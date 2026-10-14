import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ProjectorDiagnostics} from './projectorDiagnostics';
it('persists useful beta events but drops PINs, URLs, identities and arbitrary errors',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-projector-log-'));
  try {
    const log=new ProjectorDiagnostics(root,'0.11.0-beta.6',true);
    log.record('connect.phase',{phase:'signin',code:'001234',url:'https://school.invalid/?token=secret',email:'private@example.com',reason:'some private failure'});
    log.record('board.refresh',{httpStatus:503,durationMs:500,active:false});
    log.record('unknown-event',{reason:'network'});
    const report=await log.export();
    expect(report.events).toHaveLength(2);
    expect(report.events[0]).toMatchObject({event:'connect.phase',details:{phase:'signin'}});
    expect(JSON.stringify(report)).not.toMatch(/001234|token=|private@example|some private/);
    const reopened=new ProjectorDiagnostics(root,'0.11.0-beta.6',true);
    expect((await reopened.export()).events).toHaveLength(2);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
it('cannot log or export in stable builds even when requested',async()=>{
  const root=path.join(os.tmpdir(),'schoolwork-disabled-log-'+Date.now());
  const log=new ProjectorDiagnostics(root,'0.11.0',true);
  log.record('connect.start',{outcome:'started'});
  expect(log.enabled).toBe(false);
  await expect(log.export()).rejects.toThrow('only in beta');
  await expect(fs.stat(root)).rejects.toThrow();
});
it('diagnostic write failures do not fail the operation and remain exportable',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-log-write-'));
  try{
    const file=path.join(root,'not-a-directory');await fs.writeFile(file,'fixture');
    const log=new ProjectorDiagnostics(file,'0.11.0-beta.6',true);
    expect(()=>log.record('connect.finish',{outcome:'failed',reason:'network'})).not.toThrow();
    expect((await log.export()).events).toHaveLength(1);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
