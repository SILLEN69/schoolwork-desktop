import {it,expect} from 'vitest';import {notesMarkdown,parseNotesMarkdown} from './lessonPrompts';
it('round-trips editable study notes including multiline formulas without altering the task list',()=>{
 const notes={overview:'We studied energy.',sections:[{heading:'Conservation',points:['Energy is conserved in a closed system.','$$\nE = m c^2\n$$']}]};
 expect(parseNotesMarkdown(notesMarkdown(notes))).toEqual(notes);
});
