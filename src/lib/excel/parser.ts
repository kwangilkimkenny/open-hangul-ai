/**
 * Excel Parser
 * Excel(.xlsx/.xls) 파일을 편집기 문서 데이터(HWPXDocument)로 변환
 *
 * @module lib/excel/parser
 * @version 1.0.0
 */

interface Run {
  text: string;
  type?: string;
  inlineStyle?: Record<string, any>;
  style?: Record<string, any>;
}

interface CellData {
  elements: any[];
  colSpan?: number;
  rowSpan?: number;
  isCovered?: boolean;
  style?: Record<string, any>;
}

interface RowData {
  cells: CellData[];
  style?: Record<string, any>;
}

interface Element {
  type: string;
  runs?: Run[];
  rows?: RowData[];
  colWidths?: string[];
  colWidthsPercent?: string[];
  style?: Record<string, any>;
}

interface Section {
  elements: Element[];
  pageSettings: Record<string, string>;
  pageWidth: number;
  pageHeight: number;
  headers: { both: null; odd: null; even: null };
  footers: { both: null; odd: null; even: null };
}

interface DocumentData {
  sections: Section[];
  images: Map<string, any>;
  borderFills: Map<string, any>;
  metadata: Record<string, any>;
}

// =============================================
// Constants
// =============================================

const MAX_ROWS = 10000;
const VIRTUAL_SCROLL_THRESHOLD = 200;
const DEFAULT_COL_WIDTH = 8.43; // Excel default column width in character units
const PAGE_CONTENT_WIDTH = 624; // A4 content area: 794 - 85 - 85

// Excel theme color defaults (Office standard)
const THEME_COLORS: Record<number, string> = {
  0: '#000000', // dk1
  1: '#FFFFFF', // lt1
  2: '#44546A', // dk2
  3: '#E7E6E6', // lt2
  4: '#4472C4', // accent1
  5: '#ED7D31', // accent2
  6: '#A5A5A5', // accent3
  7: '#FFC000', // accent4
  8: '#5B9BD5', // accent5
  9: '#70AD47', // accent6
};

// =============================================
// Helper Functions
// =============================================

/**
 * ExcelJS ARGB 색상을 CSS hex로 변환
 * 'FF2B579A' → '#2B579A'
 */
function argbToHex(argb: string | undefined): string | undefined {
  if (!argb || argb.length < 6) return undefined;
  // ARGB format: 첫 2자리는 alpha, 나머지 6자리가 RGB
  const rgb = argb.length === 8 ? argb.substring(2) : argb;
  return `#${rgb}`;
}

/**
 * ExcelJS 색상 객체에서 CSS hex 추출
 */
function resolveColor(color: any): string | undefined {
  if (!color) return undefined;
  if (color.argb) return argbToHex(color.argb);
  if (color.theme !== undefined && color.theme !== null) {
    return THEME_COLORS[color.theme] || '#000000';
  }
  if (color.indexed !== undefined) return undefined; // indexed colors는 복잡 — 무시
  return undefined;
}

/**
 * Excel 열 너비(문자 단위)를 픽셀로 변환
 */
function excelWidthToPixels(charWidth: number): number {
  return Math.round(charWidth * 7.5 + 12);
}

/**
 * ExcelJS 테두리를 CSS 문자열로 변환
 */
