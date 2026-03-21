/**
 * Hangul-Style Toolbar
 * 한글과컴퓨터 한글의 메뉴바 + 리본 도구모음 재현
 *
 * Layout:
 *   [메뉴바] 파일 | 편집 | 보기 | 삽입 | 서식 | 도구
 *   [리본탭] 홈 | 삽입 | 서식 | 도구 | 보기 | AI
 *   [리본패널] 글꼴그룹 | 단락그룹 | 편집그룹 | ...
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import type { HWPXViewerInstance } from '../types/viewer';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Types
// ============================================================================

interface HangulStyleToolbarProps {
  viewer?: HWPXViewerInstance | null;
  onFileSelect?: (file: File) => void;
  onToggleAI?: () => void;
  showAIPanel?: boolean;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  children?: MenuItem[];
}

type RibbonTab = 'home' | 'insert' | 'format' | 'tools' | 'view' | 'ai';

// ============================================================================
// MenuBar
// ============================================================================

function MenuBar({ viewer, onFileSelect }: { viewer?: HWPXViewerInstance | null; onFileSelect?: (file: File) => void }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileOpen = useCallback(() => {
    fileInputRef.current?.click();
    setActiveMenu(null);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.hwpx')) {
        toast.error('HWPX 파일만 지원됩니다');
        return;
      }
      onFileSelect?.(file);
    }
    e.target.value = '';
  }, [onFileSelect]);

  const handleSave = useCallback(async () => {
    setActiveMenu(null);
    if (viewer && typeof (viewer as any).saveFile === 'function') {
      try {
        toast.loading('저장 중...', { id: 'saving' });
        await (viewer as any).saveFile();
        toast.dismiss('saving');
        toast.success('저장 완료');
      } catch (err: any) {
        toast.dismiss('saving');
        toast.error(`저장 실패: ${err?.message}`);
      }
    } else {
      toast.error('저장할 문서가 없습니다');
    }
  }, [viewer]);

  const handlePrint = useCallback(() => {
    setActiveMenu(null);
    if (viewer && (viewer as any).printDocument) {
      (viewer as any).printDocument();
    } else {
      window.print();
    }
  }, [viewer]);

  const menus: Record<string, MenuItem[]> = {
    '파일(F)': [
      { label: '열기', shortcut: 'Ctrl+O', action: handleFileOpen },
      { label: '저장', shortcut: 'Ctrl+S', action: handleSave },
      { label: '다른 이름으로 저장', shortcut: 'Ctrl+Shift+S', action: handleSave },
      { label: '', divider: true },
      { label: '인쇄', shortcut: 'Ctrl+P', action: handlePrint },
      { label: '', divider: true },
      { label: '문서 정보', action: () => { setActiveMenu(null); toast('문서 정보'); } },
    ],
    '편집(E)': [
      { label: '실행 취소', shortcut: 'Ctrl+Z', action: () => { setActiveMenu(null); (viewer as any)?.historyManager?.undo(); } },
      { label: '다시 실행', shortcut: 'Ctrl+Y', action: () => { setActiveMenu(null); (viewer as any)?.historyManager?.redo(); } },
      { label: '', divider: true },
      { label: '잘라내기', shortcut: 'Ctrl+X', action: () => { setActiveMenu(null); document.execCommand('cut'); } },
      { label: '복사', shortcut: 'Ctrl+C', action: () => { setActiveMenu(null); document.execCommand('copy'); } },
      { label: '붙여넣기', shortcut: 'Ctrl+V', action: () => { setActiveMenu(null); document.execCommand('paste'); } },
      { label: '', divider: true },
      { label: '찾기', shortcut: 'Ctrl+F', action: () => { setActiveMenu(null); (viewer as any)?.searchDialog?.open(); } },
      { label: '찾아 바꾸기', shortcut: 'Ctrl+H', action: () => { setActiveMenu(null); (viewer as any)?.searchDialog?.openReplace?.(); } },
    ],
    '보기(V)': [
      { label: '확대', shortcut: 'Ctrl++', action: () => setActiveMenu(null) },
      { label: '축소', shortcut: 'Ctrl+-', action: () => setActiveMenu(null) },
      { label: '100%', shortcut: 'Ctrl+0', action: () => setActiveMenu(null) },
      { label: '', divider: true },
      { label: '편집 모드 전환', action: () => { setActiveMenu(null); (viewer as any)?.editModeManager?.toggle?.(); } },
    ],
    '삽입(I)': [
      { label: '표 삽입 (3x3)', action: () => { setActiveMenu(null); (viewer as any)?.commandAdapt?.executeInsertTable(3, 3); } },
      { label: '그림 삽입', action: () => {
        setActiveMenu(null);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (ev: any) => {
          const file = ev.target?.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            await (viewer as any)?.commandAdapt?.executeInsertImage(url, { width: 300 });
          }
        };
        input.click();
      }},
      { label: '특수 문자', shortcut: 'Ctrl+F10', action: () => { setActiveMenu(null); (viewer as any)?.specialCharPicker?.open?.(); } },
      { label: '', divider: true },
      { label: '글머리 기호', action: () => { setActiveMenu(null); (viewer as any)?.command?.bulletList('bullet'); } },
      { label: '번호 매기기', action: () => { setActiveMenu(null); (viewer as any)?.command?.numberedList('decimal'); } },
      { label: '목록 제거', action: () => { setActiveMenu(null); (viewer as any)?.command?.removeList?.(); } },
    ],
    '서식(O)': [
      { label: '굵게', shortcut: 'Ctrl+B', action: () => { setActiveMenu(null); (viewer as any)?.command?.bold(); } },
      { label: '기울임', shortcut: 'Ctrl+I', action: () => { setActiveMenu(null); (viewer as any)?.command?.italic(); } },
      { label: '밑줄', shortcut: 'Ctrl+U', action: () => { setActiveMenu(null); (viewer as any)?.command?.underline(); } },
      { label: '취소선', action: () => { setActiveMenu(null); (viewer as any)?.command?.strikethrough(); } },
      { label: '', divider: true },
      { label: '왼쪽 정렬', action: () => { setActiveMenu(null); (viewer as any)?.command?.alignLeft(); } },
      { label: '가운데 정렬', action: () => { setActiveMenu(null); (viewer as any)?.command?.alignCenter(); } },
      { label: '오른쪽 정렬', action: () => { setActiveMenu(null); (viewer as any)?.command?.alignRight(); } },
      { label: '양쪽 정렬', action: () => { setActiveMenu(null); (viewer as any)?.command?.alignJustify(); } },
      { label: '', divider: true },
      { label: '줄 간격 160%', action: () => { setActiveMenu(null); (viewer as any)?.commandAdapt?.executeLineSpacing(1.6); } },
      { label: '줄 간격 200%', action: () => { setActiveMenu(null); (viewer as any)?.commandAdapt?.executeLineSpacing(2.0); } },
    ],
    '도구(T)': [
      { label: '찾아 바꾸기', shortcut: 'Ctrl+H', action: () => { setActiveMenu(null); (viewer as any)?.searchDialog?.openReplace?.(); } },
      { label: '', divider: true },
      { label: '편집 모드 전환', shortcut: 'Ctrl+E', action: () => { setActiveMenu(null); (viewer as any)?.editModeManager?.toggleGlobalEditMode?.(); } },
      { label: '문서 검증', action: () => setActiveMenu(null) },
    ],
  };

  return (
    <div ref={menuRef} className="hwp-menubar">
      <input ref={fileInputRef} type="file" accept=".hwpx" onChange={handleFileChange} style={{ display: 'none' }} />
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="hwp-menu-item-wrapper">
          <button
            className={`hwp-menu-trigger ${activeMenu === name ? 'active' : ''}`}
            onClick={() => setActiveMenu(activeMenu === name ? null : name)}
            onMouseEnter={() => { if (activeMenu) setActiveMenu(name); }}
          >
            {name}
          </button>
          {activeMenu === name && (
            <div className="hwp-menu-dropdown">
              {items.map((item, idx) =>
                item.divider ? (
                  <div key={idx} className="hwp-menu-divider" />
                ) : (
                  <button
                    key={idx}
                    className={`hwp-menu-option ${item.disabled ? 'disabled' : ''}`}
                    onClick={() => item.action?.()}
                    disabled={item.disabled}
                  >
                    <span className="hwp-menu-label">{item.label}</span>
                    {item.shortcut && <span className="hwp-menu-shortcut">{item.shortcut}</span>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - Home
// ============================================================================

function RibbonHome({ viewer }: { viewer?: HWPXViewerInstance | null }) {
  const v = viewer as any;
  const cmd = v?.command;
  const [textColor, setTextColor] = useState('#000000');
  const [highlightColor, setHighlightColor] = useState('#ffff00');

  // Font family change via command API
  const handleFontChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (cmd?.setFontFamily) cmd.setFontFamily(e.target.value);
    else if (v?.textFormatter) document.execCommand('fontName', false, e.target.value);
  }, [cmd, v]);

  // Font size change via command API
  const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = parseInt(e.target.value);
    if (cmd?.setFontSize) cmd.setFontSize(size);
  }, [cmd]);

  // Format toggle via command API (with textFormatter fallback)
  const execFormat = useCallback((format: string) => {
    if (cmd) {
      if (format === 'bold') cmd.bold();
      else if (format === 'italic') cmd.italic();
      else if (format === 'underline') cmd.underline();
      else if (format === 'strikethrough') cmd.strikethrough();
    } else if (v?.textFormatter) {
      if (format === 'bold') v.textFormatter.toggleBold();
      else if (format === 'italic') v.textFormatter.toggleItalic();
      else if (format === 'underline') v.textFormatter.toggleUnderline();
      else if (format === 'strikethrough') v.textFormatter.toggleStrikethrough?.();
    }
  }, [cmd, v]);

  // Alignment via command API
  const execAlign = useCallback((align: string) => {
    if (cmd) {
      if (align === 'left') cmd.alignLeft();
      else if (align === 'center') cmd.alignCenter();
      else if (align === 'right') cmd.alignRight();
      else if (align === 'justify') cmd.alignJustify();
    }
  }, [cmd]);

  // Line spacing via command API
  const handleLineSpacing = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value) / 100;
    if (cmd?.lineSpacing) cmd.lineSpacing(value);
    else if (v?.commandAdapt) v.commandAdapt.executeLineSpacing(value);
  }, [cmd, v]);

  // Indent via command API
  const handleIndent = useCallback((delta: number) => {
    if (delta > 0) { if (cmd?.increaseIndent) cmd.increaseIndent(); else v?.commandAdapt?.executeIncreaseIndent(); }
    else { if (cmd?.decreaseIndent) cmd.decreaseIndent(); else v?.commandAdapt?.executeDecreaseIndent(); }
  }, [cmd, v]);

  // Text color via command API
  const handleTextColor = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setTextColor(color);
    if (cmd?.color) cmd.color(color);
    else if (v?.commandAdapt) v.commandAdapt.executeColor(color);
  }, [cmd, v]);

  // Highlight via command API
  const handleHighlight = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setHighlightColor(color);
    if (cmd?.highlight) cmd.highlight(color);
    else if (v?.commandAdapt) v.commandAdapt.executeHighlight(color);
  }, [cmd, v]);

  return (
    <div className="hwp-ribbon-panel">
      {/* Font Group */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <select className="hwp-font-select" defaultValue="Malgun Gothic" title="글꼴" onChange={handleFontChange}>
            <option value="Malgun Gothic">맑은 고딕</option>
            <option value="Batang">바탕</option>
            <option value="Dotum">돋움</option>
            <option value="Gulim">굴림</option>
            <option value="NanumGothic">나눔고딕</option>
            <option value="NanumMyeongjo">나눔명조</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
          <select className="hwp-size-select" defaultValue="10" title="글꼴 크기" onChange={handleSizeChange}>
            {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn" onClick={() => execFormat('bold')} title="굵게 (Ctrl+B)"><b>B</b></button>
          <button className="hwp-ribbon-btn" onClick={() => execFormat('italic')} title="기울임 (Ctrl+I)"><i>I</i></button>
          <button className="hwp-ribbon-btn" onClick={() => execFormat('underline')} title="밑줄 (Ctrl+U)"><u>U</u></button>
          <button className="hwp-ribbon-btn" onClick={() => execFormat('strikethrough')} title="취소선"><s>S</s></button>
          <span className="hwp-ribbon-sep" />
          <label className="hwp-ribbon-btn hwp-color-btn" title="글자 색">
            <span style={{ borderBottom: `3px solid ${textColor}` }}>A</span>
            <input type="color" value={textColor} onChange={handleTextColor} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          </label>
          <label className="hwp-ribbon-btn hwp-color-btn" title="강조 색">
            <span style={{ background: highlightColor, padding: '0 3px' }}>ab</span>
            <input type="color" value={highlightColor} onChange={handleHighlight} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          </label>
        </div>
        <div className="hwp-ribbon-group-label">글꼴</div>
      </div>

      {/* Paragraph Group */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn" onClick={() => execAlign('left')} title="왼쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M1 5h8M1 8h12M1 11h6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => execAlign('center')} title="가운데 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M3 5h8M1 8h12M4 11h6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => execAlign('right')} title="오른쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M5 5h8M1 8h12M7 11h6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => execAlign('justify')} title="양쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M1 5h12M1 8h12M1 11h12" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
        </div>
        <div className="hwp-ribbon-row">
          <select className="hwp-lineheight-select" defaultValue="160" title="줄 간격" onChange={handleLineSpacing}>
            <option value="100">100%</option>
            <option value="130">130%</option>
            <option value="160">160%</option>
            <option value="200">200%</option>
            <option value="250">250%</option>
            <option value="300">300%</option>
          </select>
          <button className="hwp-ribbon-btn" onClick={() => handleIndent(-1)} title="들여쓰기 감소">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M5 5h8M5 8h8M1 11h12M3 4l-2 2.5L3 9" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => handleIndent(1)} title="들여쓰기 증가">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M5 5h8M5 8h8M1 11h12M1 4l2 2.5L1 9" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">단락</div>
      </div>

      {/* Edit Group */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn" onClick={() => cmd?.undo() ?? v?.historyManager?.undo()} title="실행 취소 (Ctrl+Z)">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 5l-2 2 2 2M1 7h8a3 3 0 0 1 0 6H7" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => cmd?.redo() ?? v?.historyManager?.redo()} title="다시 실행 (Ctrl+Y)">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 5l2 2-2 2M13 7H5a3 3 0 0 0 0 6h2" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
          </button>
        </div>
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn" onClick={() => v?.searchDialog?.open()} title="찾기 (Ctrl+F)">
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => v?.clipboardManager?.copyFormat?.()} title="서식 복사 (Alt+C)">
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="3" y="1" width="8" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5 4h4M5 7h4M5 10h2" stroke="currentColor" strokeWidth="1"/></svg>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">편집</div>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - Insert (placeholder)
// ============================================================================

