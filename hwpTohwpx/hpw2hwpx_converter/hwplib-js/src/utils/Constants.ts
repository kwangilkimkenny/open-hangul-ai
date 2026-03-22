/**
 * HWP 파일 포맷 상수 정의
 * 매직 넘버 제거 및 가독성 향상
 */

// ============================================================================
// OLE Compound Document 상수
// ============================================================================

export const OLE = {
  /** OLE 시그니처 바이트 */
  SIGNATURE: [0xD0, 0xCF, 0x11, 0xE0] as const,

  /** 헤더 크기 */
  HEADER_SIZE: 512,

  /** 디렉토리 엔트리 크기 */
  DIRECTORY_ENTRY_SIZE: 128,

  /** 섹터당 디렉토리 엔트리 수 */
  ENTRIES_PER_SECTOR: 4,

  /** FAT 특수 값 */
  FAT: {
    END_OF_CHAIN: 0xFFFFFFFE,
    FREE_SECTOR: 0xFFFFFFFF,
    FAT_SECTOR: 0xFFFFFFFD,
    DIF_SECTOR: 0xFFFFFFFC
  },

  /** 디렉토리 엔트리 타입 */
  ENTRY_TYPE: {
    EMPTY: 0,
    STORAGE: 1,
    STREAM: 2,
    LOCK_BYTES: 3,
    PROPERTY: 4,
    ROOT: 5
  },

  /** 헤더 오프셋 */
  HEADER_OFFSET: {
    MINOR_VERSION: 24,
    MAJOR_VERSION: 26,
    BYTE_ORDER: 28,
    SECTOR_SHIFT: 30,
    MINI_SECTOR_SHIFT: 32,
    FAT_SECTORS: 44,
    FIRST_DIR_SECTOR: 48,
    MIN_STREAM_SIZE: 56,
    FIRST_MINI_FAT_SECTOR: 60,
    TOTAL_MINI_FAT_SECTORS: 64,
    FIRST_DIFAT_SECTOR: 68,
    TOTAL_DIFAT_SECTORS: 72,
    DIFAT_START: 76
  },

  /** DIFAT 엔트리 수 (헤더 내) */
  DIFAT_ENTRIES_IN_HEADER: 109,

  /** 무효한 엔트리 ID */
  INVALID_ENTRY_ID: 0xFFFFFFFF
} as const;

// ============================================================================
// HWP 레코드 태그 ID
// ============================================================================

export const HWPTAG = {
  // 기본 태그 (16+)
  BEGIN: 0x010,

  // BodyText 레코드
  PARA_HEADER: 66,
  PARA_TEXT: 67,
  PARA_CHAR_SHAPE: 68,
  PARA_LINE_SEG: 69,
  CTRL_HEADER: 71,
  LIST_HEADER: 72,
  PAGE_DEF: 73,

  // 도형 컴포넌트
  SHAPE_COMPONENT: 76,
  SHAPE_COMPONENT_V1: 70,
  TABLE: 77,
  SHAPE_COMPONENT_LINE: 78,
  SHAPE_COMPONENT_RECTANGLE: 79,
  SHAPE_COMPONENT_ELLIPSE: 80,
  SHAPE_COMPONENT_POLYGON: 82,
  SHAPE_COMPONENT_CURVE: 83,
  SHAPE_COMPONENT_PICTURE: 85,
  SHAPE_COMPONENT_PICTURE_V1: 74,
  PAGE_BORDER_FILL: 84,

  // 필드
  FIELD_BEGIN: 98,
  FIELD_END: 99,

  // 각주/미주
  FOOTNOTE: 92,
  ENDNOTE: 93,

  // 수식/차트
  EQEDIT: 111,
  CHART: 115
} as const;

// ============================================================================
// HWP 컨트롤 ID (4바이트 문자열)
// ============================================================================

export const CTRL_ID = {
  SECTION_DEF: 'secd',
  HEADER: 'head',
  FOOTER: 'foot',
  COLUMN_DEF: 'cold',
  TABLE: 'tbl ',
  SHAPE: 'gso ',
  EQUATION: 'eqed',
  FOOTNOTE: 'fn  ',
  ENDNOTE: 'en  ',
  HIDDEN_COMMENT: 'tcmt',
  PAGE_NUMBER: 'pgct',
  PAGE_BREAK: 'pgbk',
  BOOKMARK: 'bokm',
  AUTO_NUMBER: 'atno'
} as const;

