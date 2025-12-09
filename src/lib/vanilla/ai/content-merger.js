/**
 * Content Merger
 * GPT 생성 콘텐츠를 원본 문서 구조에 병합
 * 
 * @module ai/content-merger
 * @version 2.1.0
 */

import { getLogger } from '../utils/logger.js';
import { HWPXError, ErrorType } from '../utils/error.js';
import { validateStructure, validateSlotData } from './validation.js';
import { AIConfig } from '../config/ai-config.js';

const logger = getLogger();

/**
 * 콘텐츠 병합기 클래스
 * GPT가 생성한 새로운 텍스트를 원본 문서 구조에 병합
 * 
 * @example
 * const merger = new ContentMerger();
 * const updated = merger.mergeGeneratedContent(originalDoc, gptResponse);
 */
export class ContentMerger {
    /**
     * ContentMerger 생성자
     * @param {Object} [options={}] - 병합 옵션
     */
    constructor(options = {}) {
        this.options = {
            validateStructure: options.validateStructure ?? AIConfig.merging.validateStructure,
            saveHistory: options.saveHistory ?? AIConfig.merging.saveHistory,
            maxHistorySize: options.maxHistorySize || AIConfig.merging.maxHistorySize,
            ...options
        };
        
        // 변경 이력
        this.history = [];
        
        // 통계
        this.stats = {
            totalMerges: 0,
            successfulMerges: 0,
            failedMerges: 0,
            totalSlotsUpdated: 0
        };
        
        logger.info('🔀 ContentMerger initialized');
    }
    
    /**
     * 생성된 콘텐츠 병합 (메인 메서드)
     * @param {Object} originalDocument - 원본 문서
     * @param {Object} generatedContent - GPT 생성 콘텐츠
     * @param {Object} extractedData - 추출된 데이터 (텍스트 슬롯 맵 포함)
     * @returns {Object} 업데이트된 문서
     * 
     * @example
     * const updated = merger.mergeGeneratedContent(originalDoc, gptResponse, extractedData);
     */
    mergeGeneratedContent(originalDocument, generatedContent, extractedData) {
        logger.info('🔀 Merging generated content...');
        logger.time('Content Merge');
        
        this.stats.totalMerges++;
        
        try {
            // 1. 입력 검증
            this.validateInput(originalDocument, generatedContent, extractedData);
            
            // 2. 슬롯 데이터 검증
            if (this.options.validateStructure) {
                const slotValidation = validateSlotData(
                    generatedContent.updatedSlots,
                    extractedData.textSlots
                );
                
                if (!slotValidation.isValid) {
                    throw new HWPXError(
                        ErrorType.VALIDATION_ERROR,
                        `슬롯 데이터 검증 실패: ${slotValidation.errors.join(', ')}`
                    );
                }
                
                if (slotValidation.warnings.length > 0) {
                    logger.warn(`⚠️  ${slotValidation.warnings.length} warnings during validation`);
                    slotValidation.warnings.forEach(w => logger.warn(`  - ${w}`));
                }
            }
            
            // 3. 원본 문서 깊은 복사
            const updatedDocument = this.deepClone(originalDocument);
            
            // 4. 슬롯 ID → 문서 경로 매핑 생성
            const slotPathMap = this.buildSlotPathMap(extractedData.textSlots);
            
            // 5. 각 슬롯에 대해 텍스트 교체
            const updateCount = this.applySlotUpdates(
                updatedDocument,
                generatedContent.updatedSlots,
                slotPathMap
            );
            
            // 6. 구조 검증 (선택적)
            if (this.options.validateStructure) {
                const structureValidation = validateStructure(originalDocument, updatedDocument);
                
                if (!structureValidation.isValid) {
                    throw new HWPXError(
                        ErrorType.VALIDATION_ERROR,
                        `구조 검증 실패: ${structureValidation.errors.join(', ')}`
                    );
                }
            }
            
            // 7. 변경 이력 저장 (선택적)
            if (this.options.saveHistory) {
                this.saveToHistory({
                    original: originalDocument,
                    updated: updatedDocument,
                    generatedContent: generatedContent,
                    timestamp: new Date().toISOString(),
                    slotsUpdated: updateCount
                });
            }
            
            // 8. 통계 업데이트
            this.stats.successfulMerges++;
            this.stats.totalSlotsUpdated += updateCount;
            
            logger.timeEnd('Content Merge');
            logger.info(`✅ Merged ${updateCount} text slots`);
            
            return updatedDocument;
            
        } catch (error) {
            this.stats.failedMerges++;
            logger.error('❌ Content merge failed:', error);
            logger.timeEnd('Content Merge');
            throw error;
        }
    }
    
