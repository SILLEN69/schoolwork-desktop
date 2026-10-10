import { z } from 'zod';
export const lessonTaskSchema = z.object({
  id: z.string().min(1).max(80), title: z.string().min(1).max(240),
  details: z.string().max(2000), kind: z.enum(['lesson', 'assignment']),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  evidence: z.string().min(1).max(1000),
});
export const lessonAnalysisSchema = z.object({
  title: z.string().min(1).max(160), overview: z.string().max(3000),
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
  createdAt: number; updatedAt: number; revision: number;
  segments: TranscriptSegment[]; pending: PendingAudio[];
  analysis: Omit<LessonAnalysis, 'tasks'> & { tasks: LessonTask[] };
  analysedRevision: number; analysisAt?: number; analysisError?: string;
};
export type CalendarStatus = { configured: boolean; connected: boolean; connecting: boolean; calendarId: string };
export const emptyAnalysis = (): LessonAnalysis => ({ title: '', overview: '', sections: [], tasks: [] });
export function transcriptText(session: LessonSession) { return session.segments.map(s => s.text).filter(Boolean).join('\n'); }
export function audioEnd(session: LessonSession) { return Math.max(0, ...[...session.segments, ...session.pending].map(s => s.start + s.duration)); }
export function formatAudioTime(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
export function validDate(value: string) { const d = new Date(value + 'T12:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value; }
export function nextDate(value: string) { if (!validDate(value)) throw new Error('Choose a valid date.'); const d = new Date(value + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
