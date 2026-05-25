/**
 * Chart Options Panel (Vanilla)
 * ─────────────────────────────────────────────────────────────────────────────
 * 차트 편집기 우측 패널. 데이터 시트에서 다루지 않는 메타데이터를 입력받는다.
 * - 차트 타입 (트랙 K 의 SUPPORTED_CHART_TYPES 기반)
 * - 제목 / 부제
 * - x/y 축: 제목, 최소, 최대
 * - 범례 위치 (top/bottom/left/right/none)
 * - 색상 팔레트 (기본 10색 + 커스텀 input[type=color])
 *
 * 모든 변경은 onChange(options) 콜백으로 통지된다.
 *
 * @module vanilla/chart-editor/options-panel
 * @version 1.0.0
 */

import { SUPPORTED_CHART_TYPES } from '../chart/chart-parser.js';
import { DEFAULT_PALETTE } from '../chart/chart-renderer.js';

const CHART_TYPE_LABELS = {
    bar: '가로 막대',
    column: '세로 막대',
    line: '꺾은선',
    area: '영역',
    pie: '원형',
    doughnut: '도넛',
    scatter: '분산형',
    radar: '방사형'
};

const LEGEND_POSITIONS = [
    { value: 'top', label: '위' },
    { value: 'bottom', label: '아래' },
    { value: 'left', label: '왼쪽' },
    { value: 'right', label: '오른쪽' },
    { value: 'none', label: '숨김' }
];

/**
 * @typedef {Object} ChartOptions
 * @property {string} type
 * @property {string} title
 * @property {string} subtitle
 * @property {{title: string, min: number|null, max: number|null}} xAxis
 * @property {{title: string, min: number|null, max: number|null}} yAxis
 * @property {{position: string, visible: boolean}} legend
 * @property {string[]} palette
 */

/**
 * 기본 옵션을 반환한다.
 * @returns {ChartOptions}
 */
export function defaultChartOptions() {
    return {
        type: 'column',
        title: '',
        subtitle: '',
        xAxis: { title: '', min: null, max: null },
        yAxis: { title: '', min: null, max: null },
        legend: { position: 'bottom', visible: true },
        palette: [...DEFAULT_PALETTE]
    };
}

function cloneOptions(opts) {
    return {
        type: opts.type,
        title: opts.title || '',
        subtitle: opts.subtitle || '',
        xAxis: { ...opts.xAxis },
        yAxis: { ...opts.yAxis },
        legend: { ...opts.legend },
        palette: [...(opts.palette || DEFAULT_PALETTE)]
    };
}

