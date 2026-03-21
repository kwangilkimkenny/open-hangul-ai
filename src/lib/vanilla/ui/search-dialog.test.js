import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));

import { SearchDialog } from './search-dialog.js';

function createMockViewer() {
    return {
        command: {
            find: vi.fn().mockReturnValue(3),
            findNext: vi.fn(),
            findPrevious: vi.fn(),
            replace: vi.fn().mockReturnValue(true),
            replaceAll: vi.fn().mockReturnValue(5),
            clearSearch: vi.fn(),
        },
        searchManager: {
            getMatches: vi.fn().mockReturnValue([1, 2, 3]),
            getSearchInfo: vi.fn().mockReturnValue({ matchCount: 3, currentIndex: 0 }),
        },
    };
}

describe('SearchDialog', () => {
    let dialog;
    let viewer;

    beforeEach(() => {
        document.body.innerHTML = '';
        viewer = createMockViewer();
        dialog = new SearchDialog(viewer);
    });

    afterEach(() => {
        if (dialog && dialog.dialogElement) {
            dialog.destroy();
        }
    });

    it('should create a dialog element in the DOM', () => {
        const el = document.querySelector('.hwpx-search-dialog');
        expect(el).not.toBeNull();
        expect(el.getAttribute('role')).toBe('dialog');
        expect(el.getAttribute('aria-label')).toBe('찾기 및 바꾸기');
    });

    it('should be hidden by default', () => {
        expect(dialog.dialogElement.style.display).toBe('none');
        expect(dialog.isVisible).toBe(false);
    });

    it('should have search and replace inputs', () => {
        expect(dialog.searchInput).not.toBeNull();
        expect(dialog.searchInput.getAttribute('aria-label')).toBe('찾을 내용');
        expect(dialog.replaceInput).not.toBeNull();
        expect(dialog.replaceInput.getAttribute('aria-label')).toBe('바꿀 내용');
    });

    it('should show the dialog and focus search input when show() is called', () => {
        dialog.searchInput.focus = vi.fn();
        dialog.searchInput.select = vi.fn();

        dialog.show();

        expect(dialog.dialogElement.style.display).toBe('block');
        expect(dialog.isVisible).toBe(true);
        expect(dialog.searchInput.focus).toHaveBeenCalled();
    });

    it('should hide the dialog and clear search when hide() is called', () => {
        dialog.show();
        dialog.hide();

        expect(dialog.dialogElement.style.display).toBe('none');
        expect(dialog.isVisible).toBe(false);
        expect(viewer.command.clearSearch).toHaveBeenCalled();
    });

    it('should toggle visibility', () => {
        dialog.searchInput.focus = vi.fn();
        dialog.searchInput.select = vi.fn();

        dialog.toggle();
        expect(dialog.isVisible).toBe(true);

        dialog.toggle();
        expect(dialog.isVisible).toBe(false);
    });

    it('should set mode to find by default and hide replace elements', () => {
        expect(dialog.mode).toBe('find');
        const replaceGroup = dialog.dialogElement.querySelector('.hwpx-replace-input-group');
        expect(replaceGroup.style.display).toBe('none');
    });

    it('should switch to replace mode and show replace elements', () => {
        dialog.setMode('replace');

        expect(dialog.mode).toBe('replace');
        const replaceGroup = dialog.dialogElement.querySelector('.hwpx-replace-input-group');
        expect(replaceGroup.style.display).toBe('block');

        const replaceBtn = dialog.dialogElement.querySelector('.hwpx-btn-replace');
        expect(replaceBtn.style.display).toBe('inline-block');

        const replaceAllBtn = dialog.dialogElement.querySelector('.hwpx-btn-replace-all');
        expect(replaceAllBtn.style.display).toBe('inline-block');
    });

    it('should update tab aria-selected attributes when switching modes', () => {
        dialog.setMode('replace');
        const tabs = dialog.dialogElement.querySelectorAll('.hwpx-search-tab');
        const findTab = Array.from(tabs).find(t => t.dataset.tab === 'find');
        const replaceTab = Array.from(tabs).find(t => t.dataset.tab === 'replace');

        expect(findTab.getAttribute('aria-selected')).toBe('false');
        expect(replaceTab.getAttribute('aria-selected')).toBe('true');
        expect(replaceTab.classList.contains('active')).toBe(true);
    });

    it('should call viewer.command.find when find button is clicked with text', () => {
        dialog.searchInput.value = 'hello';
        const findBtn = dialog.dialogElement.querySelector('.hwpx-btn-find');
        findBtn.click();

        expect(viewer.command.find).toHaveBeenCalledWith('hello', expect.any(Object));
    });

    it('should call viewer.command.findNext when next button is clicked', () => {
        dialog.searchInput.value = 'hello';
        const nextBtn = dialog.dialogElement.querySelector('.hwpx-btn-find-next');
        nextBtn.click();

        expect(viewer.command.findNext).toHaveBeenCalled();
    });

    it('should call viewer.command.findPrevious when prev button is clicked', () => {
        dialog.searchInput.value = 'hello';
        const prevBtn = dialog.dialogElement.querySelector('.hwpx-btn-find-prev');
        prevBtn.click();

        expect(viewer.command.findPrevious).toHaveBeenCalled();
    });

    it('should close on Escape key', () => {
        dialog.searchInput.focus = vi.fn();
        dialog.searchInput.select = vi.fn();
        dialog.show();

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        dialog.dialogElement.dispatchEvent(event);

        expect(dialog.isVisible).toBe(false);
    });

    it('should remove dialog element from DOM on destroy', () => {
        dialog.destroy();

        expect(document.querySelector('.hwpx-search-dialog')).toBeNull();
        expect(dialog.dialogElement).toBeNull();
    });
});
