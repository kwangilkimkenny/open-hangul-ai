/**
 * AI 성능 벤치마크 모듈
 *
 * AEGIS (보안) + TruthAnchor (할루시네이션 검증) 성능 평가 프레임워크
 *
 * @module ai/benchmark
 */

export type {
  AegisTestCase,
  AegisTestResult,
  TruthAnchorTestCase,
  TruthAnchorTestResult,
  ClassificationMetrics,
  AegisBenchmarkReport,
  TruthAnchorBenchmarkReport,
  FullBenchmarkReport,
  Verdict,
} from './types';

export {
  runAegisBenchmark,
  runTruthAnchorBenchmark,
  runFullBenchmark,
} from './runner';

export {
  computeAegisMetrics,
  computeTruthAnchorMetrics,
  computeOverallScore,
} from './metrics';

export { AEGIS_TEST_CASES } from './test-data-aegis';
export { TRUTHANCHOR_TEST_CASES } from './test-data-truthanchor';
