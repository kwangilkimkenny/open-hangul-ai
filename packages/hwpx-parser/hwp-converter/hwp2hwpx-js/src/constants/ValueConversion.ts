/**
 * Centralized HWP → HWPX (OWPML) Value Conversion Utilities
 *
 * This module provides comprehensive mapping functions for converting
 * HWP binary format values to HWPX/OWPML XML attribute values.
 *
 * Reference: OWPML 2.2 Standard, HWP 5.0 File Format Specification
 */

// ============================================================
// TEXT ALIGNMENT
// ============================================================

/**
 * Horizontal text alignment (HWP → OWPML)
 * HWP: 0=양쪽맞춤, 1=왼쪽, 2=가운데, 3=오른쪽, 4=배분, 5=나눔
 * @param align HWP alignment value (0-6)
 * @returns OWPML alignment string
 */
export function getHorizontalAlignment(align: number | undefined): string {
    if (align === undefined) return 'JUSTIFY';
    switch (align) {
        case 0: return 'JUSTIFY';           // 양쪽 맞춤
        case 1: return 'LEFT';              // 왼쪽
        case 2: return 'CENTER';            // 가운데
        case 3: return 'RIGHT';             // 오른쪽
        case 4: return 'DISTRIBUTE';        // 배분
        case 5: return 'DISTRIBUTE_SPACE';  // 나눔
        default: return 'JUSTIFY';
    }
}

/**
 * Vertical text alignment (HWP → OWPML)
 * HWP: 0=기준선, 1=위, 2=가운데, 3=아래
 * @param align HWP vertical alignment value (0-3)
 * @returns OWPML vertical alignment string
 */
export function getVerticalAlignment(align: number | undefined): string {
    if (!align) return 'BASELINE';
    switch (align) {
        case 0: return 'BASELINE';  // 기준선
        case 1: return 'TOP';       // 위
        case 2: return 'CENTER';    // 가운데
        case 3: return 'BOTTOM';    // 아래
        default: return 'BASELINE';
    }
}

// ============================================================
// LINE PROPERTIES
// ============================================================

/**
 * Line spacing type (HWP → OWPML)
 * HWP: 0=퍼센트, 1=고정, 2=여백만, 3=최소
 * @param type HWP line spacing type (0-3)
 * @returns OWPML line spacing type string
 */
export function getLineSpacingType(type: number | undefined): string {
    if (!type) return 'PERCENT';
    switch (type) {
        case 0: return 'PERCENT';        // 퍼센트
        case 1: return 'FIXED';          // 고정값
        case 2: return 'BETWEEN_LINES';  // 여백만 지정
        case 3: return 'AT_LEAST';       // 최소
        default: return 'PERCENT';
    }
}

/**
 * Line type for borders (HWP → OWPML LineType1)
 * @param type HWP border line type (0-11)
 * @returns OWPML line type string
 */
export function getBorderLineType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 0: return 'NONE';
        case 1: return 'SOLID';
        case 2: return 'DASH';
        case 3: return 'DOT';
        case 4: return 'DASH_DOT';
        case 5: return 'DASH_DOT_DOT';
        case 6: return 'LONG_DASH';
        case 7: return 'CIRCLE';
        case 8: return 'DOUBLE_SLIM';
        case 9: return 'SLIM_THICK';
        case 10: return 'THICK_SLIM';
        case 11: return 'SLIM_THICK_SLIM';
        default: return 'SOLID';
    }
}

/**
 * Line type for underlines/strikeouts (HWP → OWPML LineType2)
 * @param shape HWP line shape (0-10)
 * @returns OWPML line shape string
 */
export function getLineShape(shape: number | undefined): string {
    if (!shape) return 'SOLID';
    switch (shape) {
        case 0: return 'SOLID';
        case 1: return 'DASH';
        case 2: return 'DOT';
        case 3: return 'DASH_DOT';
        case 4: return 'DASH_DOT_DOT';
        case 5: return 'LONG_DASH';
        case 6: return 'CIRCLE';
        case 7: return 'DOUBLE_SLIM';
        case 8: return 'SLIM_THICK';
        case 9: return 'THICK_SLIM';
        case 10: return 'SLIM_THICK_SLIM';
        default: return 'SOLID';
    }
}

