/**
 * IHwpParser - HWP 파서 추상화 인터페이스
 *
 * hwplib-js의 한계를 극복하기 위한 어댑터 패턴 기반 추상화 계층
 * 기존 hwplib-js와 향후 커스텀 파서 간의 일관된 인터페이스 제공
 */

// 기존 타입 import 및 re-export
import type {
    HWPSection,
    HWPParagraph,
    HWPRun,
    HWPControl,
    HWPTable,
    HWPTableRow,
    HWPTableCell,
    HWPPicture,
    PageDef,
    HeaderFooter,
    ColumnDef
} from '../models/hwp.types';

export type {
    HWPSection,
    HWPParagraph,
    HWPRun,
    HWPControl,
    HWPTable,
    HWPTableRow,
    HWPTableCell,
    HWPPicture,
    PageDef,
    HeaderFooter,
    ColumnDef
};

// ============================================
// 파싱 결과 타입 정의
// ============================================

/**
 * 완전한 HWP 파싱 결과
 */
export interface ParsedHwp {
    /** 문서 정보 (DocInfo 스트림) */
    docInfo: DocInfo;

    /** 본문 섹션 목록 */
    sections: EnhancedSection[];

    /** 바이너리 데이터 맵 (BinData ID → 데이터) */
    binData: Map<number, BinDataItem>;

    /** 문서 요약 정보 (선택적) */
    summaryInfo?: SummaryInfo;
}

/**
 * DocInfo 스트림 파싱 결과
 */
export interface DocInfo {
    /** 문서 속성 */
    documentProperties?: DocumentProperties;

    /** ID 매핑 (IdMappings) */
    idMappings?: IdMappings;

    /** 한글 폰트 목록 */
    hanFontFaceList?: FontFace[];

    /** 영문 폰트 목록 */
    enFontFaceList?: FontFace[];

    /** 한자 폰트 목록 */
    hanjaFontFaceList?: FontFace[];

    /** 일본어 폰트 목록 */
    japaneseFontFaceList?: FontFace[];

    /** 기타 폰트 목록 */
    etcFontFaceList?: FontFace[];

    /** 기호 폰트 목록 */
    symbolFontFaceList?: FontFace[];

    /** 사용자 폰트 목록 */
    userFontFaceList?: FontFace[];

    /** 테두리/배경 채우기 목록 */
    borderFillList?: BorderFill[];

    /** 글자 모양 목록 */
    charShapeList?: CharShape[];

    /** 탭 정의 목록 */
    tabDefList?: TabDef[];

    /** 번호/글머리 정의 목록 */
    numberingList?: Numbering[];

    /** 글머리표 정의 목록 */
    bulletList?: Bullet[];

    /** 문단 모양 목록 */
    paraShapeList?: ParaShape[];

    /** 스타일 목록 */
    styleList?: Style[];

    /** 메모 속성 목록 */
    memoShapeList?: MemoShape[];

    /** 변경 추적 정보 */
    trackChangeList?: TrackChange[];

    /** 변경 추적 작성자 */
    trackChangeAuthorList?: TrackChangeAuthor[];

    /** 원시 데이터 (하위 호환용) */
    raw?: RawDocInfo;
}

/**
 * 향상된 섹션 데이터 (hwplib-js 한계 극복)
 */
export interface EnhancedSection extends HWPSection {
    /** 향상된 문단 목록 (CharPosShape 기반 runs 포함) */
    paragraphs: EnhancedParagraph[];

    /** 페이지 정의 */
    pageDef?: PageDef;

    /** 머리글/바닥글 */
    headerFooters?: HeaderFooter[];

    /** 페이지 테두리/배경 */
    pageBorderFill?: PageBorderFill;

    /** 원시 레코드 데이터 (디버깅용) */
    rawRecords?: HwpRecord[];
}

/**
 * 페이지 테두리/배경 정보
 */
