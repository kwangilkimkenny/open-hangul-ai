/**
 * Footnote / Endnote Area Renderer
 * ✅ Phase 2-2: 각주(footnote)는 페이지 하단, 미주(endnote)는 문서 말미에 배치
 *
 * - 각주 영역: 페이지 컨테이너 하단에 `.hwp-footnotes` div 로 삽입
 * - 미주 영역: 문서 끝(마지막 페이지 뒤)에 `.hwp-endnotes` div 로 삽입
 * - 양방향 점프: 본문의 `[N]` ↔ 영역의 `[N]` 본문 (id 매칭)
 *
 * @module renderers/footnote
 * @version 1.0.0
 */

import { renderParagraph } from './paragraph.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('FootnoteRenderer');

/**
 * 각주 영역의 예약 높이 (px). 페이지 분할 시 본문 영역에서 미리 빼놓음.
 * 휴리스틱: 한 페이지에 표시될 수 있는 각주 본문의 시작 높이.
 */
export const FOOTNOTE_AREA_RESERVE_PX = 80;

/**
 * 단일 노트(footnote/endnote) 컨테이너 생성
 * @param {Object} note - { type, number, paragraphs }
 * @returns {HTMLElement|null}
 */
export function renderNoteEntry(note) {
  if (!note) return null;
  const isFootnote = note.type === 'footnote';
  const idPrefix = isFootnote ? 'fn' : 'en';
  const num = note.number != null && note.number !== '' ? String(note.number) : '';

  const entry = document.createElement('div');
  entry.className = isFootnote ? 'hwp-footnote-entry' : 'hwp-endnote-entry';
  if (num) {
    entry.id = `${idPrefix}-${num}`;
  }
  entry.style.fontSize = '10pt';
  entry.style.lineHeight = '1.35';
  entry.style.marginBottom = '4px';
  entry.style.display = 'flex';
  entry.style.gap = '4px';

  // 번호 + 백링크
  const marker = document.createElement('span');
  marker.className = isFootnote ? 'hwp-footnote-marker' : 'hwp-endnote-marker';
  marker.style.flexShrink = '0';
  marker.style.color = '#0645ad';

  if (num) {
    const back = document.createElement('a');
    back.href = `#${idPrefix}ref-${num}`;
    back.textContent = `[${num}]`;
    back.style.textDecoration = 'none';
    back.style.color = 'inherit';
    marker.appendChild(back);
  } else {
    marker.textContent = '[*]';
  }
  entry.appendChild(marker);

  // 본문 단락(들)
  const body = document.createElement('div');
  body.className = isFootnote ? 'hwp-footnote-body' : 'hwp-endnote-body';
  body.style.flex = '1';
  body.style.minWidth = '0';

  if (Array.isArray(note.paragraphs) && note.paragraphs.length > 0) {
    note.paragraphs.forEach(para => {
      try {
        const paraDiv = renderParagraph(para);
        if (paraDiv) {
          // 영역 안에서는 단락 간격 최소화
          paraDiv.style.margin = '0';
          body.appendChild(paraDiv);
        }
      } catch (err) {
        logger.warn('Note paragraph render failed:', err);
      }
    });
  }
  entry.appendChild(body);

  return entry;
}

/**
 * 각주 영역(footnotes) 렌더링
 * @param {Array<Object>} notes - 각주 배열 (이 페이지에서 참조된 것만)
 * @returns {HTMLElement|null}
 */
export function renderFootnoteArea(notes) {
  if (!notes || notes.length === 0) return null;

  const area = document.createElement('div');
  area.className = 'hwp-footnotes';
  area.style.borderTop = '1px solid #999';
  area.style.marginTop = '12px';
  area.style.paddingTop = '6px';
  area.style.fontSize = '10pt';
  area.style.color = '#222';

  notes.forEach(note => {
    const entry = renderNoteEntry({ ...note, type: 'footnote' });
    if (entry) area.appendChild(entry);
  });

  logger.debug(`[Footnote] rendered area with ${notes.length} entries`);
  return area;
}

/**
 * 미주 영역(endnotes) 렌더링 — 문서 말미에 한 번만
 * @param {Array<Object>} notes - 모든 미주 배열
 * @returns {HTMLElement|null}
 */
export function renderEndnoteArea(notes) {
  if (!notes || notes.length === 0) return null;

  const area = document.createElement('div');
  area.className = 'hwp-endnotes';
  area.style.borderTop = '2px solid #666';
  area.style.marginTop = '24px';
  area.style.paddingTop = '12px';
  area.style.fontSize = '10pt';
  area.style.color = '#222';

  // 제목 (미주)
  const title = document.createElement('div');
  title.className = 'hwp-endnotes-title';
  title.textContent = '미주';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  area.appendChild(title);

  notes.forEach(note => {
    const entry = renderNoteEntry({ ...note, type: 'endnote' });
    if (entry) area.appendChild(entry);
  });

  logger.debug(`[Endnote] rendered area with ${notes.length} entries`);
  return area;
}

export default {
  renderFootnoteArea,
  renderEndnoteArea,
  renderNoteEntry,
  FOOTNOTE_AREA_RESERVE_PX,
};
