/**
 * RegressionRunner.ts - 회귀 테스트 실행기
 *
 * Phase 5.2: 회귀 테스트 스위트
 * - 이전 변환 결과와 비교
 * - 스냅샷 기반 테스트
 * - 변환 일관성 검증
 *
 * @module Benchmark
 * @category Regression
 */

import { ConversionMetrics, calculateTextSimilarity } from './ConversionMetrics';
import { ParsedHwpxData, extractHwpxCounts } from './ConversionBenchmark';

/**
 * 회귀 테스트 케이스
 */
export interface RegressionTestCase {
    /** 테스트 이름 */
    name: string;
    /** 입력 HWP 파일 경로 */
    inputFile: string;
    /** 예상 변환 결과 (스냅샷) */
    expectedSnapshot?: string;
    /** 최소 품질 점수 */
    minScore: number;
    /** 예상 요소 카운트 */
    expectedCounts?: Partial<ParsedHwpxData>;
    /** 필수 텍스트 포함 여부 */
    requiredText?: string[];
    /** 금지 텍스트 (포함되면 실패) */
    forbiddenText?: string[];
    /** 태그 */
    tags?: string[];
}

/**
 * 회귀 테스트 결과
 */
export interface RegressionTestResult {
    /** 테스트 케이스 */
    testCase: RegressionTestCase;
    /** 성공 여부 */
    passed: boolean;
    /** 실패 사유 */
    failureReasons: string[];
    /** 실제 점수 */
    actualScore: number;
    /** 스냅샷 비교 결과 */
    snapshotMatch?: SnapshotMatchResult;
    /** 변환 메트릭 */
    metrics: ConversionMetrics;
    /** 실행 시간 (ms) */
    executionTime: number;
    /** 타임스탬프 */
    timestamp: Date;
}

/**
 * 스냅샷 비교 결과
 */
export interface SnapshotMatchResult {
    /** 일치 여부 */
    matched: boolean;
    /** 유사도 (0-100%) */
    similarity: number;
    /** 차이점 목록 */
    differences: SnapshotDifference[];
}

/**
 * 스냅샷 차이점
 */
export interface SnapshotDifference {
    /** 차이 유형 */
    type: 'added' | 'removed' | 'changed';
    /** 위치 (라인 또는 요소) */
    location: string;
    /** 예상 값 */
    expected?: string;
    /** 실제 값 */
    actual?: string;
}

/**
 * 회귀 테스트 스위트
 */
export interface RegressionTestSuite {
    /** 스위트 이름 */
    name: string;
    /** 설명 */
    description?: string;
    /** 테스트 케이스 목록 */
    testCases: RegressionTestCase[];
    /** 스위트 태그 */
    tags?: string[];
}

/**
 * 회귀 테스트 스위트 실행 결과
 */
export interface RegressionSuiteResult {
    /** 스위트 이름 */
    suiteName: string;
    /** 총 테스트 수 */
    totalTests: number;
    /** 통과한 테스트 수 */
    passedTests: number;
    /** 실패한 테스트 수 */
    failedTests: number;
    /** 스킵된 테스트 수 */
    skippedTests: number;
    /** 통과율 (%) */
    passRate: number;
    /** 개별 결과 */
    results: RegressionTestResult[];
    /** 총 실행 시간 (ms) */
    totalExecutionTime: number;
    /** 타임스탬프 */
    timestamp: Date;
}

/**
 * 회귀 테스트 실행 옵션
 */
export interface RegressionRunOptions {
    /** 필터링할 태그 */
    tags?: string[];
    /** 실패 시 중단 */
    stopOnFailure?: boolean;
    /** 스냅샷 업데이트 모드 */
    updateSnapshots?: boolean;
    /** 타임아웃 (ms) */
    timeout?: number;
    /** 병렬 실행 수 */
    concurrency?: number;
    /** 상세 로그 */
    verbose?: boolean;
}

/**
 * 기본 실행 옵션
 */
export const DEFAULT_RUN_OPTIONS: Required<RegressionRunOptions> = {
    tags: [],
    stopOnFailure: false,
    updateSnapshots: false,
    timeout: 30000,
    concurrency: 1,
    verbose: false,
};

/**
 * 회귀 테스트 검증
 */
