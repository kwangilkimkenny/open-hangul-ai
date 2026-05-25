/**
 * OLE 인플레이스 편집 모달
 * ─────────────────────────────────────────────────────────────────────────────
 * 한컴 한글의 OLE 객체 더블클릭 → 인플레이스 편집 UX 를 브라우저에서 재현한다.
 *
 * 동작 흐름
 *   1. `openOleEditDialog({ oleData, filename, onSave })` 호출
 *   2. 내부에서 `decodeOle()` 으로 콘텐츠 디코딩
 *   3. 타입에 따라 `ExcelEditor` / `WordEditor` / read-only viewer 분기
 *   4. "저장" 클릭 시 `reserializeOle()` 로 새 OLE 바이너리 생성 후 콜백
 *   5. "취소" 또는 ESC 키로 닫기
 *
 * 보안
 *   - 모달은 외부 fetch 없음
 *   - 매크로/스크립트 평가 없음
 *
 * @module vanilla/ole-editor/ole-edit-dialog
 */

import { decodeOle } from './ole-content-decoder.js';
import { ExcelEditor } from './excel-editor.js';
import { WordEditor } from './word-editor.js';
import { reserializeOle } from './ole-reserializer.js';
import { t } from '../i18n/index.js';

const DIALOG_CLASS = 'ole-edit-dialog';

/**
 * @typedef {Object} OpenOleEditDialogOptions
 * @property {Uint8Array|{data:Uint8Array,filename?:string}} oleData
 * @property {string} [filename]
 * @property {HTMLElement} [root]  마운트 대상. 기본 document.body
 * @property {(payload:{bytes:Uint8Array, mimeType:string, extension:string, dataModel:object}) => void|Promise<void>} [onSave]
 * @property {() => void} [onCancel]
 * @property {boolean} [readOnly]  true 면 저장 버튼 숨김
 */

/**
 * OLE 편집 모달을 연다.
 *
 * @param {OpenOleEditDialogOptions} opts
 * @returns {Promise<{close:() => void, getState:() => 'editing'|'saved'|'cancelled'|'unsupported'}>}
 */
export async function openOleEditDialog(opts) {
  if (!opts || !opts.oleData) {
    throw new Error('openOleEditDialog: oleData is required');
  }
  const root = opts.root || (typeof document !== 'undefined' ? document.body : null);
  if (!root) throw new Error('openOleEditDialog: no DOM root available');

  // Build modal scaffold
  const overlay = document.createElement('div');
  overlay.className = `${DIALOG_CLASS}__overlay`;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const dialog = document.createElement('div');
  dialog.className = DIALOG_CLASS;

  const header = document.createElement('div');
  header.className = `${DIALOG_CLASS}__header`;
  const title = document.createElement('h3');
  title.className = `${DIALOG_CLASS}__title`;
  title.textContent = opts.filename || t('ole.default.title');
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = `${DIALOG_CLASS}__close`;
  closeBtn.setAttribute('aria-label', t('common.close'));
  closeBtn.textContent = '×';
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = `${DIALOG_CLASS}__body`;
  dialog.appendChild(body);

  const footer = document.createElement('div');
  footer.className = `${DIALOG_CLASS}__footer`;
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = `${DIALOG_CLASS}__btn ${DIALOG_CLASS}__btn--cancel`;
  cancelBtn.textContent = t('ole.cancel.button');
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = `${DIALOG_CLASS}__btn ${DIALOG_CLASS}__btn--save`;
  saveBtn.textContent = t('ole.save.button');
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  dialog.appendChild(footer);

  overlay.appendChild(dialog);
  root.appendChild(overlay);

  // State
  let state = 'editing';
  /** @type {ExcelEditor|WordEditor|null} */
  let editor = null;
  /** @type {object|null} */
  let decoded = null;

  const close = () => {
    if (editor && typeof editor.destroy === 'function') {
      try {
        editor.destroy();
      } catch {
        /* ignore */
      }
    }
    document.removeEventListener('keydown', onKey);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  const cancel = () => {
    if (state === 'editing') state = 'cancelled';
    try {
      opts.onCancel?.();
    } finally {
      close();
    }
  };

  const onKey = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };
  document.addEventListener('keydown', onKey);

  closeBtn.addEventListener('click', cancel);
  cancelBtn.addEventListener('click', cancel);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) cancel();
  });

  // Decode + build editor
  try {
    decoded = await decodeOle(opts.oleData, opts.filename);
  } catch (err) {
    decoded = { type: 'unsupported', message: `Decode failed: ${err?.message || err}` };
  }

  // 타입별 렌더 디스패처 — 새 타입 추가 시 이 객체에만 한 줄 추가.
  // null 반환 = 편집 불가 (저장 버튼 숨김).
  const EDITOR_FACTORIES = {
    excel: (b, d) => {
      const ed = new ExcelEditor({ container: b, dataModel: d });
      ed.render();
      return ed;
    },
    word: (b, d) => {
      const ed = new WordEditor({ container: b, dataModel: d });
      ed.render();
      return ed;
    },
    powerpoint: (b, d) => {
      const list = document.createElement('div');
      list.className = `${DIALOG_CLASS}__viewer`;
      for (const slide of d.slides || []) {
        const sl = document.createElement('section');
        sl.className = `${DIALOG_CLASS}__slide`;
        if (slide.title) {
          const h = document.createElement('h4');
          h.textContent = slide.title;
          sl.appendChild(h);
        }
        for (const line of slide.body || []) {
          const p = document.createElement('p');
          p.textContent = line;
          sl.appendChild(p);
        }
        list.appendChild(sl);
      }
      b.appendChild(list);
      return null; // read-only viewer
    },
  };

  const renderUnsupported = (message) => {
    state = 'unsupported';
    body.innerHTML = '';
    const note = document.createElement('div');
    note.className = `${DIALOG_CLASS}__unsupported`;
    note.textContent = message;
    body.appendChild(note);
    saveBtn.disabled = true;
    saveBtn.style.display = 'none';
  };

  if (!decoded || decoded.type === 'unsupported') {
    renderUnsupported(decoded?.message || t('ole.unsupported.message'));
  } else if (EDITOR_FACTORIES[decoded.type]) {
    editor = EDITOR_FACTORIES[decoded.type](body, decoded);
    if (!editor) {
      // viewer-only (powerpoint)
      state = 'unsupported';
      saveBtn.disabled = true;
      saveBtn.style.display = 'none';
    }
  } else {
    renderUnsupported(t('ole.unsupported.format', { type: decoded.type }));
  }

  if (opts.readOnly) {
    saveBtn.style.display = 'none';
  }

  saveBtn.addEventListener('click', async () => {
    if (!editor) return;
    saveBtn.disabled = true;
    saveBtn.textContent = t('ole.saving.indicator');
    try {
      const dataModel = editor.getDataModel();
      // ExcelEditor.getDataModel() 은 type 을 포함하지 않으므로 디코딩 결과에서 보강
      if (!dataModel.type && decoded?.type) {
        dataModel.type = decoded.type;
      }
      const result = await reserializeOle(dataModel);
      state = 'saved';
      await opts.onSave?.({ ...result, dataModel });
      close();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = t('ole.save.button');
      const error = document.createElement('div');
      error.className = `${DIALOG_CLASS}__error`;
      error.textContent = t('ole.save.error', { message: err?.message || err });
      body.appendChild(error);
    }
  });

  return {
    close,
    getState: () => state,
    /** @internal — 테스트 용 접근자 */
    _internals: { overlay, dialog, editor: () => editor, decoded: () => decoded, saveBtn, cancelBtn },
  };
}
