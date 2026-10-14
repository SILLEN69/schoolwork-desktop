import {it,expect} from 'vitest';import {workQuestionSchema,validateWorkAnswer} from './workQuestion';
it('preserves OpenCode qN field keys and scalar versus multi-selection answer format',()=>{
 const q=workQuestionSchema.parse({id:'form_a',sessionID:'sess_a',title:'Questions',fields:[{key:'q0',type:'string',custom:true},{key:'q1',type:'multiselect',custom:true}]});
 expect(validateWorkAnswer(q,{q0:'My own answer',q1:['A','B']})).toEqual({q0:'My own answer',q1:['A','B']});
 expect(()=>validateWorkAnswer(q,{q0:['wrong'],q1:'wrong'})).toThrow(/format/);
 expect(()=>validateWorkAnswer(q,{q0:'A',q1:['B'],admin:true})).toThrow();
});