function parseNumberOrNull(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * 옵션 패널 컨트롤러를 생성한다.
 * @param {HTMLElement} container
 * @param {Object} [config]
 * @param {ChartOptions} [config.initial]
 * @param {(opts: ChartOptions) => void} [config.onChange]
 */
export function createOptionsPanel(container, config = {}) {
    if (!container || typeof container.appendChild !== 'function') {
        throw new TypeError('createOptionsPanel: container 가 유효한 DOM 요소가 아닙니다');
    }
    const onChange = typeof config.onChange === 'function' ? config.onChange : () => {};
    let opts = cloneOptions({ ...defaultChartOptions(), ...(config.initial || {}) });

    container.classList.add('hwp-chart-options-panel');
    container.innerHTML = '';

    // ───── 차트 타입 섹션 ─────
    const typeSection = section('차트 타입');
    const typeSelect = document.createElement('select');
    typeSelect.dataset.field = 'type';
    typeSelect.setAttribute('aria-label', '차트 타입');
    for (const t of SUPPORTED_CHART_TYPES) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = CHART_TYPE_LABELS[t] || t;
        typeSelect.appendChild(opt);
    }
    typeSelect.value = opts.type;
    typeSection.body.appendChild(typeSelect);
    container.appendChild(typeSection.root);

    // ───── 제목 / 부제 섹션 ─────
    const titleSection = section('제목');
    const titleInput = labeledInput('제목', 'title', opts.title);
    const subtitleInput = labeledInput('부제', 'subtitle', opts.subtitle);
    titleSection.body.append(titleInput.wrap, subtitleInput.wrap);
    container.appendChild(titleSection.root);

    // ───── X 축 ─────
    const xSection = section('X 축');
    const xTitle = labeledInput('축 제목', 'xAxis.title', opts.xAxis.title);
    const xMin = labeledInput('최소', 'xAxis.min', opts.xAxis.min ?? '', 'number');
    const xMax = labeledInput('최대', 'xAxis.max', opts.xAxis.max ?? '', 'number');
    xSection.body.append(xTitle.wrap, xMin.wrap, xMax.wrap);
    container.appendChild(xSection.root);

    // ───── Y 축 ─────
    const ySection = section('Y 축');
    const yTitle = labeledInput('축 제목', 'yAxis.title', opts.yAxis.title);
    const yMin = labeledInput('최소', 'yAxis.min', opts.yAxis.min ?? '', 'number');
    const yMax = labeledInput('최대', 'yAxis.max', opts.yAxis.max ?? '', 'number');
    ySection.body.append(yTitle.wrap, yMin.wrap, yMax.wrap);
    container.appendChild(ySection.root);

    // ───── 범례 ─────
    const legendSection = section('범례');
    const legendSelect = document.createElement('select');
    legendSelect.dataset.field = 'legend.position';
    legendSelect.setAttribute('aria-label', '범례 위치');
    for (const p of LEGEND_POSITIONS) {
        const o = document.createElement('option');
        o.value = p.value;
        o.textContent = p.label;
        legendSelect.appendChild(o);
    }
    legendSelect.value = opts.legend.visible === false ? 'none' : opts.legend.position;
    legendSection.body.appendChild(legendSelect);
    container.appendChild(legendSection.root);

    // ───── 색상 팔레트 ─────
    const paletteSection = section('색상 팔레트');
    const swatchRow = document.createElement('div');
    swatchRow.className = 'hwp-chart-palette-row';
    paletteSection.body.appendChild(swatchRow);
    container.appendChild(paletteSection.root);

    function renderPalette() {
        swatchRow.innerHTML = '';
        opts.palette.forEach((color, i) => {
            const sw = document.createElement('input');
            sw.type = 'color';
            sw.value = color;
            sw.dataset.field = 'palette';
            sw.dataset.index = String(i);
            sw.setAttribute('aria-label', `팔레트 색상 ${i + 1}`);
            swatchRow.appendChild(sw);
        });
    }
    renderPalette();

    // ───── 이벤트 ─────
    function emit() {
        onChange(cloneOptions(opts));
    }

    function handleChange(e) {
        const t = e.target;
        if (!t || !t.dataset) return;
        const field = t.dataset.field;
        if (!field) return;

        if (field === 'type') {
            opts.type = String(t.value);
        } else if (field === 'title') {
            opts.title = String(t.value);
        } else if (field === 'subtitle') {
            opts.subtitle = String(t.value);
        } else if (field === 'xAxis.title') {
            opts.xAxis.title = String(t.value);
        } else if (field === 'xAxis.min') {
            opts.xAxis.min = parseNumberOrNull(t.value);
        } else if (field === 'xAxis.max') {
            opts.xAxis.max = parseNumberOrNull(t.value);
        } else if (field === 'yAxis.title') {
            opts.yAxis.title = String(t.value);
        } else if (field === 'yAxis.min') {
            opts.yAxis.min = parseNumberOrNull(t.value);
        } else if (field === 'yAxis.max') {
            opts.yAxis.max = parseNumberOrNull(t.value);
        } else if (field === 'legend.position') {
            const v = String(t.value);
            if (v === 'none') {
                opts.legend.visible = false;
            } else {
                opts.legend.visible = true;
                opts.legend.position = v;
            }
        } else if (field === 'palette') {
            const idx = Number(t.dataset.index);
            if (Number.isInteger(idx) && idx >= 0 && idx < opts.palette.length) {
                opts.palette[idx] = String(t.value);
            }
        }
        emit();
    }

    container.addEventListener('change', handleChange);
    container.addEventListener('input', handleChange);

    return {
        getOptions() {
            return cloneOptions(opts);
        },
        setOptions(next) {
            opts = cloneOptions({ ...defaultChartOptions(), ...next });
            typeSelect.value = opts.type;
            titleInput.input.value = opts.title;
            subtitleInput.input.value = opts.subtitle;
            xTitle.input.value = opts.xAxis.title;
            xMin.input.value = opts.xAxis.min ?? '';
            xMax.input.value = opts.xAxis.max ?? '';
            yTitle.input.value = opts.yAxis.title;
            yMin.input.value = opts.yAxis.min ?? '';
            yMax.input.value = opts.yAxis.max ?? '';
            legendSelect.value = opts.legend.visible === false ? 'none' : opts.legend.position;
            renderPalette();
            emit();
        },
        destroy() {
            container.removeEventListener('change', handleChange);
            container.removeEventListener('input', handleChange);
            container.innerHTML = '';
            container.classList.remove('hwp-chart-options-panel');
        }
    };
}

// ───── 내부 헬퍼 ─────

function section(titleText) {
    const root = document.createElement('section');
    root.className = 'hwp-chart-options-section';
    const h = document.createElement('h4');
    h.textContent = titleText;
    root.appendChild(h);
    const body = document.createElement('div');
    body.className = 'hwp-chart-options-section-body';
    root.appendChild(body);
    return { root, body };
}

function labeledInput(label, field, value, type = 'text') {
    const wrap = document.createElement('label');
    wrap.className = 'hwp-chart-options-field';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.value = value == null ? '' : String(value);
    input.dataset.field = field;
    input.setAttribute('aria-label', label);
    wrap.append(span, input);
    return { wrap, input };
}

export { CHART_TYPE_LABELS, LEGEND_POSITIONS };
export default { createOptionsPanel, defaultChartOptions };
