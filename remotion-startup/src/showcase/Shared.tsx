import React from 'react';
import {AbsoluteFill,Easing,Interactive,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';

export const C={bg:'#111614',panel:'#191f1c',line:'#303a33',text:'#edf0e8',muted:'#a0aea3',lime:'#d3ec95'};
export const ease=Easing.bezier(.16,1,.3,1);
export const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
export function Logo({size=52}:{size?:number}){
 return <svg width={size} height={size} viewBox="0 0 160 160"><rect width="160" height="160" rx="35" fill="#C7F173"/><path d="M49 43h32a12 12 0 0 1 12 12v15H79a10 10 0 0 0-10 10v13H54a12 12 0 0 1-12-12V55a12 12 0 0 1 12-12Z M81 70h26a12 12 0 0 1 12 12v26a12 12 0 0 1-12 12H81a12 12 0 0 1-12-12V82a12 12 0 0 1 12-12Z" fill="none" stroke="#172016" strokeWidth="9" strokeLinejoin="round"/><circle cx="49" cy="101" r="6" fill="#172016"/><circle cx="110" cy="59" r="6" fill="#172016"/></svg>;
}
export function Tick({size=34}:{size?:number}){return <svg width={size} height={size} viewBox="0 0 32 32"><path d="m6 16 7 7L26 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
export function Button({children,blue=false,width=280}:{children:React.ReactNode;blue?:boolean;width?:number}){
 return <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,background:blue?'#a8c7fa':C.lime,color:'#192518',fontSize:32,fontWeight:650,width,height:74,borderRadius:12}}>{children}</div>;
}
export function Tabs({active}:{active:string}){
 return <div style={{display:'flex',gap:16,borderBottom:`1px solid ${C.line}`,paddingBottom:22,marginBottom:30}}>{['Notes','Tasks','Transcript'].map(tab=><div key={tab} style={{padding:'12px 20px',fontSize:30,color:tab===active?C.lime:C.muted,background:tab===active?'#293322':'transparent',borderRadius:10}}>{tab}</div>)}</div>;
}
export function Window({children,title='Lesson studio',light=false}:{children:React.ReactNode;title?:string;light?:boolean}){
 const frame=useCurrentFrame();
 return <Interactive.Div name="App window" style={{width:900,height:890,overflow:'hidden',borderRadius:24,border:`2px solid ${light?'#bfc8d5':C.line}`,background:light?'#f6f8fc':C.panel,color:light?'#243041':C.text,boxShadow:'0 30px 90px #0005',translate:interpolate(frame,[0,12],['0px 25px','0px 0px'],{...clamp,easing:ease}),opacity:interpolate(frame,[0,5],[.5,1],clamp)}}>
 <div style={{height:82,display:'flex',alignItems:'center',gap:16,padding:'0 32px',borderBottom:`1px solid ${light?'#dce3ec':C.line}`,background:light?'#edf2fa':'#141a16'}}>{light?<div style={{fontWeight:700,color:'#4285f4',fontSize:33}}>{title==='Gmail'?'M':'31'}</div>:<Logo size={38}/>}<div style={{fontSize:28,fontWeight:600}}>{title}</div><div style={{marginLeft:'auto',display:'flex',gap:8}}>{[0,1,2].map(n=><div key={n} style={{height:9,width:9,borderRadius:8,background:light?'#9ba9bd':'#526255'}}/>)}</div></div>
 <div style={{height:808,padding:40,position:'relative',boxSizing:'border-box'}}>{children}</div>
 </Interactive.Div>;
}
export function Layout({title,accent,children,tag='SCHOOLWORK'}:{title:string;accent:string;children:React.ReactNode;tag?:string}){
 const {width,height}=useVideoConfig(),frame=useCurrentFrame(),portrait=height>width;
 return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:'Segoe UI, Arial, sans-serif',overflow:'hidden'}}>
 <style>{'*{box-sizing:border-box} body{margin:0}'}</style>
 <AbsoluteFill style={{background:'radial-gradient(ellipse at 72% 68%, #25382288, transparent 63%)'}}/>
 <div style={{position:'absolute',left:portrait?90:100,top:portrait?105:80,display:'flex',alignItems:'center',gap:18,fontSize:30,fontWeight:600}}><Logo size={46}/>SchoolWork</div>
 <div style={{position:'absolute',left:portrait?90:100,top:portrait?255:350,width:portrait?900:750}}>
 <div style={{color:C.muted,fontSize:22,letterSpacing:4,marginBottom:25}}>{tag}</div>
 <Interactive.Div name="Scene headline" style={{fontSize:portrait?100:104,letterSpacing:-4,lineHeight:1.06,fontWeight:600,whiteSpace:'pre-line',translate:interpolate(frame,[0,10],['0px 18px','0px 0px'],{...clamp,easing:ease}),opacity:interpolate(frame,[0,8],[0,1],clamp)}}>{title}<br/><span style={{color:C.lime}}>{accent}</span></Interactive.Div>
 </div>
 <div style={{position:'absolute',left:portrait?90:935,top:portrait?690:110}}>{children}</div>
 <div style={{position:'absolute',left:portrait?90:100,bottom:portrait?165:78,color:C.muted,fontSize:22,letterSpacing:2}}>LESSON → ACTION</div>
 </AbsoluteFill>;
}
export function Pointer({points,clicks=[],bubble}:{points:{frame:number;x:number;y:number}[];clicks?:number[];bubble?:string}){
 const frame=useCurrentFrame(),xs=points.map(p=>p.x),ys=points.map(p=>p.y),fs=points.map(p=>p.frame);
 const at=clicks.find(click=>frame>=click&&frame<click+20),pulse=at===undefined?0:frame-at;
 return <div style={{position:'absolute',left:interpolate(frame,fs,xs,{...clamp,easing:ease}),top:interpolate(frame,fs,ys,{...clamp,easing:ease}),zIndex:20,pointerEvents:'none'}}>
 {at!==undefined&&<div style={{position:'absolute',width:80,height:80,left:-40,top:-40,borderRadius:100,border:'3px solid #c7f173',scale:interpolate(pulse,[0,20],[.3,1.4],clamp),opacity:interpolate(pulse,[0,20],[.8,0],clamp)}}/>}
 <svg width="50" height="60" viewBox="0 0 40 48" style={{filter:'drop-shadow(0 3px 4px #0005)'}}><path d="M3 2 5 38 15 29 24 44 32 39 23 24 37 23Z" fill="#C7F173" stroke="#223016" strokeWidth="2.4" strokeLinejoin="round"/><rect x="11" y="12" width="7" height="7" rx="2" fill="none" stroke="#223016" strokeWidth="1.3"/><rect x="16" y="17" width="7" height="7" rx="2" fill="none" stroke="#223016" strokeWidth="1.3"/></svg>
 {bubble&&<div style={{position:'absolute',left:110,top:-15,width:300,padding:'14px 18px',borderRadius:'18px 18px 18px 3px',fontSize:25,lineHeight:1.3,background:'#f1f5eadd',color:'#25301e',boxShadow:'0 4px 24px #0002'}}>{bubble}</div>}
 </div>;
}
