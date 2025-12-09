/**
 * Document Structure Extractor
 * HWPX 파싱 문서에서 구조와 텍스트를 분리 추출
 * 
 * @module ai/structure-extractor
 * @version 2.1.0
 */

import { getLogger } from '../utils/logger.js';
import { AIConfig } from '../config/ai-config.js';

const logger = getLogger();

/**
 * 고유 ID 생성 (UUID v4 간소화 버전)
 * @returns {string} 고유 ID
 * @private
 */
function generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 슬롯 ID 생성
 * @param {string} prefix - 접두사
 * @returns {string} 슬롯 ID
 * @private
 */
function generateSlotId(prefix = AIConfig.extraction.slotIdPrefix) {
    return `${prefix}${generateUniqueId()}`;
}

/**
 * 요소 ID 생성
 * @param {string} prefix - 접두사
 * @returns {string} 요소 ID
 * @private
 */
function generateElementId(prefix = AIConfig.extraction.elementIdPrefix) {
    return `${prefix}${generateUniqueId()}`;
}

/**
 * 문서 구조 추출기 클래스
 * 파싱된 HWPX 문서에서 텍스트와 구조를 분리하여 추출
 * 
 * @example
 * const extractor = new DocumentStructureExtractor();
 * const result = extractor.extractStructure(parsedDocument);
 * console.log('Text slots:', result.textSlots.size);
 * console.log('Structure:', result.structure);
 */
export class DocumentStructureExtractor {
    /**
     * DocumentStructureExtractor 생성자
     * @param {Object} [options={}] - 추출 옵션
     * @param {boolean} [options.useCache=true] - 캐시 사용 여부
     * @param {number} [options.minTextLength=1] - 최소 텍스트 길이
     */
    constructor(options = {}) {
        this.options = {
            useCache: options.useCache !== false,
            minTextLength: options.minTextLength || AIConfig.extraction.minTextLength,
            maxTextLength: options.maxTextLength || AIConfig.extraction.maxTextLength
        };
        
        // 캐시 맵
        this.cache = new Map();
        
        // 통계
        this.stats = {
            totalSlots: 0,
            paragraphSlots: 0,
            tableSlots: 0,
            extractionTime: 0
        };
        
        logger.info('📊 DocumentStructureExtractor initialized');
    }
    
    /**
     * 문서 구조 추출 (메인 메서드)
     * @param {Object} parsedDocument - 파싱된 HWPX 문서
     * @returns {Object} 추출 결과
     * 
     * @example
     * const result = extractor.extractStructure(document);
     * // Returns: { structure, textSlots, metadata }
     */
    extractStructure(parsedDocument) {
        logger.info('🔍 Starting structure extraction...');
        logger.time('Structure Extraction');
        
        // 캐시 확인
        const cacheKey = this.generateCacheKey(parsedDocument);
        if (this.options.useCache && this.cache.has(cacheKey)) {
            logger.info('✅ Using cached structure');
            logger.timeEnd('Structure Extraction');
            return this.cache.get(cacheKey);
        }
        
        // 통계 초기화
        this.stats = {
            totalSlots: 0,
            paragraphSlots: 0,
            tableSlots: 0,
            extractionTime: 0
        };
        
        // 텍스트 슬롯 맵 (slotId -> {text, path, context})
        const textSlots = new Map();
        
        // 구조 추출
        const structure = {
            sections: parsedDocument.sections.map((section, sectionIdx) => 
                this.extractSection(section, sectionIdx, textSlots)
            )
        };
        
        // 결과 객체
        const result = {
            structure,
            textSlots,
            metadata: {
                extractedAt: new Date().toISOString(),
                totalSlots: textSlots.size,
                stats: { ...this.stats },
                documentInfo: {
                    sectionsCount: parsedDocument.sections.length,
                    imagesCount: parsedDocument.images?.size || 0
                }
            }
        };
        
        // 캐시 저장
        if (this.options.useCache) {
            this.cache.set(cacheKey, result);
        }
        
        logger.timeEnd('Structure Extraction');
        logger.info(`✅ Extracted ${textSlots.size} text slots`);
        
        return result;
    }
    
    /**
     * 섹션 추출
     * @param {Object} section - 섹션 객체
     * @param {number} sectionIdx - 섹션 인덱스
     * @param {Map} textSlots - 텍스트 슬롯 맵
     * @returns {Object} 추출된 섹션 구조
     * @private
     */
    extractSection(section, sectionIdx, textSlots) {
        logger.debug(`  📄 Extracting section ${sectionIdx}...`);
        
        return {
            id: generateElementId('section-'),
            pageSettings: section.pageSettings ? { ...section.pageSettings } : null,
            elements: section.elements.map((element, elementIdx) =>
                this.extractElement(element, elementIdx, sectionIdx, textSlots)
            ),
            // 헤더/푸터는 구조만 유지 (텍스트 변경 대상 아님)
            headers: section.headers ? { ...section.headers } : null,
            footers: section.footers ? { ...section.footers } : null
        };
    }
    
