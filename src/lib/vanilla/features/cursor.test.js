import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));

import { Cursor } from './cursor.js';

/**
 * Helper: create a mock viewer with minimal DOM setup
 */
function createMockViewer(overrides = {}) {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });

    return {
        container,
        positionManager: {
            isPositionReady: vi.fn(() => true),
            getPositionList: vi.fn(() => [
                { coordinate: { left: 10, top: 10, bottom: 30, height: 20 } },
                { coordinate: { left: 20, top: 10, bottom: 30, height: 20 } },
                { coordinate: { left: 30, top: 10, bottom: 30, height: 20 } },
                { coordinate: { left: 10, top: 40, bottom: 60, height: 20 } },
                { coordinate: { left: 20, top: 40, bottom: 60, height: 20 } },
            ]),
            getPositionByIndex: vi.fn((idx) => {
                const list = [
                    { coordinate: { left: 10, top: 10, bottom: 30, height: 20 } },
                    { coordinate: { left: 20, top: 10, bottom: 30, height: 20 } },
                    { coordinate: { left: 30, top: 10, bottom: 30, height: 20 } },
                    { coordinate: { left: 10, top: 40, bottom: 60, height: 20 } },
                    { coordinate: { left: 20, top: 40, bottom: 60, height: 20 } },
                ];
                return list[idx] || null;
            }),
            getPositionByXY: vi.fn(() => null),
        },
        rangeManager: {
            clearSelection: vi.fn(),
        },
        command: {
            insertText: vi.fn(),
            deleteBackward: vi.fn(),
            deleteForward: vi.fn(),
            insertLineBreak: vi.fn(),
            undo: vi.fn(),
            redo: vi.fn(),
            bold: vi.fn(),
            italic: vi.fn(),
            underline: vi.fn(),
            strikethrough: vi.fn(),
            copy: vi.fn(() => 'copied'),
            cut: vi.fn(() => 'cut-text'),
            paste: vi.fn(),
            increaseFontSize: vi.fn(),
            decreaseFontSize: vi.fn(),
        },
        searchDialog: {
            show: vi.fn(),
        },
        ...overrides,
    };
}

describe('Cursor', () => {
    let cursor;
    let viewer;

    beforeEach(() => {
        document.body.innerHTML = '';
        viewer = createMockViewer();
        document.body.appendChild(viewer.container);
        cursor = new Cursor(viewer);
    });

    afterEach(() => {
        cursor.destroy();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    // --- Constructor / Initialization ---

    it('should initialize with default state', () => {
        expect(cursor.cursorIndex).toBe(-1);
        expect(cursor.isVisible).toBe(false);
        expect(cursor.isBlinking).toBe(true);
        expect(cursor.blinkInterval).toBe(530);
    });

    it('should create cursor DOM element in the container', () => {
        const el = viewer.container.querySelector('.hwpx-cursor');
        expect(el).not.toBeNull();
        expect(el.style.display).toBe('none');
        expect(el.style.position).toBe('absolute');
        expect(el.style.zIndex).toBe('100');
    });

    it('should create a hidden textarea (cursor agent) in document.body', () => {
        const agent = document.body.querySelector('.hwpx-cursor-agent');
        expect(agent).not.toBeNull();
        expect(agent.tagName).toBe('TEXTAREA');
        expect(agent.style.opacity).toBe('0');
    });

    // --- setCursorPosition ---

    it('should set cursor position to a valid index', () => {
        cursor.setCursorPosition(2);
        expect(cursor.cursorIndex).toBe(2);
        expect(cursor.isVisible).toBe(true);
    });

    it('should not set cursor position when positionManager is not ready', () => {
        viewer.positionManager.isPositionReady.mockReturnValue(false);
        cursor.setCursorPosition(1);
        expect(cursor.cursorIndex).toBe(-1);
    });

    it('should reject negative index', () => {
        cursor.setCursorPosition(-1);
        expect(cursor.cursorIndex).toBe(-1);
    });

    it('should reject index beyond positions length', () => {
        cursor.setCursorPosition(100);
        expect(cursor.cursorIndex).toBe(-1);
    });

    // --- moveCursor ---

    it('should move cursor forward by offset', () => {
        cursor.setCursorPosition(1);
        cursor.moveCursor(1);
        expect(cursor.cursorIndex).toBe(2);
    });

    it('should move cursor backward by offset', () => {
        cursor.setCursorPosition(2);
        cursor.moveCursor(-1);
        expect(cursor.cursorIndex).toBe(1);
    });

    it('should clamp cursor at beginning (index 0)', () => {
        cursor.setCursorPosition(0);
        cursor.moveCursor(-5);
        expect(cursor.cursorIndex).toBe(0);
    });

    it('should clamp cursor at end', () => {
        cursor.setCursorPosition(4);
        cursor.moveCursor(10);
        expect(cursor.cursorIndex).toBe(4);
    });

    it('should not move if cursorIndex is -1', () => {
        cursor.moveCursor(1);
        expect(cursor.cursorIndex).toBe(-1);
    });

    // --- show / hide ---

    it('should show the cursor element', () => {
        cursor.show();
        expect(cursor.isVisible).toBe(true);
        expect(cursor.cursorElement.style.display).toBe('block');
    });

    it('should hide the cursor element and stop blinking', () => {
        cursor.show();
        cursor.hide();
        expect(cursor.isVisible).toBe(false);
        expect(cursor.cursorElement.style.display).toBe('none');
    });

    // --- setBlinking ---

    it('should disable blinking and set opacity to 1', () => {
        cursor.show();
        cursor.setBlinking(false);
        expect(cursor.isBlinking).toBe(false);
        expect(cursor.cursorElement.style.opacity).toBe('1');
        expect(cursor.blinkTimer).toBeNull();
    });

    // --- setColor / setWidth ---

    it('should change cursor color', () => {
        cursor.setColor('red');
        expect(cursor.cursorElement.style.backgroundColor).toBe('red');
    });

    it('should change cursor width', () => {
        cursor.setWidth(4);
        expect(cursor.cursorElement.style.width).toBe('4px');
    });

    // --- getCursorIndex ---

    it('should return current cursor index', () => {
        expect(cursor.getCursorIndex()).toBe(-1);
        cursor.setCursorPosition(3);
        expect(cursor.getCursorIndex()).toBe(3);
    });

    // --- destroy ---

    it('should remove DOM elements on destroy', () => {
        // Verify elements exist before destroy
        expect(viewer.container.querySelector('.hwpx-cursor')).not.toBeNull();
        expect(document.body.querySelector('.hwpx-cursor-agent')).not.toBeNull();

        cursor.destroy();

        expect(cursor.cursorElement).toBeNull();
        expect(cursor.cursorAgent).toBeNull();
        expect(viewer.container.querySelector('.hwpx-cursor')).toBeNull();
        expect(document.body.querySelector('.hwpx-cursor-agent')).toBeNull();

        // Prevent afterEach from calling destroy again on nulled elements
        // Re-create minimal stubs so afterEach's destroy() won't crash
        cursor.cursorElement = document.createElement('div');
        cursor.cursorAgent = document.createElement('textarea');
    });
});
