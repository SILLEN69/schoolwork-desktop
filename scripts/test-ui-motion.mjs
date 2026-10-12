import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const data=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork motion '));
const out=path.resolve('work/motion-verification');await fs.mkdir(out,{recursive:true});
let app;
try {
  app=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[path.resolve('scripts/test-app.cjs'),'--user-data-dir='+data],env:{...process.env,SCHOOLWORK_TEST_DATA:data,SCHOOLWORK_TEST_EXE:process.execPath},timeout:30000});
  app.process().stderr.on('data',chunk=>process.stderr.write(chunk));
  const page=await app.firstWindow();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.locator('.startup-splash').waitFor();
  assert.equal(await page.locator('.shell').evaluate(node=>node.inert),true);
  await page.waitForFunction(()=>{const video=document.querySelector('.startup-media');return video instanceof HTMLVideoElement&&video.currentTime>0.1&&!video.paused&&video.muted;});
  await page.waitForFunction(()=>document.querySelector('video.startup-media')?.currentTime>=2.25);
  await page.screenshot({path:path.join(out,'startup.png')});
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:5000});
  assert.equal(await page.locator('.shell').evaluate(node=>node.inert),false);
  await page.getByRole('button',{name:/New task/}).click();assert.equal(await page.locator('.startup-splash').count(),0);
  const replay=async()=>{await page.getByRole('button',{name:/Settings/}).first().click();await page.getByRole('button',{name:'Preview startup animation',exact:true}).click();await page.locator('.startup-splash').waitFor();};
  await replay();await page.keyboard.press('Escape');await page.locator('.startup-splash').waitFor({state:'detached',timeout:1000});
  await replay();await page.locator('video.startup-media').evaluate(video=>video.dispatchEvent(new Event('error')));
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:1000});
  await replay();await page.locator('video.startup-media').evaluate(video=>video.pause());
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:5000});
  await page.emulateMedia({reducedMotion:'reduce'});await replay();
  assert.equal(await page.locator('video.startup-media').count(),0);assert.equal(await page.locator('img.startup-media').count(),1);
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:1200});
  await page.getByRole('button',{name:/Settings/}).first().click();
  assert.equal(await page.locator('.settings-modal').evaluate(node=>getComputedStyle(node).animationName),'none');
  await page.screenshot({path:path.join(out,'reduced-motion-settings.png')});assert.deepEqual(errors,[]);
  console.log('PASS: local muted video plays, completes once, keeps background inert, skips by keyboard, exits on media failure/stall, and honors reduced motion.');
} finally {await app?.close();}
