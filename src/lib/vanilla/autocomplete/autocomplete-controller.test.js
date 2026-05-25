import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../spell/user-dictionary.js', () => ({
  listAll: vi.fn(() => ({ ignored: [], custom: [] })),
  addWord: vi.fn(),
  ignoreWord: vi.fn(),
  unignoreWord: vi.fn(),
  isIgnored: vi.fn(),
  clearAll: vi.fn(),
}));

import { AutocompleteController, getCaretPrefix, attach } from './autocomplete-controller.js';
import { WordIndex } from './word-index.js';
import * as persistence from './persistence.js';

function mkInput(value = '') {
  const input = document.createElement('input');
  input.value = value;
  document.body.appendChild(input);
  // caret 을 끝에 위치
  try {
    input.setSelectionRange(value.length, value.length);
  } catch (_e) { /* ignore */ }
  return input;
}

describe('autocomplete controller', () => {
  /** @type {WordIndex} */
  let index;
  /** @type {AutocompleteController | null} */
  let ctrl;

  beforeEach(() => {
    document.body.innerHTML = '';
    persistence.setForcedBackend('memory');
    index = new WordIndex({ minLength: 2 });
    index.buildFromDocument('안녕하세요 안녕히가세요 반갑습니다 hello helmet help');
  });

  afterEach(async () => {
    if (ctrl) {
      try { ctrl.detach(); } catch (_e) { /* ignore */ }
    }
    ctrl = null;
    document.body.innerHTML = '';
    await persistence.clear();
    persistence.setForcedBackend(null);
  });

  it('getCaretPrefix extracts the token before caret on input', () => {
    const input = mkInput('안녕 안녕하');
    const ctx = getCaretPrefix(input);
    expect(ctx).not.toBeNull();
    expect(ctx?.prefix).toBe('안녕하');
    expect(ctx?.range.end).toBe(input.value.length);
  });

  it('attach() shows popup after debounce when prefix matches index', async () => {
    const input = mkInput('안녕');
    ctrl = new AutocompleteController({ index, debounceMs: 5, minPrefix: 2 });
    ctrl.attach(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(ctrl.popup.visible).toBe(true);
    const words = ctrl.popup.candidates.map((c) => c.word);
    expect(words).toContain('안녕하세요');
  });

  it('hides popup when prefix shorter than minPrefix', async () => {
    const input = mkInput('안');
    ctrl = new AutocompleteController({ index, debounceMs: 0, minPrefix: 2 });
    ctrl.attach(input);
    ctrl.refresh();
    await new Promise((r) => setTimeout(r, 5));
    expect(ctrl.popup.visible).toBe(false);
  });

  it('compositionstart hides popup, compositionend re-queries', async () => {
    const input = mkInput('안녕');
    ctrl = new AutocompleteController({ index, debounceMs: 0, minPrefix: 2 });
    ctrl.attach(input);
    ctrl.refresh();
    await new Promise((r) => setTimeout(r, 5));
    expect(ctrl.popup.visible).toBe(true);

    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    expect(ctrl.popup.visible).toBe(false);

    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 5));
    expect(ctrl.popup.visible).toBe(true);
  });

  it('applying a candidate replaces the prefix in the input and increments usage', async () => {
    const input = mkInput('안녕');
    const onApply = vi.fn();
    ctrl = new AutocompleteController({ index, debounceMs: 0, minPrefix: 2, onApply });
    ctrl.attach(input);
    ctrl.refresh();
    await new Promise((r) => setTimeout(r, 5));
    expect(ctrl.popup.visible).toBe(true);

    const beforeFreq = index.search('안녕')[0].frequency;
    ctrl.applyWord('안녕하세요');
    expect(input.value).toBe('안녕하세요');
    expect(onApply).toHaveBeenCalledWith('안녕하세요', '안녕');
    const afterFreq = index.trie.getFrequency('안녕하세요');
    expect(afterFreq).toBeGreaterThan(beforeFreq);
  });

  it('attach helper returns a controller and detach disposes listeners', async () => {
    const input = mkInput('hel');
    ctrl = attach(input, { index, debounceMs: 0, minPrefix: 2 });
    expect(ctrl).toBeInstanceOf(AutocompleteController);
    ctrl.refresh();
    await new Promise((r) => setTimeout(r, 5));
    expect(ctrl.popup.visible).toBe(true);
    ctrl.detach();
    expect(ctrl.popup.visible).toBe(false);
    // detach 후엔 input 이벤트가 popup 을 다시 띄우지 않아야 함
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(ctrl.popup.visible).toBe(false);
  });
});
