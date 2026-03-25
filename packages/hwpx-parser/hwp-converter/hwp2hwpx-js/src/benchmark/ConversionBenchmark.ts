/**
 * ConversionBenchmark.ts - 변환 품질 벤치마크 실행기
 *
 * Phase 5.1: 변환 정확도 벤치마크
 * - HWP → HWPX 변환 실행
 * - 변환 결과 분석 및 측정
 * - 메트릭 수집 및 리포트
 *
 * @module Benchmark
 * @category Quality
 */

import {
    ConversionMetrics,
    ElementCounts,
    MeasureOptions,
    DEFAULT_MEASURE_OPTIONS,
    createCountComparison,
    calculateTextSimilarity,
    calculateOverallScore,
    createEmptyMetrics,
} from './ConversionMetrics';

/**
 * 벤치마크 결과 인터페이스
 */
export interface BenchmarkResult {
    /** 입력 파일 경로 */
    inputFile: string;
    /** 출력 파일 경로 */
    outputFile: string;
    /** 변환 성공 여부 */
    success: boolean;
    /** 오류 메시지 (실패 시) */
    error?: string;
    /** 변환 소요 시간 (ms) */
    conversionTime: number;
    /** 변환 메트릭 */
    metrics: ConversionMetrics;
    /** 타임스탬프 */
    timestamp: Date;
}

/**
 * 벤치마크 실행 옵션
 */
export interface BenchmarkOptions extends MeasureOptions {
    /** 임시 출력 디렉토리 */
    outputDir?: string;
    /** 출력 파일 보존 여부 */
    keepOutput?: boolean;
    /** 타임아웃 (ms) */
    timeout?: number;
}

/**
 * 파싱된 HWP 데이터 구조 (분석용)
 */
export interface ParsedHwpData {
    /** 추출된 텍스트 */
    text: string;
    /** 문단 수 */
    paragraphCount: number;
    /** 테이블 수 */
    tableCount: number;
    /** 이미지 수 */
    imageCount: number;
    /** 수식 수 */
    equationCount: number;
    /** 도형 수 */
    shapeCount: number;
    /** 차트 수 */
    chartCount: number;
    /** 하이퍼링크 수 */
    hyperlinkCount: number;
    /** 각주/미주 수 */
    footnoteCount: number;
    /** 섹션 수 */
    sectionCount: number;
    /** 글꼴 스타일 수 */
    fontStyleCount: number;
    /** 문단 스타일 수 */
    paragraphStyleCount: number;
}

/**
 * 파싱된 HWPX 데이터 구조 (분석용)
 */
export interface ParsedHwpxData {
    /** 추출된 텍스트 */
    text: string;
    /** 문단 수 */
    paragraphCount: number;
    /** 테이블 수 */
    tableCount: number;
    /** 이미지 수 */
    imageCount: number;
    /** 수식 수 */
    equationCount: number;
    /** 도형 수 */
    shapeCount: number;
    /** 차트 수 */
    chartCount: number;
    /** 하이퍼링크 수 */
    hyperlinkCount: number;
    /** 각주/미주 수 */
    footnoteCount: number;
    /** 섹션 수 */
    sectionCount: number;
    /** 글꼴 스타일 수 */
    fontStyleCount: number;
    /** 문단 스타일 수 */
    paragraphStyleCount: number;
}

/**
 * 변환 메트릭 측정
 */
