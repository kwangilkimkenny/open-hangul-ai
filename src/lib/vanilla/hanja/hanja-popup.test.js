import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
  }),
}));

import { HanjaPopup, showHanjaPopup, bindHanjaShortcut } from './hanja-popup.js';

const candidates = [
  { hanja: '國', meaning: '나라', frequency: 10 },
  { hanja: '局', meaning: '판국', frequency: 7 },
  { hanja: '菊', meaning: '국화', frequency: 3 },
];

const baseRect = { left: 50, top: 50, bottom: 70, right: 120, width: 70, height: 20 };

function dispatchKey(key, opts = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  document.dispatchEvent(ev);
  return ev;
}

describe('HanjaPopup', () => {
  let popup;

  beforeEach(() => {
    document.body.innerHTML = '';
    popup = new HanjaPopup();
  });

  afterEach(() => {
    if (popup) popup.destroy();
  });

  it('creates a popup element in DOM on construction (hidden)', () => {
    const el = document.querySelector('.hanja-popup');
    expect(el).not.toBeNull();
    expect(el.style.display).toBe('none');
  });

  it('show() renders candidates and positions popup', () => {
    popup.show({ source: '국', candidates, rect: baseRect, onSelect: vi.fn() });
    expect(popup.popup.style.display).toBe('block');
    const items = popup.popup.querySelectorAll('.hanja-popup__item');
    // items: 3 candidate rows (header not counted via .hanja-popup__item)
    expect(items.length).toBe(3);
    // first candidate active
    expect(items[0].classList.contains('hanja-popup__item--active')).toBe(true);
    // popup positioned with absolute left/top set
    expect(popup.popup.style.left).not.toBe('');
    expect(popup.popup.style.top).not.toBe('');
  });

  it('renders an empty-state message when no candidates', () => {
    popup.show({ source: '뷁', candidates: [], rect: baseRect, onSelect: vi.fn() });
    expect(popup.popup.textContent).toContain('한자 후보가 없습니다');
  });

  it('ArrowDown / ArrowUp move active index', () => {
    popup.show({ source: '국', candidates, rect: baseRect, onSelect: vi.fn() });
    expect(popup.activeIndex).toBe(0);
    dispatchKey('ArrowDown');
    expect(popup.activeIndex).toBe(1);
    dispatchKey('ArrowDown');
    expect(popup.activeIndex).toBe(2);
    dispatchKey('ArrowDown'); // clamped at max
    expect(popup.activeIndex).toBe(2);
    dispatchKey('ArrowUp');
    expect(popup.activeIndex).toBe(1);
  });

  it('Enter applies active candidate and invokes onSelect(select)', () => {
    const onSelect = vi.fn();
    popup.show({ source: '국', candidates, rect: baseRect, onSelect });
    dispatchKey('ArrowDown'); // pick 局
    dispatchKey('Enter');
    expect(onSelect).toHaveBeenCalledTimes(1);
    const [picked, reason] = onSelect.mock.calls[0];
    expect(reason).toBe('select');
    expect(picked).toEqual(candidates[1]);
    expect(popup.popup.style.display).toBe('none');
  });

  it('Escape cancels and invokes onSelect(null, cancel)', () => {
    const onSelect = vi.fn();
    popup.show({ source: '국', candidates, rect: baseRect, onSelect });
    dispatchKey('Escape');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBeNull();
    expect(onSelect.mock.calls[0][1]).toBe('cancel');
    expect(popup.popup.style.display).toBe('none');
  });

  it('Number key 2 selects second candidate immediately', () => {
    const onSelect = vi.fn();
    popup.show({ source: '국', candidates, rect: baseRect, onSelect });
    dispatchKey('2');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toEqual(candidates[1]);
  });

  it('outside mousedown closes the popup', () => {
    const onSelect = vi.fn();
    popup.show({ source: '국', candidates, rect: baseRect, onSelect });
    const md = new MouseEvent('mousedown', { bubbles: true });
    document.body.dispatchEvent(md);
    expect(popup.popup.style.display).toBe('none');
    expect(onSelect).toHaveBeenCalledWith(null, 'cancel');
  });

  it('applyActive() returns picked candidate and hides popup', () => {
    const onSelect = vi.fn();
    popup.show({ source: '국', candidates, rect: baseRect, onSelect });
    const picked = popup.applyActive();
    expect(picked).toEqual(candidates[0]);
    expect(popup.visible).toBe(false);
  });

  it('showHanjaPopup helper reuses a singleton instance', () => {
    const onSelect = vi.fn();
    const a = showHanjaPopup({ source: '국', candidates, rect: baseRect, onSelect });
    const b = showHanjaPopup({ source: '학', candidates, rect: baseRect, onSelect });
    expect(a).toBe(b);
    a.destroy();
  });

  it('bindHanjaShortcut triggers handler on F9 and Ctrl+H, returns disposer', () => {
    const handler = vi.fn();
    const off = bindHanjaShortcut(document, handler);
    dispatchKey('F9');
    expect(handler).toHaveBeenCalledTimes(1);
    dispatchKey('h', { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
    off();
    dispatchKey('F9');
    expect(handler).toHaveBeenCalledTimes(2); // not called after dispose
  });
});
