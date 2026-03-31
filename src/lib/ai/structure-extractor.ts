/**
 * Document Structure Extractor v3.0
 * HWPX 문서에서 편집 가능한 구조를 시맨틱 그리드 기반으로 완전 분석
 *
 * @module lib/ai/structure-extractor
 * @version 3.0.0
 * @description 시맨틱 그리드를 활용하여 복잡한 다단계 병합 표도 인간 수준으로 이해
 */

import type { HWPXDocument, HWPXSection, HWPXTable, HWPXTableCell, HWPXParagraph } from '../../types/hwpx';
import {
  buildSemanticGridsForDocument,
  getFullHeaderLabel,
  type SemanticGrid,
  type SemanticCell,
} from './table-semantics';
import { getLogger } from '../utils/logger';

const logger = getLogger();

// ─── Types ───────────────────────────────────────────────────────────────

/**
 * 헤더-내용 쌍 (v3: 시맨틱 그리드 주소 포함)
 */
export interface HeaderContentPair {
  header: string;
  content: string;
  path: {
    section: number;
    table: number;
    row: number;
    headerCell: number;
    contentCell: number;
  };
  // v3 확장
  gridAddress?: { gridRow: number; gridCol: number };
  columnHeaders?: string[];
  rowHeaders?: string[];
  contentType?: string;
}

/**
 * 컨텍스트 샘플
 */
export interface ContextSample {
  header: string;
  originalContent: string;
  contentLength: number;
  contentStyle: 'detailed' | 'brief' | 'list' | 'structured';
  hasLineBreaks: boolean;
  hasBullets: boolean;
}

/**
 * 항목 간 관계
 */
export interface ItemRelationship {
  type: 'same-row' | 'same-column' | 'sequential' | 'hierarchical'
    | 'same-column-header' | 'same-row-header' | 'sibling';
  items: string[];
  description?: string;
}

/**
 * 표 구조 분석 결과
 */
export interface TableStructure {
  totalRows: number;
  totalColumns: number;
  headerRow?: string[];
  columnHeaders: string[];
  rowHeaders: string[];
  cellSpans: Array<{
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
    content: string;
  }>;
  // v3 확장
  headerRowCount?: number;
  headerColCount?: number;
}

/**
 * 향상된 문서 구조 (v3: 시맨틱 그리드 포함)
 */
export interface EnhancedDocumentStructure {
  pairs: HeaderContentPair[];

  documentType: 'monthly' | 'weekly' | 'daily' | 'lesson' | 'report' | 'form' | 'unknown';
  title?: string;
  subtitle?: string;

  tableStructure?: TableStructure;

  contextSamples: ContextSample[];
  relationships: ItemRelationship[];

  characteristics: {
    hasTimeSequence: boolean;
    hasHierarchy: boolean;
    hasCategorization: boolean;
    hasRepetitiveStructure: boolean;
    dominantStyle: 'formal' | 'casual' | 'educational' | 'technical';
    averageContentLength: number;
  };

  generationGuide: {
    shouldMaintainContinuity: boolean;
    shouldVaryContent: boolean;
    shouldKeepConsistentLength: boolean;
    contextualHints: string[];
  };

  // v3: 시맨틱 그리드
  semanticGrids: SemanticGrid[];
  pipeline: 'legacy' | 'semantic';
}

// ─── Main Class ──────────────────────────────────────────────────────────

