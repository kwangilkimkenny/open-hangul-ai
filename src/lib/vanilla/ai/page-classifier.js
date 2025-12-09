/**
 * Page Classifier
 * HWPX 문서의 각 페이지 유형을 자동으로 분류
 * 
 * @module ai/page-classifier
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 페이지 유형 분류기
 * 각 페이지의 역할과 특성을 자동으로 파악
 */
export class PageClassifier {
    constructor() {
        // 페이지 유형 정의
        this.pageTypes = {
            COVER: '표지',
            TOC: '목차',
            MAIN_CONTENT: '본문',
            FORM: '양식/서식',
            TABLE: '표/데이터',
            APPENDIX: '부록',
            REFERENCE: '참고자료',
            UNKNOWN: '미분류'
        };

        logger.info('📋 PageClassifier initialized');
    }

    /**
     * 페이지 유형 분석
     * @param {Object} section - 섹션 객체
     * @param {number} pageIndex - 페이지 번호 (0-based)
     * @param {number} totalPages - 전체 페이지 수
     * @returns {Object} 페이지 분석 결과
     */
    classifyPage(section, pageIndex, totalPages) {
        const analysis = {
            pageNumber: pageIndex + 1,
            type: null,
            confidence: 0,
            characteristics: {
                hasTitle: false,
                hasTable: false,
                hasForm: false,
                hasLongText: false,
                hasImages: false,
                elementCount: 0,
                textDensity: 0,
                headerPatterns: [],
                emptyFieldCount: 0
            },
            role: '',
            suggestedPrompt: ''
        };

        // 요소 분석
        const elements = section.elements || [];
        analysis.characteristics.elementCount = elements.length;

        let totalTextLength = 0;
        let tableCount = 0;
        let paragraphCount = 0;
        const headers = [];
        let emptyFields = 0;

        elements.forEach(element => {
            if (element.type === 'table') {
                tableCount++;
                // 테이블 헤더 추출
                const { headers: headerTexts, emptyCount } = this.extractTableHeaders(element);
                headers.push(...headerTexts);
                emptyFields += emptyCount;
            } else if (element.type === 'paragraph') {
                paragraphCount++;
                const text = this.extractParagraphText(element);
                totalTextLength += text.length;
                
                // 제목 패턴 감지
                if (this.isTitleLike(text)) {
                    analysis.characteristics.hasTitle = true;
                }
            }
        });

        analysis.characteristics.hasTable = tableCount > 0;
        analysis.characteristics.textDensity = totalTextLength / Math.max(elements.length, 1);
        analysis.characteristics.headerPatterns = headers;
        analysis.characteristics.emptyFieldCount = emptyFields;

        // 양식 패턴 (빈 필드가 많음)
        analysis.characteristics.hasForm = emptyFields >= 3;

        // 유형 판정 로직
        const result = this.determinePageType(
            analysis,
            pageIndex,
            totalPages,
            tableCount,
            paragraphCount,
            headers
        );

        analysis.type = result.type;
        analysis.confidence = result.confidence;
        analysis.role = result.role;
        analysis.suggestedPrompt = result.suggestedPrompt;

        logger.debug(`  📋 Page ${pageIndex + 1} classified as: ${result.type} (confidence: ${result.confidence})`);

        return analysis;
    }