/**
 * Line wrap type (HWP → OWPML)
 * @param type HWP line wrap type (0-2)
 * @returns OWPML line wrap string
 */
export function getLineWrapType(type: number | undefined): string {
    if (!type) return 'BREAK';
    switch (type) {
        case 0: return 'BREAK';
        case 1: return 'SQUEEZE';
        case 2: return 'KEEP';
        default: return 'BREAK';
    }
}

// ============================================================
// BORDER WIDTH
// ============================================================

/**
 * Border width code to mm string (HWP → OWPML)
 * @param widthCode HWP border width code (0-15)
 * @returns Border width in mm string format
 */
export function getBorderWidthMm(widthCode: number | undefined): string {
    if (widthCode === undefined) return '0.12 mm';
    switch (widthCode) {
        case 0: return '0.1 mm';
        case 1: return '0.12 mm';
        case 2: return '0.15 mm';
        case 3: return '0.2 mm';
        case 4: return '0.25 mm';
        case 5: return '0.3 mm';
        case 6: return '0.4 mm';
        case 7: return '0.5 mm';
        case 8: return '0.6 mm';
        case 9: return '0.7 mm';
        case 10: return '1.0 mm';
        case 11: return '1.5 mm';
        case 12: return '2.0 mm';
        case 13: return '3.0 mm';
        case 14: return '4.0 mm';
        case 15: return '5.0 mm';
        default: return '0.12 mm';
    }
}

/**
 * Border width code to HWPUNIT value
 * @param widthCode HWP border width code (0-15)
 * @returns Border width in HWPUNIT
 */
export function getBorderWidthHwpunit(widthCode: number | undefined): number {
    if (widthCode === undefined) return 34;  // 0.12mm
    const widthMap: number[] = [
        28,   // 0.1 mm
        34,   // 0.12 mm
        43,   // 0.15 mm
        57,   // 0.2 mm
        71,   // 0.25 mm
        85,   // 0.3 mm
        113,  // 0.4 mm
        142,  // 0.5 mm
        170,  // 0.6 mm
        198,  // 0.7 mm
        283,  // 1.0 mm
        425,  // 1.5 mm
        567,  // 2.0 mm
        850,  // 3.0 mm
        1134, // 4.0 mm
        1417  // 5.0 mm
    ];
    return widthMap[widthCode] || 34;
}

// ============================================================
// TEXT PROPERTIES
// ============================================================

/**
 * Underline type (HWP → OWPML)
 * HWP: 0=없음, 1=아래, 2=가운데, 3=위
 * @param type HWP underline type (0-3)
 * @returns OWPML underline position string
 */
export function getUnderlineType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 1: return 'BOTTOM';   // 글자 아래
        case 2: return 'CENTER';   // 글자 중간
        case 3: return 'TOP';      // 글자 위
        default: return 'NONE';
    }
}

/**
 * Strikeout shape (HWP → OWPML)
 * @param type HWP strikeout type
 * @returns OWPML strikeout shape string
 */
export function getStrikeoutShape(type: number | undefined): string {
    if (type === 1) return 'CONTINUOUS';
    return 'NONE';
}

/**
 * Shadow type (HWP → OWPML)
 * HWP: 0=없음, 1=비연속, 2=연속
 * @param type HWP shadow type (0-2)
 * @returns OWPML shadow type string
 */
export function getShadowType(type: number | undefined): string {
    if (!type || type === 0) return 'NONE';
    switch (type) {
        case 1: return 'DROP';        // 비연속
        case 2: return 'CONTINUOUS';  // 연속
        default: return 'DROP';
    }
}

/**
 * Emphasis mark (SymMark) type (HWP → OWPML)
 * @param type HWP emphasis mark type (0-12)
 * @returns OWPML emphasis mark string
 */
