import { z } from 'zod';
export const lessonTaskSchema = z.object({
  id: z.string().min(1).max(80), title: z.string().min(1).max(240),
  details: z.string().max(2000), kind: z.enum(['lesson', 'assignment']),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  evidence: z.string().min(1).max(1000),
});
export const lessonAnalysisSchema = z.object({
  title: z.string().min(1).max(160), overview: z.string().max(3000),
  subject: z.string().max(80).optional(),
  sections: z.array(z.object({ heading: z.string().max(160), points: z.array(z.string().max(1000)).max(12) })).max(12),
  tasks: z.array(lessonTaskSchema).max(40),
});
export type LessonAnalysis = z.infer<typeof lessonAnalysisSchema>;
export type LessonTask = z.infer<typeof lessonTaskSchema> & { completed?: boolean; calendarEventId?: string; calendarUrl?: string };
export type AudioLanguage = 'sv' | 'en';
export type AudioInput = { sessionId: string; id: string; base64: string; mime: string; name: string; start: number; duration: number; language: AudioLanguage };
export type TranscriptSegment = { id: string; start: number; duration: number; text: string; language: AudioLanguage; model: string };
export type PendingAudio = Omit<AudioInput, 'base64' | 'sessionId'> & { error?: string };
export type LessonSession = {
  id: string; title: string; mode: 'lesson' | 'transcription'; language: AudioLanguage;
  subject?: string; subjectLocked?: boolean;
  refinedTranscript?: { text: string; revision: number }; linkedChatId?: string;
  createdAt: number; updatedAt: number; revision: number;
  segments: TranscriptSegment[]; pending: PendingAudio[];
  analysis: Omit<LessonAnalysis, 'tasks'> & { tasks: LessonTask[] };
  analysedRevision: number; analysisAt?: number; analysisError?: string;
};
export type CalendarStatus = { configured: boolean; connected: boolean; connecting: boolean; calendarId: string; error?:string; driveEnabled?:boolean };
export const emptyAnalysis = (): LessonAnalysis => ({ title: '', overview: '', sections: [], tasks: [] });
export function transcriptText(session: LessonSession) {
  if (session.refinedTranscript?.revision === session.revision) return session.refinedTranscript.text;
  let text = ''; let previous: TranscriptSegment | undefined;
  for (const segment of [...session.segments].sort((a,b) => a.start-b.start)) {
    let next = segment.text.trim();
    // Only collapse repeated boundary words when the AUDIO actually overlaps.
    if (previous && segment.start < previous.start + previous.duration - .05) {
      const left = text.match(/\S+/g) || [], right = next.match(/\S+/g) || [];
      const word = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      for (let n = Math.min(30,left.length,right.length); n >= 2; n--) {
        if (left.slice(-n).map(word).join(' ') === right.slice(0,n).map(word).join(' ')) { next = right.slice(n).join(' '); break; }
      }
    }
    if (next) text += (text ? ' ' : '') + next;
    previous = segment;
  }
  return text;
}
export const lessonSubjects = ['Svenska','Matematik','Engelska','Fysik','Kemi','Biologi','Historia','Samhällskunskap','Religion','Geografi','Teknik','Övrigt'];
export function detectSubject(text: string, suggested?: string) {
  const rules: [string, RegExp][] = [['Svenska',/\b(svenska|swedish)\b/i],['Matematik',/\b(matematik|matte|mathematics|algebra|ekvationer)\b/i],['Engelska',/\b(engelska|english lesson)\b/i],['Fysik',/\b(fysik|physics)\b/i],['Kemi',/\b(kemi|chemistry)\b/i],['Biologi',/\b(biologi|biology)\b/i],['Historia',/\b(historia|history lesson)\b/i],['Samhällskunskap',/\b(samhällskunskap|civics)\b/i],['Religion',/\b(religion|religionskunskap)\b/i],['Geografi',/\b(geografi|geography)\b/i],['Teknik',/\b(tekniklektion|technology lesson)\b/i]];
  return rules.find(([,re]) => re.test(text))?.[0] || rules.find(([,re])=>re.test(suggested || ''))?.[0] || 'Övrigt';
}
const normal = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function significant(task: LessonTask) {
  return new Set(normal(task.title+' '+task.details).split(' ').filter(w => w.length>2 && !/^(ska|och|att|den|det|till|nästa|tisdag|onsdag|torsdag|fredag|måndag|uppgift|övning|the|for|next|task|exercise|innan|klart|gör|har)$/.test(w)));
}
export function sameLessonTask(a: LessonTask,b: LessonTask) {
  if (a.kind !== b.kind || (a.dueDate && b.dueDate && a.dueDate !== b.dueDate)) return false;
  // Page ranges distinguish separate reading assignments, even with similar language.
  const numbers = (t:LessonTask) => normal(t.title+' '+t.details).match(/\b\d+\b/g)?.join(',');
  if (numbers(a) && numbers(b) && numbers(a) !== numbers(b)) return false;
  if (normal(a.title) === normal(b.title) || normal(a.evidence) === normal(b.evidence)) return true;
  const x=significant(a),y=significant(b), overlap=[...x].filter(w=>y.has(w)).length;
  return overlap>=2 && overlap/Math.max(1,Math.min(x.size,y.size))>=.75;
}
export function mergeLessonTasks(incoming: LessonTask[], previous: LessonTask[], newId:()=>string): LessonTask[] {
  const tasks: LessonTask[]=[];
  for (const t of incoming) {
    const duplicate=tasks.find(o=>sameLessonTask(o,t));
    if (duplicate) continue;
    const old=previous.find(o=>sameLessonTask(o,t));
    tasks.push({...t,id:old?.id || newId(),completed:old?.completed,calendarEventId:old?.calendarEventId,calendarUrl:old?.calendarUrl});
  }
  // A vague recap ('exercise until Tuesday') is not an additional assignment.
  const specific=tasks.filter(t=>!/^\s*(övning|uppgift|exercise|homework|task)(\s+(till|until|for|by)\s+.*)?\s*$/i.test(t.title));
  const result=tasks.filter(t=>specific.includes(t) || !specific.some(o=>o.kind===t.kind && o.dueDate && o.dueDate===t.dueDate));
  for (const old of previous) if ((old.completed || old.calendarEventId) && !result.some(t=>t.id===old.id || sameLessonTask(t,old))) result.push(old);
  return result;
}
export function audioEnd(session: LessonSession) { return Math.max(0, ...[...session.segments, ...session.pending].map(s => s.start + s.duration)); }
export function formatAudioTime(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
export function validDate(value: string) { const d = new Date(value + 'T12:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value; }
export function nextDate(value: string) { if (!validDate(value)) throw new Error('Choose a valid date.'); const d = new Date(value + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
