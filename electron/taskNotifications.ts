import { Notification } from 'electron';

/** Notify only persisted terminal outcomes; a failed toast cannot change task state. */
export class TaskNotifications {
  private delivered=new Set<string>();
  private active=new Set<Notification>();
  constructor(private open:()=>void) {}
  notify(task:{id:string;state:string;updatedAt:number},event:string,swedish=false):Notification|undefined {
    const done=event==='answer'&&task.state==='completed';
    const failed=event==='error'&&['waiting_retry','failed'].includes(task.state);
    if(!done&&!failed)return;
    const key=`${task.id}:${event}:${task.updatedAt}`;
    if(this.delivered.has(key)||!Notification.isSupported())return;
    try {
      const toast=new Notification({
        title:swedish?(done?'SchoolWork — Uppgiften är klar':'SchoolWork — Uppgiften behöver hjälp'):(done?'SchoolWork — Task complete':'SchoolWork — Task needs attention'),
        body:swedish?(done?'Öppna SchoolWork för att se resultatet.':'Ett fel stoppade uppgiften. Framstegen är sparade; öppna SchoolWork för att försöka igen.'):(done?'Open SchoolWork to see the result.':'An error stopped the task. Progress is saved; open SchoolWork to retry.'),
        silent:false,
      });
      this.active.add(toast);
      toast.once('click',()=>{this.active.delete(toast);this.open();});
      toast.once('close',()=>this.active.delete(toast));
      toast.once('failed',()=>this.active.delete(toast));
      toast.show();this.delivered.add(key);
      if(this.delivered.size>256)this.delivered.delete(this.delivered.values().next().value!);
      return toast;
    } catch {return;}
  }
}
