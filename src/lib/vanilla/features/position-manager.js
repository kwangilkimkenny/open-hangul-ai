/**
 * Position Manager
 * 문서 내 모든 문자의 위치를 추적하고 관리
 * Canvas-editor의 Position 시스템을 DOM 기반으로 적용
 *
 * @module position-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Position Manager Class
 * 각 문자의 정확한 위치를 추적하여 커서 포지셔닝, 선택, 검색 등을 지원
 */
export class PositionManager {
    /**
     * PositionManager 생성자
     * @param {Object} viewer - HWPX Viewer 인스턴스
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.positionList = []; // 모든 문자의 위치 정보
        this.isReady = false;

        logger.info('🎯 PositionManager initialized');
    }

    /**
     * 문서 렌더링 후 위치 정보 수집
     * @param {HTMLElement} container - 렌더링된 컨테이너
     * @returns {Promise<number>} 수집된 위치 개수
     */
    async computePositions(container) {
        logger.info('📍 Computing character positions...');
        logger.time('Position Computation');

        this.positionList = [];
        this.isReady = false;

        try {
            let globalIndex = 0;

            // 모든 페이지 순회
            const pages = container.querySelectorAll('.hwp-page-container');
            logger.debug(`  Found ${pages.length} pages`);

            for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
                const page = pages[pageIndex];
                const pageNumber = parseInt(page.getAttribute('data-page-number')) || (pageIndex + 1);

                // 페이지 내 텍스트 노드 순회
                globalIndex = this._collectTextPositions(page, pageNumber, globalIndex);
            }

            this.isReady = true;
            logger.timeEnd('Position Computation');
            logger.info(`✅ Collected ${this.positionList.length} character positions`);

            return this.positionList.length;

        } catch (error) {
            logger.error('❌ Failed to compute positions:', error);
            this.isReady = false;
            throw error;
        }
    }

    /**
     * 요소 내 텍스트 위치 수집 (재귀)
     * @param {HTMLElement} element - 대상 요소
     * @param {number} pageNumber - 페이지 번호
     * @param {number} startIndex - 시작 인덱스
     * @returns {number} 다음 인덱스
     * @private
     */
    _collectTextPositions(element, pageNumber, startIndex) {
        let currentIndex = startIndex;

        // 스킵할 요소들 (헤더, 푸터, 페이지 번호)
        if (element.classList?.contains('hwp-page-header') ||
            element.classList?.contains('hwp-page-footer') ||
            element.classList?.contains('hwp-page-number')) {
            return currentIndex;
        }

        // 텍스트 노드 처리
        if (element.nodeType === Node.TEXT_NODE) {
            const text = element.textContent;
            if (!text || text.trim().length === 0) {
                return currentIndex;
            }

            // Range API를 사용하여 각 문자의 정확한 위치 측정
            const range = document.createRange();
            const parentElement = element.parentElement;

            if (!parentElement) {
                return currentIndex;
            }

            for (let i = 0; i < text.length; i++) {
                const char = text[i];

                try {
                    // 문자 범위 설정
                    range.setStart(element, i);
                    range.setEnd(element, i + 1);

                    // 문자의 경계 사각형 계산
                    const rect = range.getBoundingClientRect();

                    // 공백이나 줄바꿈도 포함 (위치 추적에 필요)
                    if (rect.width > 0 || rect.height > 0 || char === '\n' || char === ' ') {
                        this.positionList.push({
                            index: currentIndex,
                            value: char,
                            pageNumber: pageNumber,

                            // DOM 참조
                            textNode: element,
                            textOffset: i,
                            parentElement: parentElement,

                            // 좌표 정보
                            coordinate: {
                                left: rect.left,
                                top: rect.top,
                                right: rect.right,
                                bottom: rect.bottom,
                                width: rect.width,
                                height: rect.height
                            },

                            // 메타데이터
                            isWhitespace: /\s/.test(char),
                            isLinebreak: char === '\n',

                            // 컨텍스트 정보
                            elementType: this._getElementType(parentElement),
                            cellData: parentElement.closest('td, th')?._cellData,
                            paraData: parentElement.closest('.hwp-paragraph')?._paraData
                        });

                        currentIndex++;
                    }
                } catch (error) {
                    // Range 생성 실패 시 스킵 (예: display:none 요소)
                    logger.debug(`  Skipped character at index ${i}: ${error.message}`);
                }
            }

            return currentIndex;
        }

        // 자식 요소 재귀 처리
        if (element.childNodes) {
            for (const child of element.childNodes) {
                currentIndex = this._collectTextPositions(child, pageNumber, currentIndex);
            }
        }

        return currentIndex;
    }

    /**
     * 요소 타입 판별
     * @param {HTMLElement} element - 대상 요소
     * @returns {string} 요소 타입
     * @private
     */
    _getElementType(element) {
        if (element.closest('.hwp-table')) return 'table';
        if (element.closest('.hwp-paragraph')) return 'paragraph';
        if (element.closest('.hwp-shape')) return 'shape';
        if (element.closest('.hwp-image')) return 'image';
        return 'unknown';
    }

    /**
     * 좌표로 가장 가까운 위치 찾기 (클릭-투-포지션)
     * @param {number} x - X 좌표 (viewport 기준)
     * @param {number} y - Y 좌표 (viewport 기준)
     * @returns {Object|null} 가장 가까운 위치 정보
     */
    getPositionByXY(x, y) {
        if (!this.isReady || this.positionList.length === 0) {
            logger.warn('⚠️ Position list not ready');
            return null;
        }

        let closestPosition = null;
        let minDistance = Infinity;

        // 먼저 같은 줄에 있는 문자들 찾기 (Y 좌표가 비슷한)
        const tolerance = 5; // 5px 허용 오차
        const sameLine = this.positionList.filter(pos => {
            const coord = pos.coordinate;
            return y >= coord.top - tolerance && y <= coord.bottom + tolerance;
        });

        if (sameLine.length > 0) {
            // 같은 줄에서 가장 가까운 X 위치 찾기
            for (const pos of sameLine) {
                const coord = pos.coordinate;
                const centerX = (coord.left + coord.right) / 2;
                const distance = Math.abs(x - centerX);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestPosition = pos;
                }
            }
        } else {
            // 같은 줄이 없으면 전체에서 가장 가까운 위치 찾기 (2D 거리)
            for (const pos of this.positionList) {
                const coord = pos.coordinate;
                const centerX = (coord.left + coord.right) / 2;
                const centerY = (coord.top + coord.bottom) / 2;
                const distance = Math.sqrt(
                    Math.pow(x - centerX, 2) +
                    Math.pow(y - centerY, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    closestPosition = pos;
                }
            }
        }

        return closestPosition;
    }

    /**
     * 인덱스로 위치 정보 가져오기
     * @param {number} index - 위치 인덱스
     * @returns {Object|null} 위치 정보
     */
    getPositionByIndex(index) {
        if (!this.isReady || index < 0 || index >= this.positionList.length) {
            return null;
        }

        return this.positionList[index];
    }

    /**
     * 범위 내 위치들 가져오기
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     * @returns {Array} 위치 정보 배열
     */
    getPositionsInRange(startIndex, endIndex) {
        if (!this.isReady) {
            return [];
        }

        const start = Math.max(0, Math.min(startIndex, endIndex));
        const end = Math.min(this.positionList.length - 1, Math.max(startIndex, endIndex));

        return this.positionList.slice(start, end + 1);
    }

    /**
     * DOM 요소에 해당하는 위치들 가져오기
     * @param {HTMLElement} element - 대상 요소
     * @returns {Array} 위치 정보 배열
     */
    getPositionsByElement(element) {
        if (!this.isReady) {
            return [];
        }

        return this.positionList.filter(pos => {
            return pos.parentElement === element ||
                   pos.parentElement.closest('.hwp-paragraph') === element ||
                   pos.parentElement.closest('td, th') === element;
        });
    }

    /**
     * 텍스트 검색 후 위치 반환
     * @param {string} searchText - 검색할 텍스트
     * @param {boolean} caseSensitive - 대소문자 구분 여부
     * @returns {Array<{startIndex: number, endIndex: number, text: string}>} 검색 결과
     */
    searchText(searchText, caseSensitive = false) {
        if (!this.isReady || !searchText) {
            return [];
        }

        const results = [];
        const fullText = this.positionList.map(pos => pos.value).join('');
        const searchPattern = caseSensitive ? searchText : searchText.toLowerCase();
        const targetText = caseSensitive ? fullText : fullText.toLowerCase();

        let index = 0;
        while ((index = targetText.indexOf(searchPattern, index)) !== -1) {
            results.push({
                startIndex: index,
                endIndex: index + searchText.length - 1,
                text: fullText.substring(index, index + searchText.length)
            });
            index += searchText.length;
        }

        logger.debug(`🔍 Found ${results.length} matches for "${searchText}"`);
        return results;
    }

    /**
     * 위치 정보 하이라이트 (디버깅용)
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     * @param {string} color - 하이라이트 색상
     */
    highlightRange(startIndex, endIndex, color = 'yellow') {
        const positions = this.getPositionsInRange(startIndex, endIndex);

        positions.forEach(pos => {
            if (pos.parentElement) {
                pos.parentElement.style.backgroundColor = color;
            }
        });

        logger.info(`🎨 Highlighted ${positions.length} positions from ${startIndex} to ${endIndex}`);
    }

    /**
     * 하이라이트 제거
     */
    clearHighlight() {
        this.positionList.forEach(pos => {
            if (pos.parentElement) {
                pos.parentElement.style.backgroundColor = '';
            }
        });
    }

    /**
     * 전체 텍스트 추출
     * @returns {string} 전체 텍스트
     */
    getFullText() {
        if (!this.isReady) {
            return '';
        }

        return this.positionList.map(pos => pos.value).join('');
    }

    /**
     * 통계 정보 가져오기
     * @returns {Object} 통계 정보
     */
    getStats() {
        if (!this.isReady) {
            return {
                totalCharacters: 0,
                pages: 0,
                paragraphs: 0,
                tableCells: 0
            };
        }

        const pages = new Set();
        const paragraphs = new Set();
        const tableCells = new Set();

        this.positionList.forEach(pos => {
            pages.add(pos.pageNumber);
            if (pos.paraData) paragraphs.add(pos.paraData);
            if (pos.cellData) tableCells.add(pos.cellData);
        });

        return {
            totalCharacters: this.positionList.length,
            pages: pages.size,
            paragraphs: paragraphs.size,
            tableCells: tableCells.size
        };
    }

    /**
     * 위치 리스트 가져오기
     * @returns {Array} 위치 정보 배열
     */
    getPositionList() {
        return this.positionList;
    }

    /**
     * 준비 상태 확인
     * @returns {boolean} 준비 여부
     */
    isPositionReady() {
        return this.isReady;
    }

    /**
     * 리셋
     */
    reset() {
        this.positionList = [];
        this.isReady = false;
        logger.info('🔄 PositionManager reset');
    }
}

export default PositionManager;
