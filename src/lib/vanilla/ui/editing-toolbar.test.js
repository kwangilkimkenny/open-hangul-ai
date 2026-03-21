import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));

import { EditingToolbar } from './editing-toolbar.js';

function createMockViewer() {
    return {
        container: null,
        textFormatter: {
            toggleBold: vi.fn(),
            toggleItalic: vi.fn(),
            toggleUnderline: vi.fn(),
            getSelectionFormat: vi.fn().mockReturnValue({ bold: false, italic: false, underline: false }),
        },
        historyManager: {
            undo: vi.fn(),
            redo: vi.fn(),
        },
        specialCharPicker: { toggle: vi.fn() },
        clipboardManager: { copyFormat: vi.fn() },
        inlineEditor: { editingCell: null },
    };
}

describe('EditingToolbar', () => {
    let toolbar;
    let viewer;

    beforeEach(() => {
        document.body.innerHTML = '';
        viewer = createMockViewer();
        toolbar = new EditingToolbar(viewer);
    });

    afterEach(() => {
        if (toolbar && toolbar.toolbarElement) {
            toolbar.destroy();
        }
    });

    it('should create a toolbar element with correct role and label', () => {
        expect(toolbar.toolbarElement).not.toBeNull();
        expect(toolbar.toolbarElement.getAttribute('role')).toBe('toolbar');
        expect(toolbar.toolbarElement.getAttribute('aria-label')).toBe('편집 도구 모음');
    });

    it('should attach the toolbar to the DOM', () => {
        expect(document.querySelector('.hwpx-editing-toolbar')).not.toBeNull();
    });

    it('should render bold, italic, and underline buttons', () => {
        const boldBtn = toolbar.toolbarElement.querySelector('[data-action="bold"]');
        const italicBtn = toolbar.toolbarElement.querySelector('[data-action="italic"]');
        const underlineBtn = toolbar.toolbarElement.querySelector('[data-action="underline"]');

        expect(boldBtn).not.toBeNull();
        expect(italicBtn).not.toBeNull();
        expect(underlineBtn).not.toBeNull();
    });

    it('should render alignment buttons', () => {
        const left = toolbar.toolbarElement.querySelector('[data-action="alignLeft"]');
        const center = toolbar.toolbarElement.querySelector('[data-action="alignCenter"]');
        const right = toolbar.toolbarElement.querySelector('[data-action="alignRight"]');

        expect(left).not.toBeNull();
        expect(center).not.toBeNull();
        expect(right).not.toBeNull();
        // alignLeft should be active by default
        expect(left.classList.contains('active')).toBe(true);
    });

    it('should render undo and redo buttons', () => {
        expect(toolbar.toolbarElement.querySelector('[data-action="undo"]')).not.toBeNull();
        expect(toolbar.toolbarElement.querySelector('[data-action="redo"]')).not.toBeNull();
    });

    it('should toggle bold state when bold button is clicked', () => {
        const boldBtn = toolbar.toolbarElement.querySelector('[data-action="bold"]');
        boldBtn.click();

        expect(viewer.textFormatter.toggleBold).toHaveBeenCalled();
        expect(toolbar.activeStates.bold).toBe(true);
        expect(boldBtn.classList.contains('active')).toBe(true);
        expect(boldBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('should set alignment active state exclusively', () => {
        const centerBtn = toolbar.toolbarElement.querySelector('[data-action="alignCenter"]');
        centerBtn.click();

        expect(toolbar.activeStates.alignCenter).toBe(true);
        expect(toolbar.activeStates.alignLeft).toBe(false);
        expect(toolbar.activeStates.alignRight).toBe(false);

        const leftBtn = toolbar.toolbarElement.querySelector('[data-action="alignLeft"]');
        expect(leftBtn.classList.contains('active')).toBe(false);
        expect(centerBtn.classList.contains('active')).toBe(true);
    });

    it('should toggle visibility with toggle()', () => {
        expect(toolbar.isVisible).toBe(true);
        toolbar.toggle();
        expect(toolbar.isVisible).toBe(false);
        expect(toolbar.toolbarElement.style.display).toBe('none');
        toolbar.toggle();
        expect(toolbar.isVisible).toBe(true);
        expect(toolbar.toolbarElement.style.display).toBe('flex');
    });

    it('should show and hide the toolbar', () => {
        toolbar.hide();
        expect(toolbar.isVisible).toBe(false);
        expect(toolbar.toolbarElement.style.display).toBe('none');

        toolbar.show();
        expect(toolbar.isVisible).toBe(true);
        expect(toolbar.toolbarElement.style.display).toBe('flex');
    });

    it('should remove the toolbar from DOM on destroy', () => {
        toolbar.destroy();
        expect(document.querySelector('.hwpx-editing-toolbar')).toBeNull();
        expect(toolbar.toolbarElement).toBeNull();
    });
});
