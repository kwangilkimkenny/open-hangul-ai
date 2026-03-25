/**
 * DefaultValues.ts - HWP → HWPX 변환 기본값 정의
 *
 * 이 파일은 변환 과정에서 사용되는 모든 기본값을 중앙 집중화합니다.
 * 하드코딩된 값을 제거하고, 일관성 있는 기본값 관리를 제공합니다.
 *
 * 각 기본값에는 다음 정보가 포함됩니다:
 * - 값의 의미 (주석)
 * - 단위 (HWPUNIT, pt, % 등)
 * - 출처 (HWP 스펙, HWPX 샘플 분석 등)
 *
 * @module Constants
 * @category Constants
 */

import { FONT_SIZE, MARGIN, PAGE } from './hwpunit';

// ============================================
// 문단 모양 기본값 (ParaShape)
// ============================================

/**
 * 문단 모양 기본값
 * HWP 기본 문서 템플릿 기준
 */
export const PARA_DEFAULTS = {
    /**
     * 줄 간격 (%)
     * 160 = 160% (한글 워드프로세서 기본값)
     * 단행 간격의 1.6배
     */
    lineSpacing: 160,

    /**
     * 줄 간격 타입
     * 0: PERCENT (퍼센트)
     * 1: FIXED (고정값)
     * 2: BETWEEN_LINES (줄 사이)
     * 3: AT_LEAST (최소값)
     */
    lineSpacingType: 0,

    /**
     * 왼쪽 여백 (HWPUNIT)
     * 0 = 여백 없음 (기본 문단)
     */
    leftMargin: 0,

    /**
     * 오른쪽 여백 (HWPUNIT)
     */
    rightMargin: 0,

    /**
     * 들여쓰기 (HWPUNIT)
     * 0 = 들여쓰기 없음
     */
    indent: 0,

    /**
     * 문단 앞 간격 (HWPUNIT)
     */
    spacingBefore: 0,

    /**
     * 문단 뒤 간격 (HWPUNIT)
     */
    spacingAfter: 0,

    /**
     * 수평 정렬
     * JUSTIFY: 양쪽 정렬 (한글 기본값)
     * LEFT: 왼쪽 정렬
     * CENTER: 가운데 정렬
     * RIGHT: 오른쪽 정렬
     */
    alignment: 'JUSTIFY' as const,

    /**
     * 기본 탭 정의 ID
     */
    tabDefId: 0,

    /**
     * 줄바꿈 유형
     * BREAK_WORD: 단어 단위 줄바꿈 (기본)
     * KEEP_WORD: 단어 유지
     */
    breakType: 'BREAK_WORD' as const,
} as const;

// ============================================
// 글자 모양 기본값 (CharShape)
// ============================================

/**
 * 글자 모양 기본값
 */
export const CHAR_DEFAULTS = {
    /**
     * 폰트 크기 (HWPUNIT)
     * 1000 = 10pt (한글 기본 본문 크기)
     */
    fontSize: FONT_SIZE.DEFAULT,

    /**
     * 폰트 장평 (%)
     * 100 = 기본 너비
     */
    fontRatio: 100,

    /**
     * 글자 간격 (%)
     * 0 = 기본 간격
     */
    charSpacing: 0,

    /**
     * 상대 크기 (%)
     * 100 = 기준 크기
     */
    relativeSize: 100,

    /**
     * 글자 위치 (%)
     * 0 = 기본 위치 (baseline)
     */
    charOffset: 0,

    /**
     * 글자색 (RGB)
     * 0x000000 = 검정색
     */
    textColor: 0x000000,

    /**
     * 음영색 (RGB)
     * 0xFFFFFF = 흰색 (음영 없음)
     */
    shadeColor: 0xFFFFFF,

    /**
     * 밑줄색 (RGB)
     * 0x000000 = 검정색
     */
    underlineColor: 0x000000,

    /**
     * 밑줄 타입
     * NONE: 밑줄 없음
     */
    underlineType: 'NONE' as const,

    /**
     * 기울임 여부
     */
    italic: false,

    /**
     * 굵게 여부
     */
    bold: false,

    /**
     * 취소선 타입
     * NONE: 취소선 없음
     */
    strikeoutType: 'NONE' as const,

    /**
     * BorderFill 참조 ID
     * 1 = 기본 (테두리/배경 없음)
     */
    borderFillId: 1,
} as const;

