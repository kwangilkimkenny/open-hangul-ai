/**
 * Table Formula Controller
 *
 * HWPX 표 모델에서 수식 셀을 감지하고 평가합니다.
 *
 * 표 모델 형태 (파서가 생성):
 *   {
 *     type: 'table',
 *     rows: [
 *       { cells: [
 *           { elements: [{ type:'paragraph', runs:[{text:'=SUM(A1:A3)'}] }] },
 *           ...
 *       ]}
 *     ]
 *   }
 *
 * 셀 텍스트의 첫 글자가 '=' 이면 수식으로 해석합니다. 표시값은
 * `cell._formula = { src, value, error }` 메타데이터로 보존하고, 텍스트는
 * 계산된 값으로 교체합니다. 원본 수식은 메타데이터로 보존되므로 추후
 * 라운드트립 직렬화에서 다시 사용할 수 있습니다.
 *
 * 다른 트랙(canvas-editor, AI, hwpx parser/serializer)은 건드리지 않으며,
 * 별도로 호출되는 분리된 컨트롤러입니다.
 *
 * @module table-formula/table-formula-controller
 */

import { evaluateFormula, extractDependencies } from './formula-engine.js';
import { cellAddrToIndex, indexToCellAddr } from './cell-address.js';
import { DependencyGraph } from './dependency-graph.js';

/**
 * 셀 객체에서 텍스트를 추출합니다. `cell.elements` 또는 `cell.paragraphs`
 * (둘 다 paragraph 배열) 안의 모든 run.text 를 합칩니다.
 *
 * @param {object} cell
 * @returns {string}
 */
export function getCellText(cell) {
  if (!cell || typeof cell !== 'object') return '';
  const paragraphs = cell.elements || cell.paragraphs || [];
  let out = '';
  for (const p of paragraphs) {
    if (!p) continue;
    const runs = p.runs || [];
    for (const r of runs) {
      if (r && typeof r.text === 'string') out += r.text;
    }
  }
  return out;
}

/**
 * 텍스트가 수식인지(첫 글자 '=') 확인합니다. 단일 '=' 문자열은 수식으로
 * 보지 않습니다.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isFormulaText(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  return t.startsWith('=') && t.length > 1;
}

/**
 * 셀의 표시값(텍스트) 을 직접 새 값으로 교체합니다.
 * 첫 번째 paragraph 의 첫 번째 run.text 를 바꾸고, 나머지 run/paragraph 는 비웁니다.
 *
 * @param {object} cell
 * @param {string} displayValue
 */
export function setCellDisplayText(cell, displayValue) {
  if (!cell || typeof cell !== 'object') return;
  const key = cell.elements ? 'elements' : (cell.paragraphs ? 'paragraphs' : 'elements');
  let arr = cell[key];
  if (!Array.isArray(arr) || arr.length === 0) {
    arr = [{ type: 'paragraph', runs: [{ text: displayValue }] }];
    cell[key] = arr;
    return;
  }
  // first paragraph
  const para = arr[0];
  if (!Array.isArray(para.runs) || para.runs.length === 0) {
    para.runs = [{ text: displayValue }];
  } else {
    para.runs[0] = { ...para.runs[0], text: displayValue };
    // clear remaining runs in first paragraph
    para.runs.length = 1;
  }
  // clear extra paragraphs
  arr.length = 1;
}

/**
 * 셀의 값을 숫자/문자열/불리언 으로 강제 해석합니다.
 * 수식 셀의 경우 계산된 값(._formula.value)을 우선합니다.
 *
 * @param {object} cell
 * @returns {number|string|boolean|null}
 */
export function getCellValue(cell) {
  if (!cell || typeof cell !== 'object') return null;
  if (cell._formula && 'value' in cell._formula) {
    return cell._formula.value;
  }
  const text = getCellText(cell);
  if (text === '') return null;
  const trimmed = text.trim();
  // numeric?
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  const upper = trimmed.toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  return text;
}