    /**
     * 요소 추출
     * @param {Object} element - 요소 객체
     * @param {number} elementIdx - 요소 인덱스
     * @param {number} sectionIdx - 섹션 인덱스
     * @param {Map} textSlots - 텍스트 슬롯 맵
     * @returns {Object} 추출된 요소 구조
     * @private
     */
    extractElement(element, elementIdx, sectionIdx, textSlots) {
        const elementId = generateElementId();
        
        switch (element.type) {
        case 'paragraph':
            return this.extractParagraph(element, elementId, elementIdx, sectionIdx, textSlots);
            
        case 'table':
            return this.extractTable(element, elementId, elementIdx, sectionIdx, textSlots);
            
        case 'image':
        case 'shape':
        case 'container':
            // 이미지/도형/컨테이너는 구조만 보존 (텍스트 없음)
            return {
                type: element.type,
                id: elementId,
                preserveOriginal: true
            };
            
        default:
            logger.warn(`Unknown element type: ${element.type}`);
            return {
                type: element.type,
                id: elementId,
                preserveOriginal: true
            };
        }
    }
    
    /**
     * 단락 추출
     * @param {Object} para - 단락 객체
     * @param {string} elementId - 요소 ID
     * @param {number} elementIdx - 요소 인덱스
     * @param {number} sectionIdx - 섹션 인덱스
     * @param {Map} textSlots - 텍스트 슬롯 맵
     * @returns {Object} 추출된 단락 구조
     * @private
     */
    extractParagraph(para, elementId, elementIdx, sectionIdx, textSlots) {
        logger.debug(`    📝 Extracting paragraph ${elementIdx}...`);
        
        // 텍스트 런 추출
        const textRuns = [];
        
        if (para.runs && Array.isArray(para.runs)) {
            para.runs.forEach((run, runIdx) => {
                // 텍스트가 있는 런만 처리
                if (run.text && typeof run.text === 'string') {
                    const trimmed = run.text.trim();
                    
                    if (trimmed.length >= this.options.minTextLength) {
                        const slotId = generateSlotId();
                        
                        // 텍스트 슬롯 정보 저장
                        textSlots.set(slotId, {
                            text: run.text,
                            path: {
                                section: sectionIdx,
                                element: elementIdx,
                                run: runIdx
                            },
                            context: {
                                type: 'paragraph',
                                elementId: elementId,
                                style: run.style ? { ...run.style } : null
                            }
                        });
                        
                        // 구조에 슬롯 참조 추가
                        textRuns.push({
                            slotId: slotId,
                            originalText: run.text,
                            style: run.style ? { ...run.style } : null
                        });
                        
                        this.stats.totalSlots++;
                        this.stats.paragraphSlots++;
                    }
                } else if (run.type) {
                    // 특수 런 (tab, linebreak 등)은 구조만 유지
                    textRuns.push({
                        type: run.type,
                        preserveOriginal: true
                    });
                }
            });
        }
        
        return {
            type: 'paragraph',
            id: elementId,
            style: para.style ? { ...para.style } : null,
            numbering: para.numbering ? { ...para.numbering } : null,
            textRuns: textRuns,
            // 인라인 이미지/표는 구조만 보존
            hasInlineImages: !!(para.images && para.images.length > 0),
            hasInlineTables: !!(para.tables && para.tables.length > 0)
        };
    }
    
