import { Table, TableCell, TableRow } from 'hwplib-js';
import { generateParagraphsXml } from '../ForParagraph';
import { FONT_SIZE, MARGIN, PAGE, BORDER_FILL, TABLE } from '../../../constants/hwpunit';
import { generateInstanceId } from '../../../util/IdGenerator';
import { StringXmlWriter } from '../../stream/StringXmlWriter';

/**
 * 캡션을 포함한 테이블 확장 인터페이스
 * hwplib-js 빌드 없이도 타입 안전성 확보
 */
interface TableWithCaption extends Table {
  captionPosition?: string;
  captionGap?: number;
}

/**
 * 재계산된 행 데이터 인터페이스
 */
interface CalculatedRow {
  cells: TableCell[];
}

/**
 * Table to OWPML XML conversion
 * Uses correct hwplib-js cell properties: colAddr, rowAddr
 */
export function tableToXml(table: TableWithCaption): string {
  const instId = generateInstanceId();

  // --- Auto-Layout Logic ---
  // hwplib-js의 colAddr/rowAddr가 신뢰할 수 없으므로(예: 55277, Overlap),
  // 직접 Grid를 구성하여 재계산합니다.

  const rows: TableRow[] = table.rows || [];
  const calculatedRows: CalculatedRow[] = []; // 재구성된 행 데이터

  // --- hwplib-js 중복 셀 필터링 ---
  // hwplib-js에서 동일한 (rowAddr, colAddr)를 가진 중복 셀을 반환하는 버그가 있음
  // 각 행에서 중복 셀을 제거하여 올바른 테이블 구조를 유지
  const seenAddresses = new Set<string>();
  const filteredRows = rows.map((row: TableRow, rIdx: number) => {
    const cells: TableCell[] = row.cells || [];
    const uniqueCells = cells.filter((cell: TableCell) => {
      // hwplib-js의 원본 주소가 있으면 사용, 없으면 행 인덱스 사용
      const rowAddr = cell.rowAddr ?? rIdx;
      const colAddr = cell.colAddr ?? 0;
      const key = `${rowAddr},${colAddr}`;

      if (seenAddresses.has(key)) {
        return false; // 중복 셀 제거
      }
      seenAddresses.add(key);
      return true;
    });
    return { ...row, cells: uniqueCells };
  });

  // Sparse Occupancy Grid using Set for O(1) lookup and reduced memory
  // For a 100x100 table, Set uses only occupied cells vs 10,000 array slots
  const occupied = new Set<string>();

  function isOccupied(r: number, c: number): boolean {
    return occupied.has(`${r},${c}`);
  }

  function markOccupied(r: number, c: number, rs: number, cs: number): void {
    for (let i = 0; i < rs; i++) {
      for (let j = 0; j < cs; j++) {
        occupied.add(`${r + i},${c + j}`);
      }
    }
  }

  let maxColCnt = 0;

  filteredRows.forEach((row: CalculatedRow, rIdx: number) => {
    const cells: TableCell[] = row.cells || [];
    const newCells: TableCell[] = [];
    let currentCIdx = 0;

    cells.forEach((cell: TableCell) => {
      // Find next available slot
      while (isOccupied(rIdx, currentCIdx)) {
        currentCIdx++;
      }

      const colSpan = cell.colSpan || 1;
      const rowSpan = cell.rowSpan || 1;

      // Assign trusted address
      cell.rowAddr = rIdx;
      cell.colAddr = currentCIdx;

      markOccupied(rIdx, currentCIdx, rowSpan, colSpan);

      newCells.push(cell);

      // Update max column count
      if (currentCIdx + colSpan > maxColCnt) {
        maxColCnt = currentCIdx + colSpan;
      }

      // Advance cursor
      currentCIdx += colSpan;
    });
    calculatedRows.push({ ...row, cells: newCells });
  });

  const finalRowCount = calculatedRows.length || 1;
  const finalColCount = maxColCnt || 1;

  // --- End Auto-Layout ---

  // Calculate table width/height from properties or content
  // Note: table.width가 0이거나 undefined인 경우 셀 너비 합계 사용
  let tableWidth = table.width;
  if (!tableWidth || tableWidth < 100) {
    // 표 너비가 없거나 너무 작으면 셀 너비 합계로 계산
    if (calculatedRows.length > 0 && calculatedRows[0].cells) {
      // 첫 번째 행의 셀 너비 합계 (병합 셀 고려)
      const firstRowCells = calculatedRows[0].cells;
      tableWidth = firstRowCells.reduce((sum: number, c: TableCell) => {
        return sum + (c.width || FONT_SIZE.DEFAULT);
      }, 0);
    }
  }
  // 여전히 없으면 기본값 사용
  if (!tableWidth || tableWidth < 100) {
    tableWidth = PAGE.DEFAULT_TEXT_WIDTH;
  }

  // Calculate table height based on row heights
  // Note: table.height가 0이거나 너무 작으면 셀 높이 합계 사용
  let tableHeight = table.height;
  const minValidHeight = 500; // 최소 유효 높이 (너무 작으면 재계산)

  if (!tableHeight || tableHeight < minValidHeight) {
    // Calculate height based on row heights (using single-row cells only to avoid double-counting)
    const rowHeights: Map<number, number> = new Map();

    for (let rIdx = 0; rIdx < calculatedRows.length; rIdx++) {
      const row = calculatedRows[rIdx];
      const cells = row.cells || [];

      for (const cell of cells) {
        const rowAddr = cell.rowAddr ?? rIdx;
        const rowSpan = cell.rowSpan || 1;
        const height = cell.height || TABLE.DEFAULT_CELL_HEIGHT;

        // Only use single-row cells for row height calculation
        if (rowSpan === 1) {
          const currentMax = rowHeights.get(rowAddr) || 0;
          if (height > currentMax) {
            rowHeights.set(rowAddr, height);
          }
        }
      }
    }

    // Sum all row heights
    let sumRowHeights = 0;
    for (let i = 0; i < finalRowCount; i++) {
      sumRowHeights += rowHeights.get(i) || TABLE.DEFAULT_CELL_HEIGHT;
    }

    // Add border spacing compensation
    // HWP includes border thickness in table height
    // There are (rowCount + 1) horizontal border lines
    const totalBorderHeight = TABLE.BORDER_THICKNESS * (finalRowCount + 1);

    tableHeight = sumRowHeights + totalBorderHeight;
  }

  // 여전히 유효하지 않으면 기본값 사용
  if (!tableHeight || tableHeight < minValidHeight) {
    tableHeight = PAGE.DEFAULT_TABLE_HEIGHT;
  }

  // Validation for BorderFillIDRef
  // 테이블 자체는 일반적으로 테두리 없음 스타일 사용
  // hwplib-js에서 0으로 파싱되면 기본값 사용 (레퍼런스 HWPX 기준)
  const rawID = table.borderFillIDRef ?? 0;
  const borderFillIDRef = (rawID < BORDER_FILL.MIN_ID || rawID > BORDER_FILL.MAX_ID)
    ? BORDER_FILL.DEFAULT_TABLE
    : rawID;

  // XML Generation - HWPML 2011 표준 (한컴오피스 호환)
  // Optimized with StringBuilder for O(n) string building
  const sb = new StringXmlWriter();

  // Preserve actual table attributes from HWP binary
  const repeatHeaderVal = table.repeatHeader ? '1' : '0';
  const noAdjustVal = table.noAdjust ? '1' : '0';
  const pageBreakVal = table.pageBreak || 'CELL';

  sb.append(`<hp:tbl id="${instId}" zOrder="${table.zOrder || 0}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="${pageBreakVal}" repeatHeader="${repeatHeaderVal}" rowCnt="${finalRowCount}" colCnt="${finalColCount}" cellSpacing="${table.cellSpacing || 0}" borderFillIDRef="${borderFillIDRef}" noAdjust="${noAdjustVal}">`);

  // hp:sz
  sb.append(`<hp:sz width="${tableWidth}" widthRelTo="ABSOLUTE" height="${tableHeight}" heightRelTo="ABSOLUTE" protect="0"/>`);

  // hp:pos — preserve actual position/flow properties
  const flowWithText = table.flowWithText ? '1' : '0';
  const treatAsChar = table.flowWithText ? '1' : '0';
  const vertRelTo = table.vertRelTo || 'PARA';
  const horzRelTo = table.horzRelTo || 'PARA';
  sb.append(`<hp:pos treatAsChar="${treatAsChar}" affectLSpacing="0" flowWithText="${flowWithText}" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="${vertRelTo}" horzRelTo="${horzRelTo}" vertAlign="TOP" horzAlign="LEFT" vertOffset="${table.y || 0}" horzOffset="${table.x || 0}"/>`);

  // hp:outMargin — preserve actual margins (외부 여백)
  sb.append(`<hp:outMargin left="0" right="0" top="0" bottom="0"/>`);

  // hp:inMargin — preserve actual inner margins from HWP binary
  const inML = table.inMarginLeft ?? 0;
  const inMR = table.inMarginRight ?? 0;
  const inMT = table.inMarginTop ?? 0;
  const inMB = table.inMarginBottom ?? 0;
  sb.append(`<hp:inMargin left="${inML}" right="${inMR}" top="${inMT}" bottom="${inMB}"/>`);

  // hp:caption (if exists)
  if (table.caption) {
    const captionPos = table.captionPosition || 'BOTTOM';
    const captionGap = table.captionGap || 0;
    const captionWidth = tableWidth;
    sb.append(`<hp:caption side="${captionPos}" fullSz="0" width="${captionWidth}" gap="${captionGap}" lastWidth="${captionWidth}"><hp:subList><hp:p><hp:run><hp:t>${escapeXml(table.caption)}</hp:t></hp:run></hp:p></hp:subList></hp:caption>`);
  }

  const heightScale = 1;
  const rowCount = calculatedRows.length;

  for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
    const row = calculatedRows[rowIdx];
    sb.append(`\n  <hp:tr>`);

    const cells = row.cells;
    if (cells && cells.length > 0) {
      const cellCount = cells.length;
      for (let colIdx = 0; colIdx < cellCount; colIdx++) {
        sb.append(tableCellToXml(cells[colIdx], rowIdx, colIdx, heightScale));
      }
    }
    sb.append(`</hp:tr>`);
  }

  sb.append(`\n</hp:tbl>`);
  return sb.toString();
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function tableCellToXml(cell: TableCell, defaultRowIdx: number = 0, defaultColIdx: number = 0, heightScale: number = 1): string {
  // Use correct hwplib-js properties
  const colAddr = cell.colAddr ?? defaultColIdx;
  const rowAddr = cell.rowAddr ?? defaultRowIdx;
  const colSpan = cell.colSpan || 1;
  const rowSpan = cell.rowSpan || 1;
  const width = cell.width || PAGE.DEFAULT_TABLE_HEIGHT;
  // 셀 높이에 스케일 팩터 적용
  const height = Math.round((cell.height || TABLE.DEFAULT_CELL_HEIGHT) * heightScale);

  // borderFillIDRef 처리:
  // hwplib-js에서 파싱된 원본 값을 최대한 보존
  // 유효 범위 외의 값만 기본값으로 대체
  const rawID = cell.borderFillIDRef ?? BORDER_FILL.DEFAULT_CELL;
  const borderFillIDRef = (rawID < BORDER_FILL.MIN_ID || rawID > BORDER_FILL.MAX_ID)
    ? BORDER_FILL.DEFAULT_CELL
    : rawID;

  // 셀 마진 - 파싱된 값 사용, 없으면 기본값 MARGIN.CELL_DEFAULT (레퍼런스 기준)
  const hasMargin = cell.hasMargin !== false;
  const marginLeft = cell.marginLeft ?? (hasMargin ? MARGIN.CELL_DEFAULT : 0);
  const marginRight = cell.marginRight ?? (hasMargin ? MARGIN.CELL_DEFAULT : 0);
  const marginTop = cell.marginTop ?? (hasMargin ? MARGIN.CELL_DEFAULT : 0);
  const marginBottom = cell.marginBottom ?? (hasMargin ? MARGIN.CELL_DEFAULT : 0);

  // 세로 정렬 (파싱된 값 사용, 기본값 CENTER)
  const vertAlign = cell.vertAlign || 'CENTER';

  // 텍스트 방향 (파싱된 값 사용, 기본값 HORIZONTAL)
  const textDirection = cell.textDirection || 'HORIZONTAL';

  // 줄바꿈 설정 (파싱된 값 사용, 기본값 BREAK)
  const lineWrap = cell.lineWrap || 'BREAK';

  // 보호 속성 (파싱된 값 사용)
  const protect = cell.protect ? 1 : 0;

  // 머리글 속성 (파싱된 값 사용)
  const header = cell.header ? 1 : 0;

  // 편집 가능 속성 (파싱된 값 사용)
  const editable = cell.editable ? 1 : 0;

  // 셀 내 문단의 horzsize는 셀 너비에서 마진을 뺀 값
  const contentWidth = width - marginLeft - marginRight;

  // Cell Content (Paragraphs with recursive controls)
  // Use shared generateParagraphsXml to handle text, images, tables recursively
  const paragraphs = cell.paragraphs || [];

  const contentXml = generateParagraphsXml(paragraphs, [], contentWidth);

  // Note: The order of elements in <hp:tc> must be strict for HWPX validation
  // Required order: subList -> cellAddr -> cellSpan -> cellSz -> cellMargin
  return `\n    <hp:tc name="${cell.name || ''}" header="${header}" hasMargin="${hasMargin ? 1 : 0}" protect="${protect}" editable="${editable}" dirty="0" borderFillIDRef="${borderFillIDRef}"><hp:subList id="" textDirection="${textDirection}" lineWrap="${lineWrap}" vertAlign="${vertAlign}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${contentXml}</hp:subList><hp:cellAddr colAddr="${colAddr}" rowAddr="${rowAddr}"/><hp:cellSpan colSpan="${colSpan}" rowSpan="${rowSpan}"/><hp:cellSz width="${width}" height="${height}"/><hp:cellMargin left="${marginLeft}" right="${marginRight}" top="${marginTop}" bottom="${marginBottom}"/></hp:tc>`;
}
