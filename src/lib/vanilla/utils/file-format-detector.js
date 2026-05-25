/**
 * 파일 포맷 매직 넘버 감지 유틸
 * ─────────────────────────────────────────────────────────────────────────────
 * R4 리뷰 후속: ZIP/CFB/EMF/WMF/이미지 시그니처가 여러 모듈에 산재되어 있던
 * 문제를 해결하기 위해 단일 카탈로그로 통합한다.
 *
 * 이 모듈은 *순수 함수*만 노출하며, 파싱이나 외부 의존성을 가지지 않는다.
 * 따라서 워커, 브라우저, Node 환경 모두에서 안전하게 사용할 수 있다.
 *
 * 사용 예
 *   import { detectFormat, isZip, MAGIC_NUMBERS } from '../utils/file-format-detector.js';
 *   if (isZip(bytes)) { ... }
 *   const fmt = detectFormat(bytes); // 'zip' | 'cfb' | ...
 *
 * @module vanilla/utils/file-format-detector
 */

/**
 * 매직 넘버 카탈로그. 각 항목은 파일 시작부 N바이트와 정확히 일치해야 한다.
 * - ZIP    : OOXML(.xlsx/.docx/.pptx), .hwpx, 일반 zip
 * - CFB    : OLE2 컴파운드 파일(.xls/.doc/.ppt, .hwp 5.x)
 * - EMF    : Enhanced Metafile (0x01 00 00 00, "EMF" record header)
 * - WMF    : Windows Metafile Placeable header (Aldus)
 * - PNG    : 표준 PNG 시그니처
 * - JPEG   : JPEG SOI 마커 (3바이트만 일치하면 충분)
 * - PDF    : "%PDF" ASCII 시그니처
 *
 * @type {Record<string, number[]>}
 */
export const MAGIC_NUMBERS = Object.freeze({
  ZIP: [0x50, 0x4b, 0x03, 0x04],
  CFB: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  EMF: [0x01, 0x00, 0x00, 0x00],
  WMF: [0xd7, 0xcd, 0xc6, 0x9a],
  PNG: [0x89, 0x50, 0x4e, 0x47],
  JPEG: [0xff, 0xd8, 0xff],
  PDF: [0x25, 0x50, 0x44, 0x46],
});

/**
 * bytes 의 앞부분이 magic 와 정확히 일치하는지 검사.
 * @param {Uint8Array|null|undefined} bytes
 * @param {number[]} magic
 * @returns {boolean}
 */
function startsWithMagic(bytes, magic) {
  if (!bytes || bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

/** ZIP(OOXML/HWPX) 시그니처? */
export function isZip(bytes) {
  return startsWithMagic(bytes, MAGIC_NUMBERS.ZIP);
}

/** CFB(OLE2) 시그니처? */
export function isCfb(bytes) {
  return startsWithMagic(bytes, MAGIC_NUMBERS.CFB);
}

/** EMF 시그니처? */
export function isEmf(bytes) {
  return startsWithMagic(bytes, MAGIC_NUMBERS.EMF);
}

/** WMF Placeable 시그니처? */
export function isWmf(bytes) {
  return startsWithMagic(bytes, MAGIC_NUMBERS.WMF);
}

/** PNG 시그니처? */
export function isPng(bytes) {
  return startsWithMagic(bytes, MAGIC_NUMBERS.PNG);
}

/** JPEG SOI 마커? */
export function isJpeg(bytes) {
  return startsWithMagic(bytes, MAGIC_NUMBERS.JPEG);
}

/** PDF 시그니처? */
export function isPdf(bytes) {
  return startsWithMagic(bytes, MAGIC_NUMBERS.PDF);
}

/**
 * bytes 의 매직 넘버를 분석해 포맷 키워드를 반환.
 *
 * 우선순위는 *고유성*이 높은 순. CFB(8바이트)·PNG(4바이트)·WMF(4바이트)
 * 처럼 충돌 가능성이 낮은 시그니처를 먼저 검사한다. EMF 의 4바이트 시그니처는
 * 다른 바이너리 패턴과 우연 일치할 수 있으므로 마지막으로 확인한다.
 *
 * @param {Uint8Array} bytes
 * @returns {'zip'|'cfb'|'png'|'jpeg'|'pdf'|'wmf'|'emf'|'unknown'}
 */
export function detectFormat(bytes) {
  if (!bytes || bytes.length === 0) return 'unknown';
  if (isCfb(bytes)) return 'cfb';
  if (isPng(bytes)) return 'png';
  if (isPdf(bytes)) return 'pdf';
  if (isJpeg(bytes)) return 'jpeg';
  if (isZip(bytes)) return 'zip';
  if (isWmf(bytes)) return 'wmf';
  if (isEmf(bytes)) return 'emf';
  return 'unknown';
}

/**
 * Office OLE 컨테이너 분류기.
 *
 * - 'ooxml'   : ZIP (xlsx/docx/pptx)
 * - 'cfb'     : OLE2 컴파운드 (xls/doc/ppt)
 * - 'metafile': EMF / WMF 미리보기
 * - 'unknown' : 그 외
 *
 * `ole-content-decoder` 가 OLE 콘텐츠 분기에 사용하던 `detectOleContainer`
 * 로직을 단일 유틸로 이관한 결과다.
 *
 * @param {Uint8Array} bytes
 * @returns {'ooxml'|'cfb'|'metafile'|'unknown'}
 */
export function detectOleContainerFormat(bytes) {
  const fmt = detectFormat(bytes);
  if (fmt === 'zip') return 'ooxml';
  if (fmt === 'cfb') return 'cfb';
  if (fmt === 'emf' || fmt === 'wmf') return 'metafile';
  return 'unknown';
}
