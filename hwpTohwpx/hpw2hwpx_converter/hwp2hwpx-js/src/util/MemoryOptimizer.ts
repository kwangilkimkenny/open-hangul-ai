/**
 * Memory Optimizer Utility
 *
 * 대용량 HWP 파일 처리를 위한 메모리 최적화 유틸리티
 *
 * @module Utils
 */

/**
 * Node.js global object with optional gc function
 */
interface NodeGlobalWithGC {
    gc?: () => void;
}

/**
 * 메모리 사용량 통계
 */
export interface MemoryStats {
    /** 현재 힙 사용량 (bytes) */
    heapUsed: number;
    /** 총 힙 크기 (bytes) */
    heapTotal: number;
    /** 외부 메모리 (bytes) */
    external: number;
    /** RSS (bytes) */
    rss: number;
}

/**
 * 청크 처리 옵션
 */
export interface ChunkProcessorOptions {
    /** 청크 크기 (기본값: 1MB) */
    chunkSize?: number;
    /** 청크 간 지연 시간 (ms) */
    delayBetweenChunks?: number;
    /** 진행률 콜백 */
    onProgress?: (processed: number, total: number) => void;
}

/**
 * 메모리 최적화 클래스
 */
export class MemoryOptimizer {
    private static readonly DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
    private static readonly GC_THRESHOLD = 100 * 1024 * 1024; // 100MB

    /**
     * 현재 메모리 사용량 조회
     */
    static getMemoryStats(): MemoryStats | null {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const usage = process.memoryUsage();
            return {
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external,
                rss: usage.rss
            };
        }
        return null;
    }

    /**
     * 메모리 사용량을 사람이 읽기 쉬운 형식으로 변환
     */
    static formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 가비지 컬렉션 힌트 (Node.js 환경에서만 작동)
     */
    static requestGC(): void {
        if (typeof global !== 'undefined') {
            const nodeGlobal = global as NodeGlobalWithGC;
            if (typeof nodeGlobal.gc === 'function') {
                nodeGlobal.gc();
            }
        }
    }

    /**
     * 대용량 데이터 청크 처리
     * 
     * @example
     * ```typescript
     * await MemoryOptimizer.processInChunks(
     *     largeBuffer,
     *     (chunk, index) => processChunk(chunk),
     *     { chunkSize: 512 * 1024 }
     * );
     * ```
     */
    static async processInChunks<T>(
        data: Uint8Array,
        processor: (chunk: Uint8Array, chunkIndex: number) => T | Promise<T>,
        options: ChunkProcessorOptions = {}
    ): Promise<T[]> {
        const chunkSize = options.chunkSize || MemoryOptimizer.DEFAULT_CHUNK_SIZE;
        const delay = options.delayBetweenChunks || 0;
        const totalSize = data.length;
        const results: T[] = [];

        let offset = 0;
        let chunkIndex = 0;

        while (offset < totalSize) {
            const end = Math.min(offset + chunkSize, totalSize);
            const chunk = data.subarray(offset, end);

            const result = await processor(chunk, chunkIndex);
            results.push(result);

            offset = end;
            chunkIndex++;

            if (options.onProgress) {
                options.onProgress(offset, totalSize);
            }

            // 메모리 압박 시 GC 힌트
            const stats = MemoryOptimizer.getMemoryStats();
            if (stats && stats.heapUsed > MemoryOptimizer.GC_THRESHOLD) {
                MemoryOptimizer.requestGC();
            }

            // 청크 간 지연
            if (delay > 0 && offset < totalSize) {
                await MemoryOptimizer.sleep(delay);
            }
        }

        return results;
    }

    /**
     * 비동기 지연
     */
    static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 버퍼 풀 - 재사용 가능한 버퍼 관리
     */
    private static bufferPool: Uint8Array[] = [];
    private static readonly MAX_POOL_SIZE = 10;
    private static readonly POOL_BUFFER_SIZE = 1024 * 1024; // 1MB

    /**
     * 풀에서 버퍼 가져오기
     */
    static acquireBuffer(size: number = MemoryOptimizer.POOL_BUFFER_SIZE): Uint8Array {
        if (MemoryOptimizer.bufferPool.length > 0 && size <= MemoryOptimizer.POOL_BUFFER_SIZE) {
            const poolBuffer = MemoryOptimizer.bufferPool.pop();
            if (poolBuffer) {
                return poolBuffer;
            }
        }
        return new Uint8Array(size);
    }

    /**
     * 버퍼를 풀에 반환
     */
    static releaseBuffer(buffer: Uint8Array): void {
        if (buffer.length === MemoryOptimizer.POOL_BUFFER_SIZE &&
            MemoryOptimizer.bufferPool.length < MemoryOptimizer.MAX_POOL_SIZE) {
            // 버퍼 초기화
            buffer.fill(0);
            MemoryOptimizer.bufferPool.push(buffer);
        }
    }

    /**
     * 버퍼 풀 초기화
     */
    static clearBufferPool(): void {
        MemoryOptimizer.bufferPool = [];
    }

    /**
     * 대용량 파일 적합성 검사
     * 
     * @param fileSize 파일 크기 (bytes)
     * @returns 권장 처리 방식
     */
    static analyzeFileSize(fileSize: number): {
        isLarge: boolean;
        recommendedChunkSize: number;
        estimatedMemoryUsage: number;
        suggestedStrategy: 'normal' | 'chunked' | 'streaming';
    } {
        const isLarge = fileSize > 50 * 1024 * 1024; // 50MB 이상
        const estimatedMemoryUsage = fileSize * 3; // 대략 3배 메모리 사용 예상

        let suggestedStrategy: 'normal' | 'chunked' | 'streaming' = 'normal';
        let recommendedChunkSize = MemoryOptimizer.DEFAULT_CHUNK_SIZE;

        if (fileSize > 100 * 1024 * 1024) {
            suggestedStrategy = 'streaming';
            recommendedChunkSize = 512 * 1024; // 512KB
        } else if (fileSize > 50 * 1024 * 1024) {
            suggestedStrategy = 'chunked';
            recommendedChunkSize = 1024 * 1024; // 1MB
        }

        return {
            isLarge,
            recommendedChunkSize,
            estimatedMemoryUsage,
            suggestedStrategy
        };
    }
}

/**
 * 스트리밍 변환 지원 (향후 구현 예정)
 * 
 * 이 인터페이스는 향후 스트리밍 변환 구현을 위한 기반입니다.
 */
export interface StreamingConverter {
    /** 스트림 초기화 */
    initialize(): Promise<void>;
    /** 청크 처리 */
    processChunk(chunk: Uint8Array): Promise<void>;
    /** 스트림 종료 및 결과 반환 */
    finalize(): Promise<Uint8Array>;
}

/**
 * 스트리밍 변환기 팩토리 (플레이스홀더)
 */
export function createStreamingConverter(): StreamingConverter {
    // TODO: 향후 스트리밍 변환 구현
    throw new Error('Streaming conversion is not yet implemented. Use Hwp2Hwpx.convert() for now.');
}
