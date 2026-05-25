/**
 * hwp-crypto unit tests
 *
 * 알려진 PBKDF2 / AES-CBC 벡터로 키 유도 및 복호화 동작을 검증한다.
 * (실문서 vector 미보유 — 표준 RFC 7914 / NIST SP800-38A 기반 합성)
 */

import { describe, it, expect } from 'vitest';
import {
    detectEncryption,
    derivePbkdf2Key,
    derivePbkdf2Bits,
    decryptHwpxStream,
    decryptWithPassword,
    toUint8Array,
    DEFAULT_PBKDF2_PARAMS,
    _debug
} from './hwp-crypto.js';

const subtle = globalThis.crypto && globalThis.crypto.subtle;

function hexToBytes(hex) {
    const clean = hex.replace(/\s+/g, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
}

function strToBytes(s) {
    return new TextEncoder().encode(s);
}

async function encryptCbc(key, iv, plaintext) {
    const buf = await subtle.encrypt({ name: 'AES-CBC', iv }, key, plaintext);
    return new Uint8Array(buf);
}

describe('hwp-crypto :: detectEncryption', () => {
    it('returns format "unknown" for arbitrary bytes', () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        const r = detectEncryption(bytes);
        expect(r.format).toBe('unknown');
        expect(r.encrypted).toBe(false);
    });

    it('detects ZIP signature as hwpx', () => {
        const bytes = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0]);
        const r = detectEncryption(bytes);
        expect(r.format).toBe('hwpx');
        expect(r.encrypted).toBe(false);
    });

    it('detects CFB signature as hwp5', () => {
        const bytes = new Uint8Array(512);
        const sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
        sig.forEach((b, i) => { bytes[i] = b; });
        const r = detectEncryption(bytes);
        expect(r.format).toBe('hwp5');
    });

    it('detects HWPX encryption from manifest.xml', () => {
        const bytes = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0]);
        const manifestXml = `<?xml version="1.0"?>
<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <odf:file-entry full-path="Contents/section0.xml" media-type="application/xml">
    <odf:encryption-data algorithm-name="AES-128-CBC" key-derivation-name="PBKDF2"/>
  </odf:file-entry>
  <odf:file-entry full-path="Contents/section1.xml" media-type="application/xml"/>
</odf:manifest>`;
        const r = detectEncryption(bytes, { manifestXml });
        expect(r.format).toBe('hwpx');
        expect(r.encrypted).toBe(true);
        expect(r.files).toHaveLength(1);
        expect(r.files[0].path).toBe('Contents/section0.xml');
        expect(r.files[0].algo).toBe('AES-128-CBC');
        expect(r.files[0].keyDerivation).toBe('PBKDF2');
    });

    it('detects HWP 5.0 encrypted attribute flag', () => {
        // CFB 시그니처 + 임의 오프셋에 "HWP Document File ..." 시그니처 배치
        const bytes = new Uint8Array(2048);
        const cfb = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
        cfb.forEach((b, i) => { bytes[i] = b; });
        const sigStr = 'HWP Document File';
        const sigPos = 512;
        for (let i = 0; i < sigStr.length; i++) {
            bytes[sigPos + i] = sigStr.charCodeAt(i);
        }
        // attributes 위치 = sigPos + 32 + 4
        const attrPos = sigPos + 32 + 4;
        // 비트 1 (암호화) ON
        bytes[attrPos] = 0x02;
        const r = detectEncryption(bytes);
        expect(r.format).toBe('hwp5');
        expect(r.encrypted).toBe(true);
    });
});

