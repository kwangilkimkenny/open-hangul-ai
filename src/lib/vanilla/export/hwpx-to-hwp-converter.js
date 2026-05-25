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
 * Step 1 (지금 구현): 문단 + UTF-16 텍스트 런 + 기본 글자 서식 (bold/italic/색상)
 *   - DocInfo: DOCUMENT_PROPERTIES, ID_MAPPINGS, FACE_NAME(기본 폰트 1개),
 *     CHAR_SHAPE(기본 1개 + 옵션 색/굵기 1개), PARA_SHAPE, STYLE 만 emit.
 *   - BodyText/Section0: PARA_HEADER, PARA_TEXT, PARA_CHAR_SHAPE, PARA_LINE_SEG
 *     레코드만 emit.
 *   - CFB 컨테이너에 /FileHeader(40B), /DocInfo, /BodyText/Section0 추가.
 *
 * Step 2 (다음): 표 / TBL 컨트롤  ─ 현재는 TODO.
 * Step 3 (다음): 이미지 / 도형 / OLE  ─ 현재는 TODO.
 *
 * 의도적 제외
 * ------------
 *   - HWP 매크로, OLE 오브젝트, DRM/암호화
 *   - SummaryInformation 스트림 (대부분의 뷰어가 옵션 처리)
 *   - 변경 추적, 메모, 양식
 *
 * 참고: HWP 5.0 명세 (Tag ID/레코드 헤더 구조)
 *   https://cdn.hancom.com/link/docs/한글문서파일형식_5.0_revision1.3.pdf
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
};

