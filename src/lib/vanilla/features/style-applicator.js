/**
 * Style Applicator
 * 문서에 일관된 서식을 자동으로 적용
 * 
 * @module features/style-applicator
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('StyleApplicator');

/**
 * 스타일 적용기 클래스
 */
export class StyleApplicator {
    constructor() {
        logger.info('🎨 StyleApplicator initialized');
        
        // 기본 스타일 정의
        this.styles = {
            header: {
                fontSize: '11pt',
                fontFamily: '맑은 고딕',
                fontWeight: 'bold',
                color: '#000000',
                align: 'center'
            },
            content: {
                fontSize: '10pt',
                fontFamily: '맑은 고딕',
                fontWeight: 'normal',
                color: '#333333',
                align: 'left',
                lineHeight: 1.6
            },
            title: {
                fontSize: '14pt',
                fontFamily: '맑은 고딕',
                fontWeight: 'bold',
                color: '#1a1a1a',
                align: 'center'
            }
        };
    }

    /**
     * 문서 전체에 스타일 적용
     * @param {Object} document - HWPX 문서 객체
     * @param {Object} options - 스타일 옵션
     * @returns {Object} - 스타일 적용된 문서
     */
    applyStyles(document, options = {}) {
        logger.info('🎨 Applying styles to document...');
        
        const {
            headerStyle = this.styles.header,
            contentStyle = this.styles.content,
            titleStyle = this.styles.title,
            applyToHeaders = true,
            applyToContent = true
        } = options;
        
        let appliedCount = 0;
        
        // 섹션 순회
        document.sections?.forEach((section, sIdx) => {
            section.elements?.forEach((elem, eIdx) => {
                if (elem.type === 'table') {
                    const result = this._applyStylesToTable(elem, {
                        headerStyle: applyToHeaders ? headerStyle : null,
                        contentStyle: applyToContent ? contentStyle : null
                    });
                    
                    appliedCount += result.appliedCount;
                }
            });
        });
        
        logger.info(`✅ Styles applied to ${appliedCount} cells`);
        
        return {
            document,
            appliedCount
        };
    }

    /**
     * 테이블에 스타일 적용
     * @private
     */
    _applyStylesToTable(table, options) {
        let appliedCount = 0;
        
        table.rows?.forEach((row, rowIdx) => {
            row.cells?.forEach((cell, cellIdx) => {
                const isHeader = this._isHeaderCell(cell);
                
                const targetStyle = isHeader ? options.headerStyle : options.contentStyle;
                
                if (!targetStyle) {
                    return; // 스타일 적용 안 함
                }
                
                // 셀 내 단락에 스타일 적용
                cell.elements?.forEach(elem => {
                    if (elem.type === 'paragraph' && elem.runs) {
                        elem.runs.forEach(run => {
                            // 기존 스타일 병합
                            run.fontSize = targetStyle.fontSize;
                            run.fontFamily = targetStyle.fontFamily;
                            run.fontWeight = targetStyle.fontWeight;
                            run.color = targetStyle.color;
                            
                            appliedCount++;
                        });
                        
                        // 단락 정렬
                        if (targetStyle.align) {
                            elem.align = targetStyle.align;
                        }
                    }
                });
                
                logger.debug(`  ✓ Style applied to cell [${rowIdx + 1}, ${cellIdx + 1}] (${isHeader ? 'header' : 'content'})`);
            });
        });
        
        return { appliedCount };
    }

    /**
     * 헤더 셀 판별
     * @private
     */
    _isHeaderCell(cell) {
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
        
        // 텍스트 기반 판별
        const text = this._extractCellText(cell);
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
     * 커스텀 스타일 생성
     * @param {Object} styleConfig - 스타일 설정
     * @returns {Object} - 스타일 객체
     */
    createCustomStyle(styleConfig) {
        return {
            fontSize: styleConfig.fontSize || '10pt',
            fontFamily: styleConfig.fontFamily || '맑은 고딕',
            fontWeight: styleConfig.fontWeight || 'normal',
            color: styleConfig.color || '#000000',
            align: styleConfig.align || 'left',
            lineHeight: styleConfig.lineHeight || 1.5
        };
    }

    /**
     * 프리셋 스타일 목록
     * @returns {Object} - 사용 가능한 프리셋 목록
     */
    getPresets() {
        return {
            default: {
                header: this.styles.header,
                content: this.styles.content,
                title: this.styles.title
            },
            professional: {
                header: {
                    fontSize: '12pt',
                    fontFamily: '나눔고딕',
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    align: 'center'
                },
                content: {
                    fontSize: '11pt',
                    fontFamily: '나눔고딕',
                    fontWeight: 'normal',
                    color: '#34495e',
                    align: 'left',
                    lineHeight: 1.8
                }
            },
            colorful: {
                header: {
                    fontSize: '12pt',
                    fontFamily: '맑은 고딕',
                    fontWeight: 'bold',
                    color: '#e74c3c',
                    align: 'center'
                },
                content: {
                    fontSize: '10pt',
                    fontFamily: '맑은 고딕',
                    fontWeight: 'normal',
                    color: '#2980b9',
                    align: 'left',
                    lineHeight: 1.6
                }
            }
        };
    }
}

export default StyleApplicator;

