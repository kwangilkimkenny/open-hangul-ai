/**
 * Template Analyzer
 * HWPX 문서의 구조를 분석하여 템플릿화 가능한 요소를 식별
 * 
 * @module lib/core/template-analyzer
 * @version 1.0.0
 */

import type {
  HWPXDocument,
  HWPXSection,
  HWPXElement,
  HWPXParagraph,
  HWPXTable,
  HWPXTableCell,
  HWPXTextStyle,
} from '../../types/hwpx';
import type {
  DocumentStructure,
  TableLayout,
  TitleCandidate,
  TitleDetectionConfig,
  CellType,
  MergedCellInfo,
} from '../../types/template';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * 기본 제목 감지 설정
 */
const DEFAULT_TITLE_CONFIG: TitleDetectionConfig = {
  minFontSize: 10,
  titleFontSizeThreshold: 14,
  boldWeight: 20,
  centerAlignWeight: 15,
  positionWeight: 10,
  lengthWeight: 10,
  maxTitleLength: 100,
  minConfidence: 50,
};

/**
 * 템플릿 분석기 클래스
 */
export class TemplateAnalyzer {
  private config: TitleDetectionConfig;

  constructor(config?: Partial<TitleDetectionConfig>) {
    this.config = { ...DEFAULT_TITLE_CONFIG, ...config };
  }

  /**
   * 문서 구조 전체 분석
   */
  analyzeDocument(doc: HWPXDocument): DocumentStructure {
    const startTime = performance.now();
    
    logger.info('📊 문서 구조 분석 시작...');

    const structure: DocumentStructure = {
      pageCount: 0,
      sectionCount: doc.sections.length,
      
      hasTables: false,
      tableCount: 0,
      tableLayouts: [],
      
      hasTitles: false,
      titleCount: 0,
      titles: [],
      
      hasImages: false,
      imageCount: 0,
      imagePositions: [],
      
      hasShapes: false,
      shapeCount: 0,
      shapePositions: [],
      
      paragraphCount: 0,
      totalTextLength: 0,
      avgParagraphLength: 0,
      
      pageSettings: [],
    };

    // 섹션별 분석
    doc.sections.forEach((section, sectionIndex) => {
      this.analyzeSection(section, sectionIndex, structure);
    });

    // 통계 계산
    structure.avgParagraphLength = structure.paragraphCount > 0
      ? structure.totalTextLength / structure.paragraphCount
      : 0;

    const elapsed = performance.now() - startTime;
    logger.info(`✅ 문서 구조 분석 완료 (${elapsed.toFixed(2)}ms)`);
    logger.debug('구조 분석 결과:', structure);

    return structure;
  }

  /**
   * 섹션 분석
   */
  private analyzeSection(
    section: HWPXSection,
    sectionIndex: number,
    structure: DocumentStructure
  ): void {
    // 페이지 설정 저장
    if (section.pageSettings) {
      structure.pageSettings.push(section.pageSettings);
      structure.pageCount++;
    }

    // 요소별 분석
    section.elements.forEach((element, elementIndex) => {
      this.analyzeElement(element, sectionIndex, elementIndex, structure);
    });
  }

  /**
   * 요소 분석
   */
  private analyzeElement(
    element: HWPXElement,
    sectionIndex: number,
    elementIndex: number,
    structure: DocumentStructure
  ): void {
    switch (element.type) {
      case 'paragraph':
        this.analyzeParagraph(
          element as HWPXParagraph,
          sectionIndex,
          elementIndex,
          structure
        );
        break;

      case 'table':
        this.analyzeTable(
          element as HWPXTable,
          sectionIndex,
          elementIndex,
          structure
        );
        break;

      case 'image':
        structure.hasImages = true;
        structure.imageCount++;
        structure.imagePositions.push({
          sectionIndex,
          elementIndex,
          type: 'image',
        });
        break;

      case 'shape':
      case 'container':
        structure.hasShapes = true;
        structure.shapeCount++;
        structure.shapePositions.push({
          sectionIndex,
          elementIndex,
          type: 'shape',
        });
        break;
    }
  }

