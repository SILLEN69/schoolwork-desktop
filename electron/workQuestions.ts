import crypto from 'node:crypto';
import {validateWorkAnswer,type WorkQuestion,type WorkAnswer} from '../src/workQuestion';
type Store={getMetadata:(key:string)=>string|undefined;setMetadata:(key:string,value:string)=>void;updateTask:(id:string,state:any,data?:any)=>unknown};
export class WorkQuestions {
 private active=new Map<string,{question:WorkQuestion;resolve:(answer:WorkAnswer|null)=>void}>();
 constructor(private store:Store,private emit:(task:any,type:string,payload:any)=>void){}
 get(taskId:string){return this.active.get(taskId)?.question||null;}
 context(taskId:string){return this.store.getMetadata('work-question-latest:'+taskId)||'';}
 async ask(task:any,question:WorkQuestion,signal:AbortSignal):Promise<WorkAnswer|null>{
  signal.throwIfAborted();
  const signature=crypto.createHash('sha256').update((question.operationId||question.id)+JSON.stringify(question.fields)).digest('hex');
  const answerKey='work-question-answer:'+task.id+':'+signature;
  const saved=this.store.getMetadata(answerKey);
  if(saved)return saved==='null'?null:validateWorkAnswer(question,JSON.parse(saved));
  this.store.setMetadata('work-question:'+task.id,JSON.stringify(question));
  this.store.updateTask(task.id,'waiting_user');
  this.emit(task,'question',{text:question.fields[0].description||question.title,question});
  try{return await new Promise<WorkAnswer|null>((resolve,reject)=>{
   const abort=()=>{this.active.delete(task.id);reject(new Error('Task stopped. The pending question is saved.'));};
   signal.addEventListener('abort',abort,{once:true});
   this.active.set(task.id,{question,resolve:answer=>{this.store.setMetadata(answerKey,JSON.stringify(answer));signal.removeEventListener('abort',abort);resolve(answer);}});
   if(signal.aborted)abort();
  });} finally {this.active.delete(task.id);}
 }
 reply(task:any,questionId:string,input:unknown,cancel=false){
  const pending=this.active.get(task.id);
  if(!pending||pending.question.id!==questionId)throw new Error('This question is no longer active. Resume the saved task.');
  const answer=cancel?null:validateWorkAnswer(pending.question,input);
  this.store.setMetadata('work-question-latest:'+task.id,JSON.stringify({questions:pending.question.fields,answer}));
  this.store.setMetadata('work-question:'+task.id,'');
  this.store.updateTask(task.id,'running');pending.resolve(answer);
  this.emit(task,'question-answered',{text:'Your answer is saved. Continuing the task.'});
 }
}
