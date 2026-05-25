/**
 * Unit tests for ole-content-decoder.js
 *
 * 외부 픽스처 없이 ExcelJS / JSZip 으로 임시 OOXML 컨테이너를 만들어 검증한다.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  decodeExcel,
  decodeWord,
  decodePowerPoint,
  decodeOle,
  detectOleContainer,
  sniffOleContent,
} from './ole-content-decoder.js';

async function buildXlsxBytes() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.getCell('A1').value = 'name';
  ws.getCell('B1').value = 'qty';
  ws.getCell('A2').value = '사과';
  ws.getCell('B2').value = 3;
  ws.getCell('A3').value = '배';
  ws.getCell('B3').value = 5;
  ws.getCell('B4').value = { formula: 'SUM(B2:B3)', result: 8 };
  const ws2 = wb.addWorksheet('두번째');
  ws2.getCell('A1').value = 'hello';
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

async function buildDocxBytes() {
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
    '<w:body>\n' +
    '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>제목</w:t></w:r></w:p>\n' +
    '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>본문 가운데</w:t></w:r></w:p>\n' +
    '<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>이탤릭</w:t></w:r><w:r><w:t> 일반</w:t></w:r></w:p>\n' +
    '<w:sectPr/></w:body>\n' +
    '</w:document>\n';
  const zip = new JSZip();
  zip.file('word/document.xml', xml);
  zip.file('[Content_Types].xml', '<Types xmlns="x"/>');
  return zip.generateAsync({ type: 'uint8array' });
}

async function buildPptxBytes() {
  const slideXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<p:cSld><p:spTree>' +
    '<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>' +
    '<p:txBody><a:p><a:r><a:t>슬라이드 제목</a:t></a:r></a:p></p:txBody></p:sp>' +
    '<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>' +
    '<p:txBody><a:p><a:r><a:t>본문 한 줄</a:t></a:r></a:p></p:txBody></p:sp>' +
    '</p:spTree></p:cSld></p:sld>';
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', slideXml);
  zip.file('[Content_Types].xml', '<Types xmlns="x"/>');
  return zip.generateAsync({ type: 'uint8array' });
}

describe('detectOleContainer', () => {
  it('OOXML zip 시그니처를 감지한다', () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
    expect(detectOleContainer(bytes)).toBe('ooxml');
  });

  it('CFB 시그니처를 감지한다', () => {
    const bytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(detectOleContainer(bytes)).toBe('cfb');
  });

  it('EMF 시그니처를 감지한다', () => {
    const bytes = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0, 0]);
    expect(detectOleContainer(bytes)).toBe('metafile');
  });

  it('알 수 없는 컨테이너', () => {
    const bytes = new Uint8Array([0, 0, 0, 0]);
    expect(detectOleContainer(bytes)).toBe('unknown');
  });
});

describe('sniffOleContent', () => {
  it('xlsx bytes 로 oleType=excel, container=ooxml 을 결정한다', async () => {
    const bytes = await buildXlsxBytes();
    const sniff = sniffOleContent(bytes, 'embed.xlsx');
    expect(sniff?.container).toBe('ooxml');
    expect(sniff?.oleType).toBe('excel');
    expect(sniff?.filename).toBe('embed.xlsx');
  });

  it('빈 입력은 null 반환', () => {
    expect(sniffOleContent(null)).toBeNull();
    expect(sniffOleContent(new Uint8Array(0))).toBeNull();
  });
});

describe('decodeExcel', () => {
  it('워크북을 sheets 모델로 디코딩한다', async () => {
    const bytes = await buildXlsxBytes();
    const result = await decodeExcel(bytes, 'embed.xlsx');
    expect(result.type).toBe('excel');
    expect(result.sheets.length).toBe(2);
    const s = result.sheets[0];
    expect(s.name).toBe('Sheet1');
    expect(s.rows[0][0].value).toBe('name');
    expect(s.rows[1][1].value).toBe(3);
  });

  it('formula 셀을 인식한다', async () => {
    const bytes = await buildXlsxBytes();
    const result = await decodeExcel(bytes, 'embed.xlsx');
    const cell = result.sheets[0].rows[3][1];
    expect(cell.formula?.startsWith('=')).toBe(true);
    expect(cell.formula?.toUpperCase()).toContain('SUM(B2:B3)');
  });

  it('CFB(.xls) 컨테이너는 unsupported', async () => {
    const bytes = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0,
    ]);
    const result = await decodeExcel(bytes, 'legacy.xls');
    expect(result.type).toBe('unsupported');
    expect(result.oleType).toBe('excel');
  });

  it('빈 입력은 unsupported', async () => {
    const result = await decodeExcel(new Uint8Array(0));
    expect(result.type).toBe('unsupported');
  });
});

describe('decodeWord', () => {
  it('단락과 run 을 디코딩한다', async () => {
    const bytes = await buildDocxBytes();
    const result = await decodeWord(bytes, 'embed.docx');
    expect(result.type).toBe('word');
    expect(result.paragraphs.length).toBe(3);
    expect(result.paragraphs[0].runs[0].text).toBe('제목');
    expect(result.paragraphs[0].runs[0].bold).toBe(true);
  });

  it('정렬 속성을 파싱한다', async () => {
    const bytes = await buildDocxBytes();
    const result = await decodeWord(bytes, 'embed.docx');
    expect(result.paragraphs[1].align).toBe('center');
  });

  it('이탤릭 / 일반 run 을 분리한다', async () => {
    const bytes = await buildDocxBytes();
    const result = await decodeWord(bytes, 'embed.docx');
    const p = result.paragraphs[2];
    expect(p.runs[0].italic).toBe(true);
    expect(p.runs[1].italic).toBeUndefined();
    expect(p.runs.map(r => r.text).join('')).toBe('이탤릭 일반');
  });

  it('CFB(.doc) 컨테이너는 unsupported', async () => {
    const bytes = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0,
    ]);
    const result = await decodeWord(bytes, 'legacy.doc');
    expect(result.type).toBe('unsupported');
  });
});

describe('decodePowerPoint', () => {
  it('슬라이드 텍스트를 추출한다', async () => {
    const bytes = await buildPptxBytes();
    const result = await decodePowerPoint(bytes, 'embed.pptx');
    expect(result.type).toBe('powerpoint');
    expect(result.slides[0].title).toBe('슬라이드 제목');
    expect(result.slides[0].body).toEqual(['본문 한 줄']);
  });
});

describe('decodeOle dispatcher', () => {
  it('xlsx → excel 분기', async () => {
    const bytes = await buildXlsxBytes();
    const result = await decodeOle(bytes, 'embed.xlsx');
    expect(result.type).toBe('excel');
  });

  it('docx → word 분기', async () => {
    const bytes = await buildDocxBytes();
    const result = await decodeOle(bytes, 'embed.docx');
    expect(result.type).toBe('word');
  });
});
