import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderSearchHighlight,
  setActiveMatch,
  nextMatchId,
  clearSearchHighlight,
  destroySearchHighlight,
} from './search-highlight.js';

let container;
let textNode;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  container.style.position = 'relative';
  textNode = document.createTextNode('hello world hello universe');
  container.appendChild(textNode);
  document.body.appendChild(container);
});

afterEach(() => {
  destroySearchHighlight(container);
  document.body.innerHTML = '';
});

describe('search-highlight', () => {
  it('renderSearchHighlight creates root and hit spans', () => {
    const { root, hits } = renderSearchHighlight(container, [
      { textNode, matches: [{ start: 0, end: 5, id: 'm0' }, { start: 12, end: 17, id: 'm1' }] },
    ]);
    expect(root).toBeInstanceOf(HTMLDivElement);
    expect(root.classList.contains('search-overlay')).toBe(true);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0].classList.contains('search-hit')).toBe(true);
    expect(hits[0].getAttribute('data-match-id')).toBe('m0');
  });

  it('marks active match with --active class', () => {
    const { hits } = renderSearchHighlight(
      container,
      [{ textNode, matches: [{ start: 0, end: 5, id: 'm0' }, { start: 12, end: 17, id: 'm1' }] }],
      'm1',
    );
    const activeHits = hits.filter(h => h.classList.contains('search-hit--active'));
    expect(activeHits.length).toBeGreaterThanOrEqual(1);
    expect(activeHits[0].getAttribute('data-match-id')).toBe('m1');
  });

  it('setActiveMatch updates active styles', () => {
    renderSearchHighlight(container, [
      { textNode, matches: [{ start: 0, end: 5, id: 'm0' }, { start: 12, end: 17, id: 'm1' }] },
    ]);
    setActiveMatch(container, 'm1');
    const m0 = container.querySelector('[data-match-id="m0"]');
    const m1 = container.querySelector('[data-match-id="m1"]');
    expect(m0.classList.contains('search-hit--active')).toBe(false);
    expect(m1.classList.contains('search-hit--active')).toBe(true);
  });

  it('clearSearchHighlight removes hits but keeps root', () => {
    renderSearchHighlight(container, [
      { textNode, matches: [{ start: 0, end: 5, id: 'm0' }] },
    ]);
    clearSearchHighlight(container);
    expect(container.querySelectorAll('.search-hit').length).toBe(0);
    expect(container.querySelector('.search-overlay')).not.toBeNull();
  });

  it('destroySearchHighlight removes root entirely', () => {
    renderSearchHighlight(container, [
      { textNode, matches: [{ start: 0, end: 5, id: 'm0' }] },
    ]);
    destroySearchHighlight(container);
    expect(container.querySelector('.search-overlay')).toBeNull();
  });

  it('throws when container is not an HTMLElement', () => {
    expect(() => renderSearchHighlight(null, [])).toThrow(TypeError);
  });

  it('nextMatchId cycles forward and backward', () => {
    expect(nextMatchId(['a', 'b', 'c'], 'a', 1)).toBe('b');
    expect(nextMatchId(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(nextMatchId(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(nextMatchId([], 'x', 1)).toBeNull();
    expect(nextMatchId(['a'], null, 1)).toBe('a');
  });
});
