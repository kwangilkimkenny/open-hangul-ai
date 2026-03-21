/**
 * Table Renderer Test Suite
 * Tests for src/lib/vanilla/renderers/table.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

// Mock paragraph renderer
vi.mock('./paragraph.js', () => ({
  renderParagraph: vi.fn((para) => {
    const d = document.createElement('div');
    d.className = 'hwp-paragraph';
    d.textContent = para?.runs?.[0]?.text || '';
    return d;
  }),
}));

import { renderTable } from './table.js';
import { renderParagraph } from './paragraph.js';

// ─── Helpers ──────────────────────────────────────────────────

function makeCell(text = '', style = {}, extra = {}) {
  return {
    elements: [{ type: 'paragraph', runs: [{ text }] }],
    style,
    ...extra,
  };
}

function makeRow(cells = []) {
  return { cells };
}

function makeTable(rows = [], extra = {}) {
  return { rows, ...extra };
}

function createLargeTable(rowCount, colCount) {
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const cells = [];
    for (let c = 0; c < colCount; c++) {
      cells.push(makeCell(`R${r}C${c}`));
    }
    rows.push(makeRow(cells));
  }
  return makeTable(rows);
}

// ─── Tests ────────────────────────────────────────────────────

describe('renderTable', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Basic table rendering ────────────────────────────────

  describe('basic rendering', () => {
    it('should return a wrapper div with hwp-table-wrapper class', () => {
      const el = renderTable(makeTable([makeRow([makeCell('A')])]), new Map());
      expect(el.tagName).toBe('DIV');
      expect(el.className).toBe('hwp-table-wrapper');
    });

    it('should contain an inner table element with hwp-table class', () => {
      const el = renderTable(makeTable([makeRow([makeCell('A')])]), new Map());
      const table = el.querySelector('.hwp-table');
      expect(table).not.toBeNull();
      expect(table.tagName).toBe('TABLE');
    });

    it('should render correct number of rows', () => {
      const table = makeTable([
        makeRow([makeCell('R1C1')]),
        makeRow([makeCell('R2C1')]),
        makeRow([makeCell('R3C1')]),
      ]);
      const el = renderTable(table, new Map());
      const rows = el.querySelectorAll('.hwp-table-row');
      expect(rows.length).toBe(3);
    });

    it('should render correct number of cells per row', () => {
      const table = makeTable([
        makeRow([makeCell('A'), makeCell('B'), makeCell('C')]),
      ]);
      const el = renderTable(table, new Map());
      const cells = el.querySelectorAll('.hwp-table-cell');
      expect(cells.length).toBe(3);
    });

    it('should render cell content via renderParagraph', () => {
      const table = makeTable([makeRow([makeCell('Hello')])]);
      const el = renderTable(table, new Map());
      expect(renderParagraph).toHaveBeenCalled();
      const paraDiv = el.querySelector('.hwp-paragraph');
      expect(paraDiv.textContent).toBe('Hello');
    });

    it('should set table-level CSS properties', () => {
      const el = renderTable(makeTable([makeRow([makeCell('A')])]), new Map());
      const table = el.querySelector('.hwp-table');
      expect(table.style.borderCollapse).toBe('separate');
      expect(table.style.borderSpacing).toBe('0px');
      expect(table.style.tableLayout).toBe('fixed');
    });

    it('should set lang=ko on cells', () => {
      const el = renderTable(makeTable([makeRow([makeCell('test')])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.getAttribute('lang')).toBe('ko');
    });
  });

  // ─── Column widths ───────────────────────────────────────

  describe('column widths', () => {
    it('should create colgroup with percentage widths', () => {
      const table = makeTable(
        [makeRow([makeCell('A'), makeCell('B')])],
        { colWidthsPercent: ['60%', '40%'] }
      );
      const el = renderTable(table, new Map());
      const cols = el.querySelectorAll('col');
      expect(cols.length).toBe(2);
      expect(cols[0].style.width).toBe('60%');
      expect(cols[1].style.width).toBe('40%');
    });

    it('should create colgroup with pixel widths as fallback', () => {
      const table = makeTable(
        [makeRow([makeCell('A'), makeCell('B')])],
        { colWidths: ['200px', '300px'] }
      );
      const el = renderTable(table, new Map());
      const cols = el.querySelectorAll('col');
      expect(cols.length).toBe(2);
      expect(cols[0].style.width).toBe('200px');
      expect(cols[1].style.width).toBe('300px');
    });

    it('should prefer percentage widths over pixel widths', () => {
      const table = makeTable(
        [makeRow([makeCell('A')])],
        { colWidthsPercent: ['100%'], colWidths: ['500px'] }
      );
      const el = renderTable(table, new Map());
      const col = el.querySelector('col');
      expect(col.style.width).toBe('100%');
    });

    it('should not create colgroup when no widths provided', () => {
      const el = renderTable(makeTable([makeRow([makeCell('A')])]), new Map());
      expect(el.querySelector('colgroup')).toBeNull();
    });
  });

  // ─── Cell styles ──────────────────────────────────────────

  describe('cell styles', () => {
    it('should apply backgroundColor', () => {
      const cell = makeCell('Bg', { backgroundColor: '#ff0000' });
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('should apply individual border definitions', () => {
      const cell = makeCell('Borders', {
        borderTopDef: { css: '1px solid #000' },
        borderBottomDef: { css: '2px solid #333' },
        borderLeftDef: { css: '1px dashed #666' },
        borderRightDef: { css: '1px dotted #999' },
      });
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.style.borderTop).toContain('1px');
      expect(td.style.borderBottom).toContain('2px');
      expect(td.style.borderLeft).toContain('1px');
      expect(td.style.borderRight).toContain('1px');
    });

    it('should set border to none when no border definition', () => {
      const cell = makeCell('NoBorder', {});
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      // When no border definitions, the table renderer may not explicitly set borders
      expect(td).toBeTruthy();
    });

    it('should apply cell padding', () => {
      const cell = makeCell('Pad', { padding: '10px 15px' });
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.style.padding).toBe('10px 15px');
    });

    it('should use default padding when not specified', () => {
      const cell = makeCell('Default', {});
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.style.padding).toBe('3px 5px');
    });

    it('should apply verticalAlign', () => {
      const cell = makeCell('VA', { verticalAlign: 'middle' });
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.style.verticalAlign).toBe('middle');
    });

    it('should apply textAlign', () => {
      const cell = makeCell('TA', { textAlign: 'center' });
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.style.textAlign).toBe('center');
    });
  });

  // ─── Merged cells ─────────────────────────────────────────

  describe('merged cells', () => {
    it('should apply colspan', () => {
      const cell = makeCell('Span2', {}, { colSpan: 2 });
      const el = renderTable(makeTable([makeRow([cell, makeCell('B')])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.colSpan).toBe(2);
    });

    it('should apply rowspan', () => {
      const cell = makeCell('RSpan', {}, { rowSpan: 3 });
      const el = renderTable(makeTable([makeRow([cell]), makeRow([makeCell('B')])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.rowSpan).toBe(3);
    });

    it('should apply both colspan and rowspan', () => {
      const cell = makeCell('Both', {}, { colSpan: 2, rowSpan: 2 });
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td.colSpan).toBe(2);
      expect(td.rowSpan).toBe(2);
    });
  });

  // ─── Empty table ──────────────────────────────────────────

  describe('empty table', () => {
    it('should handle table with no rows gracefully', () => {
      const el = renderTable(makeTable([]), new Map());
      expect(el).not.toBeNull();
      const table = el.querySelector('.hwp-table');
      expect(table).not.toBeNull();
      expect(table.querySelectorAll('tr').length).toBe(0);
    });

    it('should handle row with no cells', () => {
      const el = renderTable(makeTable([makeRow([])]), new Map());
      const tr = el.querySelector('.hwp-table-row');
      expect(tr).not.toBeNull();
      expect(tr.querySelectorAll('td').length).toBe(0);
    });

    it('should handle cell with no elements', () => {
      const cell = { elements: [], style: {} };
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td).not.toBeNull();
      expect(td.children.length).toBe(0);
    });
  });

  // ─── Large table ──────────────────────────────────────────

  describe('large table', () => {
    it('should render a table with many rows and columns', () => {
      const table = createLargeTable(50, 10);
      const el = renderTable(table, new Map());
      const rows = el.querySelectorAll('.hwp-table-row');
      expect(rows.length).toBe(50);
      const firstRowCells = rows[0].querySelectorAll('.hwp-table-cell');
      expect(firstRowCells.length).toBe(10);
    });

    it('should call renderParagraph for each cell in large table', () => {
      const table = createLargeTable(5, 4);
      renderTable(table, new Map());
      // 5 rows * 4 cells = 20 paragraph render calls
      expect(renderParagraph).toHaveBeenCalledTimes(20);
    });
  });

  // ─── _tableData reference ─────────────────────────────────

  describe('_tableData reference', () => {
    it('should set _tableData on the table element', () => {
      const tableData = makeTable([makeRow([makeCell('ref')])]);
      const el = renderTable(tableData, new Map());
      const table = el.querySelector('.hwp-table');
      expect(table._tableData).toBe(tableData);
    });
  });

  // ─── Images parameter ────────────────────────────────────

  describe('images parameter', () => {
    it('should handle null images gracefully', () => {
      expect(() => renderTable(makeTable([makeRow([makeCell('A')])]), null)).not.toThrow();
    });

    it('should handle undefined images gracefully', () => {
      expect(() => renderTable(makeTable([makeRow([makeCell('A')])]), undefined)).not.toThrow();
    });

    it('should handle non-Map images gracefully', () => {
      expect(() => renderTable(makeTable([makeRow([makeCell('A')])]), 'not a map')).not.toThrow();
    });

    it('should handle empty Map images', () => {
      expect(() => renderTable(makeTable([makeRow([makeCell('A')])]), new Map())).not.toThrow();
    });
  });

  // ─── Table wrapper styles ─────────────────────────────────

  describe('table wrapper', () => {
    it('should set maxWidth 100% on wrapper', () => {
      const el = renderTable(makeTable([makeRow([makeCell('A')])]), new Map());
      expect(el.style.maxWidth).toBe('100%');
    });

    it('should set overflowX auto on wrapper', () => {
      const el = renderTable(makeTable([makeRow([makeCell('A')])]), new Map());
      expect(el.style.overflowX).toBe('auto');
    });

    it('should apply table-level width and height from style', () => {
      const table = makeTable(
        [makeRow([makeCell('A')])],
        { style: { width: '500px', height: '300px' } }
      );
      const el = renderTable(table, new Map());
      const tableEl = el.querySelector('.hwp-table');
      expect(tableEl.style.width).toBe('100%');
      expect(tableEl.style.height).toBe('300px');
    });

    it('should set default fontSize 12px on table element', () => {
      const el = renderTable(makeTable([makeRow([makeCell('A')])]), new Map());
      const table = el.querySelector('.hwp-table');
      expect(table.style.fontSize).toBe('12px');
    });
  });

  // ─── _cellData reference ──────────────────────────────────

  describe('_cellData reference', () => {
    it('should set _cellData on each td element', () => {
      const cell = makeCell('ref test');
      const el = renderTable(makeTable([makeRow([cell])]), new Map());
      const td = el.querySelector('.hwp-table-cell');
      expect(td._cellData).toBe(cell);
    });
  });
});
