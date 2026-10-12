export type PointerPoint={x:number;y:number};
export function pointerFrame(point:PointerPoint,display:{x:number;y:number;width:number;height:number}) {
  const width=Math.min(360,display.width),height=Math.min(300,display.height);
  const x=Math.round(Math.max(display.x,Math.min(point.x-18,display.x+display.width-width)));
  const y=Math.round(Math.max(display.y,Math.min(point.y-18,display.y+display.height-height)));
  return {bounds:{x,y,width,height},cursor:{x:point.x-x,y:point.y-y}};
}
export function pointerPosition(from:PointerPoint,to:PointerPoint,progress:number):PointerPoint {
  const t=Math.max(0,Math.min(1,progress)),ease=t*t*(3-2*t);
  return {x:Math.round(from.x+(to.x-from.x)*ease),y:Math.round(from.y+(to.y-from.y)*ease)};
}
export function pointerText(value:string) {
  return value.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi,'').replace(/```[\s\S]*?(?:```|$)/g,'').replace(/\s+/g,' ').trim().slice(0,280);
}
