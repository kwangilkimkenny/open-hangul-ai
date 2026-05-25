/**
 * Encrypted HWPX Builder (test helper)
 *
 * 단위 테스트용 — Web Crypto API 로 PBKDF2 + AES-CBC 암호화된 합성 HWPX 생성기.
 * `SimpleHWPXParser` 의 _decryptIfNeeded 가 인식하는 형식과 일치해야 한다:
 *   - META-INF/manifest.xml 에 <manifest:encryption-data> 포함
 *   - 각 암호화 스트림 = [salt(16B) | iv(16B) | ciphertext]
 *   - PBKDF2-HMAC-SHA-256, 100000 iters, 128-bit key, AES-CBC
 *
 * Production code 가 아님 — test 전용.
 */

import JSZip from 'jszip';

const SALT_SIZE = 16;
const IV_SIZE = 16;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BITS = 128;

function getCrypto() {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API not available in this environment');
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const subtle = getCrypto().subtle;
  const baseKey = await subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, [
    'deriveKey',
  ]);
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-CBC', length: KEY_LENGTH_BITS },
    false,
    ['encrypt']
  );
}

async function encryptStream(plaintextBytes, password) {
  const cryptoObj = getCrypto();
  const salt = cryptoObj.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = cryptoObj.getRandomValues(new Uint8Array(IV_SIZE));
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(
    await cryptoObj.subtle.encrypt({ name: 'AES-CBC', iv }, key, plaintextBytes)
  );
  const out = new Uint8Array(salt.length + iv.length + ct.length);
  out.set(salt, 0);
  out.set(iv, salt.length);
  out.set(ct, salt.length + iv.length);
  return out;
}

/**
 * 최소 plaintext HWPX (1개 단락) 합성.
 */
async function buildMinimalPlaintextHwpx() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  </rootfiles>
</container>`
  );
  zip.file(
    'Contents/content.hpf',
    `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="hwpx-id">
  <opf:metadata/>
  <opf:manifest>
    <opf:item id="header" href="header.xml" media-type="application/xml"/>
    <opf:item id="section0" href="section0.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`
  );
  zip.file(
    'Contents/header.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.4"/>`
  );
  zip.file(
    'Contents/section0.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p id="p1" paraPrIDRef="0" styleIDRef="0">
    <hp:run charPrIDRef="0">
      <hp:t>암호화 테스트 문서</hp:t>
    </hp:run>
    <hp:linebreak/>
  </hp:p>
</hs:sec>`
  );
  return await zip.generateAsync({ type: 'uint8array' });
}

/**
 * 합성 plaintext HWPX 를 받아 section0.xml 만 AES-CBC 로 암호화한 HWPX 를 반환.
 *
 * @param {string} password
 * @returns {Promise<Uint8Array>}
 */
export async function buildEncryptedHwpx(password) {
  if (!password) throw new Error('password is required');
  const plainBytes = await buildMinimalPlaintextHwpx();
  const plainZip = await JSZip.loadAsync(plainBytes);

  const sectionXml = await plainZip.file('Contents/section0.xml').async('uint8array');
  const encryptedSection = await encryptStream(sectionXml, password);

  // 출력 ZIP — section0.xml 만 암호화 buffer 로 교체 + manifest 에 encryption-data 추가
  const outZip = new JSZip();
  outZip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
  outZip.file(
    'META-INF/container.xml',
    await plainZip.file('META-INF/container.xml').async('string')
  );
  outZip.file(
    'META-INF/manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="Contents/section0.xml" manifest:media-type="application/xml">
    <manifest:encryption-data manifest:algorithm-name="AES-CBC" manifest:key-derivation-name="PBKDF2"/>
  </manifest:file-entry>
</manifest:manifest>`
  );
  outZip.file('Contents/content.hpf', await plainZip.file('Contents/content.hpf').async('string'));
  outZip.file('Contents/header.xml', await plainZip.file('Contents/header.xml').async('string'));
  outZip.file('Contents/section0.xml', encryptedSection);

  return await outZip.generateAsync({ type: 'uint8array' });
}

export const TEST_PBKDF2_PARAMS = {
  iterations: PBKDF2_ITERATIONS,
  keyLength: KEY_LENGTH_BITS,
  hash: 'SHA-256',
};
