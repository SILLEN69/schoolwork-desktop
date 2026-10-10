export const speechModels = { sv: 'kb-whisper-large', en: 'faster-whisper-large-v3' } as const;
export const isSpeechModel = (model: string) => /whisper/i.test(model);
