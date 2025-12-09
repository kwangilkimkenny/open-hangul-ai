/**
 * Template Generator
 * HWPX 문서를 템플릿으로 변환
 * 
 * @module lib/core/template-generator
 * @version 1.0.0
 */

import type {
  HWPXDocument,
  HWPXSection,
  HWPXElement,
  HWPXParagraph,
  HWPXTable,
  HWPXRun,
} from '../../types/hwpx';
import type {
  DocumentStructure,
  TemplateOptions,
  TemplateGenerationResult,
  TemplateMetadata,
  TemplateStatistics,
  TemplateError,
  TemplateWarning,
} from '../../types/template';
import { TemplateAnalyzer } from './template-analyzer';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * 기본 템플릿 옵션
 */
const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
  keepTitles: true,
  titlePlaceholder: '[제목을 입력하세요]',
  
  keepTableHeaders: true,
  keepTableStructure: true,
  clearDataCells: true,
  
  keepImages: false,
  keepShapes: true,
  
  keepPageSettings: true,
  keepHeaderFooter: false,
  
  cellPlaceholder: '',
  preserveFormatting: true,
  
  minTitleConfidence: 50,
  detectFormulas: false,
};

/**
 * 템플릿 생성기 클래스
 */
export class TemplateGenerator {
  private analyzer: TemplateAnalyzer;
  private options: TemplateOptions;
  private errors: TemplateError[] = [];
  private warnings: TemplateWarning[] = [];

  constructor(analyzer?: TemplateAnalyzer, options?: Partial<TemplateOptions>) {
    this.analyzer = analyzer || new TemplateAnalyzer();
    this.options = { ...DEFAULT_TEMPLATE_OPTIONS, ...options };
  }

