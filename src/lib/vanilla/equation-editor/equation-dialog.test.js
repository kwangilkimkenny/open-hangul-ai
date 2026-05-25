/**
 * equation-dialog unit tests (jsdom)
 */

import { describe, it, expect } from 'vitest';
import { openEquationDialog } from './equation-dialog.js';

function $(sel, root = document) {
    return root.querySelector(sel);
}

async function waitFor(fn, { timeout = 500 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const v = fn();
        if (v) return v;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 5));
    }
    return fn();
}

describe('equation-dialog :: openEquationDialog', () => {
    it('returns null when no document is available', async () => {
        const result = await openEquationDialog({ document: null });
        expect(result).toBeNull();
    });

    it('mounts overlay/editor/palette into the DOM', async () => {
        const promise = openEquationDialog({ initialLatex: 'x^2', autoFocus: false });
        await waitFor(() => $('.hwpx-equation-dialog-overlay'));
        const overlay = $('.hwpx-equation-dialog-overlay');
        expect(overlay).toBeTruthy();
        expect($('.hwpx-equation-dialog-editor')).toBeTruthy();
        expect($('.hwpx-equation-palette')).toBeTruthy();
        expect($('.hwpx-equation-dialog-preview')).toBeTruthy();

        // cancel to resolve the promise & cleanup
        $('.hwpx-equation-dialog-cancel').click();
        const result = await promise;
        expect(result).toBeNull();
        await waitFor(() => !$('.hwpx-equation-dialog-overlay'));
        expect($('.hwpx-equation-dialog-overlay')).toBeNull();
    });

    it('resolves null when "취소" is clicked', async () => {
        const promise = openEquationDialog({ autoFocus: false });
        await waitFor(() => $('.hwpx-equation-dialog-cancel'));
        $('.hwpx-equation-dialog-cancel').click();
        const result = await promise;
        expect(result).toBeNull();
    });

    it('resolves null when the close (✕) button is clicked', async () => {
        const promise = openEquationDialog({ autoFocus: false });
        await waitFor(() => $('.hwpx-equation-dialog-close'));
        $('.hwpx-equation-dialog-close').click();
        const result = await promise;
        expect(result).toBeNull();
    });

    it('returns latex + mathml + hancomScript on "삽입"', async () => {
        const promise = openEquationDialog({ initialLatex: '\\frac{a}{b}', autoFocus: false });
        await waitFor(() => $('.hwpx-equation-dialog-insert'));
        // allow async editor mount (Promise.then in microtask)
        await new Promise((r) => setTimeout(r, 30));
        $('.hwpx-equation-dialog-insert').click();
        const result = await promise;
        expect(result).not.toBeNull();
        expect(typeof result.latex).toBe('string');
        expect(typeof result.mathml).toBe('string');
        expect(typeof result.hancomScript).toBe('string');
        expect(result.hancomScript.toUpperCase()).toContain('FRAC');
    });

    it('Escape key cancels the dialog', async () => {
        const promise = openEquationDialog({ autoFocus: false });
        const root = await waitFor(() => $('.hwpx-equation-dialog'));
        const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        root.dispatchEvent(ev);
        const result = await promise;
        expect(result).toBeNull();
    });
});
