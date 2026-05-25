import { describe, it, expect } from 'vitest';
import {
  KOREAN_FONT_CATALOG,
  lookupKoreanFont,
  entryToFontMetrics,
  normalizeFamilyName,
  catalogSize,
} from './korean-font-catalog.js';

describe('korean-font-catalog', () => {
  it('contains at least 25 fonts', () => {
    expect(catalogSize()).toBeGreaterThanOrEqual(25);
    expect(KOREAN_FONT_CATALOG.length).toBe(catalogSize());
  });

  it('every entry has required fields and sane values', () => {
    for (const e of KOREAN_FONT_CATALOG) {
      expect(typeof e.familyName).toBe('string');
      expect(Array.isArray(e.aliases)).toBe(true);
      expect(e.unitsPerEm).toBeGreaterThan(0);
      expect(e.ascent).toBeGreaterThan(0);
      expect(e.descent).toBeLessThanOrEqual(0);
      expect(e.capHeight).toBeGreaterThan(0);
      expect(e.xHeight).toBeGreaterThan(0);
      expect(e.hangulAdvance).toBeGreaterThan(0);
      expect(e.latinAdvance).toBeGreaterThan(0);
      expect(['serif', 'sans-serif', 'monospace']).toContain(e.category);
      expect(typeof e.license).toBe('string');
      expect(e.license.length).toBeGreaterThan(0);
    }
  });

  it('lookupKoreanFont resolves exact Korean family name', () => {
    const e = lookupKoreanFont('함초롬바탕');
    expect(e).not.toBeNull();
    expect(e?.familyName).toBe('함초롬바탕');
  });

  it('lookupKoreanFont resolves English alias case-insensitively', () => {
    const a = lookupKoreanFont('hcr batang');
    expect(a?.familyName).toBe('함초롬바탕');
    const b = lookupKoreanFont('NotoSansKR');
    expect(b?.familyName).toBe('Noto Sans KR');
  });

  it('lookupKoreanFont normalizes whitespace and dashes', () => {
    const e = lookupKoreanFont('  Noto-Sans KR  ');
    expect(e?.familyName).toBe('Noto Sans KR');
  });

  it('lookupKoreanFont returns null for unknown / empty input', () => {
    expect(lookupKoreanFont('존재하지않는폰트12345')).toBeNull();
    expect(lookupKoreanFont('')).toBeNull();
    // @ts-expect-error invalid input
    expect(lookupKoreanFont(null)).toBeNull();
  });

  it('normalizeFamilyName collapses whitespace and case', () => {
    expect(normalizeFamilyName('  Noto Sans KR ')).toBe('notosanskr');
    expect(normalizeFamilyName('HCR-Batang')).toBe('hcrbatang');
  });

  it('entryToFontMetrics converts em values to unitsPerEm coordinate space', () => {
    const e = lookupKoreanFont('함초롬바탕');
    expect(e).not.toBeNull();
    if (!e) return;
    const m = entryToFontMetrics(e);
    expect(m.unitsPerEm).toBe(1000);
    expect(m.ascent).toBe(880);
    expect(m.descent).toBe(-220);
    expect(m.capHeight).toBe(700);
    expect(m.bbox.yMax).toBe(880);
    expect(m.bbox.yMin).toBe(-220);
    expect(m.source).toBe('catalog');
  });
});
