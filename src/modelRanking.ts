export type RankedModel = { model: string; index: number | null; rank: number | null };

// Artificial Analysis entries matched to models currently exposed by TeachGPT.
// Qwen's value is its highest published reasoning-mode score; aliases may differ.
function scoreForTeachGPTModel(model: string): number | null {
  const id = model.toLowerCase().replace(/[_ ]/g, '-');
  if (id.includes('qwen3.8-27b')) return 34;
  if (id.includes('gpt-oss-120b-high')) return 12;
  if (id.includes('gpt-oss-120b-low')) return 10;
  if (id.includes('meta-llama-3.3-70b') || id.includes('llama-3.3-70b')) return 8;
  return null;
}

export function rankTeachGPTModels(availableModels: string[]): RankedModel[] {
  const entries = Array.from(new Set(availableModels)).map(model => ({ model, index: scoreForTeachGPTModel(model) }));
  entries.sort((a, b) => (b.index ?? -1) - (a.index ?? -1) || a.model.localeCompare(b.model));
  let rank = 0;
  return entries.map(entry => ({ ...entry, rank: entry.index === null ? null : ++rank }));
}
