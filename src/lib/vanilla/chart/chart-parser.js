/**
 * HWPX Chart Parser
 * ─────────────────────────────────────────────────────────────────────────────
 * HWPX <hp:chart> / DrawingML <chartSpace> XML 을 정규화된 차트 데이터 모델로
 * 변환한다. Phase 5 차트 렌더링 트랙의 일부.
 *
 * 지원 입력 형태
 *   1. HWPX 한컴 표현                 — <hp:chart type="bar"> ... </hp:chart>
 *   2. OOXML DrawingML 표현 (OLE 임베드) — <c:chartSpace>...<c:barChart>...</c:chartSpace>
 *
 * 정규화된 출력 (ChartData)
 *   {
 *     type:       'bar'|'line'|'pie'|'area'|'scatter'|'radar'|'column'|'doughnut',
 *     title?:     string,
 *     subtitle?:  string,
 *     categories: string[],              // x축(또는 카테고리 축) 라벨
 *     series: [{ name, data:number[], color? }],
 *     axes: {
 *       x: { title?, type?, min?, max? },
 *       y: { title?, type?, min?, max? }
 *     },
 *     legend: { position: 'top'|'bottom'|'left'|'right'|'none', visible: boolean }
 *   }
 *
 * 본 모듈은 DOM/문자열 모두 입력으로 받을 수 있도록 설계되어 있다.
 * 단위 테스트는 jsdom DOMParser 환경을 가정한다.
 *
 * @module vanilla/chart/chart-parser
 * @version 1.0.0
 */

/**
 * 지원하는 차트 타입 (정규화된 이름)
 * @type {Set<string>}
 */
export const SUPPORTED_CHART_TYPES = new Set([
    'bar',       // 가로 막대
    'column',    // 세로 막대 (HWPX 에서 bar 와 구분되지 않을 때는 'bar' 로 폴백)
    'line',
    'pie',
    'area',
    'scatter',
    'radar',
    'doughnut'
]);

/**
 * OOXML chartSpace 자식 노드 → 정규화 타입 매핑
 */
const OOXML_TYPE_MAP = {
    barchart: 'bar',
    bar3dchart: 'bar',
    linechart: 'line',
    line3dchart: 'line',
    piechart: 'pie',
    pie3dchart: 'pie',
    doughnutchart: 'doughnut',
    areachart: 'area',
    area3dchart: 'area',
    scatterchart: 'scatter',
    radarchart: 'radar'
};

/**
 * HWPX hp:chart type 속성 → 정규화 타입 매핑
 * 한컴은 자체 정의 코드(숫자) 또는 문자열을 사용한다.
 */
const HWPX_TYPE_MAP = {
    bar: 'bar',
    column: 'column',
    line: 'line',
    pie: 'pie',
    area: 'area',
    scatter: 'scatter',
    radar: 'radar',
    doughnut: 'doughnut',
    // numeric codes (legacy)
    0: 'bar',
    1: 'line',
    2: 'pie',
    3: 'area',
    4: 'scatter',
    5: 'radar',
    6: 'column',
    7: 'doughnut'
};

/**
 * tagName 의 네임스페이스 접두사를 제거하고 소문자로 반환한다.
 * @param {Element} el
 * @returns {string}
 */
function lname(el) {
    if (!el) return '';
    const raw = el.localName || el.tagName || '';
    return String(raw).toLowerCase().replace(/^[a-z]+:/, '');
}

/**
 * 네임스페이스 무관 첫 자식 검색 (즉시 자식만)
 */
function childByName(parent, name) {
    if (!parent || !parent.childNodes) return null;
    const target = name.toLowerCase();
    for (const node of Array.from(parent.children || [])) {
        if (lname(node) === target) return node;
    }
    return null;
}

/**
 * 네임스페이스 무관 자식 전부 검색 (즉시 자식만)
 */
