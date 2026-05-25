/**
 * Font Metrics Service
 *
 * 모든 메트릭 소스를 통합한 단일 조회 API.
 *
 * **우선순위**
 *   1. IndexedDB 캐시 (히트 시 즉시 반환)
 *   2. 한국 폰트 카탈로그 (`korean-font-catalog`)
 *   3. opentype.js 다운로드 추출 (`fontUrl` 제공 시)
 *   4. Canvas TextMetrics fallback
 *
 * 1~3 에서 얻은 결과는 모두 캐시에 영속화한다(4 는 측정 환경 의존성이
 * 크므로 캐시하지 않음).
 *
 * @module font-metrics/font-metrics-service
 * @version 1.0.0
 */

import { extractFontMetrics } from './metric-extractor.js';
import { lookupKoreanFont, entryToFontMetrics } from './korean-font-catalog.js';
import { measurementToFontMetrics } from './canvas-measurer.js';
import { buildCacheKey, readMetrics, writeMetrics } from './persistence.js';

/**
 * @typedef {Object} GetMetricsOptions
 * @property {string} [fontUrl]                폰트 파일 URL (CDN 등)
 * @property {ArrayBuffer} [buffer]            이미 로드된 폰트 바이너리
 * @property {string} [variant='400-normal']
 * @property {string} [version='v1']
 * @property {boolean} [skipCache=false]
 * @property {(url: string) => Promise<ArrayBuffer>} [fetcher]   테스트용 fetch 주입
 */

/**
 * 기본 fetch 구현. fetch API 가 없으면 throw.
 *
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
async function defaultFetcher(url) {
  if (typeof fetch !== 'function') {
    throw new Error('fontMetricsService: fetch unavailable');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return await res.arrayBuffer();
}

/**
 * 단일 폰트 패밀리에 대한 메트릭을 반환한다.
 *
 * @param {string} fontFamily
 * @param {GetMetricsOptions} [options]
 * @returns {Promise<import('./metric-extractor.js').FontMetrics>}
 */
export async function getMetricsForFont(fontFamily, options = {}) {
  if (typeof fontFamily !== 'string' || !fontFamily.trim()) {
    throw new Error('getMetricsForFont: fontFamily required');
  }
  const variant = options.variant || '400-normal';
  const version = options.version || 'v1';
  const cacheKey = buildCacheKey(fontFamily, variant, version);

  // 1) 캐시
  if (!options.skipCache) {
    const cached = await readMetrics(cacheKey);
    if (cached) return cached;
  }

  // 2) 카탈로그
  const catalogEntry = lookupKoreanFont(fontFamily);
  if (catalogEntry) {
    const m = entryToFontMetrics(catalogEntry);
    await writeMetrics(cacheKey, m);
    return m;
  }

  // 3) opentype.js (buffer 또는 URL 지정 시)
  const buffer = options.buffer || (await tryFetchBuffer(options));
  if (buffer) {
    try {
      const m = await extractFontMetrics(buffer);
      await writeMetrics(cacheKey, m);
      return m;
    } catch (_e) {
      // 추출 실패 → canvas fallback 으로
    }
  }

  // 4) canvas fallback (캐시 안 함)
  return measurementToFontMetrics(fontFamily);
}

/**
 * options 에서 fontUrl 이 있으면 fetch 해서 ArrayBuffer 를 만든다.
 *
 * @param {GetMetricsOptions} options
 * @returns {Promise<ArrayBuffer|null>}
 */
async function tryFetchBuffer(options) {
  if (!options.fontUrl) return null;
  const fetcher = options.fetcher || defaultFetcher;
  try {
    return await fetcher(options.fontUrl);
  } catch (_e) {
    return null;
  }
}

/**
 * 여러 폰트의 메트릭을 병렬로 조회한다.
 *
 * @param {Array<string>} families
 * @param {GetMetricsOptions} [sharedOptions]
 * @returns {Promise<Record<string, import('./metric-extractor.js').FontMetrics>>}
 */
export async function getMetricsForFonts(families, sharedOptions) {
  if (!Array.isArray(families) || families.length === 0) return {};
  const results = await Promise.all(
    families.map(async (f) => {
      try {
        const m = await getMetricsForFont(f, sharedOptions);
        return /** @type {[string, any]} */ ([f, m]);
      } catch (_e) {
        return /** @type {[string, any]} */ ([f, null]);
      }
    }),
  );
  /** @type {Record<string, any>} */
  const out = {};
  for (const [family, metrics] of results) {
    if (metrics) out[family] = metrics;
  }
  return out;
}

/**
 * (선택) 미리 캐시를 채워두기 — 워밍업.
 * 카탈로그에 있는 폰트는 모두 캐시에 저장한다.
 *
 * @returns {Promise<number>}  새로 저장된 항목 수
 */
export async function warmCatalogCache() {
  // 동적 import 회피 — 직접 사용
  const { KOREAN_FONT_CATALOG } = await import('./korean-font-catalog.js');
  let count = 0;
  for (const entry of KOREAN_FONT_CATALOG) {
    const key = buildCacheKey(entry.familyName);
    const existing = await readMetrics(key);
    if (!existing) {
      await writeMetrics(key, entryToFontMetrics(entry));
      count += 1;
    }
  }
  return count;
}

export default {
  getMetricsForFont,
  getMetricsForFonts,
  warmCatalogCache,
};
