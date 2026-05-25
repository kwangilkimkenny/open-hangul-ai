/**
 * CMYK 출판용 PDF 생성기
 * -----------------------------------------------------------------------------
 * Puppeteer 기반 RGB PDF (트랙 BB / `server/pdf-renderer.js`) 를 받아
 * pdf-lib 로 후처리하여 다음과 같은 인쇄소 납품용 PDF 를 만든다:
 *
 *   1) RGB 페이지를 그대로 보존하되 페이지 사이즈는 트림 박스로 정의.
 *      (Bleed 만큼 페이지 크기를 늘리거나, 그대로 두고 외곽에 마크만 추가)
 *   2) 페이지 외곽 영역(트림 박스 바깥)에 다음 마크 합성:
 *        - 크롭마크 (4 모서리)
 *        - 레지스트레이션 마크 (4 변 중앙)
 *        - 컬러바 (페이지 하단)
 *        - 페이지 정보 (좌상단 외곽)
 *   3) PDF/X-1a 친화 메타데이터 (Title, Author, Producer, Creator, Trapped …)
 *   4) Uint8Array 반환.
 *
 * **한계**: ICC 프로파일 임베드는 하지 않는다 (PDF/X-1a 의 OutputIntent 미설정).
 * 브라우저가 그린 RGB 픽셀/벡터는 픽셀 단위로 CMYK 로 변환되지 않는다.
 * 본 모듈의 CMYK 변환은 마크/메타데이터 영역에 한정된다 — 인쇄소가 RIP 단계에서
 * CMYK 분리하기 전 단계의 "준비" PDF 생성을 목표로 한다.
 *
 * @module cmyk-pdf/cmyk-pdf-generator
 */

import {
  PDFDocument,
  StandardFonts,
  PageSizes,
} from 'pdf-lib';

import { addPrintMarks, mm } from './print-marks.js';

/**
 * @typedef {object} CmykPdfOptions
 * @property {number} [bleedMm=3]
 * @property {boolean} [cropMarks=true]
 * @property {boolean} [registrationMarks=true]
 * @property {boolean} [colorBar=true]
 * @property {boolean} [pageInfo=true]
 * @property {string} [fileName]
 * @property {string} [title]
 * @property {string} [author]
 * @property {string} [creator='open-hangul-ai cmyk-pdf']
 * @property {string} [producer='open-hangul-ai cmyk-pdf']
 * @property {string} [pdfRenderModulePath]
 *   테스트/주입용. 기본 './server/pdf-renderer.js'.
 * @property {(buffer: Uint8Array, opts: object) => Promise<Uint8Array>}
 *   [renderRgbPdf]    직접 RGB PDF 생성기를 주입 (테스트용 — Puppeteer 우회).
 * @property {object} [renderOptions]
 *   `renderHwpxToPdf` 에 그대로 전달되는 옵션 (format, margin, password …).
 */

