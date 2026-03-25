/* tslint:disable */
/* eslint-disable */

/**
 * Directory entry structure
 */
export class DirectoryEntry {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Child ID
     */
    childId: number;
    /**
     * Entry type: 0=Unknown, 1=Storage, 2=Stream, 5=Root
     */
    entryType: number;
    /**
     * Entry index
     */
    index: number;
    /**
     * Left sibling ID
     */
    leftSiblingId: number;
    /**
     * Entry name
     */
    name: string;
    /**
     * Right sibling ID
     */
    rightSiblingId: number;
    /**
     * Stream size
     */
    size: number;
    /**
     * Starting sector
     */
    startSector: number;
}

/**
 * OLE file header information
 */
export class OleHeader {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * First directory sector
     */
    firstDirectorySector: number;
    /**
     * Major version (3 or 4)
     */
    majorVersion: number;
    /**
     * Mini sector size in bytes
     */
    miniSectorSize: number;
    /**
     * Mini stream cutoff size
     */
    miniStreamCutoffSize: number;
    /**
     * Sector size in bytes
     */
    sectorSize: number;
}

/**
 * OLE Compound File Parser
 */
export class OleParser {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Find entries matching prefix
     */
    findEntriesWithPrefix(prefix: string): DirectoryEntry[];
    /**
     * Find entry by name
     */
    findEntry(name: string): DirectoryEntry | undefined;
    /**
     * Get directory entries
     */
    getDirectory(): DirectoryEntry[];
    /**
     * Get entry count
     */
    getEntryCount(): number;
    /**
     * Get OLE header information
     */
    getHeader(): OleHeader;
    /**
     * Check if this is a valid OLE file
     */
    isValid(): boolean;
    /**
     * Create a new OLE parser
     */
    constructor(data: Uint8Array);
    /**
     * Read stream data by entry index
     */
    readStream(entry_index: number): Uint8Array;
    /**
     * Read stream by entry name
     */
    readStreamByName(name: string): Uint8Array;
}

/**
 * Streaming decompressor for large data
 *
 * Decompresses data in chunks to reduce memory usage.
 */
export class StreamingInflator {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Finish decompression and get result
     */
    finish(): Uint8Array;
    /**
     * Create a new streaming inflator
     */
    constructor();
    /**
     * Add compressed data chunk
     */
    push(chunk: Uint8Array): void;
    /**
     * Reset for reuse
     */
    reset(): void;
}

/**
 * Calculate CRC32 checksum
 */
export function crc32(data: Uint8Array): number;

/**
 * Compress data using zlib
 *
 * # Arguments
 * * `data` - Uncompressed data
 * * `level` - Compression level (0-9, where 9 is maximum compression)
 *
 * # Returns
 * Compressed data as Vec<u8>
 */
export function deflate(data: Uint8Array, level: number): Uint8Array;

/**
 * Compress data using raw deflate (no zlib header)
 *
 * # Arguments
 * * `data` - Uncompressed data
 * * `level` - Compression level (0-9)
 *
 * # Returns
 * Compressed data as Vec<u8>
 */
export function deflateRaw(data: Uint8Array, level: number): Uint8Array;

/**
 * Simple benchmark: hash bytes using FNV-1a
 */
export function fnv1a_hash(data: Uint8Array): number;

/**
 * Get maximum output buffer size for decompression
 *
 * This is useful for pre-allocating buffers.
 *
 * # Arguments
 * * `input_size` - Size of compressed data
 *
 * # Returns
 * Maximum possible output size
 */
export function getMaxDecompressedSize(input_size: number): number;

/**
 * Get module version
 */
export function get_version(): string;

/**
 * Decompress zlib-compressed data (with zlib header)
 *
 * This is the standard zlib format used by most HWP files.
 *
 * # Arguments
 * * `data` - Compressed data bytes
 *
 * # Returns
 * Decompressed data as Vec<u8>
 *
 * # Errors
 * Returns JsError if decompression fails
 */
export function inflate(data: Uint8Array): Uint8Array;

/**
 * Try both zlib and raw deflate decompression
 *
 * Automatically detects the compression format and decompresses.
 * Useful when the compression format is unknown.
 *
 * # Arguments
 * * `data` - Compressed data (zlib or raw deflate)
 *
 * # Returns
 * Decompressed data as Vec<u8>
 */
export function inflateAuto(data: Uint8Array): Uint8Array;

