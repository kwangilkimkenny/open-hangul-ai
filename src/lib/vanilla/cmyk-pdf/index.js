/**
 * cmyk-pdf — 출판/인쇄용 CMYK PDF 생성 모듈 진입점.
 *
 * 주요 API:
 *   - generatePrintReadyPdf(hwpxBuffer, options)
 *       HWPX → 인쇄 마크 + 메타데이터 추가된 PDF (Uint8Array)
 *   - postProcessRgbPdf(rgbBytes, options)
 *       이미 생성된 RGB PDF 바이트에 인쇄 마크/메타만 합성
 *   - rgbToCmyk / hexToCmyk / parseColorString / cmykToRgb
 *   - addPrintMarks / addCropMarks / addRegistrationMarks / addColorBar / addPageInfo
 *
 * 본 모듈은 다른 트랙(ole-editor, macro-sandbox, font-metrics) 코드를 수정하지 않는다.
 *
 * @module cmyk-pdf
 */

export {
  generatePrintReadyPdf,
  postProcessRgbPdf,
  applyPdfXMetadata,
  makeBlankRgbPdfBytes,
  mm,
} from './cmyk-pdf-generator.js';

export {
  addPrintMarks,
  addCropMarks,
  addRegistrationMarks,
  addColorBar,
  addPageInfo,
  MM_TO_PT,
} from './print-marks.js';

export {
  rgbToCmyk,
  cmykToRgb,
  hexToCmyk,
  parseColorString,
  toPdfLibCmyk,
} from './color-converter.js';
