/**
 * AI Document Controller
 * 모든 AI 모듈을 통합하는 고수준 컨트롤러
 * 
 * @module ai/ai-controller
 * @version 2.1.0
 */

import { getLogger } from '../utils/logger.js';
import { HWPXError, ErrorType } from '../utils/error.js';
import { AIConfig } from '../config/ai-config.js';
import { DocumentStructureExtractor } from './structure-extractor.js';
import { GPTContentGenerator } from './gpt-content-generator.js';
import { ContentMerger } from './content-merger.js';
import { HwpxSafeExporter } from '../export/hwpx-safe-exporter.js';
import { MultiPageAnalyzer } from './multi-page-analyzer.js';
import { SequentialPageGenerator } from './sequential-page-generator.js';
import { PromptBuilder } from './prompt-builder.js';

const logger = getLogger();

/**
 * AI 문서 컨트롤러 클래스
 * 전체 AI 워크플로우 관리: 추출 → 생성 → 병합 → 재렌더링
 * 
 * @example
 * const controller = new AIDocumentController(viewer);
 * await controller.handleUserRequest('초등학생이 이해할 수 있게 바꿔줘');
 */
export class AIDocumentController {
    /**
     * AIDocumentController 생성자
     * @param {Object} viewer - HWPX Viewer 인스턴스
     * @param {Object} [options={}] - 컨트롤러 옵션
     */
    constructor(viewer, options = {}) {
        if (!viewer) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                'Viewer 인스턴스가 필요합니다'
            );
        }
        
        this.viewer = viewer;
        this.options = {
            autoRender: options.autoRender !== false,
            saveHistory: options.saveHistory !== false,
            ...options
        };
        
        // AI 모듈 초기화 (API 키는 나중에 설정)
        this.extractor = new DocumentStructureExtractor();
        this.generator = null; // API 키 필요
        this.merger = new ContentMerger();
        this.exporter = new HwpxSafeExporter(); // 안전한 HWPX 내보내기
        
        // 상태 관리
        this.state = {
            isProcessing: false,
            currentRequest: null,
            originalDocument: null,
            updatedDocument: null,
            extractedData: null,
            error: null
        };
        
        // 변경 이력
        this.history = [];
        
        logger.info('🤖 AIDocumentController initialized');
    }
    
    /**
     * API 키 설정
     * @param {string} apiKey - OpenAI API 키
     */
    setApiKey(apiKey) {
        if (!apiKey) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                'API 키가 유효하지 않습니다'
            );
        }
        
        this.generator = new GPTContentGenerator(apiKey);
        AIConfig.openai.setApiKey(apiKey);
        logger.info('✅ API 키가 설정되었습니다');
        
        // 🆕 aiTextEditor의 gptGenerator 참조 업데이트 (v2.3.2)
        if (typeof window.updateAITextEditorGenerator === 'function') {
            window.updateAITextEditorGenerator();
        }
    }
    
    /**
     * API 키 확인
     * @returns {boolean} API 키 설정 여부
     */
    hasApiKey() {
        return this.generator !== null;
    }
    
    /**
     * 사용자 요청 처리 (메인 메서드)
     * @param {string} userMessage - 사용자 요청 메시지
     * @returns {Promise<Object>} 처리 결과
     * 
     * @example
     * const result = await controller.handleUserRequest('쉽게 바꿔줘');
     * // Returns: { success: true, updatedDocument, metadata }
     */
    async handleUserRequest(userMessage) {
        logger.info('🤖 Handling user request...');
        logger.time('AI Request Processing');
        
        // 동시 요청 방지
        if (this.state.isProcessing) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                '이미 요청을 처리 중입니다. 완료 후 다시 시도하세요.'
            );
        }
        
        // API 키 확인
        if (!this.hasApiKey()) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                AIConfig.prompts.errorMessages.noApiKey
            );
        }
        
        // 상태 업데이트
        this.state.isProcessing = true;
        this.state.currentRequest = userMessage;
        this.state.error = null;
        
        try {
            // 1. 현재 문서 가져오기
            const currentDocument = this.viewer.getDocument();
            if (!currentDocument) {
                throw new HWPXError(
                    ErrorType.VALIDATION_ERROR,
                    '문서가 로드되지 않았습니다'
                );
            }
            
            this.state.originalDocument = currentDocument;
            
            // 2. 구조 추출 (구조화된 방식)
            logger.info('  📊 Step 1/4: Extracting table structure...');
            
            // 🔥 새로운 방식: 헤더-내용 쌍 추출
            const headerContentPairs = this.extractor.extractTableHeaderContentPairs(currentDocument);
            this.state.headerContentPairs = headerContentPairs;
            
            logger.info(`    ✓ Extracted ${headerContentPairs.length} header-content pairs`);
            
            // 모든 헤더 출력 (디버깅용)
            headerContentPairs.forEach(pair => {
                logger.info(`      📋 "${pair.header}" → "${pair.content ? pair.content.substring(0, 30) + '...' : '(비어있음)'}"`);
            });
            
            // 🆕 2.5. 부분 수정 감지 및 필터링
            let pairsToGenerate = headerContentPairs;
            let isPartialEdit = false;
            
            if (window.partialEditor) {
                const partialRequest = window.partialEditor.parsePartialRequest(userMessage);
                if (partialRequest) {
                    isPartialEdit = true;
                    logger.info(`  ✏️ Partial edit detected: ${partialRequest.targetItems.join(', ')}`);
                    pairsToGenerate = window.partialEditor.filterPairs(
                        headerContentPairs,
                        partialRequest.targetItems
                    );
                    logger.info(`    → Generating only ${pairsToGenerate.length}/${headerContentPairs.length} items`);
                }
            }
            
            // 3. GPT 콘텐츠 생성 (구조화된 방식)
            logger.info('  🤖 Step 2/4: Generating content with GPT (structured)...');
            const generatedJSON = await this.generateStructuredContent(
                pairsToGenerate,
                userMessage
            );
            
            logger.info(`    ✓ Generated content for ${Object.keys(generatedJSON).length} items`);
            
            // 4. 콘텐츠 병합 (구조화된 방식)
            logger.info('  🔀 Step 3/4: Merging generated content...');
            const updatedDocument = this.mergeStructuredContent(
                currentDocument,
                generatedJSON,
                headerContentPairs
            );
            
            this.state.updatedDocument = updatedDocument;
            
            // 5. 재렌더링 (선택적)
            if (this.options.autoRender) {
                logger.info('  🎨 Step 4/4: Re-rendering document...');
                // 🔥 중요: updateDocument()를 사용하여 상태와 렌더링을 원자적으로 수행
                await this.viewer.updateDocument(updatedDocument);
            }
            
            // 6. 이력 저장 (선택적)
            if (this.options.saveHistory) {
                this.saveToHistory({
                    request: userMessage,
                    original: currentDocument,
                    updated: updatedDocument,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        itemsUpdated: Object.keys(generatedJSON).length,
                        tokensUsed: 0 // TODO: 토큰 수 추적
                    }
                });
            }
            
            // 결과 객체
            const result = {
                success: true,
                updatedDocument: updatedDocument,
                metadata: {
                    request: userMessage,
                    itemsUpdated: Object.keys(generatedJSON).length,
                    tokensUsed: 0, // TODO: 토큰 수 추적
                    processingTime: Date.now() - (this.state.processingStartTime || Date.now())
                }
            };
            
            logger.timeEnd('AI Request Processing');
            logger.info('✅ Request processed successfully');
            
            return result;
            
        } catch (error) {
            this.state.error = error;
            logger.error('❌ Request processing failed:', error);
            logger.timeEnd('AI Request Processing');
            throw error;
            
        } finally {
            this.state.isProcessing = false;
            this.state.currentRequest = null;
        }
    }
    
    /**
     * 변경 미리보기 (렌더링 없이 변경 사항만 확인)
     * @param {string} userMessage - 사용자 요청 메시지
     * @returns {Promise<Object>} 미리보기 결과
     * 
     * @example
     * const preview = await controller.previewChanges('쉽게 바꿔줘');
     * console.log('변경될 슬롯:', preview.updatedSlots.length);
     */
    async previewChanges(userMessage) {
        logger.info('👁️  Previewing changes...');
        
        // 임시로 autoRender를 false로 설정
        const originalAutoRender = this.options.autoRender;
        this.options.autoRender = false;
        
        try {
            const result = await this.handleUserRequest(userMessage);
            
            // 변경 사항 요약
            const preview = {
                updatedSlots: result.metadata.slotsUpdated,
                tokensUsed: result.metadata.tokensUsed,
                changes: this.summarizeChanges(
                    this.state.originalDocument,
                    result.updatedDocument
                )
            };
            
            return preview;
            
        } finally {
            this.options.autoRender = originalAutoRender;
        }
    }
    
    /**
     * 변경 사항 적용
     * previewChanges 후 사용자가 승인하면 실제 적용
     * @returns {Promise<void>}
     */
    async applyChanges() {
        if (!this.state.updatedDocument) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                '적용할 변경 사항이 없습니다'
            );
        }
        
        logger.info('✅ Applying changes...');
        
        // 🔥 updateDocument()를 사용하여 상태와 렌더링을 원자적으로 수행
        await this.viewer.updateDocument(this.state.updatedDocument);
        
        logger.info('✅ Changes applied successfully');
    }
    
    /**
     * 변경 사항 취소 (원본으로 되돌리기)
     * @returns {Promise<void>}
     */
    async revertChanges() {
        if (!this.state.originalDocument) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                '되돌릴 원본 문서가 없습니다'
            );
        }
        
        logger.info('🔙 Reverting changes...');
        
        // 🔥 updateDocument()를 사용하여 상태와 렌더링을 원자적으로 수행
        await this.viewer.updateDocument(this.state.originalDocument);
        
        this.state.updatedDocument = null;
        
        logger.info('✅ Changes reverted successfully');
    }
    
    /**
     * 변경 사항 요약
     * @param {Object} original - 원본 문서
     * @param {Object} updated - 업데이트된 문서
     * @returns {Object} 변경 사항 요약
     * @private
     */
    summarizeChanges(original, updated) {
        // 간단한 요약 생성
        return {
            sectionsChanged: 0, // 실제로는 비교 필요
            elementsChanged: 0,
            totalChanges: this.state.extractedData?.textSlots.size || 0
        };
    }
    
    /**
     * 이력 저장
     * @param {Object} entry - 이력 항목
     * @private
     */
    saveToHistory(entry) {
        this.history.push(entry);
        
        // 최대 크기 제한
        const maxSize = this.merger.options.maxHistorySize;
        if (this.history.length > maxSize) {
            this.history.shift();
        }
    }
    
    /**
     * 변경 이력 조회
     * @param {number} [count=10] - 조회할 개수
     * @returns {Array} 이력 배열
     */
    getHistory(count = 10) {
        return this.history.slice(-count).map(entry => ({
            request: entry.request,
            timestamp: entry.metadata.timestamp,
            slotsUpdated: entry.metadata.slotsUpdated,
            tokensUsed: entry.metadata.tokensUsed
        }));
    }
    
    /**
     * 이력 클리어
     */
    clearHistory() {
        this.history = [];
        logger.info('🗑️  History cleared');
    }
    
    /**
     * 현재 상태 조회
     * @returns {Object} 상태 객체
     */
    getState() {
        return {
            isProcessing: this.state.isProcessing,
            hasApiKey: this.hasApiKey(),
            hasDocument: this.viewer.getDocument() !== null,
            currentRequest: this.state.currentRequest,
            error: this.state.error ? {
                type: this.state.error.type,
                message: this.state.error.message
            } : null
        };
    }
    
    /**
     * 통계 조회 (모든 모듈의 통계 통합)
     * @returns {Object} 통합 통계
     */
    getStatistics() {
        return {
            extractor: this.extractor.getStatistics(),
            generator: this.generator ? this.generator.getStatistics() : null,
            merger: this.merger.getStatistics(),
            history: {
                totalEntries: this.history.length
            }
        };
    }
    
    /**
     * 구조화된 콘텐츠 생성 (헤더-내용 쌍 기반)
     * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍
     * @param {string} userRequest - 사용자 요청
     * @returns {Promise<Object>} 생성된 JSON 객체
     * @private
     */
    async generateStructuredContent(headerContentPairs, userRequest) {
        // 프롬프트 빌더 생성 (임시)
        const { PromptBuilder } = await import('./prompt-builder.js');
        const promptBuilder = new PromptBuilder();
        
        // 구조화된 프롬프트 빌드
        const messages = promptBuilder.buildStructuredPrompt(headerContentPairs, userRequest);
        
        // GPT API 호출 (재시도 포함)
        const response = await this.generator.callAPIWithRetry(messages);
        
        // JSON 파싱
        try {
            // 🔥 OpenAI API 응답 구조: response.choices[0].message.content
            let jsonText = '';
            
            if (response.choices && response.choices[0] && response.choices[0].message) {
                jsonText = response.choices[0].message.content.trim();
            } else if (response.content) {
                // 대체 구조
                jsonText = response.content.trim();
            } else {
                throw new Error('응답에서 content를 찾을 수 없습니다');
            }
            
            logger.debug('📥 Raw GPT response:', jsonText.substring(0, 200) + '...');
            
            // JSON 블록 추출 (```json ... ``` 제거)
            const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/{[\s\S]*}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : jsonText;
            
            const generatedJSON = JSON.parse(jsonStr);
            
            logger.info(`✅ Generated JSON with ${Object.keys(generatedJSON).length} keys`);
            
            // 디버그: 생성된 JSON 출력
            logger.info('📋 Generated content:');
            Object.keys(generatedJSON).forEach(key => {
                const value = generatedJSON[key];
                logger.info(`  "${key}" → "${value ? value.substring(0, 40) + '...' : '(비어있음)'}"`);
            });
            
            return generatedJSON;
            
        } catch (error) {
            logger.error('❌ Failed to parse JSON response:', error);
            logger.error('Full response:', JSON.stringify(response, null, 2));
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                'GPT 응답을 JSON으로 파싱할 수 없습니다. 응답: ' + (response.choices?.[0]?.message?.content || 'undefined')
            );
        }
    }
    
    /**
     * 구조화된 콘텐츠 병합 (헤더-내용 쌍 기반)
     * @param {Object} document - 원본 문서
     * @param {Object} generatedJSON - 생성된 JSON 객체
     * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍
     * @returns {Object} 업데이트된 문서
     * @private
     */
    mergeStructuredContent(document, generatedJSON, headerContentPairs) {
        // 문서 딥 복사
        const updatedDocument = JSON.parse(JSON.stringify(document));
        
        let updatedCount = 0;
        
        logger.info(`🔀 Merging ${Object.keys(generatedJSON).length} items into document...`);
        
        // 생성된 JSON 키 출력 (디버깅)
        logger.debug('Generated JSON keys:', Object.keys(generatedJSON));
        
        // 각 헤더-내용 쌍에 대해 처리
        headerContentPairs.forEach((pair, idx) => {
            const newContent = generatedJSON[pair.header];
            
            logger.debug(`[${idx}] Processing "${pair.header}" → "${newContent ? newContent.substring(0, 30) + '...' : 'undefined'}"`);
            
            if (newContent) {
                try {
                    // 문서에서 해당 셀 찾기
                    const section = updatedDocument.sections[pair.path.section];
                    if (!section) {
                        logger.error(`  ❌ Section ${pair.path.section} not found`);
                        return;
                    }
                    
                    const table = section.elements[pair.path.table];
                    if (!table) {
                        logger.error(`  ❌ Table ${pair.path.table} not found`);
                        return;
                    }
                    
                    const row = table.rows[pair.path.row];
                    if (!row) {
                        logger.error(`  ❌ Row ${pair.path.row} not found`);
                        return;
                    }
                    
                    const cell = row.cells[pair.path.contentCell];
                    if (!cell) {
                        logger.error(`  ❌ Cell ${pair.path.contentCell} not found`);
                        return;
                    }
                    
                    // 🔥 셀 내용 업데이트 또는 생성
                    if (!cell.elements || cell.elements.length === 0) {
                        // 비어있는 셀: 새로운 구조 생성
                        logger.debug(`  📝 Creating new paragraph for empty cell`);
                        cell.elements = [{
                            type: 'paragraph',
                            runs: [{
                                text: newContent,
                                style: {}
                            }]
                        }];
                        updatedCount++;
                        logger.info(`  ✓ Created "${pair.header}": "${newContent.substring(0, 30)}..."`);
                    } else {
                        // 기존 셀: 업데이트
                        const paragraph = cell.elements[0];
                        
                        if (!paragraph.runs || paragraph.runs.length === 0) {
                            // runs가 없으면 생성
                            logger.debug(`  📝 Creating new runs`);
                            paragraph.runs = [{
                                text: newContent,
                                style: {}
                            }];
                        } else {
                            // runs가 있으면 업데이트
                            paragraph.runs[0].text = newContent;
                        }
                        
                        updatedCount++;
                        logger.info(`  ✓ Updated "${pair.header}": "${newContent.substring(0, 30)}..."`);
                    }
                } catch (error) {
                    logger.error(`  ❌ Error updating "${pair.header}":`, error);
                }
            } else {
                logger.warn(`  ⚠️  No content generated for "${pair.header}"`);
            }
        });
        
        logger.info(`✅ Updated ${updatedCount} / ${headerContentPairs.length} items`);
        
        return updatedDocument;
    }
    
    /**
     * 모든 통계 리셋
     */
    resetStatistics() {
        this.extractor.getStatistics && this.extractor.resetStatistics && this.extractor.resetStatistics();
        this.generator && this.generator.resetStatistics && this.generator.resetStatistics();
        this.merger.resetStatistics && this.merger.resetStatistics();
        logger.info('📊 All statistics reset');
    }
    
    /**
     * 현재 문서를 HWPX 파일로 저장 (안전한 방식)
     * @param {string} filename - 저장할 파일명 (기본값: 'document.hwpx')
     * @returns {Promise<void>}
     */
    /**
     * 다중 페이지 요청 처리
     * @param {string} userMessage - 사용자 요청 메시지
     * @returns {Promise<Object>} 처리 결과
     */
    async handleMultiPageRequest(userMessage) {
        logger.info('📄 Handling multi-page request...');
        logger.time('Multi-Page Processing');

        try {
            const currentDocument = this.viewer.getDocument();

            if (!currentDocument || !currentDocument.sections) {
                throw new HWPXError(
                    ErrorType.VALIDATION_ERROR,
                    '문서가 로드되지 않았습니다'
                );
            }

            // 1. 다중 페이지 분석
            logger.info('  📊 Step 1/5: Analyzing document structure...');
            const multiPageAnalyzer = new MultiPageAnalyzer();
            const analysis = multiPageAnalyzer.analyzeDocument(currentDocument);

            // 분석 결과 출력
            logger.info(multiPageAnalyzer.summarizeAnalysis(analysis));

            // 2. 각 페이지 데이터 추출
            logger.info('  📋 Step 2/5: Extracting page data...');
            const allPagesData = [];
            
            for (let i = 0; i < currentDocument.sections.length; i++) {
                const section = currentDocument.sections[i];
                const pairs = this.extractor.extractTableHeaders(section);
                allPagesData.push(pairs);
                logger.debug(`    Page ${i + 1}: ${pairs.length} items extracted`);
            }

            // 3. 생성 전략에 따라 처리
            logger.info('  🤖 Step 3/5: Generating content...');
            
            let results;
            if (analysis.strategy === 'sequential' || analysis.strategy === 'semi-sequential') {
                // 순차 생성 (페이지 간 관계 고려)
                logger.info('     → Sequential generation (pages are related)');
                const promptBuilder = new PromptBuilder();
                const sequentialGenerator = new SequentialPageGenerator(
                    this.generator,
                    promptBuilder
                );
                results = await sequentialGenerator.generatePageByPage(
                    analysis,
                    allPagesData,
                    userMessage
                );

                // 통계 출력
                const stats = sequentialGenerator.getGenerationStats(results);
                logger.info(`\n📊 Generation Statistics:`);
                logger.info(`  Total: ${stats.total} pages`);
                logger.info(`  Successful: ${stats.successful} pages`);
                logger.info(`  Failed: ${stats.failed} pages`);
                logger.info(`  Avg contexts used: ${stats.avgContextsUsed}`);

            } else {
                // 병렬 생성 (독립적인 페이지들)
                logger.info('     → Parallel generation (pages are independent)');
                results = await this.generatePagesInParallel(
                    analysis,
                    allPagesData,
                    userMessage
                );
            }

            // 4. 결과 병합
            logger.info('  🔀 Step 4/5: Merging results...');
            const updatedDocument = this.mergeMultiPageResults(
                currentDocument,
                results,
                allPagesData
            );

            this.state.updatedDocument = updatedDocument;

            // 5. 재렌더링
            if (this.options.autoRender) {
                logger.info('  🎨 Step 5/5: Re-rendering document...');
                await this.viewer.updateDocument(updatedDocument);
            }

            logger.timeEnd('Multi-Page Processing');
            logger.info('✅ Multi-page request completed!');

            return {
                success: true,
                analysis,
                results,
                totalPages: analysis.totalPages,
                strategy: analysis.strategy
            };

        } catch (error) {
            logger.timeEnd('Multi-Page Processing');
            logger.error('❌ Multi-page request failed:', error);
            
            this.state.error = error;
            
            throw new HWPXError(
                ErrorType.AI_ERROR,
                `다중 페이지 처리 실패: ${error.message}`,
                error
            );
        }
    }

    /**
     * 병렬 페이지 생성
     * @private
     */
    async generatePagesInParallel(analysis, allPagesData, userRequest) {
        logger.info('     Generating all pages in parallel...');

        const promises = allPagesData.map(async (pageData, i) => {
            const pageAnalysis = analysis.pages[i];
            
            logger.debug(`       → Starting page ${i + 1} generation...`);

            try {
                // 구조화된 방식으로 생성
                const generatedJSON = await this.generateStructuredContent(
                    pageData,
                    userRequest + `\n(페이지 ${i + 1}: ${pageAnalysis.type} - ${pageAnalysis.role})`
                );

                logger.debug(`       ✅ Page ${i + 1} completed`);

                return {
                    pageNumber: i + 1,
                    content: generatedJSON,
                    analysis: pageAnalysis,
                    usedContexts: 0
                };

            } catch (error) {
                logger.error(`       ❌ Page ${i + 1} failed:`, error.message);
                
                return {
                    pageNumber: i + 1,
                    content: null,
                    analysis: pageAnalysis,
                    error: error.message,
                    usedContexts: 0
                };
            }
        });

        const results = await Promise.all(promises);
        
        const successCount = results.filter(r => r.content !== null).length;
        logger.info(`     ✅ Parallel generation: ${successCount}/${results.length} successful`);

        return results;
    }

    /**
     * 다중 페이지 결과 병합
     * @private
     */
    mergeMultiPageResults(originalDocument, results, allPagesData) {
        logger.debug('  🔀 Merging multi-page results...');

        const updatedDocument = JSON.parse(JSON.stringify(originalDocument));

        results.forEach((result, pageIndex) => {
            if (result.content && updatedDocument.sections[pageIndex]) {
                // 각 페이지별로 병합
                const pageData = allPagesData[pageIndex];
                const section = updatedDocument.sections[pageIndex];

                // 구조화된 콘텐츠 병합
                const updatedSection = this.mergeStructuredContent(
                    { sections: [section] },
                    result.content,
                    pageData
                );

                // 업데이트된 섹션 적용
                if (updatedSection.sections && updatedSection.sections[0]) {
                    updatedDocument.sections[pageIndex] = updatedSection.sections[0];
                    logger.debug(`    ✓ Page ${pageIndex + 1} merged`);
                }
            } else if (result.error) {
                logger.warn(`    ⚠️ Page ${pageIndex + 1} skipped (generation failed)`);
            }
        });

        logger.info(`  ✅ Merged ${results.filter(r => r.content !== null).length} pages`);

        return updatedDocument;
    }

    async saveAsHwpx(filename = 'document.hwpx') {
        try {
            logger.info('💾 HWPX 파일 저장 시작...');
            logger.time('Save HWPX');
            
            // 원본 HWPX 파일 가져오기
            const originalFile = this.viewer.state.currentFile;
            
            if (!originalFile) {
                throw new HWPXError(
                    ErrorType.VALIDATION_ERROR,
                    '원본 HWPX 파일이 없습니다. 먼저 파일을 로드해주세요.'
                );
            }
            
            // 현재 문서 가져오기 (업데이트된 문서 또는 원본 문서)
            const document = this.state.updatedDocument || this.viewer.getDocument();
            
            if (!document) {
                throw new HWPXError(
                    ErrorType.VALIDATION_ERROR,
                    '저장할 문서가 없습니다'
                );
            }
            
            // 안전한 HWPX 파일 내보내기 (원본 기반으로 수정된 부분만 교체)
            await this.exporter.exportModifiedHwpx(originalFile, document, filename);
            
            logger.timeEnd('Save HWPX');
            logger.info('✅ HWPX 파일 저장 완료!');
            
            return {
                success: true,
                filename: filename,
                message: 'HWPX 파일이 성공적으로 저장되었습니다'
            };
            
        } catch (error) {
            logger.error('❌ HWPX 파일 저장 실패:', error);
            throw new HWPXError(
                ErrorType.EXPORT_ERROR,
                'HWPX 파일 저장에 실패했습니다',
                error
            );
        }
    }
    
    /**
     * 업데이트된 문서가 있는지 확인
     * @returns {boolean} 업데이트된 문서 존재 여부
     */
    hasUpdatedDocument() {
        return this.state.updatedDocument !== null;
    }
    
    /**
     * 현재 문서 상태 가져오기
     * @returns {Object} 현재 문서 (업데이트된 문서 또는 원본 문서)
     */
    getCurrentDocument() {
        return this.state.updatedDocument || this.viewer.getDocument();
    }
}

/**
 * 간편 함수: AI 요청 처리
 * @param {Object} viewer - Viewer 인스턴스
 * @param {string} apiKey - API 키
 * @param {string} userMessage - 사용자 메시지
 * @param {Object} [options={}] - 옵션
 * @returns {Promise<Object>} 처리 결과
 * 
 * @example
 * import { processAIRequest } from './ai-controller.js';
 * const result = await processAIRequest(viewer, apiKey, '쉽게 바꿔줘');
 */
export async function processAIRequest(viewer, apiKey, userMessage, options = {}) {
    const controller = new AIDocumentController(viewer, options);
    controller.setApiKey(apiKey);
    return await controller.handleUserRequest(userMessage);
}

// Default export
export default AIDocumentController;

