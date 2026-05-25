/**
 * Table Formula module — public entry point
 *
 * 한컴 한글 표 셀의 Excel 호환 수식을 평가하는 자체 엔진입니다.
 * 외부 의존성 없이 동작하며, 후속 옵션으로 hyperformula 같은 정식
 * 엔진을 끼울 수 있도록 어댑터 형태의 인터페이스를 유지합니다.
 *
 * @module table-formula
 */

export {
  tokenize,
  parse,
  evalAst,
  evaluateFormula,
  extractDependencies,
  coerceNumber,
  coerceString,
  coerceBoolean,
} from './formula-engine.js';

export {
  columnLettersToIndex,
  columnIndexToLetters,
  cellAddrToIndex,
  indexToCellAddr,
  isCellAddr,
  parseRange,
  expandRange,
} from './cell-address.js';

export { DependencyGraph } from './dependency-graph.js';

export {
  TableFormulaController,
  recalculateTable,
  getCellText,
  getCellValue,
  isFormulaText,
  setCellDisplayText,
  indexTable,
  formatDisplay,
} from './table-formula-controller.js';

/**
 * hyperformula 통합용 후속 어댑터 (Stub).
 * 1차에서는 외부 의존성을 추가하지 않으며, 이 함수는 가용성 확인용입니다.
 *
 * @returns {Promise<null>}
 */
export async function loadHyperformulaAdapter() {
  // Deferred: 사용자가 hyperformula(GPLv3 또는 상용 라이선스)를 직접
  // 설치한 환경에서만 동적으로 import 합니다. 1차 PR에서는 stub.
  try {
    // @ts-ignore - optional dep
    // eslint-disable-next-line import/no-unresolved
    // const hf = await import('hyperformula');
    // return hf;
    return null;
  } catch {
    return null;
  }
}