function childrenByName(parent, name) {
    if (!parent || !parent.children) return [];
    const target = name.toLowerCase();
    return Array.from(parent.children).filter(n => lname(n) === target);
}

/**
 * 깊이 우선으로 첫 번째 매칭 후손 검색 (네임스페이스 무관)
 */
function descendant(parent, name) {
    if (!parent) return null;
    const target = name.toLowerCase();
    if (lname(parent) === target) return parent;
    const stack = Array.from(parent.children || []);
    while (stack.length) {
        const el = stack.shift();
        if (lname(el) === target) return el;
        stack.unshift(...Array.from(el.children || []));
    }
    return null;
}

/**
 * 모든 매칭 후손 (BFS)
 */
function descendants(parent, name) {
    if (!parent) return [];
    const target = name.toLowerCase();
    const out = [];
    const stack = Array.from(parent.children || []);
    while (stack.length) {
        const el = stack.shift();
        if (lname(el) === target) out.push(el);
        stack.push(...Array.from(el.children || []));
    }
    return out;
}

/**
 * 입력을 Element 로 정규화한다.
 * 문자열이면 DOMParser 로 파싱, Document/Element 면 적절히 추출.
 *
 * @param {string|Element|Document} input
 * @returns {Element|null}
 */
function toElement(input) {
    if (!input) return null;
    if (typeof input === 'string') {
        if (typeof DOMParser === 'undefined') {
            throw new Error('chart-parser: DOMParser is unavailable in this environment.');
        }
        const doc = new DOMParser().parseFromString(input, 'application/xml');
        // 파서 에러 검사 (jsdom 은 documentElement 가 parsererror 가 될 수 있음)
        if (!doc || !doc.documentElement) return null;
        if (doc.documentElement.localName === 'parsererror' ||
            doc.documentElement.tagName === 'parsererror') return null;
        const errorNode = doc.getElementsByTagName('parsererror')[0];
        if (errorNode) return null;
        return doc.documentElement;
    }
    if (input.documentElement) return input.documentElement;
    if (input.nodeType === 1) return input;
    return null;
}

/**
 * 색상 16진수 정규화. "RRGGBB", "#RRGGBB", "RGB(r,g,b)" 입력 허용.
 * @param {string} raw
 * @returns {string|null}
 */
function normalizeColor(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(s)) {
        return s.startsWith('#') ? s.toUpperCase() : '#' + s.toUpperCase();
    }
    if (/^#?[0-9a-fA-F]{8}$/.test(s)) {
        // ARGB → RGB (alpha 제거)
        const hex = s.replace(/^#/, '');
        return '#' + hex.slice(2).toUpperCase();
    }
    const rgbMatch = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
        const [, r, g, b] = rgbMatch;
        return '#' + [r, g, b].map(v => Number(v).toString(16).padStart(2, '0').toUpperCase()).join('');
    }
    return null;
}

/**
 * Element 내부의 첫 텍스트 콘텐츠를 찾는다. (OOXML <a:t> 등)
 */
function readText(el) {
    if (!el) return '';
    // OOXML <a:t> 우선
    const tEl = descendant(el, 't');
    if (tEl && tEl.textContent != null) return tEl.textContent.trim();
    return (el.textContent || '').trim();
}

/**
 * <c:ser> (OOXML series) 노드를 정규화한다.
 */
