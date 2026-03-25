/**
 * Special Objects (특수 객체) 모델
 * OLE 객체, 멀티미디어, 양식 필드 등
 */

/**
 * OLE 객체 (Excel, PowerPoint 등 임베디드 문서)
 */
export interface OLEObject {
  id: number;
  type: OLEObjectType;
  
  // 위치 및 크기 (HWPUNIT)
  x: number;
  y: number;
  width: number;
  height: number;
  
  // OLE 데이터
  data: Uint8Array;
  storageID: string;        // OLE Storage 이름
  
  // 미리보기 이미지
  previewImageID?: number;  // BinData 참조
  
  // 메타데이터
  classID: string;          // CLSID (예: Excel.Sheet.12)
  progID: string;           // ProgID
  
  // 옵션
  embedded: boolean;        // 임베디드 vs 연결
  linkPath?: string;        // 연결된 파일 경로
  
  // 배치
  zOrder: number;
  wrapType: WrapType;
  anchor: AnchorType;
}

/**
 * 멀티미디어 (동영상, 사운드)
 */
export interface Multimedia {
  id: number;
  type: MultimediaType;
  
  // 위치 및 크기
  x: number;
  y: number;
  width: number;
  height: number;
  
  // 미디어 데이터
  data: Uint8Array;
  format: string;           // "mp4", "avi", "mp3", "wav" 등
  mimeType: string;
  
  // 재생 옵션
  autoPlay: boolean;
  loop: boolean;
  showControls: boolean;
  volume: number;           // 0-100
  
  // 포스터 이미지 (동영상)
  posterImageID?: number;   // BinData 참조
  
  // 배치
  zOrder: number;
  wrapType: WrapType;
  anchor: AnchorType;
}

/**
 * 양식 필드 (Form Field)
 */
export interface FormField {
  id: number;
  type: FormFieldType;
  name: string;
  
  // 위치
  paragraphNo: number;
  charPos: number;
  
  // 값
  value: string | boolean | number;
  defaultValue: string | boolean | number;
  
  // 옵션
  required: boolean;
  readOnly: boolean;
  enabled: boolean;
  
  // 스타일
  width: number;
  height: number;
  
  // 타입별 속성
  options?: FormFieldOptions;
}

/**
 * 양식 필드 옵션 (타입별)
 */
export type FormFieldOptions = 
  | TextFieldOptions
  | CheckBoxOptions
  | RadioButtonOptions
  | ComboBoxOptions
  | ListBoxOptions
  | ButtonOptions;

export interface TextFieldOptions {
  type: 'TEXT';
  maxLength?: number;
  multiline?: boolean;
  password?: boolean;
  placeholder?: string;
}

export interface CheckBoxOptions {
  type: 'CHECKBOX';
  checked: boolean;
  label?: string;
}

export interface RadioButtonOptions {
  type: 'RADIO';
  groupName: string;
  selected: boolean;
  label?: string;
}

export interface ComboBoxOptions {
  type: 'COMBOBOX';
  items: string[];
  selectedIndex: number;
  editable: boolean;
}

export interface ListBoxOptions {
  type: 'LISTBOX';
  items: string[];
  selectedIndices: number[];
  multiSelect: boolean;
}

export interface ButtonOptions {
  type: 'BUTTON';
  label: string;
  action: string;          // JavaScript 코드 또는 액션 이름
}

/**
 * 차트 데이터 (Chart) - Phase 6에서 사용
 */
export interface Chart {
  id: number;
  type: ChartType;
  
  // 위치 및 크기
  x: number;
  y: number;
  width: number;
  height: number;
  
  // 데이터
  data: ChartData;
  
  // 스타일
  title?: string;
  legend: boolean;
  gridLines: boolean;
  
  // 배치
  zOrder: number;
  wrapType: WrapType;
  anchor: AnchorType;
}

/**
 * 차트 데이터
 */
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
}

/**
 * 수식 (Equation) - Phase 6에서 사용
 */
export interface Equation {
  id: number;
  
  // 위치
  paragraphNo: number;
  charPos: number;
  
  // 수식 데이터
  mathML: string;           // MathML 형식
  latex?: string;           // LaTeX 형식 (변환용)
  
  // 렌더링 이미지
  imageID?: number;         // BinData 참조
  
  // 스타일
  fontSize: number;
  inline: boolean;          // 인라인 vs 블록
}

/**
 * OLE 객체 타입
 */
