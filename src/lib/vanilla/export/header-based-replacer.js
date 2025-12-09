/**
 * Header-Based Section Replacer
 * 헤더 기반 섹션 내용 교체 시스템
 * 
 * @module export/header-based-replacer
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * @typedef {Object} TableCell
 * @property {Element} element - XML 셀 요소 (<hp:tc>)
 * @property {Element} subList - subList 요소
 * @property {string} text - 셀의 텍스트 내용
 * @property {boolean} isHeader - 헤더 여부
 * @property {number} rowIndex - 행 인덱스
 * @property {number} colIndex - 열 인덱스
 */

/**
 * @typedef {Object} HeaderSectionPair
 * @property {string} header - 헤더 이름
 * @property {TableCell} headerCell - 헤더 셀
 * @property {TableCell} contentCell - 내용 셀
 * @property {string} originalContent - 원본 내용
 */

/**
 * 헤더 기반 섹션 교체 클래스
 */
export class HeaderBasedReplacer {
    constructor() {
        this.hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
        logger.info('🔄 HeaderBasedReplacer initialized');
    }
    
    /**
     * 테이블의 모든 셀 추출
     * @param {Document} xmlDoc - XML 문서
     * @returns {Array<TableCell>} 셀 배열
     */
    extractTableCells(xmlDoc) {
        const cells = [];
        const tables = xmlDoc.getElementsByTagNameNS(this.hpNamespace, 'tbl');
        
        logger.info(`    📊 발견된 테이블: ${tables.length}개`);
        
        for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
            const table = tables[tableIdx];
            const rows = table.getElementsByTagNameNS(this.hpNamespace, 'tr');
            
            logger.debug(`    📋 테이블[${tableIdx}]: ${rows.length}개 행`);
            
            for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
                const row = rows[rowIdx];
                const tcs = row.getElementsByTagNameNS(this.hpNamespace, 'tc');
                
                for (let colIdx = 0; colIdx < tcs.length; colIdx++) {
                    const tc = tcs[colIdx];
                    const subList = tc.getElementsByTagNameNS(this.hpNamespace, 'subList')[0];
                    
                    if (subList) {
                        // 셀의 모든 텍스트 추출
                        const text = this._extractCellText(subList);
                        const isHeader = this._isHeaderCell(text);
                        
                        cells.push({
                            element: tc,
                            subList: subList,
                            text: text.trim(),
                            isHeader: isHeader,
                            rowIndex: rowIdx,
                            colIndex: colIdx,
                            tableIndex: tableIdx
                        });
                        
                        logger.debug(`    📍 셀[${rowIdx},${colIdx}]: "${text.substring(0, 20)}..." (헤더: ${isHeader})`);
                    }
                }
            }
        }
        
        logger.info(`    ✅ 총 ${cells.length}개 셀 추출 완료`);
        return cells;
    }
    
    /**
     * 셀의 모든 텍스트 추출
     * @param {Element} subList - subList 요소
     * @returns {string} 추출된 텍스트
     * @private
     */
    _extractCellText(subList) {
        const textNodes = subList.getElementsByTagNameNS(this.hpNamespace, 't');
        const texts = [];
        
        for (let i = 0; i < textNodes.length; i++) {
            const text = textNodes[i].textContent || textNodes[i].nodeValue || '';
            if (text.trim()) {
                texts.push(text.trim());
            }
        }
        
        return texts.join(' ');
    }
    
    /**
     * 헤더 셀 판별
     * @param {string} text - 셀 텍스트
     * @returns {boolean} 헤더 여부
     * @private
     */
    _isHeaderCell(text) {
        // 알려진 헤더 목록
        const knownHeaders = [
            '놀이명', '놀이기간', '연령', '놀이속배움',
            '누리과정관련요소', '놀이자료', '사전준비', '도입',
            '사전준비(도입)', '교사의 지원', '놀이방법', '전개',
            '놀이방법(전개)', '놀이의 확장', '마무리'
        ];
        
        const trimmed = text.trim();
        
        // 정확히 매칭되는 헤더
        if (knownHeaders.includes(trimmed)) {
            return true;
        }
        
        // 헤더 + 공백 패턴
        for (const header of knownHeaders) {
            if (trimmed.startsWith(header)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 헤더-섹션 쌍 생성
     * @param {Array<TableCell>} cells - 셀 배열
     * @returns {Array<HeaderSectionPair>} 헤더-섹션 쌍 배열
     */
    createHeaderSectionPairs(cells) {
        const pairs = [];
        
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            
            if (cell.isHeader) {
                // 다음 셀 찾기 (같은 행의 다음 열 또는 다음 행의 첫 열)
                let contentCell = null;
                
                // 같은 행의 다음 열 찾기
                for (let j = i + 1; j < cells.length; j++) {
                    if (cells[j].tableIndex === cell.tableIndex && 
                        cells[j].rowIndex === cell.rowIndex && 
                        cells[j].colIndex > cell.colIndex) {
                        contentCell = cells[j];
                        break;
                    }
                }
                
                // 다음 행 전체가 내용일 수 있음 (병합된 셀)
                if (!contentCell || contentCell.isHeader) {
                    for (let j = i + 1; j < cells.length; j++) {
                        if (cells[j].tableIndex === cell.tableIndex && 
                            cells[j].rowIndex > cell.rowIndex && 
                            !cells[j].isHeader) {
                            contentCell = cells[j];
                            break;
                        }
                    }
                }
                
                if (contentCell) {
                    pairs.push({
                        header: cell.text,
                        headerCell: cell,
                        contentCell: contentCell,
                        originalContent: contentCell.text
                    });
                    
                    logger.debug(`    🔗 페어: "${cell.text}" → "${contentCell.text.substring(0, 30)}..."`);
                }
            }
        }
        
        logger.info(`    ✅ ${pairs.length}개 헤더-섹션 쌍 생성 완료`);
        return pairs;
    }
    
    /**
     * 섹션 내용 교체
     * @param {Document} xmlDoc - XML 문서
     * @param {HeaderSectionPair} pair - 헤더-섹션 쌍
     * @param {string} newContent - 새 내용
     * @returns {boolean} 성공 여부
     */
    replaceSectionContent(xmlDoc, pair, newContent) {
        try {
            logger.info(`    🔄 "${pair.header}" 섹션 교체 시작`);
            logger.debug(`    📝 원본: "${pair.originalContent.substring(0, 50)}..."`);
            logger.debug(`    📝 신규: "${newContent.substring(0, 50)}..."`);
            
            const subList = pair.contentCell.subList;
            
            // 1. ⚠️ 중요: 기존 단락 제거 전 속성 저장! (live collection 문제 해결)
            const oldParagraphs = subList.getElementsByTagNameNS(this.hpNamespace, 'p');
            const oldCount = oldParagraphs.length;
            
            let paraPrIDRef = '3';  // 기본값
            let charPrIDRef = '1';  // 기본값
            
            // ✅ 제거하기 전에 속성 저장!
            if (oldCount > 0) {
                const firstOldP = oldParagraphs[0];
                paraPrIDRef = firstOldP.getAttribute('paraPrIDRef') || paraPrIDRef;
                
                const firstOldRun = firstOldP.getElementsByTagNameNS(this.hpNamespace, 'run')[0];
                if (firstOldRun) {
                    charPrIDRef = firstOldRun.getAttribute('charPrIDRef') || charPrIDRef;
                }
                logger.debug(`    🎨 원본 셀 스타일 복사: paraPrIDRef="${paraPrIDRef}", charPrIDRef="${charPrIDRef}"`);
            } else {
                // 폴백: 같은 테이블 내 다른 내용 셀에서 가져오기
                const allSubLists = xmlDoc.getElementsByTagNameNS(this.hpNamespace, 'subList');
                for (let i = 0; i < allSubLists.length; i++) {
                    const sl = allSubLists[i];
                    const ps = sl.getElementsByTagNameNS(this.hpNamespace, 'p');
                    if (ps.length > 0) {
                        // 헤더가 아닌 일반 내용 셀 찾기 (charPrIDRef가 2가 아님)
                        const p = ps[0];
                        const run = p.getElementsByTagNameNS(this.hpNamespace, 'run')[0];
                        if (run) {
                            const testCharPrIDRef = run.getAttribute('charPrIDRef');
                            // charPrIDRef="1" 또는 "2"가 아닌 것을 찾음 (내용 셀)
                            if (testCharPrIDRef && testCharPrIDRef !== '1' && testCharPrIDRef !== '2') {
                                paraPrIDRef = p.getAttribute('paraPrIDRef') || paraPrIDRef;
                                charPrIDRef = testCharPrIDRef;
                                logger.debug(`    🎨 폴백: 다른 셀 스타일 복사: paraPrIDRef="${paraPrIDRef}", charPrIDRef="${charPrIDRef}"`);
                                break;
                            }
                        }
                    }
                }
            }
            
            // 2. 이제 기존 단락 제거 (속성 저장 완료 후)
            for (let i = oldParagraphs.length - 1; i >= 0; i--) {
                subList.removeChild(oldParagraphs[i]);
            }
            
            logger.debug(`    🗑️  ${oldCount}개 기존 단락 제거`);
            
            // 3. 새 내용을 단락으로 분리 (줄바꿈 기준)
            const lines = newContent.split('\n').filter(line => line.trim());
            logger.debug(`    📄 ${lines.length}개 새 단락 생성 예정`);
            
            // 5. 각 줄을 새 단락으로 추가
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                const line = lines[lineIdx];
                
                // 새 단락 생성
                const newP = xmlDoc.createElementNS(this.hpNamespace, 'hp:p');
                newP.setAttribute('id', '0');
                newP.setAttribute('paraPrIDRef', paraPrIDRef);
                newP.setAttribute('styleIDRef', '0');
                newP.setAttribute('pageBreak', '0');
                newP.setAttribute('columnBreak', '0');
                newP.setAttribute('merged', '0');
                newP.setAttribute('autoLineBreak', '1');
                
                // 새 run 생성
                const newRun = xmlDoc.createElementNS(this.hpNamespace, 'hp:run');
                newRun.setAttribute('charPrIDRef', charPrIDRef);
                
                // 새 텍스트 노드 생성
                const newT = xmlDoc.createElementNS(this.hpNamespace, 'hp:t');
                newT.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
                newT.textContent = line;
                
                newRun.appendChild(newT);
                newP.appendChild(newRun);
                subList.appendChild(newP);
            }
            
            logger.info(`    ✅ "${pair.header}" 섹션 교체 완료 (${lines.length}개 단락)`);
            return true;
            
        } catch (error) {
            logger.error(`    ❌ 섹션 교체 실패: ${error.message}`);
            return false;
        }
    }
}

// Default export
export default HeaderBasedReplacer;

