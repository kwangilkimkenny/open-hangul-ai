/**
 * HeaderFooter (머리말/꼬리말) 및 Footnote/Endnote (각주/미주) 모델
 */

/**
 * 머리말 (Header)
 */
export interface Header {
  id: number;
  type: HeaderFooterType;
  
  // 적용 페이지
  applyTo: PageApplication;
  
  // 내용
  paragraphs: HeaderParagraph[];
  
  // 여백
  topMargin: number;      // HWPUNIT
  bottomMargin: number;   // HWPUNIT
  leftMargin: number;     // HWPUNIT
  rightMargin: number;    // HWPUNIT
  
  // 테두리
  borderTop: boolean;
  borderBottom: boolean;
  
  // 기타
  height: number;         // HWPUNIT
  textWrap: boolean;      // 본문 겹침 허용
}

/**
 * 꼬리말 (Footer)
 */
export interface Footer {
  id: number;
  type: HeaderFooterType;
  
  // 적용 페이지
  applyTo: PageApplication;
  
  // 내용
  paragraphs: HeaderParagraph[];
  
  // 여백
  topMargin: number;
  bottomMargin: number;
  leftMargin: number;
  rightMargin: number;
  
  // 테두리
  borderTop: boolean;
  borderBottom: boolean;
  
  // 기타
  height: number;
  textWrap: boolean;
}

/**
 * 각주 (Footnote)
 */
export interface Footnote {
  id: number;
  index: number;          // 각주 번호
  
  // 참조 위치
  referencePageNo: number;
  referenceParagraphNo: number;
  referenceCharPos: number;
  
  // 내용
  paragraphs: FootnoteParagraph[];
  
  // 스타일
  numberingType: NumberingType;
  numberingStart: number;
  
  // 구분선
  separatorLine: boolean;
  separatorLineType: LineType;
}

/**
 * 미주 (Endnote)
 */
export interface Endnote {
  id: number;
  index: number;          // 미주 번호
  
  // 참조 위치
  referencePageNo: number;
  referenceParagraphNo: number;
  referenceCharPos: number;
  
  // 내용
  paragraphs: FootnoteParagraph[];
  
  // 스타일
  numberingType: NumberingType;
  numberingStart: number;
  
  // 위치
  placement: EndnotePlacement;
}

/**
 * 머리말/꼬리말 문단
 */
export interface HeaderParagraph {
  text: string;
  charShapeID?: number;
  paraShapeID?: number;
  alignment?: TextAlignment;
  
  // 특수 필드 (페이지 번호 등)
  fields?: HeaderField[];
}

/**
 * 각주/미주 문단
 */
export interface FootnoteParagraph {
  text: string;
  charShapeID?: number;
  paraShapeID?: number;
}

/**
 * 머리말/꼬리말 특수 필드
 */
export interface HeaderField {
  type: FieldType;
  position: number;       // 텍스트 내 위치
  
  // 페이지 번호 형식
  pageNumberFormat?: string;  // "1", "i", "I", "a", "A"
}

/**
 * 머리말/꼬리말 타입
 */
export enum HeaderFooterType {
  BOTH_PAGE = 0,          // 양쪽 페이지
  ODD_PAGE = 1,           // 홀수 페이지
  EVEN_PAGE = 2,          // 짝수 페이지
  FIRST_PAGE = 3,         // 첫 페이지
}

/**
 * 페이지 적용
 */
export enum PageApplication {
  ALL = 0,                // 모든 페이지
  ODD_ONLY = 1,           // 홀수만
  EVEN_ONLY = 2,          // 짝수만
  FIRST_ONLY = 3,         // 첫 페이지만
  NOT_FIRST = 4,          // 첫 페이지 제외
}

/**
 * 번호 매기기 타입
 */
export enum NumberingType {
  NONE = 0,
  ARABIC = 1,             // 1, 2, 3, ...
  ROMAN_UPPER = 2,        // I, II, III, ...
  ROMAN_LOWER = 3,        // i, ii, iii, ...
  ALPHA_UPPER = 4,        // A, B, C, ...
  ALPHA_LOWER = 5,        // a, b, c, ...
  HANGUL_SYLLABLE = 6,    // 가, 나, 다, ...
  HANGUL_JAMO = 7,        // ㄱ, ㄴ, ㄷ, ...
  HANGUL_CIRCLED = 8,     // ①, ②, ③, ...
  IDEOGRAPH_TRADITIONAL = 9,  // 一, 二, 三, ...
  IDEOGRAPH_ZEGAL = 10,   // 甲, 乙, 丙, ...
}

/**
 * 미주 위치
 */
export enum EndnotePlacement {
  END_OF_SECTION = 0,     // 섹션 끝
  END_OF_DOCUMENT = 1,    // 문서 끝
}

/**
 * 선 타입
 */
export enum LineType {
  NONE = 0,
  SOLID = 1,
  DASH = 2,
  DOT = 3,
  DASH_DOT = 4,
}

/**
 * 필드 타입
 */
export enum FieldType {
  PAGE_NUMBER = 0,        // 페이지 번호
  TOTAL_PAGES = 1,        // 전체 페이지 수
  DATE = 2,               // 날짜
  TIME = 3,               // 시간
  TITLE = 4,              // 제목
  AUTHOR = 5,             // 작성자
  FILENAME = 6,           // 파일명
  PATH = 7,               // 경로
}

/**
 * 텍스트 정렬
 */
export enum TextAlignment {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
  JUSTIFY = 3,
  DISTRIBUTE = 4,
}

/**
 * HWP 머리말/꼬리말/각주/미주 레코드 TagID
 */
export enum HeaderFooterTagID {
  HWPTAG_PAGE_DEF = 72,
  HWPTAG_FOOTNOTE_SHAPE = 73,
  HWPTAG_PAGE_BORDER_FILL = 74,
  HWPTAG_HEADER = 90,
  HWPTAG_FOOTER = 91,
  HWPTAG_FOOTNOTE = 92,
  HWPTAG_ENDNOTE = 93,
  HWPTAG_AUTO_NUM_NEW_NUMBER = 94,
  HWPTAG_PAGE_NUM_CTRL = 95,
}

/**
 * 헬퍼 함수
 */

/**
 * 페이지 번호 형식 변환
 */
export function formatPageNumber(pageNo: number, format: NumberingType): string {
  switch (format) {
    case NumberingType.ARABIC:
      return pageNo.toString();
    case NumberingType.ROMAN_UPPER:
      return toRoman(pageNo).toUpperCase();
    case NumberingType.ROMAN_LOWER:
      return toRoman(pageNo).toLowerCase();
    case NumberingType.ALPHA_UPPER:
      return String.fromCharCode(64 + (pageNo % 26 || 26));
    case NumberingType.ALPHA_LOWER:
      return String.fromCharCode(96 + (pageNo % 26 || 26));
    default:
      return pageNo.toString();
  }
}

/**
 * 아라비아 숫자 → 로마 숫자
 */
function toRoman(num: number): string {
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  
  for (let i = 0; i < values.length && num > 0; i++) {
    while (num >= values[i]) {
      result += symbols[i];
      num -= values[i];
    }
  }
  
  return result;
}

