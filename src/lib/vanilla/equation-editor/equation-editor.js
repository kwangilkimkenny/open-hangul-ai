/**
 * Equation Editor
 *
 * mathlive (`<math-field>` Custom Element) 기반 WYSIWYG 수식 편집기.
 * 컨테이너에 마운트하고 LaTeX / MathML 양방향 입출력을 제공한다.
 *
 * - LaTeX 가 mathlive 의 1차 표현이며, MathML 은 `getMathML()` 로 별도 추출
 *   (mathlive 의 `getValue('math-ml')`).
 * - mathlive 모듈은 dynamic import 로 게으르게 로드 ('jsdom' 환경에서
 *   Custom Element 가 없을 때도 모듈 자체의 import 가 실패하지 않도록 한다).
 * - mathlive 가 로드되지 않은 환경(테스트/SSR) 에서는 fallback 으로 일반
 *   `<textarea>` 를 사용한다 — 동일한 `getValue/setValue/on('change')` 인터페이스를
 *   유지하므로 단위 테스트에서도 동작한다.
 *
 * 사용 예:
 *   const ed = await attachEquationEditor(container, { value: 'x^2 + y^2 = z^2' });
 *   ed.getValue();              // 'x^2 + y^2 = z^2'
 *   ed.setValue('\\frac{a}{b}');
 *   ed.getMathML();             // '<math ...>...</math>'
 *   ed.on('change', (latex) => console.log(latex));
 *
 * @module lib/vanilla/equation-editor/equation-editor
 * @version 1.0.0
 */

/** 동적 import 가 한 번만 일어나도록 캐시 */
let mathliveModulePromise = null;

/**
 * mathlive 모듈을 게으르게 로드한다.
 * jsdom 등 Custom Element 가 없는 환경에서는 null 을 반환한다.
 * @returns {Promise<any | null>}
 */
export async function loadMathlive() {
    if (mathliveModulePromise) return mathliveModulePromise;
    mathliveModulePromise = (async () => {
        try {
            // Custom Element 지원 여부 사전 체크 — jsdom 에서는 false 일 수 있다
            if (typeof window === 'undefined' || !window.customElements) return null;
            const mod = await import('mathlive');
            return mod.default || mod;
        } catch {
            return null;
        }
    })();
    return mathliveModulePromise;
}

/**
 * @typedef {Object} EquationEditorHandle
 * @property {() => string} getValue                LaTeX 표기를 반환
 * @property {(latex: string) => void} setValue     LaTeX 표기를 설정
 * @property {() => string} getMathML               MathML XML 을 반환
 * @property {(latex: string) => void} insert       현재 caret 위치에 LaTeX 삽입
 * @property {(event: 'change'|'focus'|'blur', cb: Function) => () => void} on
 * @property {() => void} focus
 * @property {() => void} destroy
 * @property {HTMLElement} element                  실제 마운트된 요소(`<math-field>` 또는 fallback)
 * @property {boolean} usesMathlive                 mathlive 가 로드되어 사용 중인지 여부
 */

/**
 * @typedef {Object} EquationEditorOptions
 * @property {string} [value]                 초기 LaTeX 값
 * @property {boolean} [readOnly=false]
 * @property {boolean} [virtualKeyboard=false] mathlive 가상 키보드 활성화
 * @property {string} [placeholder]
 * @property {Document} [document]             테스트용 주입 가능한 document
 */

/**
 * 주어진 컨테이너에 수식 편집기를 마운트한다.
 *
 * @param {HTMLElement} container
 * @param {EquationEditorOptions} [options]
 * @returns {Promise<EquationEditorHandle>}
 */
export async function attachEquationEditor(container, options = {}) {
    if (!container || typeof container.appendChild !== 'function') {
        throw new TypeError('attachEquationEditor: container is required');
    }
    const doc = options.document || container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) throw new Error('attachEquationEditor: no document available');

    const initialValue = typeof options.value === 'string' ? options.value : '';
    const mathlive = await loadMathlive();

    if (mathlive && typeof doc.createElement === 'function') {
        return mountMathfield(doc, container, initialValue, options);
    }
    // fallback
    return mountFallback(doc, container, initialValue, options);
}

// ---------------------------------------------------------------------------
// mathlive backend
// ---------------------------------------------------------------------------

