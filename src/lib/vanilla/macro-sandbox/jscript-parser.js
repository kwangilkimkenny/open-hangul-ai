/**
 * JScript / BeanShell AST 파서
 *
 * 매크로 코드를 **정적으로만** 파싱하여 AST 를 추출합니다.
 *
 *  CRITICAL SECURITY NOTICE
 *  ─────────────────────────────────────────────────────────────────────────
 *  이 모듈은 코드를 **절대 실행하지 않습니다**.
 *  - `eval`, `Function`, `new Function`, `setTimeout(string, ...)` 사용 금지
 *  - `acorn` 의 정적 파서만 사용 (트리만 생성, 실행 안 함)
 *  - BeanShell 은 Java 슈퍼셋이므로 토큰 스캔만 수행
 *  ─────────────────────────────────────────────────────────────────────────
 *
 * @module macro-sandbox/jscript-parser
 */

import { Parser } from 'acorn';

/**
 * JScript 는 Microsoft 의 JavaScript 변종으로, ES3/ES5 슈퍼셋입니다.
 * `acorn` 으로 안전하게 파싱 가능합니다.
 *
 * @param {string} code
 * @param {Object} [options]
 * @param {string} [options.sourceType='script'] - 'script' | 'module'
 * @param {boolean} [options.allowConditional=true] - JScript 의 `/*@cc_on` 등 무시
 * @returns {{ast: object|null, errors: Array<{message: string, line: number, column: number}>, ok: boolean}}
 */
export function parseJScript(code, options = {}) {
  const { sourceType = 'script' } = options;
  const errors = [];

  if (typeof code !== 'string' || code.length === 0) {
    return { ast: null, errors: [{ message: 'empty code', line: 0, column: 0 }], ok: false };
  }

  // JScript 전용 컨디셔널 컴파일 주석 (/*@cc_on ... @*/) 을 일반 주석으로 제거.
  // acorn 이 인식하지 못하기 때문에 사전에 무력화.
  const sanitized = stripJScriptConditionals(code);

  let ast = null;
  try {
    ast = Parser.parse(sanitized, {
      ecmaVersion: 'latest',
      sourceType,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowHashBang: true,
      locations: true,
      ranges: false,
    });
  } catch (err) {
    errors.push({
      message: err && err.message ? String(err.message) : 'parse error',
      line: err && typeof err.loc?.line === 'number' ? err.loc.line : 0,
      column: err && typeof err.loc?.column === 'number' ? err.loc.column : 0,
    });
    // Error recovery: 라인 단위 partial parse.
    ast = parseLineByLine(sanitized, errors);
  }

  return { ast, errors, ok: errors.length === 0 && ast != null };
}

/**
 * 라인 단위 best-effort 파싱 — acorn 이 전체 파일에서 실패한 경우,
 * 라인을 잘라가며 각각 시도. 실패한 라인은 빈 ExpressionStatement 로 대체.
 *
 * 절대 코드 실행 없음. 트리 구성만.
 *
 * @param {string} code
 * @param {Array} errors
 * @returns {object|null}
 */
function parseLineByLine(code, errors) {
  const lines = code.split(/\r?\n/);
  const program = {
    type: 'Program',
    body: [],
    sourceType: 'script',
    loc: { start: { line: 1, column: 0 }, end: { line: lines.length, column: 0 } },
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const partial = Parser.parse(line, {
        ecmaVersion: 'latest',
        allowReturnOutsideFunction: true,
        locations: true,
      });
      if (partial.body && partial.body.length > 0) {
        for (const node of partial.body) {
          // 라인 번호를 원본 위치로 조정
          shiftLocations(node, i);
          program.body.push(node);
        }
      }
    } catch {
      // 라인 단위에서도 실패한 경우는 조용히 스킵 — 이미 errors 에 전체 에러가 기록됨.
      void errors;
    }
  }

  return program.body.length > 0 ? program : null;
}

/**
 * AST 노드의 loc.line 을 offset 만큼 더함. (in-place)
 *
 * @param {object} node
 * @param {number} offset
 */
