/**
 * Headless HWPX Toolkit — Barrel Export
 * -----------------------------------------------------------------------------
 * Node.js 서버에서 HWPX 를 일괄 변환하기 위한 공개 API.
 *
 *   import {
 *     parseHwpxHeadless,
 *     ensureDomPolyfill,
 *     summarizeDocument,
 *     extractPlainText,
 *     extractStructuredText,
 *     extractTables,
 *     exportHtml,
 *   } from 'open-hangul-ai/headless';
 *
 * @module lib/headless
 */

export {
  parseHwpxHeadless,
  ensureDomPolyfill,
  summarizeDocument,
} from './headless-parser.js';

export {
  extractPlainText,
  extractStructuredText,
  extractTables,
} from './text-extractor.js';

export { exportHtml } from './html-exporter.js';