export function validateTestCase(
    testCase: RegressionTestCase,
    actualXml: string,
    actualMetrics: ConversionMetrics
): RegressionTestResult {
    const startTime = Date.now();
    const failureReasons: string[] = [];
    let snapshotMatch: SnapshotMatchResult | undefined;

    // 1. 최소 점수 검증
    if (actualMetrics.overallScore < testCase.minScore) {
        failureReasons.push(
            `점수 미달: 실제 ${actualMetrics.overallScore.toFixed(1)}% < 최소 ${testCase.minScore}%`
        );
    }

    // 2. 스냅샷 비교
    if (testCase.expectedSnapshot) {
        snapshotMatch = compareSnapshots(testCase.expectedSnapshot, actualXml);
        if (!snapshotMatch.matched) {
            failureReasons.push(
                `스냅샷 불일치: 유사도 ${snapshotMatch.similarity.toFixed(1)}%`
            );
        }
    }

    // 3. 필수 텍스트 검증
    if (testCase.requiredText) {
        for (const text of testCase.requiredText) {
            if (!actualXml.includes(text)) {
                failureReasons.push(`필수 텍스트 누락: "${text}"`);
            }
        }
    }

    // 4. 금지 텍스트 검증
    if (testCase.forbiddenText) {
        for (const text of testCase.forbiddenText) {
            if (actualXml.includes(text)) {
                failureReasons.push(`금지 텍스트 발견: "${text}"`);
            }
        }
    }

    // 5. 예상 요소 카운트 검증
    if (testCase.expectedCounts) {
        const actualCounts = extractHwpxCounts(actualXml);
        validateCounts(testCase.expectedCounts, actualCounts, failureReasons);
    }

    return {
        testCase,
        passed: failureReasons.length === 0,
        failureReasons,
        actualScore: actualMetrics.overallScore,
        snapshotMatch,
        metrics: actualMetrics,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
    };
}

/**
 * 요소 카운트 검증
 */
function validateCounts(
    expected: Partial<ParsedHwpxData>,
    actual: Partial<ParsedHwpxData>,
    failures: string[]
): void {
    if (expected.paragraphCount !== undefined &&
        actual.paragraphCount !== expected.paragraphCount) {
        failures.push(
            `문단 수 불일치: 실제 ${actual.paragraphCount} ≠ 예상 ${expected.paragraphCount}`
        );
    }
    if (expected.tableCount !== undefined &&
        actual.tableCount !== expected.tableCount) {
        failures.push(
            `테이블 수 불일치: 실제 ${actual.tableCount} ≠ 예상 ${expected.tableCount}`
        );
    }
    if (expected.imageCount !== undefined &&
        actual.imageCount !== expected.imageCount) {
        failures.push(
            `이미지 수 불일치: 실제 ${actual.imageCount} ≠ 예상 ${expected.imageCount}`
        );
    }
    if (expected.equationCount !== undefined &&
        actual.equationCount !== expected.equationCount) {
        failures.push(
            `수식 수 불일치: 실제 ${actual.equationCount} ≠ 예상 ${expected.equationCount}`
        );
    }
}

/**
 * 스냅샷 비교
 */
export function compareSnapshots(expected: string, actual: string): SnapshotMatchResult {
    // 공백 정규화
    const normalizedExpected = normalizeXml(expected);
    const normalizedActual = normalizeXml(actual);

    const similarity = calculateTextSimilarity(normalizedExpected, normalizedActual);
    const differences = findDifferences(normalizedExpected, normalizedActual);

    return {
        matched: similarity >= 99, // 99% 이상이면 일치
        similarity,
        differences,
    };
}

/**
 * XML 정규화 (비교용)
 */
function normalizeXml(xml: string): string {
    return xml
        .replace(/>\s+</g, '><')           // 태그 사이 공백 제거
        .replace(/\s+/g, ' ')              // 연속 공백을 단일 공백으로
        .replace(/id="\d+"/g, 'id="*"')    // ID 값 마스킹
        .trim();
}

/**
 * 차이점 찾기 (간단한 구현)
 */
