/**
 * Unit tests for excel-editor.js
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExcelEditor,
  parseCellAddr,
  parseCellInput,
  computeDisplay,
  setCell,
  __test__,
} from './excel-editor.js';

const { colToLetter, letterToCol } = __test__;

function makeModel() {
  return {
    sheets: [
      {
        name: 'Sheet1',
        rows: [
          [{ value: 'name' }, { value: 'qty' }],
          [{ value: '사과' }, { value: 3 }],
          [{ value: '배' }, { value: 5 }],
          [{ value: null }, { value: null }],
        ],
      },
      { name: '두번째', rows: [[{ value: 'foo' }]] },
    ],
    activeSheet: 'Sheet1',
  };
}

describe('helpers', () => {
  it('colToLetter / letterToCol 라운드트립', () => {
    for (const n of [1, 2, 26, 27, 28, 52, 53, 702, 703]) {
      expect(letterToCol(colToLetter(n))).toBe(n);
    }
  });

  it('parseCellAddr', () => {
    expect(parseCellAddr('A1')).toEqual({ col: 1, row: 1 });
    expect(parseCellAddr('$AA$10')).toEqual({ col: 27, row: 10 });
    expect(parseCellAddr('XYZ')).toBeNull();
  });

  it('parseCellInput', () => {
    expect(parseCellInput('=SUM(A1:A2)')).toEqual({ value: null, formula: '=SUM(A1:A2)' });
    expect(parseCellInput('42')).toEqual({ value: 42 });
    expect(parseCellInput('hello')).toEqual({ value: 'hello' });
    expect(parseCellInput('TRUE')).toEqual({ value: true });
    expect(parseCellInput('')).toEqual({ value: null });
  });
});

describe('computeDisplay & setCell', () => {
  it('일반 셀은 raw value 반환', () => {
    const m = makeModel();
    const d = computeDisplay(m.sheets[0], 2, 2);
    expect(d.display).toBe(3);
    expect(d.isFormula).toBe(false);
  });

  it('SUM formula 평가', () => {
    const m = makeModel();
    setCell(m.sheets[0], 5, 2, { value: null, formula: '=SUM(B2:B3)' });
    const d = computeDisplay(m.sheets[0], 5, 2);
    expect(d.isFormula).toBe(true);
    expect(d.display).toBe(8);
  });

  it('AVERAGE formula 평가', () => {
    const m = makeModel();
    setCell(m.sheets[0], 5, 2, { value: null, formula: '=AVERAGE(B2:B3)' });
    const d = computeDisplay(m.sheets[0], 5, 2);
    expect(d.display).toBe(4);
  });

  it('전이적 formula 평가 (셀 참조가 또 다른 formula)', () => {
    const m = makeModel();
    setCell(m.sheets[0], 5, 2, { value: null, formula: '=SUM(B2:B3)' });
    setCell(m.sheets[0], 6, 2, { value: null, formula: '=B5*2' });
    const d = computeDisplay(m.sheets[0], 6, 2);
    expect(d.display).toBe(16);
  });

  it('순환 참조는 #CYCLE! 또는 #REF! 안전 반환', () => {
    const m = makeModel();
    setCell(m.sheets[0], 5, 2, { value: null, formula: '=B6' });
    setCell(m.sheets[0], 6, 2, { value: null, formula: '=B5' });
    const d = computeDisplay(m.sheets[0], 5, 2);
    expect(String(d.display)).toMatch(/#CYCLE|#REF|#ERR/);
  });
});

describe('ExcelEditor rendering', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('시트 탭과 그리드를 렌더한다', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    const tabs = container.querySelectorAll('.ole-excel-editor__tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    const cells = container.querySelectorAll('td.ole-excel-editor__cell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('editCell 으로 값/수식 입력', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    editor.editCell(5, 2, '=SUM(B2:B3)');
    const out = editor.getDataModel();
    const cell = out.sheets[0].rows[4][1];
    expect(cell.formula).toBe('=SUM(B2:B3)');
  });

  it('setActiveSheet 으로 다른 시트 전환', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    editor.setActiveSheet('두번째');
    expect(editor.getActiveSheet().name).toBe('두번째');
  });

  it('addSheet 가 새 시트를 추가한다', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    const name = editor.addSheet('Custom');
    expect(name).toBe('Custom');
    expect(editor.getDataModel().sheets.find(s => s.name === 'Custom')).toBeTruthy();
  });

  it('dblclick 으로 input 진입 + Enter 로 커밋', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    const td = container.querySelector('td[data-row="5"][data-col="2"]');
    expect(td).toBeTruthy();
    td.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = container.querySelector('input.ole-excel-editor__input');
    expect(input).toBeTruthy();
    input.value = '=SUM(B2:B3)';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const out = editor.getDataModel();
    expect(out.sheets[0].rows[4][1].formula).toBe('=SUM(B2:B3)');
  });

  it('ESC 로 편집 취소 시 모델이 바뀌지 않는다', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    const td = container.querySelector('td[data-row="2"][data-col="2"]');
    td.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const input = container.querySelector('input.ole-excel-editor__input');
    input.value = '999';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const out = editor.getDataModel();
    expect(out.sheets[0].rows[1][1].value).toBe(3);
  });

  it('arrow key 로 selection 이동', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    editor._selectCell(2, 2);
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(editor.selection).toEqual({ row: 3, col: 2 });
  });

  it('숫자가 아닌 cell input 은 string 으로 저장', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    editor.editCell(1, 3, '한글');
    const out = editor.getDataModel();
    expect(out.sheets[0].rows[0][2].value).toBe('한글');
  });

  it('formula → 값 갱신 시 formula 삭제', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    editor.editCell(5, 2, '=SUM(B2:B3)');
    editor.editCell(5, 2, '42');
    const cell = editor.getDataModel().sheets[0].rows[4][1];
    expect(cell.value).toBe(42);
    expect(cell.formula).toBeUndefined();
  });
});

describe('ExcelEditor — BaseEditor 통합', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('isDirty 초기 false → editCell 후 true', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    expect(editor.isDirty()).toBe(false);
    editor.editCell(2, 2, '99');
    expect(editor.isDirty()).toBe(true);
    editor.markClean();
    expect(editor.isDirty()).toBe(false);
  });

  it('cell-change 이벤트 발화', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    let payload = null;
    editor.on('cell-change', p => { payload = p; });
    editor.editCell(3, 3, 'X');
    expect(payload).toEqual({ row: 3, col: 3 });
  });

  it('dirty 이벤트 발화', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.render();
    let fired = 0;
    editor.on('dirty', () => fired++);
    editor.editCell(2, 2, '11');
    expect(fired).toBeGreaterThanOrEqual(1);
  });
});

describe('ExcelEditor — Dependency Graph 통합', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('getAffectedCells 가 의존 셀을 반환', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.editCell(5, 2, '=SUM(B2:B3)'); // B5 = SUM(B2:B3)
    editor.render();
    const affected = editor.getAffectedCells(2, 2); // B2 변경
    expect(affected.has('2:2')).toBe(true);
    expect(affected.has('5:2')).toBe(true);
  });

  it('recomputeAffected 가 dirty 셀만 재평가', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.editCell(5, 2, '=SUM(B2:B3)');
    editor.render();
    const dirty = editor.getAffectedCells(2, 2);
    const results = editor.recomputeAffected(dirty);
    // B5 (5:2) 의 평가 결과는 SUM(B2=3 + B3=5) = 8
    const b5 = results.get('5:2');
    expect(b5).toBeTruthy();
    expect(Number(b5.value)).toBe(8);
  });

  it('getCycleCells 가 순환 참조 감지', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.editCell(5, 2, '=B6');
    editor.editCell(6, 2, '=B5');
    editor.render();
    const cyc = editor.getCycleCells();
    expect(cyc.has('5:2')).toBe(true);
    expect(cyc.has('6:2')).toBe(true);
  });

  it('순환 참조 셀은 #CYCLE! 로 렌더', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.editCell(5, 2, '=B6');
    editor.editCell(6, 2, '=B5');
    editor.render();
    const td = container.querySelector('td[data-row="5"][data-col="2"]');
    expect(td.classList.contains('is-cycle')).toBe(true);
    expect(td.textContent).toBe('#CYCLE!');
  });

  it('체인 변경 후 affected closure 가 전이 셀 포함', () => {
    const editor = new ExcelEditor({ container, dataModel: makeModel() });
    editor.editCell(5, 2, '=B2');
    editor.editCell(6, 2, '=B5*2');
    editor.render();
    const affected = editor.getAffectedCells(2, 2);
    expect(affected.has('5:2')).toBe(true);
    expect(affected.has('6:2')).toBe(true);
  });
});
