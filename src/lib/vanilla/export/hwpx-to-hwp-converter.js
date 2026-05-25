/**
 * HWPX → HWP 역변환기 (단순 케이스 전용)
 *
 * 목적
 * ------
 * `Hwpx2Hwp.convert(input)` 한 줄로 HWPX 입력을 .hwp(OLE Compound Document)
 * 바이너리로 변환한다. 입력은 두 종류를 허용한다.
 *
 *   1. `Uint8Array` (HWPX 파일 바이너리)  → 내부에서 SimpleHWPXParser 호출
 *   2. parsed HWPXDocument (parser.js 출력 shape)
 *
 * 외부 `hwpTohwpx/hpw2hwpx_converter/hwp2hwpx-js/dist/core/Hwpx2Hwp.js` 는
 * CommonJS + 자체 HwpxParser 의존성이 무거워서, 우리는 같은 기본 아이디어를
 * 가져오되 단순 paragraph-only 변환만 지원하는 가벼운 fork 를 작성한다.
 *
 * Step 1 (구현 완료): 문단 + UTF-16 텍스트 런 + 기본 글자 서식 (bold/italic/색상)
 *   - DocInfo: DOCUMENT_PROPERTIES, ID_MAPPINGS, FACE_NAME(기본 폰트 1개),
 *     CHAR_SHAPE(기본 1개 + 옵션 색/굵기 1개), PARA_SHAPE, STYLE 만 emit.
 *   - BodyText/Section0: PARA_HEADER, PARA_TEXT, PARA_CHAR_SHAPE, PARA_LINE_SEG
 *     레코드만 emit.
 *   - CFB 컨테이너에 /FileHeader(40B), /DocInfo, /BodyText/Section0 추가.
 *
 * Step 2 (구현 완료): 표 (TBL 컨트롤)
 *   - PARA_HEADER 컨트롤 마스크에 0x800 비트, 본문 텍스트에 CTRL_CHAR.INLINE_OBJ(0x18) 삽입
 *   - CTRL_HEADER (71, ctrlId='tbl ') + TABLE (77) + 셀별 LIST_HEADER (72)
 *   - 각 셀의 단락은 Step 1 PARA_HEADER 시퀀스 재사용 (재귀)
 *
 * Step 3 (구현 완료): 이미지 + 도형
 *   - DocInfo 에 BIN_DATA (18) 추가, ID_MAPPINGS 의 binData 카운트 반영
 *   - /BinData/BIN%04d.{ext} CFB 스트림으로 raw 바이너리 저장 (입력 image.bytes 또는
 *     options.binData 매핑에서 가져옴)
 *   - PARA_HEADER 컨트롤 마스크에 0x800 비트 (GSO 와 TBL 동일 비트), 본문에
 *     CTRL_CHAR.DRAWING_OBJ(0x0B) 삽입
 *   - CTRL_HEADER (71, ctrlId='gso ') + SHAPE_COMPONENT (76)
 *   - 도형 타입별: SHAPE_COMPONENT_LINE(78) / _RECTANGLE(79) / _ELLIPSE(80) /
 *     _ARC(81) / _POLYGON(82) / _CURVE(83) / _PICTURE(85)
 *   - SHAPE_COMPONENT_OLE(84) 와 차트는 의도적으로 skip
 *
 * 의도적 제외
 * ------------
 *   - HWP 매크로, OLE 오브젝트, DRM/암호화, 차트
 *   - SummaryInformation 스트림 (대부분의 뷰어가 옵션 처리)
 *   - 변경 추적, 메모, 양식
 *
 * 참고: HWP 5.0 명세 (Tag ID/레코드 헤더 구조)
 *   https://cdn.hancom.com/link/docs/한글문서파일형식_5.0_revision1.3.pdf
 *   Tag ID 는 hwplib-js (hwpTohwpx/hpw2hwpx_converter/hwplib-js/dist/utils/Constants.js)
 *   에서 교차 검증함.
 *
 * @module export/hwpx-to-hwp-converter
 */

import pako from 'pako';
import CFB from 'cfb';

// ============================================================================
// HWP 5.0 명세 상수
// ============================================================================

/** DocInfo Tag IDs */
const TAG_DOC = {
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
};

/** BodyText/Section Tag IDs */
const TAG_SEC = {
  PARA_HEADER: 66,
  PARA_TEXT: 67,
  PARA_CHAR_SHAPE: 68,
  PARA_LINE_SEG: 69,
  CTRL_HEADER: 71,
  LIST_HEADER: 72,
  SHAPE_COMPONENT: 76,
  TABLE: 77,
  SHAPE_COMPONENT_LINE: 78,
  SHAPE_COMPONENT_RECTANGLE: 79,
  SHAPE_COMPONENT_ELLIPSE: 80,
  SHAPE_COMPONENT_ARC: 81,
  SHAPE_COMPONENT_POLYGON: 82,
  SHAPE_COMPONENT_CURVE: 83,
  SHAPE_COMPONENT_OLE: 84,
  SHAPE_COMPONENT_PICTURE: 85,
};

/** HWP 컨트롤 문자 */
const CTRL = {
  PARA_BREAK: 0x0d,
  INLINE_OBJ: 0x18, // 표/덧말 등 inline 오브젝트
  DRAWING_OBJ: 0x0b, // 그리기 객체 (도형/이미지)
};

/** PARA_HEADER 컨트롤 마스크 비트 */
const CTRL_MASK = {
  TABLE_OR_GSO: 0x800, // hwplib-js 분석상 표/그리기 객체 동일 비트
};

/** 레코드 헤더 확장 임계값 (size >= 0xFFF 이면 8바이트 헤더) */
const EXTENDED_SIZE = 0xfff;

/** FileHeader 시그니처 */
const HWP_SIGNATURE = 'HWP Document File';

// ============================================================================
// Low-level binary helpers
// ============================================================================

/**
 * `RecordDataWriter` 와 동일한 역할의 경량 바이너리 직렬화 헬퍼.
 * 외부 패키지를 import 하지 않기 위해 자체 구현.
 */
