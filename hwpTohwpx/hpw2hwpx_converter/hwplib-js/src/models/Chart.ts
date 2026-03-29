/**
 * Chart (차트) 완벽 구현
 * HWP 차트를 OWPML 차트로 변환
 */

/**
 * 차트 객체
 */
export interface Chart {
  id: number;
  type: ChartType;

  // 위치 및 크기 (HWPUNIT)
  x: number;
  y: number;
  width: number;
  height: number;

  // 데이터
  data: ChartData;

  // 스타일
  title?: ChartTitle;
  legend: ChartLegend;
  axes: ChartAxes;
  plotArea: ChartPlotArea;

  // 시리즈 스타일
  seriesStyles: ChartSeriesStyle[];

  // 배치
  zOrder: number;
  wrapType: WrapType;
  anchor: AnchorType;

  // 애니메이션
  animation?: ChartAnimation;
}

/**
 * 차트 데이터
 */
export interface ChartData {
  categories: string[];     // X축 레이블
  series: ChartSeries[];    // 데이터 시리즈
}

/**
 * 차트 시리즈
 */
export interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
  lineStyle?: LineStyle;
  markerStyle?: MarkerStyle;
}

/**
 * 차트 제목
 */
export interface ChartTitle {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: number;
  alignment: TextAlignment;
  visible: boolean;
}

/**
 * 차트 범례
 */
export interface ChartLegend {
  visible: boolean;
  position: LegendPosition;
  fontSize: number;
  fontFamily: string;
  borderVisible: boolean;
}

/**
 * 차트 축
 */
export interface ChartAxes {
  xAxis: ChartAxis;
  yAxis: ChartAxis;
}

export interface ChartAxis {
  title?: string;
  visible: boolean;
  min?: number;
  max?: number;
  gridLines: boolean;
  tickMarks: boolean;
  fontSize: number;
  labelRotation?: number;   // degree
}

/**
 * 차트 플롯 영역
 */
export interface ChartPlotArea {
  backgroundColor?: number;
  borderColor?: number;
  borderWidth?: number;
  gradient?: ChartGradient;
  // 3D 효과 (새로 추가)
  effect3D?: Chart3DEffect;
}

/**
 * 차트 그라데이션 (새로 추가)
 */
export interface ChartGradient {
  enabled: boolean;
  type: 'linear' | 'radial';
  angle?: number;           // 0-360도
  colors: string[];         // 색상 배열
  stops?: number[];         // 각 색상의 위치 (0-1)
}

/**
 * 차트 3D 효과 (새로 추가)
 */
export interface Chart3DEffect {
  enabled: boolean;
  rotationX?: number;       // X축 회전 (-90 ~ 90)
  rotationY?: number;       // Y축 회전 (-90 ~ 90)
  perspective?: number;     // 원근감 (0 ~ 100)
  depth?: number;           // 깊이 (0 ~ 100)
  heightPercent?: number;   // 높이 비율 (0 ~ 500)
}

/**
 * 데이터 레이블 (새로 추가)
 */
export interface ChartDataLabel {
  visible: boolean;
  position: DataLabelPosition;
  showValue?: boolean;
  showPercent?: boolean;
  showCategoryName?: boolean;
  showSeriesName?: boolean;
  fontSize?: number;
  fontColor?: number;
  numberFormat?: string;
}

/**
 * 데이터 레이블 위치 (새로 추가)
 */
export enum DataLabelPosition {
  CENTER = 0,
  INSIDE_END = 1,
  INSIDE_BASE = 2,
  OUTSIDE_END = 3,
  BEST_FIT = 4,
}

/**
 * 차트 시리즈 스타일
 */
export interface ChartSeriesStyle {
  seriesIndex: number;
  color: string;
  fillColor?: string;
  lineWidth?: number;
  lineStyle?: LineStyle;
  markerType?: MarkerType;
  markerSize?: number;
}

/**
 * 차트 애니메이션
 */
export interface ChartAnimation {
  enabled: boolean;
  duration: number;         // ms
  easing: AnimationEasing;
}

/**
 * 차트 타입
 */
