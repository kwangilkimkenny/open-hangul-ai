/**
 * ConversionMetrics.ts - 변환 정확도 측정 시스템
 *
 * Phase 5.1: 변환 정확도 벤치마크
 * - 텍스트 보존율 측정
 * - 서식 정확도 측정
 * - 구조 무결성 검사
 * - 요소 카운트 비교
 *
 * @module Benchmark
 * @category Quality
 */

/**
 * 변환 메트릭 인터페이스
 */
export interface ConversionMetrics {
    /** 텍스트 보존율 (0-100%) */
    textPreservation: number;
    /** 서식 정확도 (0-100%) */
    formattingAccuracy: number;
    /** 구조 무결성 (0-100%) */
    structureIntegrity: number;
    /** 전체 점수 (0-100%) */
    overallScore: number;
    /** 개별 요소 카운트 */
    elementCounts: ElementCounts;
    /** 세부 측정 항목 */
    details: MetricDetails;
}

/**
 * 요소 카운트
 */
export interface ElementCounts {
    /** 문단 수 */
    paragraphs: CountComparison;
    /** 테이블 수 */
    tables: CountComparison;
    /** 이미지 수 */
    images: CountComparison;
    /** 수식 수 */
    equations: CountComparison;
    /** 도형 수 */
    shapes: CountComparison;
    /** 차트 수 */
    charts: CountComparison;
    /** 하이퍼링크 수 */
    hyperlinks: CountComparison;
    /** 각주/미주 수 */
    footnotes: CountComparison;
}

/**
 * 카운트 비교
 */
export interface CountComparison {
    /** 입력 파일 카운트 */
    input: number;
    /** 출력 파일 카운트 */
    output: number;
    /** 보존율 (0-100%) */
    preservationRate: number;
}

/**
 * 세부 측정 항목
 */
export interface MetricDetails {
    /** 텍스트 관련 */
    text: {
        /** 입력 텍스트 길이 */
        inputLength: number;
        /** 출력 텍스트 길이 */
        outputLength: number;
        /** 일치하는 문자 수 */
        matchingChars: number;
        /** 누락된 문자 수 */
        missingChars: number;
        /** 추가된 문자 수 */
        addedChars: number;
    };
    /** 서식 관련 */
    formatting: {
        /** 글꼴 스타일 보존 */
        fontStyles: number;
        /** 문단 스타일 보존 */
        paragraphStyles: number;
        /** 색상 보존 */
        colors: number;
    };
    /** 구조 관련 */
    structure: {
        /** 섹션 보존 */
        sections: number;
        /** 테이블 구조 보존 */
        tableStructure: number;
        /** 목록 구조 보존 */
        listStructure: number;
    };
}

/**
 * 측정 옵션
 */
export interface MeasureOptions {
    /** 텍스트 비교 시 공백 무시 */
    ignoreWhitespace?: boolean;
    /** 대소문자 무시 */
    ignoreCase?: boolean;
    /** 가중치 설정 */
    weights?: MetricWeights;
    /** 상세 로그 출력 */
    verbose?: boolean;
}

/**
 * 메트릭 가중치
 */
export interface MetricWeights {
    /** 텍스트 가중치 (기본: 0.5) */
    text: number;
    /** 서식 가중치 (기본: 0.3) */
    formatting: number;
    /** 구조 가중치 (기본: 0.2) */
    structure: number;
}

/**
 * 기본 가중치
 */
export const DEFAULT_WEIGHTS: MetricWeights = {
    text: 0.5,
    formatting: 0.3,
    structure: 0.2,
};

/**
 * 기본 측정 옵션
 */
export const DEFAULT_MEASURE_OPTIONS: Required<MeasureOptions> = {
    ignoreWhitespace: false,
    ignoreCase: false,
    weights: DEFAULT_WEIGHTS,
    verbose: false,
};

/**
 * 카운트 비교 생성
 */
export function createCountComparison(input: number, output: number): CountComparison {
    const preservationRate = input === 0 ? 100 : Math.min(100, (output / input) * 100);
    return { input, output, preservationRate };
}

/**
 * 텍스트 유사도 계산 (Levenshtein 기반)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 100;
    if (text1.length === 0 || text2.length === 0) {
        return text1.length === 0 && text2.length === 0 ? 100 : 0;
    }

    // 긴 텍스트는 샘플링하여 비교
    const maxLength = 10000;
    let t1 = text1;
    let t2 = text2;

    if (text1.length > maxLength || text2.length > maxLength) {
        // 시작, 중간, 끝 부분 샘플링
        const sampleSize = Math.floor(maxLength / 3);
        t1 = sampleText(text1, sampleSize);
        t2 = sampleText(text2, sampleSize);
    }

    const distance = levenshteinDistance(t1, t2);
    const maxLen = Math.max(t1.length, t2.length);
    return Math.max(0, 100 - (distance / maxLen) * 100);
}

/**
 * 텍스트 샘플링
 */
