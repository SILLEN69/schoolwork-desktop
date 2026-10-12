import {interpolate,useCurrentFrame} from 'remotion';
import {C,Layout,Pointer,Tabs,Window,clamp} from './Shared';
export function Lesson(){
 const f=useCurrentFrame(),notes=f>=35;
 return <Layout title="Capture the words." accent="Keep the ideas."><Window>
 <div style={{fontSize:40,marginBottom:25,fontWeight:600}}>Persuasive writing</div><Tabs active={notes?'Notes':'Transcript'}/>
 {!notes?<><div style={{fontSize:24,color:C.lime,marginBottom:25}}>● LISTENING</div><div style={{fontSize:43,lineHeight:1.5}}>“Ethos builds credibility.<br/>Pathos appeals to emotion.<br/>Logos uses logic.”</div><div style={{marginTop:36,color:C.muted,fontSize:26}}>00:20 · Saved transcript</div></>:<>
 <div style={{fontSize:23,color:C.muted,letterSpacing:2,marginBottom:20}}>THE KEY IDEAS</div>
 {['Ethos / Credibility','Pathos / Emotion','Logos / Logic'].map((text,i)=><div key={text} style={{display:'flex',gap:24,alignItems:'center',padding:'26px 0',borderBottom:`1px solid ${C.line}`,opacity:interpolate(f,[35+i*9,43+i*9],[0,1],clamp),translate:interpolate(f,[35+i*9,50+i*9],['20px 0px','0px 0px'],clamp)}}><span style={{fontSize:25,color:C.lime}}>0{i+1}</span><div style={{fontSize:43,fontWeight:500}}>{text.split(' / ')[0]}<div style={{fontSize:30,color:C.muted,marginTop:8}}>{text.split(' / ')[1]}</div></div></div>)}
 <div style={{marginTop:34,fontSize:29,color:C.muted}}>One lesson. Organised.</div></>}
 <Pointer points={[{frame:0,x:590,y:360},{frame:15,x:540,y:330},{frame:33,x:95,y:130},{frame:89,x:95,y:130}]} clicks={[33]}/>
 </Window></Layout>;
}