function parseOoxmlSeries(serEl) {
    const series = { name: '', data: [], color: null };

    // 이름: c:tx → c:strRef/c:strCache/c:pt/c:v 또는 c:v 직접
    const tx = childByName(serEl, 'tx');
    if (tx) {
        const v = descendant(tx, 'v');
        if (v) series.name = (v.textContent || '').trim();
        else series.name = readText(tx);
    }

    // 색상: c:spPr → a:solidFill → a:srgbClr@val
    const spPr = childByName(serEl, 'spPr');
    if (spPr) {
        const srgb = descendant(spPr, 'srgbclr');
        if (srgb) {
            const v = srgb.getAttribute('val');
            const norm = normalizeColor(v);
            if (norm) series.color = norm;
        }
    }

    // 값: c:val → c:numRef/c:numCache/c:pt/c:v   또는 c:yVal (scatter)
    const valEl = childByName(serEl, 'val') || childByName(serEl, 'yval');
    if (valEl) {
        const pts = descendants(valEl, 'pt');
        if (pts.length > 0) {
            // index 순서대로 정렬
            const indexed = pts.map(p => {
                const idx = parseInt(p.getAttribute('idx'), 10);
                const v = descendant(p, 'v');
                const num = v ? parseFloat(v.textContent) : NaN;
                return { idx: Number.isFinite(idx) ? idx : 0, num };
            });
            indexed.sort((a, b) => a.idx - b.idx);
            series.data = indexed.map(p => (Number.isFinite(p.num) ? p.num : 0));
        } else {
            // numCache 가 없으면 v 노드만 직접 수집
            const vs = descendants(valEl, 'v');
            series.data = vs.map(v => {
                const n = parseFloat(v.textContent);
                return Number.isFinite(n) ? n : 0;
            });
        }
    }

    return series;
}

/**
 * OOXML chartSpace 형식 파서.
 */
function parseOoxmlChart(root) {
    const data = {
        type: 'bar',
        title: '',
        subtitle: '',
        categories: [],
        series: [],
        axes: { x: {}, y: {} },
        legend: { position: 'bottom', visible: true }
    };

    // chart 노드 (chartSpace > chart)
    const chartNode = descendant(root, 'chart') || root;

    // 제목
    const titleEl = descendant(chartNode, 'title');
    if (titleEl) {
        // 자동 생성 비활성화 검사
        const autoTitleDeleted = descendant(chartNode, 'autotitledeleted');
        if (!autoTitleDeleted || autoTitleDeleted.getAttribute('val') !== '1') {
            const t = readText(titleEl);
            if (t) data.title = t;
        }
    }

    // plotArea: 첫 *Chart 자식이 차트 유형
    const plotArea = descendant(chartNode, 'plotarea');
    const searchRoot = plotArea || chartNode;

    let chartTypeNode = null;
    for (const child of Array.from(searchRoot.children || [])) {
        const nm = lname(child);
        if (OOXML_TYPE_MAP[nm]) {
            chartTypeNode = child;
            data.type = OOXML_TYPE_MAP[nm];
            break;
        }
    }

    // barDir: col → column, bar → bar (가로)
    if (chartTypeNode && (data.type === 'bar')) {
        const barDir = childByName(chartTypeNode, 'bardir');
        if (barDir && barDir.getAttribute('val') === 'col') {
            data.type = 'column';
        }
    }

    // doughnut: pieChart 와 별개로 doughnutChart 가 따로 있음 (이미 처리)
    // categories + series
    if (chartTypeNode) {
        const serNodes = childrenByName(chartTypeNode, 'ser');

        // categories: 첫 series 의 c:cat 에서 추출
        if (serNodes.length > 0) {
            const firstSer = serNodes[0];
            const cat = childByName(firstSer, 'cat') || childByName(firstSer, 'xval');
            if (cat) {
                const pts = descendants(cat, 'pt');
                if (pts.length > 0) {
                    const idxed = pts.map(p => {
                        const idx = parseInt(p.getAttribute('idx'), 10);
                        const v = descendant(p, 'v');
                        return { idx: Number.isFinite(idx) ? idx : 0, text: v ? (v.textContent || '') : '' };
                    });
                    idxed.sort((a, b) => a.idx - b.idx);
                    data.categories = idxed.map(p => p.text);
                } else {
                    const vs = descendants(cat, 'v');
                    data.categories = vs.map(v => v.textContent || '');
                }
            }
        }

        // series 파싱
        for (const ser of serNodes) {
            data.series.push(parseOoxmlSeries(ser));
        }
    }

    // 축 제목 (catAx, valAx)
    const catAx = descendant(searchRoot, 'catax');
    if (catAx) {
        const t = descendant(catAx, 'title');
        if (t) {
            const txt = readText(t);
            if (txt) data.axes.x.title = txt;
        }
    }
    const valAx = descendant(searchRoot, 'valax');
    if (valAx) {
        const t = descendant(valAx, 'title');
        if (t) {
            const txt = readText(t);
            if (txt) data.axes.y.title = txt;
        }
        const scaling = descendant(valAx, 'scaling');
        if (scaling) {
            const min = childByName(scaling, 'min');
            const max = childByName(scaling, 'max');
            if (min) {
                const v = parseFloat(min.getAttribute('val'));
                if (Number.isFinite(v)) data.axes.y.min = v;
            }
            if (max) {
                const v = parseFloat(max.getAttribute('val'));
                if (Number.isFinite(v)) data.axes.y.max = v;
            }
        }
    }

    // 범례
    const legend = descendant(chartNode, 'legend');
    if (legend) {
        const pos = childByName(legend, 'legendpos');
        if (pos) {
            const v = (pos.getAttribute('val') || '').toLowerCase();
            const map = { t: 'top', b: 'bottom', l: 'left', r: 'right', tr: 'right' };
            data.legend.position = map[v] || data.legend.position;
        }
        data.legend.visible = true;
    } else {
        // legend 노드가 명시적으로 없으면 보이지 않음으로 간주하지 않고 기본값 유지
        // (HWP 의 차트는 대부분 범례 기본 표시)
    }

    return data;
}

