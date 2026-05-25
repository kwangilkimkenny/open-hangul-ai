/**
 * i18n 런타임
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 단일 진입점: `t(key, params?)` 으로 현재 locale 의 라벨을 조회한다.
 *
 * 동작
 *   1) 현재 locale 의 사전에서 키 조회
 *   2) 없으면 한국어(기본) 사전에서 조회
 *   3) 그래도 없으면 키 자체를 반환 — 개발 단계에서 즉시 눈에 띈다
 *   4) `{placeholder}` 형태의 변수는 `params` 로 치환
 *
 * 설계 메모
 *   - 동기 API 만 제공 (lazy load 없음) — 라벨 카탈로그는 빌드 타임 정적이라
 *     초기 로드 비용이 사실상 0 에 가깝다.
 *   - 글로벌 mutable state (currentLocale) 가 1개 있다는 점은 의도된 단순화.
 *     테스트에서는 setLocale 로 복원 필요.
 *
 * @module vanilla/i18n
 */

import { LABELS, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './labels.js';

/** @type {string} 현재 활성 locale */
let currentLocale = DEFAULT_LOCALE;

/**
 * 현재 locale 변경.
 *
 * 지원되지 않는 locale 은 무시하고 false 반환 — throw 하지 않아
 * 사용자 설정 복원 시 카탈로그가 줄어도 앱이 멈추지 않는다.
 *
 * @param {string} locale
 * @returns {boolean} 변경 성공 여부
 */
export function setLocale(locale) {
  if (!locale || typeof locale !== 'string') return false;
  if (!SUPPORTED_LOCALES.includes(locale)) return false;
  currentLocale = locale;
  return true;
}

/**
 * 현재 locale 반환.
 *
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * 지원되는 locale 목록.
 *
 * @returns {readonly string[]}
 */
export function getSupportedLocales() {
  return SUPPORTED_LOCALES;
}

/**
 * 라벨 조회 + 변수 치환.
 *
 * @param {string} key
 * @param {Record<string, unknown>} [params={}]
 * @returns {string}
 */
export function t(key, params) {
  if (typeof key !== 'string' || key.length === 0) return '';

  const dict = LABELS[currentLocale] || LABELS[DEFAULT_LOCALE] || {};
  const fallback = LABELS[DEFAULT_LOCALE] || {};
  let s = dict[key];
  if (s === undefined) s = fallback[key];
  if (s === undefined) s = key;

  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      // 모든 occurrence 치환 — 정규식 escape 후 g 플래그 사용
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp(`\\{${escaped}\\}`, 'g'), String(v));
    }
  }
  return s;
}

/**
 * locale 변경을 일시 적용했다가 자동 복원하는 헬퍼.
 * 테스트나 PDF 렌더 같이 잠시만 다른 locale 로 렌더해야 할 때 사용.
 *
 * @template T
 * @param {string} locale
 * @param {() => T} fn
 * @returns {T}
 */
export function withLocale(locale, fn) {
  const prev = currentLocale;
  setLocale(locale);
  try {
    return fn();
  } finally {
    currentLocale = prev;
  }
}

export { LABELS, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './labels.js';

export default {
  t,
  setLocale,
  getLocale,
  getSupportedLocales,
  withLocale,
};
