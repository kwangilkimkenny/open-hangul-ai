/**
 * table-formula-controller.test.js
 */
import { describe, it, expect } from 'vitest';
import {
  TableFormulaController,
  recalculateTable,
  getCellText,
  isFormulaText,
  getCellValue,
  indexTable,
} from './table-formula-controller.js';

/**
 * Helper: build a simple table with 2D string array. Strings starting with '='
 * are treated as formulas.
 */
function makeTable(grid) {
  return {
    type: 'table',
    rows: grid.map((row) => ({
      cells: row.map((text) => ({
        rowSpan: 1,
        colSpan: 1,
        elements: [{ type: 'paragraph', runs: [{ text: String(text) }] }],
      })),
    })),
  };
}

describe('table-formula-controller — helpers', () => {
  it('getCellText concatenates runs', () => {
    const cell = {
      elements: [
        { type: 'paragraph', runs: [{ text: 'hi ' }, { text: 'there' }] },
      ],
    };
    expect(getCellText(cell)).toBe('hi there');
  });

  it('isFormulaText accepts =SUM(...) but not bare "="', () => {
    expect(isFormulaText('=A1+B1')).toBe(true);
    expect(isFormulaText('hello')).toBe(false);
    expect(isFormulaText('=')).toBe(false);
  });

  it('getCellValue parses numeric text', () => {
    const cell = {
      elements: [{ type: 'paragraph', runs: [{ text: '12.5' }] }],
    };
    expect(getCellValue(cell)).toBe(12.5);
  });

  it('indexTable handles 2x2 with no merges', () => {
    const tbl = makeTable([['A', 'B'], ['C', 'D']]);
    const { cellAt } = indexTable(tbl);
    expect(getCellText(cellAt.get('A1'))).toBe('A');
    expect(getCellText(cellAt.get('B1'))).toBe('B');
    expect(getCellText(cellAt.get('A2'))).toBe('C');
    expect(getCellText(cellAt.get('B2'))).toBe('D');
  });

  it('indexTable skips columns covered by colSpan', () => {
    const tbl = {
      type: 'table',
      rows: [
        {
          cells: [
            { rowSpan: 1, colSpan: 2, elements: [{ type: 'paragraph', runs: [{ text: 'merged' }] }] },
            { rowSpan: 1, colSpan: 1, elements: [{ type: 'paragraph', runs: [{ text: 'C1' }] }] },
          ],
        },
      ],
    };
    const { cellAt, addrOf } = indexTable(tbl);
    // first cell anchors at A1 and spans B1
    expect(addrOf.get(tbl.rows[0].cells[0])).toBe('A1');
    expect(addrOf.get(tbl.rows[0].cells[1])).toBe('C1');
    expect(cellAt.has('A1')).toBe(true);
    expect(cellAt.has('C1')).toBe(true);
  });
});

describe('recalculateTable — full evaluation', () => {
  it('evaluates SUM over a column', () => {
    const tbl = makeTable([
      ['1'],
      ['2'],
      ['3'],
      ['=SUM(A1:A3)'],
    ]);
    const res = recalculateTable(tbl);
    expect(res.evaluated).toBe(1);
    expect(res.errors).toBe(0);
    expect(getCellText(tbl.rows[3].cells[0])).toBe('6');
    expect(tbl.rows[3].cells[0]._formula).toEqual({ src: '=SUM(A1:A3)', value: 6 });
  });

  it('chained formulas evaluate in dependency order', () => {
    // A1=2, B1=3, C1=A1+B1, D1=C1*2
    const tbl = makeTable([['2', '3', '=A1+B1', '=C1*2']]);
    const res = recalculateTable(tbl);
    expect(res.evaluated).toBe(2);
    expect(getCellText(tbl.rows[0].cells[2])).toBe('5');
    expect(getCellText(tbl.rows[0].cells[3])).toBe('10');
  });

  it('IF uses other cells', () => {
    const tbl = makeTable([['15'], ['=IF(A1>10,"초과","정상")']]);
    recalculateTable(tbl);
    expect(getCellText(tbl.rows[1].cells[0])).toBe('초과');
  });

  it('AVERAGE on a row', () => {
    const tbl = makeTable([['10', '20', '30', '=AVERAGE(A1:C1)']]);
    recalculateTable(tbl);
    expect(getCellText(tbl.rows[0].cells[3])).toBe('20');
  });

  it('reports parse error as #PARSE!', () => {
    const tbl = makeTable([['=SUM(']]);
    const res = recalculateTable(tbl);
    expect(res.errors).toBe(1);
    expect(getCellText(tbl.rows[0].cells[0])).toMatch(/^#/);
  });

  it('detects circular references', () => {
    // A1 = B1 + 1, B1 = A1 + 1
    const tbl = makeTable([['=B1+1', '=A1+1']]);
    const res = recalculateTable(tbl);
    expect(res.errors).toBeGreaterThanOrEqual(1);
    expect(getCellText(tbl.rows[0].cells[0])).toBe('#CYCLE!');
    expect(getCellText(tbl.rows[0].cells[1])).toBe('#CYCLE!');
  });

  it('TableFormulaController.recalculateDocument walks sections', () => {
    const ctrl = new TableFormulaController();
    const doc = {
      sections: [
        {
          elements: [
            makeTable([['1', '2', '=A1+B1']]),
            makeTable([['10', '20', '=SUM(A1:B1)']]),
          ],
        },
      ],
    };
    const totals = ctrl.recalculateDocument(doc);
    expect(totals.tables).toBe(2);
    expect(totals.evaluated).toBe(2);
    expect(totals.errors).toBe(0);
  });
});
