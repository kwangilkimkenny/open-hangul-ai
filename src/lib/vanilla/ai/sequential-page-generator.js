/**
 * Sequential Page Generator
 * 페이지별 순차 생성 - 이전 페이지 컨텍스트를 다음 페이지에 전달
 * 
 * @module ai/sequential-page-generator
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { HWPXError, ErrorType } from '../utils/error.js';

const logger = getLogger();

/**
 * 순차적 페이지 생성기
 * 페이지 간 관계가 있을 때 이전 페이지의 컨텍스트를 활용하여 생성
 */
export class SequentialPageGenerator {
    constructor(gptGenerator, promptBuilder) {
        if (!gptGenerator) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                'GPT Generator가 필요합니다'
            );
        }
        if (!promptBuilder) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                'Prompt Builder가 필요합니다'
            );
        }

        this.gptGenerator = gptGenerator;
        this.promptBuilder = promptBuilder;
        this.pageContexts = []; // 누적 컨텍스트
        
        logger.info('🔄 SequentialPageGenerator initialized');
    }

    /**
     * 페이지별 순차 생성
     * @param {Object} multiPageAnalysis - 페이지 분석 결과
     * @param {Array} allPagesData - 모든 페이지의 데이터
     * @param {string} userRequest - 사용자 요청
     * @returns {Promise<Array>} 생성 결과 배열
     */
    async generatePageByPage(multiPageAnalysis, allPagesData, userRequest) {
        logger.info('🔄 Starting sequential page generation...');
        logger.info(`  📊 Total pages: ${allPagesData.length}`);
        logger.info(`  🔗 Strategy: ${multiPageAnalysis.strategy}`);

        this.pageContexts = []; // 초기화
        const results = [];

        for (let i = 0; i < allPagesData.length; i++) {
            const pageData = allPagesData[i];
            const pageAnalysis = multiPageAnalysis.pages[i];

            logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.info(`📄 Generating Page ${i + 1}/${allPagesData.length}...`);
            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.info(`  Type: ${pageAnalysis.type}`);
            logger.info(`  Role: ${pageAnalysis.role}`);
            
            if (this.pageContexts.length > 0) {
                logger.info(`  📚 Using context from ${this.pageContexts.length} previous page(s)`);
            }

            try {
                // 이전 페이지 컨텍스트 포함 프롬프트 생성
                const contextualPrompt = this.promptBuilder.buildContextualPagePrompt(
                    pageData,
                    pageAnalysis,
                    this.pageContexts,
                    userRequest
                );

                // GPT 생성
                const response = await this.gptGenerator.generateWithMessages(contextualPrompt);
                
                // 응답 파싱
                const generatedContent = this.parseGeneratedContent(response);

                // 결과 저장
                const result = {
                    pageNumber: i + 1,
                    content: generatedContent,
                    analysis: pageAnalysis,
                    usedContexts: this.pageContexts.length
                };
                
                results.push(result);

                // 컨텍스트 누적 (다음 페이지에서 참조)
                const pageContext = {
                    pageNumber: i + 1,
                    type: pageAnalysis.type,
                    generatedSummary: this.summarizeGenerated(generatedContent),
                    keyThemes: this.extractKeyThemes(generatedContent)
                };
                
                this.pageContexts.push(pageContext);

                logger.info(`  ✅ Page ${i + 1} generated successfully`);
                logger.debug(`     Context summary: ${pageContext.generatedSummary}`);

            } catch (error) {
                logger.error(`  ❌ Failed to generate page ${i + 1}:`, error);
                
                // 실패해도 계속 진행 (부분 성공)
                results.push({
                    pageNumber: i + 1,
                    content: null,
                    analysis: pageAnalysis,
                    error: error.message,
                    usedContexts: this.pageContexts.length
                });
            }
        }

        logger.info(`\n✅ Sequential generation completed!`);
        logger.info(`  📊 Success: ${results.filter(r => r.content !== null).length}/${results.length}`);

        return results;
    }

    /**
     * 생성된 콘텐츠 파싱
     * @private
     */
    parseGeneratedContent(response) {
        if (typeof response === 'string') {
            try {
                return JSON.parse(response);
            } catch (e) {
                logger.warn('  ⚠️ Failed to parse response as JSON, returning as-is');
                return response;
            }
        }
        return response;
    }

    /**
     * 생성된 내용 요약 (다음 페이지 컨텍스트용)
     * @private
     */
    summarizeGenerated(content) {
        if (!content) {
            return '(생성 실패)';
        }

        // 객체인 경우
        if (typeof content === 'object') {
            const keys = Object.keys(content);
            if (keys.length === 0) {
                return '(빈 내용)';
            }

            // 첫 번째 필드의 값 추출
            const firstKey = keys[0];
            const firstValue = content[firstKey];
            
            if (typeof firstValue === 'string') {
                const preview = firstValue.substring(0, 50);
                return `${firstKey}: ${preview}${firstValue.length > 50 ? '...' : ''}`;
            }

            return `${firstKey} 등 ${keys.length}개 항목 생성`;
        }

        // 문자열인 경우
        if (typeof content === 'string') {
            return content.substring(0, 50) + (content.length > 50 ? '...' : '');
        }

        return String(content).substring(0, 50);
    }

    /**
     * 주요 테마 추출
     * @private
     */
    extractKeyThemes(content) {
        const themes = [];
        
        if (!content) {
            return themes;
        }

        if (typeof content === 'object') {
            // 객체 키를 테마로 (최대 3개)
            themes.push(...Object.keys(content).slice(0, 3));
        } else if (typeof content === 'string') {
            // 문자열에서 주요 단어 추출 (간단한 방식)
            const words = content.split(/\s+/).filter(w => w.length > 2);
            themes.push(...words.slice(0, 3));
        }

        return themes.length > 0 ? themes : ['일반 내용'];
    }

    /**
     * 컨텍스트 초기화
     */
    resetContexts() {
        this.pageContexts = [];
        logger.debug('🔄 Page contexts reset');
    }

    /**
     * 현재 컨텍스트 가져오기
     * @returns {Array} 페이지 컨텍스트 배열
     */
    getContexts() {
        return [...this.pageContexts];
    }

    /**
     * 생성 통계
     * @param {Array} results - 생성 결과 배열
     * @returns {Object} 통계 정보
     */
    getGenerationStats(results) {
        const stats = {
            total: results.length,
            successful: results.filter(r => r.content !== null).length,
            failed: results.filter(r => r.content === null).length,
            avgContextsUsed: 0,
            byPageType: {}
        };

        // 평균 컨텍스트 사용 수
        const totalContexts = results.reduce((sum, r) => sum + (r.usedContexts || 0), 0);
        stats.avgContextsUsed = (totalContexts / results.length).toFixed(2);

        // 페이지 유형별 통계
        results.forEach(r => {
            const type = r.analysis?.type || 'UNKNOWN';
            if (!stats.byPageType[type]) {
                stats.byPageType[type] = { total: 0, successful: 0 };
            }
            stats.byPageType[type].total++;
            if (r.content !== null) {
                stats.byPageType[type].successful++;
            }
        });

        return stats;
    }
}

