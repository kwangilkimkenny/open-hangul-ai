/**
 * Advanced Search Engine
 *
 * `doc.sections[].paragraphs[].runs[]` 구조 위에서 동작하며,
 * 각 run 의 text 안에서 매치 범위를 찾아 SearchMatch 배열을 반환한다.
 *
 * 옵션:
 *   - regex: 정규식 모드 (query 를 RegExp 로 사용; 단, 잘못된 패턴이면 빈 결과)
 *   - caseSensitive: 대소문자 구분
 *   - wholeWord: 단어 단위 (영문/숫자 경계, 한글 인접 시 매치 인정)
 *   - ignoreSimilarChars: 한글 유사 자모 무시
 *   - styleFilter: { bold?, italic?, color?, fontFamily? }
 *   - bookmarkOnly: 책갈피가 있는 paragraph 의 run 만 검색
 *
 * @module search/search-engine
 * @version 1.0.0
 */

import { normalizeForFuzzy } from './similar-chars.js';

/**
 * @typedef {Object} SearchMatch
 * @property {number} sectionIdx
 * @property {number} paragraphIdx
 * @property {number} runIdx
 * @property {number} start          - run.text 내 시작 인덱스
 * @property {number} end            - run.text 내 끝 인덱스(exclusive)
 * @property {string} text           - 매치된 원본 문자열
 * @property {string} context        - 매치 주변 문맥 (앞/뒤 최대 20자)
 * @property {Array<string>} [groups]- regex 캡처 그룹 (있으면)
 */

/**
 * @typedef {Object} SearchOptions
 * @property {boolean} [regex=false]
 * @property {boolean} [caseSensitive=false]
 * @property {boolean} [wholeWord=false]
 * @property {boolean} [ignoreSimilarChars=false]
 * @property {{bold?:boolean,italic?:boolean,color?:string,fontFamily?:string}} [styleFilter]
 * @property {boolean} [bookmarkOnly=false]
 */

const DEFAULT_OPTIONS = {
  regex: false,
  caseSensitive: false,
  wholeWord: false,
  ignoreSimilarChars: false,
  styleFilter: null,
  bookmarkOnly: false,
};

/**
 * 정규식 특수문자 이스케이프.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 문자가 "단어 문자"인지 (영문/숫자/언더스코어).
 * 한글은 단어 경계 검사에서 항상 단어 문자로 간주(인접 한글이 있어도 매치 허용).
 *
 * @param {string} ch
 * @returns {boolean}
 */
function isWordChar(ch) {
  if (!ch) return false;
  if (/[A-Za-z0-9_]/.test(ch)) return true;
  return false;
}

/**
 * wholeWord 옵션 적용 여부 검사.
 *
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function passesWholeWord(text, start, end) {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  // 양옆이 영문/숫자가 아니어야 단어 단위 매치
  return !isWordChar(before) && !isWordChar(after);
}

/**
 * styleFilter 가 run.style 과 일치하는지 검사.
 *
 * @param {Object} style
 * @param {Object} filter
 * @returns {boolean}
 */
function passesStyleFilter(style, filter) {
  if (!filter) return true;
  const s = style || {};
  if (filter.bold !== undefined && Boolean(s.bold) !== Boolean(filter.bold)) return false;
  if (filter.italic !== undefined && Boolean(s.italic) !== Boolean(filter.italic)) return false;
  if (filter.color !== undefined && s.color !== filter.color) return false;
  if (filter.fontFamily !== undefined && s.fontFamily !== filter.fontFamily) return false;
  return true;
}

/**
 * Paragraph 에 책갈피 run 이 있는지.
 *
 * @param {Object} para
 * @returns {boolean}
 */
function paragraphHasBookmark(para) {
  if (!para || !Array.isArray(para.runs)) return false;
  return para.runs.some(r => r && r.type === 'bookmark');
}

/**
 * 옵션에 맞는 RegExp 를 만든다. regex 모드면 사용자 입력을 그대로,
 * 아니면 escape + wholeWord 적용.
 *
 * @param {string} query
 * @param {SearchOptions} opts
 * @returns {RegExp|null}
 */
function buildRegex(query, opts) {
  if (typeof query !== 'string' || query.length === 0) return null;
  const flags = opts.caseSensitive ? 'g' : 'gi';
  try {
    if (opts.regex) {
      return new RegExp(query, flags);
    }
    return new RegExp(escapeRegex(query), flags);
  } catch (_e) {
    return null;
  }
}

