/**
 * Prompt Builder
 * GPT API를 위한 프롬프트 생성 및 최적화
 * 
 * @module ai/prompt-builder
 * @version 2.1.0
 */

import { getLogger } from '../utils/logger.js';
import { AIConfig } from '../config/ai-config.js';

const logger = getLogger();

/**
 * 프롬프트 빌더 클래스
 * 문서 구조와 사용자 요청을 기반으로 GPT 프롬프트 생성
 * 
 * @example
 * const builder = new PromptBuilder();
 * const messages = builder.buildPrompt(structure, '쉽게 바꿔줘');
 */
export class PromptBuilder {
    /**
     * PromptBuilder 생성자
     * @param {Object} [options={}] - 빌더 옵션
     */
    constructor(options = {}) {
        this.options = {
            systemMessage: options.systemMessage || AIConfig.prompts.systemMessage,
            userMessageTemplate: options.userMessageTemplate || AIConfig.prompts.userMessageTemplate,
            maxStructureTokens: options.maxStructureTokens || 2000,
            ...options
        };
        
        logger.info('📝 PromptBuilder initialized');
    }
    
    /**
     * 프롬프트 빌드 (메인 메서드)
     * @param {Object} extractedData - 추출된 문서 구조 및 텍스트 슬롯
     * @param {string} userRequest - 사용자 요청
     * @returns {Array} OpenAI Chat API 메시지 배열
     * 
     * @example
     * const messages = builder.buildPrompt({ structure, textSlots }, '초등학생이 이해할 수 있게');
     */
    buildPrompt(extractedData, userRequest) {
        logger.info('📝 Building prompt...');
        logger.time('Prompt Build');
        
        // 구조 최적화 (토큰 절약)
        const optimizedStructure = this.optimizeStructure(extractedData);
        
        // 구조 JSON 직렬화
        const structureJson = JSON.stringify(optimizedStructure, null, 2);
        
        // System message
        const systemMessage = {
            role: 'system',
            content: this.options.systemMessage
        };
        
        // User message (템플릿 치환)
        const userMessage = {
            role: 'user',
            content: this.options.userMessageTemplate
                .replace('{STRUCTURE}', structureJson)
                .replace('{REQUEST}', userRequest)
        };
        
        const messages = [systemMessage, userMessage];
        
        // 토큰 수 추정
        const estimatedTokens = this.estimateTokens(messages);
        logger.info(`📊 Estimated tokens: ${estimatedTokens}`);
        
        logger.timeEnd('Prompt Build');
        
        return messages;
    }
    