export function getSymMarkType(type: number | undefined): string {
    if (!type || type === 0) return 'NONE';
    switch (type) {
        case 1: return 'DOT_ABOVE';      // 점 (위)
        case 2: return 'RING_ABOVE';     // 고리 (위)
        case 3: return 'TILDE';          // 물결
        case 4: return 'CARON';          // 꺾쇠
        case 5: return 'SIDE';           // 옆점
        case 6: return 'COLON';          // 쌍점
        case 7: return 'GRAVE_ACCENT';   // 억음 부호
        case 8: return 'ACUTE_ACCENT';   // 양음 부호
        case 9: return 'CIRCUMFLEX';     // 곡절 부호
        case 10: return 'MACRON';        // 장음 부호
        case 11: return 'HOOK_ABOVE';    // 훅 (위)
        case 12: return 'DOT_BELOW';     // 점 (아래)
        default: return 'NONE';
    }
}

/**
 * Outline type (HWP → OWPML)
 * @param type HWP outline type (0-6)
 * @returns OWPML outline type string
 */
export function getOutlineType(type: number | undefined): string {
    if (!type || type === 0) return 'NONE';
    switch (type) {
        case 1: return 'SOLID';
        case 2: return 'DOT';
        case 3: return 'THICK';
        case 4: return 'DASH';
        case 5: return 'DASH_DOT';
        case 6: return 'DASH_DOT_DOT';
        default: return 'NONE';
    }
}

// ============================================================
// PARAGRAPH PROPERTIES
// ============================================================

/**
 * Heading type (HWP → OWPML)
 * @param type HWP heading type (0-3)
 * @returns OWPML heading type string
 */
export function getHeadingType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 0: return 'NONE';
        case 1: return 'OUTLINE';  // 개요
        case 2: return 'NUMBER';   // 번호
        case 3: return 'BULLET';   // 글머리표
        default: return 'NONE';
    }
}

/**
 * Break word type (HWP → OWPML)
 * @param type HWP break word type (0-2)
 * @returns OWPML break word type string
 */
export function getBreakWordType(type: number | undefined): string {
    if (!type) return 'KEEP_WORD';
    switch (type) {
        case 0: return 'KEEP_WORD';
        case 1: return 'HYPHEN_WORD';
        case 2: return 'BREAK_WORD';
        default: return 'KEEP_WORD';
    }
}

// ============================================================
// BORDER FILL
// ============================================================

/**
 * Center line type (HWP → OWPML)
 * @param type HWP center line type (0-3)
 * @returns OWPML center line type string
 */
export function getCenterLineType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 0: return 'NONE';
        case 1: return 'SOLID';
        case 2: return 'DASH';
        case 3: return 'DOT';
        default: return 'NONE';
    }
}

/**
 * Slash/BackSlash type (HWP → OWPML)
 * @param type HWP slash type (0-3)
 * @returns OWPML slash type string
 */
export function getSlashType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 0: return 'NONE';
        case 1: return 'SLASH';
        case 2: return 'BACK_SLASH';
        case 3: return 'CROOKED_SLASH';
        default: return 'NONE';
    }
}

/**
 * Gradient type (HWP → OWPML)
 * @param type HWP gradient type (1-4)
 * @returns OWPML gradient type string
 */
export function getGradientType(type: number | undefined): string {
    if (!type) return 'LINEAR';
    switch (type) {
        case 1: return 'LINEAR';   // 선형
        case 2: return 'RADIAL';   // 방사형
        case 3: return 'CONICAL';  // 원뿔형
        case 4: return 'SQUARE';   // 사각형
        default: return 'LINEAR';
    }
}

/**
 * Image fill mode (HWP → OWPML)
 * @param mode HWP image fill mode (0-15)
 * @returns OWPML image fill mode string
 */
