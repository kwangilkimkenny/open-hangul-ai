/**
 * Performance Benchmark Utility
 *
 * HWP to HWPX 변환 성능 측정 및 분석
 *
 * @module Utils
 */

import { MemoryOptimizer } from './MemoryOptimizer';
import { Logger } from './Logger';

/**
 * 벤치마크 결과
 */
export interface BenchmarkResult {
    /** 테스트 이름 */
    name: string;
    /** 입력 파일 크기 (bytes) */
    inputSize: number;
    /** 출력 파일 크기 (bytes) */
    outputSize: number;
    /** 총 소요 시간 (ms) */
    totalTime: number;
    /** 단계별 시간 */
    stageTimings: StageTiming[];
    /** 메모리 사용량 */
    memoryUsage: MemoryUsage;
    /** 처리량 (bytes/ms) */
    throughput: number;
    /** 압축률 (%) */
    compressionRatio: number;
    /** 성공 여부 */
    success: boolean;
    /** 오류 메시지 (실패 시) */
    error?: string;
}

/**
 * 단계별 타이밍
 */
export interface StageTiming {
    /** 단계 이름 */
    stage: string;
    /** 시작 시간 (ms) */
    startTime: number;
    /** 종료 시간 (ms) */
    endTime: number;
    /** 소요 시간 (ms) */
    duration: number;
    /** 전체 대비 비율 (%) */
    percentage: number;
}

/**
 * 메모리 사용량
 */
export interface MemoryUsage {
    /** 시작 시 힙 사용량 */
    heapStart: number;
    /** 피크 힙 사용량 */
    heapPeak: number;
    /** 종료 시 힙 사용량 */
    heapEnd: number;
    /** 힙 증가량 */
    heapDelta: number;
    /** 외부 메모리 피크 */
    externalPeak: number;
}

/**
 * 벤치마크 비교 결과
 */
export interface BenchmarkComparison {
    /** 기준 결과 */
    baseline: BenchmarkResult;
    /** 비교 결과 */
    comparison: BenchmarkResult;
    /** 시간 개선율 (%) */
    timeImprovement: number;
    /** 메모리 개선율 (%) */
    memoryImprovement: number;
    /** 처리량 개선율 (%) */
    throughputImprovement: number;
}

/**
 * 벤치마크 설정
 */
export interface BenchmarkConfig {
    /** 반복 횟수 (기본값: 3) */
    iterations?: number;
    /** 워밍업 반복 횟수 (기본값: 1) */
    warmupIterations?: number;
    /** GC 실행 여부 (기본값: true) */
    runGC?: boolean;
    /** 상세 로깅 (기본값: false) */
    verbose?: boolean;
}

/**
 * 기본 벤치마크 설정
 */
const DEFAULT_CONFIG: Required<BenchmarkConfig> = {
    iterations: 3,
    warmupIterations: 1,
    runGC: true,
    verbose: false
};

/**
 * 성능 벤치마크 클래스
 *
 * @example
 * ```typescript
 * const benchmark = new PerformanceBenchmark();
 *
 * const result = await benchmark.run('Test File', async () => {
 *     return await Hwp2Hwpx.convert(hwpData);
 * }, hwpData.length);
 *
 * console.log(benchmark.formatResult(result));
 * ```
 */
export class PerformanceBenchmark {
    private config: Required<BenchmarkConfig>;
    private stageTimings: Map<string, { start: number; end: number }> = new Map();
    private currentStage: string = '';

    constructor(config?: BenchmarkConfig) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * 벤치마크 실행
     */
    async run<T>(
        name: string,
        fn: () => Promise<T>,
        inputSize: number
    ): Promise<BenchmarkResult> {
        // 초기화
        this.stageTimings.clear();

        // GC 실행
        if (this.config.runGC) {
            MemoryOptimizer.requestGC();
            await this.sleep(100);
        }

        // 시작 메모리
        const memStart = this.captureMemory();
        let memPeak = memStart;

        // 워밍업
        if (this.config.warmupIterations > 0) {
            if (this.config.verbose) {
                Logger.debug(`Benchmark ${name}: Warming up...`);
            }
            for (let i = 0; i < this.config.warmupIterations; i++) {
                await fn();
            }
            if (this.config.runGC) {
                MemoryOptimizer.requestGC();
                await this.sleep(100);
            }
        }

        // 실제 벤치마크
        const timings: number[] = [];
        let result: T | undefined;
        let error: Error | undefined;

        for (let i = 0; i < this.config.iterations; i++) {
            if (this.config.verbose) {
                Logger.debug(`Benchmark ${name}: Iteration ${i + 1}/${this.config.iterations}`);
            }

            const startTime = performance.now();

            try {
                result = await fn();
            } catch (e) {
                error = e instanceof Error ? e : new Error(String(e));
            }

            const endTime = performance.now();
            timings.push(endTime - startTime);

            // 메모리 피크 추적
            const currentMem = this.captureMemory();
            if (currentMem > memPeak) {
                memPeak = currentMem;
            }

            // GC
            if (this.config.runGC && i < this.config.iterations - 1) {
                MemoryOptimizer.requestGC();
                await this.sleep(50);
            }
        }

        // 종료 메모리
        const memEnd = this.captureMemory();

        // 결과 계산
        const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
        const outputSize = result instanceof Uint8Array ? result.length : 0;

        const benchmarkResult: BenchmarkResult = {
            name,
            inputSize,
            outputSize,
            totalTime: avgTime,
            stageTimings: this.calculateStageTimings(avgTime),
            memoryUsage: {
                heapStart: memStart,
                heapPeak: memPeak,
                heapEnd: memEnd,
                heapDelta: memPeak - memStart,
                externalPeak: 0
            },
            throughput: inputSize / avgTime,
            compressionRatio: outputSize > 0 ? (1 - outputSize / inputSize) * 100 : 0,
            success: !error,
            error: error?.message
        };

        return benchmarkResult;
    }

