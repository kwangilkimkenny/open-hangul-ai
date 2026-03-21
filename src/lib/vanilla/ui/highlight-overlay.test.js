import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));

import { HighlightOverlay } from './highlight-overlay.js';

function createRange(container) {
    // Create a simple text node and range for testing
    const textNode = document.createTextNode('test text');
    container.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    return range;
}

describe('HighlightOverlay', () => {
    let overlay;
    let container;

    beforeEach(() => {
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
        overlay = new HighlightOverlay();
    });

    it('should initialize with empty overlays and suggestionData maps', () => {
        expect(overlay.overlays.size).toBe(0);
        expect(overlay.suggestionData.size).toBe(0);
        expect(overlay.getHighlightCount()).toBe(0);
    });

    it('should add a highlight and wrap the range with a span', () => {
        const range = createRange(container);
        const data = { message: 'fix this' };
        const el = overlay.addHighlight('h1', range, 'error', data);

        expect(el).not.toBeNull();
        expect(el.tagName).toBe('SPAN');
        expect(el.classList.contains('highlight-overlay')).toBe(true);
        expect(el.classList.contains('highlight-error')).toBe(true);
        expect(el.dataset.highlightId).toBe('h1');
        expect(el.dataset.highlightType).toBe('error');
        expect(overlay.getHighlightCount()).toBe(1);
        expect(overlay.getSuggestionData('h1')).toEqual(data);
    });

    it('should remove a highlight by id and restore children', () => {
        const range = createRange(container);
        overlay.addHighlight('h1', range, 'warning');
        expect(overlay.getHighlightCount()).toBe(1);

        overlay.removeHighlight('h1');
        expect(overlay.getHighlightCount()).toBe(0);
        expect(overlay.getHighlight('h1')).toBeNull();
        // The text should still exist in the container
        expect(container.textContent).toBe('test text');
    });

    it('should remove all highlights', () => {
        const r1 = createRange(container);
        overlay.addHighlight('h1', r1, 'error');

        const r2 = createRange(container);
        overlay.addHighlight('h2', r2, 'warning');

        expect(overlay.getHighlightCount()).toBe(2);
        overlay.removeAllHighlights();
        expect(overlay.getHighlightCount()).toBe(0);
    });

    it('should remove highlights by type', () => {
        const r1 = createRange(container);
        overlay.addHighlight('h1', r1, 'error');

        const r2 = createRange(container);
        overlay.addHighlight('h2', r2, 'suggestion');

        overlay.removeHighlightsByType('error');
        expect(overlay.getHighlightCount()).toBe(1);
        expect(overlay.getHighlight('h1')).toBeNull();
        expect(overlay.getHighlight('h2')).not.toBeNull();
    });

    it('should return correct colors for each type', () => {
        expect(overlay.getColor('error')).toBe('#f56565');
        expect(overlay.getColor('warning')).toBe('#ed8936');
        expect(overlay.getColor('suggestion')).toBe('#4299e1');
        expect(overlay.getColor('style')).toBe('#9f7aea');
        expect(overlay.getColor('info')).toBe('#48bb78');
        // Unknown type falls back to suggestion
        expect(overlay.getColor('unknown')).toBe('#4299e1');
    });

    it('should return correct border styles for each type', () => {
        expect(overlay.getBorderStyle('error')).toBe('wavy');
        expect(overlay.getBorderStyle('suggestion')).toBe('dotted');
        expect(overlay.getBorderStyle('style')).toBe('dashed');
        expect(overlay.getBorderStyle('info')).toBe('solid');
    });

    it('should return highlight counts by type', () => {
        const r1 = createRange(container);
        overlay.addHighlight('h1', r1, 'error');

        const r2 = createRange(container);
        overlay.addHighlight('h2', r2, 'error');

        const r3 = createRange(container);
        overlay.addHighlight('h3', r3, 'suggestion');

        const counts = overlay.getHighlightCountByType();
        expect(counts.error).toBe(2);
        expect(counts.suggestion).toBe(1);
        expect(counts.warning).toBe(0);
    });
});
