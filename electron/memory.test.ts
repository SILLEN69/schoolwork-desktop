import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SchoolWorkStore } from './storage';
import { MemoryVault, redactMemoryText } from './memory';

describe('Obsidian-compatible memory vault', () => {
  it('saves, reads back, indexes and deduplicates a requested fact in one call', async () => {
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-memory-'));
    const store=new SchoolWorkStore(dir);const vault=new MemoryVault(store,dir,dir);await vault.initialize();
    try {
      const input={title:'Preferred response style',body:'Use concise chill SMS replies.',scope:'user' as const,tags:['style']};
      const note=await vault.saveFact(input);
      expect(note.status).toBe('provisional');
      expect(await fs.readFile(path.join(vault.root,note.relativePath),'utf8')).toContain(input.body);
      expect(vault.search('concise chill',{projectId:vault.projectId})).toHaveLength(1);
      expect((await vault.saveFact(input)).id).toBe(note.id);
      expect(await fs.readFile(path.join(vault.root,'MEMORY.md'),'utf8')).toContain(note.title);
    } finally {store.close();await fs.rm(dir,{recursive:true,force:true});}
  });
  it('redacts credential-shaped text before memory use', () => {
    expect(redactMemoryText('TEACHGPT_API_KEY=local-placeholder')).not.toContain('local-placeholder');
    expect(redactMemoryText('Authorization: Bearer test-token')).not.toContain('test-token');
    // Opaque identifiers are common in URLs (GitHub gist IDs, commit hashes, etc.);
    // length alone is not evidence that text is a secret.
    expect(redactMemoryText('https://gist.github.com/banesullivan/0123456789abcdef0123456789abcdef')).toContain('0123456789abcdef0123456789abcdef');
  });
  it('reconciles a matching externally edited fact before claiming it is indexed',async () => {
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-memory-'));
    const store=new SchoolWorkStore(dir);const vault=new MemoryVault(store,dir,dir);await vault.initialize();
    try {
      const note=await vault.saveFact({title:'Reply style',body:'Original style.',scope:'user',tags:[]});
      const filename=path.join(vault.root,note.relativePath);
      await fs.writeFile(filename,(await fs.readFile(filename,'utf8')).replace('Original style.','Updated concise style.'),'utf8');
      const saved=await vault.saveFact({title:'Reply style',body:'Updated concise style.',scope:'user',tags:[]});
      expect(saved.id).toBe(note.id);
      expect(vault.search('Updated concise',{projectId:vault.projectId}).map(n=>n.id)).toEqual([note.id]);
    } finally {store.close();await fs.rm(dir,{recursive:true,force:true});}
  });
  it('writes editable Markdown, indexes it, and detects stale editor revisions', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'schoolwork-memory-'));
    const store = new SchoolWorkStore(dir); const vault = new MemoryVault(store, dir, dir); await vault.initialize();
    const note = await vault.create({ title: 'Verified test lesson', type: 'lesson', scope: 'project', status: 'verified', body: 'When tests fail, inspect the exact error before retrying.', tags: ['testing'] });
    const markdown = await fs.readFile(path.join(vault.root, note.relativePath), 'utf8');
    expect(markdown).toContain('title: "Verified test lesson"');
    expect(markdown).toContain('status: "verified"');
    expect(vault.search('inspect exact error', { projectId: vault.projectId })).toHaveLength(1);
    const linked = await vault.create({ title: 'Follow-up procedure', type: 'procedure', scope: 'project', body: 'See [[' + note.relativePath.replace(/\\/g, '/').replace(/\.md$/i, '') + '|the lesson]].' });
    expect(vault.graph(vault.projectId).edges).toContainEqual({ source: linked.id, target: note.id, relation: 'related' });
    const current = vault.get(note.id)!;
    await vault.update(note.id, current.revision || 0, { body: 'Inspect the exact failure and rerun a focused test.' });
    await expect(vault.update(note.id, current.revision || 0, { title: 'Stale write' })).rejects.toThrow('changed elsewhere');
    expect(vault.get(note.id)?.revision).toBe(2);
    store.close(); await fs.rm(dir, { recursive: true, force: true });
  });

  it('preserves archived notes on disk but excludes them from active search', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'schoolwork-memory-'));
    const store = new SchoolWorkStore(dir); const vault = new MemoryVault(store, dir, dir); await vault.initialize();
    const note = await vault.create({ title: 'Old note', type: 'fact', scope: 'project', body: 'An older project fact.' });
    const archived = await vault.archive(note.id);
    expect(archived.status).toBe('archived');
    expect(vault.search('older project fact', { projectId: vault.projectId })).toHaveLength(0);
    expect(await fs.readFile(path.join(vault.root, archived.relativePath), 'utf8')).toContain('status: "archived"');
    store.close(); await fs.rm(dir, { recursive: true, force: true });
  });

  it('preserves external Obsidian edits when an older editor revision tries to save', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'schoolwork-memory-'));
    const store = new SchoolWorkStore(dir); const vault = new MemoryVault(store, dir, dir); await vault.initialize();
    const note = await vault.create({ title: 'External edit', type: 'fact', scope: 'project', body: 'Original note.' });
    const current = vault.get(note.id)!;
    const filename = path.join(vault.root, note.relativePath);
    const external = (await fs.readFile(filename, 'utf8')).replace('Original note.', 'Changed in Obsidian.');
    await fs.writeFile(filename, external, 'utf8');
    await expect(vault.update(note.id, current.revision || 0, { body: 'Stale UI overwrite.' })).rejects.toThrow('changed in Obsidian');
    expect(await fs.readFile(filename, 'utf8')).toContain('Changed in Obsidian.');
    expect(vault.search('changed Obsidian', { projectId: vault.projectId })).toHaveLength(1);
    store.close(); await fs.rm(dir, { recursive: true, force: true });
  });
});