/**
 * 표 안의 셀들을 (col, row) 형태로 인덱싱한 맵을 만듭니다.
 * 병합 셀(rowSpan/colSpan > 1)도 anchor 셀의 위치에만 기록합니다.
 *
 * @param {object} table
 * @returns {{
 *   cellAt: Map<string, object>,   // addr -> cell
 *   addrOf: Map<object, string>,   // cell -> addr (anchor)
 * }}
 */
export function indexTable(table) {
  const cellAt = new Map();
  const addrOf = new Map();
  const rows = table?.rows || [];
  // We need to honor existing rowSpan/colSpan so addresses match visual grid.
  // occupied[row][col] = true if covered by a span
  const occupied = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const cells = row?.cells || [];
    if (!occupied[r]) occupied[r] = [];
    let c = 0;
    for (const cell of cells) {
      while (occupied[r][c]) c++;
      const addr = indexToCellAddr(c, r);
      cellAt.set(addr, cell);
      addrOf.set(cell, addr);
      const rs = Math.max(1, cell.rowSpan || 1);
      const cs = Math.max(1, cell.colSpan || 1);
      for (let dr = 0; dr < rs; dr++) {
        if (!occupied[r + dr]) occupied[r + dr] = [];
        for (let dc = 0; dc < cs; dc++) {
          occupied[r + dr][c + dc] = true;
        }
      }
      c += cs;
    }
  }
  return { cellAt, addrOf };
}

/**
 * Excel 호환 에러 메시지를 사용자에게 보여줄 짧은 문자열로 변환합니다.
 *
 * @param {Error} err
 * @returns {string}
 */
function formatError(err) {
  const msg = String(err?.message || err);
  if (msg.startsWith('#')) return msg;
  if (/Circular/i.test(msg)) return '#CYCLE!';
  if (/Unknown function/i.test(msg)) return '#NAME?';
  if (/Unexpected|Expected|Invalid/i.test(msg)) return '#PARSE!';
  return '#ERROR!';
}

/**
 * 표의 모든 셀에 대해 수식을 평가하고 표시값을 갱신합니다.
 *
 * 절차:
 *   1) 모든 셀의 텍스트를 스캔, 수식 셀을 찾아 의존성 그래프를 빌드한다.
 *   2) 위상 정렬 순서대로 평가한다.
 *   3) 결과를 cell.elements[0].runs[0].text 에 기록하고, 원본 수식을
 *      cell._formula = { src, value, error } 로 보존한다.
 *
 * @param {object} table   HWPX 표 모델
 * @returns {{
 *   evaluated: number,
 *   errors: number,
 *   cells: Array<{addr:string, value:any, error?:string}>,
 * }}
 */
