import {expect,it,vi,beforeEach} from 'vitest';
const storage=vi.hoisted(()=>({isEncryptionAvailable:vi.fn(()=>true),decryptString:vi.fn(()=> 'local-test-value'),encryptString:vi.fn()}));
vi.mock('electron',()=>({safeStorage:storage}));
import {readTeachGPTCredential} from './credentials';
beforeEach(()=>{storage.isEncryptionAvailable.mockReturnValue(true);storage.decryptString.mockReset().mockReturnValue('local-test-value');});
it('returns a saved credential only through protected storage',()=>{
  expect(readTeachGPTCredential('dGVzdA==')).toBe('local-test-value');
  expect(storage.decryptString).toHaveBeenCalledWith(Buffer.from('test'));
});
it('gives a recoverable settings instruction without exposing cipher or platform details',()=>{
  storage.decryptString.mockImplementation(()=>{throw new Error('raw platform ciphertext details');});
  expect(()=>readTeachGPTCredential('dGVzdA==')).toThrow('Saved TeachGPT key cannot be read in this profile. Add the key again in Settings.');
});
