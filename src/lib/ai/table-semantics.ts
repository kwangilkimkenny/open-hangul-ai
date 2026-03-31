/**
 * Table Semantics Engine
 * HWPX 표의 시맨틱 그리드를 구축하여 인간 수준의 표 이해를 달성
 *
 * @module lib/ai/table-semantics
 * @version 1.0.0
 * @reference SpreadsheetLLM (EMNLP 2024), Chain-of-Table (ICLR 2024)
 * @description 파서의 gridMap을 활용해 헤더/데이터 셀 분류, 헤더 체인, 내용 타입 추론
 */

import type {
  HWPXDocument,
  HWPXTable,
  HWPXTableCell,
  HWPXTableRow,
  HWPXParagraph,
} from '../../types/hwpx';
import { getLogger } from '../utils/logger';

const logger = getLogger();

// ─── Types ───────────────────────────────────────────────────────────────

/** 셀 역할 */
export type CellRole =
  | 'corner-header'
  | 'column-header'
  | 'row-header'
  | 'data'
  | 'title'
  | 'empty';

/** 내용 타입 */
export type ContentType = 'text' | 'date' | 'number' | 'name' | 'list' | 'unknown';

/** 시맨틱 셀 */
export interface SemanticCell {
  // 논리 그리드 위치
  gridRow: number;
  gridCol: number;
  rowSpan: number;
  colSpan: number;

  // 내용
  text: string;
  isEmpty: boolean;

  // 시맨틱 분류
  role: CellRole;
  headerLevel: number; // 0 = leaf, 1+ = parent header

  // 의존 헤더 체인 (데이터 셀용)
  columnHeaderChain: SemanticCell[];
  rowHeaderChain: SemanticCell[];

  // 원본 참조 (merge-back용)
  sourcePath: {
    section: number;
    table: number;
    row: number;
    cellIndex: number;
  };

  // 내용 타입 추론
  contentType: ContentType;
}

/** 코너 영역 범위 */
export interface CornerRegion {
  rowEnd: number; // column header가 차지하는 행 수
  colEnd: number; // row header가 차지하는 열 수
}

/** 시맨틱 그리드 */
export interface SemanticGrid {
  rows: number;
  cols: number;
  cells: (SemanticCell | null)[][]; // null = covered 위치

  // 분류된 영역
  cornerRegion: CornerRegion;
  columnHeaders: SemanticCell[][]; // [level][index] — 행 단위 레벨
  rowHeaders: SemanticCell[][];    // [level][index] — 열 단위 레벨
  dataCells: SemanticCell[];
  titleCell?: SemanticCell;

  // 메타데이터
  tableIndex: number;
  sectionIndex: number;
  totalDataCells: number;
  emptyDataCells: number;
}

// ─── Runtime parser types (not in hwpx.d.ts) ─────────────────────────────

interface RuntimeCell extends HWPXTableCell {
  logicalRow?: number;
  logicalCol?: number;
  isCovered?: boolean;
  widthHWPU?: number;
  heightHWPU?: number;
}

interface RuntimeTable extends HWPXTable {
  gridMap?: (RuntimeCell | 'covered' | null)[][];
  colCount?: number;
  rowCount?: number;
}

// ─── Helper: extract cell text ───────────────────────────────────────────

function extractCellText(cell: HWPXTableCell): string {
  if (!cell.elements || cell.elements.length === 0) return '';
  const texts: string[] = [];
  for (const elem of cell.elements) {
    if (elem.type === 'paragraph') {
      const para = elem as HWPXParagraph;
      const text = para.runs?.map(r => r.text || '').join('') || '';
      if (text.trim()) texts.push(text.trim());
    }
  }
  return texts.join('\n');
}

// ─── Content type inference ──────────────────────────────────────────────

const DATE_PATTERN = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[/.-]\d{1,2}$|^\d{1,2}월\s*\d{1,2}일$/;
const NUMBER_PATTERN = /^[₩$€]?\s*[\d,]+(\.\d+)?(%|원|명|개|건)?$/;
const NAME_PATTERN = /^[가-힣]{2,4}$/;
const LIST_PATTERN = /[\n·•◦▪]|^\s*[-*]\s/m;