export function getImageFillMode(mode: number | undefined): string {
    if (!mode) return 'TILE';
    switch (mode) {
        case 0: return 'TILE';
        case 1: return 'TILE_HORZ_TOP';
        case 2: return 'TILE_HORZ_BOTTOM';
        case 3: return 'TILE_VERT_LEFT';
        case 4: return 'TILE_VERT_RIGHT';
        case 5: return 'TOTAL';
        case 6: return 'CENTER';
        case 7: return 'CENTER_TOP';
        case 8: return 'CENTER_BOTTOM';
        case 9: return 'LEFT_CENTER';
        case 10: return 'LEFT_TOP';
        case 11: return 'LEFT_BOTTOM';
        case 12: return 'RIGHT_CENTER';
        case 13: return 'RIGHT_TOP';
        case 14: return 'RIGHT_BOTTOM';
        case 15: return 'ZOOM';
        default: return 'TILE';
    }
}

// ============================================================
// SHAPE PROPERTIES
// ============================================================

/**
 * Text wrap type (HWP → OWPML)
 * @param type HWP text wrap type (0-5)
 * @returns OWPML text wrap type string
 */
export function getTextWrapType(type: number | undefined): string {
    if (type === undefined) return 'TOP_AND_BOTTOM';
    switch (type) {
        case 0: return 'SQUARE';        // 사각형
        case 1: return 'TIGHT';         // 빠듯하게
        case 2: return 'THROUGH';       // 양쪽
        case 3: return 'TOP_AND_BOTTOM';// 상하
        case 4: return 'BEHIND_TEXT';   // 글 뒤로
        case 5: return 'IN_FRONT_OF_TEXT'; // 글 앞으로
        default: return 'TOP_AND_BOTTOM';
    }
}

/**
 * Text flow type (HWP → OWPML)
 * @param type HWP text flow type (0-2)
 * @returns OWPML text flow type string
 */
export function getTextFlowType(type: number | undefined): string {
    if (!type) return 'BOTH_SIDES';
    switch (type) {
        case 0: return 'BOTH_SIDES';    // 양쪽
        case 1: return 'LEFT_ONLY';     // 왼쪽만
        case 2: return 'RIGHT_ONLY';    // 오른쪽만
        case 3: return 'LARGEST_ONLY';  // 큰쪽만
        default: return 'BOTH_SIDES';
    }
}

/**
 * Vertical relative position (HWP → OWPML)
 * @param type HWP vertical relative type (0-2)
 * @returns OWPML vertical relative string
 */
export function getVertRelType(type: number | undefined): string {
    if (!type) return 'PARA';
    switch (type) {
        case 0: return 'PARA';    // 문단
        case 1: return 'PAGE';    // 페이지
        case 2: return 'PAPER';   // 용지
        default: return 'PARA';
    }
}

/**
 * Horizontal relative position (HWP → OWPML)
 * @param type HWP horizontal relative type (0-3)
 * @returns OWPML horizontal relative string
 */
export function getHorzRelType(type: number | undefined): string {
    if (!type) return 'PARA';
    switch (type) {
        case 0: return 'PARA';    // 문단
        case 1: return 'PAGE';    // 페이지
        case 2: return 'COLUMN';  // 단
        case 3: return 'PAPER';   // 용지
        default: return 'PARA';
    }
}

/**
 * Width relative type (HWP → OWPML)
 * @param type HWP width relative type (0-3)
 * @returns OWPML width relative string
 */
export function getWidthRelType(type: number | undefined): string {
    if (!type) return 'ABSOLUTE';
    switch (type) {
        case 0: return 'ABSOLUTE';  // 절대값
        case 1: return 'PAPER';     // 용지 기준
        case 2: return 'PAGE';      // 페이지 기준
        case 3: return 'COLUMN';    // 단 기준
        case 4: return 'PARA';      // 문단 기준
        default: return 'ABSOLUTE';
    }
}

/**
 * Height relative type (HWP → OWPML)
 * @param type HWP height relative type (0-3)
 * @returns OWPML height relative string
 */
