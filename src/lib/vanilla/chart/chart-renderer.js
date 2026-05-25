/**
 * HWPX Chart Renderer (Pure SVG)
 * ─────────────────────────────────────────────────────────────────────────────
 * 외부 차트 라이브러리(Chart.js / Recharts 등) 도입 없이 표준 SVG DOM API 만
 * 사용해 차트를 그린다. 번들 사이즈/의존성 부담을 피하면서, HWPX 차트의
 * 가장 흔한 유형(막대/세로 막대/꺾은선/영역/원/도넛)을 정적으로 렌더한다.
 *
 * 모든 렌더 함수는 ChartData (chart-parser.js 의 출력 형태) 를 입력으로 받아
 * 단일 <svg> 루트 요소를 반환한다. 반응형 표현을 위해 viewBox 좌표계는
 * 항상 0 0 W H 의 논리 좌표를 사용한다.
 *
 * 미지원 타입은 placeholder 요소를 반환한다 (다음 단계 TODO 참고).
 *
 * @module vanilla/chart/chart-renderer
 * @version 1.0.0
 */

import { isRenderableChart } from './chart-parser.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 기본 색상 팔레트 (Material-ish, 색맹 친화)
 */
export const DEFAULT_PALETTE = [
    '#4E79A7', '#F28E2B', '#E15759', '#76B7B2',
    '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7',
    '#9C755F', '#BAB0AC'
];

const DEFAULT_OPTIONS = Object.freeze({
    width: 480,
    height: 320,
    padding: { top: 32, right: 24, bottom: 56, left: 56 },
    fontFamily: 'inherit',
    fontSize: 11,
    gridColor: '#E0E0E0',
    axisColor: '#666666',
    titleColor: '#222222',
    background: '#FFFFFF'
});

// ---------------------------------------------------------------------------
// 유틸리티
// ---------------------------------------------------------------------------

function svg(tag, attrs = {}, parent = null) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        el.setAttribute(k, String(v));
    }
    if (parent) parent.appendChild(el);
    return el;
}

function pickColor(series, idx) {
    if (series && series.color) return series.color;
    return DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
}

function mergeOptions(opts) {
    const merged = { ...DEFAULT_OPTIONS, ...opts };
    merged.padding = { ...DEFAULT_OPTIONS.padding, ...(opts?.padding || {}) };
    return merged;
}

function createRootSvg(opts) {
    const root = svg('svg', {
        xmlns: SVG_NS,
        viewBox: `0 0 ${opts.width} ${opts.height}`,
        preserveAspectRatio: 'xMidYMid meet',
        class: 'hwp-chart-svg',
        'data-chart': '1'
    });
    root.style.width = '100%';
    root.style.height = 'auto';
    root.style.maxWidth = `${opts.width}px`;
    root.style.fontFamily = opts.fontFamily;
    root.style.fontSize = `${opts.fontSize}px`;

    // 배경
    svg('rect', {
        x: 0, y: 0, width: opts.width, height: opts.height,
        fill: opts.background
    }, root);
    return root;
}

/**
 * 차트 타이틀 + 부제목을 그리고 padding.top 을 조정한다.
 * @returns {number} 타이틀 영역이 차지한 px 높이
 */
function drawTitle(root, data, opts) {
    let consumed = 0;
    const cx = opts.width / 2;
    if (data.title) {
        const t = svg('text', {
            x: cx, y: 16,
            'text-anchor': 'middle',
            'font-weight': 'bold',
            'font-size': opts.fontSize + 3,
            fill: opts.titleColor
        }, root);
        t.textContent = data.title;
        consumed = 18;
    }
    if (data.subtitle) {
        const t = svg('text', {
            x: cx, y: 16 + (consumed ? 14 : 0),
            'text-anchor': 'middle',
            'font-size': opts.fontSize,
            fill: '#555'
        }, root);
        t.textContent = data.subtitle;
        consumed += 14;
    }
    return consumed;
}

/**
 * 범례 그리기.
 * @returns {{height:number, width:number}} 범례 박스 크기 (위치 보정용)
 */