export interface PageBorderFill {
    /** 적용 위치: BOTH_PAGES, EVEN_PAGE, ODD_PAGE */
    applyPosition: 'BOTH_PAGES' | 'EVEN_PAGE' | 'ODD_PAGE';
    /** 테두리 오프셋 포함 여부 */
    includeBorderOffset: boolean;
    /** 머리글 영역 포함 */
    includeHeader: boolean;
    /** 바닥글 영역 포함 */
    includeFooter: boolean;
    /** BorderFill ID 참조 */
    borderFillIDRef: number;
    /** 좌측 간격 */
    offsetLeft: number;
    /** 우측 간격 */
    offsetRight: number;
    /** 상단 간격 */
    offsetTop: number;
    /** 하단 간격 */
    offsetBottom: number;
}

/**
 * 향상된 문단 데이터 (CharPosShape 완전 지원)
 */
export interface EnhancedParagraph extends HWPParagraph {
    /** 향상된 텍스트 런 (CharPosShape 기반) */
    runs: EnhancedRun[];

    /** 원본 CharPosShape 배열 */
    charPosShape?: CharPosShapeEntry[];

    /** 문단 내 컨트롤 */
    controls: HWPControl[];

    /** 문단 모양 ID */
    paraShapeID: number;

    /** 스타일 ID */
    styleID: number;

    /** 기본 글자 모양 ID (첫 번째 CharPosShape에서) */
    charShapeID: number;

    /** 문단 ID (섹션 내 순서) */
    id?: number;

    /** 페이지 나눔 여부 */
    pageBreak?: boolean;

    /** 다단 나눔 여부 */
    columnBreak?: boolean;
}

/**
 * 향상된 텍스트 런 (CharPosShape 기반)
 */
export interface EnhancedRun extends HWPRun {
    /** 런 텍스트 */
    text: string;

    /** 글자 모양 ID (charPrIDRef) */
    charShapeID: number;

    /** 문단 내 시작 위치 */
    start: number;

    /** 텍스트 길이 */
    length: number;
}

/**
 * CharPosShape 엔트리 (HWP 내부 구조)
 * position: 해당 charShapeID가 적용되기 시작하는 문자 위치
 */
export interface CharPosShapeEntry {
    position: number;
    charShapeID: number;
}

// ============================================
// DocInfo 하위 타입 정의
// ============================================

export interface DocumentProperties {
    secCount?: number;
    beginNumber?: number;
    caretPos?: number;
}

export interface IdMappings {
    binDataCount?: number;
    hangulFontCount?: number;
    englishFontCount?: number;
    chineseFontCount?: number;
    japaneseFontCount?: number;
    etcFontCount?: number;
    symbolFontCount?: number;
    userFontCount?: number;
    borderFillCount?: number;
    charShapeCount?: number;
    tabDefCount?: number;
    numberingCount?: number;
    bulletCount?: number;
    paraShapeCount?: number;
    styleCount?: number;
    memoShapeCount?: number;
}

export interface FontFace {
    name: string;
    type?: number;
    familyType?: number;
    serifStyle?: number;
    weight?: number;
    proportion?: number;
    contrast?: number;
    strokeVariation?: number;
    armStyle?: number;
    letterform?: number;
    midline?: number;
    xHeight?: number;
    substituteFont?: string;
    defaultFont?: string;
}

export interface BorderFill {
    id: number;
    threeD?: boolean;
    shadow?: boolean;
    slash?: number;
    backSlash?: number;
    leftBorder?: Border;
    rightBorder?: Border;
    topBorder?: Border;
    bottomBorder?: Border;
    diagonalBorder?: Border;
    fillInfo?: FillInfo;
    isNoBorder?: boolean;
}

export interface Border {
    type: number;
    width: number;
    color: number;
}

export interface FillInfo {
    type: number;
    patternColor?: number;
    backgroundColor?: number;
    gradation?: GradationFill;
    image?: ImageFill;
}

/**
 * Gradation fill type definition
 */
