/**
 * HWPUNIT 상수 정의
 *
 * HWPUNIT은 HWP/HWPX 문서에서 사용되는 기본 측정 단위입니다.
 * 1 HWPUNIT = 1/7200 인치 (약 0.00353mm)
 *
 * 예시:
 * - 7200 HWPUNIT = 1 인치 = 25.4mm
 * - 283 HWPUNIT ≈ 1mm
 * - 1000 HWPUNIT = 10pt 폰트 크기 (height 속성)
 *
 * @module Constants
 * @category Constants
 */

/**
 * 기본 단위 변환 상수
 */
export const HWPUNIT = {
    /** 1인치 = 7200 HWPUNIT */
    PER_INCH: 7200,

    /** 1mm ≈ 283.46 HWPUNIT (정수: 283) */
    PER_MM: 283,

    /** 1pt = 100 HWPUNIT (폰트 크기 기준) */
    PER_PT: 100,
} as const;

/**
 * 폰트 크기 관련 상수 (height 속성값)
 * 폰트 크기 = height / 100 (pt 단위)
 */
export const FONT_SIZE = {
    /** 10pt 폰트 = 1000 HWPUNIT */
    PT_10: 1000,

    /** 12pt 폰트 = 1200 HWPUNIT */
    PT_12: 1200,

    /** 14pt 폰트 = 1400 HWPUNIT */
    PT_14: 1400,

    /** 16pt 폰트 = 1600 HWPUNIT */
    PT_16: 1600,

    /** 20pt 폰트 = 2000 HWPUNIT */
    PT_20: 2000,

    /** 기본 폰트 크기 (10pt) */
    DEFAULT: 1000,

    /** 제목용 큰 폰트 (20pt) */
    HEADING: 2000,
} as const;

/**
 * 여백/마진 관련 상수
 */
export const MARGIN = {
    /** 셀 마진 기본값 (약 1mm = 283 HWPUNIT) */
    CELL_DEFAULT: 283,

    /** 각주 간 간격 기본값 */
    FOOTNOTE_BETWEEN: 283,

    /** 각주 라인 아래 간격 */
    FOOTNOTE_BELOW_LINE: 567,

    /** 각주 라인 위 간격 */
    FOOTNOTE_ABOVE_LINE: 850,
} as const;

/**
 * 라인 세그먼트 관련 상수
 */
export const LINE_SEGMENT = {
    /** 기본 baseline 비율 (fontSize * 0.85) */
    BASELINE_RATIO: 0.85,

    /** 기본 line spacing 비율 (fontSize * 0.6) */
    SPACING_RATIO: 0.6,

    /** 기본 라인 세그먼트 flags */
    DEFAULT_FLAGS: 393216,
} as const;

/**
 * 페이지/레이아웃 관련 상수
 */
export const PAGE = {
    /** A4 용지 너비 (210mm) */
    A4_WIDTH: 59528,

    /** A4 용지 높이 (297mm) */
    A4_HEIGHT: 84186,

    /** 기본 본문 영역 너비 (A4 기준 여백 제외) */
    DEFAULT_TEXT_WIDTH: 42520,

    /** 기본 테이블 높이 */
    DEFAULT_TABLE_HEIGHT: 10000,

    /** 기본 수식 너비 */
    DEFAULT_EQUATION_WIDTH: 10000,
} as const;

/**
 * BorderFill ID 관련 상수
 * HWPX에서 테두리/배경 스타일을 참조하는 ID 값
 */
export const BORDER_FILL = {
    /** 유효한 ID 최소값 */
    MIN_ID: 1,

    /** 유효한 ID 최대값 */
    MAX_ID: 50,

    /** 테이블 기본 BorderFillIDRef (테두리 없음 스타일) */
    DEFAULT_TABLE: 3,

    /** 셀 기본 BorderFillIDRef */
    DEFAULT_CELL: 7,

    /** 페이지 테두리 기본값 */
    DEFAULT_PAGE: 1,
} as const;

/**
 * 테이블 관련 상수
 */
export const TABLE = {
    /** 테이블 테두리 두께 (HWPUNIT) - 약 0.37mm */
    BORDER_THICKNESS: 105,

    /** 기본 셀 높이 */
    DEFAULT_CELL_HEIGHT: 2000,
} as const;

/**
 * HWPUNIT 유틸리티 함수
 */
export const HwpUnitUtils = {
    /** mm를 HWPUNIT으로 변환 */
    fromMm: (mm: number): number => Math.round(mm * HWPUNIT.PER_MM),

    /** HWPUNIT을 mm로 변환 */
    toMm: (hwpunit: number): number => hwpunit / HWPUNIT.PER_MM,

    /** 인치를 HWPUNIT으로 변환 */
    fromInch: (inch: number): number => Math.round(inch * HWPUNIT.PER_INCH),

    /** HWPUNIT을 인치로 변환 */
    toInch: (hwpunit: number): number => hwpunit / HWPUNIT.PER_INCH,

    /** pt를 HWPUNIT으로 변환 (폰트 크기용) */
    fromPt: (pt: number): number => Math.round(pt * HWPUNIT.PER_PT),

    /** HWPUNIT을 pt로 변환 (폰트 크기용) */
    toPt: (hwpunit: number): number => hwpunit / HWPUNIT.PER_PT,
} as const;
