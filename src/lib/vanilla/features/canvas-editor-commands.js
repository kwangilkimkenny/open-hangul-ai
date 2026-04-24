/**
 * CanvasEditorCommands
 *
 * `viewer.command` 와 동일한 표면을 가지지만 모든 호출을 canvas-editor의
 * `editor.command.execute*` API 로 라우팅하는 어댑터.
 *
 * 툴바/단축키/메뉴는 `viewer.canvasEditor?.commands` 가 있으면 이 어댑터를
 * 통해 호출하고, 없으면 기존 InlineEditor 경로(viewer.command)로 폴백한다.
 *
 * canvas-editor 가 직접 제공하지 않는 일부 명령(요소 단위 셀 편집 등) 은
 * 안전하게 no-op 로 처리한다 — 추후 필요 시 매핑을 확장한다.
 */
import { getLogger } from '../utils/logger.js';

const logger = getLogger('CanvasEditorCommands');

const ROW_FLEX = {
  left: 'left',
  center: 'center',
  right: 'right',
  alignment: 'alignment',
  justify: 'justify',
};

const BULLET_TO_LIST_STYLE = {
  bullet: 'disc',
  disc: 'disc',
  circle: 'circle',
  square: 'square',
  checkbox: 'checkbox',
};

export class CanvasEditorCommands {
  constructor(canvasEditorAdapter) {
    this.adapter = canvasEditorAdapter;
  }

  get _ed() {
    return this.adapter?.editor || null;
  }

  get _cmd() {
    return this._ed?.command || null;
  }

  _exec(method, ...args) {
    const cmd = this._cmd;
    if (!cmd || typeof cmd[method] !== 'function') {
      logger.debug(`canvas-editor command "${method}" 미지원`);
      return undefined;
    }
    try {
      return cmd[method](...args);
    } catch (err) {
      logger.warn(`canvas-editor ${method} 실패:`, err);
      return undefined;
    }
  }

  // ─── History ──────────────────────────────
  undo() {
    return this._exec('executeUndo');
  }
  redo() {
    return this._exec('executeRedo');
  }

  // ─── Range ────────────────────────────────
  selectAll() {
    return this._exec('executeSelectAll');
  }
  clearSelection() {
    /* canvas-editor 자체 처리 */
  }
  setRange() {
    /* range API 가 다르므로 직접 호출 권장 */
  }

  // ─── Inline 서식 ──────────────────────────
  bold() {
    return this._exec('executeBold');
  }
  italic() {
    return this._exec('executeItalic');
  }
  underline() {
    return this._exec('executeUnderline');
  }
  strikethrough() {
    return this._exec('executeStrikeout');
  }
  superscript() {
    return this._exec('executeSuperscript');
  }
  subscript() {
    return this._exec('executeSubscript');
  }
  color(value) {
    return this._exec('executeColor', value || null);
  }
  highlight(value) {
    return this._exec('executeHighlight', value || null);
  }

  // ─── 정렬 ─────────────────────────────────
  alignLeft() {
    return this._exec('executeRowFlex', ROW_FLEX.left);
  }
  alignCenter() {
    return this._exec('executeRowFlex', ROW_FLEX.center);
  }
  alignRight() {
    return this._exec('executeRowFlex', ROW_FLEX.right);
  }
  alignJustify() {
    return this._exec('executeRowFlex', ROW_FLEX.justify);
  }

  // ─── 목록 ─────────────────────────────────
  bulletList(bulletType = 'bullet') {
    const style = BULLET_TO_LIST_STYLE[bulletType] || 'disc';
    return this._exec('executeList', 'ul', style);
  }
  numberedList(_numberType = 'decimal') {
    return this._exec('executeList', 'ol', 'decimal');
  }
  removeList() {
    return this._exec('executeList', null);
  }
  increaseIndent() {
    /* canvas-editor 별도 명령 없음 */
  }
  decreaseIndent() {
    /* canvas-editor 별도 명령 없음 */
  }

  // ─── 줄/단락 간격 ─────────────────────────
  lineSpacing(value) {
    const v = Number(value) || 1;
    return this._exec('executeRowMargin', v);
  }
  paragraphSpaceBefore(_v) {
    /* canvas-editor 미지원 */
  }
  paragraphSpaceAfter(_v) {
    /* canvas-editor 미지원 */
  }
  paragraphSpacing(_b, _a) {
    /* canvas-editor 미지원 */
  }

  // ─── 글꼴 ─────────────────────────────────
  setFontSize(size) {
    const n = Number(size);
    if (!Number.isFinite(n)) return;
    return this._exec('executeSize', n);
  }
  increaseFontSize() {
    return this._exec('executeSizeAdd');
  }
  decreaseFontSize() {
    return this._exec('executeSizeMinus');
  }
  setFontFamily(family) {
    if (!family) return;
    return this._exec('executeFont', family);
  }

  // ─── 표 ───────────────────────────────────
  insertTable(rows = 3, cols = 3) {
    return this._exec('executeInsertTable', rows, cols);
  }
  deleteTable() {
    return this._exec('executeDeleteTable');
  }
  addRowAbove() {
    return this._exec('executeInsertTableTopRow');
  }
  addRowBelow() {
    return this._exec('executeInsertTableBottomRow');
  }
  addColumnLeft() {
    return this._exec('executeInsertTableLeftCol');
  }
  addColumnRight() {
    return this._exec('executeInsertTableRightCol');
  }
  deleteRow() {
    return this._exec('executeDeleteTableRow');
  }
  deleteColumn() {
    return this._exec('executeDeleteTableCol');
  }

