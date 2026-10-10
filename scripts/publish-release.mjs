import {spawnSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo=process.env.GITHUB_REPOSITORY || 'SILLEN69/schoolwork-desktop';
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const notes=`docs/release-${version.split('.').slice(0,2).join('.')}.md`;
const tag=process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || `v${version}`;
if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||tag!==`v${version}`)throw new Error('Repository/tag does not match this package.');
function gh(args){
 const result=spawnSync('gh',args,{encoding:'utf8',shell:false,maxBuffer:20*1024*1024});
 if(result.error||result.status!==0){const message=String(result.error?.message||result.stderr||result.stdout).slice(0,2000);console.error('::error::'+message.replaceAll('\r','').replaceAll('\n','%0A'));throw new Error('GitHub release operation failed.');}
 return result.stdout.trim();
}
const api=path=>JSON.parse(gh(['api',`repos/${repo}/${path}`]));
// /releases/tags/:tag only finds published releases. Enumerate authenticated
// releases to include drafts, then verify them using their numeric release ID.
const ids=gh(['api',`repos/${repo}/releases?per_page=100`,'--paginate','--jq',`.[] | select(.tag_name == "${tag}") | .id`]).split(/\r?\n/).filter(Boolean);
if(ids.length>1||ids.some(id=>!/^\d+$/.test(id)))throw new Error('Ambiguous release identity.');
const names=[`SchoolWork-${version}-x64-setup.exe`,`SchoolWork-${version}-x64-portable.exe`,`SchoolWork-${version}-x64-setup.exe.blockmap`,'latest.yml',`SHA256SUMS-${tag}.txt`];
const files=names.map(name=>`release/${name}`);
if(!ids.length){
 gh(['release','create',tag,...files,notes,'docs/workflow-0.10.md','--repo',repo,'--title',`SchoolWork ${version} — Lessons, voice & connected work`,'--notes-file',notes,'--draft','--verify-tag']);
 const createdIds=gh(['api',`repos/${repo}/releases?per_page=100`,'--paginate','--jq',`.[] | select(.tag_name == "${tag}") | .id`]).split(/\r?\n/).filter(Boolean);
 if(createdIds.length!==1||!/^\d+$/.test(createdIds[0]))throw new Error('Created draft could not be located.');
 ids.push(createdIds[0]);
}
let release=api(`releases/${ids[0]}`);
for(let i=0;i<names.length;i++){
 const name=names[i],file=files[i],hash='sha256:'+createHash('sha256').update(readFileSync(file)).digest('hex');
 let asset=release.assets.find(a=>a.name===name);
 if(!asset&&release.draft){gh(['release','upload',tag,file,'--repo',repo]);release=api(`releases/${ids[0]}`);asset=release.assets.find(a=>a.name===name);}
 if(!asset||asset.state!=='uploaded'||asset.size!==statSync(file).size||asset.digest!==hash)throw new Error(`Missing or mismatched uploaded asset: ${name}`);
}
for(const file of [notes,'docs/workflow-0.10.md']){
 const name=file.split('/').at(-1);
 if(!release.assets.some(a=>a.name===name)&&release.draft)gh(['release','upload',tag,file,'--repo',repo]);
}
if(release.draft)gh(['release','edit',tag,'--repo',repo,'--draft=false','--latest']);
const published=api(`releases/${ids[0]}`);
if(published.draft||published.prerelease)throw new Error('Release was not published as stable.');
console.log('::notice::Verified and published '+published.html_url);
