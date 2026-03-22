/**
 * HWP 테이블 구조 정의
 * OWPML hp:tbl에 대응
 */

// HWP 테이블 관련 레코드 태그 ID
export const enum TableTag {
  HWPTAG_LIST_HEADER = 65,        // 리스트 헤더
  HWPTAG_TABLE = 71,              // 표 (구버전)
  HWPTAG_TABLE_NEW = 88,          // 표 (신버전)
  HWPTAG_TABLE_CELL = 89,         // 표 셀
  HWPTAG_TABLE_ROW = 90,          // 표 행 (?)
}

// 제어 문자
export const CTRL_TABLE = 0x09;   // 표
export const CTRL_EXTEND_CHAR = 0x02; // 확장 문자

/**
 * 테이블 셀 (hp:tc)
 */
export interface TableCell {
  // 셀 주소
  colAddr: number;                // 열 주소 (0부터 시작)
  rowAddr: number;                // 행 주소 (0부터 시작)

  // 셀 병합
  colSpan: number;                // 열 병합 개수 (1=병합 안 함)
  rowSpan: number;                // 행 병합 개수 (1=병합 안 함)

  // 셀 크기
  width: number;                  // 너비 (HWPUNIT)
  height: number;                 // 높이 (HWPUNIT)

  // 셀 여백
  marginLeft: number;             // 왼쪽 여백
  marginRight: number;            // 오른쪽 여백
  marginTop: number;              // 위쪽 여백
  marginBottom: number;           // 아래쪽 여백

  // 셀 속성
  name?: string;                  // 셀 이름
  header: boolean;                // 헤더 셀 여부
  hasMargin: boolean;             // 여백 사용 여부
  protect: boolean;               // 보호 여부
  editable: boolean;              // 편집 가능 여부
  borderFillIDRef: number;        // 테두리/배경 ID

  // 셀 내용
  paragraphs: CellParagraph[];    // 문단 목록

  // 추가 속성
  id?: number;                    // 셀 ID
  textDirection?: number;         // 텍스트 방향
  lineWrap?: number;              // 줄바꿈
  vertAlign?: number;             // 수직 정렬

  // 추가 정보
  listID?: number;                // 리스트 ID
}

/**
 * 셀 내 문단
 */
export interface CellParagraph {
  text: string;
  charShapeID?: number;
  paraShapeID?: number;
  styleID?: number;
}

/**
 * 테이블 행 (hp:tr)
 */
export interface TableRow {
  index?: number;                 // 행 인덱스
  cells: TableCell[];             // 셀 목록
}

/**
 * 테이블 (hp:tbl)
 */
export interface Table {
  // 테이블 기본 정보
  id: number;                     // 테이블 ID
  rowCnt: number;                 // 행 개수
  colCnt: number;                 // 열 개수

  // 테이블 속성
  cellSpacing: number;            // 셀 간격
  borderFillIDRef: number;        // 테두리/배경 ID
  pageBreak: number;              // 페이지 나눔 (0=없음, 1=앞, 2=뒤)
  repeatHeader: boolean;          // 헤더 반복 여부
  noAdjust: boolean;              // 자동 조정 안 함

  // 테이블 여백
  inMarginLeft: number;           // 안쪽 왼쪽 여백
  inMarginRight: number;          // 안쪽 오른쪽 여백
  inMarginTop: number;            // 안쪽 위쪽 여백
  inMarginBottom: number;         // 안쪽 아래쪽 여백

  // 테이블 구조
  rows: TableRow[];               // 행 목록

  // 캡션/레이블
  caption?: string;               // 캡션 텍스트
  captionPosition?: string;       // 캡션 위치 (TOP, BOTTOM, LEFT, RIGHT)
  captionGap?: number;            // 캡션과 표 사이 간격 (HWPUNIT)

  // 위치/크기 (AbstractShapeObject에서 상속)
  x?: number;                     // X 좌표
  y?: number;                     // Y 좌표
  width?: number;                 // 너비
  height?: number;                // 높이
  zOrder?: number;                // Z-순서
  flowWithText?: boolean;         // 글자처럼 취급
  vertRelTo?: number;             // 세로 기준
  horzRelTo?: number;             // 가로 기준
}

/**
 * 테이블 캡션 (hp:caption)
 */
export interface TableCaption {
  text: string;                   // 캡션 텍스트
  position: number;               // 위치 (0=위, 1=아래)
  maxSize: number;                // 최대 크기
  gap: number;                    // 간격
}

/**
 * 테이블 속성 비트 플래그
 */
export const enum TableAttribute {
  REPEAT_HEADER = 1 << 0,         // 머리글 반복
  NO_ADJUST = 1 << 1,             // 자동 조정 안 함
  SPLIT_PAGE = 1 << 2,            // 페이지에서 나눔
}

/**
 * 셀 속성 비트 플래그
 */
export const enum CellAttribute {
  HEADER = 1 << 0,                // 헤더 셀
  HAS_MARGIN = 1 << 1,            // 여백 사용
  PROTECT = 1 << 2,               // 보호
  EDITABLE = 1 << 3,              // 편집 가능
  DIRTY = 1 << 4,                 // 수정됨
}

/**
 * 테이블 페이지 나눔 타입
 */
export const enum TablePageBreakType {
  NONE = 0,                       // 나누지 않음
  CELL = 1,                       // 셀 단위
  ROW = 2,                        // 행 단위
}