export interface GradationFill {
    type: number;           // 0=LINEAR, 1=RADIAL, 2=CONICAL, 3=SQUARE
    angle?: number;         // 0-360 degrees
    centerX?: number;       // Center X for radial/conical (0-100%)
    centerY?: number;       // Center Y for radial/conical (0-100%)
    blur?: number;          // Blur amount (0-100)
    colors: number[];       // Array of RGB colors
    positions?: number[];   // Color stop positions (0-100%)
}

/**
 * Image fill type definition
 */
export interface ImageFill {
    type: number;           // 0=TILE, 1=TILE_HORZ_TOP, etc.
    binDataId: number;      // Reference to BinData
    fillMode?: number;      // Fill mode
    brightAdjust?: number;  // Brightness adjustment (-100 to 100)
    contrastAdjust?: number; // Contrast adjustment (-100 to 100)
    effect?: number;        // 0=REAL, 1=GRAY, 2=BLACK_WHITE
}

export interface CharShape {
    id: number;
    fontId?: number[];
    fontRatio?: number[];
    fontSpacing?: number[];
    fontRelSize?: number[];
    fontPosition?: number[];
    baseSize?: number;
    charAttr?: number;
    shadowSpace1?: number;
    shadowSpace2?: number;
    charColor?: number;
    underlineColor?: number;
    shadeColor?: number;
    shadowColor?: number;
    borderFillId?: number;
    strikeColor?: number;
}

export interface TabDef {
    id: number;
    autoTab?: number;
    tabItems?: TabItem[];
}

export interface TabItem {
    position: number;
    tabKind: number;
    fillKind: number;
}

export interface Numbering {
    id: number;
    start?: number;
    levelNumber?: number[];
}

export interface Bullet {
    id: number;
    bulletChar?: string;
    imageBullet?: boolean;
    imageBulletId?: number;
}

export interface ParaShape {
    id: number;
    align?: number;
    lineSpacing?: number;
    lineSpacingType?: number;
    indentLeft?: number;
    indentRight?: number;
    outdent?: number;
    marginTop?: number;
    marginBottom?: number;
    tabDefId?: number;
    numberingId?: number;
    borderFillId?: number;
}

export interface Style {
    id: number;
    name?: string;
    engName?: string;
    type?: number;
    nextStyleId?: number;
    langId?: number;
    paraShapeId?: number;
    charShapeId?: number;
    lockFormID?: number;
}

export interface MemoShape {
    id: number;
    lineSpacing?: number;
    lineColor?: number;
    fillColor?: number;
}

export interface TrackChange {
    id: number;
    date?: Date;
    type?: number;
    authorId?: number;
}

export interface TrackChangeAuthor {
    id: number;
    name?: string;
}

// ============================================
// Raw Data 타입 (하위 호환용)
// ============================================

/**
 * Raw DocInfo from hwplib-js parser
 */
export interface RawDocInfo {
    documentProperties?: Record<string, unknown>;
    idMappings?: Record<string, unknown>;
    fontFaces?: Record<string, unknown>[];
    borderFills?: Map<number, BorderFill> | BorderFill[];
    borderFillList?: Map<number, BorderFill> | BorderFill[];
    charShapes?: Record<string, unknown>[];
    paraShapes?: Record<string, unknown>[];
    styles?: Record<string, unknown>[];
    tabDefs?: Record<string, unknown>[];
    numberings?: Record<string, unknown>[];
    bullets?: Record<string, unknown>[];
    [key: string]: unknown;
}

// ============================================
// BinData 관련 타입
// ============================================

export interface BinDataItem {
    id: number;
    data: Uint8Array;
    extension: string;
    isCompressed?: boolean;
}

export interface SummaryInfo {
    title?: string;
    subject?: string;
    author?: string;
    keywords?: string;
    comments?: string;
    lastAuthor?: string;
    appName?: string;
    createDate?: Date;
    lastSaveDate?: Date;
}

// ============================================
// HWP 레코드 타입 (로우 레벨)
// ============================================

export interface HwpRecord {
    tagId: number;
    level: number;
    size: number;
    data: Uint8Array;
    headerSize: number;
    offset: number;
}