    /**
     * 단계 시작 마킹
     */
    startStage(stage: string): void {
        this.currentStage = stage;
        this.stageTimings.set(stage, {
            start: performance.now(),
            end: 0
        });
    }

    /**
     * 단계 종료 마킹
     */
    endStage(stage?: string): void {
        const stageName = stage || this.currentStage;
        const timing = this.stageTimings.get(stageName);
        if (timing) {
            timing.end = performance.now();
        }
    }

    /**
     * 결과 포맷팅
     */
    formatResult(result: BenchmarkResult): string {
        const lines: string[] = [];

        lines.push('');
        lines.push('═══════════════════════════════════════════════════════════════');
        lines.push(`  Performance Benchmark: ${result.name}`);
        lines.push('═══════════════════════════════════════════════════════════════');
        lines.push('');
        lines.push('  📊 Summary');
        lines.push('  ─────────────────────────────────────────────────────────────');
        lines.push(`  Status:        ${result.success ? '✅ Success' : '❌ Failed'}`);
        lines.push(`  Input Size:    ${MemoryOptimizer.formatBytes(result.inputSize)}`);
        lines.push(`  Output Size:   ${MemoryOptimizer.formatBytes(result.outputSize)}`);
        lines.push(`  Total Time:    ${result.totalTime.toFixed(2)} ms`);
        lines.push(`  Throughput:    ${MemoryOptimizer.formatBytes(result.throughput * 1000)}/s`);
        lines.push(`  Compression:   ${result.compressionRatio.toFixed(1)}%`);
        lines.push('');

        if (result.stageTimings.length > 0) {
            lines.push('  ⏱️  Stage Timings');
            lines.push('  ─────────────────────────────────────────────────────────────');
            for (const stage of result.stageTimings) {
                const bar = '█'.repeat(Math.round(stage.percentage / 5));
                lines.push(`  ${stage.stage.padEnd(15)} ${stage.duration.toFixed(1).padStart(8)} ms  ${stage.percentage.toFixed(1).padStart(5)}% ${bar}`);
            }
            lines.push('');
        }

        lines.push('  💾 Memory Usage');
        lines.push('  ─────────────────────────────────────────────────────────────');
        lines.push(`  Heap Start:    ${MemoryOptimizer.formatBytes(result.memoryUsage.heapStart)}`);
        lines.push(`  Heap Peak:     ${MemoryOptimizer.formatBytes(result.memoryUsage.heapPeak)}`);
        lines.push(`  Heap End:      ${MemoryOptimizer.formatBytes(result.memoryUsage.heapEnd)}`);
        lines.push(`  Heap Delta:    ${MemoryOptimizer.formatBytes(result.memoryUsage.heapDelta)}`);
        lines.push('');

        if (result.error) {
            lines.push('  ❌ Error');
            lines.push('  ─────────────────────────────────────────────────────────────');
            lines.push(`  ${result.error}`);
            lines.push('');
        }

        lines.push('═══════════════════════════════════════════════════════════════');
        lines.push('');

        return lines.join('\n');
    }