export class BinaryWriter {
  constructor() {
    this.bytes = [];
  }
  get length() {
    return this.bytes.length;
  }
  writeUint8(v) {
    this.bytes.push(v & 0xff);
    return this;
  }
  writeInt8(v) {
    return this.writeUint8(v < 0 ? v + 0x100 : v);
  }
  writeUint16(v) {
    this.bytes.push(v & 0xff, (v >> 8) & 0xff);
    return this;
  }
  writeInt16(v) {
    return this.writeUint16(v);
  }
  writeUint32(v) {
    this.bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
    return this;
  }
  writeInt32(v) {
    return this.writeUint32(v);
  }
  /** UTF-16LE chars without length prefix */
  writeUtf16LE(text) {
    for (let i = 0; i < text.length; i++) {
      this.writeUint16(text.charCodeAt(i));
    }
    return this;
  }
  /** HWP-style string: [uint16 charCount][UTF-16LE chars] */
  writeHwpString(text) {
    this.writeUint16(text.length);
    return this.writeUtf16LE(text);
  }
  /** 'tbl ', 'gso ' 등 4-char ASCII 컨트롤 ID 를 LE 로 기록 */
  writeCtrlId(s) {
    const str = String(s).padEnd(4, ' ').slice(0, 4);
    // HWPX 컨트롤 ID 는 reverse order (예: "tbl " → 0x206C6274 in LE = bytes 't','b','l',' ')
    // 즉 단순 ASCII 4글자를 그대로 write 하면 된다.
    this.writeUint8(str.charCodeAt(0));
    this.writeUint8(str.charCodeAt(1));
    this.writeUint8(str.charCodeAt(2));
    this.writeUint8(str.charCodeAt(3));
    return this;
  }
  writeBytes(data) {
    for (const b of data) this.bytes.push(b & 0xff);
    return this;
  }
  writeZeros(n) {
    for (let i = 0; i < n; i++) this.bytes.push(0);
    return this;
  }
  toUint8Array() {
    return new Uint8Array(this.bytes);
  }
}

/**
 * HWP 레코드 스트림 빌더.
 * 헤더 형식:
 *   [TagID:10 bits][Level:10 bits][Size:12 bits]
 * size >= 0xFFF 이면 다음 4바이트에 실제 size 가 들어가는 확장 헤더 사용.
 */
export class RecordStreamWriter {
  constructor() {
    this.chunks = [];
    this.totalSize = 0;
  }
  /**
   * @param {number} tagId
   * @param {number} level
   * @param {Uint8Array} data
   */
  writeRecord(tagId, level, data) {
    const size = data.length;
    const header = new Uint8Array(size >= EXTENDED_SIZE ? 8 : 4);
    const view = new DataView(header.buffer);
    const sizeField = size >= EXTENDED_SIZE ? EXTENDED_SIZE : size;
    const headerWord = (tagId & 0x3ff) | ((level & 0x3ff) << 10) | ((sizeField & 0xfff) << 20);
    view.setUint32(0, headerWord, true);
    if (size >= EXTENDED_SIZE) {
      view.setUint32(4, size, true);
    }
    this.chunks.push(header);
    this.chunks.push(data);
    this.totalSize += header.length + data.length;
    return this;
  }
  toUint8Array() {
    const out = new Uint8Array(this.totalSize);
    let off = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, off);
      off += chunk.length;
    }
    return out;
  }
}

// ============================================================================
// FileHeader (40 bytes, never compressed)
// ============================================================================

function buildFileHeader({ compressed = true } = {}) {
  const buf = new Uint8Array(40);
  // 0-31: signature
  const sig = HWP_SIGNATURE;
  for (let i = 0; i < sig.length; i++) buf[i] = sig.charCodeAt(i);
  // 32-35: version (build, patch, minor, major) - default 5.1.0.0
  buf[32] = 0; // build
  buf[33] = 0; // patch
  buf[34] = 1; // minor
  buf[35] = 5; // major
  // 36-39: flags
  const view = new DataView(buf.buffer);
  view.setUint32(36, compressed ? 0x0001 : 0x0000, true);
  return buf;
}

// ============================================================================
// DocInfo serialization (Step 1 — minimal)
// ============================================================================

/**
 * 입력 HWPX 문서에서 distinct char-style 집합을 수집하여 ID 매핑 + CharShape
 * 레코드 시퀀스를 만든다. Step 1 은 1~3 개의 작은 셋만 처리.
 *
 * 표 셀 안의 단락에서 사용된 스타일도 함께 수집한다 (Step 2).
 */
function collectCharStyles(hwpxDoc) {
  // 기본 CharShape 1 개를 항상 0번에 둔다.
  const styles = [{ bold: false, italic: false, colorHex: '#000000', fontSize: 1000 }];
  const seen = new Map();
  seen.set(styleKey(styles[0]), 0);

  function visitParagraph(p) {
    for (const run of p.runs || []) {
      if (!run || run.type) continue; // 텍스트 런만
      const s = normalizeStyle(run.style);
      const k = styleKey(s);
      if (!seen.has(k)) {
        seen.set(k, styles.length);
        styles.push(s);
      }
    }
    // 단락에 부착된 표/이미지/도형의 셀 내 단락도 재귀
    for (const tbl of p.tables || []) visitTable(tbl);
  }
  function visitTable(tbl) {
    for (const row of tbl.rows || []) {
      for (const cell of row.cells || []) {
        for (const el of cell.elements || []) {
          if (el?.type === 'paragraph') visitParagraph(el);
          else if (el?.type === 'table') visitTable(el);
        }
      }
    }
  }

  for (const section of hwpxDoc.sections || []) {
    for (const el of section.elements || []) {
      if (el?.type === 'paragraph') visitParagraph(el);
      else if (el?.type === 'table') visitTable(el);
    }
  }
  return { styles, lookup: seen };
}

function normalizeStyle(style) {
  return {
    bold: !!style?.bold,
    italic: !!style?.italic,
    colorHex: typeof style?.color === 'string' ? style.color : '#000000',
    fontSize: parseFontSizeHWP(style?.fontSize),
  };
}

function styleKey(s) {
  return `${s.bold}|${s.italic}|${s.colorHex}|${s.fontSize}`;
}

function parseFontSizeHWP(fontSize) {
  // HWP CharShape 의 size 는 1/100 pt 단위. 기본 10pt = 1000.
  if (fontSize == null) return 1000;
  if (typeof fontSize === 'number') return Math.round(fontSize * 100);
  const m = String(fontSize).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : 1000;
}

