/**
 * Unit tests for ole-reserializer.js (round-trip 포함)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
  serializeExcelToOle,
  serializeWordToOle,
  reserializeOle,
} from './ole-reserializer.js';
import { decodeExcel, decodeWord } from './ole-content-decoder.js';

describe('serializeExcelToOle', () => {
  it('xlsx Uint8Array 를 생성한다', async () => {
    const bytes = await serializeExcelToOle({
      sheets: [
        {
          name: 'Sheet1',
          rows: [[{ value: 'a' }, { value: 1 }]],
        },
      ],
      activeSheet: 'Sheet1',
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(100);
    // ZIP signature
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('Excel round-trip: 값/수식이 보존된다', async () => {
    const bytes = await serializeExcelToOle({
      sheets: [
        {
          name: 'Sheet1',
          rows: [
            [{ value: 'name' }, { value: 'qty' }],
            [{ value: '사과' }, { value: 3 }],
            [{ value: '배' }, { value: 5 }],
            [{ value: null }, { value: null, formula: '=SUM(B2:B3)' }],
          ],
        },
      ],
      activeSheet: 'Sheet1',
    });
    const decoded = await decodeExcel(bytes, 'rt.xlsx');
    expect(decoded.type).toBe('excel');
    const rows = decoded.sheets[0].rows;
    expect(rows[1][0].value).toBe('사과');
    expect(rows[1][1].value).toBe(3);
    const formulaCell = rows[3][1];
    expect(formulaCell.formula?.toUpperCase()).toContain('SUM(B2:B3)');
  });

  it('다중 시트 보존', async () => {
    const bytes = await serializeExcelToOle({
      sheets: [
        { name: 'A', rows: [[{ value: 1 }]] },
        { name: 'B', rows: [[{ value: 'hi' }]] },
      ],
    });
    const decoded = await decodeExcel(bytes, 'multi.xlsx');
    expect(decoded.sheets.map(s => s.name)).toEqual(['A', 'B']);
  });

  it('잘못된 입력은 throw', async () => {
    await expect(serializeExcelToOle(null)).rejects.toThrow(/invalid dataModel/);
  });
});

describe('serializeWordToOle', () => {
  it('docx Uint8Array 를 생성한다', async () => {
    const bytes = await serializeWordToOle({
      paragraphs: [{ runs: [{ text: '안녕하세요' }] }],
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(200);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('Word round-trip: 단락/run/서식 보존', async () => {
    const bytes = await serializeWordToOle({
      paragraphs: [
        { runs: [{ text: '제목', bold: true }] },
        { runs: [{ text: '본문' }], align: 'center' },
        { runs: [{ text: '기울임', italic: true }, { text: ' 일반' }] },
      ],
    });
    const decoded = await decodeWord(bytes, 'rt.docx');
    expect(decoded.type).toBe('word');
    expect(decoded.paragraphs.length).toBe(3);
    expect(decoded.paragraphs[0].runs[0].text).toBe('제목');
    expect(decoded.paragraphs[0].runs[0].bold).toBe(true);
    expect(decoded.paragraphs[1].align).toBe('center');
    const lastRuns = decoded.paragraphs[2].runs;
    expect(lastRuns[0].italic).toBe(true);
    expect(lastRuns.map(r => r.text).join('')).toBe('기울임 일반');
  });

  it('XML 특수문자 이스케이프', async () => {
    const bytes = await serializeWordToOle({
      paragraphs: [{ runs: [{ text: '<&"한>' }] }],
    });
    const decoded = await decodeWord(bytes, 'esc.docx');
    expect(decoded.paragraphs[0].runs[0].text).toBe('<&"한>');
  });

  it('잘못된 입력은 throw', async () => {
    await expect(serializeWordToOle(null)).rejects.toThrow(/invalid dataModel/);
  });
});

describe('reserializeOle dispatcher', () => {
  it('type=excel → xlsx', async () => {
    const result = await reserializeOle({
      type: 'excel',
      sheets: [{ name: 'S', rows: [[{ value: 1 }]] }],
    });
    expect(result.extension).toBe('xlsx');
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.mimeType).toContain('spreadsheetml');
  });

  it('type=word → docx', async () => {
    const result = await reserializeOle({
      type: 'word',
      paragraphs: [{ runs: [{ text: 'x' }] }],
    });
    expect(result.extension).toBe('docx');
    expect(result.mimeType).toContain('wordprocessingml');
  });

  it('미지원 타입은 throw', async () => {
    await expect(reserializeOle({ type: 'macro' })).rejects.toThrow(/unsupported/);
  });
});