// ============================================
// 테이블 기본값
// ============================================

/**
 * 테이블 기본값
 */
export const TABLE_DEFAULTS = {
    /**
     * 셀 기본 여백 (HWPUNIT)
     * 141 ≈ 0.5mm
     */
    cellMargin: 141,

    /**
     * 셀 여백 (좀 더 여유 있는 값)
     * 283 ≈ 1mm
     */
    cellMarginLarge: MARGIN.CELL_DEFAULT,

    /**
     * 테두리 너비 (HWPUNIT)
     * 1 = 기본 얇은 선
     */
    borderWidth: 1,

    /**
     * 테이블 BorderFill 참조 ID
     * 3 = 일반적인 테이블 테두리 스타일
     */
    borderFillId: 3,

    /**
     * 셀 BorderFill 참조 ID
     * 7 = 일반적인 셀 테두리 스타일
     * 또는 1 = 기본 스타일
     */
    cellBorderFillId: 1,

    /**
     * 기본 셀 높이 (HWPUNIT)
     */
    cellHeight: 2000,

    /**
     * 기본 셀 수직 정렬
     */
    cellVertAlign: 'CENTER' as const,

    /**
     * 기본 셀 텍스트 방향
     */
    cellTextDirection: 'HORIZONTAL' as const,

    /**
     * 셀 간격 (HWPUNIT)
     */
    cellSpacing: 0,
} as const;

// ============================================
// 그림/이미지 기본값
// ============================================

/**
 * 그림/이미지 기본값
 */
export const PICTURE_DEFAULTS = {
    /**
     * 기본 너비 (HWPUNIT)
     * 8000 ≈ 28mm (약 1.1인치)
     * 원본 크기 정보가 없을 때 사용
     */
    width: 8000,

    /**
     * 기본 높이 (HWPUNIT)
     * 6000 ≈ 21mm (약 0.83인치)
     */
    height: 6000,

    /**
     * 기본 밝기 조정
     * 0 = 원본
     */
    brightness: 0,

    /**
     * 기본 대비 조정
     * 0 = 원본
     */
    contrast: 0,

    /**
     * 기본 투명도
     * 0 = 불투명
     */
    alpha: 0,

    /**
     * 기본 BinData 참조 ID
     * 0 = 미지정
     */
    binDataIdRef: 0,

    /**
     * 기본 Z-order
     */
    zOrder: 0,
} as const;

// ============================================
// 도형 기본값
// ============================================

/**
 * 도형 위치/배치 기본값
 */
export const SHAPE_DEFAULTS = {
    /**
     * 글자처럼 취급
     * true = 텍스트 흐름에 포함
     */
    treatAsChar: false,

    /**
     * 수직 기준
     * PARA: 문단 기준
     * PAGE: 페이지 기준
     * PAPER: 용지 기준
     */
    vertRelTo: 'PARA' as const,

    /**
     * 수평 기준
     * COLUMN: 단 기준
     * PARA: 문단 기준
     * PAGE: 페이지 기준
     */
    horzRelTo: 'COLUMN' as const,

    /**
     * 수직 정렬
     */
    vertAlign: 'TOP' as const,

    /**
     * 수평 정렬
     */
    horzAlign: 'LEFT' as const,

    /**
     * 수직 오프셋 (HWPUNIT)
     */
    vertOffset: 0,

    /**
     * 수평 오프셋 (HWPUNIT)
     */
    horzOffset: 0,

    /**
     * 텍스트 감싸기 타입
     * SQUARE: 사각형 주위로 감싸기
     * TOP_BOTTOM: 위아래
     * BEHIND_TEXT: 글 뒤로
     * IN_FRONT_OF_TEXT: 글 앞으로
     */
    textWrap: 'SQUARE' as const,

    /**
     * 기본 회전 각도 (도)
     */
    rotation: 0,

    /**
     * 기본 그룹 레벨
     */
    groupLevel: 0,

    /**
     * 선 색상
     * 0x000000 = 검정색
     */
    lineColor: 0x000000,

    /**
     * 선 너비 (HWPUNIT)
     */
    lineWidth: 1,

    /**
     * 선 스타일
     * 0 = 실선
     */
    lineStyle: 0,

    /**
     * 채우기 색상
     * 0xFFFFFF = 흰색 (투명)
     */
    fillColor: 0xFFFFFF,
} as const;

