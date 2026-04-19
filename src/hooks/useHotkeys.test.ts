import { describe, it, expect } from 'vitest';
import { parseHotkey, matchHotkey } from './useHotkeys';

function fakeKey(key: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }> = {}) {
  return {
    key,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
    metaKey: mods.meta ?? false,
  } as KeyboardEvent;
}

describe('parseHotkey', () => {
  it('단일 키', () => {
    expect(parseHotkey('k')).toMatchObject({ key: 'k', ctrl: false });
  });

  it('ctrl+k', () => {
    expect(parseHotkey('ctrl+k')).toMatchObject({ key: 'k', ctrl: true });
  });

  it('shift+ctrl+p', () => {
    const h = parseHotkey('shift+ctrl+p');
    expect(h.shift).toBe(true);
    expect(h.ctrl).toBe(true);
    expect(h.key).toBe('p');
  });

  it('meta/cmd alias', () => {
    expect(parseHotkey('cmd+s').meta).toBe(true);
    expect(parseHotkey('meta+s').meta).toBe(true);
  });

  it('대소문자 무관', () => {
    expect(parseHotkey('CTRL+K').key).toBe('k');
  });
});

describe('matchHotkey', () => {
  it('정확히 일치', () => {
    expect(matchHotkey(fakeKey('k', { ctrl: true }), 'ctrl+k')).toBe(true);
  });

  it('다른 키 — 불일치', () => {
    expect(matchHotkey(fakeKey('j', { ctrl: true }), 'ctrl+k')).toBe(false);
  });

  it('수정자 빠짐 — 불일치', () => {
    expect(matchHotkey(fakeKey('k'), 'ctrl+k')).toBe(false);
  });

  it('추가 수정자 — 불일치', () => {
    expect(matchHotkey(fakeKey('k', { ctrl: true, shift: true }), 'ctrl+k')).toBe(false);
  });

  it('escape', () => {
    expect(matchHotkey(fakeKey('Escape'), 'escape')).toBe(true);
  });
});
