import {interpolate,useCurrentFrame} from 'remotion';
import {Button,C,Layout,Pointer,Window,clamp} from './Shared';
export function Ask(){const f=useCurrentFrame(),text='Summarise this English lesson\nand email it to me.',count=Math.floor(interpolate(f,[20,83],[0,text.length],clamp));return <Layout title="Ask for" accent="the outcome."><Window>
 <div style={{translate:interpolate(f,[0,17],['0px 30px','0px 0px'],{...clamp})}}>
 <div style={{fontSize:26,color:C.muted,marginBottom:25}}>ENGLISH / PERSUASIVE WRITING</div>
 <div style={{fontSize:42,fontWeight:500,marginBottom:24}}>Ask about your lesson</div><div style={{fontSize:31,color:C.muted,lineHeight:1.45,marginBottom:45}}>Your notes and transcript<br/>stay in context.</div>
 <div style={{border:`2px solid ${C.lime}`,borderRadius:18,padding:30,height:235,fontSize:38,lineHeight:1.4,whiteSpace:'pre-line',background:'#202720'}}>{text.slice(0,count)}<span style={{color:C.lime,opacity:f<92?1:0}}>▎</span></div>
 <div style={{marginTop:32}}><Button width={170}>Send ↗</Button></div>
 {f>101&&<div style={{fontSize:29,color:C.lime,marginTop:30}}>I'll prepare your summary.</div>}
 </div><Pointer points={[{frame:0,x:540,y:440},{frame:75,x:510,y:420},{frame:93,x:122,y:602},{frame:119,x:122,y:602}]} clicks={[94]}/>
 </Window></Layout>;}
