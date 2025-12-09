/**
 * HWPX Viewer Constants
 * 전역 상수 및 단위 변환 함수
 * 
 * @module constants
 * @version 2.0.0
 */

/**
 * HWPX 뷰어 상수 객체
 * DPI, 단위 변환, 페이지 크기 등의 상수 정의
 */
export const HWPXConstants = {
  // ==============================================
  // DPI and Unit Conversion
  // ==============================================
  
  /** 표준 화면 DPI (96 DPI) */
  DPI_STANDARD: 96,
  
  /** 인쇄 DPI (PostScript points: 72 DPI) */
  DPI_PRINT: 72,
  
  /** HWPU (Hancom Word Processing Unit)를 픽셀로 변환하는 비율 */
  HWPU_TO_PX_RATIO: 7200,
  
  // ==============================================
  // Page Dimensions (A4 at 96 DPI)
  // ==============================================
  
  /** A4 용지 너비 (210mm = 794px at 96dpi) */
  PAGE_WIDTH_A4_PX: 794,
  
  /** A4 용지 높이 (297mm = 1123px at 96dpi) */
  PAGE_HEIGHT_A4_PX: 1123,
  
  /** 기본 페이지 패딩 (픽셀) */
  PAGE_PADDING_DEFAULT: 10,
  
  // ==============================================
  // File Limits
  // ==============================================
  
  /** 최대 파일 크기 (MB) */
  MAX_FILE_SIZE_MB: 50,
  
  /** 최대 파일 크기 (바이트) */
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  
  // ==============================================
  // Font and Typography
  // ==============================================
  
  /** 기본 폰트 크기 (포인트) */
  FONT_SIZE_DEFAULT_PT: 10,
  
  /** 기본 폰트 크기 (픽셀) */
  FONT_SIZE_DEFAULT_PX: 14,
  
  /** 기본 줄 높이 배수 */
  LINE_HEIGHT_DEFAULT: 1.6,
  
  /** 기본 자간 */
  LETTER_SPACING_BASE: 0,
  
  // ==============================================
  // Table Dimensions
  // ==============================================
  
  /** 기본 테이블 테두리 두께 */
  TABLE_BORDER_WIDTH: 1,
  
  /** 기본 셀 패딩 */
  CELL_PADDING_DEFAULT: 5,
  
  // ==============================================
  // Shape Dimensions
  // ==============================================
  
  /** 기본 도형 모서리 반경 */
  SHAPE_BORDER_RADIUS: 6,
  
  /** 최소 도형 너비 */
  SHAPE_MIN_WIDTH: 20,
  
  /** 최소 도형 높이 */
  SHAPE_MIN_HEIGHT: 20,
  
  // ==============================================
  // Z-Index Layers
  // ==============================================
  
  /** 텍스트 레이어 z-index */
  Z_INDEX_TEXT: 10,
  
  /** 도형 레이어 z-index */
  Z_INDEX_SHAPE: 5,
  
  /** 이미지 레이어 z-index */
  Z_INDEX_IMAGE: 3,
  
  /** 배경 레이어 z-index */
  Z_INDEX_BACKGROUND: 1,
  
  // ==============================================
  // Conversion Functions
  // ==============================================
  
  /**
   * 포인트를 픽셀로 변환
   */
  ptToPx(pt: number): number {
    return pt * this.DPI_STANDARD / this.DPI_PRINT;
  },
  
  /**
   * HWPU를 픽셀로 변환
   */
  hwpuToPx(hwpu: number): number {
    const HWPX_SCALE_FACTOR = 1.22;
    return hwpu / this.HWPU_TO_PX_RATIO * this.DPI_STANDARD * HWPX_SCALE_FACTOR;
  },
  
  /**
   * 밀리미터를 픽셀로 변환
   */
  mmToPx(mm: number): number {
    return mm * this.DPI_STANDARD / 25.4;
  },
  
  /**
   * 픽셀을 포인트로 변환
   */
  pxToPt(px: number): number {
    return px * this.DPI_PRINT / this.DPI_STANDARD;
  },
  
  /**
   * 인치를 픽셀로 변환
   */
  inchToPx(inch: number): number {
    return inch * this.DPI_STANDARD;
  },
  
  /**
   * 픽셀을 인치로 변환
   */
  pxToInch(px: number): number {
    return px / this.DPI_STANDARD;
  }
} as const;

export default HWPXConstants;

