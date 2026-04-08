/**
 * Excel Parser Tests
 * @module lib/excel/parser.test
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { parseExcel, exportToExcel } from './parser';
import ExcelJS from 'exceljs';

// 테스트용 xlsx 버퍼 생성 헬퍼
async function createTestWorkbook(options?: {
  sheets?: number;
  merges?: boolean;
  styling?: boolean;
  rows?: number;
}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheetCount = options?.sheets || 1;
  const rowCount = options?.rows || 5;

  for (let s = 0; s < sheetCount; s++) {
    const ws = wb.addWorksheet(`시트${s + 1}`);

    // 헤더
    ws.getCell('A1').value = '이름';
    ws.getCell('B1').value = '값';
    ws.getCell('C1').value = '비고';

    // 데이터
    for (let r = 2; r <= rowCount; r++) {
      ws.getCell(`A${r}`).value = `항목${r - 1}`;
      ws.getCell(`B${r}`).value = r * 10;
      ws.getCell(`C${r}`).value = `메모${r - 1}`;
    }

    if (options?.styling) {
      ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF2B579A' } };
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell('A1').border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
      };
    }

    if (options?.merges) {
      ws.mergeCells('A1:C1');
      ws.getCell('A1').value = '병합된 제목';
    }

    ws.getColumn('A').width = 15;
    ws.getColumn('B').width = 10;
    ws.getColumn('C').width = 20;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('Excel Parser', () => {
  describe('parseExcel', () => {
    it('단일 시트 파싱 → 1개 섹션 생성', async () => {
      const buffer = await createTestWorkbook();
      const doc = await parseExcel(buffer, 'test.xlsx');

      expect(doc.sections).toHaveLength(1);
      expect(doc.metadata.sourceFormat).toBe('excel');
      expect(doc.metadata.fileName).toBe('test.xlsx');
    });

    it('다중 시트 파싱 → 시트 수만큼 섹션 생성', async () => {
      const buffer = await createTestWorkbook({ sheets: 3 });
      const doc = await parseExcel(buffer, 'multi.xlsx');

      expect(doc.sections).toHaveLength(3);
      expect(doc.metadata.sectionsCount).toBe(3);
    });

    it('시트 이름이 제목 문단으로 생성됨', async () => {
      const buffer = await createTestWorkbook();
      const doc = await parseExcel(buffer, 'test.xlsx');

      const firstElement = doc.sections[0].elements[0];
      expect(firstElement.type).toBe('paragraph');
      expect(firstElement.runs![0].text).toBe('시트1');
      expect(firstElement.runs![0].inlineStyle?.bold).toBe(true);
    });

    it('테이블 요소가 올바른 행/셀 구조를 가짐', async () => {
      const buffer = await createTestWorkbook({ rows: 3 });
      const doc = await parseExcel(buffer, 'test.xlsx');

      // 제목 문단 + 빈줄 + 테이블 = 최소 3개
      const tableEl = doc.sections[0].elements.find((e: any) => e.type === 'table');
      expect(tableEl).toBeDefined();
      expect(tableEl!.rows).toBeDefined();
      expect(tableEl!.rows!.length).toBe(3); // 헤더 + 2 데이터 행
    });

    it('셀 스타일이 올바르게 매핑됨', async () => {
      const buffer = await createTestWorkbook({ styling: true });
      const doc = await parseExcel(buffer, 'styled.xlsx');

      const table = doc.sections[0].elements.find((e: any) => e.type === 'table');
      expect(table).toBeDefined();

      // 첫 행의 첫 셀 확인
      const firstCell = table!.rows![0].cells[0];
      expect(firstCell.style?.backgroundColor).toBe('#FFE699');

      // run 스타일 확인
      const run = firstCell.elements[0].runs[0];
      expect(run.inlineStyle?.bold).toBe(true);
    });

    it('병합 셀이 colSpan으로 변환됨', async () => {
      const buffer = await createTestWorkbook({ merges: true });
      const doc = await parseExcel(buffer, 'merged.xlsx');

      const table = doc.sections[0].elements.find((e: any) => e.type === 'table');
      const firstCell = table!.rows![0].cells[0];
      expect(firstCell.colSpan).toBe(3);
    });

    it('열 너비가 colWidthsPercent로 변환됨', async () => {
      const buffer = await createTestWorkbook();
      const doc = await parseExcel(buffer, 'test.xlsx');

      const table = doc.sections[0].elements.find((e: any) => e.type === 'table');
      expect(table!.colWidthsPercent).toBeDefined();
      expect(table!.colWidthsPercent!.length).toBe(3);
      // 퍼센트 합이 ~100%
      const sum = table!.colWidthsPercent!.reduce((a: number, b: string) => a + parseFloat(b), 0);
      expect(sum).toBeCloseTo(100, 0);
    });

    it('페이지 설정이 포함됨', async () => {
      const buffer = await createTestWorkbook();
      const doc = await parseExcel(buffer, 'test.xlsx');

      const section = doc.sections[0];
      expect(section.pageSettings).toBeDefined();
      expect(section.pageWidth).toBeGreaterThan(0);
      expect(section.pageHeight).toBeGreaterThan(0);
    });

    it('빈 워크북은 빈 메시지 섹션 반환', async () => {
      const wb = new ExcelJS.Workbook();
      const buffer = await wb.xlsx.writeBuffer();
      const doc = await parseExcel(buffer as ArrayBuffer, 'empty.xlsx');

      expect(doc.sections).toHaveLength(1);
      const text = doc.sections[0].elements[0].runs![0].text;
      expect(text).toContain('빈 Excel');
    });
  });

  describe('exportToExcel', () => {
    it('HWPXDocument → Blob 변환 성공', async () => {
      const buffer = await createTestWorkbook();
      const doc = await parseExcel(buffer, 'test.xlsx');

      const blob = await exportToExcel(doc);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toContain('spreadsheetml');
    });

    it('내보내기 Blob의 MIME 타입이 올바름', async () => {
      const buffer = await createTestWorkbook({ styling: true });
      const doc1 = await parseExcel(buffer, 'test.xlsx');

      const blob = await exportToExcel(doc1);
      expect(blob.type).toContain('spreadsheetml');
      expect(blob.size).toBeGreaterThan(100);
    });
  });
});
