/**
 * CanvasEditorAdapter
 *
 * Wraps `@hufe921/canvas-editor` so the rest of OpenHangulAI can use it
 * as a whole-document editing surface without depending on canvas-editor's
 * API directly. The adapter mirrors the high-level lifecycle exposed by
 * InlineEditor (constructor, onChange, destroy) so the viewer can swap
 * between cell-level (InlineEditor) and document-level (this) editing
 * by setting `editorType: 'canvas'`.
 *
 * The canvas-editor package is loaded lazily so that consumers building
 * the slim/library bundle can tree-shake it out when not needed.
 */

import { hwpxToCanvasEditor } from '../core/hwpx-to-canvas-editor.js';
import { canvasEditorToHwpx } from '../core/canvas-editor-to-hwpx.js';
import { CanvasEditorCommands } from './canvas-editor-commands.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('CanvasEditorAdapter');

const DEFAULT_OPTIONS = {
  defaultFont: 'Malgun Gothic',
  defaultSize: 12,
  pageMode: 'paging',
};

export class CanvasEditorAdapter {
  constructor(viewer) {
    this.viewer = viewer;
    this.editor = null;
    this.container = null;
    this.onChangeCallback = null;
    this.changeDebounceTimer = null;
    this._loaded = false;
    this.commands = new CanvasEditorCommands(this);
    this._rangeStyleListeners = new Set();
    this._pageInfoListeners = new Set();
    this._pageInfo = { current: 1, total: 1 };

    logger.info('🎨 CanvasEditorAdapter initialized');
  }

  /**
   * canvas-editor 의 selection 변경 이벤트를 구독한다.
   * @param {(style: object) => void} cb
   * @returns {() => void} unsubscribe
   */
  onRangeStyleChange(cb) {
    if (typeof cb !== 'function') return () => {};
    this._rangeStyleListeners.add(cb);
    return () => this._rangeStyleListeners.delete(cb);
  }

  /**
   * 페이지 정보(현재/전체) 변경 구독.
   * @param {(info: { current: number, total: number }) => void} cb
   * @returns {() => void} unsubscribe
   */
  onPageInfoChange(cb) {
    if (typeof cb !== 'function') return () => {};
    this._pageInfoListeners.add(cb);
    cb(this._pageInfo);
    return () => this._pageInfoListeners.delete(cb);
  }

  getPageInfo() {
    return { ...this._pageInfo };
  }

  async getWordCount() {
    try {
      return (await this.editor?.command?.getWordCount?.()) || 0;
    } catch {
      return 0;
    }
  }

  onChange(callback) {
    this.onChangeCallback = callback;
  }

  /**
   * Mount canvas-editor into the supplied container element.
   * Lazily imports the canvas-editor package on first call.
   *
   * @param {HTMLElement} container - DOM element that will host the editor
   * @param {object} hwpxDoc - parsed HWPXDocument from parser.js
   * @param {object} [options] - canvas-editor IEditorOption overrides
   */
  async mount(container, hwpxDoc, options = {}) {
    if (!container) throw new Error('CanvasEditorAdapter.mount requires a container element');

    const mod = await import('@hufe921/canvas-editor');
    const Editor = mod.default || mod.Editor;
    if (!Editor) throw new Error('Failed to load @hufe921/canvas-editor');

    if (this.editor) this.destroy();

    this.container = container;
    const data = hwpxDoc ? hwpxToCanvasEditor(hwpxDoc) : { main: [{ value: '\n' }] };
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    this.editor = new Editor(container, data, mergedOptions);
    this._loaded = true;

    if (this.editor.listener) {
      this.editor.listener.contentChange = () => this._handleContentChange();
      this.editor.listener.rangeStyleChange = style => this._handleRangeStyleChange(style);
      this.editor.listener.pageSizeChange = total => this._handlePageSizeChange(total);
      this.editor.listener.intersectionPageNoChange = current =>
        this._handleIntersectionPageNo(current);
    }

    logger.info('✅ canvas-editor mounted');
    return this.editor;
  }

  _handleRangeStyleChange(style) {
    for (const cb of this._rangeStyleListeners) {
      try {
        cb(style);
      } catch (err) {
        logger.warn('rangeStyleChange listener threw:', err);
      }
    }
  }

