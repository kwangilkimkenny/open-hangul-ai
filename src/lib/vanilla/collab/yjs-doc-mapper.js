/**
 * HWPX ↔ Yjs document mapper (Phase 1)
 *
 * 매핑 전략
 * ---------
 *  - HWPX 문서는 sections[].paragraphs[].runs[] 로 구성된다.
 *  - 협업 1차 범위에서 우리는 "문단의 텍스트" 와 "문단의 정렬" 만 동기화한다.
 *      · 텍스트는 Y.Text (문자 단위 CRDT) 로 저장 → 동일 문단 동시 편집을 자동 머지.
 *      · 정렬은 Y.Map 의 align(string) 필드로 저장 → last-writer-wins (단일 스칼라).
 *  - 표/도형/이미지/필드 등 복합 객체는 Phase 2 영역. 1차에서는 원본 run 객체를
 *    그대로 보존하여 라운드트립 시 손실 없이 복원한다 (Yjs 에는 텍스트만 노출).
 *  - 단락마다 안정 ID(`paragraphId`) 를 부여한다. 원본 HWPX 에 id 가 없으면
 *    `s{sectionIndex}-p{paraIndex}` 형태로 자동 생성한다. 동일 문서를 두 클라이언트가
 *    동일 순서로 파싱하면 같은 ID 가 나오므로 초기 sync 가 안전하다.
 *
 * Y.Doc 구조
 *  - ydoc.getMap('hwpx') : Y.Map
 *      ├─ 'meta'        : Y.Map ({ version: 'phase1' })
 *      ├─ 'paragraphs'  : Y.Map<paragraphId, Y.Map>
 *      │       └─ each Y.Map: { text: Y.Text, align: string }
 *      └─ 'order'       : Y.Array<paragraphId>  (문단 순서)
 *
 * 비-텍스트 run 정보는 매퍼 인스턴스의 sidecar(`_nonTextRuns`) 로 보존된다.
 * (원격에서 들어오는 새 단락에 대해서는 빈 run 으로 채워진다 — Phase 2 에서
 * 표/도형 동기화가 추가될 예정.)
 *
 * @module collab/yjs-doc-mapper
 */

import * as Y from 'yjs';

const Y_ROOT_KEY = 'hwpx';
const Y_PARAGRAPHS_KEY = 'paragraphs';
const Y_ORDER_KEY = 'order';
const Y_META_KEY = 'meta';

const VALID_ALIGNS = new Set(['left', 'center', 'right', 'justify']);

/**
 * 문단 ID 를 결정한다.
 * 우선순위: 명시적 id → 자동 생성 (`s{si}-p{pi}`)
 */
export function getParagraphId(para, sectionIndex, paragraphIndex) {
  if (para && typeof para.id === 'string' && para.id.length > 0) {
    return para.id;
  }
  if (para && typeof para.paragraphId === 'string' && para.paragraphId.length > 0) {
    return para.paragraphId;
  }
  return `s${sectionIndex}-p${paragraphIndex}`;
}

/**
 * 문단에서 plain text 를 추출 (run.text 만 연결).
 * 비-텍스트 run (도형/표/필드)은 무시 — Phase 1 한정.
 */
export function extractParagraphText(para) {
  if (!para || !Array.isArray(para.runs)) return '';
  let buf = '';
  for (const run of para.runs) {
    if (run && typeof run.text === 'string') {
      buf += run.text;
    }
  }
  return buf;
}

/**
 * 문단의 정렬 값을 normalized string 으로 반환.
 */
export function extractParagraphAlign(para) {
  const align = para && para.style && para.style.textAlign;
  if (typeof align === 'string' && VALID_ALIGNS.has(align.toLowerCase())) {
    return align.toLowerCase();
  }
  return 'left';
}

/**
 * 안전한 정렬 값으로 클램프.
 */
export function normalizeAlign(value) {
  if (typeof value !== 'string') return 'left';
  const v = value.toLowerCase();
  return VALID_ALIGNS.has(v) ? v : 'left';
}

