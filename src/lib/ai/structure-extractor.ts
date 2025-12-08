/**
 * Document Structure Extractor
 * HWPX 문서에서 편집 가능한 구조를 완전 분석
 * 
 * @module lib/ai/structure-extractor
 * @version 2.0.0
 * @description 문서 타입, 구조, 맥락, 관계성을 모두 파악하여 AI가 더 나은 콘텐츠를 생성하도록 지원
 */

import type { HWPXDocument, HWPXSection, HWPXTable, HWPXTableCell, HWPXParagraph } from '../../types/hwpx';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * 헤더-내용 쌍
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
}

/**
 * 컨텍스트 샘플 (원본 내용 예시)
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
  type: 'same-row' | 'same-column' | 'sequential' | 'hierarchical';
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
}

/**
 * 향상된 문서 구조
 */
export interface EnhancedDocumentStructure {
  // 기본 정보
  pairs: HeaderContentPair[];
  
  // 문서 메타데이터
  documentType: 'monthly' | 'weekly' | 'daily' | 'lesson' | 'report' | 'form' | 'unknown';
  title?: string;
  subtitle?: string;
  
  // 구조 정보
  tableStructure?: TableStructure;
  
  // 컨텍스트 정보
  contextSamples: ContextSample[];
  
  // 항목 간 관계
  relationships: ItemRelationship[];
  
  // 문서 특성
  characteristics: {
    hasTimeSequence: boolean;  // 시간 순서가 있는가 (1주, 2주 등)
    hasHierarchy: boolean;     // 계층 구조가 있는가
    hasCategorization: boolean; // 카테고리 분류가 있는가
    hasRepetitiveStructure: boolean; // 반복 구조가 있는가
    dominantStyle: 'formal' | 'casual' | 'educational' | 'technical';
    averageContentLength: number;
  };
  
  // 생성 가이드
  generationGuide: {
    shouldMaintainContinuity: boolean;  // 연속성 유지 필요
    shouldVaryContent: boolean;          // 내용 변화 필요
    shouldKeepConsistentLength: boolean; // 길이 일관성 유지
    contextualHints: string[];           // 맥락적 힌트들
  };
}

/**
 * 문서 구조 추출기 (강화 버전)
 */
export class DocumentStructureExtractor {
  /**
   * 문서 구조 완전 분석
   */
  extractEnhancedStructure(document: HWPXDocument): EnhancedDocumentStructure {
    logger.info('📊 문서 구조 완전 분석 시작...');
    
    // 1. 기본 헤더-내용 쌍 추출
    const pairs = this.extractHeaderContentPairs(document);
    
    // 2. 문서 타입 감지
    const documentType = this.detectDocumentType(document, pairs);
    
    // 3. 제목 추출
    const title = this.extractTitle(document);
    const subtitle = this.extractSubtitle(document);
    
    // 4. 표 구조 분석
    const tableStructure = this.analyzeTableStructure(document);
    
    // 5. 컨텍스트 샘플 추출
    const contextSamples = this.extractContextSamples(pairs);
    
    // 6. 항목 간 관계 분석
    const relationships = this.analyzeRelationships(pairs, tableStructure);
    
    // 7. 문서 특성 분석
    const characteristics = this.analyzeCharacteristics(
      pairs, 
      documentType, 
      tableStructure
    );
    
    // 8. 생성 가이드 생성
    const generationGuide = this.generateGuide(
      documentType,
      characteristics,
      relationships
    );
    
    const structure: EnhancedDocumentStructure = {
      pairs,
      documentType,
      title,
      subtitle,
      tableStructure,
      contextSamples,
      relationships,
      characteristics,
      generationGuide
    };
    
    logger.info(`✅ 분석 완료: ${pairs.length}개 항목, 타입=${documentType}`);
    logger.info(`   특성: 시간순서=${characteristics.hasTimeSequence}, 계층=${characteristics.hasHierarchy}`);
    logger.info(`   스타일: ${characteristics.dominantStyle}, 평균길이=${characteristics.averageContentLength}자`);
    
    return structure;
  }

