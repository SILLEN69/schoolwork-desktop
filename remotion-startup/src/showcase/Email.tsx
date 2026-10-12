import {interpolate,useCurrentFrame} from 'remotion';
import {Button,C,Layout,Pointer,Tick,Window,clamp} from './Shared';
export function Email(){const f=useCurrentFrame(),sent=f>=123;return <Layout title="Beyond" accent="the chat."><Window title="Gmail" light>
 <div style={{fontSize:26,color:'#667589',marginBottom:22}}>New message</div>
 <div style={{fontSize:28,borderBottom:'1px solid #dbe2ea',paddingBottom:20}}>To <span style={{display:'inline-block',padding:'8px 23px',borderRadius:30,background:'#e3ebf7',marginLeft:14}}>Me</span></div>
 <div style={{fontSize:31,fontWeight:600,padding:'24px 0',borderBottom:'1px solid #dbe2ea'}}>English lesson summary</div>
 <div style={{fontSize:31,lineHeight:1.5,paddingTop:25}}>Here's what we covered:<br/><br/><b>Ethos</b> — credibility<br/><b>Pathos</b> — emotion<br/><b>Logos</b> — logic<br/><br/>Assignment: 300-word paragraph.<br/>Due Friday, 16 October.</div>
 <div style={{position:'absolute',left:40,bottom:45,opacity:sent?.55:1}}><Button blue width={155}>Send</Button></div>
 {!sent&&<Pointer points={[{frame:0,x:625,y:420},{frame:62,x:590,y:455},{frame:109,x:103,y:698},{frame:120,x:103,y:698},{frame:179,x:103,y:698}]} clicks={[120]} bubble={f>=67?'I’ll send your lesson summary.':undefined}/>}
 {sent&&<div style={{position:'absolute',left:235,right:40,bottom:49,display:'flex',gap:18,alignItems:'center',background:'#25312a',color:'#ebf4ec',padding:'20px 24px',borderRadius:12,fontSize:30,opacity:interpolate(f,[123,130],[0,1],clamp)}}><span style={{color:C.lime}}><Tick size={30}/></span>Message sent</div>}
 </Window></Layout>;}
