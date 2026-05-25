/**
 * Equation Palette
 *
 * 자주 쓰는 수식 기호 / 구조를 빠르게 삽입하기 위한 버튼 그리드.
 * 각 버튼은 클릭 시 편집기 핸들의 `insert(latex)` 를 호출한다.
 *
 * 카탈로그:
 *   - basics    : 분수, 제곱근, n제곱근
 *   - bigops    : 합/곱/적분/극한 (∑ ∏ ∫ lim)
 *   - relations : ≤ ≥ ≠ ± × ÷ ∞
 *   - greek     : 그리스 문자 (소/대)
 *   - structures: 행렬, fenced, 한정자 ∀∃
 *
 * 키보드 단축키:
 *   - Ctrl+/ : 분수 (\frac{·}{·})
 *   - Ctrl+R : 제곱근 (\sqrt{·})
 *   - Ctrl+6 : 위첨자 (^{·})
 *   - Ctrl+- : 아래첨자 (_{·})
 *
 * 단축키는 `bindShortcuts(target, handle)` 를 명시적으로 호출했을 때만 활성화된다.
 *
 * @module lib/vanilla/equation-editor/equation-palette
 * @version 1.0.0
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   latex: string,
 *   aria?: string,
 *   group: 'basics' | 'bigops' | 'relations' | 'greek' | 'structures',
 *   shortcut?: string,
 * }} PaletteItem
 */

/** @type {PaletteItem[]} */
export const PALETTE_CATALOG = Object.freeze([
    // ── basics ───────────────────────────────────────────────────────────────
    { id: 'frac', group: 'basics', label: 'a/b', aria: '분수', latex: '\\frac{}{}', shortcut: 'Ctrl+/' },
    { id: 'sqrt', group: 'basics', label: '√', aria: '제곱근', latex: '\\sqrt{}', shortcut: 'Ctrl+R' },
    { id: 'nroot', group: 'basics', label: 'ⁿ√', aria: 'n제곱근', latex: '\\sqrt[n]{}' },
    { id: 'sup', group: 'basics', label: 'x²', aria: '위첨자', latex: '^{}', shortcut: 'Ctrl+6' },
    { id: 'sub', group: 'basics', label: 'x₁', aria: '아래첨자', latex: '_{}', shortcut: 'Ctrl+-' },

    // ── big operators ───────────────────────────────────────────────────────
    { id: 'sum', group: 'bigops', label: '∑', aria: '시그마', latex: '\\sum_{}^{}' },
    { id: 'prod', group: 'bigops', label: '∏', aria: '프로덕트', latex: '\\prod_{}^{}' },
    { id: 'int', group: 'bigops', label: '∫', aria: '적분', latex: '\\int_{}^{}' },
    { id: 'lim', group: 'bigops', label: 'lim', aria: '극한', latex: '\\lim_{x\\to }' },

    // ── relations / operators ───────────────────────────────────────────────
    { id: 'le', group: 'relations', label: '≤', aria: '작거나 같음', latex: '\\le' },
    { id: 'ge', group: 'relations', label: '≥', aria: '크거나 같음', latex: '\\ge' },
    { id: 'neq', group: 'relations', label: '≠', aria: '같지 않음', latex: '\\neq' },
    { id: 'pm', group: 'relations', label: '±', aria: '플러스 마이너스', latex: '\\pm' },
    { id: 'mp', group: 'relations', label: '∓', aria: '마이너스 플러스', latex: '\\mp' },
    { id: 'times', group: 'relations', label: '×', aria: '곱하기', latex: '\\times' },
    { id: 'div', group: 'relations', label: '÷', aria: '나누기', latex: '\\div' },
    { id: 'cdot', group: 'relations', label: '·', aria: '센터 닷', latex: '\\cdot' },
    { id: 'infty', group: 'relations', label: '∞', aria: '무한대', latex: '\\infty' },
    { id: 'partial', group: 'relations', label: '∂', aria: '편미분', latex: '\\partial' },
    { id: 'to', group: 'relations', label: '→', aria: '오른쪽 화살표', latex: '\\to' },

    // ── greek letters ───────────────────────────────────────────────────────
    { id: 'alpha', group: 'greek', label: 'α', aria: '알파', latex: '\\alpha' },
    { id: 'beta', group: 'greek', label: 'β', aria: '베타', latex: '\\beta' },
    { id: 'gamma', group: 'greek', label: 'γ', aria: '감마', latex: '\\gamma' },
    { id: 'delta', group: 'greek', label: 'δ', aria: '델타', latex: '\\delta' },
    { id: 'theta', group: 'greek', label: 'θ', aria: '세타', latex: '\\theta' },
    { id: 'lambda', group: 'greek', label: 'λ', aria: '람다', latex: '\\lambda' },
    { id: 'mu', group: 'greek', label: 'μ', aria: '뮤', latex: '\\mu' },
    { id: 'pi', group: 'greek', label: 'π', aria: '파이', latex: '\\pi' },
    { id: 'sigma', group: 'greek', label: 'σ', aria: '시그마(소)', latex: '\\sigma' },
    { id: 'phi', group: 'greek', label: 'φ', aria: '파이(소)', latex: '\\phi' },
    { id: 'omega', group: 'greek', label: 'ω', aria: '오메가', latex: '\\omega' },
    { id: 'Gamma', group: 'greek', label: 'Γ', aria: '대감마', latex: '\\Gamma' },
    { id: 'Delta', group: 'greek', label: 'Δ', aria: '대델타', latex: '\\Delta' },
    { id: 'Sigma', group: 'greek', label: 'Σ', aria: '대시그마', latex: '\\Sigma' },
    { id: 'Omega', group: 'greek', label: 'Ω', aria: '대오메가', latex: '\\Omega' },

    // ── structures / quantifiers ────────────────────────────────────────────
    { id: 'matrix', group: 'structures', label: '⎡⎤', aria: '2×2 행렬', latex: '\\begin{matrix} & \\\\ & \\end{matrix}' },
    { id: 'fenced', group: 'structures', label: '(·)', aria: '괄호', latex: '\\left( \\right)' },
    { id: 'forall', group: 'structures', label: '∀', aria: '모든', latex: '\\forall ' },
    { id: 'exists', group: 'structures', label: '∃', aria: '존재', latex: '\\exists ' },
    { id: 'in', group: 'structures', label: '∈', aria: '원소', latex: '\\in ' },
    { id: 'notin', group: 'structures', label: '∉', aria: '비원소', latex: '\\notin ' },
]);