  /**
   * 단락 분석 (제목 감지 포함)
   */
  private analyzeParagraph(
    para: HWPXParagraph,
    sectionIndex: number,
    elementIndex: number,
    structure: DocumentStructure
  ): void {
    structure.paragraphCount++;

    // 텍스트 길이 계산
    const textLength = this.getParagraphTextLength(para);
    structure.totalTextLength += textLength;

    // 제목 감지
    const titleCandidate = this.detectTitle(para, sectionIndex, elementIndex);
    if (titleCandidate && titleCandidate.confidence >= this.config.minConfidence) {
      structure.hasTitles = true;
      structure.titleCount++;
      structure.titles.push(titleCandidate);
    }
  }

  /**
   * 표 분석
   */
  private analyzeTable(
    table: HWPXTable,
    sectionIndex: number,
    elementIndex: number,
    structure: DocumentStructure
  ): void {
    structure.hasTables = true;
    structure.tableCount++;

    const layout: TableLayout = {
      sectionIndex,
      elementIndex,
      rowCount: table.rows?.length || 0,
      colCount: this.getColumnCount(table),
      cellCount: this.getCellCount(table),
      hasHeaders: false,
      headerRowCount: 0,
      headerColCount: 0,
      cellTypes: [],
      mergedCells: [],
      hasBorders: this.tableHasBorders(table),
      hasBackgroundColors: this.tableHasBackgroundColors(table),
    };

    // 헤더 감지
    const headerInfo = this.detectTableHeaders(table);
    layout.hasHeaders = headerInfo.hasHeaders;
    layout.headerRowCount = headerInfo.rowCount;
    layout.headerColCount = headerInfo.colCount;

    // 셀 타입 매트릭스 생성
    layout.cellTypes = this.buildCellTypeMatrix(table, headerInfo);

    // 병합 셀 정보 추출
    layout.mergedCells = this.extractMergedCells(table);

    structure.tableLayouts.push(layout);
  }

  /**
   * 제목 감지 (휴리스틱 기반)
   */
  detectTitle(
    para: HWPXParagraph,
    sectionIndex: number,
    elementIndex: number
  ): TitleCandidate | null {
    // 런이 없으면 제목이 아님
    if (!para.runs || para.runs.length === 0) {
      return null;
    }

    const firstRun = para.runs[0];
    const textStyle = firstRun.style || {};
    const originalText = this.getParagraphText(para);

    // 텍스트가 너무 길면 제목이 아님
    if (originalText.length > this.config.maxTitleLength || originalText.length === 0) {
      return null;
    }

    // 점수 계산
    const scoreBreakdown = {
      fontSize: this.calculateFontSizeScore(textStyle),
      bold: this.calculateBoldScore(textStyle),
      alignment: this.calculateAlignmentScore(para.alignment),
      position: this.calculatePositionScore(elementIndex),
      length: this.calculateLengthScore(originalText.length),
    };

    const score = Object.values(scoreBreakdown).reduce((sum, val) => sum + val, 0);
    const confidence = Math.min(100, score);

    // 제목 수준 결정 (폰트 크기와 점수 기반)
    const level = this.determineHeadingLevel(textStyle, score);

    const titleCandidate: TitleCandidate = {
      sectionIndex,
      elementIndex,
      level,
      confidence,
      style: textStyle,
      alignment: para.alignment || 'left',
      originalText,
      textLength: originalText.length,
      placeholder: this.generateTitlePlaceholder(level),
      score,
      scoreBreakdown,
    };

    return titleCandidate;
  }

