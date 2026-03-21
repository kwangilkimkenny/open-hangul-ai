import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));
vi.mock('../utils/ui.js', () => ({ showToast: vi.fn() }));

import { CellSelector, CellMode } from './cell-selector.js';
import { showToast } from '../utils/ui.js';

function createMockViewer() {
    const container = document.createElement('div');
    return { container };
}

/**
 * Helper: insert a simple table into the document so querySelectorAll('td') works.
 */
function insertTable(rows = 2, cols = 3) {
    const table = document.createElement('table');
    table.className = 'document-table';
    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const td = document.createElement('td');
            td.textContent = `R${r}C${c}`;
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    document.body.appendChild(table);
    return table;
}

describe('CellSelector', () => {
    let selector;
    let viewer;

    beforeEach(() => {
        document.body.innerHTML = '';
        viewer = createMockViewer();
        document.body.appendChild(viewer.container);
        selector = new CellSelector(viewer);
    });

    afterEach(() => {
        selector.deactivate();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    // --- CellMode constants ---

    it('should expose the four cell mode constants', () => {
        expect(CellMode.AUTO).toBe('auto');
        expect(CellMode.KEEP).toBe('keep');
        expect(CellMode.EDIT).toBe('edit');
        expect(CellMode.GENERATE).toBe('generate');
    });

    // --- Constructor ---

    it('should initialize with empty cellModes and inactive state', () => {
        expect(selector.cellModes.size).toBe(0);
        expect(selector.isActive).toBe(false);
        expect(selector.onSelectionChange).toBeNull();
    });

    // --- activate / deactivate ---

    it('should activate cell selection mode', () => {
        insertTable();
        selector.activate();
        expect(selector.isActive).toBe(true);
    });

    it('should not activate twice', () => {
        insertTable();
        selector.activate();
        // Calling activate again should be a no-op (no duplicate listeners).
        selector.activate();
        expect(selector.isActive).toBe(true);
    });

    it('should deactivate cell selection mode', () => {
        insertTable();
        selector.activate();
        selector.deactivate();
        expect(selector.isActive).toBe(false);
    });

    it('should not deactivate when already inactive', () => {
        // Should not throw
        selector.deactivate();
        expect(selector.isActive).toBe(false);
    });

    // --- toggle ---

    it('should toggle from inactive to active', () => {
        insertTable();
        const result = selector.toggle();
        expect(result).toBe(true);
        expect(selector.isActive).toBe(true);
    });

    it('should toggle from active to inactive', () => {
        insertTable();
        selector.activate();
        const result = selector.toggle();
        expect(result).toBe(false);
        expect(selector.isActive).toBe(false);
    });

    // --- setCellMode ---

    it('should set mode for a cell by id', () => {
        selector.setCellMode('cell-1', CellMode.KEEP);
        expect(selector.cellModes.get('cell-1')).toBe(CellMode.KEEP);
    });

    it('should overwrite existing mode', () => {
        selector.setCellMode('cell-1', CellMode.KEEP);
        selector.setCellMode('cell-1', CellMode.GENERATE);
        expect(selector.cellModes.get('cell-1')).toBe(CellMode.GENERATE);
    });

    it('should invoke onSelectionChange callback when set', () => {
        const callback = vi.fn();
        selector.onSelectionChange = callback;
        insertTable();
        selector.setCellMode('cell-x', CellMode.EDIT);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({ total: expect.any(Number) }));
    });

    // --- _getNextMode (cycle through modes) ---

    it('should cycle modes: auto -> keep -> edit -> generate -> auto', () => {
        expect(selector._getNextMode(CellMode.AUTO)).toBe(CellMode.KEEP);
        expect(selector._getNextMode(CellMode.KEEP)).toBe(CellMode.EDIT);
        expect(selector._getNextMode(CellMode.EDIT)).toBe(CellMode.GENERATE);
        expect(selector._getNextMode(CellMode.GENERATE)).toBe(CellMode.AUTO);
    });

    // --- setAllCellsMode ---

    it('should set all cells to KEEP mode', () => {
        insertTable(2, 2); // 4 cells
        selector.setAllCellsMode(CellMode.KEEP);
        const summary = selector.getSelectionSummary();
        expect(summary.keep).toBe(4);
        expect(summary.auto).toBe(0);
    });

    // --- resetAllCells ---

    it('should clear all cell modes', () => {
        insertTable(2, 2);
        selector.setAllCellsMode(CellMode.EDIT);
        selector.resetAllCells();
        expect(selector.cellModes.size).toBe(0);
    });

    // --- getSelectionSummary ---

    it('should return correct summary counts', () => {
        insertTable(1, 4); // 4 cells
        const cells = document.querySelectorAll('td');
        const ids = Array.from(cells).map(c => selector._getCellId(c));

        selector.setCellMode(ids[0], CellMode.KEEP, cells[0]);
        selector.setCellMode(ids[1], CellMode.EDIT, cells[1]);
        selector.setCellMode(ids[2], CellMode.GENERATE, cells[2]);
        // ids[3] left as AUTO

        const summary = selector.getSelectionSummary();
        expect(summary.total).toBe(4);
        expect(summary.keep).toBe(1);
        expect(summary.edit).toBe(1);
        expect(summary.generate).toBe(1);
        expect(summary.auto).toBe(1);
    });

    // --- saveState / loadState ---

    it('should save state as JSON string', () => {
        selector.setCellMode('c1', CellMode.KEEP);
        selector.setCellMode('c2', CellMode.GENERATE);
        const json = selector.saveState();
        const parsed = JSON.parse(json);
        expect(parsed.version).toBe('1.0');
        expect(parsed.cellModes.c1).toBe('keep');
        expect(parsed.cellModes.c2).toBe('generate');
    });

    it('should load state from JSON string', () => {
        const state = JSON.stringify({
            version: '1.0',
            cellModes: { 'x1': 'edit', 'x2': 'keep' }
        });
        selector.loadState(state);
        expect(selector.cellModes.get('x1')).toBe('edit');
        expect(selector.cellModes.get('x2')).toBe('keep');
        expect(selector.cellModes.size).toBe(2);
    });

    it('should handle invalid JSON gracefully in loadState', () => {
        // Should not throw
        selector.loadState('not-json{');
        // cellModes unchanged
        expect(selector.cellModes.size).toBe(0);
    });

    // --- _getCellId ---

    it('should reuse data-cell-id if present', () => {
        const td = document.createElement('td');
        td.dataset.cellId = 'existing-id';
        expect(selector._getCellId(td)).toBe('existing-id');
    });

    // --- ESC key deactivates ---

    it('should deactivate when ESC is pressed', () => {
        insertTable();
        selector.activate();
        expect(selector.isActive).toBe(true);
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(event);
        expect(selector.isActive).toBe(false);
    });
});