export function measureConversion(
    hwpData: ParsedHwpData,
    hwpxData: ParsedHwpxData,
    options: MeasureOptions = {}
): ConversionMetrics {
    const opts = { ...DEFAULT_MEASURE_OPTIONS, ...options };

    // 텍스트 보존율 계산
    let inputText = hwpData.text;
    let outputText = hwpxData.text;

    if (opts.ignoreWhitespace) {
        inputText = inputText.replace(/\s+/g, ' ').trim();
        outputText = outputText.replace(/\s+/g, ' ').trim();
    }

    if (opts.ignoreCase) {
        inputText = inputText.toLowerCase();
        outputText = outputText.toLowerCase();
    }

    const textPreservation = calculateTextSimilarity(inputText, outputText);

    // 요소 카운트 비교
    const elementCounts: ElementCounts = {
        paragraphs: createCountComparison(hwpData.paragraphCount, hwpxData.paragraphCount),
        tables: createCountComparison(hwpData.tableCount, hwpxData.tableCount),
        images: createCountComparison(hwpData.imageCount, hwpxData.imageCount),
        equations: createCountComparison(hwpData.equationCount, hwpxData.equationCount),
        shapes: createCountComparison(hwpData.shapeCount, hwpxData.shapeCount),
        charts: createCountComparison(hwpData.chartCount, hwpxData.chartCount),
        hyperlinks: createCountComparison(hwpData.hyperlinkCount, hwpxData.hyperlinkCount),
        footnotes: createCountComparison(hwpData.footnoteCount, hwpxData.footnoteCount),
    };

    // 서식 정확도 계산 (스타일 보존율)
    const fontStyleRate = hwpData.fontStyleCount === 0 ? 100 :
        Math.min(100, (hwpxData.fontStyleCount / hwpData.fontStyleCount) * 100);
    const paragraphStyleRate = hwpData.paragraphStyleCount === 0 ? 100 :
        Math.min(100, (hwpxData.paragraphStyleCount / hwpData.paragraphStyleCount) * 100);
    const formattingAccuracy = (fontStyleRate + paragraphStyleRate) / 2;

    // 구조 무결성 계산 (주요 요소 보존율)
    const structureElements = [
        elementCounts.paragraphs.preservationRate,
        elementCounts.tables.preservationRate,
        elementCounts.images.preservationRate,
    ];
    const structureIntegrity = structureElements.reduce((a, b) => a + b, 0) / structureElements.length;

    // 전체 점수 계산
    const overallScore = calculateOverallScore(
        textPreservation,
        formattingAccuracy,
        structureIntegrity,
        opts.weights
    );

    // 텍스트 상세 정보
    const inputLength = hwpData.text.length;
    const outputLength = hwpxData.text.length;
    const matchingChars = Math.min(inputLength, outputLength) * (textPreservation / 100);
    const missingChars = Math.max(0, inputLength - outputLength);
    const addedChars = Math.max(0, outputLength - inputLength);

    return {
        textPreservation,
        formattingAccuracy,
        structureIntegrity,
        overallScore,
        elementCounts,
        details: {
            text: {
                inputLength,
                outputLength,
                matchingChars: Math.round(matchingChars),
                missingChars,
                addedChars,
            },
            formatting: {
                fontStyles: fontStyleRate,
                paragraphStyles: paragraphStyleRate,
                colors: 100, // 기본값 (별도 측정 필요)
            },
            structure: {
                sections: hwpData.sectionCount === 0 ? 100 :
                    Math.min(100, (hwpxData.sectionCount / hwpData.sectionCount) * 100),
                tableStructure: elementCounts.tables.preservationRate,
                listStructure: 100, // 기본값 (별도 측정 필요)
            },
        },
    };
}

/**
 * HWPX XML에서 요소 카운트 추출
 */
export function extractHwpxCounts(xmlContent: string): Partial<ParsedHwpxData> {
    const counts: Partial<ParsedHwpxData> = {
        text: '',
        paragraphCount: 0,
        tableCount: 0,
        imageCount: 0,
        equationCount: 0,
        shapeCount: 0,
        chartCount: 0,
        hyperlinkCount: 0,
        footnoteCount: 0,
        sectionCount: 0,
        fontStyleCount: 0,
        paragraphStyleCount: 0,
    };

    // 문단 수 (<hp:p>)
    const paraMatches = xmlContent.match(/<hp:p[>\s]/g);
    counts.paragraphCount = paraMatches ? paraMatches.length : 0;

    // 테이블 수 (<hp:tbl>)
    const tableMatches = xmlContent.match(/<hp:tbl[>\s]/g);
    counts.tableCount = tableMatches ? tableMatches.length : 0;

    // 이미지 수 (<hp:pic> or <hp:img>)
    const imageMatches = xmlContent.match(/<hp:(?:pic|img)[>\s]/g);
    counts.imageCount = imageMatches ? imageMatches.length : 0;

    // 수식 수 (<hp:equation>)
    const equationMatches = xmlContent.match(/<hp:equation[>\s]/g);
    counts.equationCount = equationMatches ? equationMatches.length : 0;

    // 도형 수 (<hp:rect>, <hp:ellipse>, <hp:arc>, <hp:polygon>, <hp:line>)
    const shapeMatches = xmlContent.match(/<hp:(?:rect|ellipse|arc|polygon|line|curve)[>\s]/g);
    counts.shapeCount = shapeMatches ? shapeMatches.length : 0;

    // 차트 수 (<hp:chart>)
    const chartMatches = xmlContent.match(/<hp:chart[>\s]/g);
    counts.chartCount = chartMatches ? chartMatches.length : 0;

    // 하이퍼링크 수 (type="HYPERLINK")
    const hyperlinkMatches = xmlContent.match(/type="HYPERLINK"/g);
    counts.hyperlinkCount = hyperlinkMatches ? hyperlinkMatches.length : 0;

    // 각주/미주 수 (<hp:footNote>, <hp:endNote>)
    const footnoteMatches = xmlContent.match(/<hp:(?:footNote|endNote)[>\s]/g);
    counts.footnoteCount = footnoteMatches ? footnoteMatches.length : 0;

    // 텍스트 추출 (<hp:t>...</hp:t>)
    const textMatches = xmlContent.match(/<hp:t>([^<]*)<\/hp:t>/g);
    if (textMatches) {
        counts.text = textMatches
            .map(m => m.replace(/<hp:t>|<\/hp:t>/g, ''))
            .join('');
    }

    return counts;
}

