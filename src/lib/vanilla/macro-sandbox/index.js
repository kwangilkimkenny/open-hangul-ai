/**
 * 매크로 샌드박스 — 단일 진입점.
 *
 *  ⚠️  보안 보장
 *  ─────────────────────────────────────────────────────────────────────────
 *  이 모듈 트리는 다음을 **절대 사용하지 않습니다**:
 *  - `eval`
 *  - `new Function(...)`, `Function(...)`
 *  - `setTimeout(string, ...)`, `setInterval(string, ...)`
 *  - 동적 import 로 매크로 코드 로딩
 *
 *  매크로 코드는 acorn 의 정적 파서로만 트리화되며, walk 결과로 권한을 추론합니다.
 *  ─────────────────────────────────────────────────────────────────────────
 *
 * @module macro-sandbox
 */

import { parseMacroCode, parseJScript, tokenizeBeanShell } from './jscript-parser.js';
import {
  analyzeAst,
  analyzeTokens,
  computeRiskLevel,
  PERMISSION_CATALOG,
  getPermissionMeta,
} from './permission-analyzer.js';
import { generateReport, getRiskBadge } from './simulation-report.js';
import { createSandboxDialog, showSandboxDialog } from './sandbox-dialog.js';

/**
 * 매크로 코드 분석 — 메인 API.
 *
 * @param {string} code
 * @param {'jscript' | 'beanshell' | 'unknown'} [language='jscript']
 * @returns {{
 *   code: string,
 *   language: string,
 *   ast: object|null,
 *   tokens: Array|null,
 *   errors: Array,
 *   permissions: Set<string>,
 *   permissionList: string[],
 *   details: Array,
 *   report: ReturnType<typeof generateReport>,
 *   riskLevel: string,
 * }}
 */
export function analyzeMacro(code, language = 'jscript') {
  const safeCode = typeof code === 'string' ? code : '';
  const parsed = parseMacroCode(safeCode, language);

  let permissions;
  let details;
  if (parsed.language === 'beanshell') {
    const res = analyzeTokens(parsed.tokens || [], safeCode);
    permissions = res.permissions;
    details = res.details;
  } else {
    const res = analyzeAst(parsed.ast, safeCode);
    permissions = res.permissions;
    details = res.details;
  }

  const report = generateReport({
    permissions,
    details,
    errors: parsed.errors,
    language: parsed.language,
  });

  const riskLevel = report.riskLevel;

  return {
    code: safeCode,
    language: parsed.language,
    ast: parsed.ast,
    tokens: parsed.tokens,
    errors: parsed.errors,
    permissions,
    permissionList: Array.from(permissions).sort(),
    details,
    report,
    riskLevel,
  };
}

/**
 * 매크로 + 분석 결과 → 모달 UI.
 *
 * @param {{code: string, language?: string} | string} macro
 * @returns {{element: HTMLElement, close: () => void} | null}
 */
export function showMacroSandbox(macro) {
  let code;
  let language;
  if (typeof macro === 'string') {
    code = macro;
    language = 'jscript';
  } else if (macro && typeof macro === 'object') {
    code = macro.code || '';
    language = macro.language || 'jscript';
  } else {
    return null;
  }
  const analysis = analyzeMacro(code, language);
  return showSandboxDialog(analysis);
}

export {
  parseJScript,
  parseMacroCode,
  tokenizeBeanShell,
  analyzeAst,
  analyzeTokens,
  computeRiskLevel,
  generateReport,
  getRiskBadge,
  getPermissionMeta,
  createSandboxDialog,
  showSandboxDialog,
  PERMISSION_CATALOG,
};

export default {
  analyzeMacro,
  showMacroSandbox,
  showSandboxDialog,
  parseJScript,
  analyzeAst,
  generateReport,
  PERMISSION_CATALOG,
};