function borderStyleToCSS(border: any): { css: string; visible: boolean } | undefined {
  if (!border || !border.style) return undefined;

  const widthMap: Record<string, string> = {
    thin: '1px',
    medium: '2px',
    thick: '3px',
    hair: '0.5px',
    dotted: '1px',
    dashed: '1px',
    dashDot: '1px',
    dashDotDot: '1px',
    double: '3px',
    mediumDashed: '2px',
    mediumDashDot: '2px',
    mediumDashDotDot: '2px',
    slantDashDot: '2px',
  };

  const styleMap: Record<string, string> = {
    thin: 'solid',
    medium: 'solid',
    thick: 'solid',
    hair: 'solid',
    dotted: 'dotted',
    dashed: 'dashed',
    dashDot: 'dashed',
    dashDotDot: 'dotted',
    double: 'double',
    mediumDashed: 'dashed',
    mediumDashDot: 'dashed',
    mediumDashDotDot: 'dotted',
    slantDashDot: 'dashed',
  };

  const width = widthMap[border.style] || '1px';
  const style = styleMap[border.style] || 'solid';
  const color = resolveColor(border.color) || '#000000';

  return { css: `${width} ${style} ${color}`, visible: true };
}

/**
 * 셀 값을 표시 문자열로 변환
 */
function getCellDisplayValue(cell: any): string {
  if (cell.value === null || cell.value === undefined) return '';

  // 수식 결과
  if (typeof cell.value === 'object' && cell.value.formula) {
    const result = cell.value.result;
    if (result !== undefined && result !== null) {
      if (result instanceof Date) return formatDate(result);
      return String(result);
    }
    return cell.text || '';
  }

  // 날짜
  if (cell.value instanceof Date) return formatDate(cell.value);

  // Rich text
  if (typeof cell.value === 'object' && cell.value.richText) {
    return cell.value.richText.map((rt: any) => rt.text || '').join('');
  }

  // 에러
  if (typeof cell.value === 'object' && cell.value.error) {
    return cell.value.error;
  }

  // Shared formula
  if (typeof cell.value === 'object' && cell.value.sharedFormula) {
    const result = cell.value.result;
    if (result !== undefined && result !== null) return String(result);
    return cell.text || '';
  }

  // 일반 값
  return cell.text || String(cell.value);
}

function formatDate(date: Date): string {
  try {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Rich text를 runs 배열로 변환
 */
function richTextToRuns(richText: any[], defaultFont: any): Run[] {
  return richText.map((rt: any) => {
    const run: Run = { text: rt.text || '' };
    const font = rt.font || defaultFont;
    if (font) {
      run.inlineStyle = buildFontStyle(font);
    }
    return run;
  });
}

/**
 * ExcelJS 폰트 객체를 inlineStyle로 변환
 */
function buildFontStyle(font: any): Record<string, any> {
  const style: Record<string, any> = {};
  if (!font) return style;

  if (font.bold) style.bold = true;
  if (font.italic) style.italic = true;
  if (font.size) style.fontSize = `${font.size}pt`;
  if (font.name) style.fontFamily = font.name;
  if (font.underline) style.underline = true;
  if (font.strike) style.strikethrough = true;

  const color = resolveColor(font.color);
  if (color && color !== '#000000') style.color = color;

  return style;
}

/**
 * 워크시트의 병합 셀 맵 구축
 * Returns: Map<'row,col', { rowSpan, colSpan, isOrigin }>
 */
function buildMergeMap(worksheet: any): Map<string, { rowSpan: number; colSpan: number; isOrigin: boolean }> {
  const mergeMap = new Map<string, { rowSpan: number; colSpan: number; isOrigin: boolean }>();

  // ExcelJS stores merges as range strings like 'A1:C3' or as model merges
  const merges: string[] = [];

  // Try worksheet._merges (internal) or iterate model
  if (worksheet.model && worksheet.model.merges) {
    merges.push(...worksheet.model.merges);
  } else if (worksheet._merges) {
    for (const key of Object.keys(worksheet._merges)) {
      const merge = worksheet._merges[key];
      if (merge && merge.model) {
        merges.push(merge.model);
      }
    }
  }

  for (const rangeStr of merges) {
    // Parse range like 'A1:C3' or 'B2:D5'
    const match = rangeStr.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    if (!match) continue;

    const startCol = colLetterToNumber(match[1]);
    const startRow = parseInt(match[2], 10);
    const endCol = colLetterToNumber(match[3]);
    const endRow = parseInt(match[4], 10);

    const rowSpan = endRow - startRow + 1;
    const colSpan = endCol - startCol + 1;

    // Origin cell
    mergeMap.set(`${startRow},${startCol}`, { rowSpan, colSpan, isOrigin: true });

    // Covered cells
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r === startRow && c === startCol) continue;
        mergeMap.set(`${r},${c}`, { rowSpan: 0, colSpan: 0, isOrigin: false });
      }
    }
  }

  return mergeMap;
}

