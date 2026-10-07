// Focused Windows integration: real helper, disposable file picker, no provider or email.
const {app}=require('electron');
const {spawn,spawnSync}=require('node:child_process');
const {createInterface}=require('node:readline');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=process.cwd(), build=process.env.SCHOOLWORK_RECOVERY_BUILD;
if(!build)throw Error('SCHOOLWORK_RECOVERY_BUILD is required');
app.setPath('userData',path.join(build,'profile'));
app.whenReady().then(async()=>{
  let fixture,tools;
  try {
    const exe=path.join(build,'RecoveryFixture.exe');
    const csc=path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    assert.equal(spawnSync(csc,['/nologo','/target:exe','/platform:x64','/out:'+exe,'/r:System.Drawing.dll','/r:System.Windows.Forms.dll','/r:System.Web.Extensions.dll',path.join(root,'native/TestWindow.cs')],{windowsHide:true,stdio:'inherit'}).status,0);
    fixture=spawn(exe,[],{stdio:'pipe',windowsHide:false});
    const lines=[];createInterface({input:fixture.stdout}).on('line',line=>lines.push(line));
    const read=async()=>{for(let i=0;i<200;i++){if(lines.length)return lines.shift();await new Promise(r=>setTimeout(r,25));}throw Error('Fixture timeout');};
    assert.equal(await read(),'ready');fixture.stdin.write('focus\n');assert.equal(await read(),'focused');
    const {DesktopTools}=require(path.join(build,'desktopTools.js'));
    const {DesktopBridge}=require(path.join(build,'desktopBridge.js'));
    tools=new DesktopTools(new DesktopBridge(path.join(root,'dist-native/SchoolWork.DesktopBridge.exe')));
    const ctx={owner:'recovery-test',capabilities:{allApps:false,allowedApps:[exe],viewScreen:true,controlScreen:true,launchApps:true},signal:AbortSignal.timeout(45000)};
    const windows=(await tools.execute('list_windows',{},ctx)).data;
    assert.equal(windows.length,1);const main=windows[0];
    const controls=(await tools.execute('inspect_window',{windowId:main.windowId},ctx)).data.controls;
    const attach=controls.find(c=>c.name==='Attach file');assert(attach);
    let view=(await tools.execute('prepare_desktop',{windowId:main.windowId},ctx)).data;
    const clickArgs={screenshotId:view.screenshotId,x:Math.floor((attach.left-main.left+attach.width/2)*view.width/main.width),y:Math.floor((attach.top-main.top+attach.height/2)*view.height/main.height)};
    const clicked=await tools.execute('click',clickArgs,ctx);view=clicked.data;
    assert.equal(clicked.ok,true);assert.notEqual(view.window.windowId,main.windowId,'Must observe the actual file dialog');
    assert.equal(view.inputReady,true);assert(view.focusedControl.runtimeId);
    await assert.rejects(()=>tools.execute('click',clickArgs,ctx),{code:'OBSERVATION_USED'});
    // Supplying the parent while a modal is open must resolve to that dialog too.
    const prepared=(await tools.execute('prepare_desktop',{windowId:main.windowId},ctx)).data;
    assert.equal(prepared.window.windowId,view.window.windowId);
    const selectedFile=path.join(build,'attachment-example.txt');fs.writeFileSync(selectedFile,'Disposable attachment integration fixture.');
    view=(await tools.execute('key_press',{screenshotId:prepared.screenshotId,keys:'Alt+N'},ctx)).data;
    view=(await tools.execute('type_text',{screenshotId:view.screenshotId,text:selectedFile},ctx)).data;
    assert.equal(view.actionSent,true);
    await tools.execute('key_press',{screenshotId:view.screenshotId,keys:'Enter'},ctx);
    fixture.stdin.write('state\n');assert.equal(JSON.parse(await read()).text,selectedFile);
    console.log('PASS: parent → attachment dialog → focused filename entry → file selected; reused input blocked.');
    app.exitCode=0;
  } catch(e){console.error(e);app.exitCode=1;}
  finally {tools?.stop();fixture?.kill();app.exit(app.exitCode||0);}
});
