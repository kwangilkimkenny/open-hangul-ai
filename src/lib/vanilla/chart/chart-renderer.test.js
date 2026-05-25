/**
 * Chart Renderer Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
    renderChart,
    renderBarChart,
    renderLineChart,
    renderAreaChart,
    renderPieChart,
    renderPlaceholderChart,
    DEFAULT_PALETTE
} from './chart-renderer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function baseData(overrides = {}) {
    return {
        type: 'bar',
        title: '',
        subtitle: '',
        categories: ['A', 'B', 'C'],
        series: [{ name: 'S1', data: [10, 20, 30] }],
        axes: { x: {}, y: {} },
        legend: { position: 'bottom', visible: true },
        ...overrides
    };
}

describe('chart-renderer', () => {

    describe('renderBarChart (horizontal bar)', () => {
        it('returns an SVG root with rectangles for each bar', () => {
            const data = baseData({ type: 'bar' });
            const svgEl = renderBarChart(data);
            expect(svgEl.namespaceURI).toBe(SVG_NS);
            expect(svgEl.tagName.toLowerCase()).toBe('svg');
            const rects = svgEl.querySelectorAll('rect[data-series]');
            // 1 series × 3 categories = 3 bars
            expect(rects.length).toBe(3);
            // 라벨이 모두 들어 있는지
            const texts = Array.from(svgEl.querySelectorAll('text')).map(t => t.textContent);
            expect(texts).toContain('A');
            expect(texts).toContain('B');
        });

        it('renders multiple series side-by-side (column variant)', () => {
            const data = baseData({
                type: 'column',
                categories: ['Q1', 'Q2'],
                series: [
                    { name: 'A', data: [10, 20] },
                    { name: 'B', data: [30, 40] }
                ]
            });
            const svgEl = renderBarChart(data);
            const bars = svgEl.querySelectorAll('rect[data-series]');
            // 2 series × 2 categories = 4 bars
            expect(bars.length).toBe(4);
        });

        it('applies series color when provided, else palette color', () => {
            const data = baseData({
                type: 'column',
                series: [{ name: 'S', data: [1, 2, 3], color: '#ABCDEF' }]
            });
            const svgEl = renderBarChart(data);
            const firstBar = svgEl.querySelector('rect[data-series]');
            expect(firstBar.getAttribute('fill').toUpperCase()).toBe('#ABCDEF');

            const dataNoColor = baseData({ type: 'column' });
            const svgEl2 = renderBarChart(dataNoColor);
            const firstBar2 = svgEl2.querySelector('rect[data-series]');
            expect(firstBar2.getAttribute('fill')).toBe(DEFAULT_PALETTE[0]);
        });
    });

    describe('renderLineChart', () => {
        it('renders polylines and circle markers', () => {
            const data = baseData({
                type: 'line',
                series: [{ name: 'A', data: [1, 2, 3, 4] }],
                categories: ['a', 'b', 'c', 'd']
            });
            const svgEl = renderLineChart(data);
            const polylines = svgEl.querySelectorAll('polyline[data-series]');
            expect(polylines.length).toBe(1);
            const circles = svgEl.querySelectorAll('circle[data-series]');
            expect(circles.length).toBe(4);
        });

        it('draws title when provided', () => {
            const data = baseData({ type: 'line', title: '추세선' });
            const svgEl = renderLineChart(data);
            const titleText = Array.from(svgEl.querySelectorAll('text'))
                .find(t => t.textContent === '추세선');
            expect(titleText).toBeTruthy();
            expect(titleText.getAttribute('font-weight')).toBe('bold');
        });
    });

    describe('renderAreaChart', () => {
        it('produces a polygon per series plus an upper polyline', () => {
            const data = baseData({
                type: 'area',
                series: [
                    { name: 'A', data: [5, 10, 7] },
                    { name: 'B', data: [3, 6, 9] }
                ]
            });
            const svgEl = renderAreaChart(data);
            const polys = svgEl.querySelectorAll('polygon[data-series]');
            expect(polys.length).toBe(2);
            const lines = svgEl.querySelectorAll('polyline[data-series]');
            expect(lines.length).toBe(2);
            // 영역에 투명도 적용 확인
            expect(polys[0].getAttribute('fill-opacity')).toBe('0.35');
        });
    });

    describe('renderPieChart', () => {
        it('creates one path per slice from the first series only', () => {
            const data = baseData({
                type: 'pie',
                categories: ['사과', '배', '귤'],
                series: [{ name: '판매', data: [40, 30, 30] }]
            });
            const svgEl = renderPieChart(data);
            const slices = svgEl.querySelectorAll('path[data-category]');
            expect(slices.length).toBe(3);
            // 슬라이스가 충분히 크므로 라벨이 들어가야 함
            const texts = Array.from(svgEl.querySelectorAll('text')).map(t => t.textContent);
            expect(texts).toContain('사과');
        });

        it('renders doughnut hole (inner radius > 0) when type=doughnut', () => {
            const data = baseData({
                type: 'doughnut',
                series: [{ name: 'X', data: [50, 50] }]
            });
            const svgEl = renderPieChart(data);
            const slices = svgEl.querySelectorAll('path[data-category]');
            expect(slices.length).toBe(2);
            // 도넛 path 는 안쪽 아크를 포함하므로 두 번의 A 명령이 들어 있음
            const d = slices[0].getAttribute('d');
            const arcMatches = d.match(/A /g) || [];
            expect(arcMatches.length).toBeGreaterThanOrEqual(2);
        });

        it('returns empty SVG when total is zero', () => {
            const data = baseData({
                type: 'pie',
                series: [{ name: 'X', data: [0, 0, 0] }]
            });
            const svgEl = renderPieChart(data);
            const slices = svgEl.querySelectorAll('path[data-category]');
            expect(slices.length).toBe(0);
        });
    });

    describe('renderChart (dispatcher)', () => {
        it('routes bar/column/line/area/pie/doughnut to specific renderers', () => {
            for (const type of ['bar', 'column', 'line', 'area', 'pie', 'doughnut']) {
                const data = baseData({ type, series: [{ name: 'X', data: [1, 2, 3] }] });
                const svgEl = renderChart(data);
                expect(svgEl.tagName.toLowerCase()).toBe('svg');
                expect(svgEl.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
            }
        });

        it('returns a placeholder for unsupported types (scatter/radar)', () => {
            const svgEl = renderChart({ type: 'scatter', series: [{ data: [1] }] });
            const t = svgEl.querySelector('text');
            expect(t.textContent).toContain('scatter');
        });

        it('returns placeholder for empty / invalid data', () => {
            const svgEl = renderChart(null);
            expect(svgEl.tagName.toLowerCase()).toBe('svg');
            expect(svgEl.querySelector('text')).toBeTruthy();
        });

        it('SVG uses responsive viewBox (100% width)', () => {
            const svgEl = renderChart(baseData());
            expect(svgEl.style.width).toBe('100%');
            expect(svgEl.style.height).toBe('auto');
        });
    });

    describe('renderPlaceholderChart', () => {
        it('shows a placeholder message for any type', () => {
            const svgEl = renderPlaceholderChart({ type: 'radar' });
            const t = svgEl.querySelector('text');
            expect(t.textContent).toContain('radar');
        });
    });
});
