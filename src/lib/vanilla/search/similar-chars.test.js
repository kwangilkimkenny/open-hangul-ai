import { describe, it, expect } from 'vitest';
import { normalizeForFuzzy, isSimilar } from './similar-chars.js';

describe('similar-chars', () => {
  it('returns same string for non-Hangul ascii', () => {
    expect(normalizeForFuzzy('hello 123')).toBe('hello 123');
  });

  it('maps vowel group ㅏㅐㅑㅒ to ㅏ in syllables', () => {
    // 가(ㄱ+ㅏ), 개(ㄱ+ㅐ), 갸(ㄱ+ㅑ), 걔(ㄱ+ㅒ) → 모두 "가"
    expect(normalizeForFuzzy('가개갸걔')).toBe('가가가가');
  });

  it('maps vowel group ㅓㅔㅕㅖ to ㅓ', () => {
    expect(normalizeForFuzzy('거게겨계')).toBe('거거거거');
  });

  it('maps vowel group ㅗㅘㅙㅚ to ㅗ', () => {
    expect(normalizeForFuzzy('고과괘괴')).toBe('고고고고');
  });

  it('maps vowel group ㅜㅝㅞㅟ to ㅜ', () => {
    expect(normalizeForFuzzy('구궈궤귀')).toBe('구구구구');
  });

  it('maps tense consonants to base (ㄲ→ㄱ, ㄸ→ㄷ, ㅃ→ㅂ, ㅆ→ㅅ, ㅉ→ㅈ)', () => {
    // 까(ㄲㅏ)→가, 따(ㄸㅏ)→다, 빠(ㅃㅏ)→바, 싸(ㅆㅏ)→사, 짜(ㅉㅏ)→자
    expect(normalizeForFuzzy('까따빠싸짜')).toBe('가다바사자');
  });

  it('preserves final consonant (jongseong)', () => {
    // 갱(가+ㅇ) → 갱 그대로 (모음 그룹 매핑 후 종성 유지)
    // 갱(ㄱ+ㅐ+ㅇ) → 갱(ㄱ+ㅏ+ㅇ)
    expect(normalizeForFuzzy('갱')).toBe('강');
    // 깡(ㄲ+ㅏ+ㅇ) → 강
    expect(normalizeForFuzzy('깡')).toBe('강');
  });

  it('isSimilar treats fuzzy-equivalents as equal', () => {
    expect(isSimilar('개', '걔')).toBe(true);
    expect(isSimilar('가', '거')).toBe(false);
    expect(isSimilar('까', '가')).toBe(true);
  });

  it('handles empty / non-string input gracefully', () => {
    expect(normalizeForFuzzy('')).toBe('');
    expect(normalizeForFuzzy(null)).toBe('');
    expect(normalizeForFuzzy(undefined)).toBe('');
  });
});
