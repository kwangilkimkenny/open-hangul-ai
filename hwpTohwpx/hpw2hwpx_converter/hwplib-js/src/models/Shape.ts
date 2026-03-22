/**
 * Shape (도형) 객체 모델
 * 
 * HWP 도형은 선, 사각형, 원, 다각형 등 다양한 기본 도형을 포함합니다.
 */

/**
 * 도형 공통 속성
 */
export interface ShapeCommon {
  id: number;
  type: ShapeType;
  
  // 위치 (HWPUNIT)
  x: number;
  y: number;
  
  // 크기 (HWPUNIT)
  width: number;
  height: number;
  
  // 회전 (degree)
  rotation: number;
  
  // Z-order (앞으로/뒤로)
  zOrder: number;
  
  // 선 스타일
  lineColor: number;      // RGB
  lineWidth: number;      // HWPUNIT
  lineStyle: LineStyle;
  
  // 채우기
  fillColor: number;      // RGB
  fillType: FillType;
  fillOpacity: number;    // 0-100
  
  // 기타
  ctrlId: number;
  flags: number;
}

/**
 * 선 (Line)
 */
export interface ShapeLine extends ShapeCommon {
  type: 'LINE';
  startX: number;         // 시작점 X (HWPUNIT)
  startY: number;         // 시작점 Y
  endX: number;           // 끝점 X
  endY: number;           // 끝점 Y
  arrowStart: ArrowType;  // 시작 화살표
  arrowEnd: ArrowType;    // 끝 화살표
}

/**
 * 사각형 (Rectangle)
 */
export interface ShapeRectangle extends ShapeCommon {
  type: 'RECTANGLE';
  cornerRadius: number;   // 모서리 둥글기 (HWPUNIT)
  round: boolean;         // 둥근 사각형 여부
}

/**
 * 타원/원 (Ellipse)
 */
export interface ShapeEllipse extends ShapeCommon {
  type: 'ELLIPSE';
  // width === height이면 원
  arcType: ArcType;       // 호/부채꼴/현
  startAngle?: number;    // 시작 각도 (degree)
  sweepAngle?: number;    // 회전 각도 (degree)
}

/**
 * 다각형 (Polygon)
 */
export interface ShapePolygon extends ShapeCommon {
  type: 'POLYGON';
  points: Point[];        // 꼭짓점 좌표 배열
  closed: boolean;        // 닫힌 도형 여부
}

/**
 * 곡선 (Curve / Polyline)
 */
export interface ShapeCurve extends ShapeCommon {
  type: 'CURVE';
  controlPoints: Point[]; // 제어점 배열 (베지어)
  smooth: boolean;        // 부드러운 곡선 여부
}

/**
 * 연결선 (Connector)
 */
export interface ShapeConnector extends ShapeCommon {
  type: 'CONNECTOR';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  connectorType: ConnectorType;
  controlPoints?: Point[]; // 굴곡점
}

/**
 * 글맵시 (TextArt / WordArt)
 */
export interface ShapeTextArt extends ShapeCommon {
  type: 'TEXTART';
  text: string;                    // 글맵시 텍스트
  fontId?: number;                 // 글꼴 ID
  fontSize?: number;               // 글꼴 크기 (HWPUNIT)
  fontStyle?: TextArtFontStyle;    // 글꼴 스타일 (굵게, 기울임)
  textColor?: number;              // 텍스트 색상 (RGB)
  outlineColor?: number;           // 외곽선 색상
  outlineWidth?: number;           // 외곽선 두께
  shadowColor?: number;            // 그림자 색상
  shadowOffsetX?: number;          // 그림자 X 오프셋
  shadowOffsetY?: number;          // 그림자 Y 오프셋
  textArtShape?: TextArtShapeType; // 글맵시 모양 (곡선, 파형 등)
  align?: TextArtAlign;            // 정렬
}

/**
 * 글맵시 글꼴 스타일
 */
export interface TextArtFontStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeout?: boolean;
}

/**
 * 글맵시 모양 타입
 */
export enum TextArtShapeType {
  PLAIN = 0,           // 일반
  WAVE_1 = 1,          // 파형 1
  WAVE_2 = 2,          // 파형 2
  ARCH_UP = 3,         // 위로 휘어짐
  ARCH_DOWN = 4,       // 아래로 휘어짐
  CIRCLE = 5,          // 원형
  BUTTON = 6,          // 단추형
  INFLATE = 7,         // 볼록
  DEFLATE = 8,         // 오목
  FADE_RIGHT = 9,      // 오른쪽 희미하게
  FADE_LEFT = 10,      // 왼쪽 희미하게
  FADE_UP = 11,        // 위로 희미하게
  FADE_DOWN = 12,      // 아래로 희미하게
  SLANT_UP = 13,       // 위로 기울임
  SLANT_DOWN = 14,     // 아래로 기울임
  CHEVRON_UP = 15,     // V자 위
  CHEVRON_DOWN = 16,   // V자 아래
}

