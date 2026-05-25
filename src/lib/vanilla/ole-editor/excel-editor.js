/**
 * Excel 미니 편집기
 * ─────────────────────────────────────────────────────────────────────────────
 * 브라우저에서 OLE Excel 객체를 인플레이스 편집하기 위한 경량 UI 컴포넌트.
 *
 * 특징
 *   - 시트 탭 (여러 시트 지원)
 *   - 더블클릭 또는 Enter 로 셀 진입 (input)
 *   - `=` 로 시작하는 입력은 트랙 DD `table-formula/formula-engine` 으로 평가
 *   - dataModel 은 `decodeExcel(...)` 의 출력과 동일 스키마를 유지
 *
 * 보안 / 격리
 *   - 외부 fetch 없음
 *   - 셀에서 자유 JS 평가 없음 — Excel-호환 formula 만 화이트리스트 함수로 평가
 *
 * @module vanilla/ole-editor/excel-editor
 */

import { evaluateFormula } from '../table-formula/formula-engine.js';
import { BaseEditor } from '../core/base-editor.js';
import { ExcelFormulaGraph, cellKey } from './excel-formula-graph.js';

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

function colToLetter(colIdx) {
  // 1 → A, 27 → AA
  let n = colIdx;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function letterToCol(letter) {
  let n = 0;
  const up = letter.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    n = n * 26 + (up.charCodeAt(i) - 64);
  }
  return n;
}

/** A1 형식 주소 → {row, col} (1-based). */
export function parseCellAddr(addr) {
  if (!addr || typeof addr !== 'string') return null;
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(addr.trim());
  if (!m) return null;
  return { col: letterToCol(m[1]), row: Number(m[2]) };
}

// ---------------------------------------------------------------------------
// dataModel helpers
// ---------------------------------------------------------------------------

/**
 * dataModel 의 셀을 가져온다 (없으면 {value:null}).
 */
function getCell(sheet, row, col) {
  if (!sheet || row < 1 || col < 1) return { value: null };
  const r = sheet.rows[row - 1];
  if (!r) return { value: null };
  const c = r[col - 1];
  if (!c) return { value: null };
  return c;
}

/**
 * dataModel 의 셀에 값/수식을 설정한다.
 */
export function setCell(sheet, row, col, patch) {
  if (!sheet || row < 1 || col < 1) return;
  while (sheet.rows.length < row) sheet.rows.push([]);
  const r = sheet.rows[row - 1];
  while (r.length < col) r.push({ value: null });
  r[col - 1] = { ...r[col - 1], ...patch };
}

/**
 * 수식 평가용 컨텍스트를 만든다.
 * `=A1+B1` 의 셀 참조를 dataModel 에서 읽어 number/string/bool 로 변환.
 */
function makeFormulaContext(sheet) {
  return {
    getCellValue: addr => {
      const a = parseCellAddr(addr);
      if (!a) return 0;
      const cell = getCell(sheet, a.row, a.col);
      if (cell.formula) {
        // 단일 재귀 평가 (간단한 cycle 방지를 위해 동일 좌표 깊이 제한)
        try {
          return evaluateFormulaSafe(sheet, cell.formula, new Set([`${a.row}:${a.col}`]));
        } catch {
          return '#REF!';
        }
      }
      const v = cell.value;
      if (v === null || v === undefined) return 0;
      if (typeof v === 'number' || typeof v === 'boolean') return v;
      const num = Number(v);
      if (!Number.isNaN(num) && String(v).trim() !== '') return num;
      return v;
    },
  };
}

function evaluateFormulaSafe(sheet, formula, visited) {
  // 한 단계 깊이만 허용. 깊은 사이클은 #CYCLE!
  if (visited.size > 64) return '#CYCLE!';
  const ctx = {
    getCellValue: addr => {
      const a = parseCellAddr(addr);
      if (!a) return 0;
      const key = `${a.row}:${a.col}`;
      if (visited.has(key)) return '#CYCLE!';
      const cell = getCell(sheet, a.row, a.col);
      if (cell.formula) {
        const next = new Set(visited);
        next.add(key);
        try {
          return evaluateFormulaSafe(sheet, cell.formula, next);
        } catch {
          return '#REF!';
        }
      }
      const v = cell.value;
      if (v === null || v === undefined) return 0;
      if (typeof v === 'number' || typeof v === 'boolean') return v;
      const num = Number(v);
      if (!Number.isNaN(num) && String(v).trim() !== '') return num;
      return v;
    },
  };
  return evaluateFormula(formula, ctx);
}

