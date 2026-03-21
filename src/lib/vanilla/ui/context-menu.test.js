import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));

import { ContextMenu } from './context-menu.js';

describe('ContextMenu', () => {
    let menu;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
        menu = new ContextMenu();
    });

    afterEach(() => {
        // Flush pending timers (e.g. the position-adjustment setTimeout from show())
        // BEFORE destroy, so they don't access a nulled menuElement.
        vi.runAllTimers();
        if (menu && menu.menuElement) {
            menu.destroy();
        }
        vi.useRealTimers();
    });

    function showMenu(items = [], overrides = {}) {
        const event = {
            target: overrides.target || document.body,
            clientX: overrides.clientX || 0,
            clientY: overrides.clientY || 0,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };
        menu.show(event, items);
        // Flush the position-adjustment setTimeout immediately
        vi.runAllTimers();
        return event;
    }

    it('should create a menu element in the DOM on construction', () => {
        const el = document.getElementById('context-menu');
        expect(el).not.toBeNull();
        expect(el.className).toBe('context-menu');
        expect(el.getAttribute('role')).toBe('menu');
        expect(el.getAttribute('aria-label')).toBe('편집 메뉴');
    });

    it('should be hidden by default', () => {
        expect(menu.menuElement.style.display).toBe('none');
    });

    it('should initialize internal state correctly', () => {
        expect(menu.currentTarget).toBeNull();
        expect(menu.menuItems).toEqual([]);
    });

    it('should show the menu at the event coordinates', () => {
        const event = showMenu([{ label: 'Copy', action: vi.fn() }], { clientX: 150, clientY: 200 });

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
        expect(menu.menuElement.style.display).toBe('block');
        expect(menu.menuElement.style.left).toBe('150px');
        expect(menu.menuElement.style.top).toBe('200px');
    });

    it('should set currentTarget when show is called', () => {
        const target = document.createElement('span');
        showMenu([], { target });
        expect(menu.currentTarget).toBe(target);
    });

    it('should hide the menu and reset state', () => {
        showMenu([{ label: 'Test' }]);
        menu.hide();

        expect(menu.menuElement.style.display).toBe('none');
        expect(menu.currentTarget).toBeNull();
        expect(menu.menuItems).toEqual([]);
    });

    it('should render menu items with labels', () => {
        showMenu([
            { label: 'Cut', action: vi.fn() },
            { label: 'Copy', action: vi.fn() },
        ]);

        const rendered = menu.menuElement.querySelectorAll('.context-menu-item');
        expect(rendered.length).toBe(2);
        expect(rendered[0].querySelector('.context-menu-label').textContent).toBe('Cut');
        expect(rendered[1].querySelector('.context-menu-label').textContent).toBe('Copy');
    });

    it('should render separators', () => {
        showMenu([
            { label: 'Cut', action: vi.fn() },
            { separator: true },
            { label: 'Paste', action: vi.fn() },
        ]);

        const separators = menu.menuElement.querySelectorAll('.context-menu-separator');
        expect(separators.length).toBe(1);
    });

    it('should render icon and shortcut when provided', () => {
        showMenu([{ label: 'Copy', icon: 'C', shortcut: 'Ctrl+C', action: vi.fn() }]);

        const item = menu.menuElement.querySelector('.context-menu-item');
        expect(item.querySelector('.context-menu-icon').textContent).toBe('C');
        expect(item.querySelector('.context-menu-shortcut').textContent).toBe('Ctrl+C');
    });

    it('should mark disabled items with class and aria-disabled', () => {
        showMenu([{ label: 'Paste', disabled: true }]);

        const item = menu.menuElement.querySelector('.context-menu-item');
        expect(item.classList.contains('disabled')).toBe(true);
        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(item.getAttribute('tabindex')).toBe('-1');
    });

    it('should call action and hide menu when a non-disabled item is clicked', () => {
        const action = vi.fn();
        const target = document.createElement('p');
        showMenu([{ label: 'Copy', action }], { target });

        const item = menu.menuElement.querySelector('.context-menu-item');
        item.click();

        expect(action).toHaveBeenCalled();
        expect(menu.menuElement.style.display).toBe('none');
    });

    it('should hide when Escape key is pressed', () => {
        showMenu([{ label: 'Test' }]);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(menu.menuElement.style.display).toBe('none');
    });

    it('should remove the menu element and clean up on destroy', () => {
        menu.destroy();

        expect(document.getElementById('context-menu')).toBeNull();
        expect(menu.menuElement).toBeNull();
        expect(menu.currentTarget).toBeNull();
        expect(menu._boundHide).toBeNull();
        expect(menu._boundContextMenuHandler).toBeNull();
        expect(menu._boundKeydownHandler).toBeNull();
    });
});
