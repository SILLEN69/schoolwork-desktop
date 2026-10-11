import {EventEmitter} from 'node:events';
import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({supported:true,show:vi.fn(),options:[] as any[]}));
vi.mock('electron',()=>({Notification:class extends EventEmitter{
  static isSupported(){return mock.supported;}
  constructor(options:unknown){super();mock.options.push(options);}
  show(){mock.show();}
}}));
import {TaskNotifications} from './taskNotifications';
beforeEach(()=>{mock.supported=true;mock.options=[];mock.show.mockReset();});
it('notifies done and stopped errors once per outcome, keeps retries quiet, and opens the app on click',()=>{
  const open=vi.fn(),notifications=new TaskNotifications(open);
  const task={id:'task',state:'running',updatedAt:1};
  notifications.notify(task,'error');notifications.notify(task,'tool-error');notifications.notify(task,'retry');
  expect(mock.show).not.toHaveBeenCalled();
  task.state='waiting_retry';
  notifications.notify(task,'error',true);notifications.notify(task,'error',true);
  expect(mock.show).toHaveBeenCalledTimes(1);expect(mock.options[0].title).toContain('behöver hjälp');
  task.updatedAt=2;task.state='completed';
  const toast=notifications.notify(task,'answer');notifications.notify(task,'answer');
  expect(mock.show).toHaveBeenCalledTimes(2);expect(mock.options[1].title).toContain('Task complete');
  toast!.emit('click');expect(open).toHaveBeenCalledOnce();
  task.updatedAt=3;task.state='waiting_retry';notifications.notify(task,'error');
  expect(mock.show).toHaveBeenCalledTimes(3);
});
it('unsupported or broken system notifications never interrupt a task',()=>{
  const notifications=new TaskNotifications(()=>{}),task={id:'task',state:'completed',updatedAt:1};
  mock.supported=false;expect(notifications.notify(task,'answer')).toBeUndefined();expect(mock.show).not.toHaveBeenCalled();
  mock.supported=true;mock.show.mockImplementation(()=>{throw new Error('Windows notifications unavailable');});
  expect(()=>notifications.notify(task,'answer')).not.toThrow();
});