/** HWP 컨트롤 문자 */
const CTRL = {
  PARA_BREAK: 0x0d,
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
 */
function collectCharStyles(hwpxDoc) {
  // 기본 CharShape 1 개를 항상 0번에 둔다.
  const styles = [{ bold: false, italic: false, colorHex: '#000000', fontSize: 1000 }];
  const seen = new Map();
  seen.set(styleKey(styles[0]), 0);

  for (const section of hwpxDoc.sections || []) {
    for (const el of section.elements || []) {
      if (el?.type !== 'paragraph') continue;
      for (const run of el.runs || []) {
        if (!run || run.type) continue; // 텍스트 런만
        const s = normalizeStyle(run.style);
        const k = styleKey(s);
        if (!seen.has(k)) {
          seen.set(k, styles.length);
          styles.push(s);
        }
      }
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

/**
 * DocInfo 스트림을 만든다.
 * @param {object} hwpxDoc parser.js HWPXDocument shape
 * @returns {{ bytes: Uint8Array, charStyles: object[] }}
 */
export function buildDocInfoStream(hwpxDoc) {
  const { styles: charStyles } = collectCharStyles(hwpxDoc);
  const rw = new RecordStreamWriter();
  const sectionCount = (hwpxDoc.sections && hwpxDoc.sections.length) || 1;

  writeDocumentProperties(rw, sectionCount);
  writeIdMappings(rw, {
    binData: 0,
    fontPerLang: [1, 1, 1, 1, 1, 1, 1],
    borderFill: 1,
    charShape: charStyles.length,
    tabDef: 0,
    numbering: 0,
    bullet: 0,
    paraShape: 1,
    style: 1,
  });
  // FACE_NAME × 7 (모든 언어에 같은 폰트)
  for (let i = 0; i < 7; i++) writeFaceName(rw, '함초롬바탕');
  writeBorderFill(rw);
  for (const s of charStyles) writeCharShape(rw, s);
  writeParaShape(rw);
  writeStyle(rw);
  return { bytes: rw.toUint8Array(), charStyles };
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

function writeParaHeader(rw, charCount, paraId) {
  const d = new BinaryWriter();
  d.writeUint32(charCount); // 글자 수 (컨트롤 마스크 비트 미사용)
  d.writeUint32(0); // 컨트롤 마스크
  d.writeUint16(0); // ParaShape ID
  d.writeUint8(0); // Style ID
  d.writeUint8(0); // 단/페이지 나눔
  d.writeUint16(1); // CharShape 개수 (최소 1)
  d.writeUint16(0); // RangeTag 개수
  d.writeUint16(1); // 줄 세그먼트 개수 (최소 1)
  d.writeUint32(paraId);
  d.writeUint16(0); // 변경추적 병합 ID
  rw.writeRecord(TAG_SEC.PARA_HEADER, 0, d.toUint8Array());
}

function writeParaText(rw, text) {
  const d = new BinaryWriter();
  d.writeUtf16LE(text);
  rw.writeRecord(TAG_SEC.PARA_TEXT, 0, d.toUint8Array());
}

function writeParaCharShape(rw, posShapes) {
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
  rw.writeRecord(TAG_SEC.PARA_CHAR_SHAPE, 0, d.toUint8Array());
}

function writeParaLineSeg(rw, charCount) {
  // HWP 명세 표 51: 줄 세그먼트 = 36바이트
  // 그러나 5.0 일부 구현은 32바이트, 상위호환을 위해 정확히 36바이트 emit.
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
  rw.writeRecord(TAG_SEC.PARA_LINE_SEG, 0, d.toUint8Array());
}

/**
 * 단락 1개를 Section 레코드 시퀀스로 직렬화.
 */
function writeParagraph(rw, para, paraId, charStyles) {
  // 텍스트 + per-run charShape 변경 추적
  const textCodes = [];
  const posShapes = [];
  let currentShape = -1;
  for (const run of para.runs || []) {
    if (!run || run.type) continue; // Step 1: 텍스트 런만
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
  writeParaHeader(rw, charCount, paraId);
  if (charCount > 0) {
    let utf16 = '';
    for (const c of textCodes) utf16 += String.fromCharCode(c);
    writeParaText(rw, utf16);
  }
  writeParaCharShape(rw, posShapes);
  writeParaLineSeg(rw, charCount);
}

/**
 * Section 스트림 1개 생성.
 *
 * @param {object} section parser.js 의 section 객체
 * @param {object[]} charStyles DocInfo 에 emit 된 CharShape 풀
 */
export function buildSectionStream(section, charStyles) {
  const rw = new RecordStreamWriter();
  let paraId = 0;
  for (const el of section.elements || []) {
    if (el?.type !== 'paragraph') continue;
    writeParagraph(rw, el, paraId++, charStyles);
  }
  // 빈 섹션이면 최소한 빈 단락 1개 추가 (뷰어 호환)
  if (paraId === 0) {
    writeParagraph(rw, { runs: [] }, 0, charStyles);
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

/**
 * 변환 결과 통계
 * @typedef {{ inputBytes: number, outputBytes: number, sectionCount: number,
 *             charShapeCount: number, elapsedMs: number }} ConvertStats
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

    // 1. DocInfo
    const { bytes: docInfoRaw, charStyles } = buildDocInfoStream(doc);
    const docInfoBytes = opts.compress
      ? compressStream(docInfoRaw, opts.compressionLevel)
      : docInfoRaw;

    // 2. Sections
    const sectionStreams = [];
    const sections = doc.sections && doc.sections.length > 0 ? doc.sections : [{ elements: [] }];
    for (const section of sections) {
      const raw = buildSectionStream(section, charStyles);
      sectionStreams.push(opts.compress ? compressStream(raw, opts.compressionLevel) : raw);
    }

    // 3. CFB 컨테이너
    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, '/FileHeader', buildFileHeader({ compressed: opts.compress }));
    CFB.utils.cfb_add(cfb, '/DocInfo', docInfoBytes);
    for (let i = 0; i < sectionStreams.length; i++) {
      CFB.utils.cfb_add(cfb, `/BodyText/Section${i}`, sectionStreams[i]);
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

// TODO (Step 2): 표 직렬화
//   - PARA 안의 hasTable 런을 만나면 CTRL_CHAR.INLINE_OBJ (0x18) 삽입
//   - CTRL_HEADER(71) + TABLE(77) 레코드 + 셀별 LIST_HEADER(72) 시퀀스 생성
//   - PARA_HEADER 의 ctrl mask 에 0x800 비트 설정
//
// TODO (Step 3): 이미지 / 도형
//   - BinData 항목을 /BinData/BINxxxx.{ext} 스트림으로 추가 (필요시 압축)
//   - SHAPE_COMPONENT(76) + SHAPE_COMPONENT_PICTURE(85) 직렬화
//
// TODO (확장): 양식 컨트롤 / 메모 / TrackChange 스켈레톤
//   - hwp2hwpx-js 의 양식/메모 파서를 역방향으로 호출 (NumberingWriter 등 미보유 영역)
//   - 단계적 도입 예정