function RibbonInsert({ viewer }: { viewer?: HWPXViewerInstance | null }) {
  const v = viewer as any;

  const handleInsertTable = useCallback(() => {
    v?.commandAdapt?.executeInsertTable(3, 3);
  }, [v]);

  const handleInsertImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (ev: any) => {
      const file = ev.target?.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        await v?.commandAdapt?.executeInsertImage(url, { width: 300 });
      }
    };
    input.click();
  }, [v]);

  const handleBulletList = useCallback(() => { v?.command?.bulletList('bullet'); }, [v]);
  const handleNumberedList = useCallback(() => { v?.command?.numberedList('decimal'); }, [v]);

  return (
    <div className="hwp-ribbon-panel">
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={handleInsertTable} title="표 삽입 (3x3)">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="1" y="1" width="18" height="18" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1 7h18M1 13h18M7 1v18M13 1v18" stroke="currentColor" strokeWidth="1"/></svg>
            <span>표</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={handleInsertImage} title="그림 삽입">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="1" y="1" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="7" cy="7" r="2" fill="currentColor"/><path d="M1 15l5-5 3 3 4-4 6 6" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            <span>그림</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.specialCharPicker?.open?.()} title="특수 문자 (Ctrl+F10)">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="5" y="16" fontSize="16" fill="currentColor">&#937;</text></svg>
            <span>특수문자</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">삽입</div>
      </div>

      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={handleBulletList} title="글머리 기호">
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="4" cy="5" r="2" fill="currentColor"/><path d="M9 5h9" stroke="currentColor" strokeWidth="1.5"/><circle cx="4" cy="10" r="2" fill="currentColor"/><path d="M9 10h9" stroke="currentColor" strokeWidth="1.5"/><circle cx="4" cy="15" r="2" fill="currentColor"/><path d="M9 15h9" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>글머리</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={handleNumberedList} title="번호 매기기">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="2" y="7" fontSize="7" fill="currentColor">1.</text><path d="M9 5h9" stroke="currentColor" strokeWidth="1.5"/><text x="2" y="12" fontSize="7" fill="currentColor">2.</text><path d="M9 10h9" stroke="currentColor" strokeWidth="1.5"/><text x="2" y="17" fontSize="7" fill="currentColor">3.</text><path d="M9 15h9" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>번호</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">목록</div>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - AI (unique feature)
// ============================================================================

