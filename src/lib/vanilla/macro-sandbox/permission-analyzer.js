/**
 * 매크로 권한 분석기
 *
 * AST (또는 토큰 리스트) 를 walk 하여 어떤 시스템 권한이 요청되는지 추출합니다.
 * 코드를 실행하지 않고, 호출 패턴만 정적으로 인식합니다.
 *
 * 권한·심각도 식별자는 `permission-types.js` 의 freeze 된 enum 으로만 사용합니다.
 * 카탈로그 구축 시 `validatePermission` / `validateSeverity` 로 검증해
 * 잘못된 키가 들어오면 개발 단계에서 즉시 throw 합니다.
 *
 * @module macro-sandbox/permission-analyzer
 */

import * as walk from 'acorn-walk';
import {
  Permission,
  Severity,
  SEVERITY_ORDER,
  validatePermission,
  validateSeverity,
} from './permission-types.js';

/**
 * 권한 카테고리 카탈로그.
 * 키 = 권한 ID (Permission enum 값), 값 = 매칭 식별자 패턴.
 *
 * 정의 시 Permission/Severity enum 으로만 키/severity 를 설정하고,
 * `validate*` 가 알 수 없는 값을 막아줍니다.
 */
function defineCatalog() {
  const entries = [
    [
      Permission.FILE_IO,
      {
        label: '파일 입출력',
        severity: Severity.HIGH,
        patterns: [
          /^FileSystemObject$/i,
          /^Scripting\.FileSystemObject$/i,
          /^OpenTextFile$/i,
          /^CreateTextFile$/i,
          /^ReadAll$/i,
          /^WriteLine$/,
          /^Write$/,
          /^java\.io\.(File|FileInputStream|FileOutputStream|RandomAccessFile)$/,
          /^java\.io\.File$/,
          /^FileReader$/,
          /^FileWriter$/,
        ],
      },
    ],
    [
      Permission.NETWORK,
      {
        label: '네트워크',
        severity: Severity.CRITICAL,
        patterns: [
          /^XMLHttpRequest$/,
          /^MSXML2\.XMLHTTP$/i,
          /^WinHttp\.WinHttpRequest(\.\d+)?$/i,
          /^URLDownloadToFile$/i,
          /^java\.net\.(URL|HttpURLConnection|Socket|ServerSocket)$/,
          /^fetch$/,
        ],
      },
    ],
    [
      Permission.SHELL,
      {
        label: '셸 명령 실행',
        severity: Severity.CRITICAL,
        patterns: [
          /^WScript\.Shell$/i,
          /^Shell\.Application$/i,
          /^Run$/,
          /^Exec$/,
          /^Runtime\.getRuntime$/,
          /^ProcessBuilder$/,
          /^java\.lang\.Runtime$/,
        ],
      },
    ],
    [
      Permission.REGISTRY,
      {
        label: '레지스트리 접근',
        severity: Severity.HIGH,
        patterns: [
          /^RegRead$/i,
          /^RegWrite$/i,
          /^RegDelete$/i,
          /^HKEY_(LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)/i,
        ],
      },
    ],
    [
      Permission.WSCRIPT,
      {
        label: 'Windows Script Host',
        severity: Severity.MEDIUM,
        patterns: [/^WScript$/i, /^WSH$/i, /^WSH\..+/i],
      },
    ],
    [
      Permission.ACTIVEX,
      {
        label: 'ActiveX / COM 객체',
        severity: Severity.HIGH,
        patterns: [/^ActiveXObject$/, /^CreateObject$/, /^GetObject$/],
      },
    ],
    [
      Permission.DOM,
      {
        label: '브라우저 DOM',
        severity: Severity.LOW,
        patterns: [/^document$/, /^window$/, /^navigator$/, /^location$/],
      },
    ],
    [
      Permission.HANCOM_API,
      {
        label: '한컴 자동화 API',
        severity: Severity.MEDIUM,
        patterns: [
          /^HwpCtrl$/,
          /^HAction$/,
          /^HParameterSet$/,
          /^HwpAutomation$/,
          /^XHwpDocuments$/,
          /^HEAD/,
        ],
      },
    ],
    [
      Permission.DYNAMIC_EVAL,
      {
        label: '동적 코드 실행',
        severity: Severity.CRITICAL,
        patterns: [/^eval$/, /^Function$/, /^setTimeout$/, /^setInterval$/, /^execScript$/i],
      },
    ],
  ];

  const catalog = {};
  for (const [permId, def] of entries) {
    validatePermission(permId);
    validateSeverity(def.severity);
    catalog[permId] = def;
  }
  return Object.freeze(catalog);
}

