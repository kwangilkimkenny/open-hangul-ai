/**
 * Unit tests for excel-preview.js
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildExcelPreview, sliceForPreview } from './excel-preview.js';

async function buildBigWorkbook(sheetCount = 8, rows = 10, cols = 8) {
  const wb = new ExcelJS.Workbook();
  for (let s = 1; s <= sheetCount; s++) {
    const ws = wb.addWorksheet(`Sheet${s}`);
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        ws.getCell(r, c).value = `s${s}-r${r}c${c}`;
      }
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

describe('sliceForPreview', () => {
  it('5x5 영역으로 자른다(기본)', () => {
    const rows = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => ({ value: `${r}-${c}` }))
    );
    const out = sliceForPreview(rows);
    expect(out.length).toBe(5);
    expect(out[0].length).toBe(5);
    expect(out[4][4].value).toBe('4-4');
  });

  it('가로/세로 크기가 작으면 그대로 반환', () => {
    const rows = [[{ value: 'a' }, { value: 'b' }]];
    const out = sliceForPreview(rows);
    expect(out).toEqual(rows);
  });

  it('잘못된 입력은 빈 배열', () => {
    expect(sliceForPreview(null)).toEqual([]);
    expect(sliceForPreview(undefined)).toEqual([]);
  });
});

describe('buildExcelPreview', () => {
  it('대규모 워크북에서 활성 시트만 로드한다', async () => {
    const bytes = await buildBigWorkbook(8, 10, 10);
    const preview = await buildExcelPreview(bytes, 'big.xlsx');
    expect(preview.type).toBe('excel-preview');
    expect(preview.totalSheets).toBe(8);
    expect(preview.activeSheet).toBe('Sheet1');
    expect(preview.sheets).toHaveLength(8);
    expect(preview.sheets[0].loaded).toBe(true);
    for (let i = 1; i < 8; i++) {
      expect(preview.sheets[i].loaded).toBe(false);
    }
  });

  it('preview 는 5x5 셀로 잘려있다', async () => {
    const bytes = await buildBigWorkbook(2, 20, 20);
    const preview = await buildExcelPreview(bytes, 'big.xlsx');
    expect(preview.preview.length).toBe(5);
    expect(preview.preview[0].length).toBe(5);
    expect(preview.preview[0][0].value).toBe('s1-r1c1');
  });

  it('loadSheet 로 lazy 시트를 hydrate 한다', async () => {
    const bytes = await buildBigWorkbook(3, 4, 4);
    const preview = await buildExcelPreview(bytes, 'big.xlsx');
    expect(preview.sheets[2].loaded).toBe(false);
    const sheet3 = await preview.loadSheet('Sheet3');
    expect(sheet3).not.toBeNull();
    expect(sheet3.name).toBe('Sheet3');
    expect(sheet3.rows[0][0].value).toBe('s3-r1c1');
  });

  it('loadSheet 결과는 캐시된다 (동일 객체 반환)', async () => {
    const bytes = await buildBigWorkbook(2, 4, 4);
    const preview = await buildExcelPreview(bytes, 'big.xlsx');
    const first = await preview.loadSheet('Sheet2');
    const second = await preview.loadSheet('Sheet2');
    expect(first).toBe(second);
  });

  it('활성 시트도 캐시되어 두번째 loadSheet 는 즉시 반환', async () => {
    const bytes = await buildBigWorkbook(2, 3, 3);
    const preview = await buildExcelPreview(bytes, 'big.xlsx');
    const active = await preview.loadSheet('Sheet1');
    expect(active).not.toBeNull();
    expect(active.name).toBe('Sheet1');
  });

  it('빈 입력은 error envelope 을 반환한다', async () => {
    const preview = await buildExcelPreview(new Uint8Array(0), 'empty.xlsx');
    expect(preview.type).toBe('excel-preview');
    expect(preview.error).toBeTruthy();
    expect(preview.sheets).toEqual([]);
    expect(preview.preview).toEqual([]);
  });
});
