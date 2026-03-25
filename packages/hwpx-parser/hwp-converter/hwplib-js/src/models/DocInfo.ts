/**
 * HWP DocInfo 구조 정의
 * DocInfo는 문서의 메타데이터와 서식 정보를 포함
 */

// HWP 레코드 태그 ID
export const enum HWPTag {
  // DocInfo 레코드들
  HWPTAG_DOCUMENT_PROPERTIES = 16,
  HWPTAG_ID_MAPPINGS = 17,
  HWPTAG_BIN_DATA = 10,

  // HWP 5.0 공식 태그 ID (HWPTAG_BEGIN = 0x010 = 16)
  // 공식 문서: https://www.hancom.com/etc/hwpDownload.do
  // HWPTAG_BEGIN + offset
  HWPTAG_FACE_NAME_OLD = 19,      // BEGIN+3: 글꼴 이름
  HWPTAG_BORDER_FILL_OLD = 20,    // BEGIN+4: 테두리/배경
  HWPTAG_CHAR_SHAPE_OLD = 21,     // BEGIN+5: 문자 서식
  HWPTAG_TAB_DEF_OLD = 22,        // BEGIN+6: 탭 정의
  HWPTAG_NUMBERING_OLD = 23,      // BEGIN+7: 번호 매기기
  HWPTAG_BULLET_OLD = 24,         // BEGIN+8: 글머리 기호
  HWPTAG_PARA_SHAPE_OLD = 25,     // BEGIN+9: 문단 서식
  HWPTAG_STYLE_OLD = 26,          // BEGIN+10: 스타일

  // HWP 5.0+ 버전 TagID
  HWPTAG_CHAR_SHAPE = 66,         // 문자 서식
  HWPTAG_PARA_SHAPE = 67,         // 문단 서식
  HWPTAG_TAB_DEF = 68,            // 탭 정의
  HWPTAG_NUMBERING = 69,          // 번호 매기기
  HWPTAG_BULLET = 70,             // 글머리 기호
  HWPTAG_STYLE = 72,              // 스타일
  HWPTAG_FACE_NAME = 77,          // 글꼴 이름
  HWPTAG_BORDER_FILL = 78,        // 테두리/배경
  HWPTAG_DOC_DATA = 80,           // 문서 데이터
  HWPTAG_DISTRIBUTE_DOC_DATA = 81, // 배포용 문서 데이터
  HWPTAG_COMPATIBLE_DOCUMENT = 122, // 호환 문서
  HWPTAG_LAYOUT_COMPATIBILITY = 123 // 레이아웃 호환성
}

/**
 * 글꼴 이름 (HWPTAG_FACE_NAME = 77)
 */
export interface FaceName {
  id: number
  name: string                    // 글꼴 이름 (예: "맑은 고딕")
  altName?: string                // 대체 글꼴 이름
  panose?: number[]               // PANOSE 분류 (10 bytes)
  fontType: number                // 0=TTF, 1=HFT, 2=symbol
  isEmbedded: boolean             // 포함 여부
}

/**
 * 테두리/배경 (HWPTAG_BORDER_FILL = 78)
 */
export interface BorderFill {
  id: number
  flags: number                   // 3D, 그림자 등
  leftBorder: Border
  rightBorder: Border
  topBorder: Border
  bottomBorder: Border
  diagonal: Border
  fillBrush?: FillBrush
}

export interface Border {
  type: number                    // 0=없음, 1=실선, 2=점선, ...
  width: number                   // 선 굵기 (HWPUNIT)
  color: number                   // RGB 색상
}

export interface FillBrush {
  type: number                    // 0=색, 1=그라데이션, 2=이미지
  faceColor: number               // 전경색
  hatchColor?: number             // 해치색
  alpha?: number                  // 투명도
}

/**
 * 문자 서식 (HWPTAG_CHAR_SHAPE = 66)
 * OWPML: hh:charPr
 */
export interface CharShape {
  id: number

