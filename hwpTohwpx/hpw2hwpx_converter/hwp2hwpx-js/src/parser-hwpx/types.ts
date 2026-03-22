/**
 * HWPX 파싱 결과 타입 정의
 *
 * @module ParserHwpx
 */

/**
 * 파싱된 HWPX 문서
 */
export interface HwpxDocument {
    /** 헤더 정보 (fonts, styles, etc.) */
    header: HwpxHeader;
    /** 섹션 목록 */
    sections: HwpxSection[];
    /** BinData (이미지 등) */
    binData: HwpxBinData[];
}

/**
 * 탭 속성
 */
export interface HwpxTabProperty {
    /** ID */
    id: number;
    /** 자동 왼쪽 탭 */
    autoTabLeft?: boolean;
    /** 자동 오른쪽 탭 */
    autoTabRight?: boolean;
}

/**
 * 문단 번호
 */
export interface HwpxNumbering {
    /** ID */
    id: number;
    /** 레벨별 속성 */
    levels?: Array<{
        /** 번호 형식 */
        format?: string;
        /** 시작 번호 */
        start?: number;
    }>;
}

/**
 * 글머리표
 */
export interface HwpxBullet {
    /** ID */
    id: number;
    /** 글머리표 문자 */
    char?: string;
}

/**
 * HWPX 헤더 정보 (header.xml)
 */
export interface HwpxHeader {
    /** 버전 */
    version: string;
    /** 섹션 개수 */
    secCnt: number;
    /** 폰트 정의 */
    fontfaces: HwpxFontface[];
    /** 글자 모양 */
    charShapes: HwpxCharShape[];
    /** 문단 모양 */
    paraShapes: HwpxParaShape[];
    /** 스타일 */
    styles: HwpxStyle[];
    /** 테두리/채우기 */
    borderFills: HwpxBorderFill[];
    /** 글머리표 */
    bullets: HwpxBullet[];
    /** 문단 번호 */
    numberings: HwpxNumbering[];
    /** 탭 속성 */
    tabProperties: HwpxTabProperty[];
}

/**
 * 폰트 정의 (언어별)
 */
export interface HwpxFontface {
    /** 언어 코드 */
    lang: string;
    /** 폰트 목록 */
    fonts: HwpxFont[];
}

/**
 * 개별 폰트 정보
 */
export interface HwpxFont {
    /** 폰트 ID */
    id: number;
    /** 폰트 이름 */
    face: string;
    /** 폰트 타입 (TTF, HFT) */
    type: string;
    /** 임베디드 여부 */
    isEmbedded: boolean;
}

/**
 * 글자 모양
 */
export interface HwpxCharShape {
    /** ID */
    id: number;
    /** 높이 (HWPUNIT, 1000 = 10pt) */
    height: number;
    /** 텍스트 색상 */
    textColor: string;
    /** 음영 색상 */
    shadeColor: string;
    /** 글꼴 공백 사용 */
    useFontSpace: boolean;
    /** 커닝 사용 */
    useKerning: boolean;
    /** 강조점 */
    symMark: string;
    /** 테두리/채우기 참조 */
    borderFillIDRef: number;
    /** 폰트 참조 (언어별) */
    fontRefs: number[];
    /** 장평 (언어별) */
    ratios: number[];
    /** 자간 (언어별) */
    spacings: number[];
    /** 상대 크기 (언어별) */
    relSizes: number[];
    /** 오프셋 (언어별) */
    offsets: number[];
}

/**
 * 문단 모양
 */
export interface HwpxParaShape {
    /** ID */
    id: number;
    /** 정렬 */
    align: string;
    /** 수직 정렬 */
    vertAlign: string;
    /** 개요 타입 */
    headingType: string;
    /** 개요 레벨 */
    headingLevel: number;
    /** 개요 ID 참조 */
    headingIdRef: number;
    /** 왼쪽 여백 */
    marginLeft: number;
    /** 오른쪽 여백 */
    marginRight: number;
    /** 들여쓰기 */
    indent: number;
    /** 문단 위 간격 */
    marginPrev: number;
    /** 문단 아래 간격 */
    marginNext: number;
    /** 줄 간격 타입 */
    lineSpacingType: string;
    /** 줄 간격 값 */
    lineSpacingValue: number;
    /** 탭 정의 참조 */
    tabDefIDRef: number;
    /** 테두리/채우기 참조 */
    borderFillIDRef: number;
}

/**
 * 스타일
 */
export interface HwpxStyle {
    /** ID */
    id: number;
    /** 타입 (PARA, CHAR) */
    type: string;
    /** 이름 */
    name: string;
    /** 영문 이름 */
    engName: string;
    /** 문단 모양 참조 */
    paraPrIDRef: number;
    /** 글자 모양 참조 */
    charPrIDRef: number;
    /** 다음 스타일 참조 */
    nextStyleIDRef: number;
    /** 언어 ID */
    langId: number;
    /** 잠금 */
    lockForm: boolean;
}

/**
 * 테두리/채우기
 */
export interface HwpxBorderFill {
    /** ID */
    id: number;
    /** 3D 효과 */
    threeD: boolean;
    /** 그림자 */
    shadow: boolean;
    /** 대각선 */
    slash: string;
    /** 역대각선 */
    backSlash: string;
    /** 각 면의 테두리 */
    borders: {
        left: { type: string; width: string; color: string };
        right: { type: string; width: string; color: string };
        top: { type: string; width: string; color: string };
        bottom: { type: string; width: string; color: string };
    };
    /** 채우기 타입 */
    fillType: string;
    /** 채우기 색상 */
    fillColor?: string;
}

/**
 * 섹션
 */
export interface HwpxSection {
    /** 섹션 인덱스 */
    index: number;
    /** 문단 목록 */
    paragraphs: HwpxParagraph[];
}

/**
 * 문단
 */
export interface HwpxParagraph {
    /** 문단 ID */
    id: string;
    /** 문단 모양 참조 */
    paraPrIDRef: number;
    /** 스타일 참조 */
    styleIDRef: number;
    /** 페이지 나누기 */
    pageBreak: boolean;
    /** 단 나누기 */
    columnBreak: boolean;
    /** Run 목록 */
    runs: HwpxRun[];
}

/**
 * Run (텍스트 + 속성)
 */
export interface HwpxRun {
    /** 글자 모양 참조 */
    charPrIDRef: number;
    /** 텍스트 */
    text: string;
    /** 컨트롤 (표, 그림 등) */
    controls: {
        type: string;
        element: Element;
    }[];
}

/**
 * BinData (이미지 등)
 */
export interface HwpxBinData {
    /** ID */
    id: number;
    /** 파일명 */
    filename: string;
    /** 확장자 */
    extension: string;
    /** 바이너리 데이터 */
    data: Uint8Array;
}
