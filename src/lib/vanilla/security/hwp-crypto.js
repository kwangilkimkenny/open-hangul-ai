/**
 * HWP/HWPX Crypto Module
 *
 * 한컴 HWP 5.0 및 HWPX 암호화 문서의 감지 및 복호화 기능 제공.
 *
 * 본 모듈은 Web Crypto API(`crypto.subtle`)만 사용하며, 추가 NPM 의존성은
 * 도입하지 않는다. 실제 한컴 암호 문서의 round-trip 호환성은 명세 기반의
 * 추정 구현이며(실문서 vector 미보유), 알려진 벡터에 대한 PBKDF2/AES
 * 동작은 단위 테스트에서 검증한다.
 *
 * 알고리즘 요약 (HWP 5.0 spec rev 1.3 기반):
 *   - HWP 5.0(CFB): FileHeader 36~39 바이트 영역의 속성 플래그 비트 1이 켜져
 *     있으면 패스워드 문서. DocInfo 스트림 헤더에 salt(16B)/iv(16B) 가 포함.
 *   - HWPX(ZIP):    META-INF/manifest.xml 의 <odf:encryption-data> 요소가
 *     존재하면 암호화된 스트림. PBKDF2-HMAC-SHA256(또는 SHA1) → AES-CBC.
 *
 * @module security/hwp-crypto
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

// ============================================================================
// Constants
// ============================================================================

/** HWP 5.0 CFB 시그니처 (D0 CF 11 E0 A1 B1 1A E1) */
const CFB_SIGNATURE = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);

/** ZIP local file header 시그니처 ("PK\\x03\\x04") */
const ZIP_SIGNATURE = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);

/** HWP 5.0 FileHeader 의 시그니처 문자열 */
const HWP_SIGNATURE_STR = 'HWP Document File';

/** HWPX 기본 PBKDF2 파라미터 (한컴 권장값) */
export const DEFAULT_PBKDF2_PARAMS = Object.freeze({
    iterations: 100000,
    keyLength: 128,       // bits
    hash: 'SHA-256'
});

/** salt / iv 크기 (바이트). AES 블록과 동일 */
export const SALT_SIZE = 16;
export const IV_SIZE = 16;

// ============================================================================
// Utility
// ============================================================================

/**
 * ArrayBuffer / Uint8Array 입력을 Uint8Array 로 정규화한다.
 *
 * @param {ArrayBuffer | Uint8Array | ArrayBufferLike} buffer
 * @returns {Uint8Array}
 */
export function toUint8Array(buffer) {
    if (!buffer) {
        throw new TypeError('hwp-crypto: buffer must be provided');
    }
    if (buffer instanceof Uint8Array) return buffer;
    if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
    if (ArrayBuffer.isView(buffer)) {
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    throw new TypeError('hwp-crypto: unsupported buffer type');
}

function startsWith(haystack, needle) {
    if (haystack.length < needle.length) return false;
    for (let i = 0; i < needle.length; i++) {
        if (haystack[i] !== needle[i]) return false;
    }
    return true;
}

function bytesToHex(bytes) {
    const u8 = toUint8Array(bytes);
    let out = '';
    for (let i = 0; i < u8.length; i++) {
        out += u8[i].toString(16).padStart(2, '0');
    }
    return out;
}

/**
 * Web Crypto subtle 핸들을 안전하게 얻는다.
 * Node 19+ / 모던 브라우저에서 globalThis.crypto.subtle 이 제공된다.
 *
 * @returns {SubtleCrypto}
 */
function getSubtle() {
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj || !cryptoObj.subtle) {
        throw new Error('hwp-crypto: Web Crypto API (crypto.subtle) is not available in this environment');
    }
    return cryptoObj.subtle;
}

// ============================================================================
// Encryption Detection
// ============================================================================

/**
 * HWP 5.0 CFB FileHeader 의 속성 플래그를 해석한다.
 *
 * spec: FileHeader 는 512B(또는 4096B) CFB 섹터 내부의 /FileHeader 스트림
 * 으로 직렬화되지만, 컨테이너 헤더 직후 위치한 첫 섹터 안에 시그니처
 * "HWP Document File ... v5.x" + 4 byte version + 4 byte attributes 가
 * 들어 있다. 본 모듈은 buffer 전체를 스캔하여 시그니처 위치를 찾은 후
 * attributes 의 비트 0(압축) / 비트 1(암호화) 을 확인한다.
 *
 * @param {Uint8Array} bytes 입력 바이트
 * @returns {{ encrypted: boolean, attributesOffset: number }}
 */