function hexToColorRef(hex) {
  // #RRGGBB → 0x00BBGGRR
  const h = String(hex || '#000000').replace('#', '');
  const r = parseInt(h.substring(0, 2) || '0', 16);
  const g = parseInt(h.substring(2, 4) || '0', 16);
  const b = parseInt(h.substring(4, 6) || '0', 16);
  return ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

/**
 * DOCUMENT_PROPERTIES (TagID=16) — 30바이트
 */
function writeDocumentProperties(rw, sectionCount) {
  const d = new BinaryWriter();
  d.writeUint16(sectionCount); // secCnt
  d.writeUint16(1); // 페이지 번호 시작
  d.writeUint16(1); // 각주
  d.writeUint16(1); // 미주
  d.writeUint16(1); // 그림
  d.writeUint16(1); // 표
  d.writeUint16(1); // 수식
  d.writeUint32(0); // 캐럿: listID
  d.writeUint32(0); // 캐럿: paraID
  d.writeUint32(0); // 캐럿: charPos
  rw.writeRecord(TAG_DOC.DOCUMENT_PROPERTIES, 0, d.toUint8Array());
}

/**
 * ID_MAPPINGS (TagID=17) — 48바이트 (HWP 5.0/5.1)
 * 항목 수: binData / face name × 7 / borderFill / charShape / tabDef /
 *         numbering / bullet / paraShape / style / memoShape
 */
function writeIdMappings(rw, counts) {
  const d = new BinaryWriter();
  d.writeInt32(counts.binData);
  // FACE_NAME × 7 lang (Hangul, Latin, Hanja, JP, Other, Symbol, User)
  for (let i = 0; i < 7; i++) d.writeInt32(counts.fontPerLang[i] || 0);
  d.writeInt32(counts.borderFill);
  d.writeInt32(counts.charShape);
  d.writeInt32(counts.tabDef);
  d.writeInt32(counts.numbering);
  d.writeInt32(counts.bullet);
  d.writeInt32(counts.paraShape);
  d.writeInt32(counts.style);
  d.writeInt32(counts.memoShape || 0);
  rw.writeRecord(TAG_DOC.ID_MAPPINGS, 0, d.toUint8Array());
}

/**
 * BIN_DATA (TagID=18) — 한 개의 BinData 매핑 entry.
 *
 * 형식: [속성:2][유형:1 또는 확장자 NULL-종결 UTF-16LE]
 *
 * 명세상 EMBEDDING(type=1) 항목은:
 *   [flags:uint16][extension: HWP-string (uint16 len + UTF-16LE chars)]
 * 우리는 flags = (type=EMBEDDING(1)) | (compression NONE(0) << 2) = 0x0001.
 */
function writeBinData(rw, ext) {
  const d = new BinaryWriter();
  // flags: 하위 2비트=type(1=EMBEDDING), 비트2~3=compression(0=NONE)
  d.writeUint16(0x0001);
  // 확장자: HWP-string format
  d.writeHwpString(String(ext || 'bin').toLowerCase());
  rw.writeRecord(TAG_DOC.BIN_DATA, 0, d.toUint8Array());
}

/**
 * FACE_NAME (TagID=19) — 단일 폰트 "함초롬바탕" (기본)
 * 프로퍼티: [속성:1][폰트명: HWP string][대체폰트존재:1 → 없음 0]
 *           [폰트 타입정보 (옵션, 생략)][폰트번역명 (옵션, 생략)][기본글꼴(옵션, 생략)]
 */
function writeFaceName(rw, fontName) {
  const d = new BinaryWriter();
  d.writeUint8(0); // 속성 (없음)
  d.writeHwpString(fontName);
  d.writeUint8(0); // 대체 폰트 없음
  d.writeUint8(0); // 폰트 타입 정보 없음
  d.writeUint8(0); // 폰트 번역 정보 없음
  d.writeUint8(0); // 기본 글꼴 정보 없음
  rw.writeRecord(TAG_DOC.FACE_NAME, 0, d.toUint8Array());
}

/**
 * BORDER_FILL (TagID=20) — 가장 기본: 테두리/채우기 없음
 * 형식 (요약): [속성:2][slash:1][crooked:1]
 *   + line 4개 × (type 1 + thickness 1 + color 4)
 *   + diagonal 2개 × (type 1 + thickness 1 + color 4)
 *   + fillInfo: type 4바이트 (0 = no fill)
 */
function writeBorderFill(rw) {
  const d = new BinaryWriter();
  d.writeUint16(0); // 속성
  // 8 라인 (4 외곽 + 4 대각): type:uint8, thickness:uint8, color:uint32
  for (let i = 0; i < 6; i++) {
    d.writeUint8(0); // 타입 = NONE
    d.writeUint8(0); // 두께
    d.writeUint32(0); // 색
  }
  d.writeUint32(0); // fill type = NONE
  rw.writeRecord(TAG_DOC.BORDER_FILL, 0, d.toUint8Array());
}

/**
 * CHAR_SHAPE (TagID=21) — HWP 5.0 명세 약 72바이트.
 * 핵심 필드만 안정적으로 채우고, 명세상 reserved 영역은 0 으로 패딩.
 *
 * 글자 모양 구조 (간소화):
 *   [faceID × 7 lang : uint16]          // 14
 *   [ratio × 7 : uint8]                 // 7
 *   [charSpacing × 7 : int8]            // 7
 *   [relSize × 7 : uint8]               // 7
 *   [charOffset × 7 : int8]             // 7
 *   [baseSize : int32 — 1/100 pt]       // 4
 *   [attrFlags : uint32]                // 4
 *   [shadowOffsetX : int8]              // 1
 *   [shadowOffsetY : int8]              // 1
 *   [textColor : uint32]                // 4
 *   [underlineColor : uint32]           // 4
 *   [shadeColor : uint32]               // 4
 *   [shadowColor : uint32]              // 4
 *   = 72 bytes
 */
function writeCharShape(rw, style) {
  const d = new BinaryWriter();
  // faceID per lang (모두 0 = 첫 폰트)
  for (let i = 0; i < 7; i++) d.writeUint16(0);
  // ratio (100 = 기본)
  for (let i = 0; i < 7; i++) d.writeUint8(100);
  // charSpacing (0)
  for (let i = 0; i < 7; i++) d.writeUint8(0);
  // relSize (100)
  for (let i = 0; i < 7; i++) d.writeUint8(100);
  // charOffset (0)
  for (let i = 0; i < 7; i++) d.writeUint8(0);
  // baseSize
  d.writeInt32(style.fontSize || 1000);
  // attr flags: bit0 italic, bit1 bold (HWP 5.0 명세 표 7)
  let flags = 0;
  if (style.italic) flags |= 0x00000001;
  if (style.bold) flags |= 0x00000002;
  d.writeUint32(flags);
  d.writeUint8(0); // shadow offset X
  d.writeUint8(0); // shadow offset Y
  d.writeUint32(hexToColorRef(style.colorHex)); // text color
  d.writeUint32(0); // underline color
  d.writeUint32(0); // shade color
  d.writeUint32(0); // shadow color
  rw.writeRecord(TAG_DOC.CHAR_SHAPE, 0, d.toUint8Array());
}

/**
 * PARA_SHAPE (TagID=25) — 명세상 30~54바이트.
 * Step 1 은 단일 기본 단락 모양만 사용.
 */
function writeParaShape(rw) {
  const d = new BinaryWriter();
  d.writeUint32(0); // 속성 1
  d.writeInt32(0); // 좌여백
  d.writeInt32(0); // 우여백
  d.writeInt32(0); // 들여쓰기
  d.writeInt32(0); // 상여백
  d.writeInt32(0); // 하여백
  d.writeInt32(160); // 줄간격 (160 = 100%)
  d.writeInt16(0); // 탭정의 ID
  d.writeInt16(0); // 번호 ID
  d.writeInt16(0); // 테두리/배경 ID
  rw.writeRecord(TAG_DOC.PARA_SHAPE, 0, d.toUint8Array());
}

/**
 * STYLE (TagID=26) — 단일 기본 스타일 "Normal"
 */
function writeStyle(rw) {
  const d = new BinaryWriter();
  d.writeHwpString('Normal'); // 한글이름
  d.writeHwpString('Normal'); // 영문이름
  d.writeUint8(0); // 속성
  d.writeUint8(0); // 다음 스타일 ID
  d.writeUint16(0x0412); // 언어 ID (한국어)
  d.writeUint16(0); // ParaShape ID
  d.writeUint16(0); // CharShape ID
  rw.writeRecord(TAG_DOC.STYLE, 0, d.toUint8Array());
}

// ============================================================================
// BinData collection (Step 3)
// ============================================================================

/**
 * 문서 전체에서 사용된 이미지(BinData) 목록을 수집한다.
 *
 * 각 항목은 { key, ext, bytes? } 형태이며 key 는 원본 binaryItemIDRef.
 * 동일한 binItemID 는 한 번만 등록된다. bytes 는 옵션의 binData lookup,
 * 또는 image.bytes/image.data 필드, 두 경로 모두 비면 null.
 *
 * @param {object} hwpxDoc
 * @param {object} [options]
 * @param {Map<string, {bytes: Uint8Array, ext?: string}>|object} [options.binData]
 *   binaryItemIDRef → { bytes, ext } 사전. 호출자가 외부에서 raw 바이트를 주입할 때 사용.
 * @returns {Array<{key: string, ext: string, bytes: Uint8Array|null, index: number}>}
 */
export function collectBinData(hwpxDoc, options = {}) {
  const list = [];
  const seen = new Map();
  const binMap = normalizeBinDataMap(options.binData);

  function lookupExt(image) {
    // 우선순위: explicit ext → image.path/filename → mimeType
    if (image.ext) return String(image.ext).toLowerCase().replace(/^\./, '');
    if (image.filename) {
      const m = String(image.filename).match(/\.([a-z0-9]+)$/i);
      if (m) return m[1].toLowerCase();
    }
    if (image.path) {
      const m = String(image.path).match(/\.([a-z0-9]+)$/i);
      if (m) return m[1].toLowerCase();
    }
    if (image.mimeType) {
      const mt = String(image.mimeType).toLowerCase();
      if (mt.includes('png')) return 'png';
      if (mt.includes('jpeg') || mt.includes('jpg')) return 'jpg';
      if (mt.includes('gif')) return 'gif';
      if (mt.includes('bmp')) return 'bmp';
      if (mt.includes('svg')) return 'svg';
    }
    return 'bin';
  }

  function recordImage(image) {
    if (!image) return -1;
    const key = String(image.binaryItemId || image.binaryItemIDRef || image.binId || '');
    if (!key) return -1;
    if (seen.has(key)) return seen.get(key);
    const idx = list.length;
    const ext = lookupExt(image);
    const fromMap = binMap.get(key);
    const bytes = (image.bytes && image.bytes.length ? image.bytes
      : image.data instanceof Uint8Array ? image.data
      : fromMap ? fromMap.bytes
      : null);
    list.push({ key, ext: (fromMap && fromMap.ext) || ext, bytes: bytes || null, index: idx });
    seen.set(key, idx);
    return idx;
  }

  function visitParagraph(p) {
    for (const img of p.images || []) recordImage(img);
    for (const tbl of p.tables || []) visitTable(tbl);
  }
  function visitTable(tbl) {
    for (const row of tbl.rows || []) {
      for (const cell of row.cells || []) {
        for (const el of cell.elements || []) {
          if (el?.type === 'paragraph') visitParagraph(el);
          else if (el?.type === 'table') visitTable(el);
        }
      }
    }
  }

  for (const section of hwpxDoc.sections || []) {
    for (const el of section.elements || []) {
      if (el?.type === 'paragraph') visitParagraph(el);
      else if (el?.type === 'table') visitTable(el);
    }
  }
  return list;
}

function normalizeBinDataMap(raw) {
  const out = new Map();
  if (!raw) return out;
  if (raw instanceof Map) {
    for (const [k, v] of raw) out.set(String(k), normalizeBinEntry(v));
    return out;
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && item.id != null) out.set(String(item.id), normalizeBinEntry(item));
    }
    return out;
  }
  if (typeof raw === 'object') {
    for (const k of Object.keys(raw)) out.set(String(k), normalizeBinEntry(raw[k]));
  }
  return out;
}
function normalizeBinEntry(v) {
  if (!v) return { bytes: null, ext: null };
  if (v instanceof Uint8Array) return { bytes: v, ext: null };
  return { bytes: v.bytes || v.data || null, ext: v.ext || null };
}