/**
 * 글맵시 정렬
 */
export enum TextArtAlign {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
  JUSTIFY = 3,
}

/**
 * Shape 통합 타입
 */
export type Shape = ShapeLine | ShapeRectangle | ShapeEllipse | ShapePolygon | ShapeCurve | ShapeConnector | ShapeTextArt;

/**
 * 도형 타입
 */
export type ShapeType = 'LINE' | 'RECTANGLE' | 'ELLIPSE' | 'POLYGON' | 'CURVE' | 'CONNECTOR' | 'TEXTART';

/**
 * 점 (좌표)
 */
export interface Point {
  x: number;  // HWPUNIT
  y: number;  // HWPUNIT
}

/**
 * 선 스타일
 */
export enum LineStyle {
  NONE = 0,
  SOLID = 1,          // 실선
  DASH = 2,           // 긴 점선
  DOT = 3,            // 짧은 점선
  DASH_DOT = 4,       // 일점쇄선
  DASH_DOT_DOT = 5,   // 이점쇄선
  LONG_DASH = 6,      // 긴 파선
}

/**
 * 채우기 타입
 */
export enum FillType {
  NONE = 0,           // 없음
  SOLID = 1,          // 단색
  GRADIENT = 2,       // 그라데이션
  PATTERN = 3,        // 무늬
  IMAGE = 4,          // 이미지
}

/**
 * 화살표 타입
 */
export enum ArrowType {
  NONE = 0,           // 없음
  NORMAL = 1,         // 보통 화살표
  OPEN = 2,           // 열린 화살표
  FILLED = 3,         // 채워진 화살표
  DIAMOND = 4,        // 다이아몬드
  CIRCLE = 5,         // 원
  SQUARE = 6,         // 사각형
}

/**
 * 호 타입 (타원 전용)
 */
export enum ArcType {
  NORMAL = 0,         // 일반 (타원)
  ARC = 1,            // 호
  PIE = 2,            // 부채꼴
  CHORD = 3,          // 현
}

/**
 * 연결선 타입
 */
export enum ConnectorType {
  STRAIGHT = 0,       // 직선
  ELBOW_1 = 1,        // 꺾은선 (1개 꺾임)
  ELBOW_2 = 2,        // 꺾은선 (2개 꺾임)
  CURVE = 3,          // 곡선
}

/**
 * HWP 도형 레코드 TagID
 */
export enum ShapeTagID {
  HWPTAG_SHAPE_COMPONENT = 76,
  HWPTAG_TABLE = 77,
  HWPTAG_SHAPE_COMPONENT_LINE = 78,
  HWPTAG_SHAPE_COMPONENT_RECTANGLE = 79,
  HWPTAG_SHAPE_COMPONENT_ELLIPSE = 80,
  HWPTAG_SHAPE_COMPONENT_ARC = 81,
  HWPTAG_SHAPE_COMPONENT_POLYGON = 82,
  HWPTAG_SHAPE_COMPONENT_CURVE = 83,
  HWPTAG_SHAPE_COMPONENT_OLE = 84,
  HWPTAG_SHAPE_COMPONENT_PICTURE = 85,
  HWPTAG_SHAPE_COMPONENT_CONTAINER = 86,
  HWPTAG_SHAPE_COMPONENT_TEXTART = 87,
}

/**
 * 도형 헬퍼 함수
 */

/**
 * 원인지 타원인지 판별
 */
export function isCircle(ellipse: ShapeEllipse): boolean {
  return Math.abs(ellipse.width - ellipse.height) < 100; // 오차 범위 내에서 원
}

/**
 * 닫힌 다각형인지 열린 다각형(폴리라인)인지 판별
 */
export function isClosedPolygon(polygon: ShapePolygon): boolean {
  if (polygon.points.length < 2) return false;
  const first = polygon.points[0];
  const last = polygon.points[polygon.points.length - 1];
  return Math.abs(first.x - last.x) < 10 && Math.abs(first.y - last.y) < 10;
}

/**
 * 선 스타일 이름
 */
export function getLineStyleName(style: LineStyle): string {
  const names: { [key: number]: string } = {
    0: 'NONE',
    1: 'SOLID',
    2: 'DASH',
    3: 'DOT',
    4: 'DASH_DOT',
    5: 'DASH_DOT_DOT',
    6: 'LONG_DASH',
  };
  return names[style] || 'SOLID';
}

