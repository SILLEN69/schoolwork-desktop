// Run before publishing: node scripts/verify-release.cjs <electron-builder output directory>
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'release');
const version=require('../package.json').version;
const manifest=fs.readFileSync(path.join(root,'latest.yml'),'utf8');
const setup=`SchoolWork-${version}-x64-setup.exe`;
assert.match(manifest,new RegExp('^version: '+version.replaceAll('.','\\.')+'\\s*$','m'));
assert.equal(manifest.match(/^path: (.+)$/m)?.[1].trim(),setup);
assert.equal(manifest.match(/- url: (.+)/)?.[1].trim(),setup);
for(const name of [setup,setup+'.blockmap',`SchoolWork-${version}-x64-portable.exe`])assert(fs.statSync(path.join(root,name)).size>0,`Missing asset: ${name}`);
const bytes=fs.readFileSync(path.join(root,setup));
assert.equal(Number(manifest.match(/size: (\d+)/)?.[1]),bytes.length);
const expected=crypto.createHash('sha512').update(bytes).digest('base64');
const hashes=[...manifest.matchAll(/sha512: (\S+)/g)].map(m=>m[1]);
assert(hashes.length>=2 && hashes.every(hash=>hash===expected),'Update manifest must match the actual installer');
console.log(`PASS: ${version} installer, portable, blockmap and update manifest are complete; installer SHA-512 matches.`);
