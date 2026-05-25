/**
 * Chart Parser Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
    parseChart,
    serializeChart,
    isRenderableChart,
    SUPPORTED_CHART_TYPES
} from './chart-parser.js';

describe('chart-parser', () => {

    describe('SUPPORTED_CHART_TYPES', () => {
        it('exposes a sensible default set including bar/line/pie/area', () => {
            expect(SUPPORTED_CHART_TYPES.has('bar')).toBe(true);
            expect(SUPPORTED_CHART_TYPES.has('line')).toBe(true);
            expect(SUPPORTED_CHART_TYPES.has('pie')).toBe(true);
            expect(SUPPORTED_CHART_TYPES.has('area')).toBe(true);
            expect(SUPPORTED_CHART_TYPES.has('doughnut')).toBe(true);
        });
    });

    describe('parseChart(HWPX format)', () => {
        it('parses a minimal hp:chart with categories and one series', () => {
            const xml = `
                <hp:chart xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"
                          type="bar" title="매출">
                    <hp:categories>
                        <hp:c>1월</hp:c>
                        <hp:c>2월</hp:c>
                        <hp:c>3월</hp:c>
                    </hp:categories>
                    <hp:series name="제품A" color="#FF0000">
                        <hp:v>10</hp:v>
                        <hp:v>20</hp:v>
                        <hp:v>30</hp:v>
                    </hp:series>
                    <hp:legend pos="top" visible="true"/>
                    <hp:xAxis title="월"/>
                    <hp:yAxis title="원" min="0" max="100"/>
                </hp:chart>
            `;
            const data = parseChart(xml);
            expect(data).not.toBeNull();
            expect(data.type).toBe('bar');
            expect(data.title).toBe('매출');
            expect(data.categories).toEqual(['1월', '2월', '3월']);
            expect(data.series).toHaveLength(1);
            expect(data.series[0].name).toBe('제품A');
            expect(data.series[0].data).toEqual([10, 20, 30]);
            expect(data.series[0].color).toBe('#FF0000');
            expect(data.legend.position).toBe('top');
            expect(data.legend.visible).toBe(true);
            expect(data.axes.x.title).toBe('월');
            expect(data.axes.y.title).toBe('원');
            expect(data.axes.y.min).toBe(0);
            expect(data.axes.y.max).toBe(100);
        });

        it('maps numeric type codes to normalized type names', () => {
            const xml = `<hp:chart xmlns:hp="x" type="2">
                <hp:series><hp:v>1</hp:v></hp:series>
            </hp:chart>`;
            const data = parseChart(xml);
            expect(data.type).toBe('pie');
        });

        it('handles multiple series', () => {
            const xml = `<hp:chart xmlns:hp="x" type="line">
                <hp:categories><hp:c>A</hp:c><hp:c>B</hp:c></hp:categories>
                <hp:series name="S1"><hp:v>1</hp:v><hp:v>2</hp:v></hp:series>
                <hp:series name="S2"><hp:v>3</hp:v><hp:v>4</hp:v></hp:series>
            </hp:chart>`;
            const data = parseChart(xml);
            expect(data.series).toHaveLength(2);
            expect(data.series[1].data).toEqual([3, 4]);
        });
    });

    describe('parseChart(OOXML format)', () => {
        it('parses a basic OOXML barChart inside chartSpace', () => {
            const xml = `
                <c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
                              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <c:chart>
                        <c:title><c:tx><c:rich><a:p><a:r><a:t>분기 매출</a:t></a:r></a:p></c:rich></c:tx></c:title>
                        <c:plotArea>
                            <c:barChart>
                                <c:barDir val="col"/>
                                <c:ser>
                                    <c:tx><c:v>매출</c:v></c:tx>
                                    <c:spPr><a:solidFill><a:srgbClr val="4E79A7"/></a:solidFill></c:spPr>
                                    <c:cat>
                                        <c:strRef><c:strCache>
                                            <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                                            <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                                        </c:strCache></c:strRef>
                                    </c:cat>
                                    <c:val>
                                        <c:numRef><c:numCache>
                                            <c:pt idx="0"><c:v>100</c:v></c:pt>
                                            <c:pt idx="1"><c:v>250</c:v></c:pt>
                                        </c:numCache></c:numRef>
                                    </c:val>
                                </c:ser>
                            </c:barChart>
                        </c:plotArea>
                        <c:legend><c:legendPos val="b"/></c:legend>
                    </c:chart>
                </c:chartSpace>
            `;
            const data = parseChart(xml);
            expect(data).not.toBeNull();
            // barDir val=col → column
            expect(data.type).toBe('column');
            expect(data.title).toBe('분기 매출');
            expect(data.categories).toEqual(['Q1', 'Q2']);
            expect(data.series).toHaveLength(1);
            expect(data.series[0].name).toBe('매출');
            expect(data.series[0].data).toEqual([100, 250]);
            expect(data.series[0].color).toBe('#4E79A7');
            expect(data.legend.position).toBe('bottom');
        });

        it('detects pieChart and doughnutChart types', () => {
            const pieXml = `<c:chartSpace xmlns:c="x"><c:chart><c:plotArea>
                <c:pieChart><c:ser>
                    <c:val><c:numCache>
                        <c:pt idx="0"><c:v>10</c:v></c:pt>
                        <c:pt idx="1"><c:v>20</c:v></c:pt>
                    </c:numCache></c:val>
                </c:ser></c:pieChart>
            </c:plotArea></c:chart></c:chartSpace>`;
            const piData = parseChart(pieXml);
            expect(piData.type).toBe('pie');
            expect(piData.series[0].data).toEqual([10, 20]);

            const doXml = pieXml.replace(/pieChart/g, 'doughnutChart');
            const doData = parseChart(doXml);
            expect(doData.type).toBe('doughnut');
        });
    });

    describe('parseChart edge cases', () => {
        it('returns null for non-chart XML', () => {
            const xml = '<root><foo/></root>';
            expect(parseChart(xml)).toBeNull();
        });

        it('returns null for empty input', () => {
            expect(parseChart('')).toBeNull();
            expect(parseChart(null)).toBeNull();
        });

        it('accepts a DOM Element directly', () => {
            const doc = new DOMParser().parseFromString(
                '<hp:chart xmlns:hp="x" type="line"><hp:series><hp:v>5</hp:v></hp:series></hp:chart>',
                'application/xml'
            );
            const data = parseChart(doc.documentElement);
            expect(data.type).toBe('line');
            expect(data.series[0].data).toEqual([5]);
        });
    });

    describe('isRenderableChart', () => {
        it('returns true for valid chart data', () => {
            expect(isRenderableChart({
                type: 'bar',
                series: [{ name: 'A', data: [1, 2] }]
            })).toBe(true);
        });

        it('returns false for empty/invalid data', () => {
            expect(isRenderableChart(null)).toBe(false);
            expect(isRenderableChart({ type: 'bar', series: [] })).toBe(false);
            expect(isRenderableChart({ type: 'bar', series: [{ data: [] }] })).toBe(false);
            expect(isRenderableChart({ type: 'unknown', series: [{ data: [1] }] })).toBe(false);
        });
    });

    describe('serializeChart (round-trip)', () => {
        it('produces XML that parses back to equivalent data', () => {
            const original = {
                type: 'line',
                title: '월별 추이',
                subtitle: '2024',
                categories: ['1월', '2월', '3월'],
                series: [
                    { name: 'A', data: [1, 2, 3], color: '#FF0000' },
                    { name: 'B', data: [4, 5, 6], color: '#00FF00' }
                ],
                axes: {
                    x: { title: '월' },
                    y: { title: '값', min: 0, max: 10 }
                },
                legend: { position: 'top', visible: true }
            };
            const xml = serializeChart(original);
            expect(xml).toContain('<hp:chart');
            expect(xml).toContain('월별 추이');

            const parsed = parseChart(xml);
            expect(parsed.type).toBe(original.type);
            expect(parsed.title).toBe(original.title);
            expect(parsed.subtitle).toBe(original.subtitle);
            expect(parsed.categories).toEqual(original.categories);
            expect(parsed.series).toHaveLength(2);
            expect(parsed.series[0].data).toEqual(original.series[0].data);
            expect(parsed.series[0].color).toBe('#FF0000');
            expect(parsed.axes.y.min).toBe(0);
            expect(parsed.axes.y.max).toBe(10);
            expect(parsed.legend.position).toBe('top');
        });

        it('escapes special characters in titles', () => {
            const xml = serializeChart({
                type: 'bar',
                title: 'A & B <C>',
                categories: [], series: [{ name: '', data: [1] }],
                axes: { x: {}, y: {} },
                legend: { position: 'bottom', visible: true }
            });
            expect(xml).toContain('A &amp; B &lt;C&gt;');
        });
    });
});