function shiftLocations(node, offset) {
  if (!node || typeof node !== 'object') return;
  if (node.loc) {
    if (node.loc.start) node.loc.start.line = (node.loc.start.line || 1) + offset;
    if (node.loc.end) node.loc.end.line = (node.loc.end.line || 1) + offset;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'parent') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const child of val) {
        if (child && typeof child === 'object') shiftLocations(child, offset);
      }
    } else if (val && typeof val === 'object') {
      shiftLocations(val, offset);
    }
  }
}

/**
 * JScript 전용 조건부 컴파일 주석을 일반 주석으로 변환.
 *
 *   /*@cc_on
 *     @if (...) ...
 *   @* /
 *
 * @param {string} code
 * @returns {string}
 */
export function stripJScriptConditionals(code) {
  if (!code || typeof code !== 'string') return '';
  // /*@ ... @*/ 블록을 빈 공백으로 치환 (행 번호 보존을 위해 줄바꿈은 유지)
  return code.replace(/\/\*@[\s\S]*?@\*\//g, match => match.replace(/[^\r\n]/g, ' '));
}

/**
 * BeanShell 토큰 추출 — Java 슈퍼셋이므로 acorn 으로 파싱 불가능.
 * 단순 토큰 스캔 (식별자, 점 표기, 함수 호출 패턴) 만 수행.
 *
 * 절대 코드 실행 없음. 정규식 토크나이저만.
 *
 * @param {string} code
 * @returns {{tokens: Array<{type: string, value: string, line: number}>, errors: Array}}
 */
export function tokenizeBeanShell(code) {
  const errors = [];
  if (typeof code !== 'string' || code.length === 0) {
    return { tokens: [], errors: [{ message: 'empty code', line: 0 }] };
  }

  const tokens = [];
  const lines = code.split(/\r?\n/);
  // 식별자 + (선택적) 점 체인 + (선택적) 괄호
  const callRe =
    /([A-Za-z_$][A-Za-z0-9_$]*(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*)*)\s*(\()?/g;
  // 문자열 리터럴
  const strRe = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g;
  // import 문
  const importRe = /import\s+([A-Za-z_$][\w.]*\s*(?:\.\s*\*)?)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    importRe.lastIndex = 0;
    let m;
    while ((m = importRe.exec(line))) {
      tokens.push({ type: 'Import', value: m[1].replace(/\s+/g, ''), line: lineNum });
    }

    strRe.lastIndex = 0;
    while ((m = strRe.exec(line))) {
      tokens.push({ type: 'StringLiteral', value: m[0], line: lineNum });
    }

    callRe.lastIndex = 0;
    while ((m = callRe.exec(line))) {
      const ident = m[1].replace(/\s+/g, '');
      if (!ident) continue;
      // 예약어 필터링
      if (
        /^(if|else|for|while|do|switch|case|break|continue|return|new|class|public|private|protected|static|void|int|long|double|float|boolean|String|true|false|null|import|package|try|catch|finally|throw|throws)$/.test(
          ident
        )
      ) {
        continue;
      }
      tokens.push({
        type: m[2] === '(' ? 'CallExpression' : 'Identifier',
        value: ident,
        line: lineNum,
      });
    }
  }

  return { tokens, errors };
}

/**
 * 통합 파서 — 언어에 따라 적절한 파서/토크나이저 선택.
 *
 * @param {string} code
 * @param {'jscript' | 'beanshell' | 'unknown'} language
 * @returns {{ast: object|null, tokens: Array|null, errors: Array, language: string, ok: boolean}}
 */
export function parseMacroCode(code, language = 'jscript') {
  if (language === 'beanshell') {
    const { tokens, errors } = tokenizeBeanShell(code);
    return { ast: null, tokens, errors, language, ok: errors.length === 0 };
  }
  // jscript / unknown 은 JScript 파서로 시도
  const { ast, errors, ok } = parseJScript(code);
  return { ast, tokens: null, errors, language: language || 'jscript', ok };
}

export default {
  parseJScript,
  parseMacroCode,
  tokenizeBeanShell,
  stripJScriptConditionals,
};
