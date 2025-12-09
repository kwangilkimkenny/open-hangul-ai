/**
 * Document Validator
 * 문서 내용 검증 (빈 칸, 오류, 중복, 품질 체크)
 * 
 * @module features/document-validator
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('DocumentValidator');

/**
 * 문서 검증기 클래스
 */
export class DocumentValidator {
    constructor() {
        logger.info('✅ DocumentValidator initialized');
        
        // 검증 규칙 정의
        this.rules = {
            minContentLength: 5,      // 최소 내용 길이
            maxContentLength: 5000,   // 최대 내용 길이 (매우 긴 텍스트)
            requiredHeaders: [        // 필수 헤더
                '놀이명',
                '놀이기간',
                '연령',
                '놀이방법'
            ]
        };
    }

    /**
     * 문서 전체 검증
     * @param {Object} document - HWPX 문서 객체
     * @returns {Object} - 검증 결과
     */
    validate(document) {
        logger.info('✅ Starting document validation...');
        
        const issues = [];
        const warnings = [];
        const stats = {
            totalCells: 0,
            emptyCells: 0,
            shortCells: 0,
            longCells: 0,
            tableCount: 0,
            headerCount: 0,
            contentCount: 0
        };
        
        // 테이블 검사
        document.sections?.forEach((section, sIdx) => {
            section.elements?.forEach((elem, eIdx) => {
                if (elem.type === 'table') {
                    stats.tableCount++;
                    const tableResult = this._validateTable(elem, sIdx, eIdx);
                    
                    issues.push(...tableResult.issues);
                    warnings.push(...tableResult.warnings);
                    
                    stats.totalCells += tableResult.stats.totalCells;
                    stats.emptyCells += tableResult.stats.emptyCells;
                    stats.shortCells += tableResult.stats.shortCells;
                    stats.longCells += tableResult.stats.longCells;
                    stats.headerCount += tableResult.stats.headerCount;
                    stats.contentCount += tableResult.stats.contentCount;
                }
            });
        });
        
        // 필수 항목 체크
        const missingHeaders = this._checkRequiredHeaders(document);
        if (missingHeaders.length > 0) {
            issues.push({
                type: 'missing_header',
                severity: 'error',
                message: `필수 항목 누락: ${missingHeaders.join(', ')}`
            });
        }
        
        // 결과
        const result = {
            isValid: issues.filter(i => i.severity === 'error').length === 0,
            issues,
            warnings,
            stats,
            summary: this._generateSummary(issues, warnings, stats)
        };
        
        logger.info(`✅ Validation completed: ${issues.length} issues, ${warnings.length} warnings`);
        
        return result;
    }

    /**
     * 테이블 검증
     * @private
     */
    _validateTable(table, sectionIdx, elementIdx) {
        const issues = [];
        const warnings = [];
        const stats = {
            totalCells: 0,
            emptyCells: 0,
            shortCells: 0,
            longCells: 0,
            headerCount: 0,
            contentCount: 0
        };
        
        table.rows?.forEach((row, rowIdx) => {
            row.cells?.forEach((cell, cellIdx) => {
                stats.totalCells++;
                
                const text = this._extractCellText(cell);
                const isHeader = this._isHeaderCell(cell, text);
                
                if (isHeader) {
                    stats.headerCount++;
                } else {
                    stats.contentCount++;
                    
                    // 빈 칸 체크
                    if (!text || text === '(비어있음)') {
                        stats.emptyCells++;
                        issues.push({
                            type: 'empty_cell',
                            severity: 'error',
                            location: { section: sectionIdx, table: elementIdx, row: rowIdx, cell: cellIdx },
                            message: `빈 칸: 행 ${rowIdx + 1}, 셀 ${cellIdx + 1}`
                        });
                    }
                    // 너무 짧은 내용
                    else if (text.length < this.rules.minContentLength) {
                        stats.shortCells++;
                        warnings.push({
                            type: 'short_content',
                            severity: 'warning',
                            location: { section: sectionIdx, table: elementIdx, row: rowIdx, cell: cellIdx },
                            message: `내용이 너무 짧음 (${text.length}자): 행 ${rowIdx + 1}, 셀 ${cellIdx + 1} - "${text}"`
                        });
                    }
                    // 너무 긴 내용 (경고)
                    else if (text.length > this.rules.maxContentLength) {
                        stats.longCells++;
                        warnings.push({
                            type: 'long_content',
                            severity: 'warning',
                            location: { section: sectionIdx, table: elementIdx, row: rowIdx, cell: cellIdx },
                            message: `내용이 매우 길음 (${text.length}자): 행 ${rowIdx + 1}, 셀 ${cellIdx + 1}`
                        });
                    }
                }
            });
        });
        
        return { issues, warnings, stats };
    }