function RibbonAI({ onToggleAI, showAIPanel }: { onToggleAI?: () => void; showAIPanel?: boolean }) {
  return (
    <div className="hwp-ribbon-panel">
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button
            className={`hwp-ribbon-btn-lg ${showAIPanel ? 'active' : ''}`}
            onClick={onToggleAI}
            title="AI 채팅 패널 열기/닫기"
          >
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M6 11l4 4 4-4" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="7" cy="8" r="1" fill="currentColor"/><circle cx="13" cy="8" r="1" fill="currentColor"/></svg>
            <span>AI 채팅</span>
          </button>
          <button className="hwp-ribbon-btn-lg" title="AI 문서 생성" disabled>
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2l2 5h5l-4 3 1.5 5L10 12l-4.5 3L7 10 3 7h5z" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            <span>AI 생성</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">AI 기능</div>
      </div>
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" title="템플릿 채우기" disabled>
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M6 6h8M6 10h8M6 14h4" stroke="currentColor" strokeWidth="1"/><path d="M14 10l2 2-2 2" stroke="#2b579a" strokeWidth="1.5" fill="none"/></svg>
            <span>템플릿</span>
          </button>
          <button className="hwp-ribbon-btn-lg" title="문서 검증" disabled>
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            <span>검증</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">도구</div>
      </div>
    </div>
  );
}