/**
 * DocInfo 스트림을 만든다.
 * @param {object} hwpxDoc parser.js HWPXDocument shape
 * @param {object} [options]
 * @param {Array} [options.binDataList] collectBinData() 결과를 재사용하고 싶을 때
 * @returns {{ bytes: Uint8Array, charStyles: object[], binDataList: Array }}
 */
export function buildDocInfoStream(hwpxDoc, options = {}) {
  const { styles: charStyles } = collectCharStyles(hwpxDoc);
  const binDataList = options.binDataList || collectBinData(hwpxDoc, options);
  const rw = new RecordStreamWriter();
  const sectionCount = (hwpxDoc.sections && hwpxDoc.sections.length) || 1;

  writeDocumentProperties(rw, sectionCount);
  writeIdMappings(rw, {
    binData: binDataList.length,
    fontPerLang: [1, 1, 1, 1, 1, 1, 1],
    borderFill: 1,
    charShape: charStyles.length,
    tabDef: 0,
    numbering: 0,
    bullet: 0,
    paraShape: 1,
    style: 1,
  });
  // BIN_DATA 매핑 (이미지 1개당 1 레코드)
  for (const bd of binDataList) writeBinData(rw, bd.ext);
  // FACE_NAME × 7 (모든 언어에 같은 폰트)
  for (let i = 0; i < 7; i++) writeFaceName(rw, '함초롬바탕');
  writeBorderFill(rw);
  for (const s of charStyles) writeCharShape(rw, s);
  writeParaShape(rw);
  writeStyle(rw);
  return { bytes: rw.toUint8Array(), charStyles, binDataList };
}

// ============================================================================
// Section serialization (Step 1)
// ============================================================================

/** charStyles lookup helper */
function findCharShapeId(charStyles, style) {
  const target = normalizeStyle(style);
  const key = styleKey(target);
  for (let i = 0; i < charStyles.length; i++) {
    if (styleKey(charStyles[i]) === key) return i;
  }
  return 0;
}