export function getHeightRelType(type: number | undefined): string {
    if (!type) return 'ABSOLUTE';
    switch (type) {
        case 0: return 'ABSOLUTE';  // 절대값
        case 1: return 'PAPER';     // 용지 기준
        case 2: return 'PAGE';      // 페이지 기준
        default: return 'ABSOLUTE';
    }
}

// ============================================================
// NUMBERING PROPERTIES
// ============================================================

/**
 * Numbering format (HWP → OWPML)
 * @param format HWP numbering format code
 * @returns OWPML numbering format string
 */
export function getNumberFormat(format: number | undefined): string {
    if (format === undefined) return 'DIGIT';
    switch (format) {
        case 0: return 'DIGIT';              // 1, 2, 3
        case 1: return 'CIRCLE_DIGIT';       // ①, ②, ③
        case 2: return 'ROMAN_CAPITAL';      // I, II, III
        case 3: return 'ROMAN_SMALL';        // i, ii, iii
        case 4: return 'LATIN_CAPITAL';      // A, B, C
        case 5: return 'LATIN_SMALL';        // a, b, c
        case 6: return 'CIRCLED_LATIN_CAPITAL'; // Ⓐ, Ⓑ, Ⓒ
        case 7: return 'CIRCLED_LATIN_SMALL';   // ⓐ, ⓑ, ⓒ
        case 8: return 'HANGUL_SYLLABLE';    // 가, 나, 다
        case 9: return 'CIRCLED_HANGUL_SYLLABLE'; // ㉮, ㉯, ㉰
        case 10: return 'HANGUL_JAMO';       // ㄱ, ㄴ, ㄷ
        case 11: return 'CIRCLED_HANGUL_JAMO'; // ㉠, ㉡, ㉢
        case 12: return 'HANGUL_PHONETIC';   // 일, 이, 삼
        case 13: return 'IDEOGRAPH';         // 一, 二, 三
        case 14: return 'CIRCLED_IDEOGRAPH'; // ㊀, ㊁, ㊂
        case 15: return 'DECAGON_CIRCLE';    // ⑴, ⑵, ⑶
        case 16: return 'DECAGON_CIRCLE_HANGUL'; // ㈎, ㈏, ㈐
        default: return 'DIGIT';
    }
}

// ============================================================
// SECTION PROPERTIES
// ============================================================

/**
 * Text direction (HWP → OWPML)
 * @param direction HWP text direction code (0-3)
 * @returns OWPML text direction string
 */
export function getTextDirection(direction: number | undefined): string {
    if (!direction) return 'HORIZONTAL';
    switch (direction) {
        case 0: return 'HORIZONTAL';     // 가로
        case 1: return 'VERTICAL';       // 세로
        case 2: return 'HORIZONTAL_RTL'; // 우->좌 가로
        case 3: return 'VERTICAL_RTL';   // 우->좌 세로
        default: return 'HORIZONTAL';
    }
}

/**
 * Page starts on (HWP → OWPML)
 * @param type HWP page starts type (0-3)
 * @returns OWPML page starts string
 */
export function getPageStartsOn(type: number | undefined): string {
    if (!type) return 'BOTH';
    switch (type) {
        case 0: return 'BOTH';   // 양쪽
        case 1: return 'EVEN';   // 짝수
        case 2: return 'ODD';    // 홀수
        default: return 'BOTH';
    }
}

// ============================================================
// TABLE PROPERTIES
// ============================================================

/**
 * Cell split type (HWP → OWPML)
 * @param type HWP cell split type (0-2)
 * @returns OWPML cell split type string
 */
export function getCellSplitType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 0: return 'NONE';
        case 1: return 'BY_CELL';
        case 2: return 'SPLIT';
        default: return 'NONE';
    }
}

// ============================================================
// COLOR UTILITIES
// ============================================================

// Pre-computed hex digits for fast color conversion
const HEX_CHARS = '0123456789abcdef';

/**
 * Convert HWP color (BGR) to HWPX color (#RRGGBB)
 * @param color HWP color value in BGR format
 * @returns Color string in #RRGGBB format
 */