/**
 * HWPX 문서를 Y.Doc 으로 직렬화.
 * @param {object} hwpxDoc - parser.js 결과 { sections: [...] }
 * @param {Y.Doc} [target] - 재사용할 Y.Doc (없으면 새로 생성)
 * @returns {Y.Doc}
 */
export function hwpxToYDoc(hwpxDoc, target) {
  const ydoc = target instanceof Y.Doc ? target : new Y.Doc();
  const root = ydoc.getMap(Y_ROOT_KEY);

  ydoc.transact(() => {
    // meta
    let meta = root.get(Y_META_KEY);
    if (!(meta instanceof Y.Map)) {
      meta = new Y.Map();
      root.set(Y_META_KEY, meta);
    }
    meta.set('version', 'phase1');

    let paragraphs = root.get(Y_PARAGRAPHS_KEY);
    if (!(paragraphs instanceof Y.Map)) {
      paragraphs = new Y.Map();
      root.set(Y_PARAGRAPHS_KEY, paragraphs);
    }

    let order = root.get(Y_ORDER_KEY);
    if (!(order instanceof Y.Array)) {
      order = new Y.Array();
      root.set(Y_ORDER_KEY, order);
    }

    // 기존 내용은 깨끗하게 다시 채운다 (라운드트립 안정성).
    if (order.length > 0) order.delete(0, order.length);
    Array.from(paragraphs.keys()).forEach(k => paragraphs.delete(k));

    const sections = Array.isArray(hwpxDoc && hwpxDoc.sections) ? hwpxDoc.sections : [];

    const orderList = [];
    sections.forEach((section, si) => {
      const paras = Array.isArray(section && section.paragraphs) ? section.paragraphs : [];
      paras.forEach((para, pi) => {
        const id = getParagraphId(para, si, pi);
        const pMap = new Y.Map();
        const yText = new Y.Text();
        const initialText = extractParagraphText(para);
        if (initialText) yText.insert(0, initialText);
        pMap.set('text', yText);
        pMap.set('align', extractParagraphAlign(para));
        paragraphs.set(id, pMap);
        orderList.push(id);
      });
    });
    if (orderList.length > 0) order.push(orderList);
  });

  return ydoc;
}

/**
 * Y.Doc → HWPX (역변환).
 * 원본 hwpxDoc 을 베이스로 텍스트/정렬만 패치한다 (비-텍스트 run 보존).
 *
 * @param {Y.Doc} ydoc
 * @param {object} hwpxDoc - 원본 문서 (immutable input; 결과는 새 객체)
 * @returns {object} 패치된 문서
 */
export function applyYDocToHwpx(ydoc, hwpxDoc) {
  const root = ydoc.getMap(Y_ROOT_KEY);
  const paragraphs = root.get(Y_PARAGRAPHS_KEY);
  if (!(paragraphs instanceof Y.Map)) {
    return cloneDocShallow(hwpxDoc);
  }

  const baseSections = Array.isArray(hwpxDoc && hwpxDoc.sections) ? hwpxDoc.sections : [];
  const newSections = baseSections.map((section, si) => {
    const paras = Array.isArray(section && section.paragraphs) ? section.paragraphs : [];
    const newParas = paras.map((para, pi) => {
      const id = getParagraphId(para, si, pi);
      const pMap = paragraphs.get(id);
      if (!(pMap instanceof Y.Map)) return cloneParaShallow(para);

      const yText = pMap.get('text');
      const align = normalizeAlign(pMap.get('align'));

      const newText = yText instanceof Y.Text ? yText.toString() : extractParagraphText(para);

      return patchParagraphTextAndAlign(para, newText, align);
    });
    return { ...section, paragraphs: newParas };
  });

  return { ...hwpxDoc, sections: newSections };
}

/**
 * 문단의 텍스트를 새 텍스트로 교체.
 * - 첫 텍스트 run 에 newText 를 통째로 넣고, 나머지 텍스트 run 은 제거한다.
 * - 텍스트 run 이 없으면(전부 도형/표) 새 run 을 prepend 한다.
 * - 비-텍스트 run 은 순서를 보존한다.
 */
