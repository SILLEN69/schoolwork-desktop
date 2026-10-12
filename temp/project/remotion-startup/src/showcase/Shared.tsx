import React from 'react';
import {AbsoluteFill,Easing,Interactive,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';

export const C={bg:'#111614',panel:'#191f1c',line:'#303a33',text:'#edf0e8',muted:'#a0aea3',lime:'#d3ec95'};
export const ease=Easing.bezier(.16,1,.3,1);
export const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
// Exact taskbar-reference vector: https://github.com/electron/website/blob/main/static/assets/img/logo.svg
// Copyright (c) 2024 Contributors to the Electron project. Apache-2.0; full notice: public/schoolwork-atom.LICENSE.txt.
// Adapted only to JSX with optional frame-driven orbit assembly; the original SVG is retained in public/.
export function Logo({size=52,progress=1}:{size?:number;progress?:number}){
 const reveal=(delay:number)=>Math.max(0,Math.min(1,(progress-delay)/(1-delay)));
 return <svg width={size} height={size} viewBox="0 0 128 128" fill="none" role="img" aria-label="SchoolWork atom" style={{display:'block',flexShrink:0}}>
<circle cx="64" cy="64" r="64" fill="#2F3242"/>
<g opacity={reveal(0)}><path d="M51.3954 39.5028C52.3733 39.6812 53.3108 39.033 53.4892 38.055C53.6676 37.0771 53.0194 36.1396 52.0414 35.9612L51.3954 39.5028ZM28.6153 43.5751L30.1748 44.4741L30.1748 44.4741L28.6153 43.5751ZM28.9393 60.9358C29.4332 61.7985 30.5329 62.0976 31.3957 61.6037C32.2585 61.1098 32.5575 60.0101 32.0636 59.1473L28.9393 60.9358ZM37.6935 66.7457C37.025 66.01 35.8866 65.9554 35.1508 66.6239C34.415 67.2924 34.3605 68.4308 35.029 69.1666L37.6935 66.7457ZM53.7489 81.7014L52.8478 83.2597L53.7489 81.7014ZM96.9206 89.515C97.7416 88.9544 97.9526 87.8344 97.3919 87.0135C96.8313 86.1925 95.7113 85.9815 94.8904 86.5422L96.9206 89.515ZM52.0414 35.9612C46.4712 34.9451 41.2848 34.8966 36.9738 35.9376C32.6548 36.9806 29.0841 39.1576 27.0559 42.6762L30.1748 44.4741C31.5693 42.0549 34.1448 40.3243 37.8188 39.4371C41.5009 38.5479 46.1547 38.5468 51.3954 39.5028L52.0414 35.9612ZM27.0559 42.6762C24.043 47.9029 25.2781 54.5399 28.9393 60.9358L32.0636 59.1473C28.6579 53.1977 28.1088 48.0581 30.1748 44.4741L27.0559 42.6762ZM35.029 69.1666C39.6385 74.24 45.7158 79.1355 52.8478 83.2597L54.6499 80.1432C47.8081 76.1868 42.0298 71.5185 37.6935 66.7457L35.029 69.1666ZM52.8478 83.2597C61.344 88.1726 70.0465 91.2445 77.7351 92.3608C85.359 93.4677 92.2744 92.6881 96.9206 89.515L94.8904 86.5422C91.3255 88.9767 85.4902 89.849 78.2524 88.7982C71.0793 87.7567 62.809 84.8612 54.6499 80.1432L52.8478 83.2597ZM105.359 84.9077C105.359 81.4337 102.546 78.6127 99.071 78.6127V82.2127C100.553 82.2127 101.759 83.4166 101.759 84.9077H105.359ZM99.071 78.6127C95.5956 78.6127 92.7831 81.4337 92.7831 84.9077H96.3831C96.3831 83.4166 97.5892 82.2127 99.071 82.2127V78.6127ZM92.7831 84.9077C92.7831 88.3817 95.5956 91.2027 99.071 91.2027V87.6027C97.5892 87.6027 96.3831 86.3988 96.3831 84.9077H92.7831ZM99.071 91.2027C102.546 91.2027 105.359 88.3817 105.359 84.9077H101.759C101.759 86.3988 100.553 87.6027 99.071 87.6027V91.2027Z" fill="#A2ECFB"/></g>
<g opacity={reveal(0.1)}><path d="M91.4873 65.382C90.8456 66.1412 90.9409 67.2769 91.7002 67.9186C92.4594 68.5603 93.5951 68.465 94.2368 67.7058L91.4873 65.382ZM99.3169 43.6354L97.7574 44.5344L99.3169 43.6354ZM84.507 35.2412C83.513 35.2282 82.6967 36.0236 82.6838 37.0176C82.6708 38.0116 83.4661 38.8279 84.4602 38.8409L84.507 35.2412ZM74.9407 39.8801C75.9127 39.6716 76.5315 38.7145 76.323 37.7425C76.1144 36.7706 75.1573 36.1517 74.1854 36.3603L74.9407 39.8801ZM53.7836 46.3728L54.6847 47.931L53.7836 46.3728ZM25.5491 80.9047C25.6932 81.8883 26.6074 82.5688 27.5911 82.4247C28.5747 82.2806 29.2552 81.3664 29.1111 80.3828L25.5491 80.9047ZM94.2368 67.7058C97.8838 63.3907 100.505 58.927 101.752 54.678C103.001 50.4213 102.9 46.2472 100.876 42.7365L97.7574 44.5344C99.1494 46.9491 99.3603 50.0419 98.2974 53.6644C97.2323 57.2945 94.9184 61.3223 91.4873 65.382L94.2368 67.7058ZM100.876 42.7365C97.9119 37.5938 91.7082 35.335 84.507 35.2412L84.4602 38.8409C91.1328 38.9278 95.7262 41.0106 97.7574 44.5344L100.876 42.7365ZM74.1854 36.3603C67.4362 37.8086 60.0878 40.648 52.8826 44.8146L54.6847 47.931C61.5972 43.9338 68.5948 41.2419 74.9407 39.8801L74.1854 36.3603ZM52.8826 44.8146C44.1366 49.872 36.9669 56.0954 32.1491 62.3927C27.3774 68.63 24.7148 75.2115 25.5491 80.9047L29.1111 80.3828C28.4839 76.1026 30.4747 70.5062 35.0084 64.5802C39.496 58.7143 46.2839 52.7889 54.6847 47.931L52.8826 44.8146Z" fill="#A2ECFB"/></g>
<g opacity={reveal(0.2)}><path d="M49.0825 87.2295C48.7478 86.2934 47.7176 85.8059 46.7816 86.1406C45.8455 86.4753 45.358 87.5055 45.6927 88.4416L49.0825 87.2295ZM78.5635 96.4256C79.075 95.5732 78.7988 94.4675 77.9464 93.9559C77.0941 93.4443 75.9884 93.7205 75.4768 94.5729L78.5635 96.4256ZM79.5703 85.1795C79.2738 86.1284 79.8027 87.1379 80.7516 87.4344C81.7004 87.7308 82.71 87.2019 83.0064 86.2531L79.5703 85.1795ZM84.3832 64.0673H82.5832H84.3832ZM69.156 22.5301C68.2477 22.1261 67.1838 22.535 66.7799 23.4433C66.3759 24.3517 66.7848 25.4155 67.6931 25.8194L69.156 22.5301ZM45.6927 88.4416C47.5994 93.7741 50.1496 98.2905 53.2032 101.505C56.2623 104.724 59.9279 106.731 63.9835 106.731V103.131C61.1984 103.131 58.4165 101.765 55.8131 99.0249C53.2042 96.279 50.8768 92.2477 49.0825 87.2295L45.6927 88.4416ZM63.9835 106.731C69.8694 106.731 74.8921 102.542 78.5635 96.4256L75.4768 94.5729C72.0781 100.235 68.0122 103.131 63.9835 103.131V106.731ZM83.0064 86.2531C85.0269 79.7864 86.1832 72.1831 86.1832 64.0673H82.5832C82.5832 71.8536 81.4723 79.0919 79.5703 85.1795L83.0064 86.2531ZM86.1832 64.0673C86.1832 54.1144 84.4439 44.922 81.4961 37.6502C78.5748 30.4436 74.3436 24.8371 69.156 22.5301L67.6931 25.8194C71.6364 27.5731 75.3846 32.1564 78.1598 39.0026C80.9086 45.7836 82.5832 54.507 82.5832 64.0673H86.1832Z" fill="#A2ECFB"/></g>
<g opacity={reveal(0.3)}><path fillRule="evenodd" clipRule="evenodd" d="M103.559 84.9077C103.559 82.4252 101.55 80.4127 99.071 80.4127C96.5924 80.4127 94.5831 82.4252 94.5831 84.9077C94.5831 87.3902 96.5924 89.4027 99.071 89.4027C101.55 89.4027 103.559 87.3902 103.559 84.9077V84.9077Z" stroke="#A2ECFB" strokeWidth="3.6" strokeLinecap="round"/></g>
<g opacity={reveal(0.4)}><path fillRule="evenodd" clipRule="evenodd" d="M28.8143 89.4027C31.2929 89.4027 33.3023 87.3902 33.3023 84.9077C33.3023 82.4252 31.2929 80.4127 28.8143 80.4127C26.3357 80.4127 24.3264 82.4252 24.3264 84.9077C24.3264 87.3902 26.3357 89.4027 28.8143 89.4027V89.4027V89.4027Z" stroke="#A2ECFB" strokeWidth="3.6" strokeLinecap="round"/></g>
<g opacity={reveal(0.5)}><ellipse cx="63.9835" cy="23.2036" rx="4.48794" ry="4.495" stroke="#A2ECFB" strokeWidth="3.6" strokeLinecap="round"/></g>
<g opacity={reveal(0.55)}><path fillRule="evenodd" clipRule="evenodd" d="M64.8501 68.0857C62.6341 68.5652 60.451 67.1547 59.9713 64.9353C59.4934 62.7159 60.9007 60.5293 63.1167 60.0489C65.3326 59.5693 67.5157 60.9798 67.9954 63.1992C68.4742 65.4186 67.066 67.6052 64.8501 68.0857Z" fill="#A2ECFB"/></g>
 </svg>;
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
export function Pointer({points,clicks=[],bubble,bubbleTop=-15}:{points:{frame:number;x:number;y:number}[];clicks?:number[];bubble?:string;bubbleTop?:number}){
 const frame=useCurrentFrame(),xs=points.map(p=>p.x),ys=points.map(p=>p.y),fs=points.map(p=>p.frame);
 const at=clicks.find(click=>frame>=click&&frame<click+20),pulse=at===undefined?0:frame-at;
 return <div style={{position:'absolute',left:interpolate(frame,fs,xs,{...clamp,easing:ease}),top:interpolate(frame,fs,ys,{...clamp,easing:ease}),zIndex:20,pointerEvents:'none'}}>
 {at!==undefined&&<div style={{position:'absolute',width:80,height:80,left:-40,top:-40,borderRadius:100,border:'3px solid #c7f173',scale:interpolate(pulse,[0,20],[.3,1.4],clamp),opacity:interpolate(pulse,[0,20],[.8,0],clamp)}}/>}
 <svg width="46" height="56" viewBox="0 0 40 48" style={{filter:'drop-shadow(0 2px 3px #16351c50)',scale:at===undefined?1:interpolate(pulse,[0,3,8],[1,.94,1],clamp),transformOrigin:'4px 3px'}}>
 <defs><linearGradient id="schoolwork-cursor" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#dcffb3"/><stop offset="1" stopColor="#a5e85d"/></linearGradient><radialGradient id="schoolwork-cursor-halo"><stop stopColor="#baf57a" stopOpacity=".25"/><stop offset="1" stopColor="#baf57a" stopOpacity="0"/></radialGradient></defs>
 <circle cx="14" cy="18" r="18" fill="url(#schoolwork-cursor-halo)"/>
 <path d="M4 3c-.5-.6-1.4-.2-1.4.6l1.7 32.1c.1 1.1 1.4 1.6 2.2.9l8.1-7.7 7.7 13.7c.5.8 1.5 1.1 2.3.6l5.2-3c.8-.5 1.1-1.5.6-2.3L23 24.2l11.1-.3c1.1 0 1.6-1.4.8-2.1L4 3Z" fill="url(#schoolwork-cursor)" stroke="#24502b" strokeWidth="1.5" strokeLinejoin="round"/>
 <path d="m5.3 6 1.4 25" stroke="#f4ffe4" strokeWidth="1.3" strokeLinecap="round" opacity=".7"/>
 </svg>
 {bubble&&<div style={{position:'absolute',left:110,top:bubbleTop,width:300,padding:'14px 18px',borderRadius:'18px 18px 18px 3px',fontSize:25,lineHeight:1.3,background:'#f1f5eadd',color:'#25301e',boxShadow:'0 4px 24px #0002'}}>{bubble}</div>}
 </div>;
}
