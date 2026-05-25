/**
 * Chart Options Panel Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOptionsPanel, defaultChartOptions } from './options-panel.js';
import { SUPPORTED_CHART_TYPES } from '../chart/chart-parser.js';

function mount() {
    const div = document.createElement('div');
    document.body.appendChild(div);
    return div;
}

function fireChange(el, value) {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
}
function fireInput(el, value) {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('chart-editor / options-panel', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('기본 옵션으로 초기 렌더 시 모든 섹션이 그려진다', () => {
        const container = mount();
        const panel = createOptionsPanel(container);
        // 차트 타입 옵션 개수는 SUPPORTED_CHART_TYPES 와 같다
        const typeOptions = container.querySelectorAll('select[data-field="type"] option');
        expect(typeOptions.length).toBe(SUPPORTED_CHART_TYPES.size);
        // 팔레트 스와치 10 개
        const swatches = container.querySelectorAll('input[type="color"]');
        expect(swatches.length).toBe(10);
        // 기본 타입
        expect(panel.getOptions().type).toBe('column');
    });

    it('차트 타입 변경 시 onChange 콜백을 호출한다', () => {
        const container = mount();
        const onChange = vi.fn();
        const panel = createOptionsPanel(container, { onChange });
        const sel = container.querySelector('select[data-field="type"]');
        fireChange(sel, 'line');
        expect(panel.getOptions().type).toBe('line');
        expect(onChange).toHaveBeenCalled();
    });

    it('제목/부제 입력은 옵션에 즉시 반영된다', () => {
        const container = mount();
        const panel = createOptionsPanel(container);
        const title = container.querySelector('input[data-field="title"]');
        const subtitle = container.querySelector('input[data-field="subtitle"]');
        fireInput(title, '월별 매출');
        fireInput(subtitle, '2026 상반기');
        const o = panel.getOptions();
        expect(o.title).toBe('월별 매출');
        expect(o.subtitle).toBe('2026 상반기');
    });

    it('축 최소/최대 값은 숫자로 변환되며 빈 값은 null', () => {
        const container = mount();
        const panel = createOptionsPanel(container);
        const yMin = container.querySelector('input[data-field="yAxis.min"]');
        const yMax = container.querySelector('input[data-field="yAxis.max"]');
        fireInput(yMin, '0');
        fireInput(yMax, '100');
        expect(panel.getOptions().yAxis.min).toBe(0);
        expect(panel.getOptions().yAxis.max).toBe(100);
        fireInput(yMin, '');
        expect(panel.getOptions().yAxis.min).toBeNull();
    });

    it('범례 위치 변경이 정확히 반영된다', () => {
        const container = mount();
        const panel = createOptionsPanel(container);
        const sel = container.querySelector('select[data-field="legend.position"]');
        fireChange(sel, 'right');
        const o = panel.getOptions();
        expect(o.legend.position).toBe('right');
        expect(o.legend.visible).toBe(true);
    });

    it('"숨김" 선택 시 legend.visible 이 false', () => {
        const container = mount();
        const panel = createOptionsPanel(container);
        const sel = container.querySelector('select[data-field="legend.position"]');
        fireChange(sel, 'none');
        expect(panel.getOptions().legend.visible).toBe(false);
    });

    it('팔레트 색상 변경은 해당 인덱스 만 갱신한다', () => {
        const container = mount();
        const panel = createOptionsPanel(container);
        const sw = container.querySelectorAll('input[type="color"]');
        // 일부 jsdom 환경은 #FF0000 을 #ff0000 으로 정규화한다
        fireInput(sw[0], '#ff0000');
        const o = panel.getOptions();
        expect(o.palette[0].toLowerCase()).toBe('#ff0000');
        // 두번째 색상은 기존 유지
        expect(o.palette[1]).toBe(defaultChartOptions().palette[1]);
    });

    it('setOptions 는 외부에서 옵션을 일괄 갱신한다', () => {
        const container = mount();
        const panel = createOptionsPanel(container);
        panel.setOptions({
            type: 'pie',
            title: 'T',
            subtitle: 'S',
            xAxis: { title: 'x', min: null, max: null },
            yAxis: { title: 'y', min: 0, max: 50 },
            legend: { position: 'top', visible: true },
            palette: defaultChartOptions().palette
        });
        const o = panel.getOptions();
        expect(o.type).toBe('pie');
        expect(o.title).toBe('T');
        expect(o.yAxis.max).toBe(50);
    });

    it('destroy 호출 시 컨테이너가 비워진다', () => {
        const container = mount();
        const panel = createOptionsPanel(container);
        panel.destroy();
        expect(container.children.length).toBe(0);
    });
});
