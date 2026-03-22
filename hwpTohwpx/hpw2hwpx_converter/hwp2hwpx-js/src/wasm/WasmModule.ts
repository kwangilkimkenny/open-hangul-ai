/**
 * WasmModule - WebAssembly module loader and manager
 *
 * Handles loading, initialization, and lifecycle of the WASM module.
 * Provides automatic fallback to JavaScript implementations when
 * WASM is not available.
 *
 * @module Wasm
 * @category Wasm
 */

import { Logger } from '../util/Logger';

/**
 * WASM module interface
 */
export interface HwpWasmModule {
    // Initialization
    is_ready(): boolean;
    get_version(): string;

    // Compression
    inflate(data: Uint8Array): Uint8Array;
    inflateRaw(data: Uint8Array): Uint8Array;
    inflateAuto(data: Uint8Array): Uint8Array;
    deflate(data: Uint8Array, level: number): Uint8Array;
    deflateRaw(data: Uint8Array, level: number): Uint8Array;

    // Hashing
    fnv1a_hash(data: Uint8Array): number;
    crc32(data: Uint8Array): number;

    // OLE Parser (class)
    OleParser: {
        new(data: Uint8Array): OleParserInstance;
    };

    // Streaming Inflator (class)
    StreamingInflator: {
        new(): StreamingInflatorInstance;
    };
}

/**
 * OLE Parser instance interface
 */
export interface OleParserInstance {
    getHeader(): {
        majorVersion: number;
        sectorSize: number;
        miniSectorSize: number;
        miniStreamCutoffSize: number;
        firstDirectorySector: number;
    };
    getDirectory(): Array<{
        name: string;
        entryType: number;
        leftSiblingId: number;
        rightSiblingId: number;
        childId: number;
        startSector: number;
        size: number;
        index: number;
    }>;
    getEntryCount(): number;
    findEntry(name: string): {
        name: string;
        entryType: number;
        size: number;
        index: number;
    } | undefined;
    findEntriesWithPrefix(prefix: string): Array<{
        name: string;
        entryType: number;
        size: number;
        index: number;
    }>;
    readStream(entryIndex: number): Uint8Array;
    readStreamByName(name: string): Uint8Array;
    isValid(): boolean;
    free(): void;
}

/**
 * Streaming Inflator instance interface
 */
export interface StreamingInflatorInstance {
    push(chunk: Uint8Array): void;
    finish(): Uint8Array;
    reset(): void;
    free(): void;
}

/**
 * WASM module state
 */
interface WasmState {
    module: HwpWasmModule | null;
    loading: Promise<HwpWasmModule | null> | null;
    loaded: boolean;
    error: Error | null;
}

// Global state
const state: WasmState = {
    module: null,
    loading: null,
    loaded: false,
    error: null
};

/**
 * Default WASM module path
 */
let wasmModulePath: string | URL = './wasm/pkg/hwp_wasm.js';

/**
 * Set WASM module path
 */
export function setWasmModulePath(path: string | URL): void {
    wasmModulePath = path;
}

/**
 * Check if WASM is supported in the current environment
 */
export function isWasmSupported(): boolean {
    try {
        if (typeof WebAssembly === 'object' &&
            typeof WebAssembly.instantiate === 'function') {
            // Check for basic WASM support
            const module = new WebAssembly.Module(
                new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
            );
            return module instanceof WebAssembly.Module;
        }
    } catch {
        // WASM not supported
    }
    return false;
}

/**
 * Load the WASM module
 *
 * @returns Promise that resolves to the WASM module or null if unavailable
 */
export async function loadWasm(): Promise<HwpWasmModule | null> {
    // Return cached module if already loaded
    if (state.loaded) {
        return state.module;
    }

    // Return existing loading promise if in progress
    if (state.loading) {
        return state.loading;
    }

    // Check WASM support
    if (!isWasmSupported()) {
        console.warn('[WasmModule] WebAssembly not supported in this environment');
        state.loaded = true;
        return null;
    }

    // Start loading
    state.loading = (async () => {
        try {
            // Dynamic import of WASM module
            const wasmModule = await import(/* webpackIgnore: true */ wasmModulePath.toString());

            // Initialize WASM
            if (typeof wasmModule.default === 'function') {
                await wasmModule.default();
            }

            // Verify module is ready
            if (!wasmModule.is_ready || !wasmModule.is_ready()) {
                throw new Error('WASM module failed to initialize');
            }

            state.module = wasmModule as HwpWasmModule;
            state.loaded = true;
            state.error = null;

            Logger.info(`WASM module loaded successfully, version: ${wasmModule.get_version()}`);

            return state.module;

        } catch (error) {
            Logger.warn('Failed to load WASM module:', error);
            state.error = error instanceof Error ? error : new Error(String(error));
            state.loaded = true;
            state.module = null;
            return null;
        }
    })();

    return state.loading;
}

/**
 * Get the loaded WASM module (or null if not available)
 */
export function getWasmModule(): HwpWasmModule | null {
    return state.module;
}

/**
 * Check if WASM module is loaded and available
 */
export function isWasmAvailable(): boolean {
    return state.module !== null;
}

/**
 * Check if WASM loading has completed (success or failure)
 */
export function isWasmLoadComplete(): boolean {
    return state.loaded;
}

/**
 * Get WASM loading error (if any)
 */
export function getWasmLoadError(): Error | null {
    return state.error;
}

/**
 * Force reload of WASM module
 */
export async function reloadWasm(): Promise<HwpWasmModule | null> {
    state.module = null;
    state.loading = null;
    state.loaded = false;
    state.error = null;
    return loadWasm();
}

/**
 * Unload WASM module and free resources
 */
export function unloadWasm(): void {
    state.module = null;
    state.loading = null;
    state.loaded = false;
    state.error = null;
}

/**
 * Execute function with WASM module
 *
 * @param fn Function to execute with WASM module
 * @param fallback Fallback function if WASM not available
 */
export async function withWasm<T>(
    fn: (wasm: HwpWasmModule) => T,
    fallback: () => T
): Promise<T> {
    const wasm = await loadWasm();

    if (wasm) {
        try {
            return fn(wasm);
        } catch (error) {
            console.warn('[WasmModule] WASM execution failed, using fallback:', error);
        }
    }

    return fallback();
}

/**
 * Execute function with WASM module (synchronous, requires pre-loading)
 *
 * @param fn Function to execute with WASM module
 * @param fallback Fallback function if WASM not available
 */
export function withWasmSync<T>(
    fn: (wasm: HwpWasmModule) => T,
    fallback: () => T
): T {
    const wasm = getWasmModule();

    if (wasm) {
        try {
            return fn(wasm);
        } catch (error) {
            console.warn('[WasmModule] WASM execution failed, using fallback:', error);
        }
    }

    return fallback();
}
