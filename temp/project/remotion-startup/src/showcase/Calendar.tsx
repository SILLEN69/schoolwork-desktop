import {useCurrentFrame,interpolate} from 'remotion';
import {Button,Layout,Pointer,Tick,Window,clamp} from './Shared';
export function Calendar(){const f=useCurrentFrame(),saved=f>=87;return <Layout title="A deadline." accent="In your calendar."><Window title="Google Calendar" light>
 {!saved?<><div style={{fontSize:24,color:'#6b7888',letterSpacing:2,marginBottom:25}}>REVIEW ASSIGNMENT</div><div style={{fontSize:46,lineHeight:1.18,fontWeight:600,marginBottom:36}}>English writing<br/>assignment</div><div style={{fontSize:25,color:'#5e6f83'}}>DATE</div><div style={{border:'2px solid #ccd6e4',borderRadius:12,padding:24,fontSize:34,margin:'15px 0 30px'}}>Friday, 16 October 2026</div><div style={{fontSize:28,color:'#5e6f83',marginBottom:46}}>Your main calendar</div><Button blue width={330}>Confirm and save</Button><Pointer points={[{frame:0,x:640,y:380},{frame:16,x:590,y:380},{frame:65,x:195,y:552},{frame:119,x:195,y:552}]} clicks={[78]}/></>:<div style={{opacity:interpolate(f,[87,97],[0,1],clamp)}}>
 <div style={{display:'flex',gap:18,alignItems:'center',fontSize:34,color:'#34734b',marginBottom:40}}><Tick/> Added to Calendar</div>
 <div style={{fontSize:27,color:'#647488',marginBottom:20}}>FRIDAY</div><div style={{fontSize:116,letterSpacing:-6,fontWeight:500}}>16<span style={{fontSize:38,letterSpacing:-1,marginLeft:25}}>October</span></div>
 <div style={{background:'#d4e4ff',borderLeft:'7px solid #5085e2',borderRadius:12,padding:30,marginTop:35,fontSize:36,fontWeight:500,lineHeight:1.2}}>English writing assignment<div style={{fontSize:25,marginTop:17,fontWeight:400,color:'#527093'}}>All day · Persuasive paragraph</div></div>
 </div>}
 </Window></Layout>;}
