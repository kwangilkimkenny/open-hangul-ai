/**
 * Equation Dialog
 *
 * "수식 삽입" 모달.
 *
 *   ┌────────────────────────────────────────────┐
 *   │ 수식 편집                            ✕     │
 *   ├────────────────────────────────────────────┤
 *   │ [팔레트: 분수 √ ∑ ∫ α β …]                  │
 *   │ ┌──────────────────────────────────────┐  │
 *   │ │  <math-field>  (mathlive)            │  │
 *   │ └──────────────────────────────────────┘  │
 *   │ 미리보기: x^2 + y^2 = z^2                  │
 *   │  (KaTeX 렌더)                              │
 *   ├────────────────────────────────────────────┤
 *   │                       [취소]   [삽입]      │
 *   └────────────────────────────────────────────┘
 *
 * `openEquationDialog()` 는 Promise 를 반환하며,
 *   - 삽입 시  : { latex, mathml, hancomScript }
 *   - 취소 시  : null
 *
 * @module lib/vanilla/equation-editor/equation-dialog
 * @version 1.0.0
 */

import { attachEquationEditor } from './equation-editor.js';
import { attachPalette, bindShortcuts } from './equation-palette.js';
import { hancomScriptToLatex, latexToHancomScript } from './hancom-bridge.js';
import { renderKaTeXFromMathML } from '../math/mathml-katex-bridge.js';
import { hancomToMathML } from '../math/hancom-math-converter.js';

const DIALOG_CLASS = 'hwpx-equation-dialog';

/**
 * @typedef {Object} EquationDialogResult
 * @property {string} latex
 * @property {string} mathml
 * @property {string} hancomScript
 */

/**
 * @typedef {Object} EquationDialogOptions
 * @property {string} [initialLatex]            초기 LaTeX 값
 * @property {string} [initialHancomScript]     초기 한컴 표기 (LaTeX 우선)
 * @property {Document} [document]              테스트용 주입 가능한 document
 * @property {boolean} [autoFocus=true]
 * @property {boolean} [virtualKeyboard=false]
 */

/**
 * 모달을 띄우고 사용자의 입력을 받아 반환한다.
 *
 * @param {EquationDialogOptions} [options]
 * @returns {Promise<EquationDialogResult | null>}
 */
export async function openEquationDialog(options = {}) {
    const doc = ('document' in options)
        ? options.document
        : (typeof document !== 'undefined' ? document : null);
    if (!doc) {
        // 헤드리스 환경 — 즉시 null
        return null;
    }

    // 초기값: LaTeX 우선, 없으면 한컴 표기를 LaTeX 로 변환
    let initialLatex = typeof options.initialLatex === 'string' ? options.initialLatex : '';
    if (!initialLatex && options.initialHancomScript) {
        initialLatex = hancomScriptToLatex(options.initialHancomScript);
    }

    return new Promise((resolve) => {
        const { overlay, root, editorHost, paletteHost, previewEl, insertBtn, cancelBtn, closeBtn, cleanup } =
            buildDialog(doc);

        let editorHandle = null;
        let paletteHandle = null;
        let unbindShortcuts = () => { /* noop */ };
        let lastLatex = initialLatex;

        const finish = (value) => {
            try { unbindShortcuts(); } catch { /* noop */ }
            try { paletteHandle?.destroy(); } catch { /* noop */ }
            try { editorHandle?.destroy(); } catch { /* noop */ }
            cleanup();
            resolve(value);
        };

        const renderPreview = async (latex) => {
            lastLatex = latex || '';
            if (!previewEl) return;
            if (!latex) {
                previewEl.textContent = '미리보기';
                previewEl.classList.add('is-empty');
                return;
            }
            previewEl.classList.remove('is-empty');
            try {
                // mathml 우선 — mathlive 가 있으면 정확한 MathML 을 사용
                let mathml = editorHandle ? editorHandle.getMathML() : '';
                if (!mathml) {
                    // fallback: 한컴 표기 경유 — 안전한 동기 MathML 변환
                    const script = latexToHancomScript(latex);
                    mathml = hancomToMathML(script);
                }
                const html = await renderKaTeXFromMathML(mathml || '');
                previewEl.innerHTML = html || escapeHtml(latex);
            } catch {
                previewEl.textContent = latex;
            }
        };

        // 1) 편집기 마운트
        attachEquationEditor(editorHost, {
            value: initialLatex,
            virtualKeyboard: options.virtualKeyboard === true,
            document: doc,
        }).then((handle) => {
            editorHandle = handle;
            handle.on('change', (latex) => {
                renderPreview(latex);
            });
            if (options.autoFocus !== false) {
                try { handle.focus(); } catch { /* noop */ }
            }
            renderPreview(initialLatex);
        }).catch(() => {
            // 편집기 마운트 실패 시에도 모달은 유지 — 사용자가 취소 가능
        });

        // 2) 팔레트 마운트
        paletteHandle = attachPalette(paletteHost, {
            document: doc,
            onInsert: (latex) => {
                if (editorHandle) {
                    editorHandle.insert(latex);
                    renderPreview(editorHandle.getValue());
                } else {
                    lastLatex = (lastLatex || '') + latex;
                    renderPreview(lastLatex);
                }
            },
        });

        // 3) 단축키
        unbindShortcuts = bindShortcuts(root, (latex) => {
            if (editorHandle) {
                editorHandle.insert(latex);
                renderPreview(editorHandle.getValue());
            }
        });

        // 4) 버튼 핸들러
        const onInsert = () => {
            const latex = editorHandle ? editorHandle.getValue() : lastLatex;
            const mathml = editorHandle ? editorHandle.getMathML() : hancomToMathML(latexToHancomScript(latex));
            const hancomScript = latexToHancomScript(latex);
            finish({ latex, mathml, hancomScript });
        };
        const onCancel = () => finish(null);

        insertBtn.addEventListener('click', onInsert);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);

        // 5) Esc / Enter (단, mathlive 가 Enter 를 가로채면 그대로 전달)
        const onKey = (/** @type {KeyboardEvent} */ ev) => {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                onCancel();
            }
        };
        root.addEventListener('keydown', onKey);

        // 오버레이 클릭으로 외부 영역에서 닫지 않도록 — 의도하지 않은 손실 방지
        overlay.addEventListener('mousedown', (ev) => {
            if (ev.target === overlay) ev.stopPropagation();
        });
    });
}

