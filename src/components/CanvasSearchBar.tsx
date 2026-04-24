/**
 * CanvasSearchBar
 *
 * canvas-editor 가 마운트된 상태에서 사용하는 가벼운 찾기/치환 바.
 * Ctrl+F / Ctrl+H 또는 툴바의 "찾기"·"바꾸기" 버튼으로 열린다.
 *
 * 활성 매치 정보는 canvas-editor 의 `getSearchNavigateInfo()` 로 가져온다.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { HWPXViewerInstance } from '../types/viewer';

interface Props {
  viewer?: HWPXViewerInstance | null;
}

type Mode = 'find' | 'replace';

interface NavigateInfo {
  index: number;
  count: number;
}

interface CanvasEditorAdapter {
  commands?: {
    search?: (query: string) => void;
    replace?: (newText: string, options?: { all?: boolean }) => void;
    clearSearch?: () => void;
  };
  editor?: {
    command?: {
      getSearchNavigateInfo?: () => NavigateInfo;
      executeSearchNavigatePre?: () => void;
      executeSearchNavigateNext?: () => void;
    };
  };
}

export function CanvasSearchBar({ viewer }: Props) {
  const v = viewer as { canvasEditor?: CanvasEditorAdapter } | null;
  const adapter = v?.canvasEditor;
  const cmd = adapter?.commands;
  const editor = adapter?.editor;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('find');
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [info, setInfo] = useState<NavigateInfo>({ index: 0, count: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refreshInfo = useCallback(() => {
    const raw = editor?.command?.getSearchNavigateInfo?.();
    if (raw && typeof raw.index === 'number' && typeof raw.count === 'number') {
      setInfo({ index: raw.index, count: raw.count });
    } else {
      setInfo({ index: 0, count: 0 });
    }
  }, [editor]);

  const runSearch = useCallback(
    (value: string) => {
      if (!cmd) return;
      cmd.find(value || null);
      // canvas-editor 는 search 결과 갱신이 비동기 렌더 후 반영되므로 다음 tick 에 읽는다
      setTimeout(refreshInfo, 0);
    },
    [cmd, refreshInfo]
  );

  // 외부에서 여는 진입점: searchDialog.show() 가 canvas 모드일 때 이 바를 띄우도록 가로채기
  useEffect(() => {
    if (!v) return;
    const original = v.searchDialog?.show?.bind(v.searchDialog);
    if (!v.searchDialog) {
      v.searchDialog = {};
    }
    v.searchDialog.show = (m?: Mode) => {
      if (v.canvasEditor) {
        setMode(m === 'replace' ? 'replace' : 'find');
        setOpen(true);
        return;
      }
      original?.(m);
    };
    return () => {
      if (v.searchDialog && original) v.searchDialog.show = original;
    };
  }, [v]);

  // 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!v?.canvasEditor) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          close();
        }
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setMode('find');
        setOpen(true);
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setMode('replace');
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      if (query) runSearch(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    cmd?.clearSearch?.();
  };

  const onQueryChange = (next: string) => {
    setQuery(next);
    runSearch(next);
  };

  const next = () => {
    cmd?.findNext?.();
    setTimeout(refreshInfo, 0);
  };
  const prev = () => {
    cmd?.findPrevious?.();
    setTimeout(refreshInfo, 0);
  };
  const doReplace = () => {
    if (!query) return;
    cmd?.replace?.(replaceText);
    setTimeout(() => {
      runSearch(query);
      refreshInfo();
    }, 0);
  };
  const doReplaceAll = () => {
    if (!query) return;
    cmd?.replaceAll?.(query, replaceText);
    setTimeout(() => {
      runSearch(query);
      refreshInfo();
    }, 0);
  };

  if (!open || !v?.canvasEditor) return null;

  return (
    <div
      role="dialog"
      aria-label={mode === 'replace' ? '찾아 바꾸기' : '찾기'}
      style={{
        position: 'absolute',
        top: 8,
        right: 16,
        zIndex: 1000,
        background: 'var(--surface, #fff)',
        border: '1px solid var(--border, #d0d0d0)',
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 320,
        font: '13px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) prev();
              else next();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
          placeholder="찾을 문자열"
          style={{ flex: 1, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <span style={{ minWidth: 56, textAlign: 'center', color: '#666', fontSize: 12 }}>
          {info.count > 0 ? `${info.index}/${info.count}` : '-'}
        </span>
        <button onClick={prev} title="이전 (Shift+Enter)" style={btn}>
          ‹
        </button>
        <button onClick={next} title="다음 (Enter)" style={btn}>
          ›
        </button>
        <button
          onClick={() => setMode(mode === 'find' ? 'replace' : 'find')}
          title="치환 토글"
          style={btn}
        >
          {mode === 'replace' ? '−' : '+'}
        </button>
        <button onClick={close} title="닫기 (Esc)" style={btn}>
          ✕
        </button>
      </div>
      {mode === 'replace' && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="text"
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                doReplace();
              }
            }}
            placeholder="바꿀 문자열"
            style={{ flex: 1, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }}
          />
          <button onClick={doReplace} style={btnPrimary} disabled={!query}>
            바꾸기
          </button>
          <button onClick={doReplaceAll} style={btnPrimary} disabled={!query}>
            모두 바꾸기
          </button>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  width: 28,
  height: 26,
  padding: 0,
  border: '1px solid #ccc',
  background: '#f7f7f7',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
};
const btnPrimary: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #2b579a',
  background: '#2b579a',
  color: '#fff',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

export default CanvasSearchBar;
