import { Notification } from 'electron';

/** Notify only persisted terminal outcomes; a failed toast cannot change task state. */
export class TaskNotifications {
  private delivered=new Set<string>();
  private active=new Set<Notification>();
  constructor(private open:(taskId:string)=>void, private report:(taskId:string,status:string)=>void=()=>{}) {}
  private record(taskId:string,status:string){try{this.report(taskId,status);}catch{/* Diagnostics must not interrupt a task. */}}
  notify(task:{id:string;state:string;updatedAt:number},event:string,swedish=false):Notification|undefined {
    const done=event==='answer'&&task.state==='completed';
    const failed=event==='error'&&['waiting_retry','failed'].includes(task.state);
    if(!done&&!failed)return;
    const key=`${task.id}:${event}:${task.updatedAt}`;
    if(this.delivered.has(key))return;
    let toast:Notification|undefined;
    try {
      if(!Notification.isSupported()){this.record(task.id,'unsupported');return;}
      this.delivered.add(key);
      toast=new Notification({
        title:swedish?(done?'SchoolWork — Uppgiften är klar':'SchoolWork — Uppgiften behöver hjälp'):(done?'SchoolWork — Task complete':'SchoolWork — Task needs attention'),
        body:swedish?(done?'Öppna SchoolWork för att se resultatet.':'Ett fel stoppade uppgiften. Framstegen är sparade; öppna SchoolWork för att försöka igen.'):(done?'Open SchoolWork to see the result.':'An error stopped the task. Progress is saved; open SchoolWork to retry.'),
        silent:false,
      });
      const currentToast=toast;
      this.active.add(toast);
      toast.once('show',()=>this.record(task.id,'accepted'));
      toast.once('click',()=>{this.active.delete(currentToast);this.record(task.id,'clicked');this.open(task.id);});
      toast.once('close',()=>this.active.delete(currentToast));
      toast.once('failed',()=>{this.active.delete(currentToast);this.delivered.delete(key);this.record(task.id,'failed');});
      toast.show();this.record(task.id,'requested');
      if(this.delivered.size>256)this.delivered.delete(this.delivered.values().next().value!);
      return toast;
    } catch {if(toast)this.active.delete(toast);this.delivered.delete(key);this.record(task.id,'failed');return;}
  }
}
