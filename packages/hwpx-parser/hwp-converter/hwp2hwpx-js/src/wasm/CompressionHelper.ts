/**
 * CompressionHelper - Unified compression/decompression API
 *
 * Provides a unified interface for compression operations,
 * automatically using WASM when available and falling back
 * to pako for JavaScript-only environments.
 *
 * Performance:
 * - WASM: 2-4x faster than pako
 * - Automatic fallback to pako
 *
 * @module Wasm
 * @category Wasm
 */

import pako from 'pako';
import { loadWasm, getWasmModule, isWasmAvailable, withWasmSync } from './WasmModule';

/**
 * Compression options
 */
export interface CompressionOptions {
    /** Compression level (0-9, where 9 is maximum compression) */
    level?: number;

    /** Force using pako (skip WASM) */
    forcePako?: boolean;

    /** Raw deflate (no zlib header) */
    raw?: boolean;
}

/**
 * Compression statistics
 */
export interface CompressionStats {
    /** Whether WASM was used */
    usedWasm: boolean;

    /** Original size in bytes */
    originalSize: number;

    /** Compressed/decompressed size in bytes */
    resultSize: number;

    /** Time taken in milliseconds */
    timeMs: number;
}

/**
 * Initialize compression module
 *
 * Pre-loads WASM module for faster first operation
 */
export async function initCompression(): Promise<boolean> {
    const wasm = await loadWasm();
    return wasm !== null;
}

/**
 * Decompress zlib-compressed data
 *
 * @param data Compressed data
 * @param options Decompression options
 * @returns Decompressed data
 */
export function inflate(
    data: Uint8Array,
    options: CompressionOptions = {}
): Uint8Array {
    if (options.forcePako) {
        return options.raw ? pako.inflateRaw(data) : pako.inflate(data);
    }

    return withWasmSync(
        (wasm) => {
            if (options.raw) {
                return new Uint8Array(wasm.inflateRaw(data));
            }
            return new Uint8Array(wasm.inflate(data));
        },
        () => {
            return options.raw ? pako.inflateRaw(data) : pako.inflate(data);
        }
    );
}

/**
 * Decompress with automatic format detection
 *
 * Tries zlib first, then raw deflate
 *
 * @param data Compressed data
 * @param options Decompression options
 * @returns Decompressed data
 */
export function inflateAuto(
    data: Uint8Array,
    options: CompressionOptions = {}
): Uint8Array {
    if (options.forcePako) {
        try {
            return pako.inflate(data);
        } catch {
            return pako.inflateRaw(data);
        }
    }

    return withWasmSync(
        (wasm) => new Uint8Array(wasm.inflateAuto(data)),
        () => {
            try {
                return pako.inflate(data);
            } catch {
                return pako.inflateRaw(data);
            }
        }
    );
}

/**
 * Compress data using zlib
 *
 * @param data Uncompressed data
 * @param options Compression options
 * @returns Compressed data
 */
export function deflate(
    data: Uint8Array,
    options: CompressionOptions = {}
): Uint8Array {
    const level = options.level ?? 6;

    // Clamp level to valid pako range (-1 to 9)
    const pakoLevel = Math.max(-1, Math.min(9, level)) as pako.DeflateFunctionOptions['level'];

    if (options.forcePako) {
        return options.raw
            ? pako.deflateRaw(data, { level: pakoLevel })
            : pako.deflate(data, { level: pakoLevel });
    }

    return withWasmSync(
        (wasm) => {
            if (options.raw) {
                return new Uint8Array(wasm.deflateRaw(data, level));
            }
            return new Uint8Array(wasm.deflate(data, level));
        },
        () => {
            return options.raw
                ? pako.deflateRaw(data, { level: pakoLevel })
                : pako.deflate(data, { level: pakoLevel });
        }
    );
}

/**
 * Try to decompress data, return original if not compressed
 *
 * @param data Potentially compressed data
 * @returns Decompressed data or original if not compressed
 */
export function tryInflate(data: Uint8Array): Uint8Array {
    try {
        return inflateAuto(data);
    } catch {
        return data;
    }
}

/**
 * Decompress with statistics tracking
 *
 * @param data Compressed data
 * @param options Decompression options
 * @returns Object with result and statistics
 */
export function inflateWithStats(
    data: Uint8Array,
    options: CompressionOptions = {}
): { result: Uint8Array; stats: CompressionStats } {
    const startTime = performance.now();
    const usedWasm = isWasmAvailable() && !options.forcePako;

    const result = inflate(data, options);

    return {
        result,
        stats: {
            usedWasm,
            originalSize: data.length,
            resultSize: result.length,
            timeMs: performance.now() - startTime
        }
    };
}

/**
 * Compress with statistics tracking
 *
 * @param data Uncompressed data
 * @param options Compression options
 * @returns Object with result and statistics
 */
export function deflateWithStats(
    data: Uint8Array,
    options: CompressionOptions = {}
): { result: Uint8Array; stats: CompressionStats } {
    const startTime = performance.now();
    const usedWasm = isWasmAvailable() && !options.forcePako;

    const result = deflate(data, options);

    return {
        result,
        stats: {
            usedWasm,
            originalSize: data.length,
            resultSize: result.length,
            timeMs: performance.now() - startTime
        }
    };
}

/**
 * Batch decompress multiple chunks
 *
 * @param chunks Array of compressed chunks
 * @param options Decompression options
 * @returns Array of decompressed chunks
 */
export function inflateBatch(
    chunks: Uint8Array[],
    options: CompressionOptions = {}
): Uint8Array[] {
    return chunks.map(chunk => inflate(chunk, options));
}

/**
 * Batch compress multiple chunks
 *
 * @param chunks Array of uncompressed chunks
 * @param options Compression options
 * @returns Array of compressed chunks
 */
export function deflateBatch(
    chunks: Uint8Array[],
    options: CompressionOptions = {}
): Uint8Array[] {
    return chunks.map(chunk => deflate(chunk, options));
}

/**
 * Calculate FNV-1a hash (faster than SHA for change detection)
 */
export function fnv1aHash(data: Uint8Array): number {
    return withWasmSync(
        (wasm) => wasm.fnv1a_hash(data),
        () => {
            // JavaScript fallback
            const FNV_PRIME = 0x01000193;
            const FNV_OFFSET = 0x811c9dc5;

            let hash = FNV_OFFSET;
            for (let i = 0; i < data.length; i++) {
                hash ^= data[i];
                hash = Math.imul(hash, FNV_PRIME);
            }
            return hash >>> 0;
        }
    );
}

// CRC32 lookup table (pre-computed)
const CRC32_TABLE: number[] = (() => {
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c;
    }
    return table;
})();

/**
 * Calculate CRC32 checksum
 */
export function crc32(data: Uint8Array): number {
    return withWasmSync(
        (wasm) => wasm.crc32(data),
        () => {
            // JavaScript fallback implementation
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < data.length; i++) {
                crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
    );
}

/**
 * Get compression module status
 */
export function getCompressionStatus(): {
    wasmAvailable: boolean;
    wasmVersion: string | null;
    fallbackAvailable: boolean;
} {
    const wasm = getWasmModule();

    return {
        wasmAvailable: wasm !== null,
        wasmVersion: wasm ? wasm.get_version() : null,
        fallbackAvailable: true // pako is always available
    };
}
