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
