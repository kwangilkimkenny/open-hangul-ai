/**
 * ClipboardManager Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

import { ClipboardManager } from './clipboard-manager.js';

describe('ClipboardManager', () => {
  let clipboardManager;
  let viewer;

  beforeEach(() => {
    viewer = {
      inlineEditor: {
        editingCell: null,
        onChangeCallback: null,
      },
    };

    clipboardManager = new ClipboardManager(viewer);

    document.body.innerHTML = '';

    // Mock document.execCommand (not available in jsdom)
    if (!document.execCommand) {
      document.execCommand = vi.fn(() => true);
    }

    // Mock window.getSelection
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 0,
      isCollapsed: true,
      toString: () => '',
      getRangeAt: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // 1. Constructor initializes with null clipboard
  it('should initialize with null clipboard', () => {
    expect(clipboardManager.clipboard).toBeNull();
    expect(clipboardManager.formatClipboard).toBeNull();
    expect(clipboardManager.formatPasteMode).toBe(false);
  });

  // 2. copy() with no selection returns false
  it('should return false when no text is selected', () => {
    const result = clipboardManager.copy();
    expect(result).toBe(false);
  });

  // 3. copy() with selection stores in clipboard
  it('should store text in clipboard when selection exists', () => {
    const mockRange = {
      commonAncestorContainer: document.createElement('span'),
      cloneContents: vi.fn(() => document.createDocumentFragment()),
    };

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => 'Selected text',
      getRangeAt: vi.fn(() => mockRange),
    });

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      fontSize: '12px',
      fontFamily: 'Arial',
      color: 'black',
      textAlign: 'left',
      lineHeight: 'normal',
      marginLeft: '0px',
    });

    // ClipboardItem mock
    globalThis.ClipboardItem = vi.fn();

    const result = clipboardManager.copy();

    expect(result).toBe(true);
    expect(clipboardManager.clipboard).not.toBeNull();
    expect(clipboardManager.clipboard.text).toBe('Selected text');
  });

  // 4. cut() copies then deletes
  it('should copy and delete on cut', () => {
    const copySpy = vi.spyOn(clipboardManager, 'copy').mockReturnValue(true);
    document.execCommand = vi.fn(() => true);

    const result = clipboardManager.cut();

    expect(copySpy).toHaveBeenCalled();
    expect(document.execCommand).toHaveBeenCalledWith('delete');
    expect(result).toBe(true);
  });

  // 5. paste() with no editing cell returns false
  it('should return false when no editing cell exists', async () => {
    const result = await clipboardManager.paste();
    expect(result).toBe(false);
  });

  // 6. paste() from internal clipboard (recent)
  it('should paste from internal clipboard when recent', async () => {
    // Set up editing cell
    const editingCell = document.createElement('td');
    editingCell.contentEditable = 'true';
    document.body.appendChild(editingCell);
    viewer.inlineEditor.editingCell = editingCell;

    // Set up internal clipboard
    clipboardManager.clipboard = {
      text: 'Copied text',
      html: '<b>Copied text</b>',
      format: {},
      timestamp: Date.now(), // recent
    };

    document.execCommand = vi.fn(() => true);

    const result = await clipboardManager.paste();

    expect(result).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('insertHTML', false, '<b>Copied text</b>');
  });

  // 7. isFormatPasteMode() default false
  it('should return false for isFormatPasteMode by default', () => {
    expect(clipboardManager.isFormatPasteMode()).toBe(false);
  });

  // 8. copyFormat() -> isFormatPasteMode() true
  it('should set formatPasteMode to true after copyFormat', () => {
    const mockRange = {
      commonAncestorContainer: document.createElement('span'),
    };

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: vi.fn(() => mockRange),
    });

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontWeight: 'bold',
      fontStyle: 'italic',
      textDecoration: 'underline',
      fontSize: '14px',
      fontFamily: 'Arial',
      color: 'red',
      textAlign: 'center',
      lineHeight: '1.5',
      marginLeft: '10px',
    });

    const result = clipboardManager.copyFormat();

    expect(result).toBe(true);
    expect(clipboardManager.isFormatPasteMode()).toBe(true);
    expect(clipboardManager.formatClipboard).not.toBeNull();
  });

  // 9. System clipboard fallback
  it('should use system clipboard write for copy', () => {
    const mockRange = {
      commonAncestorContainer: document.createElement('span'),
      cloneContents: vi.fn(() => document.createDocumentFragment()),
    };

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => 'text',
      getRangeAt: vi.fn(() => mockRange),
    });

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      fontSize: '12px',
      fontFamily: 'Arial',
      color: 'black',
      textAlign: 'left',
      lineHeight: 'normal',
      marginLeft: '0px',
    });

    globalThis.ClipboardItem = vi.fn();

    const result = clipboardManager.copy();
    expect(result).toBe(true);
    // navigator.clipboard.write should have been called
    expect(navigator.clipboard.write).toHaveBeenCalled();
  });

  // 10. cancelFormatPaste disables format paste mode
  it('should cancel format paste mode', () => {
    clipboardManager.formatPasteMode = true;

    clipboardManager.cancelFormatPaste();

    expect(clipboardManager.formatPasteMode).toBe(false);
  });

  // 11. cut() returns false when copy fails
  it('should return false on cut when copy fails', () => {
    vi.spyOn(clipboardManager, 'copy').mockReturnValue(false);

    const result = clipboardManager.cut();

    expect(result).toBe(false);
  });

  // 12. paste() with expired internal clipboard falls through
  it('should not use internal clipboard when expired', async () => {
    const editingCell = document.createElement('td');
    editingCell.contentEditable = 'true';
    document.body.appendChild(editingCell);
    viewer.inlineEditor.editingCell = editingCell;

    clipboardManager.clipboard = {
      text: 'Old text',
      html: 'Old text',
      format: {},
      timestamp: Date.now() - 120000, // 2 minutes ago, expired
    };

    document.execCommand = vi.fn(() => true);

    await clipboardManager.paste();

    // Should NOT have used the internal clipboard html
    expect(document.execCommand).not.toHaveBeenCalledWith('insertHTML', false, 'Old text');
  });

  // 13. pasteFormat() with no format clipboard returns false
  it('should return false for pasteFormat when no format is stored', () => {
    const result = clipboardManager.pasteFormat();
    expect(result).toBe(false);
  });

  // 14. _triggerChange calls onChangeCallback
  it('should call onChangeCallback via _triggerChange', () => {
    const callback = vi.fn();
    viewer.inlineEditor.onChangeCallback = callback;

    clipboardManager._triggerChange('paste');

    expect(callback).toHaveBeenCalledWith({ type: 'clipboard', action: 'paste' });
  });

  // 15. copy() handles error gracefully
  it('should return false when copy throws an error', () => {
    // Mock getSelection to return a selection that will cause an error inside the try block
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => 'text',
      getRangeAt: vi.fn(() => {
        throw new Error('Range error');
      }),
    });

    const result = clipboardManager.copy();
    expect(result).toBe(false);
  });
});