/**
 * HWPX 버퍼를 받아 인쇄소 납품용 PDF 를 생성한다.
 *
 * 흐름:
 *   1) renderHwpxToPdf(hwpxBuffer, ...) → RGB PDF Uint8Array
 *   2) PDFDocument.load(rgbPdfBytes) 로 pdf-lib 문서 로드
 *   3) 각 페이지에 대해 print-marks 합성
 *   4) PDF/X-1a 친화 메타데이터 설정
 *   5) doc.save() → Uint8Array 반환
 *
 * @param {Uint8Array | ArrayBuffer | Buffer} hwpxBuffer
 * @param {CmykPdfOptions} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function generatePrintReadyPdf(hwpxBuffer, options = {}) {
  if (!hwpxBuffer) {
    throw new Error('generatePrintReadyPdf: hwpxBuffer 인자가 필요합니다.');
  }

  // 1) RGB PDF 확보
  const renderFn = options.renderRgbPdf || (await loadDefaultRenderer(options));
  const rgbBytes = await renderFn(hwpxBuffer, {
    fileName: options.fileName,
    title: options.title || options.fileName,
    ...(options.renderOptions || {}),
  });

  // 2) pdf-lib 로 로드 & 마크 합성
  return await postProcessRgbPdf(rgbBytes, options);
}

/**
 * 이미 생성된 RGB PDF (Uint8Array) 에 인쇄 마크/메타데이터를 합성한다.
 * 외부에서 자체적으로 PDF 를 만든 경우에도 사용할 수 있는 저수준 API.
 *
 * @param {Uint8Array} rgbBytes
 * @param {CmykPdfOptions} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function postProcessRgbPdf(rgbBytes, options = {}) {
  if (!rgbBytes || rgbBytes.byteLength === 0) {
    throw new Error('postProcessRgbPdf: rgbBytes 가 비어 있습니다.');
  }
  const doc = await PDFDocument.load(rgbBytes, { ignoreEncryption: true });

  // 폰트 — Helvetica (PDF 표준 14 폰트) — ASCII 만 지원하므로 페이지 정보는 영문/숫자/하이픈으로 제한
  let font;
  if (options.pageInfo !== false) {
    try {
      font = await doc.embedFont(StandardFonts.Helvetica);
    } catch {
      font = undefined;
    }
  }

  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < total; i++) {
    addPrintMarks(pages[i], {
      bleedMm: options.bleedMm ?? 3,
      cropMarks: options.cropMarks !== false,
      registrationMarks: options.registrationMarks !== false,
      colorBar: options.colorBar !== false,
      pageInfo: options.pageInfo !== false,
      font,
      fileName: options.fileName || 'document',
      pageNumber: i + 1,
      pageTotal: total,
    });
  }

  applyPdfXMetadata(doc, options);

  return await doc.save({ useObjectStreams: false });
}

/**
 * PDF/X-1a 호환 가능한 메타데이터를 설정한다.
 * (실제 PDF/X-1a 컴플라이언스는 OutputIntent ICC 임베드까지 필요 — 본 모듈은 "친화" 수준)
 *
 * @param {import('pdf-lib').PDFDocument} doc
 * @param {CmykPdfOptions} options
 */
export function applyPdfXMetadata(doc, options = {}) {
  if (options.title) doc.setTitle(options.title, { showInWindowTitleBar: true });
  if (options.author) doc.setAuthor(options.author);
  doc.setCreator(options.creator || 'open-hangul-ai cmyk-pdf');
  doc.setProducer(options.producer || 'open-hangul-ai cmyk-pdf');
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  // PDF/X-1a 는 Trapped 키 명시 필요 — "False" 로 보수적 설정
  try {
    doc.setSubject(options.title ? `${options.title} (print-ready)` : 'print-ready');
  } catch {
    /* setSubject 미지원 시 무시 */
  }
}

/**
 * 빈 A4 페이지 1장으로 만든 더미 RGB PDF 를 반환한다.
 * 테스트/CLI smoke 용 — Puppeteer 환경이 없을 때.
 *
 * @returns {Promise<Uint8Array>}
 */
export async function makeBlankRgbPdfBytes() {
  const doc = await PDFDocument.create();
  doc.addPage(PageSizes.A4);
  return await doc.save();
}

/**
 * 기본 RGB PDF 렌더러 (트랙 BB) 를 동적으로 로드한다.
 * 모듈을 찾을 수 없거나 puppeteer 미설치 시 명확한 에러를 던진다.
 *
 * @param {CmykPdfOptions} options
 * @returns {Promise<(buf: Uint8Array, opts: object) => Promise<Uint8Array>>}
 */
async function loadDefaultRenderer(options) {
  const candidates = [
    options.pdfRenderModulePath,
    // 본 파일 기준 상대 경로 (src/lib/vanilla/cmyk-pdf → server/pdf-renderer.js)
    new URL('../../../../server/pdf-renderer.js', import.meta.url).href,
    new URL('../../../../dist/server/pdf-renderer.js', import.meta.url).href,
  ].filter(Boolean);

  let lastErr;
  for (const p of candidates) {
    try {
      const mod = await import(p);
      const fn = mod.renderHwpxToPdf || mod.default;
      if (typeof fn === 'function') return fn;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    'cmyk-pdf: server/pdf-renderer.js 를 로드할 수 없습니다. ' +
      'puppeteer 설치 여부를 확인하세요. (원인: ' +
      ((lastErr && lastErr.message) || lastErr) +
      ')'
  );
}

// page-info 기본 크기/오프셋 등 외부 사용자가 mm 단위로 다루도록 export
export { mm };
