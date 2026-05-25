/**
 * Chart Editor Dialog Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openChartDialog, buildChartRunXml } from './chart-dialog.js';

describe('chart-editor / chart-dialog', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('모달이 body 에 마운트되고 3개의 패널이 존재한다', () => {
        const dialog = openChartDialog({ debounceMs: 0 });
        const backdrop = document.querySelector('.hwp-chart-dialog-backdrop');
        expect(backdrop).toBeTruthy();
        // 좌/중/우
        expect(document.querySelector('.hwp-chart-dialog-col-data')).toBeTruthy();
        expect(document.querySelector('.hwp-chart-dialog-col-preview')).toBeTruthy();
        expect(document.querySelector('.hwp-chart-dialog-col-options')).toBeTruthy();
        // 첫 렌더 SVG 즉시 등장
        expect(document.querySelector('.hwp-chart-dialog-col-preview svg')).toBeTruthy();
        dialog.close();
    });

    it('"삽입" 버튼 클릭 시 onInsert 콜백이 ChartData 와 함께 호출된다', () => {
        const onInsert = vi.fn();
        openChartDialog({ debounceMs: 0, onInsert });
        const btn = document.querySelector('button[data-action="insert"]');
        btn.click();
        expect(onInsert).toHaveBeenCalledOnce();
        const data = onInsert.mock.calls[0][0];
        expect(data).toHaveProperty('type');
        expect(Array.isArray(data.series)).toBe(true);
        expect(Array.isArray(data.categories)).toBe(true);
        // 다이얼로그는 자동 닫혀야 한다
        expect(document.querySelector('.hwp-chart-dialog-backdrop')).toBeNull();
    });

    it('"취소" 버튼 클릭 시 onCancel 만 호출되고 onInsert 는 호출되지 않는다', () => {
        const onInsert = vi.fn();
        const onCancel = vi.fn();
        openChartDialog({ debounceMs: 0, onInsert, onCancel });
        const cancelBtn = document.querySelector('button[data-action="cancel"]');
        cancelBtn.click();
        expect(onCancel).toHaveBeenCalled();
        expect(onInsert).not.toHaveBeenCalled();
        expect(document.querySelector('.hwp-chart-dialog-backdrop')).toBeNull();
    });

    it('Escape 키로 다이얼로그가 취소된다', () => {
        const onCancel = vi.fn();
        openChartDialog({ debounceMs: 0, onCancel });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onCancel).toHaveBeenCalled();
    });

    it('getSerializedXml 은 트랙 K serializeChart 출력을 반환한다', () => {
        const dialog = openChartDialog({ debounceMs: 0 });
        const xml = dialog.getSerializedXml();
        expect(xml).toContain('<hp:chart');
        expect(xml).toContain('xmlns:hp=');
        expect(xml).toContain('</hp:chart>');
        dialog.close();
    });

    it('buildChartRunXml 은 hp:run 으로 감싼 차트 XML 을 만든다', () => {
        const xml = buildChartRunXml({
            type: 'bar',
            title: 'T',
            categories: ['A'],
            series: [{ name: 'S', data: [1] }]
        });
        expect(xml.startsWith('<hp:run>')).toBe(true);
        expect(xml.endsWith('</hp:run>')).toBe(true);
        expect(xml).toContain('<hp:chart');
    });
});
