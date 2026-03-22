/**
 * WASM Module - High-performance WebAssembly utilities
 *
 * Provides WASM-accelerated implementations of:
 * - Compression/decompression (2-4x faster than pako)
 * - OLE parsing
 * - Hashing utilities
 *
 * Automatic fallback to JavaScript when WASM is not available.
 *
 * @module Wasm
 * @category Wasm
 */

// WASM module loader
export {
    loadWasm,
    getWasmModule,
    isWasmSupported,
    isWasmAvailable,
    isWasmLoadComplete,
    getWasmLoadError,
    reloadWasm,
    unloadWasm,
    setWasmModulePath,
    withWasm,
    withWasmSync
} from './WasmModule';

export type {
    HwpWasmModule,
    OleParserInstance,
    StreamingInflatorInstance
} from './WasmModule';

// Compression utilities
export {
    initCompression,
    inflate,
    inflateAuto,
    deflate,
    tryInflate,
    inflateWithStats,
    deflateWithStats,
    inflateBatch,
    deflateBatch,
    fnv1aHash,
    crc32,
    getCompressionStatus
} from './CompressionHelper';

export type {
    CompressionOptions,
    CompressionStats
} from './CompressionHelper';
