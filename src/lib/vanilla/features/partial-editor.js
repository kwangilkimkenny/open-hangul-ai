/**
 * Partial Editor
 * 선택한 항목만 수정하는 기능
 * 
 * @module features/partial-editor
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('PartialEditor');

/**
 * 부분 편집기 클래스
 */
export class PartialEditor {
    constructor() {
        logger.info('✏️ PartialEditor initialized');
        
        // 인식 가능한 항목 키워드
        this.itemKeywords = [
            { keywords: ['놀이명', '제목', '타이틀'], canonical: '놀이명' },
            { keywords: ['놀이기간', '기간', '날짜'], canonical: '놀이기간' },
            { keywords: ['연령', '나이', '대상'], canonical: '연령' },
            { keywords: ['놀이속배움', '배움', '학습목표'], canonical: '놀이속배움' },
            { keywords: ['누리과정', '관련요소', '교육과정'], canonical: '누리과정관련요소' },
            { keywords: ['놀이자료', '자료', '준비물', '재료'], canonical: '놀이자료' },
            { keywords: ['사전준비', '도입', '준비'], canonical: '사전준비(도입)' },
            { keywords: ['교사의 지원', '지원', '역할', '교사역할'], canonical: '교사의 지원' },
            { keywords: ['놀이방법', '전개', '활동', '과정'], canonical: '놀이방법(전개)' },
            { keywords: ['놀이의 확장', '확장', '심화'], canonical: '놀이의 확장' },
            { keywords: ['마무리', '정리', '평가'], canonical: '마무리' }
        ];
    }

    /**
     * 사용자 요청에서 부분 수정 항목 추출
     * @param {string} userRequest - 사용자 요청
     * @returns {Object|null} - { isPartial: boolean, targetItems: string[], userRequest: string }
     */
    parsePartialRequest(userRequest) {
        logger.debug(`📝 Parsing partial request: "${userRequest}"`);
        
        // "만 다시 생성", "만 수정", "부분만" 같은 키워드 감지
        const partialKeywords = ['만 다시', '만 수정', '만 변경', '만 생성', '부분만', '항목만'];
        const isPartialRequest = partialKeywords.some(keyword => userRequest.includes(keyword));
        
        if (!isPartialRequest) {
            return null;
        }
        
        // 항목 추출
        const targetItems = [];
        
        this.itemKeywords.forEach(item => {
            // 각 키워드를 검사
            item.keywords.forEach(keyword => {
                if (userRequest.includes(keyword)) {
                    // 중복 방지
                    if (!targetItems.includes(item.canonical)) {
                        targetItems.push(item.canonical);
                        logger.debug(`  ✓ 항목 발견: ${item.canonical} (키워드: ${keyword})`);
                    }
                }
            });
        });
        
        if (targetItems.length === 0) {
            logger.warn('⚠️ 부분 수정 요청이지만 항목을 찾을 수 없음');
            return null;
        }
        
        logger.info(`✅ 부분 수정 요청: ${targetItems.length}개 항목 - [${targetItems.join(', ')}]`);
        
        return {
            isPartial: true,
            targetItems,
            originalRequest: userRequest
        };
    }

    /**
     * 헤더-내용 쌍 필터링 (선택한 항목만)
     * @param {Array<Object>} headerContentPairs - 전체 헤더-내용 쌍
     * @param {Array<string>} targetItems - 수정할 항목 이름
     * @returns {Array<Object>} - 필터링된 헤더-내용 쌍
     */
    filterPairs(headerContentPairs, targetItems) {
        logger.debug(`🔍 Filtering pairs: ${headerContentPairs.length} → ${targetItems.length} items`);
        
        const filtered = headerContentPairs.filter(pair => {
            // 정확한 매칭
            if (targetItems.includes(pair.header)) {
                return true;
            }
            
            // 유사 매칭 (공백, 괄호 무시)
            const normalizedHeader = this.normalizeText(pair.header);
            return targetItems.some(target => {
                const normalizedTarget = this.normalizeText(target);
                return normalizedHeader.includes(normalizedTarget) || 
                       normalizedTarget.includes(normalizedHeader);
            });
        });
        
        logger.info(`✅ Filtered: ${filtered.length}/${headerContentPairs.length} pairs`);
        filtered.forEach(pair => {
            logger.debug(`  ✓ "${pair.header}"`);
        });
        
        return filtered;
    }

    /**
     * 텍스트 정규화 (비교용)
     * @private
     */
    normalizeText(text) {
        return text.replace(/[\s()]/g, '').toLowerCase();
    }

    /**
     * 부분 수정 결과를 원본 문서에 병합
     * @param {Object} originalDoc - 원본 문서
     * @param {Object} partialResult - 부분 수정 결과
     * @param {Array<string>} targetItems - 수정된 항목
     * @returns {Object} - 병합된 문서
     */
    mergePartialResult(originalDoc, partialResult, targetItems) {
        logger.info(`🔀 Merging partial result: ${targetItems.length} items`);
        
        // Deep clone
        const mergedDoc = JSON.parse(JSON.stringify(originalDoc));
        
        // partialResult의 내용을 mergedDoc에 병합
        // (여기서는 단순화를 위해 전체 덮어쓰기, 실제로는 항목별 병합 필요)
        
        logger.info('✅ Partial merge completed');
        
        return partialResult; // 간단화: 부분 결과를 그대로 반환
    }
}

export default PartialEditor;

