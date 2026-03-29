/**
 * HWPML-compliant Chart (차트) XML Generation
 * Charts in HWPX reference external OOXML chart data
 * Enhanced with support for: Title, Legend, Axes, 3D effects, Gradients, DataLabels
 */

import { Chart, ChartType, ChartHelper, LegendPosition, ChartTitle, ChartLegend, ChartAxes } from 'hwplib-js';
import { generateInstanceId } from '../../../util/IdGenerator';

/**
 * Convert Chart control to OWPML XML
 * Enhanced with full chart feature support
 */
export function chartToXml(chart: Chart): string {
    const instId = generateInstanceId();
    const width = chart.width || 20000;
    const height = chart.height || 15000;
    const chartType = getChartTypeName(chart.type);
    const is3D = is3DChartType(chart.type);

    return `<hp:ctrl>
  <hp:chart id="${instId}" lock="0" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES">
    <hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${height}" heightRelTo="ABSOLUTE" protect="0"/>
    <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
    <hp:outMargin left="283" right="283" top="283" bottom="283"/>
    <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${chart.x || 0}" y="${chart.y || 0}" alpha="100" angle="0"/>
    <hp:chartPr type="${chartType}" version="1">
      ${generateTitleXml(chart.title)}
      ${generateLegendXml(chart.legend)}
      ${generateAxesXml(chart.axes, chart.type)}
      ${generatePlotAreaXml(chart)}
      ${is3D ? generate3DEffectXml(chart) : ''}
      <hp:chartData chartType="${chartType}">
        ${generateChartDataXml(chart)}
      </hp:chartData>
    </hp:chartPr>
  </hp:chart>
</hp:ctrl>`;
}

// === Helper Functions ===

function generateChartDataXml(chart: Chart): string {
    if (!chart.data || !chart.data.series) {
        return '';
    }

    const parts: string[] = [];

    // Categories - use map().join() for better performance
    if (chart.data.categories && chart.data.categories.length > 0) {
        const categoryXmls = chart.data.categories.map(cat =>
            `<hp:cat>${escapeXml(cat)}</hp:cat>`
        );
        parts.push(`<hp:categories>${categoryXmls.join('')}</hp:categories>`);
    }

    // Series - use map().join() for better performance
    const seriesXmls = chart.data.series.map((series, idx) => {
        const color = series.color || ChartHelper.DEFAULT_COLORS[idx % ChartHelper.DEFAULT_COLORS.length];
        const valuesXml = series.values.map(val => `<hp:val>${val}</hp:val>`).join('');

        // 시리즈 스타일 속성 추가
        const style = chart.seriesStyles?.find(s => s.seriesIndex === idx);
        const lineStyleAttr = style?.lineStyle !== undefined ? ` lineStyle="${style.lineStyle}"` : '';
        const lineWidthAttr = style?.lineWidth !== undefined ? ` lineWidth="${style.lineWidth}"` : '';
        const markerAttr = style?.markerType !== undefined ? ` markerType="${style.markerType}"` : '';
        const markerSizeAttr = style?.markerSize !== undefined ? ` markerSize="${style.markerSize}"` : '';

        return `<hp:series name="${escapeXml(series.name)}" color="${color}"${lineStyleAttr}${lineWidthAttr}${markerAttr}${markerSizeAttr}>${valuesXml}</hp:series>`;
    });
    parts.push(...seriesXmls);

    return parts.join('');
}

function getChartTypeName(type: ChartType | undefined): string {
    if (type === undefined || type === null) return 'COLUMN';

    const names: { [key: number]: string } = {
        [ChartType.LINE]: 'LINE',
        [ChartType.BAR]: 'BAR',
        [ChartType.COLUMN]: 'COLUMN',
        [ChartType.PIE]: 'PIE',
        [ChartType.DOUGHNUT]: 'DOUGHNUT',
        [ChartType.AREA]: 'AREA',
        [ChartType.SCATTER]: 'SCATTER',
        [ChartType.BUBBLE]: 'BUBBLE',
        [ChartType.RADAR]: 'RADAR',
        [ChartType.STOCK]: 'STOCK',
        [ChartType.SURFACE]: 'SURFACE',
        [ChartType.COMBINATION]: 'COMBINATION',
        // 3D chart types
        [ChartType.LINE_3D]: 'LINE_3D',
        [ChartType.BAR_3D]: 'BAR_3D',
        [ChartType.COLUMN_3D]: 'COLUMN_3D',
        [ChartType.PIE_3D]: 'PIE_3D',
        [ChartType.AREA_3D]: 'AREA_3D',
        [ChartType.SURFACE_3D]: 'SURFACE_3D',
        // Special chart types
        [ChartType.WATERFALL]: 'WATERFALL',
        [ChartType.TREEMAP]: 'TREEMAP',
        [ChartType.SUNBURST]: 'SUNBURST',
        [ChartType.HISTOGRAM]: 'HISTOGRAM',
        [ChartType.BOX_WHISKER]: 'BOX_WHISKER',
        [ChartType.FUNNEL]: 'FUNNEL',
        [ChartType.MAP]: 'MAP',
    };
    return names[type] || 'COLUMN';
}

/**
 * Check if chart type is 3D
 */
function is3DChartType(type: ChartType | undefined): boolean {
    if (type === undefined || type === null) return false;
    return [
        ChartType.LINE_3D,
        ChartType.BAR_3D,
        ChartType.COLUMN_3D,
        ChartType.PIE_3D,
        ChartType.AREA_3D,
        ChartType.SURFACE_3D,
    ].includes(type);
}

/**
 * Generate chart title XML
 */
