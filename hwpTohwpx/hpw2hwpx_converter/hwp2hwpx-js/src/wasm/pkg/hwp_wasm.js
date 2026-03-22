/* @ts-self-types="./hwp_wasm.d.ts" */

/**
 * Directory entry structure
 */
export class DirectoryEntry {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(DirectoryEntry.prototype);
        obj.__wbg_ptr = ptr;
        DirectoryEntryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DirectoryEntryFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_directoryentry_free(ptr, 0);
    }
    /**
     * Child ID
     * @returns {number}
     */
    get childId() {
        const ret = wasm.__wbg_get_directoryentry_childId(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Entry type: 0=Unknown, 1=Storage, 2=Stream, 5=Root
     * @returns {number}
     */
    get entryType() {
        const ret = wasm.__wbg_get_directoryentry_entryType(this.__wbg_ptr);
        return ret;
    }
    /**
     * Entry index
     * @returns {number}
     */
    get index() {
        const ret = wasm.__wbg_get_directoryentry_index(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Left sibling ID
     * @returns {number}
     */
    get leftSiblingId() {
        const ret = wasm.__wbg_get_directoryentry_leftSiblingId(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Entry name
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.__wbg_get_directoryentry_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Right sibling ID
     * @returns {number}
     */
    get rightSiblingId() {
        const ret = wasm.__wbg_get_directoryentry_rightSiblingId(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Stream size
     * @returns {number}
     */
    get size() {
        const ret = wasm.__wbg_get_directoryentry_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Starting sector
     * @returns {number}
     */
    get startSector() {
        const ret = wasm.__wbg_get_directoryentry_startSector(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Child ID
     * @param {number} arg0
     */
    set childId(arg0) {
        wasm.__wbg_set_directoryentry_childId(this.__wbg_ptr, arg0);
    }
    /**
     * Entry type: 0=Unknown, 1=Storage, 2=Stream, 5=Root
     * @param {number} arg0
     */
    set entryType(arg0) {
        wasm.__wbg_set_directoryentry_entryType(this.__wbg_ptr, arg0);
    }
    /**
     * Entry index
     * @param {number} arg0
     */
    set index(arg0) {
        wasm.__wbg_set_directoryentry_index(this.__wbg_ptr, arg0);
    }
    /**
     * Left sibling ID
     * @param {number} arg0
     */
    set leftSiblingId(arg0) {
        wasm.__wbg_set_directoryentry_leftSiblingId(this.__wbg_ptr, arg0);
    }
    /**
     * Entry name
     * @param {string} arg0
     */
    set name(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_directoryentry_name(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Right sibling ID
     * @param {number} arg0
     */
    set rightSiblingId(arg0) {
        wasm.__wbg_set_directoryentry_rightSiblingId(this.__wbg_ptr, arg0);
    }
    /**
     * Stream size
     * @param {number} arg0
     */
    set size(arg0) {
        wasm.__wbg_set_directoryentry_size(this.__wbg_ptr, arg0);
    }
    /**
     * Starting sector
     * @param {number} arg0
     */
    set startSector(arg0) {
        wasm.__wbg_set_directoryentry_startSector(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) DirectoryEntry.prototype[Symbol.dispose] = DirectoryEntry.prototype.free;

/**
 * OLE file header information
 */
export class OleHeader {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(OleHeader.prototype);
        obj.__wbg_ptr = ptr;
        OleHeaderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OleHeaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_oleheader_free(ptr, 0);
    }
    /**
     * First directory sector
     * @returns {number}
     */
    get firstDirectorySector() {
        const ret = wasm.__wbg_get_directoryentry_leftSiblingId(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Major version (3 or 4)
     * @returns {number}
     */
    get majorVersion() {
        const ret = wasm.__wbg_get_oleheader_majorVersion(this.__wbg_ptr);
        return ret;
    }
    /**
     * Mini sector size in bytes
     * @returns {number}
     */
    get miniSectorSize() {
        const ret = wasm.__wbg_get_oleheader_miniSectorSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Mini stream cutoff size
     * @returns {number}
     */
    get miniStreamCutoffSize() {
        const ret = wasm.__wbg_get_oleheader_miniStreamCutoffSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Sector size in bytes
     * @returns {number}
     */
    get sectorSize() {
        const ret = wasm.__wbg_get_oleheader_sectorSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * First directory sector
     * @param {number} arg0
     */
    set firstDirectorySector(arg0) {
        wasm.__wbg_set_directoryentry_leftSiblingId(this.__wbg_ptr, arg0);
    }
    /**
     * Major version (3 or 4)
     * @param {number} arg0
     */
    set majorVersion(arg0) {
        wasm.__wbg_set_oleheader_majorVersion(this.__wbg_ptr, arg0);
    }
    /**
     * Mini sector size in bytes
     * @param {number} arg0
     */
    set miniSectorSize(arg0) {
        wasm.__wbg_set_oleheader_miniSectorSize(this.__wbg_ptr, arg0);
    }
    /**
     * Mini stream cutoff size
     * @param {number} arg0
     */
    set miniStreamCutoffSize(arg0) {
        wasm.__wbg_set_oleheader_miniStreamCutoffSize(this.__wbg_ptr, arg0);
    }
    /**
     * Sector size in bytes
     * @param {number} arg0
     */
    set sectorSize(arg0) {
        wasm.__wbg_set_oleheader_sectorSize(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) OleHeader.prototype[Symbol.dispose] = OleHeader.prototype.free;

/**
 * OLE Compound File Parser
 */
export class OleParser {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OleParserFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_oleparser_free(ptr, 0);
    }
    /**
     * Find entries matching prefix
     * @param {string} prefix
     * @returns {DirectoryEntry[]}
     */
    findEntriesWithPrefix(prefix) {
        const ptr0 = passStringToWasm0(prefix, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.oleparser_findEntriesWithPrefix(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * Find entry by name
     * @param {string} name
     * @returns {DirectoryEntry | undefined}
     */
    findEntry(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.oleparser_findEntry(this.__wbg_ptr, ptr0, len0);
        return ret === 0 ? undefined : DirectoryEntry.__wrap(ret);
    }
    /**
     * Get directory entries
     * @returns {DirectoryEntry[]}
     */
    getDirectory() {
        const ret = wasm.oleparser_getDirectory(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Get entry count
     * @returns {number}
     */
    getEntryCount() {
        const ret = wasm.oleparser_getEntryCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get OLE header information
     * @returns {OleHeader}
     */
    getHeader() {
        const ret = wasm.oleparser_getHeader(this.__wbg_ptr);
        return OleHeader.__wrap(ret);
    }
    /**
     * Check if this is a valid OLE file
     * @returns {boolean}
     */
    isValid() {
        const ret = wasm.oleparser_isValid(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Create a new OLE parser
     * @param {Uint8Array} data
     */
    constructor(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.oleparser_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        OleParserFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Read stream data by entry index
     * @param {number} entry_index
     * @returns {Uint8Array}
     */
    readStream(entry_index) {
        const ret = wasm.oleparser_readStream(this.__wbg_ptr, entry_index);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Read stream by entry name
     * @param {string} name
     * @returns {Uint8Array}
     */
    readStreamByName(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.oleparser_readStreamByName(this.__wbg_ptr, ptr0, len0);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v2;
    }
}
if (Symbol.dispose) OleParser.prototype[Symbol.dispose] = OleParser.prototype.free;

/**
 * Streaming decompressor for large data
 *
 * Decompresses data in chunks to reduce memory usage.
 */
export class StreamingInflator {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StreamingInflatorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_streaminginflator_free(ptr, 0);
    }
    /**
     * Finish decompression and get result
     * @returns {Uint8Array}
     */
    finish() {
        const ret = wasm.streaminginflator_finish(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Create a new streaming inflator
     */
    constructor() {
        const ret = wasm.streaminginflator_new();
        this.__wbg_ptr = ret >>> 0;
        StreamingInflatorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Add compressed data chunk
     * @param {Uint8Array} chunk
     */
    push(chunk) {
        const ptr0 = passArray8ToWasm0(chunk, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.streaminginflator_push(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Reset for reuse
     */
    reset() {
        wasm.streaminginflator_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) StreamingInflator.prototype[Symbol.dispose] = StreamingInflator.prototype.free;

/**
 * Calculate CRC32 checksum
 * @param {Uint8Array} data
 * @returns {number}
 */
export function crc32(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.crc32(ptr0, len0);
    return ret >>> 0;
}

/**
 * Compress data using zlib
 *
 * # Arguments
 * * `data` - Uncompressed data
 * * `level` - Compression level (0-9, where 9 is maximum compression)
 *
 * # Returns
 * Compressed data as Vec<u8>
 * @param {Uint8Array} data
 * @param {number} level
 * @returns {Uint8Array}
 */
export function deflate(data, level) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.deflate(ptr0, len0, level);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Compress data using raw deflate (no zlib header)
 *
 * # Arguments
 * * `data` - Uncompressed data
 * * `level` - Compression level (0-9)
 *
 * # Returns
 * Compressed data as Vec<u8>
 * @param {Uint8Array} data
 * @param {number} level
 * @returns {Uint8Array}
 */
export function deflateRaw(data, level) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.deflateRaw(ptr0, len0, level);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Simple benchmark: hash bytes using FNV-1a
 * @param {Uint8Array} data
 * @returns {number}
 */
export function fnv1a_hash(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.fnv1a_hash(ptr0, len0);
    return ret >>> 0;
}

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
 * @param {number} input_size
 * @returns {number}
 */
export function getMaxDecompressedSize(input_size) {
    const ret = wasm.getMaxDecompressedSize(input_size);
    return ret >>> 0;
}

/**
 * Get module version
 * @returns {string}
 */
export function get_version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.get_version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

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
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function inflate(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.inflate(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

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
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function inflateAuto(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.inflateAuto(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

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
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function inflateRaw(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.inflateRaw(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Initialize the WASM module
 */
export function init() {
    wasm.init();
}

/**
 * Check if WASM module is ready
 * @returns {boolean}
 */
export function is_ready() {
    const ret = wasm.is_ready();
    return ret !== 0;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_8c4e43fe74559d73: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_directoryentry_new: function(arg0) {
            const ret = DirectoryEntry.__wrap(arg0);
            return ret;
        },
        __wbg_error_7534b8e9a36f1ab4: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_new_8a6f238a6ece86ea: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_stack_0ed75d68575b0f3c: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./hwp_wasm_bg.js": import0,
    };
}

const DirectoryEntryFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_directoryentry_free(ptr >>> 0, 1));
const OleHeaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_oleheader_free(ptr >>> 0, 1));
const OleParserFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_oleparser_free(ptr >>> 0, 1));
const StreamingInflatorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_streaminginflator_free(ptr >>> 0, 1));

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('hwp_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