  // 글꼴 ID (7개 언어별)
  fontIDs: {
    hangul: number                // 한글
    latin: number                 // 영문
    hanja: number                 // 한자
    japanese: number              // 일본어
    other: number                 // 기타
    symbol: number                // 기호
    user: number                  // 사용자 정의
  }

  // 글자 크기 (7개 언어별)
  fontSizes: {
    hangul: number                // pt * 100 (예: 1000 = 10pt)
    latin: number
    hanja: number
    japanese: number
    other: number
    symbol: number
    user: number
  }

  // 글자 속성 (비트 플래그)
  attribute: number               // Bold, Italic, Underline, Strikeout, ...

  // 색상
  textColor: number               // RGB
  shadeColor: number              // 음영 색상

  // 장평/자간 (7개 언어별)
  ratios: {                       // 장평 (%) 100=기본
    hangul: number
    latin: number
    hanja: number
    japanese: number
    other: number
    symbol: number
    user: number
  }

  spacing: {                      // 자간 (HWPUNIT)
    hangul: number
    latin: number
    hanja: number
    japanese: number
    other: number
    symbol: number
    user: number
  }

  // 상대 크기 (7개 언어별)
  relSizes: {                     // 상대 크기 (%) 100=기본
    hangul: number
    latin: number
    hanja: number
    japanese: number
    other: number
    symbol: number
    user: number
  }

  // 위치 (7개 언어별)
  offsets: {                      // 위/아래 첨자 위치
    hangul: number
    latin: number
    hanja: number
    japanese: number
    other: number
    symbol: number
    user: number
  }

  // 기타
  useFontSpace: boolean           // 글꼴 간격 사용
  useKerning: boolean             // 커닝 사용
  symMark: number                 // 기호 마크 (0=없음)
  borderFillID: number            // 테두리/배경 ID

  // 밑줄/취소선
  underlineType: number           // 0=없음, 1=실선, 2=점선, ...
  underlineShape: number          // 모양
  underlineColor: number          // 색상
  strikeoutType: number           // 취소선 타입
  strikeoutColor: number          // 취소선 색상

  // 외곽선/그림자
  outlineType: number             // 외곽선 타입
  shadowType: number              // 그림자 타입
  shadowColor: number             // 그림자 색상
  shadowOffsetX: number           // 그림자 X 오프셋
  shadowOffsetY: number           // 그림자 Y 오프셋
}

/**
 * 문단 서식 (HWPTAG_PARA_SHAPE = 67)
 * OWPML: hh:paraPr
 */
export interface ParaShape {
  id: number

  // 정렬
  align: number                   // 0=왼쪽, 1=가운데, 2=오른쪽, 3=양쪽, 4=배분, 5=나눔

  // 여백 (HWPUNIT)
  indent: number                  // 첫 줄 들여쓰기 (음수=내어쓰기)
  leftMargin: number              // 왼쪽 여백
  rightMargin: number             // 오른쪽 여백
  prevSpacing: number             // 문단 위 간격
  nextSpacing: number             // 문단 아래 간격

  // 줄 간격
  lineSpacing: number             // 줄 간격 값
  lineSpacingType: number         // 0=비율(%), 1=고정값, 2=최소값

  // 탭
  tabDefID: number                // 탭 정의 ID

  // 번호 매기기
  numberingID: number             // 번호 매기기 ID (0=없음)
  bulletID: number                // 글머리 기호 ID (0=없음)

  // 테두리/배경
  borderFillID: number            // 테두리/배경 ID
  borderLeft: number              // 테두리 왼쪽 오프셋
  borderRight: number             // 테두리 오른쪽 오프셋
  borderTop: number               // 테두리 위 오프셋
  borderBottom: number            // 테두리 아래 오프셋

  // 기타 속성
  condense: number                // 장평 (%)
  fontLineHeight: boolean         // 글꼴에 어울리는 줄 높이
  snapToGrid: boolean             // 격자에 맞춤
  suppressLineNumbers: boolean    // 줄 번호 표시 안 함