export enum OLEObjectType {
  EXCEL = 0,                // Excel 스프레드시트
  WORD = 1,                 // Word 문서
  POWERPOINT = 2,           // PowerPoint 프레젠테이션
  PDF = 3,                  // PDF 문서
  IMAGE = 4,                // 이미지 (BMP, PNG 등)
  UNKNOWN = 99,             // 알 수 없음
}

/**
 * 멀티미디어 타입
 */
export enum MultimediaType {
  VIDEO = 0,                // 동영상
  AUDIO = 1,                // 오디오
  FLASH = 2,                // Flash (레거시)
  ANIMATION = 3,            // 애니메이션
}

/**
 * 양식 필드 타입
 */
export enum FormFieldType {
  TEXT = 0,                 // 텍스트 입력
  CHECKBOX = 1,             // 체크박스
  RADIO = 2,                // 라디오 버튼
  COMBOBOX = 3,             // 콤보박스 (드롭다운)
  LISTBOX = 4,              // 리스트박스
  BUTTON = 5,               // 버튼
  DATE = 6,                 // 날짜 선택
  SIGNATURE = 7,            // 전자 서명
}

/**
 * 차트 타입
 */
export enum ChartType {
  LINE = 0,                 // 꺾은선
  BAR = 1,                  // 막대
  COLUMN = 2,               // 세로 막대
  PIE = 3,                  // 원형
  AREA = 4,                 // 영역
  SCATTER = 5,              // 분산형
  RADAR = 6,                // 방사형
}

/**
 * 배치 타입
 */
export enum WrapType {
  SQUARE = 0,
  TOP_AND_BOTTOM = 1,
  TIGHT = 2,
  THROUGH = 3,
  NONE = 4,
}

/**
 * 앵커 타입
 */
export enum AnchorType {
  PARAGRAPH = 0,
  CHAR = 1,
  PAGE = 2,
}

/**
 * HWP 특수 객체 레코드 TagID
 */
export enum SpecialTagID {
  HWPTAG_SHAPE_COMPONENT_OLE = 84,
  HWPTAG_CTRL_DATA = 110,
  HWPTAG_EQEDIT = 111,
  HWPTAG_FORM_OBJECT = 112,
  HWPTAG_PRESENTATION = 113,
  HWPTAG_MULTIMEDIA = 114,
}

/**
 * 헬퍼 함수
 */

/**
 * OLE CLSID → 객체 타입 변환
 */
export function getOLETypeFromCLSID(classID: string): OLEObjectType {
  const clsidMap: { [key: string]: OLEObjectType } = {
    '00020820-0000-0000-C000-000000000046': OLEObjectType.EXCEL,
    '00020821-0000-0000-C000-000000000046': OLEObjectType.EXCEL,
    '00020906-0000-0000-C000-000000000046': OLEObjectType.WORD,
    '64818D10-4F9B-11CF-86EA-00AA00B929E8': OLEObjectType.POWERPOINT,
  };
  
  return clsidMap[classID.toUpperCase()] || OLEObjectType.UNKNOWN;
}

/**
 * 파일 확장자 → 멀티미디어 타입
 */
export function getMultimediaTypeFromExtension(ext: string): MultimediaType {
  const extMap: { [key: string]: MultimediaType } = {
    'mp4': MultimediaType.VIDEO,
    'avi': MultimediaType.VIDEO,
    'wmv': MultimediaType.VIDEO,
    'mov': MultimediaType.VIDEO,
    'mp3': MultimediaType.AUDIO,
    'wav': MultimediaType.AUDIO,
    'wma': MultimediaType.AUDIO,
    'swf': MultimediaType.FLASH,
    'gif': MultimediaType.ANIMATION,
  };
  
  return extMap[ext.toLowerCase()] || MultimediaType.VIDEO;
}

/**
 * MIME 타입 → 멀티미디어 형식
 */
export function getMimeTypeForFormat(format: string): string {
  const mimeMap: { [key: string]: string } = {
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'wma': 'audio/x-ms-wma',
  };
  
  return mimeMap[format.toLowerCase()] || 'application/octet-stream';
}

/**
 * 양식 필드 유효성 검사
 */
export function validateFormField(field: FormField): boolean {
  // 필수 필드 체크
  if (field.required && !field.value) {
    return false;
  }
  
  // 타입별 검증
  if (field.options?.type === 'TEXT') {
    const textOpts = field.options as TextFieldOptions;
    if (textOpts.maxLength && String(field.value).length > textOpts.maxLength) {
      return false;
    }
  }
  
  return true;
}

