/**
 * HWP Section/Paragraph Type Definitions for hwp2hwpx-js
 * These provide stricter typing for the XML generator without modifying hwplib-js
 */

// --- Section ---
export interface HWPSection {
    index: number;
    paragraphs: HWPParagraph[];
    pageDef?: PageDef;
    headerFooters?: HeaderFooter[];
    columnDefs?: ColumnDef[];
    pageBorderFillID?: number;
    masterPages?: MasterPage[];
}

// --- Master Page (바탕쪽) ---
export type MasterPageType = 'BOTH' | 'EVEN' | 'ODD';

export interface MasterPage {
    type: MasterPageType;
    paragraphs: HWPParagraph[];
    tables?: HWPTable[];
    pictures?: HWPPicture[];
    borderFillID?: number;
}

// --- Page Definition ---
export interface PageDef {
    width: number;
    height: number;
    property: number; // bit 0: landscape
    landscape: boolean; // true = WIDELY (가로), false = NARROWLY (세로)
    leftMargin: number;
    rightMargin: number;
    topMargin: number;
    bottomMargin: number;
    headerMargin: number;
    footerMargin: number;
    gutterMargin: number;
    paperSize?: string;
    // Extended properties for complete page settings
    gutterType?: 'LEFT_ONLY' | 'LEFT_RIGHT' | 'TOP_BOTTOM'; // 제본 여백 위치
    textDirection?: 'HORIZONTAL' | 'VERTICAL'; // 텍스트 방향
    lineGrid?: number; // 줄 격자
    charGrid?: number; // 글자 격자
    tabStop?: number; // 기본 탭 간격 (HWPUNIT)
    // Page number settings
    pageStartNumber?: number; // 시작 페이지 번호
    pageStartsOn?: 'BOTH' | 'EVEN' | 'ODD'; // 쪽 시작 위치
}

// --- Column Definition ---
export interface ColumnDef {
    columnCount: number;
    sameWidth: boolean;
    gap: number;
}

// --- Header/Footer ---
export interface HeaderFooter {
    type: 'HEADER' | 'FOOTER';
    applyPage: number; // 0=Both, 1=Even, 2=Odd
    paragraphs: HWPParagraph[];
    tables?: HWPTable[];
    pictures?: HWPPicture[];
}

// --- Paragraph ---
export interface HWPParagraph {
    text?: string;
    paraShapeID?: number;
    styleID?: number;
    charShapeID?: number;
    pageBreak?: boolean;
    columnBreak?: boolean;
    runs?: HWPRun[];
    controls?: HWPControl[];
}

// --- Run (Text Run) ---
export interface HWPRun {
    text: string;
    charShapeID?: number;
}

// --- Control Types ---
export type ControlType =
    | 'TABLE'
    | 'PICTURE'
    | 'SHAPE'
    | 'TEXTBOX'
    | 'FOOTNOTE'
    | 'ENDNOTE'
    | 'EQUATION'
    | 'CHART'
    | 'FIELD_BEGIN'
    | 'FIELD_END'
    | 'OLE'
    | 'MEDIA'
    | 'FORM'
    | 'MEMO';

// --- Control (Abstract Base) ---
// obj는 hwplib-js 타입과의 호환성을 위해 unknown 사용
// 실제 타입은 control.type에 따라 결정됨
export interface HWPControl {
    type: ControlType;
    obj?: unknown;
}

// --- TextBox ---
export interface HWPTextBox {
    paragraphs: HWPParagraph[];
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    borderFillID?: number;
}

// --- Table ---
export interface HWPTable {
    width: number;
    height: number;
    rows: HWPTableRow[];
    borderFillID?: number;
}

export interface HWPTableRow {
    cells: HWPTableCell[];
}

export interface HWPTableCell {
    paragraphs: HWPParagraph[];
    colIndex?: number;
    rowIndex?: number;
    colSpan?: number;
    rowSpan?: number;
    width?: number;
    height?: number;
    borderFillID?: number;
    name?: string;
    header?: boolean;
}

// --- Picture ---
export interface HWPPicture {
    binDataIDRef: number;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    rotation?: number;
    cropLeft?: number;
    cropRight?: number;
    cropTop?: number;
    cropBottom?: number;
    // Effect attributes (HWPML spec)
    bright?: number;      // -100 ~ 100
    contrast?: number;    // -100 ~ 100
    effect?: number;      // 0=RealPic, 1=GrayScale, 2=BlackWhite
    alpha?: number;       // 0~255
    // Position attributes
    textWrap?: number;    // 0=Square, 1=Tight, 2=Through, 3=TopAndBottom, 4=BehindText, 5=InFrontOfText
    textFlow?: number;    // 0=BothSides, 1=LeftOnly, 2=RightOnly, 3=LargestOnly
    vertRelTo?: number;   // 0=Paper, 1=Page, 2=Para
    horzRelTo?: number;   // 0=Paper, 1=Page, 2=Column, 3=Para
    vertAlign?: number;   // 0=Top, 1=Center, 2=Bottom, 3=Inside, 4=Outside
    horzAlign?: number;   // 0=Left, 1=Center, 2=Right, 3=Inside, 4=Outside
    vertOffset?: number;
    horzOffset?: number;
    treatAsChar?: boolean;
    // Flip
    horzFlip?: boolean;
    vertFlip?: boolean;
    // Margins
    marginLeft?: number;
    marginRight?: number;
    marginTop?: number;
    marginBottom?: number;
    // Other
    zOrder?: number;
    lock?: boolean;
    href?: string;
    groupLevel?: number;
    // Original image dimensions (from SHAPE_COMPONENT_PICTURE)
    imgWidth?: number;   // 원본 이미지 너비 (HWPUNIT)
    imgHeight?: number;  // 원본 이미지 높이 (HWPUNIT)
}

