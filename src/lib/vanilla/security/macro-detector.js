/**
 * HWP/HWPX Macro Metadata Detector
 *
 * 보안 모듈 — 한컴 한글의 매크로(JScript / BeanShell)를 **정적으로만** 감지합니다.
 *
 *  ⚠️  CRITICAL SECURITY NOTICE
 *  ─────────────────────────────────────────────────────────────────────────
 *  이 모듈은 매크로 코드를 **절대 실행하지 않습니다.**
 *  - `eval`, `Function`, `new Function`, `setTimeout(string, ...)` 등을
 *    사용하지 않습니다.
 *  - 코드 본문은 길이 계산과 정규식 기반 키워드 스캔에만 쓰이며, 호출자에게
 *    반환되지 않습니다 (`sanitize`).
 *  - 호출자가 명시적으로 `keepCode: true` 옵션을 전달한 경우에만 HTML 이스케이프된
 *    문자열이 반환됩니다. 이는 UI 의 "자세히 보기" 모달에서만 사용해야 합니다.
 *  ─────────────────────────────────────────────────────────────────────────
 *
 * @module security/macro-detector
 */

/**
 * 매크로가 들어있을 수 있는 ZIP 엔트리 경로 패턴.
 * HWP (OLE / Compound Document) 의 스트림은 ZIP 으로 풀렸을 때 보통 아래 경로로
 * 노출되며, HWPX 의 경우 `Scripts/` 아래 또는 본문 XML 의 `<hp:script>` 노드로
 * 표현됩니다.
 *
 * @type {Array<{pattern: RegExp, language: string}>}
 */
const MACRO_PATH_PATTERNS = [
  { pattern: /(^|\/)Scripts\/DefaultJScript$/i, language: 'jscript' },
  { pattern: /(^|\/)Scripts\/JScriptVersion$/i, language: 'jscript' },
  { pattern: /(^|\/)Scripts\/DefaultBeanShell$/i, language: 'beanshell' },
  { pattern: /(^|\/)Scripts\/BeanShellVersion$/i, language: 'beanshell' },
  { pattern: /(^|\/)Scripts\/[^/]+$/i, language: 'unknown' },
  { pattern: /(^|\/)scripts\.xml$/i, language: 'unknown' },
];

/**
 * 위험 키워드 카탈로그.
 * 코드를 **실행하지 않고** 정규식으로만 매칭합니다.
 *
 * - `file-io`     : 파일 읽기/쓰기 (잠재적 데이터 유출)
 * - `network`     : 외부 통신 (C2, 데이터 유출)
 * - `shell-exec`  : 외부 프로세스 실행 (랜섬웨어, 드로퍼)
 * - `registry`    : Windows 레지스트리 접근
 * - `wscript`     : Windows Script Host 사용 (시스템 제어)
 * - `activex`     : ActiveX / COM 객체 생성 (악성 페이로드 빈출)
 * - `obfuscation` : 인코딩 / 디코딩 (난독화 우회 신호)
 * - `dynamic-eval`: 동적 코드 실행 (eval / Function)
 * - `hancom-api`  : 한컴 자동화 API 호출 (문서 자동조작)
 *
 * @type {Record<string, RegExp>}
 */
