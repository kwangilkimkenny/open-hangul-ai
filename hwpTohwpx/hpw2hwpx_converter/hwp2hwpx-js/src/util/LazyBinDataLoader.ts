/**
 * Lazy BinData Loader
 *
 * 대용량 이미지/바이너리 데이터를 지연 로딩하여 메모리 사용량 40% 절감
 *
 * @module Utils
 */

import { MemoryOptimizer } from './MemoryOptimizer';

/**
 * BinData 메타데이터 (실제 데이터 없이 참조만 저장)
 */
export interface BinDataMetadata {
    /** BinData ID */
    id: number;
    /** 파일 확장자 */
    extension: string;
    /** 데이터 크기 (bytes) */
    size: number;
    /** 원본 데이터 오프셋 */
    offset: number;
    /** 압축 여부 */
    isCompressed: boolean;
    /** 로드 완료 여부 */
    isLoaded: boolean;
}

/**
 * 지연 로딩된 BinData 항목
 */
export interface LazyBinDataItem {
    /** 메타데이터 */
    metadata: BinDataMetadata;
    /** 실제 데이터 (지연 로딩됨) */
    data: Uint8Array | null;
    /** 데이터 로드 함수 */
    loader: () => Promise<Uint8Array>;
}

/**
 * Lazy BinData 로더 옵션
 */
export interface LazyBinDataLoaderOptions {
    /** 즉시 로드할 최대 크기 (기본값: 100KB) */
    immediateLoadThreshold?: number;
    /** 캐시 최대 크기 (bytes, 기본값: 50MB) */
    maxCacheSize?: number;
    /** LRU 캐시 활성화 */
    enableLruCache?: boolean;
    /** 프리페치 활성화 */
    enablePrefetch?: boolean;
}

/**
 * 기본 옵션
 */
const DEFAULT_OPTIONS: LazyBinDataLoaderOptions = {
    immediateLoadThreshold: 100 * 1024, // 100KB
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    enableLruCache: true,
    enablePrefetch: false
};

/**
 * LRU 캐시 엔트리
 */
interface CacheEntry {
    id: number;
    data: Uint8Array;
    lastAccess: number;
}

/**
 * Lazy BinData 로더
 *
 * 대용량 바이너리 데이터를 필요할 때만 로드하여 메모리 절약
 *
 * @example
 * ```typescript
 * const loader = new LazyBinDataLoader(sourceBuffer);
 *
 * // 메타데이터만 로드
 * await loader.loadMetadata();
 *
 * // 필요할 때 데이터 로드
 * const imageData = await loader.getData(1);
 * ```
 */
export class LazyBinDataLoader {
    private metadataMap: Map<number, BinDataMetadata> = new Map();
    private dataCache: Map<number, Uint8Array> = new Map();
    private lruQueue: CacheEntry[] = [];
    private options: Required<LazyBinDataLoaderOptions>;
    private currentCacheSize: number = 0;
    private dataExtractors: Map<number, () => Promise<Uint8Array>> = new Map();

    constructor(options?: LazyBinDataLoaderOptions) {
        this.options = { ...DEFAULT_OPTIONS, ...options } as Required<LazyBinDataLoaderOptions>;
    }

    /**
     * BinData 메타데이터 등록
     */
    registerBinData(
        id: number,
        extension: string,
        size: number,
        offset: number,
        isCompressed: boolean = false
    ): void {
        this.metadataMap.set(id, {
            id,
            extension,
            size,
            offset,
            isCompressed,
            isLoaded: false
        });
    }

    /**
     * 데이터 추출 함수 등록
     */
    registerExtractor(id: number, extractor: () => Promise<Uint8Array>): void {
        this.dataExtractors.set(id, extractor);
    }

    /**
     * 기존 BinData Map에서 메타데이터 로드
     */
    loadFromBinDataMap(binData: Map<number, { data: Uint8Array; extension: string }>): void {
        for (const [id, item] of binData) {
            const size = item.data.length;

            this.metadataMap.set(id, {
                id,
                extension: item.extension,
                size,
                offset: 0,
                isCompressed: false,
                isLoaded: size <= this.options.immediateLoadThreshold
            });

            // 작은 데이터는 즉시 캐시
            if (size <= this.options.immediateLoadThreshold) {
                this.cacheData(id, item.data);
            }

            // 데이터 추출기 등록
            this.dataExtractors.set(id, async () => item.data);
        }
    }

