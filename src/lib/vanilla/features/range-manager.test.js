import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));

import { RangeManager } from './range-manager.js';

/**
 * Helper: build position list for testing
 */
function buildPositions(count = 10) {
    return Array.from({ length: count }, (_, i) => ({
        value: String.fromCharCode(65 + (i % 26)), // A, B, C, ...
        coordinate: {
            left: (i % 5) * 20,
            top: Math.floor(i / 5) * 30,
            bottom: Math.floor(i / 5) * 30 + 20,
            width: 15,
            height: 20,
        },
        parentElement: document.createElement('span'),
        isWhitespace: false,
    }));
}

function createMockViewer(positionCount = 10) {
    const positions = buildPositions(positionCount);
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });

    return {
        container,
        getPositionManager: () => ({
            isPositionReady: vi.fn(() => true),
            getPositionList: vi.fn(() => positions),
            getPositionsInRange: vi.fn((start, end) => positions.slice(start, end + 1)),
            getPositionByXY: vi.fn(() => null),
        }),
        _positions: positions,
    };
}

describe('RangeManager', () => {
    let rm;
    let viewer;

    beforeEach(() => {
        document.body.innerHTML = '';
        viewer = createMockViewer(10);
        document.body.appendChild(viewer.container);
        rm = new RangeManager(viewer);
    });

    afterEach(() => {
        rm.destroy();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    // --- Constructor ---

    it('should initialise with collapsed range', () => {
        const range = rm.getRange();
        expect(range.startIndex).toBe(-1);
        expect(range.endIndex).toBe(-1);
        expect(range.isCollapsed).toBe(true);
    });

    it('should not be selecting initially', () => {
        expect(rm.isSelecting).toBe(false);
        expect(rm.selectionStartPos).toBeNull();
    });

    // --- setRange ---

    it('should set a valid range', () => {
        rm.setRange(2, 5);
        const range = rm.getRange();
        expect(range.startIndex).toBe(2);
        expect(range.endIndex).toBe(5);
        expect(range.isCollapsed).toBe(false);
    });

    it('should normalise range when start > end', () => {
        rm.setRange(7, 3);
        const range = rm.getRange();
        expect(range.startIndex).toBe(3);
        expect(range.endIndex).toBe(7);
    });

    it('should mark range as collapsed when start equals end', () => {
        rm.setRange(4, 4);
        const range = rm.getRange();
        expect(range.isCollapsed).toBe(true);
    });

    // --- getRange returns a copy ---

    it('should return a copy of the range object', () => {
        rm.setRange(1, 3);
        const r1 = rm.getRange();
        r1.startIndex = 999;
        expect(rm.getRange().startIndex).toBe(1);
    });

    // --- hasSelection ---

    it('should return false when no selection', () => {
        expect(rm.hasSelection()).toBe(false);
    });

    it('should return true when a non-collapsed range is set', () => {
        rm.setRange(0, 3);
        expect(rm.hasSelection()).toBe(true);
    });

    it('should return false for collapsed selection', () => {
        rm.setRange(2, 2);
        expect(rm.hasSelection()).toBe(false);
    });

    // --- getSelectedPositions ---

    it('should return empty array when collapsed', () => {
        rm.setRange(2, 2);
        expect(rm.getSelectedPositions()).toEqual([]);
    });

    it('should return positions in range', () => {
        rm.setRange(1, 4);
        const positions = rm.getSelectedPositions();
        expect(positions.length).toBe(4); // indices 1,2,3,4
    });

    // --- getSelectedText ---

    it('should return joined text from selected positions', () => {
        rm.setRange(0, 2);
        const text = rm.getSelectedText();
        // positions 0,1,2 → values A,B,C
        expect(text).toBe('ABC');
    });

    // --- clearSelection ---

    it('should reset range to collapsed state', () => {
        rm.setRange(1, 5);
        rm.clearSelection();
        const range = rm.getRange();
        expect(range.startIndex).toBe(-1);
        expect(range.endIndex).toBe(-1);
        expect(range.isCollapsed).toBe(true);
    });

    it('should remove highlight elements from DOM', () => {
        rm.setRange(0, 2);
        // Highlights are created during setRange via _updateSelectionHighlight
        expect(rm.highlightElements.length).toBeGreaterThan(0);
        rm.clearSelection();
        expect(rm.highlightElements.length).toBe(0);
    });

    // --- selectAll ---

    it('should select all positions', () => {
        rm.selectAll();
        const range = rm.getRange();
        expect(range.startIndex).toBe(0);
        expect(range.endIndex).toBe(9);
        expect(range.isCollapsed).toBe(false);
    });

    it('should not select when positionManager is not ready', () => {
        rm.positionManager.isPositionReady.mockReturnValue(false);
        rm.selectAll();
        expect(rm.getRange().startIndex).toBe(-1);
    });

    // --- getRangeInfo ---

    it('should return hasSelection false when no selection', () => {
        const info = rm.getRangeInfo();
        expect(info.hasSelection).toBe(false);
        expect(info.length).toBe(0);
        expect(info.text).toBe('');
    });

    it('should return correct info for active selection', () => {
        rm.setRange(0, 4);
        const info = rm.getRangeInfo();
        expect(info.hasSelection).toBe(true);
        expect(info.startIndex).toBe(0);
        expect(info.endIndex).toBe(4);
        expect(info.length).toBe(5);
        expect(info.text).toBe('ABCDE');
    });

    // --- reset ---

    it('should clear selection and reset selecting state', () => {
        rm.isSelecting = true;
        rm.selectionStartPos = { index: 0 };
        rm.setRange(0, 3);
        rm.reset();
        expect(rm.hasSelection()).toBe(false);
        expect(rm.isSelecting).toBe(false);
        expect(rm.selectionStartPos).toBeNull();
    });

    // --- enableSelection / disableSelection ---

    it('should set tabindex on container when enabled', () => {
        rm.enableSelection();
        expect(viewer.container.getAttribute('tabindex')).toBe('0');
    });

    // --- destroy ---

    it('should clean up on destroy', () => {
        rm.setRange(0, 3);
        rm.destroy();
        expect(rm.hasSelection()).toBe(false);
        expect(rm.isSelecting).toBe(false);
    });
});
