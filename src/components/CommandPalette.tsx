/**
 * CommandPalette — Ctrl+K 커맨드 팔레트
 *
 * Raycast·Linear 스타일. 프롬프트 입력 → AI 생성 / 참조 문서 관리 / Diff·OCR 실행.
 * v5 의 편집 UI 를 대체하는 유일한 상호작용 창.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from '../hooks/useHotkeys';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  group?: string;
  icon?: string;
  action: () => void | Promise<void>;
  keywords?: string[];
}

interface Props {
  commands: CommandItem[];
  placeholder?: string;
  onAIPrompt?: (prompt: string) => void | Promise<void>;
}

export default function CommandPalette({
  commands,
  placeholder = '명령을 입력하거나 AI 에게 요청 (예: "2026년 사업계획 보고서 작성")',
  onAIPrompt,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useHotkeys({
    'ctrl+k': () => setOpen(v => !v),
    'meta+k': () => setOpen(v => !v),
    'escape': () => setOpen(false),
  });

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => {
      const hay = [c.label, c.description ?? '', c.group ?? '', ...(c.keywords ?? [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [query, commands]);

  const isAIPromptMode = query.length > 15 && filtered.length === 0;

  async function execute(cmd: CommandItem) {
    setOpen(false);
    await cmd.action();
  }

  async function executeAIPrompt() {
    if (!onAIPrompt || !query.trim()) return;
    const prompt = query;
    setOpen(false);
    await onAIPrompt(prompt);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex(i => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isAIPromptMode) {
        executeAIPrompt();
      } else if (filtered[index]) {
        execute(filtered[index]);
      }
    }
  }

  if (!open) return null;

  const groups = filtered.reduce<Record<string, CommandItem[]>>((acc, c) => {
    const g = c.group ?? '기본';
    (acc[g] ??= []).push(c);
    return acc;
  }, {});

  let visibleIdx = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(640px, 92vw)',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setIndex(0); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            border: 'none',
            padding: '16px 20px',
            fontSize: 16,
            outline: 'none',
            borderBottom: '1px solid #e5e7eb',
          }}
        />

        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {isAIPromptMode && onAIPrompt && (
            <div
              onClick={executeAIPrompt}
              style={{
                padding: 14,
                cursor: 'pointer',
                background: '#eff6ff',
                borderLeft: '3px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 24 }}>✨</span>
              <div>
                <div style={{ fontWeight: 600, color: '#1e40af' }}>AI 로 초안 생성</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>"{query.slice(0, 60)}{query.length > 60 ? '...' : ''}"</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>Enter ⏎</span>
            </div>
          )}

          {!isAIPromptMode && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              일치하는 명령 없음 — 더 길게 입력하면 AI 에게 요청합니다.
            </div>
          )}

          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div style={{ padding: '8px 20px 4px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {group}
              </div>
              {items.map(cmd => {
                const myIdx = visibleIdx++;
                const active = myIdx === index;
                return (
                  <div
                    key={cmd.id}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setIndex(myIdx)}
                    style={{
                      padding: '10px 20px',
                      cursor: 'pointer',
                      background: active ? '#f3f4f6' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {cmd.icon && <span style={{ fontSize: 18, width: 24 }}>{cmd.icon}</span>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#111827' }}>{cmd.label}</div>
                      {cmd.description && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{cmd.description}</div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        fontFamily: 'monospace',
                      }}>{cmd.shortcut}</kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #e5e7eb',
          fontSize: 11,
          color: '#9ca3af',
          display: 'flex',
          gap: 16,
        }}>
          <span>↑↓ 이동</span>
          <span>⏎ 실행</span>
          <span>ESC 닫기</span>
        </div>
      </div>
    </div>
  );
}