function writeParaHeader(rw, level, charCount, paraId, ctrlMask = 0) {
  const d = new BinaryWriter();
  d.writeUint32(charCount); // 글자 수
  d.writeUint32(ctrlMask); // 컨트롤 마스크
  d.writeUint16(0); // ParaShape ID
  d.writeUint8(0); // Style ID
  d.writeUint8(0); // 단/페이지 나눔
  d.writeUint16(1); // CharShape 개수 (최소 1)
  d.writeUint16(0); // RangeTag 개수
  d.writeUint16(1); // 줄 세그먼트 개수 (최소 1)
  d.writeUint32(paraId);
  d.writeUint16(0); // 변경추적 병합 ID
  rw.writeRecord(TAG_SEC.PARA_HEADER, level, d.toUint8Array());
}

function writeParaText(rw, level, text) {
  const d = new BinaryWriter();
  d.writeUtf16LE(text);
  rw.writeRecord(TAG_SEC.PARA_TEXT, level, d.toUint8Array());
}

function writeParaCharShape(rw, level, posShapes) {
  const d = new BinaryWriter();
  if (posShapes.length === 0) {
    d.writeUint32(0);
    d.writeUint32(0);
  } else {
    for (const p of posShapes) {
      d.writeUint32(p.position);
      d.writeUint32(p.charShapeId);
    }
  }
  rw.writeRecord(TAG_SEC.PARA_CHAR_SHAPE, level, d.toUint8Array());
}

function writeParaLineSeg(rw, level, charCount) {
  // HWP 명세 표 51: 줄 세그먼트 = 36바이트
  const d = new BinaryWriter();
  d.writeInt32(0); // textStartPos
  d.writeInt32(0); // lineVertPos
  d.writeInt32(1000); // lineHeight
  d.writeInt32(1000); // textHeight
  d.writeInt32(850); // distBaseLine
  d.writeInt32(600); // lineSpacing
  d.writeInt32(0); // segStartPos
  d.writeInt32(48000); // segWidth
  let segFlags = 0x60000;
  if (charCount <= 1) segFlags |= 0x03;
  d.writeUint32(segFlags);
  rw.writeRecord(TAG_SEC.PARA_LINE_SEG, level, d.toUint8Array());
}

// ============================================================================
// Step 2 — Table serialization
// ============================================================================

/**
 * CTRL_HEADER + TABLE + (각 셀별 LIST_HEADER + 셀 내 단락) 시퀀스를 emit.
 *
 * @param {RecordStreamWriter} rw
 * @param {number} level 현재 단락 레벨 (보통 0). 표 컨트롤은 level+1, TABLE 은 level+2,
 *                       셀 LIST_HEADER 는 level+2, 셀 단락은 level+3 으로 둔다.
 * @param {object} table parser.js parseTable() 출력
 * @param {object[]} charStyles DocInfo char-style 풀
 * @param {object} binIndex binaryItemIDRef → idx 매핑
 */
function writeTableControl(rw, level, table, charStyles, binIndex) {
  const rowCnt = table.rowCount ?? (table.rows ? table.rows.length : 0);
  let colCnt = table.colCount ?? 0;
  if (!colCnt) {
    // colCount 가 없으면 가장 긴 row 의 cell 수로 추정
    for (const row of table.rows || []) {
      colCnt = Math.max(colCnt, (row.cells || []).length);
    }
  }
  const cellSpacing = Math.max(0, parseInt(table.style?.cellSpacing || 0, 10) || 0);
  const inMargin = table.style?.inMargin || {};
  const borderFillId = parseInt(table.style?.borderFillId || 1, 10) || 1;

  // 1) CTRL_HEADER (71) — 'tbl '
  const ch = new BinaryWriter();
  ch.writeCtrlId('tbl ');
  rw.writeRecord(TAG_SEC.CTRL_HEADER, level + 1, ch.toUint8Array());

  // 2) TABLE (77)
  const tb = new BinaryWriter();
  tb.writeUint32(0); // 속성
  tb.writeUint16(rowCnt);
  tb.writeUint16(colCnt);
  tb.writeUint16(cellSpacing);
  // 내부 여백 left/right/top/bottom (각 2바이트)
  tb.writeUint16(toInt(inMargin.left, 510));
  tb.writeUint16(toInt(inMargin.right, 510));
  tb.writeUint16(toInt(inMargin.top, 141));
  tb.writeUint16(toInt(inMargin.bottom, 141));
  // 각 행 높이 (row.style.height 또는 cell.height 첫번째)
  for (let r = 0; r < rowCnt; r++) {
    const row = table.rows?.[r];
    let h = 1000;
    if (row?.style?.heightHWPU) h = row.style.heightHWPU;
    else if (row?.cells?.[0]?.heightHWPU) h = row.cells[0].heightHWPU;
    tb.writeUint16(Math.max(0, Math.min(0xffff, h)));
  }
  tb.writeUint16(borderFillId);
  tb.writeUint16(0); // 유효 영역 정보
  rw.writeRecord(TAG_SEC.TABLE, level + 2, tb.toUint8Array());

  // 3) 각 셀: LIST_HEADER (72) + 셀 단락들
  for (const row of table.rows || []) {
    for (const cell of row.cells || []) {
      writeCellListHeader(rw, level + 2, cell, borderFillId);
      const cellParas = (cell.elements || []).filter(e => e?.type === 'paragraph');
      const paraList = cellParas.length > 0 ? cellParas : [{ runs: [] }];
      let cpid = 0;
      for (const cp of paraList) {
        writeParagraph(rw, cp, cpid++, charStyles, binIndex, level + 3);
      }
    }
  }
}

function writeCellListHeader(rw, level, cell, fallbackBorderFillId) {
  const cellParas = (cell.elements || []).filter(e => e?.type === 'paragraph');
  const paraCount = Math.max(1, cellParas.length);
  const d = new BinaryWriter();
  d.writeUint16(paraCount);
  // 속성: vertAlign 매핑 (0=TOP, 1=CENTER, 2=BOTTOM 비트 0~1)
  let flags = 0;
  const va = cell.style?.verticalAlign || 'top';
  if (va === 'middle') flags |= 0x01;
  else if (va === 'bottom') flags |= 0x02;
  d.writeUint32(flags);
  // 셀 주소
  d.writeUint16(toInt(cell.colAddr, 0));
  d.writeUint16(toInt(cell.rowAddr, 0));
  d.writeUint16(Math.max(1, toInt(cell.colSpan, 1)));
  d.writeUint16(Math.max(1, toInt(cell.rowSpan, 1)));
  // 너비/높이
  d.writeUint32(toInt(cell.widthHWPU, 1000));
  d.writeUint32(toInt(cell.heightHWPU, 1000));
  // 마진 left/right/top/bottom — px 변환된 padding 으로 역계산은 어려우니 기본값 사용
  d.writeUint16(510);
  d.writeUint16(510);
  d.writeUint16(141);
  d.writeUint16(141);
  // borderFill
  d.writeUint16(parseInt(cell.style?.borderFillId || fallbackBorderFillId, 10) || fallbackBorderFillId);
  // 유효 영역
  d.writeUint16(0);
  rw.writeRecord(TAG_SEC.LIST_HEADER, level, d.toUint8Array());
}

