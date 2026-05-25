import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { AutocompletePopup, showAutocompletePopup, getAutocompletePopup } from './autocomplete-popup.js';

const candidates = [
  { word: '안녕하세요', frequency: 5 },
  { word: '안녕히가세요', frequency: 3 },
  { word: '안녕히계세요', frequency: 1 },
];

const baseRect = { left: 100, top: 60, bottom: 80 };

function dispatchKey(key, opts = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  document.dispatchEvent(ev);
  return ev;
}

describe('AutocompletePopup', () => {
  let popup;

  beforeEach(() => {
    document.body.innerHTML = '';
    popup = new AutocompletePopup();
  });

  afterEach(() => {
    if (popup) popup.destroy();
  });

  it('creates a hidden popup element on construction', () => {
    const el = document.querySelector('.autocomplete-popup');
    expect(el).not.toBeNull();
    expect(el.style.display).toBe('none');
  });

  it('show() renders candidates and positions popup', () => {
    popup.show({ prefix: '안녕', candidates, rect: baseRect, onSelect: vi.fn() });
    expect(popup.popup.style.display).toBe('block');
    const items = popup.popup.querySelectorAll('.autocomplete-popup__item');
    expect(items.length).toBe(3);
    expect(items[0].classList.contains('autocomplete-popup__item--active')).toBe(true);
    expect(popup.popup.style.left).not.toBe('');
    expect(popup.popup.style.top).not.toBe('');
  });

  it('renders empty-state when no candidates', () => {
    popup.show({ prefix: '없', candidates: [], rect: baseRect, onSelect: vi.fn() });
    expect(popup.popup.textContent).toContain('후보 없음');
  });

  it('Arrow keys move active index', () => {
    popup.show({ prefix: '안녕', candidates, rect: baseRect, onSelect: vi.fn() });
    expect(popup.activeIndex).toBe(0);
    dispatchKey('ArrowDown');
    expect(popup.activeIndex).toBe(1);
    dispatchKey('ArrowDown');
    expect(popup.activeIndex).toBe(2);
    dispatchKey('ArrowDown'); // clamped
    expect(popup.activeIndex).toBe(2);
    dispatchKey('ArrowUp');
    expect(popup.activeIndex).toBe(1);
  });

  it('Enter applies active candidate', () => {
    const onSelect = vi.fn();
    popup.show({ prefix: '안녕', candidates, rect: baseRect, onSelect });
    dispatchKey('ArrowDown');
    dispatchKey('Enter');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][1]).toBe('select');
    expect(onSelect.mock.calls[0][0]).toEqual(candidates[1]);
    expect(popup.popup.style.display).toBe('none');
  });

  it('Tab also applies active candidate', () => {
    const onSelect = vi.fn();
    popup.show({ prefix: '안녕', candidates, rect: baseRect, onSelect });
    dispatchKey('Tab');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toEqual(candidates[0]);
  });

  it('Escape cancels with reason=cancel', () => {
    const onSelect = vi.fn();
    popup.show({ prefix: '안녕', candidates, rect: baseRect, onSelect });
    dispatchKey('Escape');
    expect(onSelect).toHaveBeenCalledWith(null, 'cancel');
    expect(popup.popup.style.display).toBe('none');
  });

  it('Number key 1-9 selects directly', () => {
    const onSelect = vi.fn();
    popup.show({ prefix: '안녕', candidates, rect: baseRect, onSelect });
    dispatchKey('2');
    expect(onSelect).toHaveBeenCalledWith(candidates[1], 'select');
  });

  it('outside mousedown closes popup', () => {
    const onSelect = vi.fn();
    popup.show({ prefix: '안녕', candidates, rect: baseRect, onSelect });
    const md = new MouseEvent('mousedown', { bubbles: true });
    document.body.dispatchEvent(md);
    expect(popup.popup.style.display).toBe('none');
    expect(onSelect).toHaveBeenCalledWith(null, 'cancel');
  });

  it('updateCandidates re-renders without re-showing', () => {
    popup.show({ prefix: '안', candidates, rect: baseRect, onSelect: vi.fn() });
    popup.updateCandidates([{ word: '아하' }, { word: '아침' }], '아');
    const items = popup.popup.querySelectorAll('.autocomplete-popup__item');
    expect(items.length).toBe(2);
    expect(popup.activeIndex).toBe(0);
  });

  it('showAutocompletePopup helper reuses singleton', () => {
    const onSelect = vi.fn();
    const a = showAutocompletePopup({ prefix: 'a', candidates, rect: baseRect, onSelect });
    const b = showAutocompletePopup({ prefix: 'b', candidates, rect: baseRect, onSelect });
    expect(a).toBe(b);
    expect(getAutocompletePopup()).toBe(a);
    a.destroy();
  });
});