/**
 * 셀의 화면 표시값을 계산한다.
 *   - formula 가 있으면 평가 결과
 *   - 그 외 value 그대로
 *
 * @param {object} sheet
 * @param {number} row 1-based
 * @param {number} col 1-based
 * @returns {{display:any, isFormula:boolean, raw:any, formula?:string}}
 */
export function computeDisplay(sheet, row, col) {
  const cell = getCell(sheet, row, col);
  if (cell.formula) {
    try {
      const value = evaluateFormulaSafe(sheet, cell.formula, new Set([`${row}:${col}`]));
      return { display: value, isFormula: true, raw: cell.value, formula: cell.formula };
    } catch (err) {
      return {
        display: `#ERR! ${err?.message || ''}`.trim(),
        isFormula: true,
        raw: cell.value,
        formula: cell.formula,
      };
    }
  }
  return { display: cell.value, isFormula: false, raw: cell.value };
}

/**
 * 사용자의 셀 입력 문자열을 dataModel 셀로 변환한다.
 *   - `=...` → formula
 *   - 빈 문자열 → value=null
 *   - 숫자 캐스팅 가능 → number
 *   - 그 외 → string
 *
 * @param {string} raw
 * @returns {{value:any, formula?:string}}
 */
export function parseCellInput(raw) {
  if (raw === null || raw === undefined) return { value: null };
  const text = String(raw);
  if (text.length === 0) return { value: null };
  if (text.startsWith('=')) return { value: null, formula: text };
  const trimmed = text.trim();
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
    return { value: Number(trimmed) };
  }
  if (/^(true|false)$/i.test(trimmed)) {
    return { value: /^true$/i.test(trimmed) };
  }
  return { value: text };
}

// ---------------------------------------------------------------------------
// Editor (DOM)
// ---------------------------------------------------------------------------

const DEFAULT_MIN_ROWS = 12;
const DEFAULT_MIN_COLS = 6;

/**
 * Excel 미니 편집기.
 *
 * @example
 *   const editor = new ExcelEditor({ container, dataModel });
 *   editor.render();
 *   const updated = editor.getDataModel();
 */
export class ExcelEditor extends BaseEditor {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container
   * @param {{sheets:Array<{name:string,rows:Array<Array<{value:any,formula?:string}>>}>, activeSheet:string}} opts.dataModel
   * @param {number} [opts.minRows]
   * @param {number} [opts.minCols]
   */
  constructor({ container, dataModel, minRows = DEFAULT_MIN_ROWS, minCols = DEFAULT_MIN_COLS }) {
    super({ container, dataModel });
    this.minRows = minRows;
    this.minCols = minCols;
    this.activeSheet = this.dataModel.activeSheet;
    /** @type {{row:number, col:number}|null} */
    this.selection = null;
    this._editingInput = null;
    /** @type {ExcelFormulaGraph|null} */
    this._formulaGraph = null;
  }

  /**
   * BaseEditor 훅 — dataModel 정규화.
   * @param {*} m
   */
  _normalizeModel(m) {
    return normalizeDataModel(m);
  }

  // -------------------------------------------------------------------------
  // dataModel access
  // -------------------------------------------------------------------------

  getDataModel() {
    // 셀 별 얕은 복사 + 시트 메타. typed-array 가 없어 JSON 직렬화도 가능하지만
    // formula 의 undefined 키 제거를 위해 명시적으로 dump 한다.
    return {
      type: 'excel',
      sheets: this.dataModel.sheets.map(s => ({
        name: s.name,
        rows: s.rows.map(r => r.map(c => ({ ...c }))),
      })),
      activeSheet: this.activeSheet,
    };
  }

  setActiveSheet(name) {
    if (!this.dataModel.sheets.find(s => s.name === name)) return;
    this.activeSheet = name;
    this.selection = null;
    this.render();
  }

  addSheet(name) {
    const base = name || `Sheet${this.dataModel.sheets.length + 1}`;
    let final = base;
    let i = 2;
    while (this.dataModel.sheets.find(s => s.name === final)) {
      final = `${base}(${i++})`;
    }
    this.dataModel.sheets.push({ name: final, rows: [] });
    this.activeSheet = final;
    this.render();
    return final;
  }