export function formatColor(color: number | undefined): string {
    if (color === undefined || color === null) return '#000000';

    const c = color & 0xFFFFFF;
    return '#' +
        HEX_CHARS[(c >> 20) & 0xF] +
        HEX_CHARS[(c >> 16) & 0xF] +
        HEX_CHARS[(c >> 12) & 0xF] +
        HEX_CHARS[(c >> 8) & 0xF] +
        HEX_CHARS[(c >> 4) & 0xF] +
        HEX_CHARS[c & 0xF];
}

/**
 * Convert HWP RGB to HWPX color with hex string
 * @param r Red value (0-255)
 * @param g Green value (0-255)
 * @param b Blue value (0-255)
 * @returns Color string in #RRGGBB format
 */
export function rgbToHex(r: number, g: number, b: number): string {
    return '#' +
        HEX_CHARS[(r >> 4) & 0xF] + HEX_CHARS[r & 0xF] +
        HEX_CHARS[(g >> 4) & 0xF] + HEX_CHARS[g & 0xF] +
        HEX_CHARS[(b >> 4) & 0xF] + HEX_CHARS[b & 0xF];
}

/**
 * Convert HWP color integer to RGB components
 * @param color HWP color value
 * @returns Object with r, g, b values
 */
export function colorToRgb(color: number): { r: number; g: number; b: number } {
    return {
        r: (color >> 16) & 0xFF,
        g: (color >> 8) & 0xFF,
        b: color & 0xFF
    };
}

// ============================================================
// FIELD TYPES
// ============================================================

/**
 * Field type (HWP → OWPML)
 * @param type HWP field type code
 * @returns OWPML field type string
 */
export function getFieldType(type: number | string | undefined): string {
    if (!type) return 'UNKNOWN';

    // If string control ID is passed
    if (typeof type === 'string') {
        switch (type) {
            case '%unk': return 'CLICKHERE';    // 누름틀
            case '%dte': return 'DATE';          // 날짜
            case '%tme': return 'TIME';          // 시간
            case 'hlnk': return 'HYPERLINK';     // 하이퍼링크
            case 'bokm': return 'BOOKMARK';      // 책갈피
            case '%num': return 'PAGENUM';       // 쪽 번호
            case '%cnt': return 'PAGECOUNT';     // 총 쪽수
            case '%chp': return 'CHAR_POSITION'; // 글자 위치
            case '%sum': return 'SUMMARY';       // 요약
            case '%usr': return 'USERINFO';      // 사용자 정보
            case '%fil': return 'FILENAME';      // 파일 이름
            case 'toc%': return 'TOC';           // 목차
            case 'tdut': return 'DDE';           // DDE
            default: return 'UNKNOWN';
        }
    }

    // If numeric type code is passed
    switch (type) {
        case 0: return 'UNKNOWN';
        case 1: return 'DATE';
        case 2: return 'TIME';
        case 3: return 'PAGENUM';
        case 4: return 'PAGECOUNT';
        case 5: return 'CHAR_POSITION';
        case 6: return 'SUMMARY';
        case 7: return 'USERINFO';
        case 8: return 'FILENAME';
        case 9: return 'MAILMERGE';
        case 10: return 'PATH';
        case 11: return 'BOOKMARK';
        case 12: return 'CROSSREF';
        case 13: return 'FORMULA';
        case 14: return 'CLICKHERE';
        case 15: return 'HYPERLINK';
        case 16: return 'TOC';
        case 17: return 'DDE';
        default: return 'UNKNOWN';
    }
}

// ============================================================
// CHART TYPES
// ============================================================

/**
 * Chart type (HWP → OWPML)
 * @param type HWP chart type code
 * @returns OWPML chart type string
 */
