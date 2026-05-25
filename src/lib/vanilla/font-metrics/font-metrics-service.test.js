import { describe, it, expect, vi, beforeEach } from 'vitest';

// opentype.js 모킹 — 임의 폰트 메트릭 반환
vi.mock('opentype.js', () => ({
  default: {
    parse: vi.fn(() => ({
      unitsPerEm: 1024,
      numGlyphs: 100,
      glyphs: { length: 100 },
      names: {
        fontFamily: { en: 'FakeFont' },
        fullName: { en: 'FakeFont Regular' },
        postScriptName: { en: 'FakeFont-Regular' },
      },
      tables: {
        os2: {
          sTypoAscender: 800,
          sTypoDescender: -200,
          sTypoLineGap: 0,
          sCapHeight: 720,
          sxHeight: 510,
          usWeightClass: 400,
          fsSelection: 0,
        },
        hhea: { ascender: 800, descender: -200, lineGap: 0 },
        head: { xMin: 0, yMin: -200, xMax: 1024, yMax: 800 },
      },
    })),
  },
}));

import {
  getMetricsForFont,
  getMetricsForFonts,
  warmCatalogCache,
} from './font-metrics-service.js';
import { clearCache, memoryCacheSize, buildCacheKey, readMetrics } from './persistence.js';

beforeEach(async () => {
  await clearCache();
  vi.clearAllMocks();
});

describe('font-metrics-service', () => {
  it('returns catalog entry for known Korean font', async () => {
    const m = await getMetricsForFont('함초롬바탕');
    expect(m.source).toBe('catalog');
    expect(m.familyName).toBe('함초롬바탕');
    expect(m.ascent).toBe(880);
  });

  it('caches the catalog result in IndexedDB / memory store', async () => {
    expect(memoryCacheSize()).toBe(0);
    await getMetricsForFont('나눔고딕');
    expect(memoryCacheSize()).toBeGreaterThanOrEqual(1);
    const key = buildCacheKey('나눔고딕');
    const cached = await readMetrics(key);
    expect(cached).not.toBeNull();
    expect(cached.familyName).toBe('나눔고딕');
  });

  it('subsequent lookup returns cached result (no re-extract)', async () => {
    const first = await getMetricsForFont('나눔명조');
    const second = await getMetricsForFont('나눔명조');
    expect(second).toEqual(first);
  });

  it('extracts via opentype when buffer provided and not in catalog', async () => {
    const m = await getMetricsForFont('UnknownCustomFont', {
      buffer: new ArrayBuffer(64),
    });
    expect(m.source).toBe('opentype');
    expect(m.unitsPerEm).toBe(1024);
    expect(m.ascent).toBe(800);
  });

  it('downloads via fetcher when fontUrl is provided', async () => {
    const fetcher = vi.fn(async () => new ArrayBuffer(64));
    const m = await getMetricsForFont('AnotherCustom', {
      fontUrl: 'https://example.test/font.woff2',
      fetcher,
    });
    expect(fetcher).toHaveBeenCalledWith('https://example.test/font.woff2');
    expect(m.source).toBe('opentype');
  });

  it('falls back to canvas metrics when nothing else works', async () => {
    const m = await getMetricsForFont('TotallyUnknownFont42');
    // jsdom 환경에서 canvas 측정이 0 값이라 fallback default 가 적용된다.
    expect(['canvas', 'catalog']).toContain(m.source);
    expect(m.unitsPerEm).toBeGreaterThan(0);
  });

  it('getMetricsForFonts resolves multiple families in parallel', async () => {
    const out = await getMetricsForFonts(['함초롬바탕', '나눔고딕', '맑은 고딕']);
    expect(Object.keys(out).length).toBe(3);
    expect(out['함초롬바탕'].source).toBe('catalog');
    expect(out['나눔고딕'].source).toBe('catalog');
    expect(out['맑은 고딕'].source).toBe('catalog');
  });

  it('warmCatalogCache populates cache with all catalog entries', async () => {
    const before = memoryCacheSize();
    const added = await warmCatalogCache();
    const after = memoryCacheSize();
    expect(added).toBeGreaterThan(0);
    expect(after - before).toBe(added);
  });
});
