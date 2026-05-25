import { describe, it, expect, beforeEach } from 'vitest';
import {
  addWord,
  ignoreWord,
  unignoreWord,
  isIgnored,
  listAll,
  clearAll,
} from './user-dictionary.js';

beforeEach(() => {
  clearAll();
});

describe('user-dictionary', () => {
  it('starts empty', () => {
    const snap = listAll();
    expect(snap.ignored).toEqual([]);
    expect(snap.custom).toEqual([]);
  });

  it('addWord adds to both custom and ignored sets', () => {
    expect(addWord('테스트단어')).toBe(true);
    const snap = listAll();
    expect(snap.custom).toContain('테스트단어');
    expect(snap.ignored).toContain('테스트단어');
    expect(isIgnored('테스트단어')).toBe(true);
  });

  it('ignoreWord adds only to ignored set', () => {
    expect(ignoreWord('초콜렛')).toBe(true);
    const snap = listAll();
    expect(snap.ignored).toContain('초콜렛');
    expect(snap.custom).not.toContain('초콜렛');
    expect(isIgnored('초콜렛')).toBe(true);
  });

  it('unignoreWord removes from both sets', () => {
    addWord('단어1');
    expect(isIgnored('단어1')).toBe(true);
    expect(unignoreWord('단어1')).toBe(true);
    expect(isIgnored('단어1')).toBe(false);
    expect(unignoreWord('없는단어')).toBe(false);
  });

  it('rejects empty / non-string input', () => {
    expect(addWord('')).toBe(false);
    // @ts-expect-error invalid input
    expect(addWord(null)).toBe(false);
    expect(ignoreWord('')).toBe(false);
    expect(isIgnored('')).toBe(false);
  });

  it('deduplicates when adding the same word twice', () => {
    addWord('중복');
    addWord('중복');
    const snap = listAll();
    expect(snap.custom.filter((w) => w === '중복').length).toBe(1);
    expect(snap.ignored.filter((w) => w === '중복').length).toBe(1);
  });
});