  /**
   * 문서에서 헤더-내용 쌍 추출 (기존 메서드)
   */
  extractHeaderContentPairs(document: HWPXDocument): HeaderContentPair[] {
    const pairs: HeaderContentPair[] = [];

    document.sections.forEach((section, sectionIndex) => {
      const tablePairs = this.extractFromSection(section, sectionIndex);
      pairs.push(...tablePairs);
    });

    return pairs;
  }

  /**
   * 섹션에서 헤더-내용 쌍 추출
   */
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

  /**
   * 표에서 헤더-내용 쌍 추출
   */
  private extractFromTable(table: HWPXTable, sectionIndex: number, tableIndex: number): HeaderContentPair[] {
    const pairs: HeaderContentPair[] = [];

    table.rows?.forEach((row, rowIndex) => {
      const cells = row.cells || [];

      // 2개 이상 셀이 있는 경우: 첫 번째가 헤더, 두 번째가 내용
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

  /**
   * 셀에서 텍스트 추출
   */
  private extractCellText(cell: HWPXTableCell): string {
    if (!cell.elements || cell.elements.length === 0) return '';

    const texts: string[] = [];

    cell.elements.forEach(elem => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        const text = para.runs?.map(run => run.text || '').join('') || '';
        if (text.trim()) {
          texts.push(text.trim());
        }
      }
    });

    return texts.join('\n');
  }

  /**
   * 문서 타입 감지
   */
  private detectDocumentType(
    _document: HWPXDocument,
    pairs: HeaderContentPair[]
  ): EnhancedDocumentStructure['documentType'] {
    const headers = pairs.map(p => p.header.toLowerCase());
    const allText = pairs.map(p => `${p.header} ${p.content}`).join(' ').toLowerCase();
    
    // 월간계획안 패턴
    if (allText.includes('월간') || headers.some(h => /\d+주/.test(h))) {
      return 'monthly';
    }
    
    // 주간계획안 패턴
    if (allText.includes('주간') || headers.some(h => h.includes('요일') || h.includes('월요일'))) {
      return 'weekly';
    }
    
    // 일일계획안 패턴
    if (allText.includes('일일') || headers.some(h => h.includes('시간') && h.includes('분'))) {
      return 'daily';
    }
    
    // 수업계획안 패턴
    if (headers.some(h => h.includes('활동') || h.includes('목표') || h.includes('준비물'))) {
      return 'lesson';
    }
    
    // 보고서 패턴
    if (headers.some(h => h.includes('보고') || h.includes('결과') || h.includes('분석'))) {
      return 'report';
    }
    
    // 양식/폼 패턴
    if (headers.some(h => h.includes('성명') || h.includes('연락처') || h.includes('주소'))) {
      return 'form';
    }
    
    return 'unknown';
  }

  /**
   * 제목 추출
   */
  private extractTitle(document: HWPXDocument): string | undefined {
    // 첫 번째 섹션의 첫 번째 문단 또는 표 상단 확인
    const firstSection = document.sections[0];
    if (!firstSection) return undefined;

    // 첫 번째 요소가 문단인 경우
    const firstElement = firstSection.elements[0];
    if (firstElement?.type === 'paragraph') {
      const para = firstElement as HWPXParagraph;
      const text = para.runs?.map(run => run.text || '').join('').trim();
      if (text && text.length < 100) {  // 제목은 보통 짧음
        return text;
      }
    }

    // 첫 번째 표의 첫 행 확인 (병합된 셀일 가능성)
    if (firstElement?.type === 'table') {
      const table = firstElement as HWPXTable;
      const firstRow = table.rows?.[0];
      if (firstRow?.cells?.[0]) {
        const text = this.extractCellText(firstRow.cells[0]).trim();
        // 병합된 셀이고 길지 않으면 제목일 가능성
        if (text && text.length < 100 && firstRow.cells[0].colSpan && firstRow.cells[0].colSpan > 1) {
          return text;
        }
      }
    }

    return undefined;
  }

  /**
   * 부제목 추출
   */
  private extractSubtitle(document: HWPXDocument): string | undefined {
    const firstSection = document.sections[0];
    if (!firstSection || firstSection.elements.length < 2) return undefined;

    const secondElement = firstSection.elements[1];
    if (secondElement?.type === 'paragraph') {
      const para = secondElement as HWPXParagraph;
      const text = para.runs?.map(run => run.text || '').join('').trim();
      if (text && text.length < 100) {
        return text;
      }
    }

    return undefined;
  }

  /**
   * 표 구조 분석
   */
  private analyzeTableStructure(_document: HWPXDocument): TableStructure | undefined {
    const document = _document;
    // 첫 번째 표 찾기
    const firstTable = document.sections[0]?.elements.find(
      e => e.type === 'table'
    ) as HWPXTable;

    if (!firstTable || !firstTable.rows) return undefined;

    const rows = firstTable.rows;
    const firstRow = rows[0];
    const totalColumns = firstRow?.cells?.length || 0;

    // 헤더 행 (첫 번째 행)
    const headerRow = firstRow?.cells?.map(cell => 
      this.extractCellText(cell).trim()
    ) || [];

    // 컬럼 헤더 추출 (주차 정보 등)
    const columnHeaders: string[] = [];
    headerRow.forEach((text) => {
      if (text && (
        /\d+주/.test(text) ||   // "2주", "3주"
        /\d+월/.test(text) ||   // "3월", "4월"
        text.includes('요일') ||
        /[월화수목금토일]요일/.test(text)
      )) {
        columnHeaders.push(text);
      }
    });

    // 행 헤더 추출 (좌측 첫 번째 열)
    const rowHeaders: string[] = [];
    rows.forEach((row, idx) => {
      if (idx > 0 && row.cells && row.cells[0]) {  // 첫 행 제외
        const text = this.extractCellText(row.cells[0]).trim();
        if (text && text.length < 50) {  // 헤더는 보통 짧음
          rowHeaders.push(text);
        }
      }
    });

    // 병합 셀 정보
    const cellSpans: TableStructure['cellSpans'] = [];
    rows.forEach((row, rowIdx) => {
      row.cells?.forEach((cell) => {
        const rowSpan = cell.rowSpan || 1;
        const colSpan = cell.colSpan || 1;
        if (rowSpan > 1 || colSpan > 1) {
          cellSpans.push({
            row: rowIdx,
            col: 0,  // colIdx는 사용하지 않으므로 0으로 설정
            rowSpan,
            colSpan,
            content: this.extractCellText(cell).trim()
          });
        }
      });
    });

    return {
      totalRows: rows.length,
      totalColumns,
      headerRow,
      columnHeaders,
      rowHeaders,
      cellSpans
    };
  }

  /**
   * 컨텍스트 샘플 추출 (원본 내용 예시)
   */
  private extractContextSamples(pairs: HeaderContentPair[]): ContextSample[] {
    return pairs
      .filter(p => p.content.trim().length > 10)  // 의미있는 내용만
      .slice(0, Math.min(10, Math.ceil(pairs.length * 0.3)))  // 최대 10개 또는 30%
      .map(p => ({
        header: p.header,
        originalContent: p.content,
        contentLength: p.content.length,
        contentStyle: this.detectContentStyle(p.content),
        hasLineBreaks: p.content.includes('\n'),
        hasBullets: /[·•◦▪]/.test(p.content) || /^\s*[-*]\s/.test(p.content)
      }));
  }

  /**
   * 내용 스타일 감지
   */
  private detectContentStyle(content: string): ContextSample['contentStyle'] {
    // 구조화된 (여러 문단, 번호, 목록)
    if (content.split('\n').length > 3 || /^\s*\d+\./.test(content)) {
      return 'structured';
    }
    
    // 목록형
    if (content.includes('\n') || /[·•◦▪]/.test(content) || /^\s*[-*]\s/.test(content)) {
      return 'list';
    }
    
    // 상세형 (100자 이상)
    if (content.length > 100) {
      return 'detailed';
    }
    
    // 간략형
    return 'brief';
  }

  /**
   * 항목 간 관계 분석
   */
  private analyzeRelationships(
    pairs: HeaderContentPair[],
    _tableStructure?: TableStructure
  ): ItemRelationship[] {
    const relationships: ItemRelationship[] = [];

    // 1. 같은 행에 있는 항목들 (시간대별/주차별)
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
        
        // 주차 패턴 감지
        if (headers.some(h => /\d+주/.test(h))) {
          description = '동일한 활동에 대한 주차별 진행 내용 (연속성 필요)';
        }
        
        relationships.push({
          type: 'same-row',
          items: headers,
          description
        });
      }
    });

    // 2. 같은 열에 있는 항목들
    const colGroups = new Map<number, HeaderContentPair[]>();
    pairs.forEach(p => {
      const key = p.path.contentCell;
      if (!colGroups.has(key)) colGroups.set(key, []);
      colGroups.get(key)!.push(p);
    });

    colGroups.forEach((group) => {
      if (group.length > 2) {  // 3개 이상일 때만
        relationships.push({
          type: 'same-column',
          items: group.map(p => p.header),
          description: '동일한 시간대/주차에 속하는 다양한 활동들'
        });
      }
    });

    // 3. 순차적 패턴 (1, 2, 3 또는 첫째, 둘째)
    const sequential = pairs.filter((p, _idx, arr) => {
      const idx = _idx;
      if (idx === 0) return false;
      const prev = arr[idx - 1];
      return this.areSequential(prev.header, p.header);
    });

    if (sequential.length > 0) {
      relationships.push({
        type: 'sequential',
        items: sequential.map(p => p.header),
        description: '순차적으로 진행되는 단계별 내용'
      });
    }

    // 4. 계층 구조 (상위-하위)
    const hierarchical: string[][] = [];
    pairs.forEach((p, idx) => {
      const nextPairs = pairs.slice(idx + 1, idx + 4);  // 다음 3개 확인
      const children = nextPairs.filter(next => 
        this.isChildOf(p.header, next.header)
      );
      
      if (children.length > 0) {
        hierarchical.push([p.header, ...children.map(c => c.header)]);
      }
    });

    hierarchical.forEach(group => {
      if (group.length > 1) {
        relationships.push({
          type: 'hierarchical',
          items: group,
          description: `"${group[0]}"의 하위 세부 항목들`
        });
      }
    });

    return relationships;
  }

  /**
   * 두 헤더가 순차적인지 확인
   */
  private areSequential(header1: string, header2: string): boolean {
    // 숫자 패턴
    const num1 = header1.match(/(\d+)/);
    const num2 = header2.match(/(\d+)/);
    if (num1 && num2) {
      return parseInt(num2[1]) === parseInt(num1[1]) + 1;
    }

    // 한글 순서 (첫째, 둘째, ...)
    const koreanOrder = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
    const idx1 = koreanOrder.indexOf(header1);
    const idx2 = koreanOrder.indexOf(header2);
    if (idx1 >= 0 && idx2 >= 0) {
      return idx2 === idx1 + 1;
    }

    return false;
  }

  /**
   * header2가 header1의 하위 항목인지 확인
   */
  private isChildOf(parent: string, child: string): boolean {
    // 들여쓰기 또는 번호 체계로 판단
    if (child.startsWith('  ') || child.startsWith('\t')) return true;
    if (child.match(/^\s*[-•◦]\s/) && !parent.match(/^\s*[-•◦]\s/)) return true;
    if (child.match(/^\s*\d+\.\d+/) && parent.match(/^\s*\d+\./)) return true;
    
    return false;
  }

  /**
   * 문서 특성 분석
   */
  private analyzeCharacteristics(
    pairs: HeaderContentPair[],
    documentType: EnhancedDocumentStructure['documentType'],
    tableStructure?: TableStructure
  ): EnhancedDocumentStructure['characteristics'] {
    // 시간 순서 여부
    const hasTimeSequence = 
      tableStructure?.columnHeaders.some(h => /\d+주/.test(h) || /\d+월/.test(h)) ||
      pairs.some(p => /\d+주/.test(p.header) || /\d+차시/.test(p.header));

    // 계층 구조 여부
    const hasHierarchy = pairs.some(p => 
      p.header.match(/^\s*\d+\.\d+/) ||  // 1.1, 1.2 형식
      p.header.includes('세부') ||
      p.header.includes('하위')
    );

    // 카테고리 분류 여부
    const hasCategorization = 
      !!(tableStructure?.rowHeaders && tableStructure.rowHeaders.length > 3);

    // 반복 구조 여부
    const hasRepetitiveStructure = 
      !!(tableStructure && tableStructure.totalColumns > 2 && 
      tableStructure.columnHeaders.length > 0);

    // 주요 스타일 감지
    const dominantStyle = this.detectDominantStyle(documentType, pairs);

    // 평균 내용 길이
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
      averageContentLength
    };
  }

  /**
   * 주요 스타일 감지
   */
  private detectDominantStyle(
    documentType: EnhancedDocumentStructure['documentType'],
    pairs: HeaderContentPair[]
  ): EnhancedDocumentStructure['characteristics']['dominantStyle'] {
    const allContent = pairs.map(p => p.content).join(' ');

    // 교육 관련
    if (documentType === 'lesson' || documentType === 'monthly' || documentType === 'weekly') {
      return 'educational';
    }

    // 기술 문서
    if (allContent.match(/API|코드|시스템|알고리즘|데이터/)) {
      return 'technical';
    }

    // 격식체 (합니다, 됩니다)
    if (allContent.match(/합니다|됩니다|입니다/)) {
      return 'formal';
    }

    // 비격식체
    return 'casual';
  }

  /**
   * 생성 가이드 생성
   */
  private generateGuide(
    documentType: EnhancedDocumentStructure['documentType'],
    characteristics: EnhancedDocumentStructure['characteristics'],
    relationships: ItemRelationship[]
  ): EnhancedDocumentStructure['generationGuide'] {
    const guide: EnhancedDocumentStructure['generationGuide'] = {
      shouldMaintainContinuity: false,
      shouldVaryContent: false,
      shouldKeepConsistentLength: true,
      contextualHints: []
    };

    // 연속성 유지 필요 여부
    if (characteristics.hasTimeSequence || relationships.some(r => r.type === 'same-row')) {
      guide.shouldMaintainContinuity = true;
      guide.contextualHints.push('같은 행의 항목들은 시간순으로 발전하는 내용이어야 합니다');
    }

    // 내용 변화 필요 여부
    if (characteristics.hasRepetitiveStructure) {
      guide.shouldVaryContent = true;
      guide.contextualHints.push('각 주차/시간대별로 내용이 달라야 하지만 주제는 연관되어야 합니다');
    }

    // 길이 일관성
    if (characteristics.averageContentLength > 50) {
      guide.contextualHints.push(`각 항목은 약 ${characteristics.averageContentLength}자 정도의 상세한 설명이 필요합니다`);
    } else {
      guide.contextualHints.push('간결하고 핵심적인 내용으로 작성하세요');
    }

    // 문서 타입별 힌트
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

    // 스타일 힌트
    if (characteristics.dominantStyle === 'educational') {
      guide.contextualHints.push('교육적이고 발달단계에 적합한 내용으로 작성하세요');
    }

    return guide;
  }
}

export default DocumentStructureExtractor;
