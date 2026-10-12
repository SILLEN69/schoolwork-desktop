import {interpolate,useCurrentFrame} from 'remotion';
import {C,Layout,Logo,Pointer,Tick,Window,clamp} from './Shared';
export function Work(){const f=useCurrentFrame();return <Layout title="Build. Test." accent="Deliver."><Window title="Work / English revision">
 {f<30?<><div style={{display:'flex',justifyContent:'flex-end'}}><div style={{borderRadius:'22px 22px 5px 22px',background:'#292f2b',padding:28,fontSize:38,lineHeight:1.3,maxWidth:660}}>Build a revision page<br/>from this lesson.</div></div><div style={{display:'flex',gap:20,marginTop:45,alignItems:'center'}}><Logo size={44}/><div style={{fontSize:28,color:C.lime}}>Creating your revision page…</div></div></>:f<90?<>
 <div style={{display:'flex',gap:22,marginBottom:35,fontSize:27,color:C.muted}}><span style={{color:C.lime}}>Activity</span><span>Files</span><span>Preview</span></div>
 {['Editing index.html','Editing styles.css','Editing script.js'].map((item,i)=><div key={item} style={{display:'flex',gap:22,fontSize:31,padding:'23px 0',borderBottom:`1px solid ${C.line}`,opacity:interpolate(f,[30+i*5,35+i*5],[0,1],clamp)}}><span style={{color:C.lime}}><Tick size={29}/></span>{item}</div>)}
 <div style={{fontFamily:'Consolas, monospace',fontSize:26,padding:27,background:'#111614',borderRadius:14,marginTop:35,lineHeight:1.7}}><span style={{color:C.muted}}>$ npm test</span><br/><span style={{color:C.lime,opacity:interpolate(f,[60,67],[0,1],clamp)}}>✓ Quiz logic passed<br/>✓ All checks passed</span></div>
 </>:<div style={{height:728,borderRadius:14,overflow:'hidden',background:'#f2f3e8',color:'#203421',padding:38,boxSizing:'border-box'}}>
 <div style={{fontSize:22,letterSpacing:2,color:'#61775c',marginBottom:20}}>YOUR ENGLISH REVISION</div><div style={{fontSize:48,fontWeight:600,lineHeight:1.1,marginBottom:27}}>The art of<br/>persuasion.</div>
 <div style={{display:'flex',gap:12,marginBottom:34}}>{['Ethos','Pathos','Logos'].map(x=><div key={x} style={{fontSize:27,background:'#dce4cb',borderRadius:10,padding:'15px 20px'}}>{x}</div>)}</div>
 <div style={{fontSize:31,lineHeight:1.3,fontWeight:500,marginBottom:23}}>Which appeal uses emotion?</div>{['Ethos','Pathos','Logos'].map((item,i)=><div key={item} style={{fontSize:28,border:'1px solid #bdcbb0',borderRadius:10,padding:'15px 23px',marginBottom:10,background:f>=125&&i===1?'#c5e09e':'#e9eddf'}}>{item}{f>=125&&i===1&&<span style={{float:'right'}}><Tick size={26}/></span>}</div>)}
 {f>=126&&<div style={{color:'#3f7234',fontSize:25,marginTop:15}}>Correct. Pathos appeals to emotion.</div>}
 <Pointer points={[{frame:0,x:620,y:550},{frame:90,x:620,y:550},{frame:123,x:230,y:505},{frame:149,x:230,y:505}]} clicks={[125]}/>
 </div>}
 </Window></Layout>;}
