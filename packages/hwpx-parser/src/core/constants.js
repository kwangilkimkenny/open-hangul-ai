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
    PAGE_PADDING_DEFAULT: 10, /* ✅ 압축: 40px → 10px (75% 감소) */

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
     * @param {number} pt - 포인트 값
     * @returns {number} 픽셀 값
     * 
     * @example
     * HWPXConstants.ptToPx(10) // 13.33
     * HWPXConstants.ptToPx(72) // 96
     */
    ptToPx(pt) {
        return pt * this.DPI_STANDARD / this.DPI_PRINT;
    },

    /**
     * HWPU를 픽셀로 변환
     * @param {number} hwpu - HWPU 값
     * @returns {number} 픽셀 값
     * 
     * @example
     * HWPXConstants.hwpuToPx(7200) // 272
     * 
     * @note 2.835 배율은 실제 HWPX 렌더링 테스트를 통해 결정됨
     * 원본: hwpu / 7200 * 96 = hwpu * 0.01333
     * 수정: hwpu / 7200 * 96 * 2.835 = hwpu * 0.0378
     */
    hwpuToPx(hwpu) {
        // 🔧 HWPX 표 렌더링을 위한 조정 배율
        // 셀 안의 텍스트가 셀을 꽉 채우도록 높이 조정
        // 3097 HWPU → 약 45-50px (내용 행)
        // 2231 HWPU → 약 33-37px (헤더 행)
        const HWPX_SCALE_FACTOR = 1.22;
        return hwpu / this.HWPU_TO_PX_RATIO * this.DPI_STANDARD * HWPX_SCALE_FACTOR;
    },

    /**
     * HWPU를 픽셀로 변환 (스케일 팩터 없음, 원본 크기)
     * 표, 도형, 이미지의 크기 계산에 사용
     * ✅ v2.2.11: HWPX 문서 분석 결과에 따른 정확한 변환
     * - imgDim 1500 HWPU = 실제 이미지 20px
     * - 비율: 75 HWPU/pixel = 7200 HWPU/inch at 96 DPI
     * @param {number} hwpu - HWPU 값
     * @returns {number} 픽셀 값 (원본 크기)
     */
    hwpuToPxUnscaled(hwpu) {
        // HWPX/HWP 표준: 7200 HWPU per inch, 96 DPI 기준
        return hwpu / this.HWPU_TO_PX_RATIO * this.DPI_STANDARD;
    },


    /**
     * 밀리미터를 픽셀로 변환
     * @param {number} mm - 밀리미터 값
     * @returns {number} 픽셀 값
     * 
     * @example
     * HWPXConstants.mmToPx(210) // 794 (A4 width)
     */
    mmToPx(mm) {
        return mm * this.DPI_STANDARD / 25.4; // 1 inch = 25.4mm
    },

    /**
     * 픽셀을 포인트로 변환
     * @param {number} px - 픽셀 값
     * @returns {number} 포인트 값
     * 
     * @example
     * HWPXConstants.pxToPt(96) // 72
     */
    pxToPt(px) {
        return px * this.DPI_PRINT / this.DPI_STANDARD;
    },

    /**
     * 인치를 픽셀로 변환
     * @param {number} inch - 인치 값
     * @returns {number} 픽셀 값
     * 
     * @example
     * HWPXConstants.inchToPx(1) // 96
     */
    inchToPx(inch) {
        return inch * this.DPI_STANDARD;
    },

    /**
     * 픽셀을 인치로 변환
     * @param {number} px - 픽셀 값
     * @returns {number} 인치 값
     * 
     * @example
     * HWPXConstants.pxToInch(96) // 1
     */
    pxToInch(px) {
        return px / this.DPI_STANDARD;
    }
};

// Freeze to prevent modification
Object.freeze(HWPXConstants);

// Default export
export default HWPXConstants;