function drawLegend(root, data, opts, position) {
    if (!data.legend || data.legend.visible === false) return { height: 0, width: 0 };
    if (!data.series || data.series.length === 0) return { height: 0, width: 0 };

    const swatch = 10;
    const gap = 6;
    const itemPad = 12;
    const items = data.series.map((s, i) => ({
        name: s.name || `Series ${i + 1}`,
        color: pickColor(s, i)
    }));

    const itemWidths = items.map(it =>
        // 텍스트 폭은 글자수 * fontSize * 0.6 추정
        swatch + gap + Math.max(8, it.name.length * opts.fontSize * 0.6) + itemPad
    );
    const totalWidth = itemWidths.reduce((a, b) => a + b, 0);

    const isHorizontal = position === 'top' || position === 'bottom';
    let x = 0, y = 0;

    if (isHorizontal) {
        const startX = Math.max(0, (opts.width - totalWidth) / 2);
        y = position === 'top'
            ? opts.padding.top - 14
            : opts.height - 14;
        x = startX;
        items.forEach((it, i) => {
            svg('rect', {
                x, y: y - swatch + 2,
                width: swatch, height: swatch,
                fill: it.color, rx: 1
            }, root);
            const txt = svg('text', {
                x: x + swatch + gap, y: y + 1,
                'font-size': opts.fontSize,
                fill: '#333'
            }, root);
            txt.textContent = it.name;
            x += itemWidths[i];
        });
        return { height: 16, width: totalWidth };
    } else {
        // left/right 세로 배치
        const itemH = opts.fontSize + 6;
        const totalH = items.length * itemH;
        y = (opts.height - totalH) / 2;
        x = position === 'left' ? 4 : opts.width - 80;
        items.forEach((it) => {
            svg('rect', {
                x, y: y - swatch + 4,
                width: swatch, height: swatch,
                fill: it.color
            }, root);
            const txt = svg('text', {
                x: x + swatch + gap, y: y + 1,
                'font-size': opts.fontSize,
                fill: '#333'
            }, root);
            txt.textContent = it.name;
            y += itemH;
        });
        return { height: totalH, width: 80 };
    }
}

/**
 * 카테고리 축(x) + 값 축(y) + 그리드 그리기.
 * @returns {{x:number,y:number,w:number,h:number, yToPx:Function, xToPx:Function}} plot area
 */
function drawCartesianAxes(root, data, opts, { yMin, yMax, ticks = 5 } = {}) {
    const innerX = opts.padding.left;
    const innerY = opts.padding.top;
    const innerW = opts.width - opts.padding.left - opts.padding.right;
    const innerH = opts.height - opts.padding.top - opts.padding.bottom;

    const range = yMax - yMin || 1;
    const yToPx = (v) => innerY + innerH - ((v - yMin) / range) * innerH;
    const xCount = Math.max(1, data.categories.length || 1);
    const xToPx = (i) => innerX + (innerW / xCount) * (i + 0.5);

    // 그리드 라인 + Y 라벨
    for (let i = 0; i <= ticks; i++) {
        const v = yMin + (range * i) / ticks;
        const y = yToPx(v);
        svg('line', {
            x1: innerX, x2: innerX + innerW,
            y1: y, y2: y,
            stroke: opts.gridColor, 'stroke-width': 1
        }, root);
        const label = svg('text', {
            x: innerX - 6, y: y + 3,
            'text-anchor': 'end',
            'font-size': opts.fontSize - 1,
            fill: opts.axisColor
        }, root);
        label.textContent = formatNumber(v);
    }

    // X 축 라벨
    if (data.categories && data.categories.length) {
        data.categories.forEach((cat, i) => {
            const x = xToPx(i);
            const t = svg('text', {
                x, y: innerY + innerH + 16,
                'text-anchor': 'middle',
                'font-size': opts.fontSize - 1,
                fill: opts.axisColor
            }, root);
            t.textContent = String(cat);
        });
    }

    // 축 선
    svg('line', {
        x1: innerX, y1: innerY,
        x2: innerX, y2: innerY + innerH,
        stroke: opts.axisColor
    }, root);
    svg('line', {
        x1: innerX, y1: innerY + innerH,
        x2: innerX + innerW, y2: innerY + innerH,
        stroke: opts.axisColor
    }, root);

    // 축 제목
    if (data.axes?.x?.title) {
        const t = svg('text', {
            x: innerX + innerW / 2,
            y: opts.height - 6,
            'text-anchor': 'middle',
            'font-size': opts.fontSize,
            fill: '#333'
        }, root);
        t.textContent = data.axes.x.title;
    }
    if (data.axes?.y?.title) {
        const t = svg('text', {
            x: 14,
            y: innerY + innerH / 2,
            'text-anchor': 'middle',
            'font-size': opts.fontSize,
            fill: '#333',
            transform: `rotate(-90 14 ${innerY + innerH / 2})`
        }, root);
        t.textContent = data.axes.y.title;
    }

    return { x: innerX, y: innerY, w: innerW, h: innerH, yToPx, xToPx };
}

