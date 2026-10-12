import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
// Hash consistency only; actual video playback is covered by test-ui-motion.
test('asset guard tolerates checkout line endings but rejects stale source, changed media and missing files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork asset guard '));
  const cli=path.join(root,'scripts/check-startup-assets.mjs');
  const sources=['Composition.tsx','Root.tsx','index.ts'];
  try {
    for(const dir of ['scripts','remotion-startup/src','src/assets'])await fs.mkdir(path.join(root,dir),{recursive:true});
    await fs.copyFile('scripts/check-startup-assets.mjs',cli);
    for(const source of sources)await fs.writeFile(path.join(root,'remotion-startup/src',source),'source\r\nline two\r\n');
    await fs.writeFile(path.join(root,'remotion-startup/package.json'),JSON.stringify({dependencies:{remotion:'4.0.534'}}));
    const media=path.join(root,'src/assets/schoolwork-startup.mp4');
    await fs.writeFile(media,Buffer.from([0,1,2,3]));
    await fs.writeFile(path.join(root,'src/assets/schoolwork-startup-poster.jpg'),Buffer.from([4,5,6]));
    await run(process.execPath,[cli,'--write']);
    for(const source of sources)await fs.writeFile(path.join(root,'remotion-startup/src',source),'source\nline two\n');
    await run(process.execPath,[cli]);
    await fs.appendFile(path.join(root,'remotion-startup/src/Composition.tsx'),'edit');
    await assert.rejects(run(process.execPath,[cli]),error=>/Run npm run animation:render/.test(error.stderr));
    await run(process.execPath,[cli,'--write']);
    await fs.writeFile(media,Buffer.from([7,8,9]));
    await assert.rejects(run(process.execPath,[cli]),error=>/assets differ/.test(error.stderr));
    await fs.rm(media);await assert.rejects(run(process.execPath,[cli]),error=>/animation:render/.test(error.stderr));
  } finally {assert.equal(path.dirname(root),os.tmpdir());await fs.rm(root,{recursive:true,force:true});}
});
