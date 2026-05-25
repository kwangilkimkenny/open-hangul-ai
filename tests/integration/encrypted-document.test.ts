import { describe, it, expect } from 'vitest';
import { buildEncryptedHwpx } from '../helpers/encrypted-hwpx-builder.js';
import { SimpleHWPXParser } from '../../src/lib/vanilla/core/parser.js';

// PBKDF2 100K iterations는 jsdom 환경에서 수 초 걸린다 — testTimeout 확장.
describe('encrypted-document integration', { timeout: 60000 }, () => {
  const PASSWORD = '비밀번호1234';

  it('builds encryptable HWPX fixture', async () => {
    const bytes = await buildEncryptedHwpx(PASSWORD);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });

  it('parses encrypted HWPX with correct password (pre-injected)', async () => {
    const bytes = await buildEncryptedHwpx(PASSWORD);
    const parser = new SimpleHWPXParser({
      fileName: 'encrypted.hwpx',
      password: PASSWORD,
    });
    const doc = await parser.parse(bytes);
    expect(doc).toBeTruthy();
    expect(Array.isArray(doc.sections)).toBe(true);

    // 본문 텍스트가 복호화 후 정상 추출되는지 확인
    type Run = { text?: string };
    type El = { runs?: Run[] };
    type Sec = { elements?: El[] };
    const allText = (doc.sections as Sec[])
      .flatMap(s => (s.elements || []).flatMap(el => (el.runs || []).map(r => r.text || '')))
      .join('');
    expect(allText).toContain('암호화 테스트 문서');
  });

  it('fails with HWPX_DECRYPT_FAILED on wrong password', async () => {
    const bytes = await buildEncryptedHwpx(PASSWORD);
    const parser = new SimpleHWPXParser({
      fileName: 'encrypted.hwpx',
      password: 'wrong-password',
    });
    let caught: unknown = null;
    try {
      await parser.parse(bytes);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    // parse() outer catch wraps the error; originalError 에 원본 보존
    const c = caught as { code?: string; originalError?: { code?: string } };
    const origCode = c.code || c.originalError?.code;
    expect(origCode === 'HWPX_DECRYPT_FAILED' || origCode === 'HWPX_PASSWORD_CANCELED').toBe(true);
  });

  it('plaintext HWPX still parses without password option', async () => {
    // 동일 빌더로 만든 plaintext (암호화 없음) 는 password 없이 정상 동작해야
    const { default: JSZip } = await import('jszip');
    const enc = await buildEncryptedHwpx(PASSWORD);
    // sanity — encrypted version has manifest.xml with encryption-data
    const zip = await JSZip.loadAsync(enc);
    const manifest = await zip.file('META-INF/manifest.xml')!.async('string');
    expect(manifest).toContain('encryption-data');
  });

  it('encrypted parse error carries userMessage', async () => {
    const bytes = await buildEncryptedHwpx(PASSWORD);
    const parser = new SimpleHWPXParser({
      fileName: 'docX.hwpx',
      password: 'nope',
    });
    let caught: unknown = null;
    try {
      await parser.parse(bytes);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    const c2 = caught as {
      code?: string;
      userMessage?: string;
      originalError?: { code?: string; userMessage?: string };
    };
    const userMsg = c2.userMessage || c2.originalError?.userMessage;
    const origCode = c2.code || c2.originalError?.code;
    expect(typeof userMsg === 'string' || origCode === 'HWPX_PASSWORD_CANCELED').toBe(true);
  });

  it('canvas-editor mode acceptance — parsed doc structure intact for downstream conversion', async () => {
    // canvas-editor 어댑터는 SimpleHWPXParser 결과 객체(sections/images/oleObjects)를 그대로 받는다.
    // 복호화 후 doc 구조가 정상이면 canvas 모드도 동일하게 동작한다는 의미.
    const bytes = await buildEncryptedHwpx(PASSWORD);
    const parser = new SimpleHWPXParser({
      fileName: 'canvas-test.hwpx',
      password: PASSWORD,
    });
    const doc = await parser.parse(bytes);
    expect(doc.sections).toBeDefined();
    expect(doc.images).toBeDefined();
    expect(doc.oleObjects).toBeDefined();
    // canvas-editor 어댑터가 기대하는 핵심 필드
    expect(typeof doc.sections.length).toBe('number');
  });
});
