/**
 * Selective Content Generator
 * 선택적 AI 콘텐츠 생성 (선택된 셀 기반)
 * 
 * @module lib/ai/selective-generator
 * @version 1.0.0
 */

import type { HWPXDocument, HWPXTable, HWPXTableCell, HWPXParagraph } from '../../types/hwpx';
import type { 
  CellSelection, 
  SelectionContext, 
  TargetAnalysis 
} from '../../types/cell-selection';
import { makeCellKey } from '../../types/cell-selection';
import { GPTService } from './gpt-service';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface SelectiveGenerationOptions {
  userRequest: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SelectiveGenerationResult {
  document: HWPXDocument;
  stats: {
    itemsUpdated: number;
    tokensUsed: number;
    cost: number;
    duration: number;
  };
  context: SelectionContext;
}

export class SelectiveContentGenerator {
  private gptService: GPTService;
  
  constructor() {
    this.gptService = new GPTService();
  }
  
  /**
   * 선택적 콘텐츠 생성
   * 유지된 셀의 맥락을 분석하여 빈 셀에 적절한 내용 생성
   */
  async generateSelective(
    document: HWPXDocument,
    context: SelectionContext,
    options: SelectiveGenerationOptions
  ): Promise<SelectiveGenerationResult> {
    const startTime = Date.now();
    
    logger.info('🤖 선택적 AI 생성 시작...');
    logger.info(`   패턴: ${context.pattern}`);
    logger.info(`   유지 셀: ${context.headers.length}개`);
    
    // GPT Service는 생성자에서 이미 초기화됨
    
    // 1. 생성할 셀 분석
    const targets = this.analyzeTargets(document, context);
    logger.info(`   생성 대상: ${targets.length}개 셀`);
    
    if (targets.length === 0) {
      logger.warn('⚠️  생성할 셀이 없습니다');
      return {
        document,
        stats: {
          itemsUpdated: 0,
          tokensUsed: 0,
          cost: 0,
          duration: Date.now() - startTime
        },
        context
      };
    }
    
    // 2. GPT 프롬프트 생성
    const prompt = this.buildPrompt(context, targets, options.userRequest);
    
    // 3. GPT 호출
    logger.info('🤖 GPT 호출 중...');
    const response = await this.gptService.generateContent(
      prompt,
      {
        apiKey: options.apiKey,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 2000
      }
    );
    
    logger.info(`✅ GPT 응답 완료: ${response.tokensUsed} 토큰 사용`);
    
    // 4. 응답 파싱 및 문서에 적용
    const updatedDocument = this.applyGeneratedContent(
      document,
      targets,
      response.content
    );
    
    const duration = Date.now() - startTime;
    
    logger.info(`✅ 선택적 생성 완료 (${duration}ms)`);
    logger.info(`   업데이트: ${targets.length}개 셀`);
    logger.info(`   비용: $${response.cost.toFixed(4)}`);
    
    return {
      document: updatedDocument,
      stats: {
        itemsUpdated: targets.length,
        tokensUsed: response.tokensUsed,
        cost: response.cost,
        duration
      },
      context
    };
  }
  
  /**
   * 생성할 셀 분석
   */
  private analyzeTargets(
    document: HWPXDocument,
    context: SelectionContext
  ): TargetAnalysis[] {
    const targets: TargetAnalysis[] = [];
    const keepMap = new Map<string, CellSelection>();
    
    context.headers.forEach(h => {
      const key = makeCellKey(h.section, h.table, h.row, h.col);
      keepMap.set(key, h);
    });
    
    // 모든 셀 순회하여 빈 셀 찾기
    document.sections.forEach((section, sIdx) => {
      let tableIdx = 0;
      
      section.elements.forEach((elem) => {
        if (elem.type === 'table') {
          const table = elem as HWPXTable;
          
          table.rows?.forEach((row, rIdx) => {
            row.cells?.forEach((cell, cIdx) => {
              const key = makeCellKey(sIdx, tableIdx, rIdx, cIdx);
              
              // 유지 셀이 아니고 빈 셀인 경우
              if (!keepMap.has(key) && this.isCellEmpty(cell)) {
                // 같은 행의 유지 셀들
                const rowContext = Array.from(keepMap.values()).filter(
                  h => h.section === sIdx && h.table === tableIdx && h.row === rIdx
                );
                
                // 같은 열의 유지 셀들
                const colContext = Array.from(keepMap.values()).filter(
                  h => h.section === sIdx && h.table === tableIdx && h.col === cIdx
                );
                
                // 맥락 힌트 생성
                const contextHint = this.generateContextHint(
                  rowContext,
                  colContext,
                  context.pattern
                );
                
                targets.push({
                  target: {
                    section: sIdx,
                    table: tableIdx,
                    row: rIdx,
                    col: cIdx,
                    content: '',
                    isHeader: false,
                    role: 'generate'
                  },
                  rowContext,
                  colContext,
                  expectedLength: this.estimateLength(rowContext, colContext),
                  expectedStyle: this.estimateStyle(rowContext, colContext),
                  contextHint
                });
              }
            });
          });
          
          tableIdx++;
        }
      });
    });
    
    return targets;
  }
  
  /**
   * 셀이 비어있는지 확인
   */
  private isCellEmpty(cell: HWPXTableCell): boolean {
    if (!cell.elements || cell.elements.length === 0) return true;
    
    return cell.elements.every(elem => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        if (!para.runs || para.runs.length === 0) return true;
        
        return para.runs.every(run => !run.text || run.text.trim() === '');
      }
      return true;
    });
  }
  
  /**
   * 맥락 힌트 생성
   */
  private generateContextHint(
    rowContext: CellSelection[],
    colContext: CellSelection[],
    _pattern: SelectionContext['pattern']
  ): string {
    const hints: string[] = [];
    
    if (rowContext.length > 0) {
      const rowHeaders = rowContext.map(c => c.content).join(', ');
      hints.push(`행 맥락: ${rowHeaders}`);
    }
    
    if (colContext.length > 0) {
      const colHeaders = colContext.map(c => c.content).join(', ');
      hints.push(`열 맥락: ${colHeaders}`);
    }
    
    if (hints.length === 0) {
      return '맥락 없음';
    }
    
    return hints.join(' | ');
  }
  
  /**
   * 예상 길이 추정
   */
  private estimateLength(
    rowContext: CellSelection[],
    colContext: CellSelection[]
  ): number {
    // 헤더 길이 기반 추정
    const avgHeaderLength = 
      [...rowContext, ...colContext].reduce((sum, c) => sum + c.content.length, 0) / 
      Math.max(rowContext.length + colContext.length, 1);
    
    // 헤더가 짧으면 내용도 짧게, 길면 길게
    if (avgHeaderLength < 10) return 30;
    if (avgHeaderLength < 20) return 50;
    return 80;
  }
  
  /**
   * 예상 스타일 추정
   */
  private estimateStyle(
    rowContext: CellSelection[],
    colContext: CellSelection[]
  ): 'detailed' | 'brief' | 'list' {
    // 첫 번째 컨텍스트의 길이로 판단
    const firstContext = rowContext[0] || colContext[0];
    if (!firstContext) return 'brief';
    
    if (firstContext.content.length < 10) return 'brief';
    if (firstContext.content.length < 20) return 'list';
    return 'detailed';
  }
  
  /**
   * GPT 프롬프트 생성
   */
  private buildPrompt(
    context: SelectionContext,
    targets: TargetAnalysis[],
    userRequest: string
  ): string {
    const systemPrompt = `당신은 교육 문서 작성 전문가입니다. 표의 구조와 헤더를 보고 적절한 내용을 생성합니다.`;
    
    const userPrompt = `
# 📋 레이아웃 기반 문서 생성

## 🎯 사용자 요청
${userRequest}

## 📊 문서 구조
- 패턴: ${context.pattern}
- 유지된 헤더: ${context.headers.length}개
- 생성할 셀: ${targets.length}개

## 📝 유지된 헤더 정보
${context.headers.map((h, i) => `${i + 1}. [행${h.row}, 열${h.col}] "${h.content}"`).join('\n')}

## 🎨 생성할 셀 목록
${targets.map((t, i) => `
${i + 1}. 위치: [행${t.target.row}, 열${t.target.col}]
   ${t.contextHint}
   예상 길이: ${t.expectedLength}자
   스타일: ${t.expectedStyle}
`).join('\n')}

---

## 📌 생성 가이드
1. 각 셀의 행/열 헤더를 참고하여 내용을 생성하세요
2. 같은 행의 셀들은 서로 연관성을 가져야 합니다
3. 같은 열의 셀들은 일관된 형식을 유지해야 합니다
4. 교육적이고 실용적인 내용으로 작성하세요
5. 각 셀의 예상 길이를 지켜주세요

## 🔥 출력 형식
각 셀의 내용을 다음 형식으로 출력하세요:

[셀번호]
(생성된 내용)

---

예시:
[1]
우주복을 입고 달 탐험 놀이를 합니다.

[2]
상상력과 창의력을 키웁니다.

---

이제 ${targets.length}개 셀의 내용을 생성해주세요.
`;

    return `${systemPrompt}\n\n${userPrompt}`;
  }
  
  /**
   * 생성된 내용을 문서에 적용
   */
  private applyGeneratedContent(
    document: HWPXDocument,
    targets: TargetAnalysis[],
    generatedContent: string
  ): HWPXDocument {
    logger.info('🔀 생성된 내용을 문서에 적용 중...');
    
    // 문서 복사 (이미지 Map은 별도 보존)
    const originalImages = document.images;
    const updatedDoc = JSON.parse(JSON.stringify(document)) as HWPXDocument;
    updatedDoc.images = originalImages; // 이미지 정보 복원
    
    // GPT 응답 파싱
    const contents = this.parseGPTResponse(generatedContent, targets.length);
    
    if (contents.length !== targets.length) {
      logger.warn(`⚠️  응답 개수 불일치: 예상 ${targets.length}, 실제 ${contents.length}`);
    }
    
    // 각 타겟에 내용 적용
    targets.forEach((target, index) => {
      const content = contents[index] || '(생성 실패)';
      
      const { section, table, row, col } = target.target;
      
      // 셀 찾기
      let tableIdx = 0;
      updatedDoc.sections[section]?.elements.forEach((elem) => {
        if (elem.type === 'table') {
          if (tableIdx === table) {
            const tbl = elem as HWPXTable;
            const cell = tbl.rows?.[row]?.cells?.[col];
            
            if (cell) {
              this.setCellContent(cell, content);
              logger.debug(`✓ 적용 [${section}-${table}-${row}-${col}]: ${content.slice(0, 30)}...`);
            }
          }
          tableIdx++;
        }
      });
    });
    
    logger.info(`✅ ${targets.length}개 셀에 내용 적용 완료`);
    
    return updatedDoc;
  }
  
  /**
   * GPT 응답 파싱
   */
  private parseGPTResponse(content: string, expectedCount: number): string[] {
    const results: string[] = [];
    
    // [1], [2] 형식 파싱
    const regex = /\[(\d+)\]\s*\n([\s\S]*?)(?=\[(\d+)\]|\n---|\n\n\n|$)/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const text = match[2].trim();
      results.push(text);
    }
    
    // 파싱 실패 시 줄바꿈 기준 분할
    if (results.length === 0) {
      const lines = content.split('\n').filter(line => line.trim() !== '');
      results.push(...lines.slice(0, expectedCount));
    }
    
    // 개수 맞추기
    while (results.length < expectedCount) {
      results.push('');
    }
    
    return results.slice(0, expectedCount);
  }
  
  /**
   * 셀에 내용 설정
   */
  private setCellContent(cell: HWPXTableCell, content: string): void {
    if (!cell.elements || cell.elements.length === 0) {
      // 빈 셀이면 새로 생성
      cell.elements = [{
        type: 'paragraph',
        runs: [{
          text: content
        }]
      }];
    } else {
      // 기존 요소 수정
      const para = cell.elements[0] as HWPXParagraph;
      if (!para.runs || para.runs.length === 0) {
        para.runs = [{ text: content }];
      } else {
        para.runs[0].text = content;
      }
    }
  }
}

export default SelectiveContentGenerator;