export function patchParagraphTextAndAlign(para, newText, align) {
  const oldRuns = Array.isArray(para && para.runs) ? para.runs : [];
  const newRuns = [];
  let injected = false;

  for (const run of oldRuns) {
    if (run && typeof run.text === 'string') {
      if (!injected) {
        newRuns.push({ ...run, text: newText });
        injected = true;
      }
      // 추가 텍스트 run 은 흡수됨 (스킵)
      continue;
    }
    newRuns.push(run);
  }
  if (!injected) {
    newRuns.unshift({ text: newText, style: {} });
  }

  const oldStyle = (para && para.style) || {};
  return {
    ...para,
    runs: newRuns,
    style: { ...oldStyle, textAlign: align },
  };
}

function cloneDocShallow(doc) {
  if (!doc || typeof doc !== 'object') return { sections: [] };
  const sections = Array.isArray(doc.sections) ? doc.sections.map(cloneSectionShallow) : [];
  return { ...doc, sections };
}

function cloneSectionShallow(section) {
  const paras = Array.isArray(section && section.paragraphs)
    ? section.paragraphs.map(cloneParaShallow)
    : [];
  return { ...section, paragraphs: paras };
}

function cloneParaShallow(para) {
  if (!para) return { type: 'paragraph', runs: [], style: {} };
  return { ...para, runs: Array.isArray(para.runs) ? para.runs.slice() : [], style: { ...(para.style || {}) } };
}

/**
 * Y.Doc 에서 paragraph id 목록을 순서대로 반환.
 */
export function getOrderedParagraphIds(ydoc) {
  const root = ydoc.getMap(Y_ROOT_KEY);
  const order = root.get(Y_ORDER_KEY);
  if (!(order instanceof Y.Array)) return [];
  return order.toArray().filter(x => typeof x === 'string');
}

/**
 * 특정 문단의 Y.Text 핸들을 반환 (없으면 null).
 */
export function getParagraphYText(ydoc, paragraphId) {
  const root = ydoc.getMap(Y_ROOT_KEY);
  const paragraphs = root.get(Y_PARAGRAPHS_KEY);
  if (!(paragraphs instanceof Y.Map)) return null;
  const pMap = paragraphs.get(paragraphId);
  if (!(pMap instanceof Y.Map)) return null;
  const yText = pMap.get('text');
  return yText instanceof Y.Text ? yText : null;
}

/**
 * 특정 문단의 정렬을 반환.
 */
export function getParagraphAlign(ydoc, paragraphId) {
  const root = ydoc.getMap(Y_ROOT_KEY);
  const paragraphs = root.get(Y_PARAGRAPHS_KEY);
  if (!(paragraphs instanceof Y.Map)) return 'left';
  const pMap = paragraphs.get(paragraphId);
  if (!(pMap instanceof Y.Map)) return 'left';
  return normalizeAlign(pMap.get('align'));
}

/**
 * 특정 문단 텍스트를 통째로 교체 (로컬 편집 헬퍼).
 * - newText 와 기존 Y.Text 의 diff 를 단순히 "전체 삭제 후 삽입" 으로 적용.
 * - 더 정교한 diff 는 외부 (예: editor binding) 에서 처리.
 */
export function setParagraphText(ydoc, paragraphId, newText) {
  const yText = getParagraphYText(ydoc, paragraphId);
  if (!yText) return false;
  ydoc.transact(() => {
    if (yText.length > 0) yText.delete(0, yText.length);
    if (typeof newText === 'string' && newText.length > 0) {
      yText.insert(0, newText);
    }
  });
  return true;
}

/**
 * 특정 문단의 정렬을 변경.
 */
export function setParagraphAlign(ydoc, paragraphId, align) {
  const root = ydoc.getMap(Y_ROOT_KEY);
  const paragraphs = root.get(Y_PARAGRAPHS_KEY);
  if (!(paragraphs instanceof Y.Map)) return false;
  const pMap = paragraphs.get(paragraphId);
  if (!(pMap instanceof Y.Map)) return false;
  pMap.set('align', normalizeAlign(align));
  return true;
}

export const _internal = {
  Y_ROOT_KEY,
  Y_PARAGRAPHS_KEY,
  Y_ORDER_KEY,
  Y_META_KEY,
  VALID_ALIGNS,
};