    /**
     * 표 추출
     * @param {Object} table - 표 객체
     * @param {string} elementId - 요소 ID
     * @param {number} elementIdx - 요소 인덱스
     * @param {number} sectionIdx - 섹션 인덱스
     * @param {Map} textSlots - 텍스트 슬롯 맵
     * @returns {Object} 추출된 표 구조
     * @private
     */
    extractTable(table, elementId, elementIdx, sectionIdx, textSlots) {
        logger.debug(`    📊 Extracting table ${elementIdx}...`);
        
        const rows = [];
        
        if (table.rows && Array.isArray(table.rows)) {
            table.rows.forEach((row, rowIdx) => {
                const cells = [];
                
                if (row.cells && Array.isArray(row.cells)) {
                    row.cells.forEach((cell, cellIdx) => {
                        // 셀 내부 요소 추출
                        const cellElements = [];
                        
                        if (cell.elements && Array.isArray(cell.elements)) {
                            cell.elements.forEach((cellElement, cellElementIdx) => {
                                if (cellElement.type === 'paragraph') {
                                    const cellPara = this.extractTableCellParagraph(
                                        cellElement,
                                        sectionIdx,
                                        elementIdx,
                                        rowIdx,
                                        cellIdx,
                                        cellElementIdx,
                                        textSlots
                                    );
                                    cellElements.push(cellPara);
                                } else if (cellElement.type === 'table') {
                                    // 중첩 표
                                    const nestedTable = this.extractTable(
                                        cellElement,
                                        generateElementId('nested-table-'),
                                        cellElementIdx,
                                        sectionIdx,
                                        textSlots
                                    );
                                    cellElements.push(nestedTable);
                                }
                            });
                        }
                        
                        cells.push({
                            id: generateElementId('cell-'),
                            rowIdx: rowIdx,
                            colIdx: cellIdx,
                            rowSpan: cell.rowSpan || 1,
                            colSpan: cell.colSpan || 1,
                            style: cell.style ? { ...cell.style } : null,
                            elements: cellElements
                        });
                    });
                }
                
                rows.push({
                    id: generateElementId('row-'),
                    rowIdx: rowIdx,
                    cells: cells
                });
            });
        }
        
        return {
            type: 'table',
            id: elementId,
            rows: rows,
            colWidths: table.colWidths ? [...table.colWidths] : null,
            style: table.style ? { ...table.style } : null
        };
    }
    
    /**
     * 표 셀 내부 단락 추출
     * @param {Object} para - 단락 객체
     * @param {number} sectionIdx - 섹션 인덱스
     * @param {number} tableIdx - 표 인덱스
     * @param {number} rowIdx - 행 인덱스
     * @param {number} cellIdx - 셀 인덱스
     * @param {number} paraIdx - 단락 인덱스
     * @param {Map} textSlots - 텍스트 슬롯 맵
     * @returns {Object} 추출된 단락 구조
     * @private
     */
    extractTableCellParagraph(para, sectionIdx, tableIdx, rowIdx, cellIdx, paraIdx, textSlots) {
        const elementId = generateElementId('cell-para-');
        const textRuns = [];
        
        if (para.runs && Array.isArray(para.runs)) {
            para.runs.forEach((run, runIdx) => {
                if (run.text && typeof run.text === 'string') {
                    const trimmed = run.text.trim();
                    
                    if (trimmed.length >= this.options.minTextLength) {
                        const slotId = generateSlotId();
                        
                        // 🔥 특급 기능: 제목/라벨 감지
                        const isHeaderCell = this.detectHeaderCell(run.text, rowIdx, cellIdx, run.style);
                        
                        textSlots.set(slotId, {
                            text: run.text,
                            path: {
                                section: sectionIdx,
                                table: tableIdx,
                                row: rowIdx,
                                cell: cellIdx,
                                paragraph: paraIdx,
                                run: runIdx
                            },
                            context: {
                                type: 'table-cell',
                                elementId: elementId,
                                style: run.style ? { ...run.style } : null,
                                isHeader: isHeaderCell  // 🔥 헤더 플래그 추가
                            }
                        });
                        
                        textRuns.push({
                            slotId: slotId,
                            originalText: run.text,
                            style: run.style ? { ...run.style } : null
                        });
                        
                        this.stats.totalSlots++;
                        this.stats.tableSlots++;
                    }
                }
            });
        }
        
        return {
            type: 'paragraph',
            id: elementId,
            style: para.style ? { ...para.style } : null,
            textRuns: textRuns
        };
    }
    
    /**
     * 캐시 키 생성
     * @param {Object} document - 문서 객체
     * @returns {string} 캐시 키
     * @private
     */
    generateCacheKey(document) {
        // 문서의 주요 특성으로 캐시 키 생성
        const key = JSON.stringify({
            sectionsCount: document.sections?.length || 0,
            imagesCount: document.images?.size || 0,
            timestamp: document.metadata?.parsedAt
        });
        
        return `cache-${this.hashCode(key)}`;
    }
    
    /**
     * 간단한 해시 코드 생성
     * @param {string} str - 문자열
     * @returns {number} 해시 코드
     * @private
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
    
    /**
     * 캐시 클리어
     */
    clearCache() {
        this.cache.clear();
        logger.info('🗑️  Cache cleared');
    }
    