export class DocumentStructureExtractor {
  /**
   * 문서 구조 완전 분석 (v3: 시맨틱 그리드 기반)
   */
  extractEnhancedStructure(document: HWPXDocument): EnhancedDocumentStructure {
    logger.info('📊 문서 구조 완전 분석 시작 (v3 semantic)...');

    // 1. 시맨틱 그리드 구축
    const semanticGrids = buildSemanticGridsForDocument(document);

    // 2. 파이프라인 선택
    const pipeline = this.selectPipeline(semanticGrids);
    logger.info(`   파이프라인: ${pipeline}`);

    // 3. 헤더-내용 쌍 추출
    let pairs: HeaderContentPair[];
    if (pipeline === 'semantic' && semanticGrids.length > 0) {
      pairs = this.extractFromSemanticGrids(semanticGrids);
    } else {
      pairs = this.extractHeaderContentPairs(document);
    }

    // 4. 문서 타입 감지
    const documentType = this.detectDocumentType(document, pairs);

    // 5. 제목/부제 추출
    const title = semanticGrids[0]?.titleCell?.text || this.extractTitle(document);
    const subtitle = this.extractSubtitle(document);

    // 6. 표 구조 분석
    const tableStructure = pipeline === 'semantic' && semanticGrids[0]
      ? this.analyzeTableStructureFromGrid(semanticGrids[0])
      : this.analyzeTableStructure(document);

    // 7. 컨텍스트 샘플
    const contextSamples = this.extractContextSamples(pairs);

    // 8. 관계 분석
    const relationships = pipeline === 'semantic'
      ? this.analyzeRelationshipsFromGrid(semanticGrids, pairs)
      : this.analyzeRelationships(pairs, tableStructure);

    // 9. 특성 분석
    const characteristics = this.analyzeCharacteristics(pairs, documentType, tableStructure);

    // 10. 생성 가이드
    const generationGuide = this.generateGuide(documentType, characteristics, relationships);

    const structure: EnhancedDocumentStructure = {
      pairs,
      documentType,
      title,
      subtitle,
      tableStructure,
      contextSamples,
      relationships,
      characteristics,
      generationGuide,
      semanticGrids,
      pipeline,
    };

    logger.info(`✅ 분석 완료: ${pairs.length}개 항목, 타입=${documentType}, 파이프라인=${pipeline}`);
    if (semanticGrids.length > 0) {
      const totalData = semanticGrids.reduce((s, g) => s + g.totalDataCells, 0);
      const emptyData = semanticGrids.reduce((s, g) => s + g.emptyDataCells, 0);
      logger.info(`   시맨틱: ${semanticGrids.length}개 표, 데이터셀=${totalData}, 빈셀=${emptyData}`);
    }

    return structure;
  }

  // ─── Pipeline selection ──────────────────────────────────────────────

  private selectPipeline(grids: SemanticGrid[]): 'legacy' | 'semantic' {
    if (grids.length === 0) return 'legacy';

    // 모든 표가 단순 2열이고 병합 없으면 레거시
    const isAllSimple = grids.every(g =>
      g.cols === 2 &&
      g.dataCells.every(c => c.colSpan === 1 && c.rowSpan === 1)
    );

    return isAllSimple ? 'legacy' : 'semantic';
  }

  // ─── Semantic grid extraction ────────────────────────────────────────

  private extractFromSemanticGrids(grids: SemanticGrid[]): HeaderContentPair[] {
    const pairs: HeaderContentPair[] = [];

    for (const grid of grids) {
      for (const dc of grid.dataCells) {
        const headerLabel = getFullHeaderLabel(dc);
        pairs.push({
          header: headerLabel,
          content: dc.text,
          path: {
            section: dc.sourcePath.section,
            table: dc.sourcePath.table,
            row: dc.sourcePath.row,
            headerCell: -1, // 시맨틱 모드에서는 사용 안 함
            contentCell: dc.sourcePath.cellIndex,
          },
          gridAddress: { gridRow: dc.gridRow, gridCol: dc.gridCol },
          columnHeaders: dc.columnHeaderChain.map(h => h.text.trim()),
          rowHeaders: dc.rowHeaderChain.map(h => h.text.trim()),
          contentType: dc.contentType,
        });
      }
    }

    return pairs;
  }

  // ─── Legacy extraction (preserved) ───────────────────────────────────

