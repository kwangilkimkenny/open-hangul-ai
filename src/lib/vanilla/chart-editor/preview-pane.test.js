/**
 * Chart Preview Pane Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPreviewPane, buildChartData } from './preview-pane.js';
import { defaultChartOptions } from './options-panel.js';

function mount() {
    const div = document.createElement('div');
    document.body.appendChild(div);
    return div;
}

const SAMPLE_SHEET = {
    categories: ['A', 'B', 'C'],
    series: [{ name: 'S1', data: [1, 2, 3] }]
};

describe('chart-editor / preview-pane', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('buildChartData 는 시트와 옵션을 트랙 K 호환 ChartData 로 합친다', () => {
        const data = buildChartData(SAMPLE_SHEET, {
            ...defaultChartOptions(),
            type: 'column',
            title: 'T'
        });
        expect(data.type).toBe('column');
        expect(data.title).toBe('T');
        expect(data.categories).toEqual(['A', 'B', 'C']);
        expect(data.series[0].data).toEqual([1, 2, 3]);
        expect(data.series[0].color).toBeTruthy();
    });

    it('debounce=0 일 때 update 즉시 SVG 가 렌더된다', () => {
        const container = mount();
        const pane = createPreviewPane(container, { debounceMs: 0 });
        pane.update(SAMPLE_SHEET, defaultChartOptions());
        const svgEl = container.querySelector('svg');
        expect(svgEl).toBeTruthy();
        expect(pane.getRenderCount()).toBe(1);
    });

    it('flush() 호출 시 디바운스 타이머가 즉시 발사된다', () => {
        vi.useFakeTimers();
        const container = mount();
        const pane = createPreviewPane(container, { debounceMs: 100 });
        pane.update(SAMPLE_SHEET, defaultChartOptions());
        expect(container.querySelector('svg')).toBeNull();
        pane.flush();
        expect(container.querySelector('svg')).toBeTruthy();
    });

    it('연속 update 는 디바운스 되어 1회만 렌더된다', () => {
        vi.useFakeTimers();
        const container = mount();
        const pane = createPreviewPane(container, { debounceMs: 50 });
        pane.update(SAMPLE_SHEET, defaultChartOptions());
        pane.update(SAMPLE_SHEET, defaultChartOptions());
        pane.update(SAMPLE_SHEET, defaultChartOptions());
        vi.advanceTimersByTime(60);
        expect(pane.getRenderCount()).toBe(1);
    });

    it('데이터 변경 후 재 update 시 svg 가 재렌더된다', () => {
        const container = mount();
        const pane = createPreviewPane(container, { debounceMs: 0 });
        pane.update(SAMPLE_SHEET, defaultChartOptions());
        const first = pane.getLastSvg();
        pane.update(
            { categories: ['X'], series: [{ name: 'S', data: [99] }] },
            defaultChartOptions()
        );
        const second = pane.getLastSvg();
        expect(second).not.toBe(first);
        expect(pane.getRenderCount()).toBe(2);
    });

    it('destroy 호출 시 SVG 가 제거되고 타이머가 취소된다', () => {
        vi.useFakeTimers();
        const container = mount();
        const pane = createPreviewPane(container, { debounceMs: 100 });
        pane.update(SAMPLE_SHEET, defaultChartOptions());
        pane.destroy();
        vi.advanceTimersByTime(200);
        expect(container.querySelector('svg')).toBeNull();
        expect(pane.getRenderCount()).toBe(0);
    });
});