// HWP 레코드 TagID 상수
export const HWP_TAG_ID = {
    DOCUMENT_PROPERTIES: 16,
    ID_MAPPINGS: 17,
    BIN_DATA: 18,
    FACE_NAME: 19,
    BORDER_FILL: 20,
    CHAR_SHAPE: 21,
    TAB_DEF: 22,
    NUMBERING: 23,
    BULLET: 24,
    PARA_SHAPE: 25,
    STYLE: 26,
    DOC_DATA: 27,
    DISTRIBUTE_DOC_DATA: 28,
    COMPATIBLE_DOCUMENT: 30,

    // BodyText 레코드
    PARA_HEADER: 66,
    PARA_TEXT: 67,
    PARA_CHAR_SHAPE: 68,
    PARA_LINE_SEG: 69,
    PARA_RANGE_TAG: 70,
    CTRL_HEADER: 71,
    LIST_HEADER: 72,
    PAGE_DEF: 73,
    FOOTNOTE_SHAPE: 74,
    PAGE_BORDER_FILL: 75,
    SHAPE_COMPONENT: 76,
    TABLE: 77,
    SHAPE_COMPONENT_LINE: 78,
    SHAPE_COMPONENT_RECT: 79,
    SHAPE_COMPONENT_ELLIPSE: 80,
    SHAPE_COMPONENT_ARC: 81,
    SHAPE_COMPONENT_POLYGON: 82,
    SHAPE_COMPONENT_CURVE: 83,
    SHAPE_COMPONENT_OLE: 84,
    SHAPE_COMPONENT_PICTURE: 85,
    SHAPE_COMPONENT_CONTAINER: 86,
    CTRL_DATA: 87,
    EQEDIT: 88,
    MEMO_SHAPE: 89,
    MEMO_LIST: 90,
    CHART_DATA: 95,
    SHAPE_COMPONENT_TEXTART: 99,
    FORM_OBJECT: 100,
    SHAPE_COMPONENT_UNKNOWN: 115
} as const;

// ============================================
// 파서 인터페이스
// ============================================

/**
 * HWP 파서 인터페이스
 * hwplib-js 어댑터와 향상된 파서 모두 이 인터페이스를 구현
 */
export interface IHwpParser {
    /**
     * HWP 파일을 파싱하여 구조화된 데이터 반환
     * @param data HWP 파일의 바이너리 데이터
     * @returns 파싱된 HWP 데이터
     */
    parse(data: ArrayBuffer): Promise<ParsedHwp>;

    /**
     * 파서 이름 (디버깅/로깅용)
     */
    readonly name: string;

    /**
     * 파서 버전
     */
    readonly version: string;

    /**
     * 지원하는 기능 목록
     */
    readonly capabilities: ParserCapabilities;
}

/**
 * 파서 기능 플래그
 */
export interface ParserCapabilities {
    /** CharPosShape 파싱 지원 */
    charPosShape: boolean;

    /** 모든 테이블 파싱 지원 */
    fullTableParsing: boolean;

    /** 중첩 테이블 지원 */
    nestedTables: boolean;

    /** 하이퍼링크 파싱 지원 */
    hyperlinks: boolean;

    /** 머리글/바닥글 지원 */
    headerFooter: boolean;

    /** 각주/미주 지원 */
    footnoteEndnote: boolean;

    /** 이미지 파싱 지원 */
    images: boolean;

    /** 수식 파싱 지원 */
    equations: boolean;
}

// 기본 어댑터 capabilities (hwplib-js 한계 반영)
export const HWPLIB_CAPABILITIES: ParserCapabilities = {
    charPosShape: false,
    fullTableParsing: false,
    nestedTables: false,
    hyperlinks: false,
    headerFooter: true,
    footnoteEndnote: false,
    images: true,
    equations: false
};

// 향상된 파서 capabilities (목표)
export const ENHANCED_CAPABILITIES: ParserCapabilities = {
    charPosShape: true,
    fullTableParsing: true,
    nestedTables: true,
    hyperlinks: true,
    headerFooter: true,
    footnoteEndnote: true,
    images: true,
    equations: true
};
