/**
 * GPT Service
 * OpenAI GPT API 통신 서비스 (맥락 기반 프롬프트)
 * 
 * @module lib/ai/gpt-service
 * @version 2.0.0
 * @reference ref/hwp_hwpx_viewer/src/ai/gpt-content-generator.js
 * @description 문서 구조와 맥락을 완전히 이해하여 최적의 콘텐츠 생성
 */

import { AIConfig } from './ai-config';
import { getLogger } from '../utils/logger';
import type { EnhancedDocumentStructure } from './structure-extractor';

const logger = getLogger();

/**
 * GPT API 응답 인터페이스
 */
interface GPTResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * GPT 생성 결과
 */
export interface GPTGenerationResult {
  content: Record<string, string>;
  metadata: {
    model: string;
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
    cost: number;
  };
}

/**
 * GPT 서비스 클래스 (맥락 인식 강화)
 */
export class GPTService {
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokensUsed: 0,
    totalCost: 0
  };

  /**
   * 향상된 구조 기반 콘텐츠 생성
   */
  async generateWithEnhancedStructure(
    structure: EnhancedDocumentStructure,
    userRequest: string
  ): Promise<GPTGenerationResult> {
    logger.info('🤖 맥락 기반 GPT 콘텐츠 생성 시작...');
    logger.info(`   문서 타입: ${structure.documentType}`);
    logger.info(`   항목 수: ${structure.pairs.length}개`);
    logger.info(`   컨텍스트 샘플: ${structure.contextSamples.length}개`);
    
    this.stats.totalRequests++;

    try {
      // 1. 향상된 프롬프트 빌드
      const messages = this.buildEnhancedPrompt(structure, userRequest);

      // 2. API 호출
      const response = await this.callAPIWithRetry(messages);

      // 3. 응답 파싱
      const result = this.parseResponse(response);

      // 4. 통계 업데이트
      this.updateStatistics(response);
      this.stats.successfulRequests++;

      logger.info(`✅ GPT 생성 완료: ${Object.keys(result.content).length}개 항목`);
      logger.info(`   토큰: ${result.metadata.tokensUsed}, 비용: $${result.metadata.cost.toFixed(4)}`);

      return result;
    } catch (error) {
      this.stats.failedRequests++;
      logger.error('❌ GPT 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 단순 텍스트 프롬프트로 콘텐츠 생성
   * (선택적 생성에 사용)
   */
  async generateContent(
    prompt: string,
    options: {
      apiKey: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<{
    content: string;
    tokensUsed: number;
    cost: number;
  }> {
    logger.info('🤖 GPT 콘텐츠 생성 시작...');
    
    this.stats.totalRequests++;

    try {
      // API 호출 - JSON 형식 강제하지 않음
      const messages = [
        {
          role: 'user' as const,
          content: prompt
        }
      ];
      
      // response_format 없이 호출 (일반 텍스트 모드)
      const response = await this.callAPIWithRetry(
        messages, 
        options.apiKey, 
        false // useJsonMode = false
      );
      
      // 통계 업데이트
      this.updateStatistics(response);
      this.stats.successfulRequests++;
      
      const content = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const cost = (promptTokens * AIConfig.costManagement.costPerInputToken) +
                   (completionTokens * AIConfig.costManagement.costPerOutputToken);
      
      logger.info(`✅ GPT 생성 완료: ${tokensUsed} 토큰 사용`);
      
      return {
        content,
        tokensUsed,
        cost
      };
    } catch (error) {
      this.stats.failedRequests++;
      logger.error('❌ GPT 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 향상된 프롬프트 빌드
   */
  private buildEnhancedPrompt(
    structure: EnhancedDocumentStructure,
    userRequest: string
  ): Array<{ role: string; content: string }> {
    // System Message: 문서 타입에 맞춘 전문가 역할
    const systemMessage = this.buildSystemMessage(structure);
    
    // User Message: 풍부한 컨텍스트 정보
    const userMessage = this.buildUserMessage(structure, userRequest);

    return [
      {
        role: 'system',
        content: systemMessage
      },
      {
        role: 'user',
        content: userMessage
      }
    ];
  }

  /**
   * 시스템 메시지 생성 (문서 타입별 맞춤)
   */
  private buildSystemMessage(structure: EnhancedDocumentStructure): string {
    const docTypeName = this.getDocumentTypeName(structure.documentType);
    const styleGuide = this.getStyleGuide(structure.characteristics.dominantStyle);

    return `당신은 **${docTypeName} 작성 전문가**입니다.

## 🎯 핵심 원칙

### 1. 구조 절대 유지
- ❌ 표 레이아웃 변경 금지
- ❌ 헤더 이름 변경 금지  
- ✅ 오직 내용만 변경

### 2. 맥락 완전 이해
- 📊 문서 전체의 구조와 흐름 파악
- 🔗 항목 간 관계와 연관성 고려
- 📏 원본과 동일한 스타일과 길이 유지

### 3. 내용 품질
${styleGuide}
- 실제 ${docTypeName}에서 사용 가능한 수준의 구체성
- 자연스럽고 전문적인 문장 구성

### 4. 연관성 유지
${structure.characteristics.hasTimeSequence 
  ? '- 시간 순서에 따라 점진적으로 발전하는 내용' 
  : ''}
${structure.characteristics.hasRepetitiveStructure 
  ? '- 반복 구조에서 각 단위별로 적절히 변화하는 내용' 
  : ''}
${structure.relationships.some(r => r.type === 'same-row')
  ? '- 같은 행의 항목들은 내용적으로 연결되고 일관성 유지'
  : ''}

## 📋 응답 형식
반드시 **JSON 객체**로 응답하세요:
\`\`\`json
{
  "항목1": "생성된 내용1",
  "항목2": "생성된 내용2"
}
\`\`\`

다른 텍스트나 설명 없이 순수 JSON만 반환하세요.`;
  }

  /**
   * 사용자 메시지 생성 (풍부한 컨텍스트)
   */
  private buildUserMessage(
    structure: EnhancedDocumentStructure,
    userRequest: string
  ): string {
    // 1. 문서 개요
    const overview = this.buildDocumentOverview(structure);
    
    // 2. 구조 분석
    const structureAnalysis = this.buildStructureAnalysis(structure);
    
    // 3. 원본 컨텍스트 예시
    const contextExamples = this.buildContextExamples(structure);
    
    // 4. 항목 간 관계 설명
    const relationships = this.buildRelationshipsDescription(structure);
    
    // 5. 생성 가이드라인
    const guidelines = this.buildGenerationGuidelines(structure);
    
    // 6. 생성할 항목 목록
    const itemsList = this.buildItemsList(structure);

    return `# 📄 문서 정보

${overview}

---

# 🏗️ 문서 구조 분석

${structureAnalysis}

---

# 📝 원본 내용 스타일 예시

${contextExamples}

**⚠️ 중요: 위 예시를 참고하여 비슷한 톤, 길이, 스타일로 작성하세요!**

---

# 🔗 항목 간 관계

${relationships}

---

# 📐 생성 가이드라인

${guidelines}

---

# 🎯 사용자 요청

**"${userRequest}"**

---

# 📋 생성할 항목 목록 (${structure.pairs.length}개)

${itemsList}

---

# 💡 응답 형식

\`\`\`json
{
${structure.pairs.slice(0, 3).map(p => `  "${p.header}": "생성된 내용"`).join(',\n')}${structure.pairs.length > 3 ? ',\n  ...' : ''}
}
\`\`\`

**모든 항목에 대해 위 형식으로 JSON 응답을 생성하세요.**`;
  }

  /**
   * 문서 개요 생성
   */
  private buildDocumentOverview(structure: EnhancedDocumentStructure): string {
    const docTypeName = this.getDocumentTypeName(structure.documentType);
    
    let overview = `- **문서 유형**: ${docTypeName}`;
    
    if (structure.title) {
      overview += `\n- **제목**: ${structure.title}`;
    }
    
    if (structure.tableStructure) {
      const ts = structure.tableStructure;
      overview += `\n- **구조**: ${ts.totalRows}행 × ${ts.totalColumns}열 표 형식`;
      
      if (ts.columnHeaders.length > 0) {
        overview += `\n- **시간 구분**: ${ts.columnHeaders.join(', ')}`;
      }
    }
    
    overview += `\n- **항목 수**: ${structure.pairs.length}개`;
    overview += `\n- **평균 길이**: 약 ${structure.characteristics.averageContentLength}자`;
    
    return overview;
  }

  /**
   * 구조 분석 설명 생성
   */
  private buildStructureAnalysis(structure: EnhancedDocumentStructure): string {
    const { characteristics, tableStructure } = structure;
    let analysis = '';

    if (characteristics.hasTimeSequence) {
      analysis += '✅ **시간 순서 구조**: 이 문서는 시간 순서(주차/일자/차시)에 따라 구성되어 있습니다.\n';
      analysis += '   → 각 시간대별로 내용이 자연스럽게 발전해야 합니다.\n\n';
    }

    if (characteristics.hasRepetitiveStructure) {
      analysis += '✅ **반복 구조**: 동일한 형식이 여러 단위로 반복됩니다.\n';
      analysis += '   → 각 단위별로 내용은 다르지만 스타일은 일관되어야 합니다.\n\n';
    }

    if (characteristics.hasCategorization) {
      analysis += '✅ **카테고리 분류**: 여러 카테고리로 분류된 항목들이 있습니다.\n';
      analysis += '   → 각 카테고리 내에서 일관성을 유지하세요.\n\n';
    }

    if (tableStructure && tableStructure.columnHeaders.length > 0) {
      analysis += `📊 **열 구성**: ${tableStructure.columnHeaders.join(' | ')}\n`;
      analysis += '   → 각 열은 동일한 주제의 다른 시점/단계를 나타냅니다.\n\n';
    }

    return analysis.trim() || '기본 표 형식 문서입니다.';
  }

  /**
   * 컨텍스트 예시 생성
   */
  private buildContextExamples(structure: EnhancedDocumentStructure): string {
    if (structure.contextSamples.length === 0) {
      return '(원본 내용 예시 없음)';
    }

    let examples = '';
    
    structure.contextSamples.slice(0, 5).forEach((sample, index) => {
      const styleEmoji = {
        'detailed': '📄',
        'brief': '💬',
        'list': '📝',
        'structured': '📊'
      }[sample.contentStyle];
      
      examples += `\n### ${styleEmoji} 예시 ${index + 1}: "${sample.header}"\n`;
      examples += `**스타일**: ${this.getStyleDescription(sample.contentStyle)}\n`;
      examples += `**길이**: ${sample.contentLength}자\n`;
      
      if (sample.hasBullets) {
        examples += `**형식**: 목록형 (불릿 포인트 사용)\n`;
      }
      if (sample.hasLineBreaks) {
        examples += `**형식**: 여러 줄 (줄바꿈 포함)\n`;
      }
      
      // 내용 일부만 표시
      const preview = sample.originalContent.length > 150 
        ? sample.originalContent.substring(0, 150) + '...'
        : sample.originalContent;
      
      examples += `\n\`\`\`\n${preview}\n\`\`\`\n`;
    });

    return examples;
  }

  /**
   * 관계 설명 생성
   */
  private buildRelationshipsDescription(structure: EnhancedDocumentStructure): string {
    if (structure.relationships.length === 0) {
      return '각 항목은 독립적입니다.';
    }

    let desc = '';
    
    structure.relationships.forEach(rel => {
      const icon = {
        'same-row': '↔️',
        'same-column': '↕️',
        'sequential': '➡️',
        'hierarchical': '🔽'
      }[rel.type];
      
      desc += `\n${icon} **${rel.description || '관련 항목'}**\n`;
      desc += `   항목들: ${rel.items.slice(0, 3).join(', ')}${rel.items.length > 3 ? ' 등' : ''}\n`;
      
      if (rel.type === 'same-row') {
        desc += `   💡 이 항목들은 같은 주제에 대한 시간대별/단계별 내용으로 자연스럽게 이어져야 합니다.\n`;
      } else if (rel.type === 'sequential') {
        desc += `   💡 순차적으로 진행되므로 앞 내용을 고려하여 작성하세요.\n`;
      }
    });

    return desc.trim();
  }

  /**
   * 생성 가이드라인 작성
   */
  private buildGenerationGuidelines(structure: EnhancedDocumentStructure): string {
    const { generationGuide, characteristics } = structure;
    let guidelines = '';

    generationGuide.contextualHints.forEach((hint, index) => {
      guidelines += `${index + 1}. ${hint}\n`;
    });

    if (generationGuide.shouldMaintainContinuity) {
      guidelines += `\n⚠️ **연속성 필수**: 같은 행의 항목들은 내용적으로 연결되어야 합니다.\n`;
    }

    if (generationGuide.shouldVaryContent) {
      guidelines += `\n⚠️ **내용 변화**: 각 단위별로 내용이 달라야 하지만 주제는 연관되어야 합니다.\n`;
    }

    if (characteristics.averageContentLength > 0) {
      const lengthRange = `${Math.round(characteristics.averageContentLength * 0.8)}-${Math.round(characteristics.averageContentLength * 1.2)}자`;
      guidelines += `\n📏 **길이 가이드**: 각 항목은 대략 ${lengthRange} 정도가 적절합니다.\n`;
    }

    return guidelines.trim() || '일반적인 작성 규칙을 따르세요.';
  }

  /**
   * 항목 리스트 생성
   */
  private buildItemsList(structure: EnhancedDocumentStructure): string {
    return structure.pairs.map((p, i) => {
      const rowInfo = structure.relationships.find(r => 
        r.type === 'same-row' && r.items.includes(p.header)
      );
      
      let line = `${i + 1}. **${p.header}**`;
      
      if (rowInfo) {
        const sameRowItems = rowInfo.items.filter(item => item !== p.header);
        if (sameRowItems.length > 0) {
          line += ` ↔️ (연관: ${sameRowItems[0]}${sameRowItems.length > 1 ? ' 등' : ''})`;
        }
      }
      
      return line;
    }).join('\n');
  }

  /**
   * 문서 타입 이름 가져오기
   */
  private getDocumentTypeName(type: EnhancedDocumentStructure['documentType']): string {
    const typeNames: Record<typeof type, string> = {
      'monthly': '월간계획안',
      'weekly': '주간계획안',
      'daily': '일일계획안',
      'lesson': '수업계획안',
      'report': '보고서',
      'form': '양식',
      'unknown': '문서'
    };
    return typeNames[type] || '문서';
  }

  /**
   * 스타일 가이드 가져오기
   */
  private getStyleGuide(style: EnhancedDocumentStructure['characteristics']['dominantStyle']): string {
    const guides: Record<typeof style, string> = {
      'educational': '- 교육적이고 발달단계에 적합한 내용\n- 구체적인 활동과 목표 제시\n- 전문 교육자가 작성한 수준의 품질',
      'formal': '- 격식체 사용 (합니다, 됩니다)\n- 전문적이고 정확한 용어\n- 공식 문서 수준의 품질',
      'casual': '- 자연스럽고 읽기 쉬운 문체\n- 일상적인 표현 활용\n- 친근하지만 전문적인 톤',
      'technical': '- 정확한 기술 용어 사용\n- 논리적이고 체계적인 서술\n- 전문가 수준의 정보'
    };
    return guides[style];
  }

  /**
   * 스타일 설명 가져오기
   */
  private getStyleDescription(style: string): string {
    const descriptions: Record<string, string> = {
      'detailed': '상세형 (긴 설명)',
      'brief': '간략형 (짧은 설명)',
      'list': '목록형 (항목 나열)',
      'structured': '구조화 (여러 단락)'
    };
    return descriptions[style] || style;
  }

  /**
   * API 호출 (재시도 로직 포함)
   */
  private async callAPIWithRetry(
    messages: Array<{ role: string; content: string }>,
    apiKey?: string,
    useJsonMode: boolean = true
  ): Promise<GPTResponse> {
    const { maxAttempts, delayMs, backoffMultiplier } = AIConfig.openai.retry;
    
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(`🔄 API 호출 시도 ${attempt}/${maxAttempts}`);
        return await this.callAPI(messages, apiKey, useJsonMode);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
          logger.warn(`⚠️  시도 ${attempt} 실패, ${delay}ms 후 재시도...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('API 호출 실패');
  }

  /**
   * API 호출 (단일 시도)
   */
  private async callAPI(
    messages: Array<{ role: string; content: string }>,
    providedApiKey?: string,
    useJsonMode: boolean = true
  ): Promise<GPTResponse> {
    const apiKey = providedApiKey || AIConfig.openai.getApiKey();
    
    if (!apiKey) {
      throw new Error(AIConfig.prompts.errorMessages.noApiKey);
    }

    const requestBody: any = {
      model: AIConfig.openai.model,
      messages,
      temperature: AIConfig.openai.temperature,
      max_tokens: AIConfig.openai.maxTokens
    };
    
    // JSON 모드는 선택적으로만 사용
    if (useJsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AIConfig.openai.timeout);

    try {
      const response = await fetch(AIConfig.openai.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || response.statusText;
        throw new Error(`API 오류 (${response.status}): ${errorMsg}`);
      }

      const data = await response.json();
      return data as GPTResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if ((error as Error).name === 'AbortError') {
        throw new Error(AIConfig.prompts.errorMessages.timeout);
      }
      
      throw error;
    }
  }

  /**
   * 응답 파싱
   */
  private parseResponse(apiResponse: GPTResponse): GPTGenerationResult {
    if (!apiResponse.choices || apiResponse.choices.length === 0) {
      throw new Error('API 응답에 choices가 없습니다');
    }

    const content = apiResponse.choices[0].message?.content;
    
    if (!content) {
      throw new Error('API 응답에 content가 없습니다');
    }

    // JSON 파싱
    let parsedContent: Record<string, string>;
    try {
      // ```json ... ``` 블록 제거
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedContent = JSON.parse(jsonStr);
    } catch (error) {
      logger.error('JSON 파싱 실패:', content);
      throw new Error(`JSON 파싱 실패: ${(error as Error).message}`);
    }

    // 통계
    const tokensUsed = apiResponse.usage?.total_tokens || 0;
    const promptTokens = apiResponse.usage?.prompt_tokens || 0;
    const completionTokens = apiResponse.usage?.completion_tokens || 0;
    
    const cost = (promptTokens * AIConfig.costManagement.costPerInputToken) +
                 (completionTokens * AIConfig.costManagement.costPerOutputToken);

    return {
      content: parsedContent,
      metadata: {
        model: apiResponse.model,
        tokensUsed,
        promptTokens,
        completionTokens,
        cost
      }
    };
  }

  /**
   * 통계 업데이트
   */
  private updateStatistics(apiResponse: GPTResponse): void {
    const tokensUsed = apiResponse.usage?.total_tokens || 0;
    const promptTokens = apiResponse.usage?.prompt_tokens || 0;
    const completionTokens = apiResponse.usage?.completion_tokens || 0;
    
    this.stats.totalTokensUsed += tokensUsed;
    
    const cost = (promptTokens * AIConfig.costManagement.costPerInputToken) +
                 (completionTokens * AIConfig.costManagement.costPerOutputToken);
    this.stats.totalCost += cost;

    logger.debug(`💰 이번 요청 비용: $${cost.toFixed(4)}`);
    logger.debug(`💰 총 비용: $${this.stats.totalCost.toFixed(4)}`);

    // 비용 경고
    if (this.stats.totalCost > AIConfig.costManagement.warningThreshold) {
      logger.warn(`⚠️  비용 경고: $${this.stats.totalCost.toFixed(2)}`);
    }
  }

  /**
   * 통계 조회
   */
  getStatistics() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 
        ? `${(this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)}%`
        : 'N/A',
      averageTokensPerRequest: this.stats.successfulRequests > 0
        ? Math.round(this.stats.totalTokensUsed / this.stats.successfulRequests)
        : 0
    };
  }

  /**
   * Sleep 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default GPTService;
