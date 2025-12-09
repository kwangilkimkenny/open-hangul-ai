/**
 * Layout Extractor
 * 셀 선택 정보로부터 레이아웃 추출
 * 
 * @module lib/ai/layout-extractor
 * @version 1.0.0
 */

import type { 
  HWPXDocument, 
  HWPXTable, 
  HWPXTableCell, 
  HWPXParagraph 
} from '../../types/hwpx';
import type { 
  CellSelection, 
  LayoutExtractionOptions, 
  LayoutExtractionResult,
  SelectionContext 
} from '../../types/cell-selection';
import { makeCellKey } from '../../types/cell-selection';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export class LayoutExtractor {
  /**
   * 레이아웃 추출
   * 선택된 셀은 유지하고, 나머지는 빈 셀로 변환
   */
  extractLayout(
    document: HWPXDocument,
    selections: CellSelection[],
    options: Partial<LayoutExtractionOptions> = {}
  ): LayoutExtractionResult {
    logger.info('🎨 레이아웃 추출 시작...');
    
    const defaultOptions: LayoutExtractionOptions = {
      autoDetect: false,
      autoDetectHeaders: false,
      clearUnselectedCells: true,
      preserveEmptyStructure: true,
      minKeepCells: 1,
      minGenerateCells: 1
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // 통계
    let totalCells = 0;
    let keepCells = 0;
    let generateCells = 0;
    let clearedCells = 0;
    
    // 문서 복사 (이미지 Map은 별도 보존)
    const originalImages = document.images;
    const layoutDoc = JSON.parse(JSON.stringify(document)) as HWPXDocument;
    layoutDoc.images = originalImages; // 이미지 정보 복원
    
    // 선택 맵 생성 (빠른 조회)
    const selectionMap = new Map<string, CellSelection>();
    selections.forEach(sel => {
      const key = makeCellKey(sel.section, sel.table, sel.row, sel.col);
      selectionMap.set(key, sel);
    });
    
    // 모든 섹션 순회
    layoutDoc.sections.forEach((section, sIdx) => {
      let tableIdx = 0;
      
      section.elements.forEach((elem) => {
        if (elem.type === 'table') {
          const table = elem as HWPXTable;
          
          // 모든 행 순회
          table.rows?.forEach((row, rIdx) => {
            // 모든 셀 순회
            row.cells?.forEach((cell, cIdx) => {
              totalCells++;
              
              const key = makeCellKey(sIdx, tableIdx, rIdx, cIdx);
              const selection = selectionMap.get(key);
              
              if (selection) {
                if (selection.role === 'keep') {
                  // 유지: 그대로 둠
                  keepCells++;
                  logger.debug(`✓ Keep [${key}]: ${selection.content.slice(0, 20)}...`);
                } else if (selection.role === 'generate') {
                  // 생성: 빈 셀로 만들기
                  this.clearCellContent(cell);
                  generateCells++;
                  logger.debug(`⚡ Clear [${key}] for generation`);
                }
              } else {
                // 선택 안 됨: 옵션에 따라 처리
                if (finalOptions.clearUnselectedCells) {
                  this.clearCellContent(cell);
                  clearedCells++;
                }
              }
            });
          });
          
          tableIdx++;
        }
      });
    });
    
    // 맥락 생성
    const context = this.buildContext(selections);
    
    logger.info('✅ 레이아웃 추출 완료');
    logger.info(`   총 셀: ${totalCells}, 유지: ${keepCells}, 생성: ${generateCells}, 삭제: ${clearedCells}`);
    
    return {
      layoutDocument: layoutDoc,
      stats: {
        totalCells,
        keepCells,
        generateCells,
        clearedCells
      },
      context,
      timestamp: Date.now()
    };
  }
  
  /**
   * 셀 내용 삭제 (구조는 유지)
   */
  private clearCellContent(cell: HWPXTableCell): void {
    if (!cell.elements || cell.elements.length === 0) return;
    
    cell.elements.forEach(elem => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        if (para.runs) {
          para.runs.forEach(run => {
            run.text = '';  // 텍스트만 삭제
          });
        }
      }
    });
  }
  
  /**
   * 셀 텍스트 추출
   */
  private extractCellText(cell: HWPXTableCell): string {
    if (!cell.elements || cell.elements.length === 0) return '';
    
    return cell.elements.map(elem => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        return para.runs?.map(run => run.text || '').join('') || '';
      }
      return '';
    }).join('\n').trim();
  }
  
  /**
   * 자동 헤더 감지
   */
  autoDetectHeaders(document: HWPXDocument): CellSelection[] {
    logger.info('🤖 자동 헤더 감지 시작...');
    
    const selections: CellSelection[] = [];
    
    document.sections.forEach((section, sIdx) => {
      let tableIdx = 0;
      
      section.elements.forEach((elem) => {
        if (elem.type === 'table') {
          const table = elem as HWPXTable;
          
          table.rows?.forEach((row, rIdx) => {
            row.cells?.forEach((cell, cIdx) => {
              const content = this.extractCellText(cell);
              
              // 헤더 감지 로직
              if (this.isLikelyHeader(content, rIdx, cIdx, table)) {
                selections.push({
                  section: sIdx,
                  table: tableIdx,
                  row: rIdx,
                  col: cIdx,
                  content,
                  isHeader: true,
                  role: 'keep',
                  timestamp: Date.now(),
                  displayName: content.slice(0, 20) + (content.length > 20 ? '...' : '')
                });
                
                logger.debug(`🎯 Header detected [${sIdx}-${tableIdx}-${rIdx}-${cIdx}]: ${content.slice(0, 30)}`);
              }
            });
          });
          
          tableIdx++;
        }
      });
    });
    
    logger.info(`✅ ${selections.length}개 헤더 감지 완료`);
    
    return selections;
  }
  
  /**
   * 헤더 감지 휴리스틱
   */
  private isLikelyHeader(
    text: string, 
    row: number, 
    col: number, 
    _table: HWPXTable
  ): boolean {
    if (!text || text.trim() === '') return false;
    
    const trimmedText = text.trim();
    
    // 1. 첫 행은 보통 헤더
    if (row === 0) return true;
    
    // 2. 첫 열은 보통 헤더 (짧은 텍스트)
    if (col === 0 && trimmedText.length < 30) return true;
    
    // 3. 매우 짧고 명사형 (활동명, 목표, 방법 등)
    if (trimmedText.length <= 15 && /^[가-힣a-zA-Z]{2,10}$/.test(trimmedText)) {
      return true;
    }
    
    // 4. 날짜/시간 패턴 (2주, 3주, 월요일, 1차시 등)
    if (/\d+주|\d+차시|[월화수목금토일]요일|\d+월|\d+일/.test(trimmedText)) {
      return true;
    }
    
    // 5. 주제, 목표, 활동 등 교육 관련 키워드
    if (/^(주제|목표|활동명?|내용|방법|평가|준비물|유의사항|교구|시간|대상)$/.test(trimmedText)) {
      return true;
    }
    
    // 6. 영문 헤더 (Title, Name, Date 등)
    if (/^(title|name|date|type|status|description|note)$/i.test(trimmedText)) {
      return true;
    }
    
    // 7. 단순 번호 (1, 2, 3 등)
    if (/^[0-9]{1,2}$/.test(trimmedText)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 선택 맥락 생성
   */
  private buildContext(selections: CellSelection[]): SelectionContext {
    const headers = selections.filter(s => s.role === 'keep');
    
    // 행별 그룹화
    const rowHeaders = new Map<number, CellSelection[]>();
    headers.forEach(h => {
      if (!rowHeaders.has(h.row)) {
        rowHeaders.set(h.row, []);
      }
      rowHeaders.get(h.row)!.push(h);
    });
    
    // 열별 그룹화
    const colHeaders = new Map<number, CellSelection[]>();
    headers.forEach(h => {
      if (!colHeaders.has(h.col)) {
        colHeaders.set(h.col, []);
      }
      colHeaders.get(h.col)!.push(h);
    });
    
    // 패턴 감지
    let pattern: SelectionContext['pattern'] = 'free-form';
    
    // 행-헤더-내용 패턴 (각 행에 헤더 1개 + 내용 여러 개)
    const rowHeaderCounts = Array.from(rowHeaders.values()).map(r => r.length);
    const hasRowPattern = rowHeaderCounts.every(count => count >= 1) && 
                          rowHeaders.size > 0 &&
                          Array.from(rowHeaders.values()).some(row => 
                            row.some(cell => cell.col === 0)
                          );
    
    // 열-헤더-내용 패턴
    const colHeaderCounts = Array.from(colHeaders.values()).map(c => c.length);
    const hasColPattern = colHeaderCounts.every(count => count >= 1) && 
                          colHeaders.size > 0 &&
                          Array.from(colHeaders.values()).some(col => 
                            col.some(cell => cell.row === 0)
                          );
    
    // 패턴 결정
    if (hasRowPattern && hasColPattern) {
      pattern = 'matrix';
    } else if (hasRowPattern) {
      pattern = 'row-header-content';
    } else if (hasColPattern) {
      pattern = 'col-header-content';
    }
    
    logger.info(`📊 맥락 패턴: ${pattern}`);
    logger.info(`   행 헤더: ${rowHeaders.size}개, 열 헤더: ${colHeaders.size}개`);
    
    return {
      headers,
      rowHeaders,
      colHeaders,
      pattern
    };
  }
}

export default LayoutExtractor;