  /**
   * @returns {object} 현재 활성 시트.
   */
  getActiveSheet() {
    return (
      this.dataModel.sheets.find(s => s.name === this.activeSheet) || this.dataModel.sheets[0]
    );
  }

  /**
   * 셀 한 칸 편집.
   * @param {number} row 1-based
   * @param {number} col 1-based
   * @param {string} rawInput
   */
  editCell(row, col, rawInput) {
    const sheet = this.getActiveSheet();
    if (!sheet) return;
    const patch = parseCellInput(rawInput);
    // formula 가 없으면 기존 formula 도 제거
    if (!('formula' in patch)) {
      const existing = getCell(sheet, row, col);
      if (existing.formula) {
        setCell(sheet, row, col, { value: patch.value, formula: undefined });
        const r = sheet.rows[row - 1];
        if (r && r[col - 1]) delete r[col - 1].formula;
        this._ensureGraph(sheet);
        this._formulaGraph?.updateCell(row, col, undefined);
        this._markDirty();
        this._emit('cell-change', { row, col });
        return;
      }
    }
    setCell(sheet, row, col, patch);
    this._ensureGraph(sheet);
    this._formulaGraph?.updateCell(row, col, patch.formula);
    this._markDirty();
    this._emit('cell-change', { row, col });
  }

  /**
   * 첫 호출 시 또는 시트 교체 후 의존성 그래프를 새로 빌드한다.
   * @param {object} sheet
   * @protected
   */
  _ensureGraph(sheet) {
    if (!this._formulaGraph) {
      this._formulaGraph = new ExcelFormulaGraph();
      this._formulaGraph.build(sheet);
    }
  }

  /**
   * 셀 변경 시 영향받는 셀들의 closure 를 계산한다 (그래프 forward).
   * @param {number} row 1-based
   * @param {number} col 1-based
   * @returns {Set<string>} dirty cellKey 집합
   */
  getAffectedCells(row, col) {
    const sheet = this.getActiveSheet();
    if (!sheet) return new Set();
    this._ensureGraph(sheet);
    return this._formulaGraph.getDirtyCells(cellKey(row, col));
  }

  /**
   * dirty 셀만 evaluator 로 재평가한다 (전체 render 없이 td 단위 업데이트용).
   * @param {Set<string>} dirtyCells
   * @returns {Map<string, {value:any, error?:string}>}
   */
  recomputeAffected(dirtyCells) {
    const sheet = this.getActiveSheet();
    if (!sheet || !this._formulaGraph) return new Map();
    return this._formulaGraph.recomputeDirty(sheet, dirtyCells, (s, r, c) => {
      const d = computeDisplay(s, r, c);
      return d.display;
    });
  }