    /**
     * 구조화된 프롬프트 빌드 (헤더-내용 쌍 기반)
     * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍 배열
     * @param {string} userRequest - 사용자 요청
     * @returns {Array} OpenAI Chat API 메시지 배열
     */
    buildStructuredPrompt(headerContentPairs, userRequest) {
        logger.info('📝 Building structured prompt...');
        logger.time('Structured Prompt Build');

        // 단락 기반 문서인지 판별
        const isParagraphBased = headerContentPairs.length > 0 &&
            headerContentPairs[0]?.path?.type === 'paragraph';

        if (isParagraphBased) {
            return this.buildParagraphPrompt(headerContentPairs, userRequest);
        }

        // 헤더-내용 쌍을 객체로 변환
        const contentMap = {};
        headerContentPairs.forEach(pair => {
            contentMap[pair.header] = pair.content || '(비어있음)';
        });
        
        // System message (v3.0: 범용 문서 지원)
        const systemMessage = {
            role: 'system',
            content: `당신은 문서 작성 전문가입니다. 테이블 형식 문서의 각 항목을 분석하고 적절한 내용을 생성합니다.

**역할**:
- 테이블의 각 항목(제목)에 대해 적절한 내용을 생성하거나 수정
- 빈 항목("(비어있음)")은 반드시 채워야 함
- 기존 내용이 있는 항목은 사용자 요청에 맞게 개선
- 문서의 맥락과 용도에 맞는 전문적인 내용 작성

**응답 형식**: 반드시 JSON만 응답
{
  "항목1": "생성된 내용",
  "항목2": "생성된 내용",
  ...
}

**중요 규칙**:
1. 반드시 JSON 형식으로만 응답 (다른 텍스트 금지)
2. 입력에 있는 **모든 키**를 포함해야 함
3. 키 이름은 절대 변경하지 마세요
4. 한글 문법과 맞춤법 준수
5. 각 항목은 해당 문서의 맥락에 맞게 구체적으로 작성
6. 내용이 긴 항목은 줄바꿈(\\n)으로 구분하여 가독성을 높여주세요`
        };

        // User message (v3.0: 범용)
        const userMessage = {
            role: 'user',
            content: `다음 문서의 각 항목을 사용자 요청에 맞게 작성/수정해주세요.

**현재 문서 구조** (JSON):
${JSON.stringify(contentMap, null, 2)}

**사용자 요청**:
${userRequest}

**지시사항**:
1. 위의 모든 키(${Object.keys(contentMap).join(', ')})를 응답에 포함하세요
2. "(비어있음)" 항목은 반드시 적절한 내용으로 채우세요
3. 기존 내용이 있는 항목은 사용자 요청에 맞게 수정하세요
4. 각 항목의 제목/성격에 맞는 내용을 생성하세요
5. JSON 형식으로만 응답하세요`
        };
        
        const messages = [systemMessage, userMessage];
        
        // 토큰 수 추정
        const estimatedTokens = this.estimateTokens(messages);
        logger.info(`📊 Structured prompt tokens: ${estimatedTokens}`);
        logger.info(`📊 Total pairs: ${headerContentPairs.length}`);
        
        logger.timeEnd('Structured Prompt Build');
        
        return messages;
    }
    
    /**
     * 단락(paragraph) 기반 문서용 프롬프트 빌드
     * @param {Array<Object>} headerContentPairs - 단락 쌍 배열
     * @param {string} userRequest - 사용자 요청
     * @returns {Array} OpenAI Chat API 메시지 배열
     * @private
     */
    buildParagraphPrompt(headerContentPairs, userRequest) {
        // 단락 내용을 키-값 맵으로 변환
        const contentMap = {};
        headerContentPairs.forEach(pair => {
            contentMap[pair.header] = pair.content || '(비어있음)';
        });

        const systemMessage = {
            role: 'system',
            content: `당신은 문서 편집 전문가입니다. 사용자의 요청에 따라 문서의 각 단락을 수정합니다.

**역할**:
- 주어진 단락들을 사용자의 요청에 맞게 수정
- 각 단락의 키(key)를 그대로 유지하면서 내용만 변경

**응답 형식 (JSON)**:
입력과 동일한 키를 사용하여 수정된 내용을 반환하세요.
{
  "paragraph_0_0": "수정된 내용1",
  "paragraph_0_1": "수정된 내용2",
  ...
}

**중요 규칙**:
1. 반드시 JSON 형식으로만 응답
2. 입력에 있는 **모든 키를 그대로** 포함해야 함 (키 이름 변경 금지!)
3. 한글 문법과 맞춤법 준수
4. 다른 텍스트 포함 금지 (JSON만)`
        };

        const userMessage = {
            role: 'user',
            content: `다음 문서의 단락들을 수정해주세요:

**현재 문서 내용**:
${JSON.stringify(contentMap, null, 2)}

**사용자 요청**:
${userRequest}

**필수 지시사항**:
1. 위의 모든 키(${Object.keys(contentMap).join(', ')})를 응답에 포함하세요
2. 키 이름은 절대 변경하지 마세요 (예: "paragraph_0_0" → "paragraph_0_0")
3. 각 단락의 내용을 사용자 요청에 맞게 수정하세요
4. 응답은 JSON 형식으로만 제공하세요`
        };

        const messages = [systemMessage, userMessage];

        const estimatedTokens = this.estimateTokens(messages);
        logger.info(`📊 Paragraph prompt tokens: ${estimatedTokens}`);
        logger.info(`📊 Total pairs: ${headerContentPairs.length}`);

        logger.timeEnd('Structured Prompt Build');

        return messages;
    }