/**
 * 권한 카테고리 카탈로그 (frozen).
 * 키 = 권한 ID, 값 = 매칭 식별자 패턴.
 */
export const PERMISSION_CATALOG = defineCatalog();

/**
 * 식별자/문자열을 권한 카테고리에 매칭.
 *
 * @param {string} name
 * @returns {string[]} 매칭된 Permission ID 목록 (없으면 빈 배열)
 */
// 정규식 매칭 결과 메모이즈 — 대규모 매크로 (500+ 식별자) 에서 동일 식별자가
// 여러 번 등장할 때 80+회 정규식 테스트를 반복하던 비용 제거.
const _matchPermissionCache = new Map();
const MATCH_CACHE_LIMIT = 5000;

export function matchPermission(name) {
  if (!name || typeof name !== 'string') return [];
  const cached = _matchPermissionCache.get(name);
  if (cached !== undefined) return cached;

  const hits = [];
  for (const [permId, def] of Object.entries(PERMISSION_CATALOG)) {
    for (const pat of def.patterns) {
      if (pat.test(name)) {
        hits.push(permId);
        break;
      }
    }
  }

  // 단순 LRU — 한계 초과 시 첫 항목 제거
  if (_matchPermissionCache.size >= MATCH_CACHE_LIMIT) {
    const firstKey = _matchPermissionCache.keys().next().value;
    _matchPermissionCache.delete(firstKey);
  }
  _matchPermissionCache.set(name, hits);
  return hits;
}

/**
 * MemberExpression 을 점 표기 문자열로 평탄화 (예: `WScript.Shell.Run`).
 *
 * @param {object} node
 * @returns {string}
 */
export function flattenMemberExpression(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name || '';
  if (node.type === 'ThisExpression') return 'this';
  if (node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : String(node.value ?? '');
  }
  if (node.type === 'MemberExpression') {
    const obj = flattenMemberExpression(node.object);
    let prop;
    if (node.computed) {
      // 동적 접근 (e[x]) — property 가 리터럴이면 값 사용, 아니면 [?] 마커.
      if (node.property && node.property.type === 'Literal') {
        prop = String(node.property.value ?? '');
      } else {
        prop = '[?]';
      }
    } else {
      prop = flattenMemberExpression(node.property);
    }
    return obj && prop ? `${obj}.${prop}` : obj || prop || '';
  }
  if (node.type === 'CallExpression') {
    return flattenMemberExpression(node.callee);
  }
  if (node.type === 'NewExpression') {
    return flattenMemberExpression(node.callee);
  }
  return '';
}

/**
 * detail 항목을 사전에 중복 차단하며 push 하는 헬퍼 팩토리.
 *
 * 기존에는 (type, line, identifier) 가 같은 detail 을 무조건 push 한 뒤
 * 마지막에 `dedupDetails` 로 정제했습니다. AST 의 동일 노드를 여러
 * 비짓터(CallExpression / MemberExpression / Identifier)가 함께 잡으면
 * 중복이 수십~수백 개씩 쌓여 메모리/CPU 가 낭비됐습니다.
 *
 * 이 헬퍼는 같은 키를 두 번째로 보면 push 자체를 건너뛰어,
 * 결과 details 배열을 항상 deduped 상태로 유지합니다.
 *
 * @param {Set<string>} permissions
 * @param {Array} details
 * @param {(line: number) => string} snippet
 */