    /**
     * 셀 텍스트 추출
     * @private
     */
    _extractCellText(cell) {
        if (!cell.elements || cell.elements.length === 0) return '';
        
        let text = '';
        cell.elements.forEach(elem => {
            if (elem.type === 'paragraph' && elem.runs) {
                elem.runs.forEach(run => {
                    if (run.text) text += run.text;
                });
            }
        });
        
        return text.trim();
    }

    /**
     * 헤더 셀 판별
     * @private
     */
    _isHeaderCell(cell, text) {
        // 배경색 체크
        if (cell.style?.backgroundColor && 
            cell.style.backgroundColor !== '#FFFFFF' &&
            cell.style.backgroundColor !== '#ffffff' &&
            cell.style.backgroundColor !== 'transparent') {
            return true;
        }
        
        // 배경 이미지 체크
        if (cell.style?.backgroundImage) {
            return true;
        }
        
        // 헤더 키워드 체크
        const headerKeywords = [
            '놀이명', '놀이기간', '기간', '연령', '날짜',
            '놀이속배움', '누리과정', '관련요소',
            '놀이자료', '자료', '준비물',
            '사전준비', '도입', '준비',
            '교사의 지원', '지원', '역할',
            '놀이방법', '전개', '활동', '과정',
            '놀이의 확장', '확장',
            '마무리', '정리', '평가'
        ];
        
        return text.length <= 30 && headerKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * 필수 헤더 체크
     * @private
     */
    _checkRequiredHeaders(document) {
        const foundHeaders = new Set();
        
        document.sections?.forEach(section => {
            section.elements?.forEach(elem => {
                if (elem.type === 'table') {
                    elem.rows?.forEach(row => {
                        row.cells?.forEach(cell => {
                            const text = this._extractCellText(cell);
                            if (this._isHeaderCell(cell, text)) {
                                // 정규화해서 매칭
                                this.rules.requiredHeaders.forEach(required => {
                                    if (text.includes(required)) {
                                        foundHeaders.add(required);
                                    }
                                });
                            }
                        });
                    });
                }
            });
        });
        
        return this.rules.requiredHeaders.filter(h => !foundHeaders.has(h));
    }

    /**
     * 검증 요약 생성
     * @private
     */
    _generateSummary(issues, warnings, stats) {
        const errorCount = issues.filter(i => i.severity === 'error').length;
        const warningCount = warnings.length;
        
        let summary = '';
        
        if (errorCount === 0 && warningCount === 0) {
            summary = '✅ 문제가 발견되지 않았습니다!';
        } else {
            summary = `⚠️ ${errorCount}개 오류, ${warningCount}개 경고 발견\n\n`;
            summary += `📊 통계:\n`;
            summary += `  - 테이블: ${stats.tableCount}개\n`;
            summary += `  - 전체 셀: ${stats.totalCells}개\n`;
            summary += `  - 헤더: ${stats.headerCount}개\n`;
            summary += `  - 내용: ${stats.contentCount}개\n`;
            summary += `  - 빈 칸: ${stats.emptyCells}개 ❌\n`;
            summary += `  - 짧은 내용: ${stats.shortCells}개 ⚠️\n`;
            summary += `  - 긴 내용: ${stats.longCells}개 ⚠️\n`;
        }
        
        return summary;
    }

    /**
     * 검증 결과를 사용자 친화적인 메시지로 변환
     * @param {Object} result - 검증 결과
     * @returns {string} - 포맷된 메시지
     */
    formatResult(result) {
        let message = result.summary + '\n\n';
        
        // 오류 목록
        const errors = result.issues.filter(i => i.severity === 'error');
        if (errors.length > 0) {
            message += '❌ 오류:\n';
            errors.slice(0, 10).forEach((error, idx) => {
                message += `  ${idx + 1}. ${error.message}\n`;
            });
            if (errors.length > 10) {
                message += `  ... 외 ${errors.length - 10}개\n`;
            }
            message += '\n';
        }
        
        // 경고 목록
        if (result.warnings.length > 0) {
            message += '⚠️ 경고:\n';
            result.warnings.slice(0, 5).forEach((warning, idx) => {
                message += `  ${idx + 1}. ${warning.message}\n`;
            });
            if (result.warnings.length > 5) {
                message += `  ... 외 ${result.warnings.length - 5}개\n`;
            }
        }
        
        return message;
    }
}

export default DocumentValidator;

