import {z} from 'zod';
export const workQuestionSchema=z.object({id:z.string().min(1).max(200),sessionID:z.string().min(1).max(200),title:z.string().max(200),operationId:z.string().max(300).optional(),
 fields:z.array(z.object({key:z.string().min(1).max(80),title:z.string().max(200).optional(),description:z.string().max(3000).optional(),
  type:z.enum(['string','multiselect']),custom:z.boolean().optional(),required:z.boolean().optional(),
  options:z.array(z.object({value:z.string().max(1000),label:z.string().max(1000),description:z.string().max(2000).optional()})).max(30).optional()})).min(1).max(8)});
export type WorkQuestion=z.infer<typeof workQuestionSchema>;
export type WorkAnswer=Record<string,string|string[]>;
export function validateWorkAnswer(question:WorkQuestion,input:unknown):WorkAnswer {
 const answer=z.record(z.string(),z.union([z.string().max(4000),z.array(z.string().max(1000)).max(30)])).parse(input);
 if(Object.keys(answer).some(key=>!question.fields.some(field=>field.key===key)))throw new Error('Unknown question field.');
 for(const field of question.fields){
  const value=answer[field.key];if(value===undefined||value.length===0)throw new Error('Answer each question before sending.');
  if((field.type==='multiselect')!==Array.isArray(value))throw new Error('Answer format does not match the question.');
  const values=Array.isArray(value)?value:[value];
  if(field.custom!==true&&field.options?.length&&values.some(v=>!field.options!.some(o=>o.value===v)))throw new Error('Choose an available answer.');
 }
 return answer;
}