  extractHeaderContentPairs(document: HWPXDocument): HeaderContentPair[] {
    const pairs: HeaderContentPair[] = [];
    document.sections.forEach((section, sectionIndex) => {
      const tablePairs = this.extractFromSection(section, sectionIndex);
      pairs.push(...tablePairs);
    });
    return pairs;
  }

  private extractFromSection(section: HWPXSection, sectionIndex: number): HeaderContentPair[] {
    const pairs: HeaderContentPair[] = [];
    section.elements.forEach((element, elementIndex) => {
      if (element.type === 'table') {
        const table = element as HWPXTable;
        const tablePairs = this.extractFromTable(table, sectionIndex, elementIndex);
        pairs.push(...tablePairs);
      }
    });
    return pairs;
  }

  private extractFromTable(table: HWPXTable, sectionIndex: number, tableIndex: number): HeaderContentPair[] {
    const pairs: HeaderContentPair[] = [];
    table.rows?.forEach((row, rowIndex) => {
      const cells = row.cells || [];
      if (cells.length >= 2) {
        for (let i = 0; i < cells.length - 1; i += 2) {
          const headerCell = cells[i];
          const contentCell = cells[i + 1];
          const header = this.extractCellText(headerCell);
          const content = this.extractCellText(contentCell);
          if (header && header.trim().length > 0) {
            pairs.push({
              header: header.trim(),
              content: content.trim(),
              path: {
                section: sectionIndex,
                table: tableIndex,
                row: rowIndex,
                headerCell: i,
                contentCell: i + 1,
              },
            });
          }
        }
      }
    });
    return pairs;
  }

  // ─── Cell text extraction ────────────────────────────────────────────

