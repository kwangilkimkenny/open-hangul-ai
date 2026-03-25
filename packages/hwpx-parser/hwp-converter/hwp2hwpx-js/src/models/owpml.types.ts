/**
 * HWPX OWPML Type Definitions
 * Based on Hancom Office OWPML Specification
 */

export interface OwpmlHeader {
    version: string;
    secCnt: number;
    beginNum: BeginNum;
    refList: RefList;
    compatibleDocument: CompatibleDocument;
    docOption: DocOption;
    trackchageConfig: TrackChangeConfig;
}

export interface BeginNum {
    page: number;
    footnote: number;
    endnote: number;
    pic: number;
    tbl: number;
    equation: number;
}

export interface RefList {
    fontfaces: FontFaces;
    borderFills: BorderFills;
    charProperties: CharProperties;
    tabProperties: TabProperties;
    numberings: Numberings;
    paraProperties: ParaProperties;
    styles: Styles;
}

// --- FontFaces ---
export interface FontFaces {
    itemCnt: number;
    fontface: FontFace[];
}

export interface FontFace {
    lang: string;
    fontCnt: number;
    font: Font[];
}

export interface Font {
    id: string; // or number? formatted as string in XML
    face: string;
    type: string;
    isEmbedded: string; // "0" or "1"
    typeInfo?: TypeInfo;
}

export interface TypeInfo {
    familyType: string;
    weight: string;
    proportion: string;
    contrast: string;
    strokeVariation: string;
    armStyle: string;
    letterform: string;
    midline: string;
    xHeight: string;
}

// --- BorderFills ---
export interface BorderFills {
    itemCnt: number;
    borderFill: BorderFill[];
}

export interface BorderFill {
    id: string;
    threeD: string;
    shadow: string;
    centerLine: string;
    breakCellSeparateLine: string;
    slash: SlashType;
    backSlash: SlashType;
    leftBorder: BorderType;
    rightBorder: BorderType;
    topBorder: BorderType;
    bottomBorder: BorderType;
    diagonal: BorderType;
    fillBrush?: FillBrush;
}

export interface SlashType {
    type: string;
    Crooked: string; // Case sensitive in HWPX usually
    isCounter: string;
}

export interface BorderType {
    type: string;
    width: string;
    color: string;
}

export interface FillBrush {
    winBrush?: WinBrush;
    colorRef?: ColorRef;
}

export interface WinBrush {
    faceColor: string;
    hatchColor: string;
    alpha: string;
}

export interface ColorRef {
    type: string;
    value: string;
}

// --- CharProperties ---
export interface CharProperties {
    itemCnt: number;
    charPr: CharPr[];
}

export interface CharPr {
    id: string;
    height: string;
    textColor: string;
    shadeColor: string;
    useFontSpace: string;
    useKerning: string;
    symMark: string;
    borderFillIDRef: string;
    fontRef: FontRef;
    ratio: Ratio;
    spacing: Spacing;
    relSz: RelSz;
    offset: Offset;
    bold?: boolean;
    italic?: boolean;
    underline?: Underline;
    strikeout?: Strikeout;
    outline?: Outline;
    shadow?: Shadow;
}

export interface FontRef {
    hangul: string;
    latin: string;
    hanja: string;
    japanese: string;
    other: string;
    symbol: string;
    user: string;
}

export type Ratio = FontRef; // Same structure
export type Spacing = FontRef; // Same structure
export type RelSz = FontRef; // Same structure
export type Offset = FontRef; // Same structure

export interface Underline {
    type: string;
    shape: string;
    color: string;
}

export interface Strikeout {
    shape: string;
    color: string;
}

export interface Outline {
    type: string;
}

export interface Shadow {
    type: string;
    color: string;
    offsetX: string;
    offsetY: string;
}

// --- TabProperties ---
export interface TabProperties {
    itemCnt: number;
    tabPr: TabPr[];
}

export interface TabPr {
    id: string;
    autoTabLeft: string;
    autoTabRight: string;
    tabItem?: TabItem[];
}

