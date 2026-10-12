import {spawnSync} from 'node:child_process';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const dir=path.resolve('../../showcase');
const bin=path.resolve('node_modules/@remotion/compositor-win32-x64-msvc');
function run(exe,args){const result=spawnSync(path.join(bin,exe+'.exe'),args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(result.status!==0)throw new Error(result.stderr||result.error?.message||'Media tool failed');return result;}
const manifest=[];
for(const format of ['Portrait','Landscape']){
 const name=`SchoolWork-30s-${format}.mp4`,file=path.join(dir,name);
 const master=run('ffmpeg',['-hide_banner','-y','-i',path.join(dir,`SchoolWork-30s-${format}-raw.mp4`),'-t','30','-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',file]);
 await writeFile(path.join(dir,format+'-master.log'),master.stderr);
 const metadata=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames,sample_rate,channels','-of','json',file]).stdout);
 const video=metadata.streams.find(stream=>stream.codec_type==='video'),audio=metadata.streams.find(stream=>stream.codec_type==='audio');
 if(Number(metadata.format.duration)!==30||Number(video.nb_frames)!==900||audio.channels!==2||audio.sample_rate!=='48000')throw new Error('Export specifications do not match');
 const decode=run('ffmpeg',['-hide_banner','-v','error','-err_detect','explode','-i',file,'-c:v','libx264','-preset','ultrafast','-c:a','pcm_s16le','-f','null','-']);
 await writeFile(path.join(dir,format+'-decode-check.log'),decode.stderr);
 await writeFile(path.join(dir,format+'-metadata.json'),JSON.stringify(metadata,null,2));
 manifest.push({name,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),duration:30,frames:900,dimensions:[video.width,video.height],audio:'Stereo AAC, 48 kHz'});
 console.log('Final verified export: '+name);
}
await writeFile(path.join(dir,'exports.json'),JSON.stringify(manifest,null,2));
