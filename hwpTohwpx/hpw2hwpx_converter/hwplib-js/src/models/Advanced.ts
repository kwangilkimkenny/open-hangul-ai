/**
 * Advanced Features (고급 기능) 모델
 * 하이퍼링크, 책갈피, 필드, 텍스트상자 등
 */

/**
 * 하이퍼링크 (Hyperlink)
 */
export interface Hyperlink {
  id: number;
  
  // 링크 정보
  url: string;
  displayText: string;
  
  // 위치
  paragraphNo: number;
  charPos: number;
  length: number;
  
  // 타입
  type: HyperlinkType;
  target: HyperlinkTarget;
  
  // 툴팁
  tooltip?: string;
  
  // 책갈피 참조 (내부 링크)
  bookmarkRef?: string;
}

/**
 * 책갈피 (Bookmark)
 */
export interface Bookmark {
  id: number;
  name: string;
  
  // 위치
  paragraphNo: number;
  charPos: number;
  
  // 범위 (선택 영역)
  endParagraphNo?: number;
  endCharPos?: number;
  
  // 표시
  visible: boolean;
}

/**
 * 필드 (Field) - 동적 콘텐츠
 */
export interface Field {
  id: number;
  type: FieldType;
  
  // 위치
  paragraphNo: number;
  charPos: number;
  
  // 필드별 데이터
  data: FieldData;
  
  // 업데이트
  autoUpdate: boolean;
  lastUpdated?: Date;
}

/**
 * 필드 데이터 (타입별)
 */
export type FieldData = 
  | PageNumberFieldData
  | DateFieldData
  | TimeFieldData
  | TitleFieldData
  | AuthorFieldData
  | FilenameFieldData
  | FormulaFieldData
  | MailMergeFieldData;

export interface PageNumberFieldData {
  type: 'PAGE_NUMBER';
  format: NumberingFormat;
  totalPages?: boolean;  // "1/10" 형식
}

export interface DateFieldData {
  type: 'DATE';
  format: string;  // "YYYY-MM-DD", "YYYY년 MM월 DD일" 등
}

export interface TimeFieldData {
  type: 'TIME';
  format: string;  // "HH:mm:ss", "오전/오후 HH:mm" 등
}

export interface TitleFieldData {
  type: 'TITLE';
  value: string;
}

export interface AuthorFieldData {
  type: 'AUTHOR';
  value: string;
}

export interface FilenameFieldData {
  type: 'FILENAME';
  includePath: boolean;
  includeExtension: boolean;
}

export interface FormulaFieldData {
  type: 'FORMULA';
  expression: string;
  result?: number | string;
}

export interface MailMergeFieldData {
  type: 'MAIL_MERGE';
  fieldName: string;
  value?: string;
}

/**
 * 텍스트상자 (Text Box)
 */
export interface TextBox {
  id: number;
  
  // 위치 및 크기 (HWPUNIT)
  x: number;
  y: number;
  width: number;
  height: number;
  
  // 회전
  rotation: number;  // degree
  
  // Z-order
  zOrder: number;
  
  // 내용
  paragraphs: TextBoxParagraph[];
  
  // 스타일
  backgroundColor: number;  // RGB
  borderColor: number;
  borderWidth: number;
  borderStyle: LineStyle;
  
  // 텍스트 정렬
  verticalAlign: VerticalAlignment;
  padding: TextBoxPadding;
  
  // 배치
  wrapType: WrapType;
  anchor: AnchorType;
  
  // 기타
  shadow: boolean;
  opacity: number;  // 0-100
}

/**
 * 텍스트상자 문단
 */
export interface TextBoxParagraph {
  text: string;
  charShapeID?: number;
  paraShapeID?: number;
  alignment?: TextAlignment;
}

/**
 * 텍스트상자 여백
 */
export interface TextBoxPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * 하이퍼링크 타입
 */
export enum HyperlinkType {
  URL = 0,              // 웹 URL
  EMAIL = 1,            // 이메일
  FILE = 2,             // 파일
  BOOKMARK = 3,         // 책갈피 (내부 링크)
  FOOTNOTE = 4,         // 각주 참조
  ENDNOTE = 5,          // 미주 참조
}

/**
 * 하이퍼링크 대상
 */