// ============================================================================
// Step 3 — Shape / Image serialization
// ============================================================================

/**
 * 도형 또는 이미지 컨트롤을 emit.
 *
 * @param {RecordStreamWriter} rw
 * @param {number} level
 * @param {object} obj parser image (type='image') 또는 shape (type='shape')
 * @param {object} binIndex binaryItemIDRef → BIN_DATA idx 매핑
 */
function writeShapeControl(rw, level, obj, binIndex) {
  const isImage = obj.type === 'image';
  const shapeType = isImage ? 'picture' : (obj.shapeType || 'rectangle');
  const width = Math.max(1, toInt(obj.width, 10000));
  const height = Math.max(1, toInt(obj.height, 10000));

  // 1) CTRL_HEADER (71) — 'gso '
  const ch = new BinaryWriter();
  ch.writeCtrlId('gso ');
  // GSO 속성 비트 (최소값)
  let attr = 0;
  if (obj.treatAsChar || obj.position?.treatAsChar) attr |= 0x01;
  attr |= (1 << 17); // affectLSpacing
  attr |= (2 << 18); // allowOverlap
  attr |= (2 << 20); // width criteria
  attr |= (1 << 22); // height criteria
  ch.writeUint32(attr);
  ch.writeInt32(toInt(obj.position?.vertOffset, 0));
  ch.writeInt32(toInt(obj.position?.horzOffset, 0));
  ch.writeUint32(width);
  ch.writeUint32(height);
  ch.writeInt32(0); // z-order
  ch.writeInt16(0); // outMargin left
  ch.writeInt16(0); // outMargin right
  ch.writeInt16(0); // outMargin top
  ch.writeInt16(0); // outMargin bottom
  ch.writeUint32(0); // instId
  ch.writeUint32(0); // 캡션 방지
  ch.writeUint16(0); // 설명 문자열 길이
  rw.writeRecord(TAG_SEC.CTRL_HEADER, level + 1, ch.toUint8Array());

  // 2) SHAPE_COMPONENT (76) — 196 bytes (간소화 인덴티티 행렬)
  writeShapeComponent(rw, level + 2, shapeType, width, height);

  // 3) 도형 타입별 레코드
  if (isImage) {
    writeShapeComponentPicture(rw, level + 3, obj, width, height, binIndex);
  } else {
    writeShapeComponentByType(rw, level + 3, obj, shapeType, width, height);
  }
}

function shapeObjTagIdFromType(shapeType) {
  switch (shapeType) {
    case 'line': return TAG_SEC.SHAPE_COMPONENT_LINE;
    case 'rectangle': return TAG_SEC.SHAPE_COMPONENT_RECTANGLE;
    case 'ellipse': return TAG_SEC.SHAPE_COMPONENT_ELLIPSE;
    case 'arc': return TAG_SEC.SHAPE_COMPONENT_ARC;
    case 'polygon': return TAG_SEC.SHAPE_COMPONENT_POLYGON;
    case 'curve': return TAG_SEC.SHAPE_COMPONENT_CURVE;
    case 'picture': return TAG_SEC.SHAPE_COMPONENT_PICTURE;
    default: return TAG_SEC.SHAPE_COMPONENT_RECTANGLE;
  }
}

function shapeObjId4(shapeType) {
  // "$pic", "$rec", "$ell", "$lin", "$arc", "$pol", "$cur"
  const map = {
    picture: '$pic',
    rectangle: '$rec',
    ellipse: '$ell',
    line: '$lin',
    arc: '$arc',
    polygon: '$pol',
    curve: '$cur',
  };
  return map[shapeType] || '$rec';
}

function writeShapeComponent(rw, level, shapeType, width, height) {
  const d = new BinaryWriter();
  const id4 = shapeObjId4(shapeType);
  // shape obj id × 2 (8 bytes)
  d.writeUint8(id4.charCodeAt(0));
  d.writeUint8(id4.charCodeAt(1));
  d.writeUint8(id4.charCodeAt(2));
  d.writeUint8(id4.charCodeAt(3));
  d.writeUint8(id4.charCodeAt(0));
  d.writeUint8(id4.charCodeAt(1));
  d.writeUint8(id4.charCodeAt(2));
  d.writeUint8(id4.charCodeAt(3));
  // 좌표 / 스케일 / 크기 4쌍 (4+4+4+4+4+4+4 = 28 bytes)
  d.writeInt32(0); // xPos
  d.writeInt32(0); // yPos
  d.writeUint32(65536); // scale 100%
  d.writeUint32(width);
  d.writeUint32(height);
  d.writeUint32(width);
  d.writeUint32(height);
  // 추가 필드 12 + flags 4 = 16 bytes
  d.writeUint32(0);
  d.writeUint32(0);
  d.writeUint32(0);
  d.writeUint32(0x00010000);
  // 4개 변환 행렬 (6 + 6 + 4 + 2 doubles = 18 doubles = 144 bytes)
  // 1st: identity
  d.writeBytes(double8(1));
  d.writeBytes(double8(0));
  d.writeBytes(double8(0));
  d.writeBytes(double8(0));
  d.writeBytes(double8(1));
  d.writeBytes(double8(0));
  // 2nd: zero
  for (let i = 0; i < 6; i++) d.writeBytes(double8(0));
  // 3rd: 1,0,0,0
  d.writeBytes(double8(1));
  d.writeBytes(double8(0));
  d.writeBytes(double8(0));
  d.writeBytes(double8(0));
  // 4th: 1,0
  d.writeBytes(double8(1));
  d.writeBytes(double8(0));
  rw.writeRecord(TAG_SEC.SHAPE_COMPONENT, level, d.toUint8Array());
}

function double8(v) {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, v, true);
  return new Uint8Array(buf);
}

