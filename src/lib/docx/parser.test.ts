/**
 * DOCX Parser Tests
 * @module lib/docx/parser.test
 */
import { describe, it, expect } from 'vitest';
import { parseDocx, exportToDocx } from './parser';
import JSZip from 'jszip';

// 테스트용 최소 DOCX 파일 생성 헬퍼
async function createTestDocx(options?: {
  paragraphs?: { text: string; bold?: boolean; italic?: boolean; fontSize?: number; heading?: number }[];
  table?: { rows: string[][] };
}): Promise<ArrayBuffer> {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

  // document.xml 생성
  let bodyContent = '';

  // 문단
  const paragraphs = options?.paragraphs || [
    { text: '테스트 문서', bold: true, fontSize: 24 },
    { text: '일반 텍스트입니다.' },
    { text: '굵은 글씨', bold: true },
    { text: '기울임 글씨', italic: true },
  ];

  for (const p of paragraphs) {
    let rPr = '';
    if (p.bold) rPr += '<w:b/>';
    if (p.italic) rPr += '<w:i/>';
    if (p.fontSize) rPr += `<w:sz w:val="${p.fontSize * 2}"/>`;

    let pPr = '';
    if (p.heading) {
      pPr = `<w:pPr><w:pStyle w:val="Heading${p.heading}"/></w:pPr>`;
    }

    bodyContent += `<w:p>${pPr}<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${p.text}</w:t></w:r></w:p>`;
  }

  // 테이블
  if (options?.table) {
    let tblContent = '<w:tblGrid>';
    const colCount = options.table.rows[0]?.length || 1;
    for (let c = 0; c < colCount; c++) {
      tblContent += `<w:gridCol w:w="2880"/>`;
    }
    tblContent += '</w:tblGrid>';

    for (const row of options.table.rows) {
      tblContent += '<w:tr>';
      for (const cellText of row) {
        tblContent += `<w:tc><w:p><w:r><w:t>${cellText}</w:t></w:r></w:p></w:tc>`;
      }
      tblContent += '</w:tr>';
    }
    bodyContent += `<w:tbl>${tblContent}</w:tbl>`;
  }

  // 섹션 속성
  bodyContent += `<w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
  </w:sectPr>`;

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyContent}</w:body>
</w:document>`);

  const blob = await zip.generateAsync({ type: 'arraybuffer' });
  return blob;
}

describe('DOCX Parser', () => {
  describe('parseDocx', () => {
    it('기본 DOCX 파싱 → 1개 섹션 생성', async () => {
      const buffer = await createTestDocx();
      const doc = await parseDocx(buffer, 'test.docx');

      expect(doc.sections).toHaveLength(1);
      expect(doc.metadata.sourceFormat).toBe('docx');
      expect(doc.metadata.fileName).toBe('test.docx');
    });

    it('문단 텍스트가 올바르게 추출됨', async () => {
      const buffer = await createTestDocx({
        paragraphs: [{ text: '안녕하세요' }],
      });
      const doc = await parseDocx(buffer, 'test.docx');

      const para = doc.sections[0].elements[0];
      expect(para.type).toBe('paragraph');
      expect(para.runs![0].text).toBe('안녕하세요');
    });

    it('굵은 글씨 스타일이 매핑됨', async () => {
      const buffer = await createTestDocx({
        paragraphs: [{ text: '볼드', bold: true }],
      });
      const doc = await parseDocx(buffer, 'test.docx');

      const run = doc.sections[0].elements[0].runs![0];
      expect(run.inlineStyle?.bold).toBe(true);
    });

    it('기울임 글씨 스타일이 매핑됨', async () => {
      const buffer = await createTestDocx({
        paragraphs: [{ text: '이탤릭', italic: true }],
      });
      const doc = await parseDocx(buffer, 'test.docx');

      const run = doc.sections[0].elements[0].runs![0];
      expect(run.inlineStyle?.italic).toBe(true);
    });

    it('글꼴 크기가 매핑됨', async () => {
      const buffer = await createTestDocx({
        paragraphs: [{ text: '큰 글씨', fontSize: 24 }],
      });
      const doc = await parseDocx(buffer, 'test.docx');

      const run = doc.sections[0].elements[0].runs![0];
      expect(run.inlineStyle?.fontSize).toBe('24pt');
    });

    it('테이블이 올바르게 파싱됨', async () => {
      const buffer = await createTestDocx({
        paragraphs: [],
        table: {
          rows: [
            ['이름', '나이', '도시'],
            ['홍길동', '30', '서울'],
            ['김철수', '25', '부산'],
          ],
        },
      });
      const doc = await parseDocx(buffer, 'table.docx');

      const table = doc.sections[0].elements.find((e: any) => e.type === 'table');
      expect(table).toBeDefined();
      expect(table!.rows!).toHaveLength(3);
      expect(table!.rows![0].cells).toHaveLength(3);
    });

    it('테이블 셀 텍스트가 추출됨', async () => {
      const buffer = await createTestDocx({
        paragraphs: [],
        table: { rows: [['셀1', '셀2']] },
      });
      const doc = await parseDocx(buffer, 'test.docx');

      const table = doc.sections[0].elements.find((e: any) => e.type === 'table');
      const cellText = table!.rows![0].cells[0].elements[0].runs[0].text;
      expect(cellText).toBe('셀1');
    });

    it('열 너비가 colWidthsPercent로 변환됨', async () => {
      const buffer = await createTestDocx({
        paragraphs: [],
        table: { rows: [['A', 'B', 'C']] },
      });
      const doc = await parseDocx(buffer, 'test.docx');

      const table = doc.sections[0].elements.find((e: any) => e.type === 'table');
      expect(table!.colWidthsPercent).toBeDefined();
      expect(table!.colWidthsPercent!.length).toBe(3);
    });

    it('페이지 설정이 추출됨', async () => {
      const buffer = await createTestDocx();
      const doc = await parseDocx(buffer, 'test.docx');

      expect(doc.sections[0].pageSettings.width).toBeDefined();
      expect(doc.sections[0].pageWidth).toBeGreaterThan(0);
    });

    it('잘못된 파일은 에러 발생', async () => {
      const buffer = new ArrayBuffer(10);
      await expect(parseDocx(buffer, 'bad.docx')).rejects.toThrow();
    });
  });

  describe('exportToDocx', () => {
    it('HWPXDocument → Blob 변환 성공', async () => {
      const buffer = await createTestDocx();
      const doc = await parseDocx(buffer, 'test.docx');

      const blob = await exportToDocx(doc);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('내보내기 Blob의 크기와 타입이 올바름', async () => {
      const buffer = await createTestDocx({
        paragraphs: [
          { text: '제목', bold: true, fontSize: 20 },
          { text: '본문 1' },
          { text: '본문 2' },
        ],
      });
      const doc1 = await parseDocx(buffer, 'test.docx');

      const blob = await exportToDocx(doc1);
      expect(blob.size).toBeGreaterThan(100);
    });

    it('테이블 포함 문서 내보내기 성공', async () => {
      const buffer = await createTestDocx({
        paragraphs: [{ text: '테이블 문서' }],
        table: { rows: [['A', 'B'], ['1', '2']] },
      });
      const doc1 = await parseDocx(buffer, 'test.docx');

      const blob = await exportToDocx(doc1);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(100);
    });
  });
});
