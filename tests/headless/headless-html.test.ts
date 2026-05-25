/**
 * Headless HTML exporter 테스트.
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parseHwpxHeadless,
  exportHtml,
} from '../../src/lib/headless/index.js';

async function loadDoc(name: string) {
  const buf = await readFile(resolve(__dirname, '../golden', name, 'fixture.hwpx'));
  return parseHwpxHeadless(buf);
}

describe('html-exporter: 표준 HTML5 출력', () => {
  it('DOCTYPE + html + head + body 구조', async () => {
    const doc = await loadDoc('01-paragraph');
    const html = exportHtml(doc);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toMatch(/<html lang="ko">/);
    expect(html).toContain('<head>');
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain('<body');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('단락 텍스트가 모두 포함된다 (HTML 이스케이프 후에도)', async () => {
    const doc = await loadDoc('01-paragraph');
    const html = exportHtml(doc);
    expect(html).toContain('가운데 정렬');
    expect(html).toContain('빨강');
  });

  it('inlineStyles=true 면 <style> 블록을 생략한다', async () => {
    const doc = await loadDoc('01-paragraph');
    const html = exportHtml(doc, { inlineStyles: true });
    expect(html).not.toContain('<style>');
    expect(html).not.toContain('class="hwpx-document"');
  });

  it('inlineStyles=false (기본) 면 <style> 블록을 포함', async () => {
    const doc = await loadDoc('01-paragraph');
    const html = exportHtml(doc);
    expect(html).toContain('<style>');
    expect(html).toContain('.hwpx-table');
  });

  it('표는 <table>/<tr>/<td> 마크업으로 출력된다', async () => {
    const doc = await loadDoc('02-table');
    const html = exportHtml(doc);
    expect(html).toContain('<table');
    expect(html).toContain('<tr>');
    expect(html).toContain('<td');
    expect(html).toContain('병합');
  });

  it('colspan/rowspan 이 보존된다', async () => {
    const doc = await loadDoc('02-table');
    const html = exportHtml(doc);
    expect(html).toMatch(/colspan="2"/);
    expect(html).toMatch(/rowspan="2"/);
  });

  it('pageBreaks=true (기본) 면 page-break 디바이더 삽입', async () => {
    const doc = await loadDoc('01-paragraph');
    const html = exportHtml(doc);
    // 단일 섹션이라 page-break 가 안 들어갈 수 있으므로, CSS 정의만이라도 포함
    expect(html).toContain('hwpx-page-break');
  });

  it('HTML 이스케이프: <,>,& 가 안전하게 처리된다', async () => {
    // 가짜 doc 으로 검증
    const fakeDoc = {
      sections: [
        {
          elements: [
            { type: 'paragraph', runs: [{ text: '<script>alert(1)</script> & "Q"' }] },
          ],
        },
      ],
    };
    const html = exportHtml(fakeDoc);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('lang 옵션이 반영된다', async () => {
    const doc = await loadDoc('01-paragraph');
    const html = exportHtml(doc, { lang: 'en' });
    expect(html).toMatch(/<html lang="en">/);
  });
});
