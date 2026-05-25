import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import * as persistence from './persistence.js';

describe('autocomplete persistence', () => {
  beforeEach(async () => {
    persistence.close();
    // 자동 감지가 jsdom 의 mock IDB 를 잡지 않도록 memory 로 강제
    persistence.setForcedBackend('memory');
    await persistence.clear();
  });

  afterEach(async () => {
    await persistence.clear();
    persistence.setForcedBackend(null);
    persistence.close();
  });

  it('detectBackend returns one of the known kinds', () => {
    persistence.setForcedBackend(null);
    const kind = persistence.detectBackend();
    expect(['indexeddb', 'localstorage', 'memory']).toContain(kind);
    persistence.setForcedBackend('memory');
  });

  it('memory backend: put/get/getAll/remove/clear round-trip', async () => {
    persistence.setForcedBackend('memory');
    expect(persistence.detectBackend()).toBe('memory');

    await persistence.put({ word: '안녕', frequency: 3, lastUsed: 1000 });
    await persistence.put({ word: '하세요', frequency: 1, lastUsed: 2000 });

    const a = await persistence.get('안녕');
    expect(a).toEqual({ word: '안녕', frequency: 3, lastUsed: 1000 });

    const all = await persistence.getAll();
    expect(all.length).toBe(2);

    await persistence.remove('안녕');
    expect(await persistence.get('안녕')).toBeNull();

    await persistence.clear();
    expect((await persistence.getAll()).length).toBe(0);
  });

  it('memory backend: getMru returns by lastUsed desc', async () => {
    await persistence.putAll([
      { word: 'a', frequency: 1, lastUsed: 100 },
      { word: 'b', frequency: 1, lastUsed: 300 },
      { word: 'c', frequency: 1, lastUsed: 200 },
    ]);
    const mru = await persistence.getMru(2);
    expect(mru.map((r) => r.word)).toEqual(['b', 'c']);
  });

  it('memory backend: put rejects empty / invalid records', async () => {
    await persistence.put({ word: '', frequency: 1, lastUsed: 0 });
    // @ts-expect-error invalid
    await persistence.put(null);
    expect((await persistence.getAll()).length).toBe(0);
  });

  it('localstorage fallback: persists across put/get when forced', async () => {
    if (typeof globalThis.localStorage === 'undefined') return;
    persistence.setForcedBackend('localstorage');
    try { globalThis.localStorage.removeItem('autocomplete.mru.v1'); } catch (_e) { /* ignore */ }

    await persistence.put({ word: 'lsword', frequency: 9, lastUsed: 4444 });
    const got = await persistence.get('lsword');
    expect(got).not.toBeNull();
    expect(got?.word).toBe('lsword');
    expect(got?.frequency).toBe(9);

    const mru = await persistence.getMru(10);
    expect(mru.map((r) => r.word)).toContain('lsword');

    await persistence.clear();
    persistence.setForcedBackend('memory');
  });
});