    /**
     * 테이블 셀이 헤더(제목)인지 감지
     * @param {string} text - 셀 텍스트
     * @param {number} rowIdx - 행 인덱스
     * @param {number} cellIdx - 열 인덱스
     * @param {Object} style - 텍스트 스타일
     * @returns {boolean} 헤더 여부
     * @private
     */
    detectHeaderCell(text, rowIdx, cellIdx, style) {
        const trimmed = text.trim();
        
        // 🔥 규칙 1: 첫 번째 행은 항상 헤더 (테이블 헤더)
        if (rowIdx === 0) {
            logger.debug(`      🏷️  Cell [${rowIdx},${cellIdx}] detected as HEADER (first row): "${trimmed}"`);
            return true;
        }
        
        // 🔥 규칙 2: 첫 번째 열이면서 짧은 텍스트 (10자 이하) → 제목/라벨
        if (cellIdx === 0 && trimmed.length <= 10) {
            logger.debug(`      🏷️  Cell [${rowIdx},${cellIdx}] detected as HEADER (first column + short): "${trimmed}"`);
            return true;
        }
        
        // 🔥 규칙 3: 짧은 텍스트 (8자 이하) + 키워드 → 제목
        if (trimmed.length <= 8) {
            const headerKeywords = ['활동', '목표', '주제', '내용', '시간', '날짜', '장소', '대상', '방법', '평가', '비고', '준비물', '유의사항', '놀이', '기간'];
            const hasKeyword = headerKeywords.some(keyword => trimmed.includes(keyword));
            
            if (hasKeyword) {
                logger.debug(`      🏷️  Cell [${rowIdx},${cellIdx}] detected as HEADER (short + keyword): "${trimmed}"`);
                return true;
            }
        }
        
        // 🔥 규칙 4: 굵은 글씨(bold) + 짧은 텍스트 (12자 이하) → 제목
        if (style && style.bold === true && trimmed.length <= 12) {
            logger.debug(`      🏷️  Cell [${rowIdx},${cellIdx}] detected as HEADER (bold + short): "${trimmed}"`);
            return true;
        }
        
        // 🔥 규칙 5: 콜론(:)으로 끝나는 텍스트는 라벨
        if (trimmed.endsWith(':') || trimmed.endsWith('：')) {
            logger.debug(`      🏷️  Cell [${rowIdx},${cellIdx}] detected as HEADER (ends with colon): "${trimmed}"`);
            return true;
        }
        
        // 기본: 내용 셀로 간주
        logger.debug(`      📝 Cell [${rowIdx},${cellIdx}] detected as CONTENT: "${trimmed.substring(0, 30)}..."`);
        return false;
    }
    
    /**
     * 통계 조회
     * @returns {Object} 통계 정보
     */
    getStatistics() {
        return {
            ...this.stats,
            cacheSize: this.cache.size
        };
    }
    
    /**
     * 테이블 헤더-내용 쌍 추출 (구조화된 방식)
     * @param {Object} parsedDocument - 파싱된 문서
     * @returns {Array<Object>} 헤더-내용 쌍 배열
     */
    extractTableHeaderContentPairs(parsedDocument) {
        logger.info('📋 Extracting table header-content pairs...');
        
        const pairs = [];
        
        parsedDocument.sections?.forEach((section, sectionIdx) => {
            section.elements?.forEach((element, elementIdx) => {
                if (element.type === 'table') {
                    const tablePairs = this.extractPairsFromTable(element, sectionIdx, elementIdx);
                    pairs.push(...tablePairs);
                }
            });
        });
        
        logger.info(`✅ Extracted ${pairs.length} header-content pairs`);
        return pairs;
    }
    
