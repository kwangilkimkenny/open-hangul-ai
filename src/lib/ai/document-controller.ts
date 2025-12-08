/**
 * AI Document Controller
 * AI 기반 문서 편집 통합 컨트롤러 (맥락 인식)
 * 
 * @module lib/ai/document-controller
 * @version 2.0.0
 * @reference ref/hwp_hwpx_viewer/src/ai/ai-controller.js
 * @description 문서 구조를 완전히 이해하고 맥락에 맞는 콘텐츠 생성
 */

import type { HWPXDocument } from '../../types/hwpx';
import { DocumentStructureExtractor, type EnhancedDocumentStructure } from './structure-extractor';
import { GPTService } from './gpt-service';
import { AIConfig } from './ai-config';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * AI 처리 결과
 */
export interface AIProcessResult {
  success: boolean;
  updatedDocument: HWPXDocument;
  metadata: {
    request: string;
    documentType: string;
    itemsUpdated: number;
    tokensUsed: number;
    cost: number;
    processingTime: number;
    structureAnalysis: {
      hasTimeSequence: boolean;
      hasRepetitiveStructure: boolean;
      averageContentLength: number;
    };
  };
}

/**
 * AI 문서 컨트롤러 (맥락 인식 강화)
 */
export class AIDocumentController {
  private extractor: DocumentStructureExtractor;
  private gptService: GPTService;
  private isProcessing = false;
  private lastStructure?: EnhancedDocumentStructure;

  constructor() {
    this.extractor = new DocumentStructureExtractor();
    this.gptService = new GPTService();
  }

  /**
   * API 키 확인
   */
  hasApiKey(): boolean {
    return AIConfig.openai.getApiKey() !== null;
  }

  /**
   * API 키 설정
   */
  setApiKey(apiKey: string): void {
    AIConfig.openai.setApiKey(apiKey);
  }

