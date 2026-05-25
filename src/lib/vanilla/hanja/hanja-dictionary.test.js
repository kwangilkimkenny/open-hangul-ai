import { describe, it, expect } from 'vitest';
import {
  SYLLABLE_DICTIONARY,
  WORD_DICTIONARY,
  getSyllableCandidates,
  getWordCandidates,
  getDictionaryStats,
  isHangulSyllable,
} from './hanja-dictionary.js';

describe('hanja-dictionary', () => {
  it('exposes SYLLABLE_DICTIONARY as a Map with at least 200 entries', () => {
    expect(SYLLABLE_DICTIONARY).toBeInstanceOf(Map);
    expect(SYLLABLE_DICTIONARY.size).toBeGreaterThanOrEqual(200);
  });

  it('exposes WORD_DICTIONARY as a Map with several common words', () => {
    expect(WORD_DICTIONARY).toBeInstanceOf(Map);
    expect(WORD_DICTIONARY.size).toBeGreaterThanOrEqual(50);
    expect(WORD_DICTIONARY.has('국가')).toBe(true);
    expect(WORD_DICTIONARY.has('학교')).toBe(true);
    expect(WORD_DICTIONARY.has('한국')).toBe(true);
  });

  it('returns syllable candidates sorted by frequency desc', () => {
    const c = getSyllableCandidates('국');
    expect(c.length).toBeGreaterThan(0);
    // top1 should be 國 ('나라')
    expect(c[0].hanja).toBe('國');
    expect(c[0].meaning).toMatch(/나라/);
    // monotonically non-increasing frequency
    for (let i = 1; i < c.length; i++) {
      expect(c[i].frequency).toBeLessThanOrEqual(c[i - 1].frequency);
    }
  });

  it('returns empty array for unknown syllable / bad input', () => {
    expect(getSyllableCandidates('')).toEqual([]);
    expect(getSyllableCandidates(null)).toEqual([]);
    expect(getSyllableCandidates(undefined)).toEqual([]);
    expect(getSyllableCandidates('Z')).toEqual([]);
  });

  it('returns word candidates for multi-syllable Korean words', () => {
    const c = getWordCandidates('국가');
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].hanja).toBe('國家');
  });

  it('isHangulSyllable identifies precomposed Hangul', () => {
    expect(isHangulSyllable('가')).toBe(true);
    expect(isHangulSyllable('힣')).toBe(true);
    expect(isHangulSyllable('A')).toBe(false);
    expect(isHangulSyllable('한국')).toBe(false); // multi-char
    expect(isHangulSyllable('')).toBe(false);
  });

  it('dictionary stats reflect entry counts', () => {
    const stats = getDictionaryStats();
    expect(stats.syllableCount).toBe(SYLLABLE_DICTIONARY.size);
    expect(stats.wordCount).toBe(WORD_DICTIONARY.size);
    expect(stats.totalEntries).toBeGreaterThanOrEqual(stats.syllableCount + stats.wordCount);
  });

  it('every entry has hanja + meaning + numeric frequency', () => {
    for (const [, list] of SYLLABLE_DICTIONARY) {
      for (const e of list) {
        expect(typeof e.hanja).toBe('string');
        expect(e.hanja.length).toBeGreaterThan(0);
        expect(typeof e.meaning).toBe('string');
        expect(typeof e.frequency).toBe('number');
        expect(e.frequency).toBeGreaterThanOrEqual(1);
        expect(e.frequency).toBeLessThanOrEqual(10);
      }
    }
  });
});