function writeShapeComponentPicture(rw, level, image, width, height, binIndex) {
  const d = new BinaryWriter();
  // 테두리 정보 (12 bytes)
  d.writeUint32(0); // color
  d.writeInt32(0); // width
  d.writeUint32(0); // 속성
  // padding (8 bytes)
  d.writeZeros(8);
  // 이미지 좌표 (24 bytes)
  d.writeUint32(width);
  d.writeUint32(0);
  d.writeUint32(width);
  d.writeUint32(height);
  d.writeUint32(0);
  d.writeUint32(height);
  // 클립 (16 bytes)
  d.writeInt32(0);
  d.writeInt32(0);
  d.writeInt32(width);
  d.writeInt32(height);
  // padding (11 bytes)
  d.writeZeros(11);
  // binDataId (1 byte)
  const key = String(image.binaryItemId || image.binaryItemIDRef || image.binId || '');
  const idx = binIndex && key in binIndex ? binIndex[key] : 0;
  d.writeUint8((idx + 1) & 0xff); // BIN 인덱스는 1-base
  // padding (2 bytes)
  d.writeZeros(2);
  // instId (4 bytes)
  d.writeUint32(0);
  // 밝기/명암/효과/알파 (4 bytes)
  d.writeInt8(0);
  d.writeInt8(0);
  d.writeUint8(0);
  d.writeUint8(0);
  // 추가 크기 (8 bytes)
  d.writeUint32(width);
  d.writeUint32(height);
  // 패딩 (1 byte)
  d.writeUint8(0);
  rw.writeRecord(TAG_SEC.SHAPE_COMPONENT_PICTURE, level, d.toUint8Array());
}

function writeShapeComponentByType(rw, level, shape, shapeType, width, height) {
  const tagId = shapeObjTagIdFromType(shapeType);
  const d = new BinaryWriter();
  // 공통 헤더: line color, line width, line style
  d.writeUint32(0); // line color
  d.writeInt32(0); // line width
  d.writeUint32(1); // line style SOLID
  if (shapeType === 'line') {
    // 두 점만 기록 (시작/끝) - 8 bytes
    d.writeInt32(0);
    d.writeInt32(0);
    d.writeInt32(width);
    d.writeInt32(height);
  } else if (shapeType === 'polygon' || shapeType === 'curve') {
    // 점 개수 + 각 점 좌표
    const pts = (shape.points && shape.points.length > 0) ? shape.points : [
      { x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height },
    ];
    d.writeUint32(pts.length);
    for (const p of pts) {
      d.writeInt32(toInt(p.x, 0));
      d.writeInt32(toInt(p.y, 0));
    }
    d.writeUint32(0); // fill type NONE
  } else if (shapeType === 'arc') {
    // 사각형 영역(8 × int32) + arc 시작/끝 각도(2 × int32) + fill (4)
    d.writeInt32(0);
    d.writeInt32(0);
    d.writeInt32(width);
    d.writeInt32(0);
    d.writeInt32(width);
    d.writeInt32(height);
    d.writeInt32(0);
    d.writeInt32(height);
    d.writeInt32(0); // 시작 각도
    d.writeInt32(360 * 100); // 끝 각도 (1/100도)
    d.writeUint32(0); // fill
  } else {
    // rectangle / ellipse: 4점 + 모서리 둥글기 + fill
    d.writeInt32(0);
    d.writeInt32(0);
    d.writeInt32(width);
    d.writeInt32(0);
    d.writeInt32(width);
    d.writeInt32(height);
    d.writeInt32(0);
    d.writeInt32(height);
    d.writeUint32(toInt(shape.borderRadius, 0)); // 모서리 둥글기 (사각형 전용; 타원도 같이 둠)
    d.writeUint32(0); // fill type NONE
  }
  rw.writeRecord(tagId, level, d.toUint8Array());
}

// ============================================================================
// Section paragraph dispatch
// ============================================================================

/**
 * 단락 1개를 Section 레코드 시퀀스로 직렬화. 단락 내 표/도형/이미지 컨트롤이
 * 있으면 PARA_HEADER 컨트롤 마스크에 비트를 켜고 본문 텍스트에 CTRL 문자를
 * 삽입한 뒤, 단락 직후에 CTRL_HEADER/* 시퀀스를 이어 emit 한다.
 *
 * @param {RecordStreamWriter} rw
 * @param {object} para
 * @param {number} paraId
 * @param {object[]} charStyles
 * @param {object} [binIndex] binaryItemIDRef → BinData index
 * @param {number} [level=0]
 */
function writeParagraph(rw, para, paraId, charStyles, binIndex = {}, level = 0) {
  // 텍스트 + per-run charShape 변경 추적 + 컨트롤 객체 수집
  const textCodes = [];
  const posShapes = [];
  const inlineControls = []; // {kind: 'tbl'|'gso', source}
  let currentShape = -1;
  let ctrlMask = 0;

  for (const run of para.runs || []) {
    if (!run) continue;
    // 표 컨트롤
    if (run.hasTable) {
      const tbl = (para.tables || [])[run.tableIndex];
      if (tbl) {
        textCodes.push(CTRL.INLINE_OBJ);
        ctrlMask |= CTRL_MASK.TABLE_OR_GSO;
        inlineControls.push({ kind: 'tbl', source: tbl });
      }
      continue;
    }
    // 이미지 컨트롤
    if (run.hasImage) {
      const img = (para.images || [])[run.imageIndex];
      if (img) {
        textCodes.push(CTRL.DRAWING_OBJ);
        ctrlMask |= CTRL_MASK.TABLE_OR_GSO;
        inlineControls.push({ kind: 'gso', source: img });
      }
      continue;
    }
    // 도형 컨트롤
    if (run.hasShape) {
      // para.shapes 는 push 순서. run 에 인덱스가 없으면 첫 미사용 shape 사용.
      const shapes = para.shapes || [];
      const idx = run.shapeIndex ?? findUnusedShapeIndex(shapes, inlineControls);
      const sh = shapes[idx];
      if (sh) {
        textCodes.push(CTRL.DRAWING_OBJ);
        ctrlMask |= CTRL_MASK.TABLE_OR_GSO;
        inlineControls.push({ kind: 'gso', source: sh });
      }
      continue;
    }
    if (run.type) continue; // 그 외 비-텍스트 런은 Step 1+ 범위 외
    const id = findCharShapeId(charStyles, run.style);
    if (id !== currentShape) {
      posShapes.push({ position: textCodes.length, charShapeId: id });
      currentShape = id;
    }
    const text = run.text || '';
    for (let i = 0; i < text.length; i++) textCodes.push(text.charCodeAt(i));
  }
  // 단락 끝 컨트롤 문자
  textCodes.push(CTRL.PARA_BREAK);
  if (posShapes.length === 0) posShapes.push({ position: 0, charShapeId: 0 });

  const charCount = textCodes.length;
  writeParaHeader(rw, level, charCount, paraId, ctrlMask);
  if (charCount > 0) {
    let utf16 = '';
    for (const c of textCodes) utf16 += String.fromCharCode(c);
    writeParaText(rw, level, utf16);
  }
  writeParaCharShape(rw, level, posShapes);
  writeParaLineSeg(rw, level, charCount);

  // 단락 직후에 컨트롤 시퀀스 emit
  for (const ctrl of inlineControls) {
    if (ctrl.kind === 'tbl') {
      writeTableControl(rw, level, ctrl.source, charStyles, binIndex);
    } else if (ctrl.kind === 'gso') {
      writeShapeControl(rw, level, ctrl.source, binIndex);
    }
  }
}