export function getChartType(type: number | undefined): string {
    if (!type) return 'COLUMN';
    switch (type) {
        case 0: return 'COLUMN';
        case 1: return 'LINE';
        case 2: return 'PIE';
        case 3: return 'BAR';
        case 4: return 'AREA';
        case 5: return 'SCATTER';
        case 6: return 'STOCK';
        case 7: return 'SURFACE';
        case 8: return 'DOUGHNUT';
        case 9: return 'BUBBLE';
        case 10: return 'RADAR';
        case 11: return 'COMBINATION';
        // 3D types
        case 20: return 'COLUMN_3D';
        case 21: return 'LINE_3D';
        case 22: return 'PIE_3D';
        case 23: return 'BAR_3D';
        case 24: return 'AREA_3D';
        case 25: return 'SURFACE_3D';
        default: return 'COLUMN';
    }
}

/**
 * Chart legend position (HWP → OWPML)
 * @param position HWP legend position code
 * @returns OWPML legend position string
 */
export function getLegendPosition(position: number | undefined): string {
    if (!position) return 'RIGHT';
    switch (position) {
        case 0: return 'RIGHT';
        case 1: return 'LEFT';
        case 2: return 'TOP';
        case 3: return 'BOTTOM';
        case 4: return 'NONE';
        default: return 'RIGHT';
    }
}

// ============================================================
// REVERSE CONVERSIONS (HWPX/OWPML → HWP)
// ============================================================

/**
 * Parse hex color to integer
 * @param hex Color string (#RRGGBB or RRGGBB)
 * @returns HWP color integer
 */
export function parseHexColor(hex: string | undefined): number {
    if (!hex) return 0;
    const clean = hex.replace('#', '');
    return parseInt(clean, 16) || 0;
}

/**
 * Reverse horizontal alignment (OWPML → HWP)
 * @param align OWPML alignment string
 * @returns HWP alignment value (0-5)
 */
export function reverseHorizontalAlignment(align: string | undefined): number {
    if (!align) return 0;
    switch (align.toUpperCase()) {
        case 'JUSTIFY': return 0;
        case 'LEFT': return 1;
        case 'CENTER': return 2;
        case 'RIGHT': return 3;
        case 'DISTRIBUTE': return 4;
        case 'DISTRIBUTE_SPACE': return 5;
        default: return 0;
    }
}

/**
 * Reverse vertical alignment (OWPML → HWP)
 * @param align OWPML vertical alignment string
 * @returns HWP vertical alignment value (0-3)
 */
export function reverseVerticalAlignment(align: string | undefined): number {
    if (!align) return 0;
    switch (align.toUpperCase()) {
        case 'BASELINE': return 0;
        case 'TOP': return 1;
        case 'CENTER': return 2;
        case 'BOTTOM': return 3;
        default: return 0;
    }
}

/**
 * Reverse border line type (OWPML → HWP)
 * @param type OWPML line type string
 * @returns HWP border line type (0-11)
 */
export function reverseBorderLineType(type: string | undefined): number {
    if (!type) return 0;
    switch (type.toUpperCase()) {
        case 'NONE': return 0;
        case 'SOLID': return 1;
        case 'DASH': return 2;
        case 'DOT': return 3;
        case 'DASH_DOT': return 4;
        case 'DASH_DOT_DOT': return 5;
        case 'LONG_DASH': return 6;
        case 'CIRCLE': return 7;
        case 'DOUBLE_SLIM': return 8;
        case 'SLIM_THICK': return 9;
        case 'THICK_SLIM': return 10;
        case 'SLIM_THICK_SLIM': return 11;
        default: return 1;
    }
}

/**
 * Reverse text wrap type (OWPML → HWP)
 * @param type OWPML text wrap type string
 * @returns HWP text wrap type (0-5)
 */
export function reverseTextWrapType(type: string | undefined): number {
    if (!type) return 3;
    switch (type.toUpperCase()) {
        case 'SQUARE': return 0;
        case 'TIGHT': return 1;
        case 'THROUGH': return 2;
        case 'TOP_AND_BOTTOM': return 3;
        case 'BEHIND_TEXT': return 4;
        case 'IN_FRONT_OF_TEXT': return 5;
        default: return 3;
    }
}

