/**
 * Index Marker Parser (색인 마커 파서)
 *
 * parser.js / paragraph.js 를 건드리지 않고 post-processing 방식으로
 * 본문 단락 안에 흩어진 색인(index) 마커를 수집한다.
 *
 * 감지 대상:
 *  - run.type === 'indexEntry' (parser.js 가 미래에 직접 만들어 주는 경우)
 *  - run.indexTerm / run.indexMark / run.idxMark / run.indexCategory 가 정의된 run
 *  - run.fieldType === 'INDEX_ENTRY' 또는 'IDXMARK' 인 field run
 *  - run.attrs / run.raw / run.xmlAttrs 에 hp:indexEntry / hp:idxMark / indexTerm
 *    네임스페이스 속성이 남아 있는 경우 (HWPX 원본 보존용 fallback)
 *  - run.ruby 가 색인용으로 사용된 경우 (run._isIndexRuby === true 일 때만)
 *
 * 본 모듈은 parser.js 의 출력 형태에 대해 *읽기 전용*이며 어떠한 mutation 도
 * 하지 않는다. 추출 결과는 index-generator.js 가 소비한다.
 *
 * @module features/index-marker-parser
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * @typedef {Object} RawIndexMarker
 * @property {string}  term           색인어
 * @property {string}  [category]     상위 분류 (선택)
 * @property {string}  [sortKey]      정렬용 키 (term 이 한자/특수문자일 때 대체)
 * @property {string}  paragraphId    anchor id (= para.id || `para-S-E`)
 * @property {number}  sectionIndex   섹션 인덱스
 * @property {number}  elementIndex   섹션 내 element 인덱스
 * @property {number}  [runIndex]     paragraph.runs 내 인덱스
 * @property {number}  [pageNumber]   페이지 번호 (가능 시)
 */

const NS_INDEX_ATTR_KEYS = [
  'hp:indexEntry',
  'indexEntry',
  'hp:idxMark',
  'idxMark',
  'indexTerm',
  'indexkey',
  'indexKey',
];

/**
 * sections[] 를 순회해 본문에 박혀 있는 색인 마커를 모두 평탄 배열로 모은다.
 *
 * @param {Array<{elements: Array<Object>}>} sections
 * @param {Object} [opts]
 * @param {Map<string, number>} [opts.pageMap] paragraphId → pageNumber
 * @returns {RawIndexMarker[]}
 */
export function collectIndexMarkers(sections, opts = {}) {
  const out = [];
  if (!Array.isArray(sections)) return out;
  const pageMap = opts.pageMap instanceof Map ? opts.pageMap : null;
  let scanned = 0;

  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    if (!sec || !Array.isArray(sec.elements)) continue;

    for (let e = 0; e < sec.elements.length; e++) {
      const el = sec.elements[e];
      if (!el || el.type !== 'paragraph') continue;

      const paragraphId = el.id || `para-${s}-${e}`;
      const pageNumber = _resolvePageNumber(paragraphId, el, pageMap);

      // 1) paragraph-level 색인 마커 (드물지만 ruby/anchor 변환 결과)
      if (el.indexEntries && Array.isArray(el.indexEntries)) {
        for (const ie of el.indexEntries) {
          const term = _normalizeTerm(ie && (ie.term || ie.text));
          if (!term) continue;
          out.push(_buildMarker({
            term,
            category: ie.category,
            sortKey: ie.sortKey,
            paragraphId,
            sectionIndex: s,
            elementIndex: e,
            pageNumber,
          }));
          scanned++;
        }
      }

      // 2) runs 순회
      if (Array.isArray(el.runs)) {
        for (let r = 0; r < el.runs.length; r++) {
          const run = el.runs[r];
          if (!run) continue;
          const extracted = _extractFromRun(run);
          if (!extracted) continue;
          out.push(_buildMarker({
            term: extracted.term,
            category: extracted.category,
            sortKey: extracted.sortKey,
            paragraphId,
            sectionIndex: s,
            elementIndex: e,
            runIndex: r,
            pageNumber,
          }));
          scanned++;
        }
      }
    }
  }

  logger.debug(`[Index] collected ${scanned} index marker(s) from ${sections.length} section(s)`);
  return out;
}

