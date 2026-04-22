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

    logger.info('🎨 CanvasEditorAdapter initialized');
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
    }

    logger.info('✅ canvas-editor mounted');
    return this.editor;
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
