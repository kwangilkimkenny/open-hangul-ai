/**
 * Chart Data Sheet (Vanilla)
 * ─────────────────────────────────────────────────────────────────────────────
 * 한컴 한글 차트 편집기의 "데이터 시트" 패널과 동일한 역할을 한다.
 * Excel-like 그리드 UI 로 카테고리(첫 행)와 데이터 시리즈(나머지 행)를 입력받아
 * 변경 사항을 콜백으로 외부에 통지한다.
 *
 * - 헤더 첫 셀(R0C0)은 "시리즈/카테고리" 라벨 자리 (편집 불가)
 * - 첫 행(R0C1..) = 카테고리 라벨
 * - 첫 열(R1C0..) = 시리즈 이름
 * - 나머지 (R>=1, C>=1) = 숫자 데이터
 * - Enter ⇒ 다음 행 동일 열, Tab ⇒ 다음 열, Shift+Tab ⇒ 이전 열
 * - 행 추가/삭제, 열 추가/삭제 버튼 제공
 *
 * 외부 DOM 라이브러리를 사용하지 않고 표준 DOM API 만 사용한다.
 *
 * @module vanilla/chart-editor/data-sheet
 * @version 1.0.0
 */

const DEFAULT_GRID = {
    categories: ['1월', '2월', '3월', '4월'],
    series: [
        { name: '매출', data: [10, 20, 15, 30] },
        { name: '비용', data: [5, 8, 12, 18] }
    ]
};

/**
 * @typedef {Object} SheetState
 * @property {string[]} categories
 * @property {Array<{name: string, data: number[], color?: string}>} series
 */

/**
 * 깊은 복제 (단순 구조 전용)
 */
function clone(state) {
    return {
        categories: [...state.categories],
        series: state.series.map(s => ({
            name: s.name,
            data: [...s.data],
            ...(s.color ? { color: s.color } : {})
        }))
    };
}

/**
 * 모든 시리즈 길이를 categories 와 동일하게 정렬한다 (0 으로 패딩).
 */
function normalize(state) {
    const cols = state.categories.length;
    for (const s of state.series) {
        if (s.data.length < cols) {
            s.data = [...s.data, ...new Array(cols - s.data.length).fill(0)];
        } else if (s.data.length > cols) {
            s.data = s.data.slice(0, cols);
        }
    }
    return state;
}

/**
 * 입력값을 안전한 숫자로 변환 (빈 문자열 → 0, NaN → 0).
 */
