/**
 * HTML escape utility — 단일 진실 공급자.
 *
 * macro-warning.js, headless/html-exporter.js, hwp5-encryption-notice 등 여러
 * 모듈에서 산발적으로 같은 정규식을 정의하던 것을 통합한다.
 *
 * @module utils/html-escape
 */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const ESCAPE_RE = /[&<>"']/g;

/**
 * 문자열의 HTML 메타 문자를 escape 한다.
 * non-string 입력은 String 변환 후 처리. null/undefined 는 빈 문자열.
 *
 * @param {unknown} input
 * @returns {string}
 */
export function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  const s = typeof input === 'string' ? input : String(input);
  return s.replace(ESCAPE_RE, ch => ESCAPE_MAP[ch]);
}

/**
 * 속성 값용 escape — 텍스트 노드와 동일하나 의도를 명시하기 위해 별도 export.
 *
 * @param {unknown} input
 * @returns {string}
 */
export function escapeAttr(input) {
  return escapeHtml(input);
}
