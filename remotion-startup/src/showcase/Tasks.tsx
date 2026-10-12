import {interpolate,useCurrentFrame} from 'remotion';
import {Button,C,Layout,Pointer,Tabs,Window,clamp} from './Shared';
export function Tasks(){const f=useCurrentFrame();return <Layout title="Know what" accent="comes next."><Window>
 <div style={{fontSize:40,fontWeight:600,marginBottom:25}}>Persuasive writing</div><Tabs active="Tasks"/>
 <div style={{fontSize:23,letterSpacing:2,color:C.muted,marginBottom:18}}>ASSIGNMENT</div>
 <div style={{border:`2px solid ${C.line}`,borderRadius:18,padding:32,opacity:interpolate(f,[4,14],[0,1],clamp),translate:interpolate(f,[4,18],['0px 25px','0px 0px'],clamp)}}>
 <div style={{fontSize:44,fontWeight:600,lineHeight:1.22}}>Write a persuasive<br/>paragraph</div><div style={{fontSize:30,color:C.muted,marginTop:22}}>300 words · English</div>
 <div style={{fontSize:33,color:C.lime,marginTop:30,marginBottom:36}}>Due Friday, 16 October</div><Button width={330}>Add to Calendar ↗</Button>
 </div><div style={{fontSize:26,color:C.muted,marginTop:34}}>What the teacher said ›</div>
 <Pointer points={[{frame:0,x:510,y:230},{frame:12,x:210,y:140},{frame:20,x:210,y:140},{frame:78,x:220,y:635},{frame:89,x:220,y:635}]} clicks={[12,84]}/>
 </Window></Layout>;}