function formatNumber(v) {
    if (!Number.isFinite(v)) return '';
    if (Math.abs(v) >= 1000) return v.toFixed(0);
    if (Math.abs(v) >= 10) return v.toFixed(1);
    return Math.round(v * 100) / 100 + '';
}

function computeValueRange(data, includeZero = true) {
    let min = Infinity;
    let max = -Infinity;
    for (const s of data.series || []) {
        for (const v of s.data || []) {
            if (!Number.isFinite(v)) continue;
            if (v < min) min = v;
            if (v > max) max = v;
        }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return { min: 0, max: 1 };
    }
    if (includeZero) {
        if (min > 0) min = 0;
        if (max < 0) max = 0;
    }
    if (min === max) {
        if (min === 0) { return { min: 0, max: 1 }; }
        const pad = Math.abs(min) * 0.1;
        return { min: min - pad, max: max + pad };
    }
    // Y 축 범위는 axes.y 의 min/max 가 명시되면 우선
    const fromY = data.axes?.y || {};
    if (Number.isFinite(fromY.min)) min = fromY.min;
    if (Number.isFinite(fromY.max)) max = fromY.max;
    return { min, max };
}

// ---------------------------------------------------------------------------
// 차트 타입별 렌더
// ---------------------------------------------------------------------------

/**
 * 세로(column) 또는 가로(bar) 막대 차트.
 * type === 'column' 일 때는 세로, 'bar' 일 때는 가로.
 */
export function renderBarChart(data, options = {}) {
    const opts = mergeOptions(options);
    const root = createRootSvg(opts);
    drawTitle(root, data, opts);
    drawLegend(root, data, opts, data.legend?.position || 'bottom');

    const horizontal = data.type === 'bar';
    if (horizontal) {
        // 가로 막대: 카테고리 = y축, 값 = x축
        const { min, max } = computeValueRange(data);
        const innerX = opts.padding.left;
        const innerY = opts.padding.top;
        const innerW = opts.width - opts.padding.left - opts.padding.right;
        const innerH = opts.height - opts.padding.top - opts.padding.bottom;
        const range = (max - min) || 1;
        const cats = data.categories.length || (data.series[0]?.data.length || 1);
        const groupH = innerH / cats;
        const seriesCount = data.series.length;
        const barH = Math.max(2, (groupH - 6) / seriesCount);

        // 축
        svg('line', { x1: innerX, y1: innerY, x2: innerX, y2: innerY + innerH, stroke: opts.axisColor }, root);
        svg('line', { x1: innerX, y1: innerY + innerH, x2: innerX + innerW, y2: innerY + innerH, stroke: opts.axisColor }, root);
        // x 그리드 + 라벨
        const ticks = 5;
        for (let i = 0; i <= ticks; i++) {
            const v = min + (range * i) / ticks;
            const x = innerX + ((v - min) / range) * innerW;
            svg('line', { x1: x, x2: x, y1: innerY, y2: innerY + innerH, stroke: opts.gridColor }, root);
            const t = svg('text', {
                x, y: innerY + innerH + 14,
                'text-anchor': 'middle',
                'font-size': opts.fontSize - 1,
                fill: opts.axisColor
            }, root);
            t.textContent = formatNumber(v);
        }

        for (let ci = 0; ci < cats; ci++) {
            const yBase = innerY + groupH * ci + 3;
            const catLabel = data.categories[ci] ?? String(ci + 1);
            const t = svg('text', {
                x: innerX - 6, y: yBase + groupH / 2,
                'text-anchor': 'end',
                'font-size': opts.fontSize - 1,
                fill: opts.axisColor
            }, root);
            t.textContent = String(catLabel);

            data.series.forEach((s, si) => {
                const v = Number(s.data[ci] ?? 0);
                const zeroX = innerX + ((0 - min) / range) * innerW;
                const valueX = innerX + ((v - min) / range) * innerW;
                const x = Math.min(zeroX, valueX);
                const w = Math.abs(valueX - zeroX);
                svg('rect', {
                    x, y: yBase + si * barH,
                    width: w, height: Math.max(1, barH - 1),
                    fill: pickColor(s, si),
                    'data-series': si,
                    'data-category': ci
                }, root);
            });
        }
    } else {
        // 세로 막대 (column)
        const { min, max } = computeValueRange(data);
        const plot = drawCartesianAxes(root, data, opts, { yMin: min, yMax: max });
        const cats = data.categories.length || (data.series[0]?.data.length || 1);
        const groupW = plot.w / cats;
        const seriesCount = data.series.length;
        const barW = Math.max(2, (groupW - 8) / seriesCount);
        const zeroY = plot.yToPx(Math.max(0, min));

        for (let ci = 0; ci < cats; ci++) {
            const groupStart = plot.x + groupW * ci + 4;
            data.series.forEach((s, si) => {
                const v = Number(s.data[ci] ?? 0);
                const y = plot.yToPx(v);
                const top = Math.min(y, zeroY);
                const h = Math.abs(zeroY - y);
                svg('rect', {
                    x: groupStart + si * barW,
                    y: top,
                    width: Math.max(1, barW - 1),
                    height: Math.max(1, h),
                    fill: pickColor(s, si),
                    'data-series': si,
                    'data-category': ci
                }, root);
            });
        }
    }
    return root;
}

