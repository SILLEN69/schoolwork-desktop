import {_electron as electron} from 'playwright';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const data=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-pointer-ui-'));
const out=path.resolve('work/pointer-verification');await fs.mkdir(out,{recursive:true});
const modulePath=path.resolve('dist-electron/pointer-test.cjs');
await build({entryPoints:['electron/desktopPointer.ts'],outfile:modulePath,bundle:true,platform:'node',format:'cjs',external:['electron']});
let app;
try {
  app=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[path.resolve('scripts/test-pointer-app.cjs')],env:{...process.env,SCHOOLWORK_LESSON_TEST_DATA:data},timeout:30000});
  const page=await app.firstWindow();await page.waitForFunction(()=>Boolean(window.schoolwork));
  {
    const db=new DatabaseSync(path.join(data,'schoolwork.sqlite3'));
    const insert=db.prepare('INSERT INTO conversations(id,title,created_at,updated_at) VALUES(?,?,?,?)');
    for(let i=0;i<45;i++)insert.run(randomUUID(),'Recent chat '+String(i).padStart(2,'0')+' · long title to test clipping',Date.now(),Date.now()+i);
    db.close();
  }
  await page.reload();await page.waitForFunction(()=>Boolean(window.schoolwork));
  if(!await page.getByRole('region',{name:'Recent chats'}).isVisible())await page.getByRole('button',{name:'Recent tasks',exact:true}).click();
  await page.locator('.history-row').first().waitFor();assert.equal(await page.locator('.history-row').count(),45);
  const main=await app.browserWindow(page);
  for(const size of [[1200,850],[950,640]]) {
    await main.evaluate((win,[width,height])=>win.setSize(width,height),size);
    await page.waitForTimeout(150);
    const layout=await page.evaluate(()=>{
      const list=document.querySelector('.history-list'),folder=document.querySelector('.workspace-card'),profile=document.querySelector('.profile');
      const rows=[...list.querySelectorAll('.history-row')].map(row=>row.getBoundingClientRect());
      return {listHeight:list.clientHeight,listBottom:list.getBoundingClientRect().bottom,folderTop:folder.getBoundingClientRect().top,profileBottom:profile.getBoundingClientRect().bottom,height:innerHeight,scroll:list.scrollHeight>list.clientHeight,overlap:rows.some((row,i)=>i>0&&row.top<rows[i-1].bottom)};
    });
    assert.equal(layout.overlap,false);assert(layout.listBottom<=layout.folderTop);assert(layout.profileBottom<=layout.height);assert.equal(layout.scroll,true);
    assert(layout.listHeight>=90,'Recent chats must have usable space even at minimum window height');
    await page.locator('.history-list').evaluate(list=>list.scrollTop=list.scrollHeight);
    await page.getByRole('button',{name:/Recent chat 00/}).click();
    await page.waitForFunction(()=>!document.body.textContent.includes('Invalid UUID'));
    await page.screenshot({path:path.join(out,'recent-chats-'+size[0]+'.png')});
  }
  await page.getByTitle('Toggle sidebar').click();assert.equal(await page.locator('.lesson-nav').isVisible(),false);
  await page.screenshot({path:path.join(out,'collapsed-sidebar.png')});
  await page.getByTitle('Toggle sidebar').click();
  await app.evaluate(({screen},modulePath)=>{
    global.__pointerFixture=global.__pointerLoad(modulePath);
    const origin=screen.getCursorScreenPoint(),bounds=screen.getPrimaryDisplay().workArea,target=screen.dipToScreenPoint({x:Math.min(bounds.x+bounds.width-40,origin.x+120),y:Math.min(bounds.y+bounds.height-40,origin.y+80)});
    global.__pointerFixture.explain('fixture','Jag klickar på Kalender och kontrollerar resultatet.');
    global.__pointerFixturePromise=global.__pointerFixture.beforeInput('fixture','click',target,new AbortController().signal).then(()=>global.__pointerFixture.finished('fixture','click',true));
  },modulePath);
  await app.evaluate(async()=>await global.__pointerFixturePromise);
  const overlay=(await app.windows()).find(win=>win!==page&&win.url().includes('desktop-pointer.html'));assert(overlay);
  await overlay.waitForFunction(()=>document.getElementById('text').textContent.includes('Jag klickar'));
  assert.equal(await overlay.evaluate(()=>Boolean(window.schoolwork)),false,'Pointer has no privileged application API');
  const small=await overlay.locator('#bubble').boundingBox();
  await app.evaluate(()=>global.__pointerFixture.explain('fixture','Jag kontrollerar att rätt kalender är öppen och att sidan verkligen har laddats. Sedan läser jag resultatet och väljer nästa steg.'));
  await overlay.waitForFunction(()=>document.getElementById('text').textContent.startsWith('Jag kontrollerar'));
  const large=await overlay.locator('#bubble').boundingBox();assert(large.height>=small.height);
  await overlay.screenshot({path:path.join(out,'schoolwork-pointer-bubble.png'),omitBackground:true});
  await app.evaluate(()=>{
    global.__pointerFixture.explain('fixture','Checking the page content and choosing the next action. '.repeat(8));
    global.__pointerFixture.explain('fixture','Reading the current result before continuing to the next step. '.repeat(8));
  });
  await overlay.waitForFunction(()=>document.getElementById('text').textContent.length===280);
  assert.equal(await overlay.locator('#detail').count(),0,'Only public AI explanation is displayed');
  await page.waitForTimeout(1900);
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(win=>win.getTitle()==='SchoolWork AI pointer').isVisible()),true,'No idle-stage disappearance');
  assert.equal(await overlay.evaluate(()=>{
    const box=document.getElementById('bubble').getBoundingClientRect();
    return box.top>=0&&box.bottom<=innerHeight&&box.left>=0&&box.right<=innerWidth;
  }),true,'Bounded long activity text must not clip outside the transparent window');
  const focusBefore=await main.evaluate(win=>win.isFocused());assert.equal(focusBefore,true,'Overlay must not steal foreground focus');
  await app.evaluate(async({BrowserWindow})=>await global.__pointerFixture.observe(new AbortController().signal,async()=>{
    global.__pointerFixture.explain('fixture','Checking the screenshot');
    await new Promise(resolve=>setTimeout(resolve,1700));
    if(BrowserWindow.getAllWindows().find(win=>win.getTitle()==='SchoolWork AI pointer').isVisible())throw new Error('Pointer reappeared during observation');
  }));
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(win=>win.getTitle()==='SchoolWork AI pointer').isVisible()),true,'Pointer restores immediately after capture');
  await app.evaluate(async()=>{
    await global.__pointerFixture.beforeInput('fixture','key_press',{},new AbortController().signal);
    global.__pointerFixture.explain('fixture','Jag kontrollerar den nya sidan.');
  });
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(win=>win.getTitle()==='SchoolWork AI pointer').isVisible()),false,'Public updates cannot expose the pointer during native input/result capture');
  await app.evaluate(()=>global.__pointerFixture.finished('fixture','key_press',true));
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(win=>win.getTitle()==='SchoolWork AI pointer').isVisible()),true);
  await app.evaluate(()=>{global.__pointerFixture.explain('fixture','');global.__pointerFixture.explain('fixture','<think>private internal text</think>');});
  assert.equal(await overlay.locator('#text').textContent(),'Jag kontrollerar den nya sidan.','Empty/private-only deltas must not blank or reveal the public bubble');
  await app.evaluate(()=>global.__pointerFixture.stop());
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(win=>win.getTitle()==='SchoolWork AI pointer')),false);
  // Cancellation must close the overlay before a native input could be sent.
  await app.evaluate(async({screen})=>{
    const abort=new AbortController(),target=screen.dipToScreenPoint({x:300,y:300});
    const pending=global.__pointerFixture.beforeInput('cancelled','click',target,abort.signal);
    setTimeout(()=>{abort.abort();global.__pointerFixture.stop();},60);
    try{await pending;throw new Error('Expected cancellation');}catch(error){if(!abort.signal.aborted)throw error;}
  });
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(win=>win.getTitle()==='SchoolWork AI pointer')),false);
  console.log('PASS: 45 recent chats fit; public-only bubble resizes, stays through idle, restores after capture, remains hidden throughout native input/capture, does not steal focus and closes on Stop/cancellation.');
} finally {await app?.close();await fs.rm(modulePath,{force:true});}