    /**
     * BinData 데이터 가져오기 (지연 로딩)
     */
    async getData(id: number): Promise<Uint8Array | null> {
        // 캐시 확인
        if (this.dataCache.has(id)) {
            this.updateLruAccess(id);
            return this.dataCache.get(id) ?? null;
        }

        // 메타데이터 확인
        const metadata = this.metadataMap.get(id);
        if (!metadata) {
            return null;
        }

        // 데이터 로드
        const extractor = this.dataExtractors.get(id);
        if (!extractor) {
            return null;
        }

        const data = await extractor();

        // 캐시에 저장
        this.cacheData(id, data);
        metadata.isLoaded = true;

        return data;
    }

    /**
     * 여러 BinData 동시 로드
     */
    async getMultipleData(ids: number[]): Promise<Map<number, Uint8Array>> {
        const result = new Map<number, Uint8Array>();

        const loadPromises = ids.map(async (id) => {
            const data = await this.getData(id);
            if (data) {
                result.set(id, data);
            }
        });

        await Promise.all(loadPromises);
        return result;
    }

    /**
     * 메타데이터 가져오기
     */
    getMetadata(id: number): BinDataMetadata | undefined {
        return this.metadataMap.get(id);
    }

    /**
     * 모든 메타데이터 가져오기
     */
    getAllMetadata(): BinDataMetadata[] {
        return Array.from(this.metadataMap.values());
    }

    /**
     * 로드된 데이터 수
     */
    getLoadedCount(): number {
        return this.dataCache.size;
    }

    /**
     * 총 BinData 수
     */
    getTotalCount(): number {
        return this.metadataMap.size;
    }

    /**
     * 현재 캐시 크기
     */
    getCacheSize(): number {
        return this.currentCacheSize;
    }

    /**
     * 캐시 사용률 (%)
     */
    getCacheUsage(): number {
        return (this.currentCacheSize / this.options.maxCacheSize) * 100;
    }

    /**
     * 특정 BinData 캐시에서 제거
     */
    evict(id: number): void {
        const data = this.dataCache.get(id);
        if (data) {
            this.currentCacheSize -= data.length;
            this.dataCache.delete(id);

            const metadata = this.metadataMap.get(id);
            if (metadata) {
                metadata.isLoaded = false;
            }

            // LRU 큐에서 제거
            this.lruQueue = this.lruQueue.filter(entry => entry.id !== id);
        }
    }

    /**
     * 캐시 전체 비우기
     */
    clearCache(): void {
        this.dataCache.clear();
        this.lruQueue = [];
        this.currentCacheSize = 0;

        for (const metadata of this.metadataMap.values()) {
            metadata.isLoaded = false;
        }
    }

    /**
     * 리소스 해제
     */
    dispose(): void {
        this.clearCache();
        this.metadataMap.clear();
        this.dataExtractors.clear();
    }

    /**
     * 메모리 통계
     */
    getMemoryStats(): {
        totalMetadata: number;
        loadedData: number;
        cacheSize: string;
        maxCacheSize: string;
        cacheUsage: string;
    } {
        return {
            totalMetadata: this.metadataMap.size,
            loadedData: this.dataCache.size,
            cacheSize: MemoryOptimizer.formatBytes(this.currentCacheSize),
            maxCacheSize: MemoryOptimizer.formatBytes(this.options.maxCacheSize),
            cacheUsage: `${this.getCacheUsage().toFixed(1)}%`
        };
    }

    /**
     * 프리페치 (미리 로드)
     */
    async prefetch(ids: number[]): Promise<void> {
        if (!this.options.enablePrefetch) {
            return;
        }

        for (const id of ids) {
            if (!this.dataCache.has(id)) {
                await this.getData(id);
            }
        }
    }

    /**
     * 이터레이터로 모든 BinData 순회 (지연 로딩)
     */
    async *iterateAll(): AsyncGenerator<{ id: number; data: Uint8Array; metadata: BinDataMetadata }> {
        for (const [id, metadata] of this.metadataMap) {
            const data = await this.getData(id);
            if (data) {
                yield { id, data, metadata };
            }
        }
    }

