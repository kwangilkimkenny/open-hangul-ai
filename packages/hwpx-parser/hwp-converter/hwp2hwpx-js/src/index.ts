/**
 * @packageDocumentation
 * # hwp2hwpx-js
 *
 * HWP to HWPX converter - JavaScript/TypeScript port
 *
 * ## Installation
 * ```bash
 * npm install hwp2hwpx-js
 * ```
 *
 * ## Quick Start
 * ```typescript
 * import { Hwp2Hwpx } from 'hwp2hwpx-js';
 *
 * const hwpBuffer = fs.readFileSync('document.hwp');
 * const hwpxBuffer = await Hwp2Hwpx.convert(new Uint8Array(hwpBuffer));
 * fs.writeFileSync('document.hwpx', hwpxBuffer);
 * ```
 *
 * ## Features
 * - Full HWP 5.0 format support
 * - Tables, images, equations, charts
 * - Text styling and paragraph formatting
 * - Browser and Node.js compatible
 *
 * @module hwp2hwpx-js
 */

// Core - 핵심 변환 클래스
export { Hwp2Hwpx } from './core/Hwp2Hwpx';

// Core - 스트리밍 변환 클래스 (대용량 파일 최적화)
export {
    StreamingHwp2Hwpx,
    HwpxStreamingConverter,
    type StreamingProgress,
    type StreamingOptions
} from './core/StreamingHwp2Hwpx';

// Core - 역변환 클래스 (HWPX → HWP)
export {
    Hwpx2Hwp,
    hwpxToHwp,
    type Hwpx2HwpOptions,
    type ConversionProgress as Hwpx2HwpProgress,
    type ConversionResult as Hwpx2HwpResult
} from './core/Hwpx2Hwp';

// Options - 변환 옵션
export type {
    ConversionOptions,
    ConversionProgress,
    ConversionStage,
    ProgressCallback
} from './core/ConversionOptions';
export { DEFAULT_CONVERSION_OPTIONS } from './core/ConversionOptions';

// Utilities - 유틸리티
export { ProgressTracker } from './util/ProgressTracker';

// Utilities - 메모리 최적화
export {
    MemoryOptimizer,
    type MemoryStats,
    type ChunkProcessorOptions,
    type StreamingConverter
} from './util/MemoryOptimizer';

// Utilities - Lazy BinData 로더
export {
    LazyBinDataLoader,
    StreamingBinDataProvider,
    determineLoadingStrategy,
    type BinDataMetadata,
    type LazyBinDataItem,
    type LazyBinDataLoaderOptions
} from './util/LazyBinDataLoader';

// Utilities - 성능 벤치마크
export {
    PerformanceBenchmark,
    quickBenchmark,
    measureTime,
    type BenchmarkResult,
    type StageTiming,
    type MemoryUsage,
    type BenchmarkComparison,
    type BenchmarkConfig
} from './util/PerformanceBenchmark';

// Models - OWPML/HWPX 타입 정의
export * from './models/owpml.types';

// Models - HWP 타입 정의
export type {
    HWPControl,
    HWPTable,
    HWPTableRow,
    HWPTableCell,
    HWPPicture,
    PageDef,
    HeaderFooter,
    ColumnDef
} from './models/hwp.types';

// Adapters - HWP 파서 추상화 계층
export {
    // 인터페이스
    type IHwpParser,
    type ParsedHwp,
    type DocInfo,
    type EnhancedSection,
    type EnhancedParagraph,
    type EnhancedRun,
    type CharPosShapeEntry,
    type ParserCapabilities,
    type BinDataItem,
    type SummaryInfo,
    type HwpRecord,

    // DocInfo 하위 타입
    type DocumentProperties,
    type IdMappings,
    type FontFace,
    type BorderFill,
    type Border,
    type FillInfo,
    type CharShape,
    type TabDef,
    type TabItem,
    type Numbering,
    type Bullet,
    type ParaShape,
    type Style,
    type MemoShape,
    type TrackChange,
    type TrackChangeAuthor,

    // 상수
    HWP_TAG_ID,
    HWPLIB_CAPABILITIES,
    ENHANCED_CAPABILITIES,

    // 어댑터
    HwplibAdapter,
    createHwplibAdapter,
    EnhancedAdapter,
    createEnhancedAdapterInstance,
    createDefaultParser,
    createEnhancedParser
} from './adapters';

// Constants - HWPX XML 네임스페이스 등 공통 상수
export { NAMESPACES, NS } from './constants/xml-namespaces';
export { HWPUNIT, FONT_SIZE, MARGIN, LINE_SEGMENT, PAGE, HwpUnitUtils } from './constants/hwpunit';

// Constants - 기본값 상수
export {
    DEFAULTS,
    PARA_DEFAULTS,
    CHAR_DEFAULTS,
    TABLE_DEFAULTS,
    PICTURE_DEFAULTS,
    SHAPE_DEFAULTS,
    INLINE_SHAPE_DEFAULTS,
    EQUATION_DEFAULTS,
    CHART_DEFAULTS,
    DEFAULT_FONTS,
    PAGE_DEFAULTS,
    PAGE_BORDER_DEFAULTS,
    FIELD_DEFAULTS,
    ID_FALLBACKS,
    FALLBACK_FONTS,
    getDefaultFont
} from './constants/DefaultValues';

