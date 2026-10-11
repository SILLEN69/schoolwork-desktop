import {expect,it} from 'vitest';
import {pointerFrame,pointerPosition,pointerText} from './pointerGeometry';
it('keeps cursor coordinates exact and overlay inside negative-origin and edge displays',()=>{
  const display={x:-1920,y:-200,width:1920,height:1080};
  for(const point of [{x:-1900,y:-180},{x:-1,y:879},{x:-900,y:400}]){
    const frame=pointerFrame(point,display);
    expect(frame.bounds.x).toBeGreaterThanOrEqual(display.x);expect(frame.bounds.y).toBeGreaterThanOrEqual(display.y);
    expect(frame.bounds.x+frame.bounds.width).toBeLessThanOrEqual(display.x+display.width);
    expect(frame.bounds.y+frame.bounds.height).toBeLessThanOrEqual(display.y+display.height);
    expect(frame.bounds.x+frame.cursor.x).toBe(point.x);expect(frame.bounds.y+frame.cursor.y).toBe(point.y);
  }
});
it('moves smoothly between endpoints instead of jumping at intermediate frames',()=>{
  const from={x:0,y:0},to={x:1000,y:500};
  expect(pointerPosition(from,to,0)).toEqual(from);expect(pointerPosition(from,to,1)).toEqual(to);
  expect(pointerPosition(from,to,.25)).toEqual({x:156,y:78});expect(pointerPosition(from,to,.5)).toEqual({x:500,y:250});
});
it('bounds bubble output and excludes private reasoning and code blocks',()=>{
  expect(pointerText('<think>private</think> I will click Calendar')).toBe('I will click Calendar');
  expect(pointerText('<think>unfinished private')).toBe('');
  expect(pointerText('```secret code``` Next action')).toBe('Next action');
  expect(pointerText('a'.repeat(500))).toHaveLength(280);
});