function mountMathfield(doc, container, initialValue, options) {
    const el = /** @type {any} */ (doc.createElement('math-field'));
    el.className = 'hwpx-equation-editor';
    el.setAttribute('role', 'math');
    el.setAttribute('aria-label', '수식 편집기');
    if (options.placeholder) el.setAttribute('placeholder', options.placeholder);
    if (options.readOnly) el.setAttribute('read-only', '');

    // 가상 키보드는 기본 off (모달과 충돌 방지)
    try {
        el.virtualKeyboardPolicy = options.virtualKeyboard ? 'auto' : 'manual';
    } catch { /* mathlive 미정의 환경 — 무시 */ }

    if (initialValue) {
        try { el.value = initialValue; } catch { /* noop */ }
    }
    container.appendChild(el);

    const listeners = new Map(); // event → Set<cb>
    const addListener = (event, cb) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(cb);
        return () => listeners.get(event)?.delete(cb);
    };
    const fire = (event, payload) => {
        const set = listeners.get(event);
        if (!set) return;
        for (const cb of Array.from(set)) {
            try { cb(payload); } catch { /* 콜백 오류는 무시 */ }
        }
    };

    const onInput = () => fire('change', safeGetValue(el, 'latex'));
    const onFocus = () => fire('focus', null);
    const onBlur = () => fire('blur', null);
    el.addEventListener('input', onInput);
    el.addEventListener('focus', onFocus);
    el.addEventListener('blur', onBlur);

    /** @type {EquationEditorHandle} */
    const handle = {
        element: el,
        usesMathlive: true,
        getValue: () => safeGetValue(el, 'latex'),
        setValue: (latex) => {
            try { el.value = String(latex ?? ''); } catch { /* noop */ }
        },
        getMathML: () => safeGetValue(el, 'math-ml'),
        insert: (latex) => {
            const s = String(latex ?? '');
            if (!s) return;
            try {
                if (typeof el.insert === 'function') el.insert(s);
                else if (typeof el.executeCommand === 'function') el.executeCommand(['insert', s]);
                else el.value = (el.value || '') + s;
            } catch { /* noop */ }
        },
        focus: () => {
            try { el.focus(); } catch { /* noop */ }
        },
        on: addListener,
        destroy: () => {
            el.removeEventListener('input', onInput);
            el.removeEventListener('focus', onFocus);
            el.removeEventListener('blur', onBlur);
            if (el.parentNode) el.parentNode.removeChild(el);
            listeners.clear();
        },
    };
    return handle;
}

function safeGetValue(el, format) {
    try {
        if (typeof el.getValue === 'function') {
            const v = el.getValue(format);
            if (typeof v === 'string') return v;
        }
        if (format === 'latex' && typeof el.value === 'string') return el.value;
    } catch { /* noop */ }
    return '';
}

// ---------------------------------------------------------------------------
// fallback backend (textarea)
// ---------------------------------------------------------------------------

function mountFallback(doc, container, initialValue, options) {
    const el = doc.createElement('textarea');
    el.className = 'hwpx-equation-editor hwpx-equation-editor--fallback';
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', '수식 편집기 (대체 텍스트 입력)');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('autocomplete', 'off');
    if (options.placeholder) el.setAttribute('placeholder', options.placeholder);
    if (options.readOnly) el.setAttribute('readonly', 'readonly');
    el.value = initialValue;
    container.appendChild(el);

    const listeners = new Map();
    const addListener = (event, cb) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(cb);
        return () => listeners.get(event)?.delete(cb);
    };
    const fire = (event, payload) => {
        const set = listeners.get(event);
        if (!set) return;
        for (const cb of Array.from(set)) {
            try { cb(payload); } catch { /* noop */ }
        }
    };
    const onInput = () => fire('change', el.value);
    const onFocus = () => fire('focus', null);
    const onBlur = () => fire('blur', null);
    el.addEventListener('input', onInput);
    el.addEventListener('focus', onFocus);
    el.addEventListener('blur', onBlur);

    /** @type {EquationEditorHandle} */
    const handle = {
        element: el,
        usesMathlive: false,
        getValue: () => el.value || '',
        setValue: (latex) => { el.value = String(latex ?? ''); },
        getMathML: () => latexToMathMLViaTrackJ(el.value),
        insert: (latex) => {
            const s = String(latex ?? '');
            if (!s) return;
            const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
            const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length;
            const before = el.value.slice(0, start);
            const after = el.value.slice(end);
            el.value = before + s + after;
            const caret = start + s.length;
            try { el.setSelectionRange(caret, caret); } catch { /* noop */ }
            fire('change', el.value);
        },
        focus: () => {
            try { el.focus(); } catch { /* noop */ }
        },
        on: addListener,
        destroy: () => {
            el.removeEventListener('input', onInput);
            el.removeEventListener('focus', onFocus);
            el.removeEventListener('blur', onBlur);
            if (el.parentNode) el.parentNode.removeChild(el);
            listeners.clear();
        },
    };
    return handle;
}

/**
 * fallback 환경에서 MathML 을 얻기 위한 우회 경로 — 트랙 J 의 KaTeX 브리지에서
 * `katexToMathml` 을 이용하면 LaTeX → MathML 가 가능하지만 동기 호출이 불가능하다.
 * 단위 테스트에서는 비어 있는 문자열을 반환해도 무방하므로, 호출 측에서 비동기
 * MathML 이 필요하면 별도로 `katexToMathml` 을 호출해야 한다.
 *
 * @param {string} latex
 * @returns {string}
 */
function latexToMathMLViaTrackJ(latex) {
    // 동기 컨텍스트 — MathML 변환은 별도 비동기 호출로 처리해야 한다.
    void latex;
    return '';
}

export default {
    loadMathlive,
    attachEquationEditor,
};
