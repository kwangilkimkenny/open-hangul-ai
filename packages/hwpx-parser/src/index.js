/**
 * @hanview/hwpx-parser
 * HWP/HWPX Document Parser & Serializer
 *
 * HWPX 파일을 파싱하여 JSON 문서 구조로 변환하고,
 * JSON 문서를 다시 HWPX 파일로 내보내는 라이브러리
 *
 * @version 3.0.0
 * @license MIT
 */

// === Core Parser ===
export { SimpleHWPXParser, SimpleHWPXParser as HWPXParser } from './core/parser.js';
export { HWPXConstants } from './core/constants.js';

// === Export / Serializer ===
export { JsonToXmlConverter } from './export/json-to-xml.js';
export { HwpxExporter } from './export/hwpx-exporter.js';
export { HwpxSafeExporter } from './export/hwpx-safe-exporter.js';
export { HeaderBasedReplacer } from './export/header-based-replacer.js';

// === Utilities ===
export { Logger, getLogger, resetLogger } from './utils/logger.js';
export { HWPXError, ErrorType, ErrorHandler, getErrorHandler, handleError } from './utils/error.js';
export {
    formatFileSize, formatDate, formatNumber, formatPercent,
    formatDuration, getFileExtension, removeFileExtension,
    truncateString, bytesToBase64, base64ToBytes
} from './utils/format.js';
export {
    toRoman, toLetter, toHangulGanada, toHangulJamo,
    toCircledHangul, toCircledDecimal, toKoreanHanja, toChineseHanja,
    formatNumber as formatNumbering, getNumberingMarker
} from './utils/numbering.js';