// Constants - HWP → HWPX 값 변환 유틸리티
export {
    // Text alignment
    getHorizontalAlignment,
    getVerticalAlignment,
    // Line properties
    getLineSpacingType,
    getBorderLineType,
    getLineShape,
    getLineWrapType,
    // Border width
    getBorderWidthMm,
    getBorderWidthHwpunit,
    // Text properties
    getUnderlineType,
    getStrikeoutShape,
    getShadowType,
    getSymMarkType,
    getOutlineType,
    // Paragraph properties
    getHeadingType,
    getBreakWordType,
    // Border fill
    getCenterLineType,
    getSlashType,
    getGradientType,
    getImageFillMode,
    // Shape properties
    getTextWrapType,
    getTextFlowType,
    getVertRelType,
    getHorzRelType,
    getWidthRelType,
    getHeightRelType,
    // Numbering
    getNumberFormat,
    // Section
    getTextDirection,
    getPageStartsOn,
    // Table
    getCellSplitType,
    // Color
    formatColor,
    rgbToHex,
    colorToRgb,
    // Field
    getFieldType,
    // Chart
    getChartType,
    getLegendPosition
} from './constants/ValueConversion';

// Worker - 웹 워커 지원 (브라우저 전용)
export {
    // Manager
    WorkerManager,
    isWorkerSupported,
    getSharedWorkerManager,
    terminateSharedWorkerManager,
    type WorkerConversionOptions,

    // Types
    type WorkerRequest,
    type WorkerResponse,
    type ConvertRequest,
    type AbortRequest,
    type ProgressMessage,
    type CompleteMessage,
    type ErrorMessage,
    type ReadyMessage,

    // Utilities
    generateRequestId,
    isTransferable
} from './worker';

// Errors - 변환 오류 및 경고 시스템
export {
    // Error classes
    ConversionError,
    BufferUnderflowError,
    InvalidRecordError,
    InvalidIdReferenceError,
    UnsupportedFeatureError,
    // Context
    ConversionContext,
    createContext,
    getGlobalContext,
    setGlobalContext,
    // Types
    type DataLossLevel,
    type ConversionWarning,
    type ConversionStatistics,
    type ConversionResult
} from './errors/ConversionErrors';

// Validation - ID 참조 검증 시스템
export {
    IdValidator,
    createIdValidator,
    type IdValidationResult,
    type IdValidationStats,
    type IdRange
} from './validation';

// Parser - 레코드 파싱 유틸리티
export {
    RecordParser,
    RecordDataReader,
    BufferUnderflowError as RecordBufferUnderflowError,
    type RecordNode
} from './parser/RecordParser';

// Core - 변환 세션 상태 관리
export {
    startConversionSession,
    endConversionSession,
    getCurrentSession,
    getContext,
    getIdValidator,
    // ID 검증 편의 함수
    validateCharShapeId,
    validateParaShapeId,
    validateStyleId,
    validateFontId,
    validateBorderFillId,
    validateTabDefId,
    // 경고/위치 관리
    addWarning,
    pushLocation,
    popLocation,
    withLocation,
    incrementStat,
    type ConversionSessionState
} from './core/ConversionState';

// Phase 4.1: TextSanitizer - 화이트리스트 기반 텍스트 새니타이징
export {
    TextSanitizer,
    sanitizeText,
    sanitizeEquationScript,
    sanitizeForXml,
    quickSanitize,
    isValidCharacter,
    getUnicodeBlockName,
    VALID_UNICODE_RANGES,
    EQUATION_SPECIAL_RANGES,
    type SanitizeResult,
    type SanitizeWarning,
    type SanitizeOptions
} from './util/TextSanitizer';

// Phase 4.2: Hyperlink - 하이퍼링크 보존
export {
    HyperlinkProcessor,
    parseHyperlinkData,
    extractHyperlinkFromFieldData,
    hyperlinkBeginToXml,
    hyperlinkEndToXml,
    hyperlinkRunToXml,
    isValidUrl,
    isInternalLink,
    normalizeUrl,
    type Hyperlink,
    type HyperlinkTarget,
    type HyperlinkParseResult,
    type FieldDataWithHyperlink
} from './writer/section/controls/ForHyperlink';

// Phase 4.3: HwpUnit - 숫자 정밀도 보존
export {
    HwpUnit,
    HWPUNIT_CONSTANTS,
    hwpunitToString,
    hwpunitToMm,
    mmToHwpunit,
    hwpunitToPt,
    ptToHwpunit,
    scaleWithPrecision,
    toIntIfNeeded,
    hwpunitToFontPt,
    fontPtToHwpunit
} from './util/HwpUnit';

// Phase 5: Benchmark - 변환 정확도 측정 및 품질 검증
export {
    // ConversionMetrics
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

    // ConversionBenchmark
    type BenchmarkResult as ConversionBenchmarkResult,
    type BenchmarkOptions as ConversionBenchmarkOptions,
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

    // QualityReport
    type QualityReport,
    type ConversionWarning as QualityWarning,
    type ConversionError as QualityError,
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

    // RegressionRunner
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
    TestCaseBuilder
} from './benchmark';