/**
 * 꺾은선 차트.
 */
export function renderLineChart(data, options = {}) {
    const opts = mergeOptions(options);
    const root = createRootSvg(opts);
    drawTitle(root, data, opts);
    drawLegend(root, data, opts, data.legend?.position || 'bottom');

    const { min, max } = computeValueRange(data, false);
    const plot = drawCartesianAxes(root, data, opts, { yMin: min, yMax: max });

    data.series.forEach((s, si) => {
        const color = pickColor(s, si);
        const points = (s.data || []).map((v, i) => `${plot.xToPx(i)},${plot.yToPx(Number(v) || 0)}`);
        if (points.length >= 2) {
            svg('polyline', {
                points: points.join(' '),
                fill: 'none',
                stroke: color,
                'stroke-width': 2,
                'data-series': si
            }, root);
        }
        // 점 마커
        (s.data || []).forEach((v, i) => {
            svg('circle', {
                cx: plot.xToPx(i),
                cy: plot.yToPx(Number(v) || 0),
                r: 2.5,
                fill: color,
                'data-series': si,
                'data-category': i
            }, root);
        });
    });

    return root;
}

/**
 * 영역 차트.
 */
export function renderAreaChart(data, options = {}) {
    const opts = mergeOptions(options);
    const root = createRootSvg(opts);
    drawTitle(root, data, opts);
    drawLegend(root, data, opts, data.legend?.position || 'bottom');

    const { min, max } = computeValueRange(data);
    const plot = drawCartesianAxes(root, data, opts, { yMin: min, yMax: max });
    const baseY = plot.yToPx(Math.max(0, min));

    data.series.forEach((s, si) => {
        const color = pickColor(s, si);
        const vals = s.data || [];
        if (!vals.length) return;

        const pts = vals.map((v, i) => `${plot.xToPx(i)},${plot.yToPx(Number(v) || 0)}`);
        // 영역 다각형: 첫 x, baseY → 라인 → 마지막 x, baseY → close
        const firstX = plot.xToPx(0);
        const lastX = plot.xToPx(vals.length - 1);
        const polyPts = [`${firstX},${baseY}`, ...pts, `${lastX},${baseY}`].join(' ');
        svg('polygon', {
            points: polyPts,
            fill: color,
            'fill-opacity': 0.35,
            stroke: 'none',
            'data-series': si
        }, root);
        // 위쪽 라인
        svg('polyline', {
            points: pts.join(' '),
            fill: 'none', stroke: color, 'stroke-width': 2,
            'data-series': si
        }, root);
    });

    return root;
}

/**
 * 원형(파이) / 도넛 차트.
 * type === 'doughnut' 이면 내부 반경을 비운다.
 */
