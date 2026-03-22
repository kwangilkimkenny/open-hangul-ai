/**
 * Benchmark Module Index
 *
 * Phase 5: 테스트 및 검증
 * - 변환 정확도 측정
 * - 품질 리포트 생성
 * - 벤치마크 실행
 *
 * @module Benchmark
 */

// ConversionMetrics
export {
    type ConversionMetrics,
    type ElementCounts,
    type CountComparison,
    type MetricDetails,
    type MeasureOptions,
    type MetricWeights,
    DEFAULT_WEIGHTS,
    DEFAULT_MEASURE_OPTIONS,
    createCountComparison,
    calculateTextSimilarity,
    calculateOverallScore,
    createEmptyMetrics,
    formatMetricsSummary,
    serializeMetrics,
    deserializeMetrics,
} from './ConversionMetrics';

// ConversionBenchmark
export {
    type BenchmarkResult,
    type BenchmarkOptions,
    type ParsedHwpData,
    type ParsedHwpxData,
    type BenchmarkSummary,
    measureConversion,
    extractHwpxCounts,
    extractSectionCounts,
    extractHeaderCounts,
    summarizeBenchmarks,
    formatBenchmarkSummary,
    createEmptyBenchmarkResult,
} from './ConversionBenchmark';

// QualityReport
export {
    type QualityReport,
    type ConversionWarning,
    type ConversionError,
    type DataLossItem,
    type QualityGrade,
    type ReportOptions,
    GRADE_THRESHOLDS,
    GRADE_DESCRIPTIONS,
    DEFAULT_REPORT_OPTIONS,
    generateQualityReport,
    calculateGrade,
    formatReportAsText,
    formatReportAsJson,
    formatReportAsHtml,
    createEmptyReport,
} from './QualityReport';

// RegressionRunner
export {
    type RegressionTestCase,
    type RegressionTestResult,
    type SnapshotMatchResult,
    type SnapshotDifference,
    type RegressionTestSuite,
    type RegressionSuiteResult,
    type RegressionRunOptions,
    DEFAULT_RUN_OPTIONS,
    validateTestCase,
    compareSnapshots,
    filterTestCases,
    summarizeSuiteResult,
    createTestCase,
    createEmptySuiteResult,
    TestCaseBuilder,
} from './RegressionRunner';