    /**
     * 구조 최적화 (토큰 절약)
     * 불필요한 정보 제거, 구조만 유지
     * @param {Object} extractedData - 추출된 데이터
     * @returns {Object} 최적화된 구조
     * @private
     */
    optimizeStructure(extractedData) {
        const { structure, textSlots } = extractedData;
        
        // 🔥 특급 최적화: 텍스트 길이 제한으로 토큰 대폭 절약
        const MAX_TEXT_LENGTH = 150; // 긴 텍스트는 150자로 제한
        
        // 🔥 특급 필터링: 헤더(제목) 셀은 제외하고 내용 셀만 포함
        let headerCount = 0;
        let contentCount = 0;
        
        // 텍스트 슬롯 맵을 배열로 변환 (간결함)
        const slots = Array.from(textSlots.entries())
            .filter(([slotId, slotData]) => {
                // 헤더는 제외 (제목은 변경하지 않음)
                const isHeader = slotData.context?.isHeader === true;
                
                if (isHeader) {
                    headerCount++;
                    logger.debug(`  🏷️  Skipping HEADER slot: "${slotData.text.substring(0, 30)}..."`);
                    return false;  // 헤더는 GPT에 보내지 않음
                }
                
                contentCount++;
                return true;  // 내용만 GPT에 전송
            })
            .map(([slotId, slotData]) => {
                let optimizedText = slotData.text;
                
                // 긴 텍스트는 잘라내기 (토큰 절약)
                if (optimizedText.length > MAX_TEXT_LENGTH) {
                    optimizedText = optimizedText.substring(0, MAX_TEXT_LENGTH) + '...';
                }
                
                return {
                    slotId: slotId,
                    text: optimizedText,
                    // context는 제거 (불필요)
                };
            });
        
        logger.info(`  📊 Filtered slots: ${headerCount} headers skipped, ${contentCount} content slots sent to GPT`);
        
        // 🔥 특급 최적화: 구조 정보는 최소화 - ID만 남김
        const optimizedStructure = {
            // 통계 정보만 유지 (구조 세부 정보 제거)
            totalSlots: slots.length,
            totalSections: structure.sections.length,
            // sections 세부 정보 제거 - 필요없음
            textSlots: slots
        };
        
        return optimizedStructure;
    }
    
    /**
     * 요소 최적화
     * @param {Object} element - 요소 객체
     * @returns {Object} 최적화된 요소
     * @private
     */
    optimizeElement(element) {
        if (element.type === 'paragraph') {
            return {
                type: 'paragraph',
                id: element.id,
                textRuns: element.textRuns.map(run => {
                    if (run.slotId) {
                        return {
                            slotId: run.slotId
                            // 스타일, 원본 텍스트는 제외 (토큰 절약)
                        };
                    } else {
                        return {
                            type: run.type
                        };
                    }
                })
            };
        } else if (element.type === 'table') {
            return {
                type: 'table',
                id: element.id,
                rows: element.rows.map(row => ({
                    id: row.id,
                    cells: row.cells.map(cell => ({
                        id: cell.id,
                        elements: cell.elements.map(cellElement =>
                            this.optimizeElement(cellElement)
                        )
                    }))
                }))
            };
        } else {
            // 이미지, 도형 등은 ID만
            return {
                type: element.type,
                id: element.id
            };
        }
    }
    