export enum ChartType {
  LINE = 0,                 // 꺾은선
  BAR = 1,                  // 가로 막대
  COLUMN = 2,               // 세로 막대
  PIE = 3,                  // 원형
  DOUGHNUT = 4,             // 도넛
  AREA = 5,                 // 영역
  SCATTER = 6,              // 분산형
  BUBBLE = 7,               // 거품형
  RADAR = 8,                // 방사형
  STOCK = 9,                // 주식형
  SURFACE = 10,             // 표면형
  COMBINATION = 11,         // 혼합형 (콤보)
  // 3D 차트 유형 (새로 추가)
  LINE_3D = 12,             // 3D 꺾은선
  BAR_3D = 13,              // 3D 가로 막대
  COLUMN_3D = 14,           // 3D 세로 막대
  PIE_3D = 15,              // 3D 원형
  AREA_3D = 16,             // 3D 영역
  SURFACE_3D = 17,          // 3D 표면
  // 특수 차트 유형
  WATERFALL = 18,           // 폭포형
  TREEMAP = 19,             // 트리맵
  SUNBURST = 20,            // 선버스트
  HISTOGRAM = 21,           // 히스토그램
  BOX_WHISKER = 22,         // 상자 수염
  FUNNEL = 23,              // 깔때기형
  MAP = 24,                 // 지도형
}

/**
 * 범례 위치
 */
export enum LegendPosition {
  TOP = 0,
  BOTTOM = 1,
  LEFT = 2,
  RIGHT = 3,
  TOP_RIGHT = 4,
  TOP_LEFT = 5,
  BOTTOM_RIGHT = 6,
  BOTTOM_LEFT = 7,
  NONE = 8,
}

/**
 * 선 스타일
 */
export enum LineStyle {
  NONE = 0,
  SOLID = 1,
  DASH = 2,
  DOT = 3,
  DASH_DOT = 4,
  DASH_DOT_DOT = 5,
}

/**
 * 마커 스타일
 */
export enum MarkerStyle {
  NONE = 0,
  CIRCLE = 1,
  SQUARE = 2,
  DIAMOND = 3,
  TRIANGLE = 4,
  STAR = 5,
  CROSS = 6,
  PLUS = 7,
}

/**
 * 마커 타입
 */
export enum MarkerType {
  NONE = 0,
  CIRCLE = 1,
  SQUARE = 2,
  DIAMOND = 3,
  TRIANGLE_UP = 4,
  TRIANGLE_DOWN = 5,
  STAR = 6,
  X = 7,
  PLUS = 8,
}

/**
 * 텍스트 정렬
 */
export enum TextAlignment {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
}

/**
 * 애니메이션 이징
 */
export enum AnimationEasing {
  LINEAR = 0,
  EASE_IN = 1,
  EASE_OUT = 2,
  EASE_IN_OUT = 3,
  BOUNCE = 4,
}

/**
 * 배치 타입
 */
export enum WrapType {
  SQUARE = 0,
  TOP_AND_BOTTOM = 1,
  TIGHT = 2,
  THROUGH = 3,
  NONE = 4,
}

/**
 * 앵커 타입
 */
export enum AnchorType {
  PARAGRAPH = 0,
  CHAR = 1,
  PAGE = 2,
}

/**
 * HWP 차트 레코드 TagID
 */
export enum ChartTagID {
  HWPTAG_CHART = 115,
  HWPTAG_CHART_DATA = 116,
  HWPTAG_CHART_SERIES = 117,
  HWPTAG_CHART_AXIS = 118,
  HWPTAG_CHART_LEGEND = 119,
  HWPTAG_CHART_TITLE = 120,
}

/**
 * 차트 헬퍼
 */
export class ChartHelper {
  /**
   * 차트 타입 문자열 변환
   */
  static getChartTypeName(type: ChartType): string {
    const names: { [key: number]: string } = {
      [ChartType.LINE]: 'line',
      [ChartType.BAR]: 'bar',
      [ChartType.COLUMN]: 'column',
      [ChartType.PIE]: 'pie',
      [ChartType.DOUGHNUT]: 'doughnut',
      [ChartType.AREA]: 'area',
      [ChartType.SCATTER]: 'scatter',
      [ChartType.BUBBLE]: 'bubble',
      [ChartType.RADAR]: 'radar',
      [ChartType.STOCK]: 'stock',
      [ChartType.SURFACE]: 'surface',
      [ChartType.COMBINATION]: 'combination',
      [ChartType.LINE_3D]: 'line3d',
      [ChartType.BAR_3D]: 'bar3d',
      [ChartType.COLUMN_3D]: 'column3d',
      [ChartType.PIE_3D]: 'pie3d',
      [ChartType.AREA_3D]: 'area3d',
      [ChartType.SURFACE_3D]: 'surface3d',
      [ChartType.WATERFALL]: 'waterfall',
      [ChartType.TREEMAP]: 'treemap',
      [ChartType.SUNBURST]: 'sunburst',
      [ChartType.HISTOGRAM]: 'histogram',
      [ChartType.BOX_WHISKER]: 'boxWhisker',
      [ChartType.FUNNEL]: 'funnel',
      [ChartType.MAP]: 'map',
    };
    return names[type] || 'line';
  }