// ============================================================================
// 문단 헤더 속성 비트
// ============================================================================

export const PARA_ATTR = {
  STYLE: 0x01,
  PAGE_BREAK: 0x04,
  COLUMN_BREAK: 0x08
} as const;

// ============================================================================
// 리스트 헤더 오프셋 (셀 메타데이터)
// ============================================================================

export const LIST_HEADER = {
  PARA_COUNT: 0,
  ATTRIBUTES: 4,
  COL_ADDR: 8,
  ROW_ADDR: 10,
  COL_SPAN: 12,
  ROW_SPAN: 14,
  WIDTH: 16,
  HEIGHT: 20,
  MARGIN_LEFT: 24,
  MARGIN_RIGHT: 26,
  MARGIN_TOP: 28,
  MARGIN_BOTTOM: 30,
  BORDER_FILL_ID: 32,
  MIN_SIZE: 34
} as const;

// ============================================================================
// 테이블 레코드 오프셋
// ============================================================================

export const TABLE_RECORD = {
  FLAGS: 0,
  ROW_COUNT: 4,
  COL_COUNT: 6,
  ROW_SPACING: 8,
  COL_SPACING: 10,
  BORDER_FILL_ID: 12,
  MIN_SIZE: 14
} as const;

// ============================================================================
// HWP 디렉토리 엔트리 이름
// ============================================================================

export const HWP_ENTRIES = {
  ROOT: 'Root Entry',
  FILE_HEADER: 'FileHeader',
  DOC_INFO: 'DocInfo',
  BODY_TEXT: 'BodyText',
  BIN_DATA: 'BinData',
  PRV_TEXT: 'PrvText',
  PRV_IMAGE: 'PrvImage',
  DOC_OPTIONS: 'DocOptions',
  SCRIPTS: 'Scripts',
  XML_TEMPLATE: 'XMLTemplate',
  SUMMARY_INFO: 'HwpSummaryInformation',
  SUMMARY_INFO_ALT: '\x05HwpSummaryInformation'
} as const;

// ============================================================================
// 레코드 크기 상수
// ============================================================================

export const RECORD = {
  HEADER_SIZE: 4,
  EXTENDED_SIZE_THRESHOLD: 0xFFF,
  TAG_MASK: 0x3FF,
  LEVEL_SHIFT: 10,
  LEVEL_MASK: 0x3FF,
  SIZE_SHIFT: 20,
  SIZE_MASK: 0xFFF
} as const;

// ============================================================================
// 메모리/성능 제한
// ============================================================================

export const LIMITS = {
  MAX_STREAM_SIZE: 50 * 1024 * 1024,      // 50MB
  MAX_MINI_STREAM_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_ITERATIONS: 10000,
  MAX_SECTOR_SCAN: 100,
  CONSECUTIVE_EMPTY_THRESHOLD: 30,
  MAX_MINI_FAT_ENTRIES: 1000000           // MiniFAT 최대 엔트리 수
} as const;

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 4바이트 정수를 컨트롤 ID 문자열로 변환
 */
export function ctrlIdToString(id: number): string {
  return String.fromCharCode(
    id & 0xFF,
    (id >> 8) & 0xFF,
    (id >> 16) & 0xFF,
    (id >> 24) & 0xFF
  );
}

/**
 * 컨트롤 ID 문자열을 4바이트 정수로 변환
 */
export function stringToCtrlId(str: string): number {
  return (
    str.charCodeAt(0) |
    (str.charCodeAt(1) << 8) |
    (str.charCodeAt(2) << 16) |
    (str.charCodeAt(3) << 24)
  );
}

/**
 * FAT 엔트리가 특수 값인지 확인
 */
export function isSpecialFatValue(value: number): boolean {
  return value >= 0xFFFFFFFC;
}

/**
 * FAT 체인 종료 여부 확인
 */
export function isEndOfChain(value: number): boolean {
  return value === OLE.FAT.END_OF_CHAIN || value === OLE.FAT.FREE_SECTOR;
}