/**
 * 열 문자를 숫자로 변환: A→1, B→2, Z→26, AA→27
 */
function colLetterToNumber(letters: string): number {
  let num = 0;
  for (let i = 0; i < letters.length; i++) {
    num = num * 26 + (letters.charCodeAt(i) - 64);
  }
  return num;
}

// =============================================
// Main Parser
// =============================================

/**
 * Excel 파일을 편집기 문서 데이터로 변환
 */
export async function parseExcel(buffer: ArrayBuffer, fileName: string): Promise<DocumentData> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  // .xls 감지 (OLE Compound Document: D0 CF 11 E0)
  const header = new Uint8Array(buffer.slice(0, 4));
  const isXls = header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0;

  if (isXls) {
    // .xls → .xlsx 변환 (SheetJS)
    const XLSX = await import('xlsx');
    const xlsWorkbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const xlsxBuffer = XLSX.write(xlsWorkbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    await workbook.xlsx.load(xlsxBuffer as any);
  } else {
    await workbook.xlsx.load(buffer);
  }

  const sections: Section[] = [];
  let truncatedSheets: string[] = [];

  for (const worksheet of workbook.worksheets) {
    if (!worksheet || worksheet.rowCount === 0) continue;

    const elements: Element[] = [];
    let wasTruncated = false;

    // 시트 이름 제목
    elements.push({
      type: 'paragraph',
      runs: [{
        text: worksheet.name || 'Sheet',
        inlineStyle: { bold: true, fontSize: '16pt' },
      }],
    });

    // 빈 줄
    elements.push({ type: 'paragraph', runs: [{ text: '' }] });

    // 열 정보 수집
    const colCount = worksheet.columnCount || 1;
    const colWidthsPx: number[] = [];

    for (let c = 1; c <= colCount; c++) {
      const col = worksheet.getColumn(c);
      const charWidth = col.width || DEFAULT_COL_WIDTH;
      colWidthsPx.push(excelWidthToPixels(charWidth));
    }

    const totalWidthPx = colWidthsPx.reduce((a, b) => a + b, 0) || 1;
    const colWidthsPercent = colWidthsPx.map(px => `${(px / totalWidthPx * 100).toFixed(2)}%`);

    // 병합 셀 맵
    const mergeMap = buildMergeMap(worksheet);

    // freeze pane에서 헤더 행 감지
    const frozenRow = worksheet.views?.[0]?.state === 'frozen' ? (worksheet.views[0] as any).ySplit || 0 : 0;

    // 행 순회
    const rows: RowData[] = [];
    let rowIndex = 0;

    worksheet.eachRow({ includeEmpty: true }, (row: any, rowNumber: number) => {
      if (rowIndex >= MAX_ROWS) {
        if (!wasTruncated) {
          wasTruncated = true;
          truncatedSheets.push(worksheet.name);
        }
        return;
      }
      rowIndex++;

      const cells: CellData[] = [];

      for (let c = 1; c <= colCount; c++) {
        const mergeInfo = mergeMap.get(`${rowNumber},${c}`);

        // 병합으로 덮인 셀 — 스킵
        if (mergeInfo && !mergeInfo.isOrigin) {
          continue;
        }

        const cell = row.getCell(c);
        const displayValue = getCellDisplayValue(cell);

        // 셀 runs 생성
        let runs: Run[];
        if (cell.value && typeof cell.value === 'object' && cell.value.richText) {
          runs = richTextToRuns(cell.value.richText, cell.font);
        } else {
          const run: Run = { text: displayValue };
          if (cell.font) {
            run.inlineStyle = buildFontStyle(cell.font);
          }
          runs = [run];
        }

        // 셀 스타일
        const cellStyle: Record<string, any> = {};

        // 배경색
        if (cell.fill) {
          if (cell.fill.type === 'pattern' && cell.fill.fgColor) {
            const bg = resolveColor(cell.fill.fgColor);
            if (bg) cellStyle.backgroundColor = bg;
          } else if (cell.fill.type === 'gradient' && cell.fill.stops?.length > 0) {
            const bg = resolveColor(cell.fill.stops[0].color);
            if (bg) cellStyle.backgroundColor = bg;
          }
        }

        // 정렬
        if (cell.alignment) {
          if (cell.alignment.horizontal) {
            const hMap: Record<string, string> = {
              left: 'left', center: 'center', right: 'right',
              justify: 'justify', fill: 'left', distributed: 'justify',
            };
            cellStyle.textAlign = hMap[cell.alignment.horizontal] || 'left';
          }
          if (cell.alignment.vertical) {
            const vMap: Record<string, string> = {
              top: 'top', middle: 'middle', bottom: 'bottom',
              justify: 'middle', distributed: 'middle',
            };
            cellStyle.verticalAlign = vMap[cell.alignment.vertical] || 'middle';
          }
        }

        // 테두리
        if (cell.border) {
          const topDef = borderStyleToCSS(cell.border.top);
          const bottomDef = borderStyleToCSS(cell.border.bottom);
          const leftDef = borderStyleToCSS(cell.border.left);
          const rightDef = borderStyleToCSS(cell.border.right);
          if (topDef) cellStyle.borderTopDef = topDef;
          if (bottomDef) cellStyle.borderBottomDef = bottomDef;
          if (leftDef) cellStyle.borderLeftDef = leftDef;
          if (rightDef) cellStyle.borderRightDef = rightDef;
        }

        // 패딩
        cellStyle.padding = '4px 6px';

        const cellData: CellData = {
          elements: [{ type: 'paragraph', runs }],
          style: cellStyle,
        };

        // 병합 셀
        if (mergeInfo && mergeInfo.isOrigin) {
          if (mergeInfo.colSpan > 1) cellData.colSpan = mergeInfo.colSpan;
          if (mergeInfo.rowSpan > 1) cellData.rowSpan = mergeInfo.rowSpan;
        }

        cells.push(cellData);
      }

      // 행 스타일
      const rowStyle: Record<string, any> = {
        heightType: 'MINIMUM',
      };

      if (row.height) {
        rowStyle.height = `${Math.round(row.height * 1.333)}px`;
      }

      // 헤더 행 (첫 행 또는 frozen pane 기준)
      if (rowNumber <= Math.max(1, frozenRow)) {
        rowStyle.isHeader = true;
        rowStyle.backgroundColor = '#F2F2F2';
        // 헤더 행의 모든 셀 텍스트를 bold로
        cells.forEach(cell => {
          cell.elements.forEach((el: any) => {
            if (el.runs) {
              el.runs.forEach((run: Run) => {
                run.inlineStyle = { ...run.inlineStyle, bold: true };
              });
            }
          });
        });
      }

      rows.push({ cells, style: rowStyle });
    });

    // 테이블 요소 생성
    if (rows.length > 0) {
      const tableStyle: Record<string, any> = {
        width: '100%',
      };

      // 대량 행 시 렌더러에 최적화 힌트 전달 (display:block + overflow 처리용)
      if (rows.length > VIRTUAL_SCROLL_THRESHOLD) {
        tableStyle.maxHeight = '600px';
        tableStyle.overflow = 'auto';
      }

      elements.push({
        type: 'table',
        rows,
        colWidthsPercent,
        style: tableStyle,
      });
    }

    // 잘림 경고
    if (wasTruncated) {
      elements.push({ type: 'paragraph', runs: [{ text: '' }] });
      elements.push({
        type: 'paragraph',
        runs: [{
          text: `[${MAX_ROWS}행까지만 표시됩니다. 전체 ${worksheet.rowCount}행]`,
          inlineStyle: { italic: true, color: '#999999', fontSize: '10pt' },
        }],
      });
    }

    // 가로 방향 감지 (8열 초과)
    const isLandscape = colCount > 8;

    sections.push({
      elements,
      pageSettings: {
        width: isLandscape ? '1123px' : '794px',
        height: isLandscape ? '794px' : '1123px',
        marginLeft: '60px',
        marginRight: '60px',
        marginTop: '56px',
        marginBottom: '42px',
      },
      pageWidth: isLandscape ? 1123 : 794,
      pageHeight: isLandscape ? 794 : 1123,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    });
  }

  // 시트가 없는 경우 빈 섹션
  if (sections.length === 0) {
    sections.push({
      elements: [{
        type: 'paragraph',
        runs: [{ text: '빈 Excel 파일입니다.', inlineStyle: { italic: true, color: '#999999' } }],
      }],
      pageSettings: {
        width: '794px', height: '1123px',
        marginLeft: '85px', marginRight: '85px',
        marginTop: '71px', marginBottom: '57px',
      },
      pageWidth: 794,
      pageHeight: 1123,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    });
  }

  return {
    sections,
    images: new Map(),
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: sections.length,
      imagesCount: 0,
      borderFillsCount: 0,
      sourceFormat: 'excel',
      fileName,
      truncated: truncatedSheets.length > 0,
      originalRowCount: truncatedSheets.length > 0
        ? Object.fromEntries(
            workbook.worksheets
              .filter((ws: any) => ws && truncatedSheets.includes(ws.name))
              .map((ws: any) => [ws.name, ws.rowCount])
          )
        : undefined,
      truncatedSheets: truncatedSheets.length > 0 ? truncatedSheets : undefined,
    },
  };
}

