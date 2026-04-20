/**
 * Command Adapt Core - Refactored Version
 * 모듈화된 명령 구현의 메인 클래스
 *
 * @module command/command-adapt-core
 * @version 2.0.0
 * @author Kwang-il Kim (김광일) <yatav@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';
import { TextCommands } from './text-commands.js';
import { HistoryCommands } from './history-commands.js';
import { RangeCommands } from './range-commands.js';
import { ListCommands } from './list-commands.js';
import { TableCommands } from './table-commands.js';
import { ImageCommands } from './image-commands.js';
import { ShapeCommands } from './shape-commands.js';
import { DocumentCommands } from './document-commands.js';
import { ClipboardCommands } from './clipboard-commands.js';
import { TextInputCommands } from './text-input-commands.js';
import { FindReplaceCommands } from './find-replace-commands.js';
import { UtilityCommands } from './utility-commands.js';

const logger = getLogger();

/**
 * 리팩토링된 CommandAdapt 클래스
 * 모듈화되어 유지보수가 쉬워졌습니다.
 */
export class CommandAdapt {
  constructor(viewer) {
    this.viewer = viewer;
    this.historyManager = viewer.historyManager;
    this.positionManager = viewer.positionManager;
    this.rangeManager = viewer.rangeManager;

    // 명령 모듈 인스턴스 생성
    this.textCommands = new TextCommands(viewer);
    this.historyCommands = new HistoryCommands(viewer);
    this.rangeCommands = new RangeCommands(viewer);
    this.listCommands = new ListCommands(viewer);
    this.tableCommands = new TableCommands(viewer);
    this.imageCommands = new ImageCommands(viewer);
    this.shapeCommands = new ShapeCommands(viewer);
    this.documentCommands = new DocumentCommands(viewer);
    this.clipboardCommands = new ClipboardCommands(viewer);
    this.textInputCommands = new TextInputCommands(viewer);
    this.findReplaceCommands = new FindReplaceCommands(viewer);
    this.utilityCommands = new UtilityCommands(viewer);

    logger.info('CommandAdapt (refactored) initialized');
  }

  // ===========================
  // History Commands Delegation
  // ===========================

  executeUndo() {
    return this.historyCommands.executeUndo();
  }

  executeRedo() {
    return this.historyCommands.executeRedo();
  }

  canUndo() {
    return this.historyCommands.canUndo();
  }

  canRedo() {
    return this.historyCommands.canRedo();
  }

  clearHistory() {
    return this.historyCommands.clearHistory();
  }

  // ===========================
  // Range Commands Delegation
  // ===========================

  executeSetRange(startIndex, endIndex) {
    return this.rangeCommands.executeSetRange(startIndex, endIndex);
  }

  executeSelectAll() {
    return this.rangeCommands.executeSelectAll();
  }

  executeClearSelection() {
    return this.rangeCommands.executeClearSelection();
  }

  getCurrentRange() {
    return this.rangeCommands.getCurrentRange();
  }

  hasSelection() {
    return this.rangeCommands.hasSelection();
  }

  getSelectedText() {
    return this.rangeCommands.getSelectedText();
  }

  moveCursor(position) {
    return this.rangeCommands.moveCursor(position);
  }

  // ===========================
  // Text Commands Delegation
  // ===========================

  executeBold(value = true) {
    return this.textCommands.executeBold(value);
  }

  executeItalic(value = true) {
    return this.textCommands.executeItalic(value);
  }

  executeUnderline(value = true) {
    return this.textCommands.executeUnderline(value);
  }

  executeStrikethrough(value = true) {
    return this.textCommands.executeStrikethrough(value);
  }

  executeColor(color) {
    return this.textCommands.executeColor(color);
  }

  executeHighlight(color) {
    return this.textCommands.executeHighlight(color);
  }

  executeSuperscript(value = true) {
    return this.textCommands.executeSuperscript(value);
  }

  executeSubscript(value = true) {
    return this.textCommands.executeSubscript(value);
  }

  executeFontSize(size) {
    return this.textCommands.executeFontSize(size);
  }

  executeFontFamily(fontFamily) {
    return this.textCommands.executeFontFamily(fontFamily);
  }

  executeTextAlign(alignment) {
    return this.textCommands.executeTextAlign(alignment);
  }

  executeLineHeight(height) {
    return this.textCommands.executeLineHeight(height);
  }

  executeIndent() {
    return this.textCommands.executeIndent();
  }

