/**
 * 매크로 샌드박스 권한 / 심각도 enum.
 *
 * 기존에는 `'file-io'`, `'network'` 같은 raw string 이 코드 전반에 산재해
 * 오타가 발생해도 런타임/타입 단계에서 잡히지 않았습니다. 이 모듈은:
 *   1) 권한·심각도 식별자를 freeze 된 enum 객체로 모음 → 단일 진리원천
 *   2) `validatePermission(s)` / `validateSeverity(s)` 를 제공해
 *      잘못된 키 사용 시 즉시 throw → 개발 모드에서 회귀 차단
 *   3) `SEVERITY_ORDER` 를 노출해 정렬 / 비교 로직에서 공유
 *
 * @module macro-sandbox/permission-types
 */

/**
 * 권한 카테고리 식별자.
 *
 * 값은 그대로 `'file-io'` 같은 문자열 — 기존 호출자(detail.type,
 * permissions Set 멤버) 와 와이어 호환을 위해 변경하지 않았습니다.
 */
export const Permission = Object.freeze({
  FILE_IO: 'file-io',
  NETWORK: 'network',
  SHELL: 'shell',
  REGISTRY: 'registry',
  WSCRIPT: 'wscript',
  ACTIVEX: 'activex',
  OBFUSCATION: 'obfuscation',
  DYNAMIC_EVAL: 'dynamic-eval',
  HANCOM_API: 'hancom-api',
  DOM: 'dom',
});

/**
 * 심각도 등급.
 */
export const Severity = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

/**
 * 심각도 비교용 가중치 (낮을수록 덜 위험).
 *
 * 보고서 정렬 시 critical → low 가 되도록 critical = 0 으로 둡니다.
 */
export const SEVERITY_ORDER = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
});

const PERMISSION_VALUES = new Set(Object.values(Permission));
const SEVERITY_VALUES = new Set(Object.values(Severity));

/**
 * 단일 권한 ID 검증. 잘못된 값이면 throw.
 *
 * @param {string} permId
 * @returns {string} 동일한 값 (체이닝 편의)
 * @throws {TypeError}
 */
export function validatePermission(permId) {
  if (!PERMISSION_VALUES.has(permId)) {
    throw new TypeError(
      `Unknown permission id: ${JSON.stringify(permId)}. ` +
        `Use one of: ${Array.from(PERMISSION_VALUES).join(', ')}`
    );
  }
  return permId;
}

/**
 * 권한 ID 배열/Set 검증. 잘못된 값이 있으면 throw.
 *
 * @param {Iterable<string>} ids
 * @returns {string[]}
 */
export function validatePermissions(ids) {
  if (ids == null) return [];
  const out = [];
  for (const id of ids) {
    out.push(validatePermission(id));
  }
  return out;
}

/**
 * 단일 심각도 검증. 잘못된 값이면 throw.
 *
 * @param {string} sev
 * @returns {string}
 * @throws {TypeError}
 */
export function validateSeverity(sev) {
  if (!SEVERITY_VALUES.has(sev)) {
    throw new TypeError(
      `Unknown severity: ${JSON.stringify(sev)}. ` +
        `Use one of: ${Array.from(SEVERITY_VALUES).join(', ')}`
    );
  }
  return sev;
}

/**
 * 심각도 배열 검증.
 *
 * @param {Iterable<string>} sevs
 * @returns {string[]}
 */
export function validateSeverities(sevs) {
  if (sevs == null) return [];
  const out = [];
  for (const s of sevs) {
    out.push(validateSeverity(s));
  }
  return out;
}

/**
 * 알려진 권한 ID 인지 boolean 으로만 확인 (throw 안 함).
 *
 * @param {unknown} permId
 * @returns {boolean}
 */
export function isKnownPermission(permId) {
  return typeof permId === 'string' && PERMISSION_VALUES.has(permId);
}

/**
 * 알려진 심각도 인지 boolean 으로만 확인.
 *
 * @param {unknown} sev
 * @returns {boolean}
 */
export function isKnownSeverity(sev) {
  return typeof sev === 'string' && SEVERITY_VALUES.has(sev);
}

export default {
  Permission,
  Severity,
  SEVERITY_ORDER,
  validatePermission,
  validatePermissions,
  validateSeverity,
  validateSeverities,
  isKnownPermission,
  isKnownSeverity,
};