    /**
     * 비교 결과 포맷팅
     */
    formatComparison(comparison: BenchmarkComparison): string {
        const lines: string[] = [];

        lines.push('');
        lines.push('═══════════════════════════════════════════════════════════════');
        lines.push('  Performance Comparison');
        lines.push('═══════════════════════════════════════════════════════════════');
        lines.push('');
        lines.push(`  Baseline:    ${comparison.baseline.name}`);
        lines.push(`  Comparison:  ${comparison.comparison.name}`);
        lines.push('');
        lines.push('  📈 Improvements');
        lines.push('  ─────────────────────────────────────────────────────────────');
        lines.push(`  Time:        ${this.formatImprovement(comparison.timeImprovement)}`);
        lines.push(`  Memory:      ${this.formatImprovement(comparison.memoryImprovement)}`);
        lines.push(`  Throughput:  ${this.formatImprovement(comparison.throughputImprovement)}`);
        lines.push('');

        lines.push('  📊 Detailed Comparison');
        lines.push('  ─────────────────────────────────────────────────────────────');
        lines.push(`  Metric           Baseline         Comparison       Delta`);
        lines.push(`  ─────────────────────────────────────────────────────────────`);
        lines.push(`  Time (ms)        ${comparison.baseline.totalTime.toFixed(1).padStart(12)}   ${comparison.comparison.totalTime.toFixed(1).padStart(12)}   ${(comparison.comparison.totalTime - comparison.baseline.totalTime).toFixed(1).padStart(10)}`);
        lines.push(`  Heap Peak        ${MemoryOptimizer.formatBytes(comparison.baseline.memoryUsage.heapPeak).padStart(12)}   ${MemoryOptimizer.formatBytes(comparison.comparison.memoryUsage.heapPeak).padStart(12)}`);
        lines.push(`  Throughput       ${MemoryOptimizer.formatBytes(comparison.baseline.throughput * 1000).padStart(12)}   ${MemoryOptimizer.formatBytes(comparison.comparison.throughput * 1000).padStart(12)}`);
        lines.push('');
        lines.push('═══════════════════════════════════════════════════════════════');
        lines.push('');

        return lines.join('\n');
    }

    /**
     * 두 결과 비교
     */
    compare(baseline: BenchmarkResult, comparison: BenchmarkResult): BenchmarkComparison {
        return {
            baseline,
            comparison,
            timeImprovement: ((baseline.totalTime - comparison.totalTime) / baseline.totalTime) * 100,
            memoryImprovement: ((baseline.memoryUsage.heapPeak - comparison.memoryUsage.heapPeak) / baseline.memoryUsage.heapPeak) * 100,
            throughputImprovement: ((comparison.throughput - baseline.throughput) / baseline.throughput) * 100
        };
    }

    /**
     * JSON 리포트 생성
     */
    toJSON(result: BenchmarkResult): string {
        return JSON.stringify(result, null, 2);
    }

    /**
     * CSV 행 생성
     */
    toCSVRow(result: BenchmarkResult): string {
        return [
            result.name,
            result.inputSize,
            result.outputSize,
            result.totalTime.toFixed(2),
            result.throughput.toFixed(2),
            result.memoryUsage.heapPeak,
            result.memoryUsage.heapDelta,
            result.compressionRatio.toFixed(2),
            result.success ? 'true' : 'false',
            result.error || ''
        ].join(',');
    }

    /**
     * CSV 헤더
     */
    static getCSVHeader(): string {
        return 'name,inputSize,outputSize,totalTime,throughput,heapPeak,heapDelta,compressionRatio,success,error';
    }

    // ========== Private Methods ==========

    private captureMemory(): number {
        const stats = MemoryOptimizer.getMemoryStats();
        return stats?.heapUsed || 0;
    }

    private calculateStageTimings(totalTime: number): StageTiming[] {
        const result: StageTiming[] = [];

        for (const [stage, timing] of this.stageTimings) {
            if (timing.end > 0) {
                const duration = timing.end - timing.start;
                result.push({
                    stage,
                    startTime: timing.start,
                    endTime: timing.end,
                    duration,
                    percentage: (duration / totalTime) * 100
                });
            }
        }

        return result.sort((a, b) => a.startTime - b.startTime);
    }

    private formatImprovement(value: number): string {
        const sign = value >= 0 ? '+' : '';
        const emoji = value > 10 ? '🚀' : value > 0 ? '📈' : value < -10 ? '📉' : '➖';
        return `${emoji} ${sign}${value.toFixed(1)}%`;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 간단한 벤치마크 실행
 */
export async function quickBenchmark<T>(
    name: string,
    fn: () => Promise<T>,
    inputSize: number = 0
): Promise<BenchmarkResult> {
    const benchmark = new PerformanceBenchmark({ iterations: 1, warmupIterations: 0 });
    return benchmark.run(name, fn, inputSize);
}

/**
 * 함수 실행 시간 측정 데코레이터
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function measureTime<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    label?: string
): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        const start = performance.now();
        try {
            const result = await fn(...args);
            const end = performance.now();
            Logger.debug(`Timing ${label || fn.name}: ${(end - start).toFixed(2)} ms`);
            return result;
        } catch (error) {
            const end = performance.now();
            Logger.debug(`Timing ${label || fn.name}: ${(end - start).toFixed(2)} ms (failed)`);
            throw error;
        }
    }) as T;
}