    /**
     * 토큰 수 추정 (대략적)
     * 1 token ≈ 4 characters (영어 기준)
     * 한글은 약 1.5-2 characters per token
     * @param {Array} messages - 메시지 배열
     * @returns {number} 추정 토큰 수
     * @private
     */
    estimateTokens(messages) {
        let totalChars = 0;
        
        messages.forEach(msg => {
            totalChars += msg.content.length;
        });
        
        // 한글이 많은 경우 토큰 수가 더 많음
        // 보수적으로 2 characters per token으로 계산
        return Math.ceil(totalChars / 2);
    }
    
    /**
     * 프롬프트 검증
     * @param {Array} messages - 메시지 배열
     * @returns {Object} 검증 결과
     */
    validatePrompt(messages) {
        const errors = [];
        const warnings = [];
        
        if (!messages || messages.length === 0) {
            errors.push('메시지 배열이 비어있습니다');
            return { isValid: false, errors, warnings };
        }
        
        // System message 확인
        if (!messages.find(m => m.role === 'system')) {
            warnings.push('System message가 없습니다');
        }
        
        // User message 확인
        if (!messages.find(m => m.role === 'user')) {
            errors.push('User message가 없습니다');
        }
        
        // 토큰 수 확인
        const tokens = this.estimateTokens(messages);
        if (tokens > AIConfig.openai.maxTokens) {
            warnings.push(`토큰 수가 제한을 초과할 수 있습니다: ${tokens} > ${AIConfig.openai.maxTokens}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            estimatedTokens: tokens
        };
    }
    
    /**
     * 디버그 정보 출력
     * @param {Array} messages - 메시지 배열
     */
    debugPrompt(messages) {
        logger.debug('📋 Prompt Debug Info:');
        messages.forEach((msg, idx) => {
            logger.debug(`  Message ${idx + 1} (${msg.role}):`);
            logger.debug(`    Length: ${msg.content.length} characters`);
            logger.debug(`    Preview: ${msg.content.substring(0, 100)}...`);
        });
    }
    
    /**
     * 🔥 특급 기능: 항목 기반 프롬프트 빌드
     * 테이블 구조 분석 결과를 기반으로 명확한 프롬프트 생성
     * 
     * @param {Object} tableStructure - 테이블 구조 분석 결과
     * @param {string} userRequest - 사용자 요청
     * @returns {Array} OpenAI Chat API 메시지 배열
     */
    buildItemBasedPrompt(tableStructure, userRequest) {
        logger.info('📝 Building item-based prompt...');
        logger.time('Item-Based Prompt Build');
        
        const { items } = tableStructure;
        
        // System message (항목 기반)
        const systemMessage = {
            role: 'system',
            content: `당신은 한글 문서의 테이블 항목을 채우는 전문가입니다.

**역할**:
- 주어진 소제목(label)에 맞는 적절한 내용을 생성
- 각 항목은 독립적으로 처리
- 내용은 간결하고 명확하게 (50-100자 권장)

**응답 형식 (JSON)**:
{
  "items": [
    {
      "id": "item-xxx",
      "content": "생성된 내용"
    }
  ]
}

**중요 규칙**:
1. 모든 항목에 대해 내용을 생성하세요
2. id는 반드시 입력값 그대로 유지하세요
3. 한글 문법과 맞춤법을 정확히 지켜주세요
4. 내용은 소제목과 관련성이 높아야 합니다
5. 항상 JSON 형식으로만 응답하세요`
        };
        
        // 항목 목록을 JSON으로 구조화
        const itemsData = items.map(item => ({
            id: item.id,
            label: item.label,
            currentContent: item.currentContent || '',
            isEmpty: item.isEmpty
        }));
        
        const itemsJson = JSON.stringify(itemsData, null, 2);
        
        // User message
        const userMessage = {
            role: 'user',
            content: `다음 테이블 항목들에 내용을 채워주세요:

${itemsJson}

사용자 요청: ${userRequest}

위 항목들에 대해 사용자 요청을 반영하여 적절한 내용을 생성해주세요.
응답은 JSON 형식으로만 제공하세요.`
        };
        
        const messages = [systemMessage, userMessage];
        
        // 토큰 수 추정
        const estimatedTokens = this.estimateTokens(messages);
        logger.info(`📊 Estimated tokens: ${estimatedTokens}`);
        logger.info(`📋 Total items to fill: ${items.length}`);
        
        logger.timeEnd('Item-Based Prompt Build');
        
        return messages;
    }

    /**
     * 다중 페이지용 구조화된 프롬프트 빌드
     * @param {Object} multiPageAnalysis - 페이지 분석 결과
     * @param {Array} allPagesData - 모든 페이지의 데이터
     * @param {string} userRequest - 사용자 요청
     * @returns {Array} 메시지 배열
     */
    buildMultiPagePrompt(multiPageAnalysis, allPagesData, userRequest) {
        logger.info('📝 Building multi-page structured prompt...');
        logger.time('Multi-Page Prompt Build');

        const systemMessage = {
            role: 'system',
            content: `당신은 다중 페이지 문서의 전문가입니다.

**핵심 역할**:
1. 문서 전체의 흐름과 일관성을 유지하면서 각 페이지에 맞는 내용을 생성합니다
2. 각 페이지의 유형과 역할을 이해하고 적절한 스타일로 작성합니다
3. 페이지 간 연관성을 고려하여 전체 문서가 하나의 스토리를 이루도록 합니다

**문서 정보**:
- 총 페이지 수: ${multiPageAnalysis.totalPages}
- 문서 유형: ${multiPageAnalysis.documentType}
- 전체 주제: ${multiPageAnalysis.overallTheme}

**페이지별 특성**:
${multiPageAnalysis.pages.map((page, i) => 
    `페이지 ${page.pageNumber}: ${page.type} - ${page.role}`
).join('\n')}

**페이지 간 관계**:
${multiPageAnalysis.relationships.length > 0 
    ? multiPageAnalysis.relationships.map(rel => 
        `- 페이지 ${rel.from} → 페이지 ${rel.to}: ${rel.note}`
      ).join('\n')
    : '(독립적인 페이지들)'
}

**생성 원칙**:
1. 각 페이지의 특성에 맞는 톤과 스타일을 사용하세요
2. 페이지 간 일관성을 유지하세요 (예: 1페이지 제목과 2페이지 내용 연결)
3. 전문성과 현실성을 갖춘 내용을 생성하세요
4. 각 페이지의 목적을 명확히 달성하세요
5. 모든 빈 필드를 빠짐없이 채워주세요

**응답 형식**:
반드시 JSON 형식으로만 응답하세요. 각 페이지는 별도의 객체로 제공됩니다.`
        };

        const userMessage = {
            role: 'user',
            content: `다음 ${multiPageAnalysis.totalPages}페이지 문서의 모든 빈 칸을 채워주세요.

**사용자 요청**: ${userRequest}

${allPagesData.map((pageData, i) => {
    const pageAnalysis = multiPageAnalysis.pages[i];
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 페이지 ${i + 1}/${multiPageAnalysis.totalPages}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**유형**: ${pageAnalysis.type}
**역할**: ${pageAnalysis.role}
**생성 지침**: ${pageAnalysis.suggestedPrompt}

**현재 구조**:
${JSON.stringify(pageData, null, 2)}
`;
}).join('\n')}

**응답 형식**:
{
  "pages": [
    {
      "pageNumber": 1,
      "content": { 
        "항목명": "생성된 내용",
        ...
      }
    },
    {
      "pageNumber": 2,
      "content": { 
        "항목명": "생성된 내용",
        ...
      }
    }
  ]
}

**중요**: 
- 각 페이지를 독립적이면서도 전체 맥락에 맞게 생성하세요!
- 페이지 간 관계가 있다면 반드시 이를 반영하세요!
- 모든 빈 필드를 반드시 채워주세요!`
        };

        const messages = [systemMessage, userMessage];

        // 토큰 수 추정
        const estimatedTokens = this.estimateTokens(messages);
        logger.info(`📊 Multi-page prompt tokens: ${estimatedTokens}`);
        
        logger.timeEnd('Multi-Page Prompt Build');

        return messages;
    }

    /**
     * AI 친화 문서 교정 프롬프트 빌드
     * 정부 AI 친화 문서 표준에 따라 문서를 교정
     * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍 배열
     * @param {string} userRequest - 사용자 요청
     * @param {string} [documentType='보고서'] - 문서 유형
     * @returns {Array} OpenAI Chat API 메시지 배열
     */
    buildRefinementPrompt(headerContentPairs, userRequest, documentType = '보고서') {
        logger.info('📝 Building AI-friendly refinement prompt...');
        logger.time('Refinement Prompt Build');

        const contentMap = {};
        headerContentPairs.forEach(pair => {
            contentMap[pair.header] = pair.content || '(비어있음)';
        });

        const documentTypeGuide = {
            '보고서': '공공기관 보고서에 적합한 공식적이고 객관적인 문체를 사용하세요.',
            '공문': '공문서 형식에 맞는 격식체를 사용하고, 수신/발신/참조 체계를 준수하세요.',
            '회의록': '회의 진행 순서에 따라 논의사항과 결정사항을 명확히 구분하세요.',
            '설명자료': '독자가 배경지식 없이도 이해할 수 있도록 충분한 설명을 포함하세요.',
            '정책문서': '정책 목표, 추진배경, 기대효과를 논리적으로 연결하세요.',
        };

        const typeGuide = documentTypeGuide[documentType] || documentTypeGuide['보고서'];

        const systemMessage = {
            role: 'system',
            content: `당신은 AI 친화적 문서 교정 전문가입니다. 사람과 AI가 모두 이해할 수 있는 구조화된 문서로 교정합니다.

**문서 유형**: ${documentType}
**문체 지침**: ${typeGuide}

**AI 친화 문서 교정 7대 원칙**:

1. **완전한 문장 작성**: 모든 문장에 주어와 서술어를 반드시 포함합니다.
   - ❌ "AI 친화 문서 필요"
   - ✅ "정부는 AI와 사람이 모두 읽기 쉬운 문서 작성 체계를 구축할 필요가 있다."

2. **개조식 → 서술형 변환**: 단순 나열이나 개조식 표현을 의미가 완결된 서술형 문장으로 변환합니다.
   - ❌ "- 예산 확보\\n- 인력 배치\\n- 시스템 구축"
   - ✅ "본 사업을 추진하기 위해 예산 확보, 인력 배치, 시스템 구축을 단계적으로 진행할 계획이다."

3. **모호한 지시어 제거**: "이것", "그것", "해당", "상기", "전술한" 등을 구체적인 명사로 교체합니다.
   - ❌ "이를 통해 해당 문제를 해결한다"
   - ✅ "디지털 전환 전략을 통해 행정 처리 지연 문제를 해결한다"

4. **불필요한 꾸밈 제거**: 과도한 수식어, 미사여구, 장식적 표현을 제거합니다.
   - ❌ "혁신적이고 획기적인 미래지향적 패러다임 전환"
   - ✅ "업무 방식의 디지털 전환"

5. **한 문단 = 한 핵심 메시지**: 각 문단에는 하나의 핵심 메시지만 담습니다.

6. **핵심 정보 보존**: 날짜, 부서명, 담당자, 수치, 정책명 등 사실 정보는 절대 변경하지 않습니다.

7. **논리적 흐름 유지**: 문장 간 인과관계, 시간순서, 논리적 연결이 분명하도록 합니다.

**응답 형식**: 반드시 JSON만 응답
{
  "항목1": "교정된 내용",
  "항목2": "교정된 내용",
  ...
}

**중요 규칙**:
1. 반드시 JSON 형식으로만 응답 (다른 텍스트 금지)
2. 입력에 있는 **모든 키**를 포함해야 함
3. 키 이름은 절대 변경하지 마세요
4. 사실 정보(날짜, 수치, 고유명사)는 변경하지 마세요
5. "(비어있음)" 항목은 문서 맥락에 맞는 적절한 내용으로 채우세요
6. 교정 후에도 원래 의미를 보존해야 합니다`
        };

        const userMessage = {
            role: 'user',
            content: `다음 문서를 AI 친화적 기준으로 교정해주세요.

**현재 문서 구조** (JSON):
${JSON.stringify(contentMap, null, 2)}

**사용자 요청**:
${userRequest || 'AI 친화적 문서 표준에 맞게 전체 교정해주세요.'}

**교정 시 반드시 확인할 사항**:
1. 모든 키(${Object.keys(contentMap).join(', ')})를 응답에 포함하세요
2. 주어+서술어가 없는 문장을 완전한 문장으로 수정하세요
3. 개조식 나열은 서술형으로 변환하세요
4. 모호한 지시어(이것, 그것, 해당)를 구체 명사로 교체하세요
5. 불필요한 수식어와 장식 표현을 제거하세요
6. JSON 형식으로만 응답하세요`
        };

        const messages = [systemMessage, userMessage];
        const estimatedTokens = this.estimateTokens(messages);
        logger.info(`📊 Refinement prompt tokens: ${estimatedTokens}`);
        logger.timeEnd('Refinement Prompt Build');

        return messages;
    }

    /**
     * AI 친화도 품질 검증 프롬프트 빌드
     * 문서가 AI 처리에 적합한지 5가지 기준으로 평가
     * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍 배열
     * @returns {Array} OpenAI Chat API 메시지 배열
     */
    buildReadinessCheckPrompt(headerContentPairs) {
        logger.info('📝 Building AI readiness check prompt...');
        logger.time('Readiness Check Prompt Build');

        const contentMap = {};
        headerContentPairs.forEach(pair => {
            contentMap[pair.header] = pair.content || '(비어있음)';
        });

        const systemMessage = {
            role: 'system',
            content: `당신은 문서의 AI 친화도를 평가하는 전문가입니다. 문서가 AI 처리(자동 요약, 검색, 질의응답, RAG, 분류)에 적합한지 5가지 기준으로 평가합니다.

**평가 기준**:

1. **문장 독립성** (sentence_independence)
   - 각 문장이 다른 문장 없이도 독립적으로 이해 가능한가?
   - 모호한 지시어("이것", "그것", "해당") 없이 구체적인가?
   - 주어와 서술어가 분명한가?

2. **구조 추출 가능성** (structure_extractability)
   - AI가 제목, 항목, 본문을 구조적으로 구분할 수 있는가?
   - 정보가 명확한 카테고리로 분리되어 있는가?
   - 표의 열/행 구조가 명확한가?

3. **논리적 연결성** (logical_coherence)
   - 문장 간 인과관계, 시간순서가 분명한가?
   - 문단의 흐름이 자연스러운가?
   - 결론이나 요약이 본문과 일치하는가?

4. **표현 명확성** (expression_clarity)
   - 불필요한 수식어, 미사여구가 없는가?
   - 전문 용어가 설명 없이 사용되지 않았는가?
   - 숫자, 날짜, 고유명사가 정확한가?

5. **표 구조 적합성** (table_structure)
   - 병합된 셀이 없는가?
   - 한 셀에 하나의 의미만 있는가?
   - 열 제목과 행 제목이 명확한가?
   - (표가 없으면 이 항목은 "해당없음"으로 처리)

**응답 형식 (반드시 JSON)**:
{
  "score": 0-100,
  "grade": "A|B|C|D|F",
  "criteria": [
    {
      "name": "sentence_independence",
      "label": "문장 독립성",
      "score": 0-100,
      "pass": true/false,
      "issues": ["구체적 문제점 1", "구체적 문제점 2"]
    },
    ...5개 기준 모두 포함
  ],
  "suggestions": [
    "가장 시급한 개선 제안 1",
    "개선 제안 2",
    "개선 제안 3"
  ],
  "summary": "전체 평가 요약 (2-3문장)"
}`
        };

        const userMessage = {
            role: 'user',
            content: `다음 문서의 AI 친화도를 평가해주세요.

**문서 내용**:
${JSON.stringify(contentMap, null, 2)}

**평가 요청**:
위 문서를 5가지 기준(문장 독립성, 구조 추출 가능성, 논리적 연결성, 표현 명확성, 표 구조 적합성)으로 평가하고, 점수와 구체적인 개선 제안을 JSON 형식으로 응답해주세요.

반드시 JSON 형식으로만 응답하세요.`
        };

        const messages = [systemMessage, userMessage];
        const estimatedTokens = this.estimateTokens(messages);
        logger.info(`📊 Readiness check prompt tokens: ${estimatedTokens}`);
        logger.timeEnd('Readiness Check Prompt Build');

        return messages;
    }

    /**
     * 단일 페이지용 컨텍스트 포함 프롬프트 빌드
     * @param {Object} pageData - 페이지 데이터
     * @param {Object} pageAnalysis - 페이지 분석 결과
     * @param {Array} previousContexts - 이전 페이지 컨텍스트
     * @param {string} userRequest - 사용자 요청
     * @returns {Array} 메시지 배열
     */
    buildContextualPagePrompt(pageData, pageAnalysis, previousContexts, userRequest) {
        logger.debug(`  📝 Building contextual prompt for page ${pageAnalysis.pageNumber}...`);

        let contextInfo = '';

        if (previousContexts && previousContexts.length > 0) {
            contextInfo = `\n**📚 이전 페이지 컨텍스트**:\n`;
            previousContexts.forEach(ctx => {
                contextInfo += `- 페이지 ${ctx.pageNumber} (${ctx.type}): ${ctx.generatedSummary}\n`;
                if (ctx.keyThemes && ctx.keyThemes.length > 0) {
                    contextInfo += `  주요 테마: ${ctx.keyThemes.join(', ')}\n`;
                }
            });
            contextInfo += `\n→ 위 정보를 참고하여 일관성 있는 내용을 생성하세요.\n`;
        }

        const systemMessage = {
            role: 'system',
            content: `당신은 문서의 특정 페이지를 전문적으로 작성하는 전문가입니다.
이전 페이지의 맥락을 고려하여 자연스럽고 일관성 있는 내용을 생성합니다.`
        };

        const userMessage = {
            role: 'user',
            content: `
**사용자 요청**: ${userRequest}

**현재 페이지 정보 (${pageAnalysis.pageNumber}페이지)**:
- 유형: ${pageAnalysis.type}
- 역할: ${pageAnalysis.role}
- 생성 지침: ${pageAnalysis.suggestedPrompt}

${contextInfo}

**페이지 구조**:
${JSON.stringify(pageData, null, 2)}

위 정보를 바탕으로 이 페이지에 적합한 내용을 생성하세요.
모든 빈 필드를 빠짐없이 채워주세요.
JSON 형식으로만 응답하세요.`
        };

        return [systemMessage, userMessage];
    }
}

/**
 * 간편 함수: 프롬프트 빌드
 * @param {Object} extractedData - 추출된 데이터
 * @param {string} userRequest - 사용자 요청
 * @param {Object} [options={}] - 옵션
 * @returns {Array} 메시지 배열
 * 
 * @example
 * import { buildPrompt } from './prompt-builder.js';
 * const messages = buildPrompt(extractedData, '쉽게 바꿔줘');
 */
export function buildPrompt(extractedData, userRequest, options = {}) {
    const builder = new PromptBuilder(options);
    return builder.buildPrompt(extractedData, userRequest);
}

// Default export
export default PromptBuilder;

