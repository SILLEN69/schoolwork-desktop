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
  await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();
  await page.locator('.startup-splash').waitFor();
  assert.equal(await page.locator('.shell').evaluate(node=>node.inert),true);
  assert.equal(await page.locator('.startup-splash button').count(),0,'The logo intro has no visible skip button.');
  assert.equal(await page.locator('.startup-splash').evaluate(node=>document.activeElement===node),true);
  await page.waitForFunction(()=>{const video=document.querySelector('.startup-media');return video instanceof HTMLVideoElement&&video.currentTime>0.1&&!video.paused&&video.muted;});
  await page.waitForFunction(()=>{const video=document.querySelector('video.startup-media');return video instanceof HTMLVideoElement&&Number.isFinite(video.duration)&&video.currentTime>=video.duration*0.65;});
  await page.screenshot({path:path.join(out,'startup.png')});
  // Expect playback to reach the end of the current clip; the 96-frame/45fps
  // startup is about 2.13s, so do not hard-code a longer playback time.
  await page.waitForFunction(()=>{const video=document.querySelector('video.startup-media');return video instanceof HTMLVideoElement&&(video.ended||(Number.isFinite(video.duration)&&video.currentTime>=video.duration-0.05));});
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:5000});
  assert.equal(await page.locator('.shell').evaluate(node=>node.inert),false);
  await page.getByRole('button',{name:/New task/}).click();assert.equal(await page.locator('.startup-splash').count(),0);
  const replay=async()=>{await page.getByRole('button',{name:/Settings/}).first().click();await page.getByRole('button',{name:'Play startup animation',exact:true}).click();await page.locator('.startup-splash').waitFor();};
  await replay();await page.keyboard.press('Escape');await page.locator('.startup-splash').waitFor({state:'detached',timeout:1000});
  await replay();await page.locator('video.startup-media').evaluate(video=>video.dispatchEvent(new Event('error')));
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:1000});
  await replay();await page.locator('video.startup-media').evaluate(video=>video.pause());
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:5000});
  await page.emulateMedia({reducedMotion:'reduce'});await replay();
  await page.waitForFunction(()=>{const video=document.querySelector('video.startup-media');return video instanceof HTMLVideoElement&&video.currentTime>0.1&&!video.paused;});
  assert.equal(await page.locator('img.startup-media').count(),0);
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:5000});
  await page.getByRole('button',{name:/Settings/}).first().click();
  assert.equal(await page.locator('.settings-modal').evaluate(node=>getComputedStyle(node).animationName),'none');
  await page.screenshot({path:path.join(out,'reduced-motion-settings.png')});assert.deepEqual(errors,[]);
  assert.equal(await page.getByRole('button',{name:'Test Windows notification',exact:true}).count(),0);
  await page.reload();await page.locator('img.startup-media').waitFor();assert.equal(await page.locator('video.startup-media').count(),0);
  await page.locator('.startup-splash').waitFor({state:'detached',timeout:1200});
  assert.equal(await page.locator('.welcome-orb').count(),0,'The extra welcome icon is removed.');
  const star=page.locator('.brand-mark .atom-working svg g circle').first();
  const before=await star.getAttribute('cx');await page.waitForTimeout(340);
  assert.notEqual(await star.getAttribute('cx'),before,'Brand icon moves while idle even with OS reduced motion.');
  await page.getByRole('button',{name:/Settings/}).first().click();
  await page.getByRole('checkbox',{name:'Animate icons',exact:true}).uncheck();
  await page.waitForTimeout(150);const stopped=await star.getAttribute('cx');await page.waitForTimeout(340);
  assert.equal(await star.getAttribute('cx'),stopped,'The app animation setting can stop the icon.');
  await page.getByRole('checkbox',{name:'Animate icons',exact:true}).check();
  await page.waitForTimeout(340);assert.notEqual(await star.getAttribute('cx'),stopped);
  await page.reload();await page.locator('.brand-mark .atom-working').waitFor();
  const restored=await star.getAttribute('cx');await page.waitForTimeout(340);assert.notEqual(await star.getAttribute('cx'),restored,'Animation preference survives reload.');
  console.log('PASS: extra welcome icon removed; idle brand animation works with reduced motion; animation switch and persisted preference work.');
  console.log('PASS: muted intro/explicit replay plays; automatic startup respects reduced motion, explicit preview plays even with reduced motion; skip/error/stall exit, keyboard, inert UI and concise settings without notification test all pass.');
} finally {await app?.close();}