    /**
     * 개별 테이블에서 헤더-내용 쌍 추출 (v2.2.5: 모든 빈 셀 감지)
     * @param {Object} table - 테이블 객체
     * @param {number} sectionIdx - 섹션 인덱스
     * @param {number} tableIdx - 테이블 인덱스
     * @returns {Array<Object>} 헤더-내용 쌍
     * @private
     */
    extractPairsFromTable(table, sectionIdx, tableIdx) {
        const pairs = [];
        
        table.rows?.forEach((row, rowIdx) => {
            const cells = row.cells || [];
            
            cells.forEach((cell, cellIdx) => {
                const cellText = this.extractTextFromCell(cell);
                
                // 빈 셀이거나 매우 짧은 내용만 있는 셀 찾기
                const isEmpty = !cellText || cellText.trim().length === 0;
                
                if (isEmpty) {
                    // 왼쪽 셀에서 헤더 찾기
                    let headerText = null;
                    let headerCellIdx = null;
                    
                    // 같은 행의 왼쪽 셀들 중 텍스트가 있는 첫 번째 셀을 헤더로 사용
                    for (let i = cellIdx - 1; i >= 0; i--) {
                        const potentialHeader = this.extractTextFromCell(cells[i]);
                        if (potentialHeader && potentialHeader.trim().length > 0) {
                            headerText = potentialHeader.trim();
                            headerCellIdx = i;
                            break;
                        }
                    }
                    
                    // 왼쪽에 헤더가 없으면 위쪽 행에서 찾기
                    if (!headerText && rowIdx > 0) {
                        const aboveRow = table.rows[rowIdx - 1];
                        if (aboveRow.cells && aboveRow.cells[cellIdx]) {
                            const aboveText = this.extractTextFromCell(aboveRow.cells[cellIdx]);
                            if (aboveText && aboveText.trim().length > 0) {
                                headerText = aboveText.trim();
                                headerCellIdx = cellIdx;
                            }
                        }
                    }
                    
                    // 헤더를 찾았으면 쌍 추가
                    if (headerText) {
                        const pairId = generateSlotId();
                        
                        pairs.push({
                            pairId: pairId,
                            header: headerText,
                            content: '',
                            path: {
                                section: sectionIdx,
                                table: tableIdx,
                                row: rowIdx,
                                headerCell: headerCellIdx !== null ? headerCellIdx : cellIdx - 1,
                                contentCell: cellIdx
                            },
                            isEmpty: true
                        });
                        
                        logger.debug(`  ✓ Empty cell found: "${headerText}" at Row ${rowIdx}, Cell ${cellIdx}`);
                    }
                }
            });
            
            // 🔥 기존 로직도 유지: 2열 구조 감지 (비어있지 않은 내용도 포함)
            if (cells.length >= 2) {
                const headerCell = cells[0];
                const contentCell = cells[1];
                
                const headerText = this.extractTextFromCell(headerCell);
                const contentText = this.extractTextFromCell(contentCell);
                
                // 헤더가 있고, 내용이 비어있지 않으면 (기존 내용도 GPT가 개선할 수 있도록)
                if (headerText && headerText.length <= 15 && contentText && contentText.trim().length > 0) {
                    // 이미 추가된 쌍이 아니면 추가
                    const alreadyAdded = pairs.some(p => 
                        p.path.row === rowIdx && 
                        p.path.contentCell === 1 &&
                        p.header === headerText.trim()
                    );
                    
                    if (!alreadyAdded) {
                        const pairId = generateSlotId();
                        
                        pairs.push({
                            pairId: pairId,
                            header: headerText.trim(),
                            content: contentText.trim(),
                            path: {
                                section: sectionIdx,
                                table: tableIdx,
                                row: rowIdx,
                                headerCell: 0,
                                contentCell: 1
                            },
                            isEmpty: false
                        });
                        
                        logger.debug(`  ✓ Pair: "${headerText}" → "${contentText.substring(0, 30)}..."`);
                    }
                }
            }
        });
        
        return pairs;
    }
    
    /**
     * 셀에서 텍스트 추출
     * @param {Object} cell - 셀 객체
     * @returns {string} 추출된 텍스트
     * @private
     */
    extractTextFromCell(cell) {
        let text = '';
        
        cell.elements?.forEach(element => {
            if (element.type === 'paragraph') {
                element.runs?.forEach(run => {
                    if (run.text) {
                        text += run.text;
                    }
                });
            }
        });
        
        return text.trim();
    }
    
    /**
     * 구조 검증
     * @param {Object} structure - 추출된 구조
     * @returns {Object} 검증 결과
     */
    validateStructure(structure) {
        const errors = [];
        
        if (!structure || !structure.sections) {
            errors.push('구조에 섹션이 없습니다');
            return { isValid: false, errors };
        }
        
        structure.sections.forEach((section, idx) => {
            if (!section.id) {
                errors.push(`섹션 ${idx}: ID가 없습니다`);
            }
            
            if (!section.elements || !Array.isArray(section.elements)) {
                errors.push(`섹션 ${idx}: 요소 배열이 없습니다`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

/**
 * 간편 함수: 구조 추출
 * @param {Object} parsedDocument - 파싱된 문서
 * @param {Object} [options={}] - 옵션
 * @returns {Object} 추출 결과
 * 
 * @example
 * import { extractDocumentStructure } from './structure-extractor.js';
 * const result = extractDocumentStructure(document);
 */
export function extractDocumentStructure(parsedDocument, options = {}) {
    const extractor = new DocumentStructureExtractor(options);
    return extractor.extractStructure(parsedDocument);
}

// Default export
export default DocumentStructureExtractor;

