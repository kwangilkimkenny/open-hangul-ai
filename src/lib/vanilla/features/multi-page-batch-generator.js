/**
 * Multi-Page Batch Generator
 * 여러 페이지에 각각 다른 주제로 내용을 생성하는 일괄 생성 기능
 * 
 * @module features/multi-page-batch-generator
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('MultiPageBatchGenerator');

/**
 * 다중 페이지 일괄 생성기 클래스
 * 각 페이지에 독립적인 주제로 내용 생성
 */
export class MultiPageBatchGenerator {
    constructor(aiController, viewer) {
        this.aiController = aiController;
        this.viewer = viewer;
        logger.info('📑 MultiPageBatchGenerator initialized');
    }

    /**
     * 페이지별 일괄 생성
     * @param {Array<string>} topics - 주제 목록 (페이지 수만큼)
     * @param {Object} options - 생성 옵션
     * @returns {Promise<Object>} - 생성 결과
     */
    async generateByPages(topics, options = {}) {
        const {
            ageGroup = '만 4-5세',
            duration = '1주일'
        } = options;
        
        // 문서 정보 가져오기
        const doc = this.viewer.state?.document;
        if (!doc || !doc.sections || doc.sections.length === 0) {
            throw new Error('문서가 로드되지 않았습니다');
        }
        
        // 페이지 수 확인
        const totalPages = this._countPages(doc);
        
        logger.info(`📑 Document has ${totalPages} pages`);
        logger.info(`📋 Topics provided: ${topics.length}`);
        
        if (topics.length > totalPages) {
            logger.warn(`⚠️ More topics (${topics.length}) than pages (${totalPages}). Using first ${totalPages} topics.`);
            topics = topics.slice(0, totalPages);
        } else if (topics.length < totalPages) {
            logger.warn(`⚠️ Fewer topics (${topics.length}) than pages (${totalPages}). Some pages will remain empty.`);
        }
        
        logger.info(`🔄 Starting page-by-page generation for ${topics.length} topics...`);
        
        // 원본 문서 백업
        const originalDoc = JSON.parse(JSON.stringify(doc));
        
        // 각 페이지별로 생성
        const results = [];
        
        for (let pageIndex = 0; pageIndex < topics.length; pageIndex++) {
            const topic = topics[pageIndex];
            logger.info(`  🔄 [Page ${pageIndex + 1}/${topics.length}] Generating: "${topic}"`);
            
            try {
                // 특정 페이지만 생성
                await this._generateForPage(pageIndex, topic, { ageGroup, duration });
                
                results.push({
                    pageIndex,
                    topic,
                    success: true
                });
                
                logger.info(`    ✅ Generated for Page ${pageIndex + 1}: "${topic}"`);
                
            } catch (error) {
                logger.error(`    ❌ Failed for Page ${pageIndex + 1}: "${topic}" - ${error.message}`);
                results.push({
                    pageIndex,
                    topic,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // 요약
        const successCount = results.filter(r => r.success).length;
        logger.info(`✅ Page-by-page generation completed: ${successCount}/${topics.length} successful`);
        
        // 렌더링 (문서 상태가 이미 업데이트되었으므로 updateDocument 사용)
        if (this.viewer.state.document) {
            await this.viewer.updateDocument(this.viewer.state.document);
        } else {
            logger.warn('⚠️ No document in viewer state, skipping render');
        }
        
        return {
            results,
            totalPages,
            successCount
        };
    }

    /**
     * 특정 페이지에만 내용 생성
     * @private
     */
    async _generateForPage(pageIndex, topic, options) {
        const { ageGroup, duration } = options;
        
        // 1. DOM에서 해당 페이지의 테이블 직접 찾기
        const pageElement = document.querySelectorAll('.hwp-page-container')[pageIndex];
        
        if (!pageElement) {
            throw new Error(`Page ${pageIndex + 1} not found in DOM`);
        }
        
        // 2. 해당 페이지의 테이블만 추출
        const pageTables = this._extractTablesFromPage(pageElement, pageIndex);
        
        if (!pageTables || pageTables.length === 0) {
            throw new Error(`Page ${pageIndex + 1} has no editable tables`);
        }
        
        logger.debug(`    📊 Found ${pageTables.length} tables in Page ${pageIndex + 1}`);
        
        // 3. 테이블에서 헤더-콘텐츠 쌍 추출
        const headerContentPairs = [];
        pageTables.forEach(table => {
            const pairs = this._extractHeadersFromTable(table);
            headerContentPairs.push(...pairs);
        });
        
        logger.debug(`    📋 Extracted ${headerContentPairs.length} header-content pairs`);
        
        // 🔍 디버깅: 추출된 헤더 목록 출력
        logger.debug(`    📋 Headers for Page ${pageIndex + 1}: ${headerContentPairs.map(p => p.header).join(', ')}`);
        
        // 4. AI 프롬프트 생성
        const userRequest = this._buildPagePrompt(topic, headerContentPairs, { ageGroup, duration });
        
        // 5. GPT로 생성 (AIDocumentController의 generateStructuredContent 사용)
        const generatedContent = await this.aiController.generateStructuredContent(
            headerContentPairs,
            userRequest
        );
        
        // 6. 생성된 내용을 해당 페이지의 테이블에만 병합
        this._mergeToPage(pageIndex, headerContentPairs, generatedContent);
        
        logger.debug(`    ✅ Merged ${Object.keys(generatedContent).length} items to Page ${pageIndex + 1}`);
    }

    /**
     * DOM에서 특정 페이지의 테이블 추출
     * @private
     */
    _extractTablesFromPage(pageElement, pageIndex) {
        const tables = pageElement.querySelectorAll('table.hwp-table');
        
        logger.debug(`    🔍 Page ${pageIndex + 1}: Found ${tables.length} tables in DOM`);
        
        // 테이블과 데이터 구조를 매핑
        const doc = this.viewer.state.document;
        const section = doc.sections[0];
        
        if (!section || !section.elements) {
            return [];
        }
        
        // 문서의 테이블 요소들
        const tableElements = section.elements.filter(e => e.type === 'table');
        
        // DOM 테이블과 데이터 테이블 매핑
        const pageTables = [];
        
        Array.from(tables).forEach((domTable, idx) => {
            // 문서에서 대응하는 테이블 데이터 찾기
            // 간단한 방법: 순서대로 매핑 (페이지별로)
            const globalTableIndex = pageIndex * tables.length + idx;
            const tableData = tableElements[globalTableIndex % tableElements.length];
            
            if (tableData) {
                pageTables.push({
                    domElement: domTable,
                    dataElement: tableData,
                    index: idx
                });
            }
        });
        
        return pageTables;
    }

    /**
     * 테이블에서 헤더-콘텐츠 쌍 추출
     * @private
     */
    _extractHeadersFromTable(table) {
        const { domElement, dataElement } = table;
        const pairs = [];
        
        if (!dataElement || !dataElement.rows) {
            return pairs;
        }
        
        // 🆕 특수 구조 처리: 헤더 전용 행 + 내용 전용 행
        let pendingHeader = null;
        let pendingHeaderRowIndex = -1;
        
        // 각 행을 순회하며 헤더-콘텐츠 쌍 추출
        dataElement.rows.forEach((row, rowIndex) => {
            if (!row.cells) {
                return;
            }
            
            // 🆕 Case 1: 셀 1개 (colspan으로 전체 병합)
            if (row.cells.length === 1) {
                const cell = row.cells[0];
                const text = this._extractTextFromCell(cell).trim();
                
                if (text && text.length > 0 && !text.includes('→')) {
                    // 헤더처럼 보이는 텍스트 (짧고, 화살표 없음)
                    pendingHeader = text;
                    pendingHeaderRowIndex = rowIndex;
                    logger.debug(`      🔍 Pending header found: "${text}" at row ${rowIndex}`);
                } else if (pendingHeader) {
                    // 이전 행에 헤더가 있었고, 이 행은 내용
                    pairs.push({
                        header: pendingHeader,
                        content: text || '(비어있음)',
                        tableData: dataElement,
                        rowIndex: pendingHeaderRowIndex,
                        cellReference: cell
                    });
                    logger.debug(`      ✓ Paired: "${pendingHeader}" with content row ${rowIndex}`);
                    pendingHeader = null;
                    pendingHeaderRowIndex = -1;
                }
                return;
            }
            
            // 🆕 Case 2: 셀 4개 (2개씩 쌍)
            if (row.cells.length === 4) {
                // 첫 번째 쌍: cells[0], cells[1]
                const header1 = this._extractTextFromCell(row.cells[0]).trim();
                const content1 = this._extractTextFromCell(row.cells[1]).trim();
                
                if (header1 && header1.length > 0) {
                    pairs.push({
                        header: header1,
                        content: content1 || '(비어있음)',
                        tableData: dataElement,
                        rowIndex,
                        cellReference: row.cells[1]
                    });
                }
                
                // 두 번째 쌍: cells[2], cells[3]
                const header2 = this._extractTextFromCell(row.cells[2]).trim();
                const content2 = this._extractTextFromCell(row.cells[3]).trim();
                
                if (header2 && header2.length > 0) {
                    pairs.push({
                        header: header2,
                        content: content2 || '(비어있음)',
                        tableData: dataElement,
                        rowIndex,
                        cellReference: row.cells[3]
                    });
                }
                return;
            }
            
            // 🆕 Case 3: 셀 2개 (일반 구조)
            if (row.cells.length >= 2) {
                const headerCell = row.cells[0];
                const contentCell = row.cells[1];
                
                if (!headerCell || !contentCell) {
                    return;
                }
                
                const header = this._extractTextFromCell(headerCell).trim();
                const content = this._extractTextFromCell(contentCell).trim();
                
                if (header && header.length > 0) {
                    pairs.push({
                        header,
                        content: content || '(비어있음)',
                        tableData: dataElement,
                        rowIndex,
                        cellReference: contentCell
                    });
                }
            }
        });
        
        return pairs;
    }

    /**
     * 셀에서 텍스트 추출
     * @private
     */
    _extractTextFromCell(cell) {
        if (!cell.elements) return '';
        
        let text = '';
        cell.elements.forEach(el => {
            if (el.type === 'paragraph' && el.runs) {
                el.runs.forEach(run => {
                    if (run.text) {
                        text += run.text;
                    }
                });
            }
        });
        return text;
    }

    /**
     * 페이지별 프롬프트 생성
     * @private
     */
    _buildPagePrompt(topic, headerContentPairs, options) {
        const { ageGroup, duration } = options;
        
        const headers = headerContentPairs.map(p => p.header);
        const headersList = headers.join('\n- ');
        
        // "놀이방법(전개)" 포함 여부 확인
        const hasPlayMethod = headers.some(h => 
            h.includes('놀이방법') || h.includes('전개')
        );
        
        let prompt = `"${topic}" 주제로 놀이계획안을 작성해주세요.

**기본 정보:**
- 주제: ${topic}
- 연령: ${ageGroup}  
- 기간: ${duration}

**반드시 작성해야 할 항목 (모든 항목 필수):**
- ${headersList}

**중요한 작성 지침:**
1. 위에 나열된 **모든 항목**에 대해 빠짐없이 작성해주세요.
2. "${topic}" 주제에 맞게 내용을 작성해주세요.`;

        // "놀이방법(전개)"가 있으면 특별 강조
        if (hasPlayMethod) {
            prompt += `
3. **"놀이방법(전개)"는 매우 중요합니다!** 
   - 최소 300자 이상 상세하게 작성해주세요.
   - 교사가 그대로 따라할 수 있도록 단계별로 구체적으로 작성해주세요.
   - 예: "1단계: ..., 2단계: ..., 3단계: ..." 형식으로 작성
   - 각 단계마다 구체적인 활동 방법과 교사의 발문을 포함하세요.`;
        }

        prompt += `
4. "놀이속배움", "누리과정관련요소" 등은 "${topic}" 주제와 직접적으로 관련된 내용으로 작성해주세요.
5. 모든 내용이 "${topic}"라는 하나의 주제로 일관되게 연결되어야 합니다.

**JSON 형식으로 응답해주세요 (항목명을 정확히 사용):**
{
${headers.map(h => `  "${h}": "내용..."`).join(',\n')}
}`;
        
        return prompt;
    }

    /**
     * 생성된 내용을 특정 페이지에만 병합
     * @private
     */
    _mergeToPage(pageIndex, headerContentPairs, generatedContent) {
        let updatedCount = 0;
        
        logger.debug(`    🔄 Merging ${Object.keys(generatedContent).length} items to Page ${pageIndex + 1}...`);
        
        // 🔍 디버깅: GPT가 반환한 키 목록 출력
        const gptKeys = Object.keys(generatedContent);
        logger.debug(`    📋 GPT가 반환한 키: ${gptKeys.join(', ')}`);
        
        // 🔍 디버깅: 추출된 헤더 목록 출력
        const extractedHeaders = headerContentPairs.map(p => p.header);
        logger.debug(`    📋 추출된 헤더: ${extractedHeaders.join(', ')}`);
        
        headerContentPairs.forEach(item => {
            const { header, cellReference } = item;
            let newContent = generatedContent[header];
            
            // 🆕 유연한 매칭: 정확한 매칭이 안 되면 유사한 키 찾기
            if (!newContent) {
                // 헤더 정규화 (공백, 괄호 무시)
                const normalizedHeader = header.replace(/\s+/g, '').toLowerCase();
                
                const matchedKey = gptKeys.find(key => {
                    const normalizedKey = key.replace(/\s+/g, '').toLowerCase();
                    return normalizedKey === normalizedHeader || 
                           normalizedKey.includes(normalizedHeader) ||
                           normalizedHeader.includes(normalizedKey);
                });
                
                if (matchedKey) {
                    newContent = generatedContent[matchedKey];
                    logger.debug(`      🔍 유사 키 매칭: "${header}" → "${matchedKey}"`);
                }
            }
            
            if (newContent && cellReference) {
                // 셀 내용 업데이트
                this._updateCellContent(cellReference, newContent);
                updatedCount++;
                
                logger.debug(`      ✓ Updated "${header}" (${newContent.length}자)`);
            } else if (!newContent) {
                logger.warn(`      ❌ No content for "${header}"`);
                logger.warn(`          사용 가능한 키: ${gptKeys.join(', ')}`);
            }
        });
        
        logger.info(`    ✅ Updated ${updatedCount}/${headerContentPairs.length} cells in Page ${pageIndex + 1}`);
        
        // 🆕 누락된 항목 경고
        if (updatedCount < headerContentPairs.length) {
            const missingCount = headerContentPairs.length - updatedCount;
            logger.warn(`    ⚠️ ${missingCount}개 항목이 누락되었습니다!`);
        }
    }

    /**
     * 셀 내용 업데이트
     * @private
     */
    _updateCellContent(cell, newText) {
        if (!cell) {
            logger.warn('⚠️ Cell reference is null');
            return;
        }
        
        // 기존 elements 초기화
        cell.elements = [];
        
        // 새 내용을 단락으로 추가
        const lines = newText.split('\n');
        
        lines.forEach((line, idx) => {
            cell.elements.push({
                type: 'paragraph',
                runs: line ? [{ text: line }] : [],
                style: {}
            });
        });
        
        logger.debug(`      📝 Updated cell with ${lines.length} paragraphs`);
    }

    /**
     * 페이지 수 계산
     * @private
     */
    _countPages(doc) {
        // DOM에서 실제 페이지 수 확인 (가장 정확)
        const pageContainers = document.querySelectorAll('.hwp-page-container');
        
        if (pageContainers.length > 0) {
            logger.debug(`📄 Counted ${pageContainers.length} pages from DOM`);
            return pageContainers.length;
        }
        
        logger.warn('⚠️ No page containers found in DOM, using fallback');
        
        // 폴백: 문서 구조 기반 추정
        if (doc && doc.sections && doc.sections[0]) {
            const section = doc.sections[0];
            const elements = section.elements || [];
            
            // 테이블 개수로 추정
            const tables = elements.filter(e => e.type === 'table');
            const estimatedPages = Math.max(1, tables.length);
            
            logger.debug(`📄 Estimated ${estimatedPages} pages from ${tables.length} tables`);
            return estimatedPages;
        }
        
        return 1;
    }

    /**
     * 주제 목록 파싱
     * @param {string} topicsText - 주제 목록 텍스트
     * @returns {Array<string>} - 주제 배열
     */
    parseTopics(topicsText) {
        const topics = topicsText
            .split(/[\n,;]+/)
            .map(t => t.trim())
            .filter(t => t.length > 0);
        
        logger.info(`📋 Parsed ${topics.length} topics: ${topics.join(', ')}`);
        
        return topics;
    }
}

export default MultiPageBatchGenerator;

