/**
 * Batch Generator
 * 여러 주제를 한 번에 생성하는 일괄 생성 기능
 * 
 * @module features/batch-generator
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('BatchGenerator');

/**
 * 일괄 생성기 클래스
 */
export class BatchGenerator {
    constructor(aiController) {
        this.aiController = aiController;
        logger.info('🔄 BatchGenerator initialized');
    }

    /**
     * 일괄 생성 실행
     * @param {Array<string>} topics - 주제 목록
     * @param {Object} options - 생성 옵션
     * @returns {Promise<Array>} - 생성 결과 목록
     */
    async generateBatch(topics, options = {}) {
        logger.info(`🔄 Starting batch generation for ${topics.length} topics...`);
        
        const {
            ageGroup = '만 4-5세',
            duration = '1주일',
            template = null,  // 템플릿 문서 (선택)
            delay = 2000      // 각 생성 사이 지연 (API rate limit 방지)
        } = options;
        
        const results = [];
        
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            logger.info(`  🔄 [${i + 1}/${topics.length}] Generating: "${topic}"`);
            
            try {
                // 템플릿 사용 여부에 따라 다르게 처리
                let result;
                
                if (template) {
                    // 템플릿 기반 생성
                    result = await this.generateFromTemplate(topic, template, { ageGroup, duration });
                } else {
                    // 일반 생성 (사용자 요청 형태로)
                    const userRequest = this.buildBatchRequest(topic, { ageGroup, duration });
                    result = await this.aiController.handleUserRequest(userRequest);
                }
                
                results.push({
                    topic,
                    success: true,
                    document: result.updatedDocument,
                    metadata: result.metadata
                });
                
                logger.info(`    ✅ Generated: "${topic}"`);
                
            } catch (error) {
                logger.error(`    ❌ Failed: "${topic}" - ${error.message}`);
                results.push({
                    topic,
                    success: false,
                    error: error.message
                });
            }
            
            // 지연 (마지막 항목은 제외)
            if (i < topics.length - 1 && delay > 0) {
                logger.debug(`    ⏳ Waiting ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // 요약
        const successCount = results.filter(r => r.success).length;
        logger.info(`✅ Batch generation completed: ${successCount}/${topics.length} successful`);
        
        return results;
    }

    /**
     * 일괄 생성 요청 문구 생성
     * @private
     */
    buildBatchRequest(topic, options) {
        const { ageGroup, duration } = options;
        
        return `"${topic}" 주제로 놀이계획안을 생성해줘. ` +
               `연령은 ${ageGroup}, 기간은 ${duration}으로 설정.`;
    }

    /**
     * 템플릿 기반 생성
     * @private
     */
    async generateFromTemplate(topic, template, options) {
        // 템플릿을 복제하고 주제만 변경
        const userRequest = this.buildBatchRequest(topic, options);
        
        // AI Controller를 사용하여 생성
        // (템플릿이 이미 viewer에 로드되어 있다고 가정)
        return await this.aiController.handleUserRequest(userRequest);
    }

    /**
     * 주제 목록 파싱 (텍스트 → 배열)
     * @param {string} topicsText - 주제 목록 텍스트 (줄바꿈 또는 쉼표로 구분)
     * @returns {Array<string>} - 주제 배열
     */
    parseTopics(topicsText) {
        // 줄바꿈, 쉼표, 세미콜론으로 구분
        const topics = topicsText
            .split(/[\n,;]+/)
            .map(t => t.trim())
            .filter(t => t.length > 0);
        
        logger.info(`📋 Parsed ${topics.length} topics: ${topics.join(', ')}`);
        
        return topics;
    }

    /**
     * 일괄 생성 결과를 다운로드
     * @param {Array} results - 생성 결과 목록
     * @param {Object} exporter - HwpxSafeExporter 인스턴스
     */
    async downloadBatchResults(results, exporter) {
        logger.info('💾 Downloading batch results...');
        
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            
            if (!result.success) {
                logger.warn(`  ⏭️  Skipping failed: "${result.topic}"`);
                continue;
            }
            
            try {
                const filename = `${this.sanitizeFilename(result.topic)}_${Date.now()}.hwpx`;
                
                // HWPX 내보내기
                const exportResult = await exporter.exportToFile(result.document, filename);
                
                if (exportResult.success) {
                    // 다운로드
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(exportResult.file);
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                    
                    logger.info(`  💾 Downloaded: ${filename}`);
                    
                    // 각 다운로드 사이 약간의 지연 (브라우저가 처리할 시간)
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                logger.error(`  ❌ Download failed: "${result.topic}" - ${error.message}`);
            }
        }
        
        logger.info('✅ Batch download completed');
    }

    /**
     * 파일명 정리 (특수문자 제거)
     * @private
     */
    sanitizeFilename(text) {
        return text
            .replace(/[^a-zA-Z0-9가-힣\s_-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50); // 최대 50자
    }
}

export default BatchGenerator;