  /**
   * 범례 위치 문자열 변환
   */
  static getLegendPositionName(position: LegendPosition): string {
    const names: { [key: number]: string } = {
      0: 'top',
      1: 'bottom',
      2: 'left',
      3: 'right',
      4: 'top-right',
      5: 'top-left',
      6: 'bottom-right',
      7: 'bottom-left',
      8: 'none',
    };
    return names[position] || 'right';
  }

  /**
   * 색상 팔레트 (기본)
   */
  static readonly DEFAULT_COLORS = [
    '#4472C4', // 파랑
    '#ED7D31', // 주황
    '#A5A5A5', // 회색
    '#FFC000', // 노랑
    '#5B9BD5', // 하늘색
    '#70AD47', // 녹색
    '#264478', // 남색
    '#9E480E', // 갈색
    '#636363', // 진회색
    '#997300', // 황토색
  ];

  /**
   * 시리즈 기본 색상 할당
   */
  static assignDefaultColors(series: ChartSeries[]): void {
    series.forEach((s, index) => {
      if (!s.color) {
        s.color = this.DEFAULT_COLORS[index % this.DEFAULT_COLORS.length];
      }
    });
  }

  /**
   * 차트 데이터 유효성 검사
   */
  static validateChartData(data: ChartData): boolean {
    if (!data.series || data.series.length === 0) {
      return false;
    }

    for (const series of data.series) {
      if (!series.values || series.values.length === 0) {
        return false;
      }

      if (data.categories.length !== series.values.length) {
        console.warn(`카테고리 개수(${data.categories.length})와 데이터 개수(${series.values.length})가 일치하지 않습니다.`);
      }
    }

    return true;
  }

