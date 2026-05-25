/**
 * HWPX OLE (Object Linking and Embedding) Parser
 * ─────────────────────────────────────────────────────────────────────────────
 * HWPX BinData/ 디렉토리에 포함된 OLE 임베드 객체 (Excel / Word / PowerPoint /
 * 일반 EMF·WMF 미리보기) 를 정규화된 데이터 모델로 변환한다.
 *
 * 본 모듈은 CFB(Compound File Binary) 컨테이너 안에 들어 있는 다음 표준
 * 스트림만 메타데이터로 읽는다.
 *
 *  - CompObj   — OLE ClassName/UserType (ASCII length-prefixed 문자열)
 *               (실제 디스크 상에서는 SOH(0x01) 접두사로 저장될 수 있다)
 *  - EMF/WMF/PNG — 미리보기 메타파일/래스터 스트림 (있을 경우 우선 사용)
 *
 * 정규화된 출력 (OleData)
 *   {
 *     type: 'excel' | 'word' | 'powerpoint' | 'unknown',
 *     previewImage: Uint8Array | null,
 *     previewMimeType: string | null,
 *     metadata: {
 *       className: string,
 *       userType: string,
 *       fileSize: number,
 *       originalName: string,
 *       streams: string[]
 *     }
 *   }
 *
 * 보안 정책
 *   - 매크로/스크립트는 절대로 평가하거나 실행하지 않는다.
 *   - 본 모듈은 메타데이터와 사전 추출된 픽셀 미리보기만 노출한다.
 *
 * @module vanilla/ole/ole-parser
 * @version 1.0.0
 */

import CFB from 'cfb';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

// SOH (0x01) prefix used by standard OLE compound documents for control streams
const SOH = String.fromCharCode(0x01);

// ============================================================================
// Constants
// ============================================================================

export const OLE_EXTENSIONS = Object.freeze([
  'ole',
  'olexml',
  'xlsx',
  'xls',
  'docx',
  'doc',
  'pptx',
  'ppt',
  'emf',
  'wmf',
]);

const CLASSNAME_TYPE_MAP = Object.freeze([
  { match: /^excel\./i, type: 'excel' },
  { match: /^biff8$/i, type: 'excel' },
  { match: /^word\./i, type: 'word' },
  { match: /^msword$/i, type: 'word' },
  { match: /^powerpoint\./i, type: 'powerpoint' },
  { match: /^mspowerpoint$/i, type: 'powerpoint' },
]);

const EXTENSION_TYPE_MAP = Object.freeze({
  xlsx: 'excel',
  xls: 'excel',
  docx: 'word',
  doc: 'word',
  pptx: 'powerpoint',
  ppt: 'powerpoint',
});

// ============================================================================
// Public helpers
// ============================================================================

export function isOleBinData(pathOrName) {
  if (!pathOrName || typeof pathOrName !== 'string') return false;
  const lower = pathOrName.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) return false;
  const ext = lower.slice(dotIdx + 1);
  return OLE_EXTENSIONS.includes(ext);
}

export function inferOleTypeFromExtension(pathOrName) {
  if (!pathOrName || typeof pathOrName !== 'string') return 'unknown';
  const lower = pathOrName.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) return 'unknown';
  const ext = lower.slice(dotIdx + 1);
  if (ext === 'emf' || ext === 'wmf') return 'unknown';
  return EXTENSION_TYPE_MAP[ext] || 'unknown';
}

// ============================================================================
// Internal helpers
// ============================================================================