  private extractCellText(cell: HWPXTableCell): string {
    if (!cell.elements || cell.elements.length === 0) return '';
    const texts: string[] = [];
    cell.elements.forEach(elem => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        const text = para.runs?.map(run => run.text || '').join('') || '';
        if (text.trim()) texts.push(text.trim());
      }
    });
    return texts.join('\n');
  }

  // ─── Document type detection ─────────────────────────────────────────

  private detectDocumentType(
    _document: HWPXDocument,
    pairs: HeaderContentPair[]
  ): EnhancedDocumentStructure['documentType'] {
    const headers = pairs.map(p => p.header.toLowerCase());
    const allText = pairs.map(p => `${p.header} ${p.content}`).join(' ').toLowerCase();

    if (allText.includes('월간') || headers.some(h => /\d+주/.test(h))) return 'monthly';
    if (allText.includes('주간') || headers.some(h => h.includes('요일') || h.includes('월요일'))) return 'weekly';
    if (allText.includes('일일') || headers.some(h => h.includes('시간') && h.includes('분'))) return 'daily';
    if (headers.some(h => h.includes('활동') || h.includes('목표') || h.includes('준비물'))) return 'lesson';
    if (headers.some(h => h.includes('보고') || h.includes('결과') || h.includes('분석'))) return 'report';
    if (headers.some(h => h.includes('성명') || h.includes('연락처') || h.includes('주소'))) return 'form';
    return 'unknown';
  }

  // ─── Title extraction ────────────────────────────────────────────────

  private extractTitle(document: HWPXDocument): string | undefined {
    const firstSection = document.sections[0];
    if (!firstSection) return undefined;

    const firstElement = firstSection.elements[0];
    if (firstElement?.type === 'paragraph') {
      const para = firstElement as HWPXParagraph;
      const text = para.runs?.map(run => run.text || '').join('').trim();
      if (text && text.length < 100) return text;
    }

    if (firstElement?.type === 'table') {
      const table = firstElement as HWPXTable;
      const firstRow = table.rows?.[0];
      if (firstRow?.cells?.[0]) {
        const text = this.extractCellText(firstRow.cells[0]).trim();
        if (text && text.length < 100 && firstRow.cells[0].colSpan && firstRow.cells[0].colSpan > 1) {
          return text;
        }
      }
    }

    return undefined;
  }

  private extractSubtitle(document: HWPXDocument): string | undefined {
    const firstSection = document.sections[0];
    if (!firstSection || firstSection.elements.length < 2) return undefined;

    const secondElement = firstSection.elements[1];
    if (secondElement?.type === 'paragraph') {
      const para = secondElement as HWPXParagraph;
      const text = para.runs?.map(run => run.text || '').join('').trim();
      if (text && text.length < 100) return text;
    }

    return undefined;
  }

  // ─── Table structure analysis (semantic grid) ────────────────────────

  private analyzeTableStructureFromGrid(grid: SemanticGrid): TableStructure {
    const headerRow = grid.columnHeaders[0]?.map(h => h.text.trim()) || [];
    const columnHeaders: string[] = [];
    const rowHeaders: string[] = [];

    // 컬럼 헤더: 모든 레벨의 유니크 텍스트
    for (const level of grid.columnHeaders) {
      for (const h of level) {
        const t = h.text.trim();
        if (t && !columnHeaders.includes(t)) columnHeaders.push(t);
      }
    }

    // 행 헤더: 모든 레벨의 유니크 텍스트
    for (const level of grid.rowHeaders) {
      for (const h of level) {
        const t = h.text.trim();
        if (t && !rowHeaders.includes(t)) rowHeaders.push(t);
      }
    }

    // 병합 정보
    const cellSpans: TableStructure['cellSpans'] = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const sc = grid.cells[r]?.[c];
        if (sc && (sc.rowSpan > 1 || sc.colSpan > 1)) {
          cellSpans.push({
            row: r,
            col: c,
            rowSpan: sc.rowSpan,
            colSpan: sc.colSpan,
            content: sc.text.trim(),
          });
        }
      }
    }

    return {
      totalRows: grid.rows,
      totalColumns: grid.cols,
      headerRow,
      columnHeaders,
      rowHeaders,
      cellSpans,
      headerRowCount: grid.cornerRegion.rowEnd,
      headerColCount: grid.cornerRegion.colEnd,
    };
  }

  // ─── Table structure analysis (legacy) ───────────────────────────────

  private analyzeTableStructure(_document: HWPXDocument): TableStructure | undefined {
    const document = _document;
    const firstTable = document.sections[0]?.elements.find(e => e.type === 'table') as HWPXTable;
    if (!firstTable || !firstTable.rows) return undefined;

    const rows = firstTable.rows;
    const firstRow = rows[0];
    const totalColumns = firstRow?.cells?.length || 0;

    const headerRow = firstRow?.cells?.map(cell => this.extractCellText(cell).trim()) || [];

    const columnHeaders: string[] = [];
    headerRow.forEach((text) => {
      if (text && (/\d+주/.test(text) || /\d+월/.test(text) || text.includes('요일') || /[월화수목금토일]요일/.test(text))) {
        columnHeaders.push(text);
      }
    });

    const rowHeaders: string[] = [];
    rows.forEach((row, idx) => {
      if (idx > 0 && row.cells && row.cells[0]) {
        const text = this.extractCellText(row.cells[0]).trim();
        if (text && text.length < 50) rowHeaders.push(text);
      }
    });

    const cellSpans: TableStructure['cellSpans'] = [];
    rows.forEach((row, rowIdx) => {
      row.cells?.forEach((cell, colIdx) => {
        const rowSpan = cell.rowSpan || 1;
        const colSpan = cell.colSpan || 1;
        if (rowSpan > 1 || colSpan > 1) {
          cellSpans.push({
            row: rowIdx,
            col: colIdx,
            rowSpan,
            colSpan,
            content: this.extractCellText(cell).trim(),
          });
        }
      });
    });

    return { totalRows: rows.length, totalColumns, headerRow, columnHeaders, rowHeaders, cellSpans };
  }

  // ─── Context samples ─────────────────────────────────────────────────

  private extractContextSamples(pairs: HeaderContentPair[]): ContextSample[] {
    return pairs
      .filter(p => p.content.trim().length > 10)
      .slice(0, Math.min(10, Math.ceil(pairs.length * 0.3)))
      .map(p => ({
        header: p.header,
        originalContent: p.content,
        contentLength: p.content.length,
        contentStyle: this.detectContentStyle(p.content),
        hasLineBreaks: p.content.includes('\n'),
        hasBullets: /[·•◦▪]/.test(p.content) || /^\s*[-*]\s/.test(p.content),
      }));
  }

  private detectContentStyle(content: string): ContextSample['contentStyle'] {
    if (content.split('\n').length > 3 || /^\s*\d+\./.test(content)) return 'structured';
    if (content.includes('\n') || /[·•◦▪]/.test(content) || /^\s*[-*]\s/.test(content)) return 'list';
    if (content.length > 100) return 'detailed';
    return 'brief';
  }

  // ─── Relationship analysis (semantic grid) ───────────────────────────

  private analyzeRelationshipsFromGrid(
    grids: SemanticGrid[],
    pairs: HeaderContentPair[]
  ): ItemRelationship[] {
    const relationships: ItemRelationship[] = [];

    for (const grid of grids) {
      // 1. 같은 컬럼 헤더를 공유하는 데이터 셀들
      const colHeaderGroups = new Map<string, SemanticCell[]>();
      for (const dc of grid.dataCells) {
        if (dc.columnHeaderChain.length > 0) {
          const topHeader = dc.columnHeaderChain[0].text.trim();
          if (!colHeaderGroups.has(topHeader)) colHeaderGroups.set(topHeader, []);
          colHeaderGroups.get(topHeader)!.push(dc);
        }
      }

      for (const [header, cells] of colHeaderGroups) {
        if (cells.length > 1) {
          relationships.push({
            type: 'same-column-header',
            items: cells.slice(0, 5).map(c => getFullHeaderLabel(c)),
            description: `"${header}" 열에 속하는 항목들 — 유사한 스타일과 내용 유형 필요`,
          });
        }
      }

      // 2. 같은 행 헤더를 공유하는 데이터 셀들
      const rowHeaderGroups = new Map<string, SemanticCell[]>();
      for (const dc of grid.dataCells) {
        if (dc.rowHeaderChain.length > 0) {
          const topHeader = dc.rowHeaderChain[0].text.trim();
          if (!rowHeaderGroups.has(topHeader)) rowHeaderGroups.set(topHeader, []);
          rowHeaderGroups.get(topHeader)!.push(dc);
        }
      }

      for (const [header, cells] of rowHeaderGroups) {
        if (cells.length > 1) {
          relationships.push({
            type: 'same-row-header',
            items: cells.slice(0, 5).map(c => getFullHeaderLabel(c)),
            description: `"${header}" 행에 속하는 항목들 — 주제가 연관되어야 함`,
          });
        }
      }

      // 3. 같은 행의 인접 셀 (sibling)
      const rowGroups = new Map<number, SemanticCell[]>();
      for (const dc of grid.dataCells) {
        if (!rowGroups.has(dc.gridRow)) rowGroups.set(dc.gridRow, []);
        rowGroups.get(dc.gridRow)!.push(dc);
      }

      for (const [_row, cells] of rowGroups) {
        if (cells.length > 1) {
          relationships.push({
            type: 'sibling',
            items: cells.slice(0, 4).map(c => getFullHeaderLabel(c)),
            description: '같은 행의 형제 항목들 — 상호 참조하며 내용적으로 연결',
          });
        }
      }
    }

    // 4. 순차 패턴
    const sequential = pairs.filter((p, idx, arr) => {
      if (idx === 0) return false;
      return this.areSequential(arr[idx - 1].header, p.header);
    });

    if (sequential.length > 0) {
      relationships.push({
        type: 'sequential',
        items: sequential.map(p => p.header),
        description: '순차적으로 진행되는 단계별 내용',
      });
    }

    return relationships;
  }

  // ─── Relationship analysis (legacy) ──────────────────────────────────

  private analyzeRelationships(
    pairs: HeaderContentPair[],
    _tableStructure?: TableStructure
  ): ItemRelationship[] {
    const relationships: ItemRelationship[] = [];

    const rowGroups = new Map<number, HeaderContentPair[]>();
    pairs.forEach(p => {
      const key = p.path.row;
      if (!rowGroups.has(key)) rowGroups.set(key, []);
      rowGroups.get(key)!.push(p);
    });

    rowGroups.forEach((group) => {
      if (group.length > 1) {
        const headers = group.map(p => p.header);
        let description = '동일한 주제/활동에 대한 시간대별 또는 단계별 내용';
        if (headers.some(h => /\d+주/.test(h))) {
          description = '동일한 활동에 대한 주차별 진행 내용 (연속성 필요)';
        }
        relationships.push({ type: 'same-row', items: headers, description });
      }
    });

    const colGroups = new Map<number, HeaderContentPair[]>();
    pairs.forEach(p => {
      const key = p.path.contentCell;
      if (!colGroups.has(key)) colGroups.set(key, []);
      colGroups.get(key)!.push(p);
    });

    colGroups.forEach((group) => {
      if (group.length > 2) {
        relationships.push({
          type: 'same-column',
          items: group.map(p => p.header),
          description: '동일한 시간대/주차에 속하는 다양한 활동들',
        });
      }
    });

    const sequential = pairs.filter((p, idx, arr) => {
      if (idx === 0) return false;
      return this.areSequential(arr[idx - 1].header, p.header);
    });

    if (sequential.length > 0) {
      relationships.push({
        type: 'sequential',
        items: sequential.map(p => p.header),
        description: '순차적으로 진행되는 단계별 내용',
      });
    }

    const hierarchical: string[][] = [];
    pairs.forEach((p, idx) => {
      const nextPairs = pairs.slice(idx + 1, idx + 4);
      const children = nextPairs.filter(next => this.isChildOf(p.header, next.header));
      if (children.length > 0) {
        hierarchical.push([p.header, ...children.map(c => c.header)]);
      }
    });

    hierarchical.forEach(group => {
      if (group.length > 1) {
        relationships.push({
          type: 'hierarchical',
          items: group,
          description: `"${group[0]}"의 하위 세부 항목들`,
        });
      }
    });

    return relationships;
  }

  private areSequential(header1: string, header2: string): boolean {
    const num1 = header1.match(/(\d+)/);
    const num2 = header2.match(/(\d+)/);
    if (num1 && num2) return parseInt(num2[1]) === parseInt(num1[1]) + 1;

    const koreanOrder = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
    const idx1 = koreanOrder.indexOf(header1);
    const idx2 = koreanOrder.indexOf(header2);
    if (idx1 >= 0 && idx2 >= 0) return idx2 === idx1 + 1;

    return false;
  }

  private isChildOf(parent: string, child: string): boolean {
    if (child.startsWith('  ') || child.startsWith('\t')) return true;
    if (child.match(/^\s*[-•◦]\s/) && !parent.match(/^\s*[-•◦]\s/)) return true;
    if (child.match(/^\s*\d+\.\d+/) && parent.match(/^\s*\d+\./)) return true;
    return false;
  }

  // ─── Characteristics analysis ────────────────────────────────────────

  private analyzeCharacteristics(
    pairs: HeaderContentPair[],
    documentType: EnhancedDocumentStructure['documentType'],
    tableStructure?: TableStructure
  ): EnhancedDocumentStructure['characteristics'] {
    const hasTimeSequence =
      tableStructure?.columnHeaders.some(h => /\d+주/.test(h) || /\d+월/.test(h)) ||
      pairs.some(p => /\d+주/.test(p.header) || /\d+차시/.test(p.header));

    const hasHierarchy = pairs.some(p =>
      p.header.match(/^\s*\d+\.\d+/) ||
      p.header.includes('세부') ||
      p.header.includes('하위') ||
      (p.columnHeaders && p.columnHeaders.length > 1)
    );

    const hasCategorization =
      !!(tableStructure?.rowHeaders && tableStructure.rowHeaders.length > 3);

    const hasRepetitiveStructure =
      !!(tableStructure && tableStructure.totalColumns > 2 && tableStructure.columnHeaders.length > 0);

    const dominantStyle = this.detectDominantStyle(documentType, pairs);

    const contentLengths = pairs
      .filter(p => p.content.trim().length > 0)
      .map(p => p.content.length);
    const averageContentLength = contentLengths.length > 0
      ? Math.round(contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length)
      : 0;

    return {
      hasTimeSequence,
      hasHierarchy,
      hasCategorization,
      hasRepetitiveStructure,
      dominantStyle,
      averageContentLength,
    };
  }

  private detectDominantStyle(
    documentType: EnhancedDocumentStructure['documentType'],
    pairs: HeaderContentPair[]
  ): EnhancedDocumentStructure['characteristics']['dominantStyle'] {
    const allContent = pairs.map(p => p.content).join(' ');

    if (documentType === 'lesson' || documentType === 'monthly' || documentType === 'weekly') return 'educational';
    if (allContent.match(/API|코드|시스템|알고리즘|데이터/)) return 'technical';
    if (allContent.match(/합니다|됩니다|입니다/)) return 'formal';
    return 'casual';
  }

  // ─── Generation guide ────────────────────────────────────────────────

  private generateGuide(
    documentType: EnhancedDocumentStructure['documentType'],
    characteristics: EnhancedDocumentStructure['characteristics'],
    relationships: ItemRelationship[]
  ): EnhancedDocumentStructure['generationGuide'] {
    const guide: EnhancedDocumentStructure['generationGuide'] = {
      shouldMaintainContinuity: false,
      shouldVaryContent: false,
      shouldKeepConsistentLength: true,
      contextualHints: [],
    };

    if (characteristics.hasTimeSequence || relationships.some(r => r.type === 'same-row' || r.type === 'sibling')) {
      guide.shouldMaintainContinuity = true;
      guide.contextualHints.push('같은 행의 항목들은 시간순으로 발전하는 내용이어야 합니다');
    }

    if (characteristics.hasRepetitiveStructure) {
      guide.shouldVaryContent = true;
      guide.contextualHints.push('각 주차/시간대별로 내용이 달라야 하지만 주제는 연관되어야 합니다');
    }

    if (characteristics.averageContentLength > 50) {
      guide.contextualHints.push(`각 항목은 약 ${characteristics.averageContentLength}자 정도의 상세한 설명이 필요합니다`);
    } else {
      guide.contextualHints.push('간결하고 핵심적인 내용으로 작성하세요');
    }

    switch (documentType) {
      case 'monthly':
        guide.contextualHints.push('월간계획안이므로 각 주차별로 점진적으로 심화되는 내용이 필요합니다');
        break;
      case 'weekly':
        guide.contextualHints.push('주간계획안이므로 요일별로 연계성 있는 활동이 배치되어야 합니다');
        break;
      case 'lesson':
        guide.contextualHints.push('수업계획안이므로 목표-활동-평가가 일관성 있게 연결되어야 합니다');
        break;
    }

    if (characteristics.dominantStyle === 'educational') {
      guide.contextualHints.push('교육적이고 발달단계에 적합한 내용으로 작성하세요');
    }

    // 시맨틱 그리드 관련 힌트
    if (relationships.some(r => r.type === 'same-column-header')) {
      guide.contextualHints.push('같은 열의 항목들은 유사한 스타일과 형식으로 작성하세요');
    }
    if (relationships.some(r => r.type === 'same-row-header')) {
      guide.contextualHints.push('같은 행 헤더를 공유하는 항목들은 주제가 연관되어야 합니다');
    }

    return guide;
  }
}

export default DocumentStructureExtractor;