function toNumber(v) {
    if (v == null || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * 데이터 시트 컨트롤러를 생성한다.
 *
 * @param {HTMLElement} container - 마운트 대상 DIV
 * @param {Object} [options]
 * @param {SheetState} [options.initial]   - 초기 데이터
 * @param {(state: SheetState) => void} [options.onChange] - 변경 콜백
 * @returns {{
 *   getState: () => SheetState,
 *   setState: (s: SheetState) => void,
 *   addRow: () => void,
 *   removeRow: (idx?: number) => void,
 *   addColumn: () => void,
 *   removeColumn: (idx?: number) => void,
 *   focus: (row: number, col: number) => void,
 *   destroy: () => void
 * }}
 */
export function createDataSheet(container, options = {}) {
    if (!container || typeof container.appendChild !== 'function') {
        throw new TypeError('createDataSheet: container 가 유효한 DOM 요소가 아닙니다');
    }
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};

    /** @type {SheetState} */
    let state = normalize(clone(options.initial || DEFAULT_GRID));

    // ───── DOM 구축 ─────
    container.classList.add('hwp-chart-data-sheet');
    container.innerHTML = '';

    const toolbar = document.createElement('div');
    toolbar.className = 'hwp-chart-data-toolbar';

    const btnAddRow = document.createElement('button');
    btnAddRow.type = 'button';
    btnAddRow.textContent = '+ 행';
    btnAddRow.dataset.action = 'add-row';

    const btnDelRow = document.createElement('button');
    btnDelRow.type = 'button';
    btnDelRow.textContent = '− 행';
    btnDelRow.dataset.action = 'del-row';

    const btnAddCol = document.createElement('button');
    btnAddCol.type = 'button';
    btnAddCol.textContent = '+ 열';
    btnAddCol.dataset.action = 'add-col';

    const btnDelCol = document.createElement('button');
    btnDelCol.type = 'button';
    btnDelCol.textContent = '− 열';
    btnDelCol.dataset.action = 'del-col';

    toolbar.append(btnAddRow, btnDelRow, btnAddCol, btnDelCol);
    container.appendChild(toolbar);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'hwp-chart-data-table-wrap';
    const table = document.createElement('table');
    table.className = 'hwp-chart-data-table';
    tableWrap.appendChild(table);
    container.appendChild(tableWrap);

    // 셀 입력 dispatch 시 정확한 좌표를 찾기 위해 data-row, data-col 사용
    function emit() {
        onChange(clone(state));
    }

    function render() {
        normalize(state);
        table.innerHTML = '';

        const { categories, series } = state;

        // 헤더 행 (R0)
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.dataset.row = '0';

        const corner = document.createElement('th');
        corner.className = 'hwp-chart-corner';
        corner.textContent = '';
        headRow.appendChild(corner);

        categories.forEach((cat, c) => {
            const th = document.createElement('th');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = cat;
            input.dataset.row = '0';
            input.dataset.col = String(c + 1);
            input.setAttribute('aria-label', `카테고리 ${c + 1}`);
            th.appendChild(input);
            headRow.appendChild(th);
        });

        thead.appendChild(headRow);
        table.appendChild(thead);

        // 본문 (각 시리즈 = 1 행)
        const tbody = document.createElement('tbody');
        series.forEach((s, r) => {
            const tr = document.createElement('tr');
            tr.dataset.row = String(r + 1);

            // 첫 셀: 시리즈 이름
            const th = document.createElement('th');
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = s.name;
            nameInput.dataset.row = String(r + 1);
            nameInput.dataset.col = '0';
            nameInput.setAttribute('aria-label', `시리즈 ${r + 1} 이름`);
            th.appendChild(nameInput);
            tr.appendChild(th);

            // 데이터 셀들
            s.data.forEach((v, c) => {
                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.inputMode = 'decimal';
                input.value = String(v);
                input.dataset.row = String(r + 1);
                input.dataset.col = String(c + 1);
                input.setAttribute('aria-label', `R${r + 1}C${c + 1}`);
                td.appendChild(input);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
    }

    /**
     * 데이터-row, data-col 속성에서 현재 input 위치를 찾고 적용한다.
     */
    function applyEdit(target) {
        if (!target || !target.dataset) return false;
        const r = Number(target.dataset.row);
        const c = Number(target.dataset.col);
        if (!Number.isFinite(r) || !Number.isFinite(c)) return false;

        const raw = target.value;
        if (r === 0 && c === 0) return false;
        if (r === 0) {
            // 카테고리 라벨
            state.categories[c - 1] = String(raw);
        } else if (c === 0) {
            // 시리즈 이름
            state.series[r - 1].name = String(raw);
        } else {
            // 데이터 셀
            state.series[r - 1].data[c - 1] = toNumber(raw);
        }
        return true;
    }

    function focusCell(row, col) {
        const sel = `input[data-row="${row}"][data-col="${col}"]`;
        const el = table.querySelector(sel);
        if (el && typeof el.focus === 'function') {
            el.focus();
            if (typeof el.select === 'function') el.select();
        }
        return el;
    }

    function onInput(e) {
        if (e.target && e.target.tagName === 'INPUT') {
            if (applyEdit(e.target)) emit();
        }
    }

    function onKeydown(e) {
        const t = e.target;
        if (!t || t.tagName !== 'INPUT' || !t.dataset) return;
        const r = Number(t.dataset.row);
        const c = Number(t.dataset.col);
        const rows = state.series.length;
        const cols = state.categories.length;

        if (e.key === 'Enter') {
            e.preventDefault();
            applyEdit(t);
            emit();
            const nextR = r + 1 > rows ? r : r + 1;
            focusCell(nextR, c);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            applyEdit(t);
            emit();
            if (e.shiftKey) {
                const prevC = c - 1 < 0 ? c : c - 1;
                focusCell(r, prevC);
            } else {
                const nextC = c + 1 > cols ? c : c + 1;
                focusCell(r, nextC);
            }
        }
    }

    function addRow() {
        const cols = state.categories.length;
        const idx = state.series.length + 1;
        state.series.push({
            name: `시리즈${idx}`,
            data: new Array(cols).fill(0)
        });
        render();
        emit();
    }

    function removeRow(idx) {
        if (state.series.length <= 1) return; // 최소 1행 유지
        const i = Number.isInteger(idx) ? idx : state.series.length - 1;
        if (i < 0 || i >= state.series.length) return;
        state.series.splice(i, 1);
        render();
        emit();
    }

    function addColumn() {
        const idx = state.categories.length + 1;
        state.categories.push(`항목${idx}`);
        for (const s of state.series) s.data.push(0);
        render();
        emit();
    }

    function removeColumn(idx) {
        if (state.categories.length <= 1) return; // 최소 1열 유지
        const i = Number.isInteger(idx) ? idx : state.categories.length - 1;
        if (i < 0 || i >= state.categories.length) return;
        state.categories.splice(i, 1);
        for (const s of state.series) s.data.splice(i, 1);
        render();
        emit();
    }

    function onToolbarClick(e) {
        const action = e.target && e.target.dataset && e.target.dataset.action;
        if (!action) return;
        if (action === 'add-row') addRow();
        else if (action === 'del-row') removeRow();
        else if (action === 'add-col') addColumn();
        else if (action === 'del-col') removeColumn();
    }

    table.addEventListener('input', onInput);
    table.addEventListener('keydown', onKeydown);
    toolbar.addEventListener('click', onToolbarClick);

    render();

    return {
        getState() {
            return clone(state);
        },
        setState(next) {
            if (!next || !Array.isArray(next.categories) || !Array.isArray(next.series)) {
                throw new TypeError('setState: { categories, series } 형식이 필요합니다');
            }
            state = normalize(clone(next));
            render();
            emit();
        },
        addRow,
        removeRow,
        addColumn,
        removeColumn,
        focus(row, col) {
            focusCell(row, col);
        },
        destroy() {
            table.removeEventListener('input', onInput);
            table.removeEventListener('keydown', onKeydown);
            toolbar.removeEventListener('click', onToolbarClick);
            container.innerHTML = '';
            container.classList.remove('hwp-chart-data-sheet');
        }
    };
}

export default { createDataSheet };