function inspectHwp50Header(bytes) {
    const sigBytes = new TextEncoder().encode(HWP_SIGNATURE_STR);
    // 보수적으로 처음 8KB 만 검색 (CFB 첫 섹터 내부에 위치)
    const limit = Math.min(bytes.length - sigBytes.length - 8, 8192);
    for (let i = 0; i < limit; i++) {
        let matched = true;
        for (let j = 0; j < sigBytes.length; j++) {
            if (bytes[i + j] !== sigBytes[j]) { matched = false; break; }
        }
        if (!matched) continue;
        // 시그니처(32B) + version(4B) 다음 4B 가 attributes
        const attrOffset = i + 32 + 4;
        if (attrOffset + 4 > bytes.length) return { encrypted: false, attributesOffset: -1 };
        const attributes =
            (bytes[attrOffset]) |
            (bytes[attrOffset + 1] << 8) |
            (bytes[attrOffset + 2] << 16) |
            (bytes[attrOffset + 3] << 24);
        const encrypted = (attributes & 0x2) !== 0;
        return { encrypted, attributesOffset: attrOffset };
    }
    return { encrypted: false, attributesOffset: -1 };
}

/**
 * HWPX(ZIP) 컨테이너의 manifest.xml 을 파싱하여 암호화 정보 추출.
 *
 * @param {string} manifestXml
 * @returns {{ encrypted: boolean, files: Array<{path:string, algo:string|null, keyDerivation:string|null}> }}
 */
function inspectHwpxManifest(manifestXml) {
    if (!manifestXml || typeof manifestXml !== 'string') {
        return { encrypted: false, files: [] };
    }
    const files = [];
    // <encryption-data> 또는 <odf:encryption-data> 출현을 가벼운 정규식으로 탐지.
    // (DOMParser 사용 시 jsdom 환경에서도 동작하나, manifest 가 매우 단순한
    // XML 이므로 모듈 자체 의존성을 줄이기 위해 정규식 사용.)
    const re = /<(?:[\w-]+:)?file-entry\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:[\w-]+:)?file-entry>)/g;
    let m;
    while ((m = re.exec(manifestXml)) !== null) {
        const entryFull = m[0];
        const fullPath = (entryFull.match(/full-path="([^"]+)"/) || [])[1] || '';
        const hasEnc = /encryption-data\b/.test(entryFull) || /encryption-data\b/.test(m[1] || '');
        if (!hasEnc) continue;
        const algo = (entryFull.match(/algorithm-name="([^"]+)"/) || [])[1] || null;
        const kd = (entryFull.match(/key-derivation-name="([^"]+)"/) || [])[1] || null;
        files.push({ path: fullPath, algo, keyDerivation: kd });
    }
    return { encrypted: files.length > 0, files };
}

/**
 * HWP / HWPX 버퍼의 암호화 여부를 감지한다.
 *
 * @param {ArrayBuffer | Uint8Array} buffer 원본 파일 바이트
 * @param {Object} [opts]
 * @param {string} [opts.manifestXml] HWPX 의 경우 호출자가 ZIP 에서 읽어 전달
 * @returns {{
 *   format: 'hwp5' | 'hwpx' | 'unknown',
 *   encrypted: boolean,
 *   algo: string,
 *   keyDerivation: string,
 *   salt: Uint8Array | null,
 *   iv: Uint8Array | null,
 *   files?: Array<{path:string, algo:string|null, keyDerivation:string|null}>
 * }}
 */
export function detectEncryption(buffer, opts = {}) {
    const bytes = toUint8Array(buffer);
    const result = {
        format: 'unknown',
        encrypted: false,
        algo: 'AES-CBC',
        keyDerivation: 'PBKDF2',
        salt: null,
        iv: null
    };

    if (startsWith(bytes, CFB_SIGNATURE)) {
        result.format = 'hwp5';
        const info = inspectHwp50Header(bytes);
        result.encrypted = info.encrypted;
        // HWP 5.0 의 salt/iv 는 DocInfo 스트림 헤더에 있으므로 여기서는 null.
        return result;
    }

    if (startsWith(bytes, ZIP_SIGNATURE)) {
        result.format = 'hwpx';
        const manifest = inspectHwpxManifest(opts.manifestXml || '');
        result.encrypted = manifest.encrypted;
        result.files = manifest.files;
        if (manifest.files.length > 0) {
            result.algo = manifest.files[0].algo || 'AES-CBC';
            result.keyDerivation = manifest.files[0].keyDerivation || 'PBKDF2';
        }
        return result;
    }

    logger.debug('hwp-crypto: unknown container signature, treating as not encrypted');
    return result;
}

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * 패스워드 + salt 로부터 PBKDF2 키를 유도한다.
 *
 * @param {string} password
 * @param {Uint8Array | ArrayBuffer} salt
 * @param {number} [iterations=100000]
 * @param {number} [keyLength=128]  bits
 * @param {string} [hash='SHA-256']
 * @returns {Promise<CryptoKey>}  AES-CBC import 된 CryptoKey
 */
