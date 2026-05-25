/**
 * equation-palette unit tests (jsdom)
 */

import { describe, it, expect, vi } from 'vitest';
import {
    attachPalette,
    bindShortcuts,
    PALETTE_CATALOG,
    PALETTE_GROUPS,
} from './equation-palette.js';

describe('equation-palette :: attachPalette()', () => {
    it('renders buttons for every catalog item', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const spy = vi.fn();
        const p = attachPalette(host, { onInsert: spy });
        const btns = p.element.querySelectorAll('button.hwpx-equation-palette__btn');
        expect(btns.length).toBe(PALETTE_CATALOG.length);
        p.destroy();
        document.body.removeChild(host);
    });

    it('clicking a button calls onInsert with the catalog latex', () => {
        const host = document.createElement('div');
        const spy = vi.fn();
        const p = attachPalette(host, { onInsert: spy });

        const fracBtn = p.element.querySelector('[data-palette-id="frac"]');
        expect(fracBtn).toBeTruthy();
        fracBtn.click();

        expect(spy).toHaveBeenCalledTimes(1);
        const [latex, item] = spy.mock.calls[0];
        expect(latex).toContain('\\frac');
        expect(item.id).toBe('frac');
        p.destroy();
    });

    it('insertById() triggers onInsert without DOM events', () => {
        const host = document.createElement('div');
        const spy = vi.fn();
        const p = attachPalette(host, { onInsert: spy });
        p.insertById('sigma');
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toBe('\\sigma');
        p.destroy();
    });

    it('respects groups option for filtering', () => {
        const host = document.createElement('div');
        const spy = vi.fn();
        const p = attachPalette(host, {
            onInsert: spy,
            groups: ['greek'],
        });
        const sections = p.element.querySelectorAll('.hwpx-equation-palette__group');
        expect(sections.length).toBe(1);
        const greekItems = PALETTE_CATALOG.filter((it) => it.group === 'greek').length;
        expect(p.element.querySelectorAll('button').length).toBe(greekItems);
        p.destroy();
    });

    it('catalog exposes the documented group set', () => {
        const groups = new Set(PALETTE_GROUPS.map((g) => g.id));
        for (const item of PALETTE_CATALOG) {
            expect(groups.has(item.group)).toBe(true);
        }
    });
});

describe('equation-palette :: bindShortcuts()', () => {
    it('invokes the insert callback for Ctrl+/ (frac)', () => {
        const target = document.createElement('div');
        document.body.appendChild(target);
        const spy = vi.fn();
        const unbind = bindShortcuts(target, spy);

        const ev = new KeyboardEvent('keydown', { key: '/', ctrlKey: true });
        target.dispatchEvent(ev);

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toBe('\\frac{}{}');
        unbind();
        document.body.removeChild(target);
    });

    it('does not fire without modifier keys', () => {
        const target = document.createElement('div');
        const spy = vi.fn();
        const unbind = bindShortcuts(target, spy);
        target.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
        expect(spy).not.toHaveBeenCalled();
        unbind();
    });
});
