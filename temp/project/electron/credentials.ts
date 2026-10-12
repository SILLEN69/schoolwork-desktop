import { safeStorage } from 'electron';

/** Encrypts the school API key for storage through Electron's OS-protected credential backend. */
export function encryptTeachGPTCredential(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is not available.');
  return safeStorage.encryptString(value).toString('base64');
}

/** Decrypts an already configured key only for an authenticated provider request. */
export function readTeachGPTCredential(encrypted: string | undefined): string {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this device.');
  if (!encrypted) throw new Error('Add your TeachGPT API key in Settings.');
  try{return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));}
  catch{throw new Error('Saved TeachGPT key cannot be read in this profile. Add the key again in Settings.');}
}