  executeOutdent() {
    return this.textCommands.executeOutdent();
  }

  getCurrentStyles() {
    return this.textCommands.getCurrentStyles();
  }

  // ===========================
  // List Commands Delegation
  // ===========================

  executeBulletList(bulletType = 'bullet') {
    return this.listCommands.executeBulletList(bulletType);
  }

  executeNumberedList(numberType = 'decimal') {
    return this.listCommands.executeNumberedList(numberType);
  }

  executeRemoveList() {
    return this.listCommands.executeRemoveList();
  }

  executeIncreaseIndent() {
    return this.listCommands.executeIncreaseIndent();
  }

  executeDecreaseIndent() {
    return this.listCommands.executeDecreaseIndent();
  }

  isCurrentParagraphList() {
    return this.listCommands.isCurrentParagraphList();
  }

  getCurrentListType() {
    return this.listCommands.getCurrentListType();
  }

  // ===========================
  // Table Commands Delegation
  // ===========================

  executeAddRowAbove(cellElement) {
    return this.tableCommands.executeAddRowAbove(cellElement);
  }

  executeAddRowBelow(cellElement) {
    return this.tableCommands.executeAddRowBelow(cellElement);
  }

  executeAddColumnLeft(cellElement) {
    return this.tableCommands.executeAddColumnLeft(cellElement);
  }

  executeAddColumnRight(cellElement) {
    return this.tableCommands.executeAddColumnRight(cellElement);
  }

  executeDeleteRow(cellElement) {
    return this.tableCommands.executeDeleteRow(cellElement);
  }

  executeDeleteColumn(cellElement) {
    return this.tableCommands.executeDeleteColumn(cellElement);
  }

  executeInsertTable(rows = 3, cols = 3) {
    return this.tableCommands.executeInsertTable(rows, cols);
  }

  executeDeleteTable(cellElement) {
    return this.tableCommands.executeDeleteTable(cellElement);
  }

  executeMergeCells(cells) {
    return this.tableCommands.executeMergeCells(cells);
  }

  executeSplitCell(cellElement) {
    return this.tableCommands.executeSplitCell(cellElement);
  }

  executeSetCellBackgroundColor(cellElement, color) {
    return this.tableCommands.executeSetCellBackgroundColor(cellElement, color);
  }

  executeSetCellBorders(cellElement, borders) {
    return this.tableCommands.executeSetCellBorders(cellElement, borders);
  }

  isInTable(element) {
    return this.tableCommands.isInTable(element);
  }

  getCurrentCell() {
    return this.tableCommands.getCurrentCell();
  }

  // ===========================
  // Image Commands Delegation
  // ===========================

  async executeInsertImage(imageUrl, options = {}) {
    return this.imageCommands.executeInsertImage(imageUrl, options);
  }

  async executeDeleteImage(imageElement) {
    return this.imageCommands.executeDeleteImage(imageElement);
  }

  async executeResizeImage(imageElement, width, height) {
    return this.imageCommands.executeResizeImage(imageElement, width, height);
  }

  async executeSetImageAlignment(imageElement, alignment) {
    return this.imageCommands.executeSetImageAlignment(imageElement, alignment);
  }

  async executeSetImagePosition(imageElement, x, y) {
    return this.imageCommands.executeSetImagePosition(imageElement, x, y);
  }

  async executeSetImageAltText(imageElement, altText) {
    return this.imageCommands.executeSetImageAltText(imageElement, altText);
  }

  async executeRotateImage(imageElement, degrees) {
    return this.imageCommands.executeRotateImage(imageElement, degrees);
  }

  async executeSetImageBorder(imageElement, border) {
    return this.imageCommands.executeSetImageBorder(imageElement, border);
  }

  async executeSetImageOpacity(imageElement, opacity) {
    return this.imageCommands.executeSetImageOpacity(imageElement, opacity);
  }

  hasSelectedImage() {
    return this.imageCommands.hasSelectedImage();
  }

  getSelectedImage() {
    return this.imageCommands.getSelectedImage();
  }

  getImageInfo(imageElement) {
    return this.imageCommands.getImageInfo(imageElement);
  }

  // ===========================
  // Shape Commands Delegation
  // ===========================

  async executeInsertShape(shapeType, options = {}) {
    return this.shapeCommands.executeInsertShape(shapeType, options);
  }

