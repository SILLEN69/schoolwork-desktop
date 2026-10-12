import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill,renderMedia} from '@remotion/renderer';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const output=path.resolve('../../showcase');
const edition=process.argv.find(a=>a.startsWith('--edition='))?.slice(10)??'';
if(edition&&!/^[a-z0-9-]{1,32}$/.test(edition))throw new Error('Invalid edition name');
const suffix=edition?`-${edition}`:'';
const framesDir=path.join(output,`launch-frames${suffix}`);
await mkdir(framesDir,{recursive:true});
const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public'),outDir:path.join(output,`launch-bundle${suffix}`)});
const compositionId=process.argv.find(a=>a.startsWith('--composition='))?.slice(14)??'SchoolWorkLaunchAd';
const composition=await selectComposition({serveUrl,id:compositionId});
if(process.argv.includes('--stills')){
 const requested=process.argv.find(a=>a.startsWith('--frames='));
 const frames=requested?requested.slice(9).split(',').map(Number):[45,164,273,382,487,615,655,777,858,959,992,1019];
 for(const frame of frames){await renderStill({serveUrl,composition,frame,output:path.join(framesDir,`${frame}.png`),imageFormat:'png'});console.log(`Frame ${frame}`);}
}else{
 let last=-1;
 const raw=path.join(output,`SchoolWork-Launch-Ad-Landscape${suffix}-raw.mp4`);
 const final=path.join(output,`SchoolWork-Launch-Ad-Landscape${suffix}.mp4`);
 await renderMedia({serveUrl,composition,codec:'h264',audioCodec:'aac',audioBitrate:'192k',crf:17,concurrency:2,pixelFormat:'yuv420p',outputLocation:raw,onProgress:({progress})=>{const n=Math.floor(progress*10);if(n>last){last=n;console.log(`Rendering ${n*10}%`);}}});
 const ffmpeg=path.resolve('node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
 const result=spawnSync(ffmpeg,['-hide_banner','-v','error','-y','-i',raw,'-t','34','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',final],{windowsHide:true,encoding:'utf8'});
 if(result.status!==0)throw new Error(result.stderr);
 await writeFile(path.join(output,`launch-render-info${suffix}.json`),JSON.stringify({file:final,composition:compositionId,width:1920,height:1080,fps:30,frames:1020,duration:34,dropFrame:992,music:'User-provided track, original speed, fade 33.05–34 seconds',effects:'Downloaded Kenney and Mixkit stock effects; no generated sound effects',screens:'Animated UI; no actual email or Calendar actions performed',publication:'Local only'},null,2));
 console.log(`Rendered: ${final}`);
}
