/**
 * Advanced Replace Engine
 *
 * `searchDocument` 결과(SearchMatch)를 기반으로 doc 의 run.text 를 치환한다.
 *
 * - replaceOne: 단일 match 치환 (불변성 보장 — doc 의 새 사본 반환)
 * - replaceAll: 문서 전체 치환 (역순으로 적용해 인덱스 무결성 유지)
 * - 정규식 캡처 그룹: $1, $2, ... 지원
 * - 스타일 보존: 기존 run.style 유지하며 text 만 교체
 *
 * @module search/replace-engine
 * @version 1.0.0
 */

import { searchDocument } from './search-engine.js';

/**
 * $1, $2 등 캡처 참조를 실제 그룹 값으로 치환.
 * `$$` 는 리터럴 `$` 로, 매치된 그룹이 undefined 면 빈 문자열로 대체된다.
 *
 * @param {string} replacement
 * @param {Array<string>|undefined} groups
 * @returns {string}
 */
export function expandReplacement(replacement, groups) {
  if (typeof replacement !== 'string') return '';
  return replacement.replace(/\$(\$|\d+)/g, (_, key) => {
    if (key === '$') return '$';
    const idx = Number(key) - 1;
    if (!groups || idx < 0 || idx >= groups.length) return '';
    return groups[idx] != null ? groups[idx] : '';
  });
}

/**
 * doc 의 얕은(섹션/문단/run 단위) 깊은 복사. run.style 은 새로 객체화한다.
 * 문서 외부 참조(이미지 raw 등)는 유지.
 *
 * @param {Object} doc
 * @returns {Object}
 */
function cloneDoc(doc) {
  if (!doc) return doc;
  const out = { ...doc };
  if (Array.isArray(doc.sections)) {
    out.sections = doc.sections.map(section => {
      if (!section) return section;
      const newSection = { ...section };
      if (Array.isArray(section.paragraphs)) {
        newSection.paragraphs = section.paragraphs.map(para => {
          if (!para) return para;
          const newPara = { ...para };
          if (Array.isArray(para.runs)) {
            newPara.runs = para.runs.map(run => {
              if (!run) return run;
              const newRun = { ...run };
              if (run.style && typeof run.style === 'object') {
                newRun.style = { ...run.style };
              }
              return newRun;
            });
          }
          return newPara;
        });
      }
      return newSection;
    });
  }
  return out;
}

/**
 * doc 에서 run 을 가져온다.
 *
 * @param {Object} doc
 * @param {number} s
 * @param {number} p
 * @param {number} r
 * @returns {Object|null}
 */
function getRun(doc, s, p, r) {
  const sec = doc?.sections?.[s];
  const para = sec?.paragraphs?.[p];
  const run = para?.runs?.[r];
  return run || null;
}

/**
 * 단일 SearchMatch 위치의 run.text 를 치환한다 (스타일 보존).
 * `match.text` 가 현재 run.text 의 [start..end) 와 동일해야 안전하게 적용된다.
 *
 * @param {Object} doc
 * @param {import('./search-engine.js').SearchMatch} match
 * @param {string} replacement
 * @returns {{ doc:Object, replaced:boolean }}
 */
export function replaceOne(doc, match, replacement) {
  if (!doc || !match) return { doc, replaced: false };
  const cloned = cloneDoc(doc);
  const run = getRun(cloned, match.sectionIdx, match.paragraphIdx, match.runIdx);
  if (!run || typeof run.text !== 'string') return { doc: cloned, replaced: false };

  const { start, end } = match;
  if (start < 0 || end > run.text.length || start > end) return { doc: cloned, replaced: false };

  // 정합성 보장: 잘려나갈 substring 이 매치 text 와 일치해야 함.
  const slice = run.text.slice(start, end);
  if (slice !== match.text) return { doc: cloned, replaced: false };

  const expanded = expandReplacement(replacement, match.groups);
  run.text = run.text.slice(0, start) + expanded + run.text.slice(end);
  // 스타일은 그대로 보존 (run 의 style 객체를 건드리지 않음).
  return { doc: cloned, replaced: true };
}

/**
 * 문서 전체 치환. 같은 run 내 매치들은 역순(end → start)으로 적용해 인덱스 안전성 확보.
 *
 * @param {Object} doc
 * @param {string} query
 * @param {string} replacement
 * @param {import('./search-engine.js').SearchOptions} [options]
 * @returns {{ doc:Object, replaceCount:number }}
 */
export function replaceAll(doc, query, replacement, options = {}) {
  if (!doc) return { doc, replaceCount: 0 };
  if (typeof query !== 'string' || query.length === 0) {
    return { doc: cloneDoc(doc), replaceCount: 0 };
  }
  const matches = searchDocument(doc, query, options);
  if (matches.length === 0) return { doc: cloneDoc(doc), replaceCount: 0 };

  const cloned = cloneDoc(doc);
  // run 별로 묶어서 역순 적용
  /** @type {Map<string, Array<import('./search-engine.js').SearchMatch>>} */
  const byRun = new Map();
  for (const m of matches) {
    const k = `${m.sectionIdx}.${m.paragraphIdx}.${m.runIdx}`;
    if (!byRun.has(k)) byRun.set(k, []);
    byRun.get(k).push(m);
  }

  let count = 0;
  for (const [, list] of byRun) {
    list.sort((a, b) => b.start - a.start);
    const run = getRun(cloned, list[0].sectionIdx, list[0].paragraphIdx, list[0].runIdx);
    if (!run || typeof run.text !== 'string') continue;
    for (const m of list) {
      if (m.start < 0 || m.end > run.text.length) continue;
      const slice = run.text.slice(m.start, m.end);
      if (slice !== m.text) continue;
      const expanded = expandReplacement(replacement, m.groups);
      run.text = run.text.slice(0, m.start) + expanded + run.text.slice(m.end);
      count++;
    }
  }
  return { doc: cloned, replaceCount: count };
}

export default { replaceOne, replaceAll, expandReplacement };
