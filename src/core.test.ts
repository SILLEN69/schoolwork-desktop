import{describe,expect,it}from'vitest';import{commandSucceeded,FailedActionGuard,parseFallbackAction,parseModelIds,validateWorkspaceRelativePath,retainRecentMessages}from'./core';
describe('command outcome classification',()=>{
 it('uses the process exit code and timeout rather than treating ordinary stderr as failure',()=>{expect(commandSucceeded(0,false)).toBe(true);expect(commandSucceeded(1,false)).toBe(false);expect(commandSucceeded(0,true)).toBe(false);expect(commandSucceeded(null,false)).toBe(false)});
});
describe('workspace path boundary',()=>{
 it('allows normal relative paths',()=>expect(validateWorkspaceRelativePath('src\\app.ts')).toBe('src\\app.ts'));
 it('rejects parent traversal',()=>expect(()=>validateWorkspaceRelativePath('..\\secret.txt')).toThrow('outside'));
 it('rejects absolute paths outside the workspace',()=>expect(()=>validateWorkspaceRelativePath('C:\\Users\\private.txt')).toThrow('outside'));
 it('allows the workspace root',()=>expect(validateWorkspaceRelativePath('.')).toBe('.'));
});
describe('TeachGPT model response parsing',()=>{
 it('reads OpenAI-style data entries',()=>expect(parseModelIds({data:[{id:'Qwen3.8-27B'},{id:'gpt-oss-120b-high'}]})).toEqual(['Qwen3.8-27B','gpt-oss-120b-high']));
 it('reads a models list',()=>expect(parseModelIds({models:['a','b']})).toEqual(['a','b']));
 it('ignores malformed entries and removes duplicates',()=>expect(parseModelIds({data:[{id:'a'},null,{},'a']})).toEqual(['a']));
 it('handles an unknown response shape',()=>expect(parseModelIds(null)).toEqual([]));
});
describe('conversation context window',()=>{
 it('keeps the most recent turns in order',()=>expect(retainRecentMessages([1,2,3,4],2)).toEqual([3,4]));
 it('keeps at least one message',()=>expect(retainRecentMessages([1,2],0)).toEqual([2]));
});
describe('text-based tool call fallback',()=>{
 it('accepts one validated JSON action',()=>expect(parseFallbackAction('{"action":{"tool":"read_file","arguments":{"path":"notes.txt"}}}')).toEqual({tool:'read_file',arguments:{path:'notes.txt'}}));
 it('accepts a fenced JSON action',()=>expect(parseFallbackAction('```json\n{"action":{"tool":"list_files","arguments":{}}}\n```')?.tool).toBe('list_files'));
 it('rejects prose and invalid action shapes',()=>{expect(parseFallbackAction('I should read the file.')).toBeNull();expect(parseFallbackAction('{"action":"run"}')).toBeNull()});
});
describe('failed tool retry guard',()=>{
 it('blocks an identical retry after failure but permits changed inputs or a verified success',()=>{
  const guard=new FailedActionGuard();const args={path:'page.html'};
  expect(guard.isDuplicate('write_file',args)).toBe(false);
  guard.failed('write_file',args);
  expect(guard.isDuplicate('write_file',args)).toBe(true);
  expect(guard.isDuplicate('write_file',{path:'page.css'})).toBe(false);
  guard.succeeded();
  expect(guard.isDuplicate('write_file',args)).toBe(false);
 });
});
