import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpellPopup, showSpellPopup, bindSpellShortcut } from './spell-popup.js';

const baseRect = { left: 50, top: 50, bottom: 70, right: 120, width: 70, height: 20 };

const baseIssue = {
  ruleId: 'sp-doeda',
  start: 0,
  end: 2,
  text: '됬다',
  replacement: '됐다',
  severity: 'error',
  category: 'spelling',
  hint: "'됬다'는 잘못된 표기입니다.",
};

function dispatchKey(key, opts = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  document.dispatchEvent(ev);
  return ev;
}

describe('SpellPopup', () => {
  let popup;

  beforeEach(() => {
    document.body.innerHTML = '';
    popup = new SpellPopup();
  });

  afterEach(() => {
    if (popup) popup.destroy();
  });

  it('creates a hidden popup element on construction', () => {
    const el = document.querySelector('.spell-popup');
    expect(el).not.toBeNull();
    expect(el.style.display).toBe('none');
  });

  it('show() renders header, hint, and 4 actions', () => {
    popup.show({ issue: baseIssue, rect: baseRect, onSelect: vi.fn() });
    expect(popup.popup.style.display).toBe('block');
    expect(popup.popup.textContent).toContain('됬다');
    expect(popup.popup.textContent).toContain('됐다');
    expect(popup.popup.textContent).toContain('잘못된');
    const actions = popup.popup.querySelectorAll('.spell-popup__action');
    expect(actions.length).toBe(4);
    expect(actions[0].classList.contains('spell-popup__action--active')).toBe(true);
  });

  it('Enter applies the active action (apply) and calls onSelect', () => {
    const onSelect = vi.fn();
    popup.show({ issue: baseIssue, rect: baseRect, onSelect });
    dispatchKey('Enter');
    expect(onSelect).toHaveBeenCalledTimes(1);
    const [action, issue] = onSelect.mock.calls[0];
    expect(action).toBe('apply');
    expect(issue).toEqual(baseIssue);
    expect(popup.popup.style.display).toBe('none');
  });

  it('Escape cancels and yields null issue', () => {
    const onSelect = vi.fn();
    popup.show({ issue: baseIssue, rect: baseRect, onSelect });
    dispatchKey('Escape');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe('cancel');
    expect(onSelect.mock.calls[0][1]).toBeNull();
  });

  it('ArrowDown / ArrowUp move active action', () => {
    popup.show({ issue: baseIssue, rect: baseRect, onSelect: vi.fn() });
    expect(popup.activeIndex).toBe(0);
    dispatchKey('ArrowDown');
    expect(popup.activeIndex).toBe(1);
    dispatchKey('ArrowDown');
    expect(popup.activeIndex).toBe(2);
    dispatchKey('ArrowUp');
    expect(popup.activeIndex).toBe(1);
  });

  it('shortcut I triggers ignore action immediately', () => {
    const onSelect = vi.fn();
    popup.show({ issue: baseIssue, rect: baseRect, onSelect });
    dispatchKey('I');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe('ignore');
  });

  it('shortcut A triggers add-to-dict action immediately', () => {
    const onSelect = vi.fn();
    popup.show({ issue: baseIssue, rect: baseRect, onSelect });
    dispatchKey('A');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe('add-to-dict');
  });

  it('outside mousedown cancels the popup', () => {
    const onSelect = vi.fn();
    popup.show({ issue: baseIssue, rect: baseRect, onSelect });
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('cancel', null);
    expect(popup.popup.style.display).toBe('none');
  });

  it('showSpellPopup helper reuses a singleton', () => {
    const a = showSpellPopup({ issue: baseIssue, rect: baseRect, onSelect: vi.fn() });
    const b = showSpellPopup({ issue: baseIssue, rect: baseRect, onSelect: vi.fn() });
    expect(a).toBe(b);
    a.destroy();
  });
});

describe('bindSpellShortcut', () => {
  it('fires handler on F7', () => {
    const handler = vi.fn();
    const off = bindSpellShortcut(document, handler);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F7' }));
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F7' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
