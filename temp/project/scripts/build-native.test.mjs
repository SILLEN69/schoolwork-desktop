import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
test('a terminated native compiler fails the build instead of accepting an old helper',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork compiler guard '));
  try {
    const preload=path.join(root,'terminated.cjs');
    await fs.writeFile(preload,"require('node:child_process').spawnSync=()=>({status:null,signal:'SIGTERM'});require('node:module').syncBuiltinESMExports();");
    await assert.rejects(run(process.execPath,['--require',preload,path.resolve('scripts/build-native.mjs')],{cwd:root,env:{...process.env,SCHOOLWORK_CSC:'synthetic-compiler',SCHOOLWORK_FRAMEWORK_REFERENCES:root}}),error=>/Native compiler did not finish/.test(error.stderr));
    await assert.rejects(fs.access(path.join(root,'dist-native/build.json')));
  } finally {assert.equal(path.dirname(root),os.tmpdir());await fs.rm(root,{recursive:true,force:true});}
});