// =============================================
// Excel Exporter
// =============================================

/**
 * CSS hex 색상을 ExcelJS ARGB로 변환
 * '#2B579A' → 'FF2B579A', '#666' → 'FF666666', 'rgb(...)' → 'FFrrggbb'
 */
function hexToArgb(hex: string): string {
  if (!hex) return 'FF000000';
  let v = String(hex).trim();
  if (v.toLowerCase() === 'auto' || v.toLowerCase() === 'transparent') return 'FF000000';
  if (v.startsWith('#')) v = v.slice(1);
  const rgbMatch = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10));
    const g = Math.min(255, parseInt(rgbMatch[2], 10));
    const b = Math.min(255, parseInt(rgbMatch[3], 10));
    v = [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  if (/^[0-9a-fA-F]{3}$/.test(v)) v = v.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return 'FF000000';
  return `FF${v.toUpperCase()}`;
}

/**
 * CSS border 문자열에서 ExcelJS border 스타일 추출
 * '1px solid #000000' → { style: 'thin', color: { argb: 'FF000000' } }
 */
function cssBorderToExcel(borderDef: any): any | undefined {
  if (!borderDef || !borderDef.css) return undefined;
  const css = borderDef.css as string;
  const parts = css.split(/\s+/);
  if (parts.length < 2) return undefined;

  const widthPx = parseFloat(parts[0]);
  const cssStyle = parts[1];
  const color = parts[2] || '#000000';

  let excelStyle = 'thin';
  if (cssStyle === 'dotted') excelStyle = 'dotted';
  else if (cssStyle === 'dashed') excelStyle = 'dashed';
  else if (cssStyle === 'double') excelStyle = 'double';
  else if (widthPx >= 3) excelStyle = 'thick';
  else if (widthPx >= 2) excelStyle = 'medium';

  return { style: excelStyle, color: { argb: hexToArgb(color) } };
}

