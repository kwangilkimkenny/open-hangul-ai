/**
 * Command API Tests
 * command.js 퍼블릭 API 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from './command.js';

describe('Command', () => {
  let mockAdapt;
  let command;

  beforeEach(() => {
    mockAdapt = {
      executeUndo: vi.fn().mockReturnValue(true),
      executeRedo: vi.fn().mockReturnValue(true),
      executeSetRange: vi.fn(),
      executeSelectAll: vi.fn(),
      executeClearSelection: vi.fn(),
      executeBold: vi.fn(),
      executeItalic: vi.fn(),
      executeUnderline: vi.fn(),
      executeStrikethrough: vi.fn(),
      executeColor: vi.fn(),
      executeHighlight: vi.fn(),
      executeSuperscript: vi.fn(),
      executeSubscript: vi.fn(),
      executeInsertText: vi.fn(),
      executeDeleteBackward: vi.fn(),
      executeDeleteForward: vi.fn(),
      executeInsertLineBreak: vi.fn(),
      executeCopy: vi.fn(),
      executeCut: vi.fn(),
      executePaste: vi.fn(),
      executeFind: vi.fn(),
      executeFindNext: vi.fn(),
      executeFindPrevious: vi.fn(),
      executeReplace: vi.fn(),
      executeReplaceAll: vi.fn(),
      executeClearSearch: vi.fn(),
      _executeAlignment: vi.fn(),
      executeAlignLeft: vi.fn(),
      executeAlignCenter: vi.fn(),
      executeAlignRight: vi.fn(),
      executeAlignJustify: vi.fn(),
      executeBulletList: vi.fn(),
      executeNumberedList: vi.fn(),
      executeRemoveList: vi.fn(),
      executeIncreaseIndent: vi.fn(),
      executeDecreaseIndent: vi.fn(),
      executeLineSpacing: vi.fn(),
      executeParagraphSpaceBefore: vi.fn(),
      executeParagraphSpaceAfter: vi.fn(),
      executeParagraphSpacing: vi.fn(),
      executeSetFontSize: vi.fn(),
      executeIncreaseFontSize: vi.fn(),
      executeDecreaseFontSize: vi.fn(),
      executeSetFontFamily: vi.fn(),
      executeEditCell: vi.fn(),
      executeClearCell: vi.fn(),
      executeAddRowAbove: vi.fn(),
      executeAddRowBelow: vi.fn(),
      executeAddColumnLeft: vi.fn(),
      executeAddColumnRight: vi.fn(),
      executeDeleteRow: vi.fn(),
      executeDeleteColumn: vi.fn(),
      executeInsertTable: vi.fn(),
      executeDeleteTable: vi.fn(),
      executeMergeCells: vi.fn(),
      executeSplitCell: vi.fn(),
      executeSetCellBackgroundColor: vi.fn(),
      executeSetCellBorders: vi.fn(),
      executeInsertImage: vi.fn(),
      executeDeleteImage: vi.fn(),
      executeResizeImage: vi.fn(),
      executeUpdateDocument: vi.fn(),
    };
    command = new Command(mockAdapt);
  });

  // History
  it('undo() delegates to adapt', () => {
    expect(command.undo()).toBe(true);
    expect(mockAdapt.executeUndo).toHaveBeenCalled();
  });

  it('redo() delegates to adapt', () => {
    expect(command.redo()).toBe(true);
    expect(mockAdapt.executeRedo).toHaveBeenCalled();
  });

  // Format
  it('bold() delegates to adapt', () => {
    command.bold();
    expect(mockAdapt.executeBold).toHaveBeenCalledWith(true);
  });

  it('italic() delegates to adapt', () => {
    command.italic();
    expect(mockAdapt.executeItalic).toHaveBeenCalledWith(true);
  });

  it('underline() delegates to adapt', () => {
    command.underline();
    expect(mockAdapt.executeUnderline).toHaveBeenCalledWith(true);
  });

  it('strikethrough() delegates to adapt', () => {
    command.strikethrough();
    expect(mockAdapt.executeStrikethrough).toHaveBeenCalledWith(true);
  });

  it('color() delegates to adapt', () => {
    command.color('#ff0000');
    expect(mockAdapt.executeColor).toHaveBeenCalledWith('#ff0000');
  });

  it('highlight() delegates to adapt', () => {
    command.highlight('#ffff00');
    expect(mockAdapt.executeHighlight).toHaveBeenCalledWith('#ffff00');
  });

  // Font
  it('setFontSize() delegates to adapt', () => {
    command.setFontSize(16);
    expect(mockAdapt.executeSetFontSize).toHaveBeenCalledWith(16);
  });

  it('setFontFamily() delegates to adapt', () => {
    command.setFontFamily('Arial');
    expect(mockAdapt.executeSetFontFamily).toHaveBeenCalledWith('Arial');
  });

  it('increaseFontSize() delegates to adapt', () => {
    command.increaseFontSize(2);
    expect(mockAdapt.executeIncreaseFontSize).toHaveBeenCalledWith(2);
  });

  // Alignment
  it('alignLeft() delegates to adapt', () => {
    command.alignLeft();
    expect(mockAdapt.executeAlignLeft).toHaveBeenCalled();
  });

  it('alignCenter() delegates to adapt', () => {
    command.alignCenter();
    expect(mockAdapt.executeAlignCenter).toHaveBeenCalled();
  });

  it('alignRight() delegates to adapt', () => {
    command.alignRight();
    expect(mockAdapt.executeAlignRight).toHaveBeenCalled();
  });

  it('alignJustify() delegates to adapt', () => {
    command.alignJustify();
    expect(mockAdapt.executeAlignJustify).toHaveBeenCalled();
  });

  // Lists
  it('bulletList() delegates to adapt', () => {
    command.bulletList('bullet');
    expect(mockAdapt.executeBulletList).toHaveBeenCalledWith('bullet');
  });

  it('numberedList() delegates to adapt', () => {
    command.numberedList('decimal');
    expect(mockAdapt.executeNumberedList).toHaveBeenCalledWith('decimal');
  });

  // Text input
  it('insertText() delegates to adapt', () => {
    command.insertText('hello');
    expect(mockAdapt.executeInsertText).toHaveBeenCalledWith('hello');
  });

  // Clipboard
  it('copy() delegates to adapt', () => {
    command.copy();
    expect(mockAdapt.executeCopy).toHaveBeenCalled();
  });

  it('cut() delegates to adapt', () => {
    command.cut();
    expect(mockAdapt.executeCut).toHaveBeenCalled();
  });

  // Table
  it('insertTable() delegates to adapt', () => {
    command.insertTable(3, 4);
    expect(mockAdapt.executeInsertTable).toHaveBeenCalledWith(3, 4);
  });

  it('deleteRow() delegates to adapt', () => {
    const cell = {};
    command.deleteRow(cell);
    expect(mockAdapt.executeDeleteRow).toHaveBeenCalledWith(cell);
  });

  // Line spacing
  it('lineSpacing() delegates to adapt', () => {
    command.lineSpacing(1.6);
    expect(mockAdapt.executeLineSpacing).toHaveBeenCalledWith(1.6);
  });

  // Find
  it('find() delegates to adapt', () => {
    command.find('test', { caseSensitive: true });
    expect(mockAdapt.executeFind).toHaveBeenCalledWith('test', { caseSensitive: true });
  });

  // Document
  it('updateDocument() delegates to adapt', () => {
    const doc = { sections: [] };
    command.updateDocument(doc, 'Test');
    expect(mockAdapt.executeUpdateDocument).toHaveBeenCalledWith(doc, 'Test');
  });
});