export function renderPieChart(data, options = {}) {
    const opts = mergeOptions(options);
    const root = createRootSvg(opts);
    drawTitle(root, data, opts);
    drawLegend(root, data, opts, data.legend?.position || 'right');

    // 파이 차트는 단일 series 의 data 만 사용 (HWPX 동작)
    const series = data.series?.[0];
    if (!series || !series.data?.length) return root;

    const values = series.data.map(v => Math.max(0, Number(v) || 0));
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return root;

    const cx = opts.width / 2;
    const cy = opts.height / 2 + 4;
    const r = Math.min(opts.width, opts.height) * 0.35;
    const innerR = data.type === 'doughnut' ? r * 0.55 : 0;

    let angle = -Math.PI / 2; // 12시 방향에서 시작
    values.forEach((v, i) => {
        const slice = (v / total) * Math.PI * 2;
        const next = angle + slice;
        const color = pickColor(series, i) !== series.color
            ? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
            : pickColor(series, i);
        // 위 표현은 단일 series 색상이 있을 때도 슬라이스마다 팔레트 색을 쓰도록 함
        const fillColor = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
        const path = describeSlice(cx, cy, r, innerR, angle, next);
        svg('path', {
            d: path,
            fill: fillColor,
            stroke: '#FFFFFF',
            'stroke-width': 1,
            'data-category': i
        }, root);

        // 라벨: 슬라이스가 충분히 크면 표시
        if (slice > 0.18) {
            const mid = angle + slice / 2;
            const lr = (r + innerR) / 2 || r * 0.6;
            const tx = cx + Math.cos(mid) * lr;
            const ty = cy + Math.sin(mid) * lr;
            const label = data.categories?.[i] ?? formatNumber(v);
            const t = svg('text', {
                x: tx, y: ty + 4,
                'text-anchor': 'middle',
                'font-size': opts.fontSize - 1,
                fill: '#FFFFFF',
                'font-weight': 'bold'
            }, root);
            t.textContent = String(label);
        }

        angle = next;
        // color 변수는 향후 series.color 가 슬라이스별 배열로 확장될 때 활용
        void color;
    });

    return root;
}

/**
 * SVG path 로 도넛/파이 슬라이스를 그린다.
 */
function describeSlice(cx, cy, outerR, innerR, startAngle, endAngle) {
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);

    if (innerR <= 0) {
        return [
            `M ${cx} ${cy}`,
            `L ${x1} ${y1}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');
    }
    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);
    return [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
        'Z'
    ].join(' ');
}

/**
 * 미지원 차트(scatter / radar 등) placeholder.
 * TODO(phase-5.1): scatter, radar 의 실제 렌더 구현.
 */
export function renderPlaceholderChart(data, options = {}) {
    const opts = mergeOptions(options);
    const root = createRootSvg(opts);
    drawTitle(root, data, opts);

    const msg = svg('text', {
        x: opts.width / 2, y: opts.height / 2,
        'text-anchor': 'middle',
        'font-size': opts.fontSize + 1,
        fill: '#888'
    }, root);
    msg.textContent = `[${data.type || 'unknown'} 차트 — 다음 단계에서 지원]`;

    return root;
}

/**
 * ChartData → SVG 요소로 통합 디스패치.
 * 입력이 비유효하면 placeholder 를 반환한다.
 *
 * @param {Object} data
 * @param {Object} [options]
 * @returns {SVGSVGElement}
 */
export function renderChart(data, options = {}) {
    if (!isRenderableChart(data)) {
        return renderPlaceholderChart(data || { type: 'unknown' }, options);
    }

    switch (data.type) {
        case 'bar':
        case 'column':
            return renderBarChart(data, options);
        case 'line':
            return renderLineChart(data, options);
        case 'area':
            return renderAreaChart(data, options);
        case 'pie':
        case 'doughnut':
            return renderPieChart(data, options);
        case 'scatter':
        case 'radar':
            // TODO(phase-5.1): scatter / radar 실제 렌더 구현
            return renderPlaceholderChart(data, options);
        default:
            return renderPlaceholderChart(data, options);
    }
}

export default {
    renderChart,
    renderBarChart,
    renderLineChart,
    renderAreaChart,
    renderPieChart,
    renderPlaceholderChart,
    DEFAULT_PALETTE
};