function findDifferences(expected: string, actual: string): SnapshotDifference[] {
    const differences: SnapshotDifference[] = [];

    // 간단한 라인 기반 비교
    const expectedLines = expected.split('\n');
    const actualLines = actual.split('\n');

    const maxLines = Math.max(expectedLines.length, actualLines.length);

    for (let i = 0; i < maxLines; i++) {
        const exp = expectedLines[i] || '';
        const act = actualLines[i] || '';

        if (exp !== act) {
            if (!exp && act) {
                differences.push({
                    type: 'added',
                    location: `line ${i + 1}`,
                    actual: act,
                });
            } else if (exp && !act) {
                differences.push({
                    type: 'removed',
                    location: `line ${i + 1}`,
                    expected: exp,
                });
            } else {
                differences.push({
                    type: 'changed',
                    location: `line ${i + 1}`,
                    expected: exp,
                    actual: act,
                });
            }
        }

        // 최대 10개까지만 기록
        if (differences.length >= 10) {
            break;
        }
    }

    return differences;
}

/**
 * 테스트 케이스 필터링
 */
export function filterTestCases(
    testCases: RegressionTestCase[],
    tags: string[]
): RegressionTestCase[] {
    if (tags.length === 0) {
        return testCases;
    }

    return testCases.filter(tc => {
        if (!tc.tags) return false;
        return tags.some(tag => tc.tags!.includes(tag));
    });
}

/**
 * 회귀 테스트 스위트 결과 요약
 */
export function summarizeSuiteResult(result: RegressionSuiteResult): string {
    const lines: string[] = [
        '╔════════════════════════════════════════════════════════╗',
        '║            회귀 테스트 실행 결과                       ║',
        '╠════════════════════════════════════════════════════════╣',
        `║ 스위트: ${result.suiteName.padEnd(46)}║`,
        '╠════════════════════════════════════════════════════════╣',
        `║ 총 테스트:   ${String(result.totalTests).padStart(4)}                                  ║`,
        `║ 통과:        ${String(result.passedTests).padStart(4)} (${(result.passRate).toFixed(1)}%)                        ║`,
        `║ 실패:        ${String(result.failedTests).padStart(4)}                                  ║`,
        `║ 스킵:        ${String(result.skippedTests).padStart(4)}                                  ║`,
        '╠════════════════════════════════════════════════════════╣',
        `║ 총 실행 시간: ${(result.totalExecutionTime / 1000).toFixed(2)}초                         ║`,
        '╚════════════════════════════════════════════════════════╝',
    ];

    // 실패한 테스트 목록
    const failedResults = result.results.filter(r => !r.passed);
    if (failedResults.length > 0) {
        lines.push('');
        lines.push('실패한 테스트:');
        for (const failed of failedResults) {
            lines.push(`  - ${failed.testCase.name}`);
            for (const reason of failed.failureReasons) {
                lines.push(`      ${reason}`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * 테스트 케이스 빌더
 */
export class TestCaseBuilder {
    private testCase: RegressionTestCase;

    constructor(name: string, inputFile: string) {
        this.testCase = {
            name,
            inputFile,
            minScore: 80, // 기본 최소 점수
        };
    }

    withMinScore(score: number): this {
        this.testCase.minScore = score;
        return this;
    }

    withSnapshot(snapshot: string): this {
        this.testCase.expectedSnapshot = snapshot;
        return this;
    }

    withRequiredText(texts: string[]): this {
        this.testCase.requiredText = texts;
        return this;
    }

    withForbiddenText(texts: string[]): this {
        this.testCase.forbiddenText = texts;
        return this;
    }

    withExpectedCounts(counts: Partial<ParsedHwpxData>): this {
        this.testCase.expectedCounts = counts;
        return this;
    }

    withTags(tags: string[]): this {
        this.testCase.tags = tags;
        return this;
    }

    build(): RegressionTestCase {
        return { ...this.testCase };
    }
}

/**
 * 테스트 케이스 생성 헬퍼
 */
export function createTestCase(name: string, inputFile: string): TestCaseBuilder {
    return new TestCaseBuilder(name, inputFile);
}

/**
 * 빈 스위트 결과 생성
 */
export function createEmptySuiteResult(suiteName: string): RegressionSuiteResult {
    return {
        suiteName,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        passRate: 0,
        results: [],
        totalExecutionTime: 0,
        timestamp: new Date(),
    };
}

export default {
    validateTestCase,
    compareSnapshots,
    filterTestCases,
    summarizeSuiteResult,
    createTestCase,
    createEmptySuiteResult,
    TestCaseBuilder,
};