export async function derivePbkdf2Key(
    password,
    salt,
    iterations = DEFAULT_PBKDF2_PARAMS.iterations,
    keyLength = DEFAULT_PBKDF2_PARAMS.keyLength,
    hash = DEFAULT_PBKDF2_PARAMS.hash
) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new TypeError('hwp-crypto: password must be a non-empty string');
    }
    const saltBytes = toUint8Array(salt);
    if (saltBytes.length === 0) {
        throw new TypeError('hwp-crypto: salt must be non-empty');
    }
    if (!Number.isInteger(iterations) || iterations < 1000) {
        throw new RangeError('hwp-crypto: iterations must be >= 1000');
    }
    if (![128, 192, 256].includes(keyLength)) {
        throw new RangeError('hwp-crypto: keyLength must be 128/192/256 bits');
    }

    const subtle = getSubtle();

    // 1) password → raw PBKDF2 base key
    const baseKey = await subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    // 2) baseKey → AES-CBC 키
    const aesKey = await subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBytes, iterations, hash },
        baseKey,
        { name: 'AES-CBC', length: keyLength },
        true,
        ['encrypt', 'decrypt']
    );

    return aesKey;
}

/**
 * PBKDF2 의 raw 출력 비트열을 얻고 싶을 때 사용 (테스트 벡터 검증 등).
 *
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {number} iterations
 * @param {number} keyLengthBits
 * @param {string} hash
 * @returns {Promise<Uint8Array>}
 */
export async function derivePbkdf2Bits(
    password,
    salt,
    iterations = DEFAULT_PBKDF2_PARAMS.iterations,
    keyLengthBits = DEFAULT_PBKDF2_PARAMS.keyLength,
    hash = DEFAULT_PBKDF2_PARAMS.hash
) {
    const subtle = getSubtle();
    const baseKey = await subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const bits = await subtle.deriveBits(
        { name: 'PBKDF2', salt: toUint8Array(salt), iterations, hash },
        baseKey,
        keyLengthBits
    );
    return new Uint8Array(bits);
}

// ============================================================================
// Stream Decryption
// ============================================================================

/**
 * AES-CBC 로 암호화된 HWPX 스트림을 복호화한다.
 *
 * @param {Uint8Array | ArrayBuffer} encryptedBytes
 * @param {CryptoKey} key      derivePbkdf2Key 가 반환한 CryptoKey
 * @param {Uint8Array} iv      16바이트 IV
 * @returns {Promise<Uint8Array>}
 * @throws {Error} 잘못된 비밀번호 또는 손상된 페이로드일 경우
 */
export async function decryptHwpxStream(encryptedBytes, key, iv) {
    const data = toUint8Array(encryptedBytes);
    const ivBytes = toUint8Array(iv);
    if (ivBytes.length !== IV_SIZE) {
        throw new RangeError(`hwp-crypto: IV must be ${IV_SIZE} bytes, got ${ivBytes.length}`);
    }
    if (data.length === 0 || (data.length % 16) !== 0) {
        // AES-CBC ciphertext 는 16 의 배수여야 함.
        throw new Error('hwp-crypto: ciphertext length must be a non-zero multiple of 16');
    }

    const subtle = getSubtle();
    try {
        const plainBuffer = await subtle.decrypt(
            { name: 'AES-CBC', iv: ivBytes },
            key,
            data
        );
        return new Uint8Array(plainBuffer);
    } catch (err) {
        // Web Crypto 는 패딩 / MAC 실패를 OperationError 로 묶어서 알려준다.
        const msg = err && err.message ? err.message : String(err);
        const wrapped = new Error('hwp-crypto: decryption failed (wrong password or corrupted data)');
        wrapped.cause = err;
        wrapped.detail = msg;
        throw wrapped;
    }
}

/**
 * 편의 함수: password + salt + iv + ciphertext → plaintext.
 *
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {Uint8Array} iv
 * @param {Uint8Array} ciphertext
 * @param {Object} [pbkdf2Opts]
 * @returns {Promise<Uint8Array>}
 */
export async function decryptWithPassword(password, salt, iv, ciphertext, pbkdf2Opts = {}) {
    const { iterations, keyLength, hash } = { ...DEFAULT_PBKDF2_PARAMS, ...pbkdf2Opts };
    const key = await derivePbkdf2Key(password, salt, iterations, keyLength, hash);
    return decryptHwpxStream(ciphertext, key, iv);
}

// ============================================================================
// Debug helpers (테스트 전용 — 메모리에만 존재)
// ============================================================================

/**
 * 디버그 용도로 salt / iv 를 안전한 hex 문자열로 변환.
 * 비밀번호 자체는 절대 인쇄/리턴하지 않는다.
 */
export const _debug = {
    bytesToHex,
    inspectHwpxManifest,
    inspectHwp50Header
};