  /**
   * 차트 데이터 → CSV 변환 (디버깅용)
   */
  static chartDataToCSV(data: ChartData): string {
    let csv = 'Category,' + data.series.map(s => s.name).join(',') + '\n';

    for (let i = 0; i < data.categories.length; i++) {
      const row = [data.categories[i]];
      for (const series of data.series) {
        row.push(series.values[i]?.toString() || '');
      }
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * 차트를 SVG로 렌더링 (폴백 이미지 생성용)
   */
  static chartToSvg(chart: Chart, width: number = 600, height: number = 400): string {
    const padding = { top: 40, right: 30, bottom: 50, left: 60 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const data = chart.data;
    if (!data || !data.series || data.series.length === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="#f9f9f9" stroke="#ccc"/>
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#999">No Data</text>
      </svg>`;
    }

    this.assignDefaultColors(data.series);

    const type = chart.type;
    const isPie = type === ChartType.PIE || type === ChartType.DOUGHNUT || type === ChartType.PIE_3D;

    if (isPie) {
      return this.renderPieSvg(chart, data, width, height);
    }

    return this.renderBarLineSvg(chart, data, width, height, plotW, plotH, padding);
  }

  private static renderPieSvg(chart: Chart, data: ChartData, width: number, height: number): string {
    const cx = width / 2;
    const cy = height / 2 + 10;
    const radius = Math.min(width, height) / 2 - 40;
    const isDoughnut = chart.type === ChartType.DOUGHNUT;
    const innerRadius = isDoughnut ? radius * 0.5 : 0;

    const values = data.series[0]?.values || [];
    const total = values.reduce((s, v) => s + Math.abs(v), 0);
    if (total === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${cx}" y="${cy}" text-anchor="middle">No Data</text></svg>`;

    const slices: string[] = [];
    let angle = -Math.PI / 2;

    values.forEach((val, i) => {
      const sliceAngle = (Math.abs(val) / total) * 2 * Math.PI;
      const endAngle = angle + sliceAngle;
      const color = this.DEFAULT_COLORS[i % this.DEFAULT_COLORS.length];
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const x1 = cx + radius * Math.cos(angle);
      const y1 = cy + radius * Math.sin(angle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);

      if (isDoughnut) {
        const ix1 = cx + innerRadius * Math.cos(angle);
        const iy1 = cy + innerRadius * Math.sin(angle);
        const ix2 = cx + innerRadius * Math.cos(endAngle);
        const iy2 = cy + innerRadius * Math.sin(endAngle);
        slices.push(`<path d="M${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} L${ix2},${iy2} A${innerRadius},${innerRadius} 0 ${largeArc},0 ${ix1},${iy1} Z" fill="${color}" stroke="white" stroke-width="1"/>`);
      } else {
        slices.push(`<path d="M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z" fill="${color}" stroke="white" stroke-width="1"/>`);
      }

      // Label
      const midAngle = angle + sliceAngle / 2;
      const labelR = radius * 0.7;
      const lx = cx + labelR * Math.cos(midAngle);
      const ly = cy + labelR * Math.sin(midAngle);
      const pct = ((val / total) * 100).toFixed(1);
      if (sliceAngle > 0.3) { // Only show label if slice is big enough
        slices.push(`<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="white" font-weight="bold">${pct}%</text>`);
      }

      angle = endAngle;
    });

    const title = chart.title?.visible ? `<text x="${cx}" y="20" text-anchor="middle" font-size="14" font-weight="bold">${this.escapeXml(chart.title.text || '')}</text>` : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="white"/>
      ${title}
      ${slices.join('\n      ')}
    </svg>`;
  }

  private static renderBarLineSvg(
    chart: Chart, data: ChartData,
    width: number, height: number,
    plotW: number, plotH: number,
    padding: { top: number; right: number; bottom: number; left: number }
  ): string {
    const isBar = chart.type === ChartType.BAR || chart.type === ChartType.COLUMN ||
                  chart.type === ChartType.BAR_3D || chart.type === ChartType.COLUMN_3D ||
                  chart.type === ChartType.HISTOGRAM;
    const isArea = chart.type === ChartType.AREA || chart.type === ChartType.AREA_3D;
    const categories = data.categories;
    const allValues = data.series.flatMap(s => s.values);
    const minVal = Math.min(0, ...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;

    const yScale = (v: number) => padding.top + plotH - ((v - minVal) / range) * plotH;
    const xStep = plotW / Math.max(categories.length, 1);

    const elements: string[] = [];

    // Grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (plotH / 5) * i;
      const val = maxVal - (range / 5) * i;
      elements.push(`<line x1="${padding.left}" y1="${y}" x2="${padding.left + plotW}" y2="${y}" stroke="#e0e0e0" stroke-width="0.5"/>`);
      elements.push(`<text x="${padding.left - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666">${val.toFixed(1)}</text>`);
    }

    // X axis labels
    categories.forEach((cat, i) => {
      const x = padding.left + i * xStep + xStep / 2;
      elements.push(`<text x="${x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#666">${this.escapeXml(cat)}</text>`);
    });

    // Data
    data.series.forEach((series, si) => {
      const color = series.color || this.DEFAULT_COLORS[si % this.DEFAULT_COLORS.length];

      if (isBar) {
        const barW = xStep * 0.6 / data.series.length;
        series.values.forEach((val, i) => {
          const x = padding.left + i * xStep + xStep * 0.2 + si * barW;
          const barH = ((val - minVal) / range) * plotH;
          const y = yScale(val);
          elements.push(`<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="1"/>`);
        });
      } else {
        // Line / Area
        const points = series.values.map((val, i) => {
          const x = padding.left + i * xStep + xStep / 2;
          const y = yScale(val);
          return `${x},${y}`;
        });

        if (isArea) {
          const baseY = yScale(minVal);
          const firstX = padding.left + xStep / 2;
          const lastX = padding.left + (series.values.length - 1) * xStep + xStep / 2;
          elements.push(`<polygon points="${firstX},${baseY} ${points.join(' ')} ${lastX},${baseY}" fill="${color}" opacity="0.3"/>`);
        }

        elements.push(`<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`);

        // Markers
        series.values.forEach((val, i) => {
          const x = padding.left + i * xStep + xStep / 2;
          const y = yScale(val);
          elements.push(`<circle cx="${x}" cy="${y}" r="3" fill="${color}" stroke="white" stroke-width="1"/>`);
        });
      }
    });

    // Axes
    elements.push(`<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotH}" stroke="#333" stroke-width="1"/>`);
    elements.push(`<line x1="${padding.left}" y1="${padding.top + plotH}" x2="${padding.left + plotW}" y2="${padding.top + plotH}" stroke="#333" stroke-width="1"/>`);

    const title = chart.title?.visible ? `<text x="${width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold">${this.escapeXml(chart.title.text || '')}</text>` : '';

    // Legend
    const legendItems = data.series.map((s, i) => {
      const color = s.color || this.DEFAULT_COLORS[i % this.DEFAULT_COLORS.length];
      const y = padding.top + i * 18;
      return `<rect x="${padding.left + plotW + 5}" y="${y}" width="10" height="10" fill="${color}"/>
        <text x="${padding.left + plotW + 18}" y="${y + 9}" font-size="10" fill="#333">${this.escapeXml(s.name)}</text>`;
    }).join('\n      ');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="white"/>
      ${title}
      ${elements.join('\n      ')}
      ${legendItems}
    </svg>`;
  }

  private static escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