/**
 * 섹션 XML에서 요소 카운트 추출
 */
export function extractSectionCounts(sectionXmls: string[]): ParsedHwpxData {
    const result: ParsedHwpxData = {
        text: '',
        paragraphCount: 0,
        tableCount: 0,
        imageCount: 0,
        equationCount: 0,
        shapeCount: 0,
        chartCount: 0,
        hyperlinkCount: 0,
        footnoteCount: 0,
        sectionCount: sectionXmls.length,
        fontStyleCount: 0,
        paragraphStyleCount: 0,
    };

    for (const xml of sectionXmls) {
        const counts = extractHwpxCounts(xml);
        result.text += counts.text || '';
        result.paragraphCount += counts.paragraphCount || 0;
        result.tableCount += counts.tableCount || 0;
        result.imageCount += counts.imageCount || 0;
        result.equationCount += counts.equationCount || 0;
        result.shapeCount += counts.shapeCount || 0;
        result.chartCount += counts.chartCount || 0;
        result.hyperlinkCount += counts.hyperlinkCount || 0;
        result.footnoteCount += counts.footnoteCount || 0;
    }

    return result;
}

/**
 * header.xml에서 스타일 카운트 추출
 */
export function extractHeaderCounts(headerXml: string): { fontStyleCount: number; paragraphStyleCount: number } {
    const fontMatches = headerXml.match(/<hh:charPr[>\s]/g);
    const paraMatches = headerXml.match(/<hh:paraPr[>\s]/g);

    return {
        fontStyleCount: fontMatches ? fontMatches.length : 0,
        paragraphStyleCount: paraMatches ? paraMatches.length : 0,
    };
}

/**
 * 벤치마크 결과 통계 요약
 */
export interface BenchmarkSummary {
    /** 총 테스트 수 */
    totalTests: number;
    /** 성공한 테스트 수 */
    passedTests: number;
    /** 실패한 테스트 수 */
    failedTests: number;
    /** 평균 점수 */
    averageScore: number;
    /** 최소 점수 */
    minScore: number;
    /** 최대 점수 */
    maxScore: number;
    /** 평균 변환 시간 (ms) */
    averageConversionTime: number;
    /** 개별 결과 */
    results: BenchmarkResult[];
}

/**
 * 여러 벤치마크 결과 요약
 */
export function summarizeBenchmarks(results: BenchmarkResult[]): BenchmarkSummary {
    const successResults = results.filter(r => r.success);
    const scores = successResults.map(r => r.metrics.overallScore);
    const times = successResults.map(r => r.conversionTime);

    return {
        totalTests: results.length,
        passedTests: successResults.length,
        failedTests: results.length - successResults.length,
        averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        minScore: scores.length > 0 ? Math.min(...scores) : 0,
        maxScore: scores.length > 0 ? Math.max(...scores) : 0,
        averageConversionTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        results,
    };
}

/**
 * 벤치마크 요약 포맷
 */
export function formatBenchmarkSummary(summary: BenchmarkSummary): string {
    const lines: string[] = [
        '╔════════════════════════════════════════════╗',
        '║       Conversion Benchmark Summary         ║',
        '╠════════════════════════════════════════════╣',
        `║ Total Tests:    ${String(summary.totalTests).padStart(5)}                     ║`,
        `║ Passed:         ${String(summary.passedTests).padStart(5)} (${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%)              ║`,
        `║ Failed:         ${String(summary.failedTests).padStart(5)}                     ║`,
        '╠════════════════════════════════════════════╣',
        `║ Average Score:  ${summary.averageScore.toFixed(1).padStart(5)}%                    ║`,
        `║ Min Score:      ${summary.minScore.toFixed(1).padStart(5)}%                    ║`,
        `║ Max Score:      ${summary.maxScore.toFixed(1).padStart(5)}%                    ║`,
        '╠════════════════════════════════════════════╣',
        `║ Avg Conv Time:  ${summary.averageConversionTime.toFixed(0).padStart(5)}ms                   ║`,
        '╚════════════════════════════════════════════╝',
    ];

    return lines.join('\n');
}

/**
 * 기본 빈 벤치마크 결과 생성
 */
export function createEmptyBenchmarkResult(inputFile: string): BenchmarkResult {
    return {
        inputFile,
        outputFile: '',
        success: false,
        conversionTime: 0,
        metrics: createEmptyMetrics(),
        timestamp: new Date(),
    };
}

export default {
    measureConversion,
    extractHwpxCounts,
    extractSectionCounts,
    extractHeaderCounts,
    summarizeBenchmarks,
    formatBenchmarkSummary,
    createEmptyBenchmarkResult,
};