// ============================================================================
// Simple placeholder tabs
// ============================================================================

function RibbonPlaceholder({ label }: { label: string }) {
  return (
    <div className="hwp-ribbon-panel">
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-placeholder">
          {label} 탭 도구 (준비 중)
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const HangulStyleToolbar = memo(function HangulStyleToolbar({
  viewer,
  onFileSelect,
  onToggleAI,
  showAIPanel,
}: HangulStyleToolbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');

  const tabs: { id: RibbonTab; label: string }[] = [
    { id: 'home', label: '홈' },
    { id: 'insert', label: '삽입' },
    { id: 'format', label: '서식' },
    { id: 'tools', label: '도구' },
    { id: 'view', label: '보기' },
    { id: 'ai', label: 'AI' },
  ];

  const renderTabContent = (): ReactNode => {
    switch (activeTab) {
      case 'home': return <RibbonHome viewer={viewer} />;
      case 'insert': return <RibbonInsert viewer={viewer} />;
      case 'ai': return <RibbonAI onToggleAI={onToggleAI} showAIPanel={showAIPanel} />;
      case 'format': return <RibbonPlaceholder label="서식" />;
      case 'tools': return <RibbonPlaceholder label="도구" />;
      case 'view': return <RibbonPlaceholder label="보기" />;
      default: return null;
    }
  };

  return (
    <div className="hwp-toolbar-root">
      {/* Menu Bar */}
      <MenuBar viewer={viewer} onFileSelect={onFileSelect} />

      {/* Ribbon Tabs */}
      <div className="hwp-ribbon-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`hwp-ribbon-tab ${activeTab === tab.id ? 'active' : ''} ${tab.id === 'ai' ? 'ai-tab' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ribbon Content */}
      <div className="hwp-ribbon-content">
        {renderTabContent()}
      </div>
    </div>
  );
});

export default HangulStyleToolbar;