/**
 * 인라인 도형 기본값 (글자처럼 취급되는 도형)
 */
export const INLINE_SHAPE_DEFAULTS = {
    ...SHAPE_DEFAULTS,
    treatAsChar: true,
    vertRelTo: 'LINE' as const,
    horzRelTo: 'COLUMN' as const,
} as const;

// ============================================
// 수식 기본값
// ============================================

/**
 * 수식 기본값
 */
export const EQUATION_DEFAULTS = {
    /**
     * 기본 너비 (HWPUNIT)
     */
    width: PAGE.DEFAULT_EQUATION_WIDTH,

    /**
     * 기본 높이 (HWPUNIT)
     */
    height: 5000,

    /**
     * 기본 폰트 크기 (pt)
     */
    fontSize: 10,

    /**
     * 기본 베이스라인
     */
    baseline: 0,

    /**
     * 인라인 여부
     */
    inline: true,
} as const;

// ============================================
// 차트 기본값
// ============================================

/**
 * 차트 기본값
 */
export const CHART_DEFAULTS = {
    /**
     * 기본 너비 (HWPUNIT)
     */
    width: 20000,

    /**
     * 기본 높이 (HWPUNIT)
     */
    height: 15000,

    /**
     * 기본 차트 타입
     * 0 = COLUMN (막대 차트)
     */
    chartType: 0,
} as const;

// ============================================
// 폰트 기본값
// ============================================

/**
 * 폰트 폴백 맵 (로케일별)
 */
export const FALLBACK_FONTS: Record<string, string> = {
    'ko-KR': '맑은 고딕',
    'ko': '맑은 고딕',
    'en-US': 'Arial',
    'en': 'Arial',
    'ja-JP': 'MS Gothic',
    'ja': 'MS Gothic',
    'zh-CN': 'SimSun',
    'zh-TW': 'PMingLiU',
    'zh': 'SimSun',
    'default': '맑은 고딕',
};

/**
 * 폰트 언어 타입별 기본 폰트
 */
export const DEFAULT_FONTS = {
    /** 한글 기본 폰트 */
    hangul: '맑은 고딕',
    /** 영문 기본 폰트 */
    latin: '맑은 고딕',
    /** 한자 기본 폰트 */
    hanja: '맑은 고딕',
    /** 일본어 기본 폰트 */
    japanese: '맑은 고딕',
    /** 기타 기본 폰트 */
    other: '맑은 고딕',
    /** 기호 기본 폰트 */
    symbol: '맑은 고딕',
    /** 사용자 기본 폰트 */
    user: '맑은 고딕',
} as const;

/**
 * 로케일에 따른 기본 폰트 반환
 * @param locale 로케일 코드 (예: 'ko-KR', 'en-US')
 */
export function getDefaultFont(locale?: string): string {
    if (!locale) {
        return FALLBACK_FONTS.default;
    }

    // 정확한 매칭 시도
    if (FALLBACK_FONTS[locale]) {
        return FALLBACK_FONTS[locale];
    }

    // 언어 코드만으로 매칭 시도 (ko-KR -> ko)
    const langCode = locale.split('-')[0];
    if (FALLBACK_FONTS[langCode]) {
        return FALLBACK_FONTS[langCode];
    }

    return FALLBACK_FONTS.default;
}

// ============================================
// 페이지 기본값
// ============================================

