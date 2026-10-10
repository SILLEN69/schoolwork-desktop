import {expect,it} from 'vitest';
import {detectSubject,mergeLessonTasks,transcriptText,emptyAnalysis,type LessonTask,type LessonSession} from './lesson';
const task=(id:string,title:string,details=title):LessonTask=>({id,title,details,evidence:details,kind:'assignment',dueDate:'2026-10-13'});
it('merges reading recaps and preserves completed/calendar identity, but not different page ranges',()=>{
  const old={...task('stable','Läs sidor 23 till 76'),completed:true,calendarEventId:'sc123'};
  const merged=mergeLessonTasks([task('generated','Läs sidor 23 till 76'),task('again','Läs sidor 23 till 76'),task('vague','Övning till nästa tisdag'),task('seminar','Seminarium om lästexten')],[old],()=> 'new');
  expect(merged).toHaveLength(2);expect(merged[0]).toMatchObject({id:'stable',completed:true,calendarEventId:'sc123'});
  expect(mergeLessonTasks([task('a','Läs sidor','23 till 76'),task('b','Läs sidor','80 till 90')],[],()=>crypto.randomUUID())).toHaveLength(2);
});
it('does not transfer a calendar event just because the model recycled an id',()=>{
 const old={...task('same','Läs romanen'),calendarEventId:'sc123'};
 const result=mergeLessonTasks([task('same','Skriv labbrapport')],[old],()=> 'fresh');
 expect(result[0]).toMatchObject({id:'fresh'});expect(result[0].calendarEventId).toBeUndefined();expect(result[1]).toEqual(old);
});
it('groups by school subject, not Whisper language',()=>{
 expect(detectSubject('Hej välkommen till svenska lektionen')).toBe('Svenska');
 expect(detectSubject('Vi löser ekvationer')).toBe('Matematik');expect(detectSubject('Physics today')).toBe('Fysik');expect(detectSubject('Hello everyone')).toBe('Övrigt');
});
it('joins only actual overlapping boundaries and invalidates AI tidying when new audio arrives',()=>{
 const s:LessonSession={id:'s',title:'Lesson',mode:'lesson',language:'sv',createdAt:0,updatedAt:0,revision:2,pending:[],analysis:emptyAnalysis(),analysedRevision:0,segments:[{id:'1',start:0,duration:22,text:'Vi läser sida 23 till',language:'sv',model:'whisper'},{id:'2',start:20,duration:22,text:'sida 23 till 76 innan tisdag.',language:'sv',model:'whisper'}]};
 expect(transcriptText(s)).toBe('Vi läser sida 23 till 76 innan tisdag.');
 s.segments[1].start=22;expect(transcriptText(s)).toContain('till sida 23 till');
 s.refinedTranscript={text:'Tidied original',revision:2};expect(transcriptText(s)).toBe('Tidied original');s.revision++;expect(transcriptText(s)).not.toBe('Tidied original');
});
