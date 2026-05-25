/**
 * cmyk-pdf-generator 통합 테스트.
 * Puppeteer 가 필요한 부분은 RGB PDF 렌더러를 직접 주입(`renderRgbPdf`) 해서 우회한다.
 */

import { PDFDocument } from 'pdf-lib';

import {
  generatePrintReadyPdf,
  postProcessRgbPdf,
  applyPdfXMetadata,
  makeBlankRgbPdfBytes,
} from './cmyk-pdf-generator.js';

/**
 * 더미 RGB PDF 바이트를 동기 생성하기 위한 헬퍼.
 */
async function makeMultiPageRgbBytes(pageCount = 2) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([595.28, 841.89]); // A4
  }
  return await doc.save();
}

describe('makeBlankRgbPdfBytes', () => {
  it('빈 1페이지 PDF 를 반환', async () => {
    const bytes = await makeBlankRgbPdfBytes();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(100);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });
});

describe('postProcessRgbPdf', () => {
  it('빈 입력은 에러', async () => {
    await expect(postProcessRgbPdf(new Uint8Array(0))).rejects.toThrow(/비어/);
  });

  it('2-페이지 RGB PDF 에 마크/메타 합성 후에도 페이지 수 보존', async () => {
    const rgb = await makeMultiPageRgbBytes(2);
    const out = await postProcessRgbPdf(rgb, {
      fileName: 'integration-test.hwpx',
      title: 'Integration',
      author: 'tester',
    });
    expect(out).toBeInstanceOf(Uint8Array);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(2);

    // 메타데이터 확인 — pdf-lib 는 저장 시 Producer 를 자체 시그니처로 덮어쓸 수 있으므로
    // Title/Author/Creator 만 강제 검증한다.
    expect(reloaded.getTitle()).toBe('Integration');
    expect(reloaded.getAuthor()).toBe('tester');
    expect(reloaded.getCreator()).toContain('cmyk-pdf');
  });

  it('cropMarks/colorBar/registrationMarks=false 옵션도 정상 동작', async () => {
    const rgb = await makeMultiPageRgbBytes(1);
    const out = await postProcessRgbPdf(rgb, {
      cropMarks: false,
      colorBar: false,
      registrationMarks: false,
      pageInfo: false,
    });
    expect(out).toBeInstanceOf(Uint8Array);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});

describe('generatePrintReadyPdf (renderRgbPdf 주입)', () => {
  it('주입한 RGB 렌더러를 호출하고 결과 PDF 반환', async () => {
    const renderRgbPdf = vi.fn(async () => await makeMultiPageRgbBytes(1));
    const dummyHwpx = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP magic
    const out = await generatePrintReadyPdf(dummyHwpx, {
      renderRgbPdf,
      fileName: 'sample.hwpx',
      title: 'Sample',
    });
    expect(renderRgbPdf).toHaveBeenCalledTimes(1);
    expect(out).toBeInstanceOf(Uint8Array);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
    expect(reloaded.getTitle()).toBe('Sample');
  });

  it('hwpxBuffer 가 falsy 면 에러', async () => {
    await expect(generatePrintReadyPdf(null)).rejects.toThrow(/hwpxBuffer/);
  });
});

describe('applyPdfXMetadata', () => {
  it('Title/Author/Creator/Producer 가 설정됨', async () => {
    const doc = await PDFDocument.create();
    applyPdfXMetadata(doc, {
      title: 'Doc',
      author: 'Anyone',
      creator: 'C',
      producer: 'P',
    });
    expect(doc.getTitle()).toBe('Doc');
    expect(doc.getAuthor()).toBe('Anyone');
    expect(doc.getCreator()).toBe('C');
    expect(doc.getProducer()).toBe('P');
  });
});