/**
 * 페이지 정의 기본값
 */
export const PAGE_DEFAULTS = {
    /** A4 너비 (HWPUNIT) */
    width: PAGE.A4_WIDTH,

    /** A4 높이 (HWPUNIT) */
    height: PAGE.A4_HEIGHT,

    /** 기본 왼쪽 여백 (약 30mm) */
    leftMargin: 8504,

    /** 기본 오른쪽 여백 (약 30mm) */
    rightMargin: 8504,

    /** 기본 위쪽 여백 (약 25mm) */
    topMargin: 5669,

    /** 기본 아래쪽 여백 (약 15mm) */
    bottomMargin: 4252,

    /** 기본 머리말 여백 */
    headerMargin: 4252,

    /** 기본 꼬리말 여백 */
    footerMargin: 4252,

    /** 기본 제본 여백 */
    gutterMargin: 0,

    /** 기본 방향 (세로) */
    landscape: false,
} as const;

// ============================================
// 페이지 테두리/배경 기본값
// ============================================

/**
 * 페이지 테두리/배경 기본값
 */
export const PAGE_BORDER_DEFAULTS = {
    /** 적용 위치 */
    applyPosition: 'BOTH_PAGES' as const,

    /** BorderFill 참조 ID */
    borderFillId: 1,

    /** 테두리 오프셋 포함 */
    includeBorderOffset: false,

    /** 머리글 포함 */
    includeHeader: true,

    /** 바닥글 포함 */
    includeFooter: true,

    /** 오프셋 (HWPUNIT) */
    offset: 0,
} as const;

// ============================================
// 필드/컨트롤 기본값
// ============================================

/**
 * 필드 컨트롤 기본값
 */
export const FIELD_DEFAULTS = {
    /**
     * 하이퍼링크 타겟
     */
    hyperlinkTarget: '_blank' as const,

    /**
     * 북마크 기본 이름 접두사
     */
    bookmarkPrefix: 'bookmark_',

    /**
     * 필드 기본 값
     */
    fieldValue: '',
} as const;

// ============================================
// ID 참조 기본값 (폴백용)
// ============================================

/**
 * ID 참조 폴백 값
 * 유효하지 않은 ID가 감지되었을 때 사용
 */
export const ID_FALLBACKS = {
    /** 폰트 ID 폴백 (0 = 첫 번째 폰트) */
    fontId: 0,

    /** CharShape ID 폴백 */
    charShapeId: 0,

    /** ParaShape ID 폴백 */
    paraShapeId: 0,

    /** Style ID 폴백 */
    styleId: 0,

    /** BorderFill ID 폴백 (1 = 기본 스타일) */
    borderFillId: 1,

    /** TabDef ID 폴백 */
    tabDefId: 0,

    /** BinData ID 폴백 (0 = 없음) */
    binDataId: 0,
} as const;

// ============================================
// 통합 DEFAULTS 객체
// ============================================

/**
 * 모든 기본값을 포함하는 통합 객체
 *
 * 사용 예시:
 * ```typescript
 * import { DEFAULTS } from './constants/DefaultValues';
 *
 * const lineSpacing = paraShape.lineSpacing ?? DEFAULTS.paragraph.lineSpacing;
 * const fontSize = charShape.height ?? DEFAULTS.character.fontSize;
 * ```
 */
export const DEFAULTS = {
    paragraph: PARA_DEFAULTS,
    character: CHAR_DEFAULTS,
    table: TABLE_DEFAULTS,
    picture: PICTURE_DEFAULTS,
    shape: SHAPE_DEFAULTS,
    inlineShape: INLINE_SHAPE_DEFAULTS,
    equation: EQUATION_DEFAULTS,
    chart: CHART_DEFAULTS,
    font: DEFAULT_FONTS,
    page: PAGE_DEFAULTS,
    pageBorder: PAGE_BORDER_DEFAULTS,
    field: FIELD_DEFAULTS,
    idFallback: ID_FALLBACKS,
} as const;

export default DEFAULTS;