export function recalculateTable(table) {
  const result = { evaluated: 0, errors: 0, cells: [] };
  if (!table || !Array.isArray(table.rows)) return result;

  const { cellAt } = indexTable(table);
  const graph = new DependencyGraph();
  /** @type {Map<string, string>} addr -> formula source (without leading =) */
  const formulas = new Map();
  /** @type {Set<string>} addrs whose formula failed to parse (skip later eval) */
  const parseErrored = new Set();

  // (1) collect formulas + dependencies
  for (const [addr, cell] of cellAt.entries()) {
    const text = getCellText(cell);
    if (!isFormulaText(text)) {
      // clear any prior formula metadata
      if (cell._formula) delete cell._formula;
      continue;
    }
    const src = text.trim();
    formulas.set(addr, src);
    try {
      const deps = extractDependencies(src);
      for (const dep of deps) {
        graph.addDependency(addr, dep);
      }
    } catch (err) {
      // parse error — record now and skip evaluation
      const errStr = formatError(err);
      cell._formula = { src, value: null, error: errStr };
      setCellDisplayText(cell, errStr);
      parseErrored.add(addr);
      result.errors++;
      result.cells.push({ addr, value: null, error: errStr });
    }
  }

  // (2) detect cycles
  const cycle = graph.detectCycles();
  const cycleSet = new Set(cycle);

  // (3) build evaluation order — affected by ALL formula seeds
  const seeds = Array.from(formulas.keys());
  let order;
  try {
    order = graph.topologicalOrder(seeds);
  } catch {
    order = seeds;
  }
  // include any formula cells not in graph (no deps) at the front
  const inOrder = new Set(order);
  for (const a of seeds) if (!inOrder.has(a)) order.unshift(a);

  // (4) evaluate
  /** @type {Map<string, any>} computed cell values for in-progress eval */
  const computed = new Map();
  const ctx = {
    getCellValue: (refAddr) => {
      if (computed.has(refAddr)) return computed.get(refAddr);
      const c = cellAt.get(refAddr);
      if (!c) return null;
      return getCellValue(c);
    },
  };

  for (const addr of order) {
    if (!formulas.has(addr)) continue;
    if (parseErrored.has(addr)) continue;
    const cell = cellAt.get(addr);
    if (!cell) continue;
    if (cycleSet.has(addr)) {
      const errStr = '#CYCLE!';
      cell._formula = { src: formulas.get(addr), value: null, error: errStr };
      setCellDisplayText(cell, errStr);
      computed.set(addr, null);
      result.errors++;
      result.cells.push({ addr, value: null, error: errStr });
      continue;
    }
    try {
      const value = evaluateFormula(formulas.get(addr), ctx);
      cell._formula = { src: formulas.get(addr), value };
      setCellDisplayText(cell, formatDisplay(value));
      computed.set(addr, value);
      result.evaluated++;
      result.cells.push({ addr, value });
    } catch (err) {
      const errStr = formatError(err);
      cell._formula = { src: formulas.get(addr), value: null, error: errStr };
      setCellDisplayText(cell, errStr);
      computed.set(addr, null);
      result.errors++;
      result.cells.push({ addr, value: null, error: errStr });
    }
  }
  return result;
}

/**
 * 평가 결과를 표시 문자열로 변환합니다.
 * - 숫자: 소수점이 길면 적절히 자릅니다 (12자리)
 * - 불리언: TRUE / FALSE
 *
 * @param {any} v
 * @returns {string}
 */
export function formatDisplay(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '#NUM!';
    if (Number.isInteger(v)) return String(v);
    // limit precision but trim trailing zeros
    return parseFloat(v.toFixed(12)).toString();
  }
  return String(v);
}

/**
 * Controller 클래스 — 다른 트랙에서 인스턴스를 들고 다닐 때 사용.
 */
export class TableFormulaController {
  constructor() {
    /** @type {DependencyGraph} */
    this.lastGraph = new DependencyGraph();
  }

  /**
   * 단일 표를 재계산합니다.
   * @param {object} table
   */
  recalculate(table) {
    return recalculateTable(table);
  }

  /**
   * 문서 트리 전체를 순회하며 모든 표를 재계산합니다.
   * @param {object} doc   { sections: [{ elements: [...] }, ...] }
   */
  recalculateDocument(doc) {
    const totals = { evaluated: 0, errors: 0, tables: 0 };
    if (!doc?.sections) return totals;
    const visit = (elements) => {
      if (!Array.isArray(elements)) return;
      for (const el of elements) {
        if (!el || typeof el !== 'object') continue;
        if (el.type === 'table') {
          const r = this.recalculate(el);
          totals.tables++;
          totals.evaluated += r.evaluated;
          totals.errors += r.errors;
          // also visit nested elements inside cells (tables can nest)
          for (const row of el.rows || []) {
            for (const cell of row.cells || []) {
              visit(cell.elements || cell.paragraphs || []);
            }
          }
        }
      }
    };
    for (const sec of doc.sections) visit(sec.elements || []);
    return totals;
  }
}

/**
 * 셀 주소 유틸리티 재노출 (외부 사용 편의).
 */
export { cellAddrToIndex, indexToCellAddr };
