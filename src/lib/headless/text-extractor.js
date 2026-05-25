/**
 * Text Extractor (Headless)
 * -----------------------------------------------------------------------------
 * parseHwpxHeadless() 가 반환한 document 객체에서 텍스트만 뽑아내는
 * 순수 함수 모듈. ZIP/DOM 의존성 없음 — Node/브라우저 모두에서 동일하게 동작.
 *
 * 제공 API:
 *  - extractPlainText(doc)         → string (단락별 \n 으로 join)
 *  - extractStructuredText(doc)    → Array<{section, paragraph, text}>
 *  - extractTables(doc)            → Array<Array<Array<string>>>
 *
 * @module lib/headless/text-extractor
 */

/**
 * 단일 paragraph 의 runs 를 평탄화해서 텍스트만 추출한다.
 * - hyperlink / ruby / bookmark / 수식 / 폼컨트롤 등은
 *   사람이 읽을 수 있는 표시 텍스트(`text` 필드)를 그대로 사용한다.
 *
 * @param {object} para SimpleHWPXParser 의 paragraph
 * @returns {string}
 */
function runsToText(para) {
  if (!para || !Array.isArray(para.runs)) return '';
  let out = '';
  for (const run of para.runs) {
    if (!run || typeof run !== 'object') continue;
    // 이미지/도형 등 placeholder run 은 무시
    if (run.hasImage || run.hasShape) continue;
    if (typeof run.text === 'string' && run.text.length > 0) {
      out += run.text;
    } else if (run.hyperlink && typeof run.hyperlink.text === 'string') {
      out += run.hyperlink.text;
    } else if (run.type === 'ruby' && typeof run.baseText === 'string') {
      out += run.baseText;
    }
  }
  return out;
}

/**
 * 셀 내부의 모든 paragraph 텍스트를 \n 으로 join 한다.
 * 셀이 중첩 표를 포함하면 표 내용을 ` | ` 로 평탄화한다.
 *
 * @param {object} cell
 * @returns {string}
 */
function cellToText(cell) {
  if (!cell || !Array.isArray(cell.elements)) return '';
  const lines = [];
  for (const el of cell.elements) {
    if (!el || typeof el !== 'object') continue;
    if (el.type === 'paragraph') {
      lines.push(runsToText(el));
    } else if (el.type === 'table') {
      const t = tableToMatrix(el);
      for (const row of t) lines.push(row.join(' | '));
    }
  }
  return lines.join('\n').trim();
}

/**
 * 표 → 2차원 문자열 배열로 평탄화.
 * colSpan/rowSpan 은 첫 셀에만 텍스트가 들어가도록 자연 처리되지만,
 * grid 정렬은 시도하지 않는다 (구조 보존이 필요하면 별도 호출자가 가공).
 *
 * @param {object} table
 * @returns {string[][]}
 */
function tableToMatrix(table) {
  if (!table || !Array.isArray(table.rows)) return [];
  return table.rows.map(row => {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    return cells.map(cellToText);
  });
}

/**
 * 모든 단락을 \n 으로 join 한 평문을 반환한다.
 * 표 내용은 `| ` 로 join 된 행으로 포함된다.
 *
 * @param {object} doc parseHwpxHeadless 결과
 * @returns {string}
 */
export function extractPlainText(doc) {
  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  const out = [];
  for (const sec of sections) {
    const elements = Array.isArray(sec?.elements) ? sec.elements : [];
    for (const el of elements) {
      if (!el || typeof el !== 'object') continue;
      if (el.type === 'paragraph') {
        out.push(runsToText(el));
      } else if (el.type === 'table') {
        const matrix = tableToMatrix(el);
        for (const row of matrix) out.push(row.join(' | '));
      }
    }
  }
  return out.join('\n');
}

/**
 * 구조 보존: 섹션/단락 인덱스를 함께 돌려준다.
 * AI/번역 파이프라인 등에서 위치 추적이 필요할 때 사용한다.
 *
 * @param {object} doc
 * @returns {Array<{section: number, paragraph: number, text: string}>}
 */
export function extractStructuredText(doc) {
  const result = [];
  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  sections.forEach((sec, sIdx) => {
    const elements = Array.isArray(sec?.elements) ? sec.elements : [];
    let pIdx = 0;
    for (const el of elements) {
      if (!el || el.type !== 'paragraph') continue;
      result.push({
        section: sIdx,
        paragraph: pIdx,
        text: runsToText(el),
      });
      pIdx += 1;
    }
  });
  return result;
}

/**
 * 문서 내의 모든 표를 2차원 문자열 배열로 추출한다.
 * 호출자가 CSV/TSV 변환을 손쉽게 할 수 있도록 한다.
 *
 * @param {object} doc
 * @returns {Array<Array<Array<string>>>}
 */
export function extractTables(doc) {
  const tables = [];
  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  for (const sec of sections) {
    const elements = Array.isArray(sec?.elements) ? sec.elements : [];
    for (const el of elements) {
      if (el && el.type === 'table') {
        tables.push(tableToMatrix(el));
      }
    }
  }
  return tables;
}

// 내부 헬퍼도 테스트 용도로 노출
export { runsToText, cellToText, tableToMatrix };