  _emitPageInfo() {
    const snapshot = { ...this._pageInfo };
    for (const cb of this._pageInfoListeners) {
      try {
        cb(snapshot);
      } catch (err) {
        logger.warn('pageInfo listener threw:', err);
      }
    }
  }

  _handlePageSizeChange(total) {
    if (typeof total !== 'number' || total < 1) return;
    this._pageInfo = { ...this._pageInfo, total };
    this._emitPageInfo();
  }

  _handleIntersectionPageNo(current) {
    if (typeof current !== 'number') return;
    // canvas-editor pageNo 는 0-base — UI 는 1-base
    this._pageInfo = { ...this._pageInfo, current: current + 1 };
    this._emitPageInfo();
  }

  /**
   * Replace the editor's document with a freshly parsed HWPX document.
   * @param {object} hwpxDoc
   */
  loadDocument(hwpxDoc) {
    if (!this.editor) throw new Error('CanvasEditorAdapter.loadDocument called before mount');
    const data = hwpxToCanvasEditor(hwpxDoc);
    if (typeof this.editor.command?.executeSetValue === 'function') {
      this.editor.command.executeSetValue(data);
    }
  }

  /**
   * Read the current editor state and convert back to a HWPX-shaped document.
   * @returns {object|null}
   */
  getDocument() {
    if (!this.editor) return null;
    const result = this.editor.command?.getValue?.();
    if (!result?.data) return null;
    return canvasEditorToHwpx(result.data);
  }

  /**
   * @returns {object|null} Raw canvas-editor IEditorResult (debug / power users)
   */
  getRawValue() {
    if (!this.editor) return null;
    return this.editor.command?.getValue?.() || null;
  }

  setReadonly(readonly) {
    if (!this.editor?.command?.executeMode) return;
    this.editor.command.executeMode(readonly ? 'readonly' : 'edit');
  }

  /**
   * canvas-editor 의 페이지 이미지(PNG data URL 배열)를 jsPDF 로 묶어 PDF 다운로드.
   * @param {string} [filename]
   */
  async exportPDF(filename = '문서.pdf') {
    if (!this.editor?.command?.getImage) throw new Error('canvas-editor not ready');
    const images = await this.editor.command.getImage({ pixelRatio: 2 });
    if (!images || images.length === 0) throw new Error('렌더된 페이지가 없습니다');

    const { jsPDF } = await import('jspdf');
    const opts = this.editor.command.getOptions?.();
    const paperWidth = opts?.width ?? 794; // px
    const paperHeight = opts?.height ?? 1123; // px
    const orientation = paperWidth > paperHeight ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      unit: 'px',
      format: [paperWidth, paperHeight],
      orientation,
      hotfixes: ['px_scaling'],
    });

    for (let i = 0; i < images.length; i += 1) {
      if (i > 0) pdf.addPage([paperWidth, paperHeight], orientation);
      pdf.addImage(images[i], 'PNG', 0, 0, paperWidth, paperHeight, undefined, 'FAST');
    }
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return true;
  }

  /**
   * 브라우저 인쇄 다이얼로그 — canvas-editor 내장 print 사용.
   */
  async print() {
    if (!this.editor?.command?.print) throw new Error('canvas-editor not ready');
    return this.editor.command.print();
  }

  destroy() {
    if (this.changeDebounceTimer) {
      clearTimeout(this.changeDebounceTimer);
      this.changeDebounceTimer = null;
    }
    if (this.editor?.destroy) {
      try {
        this.editor.destroy();
      } catch (err) {
        logger.warn('canvas-editor destroy threw:', err);
      }
    }
    this.editor = null;
    this.container = null;
    this._loaded = false;
    this._rangeStyleListeners.clear();
    this._pageInfoListeners.clear();
  }

  _handleContentChange() {
    if (!this.onChangeCallback) return;
    if (this.changeDebounceTimer) clearTimeout(this.changeDebounceTimer);
    this.changeDebounceTimer = setTimeout(() => {
      this.changeDebounceTimer = null;
      try {
        this.onChangeCallback(this.getDocument());
      } catch (err) {
        logger.error('onChange callback threw:', err);
      }
    }, 150);
  }
}

export default CanvasEditorAdapter;