// ============================================================================
// DOM builder
// ============================================================================

function buildDialog(doc) {
    const overlay = doc.createElement('div');
    overlay.className = `${DIALOG_CLASS}-overlay`;
    overlay.setAttribute('role', 'presentation');
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '99999',
    });

    const root = doc.createElement('div');
    root.className = DIALOG_CLASS;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '수식 편집');
    Object.assign(root.style, {
        background: '#fff',
        color: '#222',
        padding: '16px 18px',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        minWidth: '480px',
        maxWidth: '720px',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    });

    // 헤더
    const header = doc.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '4px',
    });
    const title = doc.createElement('h3');
    title.textContent = '수식 편집';
    title.style.margin = '0';
    title.style.fontSize = '15px';
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = `${DIALOG_CLASS}-close`;
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
    });
    header.appendChild(title);
    header.appendChild(closeBtn);

    // 팔레트 호스트
    const paletteHost = doc.createElement('div');
    paletteHost.className = `${DIALOG_CLASS}-palette`;

    // 편집기 호스트
    const editorHost = doc.createElement('div');
    editorHost.className = `${DIALOG_CLASS}-editor`;
    Object.assign(editorHost.style, {
        border: '1px solid #c8c8c8',
        borderRadius: '4px',
        padding: '8px',
        minHeight: '60px',
        background: '#fafafa',
    });

    // 미리보기
    const previewLabel = doc.createElement('div');
    previewLabel.textContent = '미리보기';
    Object.assign(previewLabel.style, {
        fontSize: '12px',
        color: '#666',
        marginBottom: '2px',
    });
    const previewEl = doc.createElement('div');
    previewEl.className = `${DIALOG_CLASS}-preview`;
    previewEl.setAttribute('aria-live', 'polite');
    Object.assign(previewEl.style, {
        border: '1px dashed #ddd',
        borderRadius: '4px',
        padding: '10px',
        minHeight: '40px',
        background: '#fff',
        textAlign: 'center',
    });

    // 액션
    const actions = doc.createElement('div');
    Object.assign(actions.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '4px',
    });
    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = `${DIALOG_CLASS}-cancel`;
    cancelBtn.textContent = '취소';
    Object.assign(cancelBtn.style, {
        padding: '6px 14px',
        border: '1px solid #c8c8c8',
        background: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
    });
    const insertBtn = doc.createElement('button');
    insertBtn.type = 'button';
    insertBtn.className = `${DIALOG_CLASS}-insert`;
    insertBtn.textContent = '삽입';
    Object.assign(insertBtn.style, {
        padding: '6px 14px',
        border: '1px solid #2962ff',
        background: '#2962ff',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(insertBtn);

    root.appendChild(header);
    root.appendChild(paletteHost);
    root.appendChild(editorHost);
    root.appendChild(previewLabel);
    root.appendChild(previewEl);
    root.appendChild(actions);

    overlay.appendChild(root);
    doc.body.appendChild(overlay);

    const cleanup = () => {
        try { overlay.parentNode?.removeChild(overlay); } catch { /* noop */ }
    };

    return { overlay, root, editorHost, paletteHost, previewEl, insertBtn, cancelBtn, closeBtn, cleanup };
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export default {
    openEquationDialog,
};
