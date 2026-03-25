/**
 * ConversionCache - LRU cache for incremental conversion
 *
 * Implements a Least Recently Used (LRU) cache for storing
 * converted document sections. Enables 80-90% faster repeated
 * conversions by reusing previously generated XML.
 *
 * Features:
 * - LRU eviction policy
 * - Time-based expiration
 * - Memory-aware sizing
 * - Statistics tracking
 *
 * @module Core
 * @category Core
 */

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
    /** Cached value */
    value: T;

    /** Content hash for validation */
    hash: string;

    /** Creation timestamp */
    createdAt: number;

    /** Last access timestamp */
    accessedAt: number;

    /** Entry size in bytes (estimated) */
    size: number;

    /** Access count */
    accessCount: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
    /** Total entries in cache */
    entries: number;

    /** Cache hits */
    hits: number;

    /** Cache misses */
    misses: number;

    /** Hit rate percentage */
    hitRate: number;

    /** Total memory used (bytes) */
    memoryUsed: number;

    /** Maximum memory allowed (bytes) */
    maxMemory: number;

    /** Memory utilization percentage */
    memoryUtilization: number;

    /** Evictions due to capacity */
    evictions: number;

    /** Evictions due to expiration */
    expirations: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
    /** Maximum entries (default: 1000) */
    maxEntries?: number;

    /** Maximum memory in bytes (default: 100MB) */
    maxMemory?: number;

    /** Entry TTL in milliseconds (default: 30 minutes) */
    ttl?: number;

    /** Enable statistics tracking */
    trackStats?: boolean;

    /** Cleanup interval in milliseconds (default: 60 seconds) */
    cleanupInterval?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<CacheConfig> = {
    maxEntries: 1000,
    maxMemory: 100 * 1024 * 1024, // 100MB
    ttl: 30 * 60 * 1000, // 30 minutes
    trackStats: true,
    cleanupInterval: 60 * 1000 // 1 minute
};

/**
 * ConversionCache - LRU cache with memory management
 *
 * @example
 * ```typescript
 * const cache = new ConversionCache();
 *
 * // Cache a section's XML
 * cache.set('section:0', sectionXml, sectionHash);
 *
 * // Later, check cache before regenerating
 * const cached = cache.get('section:0', currentHash);
 * if (cached) {
 *     // Use cached XML
 * } else {
 *     // Generate new XML
 * }
 * ```
 */
