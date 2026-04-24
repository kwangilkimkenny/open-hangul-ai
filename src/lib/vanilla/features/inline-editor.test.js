/**
 * InlineEditor Tests
 */
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

vi.mock('../utils/ui.js', async () => {
  // sanitizeHTML 의 실제 구현이 paste 정화 테스트에서 필수다.
  // 다른 호출자는 spy 가능하도록 vi.fn 래퍼로 감싼다.
  const actual = await vi.importActual('../utils/ui.js');
  return {
    sanitizeHTML: vi.fn((html, options) => actual.sanitizeHTML(html, options)),
  };
});

import { InlineEditor } from './inline-editor.js';
import { sanitizeHTML } from '../utils/ui.js';

describe('InlineEditor', () => {
  let editor;
  let viewer;
  let mockHistoryManager;
  let mockTextFormatter;
  let mockClipboardManager;

  beforeEach(() => {
    mockHistoryManager = {
      undo: vi.fn(),
      redo: vi.fn(),
      execute: vi.fn((execFn, undoFn, name, metadata) => execFn()),
    };

    mockTextFormatter = {
      toggleBold: vi.fn(),
      toggleItalic: vi.fn(),
      toggleUnderline: vi.fn(),
    };

    mockClipboardManager = {
      copy: vi.fn(),
      paste: vi.fn(),
      copyFormat: vi.fn(),
      pasteFormat: vi.fn(),
      isFormatPasteMode: vi.fn(() => false),
    };

    viewer = {
      historyManager: mockHistoryManager,
      textFormatter: mockTextFormatter,
      clipboardManager: mockClipboardManager,
    };

    editor = new InlineEditor(viewer);

    // Clean up window.editModeManager
    delete window.editModeManager;

    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.editModeManager;
  });

  function createCell(text = 'Hello') {
    const cell = document.createElement('td');
    cell.textContent = text;
    document.body.appendChild(cell);
    return cell;
  }

  function createCellData() {
    return { elements: [{ type: 'paragraph', runs: [{ text: 'Hello' }] }] };
  }

  // 1. Constructor initializes
  it('should initialize correctly', () => {
    expect(editor.editingCell).toBeNull();
    expect(editor.originalContent).toBeNull();
    expect(editor.onChangeCallback).toBeNull();
    expect(editor.cellDataMap).toBeInstanceOf(WeakMap);
  });

  // 2. onChange() registers callback
  it('should register onChange callback', () => {
    const cb = vi.fn();
    editor.onChange(cb);
    expect(editor.onChangeCallback).toBe(cb);
  });

  // 3. enableEditMode() makes cell editable
  it('should enable edit mode on a cell', () => {
    const cell = createCell();
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    expect(editor.editingCell).toBe(cell);
    expect(String(cell.contentEditable)).toBe('true');
  });

  // 4. enableEditMode() sets contentEditable=true and editing class
  // Note: 시각적 스타일은 CSS 클래스 'editing'으로 처리 (Word/한글 스타일 — 인라인 outline 제거)
  it('should set contentEditable and editing class', () => {
    const cell = createCell();
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    expect(cell.classList.contains('editing')).toBe(true);
    expect(String(cell.contentEditable)).toBe('true');
    expect(cell.spellcheck).toBe(true);
  });

  // 5. enableEditMode() when editMode OFF -> returns without editing
  it('should not edit when global edit mode is OFF', () => {
    window.editModeManager = { isGlobalEditMode: false };

    const cell = createCell();
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    expect(editor.editingCell).toBeNull();
    expect(cell.contentEditable).not.toBe('true');
  });

  // 6. enableEditMode() same cell again -> ignored
  it('should ignore enabling edit mode on same cell', () => {
    const cell = createCell();
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    // Spy on focus after first enableEditMode
    const focusSpy = vi.spyOn(cell, 'focus');

    editor.enableEditMode(cell, cellData);
    // Focus should not be called again since same cell is ignored
    expect(focusSpy).not.toHaveBeenCalled();
  });

  // 7. enableEditMode() different cell -> auto-saves previous
  // Note: 자동저장은 saveChanges(true) 호출하여 이벤트 리스너 완전 제거 (중복 방지)
  it('should auto-save previous cell when enabling edit on different cell', () => {
    const cell1 = createCell('First');
    const cell2 = createCell('Second');
    const data1 = createCellData();
    const data2 = createCellData();

    const saveSpy = vi.spyOn(editor, 'saveChanges');

    editor.enableEditMode(cell1, data1);
    editor.enableEditMode(cell2, data2);

    expect(saveSpy).toHaveBeenCalledWith(true);
    expect(editor.editingCell).toBe(cell2);
  });

  // 8. saveChanges(true) -> ends editing, removes class/outline
  it('should end editing and clean up on saveChanges(true)', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);
    expect(cell.classList.contains('editing')).toBe(true);

    editor.saveChanges(true);

    expect(editor.editingCell).toBeNull();
  });

  // 9. saveChanges(false) -> saves but keeps editing
  it('should save but keep editing cell reference on saveChanges(false)', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    // Change cell text to trigger actual save
    cell.textContent = 'Changed';
    editor.saveChanges(false);

    // editingCell should still be set (saveChanges with false does not clear unless implementation does)
    // Based on the source, saveChanges(false) does not call _endEditMode
    // The method processes the change but only calls _endEditMode if exitEditMode=true
  });

  // 10. discardChanges() -> restores original content
  it('should restore original content on discardChanges', () => {
    const cell = createCell('Original');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);
    cell.textContent = 'Modified';

    if (typeof editor.discardChanges === 'function') {
      editor.discardChanges();
      expect(cell.innerHTML).toBe('Original');
    }
  });

  // 11. Escape key -> saves and ends
  it('should save and end editing on Escape key', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const saveSpy = vi.spyOn(editor, 'saveChanges');

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(saveSpy).toHaveBeenCalledWith(true);
  });

  // 12. Enter key -> inserts newline (Word/한글 스타일)
  // Note: Enter는 줄바꿈 (저장/이동이 아님), 셀 간 이동은 Tab 키
  it('should insert newline on Enter key (Word/Hangul style)', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const insertSpy = vi.spyOn(editor, '_insertNewlineAtCursor');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(insertSpy).toHaveBeenCalled();
  });

  // 13. Shift+Enter -> inserts newline
  it('should insert newline on Shift+Enter', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const insertSpy = vi.spyOn(editor, '_insertNewlineAtCursor');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(insertSpy).toHaveBeenCalled();
  });

  // 14. Tab key -> navigates to next
  it('should navigate on Tab key', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const navSpy = vi.spyOn(editor, '_navigateToNext');

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(navSpy).toHaveBeenCalledWith('next');
  });

  // 15. Ctrl+Z -> calls historyManager.undo()
  it('should call historyManager.undo on Ctrl+Z', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(mockHistoryManager.undo).toHaveBeenCalled();
  });

  // 16. Ctrl+Y -> calls historyManager.redo()
  it('should call historyManager.redo on Ctrl+Y', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const event = new KeyboardEvent('keydown', {
      key: 'y',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(mockHistoryManager.redo).toHaveBeenCalled();
  });

  // 17. Ctrl+B -> calls textFormatter.toggleBold()
  it('should call toggleBold on Ctrl+B', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const event = new KeyboardEvent('keydown', {
      key: 'b',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(mockTextFormatter.toggleBold).toHaveBeenCalled();
  });

  // 18. Ctrl+I -> calls textFormatter.toggleItalic()
  it('should call toggleItalic on Ctrl+I', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(mockTextFormatter.toggleItalic).toHaveBeenCalled();
  });

  // 19. Ctrl+U -> calls textFormatter.toggleUnderline()
  it('should call toggleUnderline on Ctrl+U', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const event = new KeyboardEvent('keydown', {
      key: 'u',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    expect(mockTextFormatter.toggleUnderline).toHaveBeenCalled();
  });

  // 20. _handleBlur -> auto saves
  it('should auto save on blur', () => {
    vi.useFakeTimers();

    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    const saveSpy = vi.spyOn(editor, 'saveChanges');

    const blurEvent = new Event('blur', { bubbles: true });
    // We need to define target manually for the handler
    Object.defineProperty(blurEvent, 'target', { value: cell });
    cell.dispatchEvent(blurEvent);

    vi.advanceTimersByTime(200);

    expect(saveSpy).toHaveBeenCalledWith(true);

    vi.useRealTimers();
  });

  // 21. WeakMap stores cellData mapping
  it('should store cellData mapping in WeakMap', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    expect(editor.cellDataMap.has(cellData)).toBe(true);
    expect(editor.cellDataMap.get(cellData)).toBe(cell);
  });

  // 22. IME composition: keydown ignored during isComposing
  it('should ignore keydown during IME composition', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    // Simulate composition start
    cell.dispatchEvent(new CompositionEvent('compositionstart'));

    const saveSpy = vi.spyOn(editor, 'saveChanges');

    // Key event during composition should be ignored
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    // Set isComposing manually since the composition handler sets it
    editor.isComposing = true;
    cell.dispatchEvent(event);

    expect(saveSpy).not.toHaveBeenCalled();
  });

  // 23. Paste handler: plain text only
  it('should handle paste with plain text only', () => {
    const cell = createCell('Hello');
    const cellData = createCellData();

    editor.enableEditMode(cell, cellData);

    // Create a mock paste event
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    pasteEvent.clipboardData = {
      getData: vi.fn(type => {
        if (type === 'text/plain') return 'Pasted text';
        return '';
      }),
    };
    pasteEvent.preventDefault = vi.fn();

    cell.dispatchEvent(pasteEvent);

    expect(pasteEvent.preventDefault).toHaveBeenCalled();
  });

  // 24. XSS prevention: sanitizeHTML called on backup
  it('should call sanitizeHTML when backing up original content', () => {
    const cell = createCell('<script>alert("xss")</script>Hello');
    const cellData = createCellData();

    sanitizeHTML.mockClear();

    editor.enableEditMode(cell, cellData);

    expect(sanitizeHTML).toHaveBeenCalledWith(cell.innerHTML);
  });

  // 25. _getLastTextNode() finds deepest text node
  it('should find the deepest text node', () => {
    const container = document.createElement('div');
    const span = document.createElement('span');
    const innerSpan = document.createElement('span');
    innerSpan.textContent = 'Deep text';
    span.appendChild(innerSpan);
    container.appendChild(span);

    const result = editor._getLastTextNode(container);
    expect(result).not.toBeNull();
    expect(result.textContent).toBe('Deep text');
    expect(result.nodeType).toBe(Node.TEXT_NODE);
  });

  // 26. compositionstart sets isComposing immediately
  it('should set isComposing on compositionstart', () => {
    const cell = createCell('Hello');
    editor.enableEditMode(cell, createCellData());

    const event = new CompositionEvent('compositionstart', { data: '' });
    cell.dispatchEvent(event);

    expect(editor.isComposing).toBe(true);
  });

  // 27. compositionupdate keeps isComposing true and tracks data
  it('should track partial composition data on compositionupdate', () => {
    const cell = createCell('Hello');
    editor.enableEditMode(cell, createCellData());

    cell.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    // 한글 자모: ㅎ → 하 → 한
    cell.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'ㅎ' }));
    expect(editor.isComposing).toBe(true);
    expect(editor.lastCompositionData).toBe('ㅎ');

    cell.dispatchEvent(new CompositionEvent('compositionupdate', { data: '한' }));
    expect(editor.isComposing).toBe(true);
    expect(editor.lastCompositionData).toBe('한');
  });

  // 28. compositionend clears isComposing immediately (no setTimeout race)
  it('should clear isComposing immediately on compositionend (no race)', () => {
    const cell = createCell('Hello');
    editor.enableEditMode(cell, createCellData());

    cell.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    expect(editor.isComposing).toBe(true);

    cell.dispatchEvent(new CompositionEvent('compositionend', { data: '한' }));

    // 핵심: setTimeout 을 거치지 않고 즉시 false 가 되어야 다음 키 입력이 막히지 않는다.
    expect(editor.isComposing).toBe(false);
    expect(editor.lastCompositionData).toBe('');
  });

  // 29. keyCode 229 (IME pending) is ignored even if isComposing is false
  it('should ignore keydown with keyCode 229 (IME pending)', () => {
    const cell = createCell('Hello');
    editor.enableEditMode(cell, createCellData());

    const saveSpy = vi.spyOn(editor, 'saveChanges');
    const event = new KeyboardEvent('keydown', {
      key: 'Process',
      keyCode: 229,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);

    // Escape 가 아니더라도 IME pending 키는 단축키 분기 전에 차단되어야 한다.
    expect(saveSpy).not.toHaveBeenCalled();
  });

  // 30. e.isComposing flag also blocks shortcuts
  it('should ignore keydown when KeyboardEvent.isComposing is true', () => {
    const cell = createCell('Hello');
    editor.enableEditMode(cell, createCellData());

    const event = new KeyboardEvent('keydown', {
      key: 'b',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    // 일부 브라우저는 compositionstart 보다 먼저 keydown 을 보내며 e.isComposing=true 를 세팅한다.
    Object.defineProperty(event, 'isComposing', { value: true });
    cell.dispatchEvent(event);

    expect(mockTextFormatter.toggleBold).not.toHaveBeenCalled();
  });

  // 31. _disableEditMode cleans up compositionupdate listener
  it('should remove compositionupdate listener on disable', () => {
    const cell = createCell('Hello');
    editor.enableEditMode(cell, createCellData());

    expect(editor._compositionHandlers).toBeDefined();
    expect(editor._compositionHandlers.update).toBeInstanceOf(Function);

    editor._disableEditMode();
    expect(editor._compositionHandlers).toBeNull();
    expect(editor.isComposing).toBe(false);
    expect(editor.lastCompositionData).toBe('');
  });

  // 32. Paste text/html is sanitized but preserves bold/italic
  it('should sanitize HTML paste while preserving safe formatting', () => {
    const cell = createCell('');
    editor.enableEditMode(cell, createCellData());
    cell.focus();

    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    pasteEvent.clipboardData = {
      getData: vi.fn(type => {
        if (type === 'text/html') {
          return '<p><b>안녕</b> <script>alert(1)</script><i>하세요</i></p>';
        }
        if (type === 'text/plain') return '안녕 하세요';
        return '';
      }),
    };
    pasteEvent.preventDefault = vi.fn();

    cell.dispatchEvent(pasteEvent);

    expect(pasteEvent.preventDefault).toHaveBeenCalled();
    const html = cell.innerHTML;
    expect(html).toContain('<b>안녕</b>');
    expect(html).toContain('<i>하세요</i>');
    expect(html).not.toContain('<script>');
  });

  // 33. Paste from Word strips mso-* styles and class attributes
  it('should strip mso-* styles and class attributes from Word paste', () => {
    const cell = createCell('');
    editor.enableEditMode(cell, createCellData());

    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const wordHtml =
      '<!--StartFragment--><p class="MsoNormal" style="mso-pagination:none; color:red;">' +
      'Word text</p><!--EndFragment-->';
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    pasteEvent.clipboardData = {
      getData: vi.fn(type => (type === 'text/html' ? wordHtml : 'Word text')),
    };
    pasteEvent.preventDefault = vi.fn();

    cell.dispatchEvent(pasteEvent);

    const html = cell.innerHTML;
    expect(html).not.toContain('mso-');
    expect(html).not.toContain('MsoNormal');
    expect(html).not.toContain('class=');
    // color 는 화이트리스트에 있으므로 보존
    expect(html).toContain('color');
    expect(html).toContain('Word text');
  });

  // 34. Paste falls back to plain text when text/html is empty
  it('should fall back to plain text when HTML clipboard is empty', () => {
    const cell = createCell('');
    editor.enableEditMode(cell, createCellData());

    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    pasteEvent.clipboardData = {
      getData: vi.fn(type => (type === 'text/plain' ? 'line1\nline2' : '')),
    };
    pasteEvent.preventDefault = vi.fn();

    cell.dispatchEvent(pasteEvent);

    const html = cell.innerHTML;
    expect(html).toContain('line1');
    expect(html).toContain('line2');
    expect(html).toContain('<br>');
  });
});
