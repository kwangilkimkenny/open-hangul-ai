/**
 * useHotkeys — 글로벌 키 바인딩 훅
 *
 * 표현식: "ctrl+k", "shift+ctrl+p", "meta+s" (mac 자동 변환 — meta/ctrl 통합)
 * input/textarea 포커스 시 기본 무시 (enableInEditable 옵션으로 허용)
 */

import { useEffect, useRef } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

export interface HotkeyOptions {
  enableInEditable?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export type HotkeyMap = Record<string, KeyHandler>;

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function parseHotkey(expr: string): {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
} {
  const parts = expr.toLowerCase().split('+').map(p => p.trim());
  let ctrl = false, shift = false, alt = false, meta = false;
  let key = '';
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control') ctrl = true;
    else if (p === 'shift') shift = true;
    else if (p === 'alt' || p === 'option') alt = true;
    else if (p === 'meta' || p === 'cmd' || p === 'command') meta = true;
    else key = p;
  }
  return { key, ctrl, shift, alt, meta };
}

export function matchHotkey(e: KeyboardEvent, expr: string): boolean {
  const h = parseHotkey(expr);
  const onMac = isMac();
  // ctrl on mac → cmd, for convenience
  const ctrlMatch = onMac
    ? (h.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey)
    : (e.ctrlKey === h.ctrl);
  const metaMatch = onMac
    ? true  // already handled above
    : (e.metaKey === h.meta);

  return (
    e.key.toLowerCase() === h.key &&
    ctrlMatch &&
    e.shiftKey === h.shift &&
    e.altKey === h.alt &&
    metaMatch
  );
}

export function useHotkeys(map: HotkeyMap, options: HotkeyOptions = {}) {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!options.enableInEditable && isEditable(e.target)) return;
      for (const [expr, handler] of Object.entries(mapRef.current)) {
        if (matchHotkey(e, expr)) {
          if (options.preventDefault !== false) e.preventDefault();
          if (options.stopPropagation) e.stopPropagation();
          handler(e);
          return;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options.enableInEditable, options.preventDefault, options.stopPropagation]);
}