/**
 * Decompress raw deflate data (without zlib header)
 *
 * Some HWP streams use raw deflate without the zlib header.
 *
 * # Arguments
 * * `data` - Raw deflate compressed data
 *
 * # Returns
 * Decompressed data as Vec<u8>
 */
export function inflateRaw(data: Uint8Array): Uint8Array;

/**
 * Initialize the WASM module
 */
export function init(): void;

/**
 * Check if WASM module is ready
 */
export function is_ready(): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_directoryentry_free: (a: number, b: number) => void;
    readonly __wbg_get_directoryentry_childId: (a: number) => number;
    readonly __wbg_get_directoryentry_entryType: (a: number) => number;
    readonly __wbg_get_directoryentry_index: (a: number) => number;
    readonly __wbg_get_directoryentry_leftSiblingId: (a: number) => number;
    readonly __wbg_get_directoryentry_name: (a: number) => [number, number];
    readonly __wbg_get_directoryentry_rightSiblingId: (a: number) => number;
    readonly __wbg_get_directoryentry_size: (a: number) => number;
    readonly __wbg_get_directoryentry_startSector: (a: number) => number;
    readonly __wbg_get_oleheader_majorVersion: (a: number) => number;
    readonly __wbg_get_oleheader_miniSectorSize: (a: number) => number;
    readonly __wbg_get_oleheader_miniStreamCutoffSize: (a: number) => number;
    readonly __wbg_get_oleheader_sectorSize: (a: number) => number;
    readonly __wbg_oleheader_free: (a: number, b: number) => void;
    readonly __wbg_oleparser_free: (a: number, b: number) => void;
    readonly __wbg_set_directoryentry_childId: (a: number, b: number) => void;
    readonly __wbg_set_directoryentry_entryType: (a: number, b: number) => void;
    readonly __wbg_set_directoryentry_index: (a: number, b: number) => void;
    readonly __wbg_set_directoryentry_leftSiblingId: (a: number, b: number) => void;
    readonly __wbg_set_directoryentry_name: (a: number, b: number, c: number) => void;
    readonly __wbg_set_directoryentry_rightSiblingId: (a: number, b: number) => void;
    readonly __wbg_set_directoryentry_size: (a: number, b: number) => void;
    readonly __wbg_set_directoryentry_startSector: (a: number, b: number) => void;
    readonly __wbg_set_oleheader_majorVersion: (a: number, b: number) => void;
    readonly __wbg_set_oleheader_miniSectorSize: (a: number, b: number) => void;
    readonly __wbg_set_oleheader_miniStreamCutoffSize: (a: number, b: number) => void;
    readonly __wbg_set_oleheader_sectorSize: (a: number, b: number) => void;
    readonly __wbg_streaminginflator_free: (a: number, b: number) => void;
    readonly crc32: (a: number, b: number) => number;
    readonly deflate: (a: number, b: number, c: number) => [number, number, number, number];
    readonly deflateRaw: (a: number, b: number, c: number) => [number, number, number, number];
    readonly fnv1a_hash: (a: number, b: number) => number;
    readonly getMaxDecompressedSize: (a: number) => number;
    readonly get_version: () => [number, number];
    readonly inflate: (a: number, b: number) => [number, number, number, number];
    readonly inflateAuto: (a: number, b: number) => [number, number, number, number];
    readonly inflateRaw: (a: number, b: number) => [number, number, number, number];
    readonly is_ready: () => number;
    readonly oleparser_findEntriesWithPrefix: (a: number, b: number, c: number) => [number, number];
    readonly oleparser_findEntry: (a: number, b: number, c: number) => number;
    readonly oleparser_getDirectory: (a: number) => [number, number];
    readonly oleparser_getEntryCount: (a: number) => number;
    readonly oleparser_getHeader: (a: number) => number;
    readonly oleparser_isValid: (a: number) => number;
    readonly oleparser_new: (a: number, b: number) => [number, number, number];
    readonly oleparser_readStream: (a: number, b: number) => [number, number, number, number];
    readonly oleparser_readStreamByName: (a: number, b: number, c: number) => [number, number, number, number];
    readonly streaminginflator_finish: (a: number) => [number, number, number, number];
    readonly streaminginflator_new: () => number;
    readonly streaminginflator_push: (a: number, b: number, c: number) => void;
    readonly streaminginflator_reset: (a: number) => void;
    readonly __wbg_set_oleheader_firstDirectorySector: (a: number, b: number) => void;
    readonly init: () => void;
    readonly __wbg_get_oleheader_firstDirectorySector: (a: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
