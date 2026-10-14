import {it,expect} from 'vitest';
import {cleanError,userError} from './userError';
it('removes Electron transport wrappers while preserving the actual error',()=>{
 expect(cleanError(new Error("Error invoking remote method 'board:configure': Error: The provided code is invalid."))).toBe('The provided code is invalid.');
 expect(cleanError('PowerShell exited 1. Exit code: 1')).toBe('PowerShell exited 1. Exit code: 1');
});
it('renders understandable errors in the currently selected UI language',()=>{
 expect(userError("Error invoking remote method 'board:configure': Error: The provided code is invalid.")).toContain('Projektorkoden');
 expect(userError('No cast is running on that projector right now.','en')).toContain('No picture');
 expect(userError('HTTP 504')).toContain('Arbetet är sparat');
});