  /**
   * 사용자 요청 처리 (메인 메서드 - 맥락 인식 강화)
   */
  async handleUserRequest(
    document: HWPXDocument,
    userMessage: string
  ): Promise<AIProcessResult> {
    logger.info('🤖 AI 요청 처리 시작 (맥락 인식 모드)...');
    logger.info(`   요청: "${userMessage}"`);
    
    const startTime = Date.now();

    // 동시 요청 방지
    if (this.isProcessing) {
      throw new Error('이미 요청을 처리 중입니다. 완료 후 다시 시도하세요.');
    }

    // API 키 확인
    if (!this.hasApiKey()) {
      throw new Error(AIConfig.prompts.errorMessages.noApiKey);
    }

    this.isProcessing = true;

    try {
      // ========================================
      // 1단계: 문서 구조 완전 분석
      // ========================================
      logger.info('  📊 Step 1/4: 문서 구조 완전 분석...');
      const structure = this.extractor.extractEnhancedStructure(document);
      this.lastStructure = structure;
      
      if (structure.pairs.length === 0) {
        throw new Error('편집 가능한 항목을 찾을 수 없습니다. 표 형식의 문서인지 확인해주세요.');
      }

      logger.info(`    ✓ 문서 타입: ${structure.documentType}`);
      logger.info(`    ✓ ${structure.pairs.length}개 항목 추출`);
      logger.info(`    ✓ ${structure.contextSamples.length}개 컨텍스트 샘플`);
      logger.info(`    ✓ ${structure.relationships.length}개 관계 패턴 인식`);

      // ========================================
      // 2단계: 맥락 기반 프롬프트로 GPT 생성
      // ========================================
      logger.info('  🤖 Step 2/4: 맥락 기반 GPT 콘텐츠 생성...');
      logger.info(`    문서 특성: 시간순서=${structure.characteristics.hasTimeSequence}, 반복구조=${structure.characteristics.hasRepetitiveStructure}`);
      
      const generation = await this.gptService.generateWithEnhancedStructure(
        structure,
        userMessage
      );
      
      logger.info(`    ✓ ${Object.keys(generation.content).length}개 항목 생성 완료`);
      logger.info(`    ✓ 토큰: ${generation.metadata.tokensUsed}, 비용: $${generation.metadata.cost.toFixed(4)}`);

      // 생성된 항목과 요청 항목 비교
      const generatedCount = Object.keys(generation.content).length;
      const requestedCount = structure.pairs.length;
      if (generatedCount < requestedCount * 0.8) {
        logger.warn(`    ⚠️  생성률 낮음: ${generatedCount}/${requestedCount} (${(generatedCount/requestedCount*100).toFixed(0)}%)`);
      }

      // ========================================
      // 3단계: 문서에 병합
      // ========================================
      logger.info('  🔀 Step 3/4: 문서에 병합...');
      const updatedDocument = this.mergeContent(
        document,
        generation.content,
        structure
      );
      
      logger.info('    ✓ 병합 완료');

      // ========================================
      // 4단계: 검증 및 결과 생성
      // ========================================
      logger.info('  ✅ Step 4/4: 검증 및 결과 생성...');
      const processingTime = Date.now() - startTime;

      const result: AIProcessResult = {
        success: true,
        updatedDocument,
        metadata: {
          request: userMessage,
          documentType: this.getDocumentTypeKorean(structure.documentType),
          itemsUpdated: Object.keys(generation.content).length,
          tokensUsed: generation.metadata.tokensUsed,
          cost: generation.metadata.cost,
          processingTime,
          structureAnalysis: {
            hasTimeSequence: structure.characteristics.hasTimeSequence,
            hasRepetitiveStructure: structure.characteristics.hasRepetitiveStructure,
            averageContentLength: structure.characteristics.averageContentLength
          }
        }
      };

      logger.info(`✅ AI 처리 완료 (${processingTime}ms)`);
      logger.info(`   업데이트: ${result.metadata.itemsUpdated}개 항목`);
      logger.info(`   비용: $${result.metadata.cost.toFixed(4)}`);

      return result;
    } catch (error) {
      logger.error('❌ AI 처리 실패:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 생성된 콘텐츠를 문서에 병합 (향상된 버전)
   */
  private mergeContent(
    document: HWPXDocument,
    generatedContent: Record<string, string>,
    structure: EnhancedDocumentStructure
  ): HWPXDocument {
    // 문서 딥 복사
    const updatedDocument = JSON.parse(JSON.stringify(document)) as HWPXDocument;

    let updatedCount = 0;
    let skippedCount = 0;

    // 각 헤더-내용 쌍에 대해 처리
    structure.pairs.forEach((pair, index) => {
      const newContent = generatedContent[pair.header];

      if (newContent !== undefined && newContent !== null) {
        try {
          // 경로를 따라 셀 찾기
          const section = updatedDocument.sections[pair.path.section];
          if (!section) {
            logger.warn(`  ⚠️  섹션 ${pair.path.section} 없음: "${pair.header}"`);
            skippedCount++;
            return;
          }

          const table = section.elements[pair.path.table];
          if (!table || table.type !== 'table') {
            logger.warn(`  ⚠️  표 ${pair.path.table} 없음: "${pair.header}"`);
            skippedCount++;
            return;
          }

          const row = table.rows?.[pair.path.row];
          if (!row) {
            logger.warn(`  ⚠️  행 ${pair.path.row} 없음: "${pair.header}"`);
            skippedCount++;
            return;
          }

          const cell = row.cells?.[pair.path.contentCell];
          if (!cell) {
            logger.warn(`  ⚠️  셀 ${pair.path.contentCell} 없음: "${pair.header}"`);
            skippedCount++;
            return;
          }

          // 셀 내용 업데이트
          if (!cell.elements || cell.elements.length === 0) {
            // 비어있는 셀: 새로운 구조 생성
            cell.elements = [{
              type: 'paragraph',
              runs: [{
                text: newContent,
                style: {}
              }]
            }];
          } else {
            // 기존 셀: 첫 번째 문단 업데이트
            const paragraph = cell.elements[0];
            
            if (paragraph.type === 'paragraph') {
              if (!paragraph.runs || paragraph.runs.length === 0) {
                paragraph.runs = [{
                  text: newContent,
                  style: {}
                }];
              } else {
                // 기존 스타일 유지하면서 텍스트만 변경
                paragraph.runs[0].text = newContent;
              }
            }
          }

          updatedCount++;
          
          // 주기적으로 진행상황 로그 (10개마다)
          if ((index + 1) % 10 === 0) {
            logger.debug(`  ... ${index + 1}/${structure.pairs.length} 처리 중`);
          }
        } catch (error) {
          logger.error(`  ❌ "${pair.header}" 업데이트 실패:`, error);
          skippedCount++;
        }
      } else {
        logger.debug(`  ⊘ "${pair.header}" 건너뜀 (생성 안 됨)`);
        skippedCount++;
      }
    });

    const successRate = ((updatedCount / structure.pairs.length) * 100).toFixed(1);
    logger.info(`✅ 병합 완료: ${updatedCount} / ${structure.pairs.length} (${successRate}%)`);
    
    if (skippedCount > 0) {
      logger.warn(`⚠️  건너뛴 항목: ${skippedCount}개`);
    }

    return updatedDocument;
  }

  /**
   * 문서 타입 한글 이름
   */
  private getDocumentTypeKorean(type: EnhancedDocumentStructure['documentType']): string {
    const names: Record<typeof type, string> = {
      'monthly': '월간계획안',
      'weekly': '주간계획안',
      'daily': '일일계획안',
      'lesson': '수업계획안',
      'report': '보고서',
      'form': '양식',
      'unknown': '문서'
    };
    return names[type] || '문서';
  }

  /**
   * 마지막 분석 결과 조회
   */
  getLastStructure(): EnhancedDocumentStructure | undefined {
    return this.lastStructure;
  }

  /**
   * 통계 조회
   */
  getStatistics() {
    return this.gptService.getStatistics();
  }

  /**
   * 현재 처리 상태 확인
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * 문서 구조 미리보기 (디버깅용)
   */
  async previewStructure(document: HWPXDocument): Promise<EnhancedDocumentStructure> {
    logger.info('🔍 문서 구조 미리보기...');
    const structure = this.extractor.extractEnhancedStructure(document);
    
    logger.info('📊 분석 결과:');
    logger.info(`  - 문서 타입: ${structure.documentType}`);
    logger.info(`  - 제목: ${structure.title || '(없음)'}`);
    logger.info(`  - 항목 수: ${structure.pairs.length}개`);
    logger.info(`  - 시간 순서: ${structure.characteristics.hasTimeSequence ? '있음' : '없음'}`);
    logger.info(`  - 반복 구조: ${structure.characteristics.hasRepetitiveStructure ? '있음' : '없음'}`);
    logger.info(`  - 평균 길이: ${structure.characteristics.averageContentLength}자`);
    
    return structure;
  }
}

export default AIDocumentController;
