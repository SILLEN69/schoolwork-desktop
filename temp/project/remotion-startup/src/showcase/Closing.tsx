import {AbsoluteFill,Interactive,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {C,Logo,clamp,ease} from './Shared';
export function Closing(){const f=useCurrentFrame(),{width,height}=useVideoConfig(),portrait=height>width;return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:'Segoe UI, Arial, sans-serif',alignItems:'center',justifyContent:'center'}}>
 <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 43%, #314a2980, transparent 62%)'}}/>
 <Interactive.Div name="SchoolWork closing mark" style={{scale:interpolate(f,[0,20],[.82,1],{...clamp,easing:ease}),opacity:interpolate(f,[0,10],[0,1],clamp),marginBottom:45}}><Logo size={portrait?180:150}/></Interactive.Div>
 <Interactive.Div name="Brand" style={{fontSize:portrait?108:116,fontWeight:650,letterSpacing:-5,opacity:interpolate(f,[4,17],[0,1],clamp)}}>SchoolWork</Interactive.Div>
 <Interactive.Div name="Tagline" style={{fontSize:portrait?48:48,marginTop:26,color:C.lime,opacity:interpolate(f,[12,23],[0,1],clamp)}}>From lesson to action.</Interactive.Div>
 <Interactive.Div name="Call to action" style={{fontSize:31,marginTop:70,color:C.muted,opacity:interpolate(f,[20,30],[0,1],clamp)}}>Follow for beta updates.</Interactive.Div>
 <div style={{position:'absolute',bottom:portrait?155:60,fontSize:22,color:'#94a18f'}}>Windows beta · TeachGPT access required</div>
 </AbsoluteFill>;}