function looksLikeCfb(bytes) {
  if (!bytes || bytes.length < 8) return false;
  return (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

function looksLikeZip(bytes) {
  if (!bytes || bytes.length < 4) return false;
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * CFB FullPaths 를 직접 스캔하여 이름이 일치하는 첫 항목을 반환한다.
 * - 표준 OLE 의 SOH(0x01) prefix 와 일반 prefix 모두 매칭한다.
 * - 대소문자 무시.
 *
 * @param {{FullPaths: string[], FileIndex: Array}} container
 * @param {string} baseName  예: 'CompObj', 'EMF', 'WMF', 'PNG', 'Ole', 'Pic'
 * @returns {Object|null}
 */
function findStreamByName(container, baseName) {
  if (!container || !Array.isArray(container.FullPaths)) return null;
  const target = baseName.toLowerCase();
  for (let i = 0; i < container.FullPaths.length; i++) {
    const fullPath = container.FullPaths[i];
    if (!fullPath) continue;
    let tail = fullPath.split('/').pop() || '';
    // strip SOH prefix if present
    if (tail.charCodeAt(0) === 0x01) tail = tail.slice(1);
    if (tail.toLowerCase() === target) {
      return container.FileIndex[i] || null;
    }
  }
  return null;
}

/**
 * CompObj 스트림에서 ClassName / UserType 을 읽는다.
 *
 * 레이아웃 요약: 28-byte header → length-prefixed (LE u32 + ASCII + 0x00) * 3
 *   [0] UserType, [1] ClipboardFormat, [2] ProgID
 *
 * @param {Uint8Array|Buffer|number[]} content
 * @returns {{ userType: string, className: string }}
 */
export function parseCompObjStream(content) {
  const result = { userType: '', className: '' };
  if (!content) return result;
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  if (bytes.length < 32) return result;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 28;
  const strings = [];

  for (let i = 0; i < 3 && pos + 4 <= bytes.length; i++) {
    const len = view.getUint32(pos, true);
    pos += 4;
    if (len === 0 || len === 0xffffffff) continue;
    if (len > 1024 || len > bytes.length - pos) break;

    let end = pos + len;
    while (end > pos && bytes[end - 1] === 0x00) end--;
    let s = '';
    for (let j = pos; j < end; j++) s += String.fromCharCode(bytes[j]);
    strings.push(s);
    pos += len;
  }

  if (strings.length >= 1) result.userType = strings[0].trim();
  if (strings.length >= 3) result.className = strings[2].trim();
  if (!result.className && strings.length >= 2) {
    const candidate = strings[1].trim();
    if (/^[A-Za-z][A-Za-z0-9.]+$/.test(candidate)) {
      result.className = candidate;
    }
  }
  return result;
}

/**
 * ClassName / UserType 으로부터 표준화된 type 분류를 결정한다.
 */
export function classifyOleType(className, userType) {
  const sources = [className, userType].filter(Boolean);
  for (const src of sources) {
    for (const rule of CLASSNAME_TYPE_MAP) {
      if (rule.match.test(src)) return rule.type;
    }
    if (/엑셀|excel/i.test(src)) return 'excel';
    if (/워드|word(?!pad)/i.test(src)) return 'word';
    if (/파워포인트|powerpoint|슬라이드/i.test(src)) return 'powerpoint';
  }
  return 'unknown';
}

/**
 * CFB 컨테이너에서 미리보기 메타파일(EMF/WMF/PNG) 스트림을 찾는다.
 */
export function findPreviewStream(container) {
  if (!container || !Array.isArray(container.FileIndex)) return null;

  const candidates = [
    { base: 'EMF', mime: 'image/x-emf' },
    { base: 'WMF', mime: 'image/x-wmf' },
    { base: 'PNG', mime: 'image/png' },
    { base: 'Pic', mime: 'image/x-wmf' },
  ];

  for (const { base, mime } of candidates) {
    const entry = findStreamByName(container, base);
    if (entry && entry.content && entry.content.length > 0) {
      const bytes =
        entry.content instanceof Uint8Array ? entry.content : new Uint8Array(entry.content);
      return { bytes, mimeType: mime };
    }
  }
  return null;
}

// ============================================================================
// Main entry
// ============================================================================

/**
 * BinData OLE 항목 1건을 정규화된 OleData 로 변환한다.
 */
/**
 * OLE 매크로 스트림 감지 패턴.
 * 코드는 절대 읽지 않고 스트림 이름/경로만 확인한다.
 */
const OLE_MACRO_PATTERNS = Object.freeze([
  { pattern: /(^|\/)VBA(\/|$)/i, kind: 'vba', desc: 'VBA project storage' },
  { pattern: /_VBA_PROJECT_CUR/i, kind: 'vba', desc: 'VBA project current' },
  { pattern: /_VBA_PROJECT/i, kind: 'vba', desc: 'VBA project' },
  { pattern: /vbaProject\.bin/i, kind: 'vba', desc: 'OOXML vbaProject.bin' },
  { pattern: /(^|\/)Macros(\/|$)/i, kind: 'macros', desc: 'Macros storage' },
  { pattern: /Excel 4\.0 Macros/i, kind: 'xl4-macros', desc: 'Excel 4.0 macro sheet' },
  { pattern: /_Macros/i, kind: 'legacy-macros', desc: 'Legacy macro storage' },
  { pattern: /WordDocument\/macros/i, kind: 'word-macros', desc: 'Word legacy macros' },
  { pattern: /PPT\/macros/i, kind: 'ppt-macros', desc: 'PowerPoint macros' },
]);

/**
 * CFB FullPaths 목록을 스캔해 매크로 스트림 존재 여부를 판단한다.
 * 코드/콘텐츠는 절대 디코딩하지 않으며, 경로만 매칭한다.
 *
 * @param {string[]} fullPaths
 * @returns {{present: boolean, streams: string[], indicators: string[]}}
 */
export function detectOleMacroStreams(fullPaths) {
  const result = { present: false, streams: [], indicators: [] };
  if (!Array.isArray(fullPaths) || fullPaths.length === 0) return result;

  const indicatorSet = new Set();
  for (const p of fullPaths) {
    if (typeof p !== 'string') continue;
    for (const { pattern, kind, desc } of OLE_MACRO_PATTERNS) {
      if (pattern.test(p)) {
        result.present = true;
        if (!result.streams.includes(p)) {
          result.streams.push(p);
        }
        if (!indicatorSet.has(kind)) {
          indicatorSet.add(kind);
          result.indicators.push(`${kind} (${desc})`);
        }
        break; // 한 경로당 하나의 indicator
      }
    }
  }
  return result;
}

export function parseOle(input, filename) {
  if (!input) return null;

  let bytes;
  let originalName = '';
  if (input instanceof Uint8Array) {
    bytes = input;
    originalName = filename || '';
  } else if (typeof input === 'object' && input.data) {
    bytes = input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data);
    originalName = input.filename || input.path || filename || '';
  } else {
    return null;
  }

  if (originalName.includes('/')) {
    originalName = originalName.split('/').pop();
  }

  const fileSize = bytes.byteLength;
  const baseMeta = {
    className: '',
    userType: '',
    fileSize,
    originalName,
    streams: [],
  };

  // Case 1: 단독 EMF/WMF 미리보기 — CFB 가 아니라 raw 메타파일
  if (originalName) {
    const lower = originalName.toLowerCase();
    if (lower.endsWith('.emf')) {
      return {
        type: 'unknown',
        previewImage: bytes,
        previewMimeType: 'image/x-emf',
        macroInfo: { present: false, streams: [], indicators: [] },
        metadata: baseMeta,
      };
    }
    if (lower.endsWith('.wmf')) {
      return {
        type: 'unknown',
        previewImage: bytes,
        previewMimeType: 'image/x-wmf',
        macroInfo: { present: false, streams: [], indicators: [] },
        metadata: baseMeta,
      };
    }
  }

  // Case 2: OOXML zip (xlsx/docx/pptx)
  if (looksLikeZip(bytes)) {
    return {
      type: inferOleTypeFromExtension(originalName),
      previewImage: null,
      previewMimeType: null,
      macroInfo: { present: false, streams: [], indicators: [] },
      metadata: { ...baseMeta },
    };
  }

  // Case 3: CFB compound — CompObj 와 미리보기 스트림을 추출
  if (!looksLikeCfb(bytes)) {
    return {
      type: inferOleTypeFromExtension(originalName),
      previewImage: null,
      previewMimeType: null,
      macroInfo: { present: false, streams: [], indicators: [] },
      metadata: baseMeta,
    };
  }

  let container;
  try {
    container = CFB.read(bytes, { type: 'array' });
  } catch (err) {
    logger.warn?.('[OLE] CFB.read failed:', err?.message || err);
    return {
      type: inferOleTypeFromExtension(originalName),
      previewImage: null,
      previewMimeType: null,
      macroInfo: { present: false, streams: [], indicators: [] },
      metadata: baseMeta,
    };
  }

  const streams = Array.isArray(container?.FullPaths) ? container.FullPaths.slice() : [];

  let className = '';
  let userType = '';
  try {
    const compObjEntry = findStreamByName(container, 'CompObj');
    if (compObjEntry && compObjEntry.content) {
      const parsed = parseCompObjStream(compObjEntry.content);
      className = parsed.className;
      userType = parsed.userType;
    }
  } catch (err) {
    logger.warn?.('[OLE] CompObj parse failed:', err?.message || err);
  }

  let type = classifyOleType(className, userType);
  if (type === 'unknown') {
    type = inferOleTypeFromExtension(originalName);
  }

  const preview = findPreviewStream(container);
  const macroInfo = detectOleMacroStreams(streams);

  return {
    type,
    previewImage: preview ? preview.bytes : null,
    previewMimeType: preview ? preview.mimeType : null,
    macroInfo,
    metadata: {
      className,
      userType,
      fileSize,
      originalName,
      streams,
    },
  };
}

// ============================================================================
// Serialization (skeleton)
// ============================================================================

/**
 * OleData → CFB Uint8Array 직렬화 (skeleton).
 *
 * 최소 형태로 CompObj + 미리보기 스트림을 포함한 CFB 컨테이너를 만든다.
 * HWP 본문 트랙(I)으로의 통합은 후속 작업이며, 본 함수는 인터페이스만 보장한다.
 */
export function serializeOLE(oleData) {
  const cfb = CFB.utils.cfb_new();
  const className = oleData?.metadata?.className || '';
  const userType = oleData?.metadata?.userType || '';

  const compObjBytes = buildCompObjBytes(userType, className);
  CFB.utils.cfb_add(cfb, '/' + SOH + 'CompObj', compObjBytes);

  if (oleData?.previewImage && oleData.previewImage.length > 0) {
    const mime = oleData.previewMimeType || '';
    const name = mime.includes('emf') ? '/EMF' : mime.includes('wmf') ? '/WMF' : '/PNG';
    CFB.utils.cfb_add(cfb, name, oleData.previewImage);
  }

  const out = CFB.write(cfb, { type: 'array' });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

function buildCompObjBytes(userType, className) {
  const header = new Uint8Array([
    0x01, 0x00, 0xfe, 0xff, 0x03, 0x0a, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  const enc = str => {
    if (!str) return new Uint8Array(4);
    const out = new Uint8Array(4 + str.length + 1);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, str.length + 1, true);
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      out[4 + i] = code < 0x80 ? code : 0x3f;
    }
    out[4 + str.length] = 0x00;
    return out;
  };

  const userBytes = enc(userType);
  const fmtBytes = new Uint8Array(4);
  const progBytes = enc(className);

  const total = header.length + userBytes.length + fmtBytes.length + progBytes.length;
  const buf = new Uint8Array(total);
  let off = 0;
  buf.set(header, off);
  off += header.length;
  buf.set(userBytes, off);
  off += userBytes.length;
  buf.set(fmtBytes, off);
  off += fmtBytes.length;
  buf.set(progBytes, off);
  return buf;
}