describe('hwp-crypto :: derivePbkdf2Key', () => {
    it('throws on empty password', async () => {
        await expect(derivePbkdf2Key('', new Uint8Array(16))).rejects.toThrow(/non-empty string/);
    });

    it('throws on empty salt', async () => {
        await expect(derivePbkdf2Key('pw', new Uint8Array(0))).rejects.toThrow(/salt must be non-empty/);
    });

    it('throws on low iterations', async () => {
        await expect(derivePbkdf2Key('pw', new Uint8Array(16), 10)).rejects.toThrow(/iterations/);
    });

    it('returns a CryptoKey usable for AES-CBC', async () => {
        const key = await derivePbkdf2Key('password', strToBytes('saltsaltsaltsalt'), 1000, 128, 'SHA-256');
        expect(key).toBeDefined();
        expect(key.algorithm.name).toBe('AES-CBC');
        expect(key.algorithm.length).toBe(128);
        expect(key.usages).toContain('decrypt');
    });

    it('produces deterministic output matching RFC 6070 PBKDF2-HMAC-SHA1 vector', async () => {
        // RFC 6070 vector #3:
        //   P="password", S="salt", c=4096, dkLen=20
        //   DK = 4b 00 79 01 b7 65 48 9a be ad 49 d9 26 f7 21 d0 65 a4 29 c1
        const bits = await derivePbkdf2Bits('password', strToBytes('salt'), 4096, 160, 'SHA-1');
        expect(_debug.bytesToHex(bits)).toBe('4b007901b765489abead49d926f721d065a429c1');
    });
});

describe('hwp-crypto :: decryptHwpxStream', () => {
    it('round-trips an AES-CBC payload using a derived key', async () => {
        const password = 'hancom-test-password';
        const salt = strToBytes('0123456789abcdef');
        const iv = new Uint8Array(16);
        for (let i = 0; i < 16; i++) iv[i] = i + 1;

        const key = await derivePbkdf2Key(password, salt, 1000, 128, 'SHA-256');
        const plaintext = strToBytes('Hello, 한컴 암호 문서!');

        const ciphertext = await encryptCbc(key, iv, plaintext);
        expect(ciphertext.length % 16).toBe(0);

        const recovered = await decryptHwpxStream(ciphertext, key, iv);
        expect(new TextDecoder().decode(recovered)).toBe('Hello, 한컴 암호 문서!');
    });

    it('throws a clear error on wrong password', async () => {
        const salt = strToBytes('saltsaltsaltsalt');
        const iv = new Uint8Array(16);
        const right = await derivePbkdf2Key('correct', salt, 1000, 128, 'SHA-256');
        const wrong = await derivePbkdf2Key('incorrect', salt, 1000, 128, 'SHA-256');

        const ciphertext = await encryptCbc(right, iv, strToBytes('secret'));

        await expect(decryptHwpxStream(ciphertext, wrong, iv))
            .rejects
            .toThrow(/decryption failed/i);
    });

    it('rejects IVs of wrong size', async () => {
        const key = await derivePbkdf2Key('pw', strToBytes('saltsaltsaltsalt'), 1000);
        await expect(decryptHwpxStream(new Uint8Array(16), key, new Uint8Array(8)))
            .rejects
            .toThrow(/IV must be 16 bytes/);
    });

    it('rejects ciphertext of non-multiple-of-16 length', async () => {
        const key = await derivePbkdf2Key('pw', strToBytes('saltsaltsaltsalt'), 1000);
        await expect(decryptHwpxStream(new Uint8Array(13), key, new Uint8Array(16)))
            .rejects
            .toThrow(/multiple of 16/);
    });
});

describe('hwp-crypto :: decryptWithPassword (convenience)', () => {
    it('decrypts using password + salt + iv', async () => {
        const password = 'p@ssw0rd';
        const salt = strToBytes('saltsaltsaltsalt');
        const iv = new Uint8Array(16);
        const key = await derivePbkdf2Key(password, salt, DEFAULT_PBKDF2_PARAMS.iterations, 128, 'SHA-256');
        const ciphertext = await encryptCbc(key, iv, strToBytes('OK'));
        const recovered = await decryptWithPassword(password, salt, iv, ciphertext);
        expect(new TextDecoder().decode(recovered)).toBe('OK');
    });
});

describe('hwp-crypto :: toUint8Array', () => {
    it('passes through Uint8Array', () => {
        const u = new Uint8Array([1, 2, 3]);
        expect(toUint8Array(u)).toBe(u);
    });

    it('wraps ArrayBuffer', () => {
        const ab = new ArrayBuffer(4);
        const u = toUint8Array(ab);
        expect(u).toBeInstanceOf(Uint8Array);
        expect(u.byteLength).toBe(4);
    });

    it('throws on falsy input', () => {
        expect(() => toUint8Array(null)).toThrow();
    });
});