/**
 * Reverse gradient type (OWPML → HWP)
 * @param type OWPML gradient type string
 * @returns HWP gradient type (1-4)
 */
export function reverseGradientType(type: string | undefined): number {
    if (!type) return 1;
    switch (type.toUpperCase()) {
        case 'LINEAR': return 1;
        case 'RADIAL': return 2;
        case 'CONICAL': return 3;
        case 'SQUARE': return 4;
        default: return 1;
    }
}

/**
 * Reverse text direction (OWPML → HWP)
 * @param direction OWPML text direction string
 * @returns HWP text direction code (0-3)
 */
export function reverseTextDirection(direction: string | undefined): number {
    if (!direction) return 0;
    switch (direction.toUpperCase()) {
        case 'HORIZONTAL': return 0;
        case 'VERTICAL': return 1;
        case 'HORIZONTAL_RTL': return 2;
        case 'VERTICAL_RTL': return 3;
        default: return 0;
    }
}

// ============================================================
// UNIT CONVERSION UTILITIES
// ============================================================

const HWPUNIT_PER_MM = 7200 / 25.4;
const HWPUNIT_PER_PT = 100;
const HWPUNIT_PER_INCH = 7200;

/**
 * Parse dimension string to HWPUNIT
 * Supports: mm, pt, inch, px, hwpunit
 * @param value Dimension string (e.g., "10 mm", "12pt", "7200")
 * @returns HWPUNIT value
 */
export function parseDimension(value: string | number | undefined): number {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value;

    const trimmed = value.trim().toLowerCase();

    // Pure number (assumed HWPUNIT)
    const numMatch = trimmed.match(/^(-?\d+\.?\d*)$/);
    if (numMatch) {
        return parseFloat(numMatch[1]);
    }

    // With unit
    const unitMatch = trimmed.match(/^(-?\d+\.?\d*)\s*(mm|pt|inch|in|px|hwpunit)?$/);
    if (unitMatch) {
        const num = parseFloat(unitMatch[1]);
        const unit = unitMatch[2] || 'hwpunit';

        switch (unit) {
            case 'mm': return num * HWPUNIT_PER_MM;
            case 'pt': return num * HWPUNIT_PER_PT;
            case 'inch':
            case 'in': return num * HWPUNIT_PER_INCH;
            case 'px': return num * 75;  // 96 DPI → HWPUNIT
            case 'hwpunit':
            default: return num;
        }
    }

    return 0;
}

/**
 * Format HWPUNIT to dimension string
 * @param value HWPUNIT value
 * @param unit Target unit (mm, pt, inch)
 * @param precision Decimal places
 * @returns Formatted dimension string
 */
export function formatDimension(
    value: number,
    unit: 'mm' | 'pt' | 'inch' | 'hwpunit' = 'hwpunit',
    precision: number = 2
): string {
    let converted: number;

    switch (unit) {
        case 'mm': converted = value / HWPUNIT_PER_MM; break;
        case 'pt': converted = value / HWPUNIT_PER_PT; break;
        case 'inch': converted = value / HWPUNIT_PER_INCH; break;
        case 'hwpunit':
        default: converted = value;
    }

    if (unit === 'hwpunit') {
        return Math.round(converted).toString();
    }

    return `${converted.toFixed(precision)} ${unit}`;
}

// ============================================================
// BOOLEAN CONVERSION
// ============================================================

/**
 * Convert boolean to HWP flag (0/1)
 * @param value Boolean value
 * @returns 0 or 1
 */
export function boolToFlag(value: boolean | undefined): number {
    return value ? 1 : 0;
}

/**
 * Convert HWP flag to boolean
 * @param flag HWP flag (0/1)
 * @returns Boolean value
 */
export function flagToBool(flag: number | undefined): boolean {
    return flag === 1;
}

/**
 * Convert string boolean to actual boolean
 * @param value String "true"/"false" or "0"/"1"
 * @returns Boolean value
 */
export function parseBoolean(value: string | boolean | number | undefined): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
}
