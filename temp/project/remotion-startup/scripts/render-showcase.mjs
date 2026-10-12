import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill,renderMedia} from '@remotion/renderer';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const output=path.resolve('../../showcase');await mkdir(output,{recursive:true});
const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public'),outDir:path.join(output,'bundle')});
const portrait=await selectComposition({serveUrl,id:'SchoolWorkShowcasePortrait'});
if(process.argv.includes('--stills')){
 const requested=process.argv.find(argument=>argument.startsWith('--frames='));
 const frames=requested?requested.slice(9).split(',').map(Number):[45,127,224,344,464,573,639,731,800,866];
 await mkdir(path.join(output,'frames'),{recursive:true});
 for(const frame of frames){await renderStill({serveUrl,composition:portrait,frame,output:path.join(output,'frames',`${frame}.png`),imageFormat:'png'});console.log('Verified frame '+frame);}
 const landscape=await selectComposition({serveUrl,id:'SchoolWorkShowcaseLandscape'});
 await renderStill({serveUrl,composition:landscape,frame:573,output:path.join(output,'frames','landscape.png'),imageFormat:'png'});
}else{
 for(const [id,name] of [['SchoolWorkShowcasePortrait','SchoolWork-30s-Portrait-raw.mp4'],['SchoolWorkShowcaseLandscape','SchoolWork-30s-Landscape-raw.mp4']]){
  const composition=await selectComposition({serveUrl,id});let last=-1;
  await renderMedia({serveUrl,composition,codec:'h264',audioCodec:'aac',audioBitrate:'192k',crf:17,concurrency:2,pixelFormat:'yuv420p',outputLocation:path.join(output,name),onProgress:({progress})=>{const n=Math.floor(progress*10);if(n>last){last=n;console.log(`${id}: ${n*10}%`);}}});
 }
 await writeFile(path.join(output,'render-info.json'),JSON.stringify({duration:30,fps:30,frames:900,portrait:[1080,1920],landscape:[1920,1080],audio:'Original 120 BPM procedural score and 46 synced sound-design cues',screens:'Animated product scenes approved by owner; no live sends or calendar writes'},null,2));
 const mastering=spawnSync(process.execPath,[path.resolve('scripts/master-showcase.mjs')],{stdio:'inherit',windowsHide:true});
 if(mastering.status!==0)throw new Error('Final audio mastering/export verification failed');
}
