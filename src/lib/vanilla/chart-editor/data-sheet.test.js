/**
 * Chart Data Sheet Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataSheet } from './data-sheet.js';

function mount() {
    const div = document.createElement('div');
    document.body.appendChild(div);
    return div;
}

function dispatchInput(input, value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('chart-editor / data-sheet', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('초기 데이터로 헤더 + 본문 셀을 렌더한다', () => {
        const container = mount();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['Q1', 'Q2'],
                series: [{ name: '매출', data: [100, 200] }]
            }
        });
        // 헤더: 1 corner + 2 카테고리
        const ths = container.querySelectorAll('thead th');
        expect(ths.length).toBe(3);
        // 본문 1행: th(시리즈 이름) + 2 data cells
        const tds = container.querySelectorAll('tbody td');
        expect(tds.length).toBe(2);
        expect(sheet.getState().categories).toEqual(['Q1', 'Q2']);
    });

    it('데이터 셀 편집 시 숫자로 파싱하고 onChange 콜백을 호출한다', () => {
        const container = mount();
        const onChange = vi.fn();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['A'],
                series: [{ name: 'S1', data: [0] }]
            },
            onChange
        });
        const dataInput = container.querySelector('input[data-row="1"][data-col="1"]');
        dispatchInput(dataInput, '42');
        const st = sheet.getState();
        expect(st.series[0].data[0]).toBe(42);
        expect(onChange).toHaveBeenCalled();
    });

    it('카테고리(첫 행) 편집은 문자열로 저장된다', () => {
        const container = mount();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['A', 'B'],
                series: [{ name: 'S1', data: [1, 2] }]
            }
        });
        const catInput = container.querySelector('input[data-row="0"][data-col="2"]');
        dispatchInput(catInput, '신규');
        expect(sheet.getState().categories).toEqual(['A', '신규']);
    });

    it('시리즈 이름(첫 열) 편집은 시리즈 name 을 갱신한다', () => {
        const container = mount();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['A'],
                series: [{ name: '기존', data: [1] }]
            }
        });
        const nameInput = container.querySelector('input[data-row="1"][data-col="0"]');
        dispatchInput(nameInput, '변경됨');
        expect(sheet.getState().series[0].name).toBe('변경됨');
    });

    it('+ 행 / + 열 버튼이 시리즈와 카테고리를 추가한다', () => {
        const container = mount();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['A'],
                series: [{ name: 'S1', data: [1] }]
            }
        });
        sheet.addRow();
        expect(sheet.getState().series.length).toBe(2);
        // 새 행은 0 으로 패딩
        expect(sheet.getState().series[1].data).toEqual([0]);
        sheet.addColumn();
        expect(sheet.getState().categories.length).toBe(2);
        // 모든 시리즈에 0 컬럼 추가
        for (const s of sheet.getState().series) {
            expect(s.data.length).toBe(2);
        }
    });

    it('− 행 / − 열 버튼이 마지막 항목을 제거한다', () => {
        const container = mount();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['A', 'B', 'C'],
                series: [
                    { name: 'S1', data: [1, 2, 3] },
                    { name: 'S2', data: [4, 5, 6] }
                ]
            }
        });
        sheet.removeRow();
        expect(sheet.getState().series.length).toBe(1);
        sheet.removeColumn();
        expect(sheet.getState().categories.length).toBe(2);
        expect(sheet.getState().series[0].data).toEqual([1, 2]);
    });

    it('최소 1행 / 1열은 유지된다', () => {
        const container = mount();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['A'],
                series: [{ name: 'S1', data: [1] }]
            }
        });
        sheet.removeRow();
        sheet.removeColumn();
        expect(sheet.getState().series.length).toBe(1);
        expect(sheet.getState().categories.length).toBe(1);
    });

    it('Enter 키는 다음 행 동일 열로 포커스를 이동한다', () => {
        const container = mount();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['A'],
                series: [
                    { name: 'S1', data: [1] },
                    { name: 'S2', data: [2] }
                ]
            }
        });
        const cell = container.querySelector('input[data-row="1"][data-col="1"]');
        cell.focus();
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const next = document.activeElement;
        expect(next).toBe(container.querySelector('input[data-row="2"][data-col="1"]'));
        // 사용 안 함 경고 회피
        expect(sheet.getState().series.length).toBe(2);
    });

    it('Tab 키는 다음 열로, Shift+Tab 은 이전 열로 이동한다', () => {
        const container = mount();
        createDataSheet(container, {
            initial: {
                categories: ['A', 'B'],
                series: [{ name: 'S1', data: [1, 2] }]
            }
        });
        const cell = container.querySelector('input[data-row="1"][data-col="1"]');
        cell.focus();
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(document.activeElement).toBe(
            container.querySelector('input[data-row="1"][data-col="2"]')
        );
        // 다시 Shift+Tab → 좌측
        document.activeElement.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
        );
        expect(document.activeElement).toBe(
            container.querySelector('input[data-row="1"][data-col="1"]')
        );
    });

    it('setState 는 외부에서 데이터를 갈아끼울 수 있다', () => {
        const container = mount();
        const onChange = vi.fn();
        const sheet = createDataSheet(container, { onChange });
        sheet.setState({
            categories: ['X', 'Y', 'Z'],
            series: [{ name: 'A', data: [1, 2, 3] }]
        });
        const st = sheet.getState();
        expect(st.categories).toEqual(['X', 'Y', 'Z']);
        expect(st.series[0].data).toEqual([1, 2, 3]);
        expect(onChange).toHaveBeenCalled();
    });

    it('비숫자 입력은 0 으로 안전 변환된다', () => {
        const container = mount();
        const sheet = createDataSheet(container, {
            initial: {
                categories: ['A'],
                series: [{ name: 'S1', data: [5] }]
            }
        });
        const cell = container.querySelector('input[data-row="1"][data-col="1"]');
        dispatchInput(cell, 'abc');
        expect(sheet.getState().series[0].data[0]).toBe(0);
    });
});