  // ─── 검색/치환 ────────────────────────────
  find(text) {
    return this._exec('executeSearch', text || null);
  }
  findNext() {
    return this._exec('executeSearchNavigateNext');
  }
  findPrevious() {
    return this._exec('executeSearchNavigatePre');
  }
  replace(value) {
    return this._exec('executeReplace', value);
  }
  replaceAll(searchText, replaceText) {
    this._exec('executeSearch', searchText);
    return this._exec('executeReplace', replaceText);
  }
  clearSearch() {
    return this._exec('executeSearch', null);
  }

  // ─── 삽입 ─────────────────────────────────
  insertText(text) {
    if (text == null) return;
    if (typeof this._cmd?.executeInsertElementList === 'function') {
      return this._cmd.executeInsertElementList([{ value: String(text) }]);
    }
  }
  insertLineBreak() {
    if (typeof this._cmd?.executeInsertElementList === 'function') {
      return this._cmd.executeInsertElementList([{ value: '\n' }]);
    }
  }
  pageBreak() {
    return this._exec('executePageBreak');
  }
  separator(payload) {
    return this._exec('executeSeparator', payload);
  }

  async insertImage(imageUrl, options = {}) {
    if (!imageUrl) return;
    const payload = {
      value: imageUrl,
      width: options.width || 200,
      height: options.height || 200,
    };
    return this._exec('executeImage', payload);
  }
  insertHyperlink(payload) {
    return this._exec('executeHyperlink', payload);
  }

  // ─── 문서 ─────────────────────────────────
  getDocument() {
    return this.adapter?.getDocument?.() || null;
  }
  updateDocument(doc) {
    if (!doc || !this.adapter) return;
    this.adapter.loadDocument(doc);
  }
  render() {
    // canvas-editor 는 자동 렌더이므로 강제 리페인트만 시도
    if (typeof this._cmd?.executeRender === 'function') {
      return this._cmd.executeRender();
    }
  }

  // ─── Clipboard / 입력 ─────────────────────
  copy() {
    if (typeof this._cmd?.executeCopy === 'function') return this._cmd.executeCopy();
    return '';
  }
  cut() {
    if (typeof this._cmd?.executeCut === 'function') return this._cmd.executeCut();
    return '';
  }
  paste(text) {
    if (typeof this._cmd?.executePaste === 'function') return this._cmd.executePaste(text);
  }
  deleteBackward() {
    if (typeof this._cmd?.executeDelete === 'function') return this._cmd.executeDelete();
  }
  deleteForward() {
    if (typeof this._cmd?.executeDelete === 'function') return this._cmd.executeDelete();
  }

  // ─── 셀/이미지/도형 (요소 단위) ─────────────
  // canvas-editor 에서는 selection 기반이므로 요소 인자는 무시한다.
  editCell() {
    /* no-op */
  }
  clearCell() {
    /* no-op */
  }
  mergeCells() {
    return this._exec('executeMergeTableCell');
  }
  splitCell() {
    return this._exec('executeCancelMergeTableCell');
  }
  setCellBackgroundColor() {
    /* canvas-editor 별도 UI */
  }
  setCellBorders() {
    /* canvas-editor 별도 UI */
  }
  deleteImage() {
    /* canvas-editor 는 selection 기반 delete */
  }
  resizeImage() {
    /* selection 기반 */
  }
  setImageAlignment() {
    /* selection 기반 */
  }
  setImagePosition() {
    /* canvas-editor 미지원 */
  }
  setImageAltText() {
    /* selection 기반 */
  }
  rotateImage() {
    /* canvas-editor 미지원 */
  }
  setImageBorder() {
    /* canvas-editor 미지원 */
  }
  setImageOpacity() {
    /* canvas-editor 미지원 */
  }
  insertShape() {
    /* canvas-editor 미지원 */
  }
  deleteShape() {
    /* canvas-editor 미지원 */
  }
  resizeShape() {
    /* canvas-editor 미지원 */
  }
  setShapePosition() {
    /* canvas-editor 미지원 */
  }
  setShapeFillColor() {
    /* canvas-editor 미지원 */
  }
  setShapeStroke() {
    /* canvas-editor 미지원 */
  }
  rotateShape() {
    /* canvas-editor 미지원 */
  }
  setShapeOpacity() {
    /* canvas-editor 미지원 */
  }
  setShapeText() {
    /* canvas-editor 미지원 */
  }
  setShapeBorderRadius() {
    /* canvas-editor 미지원 */
  }

  // ─── Selection style 조회 (toolbar 동기화 용) ─
  /**
   * 현재 selection 의 서식 정보를 반환한다.
   * @returns {object|null} { bold, italic, underline, strikeout, superscript, subscript,
   *                          color, highlight, font, size, rowFlex, listType, listStyle, ... }
   */
  getRangeStyle() {
    if (typeof this._cmd?.getRangeStyle === 'function') {
      try {
        return this._cmd.getRangeStyle();
      } catch {
        return null;
      }
    }
    return null;
  }
}

export default CanvasEditorCommands;