  /**
   * 표 헤더 감지
   */
  private detectTableHeaders(table: HWPXTable): {
    hasHeaders: boolean;
    rowCount: number;
    colCount: number;
  } {
    if (!table.rows || table.rows.length === 0) {
      return { hasHeaders: false, rowCount: 0, colCount: 0 };
    }

    let headerRowCount = 0;
    let headerColCount = 0;

    // 첫 번째 행 검사
    const firstRow = table.rows[0];
    if (this.isHeaderRow(firstRow)) {
      headerRowCount = 1;
    }

    // 첫 번째 열 검사
    if (this.hasHeaderColumn(table)) {
      headerColCount = 1;
    }

    return {
      hasHeaders: headerRowCount > 0 || headerColCount > 0,
      rowCount: headerRowCount,
      colCount: headerColCount,
    };
  }

  /**
   * 헤더 행 여부 판단
   */
  private isHeaderRow(row: any): boolean {
    if (!row.cells || row.cells.length === 0) return false;

    let headerIndicators = 0;

    row.cells.forEach((cell: HWPXTableCell) => {
      // 배경색이 있으면 헤더 가능성 높음
      if (cell.backgroundColor) headerIndicators++;

      // 볼드 텍스트가 있으면 헤더 가능성 높음
      if (this.cellHasBoldText(cell)) headerIndicators++;

      // 중앙 정렬이면 헤더 가능성 높음
      if (cell.textAlign === 'center') headerIndicators++;
    });

    // 절반 이상의 셀이 헤더 특성을 가지면 헤더로 판단
    return headerIndicators >= row.cells.length * 0.5;
  }

  /**
   * 헤더 열 존재 여부
   */
  private hasHeaderColumn(table: HWPXTable): boolean {
    if (!table.rows || table.rows.length < 2) return false;

    let headerIndicators = 0;
    const rowCount = table.rows.length;

    table.rows.forEach(row => {
      const firstCell = row.cells?.[0];
      if (!firstCell) return;

      if (firstCell.backgroundColor) headerIndicators++;
      if (this.cellHasBoldText(firstCell)) headerIndicators++;
    });

    return headerIndicators >= rowCount * 0.5;
  }

  /**
   * 셀 타입 매트릭스 생성
   */
  private buildCellTypeMatrix(
    table: HWPXTable,
    headerInfo: { rowCount: number; colCount: number }
  ): CellType[][] {
    const matrix: CellType[][] = [];

    table.rows?.forEach((row, rowIdx) => {
      const rowTypes: CellType[] = [];

      row.cells?.forEach((cell, colIdx) => {
        let cellType: CellType = 'data';

        // 헤더 판단
        if (rowIdx < headerInfo.rowCount || colIdx < headerInfo.colCount) {
          cellType = 'header';
        }
        // 병합된 셀 (실제 콘텐츠는 다른 셀에 있음)
        else if ((cell.colSpan && cell.colSpan > 1) || (cell.rowSpan && cell.rowSpan > 1)) {
          // 병합 시작 셀은 data, 나머지는 merged 처리는 별도 로직 필요
          cellType = 'data';
        }
        // 빈 셀
        else if (this.isCellEmpty(cell)) {
          cellType = 'empty';
        }

        rowTypes.push(cellType);
      });

      matrix.push(rowTypes);
    });

    return matrix;
  }

  /**
   * 병합 셀 정보 추출
   */
  private extractMergedCells(table: HWPXTable): MergedCellInfo[] {
    const mergedCells: MergedCellInfo[] = [];

    table.rows?.forEach((row, rowIdx) => {
      row.cells?.forEach((cell, colIdx) => {
        if ((cell.colSpan && cell.colSpan > 1) || (cell.rowSpan && cell.rowSpan > 1)) {
          mergedCells.push({
            startRow: rowIdx,
            startCol: colIdx,
            rowSpan: cell.rowSpan || 1,
            colSpan: cell.colSpan || 1,
          });
        }
      });
    });

    return mergedCells;
  }

  // =============================================
  // 점수 계산 메서드
  // =============================================

