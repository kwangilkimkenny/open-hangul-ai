/**
 * Chart Preview Pane (Vanilla)
 * ─────────────────────────────────────────────────────────────────────────────
 * 트랙 K 의 chart-renderer 를 사용해 데이터/옵션에 따른 SVG 차트를 실시간으로
 * 재렌더한다. 키 입력에 모두 반응하면 과도한 DOM 재구성이 발생하므로
 * 디바운스(기본 100ms)를 둔다.
 *
 * @module vanilla/chart-editor/preview-pane
 * @version 1.0.0
 */

import { renderChart } from '../chart/chart-renderer.js';

/**
 * @typedef {Object} ChartData (트랙 K 호환 포맷)
 * @property {string} type
 * @property {string=} title
 * @property {string=} subtitle
 * @property {string[]=} categories
 * @property {Array<{name: string, data: number[], color?: string}>=} series
 * @property {Object=} axes
 * @property {Object=} legend
 */

/**
 * 시트 + 옵션을 트랙 K 호환 ChartData 로 합친다.
 * @param {{categories: string[], series: Array}} sheet
 * @param {Object} options
 * @returns {ChartData}
 */
export function buildChartData(sheet, options) {
    const palette = Array.isArray(options.palette) ? options.palette : [];
    const series = (sheet.series || []).map((s, i) => ({
        name: s.name,
        data: Array.isArray(s.data) ? s.data.map(v => Number(v) || 0) : [],
        color: s.color || palette[i % (palette.length || 1)]
    }));

    return {
        type: options.type || 'column',
        title: options.title || '',
        subtitle: options.subtitle || '',
        categories: [...(sheet.categories || [])],
        series,
        axes: {
            x: {
                title: options.xAxis?.title || '',
                ...(Number.isFinite(options.xAxis?.min) ? { min: options.xAxis.min } : {}),
                ...(Number.isFinite(options.xAxis?.max) ? { max: options.xAxis.max } : {})
            },
            y: {
                title: options.yAxis?.title || '',
                ...(Number.isFinite(options.yAxis?.min) ? { min: options.yAxis.min } : {}),
                ...(Number.isFinite(options.yAxis?.max) ? { max: options.yAxis.max } : {})
            }
        },
        legend: {
            position: options.legend?.position || 'bottom',
            visible: options.legend?.visible !== false
        }
    };
}

/**
 * 미리보기 컨트롤러를 생성한다.
 * @param {HTMLElement} container
 * @param {Object} [opts]
 * @param {number} [opts.debounceMs=100]
 * @param {{width:number, height:number}} [opts.size]
 * @returns {{
 *   update: (sheet: Object, options: Object) => void,
 *   flush: () => void,
 *   getLastSvg: () => SVGSVGElement | null,
 *   getRenderCount: () => number,
 *   destroy: () => void
 * }}
 */
export function createPreviewPane(container, opts = {}) {
    if (!container || typeof container.appendChild !== 'function') {
        throw new TypeError('createPreviewPane: container 가 유효한 DOM 요소가 아닙니다');
    }
    const debounceMs = Number.isFinite(opts.debounceMs) ? opts.debounceMs : 100;
    const size = opts.size || { width: 480, height: 320 };

    container.classList.add('hwp-chart-preview-pane');
    container.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'hwp-chart-preview-inner';
    container.appendChild(inner);

    let timer = null;
    let pendingSheet = null;
    let pendingOptions = null;
    let lastSvg = null;
    let renderCount = 0;

    function doRender() {
        timer = null;
        if (!pendingSheet || !pendingOptions) return;
        const data = buildChartData(pendingSheet, pendingOptions);
        const svgEl = renderChart(data, {
            width: size.width,
            height: size.height,
            // 사용자 팔레트의 색이 series.color 로 이미 주입되었지만,
            // 누락된 경우 chart-renderer 의 DEFAULT_PALETTE 를 그대로 사용한다.
        });

        // 기존 내용 비우고 새 SVG 부착
        inner.innerHTML = '';
        if (svgEl) inner.appendChild(svgEl);
        lastSvg = svgEl;
        renderCount += 1;
    }

    function update(sheet, options) {
        pendingSheet = sheet;
        pendingOptions = options;
        if (timer != null) clearTimeout(timer);
        if (debounceMs <= 0) {
            doRender();
        } else {
            timer = setTimeout(doRender, debounceMs);
        }
    }

    function flush() {
        if (timer != null) {
            clearTimeout(timer);
            timer = null;
        }
        doRender();
    }

    function destroy() {
        if (timer != null) {
            clearTimeout(timer);
            timer = null;
        }
        container.innerHTML = '';
        container.classList.remove('hwp-chart-preview-pane');
        lastSvg = null;
    }

    return {
        update,
        flush,
        getLastSvg: () => lastSvg,
        getRenderCount: () => renderCount,
        destroy
    };
}

export default { createPreviewPane, buildChartData };
