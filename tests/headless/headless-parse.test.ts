/**
 * Headless Parser — Node (Buffer) → 문서 객체.
 *
 * 트랙 H 의 golden 픽스처 12개를 일괄 파싱해 회귀를 방지한다.
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parseHwpxHeadless,
  summarizeDocument,
  ensureDomPolyfill,
} from '../../src/lib/headless/index.js';

const GOLDEN_DIRS = [
  '01-paragraph',
  '02-table',
  '03-image',
  '04-shape',
  '05-footnote',
  '06-header-footer',
  '07-field',
  '08-multi-column',
  '09-numbering',
  '10-ruby',
  '11-hyperlink',
  '12-bookmark',
];

async function loadFixture(name: string): Promise<Buffer> {
  const p = resolve(__dirname, '../golden', name, 'fixture.hwpx');
  return readFile(p);
}

describe('headless-parser: DOM polyfill', () => {
  it('ensureDomPolyfill is idempotent and installs DOMParser', async () => {
    await ensureDomPolyfill();
    expect(typeof (globalThis as unknown as { DOMParser?: unknown }).DOMParser).toBe('function');
    // 두 번 호출해도 안전해야 한다
    await ensureDomPolyfill();
    expect(typeof (globalThis as unknown as { DOMParser?: unknown }).DOMParser).toBe('function');
  });
});

describe('headless-parser: Buffer/Uint8Array/ArrayBuffer 모두 수용', () => {
  it('Buffer 를 받아 파싱한다', async () => {
    const buf = await loadFixture('01-paragraph');
    const doc = await parseHwpxHeadless(buf);
    expect(Array.isArray(doc.sections)).toBe(true);
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('Uint8Array 를 받아 파싱한다', async () => {
    const buf = await loadFixture('01-paragraph');
    const u8 = new Uint8Array(buf);
    const doc = await parseHwpxHeadless(u8);
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('ArrayBuffer 를 받아 파싱한다', async () => {
    const buf = await loadFixture('01-paragraph');
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const doc = await parseHwpxHeadless(ab);
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('잘못된 입력 타입은 TypeError 를 던진다', async () => {
    await expect(
      parseHwpxHeadless('not-a-buffer' as unknown as Buffer)
    ).rejects.toThrow(TypeError);
  });
});

describe('headless-parser: 골든 픽스처 12개 회귀', () => {
  it.each(GOLDEN_DIRS)('파싱 성공 — %s', async dir => {
    const buf = await loadFixture(dir);
    const doc = await parseHwpxHeadless(buf);
    expect(doc).toBeTruthy();
    expect(Array.isArray(doc.sections)).toBe(true);
    expect(doc.sections.length).toBeGreaterThan(0);
    expect(doc.metadata).toBeTruthy();
    expect(doc.metadata.parserVersion).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('headless-parser: summarizeDocument', () => {
  it('paragraph fixture 의 단락 수가 expected.json 과 일치', async () => {
    const buf = await loadFixture('01-paragraph');
    const doc = await parseHwpxHeadless(buf);
    const sum = summarizeDocument(doc);
    expect(sum.sections).toBe(1);
    expect(sum.paragraphs).toBe(3);
    expect(sum.tables).toBe(0);
    expect(sum.parserVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('table fixture 의 표 수가 1', async () => {
    const buf = await loadFixture('02-table');
    const doc = await parseHwpxHeadless(buf);
    const sum = summarizeDocument(doc);
    expect(sum.tables).toBe(1);
  });

  it('macroDetected 는 기본 false (golden 픽스처에 매크로 없음)', async () => {
    const buf = await loadFixture('01-paragraph');
    const doc = await parseHwpxHeadless(buf);
    const sum = summarizeDocument(doc);
    expect(sum.macrosDetected).toBe(false);
  });
});
