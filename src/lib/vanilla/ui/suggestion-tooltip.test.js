import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));

import { SuggestionTooltip } from './suggestion-tooltip.js';

function createSuggestion(overrides = {}) {
    return {
        type: 'suggestion',
        category: 'grammar',
        original: 'teh',
        suggestion: 'the',
        reason: 'Spelling error',
        confidence: 0.95,
        ...overrides,
    };
}

describe('SuggestionTooltip', () => {
    let tooltip;

    beforeEach(() => {
        document.body.innerHTML = '';
        tooltip = new SuggestionTooltip();
    });

    afterEach(() => {
        if (tooltip && tooltip.tooltip && tooltip.tooltip.parentNode) {
            tooltip.tooltip.parentNode.removeChild(tooltip.tooltip);
        }
    });

    it('should create a tooltip element in the DOM on construction', () => {
        const el = document.querySelector('.ai-suggestion-tooltip');
        expect(el).not.toBeNull();
        expect(el.style.display).toBe('none');
    });

    it('should register and retrieve suggestions', () => {
        const suggestion = createSuggestion();
        tooltip.registerSuggestion('s1', suggestion);
        expect(tooltip.suggestionRegistry.get('s1')).toEqual(suggestion);
    });

    it('should show the tooltip with rendered content when show() is called', () => {
        const suggestion = createSuggestion();
        const rect = { left: 100, top: 50, bottom: 70, right: 200 };

        tooltip.show({ id: 'h1', target: document.body, overlay: null, suggestion, rect });

        expect(tooltip.tooltip.style.display).toBe('block');
        expect(tooltip.currentHighlightId).toBe('h1');
        expect(tooltip.currentSuggestion).toEqual(suggestion);
        // Check rendered content
        expect(tooltip.tooltip.querySelector('.original-text').textContent).toContain('teh');
        expect(tooltip.tooltip.querySelector('.suggested-text').textContent).toContain('the');
        expect(tooltip.tooltip.querySelector('.suggestion-reason').textContent).toContain('Spelling error');
    });

    it('should not show tooltip if no suggestion data is available', () => {
        tooltip.show({ id: 'unknown', target: document.body, overlay: null, suggestion: null, rect: null });
        expect(tooltip.tooltip.style.display).toBe('none');
    });

    it('should use registered suggestion when none is provided in detail', () => {
        const suggestion = createSuggestion({ original: 'recieve', suggestion: 'receive' });
        tooltip.registerSuggestion('s1', suggestion);
        const rect = { left: 0, top: 0, bottom: 20, right: 100 };

        tooltip.show({ id: 's1', target: document.body, overlay: null, suggestion: null, rect });

        expect(tooltip.tooltip.style.display).toBe('block');
        expect(tooltip.tooltip.querySelector('.original-text').textContent).toContain('recieve');
    });

    it('should hide the tooltip and clear current state', () => {
        vi.useFakeTimers();
        const suggestion = createSuggestion();
        const rect = { left: 0, top: 0, bottom: 20, right: 100 };
        tooltip.show({ id: 'h1', target: document.body, overlay: null, suggestion, rect });

        tooltip.hide();
        vi.advanceTimersByTime(200);

        expect(tooltip.tooltip.style.display).toBe('none');
        expect(tooltip.currentHighlightId).toBeNull();
        expect(tooltip.currentSuggestion).toBeNull();
        vi.useRealTimers();
    });

    it('should remove a suggestion and hide tooltip if it is currently shown', () => {
        vi.useFakeTimers();
        const suggestion = createSuggestion();
        tooltip.registerSuggestion('s1', suggestion);
        const rect = { left: 0, top: 0, bottom: 20, right: 100 };
        tooltip.show({ id: 's1', target: document.body, overlay: null, suggestion, rect });

        tooltip.removeSuggestion('s1');
        vi.advanceTimersByTime(200);

        expect(tooltip.suggestionRegistry.has('s1')).toBe(false);
        expect(tooltip.tooltip.style.display).toBe('none');
        vi.useRealTimers();
    });

    it('should clear all suggestions', () => {
        vi.useFakeTimers();
        tooltip.registerSuggestion('s1', createSuggestion());
        tooltip.registerSuggestion('s2', createSuggestion());

        tooltip.clearAllSuggestions();
        vi.advanceTimersByTime(200);

        expect(tooltip.suggestionRegistry.size).toBe(0);
        expect(tooltip.tooltip.style.display).toBe('none');
        vi.useRealTimers();
    });
});
