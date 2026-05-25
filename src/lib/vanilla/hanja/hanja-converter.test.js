import { describe, it, expect } from 'vitest';
import {
  lookupHanja,
  convertToHanja,
  convertWithParenthesis,
  tokenizeConversion,
  getCoverage,
} from './hanja-converter.js';

describe('hanja-converter', () => {
  it('lookupHanja returns word candidates when input matches WORD_DICTIONARY', () => {
    const c = lookupHanja('국가');
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].hanja).toBe('國家');
  });

  it('lookupHanja falls back to syllable candidates when no word match', () => {
    // '국' alone -> syllable lookup
    const c = lookupHanja('국');
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].hanja).toBe('國');
  });

  it('lookupHanja returns [] for empty / invalid input', () => {
    expect(lookupHanja('')).toEqual([]);
    expect(lookupHanja(null)).toEqual([]);
    expect(lookupHanja(undefined)).toEqual([]);
  });

  it('convertToHanja converts known word with greedy longest-match (top1 mode)', () => {
    // '학교에 갔다' -> 學校 prefers word match
    const result = convertToHanja('학교');
    expect(result).toBe('學校');
  });

  it('convertToHanja keeps non-Hangul characters intact', () => {
    const result = convertToHanja('Hello, 한국 2026!');
    expect(result).toContain('Hello');
    expect(result).toContain('2026');
    expect(result).toContain('韓國'); // 한국 word match
    expect(result).toContain('!');
    expect(result).toContain(',');
  });

  it('convertToHanja preserves syllables with no dictionary entry', () => {
    // '뷁' (likely unknown) should remain as-is, '학' should convert
    const result = convertToHanja('뷁학');
    expect(result.startsWith('뷁')).toBe(true);
    expect(result.endsWith('學')).toBe(true);
  });

  it('convertToHanja word-only mode leaves un-matched syllables intact', () => {
    // single syllable '학' has syllable candidate but no word entry
    const result = convertToHanja('학', 'word-only');
    expect(result).toBe('학'); // word-only fallback to original
  });

  it('convertWithParenthesis produces 한자(한글) by default', () => {
    expect(convertWithParenthesis('국가', '國家')).toBe('國家(국가)');
  });

  it('convertWithParenthesis supports hangul-first order', () => {
    expect(convertWithParenthesis('국가', '國家', { order: 'hangul-first' })).toBe('국가(國家)');
  });

  it('convertWithParenthesis handles empty/identical inputs gracefully', () => {
    expect(convertWithParenthesis('', '')).toBe('');
    expect(convertWithParenthesis('국가', '국가')).toBe('국가');
    expect(convertWithParenthesis('국가', '')).toBe('국가');
    expect(convertWithParenthesis('', '國家')).toBe('國家');
  });

  it('tokenizeConversion segments mixed text into word / syllable / literal tokens', () => {
    const tokens = tokenizeConversion('학교 Z');
    // '학교' (word) + ' ' (literal) + 'Z' (literal)
    expect(tokens.length).toBe(3);
    expect(tokens[0]).toMatchObject({ type: 'word', source: '학교', hanja: '學校' });
    expect(tokens[1]).toMatchObject({ type: 'literal', source: ' ' });
    expect(tokens[2]).toMatchObject({ type: 'literal', source: 'Z' });
  });

  it('tokenizeConversion falls back to syllable token when no word match', () => {
    const tokens = tokenizeConversion('학');
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe('syllable');
    expect(tokens[0].hanja).toBe('學');
  });

  it('getCoverage reports converted/total Hangul syllables', () => {
    const cov = getCoverage('학교 abc');
    expect(cov.total).toBe(2); // 학, 교
    expect(cov.converted).toBe(2);
    expect(cov.ratio).toBe(1);
  });

  it('convertToHanja prefers longer word match over individual syllables', () => {
    // '대학교' is in WORD_DICTIONARY as 大學校 — must take precedence over '대학' + '교'
    const result = convertToHanja('대학교');
    expect(result).toBe('大學校');
  });
});
