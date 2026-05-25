/**
 * 매크로 권한 분석기
 *
 * AST (또는 토큰 리스트) 를 walk 하여 어떤 시스템 권한이 요청되는지 추출합니다.
 * 코드를 실행하지 않고, 호출 패턴만 정적으로 인식합니다.
 *
 * @module macro-sandbox/permission-analyzer
 */

import * as walk from 'acorn-walk';

/**
 * 권한 카테고리 카탈로그.
 * 키 = 권한 ID, 값 = 매칭 식별자 패턴.
 */
export const PERMISSION_CATALOG = {
  'file-io': {
    label: '파일 입출력',
    severity: 'high',
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
  network: {
    label: '네트워크',
    severity: 'critical',
    patterns: [
      /^XMLHttpRequest$/,
      /^MSXML2\.XMLHTTP$/i,
      /^WinHttp\.WinHttpRequest(\.\d+)?$/i,
      /^URLDownloadToFile$/i,
      /^java\.net\.(URL|HttpURLConnection|Socket|ServerSocket)$/,
      /^fetch$/,
    ],
  },
  shell: {
    label: '셸 명령 실행',
    severity: 'critical',
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
  registry: {
    label: '레지스트리 접근',
    severity: 'high',
    patterns: [
      /^RegRead$/i,
      /^RegWrite$/i,
      /^RegDelete$/i,
      /^HKEY_(LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)/i,
    ],
  },
  wscript: {
    label: 'Windows Script Host',
    severity: 'medium',
    patterns: [/^WScript$/i, /^WSH$/i, /^WSH\..+/i],
  },
  activex: {
    label: 'ActiveX / COM 객체',
    severity: 'high',
    patterns: [/^ActiveXObject$/, /^CreateObject$/, /^GetObject$/],
  },
  dom: {
    label: '브라우저 DOM',
    severity: 'low',
    patterns: [/^document$/, /^window$/, /^navigator$/, /^location$/],
  },
  'hancom-api': {
    label: '한컴 자동화 API',
    severity: 'medium',
    patterns: [
      /^HwpCtrl$/,
      /^HAction$/,
      /^HParameterSet$/,
      /^HwpAutomation$/,
      /^XHwpDocuments$/,
      /^HEAD/,
    ],
  },
  'dynamic-eval': {
    label: '동적 코드 실행',
    severity: 'critical',
    patterns: [/^eval$/, /^Function$/, /^setTimeout$/, /^setInterval$/, /^execScript$/i],
  },
};

/**
 * 식별자/문자열을 권한 카테고리에 매칭.
 *
 * @param {string} name
 * @returns {string[]} 매칭된 권한 ID 목록 (없으면 빈 배열)
 */
function matchPermission(name) {
  if (!name || typeof name !== 'string') return [];
  const hits = [];
  for (const [permId, def] of Object.entries(PERMISSION_CATALOG)) {
    for (const pat of def.patterns) {
      if (pat.test(name)) {
        hits.push(permId);
        break;
      }
    }
  }
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

  const recordHit = (identifier, line) => {
    const hits = matchPermission(identifier);
    for (const h of hits) {
      permissions.add(h);
      details.push({
        type: h,
        line: line || 0,
        code_snippet: snippet(line),
        identifier,
      });
    }
  };

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

  return { permissions, details: dedupDetails(details) };
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

  for (const tok of tokens) {
    if (!tok || !tok.value) continue;
    const hits = matchPermission(tok.value);
    // 문자열 리터럴이면 따옴표 제거 후 한 번 더 매칭
    if (tok.type === 'StringLiteral') {
      const stripped = tok.value.replace(/^['"]|['"]$/g, '');
      const innerHits = matchPermission(stripped);
      for (const h of innerHits) {
        permissions.add(h);
        details.push({
          type: h,
          line: tok.line,
          code_snippet: snippet(tok.line),
          identifier: stripped,
        });
      }
    }
    for (const h of hits) {
      permissions.add(h);
      details.push({
        type: h,
        line: tok.line,
        code_snippet: snippet(tok.line),
        identifier: tok.value,
      });
    }
    // 점 체인의 prefix 도 검사 (java.io.File → java.io.File 매치)
    const segments = tok.value.split('.');
    if (segments.length > 1) {
      // 누적 prefix
      let acc = segments[0];
      const accHits = matchPermission(acc);
      for (const h of accHits) {
        permissions.add(h);
        details.push({
          type: h,
          line: tok.line,
          code_snippet: snippet(tok.line),
          identifier: acc,
        });
      }
      for (let i = 1; i < segments.length; i++) {
        acc += '.' + segments[i];
        const moreHits = matchPermission(acc);
        for (const h of moreHits) {
          permissions.add(h);
          details.push({
            type: h,
            line: tok.line,
            code_snippet: snippet(tok.line),
            identifier: acc,
          });
        }
      }
    }
  }

  return { permissions, details: dedupDetails(details) };
}

/**
 * detail 항목 중 (type + line + identifier) 가 동일한 것을 제거.
 *
 * @param {Array} details
 * @returns {Array}
 */
function dedupDetails(details) {
  const seen = new Set();
  const out = [];
  for (const d of details) {
    const key = `${d.type}|${d.line}|${d.identifier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

/**
 * 위험 등급 계산 — 권한 조합에 따라 low/medium/high/critical 부여.
 *
 * @param {Set<string> | string[]} permissions
 * @returns {'low'|'medium'|'high'|'critical'}
 */
export function computeRiskLevel(permissions) {
  const set = permissions instanceof Set ? permissions : new Set(permissions || []);
  if (set.size === 0) return 'low';

  // critical 권한이 하나라도 있으면 critical
  for (const p of set) {
    if (PERMISSION_CATALOG[p]?.severity === 'critical') return 'critical';
  }

  // shell + file-io / network 같은 위험한 조합
  if (set.has('shell') && (set.has('file-io') || set.has('network'))) return 'critical';
  if (set.has('network') && set.has('file-io')) return 'high';
  if (set.has('activex') && set.has('registry')) return 'high';

  let high = 0;
  let medium = 0;
  for (const p of set) {
    const sev = PERMISSION_CATALOG[p]?.severity;
    if (sev === 'high') high += 1;
    else if (sev === 'medium') medium += 1;
  }
  if (high >= 2) return 'high';
  if (high >= 1) return 'medium';
  if (medium >= 1) return 'medium';
  return 'low';
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

export default {
  analyzeAst,
  analyzeTokens,
  computeRiskLevel,
  flattenMemberExpression,
  groupDetailsByType,
  getPermissionMeta,
  PERMISSION_CATALOG,
};