/**
 * 단일 run 에서 색인 정보를 끄집어낸다. 발견하지 못하면 null.
 *
 * 다음 우선순위로 검사한다:
 *  1) run.type === 'indexEntry'  → run.indexTerm / run.text
 *  2) run.fieldType === 'INDEX_ENTRY' or 'IDXMARK'
 *  3) run.indexTerm / run.idxMark / run.indexMark
 *  4) run._isIndexRuby === true → run.ruby.text 가 색인어
 *  5) run.attrs / run.xmlAttrs 의 NS_INDEX_ATTR_KEYS
 *
 * @param {Object} run
 * @returns {{term:string, category?:string, sortKey?:string} | null}
 */
export function extractIndexFromRun(run) {
  return _extractFromRun(run);
}

function _extractFromRun(run) {
  if (!run || typeof run !== 'object') return null;

  // 1) 명시적 type
  if (run.type === 'indexEntry') {
    const term = _normalizeTerm(run.indexTerm || run.term || run.text);
    if (!term) return null;
    return {
      term,
      category: _toStr(run.indexCategory || run.category),
      sortKey: _toStr(run.indexSortKey || run.sortKey),
    };
  }

  // 2) field type
  if (run.type === 'field') {
    const ft = String(run.fieldType || '').toUpperCase();
    if (ft === 'INDEX_ENTRY' || ft === 'IDXMARK' || ft === 'INDEX_MARK') {
      const term = _normalizeTerm(run.indexTerm || run.term || run.text);
      if (!term) return null;
      return {
        term,
        category: _toStr(run.indexCategory || run.category),
        sortKey: _toStr(run.indexSortKey || run.sortKey),
      };
    }
  }

  // 3) flat 속성
  const flatTerm = run.indexTerm || run.idxMark || run.indexMark;
  if (flatTerm) {
    const term = _normalizeTerm(flatTerm);
    if (!term) return null;
    return {
      term,
      category: _toStr(run.indexCategory || run.category),
      sortKey: _toStr(run.indexSortKey || run.sortKey),
    };
  }

  // 4) ruby 기반 색인 (HWPX 변형 패턴)
  if (run._isIndexRuby && run.ruby) {
    const term = _normalizeTerm(run.ruby.text || run.ruby.term || run.text);
    if (!term) return null;
    return {
      term,
      category: _toStr(run.ruby.category),
      sortKey: _toStr(run.ruby.sortKey),
    };
  }

  // 5) 원본 XML 속성 보존
  const attrs = run.attrs || run.xmlAttrs || run.raw;
  if (attrs && typeof attrs === 'object') {
    for (const key of NS_INDEX_ATTR_KEYS) {
      if (attrs[key] != null) {
        const term = _normalizeTerm(attrs[key]);
        if (!term) continue;
        return {
          term,
          category: _toStr(attrs['indexCategory'] || attrs['category']),
          sortKey: _toStr(attrs['indexSortKey'] || attrs['sortKey']),
        };
      }
    }
  }

  return null;
}

function _buildMarker(m) {
  /** @type {RawIndexMarker} */
  const out = {
    term: m.term,
    paragraphId: m.paragraphId,
    sectionIndex: m.sectionIndex,
    elementIndex: m.elementIndex,
  };
  if (m.category) out.category = m.category;
  if (m.sortKey) out.sortKey = m.sortKey;
  if (typeof m.runIndex === 'number') out.runIndex = m.runIndex;
  if (Number.isFinite(m.pageNumber)) out.pageNumber = m.pageNumber;
  return out;
}

function _resolvePageNumber(paragraphId, el, pageMap) {
  if (pageMap && pageMap.has(paragraphId)) return pageMap.get(paragraphId);
  if (el && typeof el.pageNumber === 'number') return el.pageNumber;
  return undefined;
}

function _normalizeTerm(v) {
  if (v == null) return '';
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s;
}

function _toStr(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export default {
  collectIndexMarkers,
  extractIndexFromRun,
};
