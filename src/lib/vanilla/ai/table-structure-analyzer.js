/**
 * 테이블 구조 분석기
 * 테이블의 소제목(헤더)과 내용(content) 셀을 명확히 매핑
 * 
 * @module table-structure-analyzer
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TableStructureAnalyzer');

/**
 * 테이블 구조 분석기 클래스
 * 
 * @class TableStructureAnalyzer
 */
export class TableStructureAnalyzer {
    constructor() {
        logger.info('📋 TableStructureAnalyzer initialized');
    }
    
    /**
     * 테이블 요소를 분석하여 소제목-내용 쌍을 추출
     * 
     * @param {Object} parsedDocument - 파싱된 HWPX 문서
     * @returns {Object} 분석된 테이블 구조
     */
    analyzeTableStructure(parsedDocument) {
        logger.info('🔍 Analyzing table structure...');
        logger.time('Table Structure Analysis');
        
        const tableItems = [];
        let itemCounter = 0;
        
        // 섹션 순회
        parsedDocument.sections?.forEach((section, sectionIdx) => {
            section.elements?.forEach((element, elementIdx) => {
                if (element.type === 'table') {
                    // 테이블 발견
                    const items = this.extractTableItems(element, sectionIdx, elementIdx);
                    tableItems.push(...items);
                    itemCounter += items.length;
                }
            });
        });
        
        logger.info(`✅ Found ${itemCounter} table items (header-content pairs)`);
        logger.timeEnd('Table Structure Analysis');
        
        return {
            items: tableItems,
            totalItems: itemCounter,
            analyzedAt: new Date().toISOString()
        };
    }
    
    /**
     * 테이블에서 항목 추출 (소제목-내용 쌍)
     * 
     * @param {Object} table - 테이블 요소
     * @param {number} sectionIdx - 섹션 인덱스
     * @param {number} tableIdx - 테이블 인덱스
     * @returns {Array} 추출된 항목 배열
     * @private
     */
    extractTableItems(table, sectionIdx, tableIdx) {
        const items = [];
        
        logger.debug(`  📊 Analyzing table at section ${sectionIdx}, element ${tableIdx}`);
        
        // 테이블 행 순회
        table.rows?.forEach((row, rowIdx) => {
            // 각 행을 소제목-내용 쌍으로 분석
            const rowItems = this.analyzeRow(row, rowIdx, sectionIdx, tableIdx);
            items.push(...rowItems);
        });
        
        logger.debug(`  ✅ Extracted ${items.length} items from table`);
        
        return items;
    }
    
    /**
     * 행 분석 (2열 테이블 가정: 첫 번째 열 = 소제목, 두 번째 열 = 내용)
     * 
     * @param {Object} row - 테이블 행
     * @param {number} rowIdx - 행 인덱스
     * @param {number} sectionIdx - 섹션 인덱스
     * @param {number} tableIdx - 테이블 인덱스
     * @returns {Array} 행에서 추출된 항목
     * @private
     */
    analyzeRow(row, rowIdx, sectionIdx, tableIdx) {
        const items = [];
        
        // 첫 번째 행은 보통 테이블 헤더이므로 건너뜀
        if (rowIdx === 0) {
            logger.debug(`    ⏭️  Skipping header row ${rowIdx}`);
            return items;
        }
        
        const cells = row.cells || [];
        
        // 2열 테이블 패턴: [소제목 | 내용]
        if (cells.length >= 2) {
            const headerCell = cells[0];  // 첫 번째 열 = 소제목
            const contentCell = cells[1]; // 두 번째 열 = 내용
            
            const headerText = this.extractCellText(headerCell);
            const contentText = this.extractCellText(contentCell);
            
            // 소제목이 있는 경우만 항목으로 추가
            if (headerText && headerText.trim().length > 0) {
                const item = {
                    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    label: headerText.trim(),
                    content: contentText?.trim() || '',  // 내용이 없을 수도 있음 (빈 셀)
                    path: {
                        section: sectionIdx,
                        table: tableIdx,
                        row: rowIdx,
                        headerCell: 0,
                        contentCell: 1
                    },
                    isEmpty: !contentText || contentText.trim().length === 0
                };
                
                items.push(item);
                
                if (item.isEmpty) {
                    logger.debug(`    📝 Row ${rowIdx}: "${item.label}" → [EMPTY] (needs content)`);
                } else {
                    logger.debug(`    📝 Row ${rowIdx}: "${item.label}" → "${item.content.substring(0, 30)}..."`);
                }
            }
        } else if (cells.length === 1) {
            // 1열 테이블: 제목 행으로 간주
            const headerText = this.extractCellText(cells[0]);
            logger.debug(`    🏷️  Row ${rowIdx}: Title row - "${headerText}"`);
        }
        
        return items;
    }
    
    /**
     * 셀에서 텍스트 추출
     * 
     * @param {Object} cell - 테이블 셀
     * @returns {string} 추출된 텍스트
     * @private
     */
    extractCellText(cell) {
        const texts = [];
        
        // 셀 내부 요소 순회 (보통 단락)
        cell.elements?.forEach(element => {
            if (element.type === 'paragraph') {
                element.runs?.forEach(run => {
                    if (run.text && typeof run.text === 'string') {
                        texts.push(run.text);
                    }
                });
            }
        });
        
        return texts.join(' ');
    }
    
    /**
     * 항목 검증 (모든 소제목이 추출되었는지 확인)
     * 
     * @param {Object} structureData - 분석된 구조 데이터
     * @returns {Object} 검증 결과
     */
    validateItems(structureData) {
        const { items } = structureData;
        
        const emptyItems = items.filter(item => item.isEmpty);
        const filledItems = items.filter(item => !item.isEmpty);
        
        const validation = {
            isValid: true,
            totalItems: items.length,
            emptyItems: emptyItems.length,
            filledItems: filledItems.length,
            emptyItemLabels: emptyItems.map(item => item.label),
            warnings: []
        };
        
        if (emptyItems.length > 0) {
            validation.warnings.push(
                `${emptyItems.length}개 항목이 비어있습니다: ${emptyItems.map(i => i.label).join(', ')}`
            );
        }
        
        if (items.length === 0) {
            validation.isValid = false;
            validation.warnings.push('테이블 항목을 찾을 수 없습니다.');
        }
        
        logger.info(`📊 Validation: ${filledItems.length} filled, ${emptyItems.length} empty`);
        
        return validation;
    }
    
    /**
     * 구조화된 프롬프트 데이터 생성
     * (GPT에게 전달할 형식)
     * 
     * @param {Object} structureData - 분석된 구조 데이터
     * @returns {Object} 프롬프트 데이터
     */
    buildPromptData(structureData) {
        const { items } = structureData;
        
        // 빈 항목만 또는 모든 항목을 GPT에 전달
        const itemsToFill = items.map(item => ({
            id: item.id,
            label: item.label,
            currentContent: item.content,
            isEmpty: item.isEmpty
        }));
        
        logger.info(`📝 Built prompt data for ${itemsToFill.length} items`);
        
        return {
            items: itemsToFill,
            totalItems: itemsToFill.length
        };
    }
}

// Export
export default TableStructureAnalyzer;

