/**
 * Parser Extensions Barrel
 *
 * parser.js 가 사용하는 외부 모듈들의 단일 진입점.
 * 새 외부 모듈을 추가할 때는 여기에 export 만 추가하고 parser.js 의
 * import 블록은 의도적으로 단순하게 유지한다 (트랙 간 머지 충돌 회피).
 *
 * @module core/parser-extensions
 */

// Math (Phase 5)
export { hancomToMathML } from '../math/hancom-math-converter.js';

// Chart (Phase 5)
export { parseChart } from '../chart/chart-parser.js';

// Form controls (Phase 5)
export { parseFormControl, isFormControlTag } from '../features/form-controls.js';

// OLE (Phase 6)
export { parseOle, isOleBinData } from '../ole/ole-parser.js';

// Security: macros (Phase 6 + Track T OLE integration)
export {
  detectMacrosFromEntries,
  detectMacrosInOleObjects,
  mergeMacroResults,
} from '../security/macro-detector.js';

// Security: HWPX encryption (Phase 6)
export {
  detectEncryption,
  decryptHwpxStream,
  derivePbkdf2Key,
  SALT_SIZE,
  IV_SIZE,
  DEFAULT_PBKDF2_PARAMS,
} from '../security/hwp-crypto.js';

// Security: password dialog (Phase 6)
export { promptPassword } from '../security/password-dialog.js';

// Security: HWP 5.0 encryption notice helpers (Phase 6 - Track R)
export {
  showHwp5EncryptionNotice,
  isHwp5EncryptionError,
} from '../security/hwp5-encryption-notice.js';
