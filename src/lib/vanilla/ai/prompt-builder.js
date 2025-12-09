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
        
        // 헤더-내용 쌍을 객체로 변환
        const contentMap = {};
        headerContentPairs.forEach(pair => {
            contentMap[pair.header] = pair.content || '(비어있음)';
        });
        
        // System message (구조화된 버전) - v2.2.6: 놀이방법(전개) 상세화
        const systemMessage = {
            role: 'system',
            content: `당신은 유아교육 전문가로서, 교사가 바로 현장에서 활용할 수 있는 놀이계획안을 작성합니다.

**역할**:
- 테이블의 **모든** 빈 칸을 적절한 내용으로 채우기
- 각 항목(소제목)에 대해 일관성 있고 자연스러운 내용 생성
- 빈 칸("(비어있음)")도 **반드시** 채워야 함
- 교육학적 근거와 실천 가능성을 고려한 내용 작성

**응답 형식 (JSON)**:
{
  "항목1": "생성된 내용1",
  "항목2": "생성된 내용2",
  "놀이명": "놀이 제목",
  "연령": "대상 연령",
  "놀이방법(전개)": "매우 상세하고 긴 단계별 설명...",
  ...
}

**중요 규칙**:
1. 반드시 JSON 형식으로만 응답
2. **모든** 소제목(키)을 포함 (빈 칸도 포함!)
3. 각 내용은 명확하고 구체적으로
4. 한글 문법과 맞춤법 준수
5. 다른 텍스트 포함 금지 (JSON만)

**항목별 작성 가이드**:
- "놀이명": 구체적이고 흥미로운 놀이 제목
- "연령": 대상 연령(예: "만 3-5세")
- "놀이기간": 적절한 기간 제시
- "놀이속배움": 교육적 목표와 배움의 내용
- "누리과정관련요소": 관련 영역 명시
- "놀이자료": 구체적인 준비물 목록
  * "→ "로 시작하는 항목 나열
  * 예: "→ 색종이, 가위, 풀\n→ 우주선 모형 또는 사진\n→ 그림 도구 (크레용, 색연필)"
- "사전준비(도입)": 사전 준비사항과 도입 방법
  * "→ "로 시작하는 항목 나열
  * 예: "→ 우주 관련 그림책과 영상 자료를 미리 준비합니다.\n→ 우주선 만들기 재료를 각 테이블에 배치합니다.\n→ 안전 수칙을 사전에 공지합니다."
- "교사의 지원": 교사의 역할과 지원 방법
  * "→ "로 시작하는 항목 나열
  * 예: "→ 유아들의 활동을 관찰하며 필요한 도움을 제공합니다.\n→ 긍정적인 피드백으로 자신감을 북돋아줍니다.\n→ 어려움을 겪는 유아에게는 개별 지원을 합니다."
- **"놀이방법(전개)" 또는 "놀이방법" 또는 "전개"**: 
  * 교사가 바로 따라할 수 있도록 **매우 상세하고 구체적으로** 작성
  * 단계별로 명확히 구분 (【1단계】, 【2단계】, 【3단계】 등 - 반드시 【】 기호 사용!)
  * 각 단계 제목 뒤에 반드시 줄바꿈
  * 각 단계의 세부 내용은 "→ "로 시작하는 항목으로 작성
  * 각 단계 사이에 빈 줄 추가
  * 각 단계마다 교사의 발문, 유아의 예상 반응, 교사의 피드백 포함
  * 최소 300자 이상의 긴 내용으로 작성
  * 교육학적 근거가 드러나도록 작성
  * **필수 형식 예시**: "【1단계】 호기심 유발하기 (5-10분)\n→ 교사는 '오늘은...'라고 말하며...\n→ 유아들의 관심을 유도합니다.\n\n【2단계】 재료 탐색 (10분)\n→ 준비된 재료들을..."
- "놀이의 확장": 확장 가능한 활동 제시
  * "→ "로 시작하는 항목 나열
  * 예: "→ 우주 여행 일기 작성하기\n→ 별자리 카드를 이용한 게임\n→ 우주 관련 책 읽고 이야기 나누기"
- "마무리": 정리 및 평가 방법
  * "→ "로 시작하는 항목 나열
  * 예: "→ 활동을 회상하며 배운 점과 느낀 점을 공유합니다.\n→ 완성된 작품을 전시하고 서로 감상합니다.\n→ 다음 활동에 대한 기대감을 가질 수 있도록 격려합니다."

**길이 지침**:
- "놀이방법(전개)"/"놀이방법"/"전개": **최소 300자 이상**, 가능한 한 상세하게
- 다른 항목: 간결하되 명확하게 (각 50-150자)
- "(비어있음)"이라고 표시된 항목은 반드시 적절한 내용으로 채워야 합니다`
        };
        
        // User message - v2.2.6: 놀이방법(전개) 상세화 지시
        const userMessage = {
            role: 'user',
            content: `다음 테이블의 **모든 빈 칸**을 채워주세요:

**현재 테이블 구조**:
${JSON.stringify(contentMap, null, 2)}

**사용자 요청**:
${userRequest}

**필수 지시사항**:
1. 위 구조의 **모든 항목**에 대해 사용자 요청에 맞는 내용을 생성하세요
2. "(비어있음)"으로 표시된 항목은 **반드시** 적절한 내용으로 채워야 합니다
3. "놀이명", "연령" 등 모든 빈 칸을 빠짐없이 채워주세요
4. 각 항목의 성격에 맞는 적절한 내용을 생성하세요

**🔥 특히 중요: "놀이방법(전개)" 또는 "놀이방법" 또는 "전개" 항목**:
- 교사가 현장에서 **바로 따라할 수 있도록** 매우 구체적이고 상세하게 작성하세요
- **반드시 다음 형식을 정확히 따르세요**:
  * 단계 제목: 【1단계】, 【2단계】, 【3단계】... (반드시 【】 기호 사용!)
  * 각 단계 제목 뒤에 시간 표기: (5-10분), (10-15분) 등
  * 제목 뒤 즉시 줄바꿈
  * 세부 내용은 각 줄마다 "→ "로 시작
  * 각 단계 사이에 빈 줄(줄바꿈 2번)
- 각 단계마다:
  * 교사가 해야 할 구체적인 행동
  * 교사의 발문 예시 (따옴표로 명시)
  * 유아의 예상 반응
  * 교사의 피드백 방법
- **최소 300자 이상**, 가능한 한 길고 상세하게 작성하세요
- 교육학적 근거가 드러나도록 작성하세요

**필수 형식 예시**:

1. "놀이방법(전개)" - 단계별 상세 설명:
"【1단계】 관심 유발하기 (5분)
→ 교사는 '여러분, 오늘 특별한 활동을 준비했어요. 무엇일까요?'라고 질문하며 유아들의 호기심을 자극합니다.
→ 유아들이 다양한 추측을 하면 '모두 재미있는 생각이네요'라고 긍정적으로 반응합니다.
→ 호기심을 더 자극하기 위해 관련 자료나 힌트를 제공합니다.

【2단계】 재료 탐색하기 (10분)
→ 교사는 준비된 재료들을 하나씩 보여주며 '이것은 무엇에 사용할 수 있을까요?'라고 물어봅니다.
→ 유아들이 자유롭게 재료를 만져보고 탐색할 수 있도록 충분한 시간을 제공합니다.

【3단계】 활동 실행하기 (20분)
→ 유아들이 자신만의 방법으로 활동을 진행하도록 격려합니다.
→ 어려움을 겪는 유아에게는 적절한 도움을 제공합니다."

2. "놀이자료" - 항목 나열:
"→ 색종이, 가위, 풀
→ 우주선 모형 또는 사진
→ 그림 도구 (크레용, 색연필)
→ 스티커, 반짝이 등 꾸미기 재료"

3. "사전준비(도입)" - 준비사항 나열:
"→ 우주 관련 그림책과 영상 자료를 미리 준비합니다.
→ 우주선 만들기 재료를 각 테이블에 배치합니다.
→ 안전 수칙을 사전에 공지합니다."

4. "교사의 지원" - 지원 방법 나열:
"→ 유아들의 활동을 관찰하며 필요한 도움을 제공합니다.
→ 긍정적인 피드백으로 자신감을 북돋아줍니다.
→ 어려움을 겪는 유아에게는 개별 지원을 합니다."

**⚠️ 중요: 모든 항목에서 "→ " 기호를 사용하여 가독성을 높여주세요!**

응답은 반드시 JSON 형식으로만 제공하세요. 다른 텍스트는 포함하지 마세요.`
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

