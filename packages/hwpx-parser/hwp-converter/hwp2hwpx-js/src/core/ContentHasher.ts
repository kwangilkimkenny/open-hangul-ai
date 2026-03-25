/**
 * ContentHasher - Fast content hashing for incremental conversion
 *
 * Implements FNV-1a hash algorithm for fast content fingerprinting.
 * Used to detect changes in document sections for incremental conversion.
 *
 * Benefits:
 * - O(n) hashing with minimal overhead
 * - Good distribution for content-based change detection
 * - Collision-resistant for typical document content
 *
 * @module Core
 * @category Core
 */

/**
 * FNV-1a hash constants (32-bit)
 */
const FNV_PRIME_32 = 0x01000193;
const FNV_OFFSET_32 = 0x811c9dc5;

/**
 * FNV-1a hash constants (64-bit using BigInt)
 */
const FNV_PRIME_64 = BigInt('0x00000100000001B3');
const FNV_OFFSET_64 = BigInt('0xcbf29ce484222325');

/**
 * Hash result type
 */
export interface ContentHash {
    /** 32-bit hash value (fast) */
    hash32: number;

    /** 64-bit hash value (more collision resistant) */
    hash64: bigint;

    /** Hex string representation */
    hex: string;

    /** Content size in bytes */
    size: number;
}

/**
 * FNV-1a 32-bit hash
 *
 * @param data Input data
 * @returns 32-bit hash value
 */
export function fnv1a32(data: Uint8Array | string): number {
    let hash = FNV_OFFSET_32;

    if (typeof data === 'string') {
        const len = data.length;
        for (let i = 0; i < len; i++) {
            hash ^= data.charCodeAt(i);
            hash = Math.imul(hash, FNV_PRIME_32);
        }
    } else {
        const len = data.length;
        for (let i = 0; i < len; i++) {
            hash ^= data[i];
            hash = Math.imul(hash, FNV_PRIME_32);
        }
    }

    return hash >>> 0; // Convert to unsigned
}

/**
 * FNV-1a 64-bit hash using BigInt
 *
 * @param data Input data
 * @returns 64-bit hash value as BigInt
 */
export function fnv1a64(data: Uint8Array | string): bigint {
    let hash = FNV_OFFSET_64;

    if (typeof data === 'string') {
        const len = data.length;
        for (let i = 0; i < len; i++) {
            hash ^= BigInt(data.charCodeAt(i));
            hash = (hash * FNV_PRIME_64) & BigInt('0xFFFFFFFFFFFFFFFF');
        }
    } else {
        const len = data.length;
        for (let i = 0; i < len; i++) {
            hash ^= BigInt(data[i]);
            hash = (hash * FNV_PRIME_64) & BigInt('0xFFFFFFFFFFFFFFFF');
        }
    }

    return hash;
}

/**
 * ContentHasher class for document content hashing
 *
 * @example
 * ```typescript
 * const hasher = new ContentHasher();
 *
 * // Hash a section
 * const hash1 = hasher.hashSection(section);
 *
 * // Later, check if section changed
 * const hash2 = hasher.hashSection(modifiedSection);
 * if (hash1.hex !== hash2.hex) {
 *     console.log('Section changed');
 * }
 * ```
 */
export class ContentHasher {
    private encoder: TextEncoder;

    constructor() {
        this.encoder = new TextEncoder();
    }

    /**
     * Hash arbitrary data
     */
    hash(data: Uint8Array | string): ContentHash {
        const bytes = typeof data === 'string' ? this.encoder.encode(data) : data;
        const hash32 = fnv1a32(bytes);
        const hash64 = fnv1a64(bytes);

        return {
            hash32,
            hash64,
            hex: hash64.toString(16).padStart(16, '0'),
            size: bytes.length
        };
    }

    /**
     * Hash a section object
     */
    hashSection(section: unknown): ContentHash {
        const json = JSON.stringify(section, this.jsonReplacer);
        return this.hash(json);
    }

    /**
     * Hash DocInfo object
     */
    hashDocInfo(docInfo: unknown): ContentHash {
        const json = JSON.stringify(docInfo, this.jsonReplacer);
        return this.hash(json);
    }

    /**
     * Hash binary data (e.g., images)
     */
    hashBinary(data: Uint8Array): ContentHash {
        return this.hash(data);
    }

    /**
     * Hash multiple items and combine
     */
    hashMultiple(items: Array<Uint8Array | string | unknown>): ContentHash {
        const hashes: string[] = [];

        for (const item of items) {
            if (item instanceof Uint8Array) {
                hashes.push(this.hashBinary(item).hex);
            } else if (typeof item === 'string') {
                hashes.push(this.hash(item).hex);
            } else {
                hashes.push(this.hashSection(item).hex);
            }
        }

        return this.hash(hashes.join(':'));
    }

    /**
     * Compare two hashes
     */
    compare(hash1: ContentHash, hash2: ContentHash): boolean {
        return hash1.hash64 === hash2.hash64;
    }

    /**
     * JSON replacer to handle special types
     */
    private jsonReplacer(_key: string, value: unknown): unknown {
        if (value instanceof Uint8Array) {
            // Hash binary data instead of serializing
            return `<binary:${value.length}:${fnv1a32(value).toString(16)}>`;
        }
        if (value instanceof Map) {
            return Object.fromEntries(value);
        }
        if (value instanceof Set) {
            return Array.from(value);
        }
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    }
}

/**
 * Quick hash function for simple use cases
 */
export function quickHash(data: Uint8Array | string): string {
    const hash64 = fnv1a64(data);
    return hash64.toString(16).padStart(16, '0');
}

/**
 * Hash a file's content for caching
 */
export function hashFileContent(data: ArrayBuffer): string {
    const bytes = new Uint8Array(data);
    return quickHash(bytes);
}

/**
 * Create a composite hash from multiple components
 */
export function createCompositeHash(components: string[]): string {
    return quickHash(components.join('|'));
}

/**
 * Singleton hasher instance
 */
let globalHasher: ContentHasher | null = null;

/**
 * Get global hasher instance
 */
export function getGlobalHasher(): ContentHasher {
    if (!globalHasher) {
        globalHasher = new ContentHasher();
    }
    return globalHasher;
}
