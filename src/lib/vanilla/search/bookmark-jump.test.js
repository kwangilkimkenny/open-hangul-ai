import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listBookmarks, findBookmark, scrollToBookmark } from './bookmark-jump.js';

function makeDoc(paragraphs) {
  return {
    sections: [{ paragraphs: paragraphs.map(runs => ({ runs })) }],
  };
}

describe('listBookmarks', () => {
  it('returns empty list for empty/invalid doc', () => {
    expect(listBookmarks(null)).toEqual([]);
    expect(listBookmarks({})).toEqual([]);
    expect(listBookmarks(makeDoc([]))).toEqual([]);
  });

  it('collects all bookmark runs with positional info', () => {
    const doc = makeDoc([
      [{ text: 'plain' }],
      [{ type: 'bookmark', name: 'intro', text: '' }, { text: 'section1' }],
      [{ text: 'middle' }, { type: 'bookmark', name: 'end', text: '' }],
    ]);
    const list = listBookmarks(doc);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: 'intro', sectionIdx: 0, paragraphIdx: 1, runIdx: 0 });
    expect(list[1]).toMatchObject({ name: 'end', sectionIdx: 0, paragraphIdx: 2, runIdx: 1 });
  });

  it('skips bookmark runs without a name', () => {
    const doc = makeDoc([
      [{ type: 'bookmark', name: '', text: '' }, { type: 'bookmark', name: 'a', text: '' }],
    ]);
    const list = listBookmarks(doc);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('a');
  });
});

describe('findBookmark', () => {
  it('returns matching bookmark', () => {
    const doc = makeDoc([
      [{ type: 'bookmark', name: 'first', text: '' }],
      [{ type: 'bookmark', name: 'second', text: '' }],
    ]);
    expect(findBookmark(doc, 'second')).toMatchObject({ paragraphIdx: 1 });
    expect(findBookmark(doc, 'missing')).toBeNull();
    expect(findBookmark(doc, '')).toBeNull();
  });
});

describe('scrollToBookmark', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('returns false when container missing', () => {
    expect(scrollToBookmark(null, 'x')).toBe(false);
  });

  it('returns false when bookmark element not found', () => {
    expect(scrollToBookmark(container, 'nope')).toBe(false);
  });

  it('scrolls and applies temporary highlight when element exists', () => {
    vi.useFakeTimers();
    const el = document.createElement('span');
    el.setAttribute('data-bookmark', 'intro');
    el.textContent = 'target';
    el.scrollIntoView = vi.fn();
    container.appendChild(el);

    const ok = scrollToBookmark(container, 'intro', { highlightMs: 100 });
    expect(ok).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.style.outline).toContain('2px');
    vi.advanceTimersByTime(150);
    // Highlight should be cleared
    expect(el.style.outline === '' || el.style.outline === 'none').toBe(true);
  });

  it('falls back to id="bookmark-<name>" selector', () => {
    const el = document.createElement('span');
    el.id = 'bookmark-end';
    el.scrollIntoView = () => {};
    container.appendChild(el);
    expect(scrollToBookmark(container, 'end')).toBe(true);
  });
});