    /**
     * 입력 검증
     * @param {Object} originalDocument - 원본 문서
     * @param {Object} generatedContent - 생성된 콘텐츠
     * @param {Object} extractedData - 추출된 데이터
     * @private
     */
    validateInput(originalDocument, generatedContent, extractedData) {
        if (!originalDocument || !originalDocument.sections) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                '원본 문서가 유효하지 않습니다'
            );
        }
        
        if (!generatedContent || !generatedContent.updatedSlots) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                '생성된 콘텐츠가 유효하지 않습니다'
            );
        }
        
        if (!extractedData || !extractedData.textSlots) {
            throw new HWPXError(
                ErrorType.VALIDATION_ERROR,
                '추출된 데이터가 유효하지 않습니다'
            );
        }
    }
    
    /**
     * 깊은 복사
     * @param {Object} obj - 복사할 객체
     * @returns {Object} 복사된 객체
     * @private
     */
    deepClone(obj) {
        // Map 처리
        if (obj instanceof Map) {
            const clonedMap = new Map();
            obj.forEach((value, key) => {
                clonedMap.set(key, this.deepClone(value));
            });
            return clonedMap;
        }
        
        // 배열 처리
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        
        // 객체 처리
        if (obj !== null && typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
        
        // Primitive 타입
        return obj;
    }
    
    /**
     * 슬롯 경로 매핑 생성
     * slotId → 문서 내 경로 매핑
     * @param {Map} textSlots - 텍스트 슬롯 맵
     * @returns {Map} 슬롯 경로 맵
     * @private
     */
    buildSlotPathMap(textSlots) {
        const slotPathMap = new Map();
        
        textSlots.forEach((slotData, slotId) => {
            slotPathMap.set(slotId, {
                path: slotData.path,
                context: slotData.context
            });
        });
        
        return slotPathMap;
    }
    
    /**
     * 슬롯 업데이트 적용
     * @param {Object} document - 문서 객체 (변경됨)
     * @param {Array} updatedSlots - 업데이트된 슬롯 배열
     * @param {Map} slotPathMap - 슬롯 경로 맵
     * @returns {number} 업데이트된 슬롯 수
     * @private
     */
    applySlotUpdates(document, updatedSlots, slotPathMap) {
        let updateCount = 0;
        
        updatedSlots.forEach((slot, idx) => {
            try {
                // 슬롯 경로 조회
                const pathInfo = slotPathMap.get(slot.slotId);
                
                if (!pathInfo) {
                    logger.warn(`⚠️  Slot ${slot.slotId} not found in path map, skipping`);
                    return;
                }
                
                // 경로에 따라 텍스트 업데이트
                const updated = this.updateTextAtPath(document, pathInfo.path, slot.newText);
                
                if (updated) {
                    updateCount++;
                    logger.debug(`  ✓ Updated slot ${idx + 1}/${updatedSlots.length}: ${slot.slotId}`);
                } else {
                    logger.warn(`  ✗ Failed to update slot: ${slot.slotId}`);
                }
                
            } catch (error) {
                logger.error(`  ✗ Error updating slot ${slot.slotId}:`, error);
            }
        });
        
        return updateCount;
    }
    
    /**
     * 경로에 따라 텍스트 업데이트
     * @param {Object} document - 문서 객체
     * @param {Object} path - 경로 객체
     * @param {string} newText - 새로운 텍스트
     * @returns {boolean} 업데이트 성공 여부
     * @private
     */
    updateTextAtPath(document, path, newText) {
        try {
            // 섹션 접근
            const section = document.sections[path.section];
            if (!section) {
                logger.warn(`Section ${path.section} not found`);
                return false;
            }
            
            // 표 내부 텍스트인지 확인
            if (path.table !== undefined) {
                return this.updateTableCellText(section, path, newText);
            } else {
                return this.updateParagraphText(section, path, newText);
            }
            
        } catch (error) {
            logger.error('Error updating text at path:', error);
            return false;
        }
    }
    
    /**
     * 단락 텍스트 업데이트
     * @param {Object} section - 섹션 객체
     * @param {Object} path - 경로 객체
     * @param {string} newText - 새로운 텍스트
     * @returns {boolean} 업데이트 성공 여부
     * @private
     */
    updateParagraphText(section, path, newText) {
        const element = section.elements[path.element];
        
        if (!element || element.type !== 'paragraph') {
            logger.warn(`Element at section=${path.section}, element=${path.element} is not a paragraph`);
            return false;
        }
        
        if (!element.runs || !element.runs[path.run]) {
            logger.warn(`Run at index ${path.run} not found`);
            return false;
        }
        
        // 텍스트 교체
        element.runs[path.run].text = newText;
        return true;
    }
    
    /**
     * 표 셀 텍스트 업데이트
     * @param {Object} section - 섹션 객체
     * @param {Object} path - 경로 객체
     * @param {string} newText - 새로운 텍스트
     * @returns {boolean} 업데이트 성공 여부
     * @private
     */
    updateTableCellText(section, path, newText) {
        const table = section.elements[path.table];
        
        if (!table || table.type !== 'table') {
            logger.warn(`Element at section=${path.section}, table=${path.table} is not a table`);
            return false;
        }
        
        const row = table.rows[path.row];
        if (!row) {
            logger.warn(`Row at index ${path.row} not found`);
            return false;
        }
        
        const cell = row.cells[path.cell];
        if (!cell) {
            logger.warn(`Cell at row=${path.row}, cell=${path.cell} not found`);
            return false;
        }
        
        const cellPara = cell.elements[path.paragraph];
        if (!cellPara || cellPara.type !== 'paragraph') {
            logger.warn(`Paragraph at cell not found`);
            return false;
        }
        
        if (!cellPara.runs || !cellPara.runs[path.run]) {
            logger.warn(`Run at index ${path.run} not found in cell`);
            return false;
        }
        
        // 텍스트 교체
        cellPara.runs[path.run].text = newText;
        return true;
    }
    
    /**
     * 변경 이력 저장
     * @param {Object} entry - 이력 항목
     * @private
     */
    saveToHistory(entry) {
        this.history.push(entry);
        
        // 최대 크기 제한
        if (this.history.length > this.options.maxHistorySize) {
            this.history.shift();
        }
    }
    
    /**
     * 변경 이력 조회
     * @param {number} [count=10] - 조회할 개수
     * @returns {Array} 이력 배열
     */
    getHistory(count = 10) {
        return this.history.slice(-count);
    }
    
    /**
     * 이력 클리어
     */
    clearHistory() {
        this.history = [];
        logger.info('🗑️  History cleared');
    }
    
    /**
     * 통계 조회
     * @returns {Object} 통계 정보
     */
    getStatistics() {
        return {
            ...this.stats,
            successRate: this.stats.totalMerges > 0 ?
                (this.stats.successfulMerges / this.stats.totalMerges * 100).toFixed(2) + '%' :
                'N/A',
            averageSlotsPerMerge: this.stats.successfulMerges > 0 ?
                Math.round(this.stats.totalSlotsUpdated / this.stats.successfulMerges) :
                0
        };
    }
    
    /**
     * 통계 리셋
     */
    resetStatistics() {
        this.stats = {
            totalMerges: 0,
            successfulMerges: 0,
            failedMerges: 0,
            totalSlotsUpdated: 0
        };
        logger.info('📊 Statistics reset');
    }
}

/**
 * 간편 함수: 콘텐츠 병합
 * @param {Object} originalDocument - 원본 문서
 * @param {Object} generatedContent - 생성된 콘텐츠
 * @param {Object} extractedData - 추출된 데이터
 * @param {Object} [options={}] - 옵션
 * @returns {Object} 업데이트된 문서
 * 
 * @example
 * import { mergeContent } from './content-merger.js';
 * const updated = mergeContent(originalDoc, gptResponse, extractedData);
 */
export function mergeContent(originalDocument, generatedContent, extractedData, options = {}) {
    const merger = new ContentMerger(options);
    return merger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);
}

// Default export
export default ContentMerger;

