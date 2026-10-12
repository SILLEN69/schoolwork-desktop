import { describe, expect, it } from 'vitest';
import { rankTeachGPTModels } from './modelRanking';

describe('TeachGPT model ranking', () => {
  it('orders listed TeachGPT models by matched Artificial Analysis intelligence index', () => {
    expect(rankTeachGPTModels([
      'gpt-oss-120b-low',
      'Meta-Llama-3.3-70B-Instruct-AWQ',
      'gpt-oss-120b-medium',
      'gpt-oss-120b-high',
      'Qwen3.8-27B',
    ])).toEqual([
      { model: 'Qwen3.8-27B', index: 34, rank: 1 },
      { model: 'gpt-oss-120b-high', index: 12, rank: 2 },
      { model: 'gpt-oss-120b-low', index: 10, rank: 3 },
      { model: 'Meta-Llama-3.3-70B-Instruct-AWQ', index: 8, rank: 4 },
      { model: 'gpt-oss-120b-medium', index: null, rank: null },
    ]);
  });

  it('only returns supplied models and puts unscored TeachGPT models after scored ones', () => {
    expect(rankTeachGPTModels(['TeachGPT-new-model', 'gpt-oss-120b-high']).map(x => x.model))
      .toEqual(['gpt-oss-120b-high', 'TeachGPT-new-model']);
  });
});