// --- Shape ---
export interface HWPShape {
    shapeType: 'LINE' | 'RECTANGLE' | 'ELLIPSE' | 'POLYGON' | 'CURVE';
    // Additional shape-specific properties...
}

// --- OLE Object ---
export type OLEType = 'EMBED' | 'LINK' | 'STATIC';

export interface HWPOLEObject {
    type: OLEType;
    binDataIDRef?: number;        // 미리보기 이미지 BinData ID
    objDataBIDRef?: number;       // OLE 데이터 BinData ID
    width: number;                // 너비 (HWPUNIT)
    height: number;               // 높이 (HWPUNIT)
    x?: number;                   // X 위치
    y?: number;                   // Y 위치
    zOrder?: number;              // Z 순서
    drawAspect?: 'CONTENT' | 'ICON';  // 표시 방식
    objectId?: string;            // OLE Object ID (UUID)
    programId?: string;           // 프로그램 ID (e.g., "Excel.Sheet.12")
    isPreviewLocked?: boolean;    // 미리보기 잠금
    hasMoniker?: boolean;         // Moniker 존재 여부
    // Position attributes
    vertRelTo?: number;
    horzRelTo?: number;
    vertAlign?: number;
    horzAlign?: number;
    vertOffset?: number;
    horzOffset?: number;
    treatAsChar?: boolean;
}

// --- Media Object ---
export type MediaType = 'VIDEO' | 'AUDIO';

export interface HWPMedia {
    mediaType: MediaType;
    format: string;               // 파일 포맷 (MP4, AVI, MP3, WAV 등)
    binDataIDRef: number;         // 미디어 데이터 BinData ID
    previewBinDataIDRef?: number; // 미리보기 이미지 BinData ID
    width: number;                // 너비 (HWPUNIT)
    height: number;               // 높이 (HWPUNIT)
    x?: number;                   // X 위치
    y?: number;                   // Y 위치
    zOrder?: number;              // Z 순서
    autoPlay?: boolean;           // 자동 재생
    loop?: boolean;               // 반복 재생
    showControls?: boolean;       // 컨트롤 표시
    muted?: boolean;              // 음소거
    volume?: number;              // 볼륨 (0-100)
    startTime?: number;           // 시작 시간 (ms)
    endTime?: number;             // 종료 시간 (ms)
}

// --- Form Control ---
export type FormControlType =
    | 'EDIT'        // 입력 필드
    | 'CHECKBOX'    // 체크박스
    | 'RADIO'       // 라디오 버튼
    | 'COMBOBOX'    // 콤보박스 (드롭다운)
    | 'LISTBOX'     // 리스트박스
    | 'BUTTON'      // 버튼
    | 'DATEPICKER'  // 날짜 선택기
    | 'NUMERICUD';  // 숫자 업다운

export interface HWPFormControl {
    formType: FormControlType;
    name: string;                 // 컨트롤 이름
    width: number;                // 너비 (HWPUNIT)
    height: number;               // 높이 (HWPUNIT)
    enabled?: boolean;            // 활성화 여부
    readonly?: boolean;           // 읽기 전용
    tabOrder?: number;            // 탭 순서
    tooltip?: string;             // 도움말 텍스트
    charPrIDRef?: number;         // 문자 서식 ID
    // Type-specific fields
    value?: string;               // 현재 값 (EDIT, COMBOBOX)
    checked?: boolean;            // 체크 상태 (CHECKBOX, RADIO)
    items?: string[];             // 선택 항목들 (COMBOBOX, LISTBOX)
    selectedIndex?: number;       // 선택된 인덱스
    selectedIndices?: number[];   // 다중 선택 인덱스 (LISTBOX)
    groupName?: string;           // 그룹 이름 (RADIO)
    placeholder?: string;         // 플레이스홀더 (EDIT)
    maxLength?: number;           // 최대 길이 (EDIT)
    multiLine?: boolean;          // 여러 줄 (EDIT)
    password?: boolean;           // 비밀번호 모드 (EDIT)
    multiSelect?: boolean;        // 다중 선택 (LISTBOX)
    editable?: boolean;           // 편집 가능 (COMBOBOX)
    caption?: string;             // 버튼 텍스트 (BUTTON)
    action?: string;              // 클릭 액션 (BUTTON)
}