/**
 * 단일 run.text 안의 매치를 찾아 부분 결과 배열로 돌려준다.
 *
 * @param {string} text
 * @param {string} query
 * @param {RegExp} re
 * @param {SearchOptions} opts
 * @returns {Array<{start:number,end:number,text:string,groups?:Array<string>}>}
 */
function findInText(text, query, re, opts) {
  if (typeof text !== 'string' || text.length === 0) return [];

  // ignoreSimilarChars: 텍스트와 쿼리를 모두 정규화한 뒤 매치.
  // 그러나 매치 인덱스는 원본 텍스트에 그대로 사상해야 한다.
  // 정규화는 음절 단위 1:1 치환이라 인덱스가 보존된다.
  let searchText = text;
  let searchRe = re;
  if (opts.ignoreSimilarChars && !opts.regex) {
    const normText = normalizeForFuzzy(text);
    const normQuery = normalizeForFuzzy(query);
    const flags = opts.caseSensitive ? 'g' : 'gi';
    try {
      searchRe = new RegExp(escapeRegex(normQuery), flags);
    } catch (_e) {
      return [];
    }
    searchText = normText;
  }

  const out = [];
  let m;
  // RegExp lastIndex 초기화
  if (searchRe) searchRe.lastIndex = 0;
  while (searchRe && (m = searchRe.exec(searchText)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (opts.wholeWord && !passesWholeWord(searchText, start, end)) {
      if (m[0].length === 0) searchRe.lastIndex++;
      continue;
    }
    // 매치된 substring은 (정규화 모드에서는) 원본 text 의 같은 위치를 가리킨다.
    const matched = text.slice(start, end);
    /** @type {{start:number,end:number,text:string,groups?:Array<string>}} */
    const item = { start, end, text: matched };
    if (m.length > 1) item.groups = m.slice(1);
    out.push(item);
    if (m[0].length === 0) searchRe.lastIndex++;
  }
  return out;
}

/**
 * 매치 주변 문맥 추출.
 *
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {number} pad
 * @returns {string}
 */
function makeContext(text, start, end, pad = 20) {
  if (typeof text !== 'string') return '';
  const left = Math.max(0, start - pad);
  const right = Math.min(text.length, end + pad);
  let ctx = text.slice(left, right);
  if (left > 0) ctx = '…' + ctx;
  if (right < text.length) ctx += '…';
  return ctx;
}

/**
 * 문서 전체를 검색해 SearchMatch 배열을 반환.
 *
 * @param {Object} doc - { sections: [ { paragraphs: [ { runs: [...] } ] } ] }
 * @param {string} query
 * @param {SearchOptions} [options]
 * @returns {Array<SearchMatch>}
 */
export function searchDocument(doc, query, options = {}) {
  /** @type {SearchOptions} */
  const opts = { ...DEFAULT_OPTIONS, ...options };
  /** @type {Array<SearchMatch>} */
  const results = [];

  if (!doc || !Array.isArray(doc.sections)) return results;
  if (typeof query !== 'string' || query.length === 0) return results;

  const re = buildRegex(query, opts);
  if (!re) return results;

  for (let s = 0; s < doc.sections.length; s++) {
    const section = doc.sections[s];
    if (!section || !Array.isArray(section.paragraphs)) continue;
    for (let p = 0; p < section.paragraphs.length; p++) {
      const para = section.paragraphs[p];
      if (!para || !Array.isArray(para.runs)) continue;
      if (opts.bookmarkOnly && !paragraphHasBookmark(para)) continue;

      for (let r = 0; r < para.runs.length; r++) {
        const run = para.runs[r];
        if (!run) continue;
        if (typeof run.text !== 'string' || run.text.length === 0) continue;
        // 비-텍스트 type (linebreak/tab/bookmark 등)은 건너뜀
        if (run.type && run.type !== 'text') continue;
        if (!passesStyleFilter(run.style, opts.styleFilter)) continue;

        const partials = findInText(run.text, query, re, opts);
        for (const pr of partials) {
          /** @type {SearchMatch} */
          const match = {
            sectionIdx: s,
            paragraphIdx: p,
            runIdx: r,
            start: pr.start,
            end: pr.end,
            text: pr.text,
            context: makeContext(run.text, pr.start, pr.end),
          };
          if (pr.groups) match.groups = pr.groups;
          results.push(match);
        }
      }
    }
  }

  return results;
}

/**
 * 매치 개수만 빠르게 세기 (find UI 카운터용).
 *
 * @param {Object} doc
 * @param {string} query
 * @param {SearchOptions} [options]
 * @returns {number}
 */
export function countMatches(doc, query, options = {}) {
  return searchDocument(doc, query, options).length;
}

export default { searchDocument, countMatches };