  private calculateFontSizeScore(style: HWPXTextStyle): number {
    const fontSize = this.parseFontSize(style);
    if (fontSize >= 18) return 30;
    if (fontSize >= this.config.titleFontSizeThreshold) return 20;
    return 0;
  }

  private calculateBoldScore(style: HWPXTextStyle): number {
    return style.bold || style.fontWeight === 'bold' ? this.config.boldWeight : 0;
  }

  private calculateAlignmentScore(alignment?: string): number {
    return alignment === 'center' ? this.config.centerAlignWeight : 0;
  }

  private calculatePositionScore(elementIndex: number): number {
    if (elementIndex < 3) return this.config.positionWeight;
    if (elementIndex < 10) return this.config.positionWeight * 0.5;
    return 0;
  }

  private calculateLengthScore(length: number): number {
    if (length < 20) return this.config.lengthWeight;
    if (length < 50) return this.config.lengthWeight * 0.5;
    return 0;
  }

  private determineHeadingLevel(
    style: HWPXTextStyle,
    score: number
  ): number {
    const fontSize = this.parseFontSize(style);
    
    if (fontSize >= 22 || score >= 90) return 1;
    if (fontSize >= 18 || score >= 80) return 2;
    if (fontSize >= 16 || score >= 70) return 3;
    if (fontSize >= 14 || score >= 60) return 4;
    return 5;
  }

  // =============================================
  // 유틸리티 메서드
  // =============================================

  private parseFontSize(style: HWPXTextStyle): number {
    if (style.fontSizePx) {
      return parseFloat(style.fontSizePx);
    }
    if (style.fontSize) {
      const fontSize = typeof style.fontSize === 'string' 
        ? parseFloat(style.fontSize) 
        : style.fontSize;
      return fontSize * 1.33; // pt to px approximation
    }
    return 13.33; // default
  }

  private getParagraphText(para: HWPXParagraph): string {
    return para.runs?.map(run => run.text || '').join('').trim() || '';
  }

  private getParagraphTextLength(para: HWPXParagraph): number {
    return this.getParagraphText(para).length;
  }

  private getColumnCount(table: HWPXTable): number {
    if (!table.rows || table.rows.length === 0) return 0;
    return table.rows[0].cells?.length || 0;
  }

  private getCellCount(table: HWPXTable): number {
    let count = 0;
    table.rows?.forEach(row => {
      count += row.cells?.length || 0;
    });
    return count;
  }

  private tableHasBorders(table: HWPXTable): boolean {
    // 첫 번째 셀만 체크 (샘플링)
    const firstCell = table.rows?.[0]?.cells?.[0];
    return !!(
      firstCell?.borderTop ||
      firstCell?.borderBottom ||
      firstCell?.borderLeft ||
      firstCell?.borderRight
    );
  }

  private tableHasBackgroundColors(table: HWPXTable): boolean {
    // 첫 번째 행 체크
    const firstRow = table.rows?.[0];
    return firstRow?.cells?.some(cell => !!cell.backgroundColor) || false;
  }

  private cellHasBoldText(cell: HWPXTableCell): boolean {
    return cell.elements?.some(elem => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        return para.runs?.some(run => 
          run.style?.bold || run.style?.fontWeight === 'bold'
        );
      }
      return false;
    }) || false;
  }

  private isCellEmpty(cell: HWPXTableCell): boolean {
    if (!cell.elements || cell.elements.length === 0) return true;
    
    return cell.elements.every(elem => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        const text = para.runs?.map(r => r.text || '').join('').trim();
        return !text || text.length === 0;
      }
      return false;
    });
  }

  private generateTitlePlaceholder(level: number): string {
    const placeholders = [
      '[제목을 입력하세요]',
      '[부제목을 입력하세요]',
      '[소제목을 입력하세요]',
      '[항목 제목을 입력하세요]',
      '[내용 제목을 입력하세요]',
    ];
    return placeholders[Math.min(level - 1, placeholders.length - 1)];
  }
}

export default TemplateAnalyzer;

