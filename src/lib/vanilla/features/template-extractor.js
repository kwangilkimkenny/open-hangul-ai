/**
 * Template Extractor
 * 문서에서 구조(헤더/제목/표)만 남기고 내용 제거
 * 
 * @module features/template-extractor
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TemplateExtractor');

/**
 * 템플릿 추출기 클래스
 */
export class TemplateExtractor {
    constructor() {
        logger.info('📋 TemplateExtractor initialized');
    }

    /**
     * 문서에서 템플릿 추출
     * @param {Object} document - HWPX 문서 객체
     * @param {Object} options - 추출 옵션
     * @returns {Object} 템플릿 문서
     */
    extractTemplate(document, options = {}) {
        logger.info('📋 템플릿 추출 시작...');

        const {
            keepHeaders = true,          // 헤더 유지
            keepImages = true,            // 배경 이미지 유지
            keepStyles = true,            // 스타일 유지
            emptyContentText = '',        // 빈 내용 대체 텍스트
            preserveTableStructure = true // 테이블 구조 유지
        } = options;

        // Deep clone to avoid modifying original
        // ⚠️ JSON.stringify()는 Map을 복사하지 못함 → images는 별도 처리
        const templateDoc = JSON.parse(JSON.stringify(document));
        
        // ✅ images Map은 원본 참조 유지 (배경 이미지 정보 필요)
        if (document.images && document.images instanceof Map) {
            templateDoc.images = document.images;
            logger.debug(`  ✓ Images Map 유지: ${document.images.size}개`);
        }

        let headerCount = 0;
        let contentClearedCount = 0;
        let paragraphClearedCount = 0;

        // 섹션 순회
        templateDoc.sections.forEach((section, sectionIdx) => {
            logger.debug(`  섹션 ${sectionIdx + 1} 처리 중...`);

            section.elements?.forEach((element, elemIdx) => {
                if (element.type === 'table') {
                    // 테이블 처리
                    const result = this._processTable(element, {
                        keepHeaders,
                        emptyContentText,
                        keepImages,
                        keepStyles
                    });
                    
                    headerCount += result.headerCount;
                    contentClearedCount += result.contentClearedCount;
                } else if (element.type === 'paragraph') {
                    // 일반 단락 처리 (테이블 밖)
                    const cleared = this._processParagraph(element, {
                        emptyContentText,
                        keepStyles
                    });
                    
                    if (cleared) {
                        paragraphClearedCount++;
                    }
                }
            });
        });

        logger.info(`✅ 템플릿 추출 완료: 헤더 ${headerCount}개, 테이블 내용 제거 ${contentClearedCount}개, 단락 제거 ${paragraphClearedCount}개`);

        return {
            document: templateDoc,
            stats: {
                headerCount,
                contentClearedCount,
                paragraphClearedCount
            }
        };
    }

    /**
     * 일반 단락 처리 (테이블 밖)
     * @private
     */
    _processParagraph(paragraph, options) {
        const { emptyContentText, keepStyles } = options;
        
        // 단락에 텍스트가 있는지 확인
        if (!paragraph.runs || paragraph.runs.length === 0) {
            return false; // 이미 비어있음
        }
        
        let hasText = false;
        paragraph.runs.forEach(run => {
            if (run.text && run.text.trim().length > 0) {
                hasText = true;
            }
        });
        
        if (!hasText) {
            return false; // 텍스트 없음
        }
        
        // 첫 번째 run의 스타일 보존
        const firstRun = paragraph.runs[0] || {};
        
        // 텍스트만 비우기
        paragraph.runs = [{
            text: emptyContentText,
            // 스타일 보존 (선택적)
            ...(keepStyles && firstRun.style ? { style: firstRun.style } : {}),
            ...(keepStyles && firstRun.fontSize ? { fontSize: firstRun.fontSize } : {}),
            ...(keepStyles && firstRun.fontFamily ? { fontFamily: firstRun.fontFamily } : {}),
            ...(keepStyles && firstRun.color ? { color: firstRun.color } : {})
        }];
        
        logger.debug(`    ✓ 단락 내용 제거`);
        return true; // 제거됨
    }

    /**
     * 테이블 처리
     * @private
     */
    _processTable(table, options) {
        let headerCount = 0;
        let contentClearedCount = 0;

        table.rows?.forEach((row, rowIdx) => {
            row.cells?.forEach((cell, cellIdx) => {
                const isHeader = this._isHeaderCell(cell);

                if (isHeader) {
                    // 헤더 셀: 유지
                    headerCount++;
                    logger.debug(`    ✓ 헤더 유지 [행${rowIdx + 1}, 셀${cellIdx + 1}]: "${this._getCellText(cell)}"`);
                } else {
                    // 내용 셀: 비우기
                    if (this._hasContent(cell)) {
                        this._clearCellContent(cell, options);
                        contentClearedCount++;
                        logger.debug(`    ✓ 내용 제거 [행${rowIdx + 1}, 셀${cellIdx + 1}]`);
                    }
                }
            });
        });

        return { headerCount, contentClearedCount };
    }

    /**
     * 헤더 셀 판별
     * @private
     */
    _isHeaderCell(cell) {
        // 조건 1: 배경색이 있음 (흰색/투명 제외)
        if (cell.style?.backgroundColor && 
            cell.style.backgroundColor !== '#FFFFFF' &&
            cell.style.backgroundColor !== '#ffffff' &&
            cell.style.backgroundColor !== 'transparent') {
            return true;
        }

        // 조건 2: 배경 이미지가 있음 (컬러풀한 선)
        if (cell.style?.backgroundImage) {
            return true;
        }

        // 조건 3: 특정 헤더 키워드 포함
        const text = this._getCellText(cell);
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

        // 짧은 텍스트 + 키워드 포함 = 헤더
        if (text.length <= 30 && headerKeywords.some(keyword => text.includes(keyword))) {
            return true;
        }

        return false;
    }

    /**
     * 셀 텍스트 추출
     * @private
     */
    _getCellText(cell) {
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
     * 셀에 내용이 있는지 확인
     * @private
     */
    _hasContent(cell) {
        const text = this._getCellText(cell);
        return text.length > 0 && text !== '(비어있음)';
    }

    /**
     * 셀 내용 비우기
     * @private
     */
    _clearCellContent(cell, options) {
        const { emptyContentText, keepStyles } = options;

        if (!cell.elements || cell.elements.length === 0) {
            // 빈 셀에 기본 단락 추가
            cell.elements = [{
                type: 'paragraph',
                runs: [{ text: emptyContentText }]
            }];
            return;
        }

        // 기존 스타일 보존하면서 텍스트만 변경
        cell.elements.forEach(elem => {
            if (elem.type === 'paragraph' && elem.runs) {
                // 첫 번째 run의 스타일 보존
                const firstRun = elem.runs[0] || {};
                
                elem.runs = [{
                    text: emptyContentText,
                    // 스타일 속성 보존 (선택적)
                    ...(keepStyles && firstRun.fontSize ? { fontSize: firstRun.fontSize } : {}),
                    ...(keepStyles && firstRun.fontFamily ? { fontFamily: firstRun.fontFamily } : {}),
                    ...(keepStyles && firstRun.color ? { color: firstRun.color } : {})
                }];
            }
        });
    }
}

export default TemplateExtractor;