function makeRecorder(permissions, details, snippet) {
  const seenDetailKey = new Set();
  return function record(identifier, line) {
    const hits = matchPermission(identifier);
    if (hits.length === 0) return;
    const safeLine = line || 0;
    for (const h of hits) {
      permissions.add(h);
      const key = `${h}|${safeLine}|${identifier}`;
      if (seenDetailKey.has(key)) continue;
      seenDetailKey.add(key);
      details.push({
        type: h,
        line: safeLine,
        code_snippet: snippet(safeLine),
        identifier,
      });
    }
  };
}

/**
 * AST 를 walk 하여 권한 호출 추적.
 *
 * @param {object|null} ast - acorn AST
 * @param {string} sourceCode - 원본 코드 (snippet 추출용)
 * @returns {{
 *   permissions: Set<string>,
 *   details: Array<{type: string, line: number, code_snippet: string, identifier: string}>,
 * }}
 */
export function analyzeAst(ast, sourceCode = '') {
  const permissions = new Set();
  const details = [];

  if (!ast) {
    return { permissions, details };
  }

  const lines = (sourceCode || '').split(/\r?\n/);
  const snippet = lineNum => {
    if (lineNum <= 0 || lineNum > lines.length) return '';
    return (lines[lineNum - 1] || '').trim().slice(0, 240);
  };

  const recordHit = makeRecorder(permissions, details, snippet);

  walk.simple(ast, {
    NewExpression(node) {
      const name = flattenMemberExpression(node.callee);
      recordHit(name, node.loc?.start?.line || 0);
      // ActiveXObject("FileSystemObject") 처럼 첫 인자 문자열도 권한 카테고리 트리거
      if (
        node.arguments &&
        node.arguments[0] &&
        node.arguments[0].type === 'Literal' &&
        typeof node.arguments[0].value === 'string'
      ) {
        recordHit(node.arguments[0].value, node.loc?.start?.line || 0);
      }
    },
    CallExpression(node) {
      const name = flattenMemberExpression(node.callee);
      recordHit(name, node.loc?.start?.line || 0);
      // 마지막 세그먼트도 매칭 (예: WScript.Shell.Run → Run)
      const lastSeg = name.split('.').pop();
      if (lastSeg && lastSeg !== name) recordHit(lastSeg, node.loc?.start?.line || 0);
      // CreateObject("WScript.Shell") 같은 케이스
      if (
        node.arguments &&
        node.arguments[0] &&
        node.arguments[0].type === 'Literal' &&
        typeof node.arguments[0].value === 'string'
      ) {
        recordHit(node.arguments[0].value, node.loc?.start?.line || 0);
      }
    },
    MemberExpression(node) {
      // 점 표기 (WScript.Shell, java.io.File 등) 자체도 권한 카테고리 후보
      const full = flattenMemberExpression(node);
      recordHit(full, node.loc?.start?.line || 0);
      // 첫 토큰만으로 매칭 (HKEY_LOCAL_MACHINE 등)
      const first = full.split('.')[0];
      if (first && first !== full) recordHit(first, node.loc?.start?.line || 0);
    },
    Identifier(node) {
      // 단독 식별자 — eval, document, window 등
      recordHit(node.name, node.loc?.start?.line || 0);
    },
  });

  return { permissions, details };
}

/**
 * BeanShell 토큰 리스트에서 권한 추적.
 *
 * @param {Array<{type: string, value: string, line: number}>} tokens
 * @param {string} sourceCode
 * @returns {{permissions: Set<string>, details: Array}}
 */