const RISK_KEYWORDS = {
  'file-io':
    /\b(FileSystemObject|OpenTextFile|ReadAll|WriteFile|fopen|fread|fwrite|java\.io\.(File|FileInputStream|FileOutputStream)|new\s+File\s*\()\b/i,
  network:
    /\b(XMLHttpRequest|MSXML2\.XMLHTTP|WinHttp\.WinHttpRequest|URLDownloadToFile|java\.net\.(URL|HttpURLConnection|Socket)|Net\.Sockets|InternetOpen|Msxml2)\b/i,
  'shell-exec':
    /\b(WScript\.Shell|Shell\.Application|shell\.Run|cmd\.exe|powershell|Runtime\.getRuntime|exec\s*\(|ProcessBuilder|java\.lang\.Runtime)\b/i,
  registry:
    /\b(RegRead|RegWrite|RegDelete|HKEY_(LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT)|Wscript\.Shell.{0,40}Reg)\b/i,
  wscript: /\b(WScript\.(CreateObject|Echo|Sleep|Quit|Arguments)|WSH)\b/i,
  activex: /\b(ActiveXObject|CreateObject\s*\(|new\s+ActiveXObject)\b/i,
  obfuscation:
    /\b(eval\s*\(|unescape\s*\(|fromCharCode|atob\s*\(|btoa\s*\(|String\.fromCharCode|decodeURIComponent\s*\(|Base64)\b/i,
  'dynamic-eval':
    /\b(eval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"]|setInterval\s*\(\s*['"])\b/,
  'hancom-api': /\b(HwpCtrl|HAction|HParameterSet|HEAD\s*Ctrl|HwpAutomation|XHwpDocuments)\b/i,
};

/**
 * HTML 안전 이스케이프.
 * 매크로 코드를 모달에 노출할 때 사용 (`<script>` / `on*` 주입 차단).
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 바이트 / 텍스트 입력을 UTF-8 문자열로 정규화.
 *
 * @param {string | Uint8Array | ArrayBuffer | null | undefined} input
 * @returns {string}
 */
function toText(input) {
  if (input == null) return '';
  if (typeof input === 'string') return input;
  try {
    // ArrayBufferView (Uint8Array 등 — 다른 realm 의 인스턴스도 포함)
    if (ArrayBuffer.isView(input)) {
      return new TextDecoder('utf-8', { fatal: false }).decode(input);
    }
    // 순수 ArrayBuffer
    if (
      input instanceof ArrayBuffer ||
      Object.prototype.toString.call(input) === '[object ArrayBuffer]'
    ) {
      return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(input));
    }
    // 일반 배열 (byte 배열)
    if (Array.isArray(input)) {
      return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(input));
    }
  } catch {
    return '';
  }
  return '';
}

/**
 * 경로에서 매크로 언어 추론.
 *
 * @param {string} path
 * @returns {'jscript' | 'beanshell' | 'unknown' | null}
 */
function detectLanguageFromPath(path) {
  if (!path || typeof path !== 'string') return null;
  for (const { pattern, language } of MACRO_PATH_PATTERNS) {
    if (pattern.test(path)) return language;
  }
  return null;
}

/**
 * 코드 본문에서 언어 힌트 추론 (경로로 결정 불가능할 때 보조).
 *
 * @param {string} code
 * @returns {'jscript' | 'beanshell' | 'unknown'}
 */
function detectLanguageFromCode(code) {
  if (!code) return 'unknown';
  // BeanShell 은 Java 문법: `import java.`, `System.out.println` 등이 자주 등장
  if (/\b(import\s+java\.|System\.out\.println|public\s+(class|static\s+void))\b/.test(code)) {
    return 'beanshell';
  }
  // JScript 는 var / function / WScript / ActiveXObject 등
  if (/\b(var\s+\w+\s*=|function\s+\w+\s*\(|WScript|ActiveXObject)\b/.test(code)) {
    return 'jscript';
  }
  return 'unknown';
}

/**
 * 코드 본문에 대해 위험 키워드 정적 스캔 수행.
 *
 * **중요**: 정규식 매칭만 사용합니다. 코드를 평가하거나 파싱해서 실행하지 않습니다.
 *
 * @param {string} code
 * @returns {string[]} 매칭된 위험 카테고리 배열 (중복 제거 / 정렬됨)
 */
export function scanRiskHints(code) {
  if (!code || typeof code !== 'string') return [];
  const hits = new Set();
  for (const [tag, regex] of Object.entries(RISK_KEYWORDS)) {
    try {
      if (regex.test(code)) {
        hits.add(tag);
      }
    } catch {
      // 정규식 실행은 결정적이지만, 방어적으로 try/catch.
    }
  }
  return Array.from(hits).sort();
}

/**
 * 단일 매크로 엔트리에 대해 메타데이터를 추출.
 *
 * @param {Object} entry
 * @param {string} entry.path - ZIP 내부 경로 (또는 식별자)
 * @param {string | Uint8Array} [entry.data] - 원본 바이트 / 텍스트
 * @param {string} [entry.code] - 이미 디코딩된 코드 본문
 * @param {string} [entry.version] - 버전 문자열 (예: `5.0.5.0`)
 * @param {string} [entry.language] - 외부에서 지정한 언어
 * @param {Object} [options]
 * @param {boolean} [options.keepCode=false] - true 면 HTML 이스케이프된 코드를 반환
 * @param {number} [options.maxCodeLength=20000] - keepCode 사용 시 노출 길이 상한
 * @returns {{
 *   present: true,
 *   path: string,
 *   language: 'jscript' | 'beanshell' | 'unknown',
 *   version: string,
 *   length: number,
 *   riskHints: string[],
 *   sanitizedCode?: string,
 *   truncated?: boolean,
 * }}
 */
export function extractMacroEntryMetadata(entry, options = {}) {
  const { keepCode = false, maxCodeLength = 20000 } = options;
  const path = entry?.path || '';
  const code = entry?.code != null ? String(entry.code) : toText(entry?.data);
  const length = code.length;

  const languageHint =
    entry?.language || detectLanguageFromPath(path) || detectLanguageFromCode(code) || 'unknown';

  const language =
    languageHint === 'jscript' || languageHint === 'beanshell' ? languageHint : 'unknown';

  const result = {
    present: true,
    path,
    language,
    version: entry?.version ? String(entry.version) : '',
    length,
    riskHints: scanRiskHints(code),
  };

  if (keepCode && code) {
    const slice = length > maxCodeLength ? code.slice(0, maxCodeLength) : code;
    result.sanitizedCode = escapeHtml(slice);
    result.truncated = length > maxCodeLength;
  }

  return result;
}

/**
 * ZIP 엔트리 맵에서 매크로 스트림을 일괄 감지.
 *
 * @param {Map<string, Uint8Array> | Record<string, Uint8Array>} entries
 *   parser 의 `entries` Map 또는 path→bytes 객체.
 * @param {Object} [options]
 * @param {boolean} [options.keepCode=false]
 * @param {number} [options.maxCodeLength=20000]
 * @returns {{
 *   present: boolean,
 *   detected: boolean,
 *   count: number,
 *   details: Array<ReturnType<typeof extractMacroEntryMetadata>>,
 *   languages: string[],
 *   riskHints: string[],
 * }}
 */
export function detectMacrosFromEntries(entries, options = {}) {
  const details = [];
  const seen = new Set();

  const visit = (path, data) => {
    if (!path || seen.has(path)) return;
    if (!detectLanguageFromPath(path)) return;
    seen.add(path);
    details.push(extractMacroEntryMetadata({ path, data }, options));
  };

  if (entries instanceof Map) {
    for (const [path, data] of entries.entries()) {
      visit(path, data);
    }
  } else if (entries && typeof entries === 'object') {
    for (const [path, data] of Object.entries(entries)) {
      visit(path, data);
    }
  }

  const languages = Array.from(new Set(details.map(d => d.language))).sort();
  const riskHints = Array.from(new Set(details.flatMap(d => d.riskHints))).sort();

  return {
    present: details.length > 0,
    detected: details.length > 0,
    count: details.length,
    details,
    languages,
    riskHints,
  };
}

/**
 * XML 문서에서 `<hp:script>` / `<script>` 노드를 찾아 매크로 메타데이터 추출.
 * 인라인 매크로 (본문 XML 내부에 직접 박힌 스크립트) 대응.
 *
 * @param {Document | null | undefined} xmlDoc - DOMParser 로 파싱한 XML Document
 * @param {Object} [options]
 * @returns {ReturnType<typeof detectMacrosFromEntries>}
 */
export function detectMacrosFromXml(xmlDoc, options = {}) {
  const details = [];
  if (!xmlDoc || typeof xmlDoc.querySelectorAll !== 'function') {
    return {
      present: false,
      detected: false,
      count: 0,
      details: [],
      languages: [],
      riskHints: [],
    };
  }

  let nodes;
  try {
    nodes = xmlDoc.querySelectorAll('script, hp\\:script, scriptCode, hp\\:scriptCode');
  } catch {
    nodes = [];
  }

  nodes.forEach((node, idx) => {
    const text = node.textContent || '';
    // 수식 스크립트(MathML 변환용) 와 매크로 스크립트를 구분: 매크로 스크립트는
    // 보통 길거나 변수/함수 정의를 포함. 너무 짧은 토큰은 수식 후보로 간주.
    if (!text || text.length < 8) return;
    // 부모가 equation 인 경우는 수식 스크립트이므로 제외
    const parent = node.parentElement;
    const parentName = parent ? (parent.localName || parent.tagName || '').toLowerCase() : '';
    if (parentName.endsWith('equation')) return;

    details.push(
      extractMacroEntryMetadata(
        {
          path: `inline:script[${idx}]`,
          code: text,
          language:
            node.getAttribute && node.getAttribute('type')
              ? mapMimeToLanguage(node.getAttribute('type'))
              : undefined,
        },
        options
      )
    );
  });

  const languages = Array.from(new Set(details.map(d => d.language))).sort();
  const riskHints = Array.from(new Set(details.flatMap(d => d.riskHints))).sort();

  return {
    present: details.length > 0,
    detected: details.length > 0,
    count: details.length,
    details,
    languages,
    riskHints,
  };
}

/**
 * MIME / type 속성에서 매크로 언어 추론.
 *
 * @param {string} type
 * @returns {'jscript' | 'beanshell' | 'unknown'}
 */
function mapMimeToLanguage(type) {
  if (!type) return 'unknown';
  const t = String(type).toLowerCase();
  if (t.includes('jscript') || t.includes('javascript')) return 'jscript';
  if (t.includes('beanshell') || t.includes('bsh')) return 'beanshell';
  return 'unknown';
}

/**
 * OLE 객체들의 `macroInfo` 를 매크로 감지 결과 형식으로 변환.
 *
 * 입력은 `parseOle()` 가 만드는 객체들의 Map 또는 배열.
 * 각 OLE 의 매크로 스트림은 *코드 디코딩 없이* 경로만 보고 감지된 것이므로
 * details[i].length 는 -1 (unknown) 로 두고, riskHints 는 OLE indicator 카탈로그로 채운다.
 *
 * @param {Map<string, object> | Array<object> | object | null | undefined} oleObjects
 * @returns {ReturnType<typeof detectMacrosFromEntries>}
 */
export function detectMacrosInOleObjects(oleObjects) {
  const details = [];

  const visit = (key, ole) => {
    if (!ole || !ole.macroInfo || !ole.macroInfo.present) return;
    const streams = Array.isArray(ole.macroInfo.streams) ? ole.macroInfo.streams : [];
    const indicators = Array.isArray(ole.macroInfo.indicators) ? ole.macroInfo.indicators : [];
    const oleClassName = ole.metadata && ole.metadata.className ? ole.metadata.className : '';
    const oleOriginalName =
      ole.metadata && ole.metadata.originalName ? ole.metadata.originalName : key;

    for (const path of streams) {
      details.push({
        path: `ole:${oleOriginalName || key}#${path}`,
        language: 'unknown',
        version: '',
        length: -1,
        riskHints: indicators.slice(),
        sanitizedCode: null,
        source: 'ole',
        oleClassName,
      });
    }
  };

  if (oleObjects instanceof Map) {
    for (const [key, ole] of oleObjects.entries()) visit(key, ole);
  } else if (Array.isArray(oleObjects)) {
    oleObjects.forEach((ole, i) => visit(`ole[${i}]`, ole));
  } else if (oleObjects && typeof oleObjects === 'object') {
    for (const [key, ole] of Object.entries(oleObjects)) visit(key, ole);
  }

  const languages = Array.from(new Set(details.map(d => d.language))).sort();
  const riskHints = Array.from(new Set(details.flatMap(d => d.riskHints))).sort();

  return {
    present: details.length > 0,
    detected: details.length > 0,
    count: details.length,
    details,
    languages,
    riskHints,
  };
}

/**
 * 두 매크로 감지 결과를 병합.
 *
 * @param {...ReturnType<typeof detectMacrosFromEntries>} parts
 * @returns {ReturnType<typeof detectMacrosFromEntries>}
 */
export function mergeMacroResults(...parts) {
  const details = [];
  for (const part of parts) {
    if (part && Array.isArray(part.details)) {
      details.push(...part.details);
    }
  }
  const languages = Array.from(new Set(details.map(d => d.language))).sort();
  const riskHints = Array.from(new Set(details.flatMap(d => d.riskHints))).sort();
  return {
    present: details.length > 0,
    detected: details.length > 0,
    count: details.length,
    details,
    languages,
    riskHints,
  };
}

/**
 * 외부에서 카탈로그를 점검할 수 있도록 키 목록을 노출 (테스트 / 문서화 용도).
 *
 * @returns {string[]}
 */
export function listRiskCategories() {
  return Object.keys(RISK_KEYWORDS).sort();
}

export default {
  detectMacrosFromEntries,
  detectMacrosFromXml,
  extractMacroEntryMetadata,
  scanRiskHints,
  escapeHtml,
  mergeMacroResults,
  listRiskCategories,
};
