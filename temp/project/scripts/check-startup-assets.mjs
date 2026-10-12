import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=path.join(root,'remotion-startup/asset-manifest.json');
const files=['remotion-startup/src/Composition.tsx','remotion-startup/src/Root.tsx','remotion-startup/src/index.ts','src/assets/schoolwork-startup.mp4','src/assets/schoolwork-startup-poster.jpg'];
const hashes={};
try {
  for(const file of files){const data=await fs.readFile(path.join(root,file));const content=file.endsWith('.ts')||file.endsWith('.tsx')?data.toString('utf8').replace(/\r\n/g,'\n'):data;hashes[file]=createHash('sha256').update(content).digest('hex');}
  const version=JSON.parse(await fs.readFile(path.join(root,'remotion-startup/package.json'),'utf8')).dependencies.remotion;
  const current={remotionVersion:version,sha256:hashes};
  if(process.argv.includes('--write'))await fs.writeFile(manifestPath,JSON.stringify(current,null,2)+'\n');
  else if(JSON.stringify(JSON.parse(await fs.readFile(manifestPath,'utf8')))!==JSON.stringify(current))throw new Error('Startup source and rendered assets differ.');
  console.log('Startup assets match their composition and pinned Remotion version.');
} catch(error) {
  console.error(String(error.message)+' Run npm run animation:render after installing the animation dependencies.');process.exitCode=1;
}