  /**
   * 템플릿 생성 (메인 메서드)
   */
  async generateTemplate(
    doc: HWPXDocument,
    customOptions?: Partial<TemplateOptions>
  ): Promise<TemplateGenerationResult> {
    const startTime = performance.now();
    this.errors = [];
    this.warnings = [];

    // 옵션 병합
    const options = { ...this.options, ...customOptions };

    try {
      logger.info('🎨 템플릿 생성 시작...');

      // 1단계: 문서 구조 분석
      const analysisStart = performance.now();
      const structure = this.analyzer.analyzeDocument(doc);
      const analysisTime = performance.now() - analysisStart;
      logger.info(`✅ 구조 분석 완료 (${analysisTime.toFixed(2)}ms)`);

      // 2단계: 템플릿 문서 생성
      const generationStart = performance.now();
      const template = this.createTemplateDocument(doc, structure, options);
      const generationTime = performance.now() - generationStart;
      logger.info(`✅ 템플릿 생성 완료 (${generationTime.toFixed(2)}ms)`);

      // 3단계: 메타데이터 생성
      const metadata = this.createTemplateMetadata(doc, structure, options);

      // 4단계: 통계 생성
      const statistics = this.calculateStatistics(
        doc,
        template,
        analysisTime,
        generationTime
      );

      const totalTime = performance.now() - startTime;
      logger.info(`🎉 템플릿 생성 완료 (총 ${totalTime.toFixed(2)}ms)`);

      return {
        success: true,
        template,
        metadata,
        structure,
        statistics,
        errors: this.errors,
        warnings: this.warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('❌ 템플릿 생성 실패:', error);

      this.errors.push({
        code: 'GENERATION_FAILED',
        message: errorMsg,
        severity: 'error',
      });

      return {
        success: false,
        template: null,
        metadata: null,
        structure: this.analyzer.analyzeDocument(doc),
        statistics: this.createEmptyStatistics(),
        errors: this.errors,
        warnings: this.warnings,
      };
    }
  }

  /**
   * 템플릿 문서 생성
   */
  private createTemplateDocument(
    doc: HWPXDocument,
    structure: DocumentStructure,
    options: TemplateOptions
  ): HWPXDocument {
    const templateDoc: HWPXDocument = {
      sections: [],
      images: options.keepImages ? new Map(doc.images) : new Map(),
      metadata: {
        ...doc.metadata,
        title: '[템플릿] ' + (doc.metadata?.title || '제목없음'),
      },
    };

    // 섹션별 처리
    doc.sections.forEach((section, sIdx) => {
      try {
        const templateSection = this.processSection(section, structure, sIdx, options);
        templateDoc.sections.push(templateSection);
      } catch (error) {
        logger.error(`섹션 ${sIdx} 처리 실패:`, error);
        this.errors.push({
          code: 'SECTION_PROCESSING_FAILED',
          message: `섹션 ${sIdx + 1} 처리 중 오류 발생`,
          sectionIndex: sIdx,
          severity: 'error',
        });
        // 원본 섹션 유지
        templateDoc.sections.push(section);
      }
    });

    return templateDoc;
  }

  /**
   * 섹션 처리
   */
  private processSection(
    section: HWPXSection,
    structure: DocumentStructure,
    sectionIndex: number,
    options: TemplateOptions
  ): HWPXSection {
    const templateSection: HWPXSection = {
      id: section.id,
      pageSettings: options.keepPageSettings ? section.pageSettings : undefined,
      elements: [],
      colPr: section.colPr,
      pageNum: section.pageNum,
    };

    // 머리글/바닥글 처리
    if (options.keepHeaderFooter) {
      templateSection.headers = section.headers;
      templateSection.footers = section.footers;
    }

    // 요소별 처리
    section.elements.forEach((element, eIdx) => {
      try {
        const templateElement = this.processElement(
          element,
          structure,
          sectionIndex,
          eIdx,
          options
        );

        if (templateElement) {
          templateSection.elements.push(templateElement);
        }
      } catch (error) {
        logger.error(`요소 ${eIdx} 처리 실패:`, error);
        this.errors.push({
          code: 'ELEMENT_PROCESSING_FAILED',
          message: `요소 처리 중 오류 발생`,
          sectionIndex,
          elementIndex: eIdx,
          severity: 'warning',
        });
        // 원본 요소 유지
        templateSection.elements.push(element);
      }
    });

    return templateSection;
  }

  /**
   * 요소 처리
   */
  private processElement(
    element: HWPXElement,
    structure: DocumentStructure,
    sectionIndex: number,
    elementIndex: number,
    options: TemplateOptions
  ): HWPXElement | null {
    switch (element.type) {
      case 'paragraph':
        return this.processParagraph(
          element as HWPXParagraph,
          structure,
          sectionIndex,
          elementIndex,
          options
        );

      case 'table':
        return this.processTable(
          element as HWPXTable,
          structure,
          sectionIndex,
          elementIndex,
          options
        );

      case 'image':
        return options.keepImages ? element : null;

      case 'shape':
      case 'container':
        return options.keepShapes ? element : null;

      default:
        return element;
    }
  }

  /**
   * 단락 처리
   */
  private processParagraph(
    para: HWPXParagraph,
    structure: DocumentStructure,
    sectionIndex: number,
    elementIndex: number,
    options: TemplateOptions
  ): HWPXParagraph {
    // 제목 여부 확인
    const titleInfo = structure.titles.find(
      t => t.sectionIndex === sectionIndex && t.elementIndex === elementIndex
    );

    if (titleInfo && options.keepTitles) {
      // 제목은 플레이스홀더로 교체
      return this.createTitleParagraph(para, titleInfo.placeholder, options);
    }

    // 일반 단락은 빈 런으로 교체 (스타일만 유지)
    return this.clearParagraphContent(para, options);
  }

  /**
   * 제목 단락 생성
   */
  private createTitleParagraph(
    para: HWPXParagraph,
    placeholder: string,
    options: TemplateOptions
  ): HWPXParagraph {
    const firstRun = para.runs?.[0];
    
    return {
      ...para,
      runs: [{
        text: placeholder,
        style: options.preserveFormatting ? (firstRun?.style || {}) : {},
      }],
    };
  }

  /**
   * 단락 내용 제거
   */
  private clearParagraphContent(
    para: HWPXParagraph,
    options: TemplateOptions
  ): HWPXParagraph {
    const clearedRuns: HWPXRun[] = [];

    para.runs?.forEach(run => {
      // 탭은 유지
      if (run.type === 'tab') {
        clearedRuns.push(run);
      }
      // 줄바꿈 유지
      else if (run.type === 'linebreak') {
        clearedRuns.push(run);
      }
      // 텍스트는 빈 문자열로 (스타일만 유지)
      else if (options.preserveFormatting && run.style) {
        clearedRuns.push({
          text: '',
          style: run.style,
        });
      }
    });

    // 빈 런이 없으면 최소한 하나의 빈 런 추가
    if (clearedRuns.length === 0) {
      clearedRuns.push({
        text: '',
        style: para.runs?.[0]?.style || {},
      });
    }

    return {
      ...para,
      runs: clearedRuns,
      // 인라인 요소 처리
      images: options.keepImages ? para.images : undefined,
      shapes: options.keepShapes ? para.shapes : undefined,
      tables: options.keepTableStructure ? para.tables : undefined,
    };
  }

  /**
   * 표 처리
   */
  private processTable(
    table: HWPXTable,
    structure: DocumentStructure,
    sectionIndex: number,
    elementIndex: number,
    options: TemplateOptions
  ): HWPXTable | null {
    if (!options.keepTableStructure) {
      return null;
    }

    const tableLayout = structure.tableLayouts.find(
      t => t.sectionIndex === sectionIndex && t.elementIndex === elementIndex
    );

    const headerRowCount = tableLayout?.headerRowCount || 0;

    return {
      ...table,
      rows: table.rows?.map((row, rowIdx) => ({
        ...row,
        cells: row.cells?.map((cell) => 
          this.processTableCell(
            cell,
            rowIdx,
            headerRowCount,
            options
          )
        ) || [],
      })) || [],
    };
  }

  /**
   * 표 셀 처리
   */
  private processTableCell(
    cell: any,
    rowIdx: number,
    headerRowCount: number,
    options: TemplateOptions
  ): any {
    const isHeader = rowIdx < headerRowCount;

    return {
      ...cell,
      elements: cell.elements?.map((elem: HWPXElement) => {
        if (elem.type === 'paragraph') {
          const para = elem as HWPXParagraph;

          // 헤더 셀은 내용 유지 여부에 따라 처리
          if (isHeader && options.keepTableHeaders) {
            return para; // 헤더는 원본 유지
          }

          // 데이터 셀은 플레이스홀더 또는 빈 값
          if (options.clearDataCells) {
            return this.clearParagraphContent(para, options);
          }

          return para;
        }
        
        // 중첩 테이블 처리
        if (elem.type === 'table' && options.keepTableStructure) {
          // 재귀적으로 처리 (간단히 구조만 유지)
          return elem;
        }

        return elem;
      }) || [],
    };
  }

  /**
   * 템플릿 메타데이터 생성
   */
  private createTemplateMetadata(
    doc: HWPXDocument,
    structure: DocumentStructure,
    options: TemplateOptions
  ): TemplateMetadata {
    return {
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `템플릿_${doc.metadata?.title || '제목없음'}`,
      description: `${structure.titleCount}개 제목, ${structure.tableCount}개 표 포함`,
      originalFileName: doc.metadata?.title || 'unknown',
      createdAt: new Date(),
      version: '1.0.0',
      structure,
      options,
      tags: this.generateTags(structure),
      category: this.determineCategory(structure),
    };
  }

  /**
   * 통계 계산
   */
  private calculateStatistics(
    original: HWPXDocument,
    template: HWPXDocument,
    analysisTime: number,
    generationTime: number
  ): TemplateStatistics {
    const originalTextLength = this.calculateTotalTextLength(original);
    const templateTextLength = this.calculateTotalTextLength(template);

    return {
      processedElements: this.countElements(original),
      preservedElements: this.countElements(template),
      removedElements: this.countElements(original) - this.countElements(template),
      
      originalTextLength,
      templateTextLength,
      reductionRate: originalTextLength > 0 
        ? ((originalTextLength - templateTextLength) / originalTextLength) * 100 
        : 0,
      
      preservedTables: this.countTables(template),
      preservedImages: template.images.size,
      preservedShapes: this.countShapes(template),
      
      analysisTimeMs: analysisTime,
      generationTimeMs: generationTime,
      totalTimeMs: analysisTime + generationTime,
    };
  }

  // =============================================
  // 유틸리티 메서드
  // =============================================

  private calculateTotalTextLength(doc: HWPXDocument): number {
    let totalLength = 0;

    doc.sections.forEach(section => {
      section.elements.forEach(element => {
        if (element.type === 'paragraph') {
          const para = element as HWPXParagraph;
          const text = para.runs?.map(r => r.text || '').join('') || '';
          totalLength += text.length;
        }
      });
    });

    return totalLength;
  }

  private countElements(doc: HWPXDocument): number {
    return doc.sections.reduce(
      (sum, section) => sum + section.elements.length,
      0
    );
  }

  private countTables(doc: HWPXDocument): number {
    let count = 0;
    doc.sections.forEach(section => {
      section.elements.forEach(element => {
        if (element.type === 'table') count++;
      });
    });
    return count;
  }

  private countShapes(doc: HWPXDocument): number {
    let count = 0;
    doc.sections.forEach(section => {
      section.elements.forEach(element => {
        if (element.type === 'shape' || element.type === 'container') count++;
      });
    });
    return count;
  }

  private generateTags(structure: DocumentStructure): string[] {
    const tags: string[] = [];

    if (structure.hasTables) tags.push('표');
    if (structure.hasImages) tags.push('이미지');
    if (structure.hasShapes) tags.push('도형');
    if (structure.hasTitles) tags.push('제목');
    if (structure.tableCount > 3) tags.push('다중표');

    return tags;
  }

  private determineCategory(structure: DocumentStructure): string {
    if (structure.tableCount > 5) return '업무 보고서';
    if (structure.hasTitles && structure.tableCount > 0) return '공문서';
    if (structure.tableCount > 0) return '양식';
    return '일반 문서';
  }

  private createEmptyStatistics(): TemplateStatistics {
    return {
      processedElements: 0,
      preservedElements: 0,
      removedElements: 0,
      originalTextLength: 0,
      templateTextLength: 0,
      reductionRate: 0,
      preservedTables: 0,
      preservedImages: 0,
      preservedShapes: 0,
      analysisTimeMs: 0,
      generationTimeMs: 0,
      totalTimeMs: 0,
    };
  }

  /**
   * 옵션 업데이트
   */
  setOptions(options: Partial<TemplateOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 에러 및 경고 조회
   */
  getErrors(): TemplateError[] {
    return this.errors;
  }

  getWarnings(): TemplateWarning[] {
    return this.warnings;
  }
}

export default TemplateGenerator;

