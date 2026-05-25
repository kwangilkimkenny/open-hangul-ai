import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
  }),
}));

import { Trie, createTrie } from './trie.js';

describe('Trie', () => {
  /** @type {Trie} */
  let trie;
  beforeEach(() => {
    trie = new Trie();
  });

  it('starts empty', () => {
    expect(trie.size).toBe(0);
    expect(trie.searchPrefix('아')).toEqual([]);
  });

  it('insert adds a word and counts as new only the first time', () => {
    expect(trie.insert('안녕')).toBe(true);
    expect(trie.size).toBe(1);
    expect(trie.contains('안녕')).toBe(true);
    // 같은 단어 재삽입은 빈도만 누적
    expect(trie.insert('안녕', 2)).toBe(false);
    expect(trie.size).toBe(1);
    expect(trie.getFrequency('안녕')).toBe(3); // 1 + 2
  });

  it('insert rejects empty or non-string input', () => {
    expect(trie.insert('')).toBe(false);
    // @ts-expect-error invalid
    expect(trie.insert(null)).toBe(false);
    // @ts-expect-error invalid
    expect(trie.insert(undefined)).toBe(false);
    expect(trie.size).toBe(0);
  });

  it('searchPrefix returns all words sharing the prefix', () => {
    trie.insert('안녕', 1);
    trie.insert('안녕하세요', 5);
    trie.insert('안내', 2);
    trie.insert('바나나', 10);
    const out = trie.searchPrefix('안');
    expect(out.map((m) => m.word).sort()).toEqual(['안내', '안녕', '안녕하세요']);
  });

  it('searchPrefix sorts by frequency desc then alphabetically', () => {
    trie.insert('apple', 1);
    trie.insert('app', 5);
    trie.insert('apex', 5);
    trie.insert('april', 2);
    const out = trie.searchPrefix('ap');
    expect(out.map((m) => m.word)).toEqual(['apex', 'app', 'april', 'apple']);
    // apex & app share freq=5; apex < app alphabetically
    expect(out[0]).toEqual({ word: 'apex', frequency: 5 });
    expect(out[1]).toEqual({ word: 'app', frequency: 5 });
  });

  it('searchPrefix respects limit', () => {
    for (let i = 0; i < 20; i++) trie.insert(`word${i}`, i + 1);
    const out = trie.searchPrefix('word', 5);
    expect(out.length).toBe(5);
    // 가장 빈도 높은 것이 먼저
    expect(out[0].word).toBe('word19');
  });

  it('searchPrefix returns empty for unknown prefix', () => {
    trie.insert('안녕');
    expect(trie.searchPrefix('잘')).toEqual([]);
  });

  it('incrementFrequency creates the word if absent', () => {
    expect(trie.contains('테스트')).toBe(false);
    const f = trie.incrementFrequency('테스트');
    expect(f).toBe(1);
    expect(trie.contains('테스트')).toBe(true);
    expect(trie.incrementFrequency('테스트')).toBe(2);
    expect(trie.getFrequency('테스트')).toBe(2);
  });

  it('remove deletes a registered word', () => {
    trie.insert('한글');
    expect(trie.contains('한글')).toBe(true);
    expect(trie.remove('한글')).toBe(true);
    expect(trie.contains('한글')).toBe(false);
    expect(trie.size).toBe(0);
    expect(trie.remove('한글')).toBe(false);
  });

  it('clear empties everything', () => {
    trie.insert('a');
    trie.insert('b');
    expect(trie.size).toBe(2);
    trie.clear();
    expect(trie.size).toBe(0);
    expect(trie.toArray()).toEqual([]);
  });

  it('toArray returns all registered words', () => {
    trie.insert('가', 1);
    trie.insert('나', 2);
    trie.insert('가나', 3);
    const all = trie.toArray().map((m) => m.word).sort();
    expect(all).toEqual(['가', '가나', '나']);
  });

  it('serialize produces a deterministic JSON-safe payload', () => {
    trie.insert('hi', 3);
    trie.insert('hello', 5);
    const payload = trie.serialize();
    expect(payload.version).toBe(1);
    expect(payload.words.length).toBe(2);
    // 직렬화 결과는 JSON.stringify 가 가능해야 한다
    const json = JSON.stringify(payload);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.words.length).toBe(2);
  });

  it('deserialize restores words and frequencies', () => {
    trie.insert('apple', 7);
    trie.insert('apricot', 2);
    const dump = trie.serialize();

    const t2 = new Trie();
    t2.deserialize(dump);
    expect(t2.size).toBe(2);
    expect(t2.getFrequency('apple')).toBe(7);
    expect(t2.getFrequency('apricot')).toBe(2);
    const top = t2.searchPrefix('ap');
    expect(top[0]).toEqual({ word: 'apple', frequency: 7 });
  });

  it('deserialize handles invalid input gracefully', () => {
    trie.insert('keep');
    trie.deserialize(null);
    expect(trie.size).toBe(0);

    trie.deserialize({ words: 'not-array' });
    expect(trie.size).toBe(0);

    trie.deserialize({ words: [['ok', 3], [1, 2], ['', 5], null] });
    expect(trie.size).toBe(1);
    expect(trie.contains('ok')).toBe(true);
  });

  it('createTrie helper returns a fresh instance', () => {
    const a = createTrie();
    const b = createTrie();
    expect(a).toBeInstanceOf(Trie);
    expect(b).toBeInstanceOf(Trie);
    expect(a).not.toBe(b);
  });

  it('handles korean syllables correctly (codepoint iteration)', () => {
    trie.insert('한국어', 1);
    trie.insert('한국말', 1);
    trie.insert('한자', 1);
    const out = trie.searchPrefix('한국');
    expect(out.map((m) => m.word).sort()).toEqual(['한국말', '한국어']);
  });
});