/**
 * HWPX <hp:chart> 형식 파서.
 *
 * HWPX 차트는 비공식 명세 — 실제 한컴 산출물은 거의 OOXML 임베드 형태이지만,
 * 최소한의 형태로 다음을 지원한다.
 *
 * <hp:chart type="bar" title="매출">
 *   <hp:categories><hp:c>1월</hp:c><hp:c>2월</hp:c></hp:categories>
 *   <hp:series name="A" color="#FF0000">
 *     <hp:v>10</hp:v><hp:v>20</hp:v>
 *   </hp:series>
 *   <hp:legend pos="bottom" visible="true"/>
 *   <hp:xAxis title="월"/>
 *   <hp:yAxis title="원" min="0" max="100"/>
 * </hp:chart>
 */
function parseHwpxChart(root) {
    const data = {
        type: 'bar',
        title: '',
        subtitle: '',
        categories: [],
        series: [],
        axes: { x: {}, y: {} },
        legend: { position: 'bottom', visible: true }
    };

    // type 결정
    const typeAttr = (root.getAttribute('type') || root.getAttribute('chartType') || '').toLowerCase();
    if (typeAttr && HWPX_TYPE_MAP[typeAttr] !== undefined) {
        data.type = HWPX_TYPE_MAP[typeAttr];
    }

    // 타이틀
    const titleAttr = root.getAttribute('title');
    if (titleAttr) data.title = titleAttr;
    const titleEl = childByName(root, 'title');
    if (titleEl) data.title = readText(titleEl) || data.title;
    const subtitleEl = childByName(root, 'subtitle');
    if (subtitleEl) data.subtitle = readText(subtitleEl);

    // categories
    const catEl = childByName(root, 'categories') || childByName(root, 'cat');
    if (catEl) {
        const items = childrenByName(catEl, 'c').length
            ? childrenByName(catEl, 'c')
            : childrenByName(catEl, 'item');
        if (items.length > 0) {
            data.categories = items.map(it => (it.textContent || '').trim());
        } else {
            // 콤마 구분 텍스트 폴백
            const txt = (catEl.textContent || '').trim();
            if (txt) data.categories = txt.split(',').map(s => s.trim());
        }
    }

    // series
    const seriesEls = childrenByName(root, 'series').length
        ? childrenByName(root, 'series')
        : childrenByName(root, 'ser');
    for (const sEl of seriesEls) {
        const s = { name: '', data: [], color: null };
        s.name = sEl.getAttribute('name') || '';
        const colorAttr = sEl.getAttribute('color') || sEl.getAttribute('fillColor');
        if (colorAttr) {
            const c = normalizeColor(colorAttr);
            if (c) s.color = c;
        }
        const valueEls = childrenByName(sEl, 'v').length
            ? childrenByName(sEl, 'v')
            : childrenByName(sEl, 'value');
        if (valueEls.length > 0) {
            s.data = valueEls.map(v => {
                const n = parseFloat(v.textContent);
                return Number.isFinite(n) ? n : 0;
            });
        } else {
            // data 속성 또는 텍스트 폴백 (콤마 구분)
            const dataAttr = sEl.getAttribute('data') || (sEl.textContent || '').trim();
            if (dataAttr) {
                s.data = dataAttr.split(',').map(t => {
                    const n = parseFloat(t.trim());
                    return Number.isFinite(n) ? n : 0;
                });
            }
        }
        data.series.push(s);
    }

    // legend
    const legendEl = childByName(root, 'legend');
    if (legendEl) {
        const pos = (legendEl.getAttribute('pos') || legendEl.getAttribute('position') || '').toLowerCase();
        if (['top', 'bottom', 'left', 'right', 'none'].includes(pos)) {
            data.legend.position = pos;
        }
        const visAttr = legendEl.getAttribute('visible');
        if (visAttr != null) {
            data.legend.visible = visAttr !== 'false' && visAttr !== '0';
        }
    }

    // axes
    const xAxis = childByName(root, 'xaxis') || childByName(root, 'xAxis'.toLowerCase());
    if (xAxis) {
        const t = xAxis.getAttribute('title');
        if (t) data.axes.x.title = t;
        const ty = xAxis.getAttribute('type');
        if (ty) data.axes.x.type = ty;
        const mn = parseFloat(xAxis.getAttribute('min'));
        if (Number.isFinite(mn)) data.axes.x.min = mn;
        const mx = parseFloat(xAxis.getAttribute('max'));
        if (Number.isFinite(mx)) data.axes.x.max = mx;
    }
    const yAxis = childByName(root, 'yaxis');
    if (yAxis) {
        const t = yAxis.getAttribute('title');
        if (t) data.axes.y.title = t;
        const ty = yAxis.getAttribute('type');
        if (ty) data.axes.y.type = ty;
        const mn = parseFloat(yAxis.getAttribute('min'));
        if (Number.isFinite(mn)) data.axes.y.min = mn;
        const mx = parseFloat(yAxis.getAttribute('max'));
        if (Number.isFinite(mx)) data.axes.y.max = mx;
    }

    return data;
}

