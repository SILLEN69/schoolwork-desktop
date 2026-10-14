import {it,expect} from 'vitest';
import {appMenu} from './appMenu';
it('defaults native menu copy to Swedish and changes labels without losing edit roles',()=>{
 const sv=appMenu(''),en=appMenu('en');expect(sv.map(m=>m.label)).toEqual(['Arkiv','Redigera','Visa','Fönster']);expect(en.map(m=>m.label)).toEqual(['File','Edit','View','Window']);
 expect(JSON.stringify(sv)).toContain('"role":"copy"');expect(JSON.stringify(en)).toContain('"role":"copy"');
});