/**
 * 카테고리 라벨 (UI 그룹 헤더).
 */
export const PALETTE_GROUPS = Object.freeze([
    { id: 'basics', label: '기본' },
    { id: 'bigops', label: '큰 연산자' },
    { id: 'relations', label: '관계/연산' },
    { id: 'greek', label: '그리스 문자' },
    { id: 'structures', label: '구조/한정자' },
]);

/**
 * @typedef {Object} PaletteHandle
 * @property {HTMLElement} element
 * @property {(id: string) => void} insertById          버튼 ID 로 강제 삽입(테스트용)
 * @property {() => void} destroy
 */

/**
 * @typedef {Object} PaletteOptions
 * @property {Document} [document]
 * @property {(latex: string, item: PaletteItem) => void} onInsert  버튼 클릭 핸들러
 * @property {string[]} [groups]                                    필터링할 그룹 ID
 */

/**
 * 컨테이너에 팔레트 UI 를 마운트한다.
 *
 * @param {HTMLElement} container
 * @param {PaletteOptions} options
 * @returns {PaletteHandle}
 */
export function attachPalette(container, options) {
    if (!container || typeof container.appendChild !== 'function') {
        throw new TypeError('attachPalette: container is required');
    }
    if (!options || typeof options.onInsert !== 'function') {
        throw new TypeError('attachPalette: onInsert callback is required');
    }
    const doc = options.document || container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) throw new Error('attachPalette: no document available');

    const groupFilter = Array.isArray(options.groups) && options.groups.length
        ? new Set(options.groups)
        : null;

    const root = doc.createElement('div');
    root.className = 'hwpx-equation-palette';
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', '수식 기호 팔레트');

    const buttonsById = new Map();

    for (const group of PALETTE_GROUPS) {
        if (groupFilter && !groupFilter.has(group.id)) continue;
        const items = PALETTE_CATALOG.filter((it) => it.group === group.id);
        if (items.length === 0) continue;

        const section = doc.createElement('div');
        section.className = `hwpx-equation-palette__group hwpx-equation-palette__group--${group.id}`;
        section.setAttribute('role', 'group');
        section.setAttribute('aria-label', group.label);

        const heading = doc.createElement('div');
        heading.className = 'hwpx-equation-palette__group-label';
        heading.textContent = group.label;
        section.appendChild(heading);

        const grid = doc.createElement('div');
        grid.className = 'hwpx-equation-palette__grid';

        for (const item of items) {
            const btn = doc.createElement('button');
            btn.type = 'button';
            btn.className = 'hwpx-equation-palette__btn';
            btn.dataset.paletteId = item.id;
            btn.dataset.latex = item.latex;
            btn.setAttribute('aria-label', item.aria || item.label);
            if (item.shortcut) btn.setAttribute('title', `${item.aria || item.label} (${item.shortcut})`);
            btn.textContent = item.label;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                options.onInsert(item.latex, item);
            });
            grid.appendChild(btn);
            buttonsById.set(item.id, btn);
        }

        section.appendChild(grid);
        root.appendChild(section);
    }
    container.appendChild(root);

    /** @type {PaletteHandle} */
    const handle = {
        element: root,
        insertById: (id) => {
            const item = PALETTE_CATALOG.find((it) => it.id === id);
            if (!item) return;
            options.onInsert(item.latex, item);
        },
        destroy: () => {
            buttonsById.clear();
            if (root.parentNode) root.parentNode.removeChild(root);
        },
    };
    return handle;
}