  async executeDeleteShape(shapeElement) {
    return this.shapeCommands.executeDeleteShape(shapeElement);
  }

  async executeResizeShape(shapeElement, width, height) {
    return this.shapeCommands.executeResizeShape(shapeElement, width, height);
  }

  async executeSetShapePosition(shapeElement, x, y) {
    return this.shapeCommands.executeSetShapePosition(shapeElement, x, y);
  }

  async executeSetShapeFillColor(shapeElement, color) {
    return this.shapeCommands.executeSetShapeFillColor(shapeElement, color);
  }

  async executeSetShapeStroke(shapeElement, color, width) {
    return this.shapeCommands.executeSetShapeStroke(shapeElement, color, width);
  }

  async executeRotateShape(shapeElement, degrees) {
    return this.shapeCommands.executeRotateShape(shapeElement, degrees);
  }

  async executeSetShapeOpacity(shapeElement, opacity) {
    return this.shapeCommands.executeSetShapeOpacity(shapeElement, opacity);
  }

  async executeSetShapeText(shapeElement, text) {
    return this.shapeCommands.executeSetShapeText(shapeElement, text);
  }

  async executeSetShapeBorderRadius(shapeElement, radius) {
    return this.shapeCommands.executeSetShapeBorderRadius(shapeElement, radius);
  }

  hasSelectedShape() {
    return this.shapeCommands.hasSelectedShape();
  }

  getSelectedShape() {
    return this.shapeCommands.getSelectedShape();
  }

  getShapeInfo(shapeElement) {
    return this.shapeCommands.getShapeInfo(shapeElement);
  }

  getSupportedShapeTypes() {
    return this.shapeCommands.getSupportedShapeTypes();
  }

  // ===========================
  // Document Commands Delegation
  // ===========================

  executeUpdateDocument(newDocument, actionName = 'Update Document') {
    return this.documentCommands.executeUpdateDocument(newDocument, actionName);
  }

  executeClearCell(cellElement) {
    return this.documentCommands.executeClearCell(cellElement);
  }

  executeEditCell(cellElement, newText) {
    return this.documentCommands.executeEditCell(cellElement, newText);
  }

  executeNewDocument() {
    return this.documentCommands.executeNewDocument();
  }

  executeCloneDocument() {
    return this.documentCommands.executeCloneDocument();
  }

  executeUpdateMetadata(metadata) {
    return this.documentCommands.executeUpdateMetadata(metadata);
  }

  validateDocument(document) {
    return this.documentCommands.validateDocument(document);
  }

  getDocumentStats() {
    return this.documentCommands.getDocumentStats();
  }

  getCurrentDocument() {
    return this.documentCommands.getCurrentDocument();
  }

  isDocumentEmpty() {
    return this.documentCommands.isDocumentEmpty();
  }

  isDocumentModified() {
    return this.documentCommands.isDocumentModified();
  }

  // ===========================
  // Clipboard Commands Delegation
  // ===========================

  executeCopy() {
    return this.clipboardCommands.executeCopy();
  }

  executeCut() {
    return this.clipboardCommands.executeCut();
  }

  async executePaste(text = null) {
    return this.clipboardCommands.executePaste(text);
  }

  getClipboardContent() {
    return this.clipboardCommands.getClipboardContent();
  }

  setClipboardContent(text) {
    return this.clipboardCommands.setClipboardContent(text);
  }

  clearClipboard() {
    return this.clipboardCommands.clearClipboard();
  }

  hasClipboardContent() {
    return this.clipboardCommands.hasClipboardContent();
  }

  isSystemClipboardSupported() {
    return this.clipboardCommands.isSystemClipboardSupported();
  }

  // ===========================
  // Text Input Commands Delegation
  // ===========================

  executeInsertText(text) {
    return this.textInputCommands.executeInsertText(text);
  }

  executeDeleteBackward() {
    return this.textInputCommands.executeDeleteBackward();
  }

  executeDeleteForward() {
    return this.textInputCommands.executeDeleteForward();
  }

  executeInsertNewline() {
    return this.textInputCommands.executeInsertNewline();
  }

  executeInsertTab() {
    return this.textInputCommands.executeInsertTab();
  }

  isTyping() {
    return this.textInputCommands.isTyping();
  }

  getAutocompleteSuggestions(text) {
    return this.textInputCommands.getAutocompleteSuggestions(text);
  }

  checkSpelling(text) {
    return this.textInputCommands.checkSpelling(text);
  }