  // 줄 나눔 설정
  breakLatinWord: number          // 영문 단어 줄바꿈 (0=유지, 1=끊음)
  breakNonLatinWord: number       // 한글 단어 줄바꿈
  widowOrphan: boolean            // 외톨이줄 보호
  keepWithNext: boolean           // 다음 문단과 함께
  keepLines: boolean              // 문단 보호
  pageBreakBefore: boolean        // 문단 앞에서 페이지 나눔
  lineWrap: number                // 줄 나눔 (0=끊음, 1=유지)

  // 자동 간격
  autoSpaceEAsianEng: boolean     // 한글-영문 자동 간격
  autoSpaceEAsianNum: boolean     // 한글-숫자 자동 간격
}

/**
 * 스타일 (HWPTAG_STYLE = 72)
 * OWPML: hh:style
 */
export interface Style {
  id: number
  name: string                    // 스타일 이름 (예: "바탕글")
  engName: string                 // 영문 이름 (예: "Normal")
  type: number                    // 0=문단, 1=문자
  nextStyleID: number             // 다음 스타일 ID
  langID: number                  // 언어 ID (1042=한국어)
  paraPrID: number                // 문단 서식 ID
  charPrID: number                // 문자 서식 ID
  lockForm: boolean               // 서식 잠금
}

/**
 * 탭 정의 (HWPTAG_TAB_DEF = 68)
 */
export interface TabDef {
  id: number
  autoTabLeft: boolean            // 왼쪽 자동 탭
  autoTabRight: boolean           // 오른쪽 자동 탭
  tabs: Tab[]                     // 탭 목록
}

export interface Tab {
  position: number                // 탭 위치 (HWPUNIT)
  type: number                    // 0=왼쪽, 1=중앙, 2=오른쪽, 3=소수점
  fillType: number                // 채우기 (0=없음, 1=점, ...)
}

/**
 * 번호 매기기 (HWPTAG_NUMBERING = 69)
 */
export interface Numbering {
  id: number
  start: number                   // 시작 번호
  levels: NumberingLevel[]        // 레벨별 설정 (최대 10개)
}

export interface NumberingLevel {
  level: number                   // 레벨 (0-9)
  start: number                   // 시작 번호
  align: number                   // 정렬 (0=왼쪽, 1=중앙, 2=오른쪽)
  numFormat: number               // 번호 형식 (0=숫자, 1=한글, ...)
  formatString: string            // 형식 문자열 (예: "^1.")
  textOffset: number              // 텍스트 오프셋
  charPrID: number                // 문자 서식 ID
}

/**
 * 이진 데이터 (HWPTAG_BIN_DATA = 18)
 */
export interface BinData {
  id: number
  type: number                    // 0=LINK, 1=EMBEDDING, 2=STORAGE
  format: string                  // 압축 포맷 ("JPEG", "PNG", ...)
  compression?: number            // 압축 방식 (0=None, 1=Deflate)
  extension?: string              // 파일 확장자 (예: "jpg")
  data: Uint8Array                // 실제 데이터
}

/**
 * DocInfo 전체 구조
 */
export interface DocInfo {
  faceNames: Map<number, FaceName>
  borderFills: Map<number, BorderFill>
  charShapes: Map<number, CharShape>
  paraShapes: Map<number, ParaShape>
  styles: Map<number, Style>
  tabDefs: Map<number, TabDef>
  numberings: Map<number, Numbering>
  binDataList: Map<number, BinData>
}

/**
 * CharShape 속성 비트 플래그
 */
export const enum CharShapeAttribute {
  BOLD = 1 << 0,                  // 굵게
  ITALIC = 1 << 1,                // 기울임
  UNDERLINE = 1 << 2,             // 밑줄
  STRIKEOUT = 1 << 3,             // 취소선
  OUTLINE = 1 << 4,               // 외곽선
  SHADOW = 1 << 5,                // 그림자
  EMBOSS = 1 << 6,                // 양각
  ENGRAVE = 1 << 7,               // 음각
  SUPERSCRIPT = 1 << 8,           // 위 첨자
  SUBSCRIPT = 1 << 9,             // 아래 첨자
  STRIKEOUT_CENTER = 1 << 10,     // 중앙 취소선
}