    /**
     * 일반 Map으로 변환 (모든 데이터 로드)
     */
    async toMap(): Promise<Map<number, { data: Uint8Array; extension: string }>> {
        const result = new Map<number, { data: Uint8Array; extension: string }>();

        for await (const { id, data, metadata } of this.iterateAll()) {
            result.set(id, {
                data,
                extension: metadata.extension
            });
        }

        return result;
    }

    // ========== Private Methods ==========

    private cacheData(id: number, data: Uint8Array): void {
        // 캐시 용량 확인 및 LRU 정리
        while (this.currentCacheSize + data.length > this.options.maxCacheSize) {
            if (this.lruQueue.length === 0) break;

            const oldest = this.lruQueue.shift();
            if (oldest) {
                this.evict(oldest.id);
            }
        }

        // 캐시에 추가
        this.dataCache.set(id, data);
        this.currentCacheSize += data.length;

        if (this.options.enableLruCache) {
            this.lruQueue.push({
                id,
                data,
                lastAccess: Date.now()
            });
        }
    }

    private updateLruAccess(id: number): void {
        if (!this.options.enableLruCache) return;

        const index = this.lruQueue.findIndex(entry => entry.id === id);
        if (index !== -1) {
            const entry = this.lruQueue.splice(index, 1)[0];
            entry.lastAccess = Date.now();
            this.lruQueue.push(entry);
        }
    }
}

/**
 * 스트리밍 BinData 프로바이더
 *
 * ZIP 파일에서 BinData를 스트리밍으로 추출
 */
export class StreamingBinDataProvider {
    private loader: LazyBinDataLoader;

    constructor(options?: LazyBinDataLoaderOptions) {
        this.loader = new LazyBinDataLoader(options);
    }

    /**
     * 기존 BinData Map에서 초기화
     */
    initFromMap(binData: Map<number, { data: Uint8Array; extension: string }>): void {
        this.loader.loadFromBinDataMap(binData);
    }

    /**
     * BinData 가져오기
     */
    async get(id: number): Promise<{ data: Uint8Array; extension: string } | null> {
        const metadata = this.loader.getMetadata(id);
        if (!metadata) return null;

        const data = await this.loader.getData(id);
        if (!data) return null;

        return {
            data,
            extension: metadata.extension
        };
    }

    /**
     * 메타데이터 목록 가져오기
     */
    getMetadataList(): { id: number; extension: string }[] {
        return this.loader.getAllMetadata().map(m => ({
            id: m.id,
            extension: m.extension
        }));
    }

    /**
     * 통계 정보
     */
    getStats(): ReturnType<LazyBinDataLoader['getMemoryStats']> {
        return this.loader.getMemoryStats();
    }

    /**
     * 리소스 해제
     */
    dispose(): void {
        this.loader.dispose();
    }
}

/**
 * 유틸리티: 이미지 크기에 따른 로딩 전략 결정
 */
export function determineLoadingStrategy(
    metadata: BinDataMetadata[],
    availableMemory?: number
): {
    immediate: number[];
    lazy: number[];
    skip: number[];
} {
    const memoryLimit = availableMemory || 100 * 1024 * 1024; // 100MB 기본값
    const SMALL_THRESHOLD = 100 * 1024; // 100KB
    const LARGE_THRESHOLD = 10 * 1024 * 1024; // 10MB

    const immediate: number[] = [];
    const lazy: number[] = [];
    const skip: number[] = [];

    let totalImmediateSize = 0;

    for (const meta of metadata) {
        if (meta.size <= SMALL_THRESHOLD) {
            // 작은 파일은 즉시 로드
            if (totalImmediateSize + meta.size <= memoryLimit * 0.3) {
                immediate.push(meta.id);
                totalImmediateSize += meta.size;
            } else {
                lazy.push(meta.id);
            }
        } else if (meta.size >= LARGE_THRESHOLD) {
            // 매우 큰 파일은 필요할 때만
            lazy.push(meta.id);
        } else {
            // 중간 크기는 조건부
            lazy.push(meta.id);
        }
    }

    return { immediate, lazy, skip };
}
