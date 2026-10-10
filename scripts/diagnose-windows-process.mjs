import {spawn} from 'node:child_process';
if(process.platform!=='win32') throw new Error('This diagnostic requires Windows.');
const restricted=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','PATH','PATHEXT','APPDATA','LOCALAPPDATA','HOME','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const simple="Write-Output 'diagnostic-ok'";
const wrapped="$ErrorActionPreference='Stop'; try { & { Write-Output 'diagnostic-ok'\n }; if ($LASTEXITCODE -ne $null) { exit $LASTEXITCODE } } catch { [Console]::Error.WriteLine($_); exit 1 }";
const groups={
  shell:['ComSpec'],
  modules:['PSModulePath'],
  system:['ALLUSERSPROFILE','ProgramData','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','CommonProgramW6432','ProgramW6432','SystemDrive'],
  user:['USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH'],
  processor:['NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','PROCESSOR_IDENTIFIER','PROCESSOR_LEVEL','PROCESSOR_REVISION'],
};
const withKeys=keys=>({...restricted,...Object.fromEntries(keys.filter(k=>process.env[k]).map(k=>[k,process.env[k]]))});
const cases=Object.entries(groups).map(([name,keys])=>[name,wrapped,withKeys(keys),'ignore']);
cases.push(['all-system-groups',wrapped,withKeys(Object.values(groups).flat()),'ignore']);
for(const [name,command,env,stdin] of cases) {
 await new Promise(resolve=>{
  const started=Date.now();let stdout='',stderr='',done=false,exited=false;
  const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{env,windowsHide:true,stdio:[stdin,'pipe','pipe']});
  child.stdin?.end();child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const finish=(event,code)=>{if(done)return;done=true;clearTimeout(timer);child.stdout.destroy();child.stderr.destroy();console.log('::notice::'+JSON.stringify({name,event,code,exited,ms:Date.now()-started,stdout:stdout.slice(0,300),stderr:stderr.slice(0,300)}));resolve();};
  child.on('exit',()=>{exited=true;});child.on('close',c=>finish('close',c));child.on('error',e=>finish('error',e.code));
  const timer=setTimeout(()=>{child.kill();finish('timeout',null);},8000);
 });
}