export enum HyperlinkTarget {
  SELF = 0,             // 같은 창
  BLANK = 1,            // 새 창
  PARENT = 2,           // 부모 프레임
  TOP = 3,              // 최상위 프레임
}

/**
 * 필드 타입
 */
export enum FieldType {
  PAGE_NUMBER = 0,
  TOTAL_PAGES = 1,
  DATE = 2,
  TIME = 3,
  TITLE = 4,
  AUTHOR = 5,
  FILENAME = 6,
  PATH = 7,
  FORMULA = 8,
  MAIL_MERGE = 9,
  SEQUENCE = 10,        // 일련번호
  REFERENCE = 11,       // 상호 참조
  EXPRESSION = 12,      // 수식
}

/**
 * 번호 매기기 형식
 */
export enum NumberingFormat {
  ARABIC = 0,           // 1, 2, 3
  ROMAN_UPPER = 1,      // I, II, III
  ROMAN_LOWER = 2,      // i, ii, iii
  ALPHA_UPPER = 3,      // A, B, C
  ALPHA_LOWER = 4,      // a, b, c
  HANGUL = 5,           // 가, 나, 다
  HANJA = 6,            // 甲, 乙, 丙
}

/**
 * 선 스타일
 */
export enum LineStyle {
  NONE = 0,
  SOLID = 1,
  DASH = 2,
  DOT = 3,
  DASH_DOT = 4,
}

/**
 * 수직 정렬
 */
export enum VerticalAlignment {
  TOP = 0,
  CENTER = 1,
  BOTTOM = 2,
  JUSTIFY = 3,
}

/**
 * 텍스트 정렬
 */
export enum TextAlignment {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
  JUSTIFY = 3,
}

/**
 * 배치 타입
 */
export enum WrapType {
  SQUARE = 0,           // 사각형
  TOP_AND_BOTTOM = 1,   // 위/아래
  TIGHT = 2,            // 좁게
  THROUGH = 3,          // 관통
  NONE = 4,             // 없음
}

/**
 * 앵커 타입
 */
export enum AnchorType {
  PARAGRAPH = 0,        // 문단
  CHAR = 1,             // 글자
  PAGE = 2,             // 페이지
}

/**
 * HWP 고급 기능 레코드 TagID
 */
export enum AdvancedTagID {
  HWPTAG_CTRL_HEADER = 71,
  HWPTAG_FIELD_UNKNOWN = 96,
  HWPTAG_FIELD_DATE = 97,
  HWPTAG_FIELD_DOC_DATE = 98,
  HWPTAG_FIELD_PATH = 99,
  HWPTAG_FIELD_BOOKMARK = 100,
  HWPTAG_FIELD_MAIL_MERGE = 101,
  HWPTAG_FIELD_CROSSREF = 102,
  HWPTAG_FIELD_FORMULA = 103,
  HWPTAG_FIELD_CLICKHERE = 104,
  HWPTAG_FIELD_SUMMARY = 105,
  HWPTAG_FIELD_USERINFO = 106,
  HWPTAG_FIELD_HYPERLINK = 107,
  HWPTAG_TEXT_BOX = 108,
}

/**
 * 헬퍼 함수
 */

/**
 * URL 유효성 검사
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 이메일 유효성 검사
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 책갈피 이름 유효성 검사
 */
export function isValidBookmarkName(name: string): boolean {
  // 한글, 영문, 숫자, 밑줄만 허용, 공백 불허
  const bookmarkRegex = /^[가-힣a-zA-Z0-9_]+$/;
  return bookmarkRegex.test(name) && name.length <= 40;
}

/**
 * 필드 형식 문자열 생성
 */
export function formatFieldValue(field: Field, context?: any): string {
  switch (field.data.type) {
    case 'PAGE_NUMBER':
      return context?.pageNo?.toString() || '1';
    case 'DATE':
      return new Date().toLocaleDateString('ko-KR');
    case 'TIME':
      return new Date().toLocaleTimeString('ko-KR');
    case 'TITLE':
      return field.data.value || '제목 없음';
    case 'AUTHOR':
      return field.data.value || '작성자 없음';
    case 'FILENAME':
      return context?.filename || 'document.hwpx';
    default:
      return '';
  }
}