function findUnusedShapeIndex(shapes, used) {
  const usedSet = new Set(used.filter(c => c.kind === 'gso').map(c => c.source));
  for (let i = 0; i < shapes.length; i++) {
    if (!usedSet.has(shapes[i])) return i;
  }
  return 0;
}

function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Section 스트림 1개 생성.
 *
 * @param {object} section parser.js 의 section 객체
 * @param {object[]} charStyles DocInfo 에 emit 된 CharShape 풀
 * @param {object} [binIndex] binaryItemIDRef → BinData index
 */
export function buildSectionStream(section, charStyles, binIndex = {}) {
  const rw = new RecordStreamWriter();
  let paraId = 0;
  for (const el of section.elements || []) {
    if (el?.type === 'paragraph') {
      writeParagraph(rw, el, paraId++, charStyles, binIndex);
    } else if (el?.type === 'table') {
      // 표가 단락 밖 최상위 요소로 올 수도 있다. 빈 단락에 표 1개를 inline 으로 emit.
      const virtualPara = {
        runs: [{ hasTable: true, tableIndex: 0 }],
        tables: [el],
      };
      writeParagraph(rw, virtualPara, paraId++, charStyles, binIndex);
    }
  }
  // 빈 섹션이면 최소한 빈 단락 1개 추가 (뷰어 호환)
  if (paraId === 0) {
    writeParagraph(rw, { runs: [] }, 0, charStyles, binIndex);
  }
  return rw.toUint8Array();
}

// ============================================================================
// CFB assembly
// ============================================================================

function compressStream(bytes, level = 6) {
  // Raw deflate (zlib header 없음) — HWP 명세
  return pako.deflateRaw(bytes, { level });
}

function buildBinIndex(binDataList) {
  const map = {};
  for (let i = 0; i < binDataList.length; i++) {
    map[binDataList[i].key] = i;
  }
  return map;
}

/**
 * 변환 결과 통계
 * @typedef {{ inputBytes: number, outputBytes: number, sectionCount: number,
 *             charShapeCount: number, binDataCount: number,
 *             elapsedMs: number }} ConvertStats
 */

/**
 * Hwpx2Hwp.convert 의 결과 객체.
 *
 * @typedef {{ data: Uint8Array, stats: ConvertStats }} ConvertResult
 */

/**
 * 우리 컨버터의 진입점.
 *
 * @example
 *   const result = await Hwpx2Hwp.convert(hwpxBytes);
 *   // result.data → .hwp 바이너리 (Uint8Array)
 */
export class Hwpx2Hwp {
  /**
   * HWPX → HWP 변환.
   *
   * @param {Uint8Array | { sections: object[] }} input 원본 HWPX 바이너리
   *   또는 이미 파싱된 HWPXDocument
   * @param {object} [options]
   * @param {boolean} [options.compress=true] DocInfo/Section 스트림 압축 여부
   * @param {number} [options.compressionLevel=6] zlib 압축 레벨 (0~9)
   * @param {Map|Array|object} [options.binData] binItemID → { bytes, ext }
   *   외부에서 raw 이미지 바이트를 주입하는 사전. 부재 시 image.bytes / image.data 사용.
   * @returns {Promise<ConvertResult>}
   */
  static async convert(input, options = {}) {
    const start = Date.now();
    const opts = { compress: true, compressionLevel: 6, ...options };

    // 입력 정규화: Uint8Array 면 parser.js 로 파싱
    let doc;
    let inputBytes = 0;
    if (input instanceof Uint8Array) {
      inputBytes = input.length;
      // 지연 import 로 트리쉐이킹 친화
      const { SimpleHWPXParser } = await import('../core/parser.js');
      const parser = new SimpleHWPXParser();
      doc = await parser.parse(input);
    } else if (input && Array.isArray(input.sections)) {
      doc = input;
      inputBytes = 0; // 알 수 없음
    } else {
      throw new Error('Hwpx2Hwp.convert: input must be Uint8Array or parsed HWPXDocument');
    }

    // 1. DocInfo (+ BinData 수집)
    const binDataList = collectBinData(doc, { binData: opts.binData });
    const binIndex = buildBinIndex(binDataList);
    const { bytes: docInfoRaw, charStyles } = buildDocInfoStream(doc, { binDataList });
    const docInfoBytes = opts.compress
      ? compressStream(docInfoRaw, opts.compressionLevel)
      : docInfoRaw;

    // 2. Sections
    const sectionStreams = [];
    const sections = doc.sections && doc.sections.length > 0 ? doc.sections : [{ elements: [] }];
    for (const section of sections) {
      const raw = buildSectionStream(section, charStyles, binIndex);
      sectionStreams.push(opts.compress ? compressStream(raw, opts.compressionLevel) : raw);
    }

    // 3. CFB 컨테이너
    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', buildFileHeader({ compressed: opts.compress }));
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoBytes);
    for (let i = 0; i < sectionStreams.length; i++) {
      CFB.utils.cfb_add(cfb, `/BodyText/Section${i}`, sectionStreams[i]);
    }
    // BinData 스트림 (raw 이미지 바이트가 있을 때만 추가)
    for (let i = 0; i < binDataList.length; i++) {
      const bd = binDataList[i];
      if (!bd.bytes || !bd.bytes.length) continue;
      const fname = `BIN${String(i + 1).padStart(4, '0')}.${bd.ext || 'bin'}`;
      const data = opts.compress ? compressStream(bd.bytes, opts.compressionLevel) : bd.bytes;
      CFB.utils.cfb_add(cfb, `/BinData/${fname}`, data);
    }
    const out = CFB.write(cfb, { type: 'buffer' });
    const data = out instanceof Uint8Array ? out : new Uint8Array(out);

    return {
      data,
      stats: {
        inputBytes,
        outputBytes: data.length,
        sectionCount: sectionStreams.length,
        charShapeCount: charStyles.length,
        binDataCount: binDataList.length,
        elapsedMs: Date.now() - start,
      },
    };
  }

  /**
   * `convert` 의 short-hand. 통계 없이 바이너리만 반환.
   *
   * @param {Uint8Array | { sections: object[] }} input
   * @param {object} [options]
   * @returns {Promise<Uint8Array>}
   */
  static async convertSimple(input, options = {}) {
    const r = await Hwpx2Hwp.convert(input, options);
    return r.data;
  }
}

export default Hwpx2Hwp;

// 향후 확장:
//   - SHAPE_COMPONENT_OLE / 차트 / 수식 정밀 변환
//   - 양식 컨트롤 / 메모 / TrackChange
//   - BORDER_FILL 다양화 (cell 배경/테두리 정확도)
