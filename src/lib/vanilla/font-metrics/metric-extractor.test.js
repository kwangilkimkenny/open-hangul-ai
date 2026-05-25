import { describe, it, expect, vi, beforeEach } from 'vitest';

// opentype.js 모듈을 통째로 모킹해 실제 폰트 바이너리 없이 테스트한다.
vi.mock('opentype.js', () => {
  return {
    default: {
      parse: vi.fn((_buffer) => {
        return {
          unitsPerEm: 1000,
          numGlyphs: 1234,
          glyphs: { length: 1234 },
          names: {
            fontFamily: { ko: '함초롬바탕', en: 'HCR Batang' },
            fullName: { en: 'HCR Batang Regular' },
            postScriptName: { en: 'HCRBatang-Regular' },
          },
          tables: {
            os2: {
              sTypoAscender: 880,
              sTypoDescender: -220,
              sTypoLineGap: 0,
              sCapHeight: 700,
              sxHeight: 490,
              usWeightClass: 400,
              fsSelection: 0,
            },
            hhea: { ascender: 880, descender: -220, lineGap: 0 },
            head: { xMin: -200, yMin: -300, xMax: 1100, yMax: 950 },
            gsub: { features: [{ tag: 'liga' }, { tag: 'kern' }] },
            gpos: { features: [{ tag: 'kern' }] },
          },
        };
      }),
    },
  };
});

import { extractFontMetrics, normalizeToEm } from './metric-extractor.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('metric-extractor', () => {
  it('throws when buffer is invalid', async () => {
    // @ts-expect-error invalid input
    await expect(extractFontMetrics(null)).rejects.toThrow(/invalid buffer/);
    await expect(extractFontMetrics(new ArrayBuffer(0))).rejects.toThrow(/invalid buffer/);
  });

  it('extracts basic ascent/descent/em from mocked font', async () => {
    const buf = new ArrayBuffer(64);
    const m = await extractFontMetrics(buf);
    expect(m.unitsPerEm).toBe(1000);
    expect(m.ascent).toBe(880);
    expect(m.descent).toBe(-220);
    expect(m.lineGap).toBe(0);
  });

  it('extracts cap-height / x-height / weight', async () => {
    const m = await extractFontMetrics(new ArrayBuffer(64));
    expect(m.capHeight).toBe(700);
    expect(m.xHeight).toBe(490);
    expect(m.weight).toBe(400);
    expect(m.style).toBe('normal');
  });

  it('detects kerning and ligatures from GSUB/GPOS tables', async () => {
    const m = await extractFontMetrics(new ArrayBuffer(64));
    expect(m.hasKerning).toBe(true);
    expect(m.hasLigatures).toBe(true);
  });

  it('prefers Korean name over English name', async () => {
    const m = await extractFontMetrics(new ArrayBuffer(64));
    expect(m.familyName).toBe('함초롬바탕');
  });

  it('produces a valid bbox from head table', async () => {
    const m = await extractFontMetrics(new ArrayBuffer(64));
    expect(m.bbox.xMin).toBe(-200);
    expect(m.bbox.xMax).toBe(1100);
    expect(m.bbox.yMax).toBeGreaterThan(m.bbox.yMin);
  });

  it('normalizeToEm divides every value by unitsPerEm', async () => {
    const m = await extractFontMetrics(new ArrayBuffer(64));
    const em = normalizeToEm(m);
    expect(em.ascent).toBeCloseTo(0.88, 5);
    expect(em.descent).toBeCloseTo(-0.22, 5);
    expect(em.capHeight).toBeCloseTo(0.7, 5);
  });
});