function inferContentType(text: string): ContentType {
  if (!text.trim()) return 'unknown';
  if (DATE_PATTERN.test(text.trim())) return 'date';
  if (NUMBER_PATTERN.test(text.trim())) return 'number';
  if (NAME_PATTERN.test(text.trim())) return 'name';
  if (LIST_PATTERN.test(text)) return 'list';
  return 'text';
}

// ─── Header detection heuristics ─────────────────────────────────────────

/** 한국어 헤더 키워드 — 공문서/교육문서에서 자주 나타나는 열/행 헤더 */
const HEADER_KEYWORDS = /^(구분|항목|종류|분류|내용|기간|일자|날짜|성명|이름|직위|비고|소계|합계|총계|번호|순번|주제|영역|목표|활동|준비물|평가|시간|교시|단원|차시|학습|주차|요일|기업명|주\s*소|전화번호|이메일|부서|직급|홈페이지|사업자등록번호|월|검증방법|수행기간|수행역할|참여기간|프로젝트명|과제명|성과지표명|지표\s*정의|목표치|용역명|발주기관)$/;

/** 데이터성 셀 패턴 — 이런 내용은 헤더가 아님 */
const DATA_VALUE_PATTERNS = /^(\d+[%명개건원]?|[VXO✓✗∨×]|면제|해당\s*없음|-|\(.+\)|[₩$€]\s*[\d,].*)$/;

/** 셀이 헤더처럼 보이는지 판단하는 점수 (0~1) */
function headerScore(cell: HWPXTableCell, text: string): number {
  const trimmed = text.trim();
  const len = trimmed.length;

  // 빈 셀은 헤더 아님
  if (len === 0) return 0;

  // 데이터 값 패턴이면 강하게 헤더 아님
  if (DATA_VALUE_PATTERNS.test(trimmed)) return 0;

  // 숫자만 있으면 데이터
  if (/^\d+$/.test(trimmed)) return 0;

  let score = 0;

  // 짧은 텍스트 → 헤더 가능성 높음
  if (len <= 15) score += 0.25;
  else if (len <= 30) score += 0.1;
  else if (len > 50) score -= 0.3; // 긴 텍스트는 강하게 데이터

  // 한국어 헤더 키워드 — 강한 시그널
  if (HEADER_KEYWORDS.test(trimmed)) {
    score += 0.5;
  }

  // 번호 접두사 + 짧은 레이블 (예: "1) 지원 분야", "8.사업내용")
  if (/^\d+[\)\.\s]/.test(trimmed) && len <= 30) {
    score += 0.3;
  }

  // 배경색이 있으면 헤더일 가능성
  if (cell.backgroundColor && cell.backgroundColor !== '#ffffff' && cell.backgroundColor !== 'transparent') {
    score += 0.2;
  }

  // rowSpan > 1인 셀은 행 헤더일 가능성 높음
  if ((cell.rowSpan || 1) > 1) score += 0.15;

  // 가운데 정렬이면 헤더 가능성
  if (cell.textAlign === 'center') score += 0.1;

  return Math.min(1, Math.max(0, score));
}

// ─── Core: buildSemanticGrid ─────────────────────────────────────────────

/**
 * HWPXTable → SemanticGrid 변환
 * 파서의 gridMap을 활용하여 5단계 알고리즘으로 시맨틱 그리드 구축
 */