    /**
     * 페이지 유형 판정
     * @private
     */
    determinePageType(analysis, pageIndex, totalPages, tableCount, paragraphCount, headers) {
        // 1. 첫 페이지 → 표지 가능성 검토
        if (pageIndex === 0 && totalPages > 1) {
            if (analysis.characteristics.hasTitle && 
                !analysis.characteristics.hasTable &&
                paragraphCount <= 5) {
                return {
                    type: this.pageTypes.COVER,
                    confidence: 0.8,
                    role: '문서의 제목, 작성자, 날짜 등을 표시하는 표지',
                    suggestedPrompt: '이 페이지는 표지입니다. 전문적이고 명확한 제목과 기본 정보를 생성하세요.'
                };
            }
        }

        // 2. 양식/서식 패턴 (헤더-내용 쌍이 많음 + 빈 필드 많음)
        if (headers.length >= 5 && 
            tableCount >= 1 && 
            analysis.characteristics.emptyFieldCount >= 5) {
            const headerSample = headers.slice(0, 3).join(', ');
            return {
                type: this.pageTypes.FORM,
                confidence: 0.9,
                role: '정형화된 양식으로 특정 정보를 기입하는 서식',
                suggestedPrompt: `이 페이지는 "${headerSample}" 등의 항목을 포함한 양식입니다. 각 항목에 맞는 구체적이고 현실적인 내용을 생성하세요. 특히 빈 필드를 모두 채워야 합니다.`
            };
        }

        // 3. 표/데이터 중심 (테이블 많음 + 빈 필드 적음)
        if (tableCount >= 2 && analysis.characteristics.emptyFieldCount < 3) {
            return {
                type: this.pageTypes.TABLE,
                confidence: 0.75,
                role: '데이터와 정보를 표 형식으로 정리한 페이지',
                suggestedPrompt: '이 페이지는 데이터 표입니다. 정확하고 일관성 있는 데이터를 생성하세요.'
            };
        }

        // 4. 본문 패턴 (긴 텍스트 + 단락 많음)
        if (analysis.characteristics.textDensity > 100 && paragraphCount > 5) {
            return {
                type: this.pageTypes.MAIN_CONTENT,
                confidence: 0.7,
                role: '주요 내용을 담은 본문',
                suggestedPrompt: '이 페이지는 본문입니다. 논리적이고 체계적인 설명을 생성하세요.'
            };
        }

        // 5. 목차 패턴 (짧은 항목들 + 숫자/점)
        if (this.hasTocPattern(headers) && paragraphCount > 3) {
            return {
                type: this.pageTypes.TOC,
                confidence: 0.65,
                role: '문서의 구조를 보여주는 목차',
                suggestedPrompt: '이 페이지는 목차입니다. 문서 전체 구조를 반영하여 생성하세요.'
            };
        }

        // 6. 마지막 페이지 → 부록/참고자료 가능성
        if (pageIndex === totalPages - 1 && totalPages > 2) {
            if (paragraphCount > 0 || tableCount > 0) {
                return {
                    type: this.pageTypes.APPENDIX,
                    confidence: 0.6,
                    role: '추가 정보나 참고자료를 제공하는 부록',
                    suggestedPrompt: '이 페이지는 부록입니다. 본문을 보완하는 추가 정보를 생성하세요.'
                };
            }
        }

        // 기본값
        return {
            type: this.pageTypes.UNKNOWN,
            confidence: 0.3,
            role: '일반 페이지',
            suggestedPrompt: '이 페이지의 내용을 적절하게 생성하세요.'
        };
    }

    /**
     * 테이블 헤더 추출 및 빈 필드 카운트
     * @private
     */
    extractTableHeaders(table) {
        const headers = [];
        let emptyCount = 0;

        if (table.rows && table.rows.length > 0) {
            table.rows.forEach(row => {
                if (row.cells) {
                    row.cells.forEach((cell, idx) => {
                        const text = this.extractCellText(cell);
                        
                        // 짝수 인덱스 또는 첫 번째 셀 → 헤더 가능성
                        if (idx % 2 === 0 || idx === 0) {
                            if (text.length < 50 && text.length > 1) {
                                headers.push(text);
                            }
                        }
                        
                        // 빈 필드 체크
                        if (text.trim() === '' || text.trim() === '(비어있음)') {
                            emptyCount++;
                        }
                    });
                }
            });
        }

        return { headers, emptyCount };
    }

    /**
     * 셀 텍스트 추출
     * @private
     */
    extractCellText(cell) {
        let text = '';
        if (cell.elements) {
            cell.elements.forEach(element => {
                if (element.type === 'paragraph' && element.runs) {
                    element.runs.forEach(run => {
                        if (run.text) {
                            text += run.text;
                        }
                    });
                }
            });
        }
        return text.trim();
    }

    /**
     * 단락 텍스트 추출
     * @private
     */
    extractParagraphText(paragraph) {
        let text = '';
        if (paragraph.runs) {
            paragraph.runs.forEach(run => {
                if (run.text) {
                    text += run.text;
                }
            });
        }
        return text;
    }

    /**
     * 제목 패턴 감지
     * @private
     */
    isTitleLike(text) {
        // 짧고, 줄바꿈 없고, 특수문자 적음
        return text.length > 3 &&
               text.length < 100 && 
               !text.includes('\n') &&
               text.split(' ').length <= 10;
    }

    /**
     * 목차 패턴 감지
     * @private
     */
    hasTocPattern(headers) {
        // "1.", "2.", "가.", "나." 등의 패턴
        const tocPattern = /^[\d가-힣a-zA-Z]+[\.\)]/;
        const matches = headers.filter(h => tocPattern.test(h.trim()));
        return matches.length >= 3;
    }

    /**
     * 분류 결과를 사람이 읽기 쉬운 형태로 반환
     * @param {Object} analysis - 분석 결과
     * @returns {string} 설명 문자열
     */
    describeClassification(analysis) {
        return `페이지 ${analysis.pageNumber}: ${analysis.type} (${analysis.role})
  - 신뢰도: ${(analysis.confidence * 100).toFixed(0)}%
  - 특성: 요소 ${analysis.characteristics.elementCount}개, 헤더 ${analysis.characteristics.headerPatterns.length}개, 빈 필드 ${analysis.characteristics.emptyFieldCount}개
  - 제안: ${analysis.suggestedPrompt}`;
    }
}