  // ===========================
  // Find/Replace Commands Delegation
  // ===========================

  executeFind(searchText, options = {}) {
    return this.findReplaceCommands.executeFind(searchText, options);
  }

  executeFindNext() {
    return this.findReplaceCommands.executeFindNext();
  }

  executeFindPrevious() {
    return this.findReplaceCommands.executeFindPrevious();
  }

  executeReplace(replaceText) {
    return this.findReplaceCommands.executeReplace(replaceText);
  }

  executeReplaceAll(searchText, replaceText, options = {}) {
    return this.findReplaceCommands.executeReplaceAll(searchText, replaceText, options);
  }

  executeClearSearch() {
    return this.findReplaceCommands.executeClearSearch();
  }

  getSearchState() {
    return this.findReplaceCommands.getSearchState();
  }

  getCurrentMatch() {
    return this.findReplaceCommands.getCurrentMatch();
  }

  isSearchActive() {
    return this.findReplaceCommands.isSearchActive();
  }

  getMatchCount() {
    return this.findReplaceCommands.getMatchCount();
  }

  // ===========================
  // Utility Commands Delegation
  // ===========================

  executeZoomIn(factor = 1.2) {
    return this.utilityCommands.executeZoomIn(factor);
  }

  executeZoomOut(factor = 0.8) {
    return this.utilityCommands.executeZoomOut(factor);
  }

  executeZoomReset() {
    return this.utilityCommands.executeZoomReset();
  }

  executeZoomToFit() {
    return this.utilityCommands.executeZoomToFit();
  }

  executeZoomToWidth() {
    return this.utilityCommands.executeZoomToWidth();
  }

  executeNextPage() {
    return this.utilityCommands.executeNextPage();
  }

  executePreviousPage() {
    return this.utilityCommands.executePreviousPage();
  }

  executeGoToPage(pageNumber) {
    return this.utilityCommands.executeGoToPage(pageNumber);
  }

  executeGoToFirstPage() {
    return this.utilityCommands.executeGoToFirstPage();
  }

  executeGoToLastPage() {
    return this.utilityCommands.executeGoToLastPage();
  }

  executeToggleFullscreen() {
    return this.utilityCommands.executeToggleFullscreen();
  }

  executeToggleReadMode() {
    return this.utilityCommands.executeToggleReadMode();
  }

  executeToggleRuler() {
    return this.utilityCommands.executeToggleRuler();
  }

  executeToggleGrid() {
    return this.utilityCommands.executeToggleGrid();
  }

  executeGetDocumentInfo() {
    return this.utilityCommands.executeGetDocumentInfo();
  }

  executeApplySettings(settings) {
    return this.utilityCommands.executeApplySettings(settings);
  }

  executeGetPerformanceInfo() {
    return this.utilityCommands.executeGetPerformanceInfo();
  }

  executeCollectDebugInfo() {
    return this.utilityCommands.executeCollectDebugInfo();
  }

  // ===========================
  // Core Utility Methods
  // ===========================

  /**
   * 모듈 상태 확인
   */
  getModuleStatus() {
    return {
      textCommands: !!this.textCommands,
      historyCommands: !!this.historyCommands,
      rangeCommands: !!this.rangeCommands,
      listCommands: !!this.listCommands,
      tableCommands: !!this.tableCommands,
      imageCommands: !!this.imageCommands,
      shapeCommands: !!this.shapeCommands,
      documentCommands: !!this.documentCommands,
      clipboardCommands: !!this.clipboardCommands,
      textInputCommands: !!this.textInputCommands,
      findReplaceCommands: !!this.findReplaceCommands,
      utilityCommands: !!this.utilityCommands,
      viewer: !!this.viewer,
      historyManager: !!this.historyManager,
      rangeManager: !!this.rangeManager,
    };
  }

  /**
   * 모든 명령 모듈 정리
   */
  destroy() {
    logger.info('CommandAdapt (refactored) destroyed');
    // 각 모듈에 정리 메서드가 있다면 호출
    this.textCommands = null;
    this.historyCommands = null;
    this.rangeCommands = null;
    this.listCommands = null;
    this.tableCommands = null;
    this.imageCommands = null;
    this.shapeCommands = null;
    this.documentCommands = null;
    this.clipboardCommands = null;
    this.textInputCommands = null;
    this.findReplaceCommands = null;
    this.utilityCommands = null;
  }
}

export default CommandAdapt;