/**
 * 차트 XML 을 정규화된 데이터로 변환한다.
 *
 * @param {string|Element|Document} input  - XML 문자열 또는 DOM Element
 * @returns {Object|null}                  - ChartData (실패 시 null)
 *
 * @example
 *   const data = parseChart('<hp:chart type="bar">...</hp:chart>');
 *   data.series.forEach(s => console.log(s.name, s.data));
 */
export function parseChart(input) {
    const root = toElement(input);
    if (!root) return null;

    const name = lname(root);

    // OOXML chartSpace 또는 그 후손에 chartSpace 가 있는지 검사
    if (name === 'chartspace' || descendant(root, 'chartspace')) {
        const space = name === 'chartspace' ? root : descendant(root, 'chartspace');
        return parseOoxmlChart(space);
    }

    // HWPX chart
    if (name === 'chart' || descendant(root, 'chart')) {
        const chart = name === 'chart' ? root : descendant(root, 'chart');
        return parseHwpxChart(chart);
    }

    // 알 수 없는 루트지만 chart 후손 탐색 폴백
    const anyOoxml = descendant(root, 'chartspace');
    if (anyOoxml) return parseOoxmlChart(anyOoxml);

    return null;
}

/**
 * 정규화된 ChartData → HWPX 호환 XML 문자열로 직렬화한다 (역방향 round-trip 용).
 * exporter 통합은 별도 트랙에서 진행하며, 본 함수는 단위 테스트와 미래 통합에 사용.
 *
 * @param {Object} data - parseChart 출력
 * @returns {string} HWPX chart XML
 */
