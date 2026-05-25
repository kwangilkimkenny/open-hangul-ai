import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// 사용자 사전 모킹
vi.mock('../spell/user-dictionary.js', () => ({
  listAll: vi.fn(() => ({ ignored: [], custom: ['사용자단어', '맞춤단어'] })),
  addWord: vi.fn(),
  ignoreWord: vi.fn(),
  unignoreWord: vi.fn(),
  isIgnored: vi.fn(),
  clearAll: vi.fn(),
}));

import { WordIndex, buildFromDocument, WEIGHTS } from './word-index.js';
import * as persistence from './persistence.js';

describe('WordIndex', () => {
  beforeEach(async () => {
    persistence.setForcedBackend('memory');
    await persistence.clear();
  });

  afterEach(async () => {
    await persistence.clear();
    persistence.setForcedBackend(null);
  });

  it('buildFromDocument extracts and indexes tokens from plain text', () => {
    const idx = new WordIndex({ minLength: 2 });
    const added = idx.buildFromDocument('안녕하세요 안녕하세요 반갑습니다 hello world hello');
    expect(added).toBeGreaterThan(0);
    expect(idx.size).toBe(4); // 안녕하세요, 반갑습니다, hello, world (안녕은 hello 동일하게 토큰)
    const out = idx.search('안녕');
    expect(out.map((c) => c.word)).toContain('안녕하세요');
    // 두 번 등장한 단어는 빈도가 더 높음
    const hello = idx.search('he')[0];
    expect(hello.word).toBe('hello');
    expect(hello.frequency).toBeGreaterThanOrEqual(2);
  });

  it('buildFromDocument accepts array and object inputs', () => {
    const idx = new WordIndex();
    idx.buildFromDocument(['첫번째 문장', '두번째 문장']);
    expect(idx.size).toBeGreaterThanOrEqual(3);

    const idx2 = new WordIndex();
    idx2.buildFromDocument({ paragraphs: ['하나', '둘셋'] });
    expect(idx2.size).toBeGreaterThanOrEqual(2);
  });

  it('mergeUserDictionary pulls words from user-dictionary with USER_DICT weight', () => {
    const idx = new WordIndex();
    const added = idx.mergeUserDictionary();
    expect(added).toBe(2);
    expect(idx.sourcesOf('사용자단어')).toContain('userDict');
    const out = idx.search('사용자');
    expect(out[0].word).toBe('사용자단어');
    expect(out[0].frequency).toBe(WEIGHTS.USER_DICT);
  });

  it('hangulOnly=true filters out non-hangul tokens', () => {
    const idx = new WordIndex({ hangulOnly: true });
    idx.buildFromDocument('한글단어 english123 다른한글');
    const all = idx.trie.toArray().map((m) => m.word).sort();
    expect(all).toEqual(['다른한글', '한글단어']);
  });

  it('incrementUsage bumps frequency and updates MRU order', () => {
    const idx = new WordIndex();
    idx.buildFromDocument('테스트 단어');
    const before = idx.search('테스')[0].frequency;
    const after = idx.incrementUsage('테스트', { persist: false });
    expect(after).toBe(before + 1);
    expect(idx.sourcesOf('테스트')).toContain('mru');
  });

  it('incrementUsage persists to backend when persist=true (default)', async () => {
    const idx = new WordIndex();
    idx.incrementUsage('지속단어');
    // Persistence는 비동기이므로 microtask flush
    await new Promise((r) => setTimeout(r, 10));
    const rec = await persistence.get('지속단어');
    expect(rec).not.toBeNull();
    expect(rec?.word).toBe('지속단어');
  });

  it('loadMru merges MRU words from persistence with MRU weight', async () => {
    await persistence.putAll([
      { word: '최근단어', frequency: 4, lastUsed: 1000 },
      { word: '다른단어', frequency: 2, lastUsed: 2000 },
    ]);
    const idx = new WordIndex();
    const added = await idx.loadMru();
    expect(added).toBe(2);
    expect(idx.sourcesOf('최근단어')).toContain('mru');
    // MRU 가중치가 곱해진다
    expect(idx.search('최근')[0].frequency).toBe(4 * WEIGHTS.MRU);
  });

  it('search sorts by combined frequency (MRU > userDict > document)', () => {
    const idx = new WordIndex();
    // 문서 단어 한 번만 등장 (freq=DOC=1)
    idx.buildFromDocument('단어문서한번');
    // userDict 단어 (freq=USER_DICT=2)
    idx.trie.insert('단어유저', WEIGHTS.USER_DICT);
    idx._addSource('단어유저', 'userDict');
    // MRU 단어 (freq=MRU=3)
    idx.trie.insert('단어최근', WEIGHTS.MRU);
    idx._addSource('단어최근', 'mru');

    const out = idx.search('단어', 10);
    // MRU > UserDict > Document 순서
    expect(out[0].word).toBe('단어최근');
    expect(out[1].word).toBe('단어유저');
    expect(out[2].word).toBe('단어문서한번');
    expect(out[0].frequency).toBe(WEIGHTS.MRU);
    expect(out[1].frequency).toBe(WEIGHTS.USER_DICT);
    expect(out[2].frequency).toBe(WEIGHTS.DOCUMENT);
  });

  it('buildFromDocument helper returns a populated WordIndex', () => {
    const idx = buildFromDocument('한국어 자동완성 한국어');
    expect(idx).toBeInstanceOf(WordIndex);
    expect(idx.size).toBeGreaterThan(0);
    expect(idx.search('한국')[0].word).toBe('한국어');
  });
});