  /**
   * 현재 그래프에서 사이클에 속한 셀 키 집합.
   * @returns {Set<string>}
   */
  getCycleCells() {
    if (!this._formulaGraph) return new Set();
    return this._formulaGraph.detectCycles();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  render() {
    this.container.innerHTML = '';
    this.container.classList.add('ole-excel-editor');

    // Sheet tabs
    const tabs = document.createElement('div');
    tabs.className = 'ole-excel-editor__tabs';
    for (const s of this.dataModel.sheets) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'ole-excel-editor__tab';
      tab.textContent = s.name;
      tab.dataset.sheet = s.name;
      if (s.name === this.activeSheet) tab.classList.add('is-active');
      tab.addEventListener('click', () => this.setActiveSheet(s.name));
      tabs.appendChild(tab);
    }
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'ole-excel-editor__tab ole-excel-editor__tab--add';
    addBtn.textContent = '+';
    addBtn.title = '시트 추가';
    addBtn.addEventListener('click', () => this.addSheet());
    tabs.appendChild(addBtn);
    this.container.appendChild(tabs);

    // Grid
    const sheet = this.getActiveSheet();
    if (!sheet) return;

    // (re)build dependency graph for the active sheet
    this._formulaGraph = new ExcelFormulaGraph();
    this._formulaGraph.build(sheet);
    const cycleCells = this._formulaGraph.detectCycles();

    const usedRows = sheet.rows.length;
    const usedCols = sheet.rows.reduce((m, r) => Math.max(m, r.length), 0);
    const rowCount = Math.max(usedRows, this.minRows);
    const colCount = Math.max(usedCols, this.minCols);

    const table = document.createElement('table');
    table.className = 'ole-excel-editor__grid';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'ole-excel-editor__corner';
    headRow.appendChild(corner);
    for (let c = 1; c <= colCount; c++) {
      const th = document.createElement('th');
      th.textContent = colToLetter(c);
      th.scope = 'col';
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 1; r <= rowCount; r++) {
      const tr = document.createElement('tr');
      const rh = document.createElement('th');
      rh.scope = 'row';
      rh.textContent = String(r);
      rh.className = 'ole-excel-editor__rowhead';
      tr.appendChild(rh);
      for (let c = 1; c <= colCount; c++) {
        const td = document.createElement('td');
        td.dataset.row = String(r);
        td.dataset.col = String(c);
        td.className = 'ole-excel-editor__cell';
        const isCycle = cycleCells.has(cellKey(r, c));
        const { display, isFormula, formula } = computeDisplay(sheet, r, c);
        const shown = isCycle ? '#CYCLE!' : display;
        td.textContent = shown === null || shown === undefined ? '' : String(shown);
        if (isFormula) {
          td.classList.add('is-formula');
          td.title = formula || '';
        }
        if (isCycle) {
          td.classList.add('is-cycle');
          td.title = `${formula || ''} (순환 참조)`;
        }
        if (this.selection && this.selection.row === r && this.selection.col === c) {
          td.classList.add('is-selected');
        }
        td.addEventListener('click', () => this._selectCell(r, c));
        td.addEventListener('dblclick', () => this._beginEdit(r, c));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.container.appendChild(table);

    // Keyboard listener (Enter to edit, arrows to move)
    this.container.tabIndex = 0;
    this.container.addEventListener('keydown', this._onKeyDown);
  }

  _selectCell(row, col) {
    this.selection = { row, col };
    // 가벼운 재페인트 — 셀 클래스만 토글
    const tds = this.container.querySelectorAll('.ole-excel-editor__cell');
    tds.forEach(td => {
      const r = Number(td.dataset.row);
      const c = Number(td.dataset.col);
      td.classList.toggle('is-selected', r === row && c === col);
    });
  }

  _beginEdit(row, col) {
    if (this._editingInput) return;
    const td = this.container.querySelector(
      `td.ole-excel-editor__cell[data-row="${row}"][data-col="${col}"]`
    );
    if (!td) return;
    const sheet = this.getActiveSheet();
    const cell = getCell(sheet, row, col);
    const initial = cell.formula ?? (cell.value ?? '');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ole-excel-editor__input';
    input.value = String(initial);
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();
    const commit = () => {
      if (this._editingInput !== input) return;
      const value = input.value;
      this.editCell(row, col, value);
      this._editingInput = null;
      this.render();
      this._selectCell(row, col);
    };
    const cancel = () => {
      if (this._editingInput !== input) return;
      this._editingInput = null;
      this.render();
      this._selectCell(row, col);
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
    input.addEventListener('blur', commit);
    this._editingInput = input;
  }

  _onKeyDown = e => {
    if (this._editingInput) return;
    if (!this.selection) return;
    const { row, col } = this.selection;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      this._beginEdit(row, col);
    } else if (e.key === 'ArrowUp' && row > 1) {
      e.preventDefault();
      this._selectCell(row - 1, col);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._selectCell(row + 1, col);
    } else if (e.key === 'ArrowLeft' && col > 1) {
      e.preventDefault();
      this._selectCell(row, col - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this._selectCell(row, col + 1);
    }
  };

  destroy() {
    this.container.removeEventListener('keydown', this._onKeyDown);
    this._formulaGraph = null;
    super.destroy();
  }
}

/**
 * dataModel 정규화 (없는 필드 보강).
 * @param {*} input
 */
function normalizeDataModel(input) {
  const model = input && typeof input === 'object' ? input : {};
  const sheets = Array.isArray(model.sheets) && model.sheets.length > 0
    ? model.sheets
    : [{ name: 'Sheet1', rows: [] }];
  return {
    sheets: sheets.map(s => ({
      name: s?.name || 'Sheet1',
      rows: Array.isArray(s?.rows)
        ? s.rows.map(r => (Array.isArray(r) ? r.map(c => ({ value: null, ...c })) : []))
        : [],
    })),
    activeSheet: model.activeSheet || sheets[0]?.name || 'Sheet1',
  };
}

export const __test__ = {
  colToLetter,
  letterToCol,
  normalizeDataModel,
  evaluateFormulaSafe,
};