function generateTitleXml(title: ChartTitle | undefined): string {
    if (!title || !title.visible) return '';

    const alignMap: { [key: number]: string } = { 0: 'LEFT', 1: 'CENTER', 2: 'RIGHT' };
    const alignment = alignMap[title.alignment] || 'CENTER';
    const colorHex = title.color ? colorToHex(title.color) : '000000';

    return `<hp:title visible="1" alignment="${alignment}">
        <hp:text>${escapeXml(title.text || '')}</hp:text>
        <hp:font face="${escapeXml(title.fontFamily || 'Arial')}" size="${title.fontSize || 14}" color="${colorHex}"/>
      </hp:title>`;
}

/**
 * Generate chart legend XML
 */
function generateLegendXml(legend: ChartLegend | undefined): string {
    if (!legend) {
        return '<hp:legend visible="0" position="RIGHT"/>';
    }

    const positionMap: { [key: number]: string } = {
        [LegendPosition.TOP]: 'TOP',
        [LegendPosition.BOTTOM]: 'BOTTOM',
        [LegendPosition.LEFT]: 'LEFT',
        [LegendPosition.RIGHT]: 'RIGHT',
        [LegendPosition.TOP_RIGHT]: 'TOP_RIGHT',
        [LegendPosition.TOP_LEFT]: 'TOP_LEFT',
        [LegendPosition.BOTTOM_RIGHT]: 'BOTTOM_RIGHT',
        [LegendPosition.BOTTOM_LEFT]: 'BOTTOM_LEFT',
        [LegendPosition.NONE]: 'NONE',
    };
    const position = positionMap[legend.position] || 'RIGHT';
    const border = legend.borderVisible ? '1' : '0';

    return `<hp:legend visible="${legend.visible ? '1' : '0'}" position="${position}" border="${border}">
        <hp:font face="${escapeXml(legend.fontFamily || 'Arial')}" size="${legend.fontSize || 10}"/>
      </hp:legend>`;
}

/**
 * Generate chart axes XML
 */
function generateAxesXml(axes: ChartAxes | undefined, chartType: ChartType | undefined): string {
    // Pie and doughnut charts don't have axes
    if (chartType === ChartType.PIE || chartType === ChartType.DOUGHNUT ||
        chartType === ChartType.PIE_3D || chartType === ChartType.RADAR) {
        return '';
    }

    if (!axes) {
        return `<hp:axes>
        <hp:xAxis visible="1" gridLines="0" tickMarks="1" fontSize="10"/>
        <hp:yAxis visible="1" gridLines="1" tickMarks="1" fontSize="10"/>
      </hp:axes>`;
    }

    const xAxis = axes.xAxis;
    const yAxis = axes.yAxis;

    return `<hp:axes>
        <hp:xAxis visible="${xAxis.visible ? '1' : '0'}" gridLines="${xAxis.gridLines ? '1' : '0'}" tickMarks="${xAxis.tickMarks ? '1' : '0'}" fontSize="${xAxis.fontSize || 10}"${xAxis.title ? ` title="${escapeXml(xAxis.title)}"` : ''}${xAxis.min !== undefined ? ` min="${xAxis.min}"` : ''}${xAxis.max !== undefined ? ` max="${xAxis.max}"` : ''}${xAxis.labelRotation ? ` rotation="${xAxis.labelRotation}"` : ''}/>
        <hp:yAxis visible="${yAxis.visible ? '1' : '0'}" gridLines="${yAxis.gridLines ? '1' : '0'}" tickMarks="${yAxis.tickMarks ? '1' : '0'}" fontSize="${yAxis.fontSize || 10}"${yAxis.title ? ` title="${escapeXml(yAxis.title)}"` : ''}${yAxis.min !== undefined ? ` min="${yAxis.min}"` : ''}${yAxis.max !== undefined ? ` max="${yAxis.max}"` : ''}/>
      </hp:axes>`;
}

/**
 * Generate chart plot area XML
 */
function generatePlotAreaXml(chart: Chart): string {
    const plotArea = chart.plotArea;
    if (!plotArea) {
        return '';
    }

    let gradientXml = '';
    if (plotArea.gradient && plotArea.gradient.enabled) {
        const g = plotArea.gradient;
        const colors = g.colors.map((c, i) => {
            const stop = g.stops ? g.stops[i] : (i / (g.colors.length - 1));
            return `<hp:stop offset="${stop}" color="${c.replace('#', '')}"/>`;
        }).join('');
        gradientXml = `<hp:gradient type="${g.type}" angle="${g.angle || 0}">${colors}</hp:gradient>`;
    }

    const bgColor = plotArea.backgroundColor ? colorToHex(plotArea.backgroundColor) : 'FFFFFF';
    const borderColor = plotArea.borderColor ? colorToHex(plotArea.borderColor) : '000000';

    return `<hp:plotArea backgroundColor="${bgColor}" borderColor="${borderColor}" borderWidth="${plotArea.borderWidth || 1}">
        ${gradientXml}
      </hp:plotArea>`;
}

/**
 * Generate 3D effect XML
 */
function generate3DEffectXml(chart: Chart): string {
    const effect = chart.plotArea?.effect3D;
    if (!effect || !effect.enabled) {
        // Default 3D settings
        return `<hp:effect3D enabled="1" rotationX="15" rotationY="20" perspective="30" depth="100" heightPercent="100"/>`;
    }

    return `<hp:effect3D enabled="1" rotationX="${effect.rotationX ?? 15}" rotationY="${effect.rotationY ?? 20}" perspective="${effect.perspective ?? 30}" depth="${effect.depth ?? 100}" heightPercent="${effect.heightPercent ?? 100}"/>`;
}

/**
 * Convert numeric color to hex string
 */
function colorToHex(color: number): string {
    const hex = (color & 0xFFFFFF).toString(16).padStart(6, '0');
    return hex.toUpperCase();
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
