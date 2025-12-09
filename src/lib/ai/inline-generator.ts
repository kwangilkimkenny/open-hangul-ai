/**
 * Inline Content Generator
 * 단일 셀/텍스트에 대한 AI 콘텐츠 생성 서비스
 * 
 * @module lib/ai/inline-generator
 * @version 1.0.0
 */

import { GPTService } from './gpt-service';
import { AIConfig } from './ai-config';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface InlineGenerationContext {
  cellContent?: string;      // 현재 셀 내용
  rowHeaders?: string[];     // 같은 행의 헤더들
  colHeaders?: string[];     // 같은 열의 헤더들
  nearbyContent?: string[];  // 주변 내용
  documentType?: string;     // 문서 타입 (예: '주간계획안', '보고서')
}

export interface InlineGenerationResult {
  content: string;
  tokensUsed: number;
  cost: number;
}

/**
 * 인라인 콘텐츠 생성 클래스
 */
export class InlineContentGenerator {
  private gptService: GPTService;

  constructor() {
    this.gptService = new GPTService();
  }

  /**
   * 단일 셀/텍스트에 대한 콘텐츠 생성
   */
  async generateContent(
    context: InlineGenerationContext,
    userRequest: string
  ): Promise<InlineGenerationResult> {
    logger.info('🤖 인라인 AI 생성 시작...');
    logger.info(`   요청: "${userRequest}"`);

    try {
      // 프롬프트 빌드
      const prompt = this.buildPrompt(context, userRequest);

      // GPT API 호출 (일반 텍스트 모드)
      const response = await this.gptService.generateContent(prompt);

      logger.info(`✅ 생성 완료 (${response.tokensUsed} 토큰)`);

      return {
        content: response.content.trim(),
        tokensUsed: response.tokensUsed,
        cost: response.cost,
      };
    } catch (error) {
      logger.error('❌ 인라인 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 프롬프트 빌드
   */
  private buildPrompt(
    context: InlineGenerationContext,
    userRequest: string
  ): string {
    const parts: string[] = [];

    // 시스템 메시지
    parts.push('당신은 교육 문서 작성 전문가입니다. 간결하고 명확한 내용을 생성합니다.');
    parts.push('');

    // 문서 타입
    if (context.documentType) {
      parts.push(`📄 문서 타입: ${context.documentType}`);
      parts.push('');
    }

    // 컨텍스트 정보
    if (context.rowHeaders && context.rowHeaders.length > 0) {
      parts.push('📌 행 헤더 (참고):');
      context.rowHeaders.forEach((header, i) => {
        parts.push(`  ${i + 1}. ${header}`);
      });
      parts.push('');
    }

    if (context.colHeaders && context.colHeaders.length > 0) {
      parts.push('📌 열 헤더 (참고):');
      context.colHeaders.forEach((header, i) => {
        parts.push(`  ${i + 1}. ${header}`);
      });
      parts.push('');
    }

    if (context.nearbyContent && context.nearbyContent.length > 0) {
      parts.push('📌 주변 내용 (참고):');
      context.nearbyContent.forEach((content, i) => {
        if (content.trim()) {
          parts.push(`  ${i + 1}. ${content.trim()}`);
        }
      });
      parts.push('');
    }

    // 현재 내용
    if (context.cellContent && context.cellContent.trim()) {
      parts.push(`📝 현재 내용: "${context.cellContent.trim()}"`);
      parts.push('');
    }

    // 사용자 요청
    parts.push('🎯 사용자 요청:');
    parts.push(userRequest);
    parts.push('');

    // 출력 가이드
    parts.push('📋 생성 가이드:');
    parts.push('1. 행/열 헤더와 주변 내용을 참고하여 일관성을 유지하세요');
    parts.push('2. 교육적이고 실용적인 내용으로 작성하세요');
    parts.push('3. 간결하고 명확하게 작성하세요 (50-200자 권장)');
    parts.push('4. 추가 설명 없이 내용만 출력하세요');
    parts.push('');
    parts.push('---');
    parts.push('');
    parts.push('생성할 내용:');

    return parts.join('\n');
  }

  /**
   * 샘플 컨텍스트 생성 (테이블 셀용)
   */
  static createTableCellContext(
    currentContent: string,
    rowHeaders: string[],
    colHeaders: string[],
    nearbyContent: string[]
  ): InlineGenerationContext {
    return {
      cellContent: currentContent,
      rowHeaders,
      colHeaders,
      nearbyContent,
    };
  }

  /**
   * 샘플 컨텍스트 생성 (일반 텍스트용)
   */
  static createParagraphContext(
    currentContent: string,
    documentType?: string
  ): InlineGenerationContext {
    return {
      cellContent: currentContent,
      documentType,
    };
  }
}

export default InlineContentGenerator;