export interface TabItem {
    pos: string;
    type: string;
    leader: string;
}

// --- ParaProperties ---
export interface ParaProperties {
    itemCnt: number;
    paraPr: ParaPr[];
}

export interface ParaPr {
    id: string;
    tabPrIDRef: string;
    condense: string;
    fontLineHeight: string;
    snapToGrid: string;
    suppressLineNumbers: string;
    checked: string;
    align: Align;
    heading: Heading;
    breakSetting: BreakSetting;
    autoSpacing: AutoSpacing;
    margin: Margin; // Inside switch/case usually
    lineSpacing: LineSpacing;
    border: ParaBorder;
}

export interface Align {
    horizontal: string;
    vertical: string;
}

export interface Heading {
    type: string;
    idRef: string;
    level: string;
}

export interface BreakSetting {
    breakLatinWord: string;
    breakNonLatinWord: string;
    widowOrphan: string;
    keepWithNext: string;
    keepLines: string;
    pageBreakBefore: string;
    lineWrap: string;
}

export interface AutoSpacing {
    eAsianEng: string;
    eAsianNum: string;
}

export interface Margin {
    intent: string;
    left: string;
    right: string;
    prev: string;
    next: string;
}

export interface LineSpacing {
    type: string;
    value: string;
    unit: string;
}

export interface ParaBorder {
    borderFillIDRef: string;
    offsetLeft: string;
    offsetRight: string;
    offsetTop: string;
    offsetBottom: string;
    connect: string;
    ignoreMargin: string;
}

// --- Numberings ---
export interface Numberings {
    itemCnt: number;
    numbering?: NumberingItem[];
}

export interface NumberingItem {
    id: string;
    start: string;
    paraHead: ParaHead[];
}

export interface ParaHead {
    /** 시작 번호 */
    start: string;
    /** 레벨 (0-9) */
    level: string;
    /** 정렬 방식 (LEFT, CENTER, RIGHT) */
    align: string;
    /** 너비 자동 조절 */
    useInstWidth: string;
    /** 자동 들여쓰기 */
    autoIndent: string;
    /** 텍스트 오프셋 */
    textOffset: string;
    /** 번호 형식 (DIGIT, CIRCLED_DIGIT, LATIN_UPPER, LATIN_LOWER, ROMAN_UPPER, ROMAN_LOWER, HANGUL, HANGUL_JAMO, CIRCLED_HANGUL, HANJA) */
    numFormat: string;
    /** 글자 모양 참조 ID */
    charPrIDRef: string;
    /** 번호 텍스트 (예: "^1.", "^2)") */
    paraHeadText?: ParaHeadText;
}

export interface ParaHeadText {
    text: string;
}

// --- Bullets ---
export interface Bullets {
    itemCnt: number;
    bullet?: BulletItem[];
}

export interface BulletItem {
    id: string;
    charPrIDRef: string;
    bulletChar?: BulletChar;
    bulletImage?: BulletImage;
}

export interface BulletChar {
    text: string;
}

export interface BulletImage {
    binItemIDRef: string;
}

// --- Styles ---
export interface Styles {
    itemCnt: number;
    style: StyleItem[];
}

export interface StyleItem {
    id: string;
    type: string;
    name: string;
    engName: string;
    paraPrIDRef: string;
    charPrIDRef: string;
    nextStyleIDRef: string;
    langID: string;
    lockForm: string;
}

// --- Others ---
export interface LayoutCompatibility {
    applyFontWeightToBold?: string;
    useInnerUnderline?: string;
    fixedUnderlineWidth?: string;
    doNotApplyStrikeout?: string;
    useLowercaseStrikeout?: string;
    [key: string]: unknown;
}

export interface CompatibleDocument {
    targetProgram: string;
    layoutCompatibility: LayoutCompatibility;
}

export interface LinkInfo {
    path?: string;
    bookmark?: string;
    webLink?: string;
    [key: string]: unknown;
}

export interface DocOption {
    linkinfo: LinkInfo;
}

export interface TrackChangeConfig {
    flags: string;
}
