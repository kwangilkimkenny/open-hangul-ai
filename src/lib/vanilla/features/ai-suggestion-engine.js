/**
 * AI Suggestion Engine
 * GPT 기반 AI 텍스트 분석 및 제안 생성
 * 
 * @module features/ai-suggestion-engine
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { TextAnalyzer } from '../ai/text-analyzer.js';

const logger = getLogger('AISuggestionEngine');

/**
 * AI 제안 엔진 클래스
 * Grammarly 스타일의 AI 텍스트 분석
 */
export class AISuggestionEngine {
    constructor(gptGenerator) {
        this.gptGenerator = gptGenerator;
        this.textAnalyzer = new TextAnalyzer();
        this.cache = new Map(); // 텍스트 -> 분석 결과 캐시
        this.maxCacheSize = 100;
        this.analyzing = new Set(); // 현재 분석 중인 텍스트
        
        logger.info('🤖 AISuggestionEngine initialized');
    }

    /**
     * 선택된 텍스트 분석 (통합 메서드)
     * @param {Object} selectionData - 선택 데이터
     * @returns {Promise<Object>} 분석 결과
     */
    async analyzeText(selectionData) {
        const { text, paragraphData, location } = selectionData;
        
        if (!text || text.length < 2) {
            logger.debug('Text too short for analysis');
            return { suggestions: [] };
        }

        // 캐시 확인
        const cacheKey = this._getCacheKey(text);
        if (this.cache.has(cacheKey)) {
            logger.debug('Using cached analysis');
            return this.cache.get(cacheKey);
        }

        // 중복 요청 방지
        if (this.analyzing.has(cacheKey)) {
            logger.debug('Analysis already in progress');
            return { suggestions: [], inProgress: true };
        }

        this.analyzing.add(cacheKey);

        try {
            // 1단계: 로컬 빠른 분석
            logger.debug('Step 1: Local quick check');
            const localIssues = this.textAnalyzer.quickCheck(text);

            // 2단계: AI 분석 (필요한 경우)
            let aiSuggestions = [];
            if (text.length >= 10) {
                logger.debug('Step 2: AI analysis');
                aiSuggestions = await this._performAIAnalysis(text, {
                    paragraphData,
                    location,
                    localIssues
                });
            }

            // 3단계: 결과 병합 및 중복 제거
            const allSuggestions = [...localIssues, ...aiSuggestions];
            const uniqueSuggestions = this._deduplicateSuggestions(allSuggestions);

            // 4단계: 신뢰도 순 정렬
            uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);

            const result = {
                text: text,
                suggestions: uniqueSuggestions,
                stats: this.textAnalyzer.getStatistics(text),
                readabilityScore: this.textAnalyzer.calculateReadabilityScore(text),
                timestamp: Date.now()
            };

            // 캐시 저장
            this._saveToCache(cacheKey, result);

            logger.info(`Analysis complete: ${uniqueSuggestions.length} suggestions found`);

            return result;
        } catch (error) {
            logger.error('Analysis failed:', error);
            return {
                suggestions: [],
                error: error.message
            };
        } finally {
            this.analyzing.delete(cacheKey);
        }
    }

    /**
     * 빠른 분석 (로컬만, AI 호출 없음)
     * @param {string} text - 분석할 텍스트
     * @returns {Promise<Object>} 분석 결과
     */
    async quickAnalyze(text) {
        if (!text || text.length < 2) {
            return { suggestions: [] };
        }

        const cacheKey = this._getCacheKey(text);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const localIssues = this.textAnalyzer.quickCheck(text);

        return {
            text: text,
            suggestions: localIssues,
            quick: true,
            timestamp: Date.now()
        };
    }

    /**
     * AI 분석 수행
     * @private
     */
    async _performAIAnalysis(text, context) {
        const prompt = this._buildAnalysisPrompt(text, context);
        
        try {
            logger.debug('Calling GPT for analysis...');
            
            const response = await this.gptGenerator.generate({
                systemPrompt: prompt.system,
                userPrompt: prompt.user,
                options: {
                    model: 'gpt-4o-mini',
                    temperature: 0.3,
                    max_tokens: 1000,
                    response_format: { type: 'json_object' }
                }
            });

            // JSON 파싱
            let parsed;
            try {
                parsed = typeof response === 'string' ? JSON.parse(response) : response;
            } catch (e) {
                logger.error('Failed to parse GPT response:', e);
                return [];
            }

            // 제안 배열 추출
            const suggestions = parsed.suggestions || [];
            
            logger.debug(`GPT returned ${suggestions.length} suggestions`);

            return suggestions;
        } catch (error) {
            logger.error('GPT analysis failed:', error);
            return [];
        }
    }

    /**
     * 분석 프롬프트 생성
     * @private
     */
    _buildAnalysisPrompt(text, context) {
        const contextInfo = context.paragraphData ? `
문맥 정보:
- 위치: ${context.location}
- 단락 ID: ${context.paragraphData.id || 'unknown'}
` : '';

        const localIssuesInfo = context.localIssues && context.localIssues.length > 0 ? `
이미 발견된 로컬 이슈 (${context.localIssues.length}개):
${context.localIssues.map(issue => `- ${issue.category}: "${issue.original}" → "${issue.suggestion}"`).join('\n')}
` : '';

        return {
            system: `당신은 한국어 문서 편집 전문가입니다.
주어진 텍스트를 분석하여 개선점을 제공하세요.

분석 영역:
1. 맞춤법 및 문법 오류
2. 더 나은 표현 제안
3. 문체 개선안
4. 명확성 향상 제안
5. 중복 표현 제거
6. 불필요한 어구 삭제

**중요**: 로컬 규칙으로 이미 발견된 이슈는 제외하고, 더 복잡하거나 문맥 기반의 제안만 제공하세요.

반드시 JSON 형식으로 응답하세요:
{
  "suggestions": [
    {
      "type": "error|warning|suggestion|style",
      "category": "맞춤법|문법|표현|문체|명확성|중복|간결성",
      "original": "원본 텍스트 (정확히 일치해야 함)",
      "suggestion": "제안 텍스트",
      "reason": "이유 설명 (간결하게)",
      "confidence": 0.85,
      "priority": 1
    }
  ]
}

confidence: 0.7-1.0 (높을수록 확신)
priority: 1-5 (1이 가장 중요)`,

            user: `다음 텍스트를 분석하세요:

"${text}"
${contextInfo}${localIssuesInfo}
분석을 시작하세요. 최대 5개의 가장 중요한 제안만 제공하세요.`
        };
    }

    /**
     * 제안 중복 제거
     * @private
     */
    _deduplicateSuggestions(suggestions) {
        const seen = new Map();
        const unique = [];

        for (const suggestion of suggestions) {
            const key = `${suggestion.original}:${suggestion.suggestion}`;
            
            if (!seen.has(key)) {
                seen.set(key, true);
                unique.push(suggestion);
            } else {
                // 중복이지만 신뢰도가 더 높으면 교체
                const existingIndex = unique.findIndex(s => 
                    s.original === suggestion.original && 
                    s.suggestion === suggestion.suggestion
                );
                
                if (existingIndex !== -1 && 
                    suggestion.confidence > unique[existingIndex].confidence) {
                    unique[existingIndex] = suggestion;
                }
            }
        }

        return unique;
    }

    /**
     * 캐시 키 생성
     * @private
     */
    _getCacheKey(text) {
        // 간단한 해시 생성 (실제로는 더 나은 해시 함수 사용)
        return text.trim().toLowerCase();
    }

    /**
     * 캐시에 저장
     * @private
     */
    _saveToCache(key, result) {
        // 캐시 크기 제한
        if (this.cache.size >= this.maxCacheSize) {
            // LRU: 가장 오래된 항목 제거
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, result);
    }

    /**
     * 캐시 초기화
     */
    clearCache() {
        this.cache.clear();
        logger.info('Cache cleared');
    }

    /**
     * 텍스트 개선 (제안 적용 없이 전체 개선)
     * @param {string} text - 원본 텍스트
     * @returns {Promise<string>} 개선된 텍스트
     */
    async improveText(text) {
        const prompt = {
            system: `당신은 한국어 문서 편집 전문가입니다.
주어진 텍스트를 더 명확하고 세련되게 개선하세요.
원래 의미는 유지하되, 표현을 향상시키세요.`,
            user: `다음 텍스트를 개선하세요:\n\n"${text}"`
        };

        try {
            const response = await this.gptGenerator.generate({
                systemPrompt: prompt.system,
                userPrompt: prompt.user,
                options: {
                    model: 'gpt-4o-mini',
                    temperature: 0.5,
                    max_tokens: 500
                }
            });

            return response.trim();
        } catch (error) {
            logger.error('Text improvement failed:', error);
            return text;
        }
    }

    /**
     * 텍스트 재작성
     * @param {string} text - 원본 텍스트
     * @param {string} style - 스타일 (formal, casual, concise, detailed)
     * @returns {Promise<string>} 재작성된 텍스트
     */
    async rewriteText(text, style = 'formal') {
        const styleInstructions = {
            formal: '격식 있고 전문적인 어조로',
            casual: '친근하고 구어체로',
            concise: '간결하고 핵심만',
            detailed: '상세하고 자세하게'
        };

        const instruction = styleInstructions[style] || styleInstructions.formal;

        const prompt = {
            system: `당신은 한국어 문서 편집 전문가입니다.
주어진 텍스트를 ${instruction} 다시 작성하세요.
핵심 메시지는 유지하되, 문체를 변경하세요.`,
            user: `다음 텍스트를 재작성하세요:\n\n"${text}"`
        };

        try {
            const response = await this.gptGenerator.generate({
                systemPrompt: prompt.system,
                userPrompt: prompt.user,
                options: {
                    model: 'gpt-4o-mini',
                    temperature: 0.7,
                    max_tokens: 500
                }
            });

            return response.trim();
        } catch (error) {
            logger.error('Text rewrite failed:', error);
            return text;
        }
    }

    /**
     * 번역
     * @param {string} text - 원본 텍스트
     * @param {string} targetLang - 목표 언어 (en, ja, zh 등)
     * @returns {Promise<string>} 번역된 텍스트
     */
    async translate(text, targetLang) {
        const langNames = {
            en: '영어',
            ja: '일본어',
            zh: '중국어',
            es: '스페인어',
            fr: '프랑스어'
        };

        const langName = langNames[targetLang] || targetLang;

        const prompt = {
            system: `당신은 전문 번역가입니다.
주어진 한국어 텍스트를 ${langName}로 정확하게 번역하세요.
자연스러운 표현을 사용하고, 문화적 맥락을 고려하세요.`,
            user: `다음 텍스트를 ${langName}로 번역하세요:\n\n"${text}"`
        };

        try {
            const response = await this.gptGenerator.generate({
                systemPrompt: prompt.system,
                userPrompt: prompt.user,
                options: {
                    model: 'gpt-4o-mini',
                    temperature: 0.3,
                    max_tokens: 500
                }
            });

            return response.trim();
        } catch (error) {
            logger.error('Translation failed:', error);
            return text;
        }
    }

    /**
     * 통계 정보 가져오기
     * @returns {Object}
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            analyzing: this.analyzing.size
        };
    }

    /**
     * 디버깅 정보 출력
     */
    debug() {
        logger.debug('='.repeat(80));
        logger.debug('AISuggestionEngine Debug Info');
        logger.debug('='.repeat(80));
        logger.debug('Stats:', this.getStats());
        logger.debug('Cache Keys:', Array.from(this.cache.keys()).slice(0, 5));
        logger.debug('Analyzing:', Array.from(this.analyzing));
        logger.debug('='.repeat(80));
    }
}