export function serializeChart(data) {
    if (!data) return '';
    const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const lines = [];
    const attrs = [
        'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"',
        `type="${esc(data.type || 'bar')}"`
    ];
    if (data.title) attrs.push(`title="${esc(data.title)}"`);
    lines.push(`<hp:chart ${attrs.join(' ')}>`);

    if (data.subtitle) {
        lines.push(`  <hp:subtitle>${esc(data.subtitle)}</hp:subtitle>`);
    }

    if (Array.isArray(data.categories) && data.categories.length) {
        lines.push('  <hp:categories>');
        for (const c of data.categories) {
            lines.push(`    <hp:c>${esc(c)}</hp:c>`);
        }
        lines.push('  </hp:categories>');
    }

    if (Array.isArray(data.series)) {
        for (const s of data.series) {
            const sAttrs = [];
            if (s.name) sAttrs.push(`name="${esc(s.name)}"`);
            if (s.color) sAttrs.push(`color="${esc(s.color)}"`);
            lines.push(`  <hp:series ${sAttrs.join(' ')}>`);
            for (const v of (s.data || [])) {
                lines.push(`    <hp:v>${esc(v)}</hp:v>`);
            }
            lines.push('  </hp:series>');
        }
    }

    if (data.axes) {
        if (data.axes.x) {
            const xa = [];
            if (data.axes.x.title) xa.push(`title="${esc(data.axes.x.title)}"`);
            if (data.axes.x.type) xa.push(`type="${esc(data.axes.x.type)}"`);
            if (Number.isFinite(data.axes.x.min)) xa.push(`min="${data.axes.x.min}"`);
            if (Number.isFinite(data.axes.x.max)) xa.push(`max="${data.axes.x.max}"`);
            if (xa.length) lines.push(`  <hp:xAxis ${xa.join(' ')}/>`);
        }
        if (data.axes.y) {
            const ya = [];
            if (data.axes.y.title) ya.push(`title="${esc(data.axes.y.title)}"`);
            if (data.axes.y.type) ya.push(`type="${esc(data.axes.y.type)}"`);
            if (Number.isFinite(data.axes.y.min)) ya.push(`min="${data.axes.y.min}"`);
            if (Number.isFinite(data.axes.y.max)) ya.push(`max="${data.axes.y.max}"`);
            if (ya.length) lines.push(`  <hp:yAxis ${ya.join(' ')}/>`);
        }
    }

    if (data.legend) {
        const la = [`pos="${esc(data.legend.position || 'bottom')}"`,
                    `visible="${data.legend.visible !== false}"`];
        lines.push(`  <hp:legend ${la.join(' ')}/>`);
    }

    lines.push('</hp:chart>');
    return lines.join('\n');
}

/**
 * 차트 데이터가 렌더링에 충분한지 빠르게 검사.
 * @param {Object} data
 * @returns {boolean}
 */
export function isRenderableChart(data) {
    if (!data || !data.type) return false;
    if (!SUPPORTED_CHART_TYPES.has(data.type)) return false;
    if (!Array.isArray(data.series) || data.series.length === 0) return false;
    return data.series.some(s => Array.isArray(s.data) && s.data.length > 0);
}

export default {
    parseChart,
    serializeChart,
    isRenderableChart,
    SUPPORTED_CHART_TYPES
};