export function analyzeTokens(tokens, sourceCode = '') {
  const permissions = new Set();
  const details = [];
  const lines = (sourceCode || '').split(/\r?\n/);
  const snippet = lineNum => {
    if (lineNum <= 0 || lineNum > lines.length) return '';
    return (lines[lineNum - 1] || '').trim().slice(0, 240);
  };

  if (!Array.isArray(tokens)) return { permissions, details };

  const recordHit = makeRecorder(permissions, details, snippet);

  for (const tok of tokens) {
    if (!tok || !tok.value) continue;
    // 문자열 리터럴이면 따옴표 제거 후 한 번 더 매칭
    if (tok.type === 'StringLiteral') {
      const stripped = tok.value.replace(/^['"]|['"]$/g, '');
      recordHit(stripped, tok.line);
    }
    recordHit(tok.value, tok.line);
    // 점 체인의 prefix 도 검사 (java.io.File → java.io.File 매치)
    const segments = tok.value.split('.');
    if (segments.length > 1) {
      // 누적 prefix
      let acc = segments[0];
      recordHit(acc, tok.line);
      for (let i = 1; i < segments.length; i++) {
        acc += '.' + segments[i];
        recordHit(acc, tok.line);
      }
    }
  }

  return { permissions, details };
}

/**
 * 위험 등급 계산 — 권한 조합에 따라 low/medium/high/critical 부여.
 *
 * @param {Set<string> | string[]} permissions
 * @returns {'low'|'medium'|'high'|'critical'}
 */
export function computeRiskLevel(permissions) {
  const set = permissions instanceof Set ? permissions : new Set(permissions || []);
  if (set.size === 0) return Severity.LOW;

  // critical 권한이 하나라도 있으면 critical
  for (const p of set) {
    if (PERMISSION_CATALOG[p]?.severity === Severity.CRITICAL) return Severity.CRITICAL;
  }

  // shell + file-io / network 같은 위험한 조합
  if (set.has(Permission.SHELL) && (set.has(Permission.FILE_IO) || set.has(Permission.NETWORK))) {
    return Severity.CRITICAL;
  }
  if (set.has(Permission.NETWORK) && set.has(Permission.FILE_IO)) return Severity.HIGH;
  if (set.has(Permission.ACTIVEX) && set.has(Permission.REGISTRY)) return Severity.HIGH;

  let high = 0;
  let medium = 0;
  for (const p of set) {
    const sev = PERMISSION_CATALOG[p]?.severity;
    if (sev === Severity.HIGH) high += 1;
    else if (sev === Severity.MEDIUM) medium += 1;
  }
  if (high >= 2) return Severity.HIGH;
  if (high >= 1) return Severity.MEDIUM;
  if (medium >= 1) return Severity.MEDIUM;
  return Severity.LOW;
}

/**
 * 권한별 세부 항목을 카테고리별로 그룹화.
 *
 * @param {Array} details
 * @returns {Record<string, Array>}
 */
export function groupDetailsByType(details) {
  const groups = {};
  if (!Array.isArray(details)) return groups;
  for (const d of details) {
    if (!d || !d.type) continue;
    if (!groups[d.type]) groups[d.type] = [];
    groups[d.type].push(d);
  }
  return groups;
}

/**
 * 카테고리 메타데이터 조회.
 *
 * @param {string} permId
 * @returns {{label: string, severity: string} | null}
 */
export function getPermissionMeta(permId) {
  const def = PERMISSION_CATALOG[permId];
  if (!def) return null;
  return { label: def.label, severity: def.severity };
}

// 테스트 / 외부 호출자 편의를 위한 re-export (단일 진입점 유지).
export { Permission, Severity, SEVERITY_ORDER };

export default {
  analyzeAst,
  analyzeTokens,
  computeRiskLevel,
  flattenMemberExpression,
  groupDetailsByType,
  getPermissionMeta,
  matchPermission,
  PERMISSION_CATALOG,
  Permission,
  Severity,
  SEVERITY_ORDER,
};
