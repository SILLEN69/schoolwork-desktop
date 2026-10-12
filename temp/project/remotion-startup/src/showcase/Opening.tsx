import {useCurrentFrame,interpolate} from 'remotion';
import {Button,C,Layout,Pointer,Tabs,Window,clamp} from './Shared';
export function Opening(){
 const f=useCurrentFrame(),live=f>=42;
 return <Layout title="Less note-taking." accent="More learning."><Window>
 <div style={{fontSize:24,color:C.muted,letterSpacing:2,marginBottom:20}}>ENGLISH / LESSON STUDIO</div>
 <div style={{fontSize:48,fontWeight:600,lineHeight:1.15,marginBottom:35}}>Persuasive writing</div>
 <Tabs active="Notes"/>
 <div style={{height:230,display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'#141a16',borderRadius:18}}>{Array.from({length:38},(_,i)=><div key={i} style={{width:10,borderRadius:10,background:live?C.lime:'#485448',height:live?24+Math.abs(Math.sin(f*.28+i*.72))*105:18+Math.sin(i*.9)**2*25}}/>)}</div>
 <div style={{fontSize:32,color:live?C.lime:C.muted,marginTop:28,marginBottom:42}}>{live?'● Listening to the lesson':'Ready when you are'}</div>
 <div style={{scale:interpolate(f,[41,44,48],[1,.97,1],clamp),transformOrigin:'130px 36px'}}><Button>{live?'Pause':'Start recording'}</Button></div>
 <Pointer points={[{frame:0,x:580,y:480},{frame:20,x:530,y:480},{frame:40,x:160,y:650},{frame:59,x:160,y:650}]} clicks={[42]}/>
 </Window></Layout>;
}
