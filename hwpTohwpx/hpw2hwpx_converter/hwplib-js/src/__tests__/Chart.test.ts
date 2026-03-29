/**
 * 차트 헬퍼 및 SVG 렌더링 테스트
 */

import { ChartHelper, ChartType, LegendPosition, WrapType, AnchorType, TextAlignment } from '../models/Chart';
import type { Chart, ChartData } from '../models/Chart';

function createMockChart(overrides: Partial<Chart> = {}): Chart {
    return {
        id: 0,
        type: ChartType.COLUMN,
        x: 0, y: 0,
        width: 20000, height: 15000,
        data: {
            categories: ['Q1', 'Q2', 'Q3', 'Q4'],
            series: [
                { name: '매출', values: [100, 150, 120, 180] },
                { name: '비용', values: [80, 90, 100, 110] },
            ]
        },
        title: { text: '분기별 실적', fontSize: 14, fontFamily: 'Arial', color: 0, alignment: TextAlignment.CENTER, visible: true },
        legend: { visible: true, position: LegendPosition.RIGHT, fontSize: 10, fontFamily: 'Arial', borderVisible: false },
        axes: {
            xAxis: { visible: true, gridLines: false, tickMarks: true, fontSize: 10 },
            yAxis: { visible: true, gridLines: true, tickMarks: true, fontSize: 10 },
        },
        plotArea: { backgroundColor: 0xFFFFFF, borderColor: 0x000000, borderWidth: 1 },
        seriesStyles: [],
        zOrder: 0,
        wrapType: WrapType.SQUARE,
        anchor: AnchorType.PARAGRAPH,
        ...overrides,
    };
}

describe('ChartHelper', () => {
    describe('getChartTypeName', () => {
        it('기본 차트 타입을 반환한다', () => {
            expect(ChartHelper.getChartTypeName(ChartType.LINE)).toBe('line');
            expect(ChartHelper.getChartTypeName(ChartType.COLUMN)).toBe('column');
            expect(ChartHelper.getChartTypeName(ChartType.PIE)).toBe('pie');
            expect(ChartHelper.getChartTypeName(ChartType.BAR)).toBe('bar');
            expect(ChartHelper.getChartTypeName(ChartType.AREA)).toBe('area');
            expect(ChartHelper.getChartTypeName(ChartType.SCATTER)).toBe('scatter');
        });

        it('3D 차트 타입을 반환한다', () => {
            expect(ChartHelper.getChartTypeName(ChartType.COLUMN_3D)).toBe('column3d');
            expect(ChartHelper.getChartTypeName(ChartType.PIE_3D)).toBe('pie3d');
            expect(ChartHelper.getChartTypeName(ChartType.BAR_3D)).toBe('bar3d');
        });

        it('특수 차트 타입을 반환한다', () => {
            expect(ChartHelper.getChartTypeName(ChartType.WATERFALL)).toBe('waterfall');
            expect(ChartHelper.getChartTypeName(ChartType.TREEMAP)).toBe('treemap');
            expect(ChartHelper.getChartTypeName(ChartType.HISTOGRAM)).toBe('histogram');
            expect(ChartHelper.getChartTypeName(ChartType.FUNNEL)).toBe('funnel');
        });

        it('알 수 없는 타입은 line을 반환한다', () => {
            expect(ChartHelper.getChartTypeName(999 as ChartType)).toBe('line');
        });
    });

    describe('assignDefaultColors', () => {
        it('색상이 없는 시리즈에 기본 색상을 할당한다', () => {
            const series: { name: string; values: number[]; color?: string }[] = [
                { name: 'A', values: [1, 2] },
                { name: 'B', values: [3, 4] },
            ];
            ChartHelper.assignDefaultColors(series);
            expect(series[0].color).toBe(ChartHelper.DEFAULT_COLORS[0]);
            expect(series[1].color).toBe(ChartHelper.DEFAULT_COLORS[1]);
        });

        it('이미 색상이 있는 시리즈는 변경하지 않는다', () => {
            const series: { name: string; values: number[]; color?: string }[] = [
                { name: 'A', values: [1], color: '#FF0000' },
            ];
            ChartHelper.assignDefaultColors(series);
            expect(series[0].color).toBe('#FF0000');
        });
    });

    describe('validateChartData', () => {
        it('유효한 데이터를 true로 반환한다', () => {
            const data: ChartData = {
                categories: ['A', 'B'],
                series: [{ name: 'S1', values: [1, 2] }],
            };
            expect(ChartHelper.validateChartData(data)).toBe(true);
        });

        it('시리즈가 없으면 false를 반환한다', () => {
            const data: ChartData = { categories: ['A'], series: [] };
            expect(ChartHelper.validateChartData(data)).toBe(false);
        });

        it('값이 없는 시리즈는 false를 반환한다', () => {
            const data: ChartData = {
                categories: ['A'],
                series: [{ name: 'S1', values: [] }],
            };
            expect(ChartHelper.validateChartData(data)).toBe(false);
        });
    });

    describe('chartDataToCSV', () => {
        it('차트 데이터를 CSV로 변환한다', () => {
            const data: ChartData = {
                categories: ['Q1', 'Q2'],
                series: [{ name: '매출', values: [100, 200] }],
            };
            const csv = ChartHelper.chartDataToCSV(data);
            expect(csv).toContain('Category,매출');
            expect(csv).toContain('Q1,100');
            expect(csv).toContain('Q2,200');
        });
    });

    describe('chartToSvg', () => {
        it('막대 차트를 SVG로 렌더링한다', () => {
            const chart = createMockChart({ type: ChartType.COLUMN });
            const svg = ChartHelper.chartToSvg(chart);
            expect(svg).toContain('<svg');
            expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('<rect'); // bar elements
            expect(svg).toContain('분기별 실적'); // title
        });

        it('꺾은선 차트를 SVG로 렌더링한다', () => {
            const chart = createMockChart({ type: ChartType.LINE });
            const svg = ChartHelper.chartToSvg(chart);
            expect(svg).toContain('<polyline');
            expect(svg).toContain('<circle'); // markers
        });

        it('원형 차트를 SVG로 렌더링한다', () => {
            const chart = createMockChart({
                type: ChartType.PIE,
                data: { categories: ['A', 'B', 'C'], series: [{ name: 'Data', values: [30, 50, 20] }] }
            });
            const svg = ChartHelper.chartToSvg(chart);
            expect(svg).toContain('<path');
            expect(svg).toContain('%'); // percentage labels
        });

        it('도넛 차트를 SVG로 렌더링한다', () => {
            const chart = createMockChart({
                type: ChartType.DOUGHNUT,
                data: { categories: ['X', 'Y'], series: [{ name: 'Data', values: [60, 40] }] }
            });
            const svg = ChartHelper.chartToSvg(chart);
            expect(svg).toContain('<path');
        });

        it('영역 차트를 SVG로 렌더링한다', () => {
            const chart = createMockChart({ type: ChartType.AREA });
            const svg = ChartHelper.chartToSvg(chart);
            expect(svg).toContain('<polygon'); // filled area
        });

        it('데이터가 없으면 "No Data"를 표시한다', () => {
            const chart = createMockChart({
                data: { categories: [], series: [] }
            });
            const svg = ChartHelper.chartToSvg(chart);
            expect(svg).toContain('No Data');
        });

        it('커스텀 크기를 지원한다', () => {
            const chart = createMockChart();
            const svg = ChartHelper.chartToSvg(chart, 800, 600);
            expect(svg).toContain('width="800"');
            expect(svg).toContain('height="600"');
        });
    });
});
