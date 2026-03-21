/**
 * TableEditor Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

import { TableEditor } from './table-editor.js';

describe('TableEditor', () => {
  let tableEditor;
  let viewer;
  let mockHistoryManager;
  let mockDocument;

  beforeEach(() => {
    mockHistoryManager = {
      execute: vi.fn((execFn, undoFn, name) => execFn()),
    };

    mockDocument = {
      sections: [
        {
          elements: [
            {
              type: 'table',
              rows: [
                {
                  cells: [
                    { rowSpan: 1, colSpan: 1, elements: [{ type: 'paragraph', runs: [{ text: 'A1' }] }] },
                    { rowSpan: 1, colSpan: 1, elements: [{ type: 'paragraph', runs: [{ text: 'B1' }] }] },
                  ],
                },
                {
                  cells: [
                    { rowSpan: 1, colSpan: 1, elements: [{ type: 'paragraph', runs: [{ text: 'A2' }] }] },
                    { rowSpan: 1, colSpan: 1, elements: [{ type: 'paragraph', runs: [{ text: 'B2' }] }] },
                  ],
                },
                {
                  cells: [
                    { rowSpan: 1, colSpan: 1, elements: [{ type: 'paragraph', runs: [{ text: 'A3' }] }] },
                    { rowSpan: 1, colSpan: 1, elements: [{ type: 'paragraph', runs: [{ text: 'B3' }] }] },
                  ],
                },
              ],
              colWidths: ['100px', '100px'],
            },
          ],
        },
      ],
    };

    viewer = {
      container: document.createElement('div'),
      getDocument: vi.fn(() => mockDocument),
      updateDocument: vi.fn(async () => {}),
      historyManager: mockHistoryManager,
    };

    document.body.innerHTML = '';
    document.body.appendChild(viewer.container);

    // Create corresponding DOM table
    const tableEl = document.createElement('div');
    tableEl.className = 'hwp-table';
    const table = document.createElement('table');
    for (let r = 0; r < 3; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < 2; c++) {
        const td = document.createElement('td');
        td.textContent = `${String.fromCharCode(65 + c)}${r + 1}`;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    tableEl.appendChild(table);
    viewer.container.appendChild(tableEl);

    tableEditor = new TableEditor(viewer);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function getCell(rowIndex, colIndex) {
    const rows = viewer.container.querySelectorAll('tr');
    const cells = rows[rowIndex].querySelectorAll('td');
    return cells[colIndex];
  }

  // 1. Constructor initializes
  it('should initialize correctly', () => {
    expect(tableEditor.viewer).toBe(viewer);
  });

  // 2. _cloneTableData creates deep copy
  it('should create a deep copy of table data', () => {
    const original = { rows: [{ cells: [{ text: 'A' }] }] };
    const clone = tableEditor._cloneTableData(original);

    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    clone.rows[0].cells[0].text = 'B';
    expect(original.rows[0].cells[0].text).toBe('A');
  });

  // 3. _restoreTableData replaces data
  it('should restore table data by replacing all keys', () => {
    const target = { rows: [{ cells: [{ text: 'modified' }] }], extra: true };
    const restore = { rows: [{ cells: [{ text: 'original' }] }] };

    tableEditor._restoreTableData(target, restore);

    expect(target.rows[0].cells[0].text).toBe('original');
    expect(target.extra).toBeUndefined();
  });

  // 4. findTableData returns null when no table found
  it('should return null when cell is not in a table', () => {
    const orphanCell = document.createElement('td');
    document.body.appendChild(orphanCell);

    const result = tableEditor.findTableData(orphanCell);
    expect(result).toBeNull();
  });

  // 5. getCellPosition returns correct indices
  it('should return correct cell position', () => {
    const cell = getCell(1, 1);
    const position = tableEditor.getCellPosition(cell);

    expect(position).not.toBeNull();
    expect(position.rowIndex).toBe(1);
    expect(position.colIndex).toBe(1);
  });

  // 6. addRowAbove inserts row before
  it('should add a row above the given cell', async () => {
    const cell = getCell(1, 0);

    // Mock findTableData to return valid data
    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    const result = await tableEditor.addRowAbove(cell);

    expect(result).toBe(true);
    expect(mockHistoryManager.execute).toHaveBeenCalled();
    expect(mockDocument.sections[0].elements[0].rows).toHaveLength(4);
  });

  // 7. addRowBelow inserts row after
  it('should add a row below the given cell', async () => {
    const cell = getCell(1, 0);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    const result = await tableEditor.addRowBelow(cell);

    expect(result).toBe(true);
    expect(mockHistoryManager.execute).toHaveBeenCalled();
    expect(mockDocument.sections[0].elements[0].rows).toHaveLength(4);
  });

  // 8. addColumnLeft inserts column before
  it('should add a column to the left', async () => {
    const cell = getCell(0, 1);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    const result = await tableEditor.addColumnLeft(cell);

    expect(result).toBe(true);
    expect(mockHistoryManager.execute).toHaveBeenCalled();
    // Each row should now have 3 cells
    expect(mockDocument.sections[0].elements[0].rows[0].cells).toHaveLength(3);
  });

  // 9. addColumnRight inserts column after
  it('should add a column to the right', async () => {
    const cell = getCell(0, 0);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    const result = await tableEditor.addColumnRight(cell);

    expect(result).toBe(true);
    expect(mockDocument.sections[0].elements[0].rows[0].cells).toHaveLength(3);
  });

  // 10. deleteRow removes row
  it('should delete a row', async () => {
    const cell = getCell(1, 0);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    const result = await tableEditor.deleteRow(cell);

    expect(result).toBe(true);
    expect(mockDocument.sections[0].elements[0].rows).toHaveLength(2);
  });

  // 11. deleteColumn removes column
  it('should delete a column', async () => {
    const cell = getCell(0, 1);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    const result = await tableEditor.deleteColumn(cell);

    expect(result).toBe(true);
    expect(mockDocument.sections[0].elements[0].rows[0].cells).toHaveLength(1);
  });

  // 12. History integration: addRowAbove registers with historyManager
  it('should register addRowAbove with historyManager', async () => {
    const cell = getCell(0, 0);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    await tableEditor.addRowAbove(cell);

    expect(mockHistoryManager.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.stringContaining('행 추가')
    );
  });

  // 13. History integration: deleteRow registers with historyManager
  it('should register deleteRow with historyManager', async () => {
    const cell = getCell(1, 0);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    await tableEditor.deleteRow(cell);

    expect(mockHistoryManager.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      '행 삭제'
    );
  });

  // 14. History integration: addColumnLeft registers with historyManager
  it('should register addColumnLeft with historyManager', async () => {
    const cell = getCell(0, 0);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    await tableEditor.addColumnLeft(cell);

    expect(mockHistoryManager.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.stringContaining('열 추가')
    );
  });

  // 15. History integration: deleteColumn registers with historyManager
  it('should register deleteColumn with historyManager', async () => {
    const cell = getCell(0, 1);

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    await tableEditor.deleteColumn(cell);

    expect(mockHistoryManager.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      '열 삭제'
    );
  });

  // 16. Edge case: single row delete should fail
  it('should not delete the last remaining row', async () => {
    // Create a table with only one row
    const singleRowDoc = {
      sections: [{
        elements: [{
          type: 'table',
          rows: [
            { cells: [{ rowSpan: 1, colSpan: 1, elements: [] }] },
          ],
        }],
      }],
    };

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: singleRowDoc.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    // Mock alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    const cell = getCell(0, 0);
    const result = await tableEditor.deleteRow(cell);

    expect(result).toBe(false);
  });

  // 17. Edge case: single column delete should fail
  it('should not delete the last remaining column', async () => {
    const singleColDoc = {
      sections: [{
        elements: [{
          type: 'table',
          rows: [
            { cells: [{ rowSpan: 1, colSpan: 1, elements: [] }] },
            { cells: [{ rowSpan: 1, colSpan: 1, elements: [] }] },
          ],
        }],
      }],
    };

    vi.spyOn(tableEditor, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: singleColDoc.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    vi.spyOn(window, 'alert').mockImplementation(() => {});

    const cell = getCell(0, 0);
    const result = await tableEditor.deleteColumn(cell);

    expect(result).toBe(false);
  });

  // 18. findTableData returns null when document is not loaded
  it('should return null when document has no sections', () => {
    viewer.getDocument.mockReturnValue(null);

    const cell = getCell(0, 0);
    // The cell is inside a .hwp-table, so DOM check passes but doc check fails
    const result = tableEditor.findTableData(cell);
    expect(result).toBeNull();
  });

  // 19. getCellPosition returns null when cell has no parent row
  it('should return null for getCellPosition with no parent table', () => {
    const orphanTd = document.createElement('td');
    const orphanTr = document.createElement('tr');
    orphanTr.appendChild(orphanTd);
    // No parent table
    document.body.appendChild(orphanTr);

    const result = tableEditor.getCellPosition(orphanTd);
    expect(result).toBeNull();
  });

  // 20. Operations without historyManager should still work
  it('should execute operation directly when historyManager is not available', async () => {
    viewer.historyManager = null;
    const editorNoHistory = new TableEditor(viewer);

    vi.spyOn(editorNoHistory, 'findTableData').mockReturnValue({
      tableElement: viewer.container.querySelector('.hwp-table'),
      tableData: mockDocument.sections[0].elements[0],
      sectionIndex: 0,
      elementIndex: 0,
    });

    const cell = getCell(1, 0);
    const result = await editorNoHistory.addRowBelow(cell);

    expect(result).toBe(true);
    expect(mockDocument.sections[0].elements[0].rows).toHaveLength(4);
  });
});
