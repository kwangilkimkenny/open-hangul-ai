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
      0: 'line',
      1: 'bar',
      2: 'column',
      3: 'pie',
      4: 'doughnut',
      5: 'area',
      6: 'scatter',
      7: 'bubble',
      8: 'radar',
      9: 'stock',
      10: 'surface',
      11: 'combination',
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
}