export function buildSemanticGrid(
  table: HWPXTable,
  sectionIdx: number,
  tableIdx: number
): SemanticGrid | null {
  const rt = table as RuntimeTable;
  const rows = rt.rows || [];
  if (rows.length === 0) return null;

  // gridMap이 없으면 직접 구축
  const gridMap = rt.gridMap || buildGridMapFallback(rt);
  if (!gridMap || gridMap.length === 0) return null;

  const numRows = gridMap.length;
  const numCols = gridMap[0]?.length || 0;
  if (numRows === 0 || numCols === 0) return null;

  // ═══════════════════════════════════════════════════════════════════
  // Step 1: 논리 그리드에서 SemanticCell 생성
  // ═══════════════════════════════════════════════════════════════════

  const semanticGrid: (SemanticCell | null)[][] = Array.from(
    { length: numRows },
    () => new Array(numCols).fill(null)
  );

  // gridMap에서 실제 셀 위치에만 SemanticCell 생성 (covered 위치는 null)
  const allCells: SemanticCell[] = [];

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const mapEntry = gridMap[r]?.[c];
      if (!mapEntry || mapEntry === 'covered') continue;

      // 이미 처리된 셀인지 확인 (같은 셀이 span으로 여러 위치에 있을 수 있음)
      if (semanticGrid[r][c] !== null) continue;

      const cell = mapEntry as RuntimeCell;
      const text = extractCellText(cell);
      const rs = cell.rowSpan || 1;
      const cs = cell.colSpan || 1;

      // 원본 행/셀 인덱스 찾기
      const sourcePath = findSourcePath(rows, cell, sectionIdx, tableIdx);

      const sc: SemanticCell = {
        gridRow: r,
        gridCol: c,
        rowSpan: rs,
        colSpan: cs,
        text,
        isEmpty: text.trim().length === 0,
        role: 'data', // 초기값, Step 3에서 분류
        headerLevel: 0,
        columnHeaderChain: [],
        rowHeaderChain: [],
        sourcePath,
        contentType: inferContentType(text),
      };

      // 셀의 점유 영역에 참조 설정 (첫 위치만 실제 셀, 나머지는 null 유지)
      semanticGrid[r][c] = sc;
      allCells.push(sc);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 2: 코너 영역 감지
  // ═══════════════════════════════════════════════════════════════════

  const corner = detectCornerRegion(semanticGrid, gridMap, numRows, numCols);

  // ═══════════════════════════════════════════════════════════════════
  // Step 3: 셀 역할 분류
  // ═══════════════════════════════════════════════════════════════════

  const titleCell = detectTitleCell(semanticGrid, numCols);
  const columnHeaders: SemanticCell[][] = [];
  const rowHeaders: SemanticCell[][] = [];
  const dataCells: SemanticCell[] = [];

  for (const sc of allCells) {
    const { gridRow, gridCol } = sc;

    // 타이틀 셀 (첫 행이 전체 병합)
    if (titleCell && sc === titleCell) {
      sc.role = 'title';
      continue;
    }

    const titleOffset = titleCell ? 1 : 0;
    const effectiveRow = gridRow - titleOffset;

    if (effectiveRow < 0) continue;

    if (effectiveRow < corner.rowEnd && gridCol < corner.colEnd) {
      // 코너 영역
      sc.role = 'corner-header';
    } else if (effectiveRow < corner.rowEnd && gridCol >= corner.colEnd) {
      // 컬럼 헤더 영역
      sc.role = 'column-header';
      const level = effectiveRow;
      while (columnHeaders.length <= level) columnHeaders.push([]);
      columnHeaders[level].push(sc);
      sc.headerLevel = corner.rowEnd - effectiveRow;
    } else if (effectiveRow >= corner.rowEnd && gridCol < corner.colEnd) {
      // 행 헤더 영역
      sc.role = 'row-header';
      const level = gridCol;
      while (rowHeaders.length <= level) rowHeaders.push([]);
      rowHeaders[level].push(sc);
      sc.headerLevel = corner.colEnd - gridCol;
    } else {
      // 데이터 영역
      sc.role = 'data';
      dataCells.push(sc);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 4: 헤더 체인 구축
  // ═══════════════════════════════════════════════════════════════════

  const titleOffset = titleCell ? 1 : 0;

  for (const dc of dataCells) {
    // columnHeaderChain: 해당 열의 위쪽 헤더들 (상위 → 하위 순)
    dc.columnHeaderChain = buildColumnHeaderChain(
      semanticGrid, gridMap, dc.gridCol, corner, titleOffset, numRows
    );

    // rowHeaderChain: 해당 행의 왼쪽 헤더들 (상위 → 하위 순)
    dc.rowHeaderChain = buildRowHeaderChain(
      semanticGrid, gridMap, dc.gridRow, corner, numCols
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 5: 내용 타입 보정 (열 단위 일관성)
  // ═══════════════════════════════════════════════════════════════════

  refineContentTypes(dataCells, numCols);

  // ═══════════════════════════════════════════════════════════════════
  // 결과 조립
  // ═══════════════════════════════════════════════════════════════════

  const emptyDataCells = dataCells.filter(c => c.isEmpty).length;

  const grid: SemanticGrid = {
    rows: numRows,
    cols: numCols,
    cells: semanticGrid,
    cornerRegion: corner,
    columnHeaders,
    rowHeaders,
    dataCells,
    titleCell: titleCell || undefined,
    tableIndex: tableIdx,
    sectionIndex: sectionIdx,
    totalDataCells: dataCells.length,
    emptyDataCells,
  };

  logger.info(`📊 SemanticGrid 구축: ${numRows}×${numCols}, 코너=${corner.rowEnd}×${corner.colEnd}, 데이터셀=${dataCells.length} (빈셀=${emptyDataCells})`);

  return grid;
}

// ─── Step 2 helper: corner region detection ──────────────────────────────

function detectCornerRegion(
  semanticGrid: (SemanticCell | null)[][],
  gridMap: (RuntimeCell | 'covered' | null)[][],
  numRows: number,
  numCols: number,
): CornerRegion {
  // 1행/1열 표는 헤더 영역 없음
  if (numRows <= 1) return { rowEnd: 0, colEnd: 0 };
  if (numCols <= 1) return { rowEnd: 0, colEnd: 0 };

  // 타이틀 행 감지 (첫 행이 전체 병합이면 건너뜀)
  let startRow = 0;
  const firstCell = semanticGrid[0]?.[0];
  if (firstCell && firstCell.colSpan >= numCols * 0.8) {
    startRow = 1;
  }

  // ─── 컬럼 헤더 행 수 결정 ───
  let headerRowEnd = 0;

  for (let r = startRow; r < Math.min(numRows, startRow + 3); r++) {
    let headerish = 0;
    let total = 0;

    for (let c = 0; c < numCols; c++) {
      const mapEntry = gridMap[r]?.[c];
      if (!mapEntry || mapEntry === 'covered') continue;

      const cell = mapEntry as RuntimeCell;
      const text = extractCellText(cell);
      total++;

      if (headerScore(cell, text) >= 0.4) {
        headerish++;
      }
    }

    // 행의 60% 이상이 헤더스러워야 헤더 행 인정 (기존 50%에서 상향)
    if (total > 0 && headerish / total >= 0.6) {
      headerRowEnd = r - startRow + 1;
    } else {
      break;
    }
  }

  // 첫 행이 헤더가 아니면 기본 1행 헤더로 설정 (대부분의 표에는 헤더 행이 있음)
  // 단, 첫 행 자체가 데이터성이 강하면 0으로 유지
  if (headerRowEnd === 0 && numRows >= 3) {
    // 첫 행의 텍스트가 모두 짧고 (<=20자) 내용이 있으면 헤더 행으로 추정
    let shortCount = 0;
    let totalFirst = 0;
    for (let c = 0; c < numCols; c++) {
      const mapEntry = gridMap[startRow]?.[c];
      if (!mapEntry || mapEntry === 'covered') continue;
      const text = extractCellText(mapEntry as RuntimeCell).trim();
      totalFirst++;
      if (text.length > 0 && text.length <= 20) shortCount++;
    }
    if (totalFirst > 0 && shortCount / totalFirst >= 0.7) {
      headerRowEnd = 1;
    }
  }

  // ─── 행 헤더 열 수 결정 ───
  let headerColEnd = 0;

  // 데이터 영역 (headerRowEnd 이후)에서 왼쪽 열이 헤더인지 판단
  for (let c = 0; c < Math.min(numCols - 1, 3); c++) { // numCols-1: 마지막 열은 헤더 불가
    let headerish = 0;
    let total = 0;

    for (let r = startRow + headerRowEnd; r < numRows; r++) {
      const mapEntry = gridMap[r]?.[c];
      if (!mapEntry || mapEntry === 'covered') continue;

      const cell = mapEntry as RuntimeCell;
      const text = extractCellText(cell);
      total++;

      if (headerScore(cell, text) >= 0.35) {
        headerish++;
      }
    }

    // 열의 50% 이상이 헤더스러워야 행 헤더 열 인정 (기존 40%에서 상향)
    if (total > 0 && headerish / total >= 0.5) {
      headerColEnd = c + 1;
    } else {
      break;
    }
  }

  // ─── 안전장치 ───

  // 1) headerRowEnd가 전체 행의 절반 이상이면 1행으로 제한
  if (headerRowEnd > 0 && headerRowEnd >= Math.ceil(numRows * 0.5)) {
    headerRowEnd = 1;
  }

  // 2) headerColEnd가 전체 열과 같거나 전체의 절반 이상이면 제한
  if (headerColEnd >= numCols) {
    headerColEnd = Math.max(1, Math.floor(numCols * 0.4));
  }
  if (headerColEnd > 0 && headerColEnd >= Math.ceil(numCols * 0.6)) {
    headerColEnd = Math.max(1, Math.floor(numCols * 0.4));
  }

  // 3) 코너가 전체 셀의 50% 이상을 차지하면 축소
  const cornerArea = headerRowEnd * headerColEnd;
  const totalArea = numRows * numCols;
  if (cornerArea > 0 && cornerArea >= totalArea * 0.5) {
    // 행 헤더가 더 큰 원인이면 열을 줄이고, 반대면 행을 줄임
    if (headerColEnd > headerRowEnd) {
      headerColEnd = Math.max(1, Math.floor(numCols * 0.3));
    } else {
      headerRowEnd = Math.max(1, Math.floor(numRows * 0.3));
    }
  }

  // 4) 결과가 데이터 셀을 최소 1개 이상 남기는지 확인
  const dataRows = numRows - startRow - headerRowEnd;
  const dataCols = numCols - headerColEnd;
  if (dataRows <= 0 || dataCols <= 0) {
    // 데이터 영역이 없으면 최소화
    if (dataRows <= 0) headerRowEnd = Math.max(0, numRows - startRow - 1);
    if (dataCols <= 0) headerColEnd = Math.max(0, numCols - 1);
  }

  return { rowEnd: headerRowEnd, colEnd: headerColEnd };
}

// ─── Title cell detection ────────────────────────────────────────────────

function detectTitleCell(
  semanticGrid: (SemanticCell | null)[][],
  numCols: number,
): SemanticCell | null {
  const firstCell = semanticGrid[0]?.[0];
  if (firstCell && firstCell.colSpan >= numCols * 0.8 && !firstCell.isEmpty) {
    return firstCell;
  }
  return null;
}

// ─── Step 4 helpers: header chain builders ───────────────────────────────

/** 셀 텍스트가 헤더 라벨로 적합한지 확인 (데이터값 필터링) */
function isValidHeaderLabel(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return false;
  // 순수 데이터값 패턴 제외
  if (DATA_VALUE_PATTERNS.test(t)) return false;
  // 순수 숫자 제외
  if (/^\d+$/.test(t)) return false;
  // 단일 특수문자 제외
  if (/^[VXO✓✗∨×]$/.test(t)) return false;
  return true;
}

function buildColumnHeaderChain(
  semanticGrid: (SemanticCell | null)[][],
  gridMap: (RuntimeCell | 'covered' | null)[][],
  col: number,
  corner: CornerRegion,
  titleOffset: number,
  _numRows: number,
): SemanticCell[] {
  const chain: SemanticCell[] = [];

  for (let r = titleOffset; r < titleOffset + corner.rowEnd; r++) {
    const sc = findOwnerCell(semanticGrid, gridMap, r, col);
    if (sc && sc.role === 'column-header' && !chain.includes(sc)) {
      // 데이터값이 아닌 유효한 헤더 라벨만 체인에 포함
      if (isValidHeaderLabel(sc.text)) {
        chain.push(sc);
      }
    }
  }

  return chain;
}

function buildRowHeaderChain(
  semanticGrid: (SemanticCell | null)[][],
  gridMap: (RuntimeCell | 'covered' | null)[][],
  row: number,
  corner: CornerRegion,
  _numCols: number,
): SemanticCell[] {
  const chain: SemanticCell[] = [];

  for (let c = 0; c < corner.colEnd; c++) {
    const sc = findOwnerCell(semanticGrid, gridMap, row, c);
    if (sc && sc.role === 'row-header' && !chain.includes(sc)) {
      if (isValidHeaderLabel(sc.text)) {
        chain.push(sc);
      }
    }
  }

  return chain;
}

/**
 * gridMap에서 (r, c) 위치를 실제로 점유하는 SemanticCell 찾기
 * gridMap을 직접 활용 — 위쪽 탐색 후 왼쪽 탐색
 */
function findOwnerCell(
  semanticGrid: (SemanticCell | null)[][],
  gridMap: (RuntimeCell | 'covered' | null)[][],
  row: number,
  col: number,
): SemanticCell | null {
  // 직접 위치에 SemanticCell이 있으면 반환
  if (semanticGrid[row]?.[col]) {
    return semanticGrid[row][col];
  }

  // 위쪽으로 탐색 (rowSpan에 의한 covered)
  for (let r = row; r >= 0; r--) {
    const entry = gridMap[r]?.[col];
    if (entry && entry !== 'covered') {
      const rc = entry as RuntimeCell;
      const lr = rc.logicalRow ?? r;
      const lc = rc.logicalCol ?? col;
      if (lr + (rc.rowSpan || 1) > row && lc + (rc.colSpan || 1) > col) {
        return semanticGrid[lr]?.[lc] || null;
      }
    }
  }

  // 왼쪽으로 탐색 (colSpan에 의한 covered)
  for (let c = col; c >= 0; c--) {
    const entry = gridMap[row]?.[c];
    if (entry && entry !== 'covered') {
      const rc = entry as RuntimeCell;
      const lr = rc.logicalRow ?? row;
      const lc = rc.logicalCol ?? c;
      if (lr + (rc.rowSpan || 1) > row && lc + (rc.colSpan || 1) > col) {
        return semanticGrid[lr]?.[lc] || null;
      }
    }
  }

  // 대각선 탐색 (rowSpan + colSpan 동시 커버)
  for (let r = row - 1; r >= 0; r--) {
    for (let c = col - 1; c >= 0; c--) {
      const sc = semanticGrid[r]?.[c];
      if (sc && r + sc.rowSpan > row && c + sc.colSpan > col) {
        return sc;
      }
    }
  }

  return null;
}

// ─── Step 5 helper: content type refinement ──────────────────────────────

function refineContentTypes(dataCells: SemanticCell[], _numCols: number): void {
  // 열별로 그룹핑
  const colGroups = new Map<number, SemanticCell[]>();
  for (const dc of dataCells) {
    if (!colGroups.has(dc.gridCol)) colGroups.set(dc.gridCol, []);
    colGroups.get(dc.gridCol)!.push(dc);
  }

  // 열별로 다수결 타입 적용
  for (const [_col, cells] of colGroups) {
    const nonEmpty = cells.filter(c => !c.isEmpty);
    if (nonEmpty.length < 2) continue;

    const typeCounts = new Map<ContentType, number>();
    for (const c of nonEmpty) {
      typeCounts.set(c.contentType, (typeCounts.get(c.contentType) || 0) + 1);
    }

    // 60% 이상이 같은 타입이면 열 전체에 적용
    for (const [type, count] of typeCounts) {
      if (count / nonEmpty.length >= 0.6 && type !== 'text' && type !== 'unknown') {
        for (const c of cells) {
          if (c.isEmpty) c.contentType = type;
        }
      }
    }
  }
}

// ─── Source path finder ──────────────────────────────────────────────────

function findSourcePath(
  rows: HWPXTableRow[],
  targetCell: RuntimeCell,
  sectionIdx: number,
  tableIdx: number,
): SemanticCell['sourcePath'] {
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].cells || [];
    for (let c = 0; c < cells.length; c++) {
      if (cells[c] === targetCell) {
        return { section: sectionIdx, table: tableIdx, row: r, cellIndex: c };
      }
    }
  }
  // 못 찾으면 logicalRow/logicalCol 기반 fallback
  return {
    section: sectionIdx,
    table: tableIdx,
    row: targetCell.logicalRow ?? 0,
    cellIndex: targetCell.logicalCol ?? 0,
  };
}

// ─── Fallback gridMap builder ────────────────────────────────────────────

function buildGridMapFallback(table: RuntimeTable): (RuntimeCell | 'covered' | null)[][] {
  const rows = table.rows || [];
  if (rows.length === 0) return [];

  const maxCols = table.colCount || Math.max(...rows.map(r => (r.cells || []).length), 1);
  const maxRows = rows.length;
  const grid: (RuntimeCell | 'covered' | null)[][] = Array.from(
    { length: maxRows },
    () => new Array(maxCols).fill(null)
  );

  rows.forEach((row, rowIdx) => {
    let colPos = 0;
    (row.cells || []).forEach(cell => {
      while (colPos < maxCols && grid[rowIdx][colPos] !== null && grid[rowIdx][colPos] !== undefined) {
        colPos++;
      }
      if (colPos >= maxCols) return;

      const rc = cell as RuntimeCell;
      const rs = rc.rowSpan || 1;
      const cs = rc.colSpan || 1;
      rc.logicalRow = rowIdx;
      rc.logicalCol = colPos;

      for (let r = 0; r < rs && (rowIdx + r) < maxRows; r++) {
        for (let c = 0; c < cs && (colPos + c) < maxCols; c++) {
          grid[rowIdx + r][colPos + c] = (r === 0 && c === 0) ? rc : 'covered';
        }
      }
      colPos += cs;
    });
  });

  return grid;
}

// ─── Document-level grid builder ─────────────────────────────────────────

/**
 * 문서의 모든 표에 대해 SemanticGrid 생성
 */
export function buildSemanticGridsForDocument(doc: HWPXDocument): SemanticGrid[] {
  const grids: SemanticGrid[] = [];

  doc.sections.forEach((section, sIdx) => {
    let tableCount = 0;
    section.elements.forEach((elem) => {
      if (elem.type === 'table') {
        const grid = buildSemanticGrid(elem as HWPXTable, sIdx, tableCount);
        if (grid) grids.push(grid);
        tableCount++;
      }
    });
  });

  logger.info(`📊 문서 전체: ${grids.length}개 표 시맨틱 분석 완료`);
  return grids;
}

// ─── Utility: get full header label for a data cell ──────────────────────

/**
 * 데이터 셀의 전체 헤더 라벨 생성 (예: "신체운동·건강 > 1주 > 활동명")
 */
export function getFullHeaderLabel(cell: SemanticCell): string {
  const parts: string[] = [];
  const seen = new Set<string>();

  // 행 헤더 체인 (상위 → 하위)
  for (const rh of cell.rowHeaderChain) {
    const t = rh.text.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      parts.push(t);
    }
  }

  // 컬럼 헤더 체인 (상위 → 하위)
  for (const ch of cell.columnHeaderChain) {
    const t = ch.text.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      parts.push(t);
    }
  }

  return parts.join(' > ') || `R${cell.gridRow}C${cell.gridCol}`;
}

/**
 * 셀 주소 문자열 생성
 */
export function getCellAddress(cell: SemanticCell): string {
  return `R${cell.gridRow}C${cell.gridCol}`;
}

export default {
  buildSemanticGrid,
  buildSemanticGridsForDocument,
  getFullHeaderLabel,
  getCellAddress,
};