export class ConversionCache<T = string> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private config: Required<CacheConfig>;
    private memoryUsed: number = 0;
    private hits: number = 0;
    private misses: number = 0;
    private evictions: number = 0;
    private expirations: number = 0;
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor(config: CacheConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Start cleanup timer if configured
        if (this.config.cleanupInterval > 0) {
            this.startCleanupTimer();
        }
    }

    /**
     * Get a value from cache
     *
     * @param key Cache key
     * @param hash Current content hash (optional, for validation)
     * @returns Cached value or undefined
     */
    get(key: string, hash?: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            if (this.config.trackStats) {
                this.misses++;
            }
            return undefined;
        }

        // Check expiration
        if (this.isExpired(entry)) {
            this.delete(key);
            if (this.config.trackStats) {
                this.misses++;
                this.expirations++;
            }
            return undefined;
        }

        // Check hash validity
        if (hash !== undefined && entry.hash !== hash) {
            this.delete(key);
            if (this.config.trackStats) {
                this.misses++;
            }
            return undefined;
        }

        // Update access time and move to end (LRU)
        entry.accessedAt = Date.now();
        entry.accessCount++;

        // Move to end of map (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        if (this.config.trackStats) {
            this.hits++;
        }

        return entry.value;
    }

    /**
     * Set a value in cache
     *
     * @param key Cache key
     * @param value Value to cache
     * @param hash Content hash for validation
     * @param size Optional size in bytes (estimated if not provided)
     */
    set(key: string, value: T, hash: string, size?: number): void {
        // Remove existing entry if present
        if (this.cache.has(key)) {
            this.delete(key);
        }

        // Estimate size if not provided
        const entrySize = size ?? this.estimateSize(value);

        // Evict entries if needed
        this.ensureCapacity(entrySize);

        const entry: CacheEntry<T> = {
            value,
            hash,
            createdAt: Date.now(),
            accessedAt: Date.now(),
            size: entrySize,
            accessCount: 0
        };

        this.cache.set(key, entry);
        this.memoryUsed += entrySize;
    }

    /**
     * Check if a key exists and is valid
     *
     * @param key Cache key
     * @param hash Optional hash for validation
     */
    has(key: string, hash?: string): boolean {
        const entry = this.cache.get(key);

        if (!entry) return false;
        if (this.isExpired(entry)) return false;
        if (hash !== undefined && entry.hash !== hash) return false;

        return true;
    }

    /**
     * Delete an entry from cache
     */
    delete(key: string): boolean {
        const entry = this.cache.get(key);

        if (!entry) return false;

        this.memoryUsed -= entry.size;
        return this.cache.delete(key);
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
        this.memoryUsed = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const totalRequests = this.hits + this.misses;

        return {
            entries: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0,
            memoryUsed: this.memoryUsed,
            maxMemory: this.config.maxMemory,
            memoryUtilization: (this.memoryUsed / this.config.maxMemory) * 100,
            evictions: this.evictions,
            expirations: this.expirations
        };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.expirations = 0;
    }

    /**
     * Get all keys
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get number of entries
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Check if entry is expired
     */
    private isExpired(entry: CacheEntry<T>): boolean {
        return Date.now() - entry.createdAt > this.config.ttl;
    }

    /**
     * Ensure capacity for new entry
     */
    private ensureCapacity(newEntrySize: number): void {
        // Evict by count if needed
        while (this.cache.size >= this.config.maxEntries) {
            this.evictLRU();
        }

        // Evict by memory if needed
        while (this.memoryUsed + newEntrySize > this.config.maxMemory && this.cache.size > 0) {
            this.evictLRU();
        }
    }

    /**
     * Evict least recently used entry
     */
    private evictLRU(): void {
        // First entry in Map is oldest (LRU)
        const firstKey = this.cache.keys().next().value;

        if (firstKey !== undefined) {
            this.delete(firstKey);
            this.evictions++;
        }
    }

    /**
     * Estimate size of value
     */
    private estimateSize(value: T): number {
        if (typeof value === 'string') {
            // Approximate: 2 bytes per character (UTF-16)
            return value.length * 2;
        }

        if (value instanceof Uint8Array) {
            return value.length;
        }

        if (value instanceof ArrayBuffer) {
            return value.byteLength;
        }

        // JSON stringify for objects
        try {
            return JSON.stringify(value).length * 2;
        } catch {
            return 1000; // Default estimate
        }
    }

    /**
     * Cleanup expired entries
     */
    cleanup(): number {
        let cleaned = 0;

        for (const [key, entry] of this.cache) {
            if (this.isExpired(entry)) {
                this.delete(key);
                cleaned++;
                this.expirations++;
            }
        }

        return cleaned;
    }

    /**
     * Start automatic cleanup timer
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Dispose cache and release resources
     */
    dispose(): void {
        this.stopCleanupTimer();
        this.clear();
    }
}

/**
 * Specialized cache for section XML
 */
export class SectionCache extends ConversionCache<string> {
    /**
     * Get section XML by index
     */
    getSectionXml(sectionIndex: number, hash: string): string | undefined {
        return this.get(`section:${sectionIndex}`, hash);
    }

    /**
     * Set section XML by index
     */
    setSectionXml(sectionIndex: number, xml: string, hash: string): void {
        this.set(`section:${sectionIndex}`, xml, hash);
    }

    /**
     * Check if section is cached
     */
    hasSection(sectionIndex: number, hash: string): boolean {
        return this.has(`section:${sectionIndex}`, hash);
    }
}

/**
 * Specialized cache for DocInfo
 */
export class DocInfoCache extends ConversionCache<string> {
    /**
     * Get DocInfo XML
     */
    getDocInfoXml(hash: string): string | undefined {
        return this.get('docinfo', hash);
    }

    /**
     * Set DocInfo XML
     */
    setDocInfoXml(xml: string, hash: string): void {
        this.set('docinfo', xml, hash);
    }

    /**
     * Check if DocInfo is cached
     */
    hasDocInfo(hash: string): boolean {
        return this.has('docinfo', hash);
    }
}

/**
 * Global cache instance
 */
let globalCache: ConversionCache | null = null;

/**
 * Get global conversion cache
 */
export function getGlobalCache(): ConversionCache {
    if (!globalCache) {
        globalCache = new ConversionCache();
    }
    return globalCache;
}

/**
 * Reset global cache
 */
export function resetGlobalCache(): void {
    if (globalCache) {
        globalCache.dispose();
        globalCache = null;
    }
}
