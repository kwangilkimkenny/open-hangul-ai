/**
 * GPT Content Generator
 * OpenAI GPT-4 API를 통한 콘텐츠 생성
 * 
 * @module ai/gpt-content-generator
 * @version 2.1.0
 */

import { getLogger } from '../utils/logger.js';
import { ErrorType, HWPXError } from '../utils/error.js';
import { AIConfig } from '../config/ai-config.js';
import { PromptBuilder } from './prompt-builder.js';

const logger = getLogger();

/**
 * GPT 콘텐츠 생성기 클래스
 * OpenAI API와 통신하여 문서 콘텐츠 생성
 * 
 * @example
 * const generator = new GPTContentGenerator(apiKey);
 * const result = await generator.generateContent(extractedData, '쉽게 바꿔줘');
 */
export class GPTContentGenerator {
    /**
     * GPTContentGenerator 생성자
     * @param {string} apiKey - OpenAI API 키
     * @param {Object} [options={}] - 생성 옵션
     */
    constructor(apiKey, options = {}) {
        if (!apiKey) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                'OpenAI API 키가 필요합니다'
            );
        }
        
        this.apiKey = apiKey;
        this.options = {
            model: options.model || AIConfig.openai.model,
            temperature: options.temperature ?? AIConfig.openai.temperature,
            maxTokens: options.maxTokens || AIConfig.openai.maxTokens,
            endpoint: options.endpoint || AIConfig.openai.endpoint,
            timeout: options.timeout || AIConfig.openai.timeout,
            retry: options.retry || AIConfig.openai.retry,
            ...options
        };
        
        this.promptBuilder = new PromptBuilder();
        
        // 통계
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokensUsed: 0,
            totalCost: 0
        };
        
        logger.info('🤖 GPTContentGenerator initialized');
    }
    
    /**
     * 콘텐츠 생성 (메인 메서드)
     * @param {Object} extractedData - 추출된 문서 구조
     * @param {string} userRequest - 사용자 요청
     * @returns {Promise<Object>} 생성된 콘텐츠
     * 
     * @example
     * const result = await generator.generateContent(extractedData, '쉽게 바꿔줘');
     * // Returns: { updatedSlots: [...], metadata: {...} }
     */
    async generateContent(extractedData, userRequest) {
        logger.info('🤖 Generating content with GPT...');
        
        // 🆕 커스텀 API 사용 여부 로깅
        if (AIConfig.custom.isEnabled()) {
            logger.info(`🔌 Using Custom API: ${AIConfig.custom.getEndpoint()}`);
        } else {
            logger.info('🤖 Using OpenAI API');
        }
        
        logger.time('GPT API Call');
        
        this.stats.totalRequests++;
        
        try {
            // 1. 프롬프트 빌드
            const messages = this.promptBuilder.buildPrompt(extractedData, userRequest);
            
            // 🔥 특급 검증: 토큰 수 사전 체크
            const estimatedTokens = this.promptBuilder.estimateTokens(messages);
            const MAX_SAFE_TOKENS = 12000; // 안전 한계 설정
            
            if (estimatedTokens > MAX_SAFE_TOKENS) {
                throw new HWPXError(
                    ErrorType.VALIDATION_ERROR,
                    `프롬프트가 너무 깁니다 (${estimatedTokens.toLocaleString()} 토큰). ` +
                    `문서가 너무 크거나 복잡합니다. ` +
                    `더 간단한 문서를 사용하거나, 문서를 분할하세요. ` +
                    `(권장: < ${MAX_SAFE_TOKENS.toLocaleString()} 토큰)`
                );
            }
            
            // 경고 수준 체크
            const WARNING_TOKENS = 8000;
            if (estimatedTokens > WARNING_TOKENS) {
                logger.warn(`⚠️  프롬프트 크기 경고: ${estimatedTokens.toLocaleString()} 토큰 (처리 시간이 길어질 수 있습니다)`);
            }
            
            // 2. API 호출 (재시도 로직 포함)
            const response = await this.callAPIWithRetry(messages);
            
            // 3. 응답 파싱
            const parsedResponse = this.parseResponse(response);
            
            // 4. 응답 검증
            const validation = this.validateResponse(parsedResponse);
            if (!validation.isValid) {
                throw new HWPXError(
                    ErrorType.VALIDATION_ERROR,
                    `GPT 응답이 유효하지 않습니다: ${validation.errors.join(', ')}`
                );
            }
            
            // 5. 통계 업데이트
            this.updateStatistics(response);
            this.stats.successfulRequests++;
            
            logger.timeEnd('GPT API Call');
            logger.info(`✅ Generated ${parsedResponse.updatedSlots.length} updated slots`);
            
            return parsedResponse;
            
        } catch (error) {
            this.stats.failedRequests++;
            logger.error('❌ GPT content generation failed:', error);
            logger.timeEnd('GPT API Call');
            throw this.wrapError(error);
        }
    }
    
    /**
     * API 호출 (재시도 로직 포함)
     * @param {Array} messages - 메시지 배열
     * @returns {Promise<Object>} API 응답
     * @private
     */
    async callAPIWithRetry(messages) {
        const { maxAttempts, delayMs, backoffMultiplier } = this.options.retry;
        
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                logger.debug(`🔄 API call attempt ${attempt}/${maxAttempts}`);
                
                const response = await this.callAPI(messages);
                return response;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < maxAttempts) {
                    // Rate limit 에러인 경우 더 긴 대기
                    const isRateLimit = error.message.includes('rate_limit') || 
                                       error.message.includes('429');
                    const delay = isRateLimit ? 
                        delayMs * backoffMultiplier * 2 : 
                        delayMs * Math.pow(backoffMultiplier, attempt - 1);
                    
                    logger.warn(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await this.sleep(delay);
                } else {
                    logger.error(`❌ All ${maxAttempts} attempts failed`);
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * API 호출 (단일 시도)
     * @param {Array} messages - 메시지 배열
     * @returns {Promise<Object>} API 응답
     * @private
     */
    async callAPI(messages) {
        // 🆕 활성 엔드포인트 및 API 키 가져오기
        const endpoint = AIConfig.getActiveEndpoint();
        const apiKey = AIConfig.getActiveApiKey();
        
        if (!apiKey) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                'API 키가 설정되지 않았습니다'
            );
        }
        
        const requestBody = {
            model: this.options.model,
            messages: messages,
            temperature: this.options.temperature,
            max_tokens: this.options.maxTokens,
            response_format: { type: 'json_object' } // JSON mode 강제
        };
        
        // 디버그 로깅
        if (AIConfig.debug.logRequests) {
            logger.debug('📤 API Request:', JSON.stringify(requestBody, null, 2));
        }
        
        // API 호출
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        // 프록시 모드: Authorization 헤더 불필요 (서버에서 API 키 관리)
        const isProxy = AIConfig.isProxyMode();
        const headers = { 'Content-Type': 'application/json' };
        if (!isProxy && apiKey && apiKey !== 'proxy') {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        if (isProxy) {
            logger.info('🔒 Proxy mode: API key managed server-side');
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // HTTP 에러 체크
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // 🆕 커스텀 API 오류 시 더 상세한 메시지
                const errorMsg = errorData.error?.message || response.statusText;
                const apiType = AIConfig.custom.isEnabled() ? '커스텀 API' : 'OpenAI API';
                
                throw new Error(
                    `${apiType} 오류 (${response.status}): ${errorMsg}\n` +
                    `엔드포인트: ${endpoint}`
                );
            }
            
            const data = await response.json();
            
            // 디버그 로깅
            if (AIConfig.debug.logResponses) {
                logger.debug('📥 API Response:', JSON.stringify(data, null, 2));
            }
            
            return data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                const apiType = AIConfig.custom.isEnabled() ? '커스텀 API' : 'OpenAI API';
                throw new Error(`${apiType} 호출 타임아웃 (${this.options.timeout}ms)`);
            }
            
            throw error;
        }
    }
    
    /**
     * 응답 파싱
     * @param {Object} apiResponse - API 응답
     * @returns {Object} 파싱된 응답
     * @private
     */
    parseResponse(apiResponse) {
        if (!apiResponse.choices || apiResponse.choices.length === 0) {
            throw new Error('API 응답에 choices가 없습니다');
        }
        
        const choice = apiResponse.choices[0];
        const content = choice.message?.content;
        
        if (!content) {
            throw new Error('API 응답에 content가 없습니다');
        }
        
        // JSON 파싱
        let parsedContent;
        try {
            parsedContent = JSON.parse(content);
        } catch (error) {
            throw new Error(`JSON 파싱 실패: ${error.message}\nContent: ${content}`);
        }
        
        // 메타데이터 추가
        return {
            updatedSlots: parsedContent.updatedSlots || [],
            metadata: {
                model: apiResponse.model,
                tokensUsed: apiResponse.usage?.total_tokens || 0,
                promptTokens: apiResponse.usage?.prompt_tokens || 0,
                completionTokens: apiResponse.usage?.completion_tokens || 0,
                finishReason: choice.finish_reason,
                generatedAt: new Date().toISOString()
            }
        };
    }
    
    /**
     * 응답 검증
     * @param {Object} response - 파싱된 응답
     * @returns {Object} 검증 결과
     * @private
     */
    validateResponse(response) {
        const errors = [];
        
        if (!response.updatedSlots || !Array.isArray(response.updatedSlots)) {
            errors.push('updatedSlots가 배열이 아닙니다');
            return { isValid: false, errors };
        }
        
        response.updatedSlots.forEach((slot, idx) => {
            if (!slot.slotId) {
                errors.push(`슬롯 ${idx}: slotId가 없습니다`);
            }
            
            if (typeof slot.newText !== 'string') {
                errors.push(`슬롯 ${idx}: newText가 문자열이 아닙니다`);
            }
            
            // 텍스트 길이 체크
            if (slot.newText.length > AIConfig.extraction.maxTextLength) {
                errors.push(`슬롯 ${idx}: 텍스트가 너무 깁니다 (${slot.newText.length} > ${AIConfig.extraction.maxTextLength})`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 통계 업데이트
     * @param {Object} apiResponse - API 응답
     * @private
     */
    updateStatistics(apiResponse) {
        const tokensUsed = apiResponse.usage?.total_tokens || 0;
        const promptTokens = apiResponse.usage?.prompt_tokens || 0;
        const completionTokens = apiResponse.usage?.completion_tokens || 0;
        
        this.stats.totalTokensUsed += tokensUsed;
        
        // 비용 계산
        const cost = (promptTokens * AIConfig.costManagement.costPerInputToken) +
                    (completionTokens * AIConfig.costManagement.costPerOutputToken);
        this.stats.totalCost += cost;
        
        logger.debug(`💰 Cost for this request: $${cost.toFixed(4)}`);
        logger.debug(`💰 Total cost: $${this.stats.totalCost.toFixed(4)}`);
        
        // 비용 경고
        if (this.stats.totalCost > AIConfig.costManagement.warningThreshold) {
            logger.warn(`⚠️  비용 경고: $${this.stats.totalCost.toFixed(2)} (임계값: $${AIConfig.costManagement.warningThreshold})`);
        }
        
        if (this.stats.totalCost > AIConfig.costManagement.maxCost) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                `최대 허용 비용 초과: $${this.stats.totalCost.toFixed(2)} > $${AIConfig.costManagement.maxCost}`
            );
        }
    }
    
    /**
     * 에러 래핑 (특급 개선 버전)
     * @param {Error} error - 원본 에러
     * @returns {HWPXError} 래핑된 에러
     * @private
     */
    wrapError(error) {
        if (error instanceof HWPXError) {
            return error;
        }
        
        let type = ErrorType.UNKNOWN_ERROR;
        let message = error.message;
        
        // 🔥 특급 에러 분류: 더 구체적인 메시지
        if (error.message.includes('rate_limit') || error.message.includes('429')) {
            type = ErrorType.NETWORK_ERROR;
            message = AIConfig.prompts.errorMessages.rateLimitExceeded;
        } else if (error.message.includes('timeout') || error.message.includes('타임아웃')) {
            type = ErrorType.NETWORK_ERROR;
            message = AIConfig.prompts.errorMessages.timeout;
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            type = ErrorType.VALIDATION_ERROR;
            message = '🔑 API 키가 유효하지 않습니다.\n\nAPI 키를 다시 확인하고 재설정해주세요.';
        } else if (error.message.includes('insufficient_quota')) {
            type = ErrorType.NETWORK_ERROR;
            message = '💳 OpenAI 계정의 크레딧이 부족합니다.\n\n결제 방법을 등록하거나 크레딧을 충전해주세요.';
        } else if (error.message.includes('API Error')) {
            type = ErrorType.NETWORK_ERROR;
            message = AIConfig.prompts.errorMessages.apiError;
        } else if (error.message.includes('JSON') || error.message.includes('파싱')) {
            type = ErrorType.VALIDATION_ERROR;
            message = AIConfig.prompts.errorMessages.invalidResponse;
        } else if (error.message.includes('프롬프트가 너무')) {
            type = ErrorType.VALIDATION_ERROR;
            message = AIConfig.prompts.errorMessages.documentTooLarge || error.message;
        }
        
        return new HWPXError(type, message, error);
    }
    
    /**
     * Sleep 유틸리티
     * @param {number} ms - 대기 시간 (밀리초)
     * @returns {Promise<void>}
     * @private
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 통계 조회
     * @returns {Object} 통계 정보
     */
    getStatistics() {
        return {
            ...this.stats,
            successRate: this.stats.totalRequests > 0 ? 
                (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : 
                'N/A',
            averageTokensPerRequest: this.stats.successfulRequests > 0 ?
                Math.round(this.stats.totalTokensUsed / this.stats.successfulRequests) :
                0
        };
    }
    
    /**
     * 통계 리셋
     */
    resetStatistics() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokensUsed: 0,
            totalCost: 0
        };
        logger.info('📊 Statistics reset');
    }
    
    /**
     * 🆕 연결 테스트
     * 현재 활성화된 API(OpenAI 또는 커스텀)와의 연결을 테스트합니다.
     * @returns {Promise<Object>} 테스트 결과 { success: boolean, message: string, endpoint: string }
     * 
     * @example
     * const result = await generator.testConnection();
     * if (result.success) {
     *   console.log('✅ Connection successful!');
     * }
     */
    async testConnection() {
        const endpoint = AIConfig.getActiveEndpoint();
        const apiKey = AIConfig.getActiveApiKey();
        const apiType = AIConfig.custom.isEnabled() ? '커스텀 API' : 'OpenAI';
        
        logger.info(`🔄 Testing ${apiType} connection: ${endpoint}`);
        
        // API 키 확인
        if (!apiKey) {
            return {
                success: false,
                message: 'API 키가 설정되지 않았습니다',
                endpoint: endpoint
            };
        }
        
        // 간단한 테스트 요청
        const testRequestBody = {
            model: this.options.model,
            messages: [
                {
                    role: 'user',
                    content: 'Hello'
                }
            ],
            max_tokens: 10,
            response_format: { type: 'json_object' }
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(testRequestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                logger.info(`✅ ${apiType} connection test passed`);
                return {
                    success: true,
                    message: `✅ ${apiType} 연결 성공!`,
                    endpoint: endpoint
                };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error?.message || response.statusText;
                
                logger.error(`❌ ${apiType} connection test failed: ${response.status}`);
                return {
                    success: false,
                    message: `❌ 연결 실패 (${response.status}): ${errorMsg}`,
                    endpoint: endpoint
                };
            }
        } catch (error) {
            clearTimeout(timeoutId);
            
            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = '연결 시간 초과 (10초)';
            } else if (error.message.includes('fetch')) {
                errorMessage = '네트워크 오류: 엔드포인트에 연결할 수 없습니다';
            }
            
            logger.error(`❌ ${apiType} connection test error:`, error);
            return {
                success: false,
                message: `❌ ${errorMessage}`,
                endpoint: endpoint
            };
        }
    }

    /**
     * 메시지 배열로 직접 생성 (다중 페이지용)
     * @param {Array} messages - 메시지 배열
     * @returns {Promise<Object>} 생성된 콘텐츠
     */
    async generateWithMessages(messages) {
        logger.debug('🤖 Generating with custom messages...');
        
        try {
            const response = await this.callAPIWithRetry(messages);
            const parsedResponse = this.parseResponse(response);
            
            this.updateStatistics(response);
            this.stats.successfulRequests++;
            
            return parsedResponse;
            
        } catch (error) {
            this.stats.failedRequests++;
            throw error;
        }
    }
}

/**
 * 간편 함수: 콘텐츠 생성
 * @param {string} apiKey - API 키
 * @param {Object} extractedData - 추출된 데이터
 * @param {string} userRequest - 사용자 요청
 * @param {Object} [options={}] - 옵션
 * @returns {Promise<Object>} 생성된 콘텐츠
 * 
 * @example
 * import { generateContent } from './gpt-content-generator.js';
 * const result = await generateContent(apiKey, extractedData, '쉽게 바꿔줘');
 */
export async function generateContent(apiKey, extractedData, userRequest, options = {}) {
    const generator = new GPTContentGenerator(apiKey, options);
    return await generator.generateContent(extractedData, userRequest);
}

// Default export
export default GPTContentGenerator;