/**
 * 키보드 단축키 핸들러를 바인딩한다.
 *
 * @param {EventTarget} target  보통 편집기 element 또는 modal root
 * @param {(latex: string, item: PaletteItem) => void} onInsert
 * @returns {() => void}        unbind
 */
export function bindShortcuts(target, onInsert) {
    if (!target || typeof target.addEventListener !== 'function') {
        return () => { /* noop */ };
    }
    if (typeof onInsert !== 'function') return () => { /* noop */ };

    const shortcuts = PALETTE_CATALOG.filter((it) => it.shortcut);

    const handler = (/** @type {KeyboardEvent} */ ev) => {
        // mathlive 가 native 단축키를 처리할 수 있도록, Ctrl/Meta 가 함께 눌린 경우만 가로챈다
        if (!ev || (!ev.ctrlKey && !ev.metaKey)) return;
        const key = ev.key;
        for (const item of shortcuts) {
            if (matchesShortcut(item.shortcut, ev.ctrlKey || ev.metaKey, ev.shiftKey, key)) {
                ev.preventDefault();
                onInsert(item.latex, item);
                return;
            }
        }
    };

    target.addEventListener('keydown', handler);
    return () => target.removeEventListener('keydown', handler);
}

function matchesShortcut(shortcut, ctrl, shift, key) {
    // 형식: "Ctrl+/" / "Ctrl+R" / "Ctrl+Shift+M" 등
    const parts = shortcut.split('+').map((p) => p.trim());
    let needCtrl = false;
    let needShift = false;
    let needKey = '';
    for (const p of parts) {
        if (p.toLowerCase() === 'ctrl' || p.toLowerCase() === 'cmd' || p.toLowerCase() === 'meta') needCtrl = true;
        else if (p.toLowerCase() === 'shift') needShift = true;
        else needKey = p;
    }
    if (needCtrl !== ctrl) return false;
    if (needShift !== shift) return false;
    return needKey.toLowerCase() === String(key).toLowerCase();
}

export default {
    PALETTE_CATALOG,
    PALETTE_GROUPS,
    attachPalette,
    bindShortcuts,
};