/**
 * 문서의 paragraph runs에서 텍스트 추출
 */
function extractTextFromElement(el: any): string {
  if (!el || !el.runs) return '';
  return el.runs
    .map((r: any) => {
      if (r.type === 'linebreak') return '\n';
      if (r.type === 'tab') return '\t';
      return r.text || '';
    })
    .join('');
}

/**
 * Run의 스타일 정보를 ExcelJS font 객체로 변환
 */
function runStyleToExcelFont(run: any): any {
  const s = run.inlineStyle || run.style || {};
  const font: any = {};

  if (s.bold || s.fontWeight === 'bold') font.bold = true;
  if (s.italic || s.fontStyle === 'italic') font.italic = true;
  if (s.underline) font.underline = true;
  if (s.strikethrough) font.strike = true;

  if (s.fontSize) {
    const size = parseFloat(String(s.fontSize));
    if (size > 0) font.size = size;
  }

  if (s.fontFamily) font.name = s.fontFamily;

  if (s.color && s.color !== '#000000') {
    font.color = { argb: hexToArgb(s.color) };
  }

  return Object.keys(font).length > 0 ? font : undefined;
}

/**
 * HWPXDocument를 Excel(.xlsx) Blob으로 내보내기
 */
export async function exportToExcel(doc: DocumentData, fileName?: string): Promise<Blob> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'HanView';
  workbook.created = new Date();

  for (let sIdx = 0; sIdx < doc.sections.length; sIdx++) {
    const section = doc.sections[sIdx];
    if (!section.elements || section.elements.length === 0) continue;

    // 시트 이름: 첫 번째 paragraph의 텍스트 또는 기본값
    let sheetName = `Sheet${sIdx + 1}`;
    const firstEl = section.elements[0];
    if (firstEl.type === 'paragraph' && firstEl.runs) {
      const title = firstEl.runs.map((r: Run) => r.text || '').join('').trim();
      if (title && title.length <= 31) {
        // Excel 시트 이름 제한: 31자, 특수문자 제거
        sheetName = title.replace(/[\\/*?:\[\]]/g, '').substring(0, 31) || sheetName;
      }
    }

    // 중복 시트 이름 방지
    let uniqueName = sheetName;
    let nameCounter = 1;
    while (workbook.worksheets.find((ws: any) => ws.name === uniqueName)) {
      uniqueName = `${sheetName.substring(0, 28)}_${nameCounter++}`;
    }

    const worksheet = workbook.addWorksheet(uniqueName);

    // 각 섹션의 테이블 요소를 찾아서 Excel로 변환
    for (const el of section.elements) {
      if (el.type !== 'table' || !el.rows) continue;

      // 열 너비 설정
      if (el.colWidthsPercent && el.colWidthsPercent.length > 0) {
        el.colWidthsPercent.forEach((pct: string, colIdx: number) => {
          const percent = parseFloat(pct);
          // 퍼센트를 문자 단위로 역변환 (대략적)
          const charWidth = Math.max(8, Math.round(percent / 100 * 80));
          const col = worksheet.getColumn(colIdx + 1);
          col.width = charWidth;
        });
      }

      let excelRow = 1;

      // 병합 셀을 추적하여 적용
      const merges: { startRow: number; startCol: number; endRow: number; endCol: number }[] = [];

      for (const row of el.rows) {
        if (!row.cells) continue;

        let excelCol = 1;

        // 이미 병합으로 점유된 열을 건너뛰기 위한 맵
        const occupiedCols = new Set<number>();
        for (const merge of merges) {
          if (excelRow >= merge.startRow && excelRow <= merge.endRow) {
            for (let c = merge.startCol; c <= merge.endCol; c++) {
              occupiedCols.add(c);
            }
          }
        }

        for (const cellData of row.cells) {
          // 점유된 열 건너뛰기
          while (occupiedCols.has(excelCol)) excelCol++;

          const cell = worksheet.getCell(excelRow, excelCol);

          // 셀 값 설정
          const textEls = cellData.elements || [];
          const texts: string[] = [];
          for (const te of textEls) {
            if (te.type === 'paragraph' && te.runs) {
              texts.push(te.runs.map((r: any) => r.text || '').join(''));
            }
          }
          const cellText = texts.join('\n');

          // 숫자인지 확인하여 숫자로 저장
          const numVal = Number(cellText);
          if (cellText && !isNaN(numVal) && cellText.trim() !== '') {
            cell.value = numVal;
          } else {
            cell.value = cellText;
          }

          // 폰트 스타일 (첫 번째 run 기준)
          const firstRun = textEls[0]?.runs?.[0];
          if (firstRun) {
            const font = runStyleToExcelFont(firstRun);
            if (font) cell.font = font;
          }

          // 셀 스타일
          const cs = cellData.style || {};

          // 배경색
          if (cs.backgroundColor && cs.backgroundColor !== '#FFFFFF') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: hexToArgb(cs.backgroundColor) },
            } as any;
          }

          // 정렬
          const alignment: any = { wrapText: true };
          if (cs.textAlign) alignment.horizontal = cs.textAlign;
          if (cs.verticalAlign) alignment.vertical = cs.verticalAlign;
          cell.alignment = alignment;

          // 테두리
          const border: any = {};
          if (cs.borderTopDef) border.top = cssBorderToExcel(cs.borderTopDef);
          if (cs.borderBottomDef) border.bottom = cssBorderToExcel(cs.borderBottomDef);
          if (cs.borderLeftDef) border.left = cssBorderToExcel(cs.borderLeftDef);
          if (cs.borderRightDef) border.right = cssBorderToExcel(cs.borderRightDef);
          if (Object.keys(border).length > 0) cell.border = border;

          // 병합 셀
          if ((cellData.colSpan && cellData.colSpan > 1) || (cellData.rowSpan && cellData.rowSpan > 1)) {
            const endRow = excelRow + (cellData.rowSpan || 1) - 1;
            const endCol = excelCol + (cellData.colSpan || 1) - 1;
            merges.push({ startRow: excelRow, startCol: excelCol, endRow, endCol });
          }

          excelCol += (cellData.colSpan || 1);
        }

        // 행 높이
        if (row.style?.height) {
          const heightPx = parseFloat(String(row.style.height));
          if (heightPx > 0) {
            worksheet.getRow(excelRow).height = heightPx / 1.333; // px → points
          }
        }

        excelRow++;
      }

      // 병합 적용
      for (const merge of merges) {
        try {
          worksheet.mergeCells(merge.startRow, merge.startCol, merge.endRow, merge.endCol);
        } catch {
          // 병합 충돌 무시
        }
      }
    }

    // 테이블이 없는 섹션: paragraph 텍스트를 A열에 배치
    const hasTables = section.elements.some(el => el.type === 'table');
    if (!hasTables) {
      let rowNum = 1;
      for (const el of section.elements) {
        if (el.type === 'paragraph' && el.runs) {
          const text = el.runs.map((r: Run) => r.text || '').join('');
          const cell = worksheet.getCell(rowNum, 1);
          cell.value = text;

          const firstRun = el.runs[0];
          if (firstRun) {
            const font = runStyleToExcelFont(firstRun);
            if (font) cell.font = font;
          }

          rowNum++;
        }
      }
      worksheet.getColumn(1).width = 80;
    }
  }

  // Blob 생성
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * HWPXDocument를 Excel 파일로 다운로드
 */
export async function downloadExcel(doc: DocumentData, fileName: string = '문서.xlsx'): Promise<void> {
  const blob = await exportToExcel(doc, fileName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default { parseExcel, exportToExcel, downloadExcel };