function sampleText(text: string, sampleSize: number): string {
    if (text.length <= sampleSize * 3) return text;

    const start = text.substring(0, sampleSize);
    const mid = text.substring(
        Math.floor(text.length / 2) - Math.floor(sampleSize / 2),
        Math.floor(text.length / 2) + Math.floor(sampleSize / 2)
    );
    const end = text.substring(text.length - sampleSize);

    return start + mid + end;
}

/**
 * Levenshtein 거리 계산 (최적화된 버전)
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // 빈 문자열 처리
    if (m === 0) return n;
    if (n === 0) return m;

    // 메모리 최적화: 2개의 행만 사용
    let prevRow = new Array(n + 1);
    let currRow = new Array(n + 1);

    // 첫 행 초기화
    for (let j = 0; j <= n; j++) {
        prevRow[j] = j;
    }

    for (let i = 1; i <= m; i++) {
        currRow[0] = i;

        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            currRow[j] = Math.min(
                prevRow[j] + 1,      // 삭제
                currRow[j - 1] + 1,  // 삽입
                prevRow[j - 1] + cost // 대체
            );
        }

        // 행 교체
        [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[n];
}

/**
 * 전체 점수 계산
 */
export function calculateOverallScore(
    textPreservation: number,
    formattingAccuracy: number,
    structureIntegrity: number,
    weights: MetricWeights = DEFAULT_WEIGHTS
): number {
    const totalWeight = weights.text + weights.formatting + weights.structure;

    return (
        (textPreservation * weights.text +
            formattingAccuracy * weights.formatting +
            structureIntegrity * weights.structure) /
        totalWeight
    );
}

/**
 * 빈 메트릭 생성
 */
export function createEmptyMetrics(): ConversionMetrics {
    return {
        textPreservation: 0,
        formattingAccuracy: 0,
        structureIntegrity: 0,
        overallScore: 0,
        elementCounts: {
            paragraphs: createCountComparison(0, 0),
            tables: createCountComparison(0, 0),
            images: createCountComparison(0, 0),
            equations: createCountComparison(0, 0),
            shapes: createCountComparison(0, 0),
            charts: createCountComparison(0, 0),
            hyperlinks: createCountComparison(0, 0),
            footnotes: createCountComparison(0, 0),
        },
        details: {
            text: {
                inputLength: 0,
                outputLength: 0,
                matchingChars: 0,
                missingChars: 0,
                addedChars: 0,
            },
            formatting: {
                fontStyles: 0,
                paragraphStyles: 0,
                colors: 0,
            },
            structure: {
                sections: 0,
                tableStructure: 0,
                listStructure: 0,
            },
        },
    };
}

/**
 * 메트릭 요약 문자열 생성
 */
export function formatMetricsSummary(metrics: ConversionMetrics): string {
    const lines: string[] = [
        '=== Conversion Metrics Summary ===',
        '',
        `Overall Score: ${metrics.overallScore.toFixed(1)}%`,
        '',
        'Component Scores:',
        `  - Text Preservation: ${metrics.textPreservation.toFixed(1)}%`,
        `  - Formatting Accuracy: ${metrics.formattingAccuracy.toFixed(1)}%`,
        `  - Structure Integrity: ${metrics.structureIntegrity.toFixed(1)}%`,
        '',
        'Element Preservation:',
        `  - Paragraphs: ${metrics.elementCounts.paragraphs.output}/${metrics.elementCounts.paragraphs.input} (${metrics.elementCounts.paragraphs.preservationRate.toFixed(1)}%)`,
        `  - Tables: ${metrics.elementCounts.tables.output}/${metrics.elementCounts.tables.input} (${metrics.elementCounts.tables.preservationRate.toFixed(1)}%)`,
        `  - Images: ${metrics.elementCounts.images.output}/${metrics.elementCounts.images.input} (${metrics.elementCounts.images.preservationRate.toFixed(1)}%)`,
        `  - Equations: ${metrics.elementCounts.equations.output}/${metrics.elementCounts.equations.input} (${metrics.elementCounts.equations.preservationRate.toFixed(1)}%)`,
    ];

    return lines.join('\n');
}

/**
 * 메트릭을 JSON으로 직렬화
 */
export function serializeMetrics(metrics: ConversionMetrics): string {
    return JSON.stringify(metrics, null, 2);
}

/**
 * JSON에서 메트릭 역직렬화
 */
export function deserializeMetrics(json: string): ConversionMetrics {
    return JSON.parse(json) as ConversionMetrics;
}

export default {
    createCountComparison,
    calculateTextSimilarity,
    calculateOverallScore,
    createEmptyMetrics,
    formatMetricsSummary,
    serializeMetrics,
    deserializeMetrics,
};
