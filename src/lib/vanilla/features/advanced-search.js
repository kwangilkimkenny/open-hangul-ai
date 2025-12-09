/**
 * Advanced Search - 고급 검색 기능 (정규식 지원)
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Advanced Search 클래스
 */
export class AdvancedSearch {
    constructor(options = {}) {
        this.options = {
            caseSensitive: false,
            wholeWord: false,
            useRegex: false,
            highlightColor: '#ffeb3b',
            ...options
        };
        
        this.results = [];
        this.currentIndex = -1;
        
        logger.info('AdvancedSearch initialized');
    }
    
    /**
     * 검색 실행
     * @param {string} query - 검색어
     * @param {HTMLElement} container - 검색 대상 컨테이너
     * @returns {Array} 검색 결과
     */
    search(query, container) {
        if (!query || !container) {
            return [];
        }
        
        // 이전 하이라이트 제거
        this.clearHighlights();
        
        this.results = [];
        this.currentIndex = -1;
        
        try {
            let searchPattern;
            
            if (this.options.useRegex) {
                // 정규식 모드
                const flags = this.options.caseSensitive ? 'g' : 'gi';
                searchPattern = new RegExp(query, flags);
            } else {
                // 일반 검색
                let escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                if (this.options.wholeWord) {
                    escapedQuery = `\\b${escapedQuery}\\b`;
                }
                
                const flags = this.options.caseSensitive ? 'g' : 'gi';
                searchPattern = new RegExp(escapedQuery, flags);
            }
            
            // 텍스트 노드 순회하며 검색
            this.searchInNode(container, searchPattern);
            
            logger.info(`Search completed: ${this.results.length} results found`);
            
        } catch (error) {
            logger.error(`Search failed: ${error.message}`);
        }
        
        return this.results;
    }
    
    /**
     * 노드에서 검색 (재귀)
     */
    searchInNode(node, pattern) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            const matches = [...text.matchAll(pattern)];
            
            if (matches.length > 0) {
                const parent = node.parentNode;
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                
                matches.forEach((match, i) => {
                    const matchStart = match.index;
                    const matchEnd = matchStart + match[0].length;
                    
                    // 매치 이전 텍스트
                    if (matchStart > lastIndex) {
                        fragment.appendChild(
                            document.createTextNode(text.substring(lastIndex, matchStart))
                        );
                    }
                    
                    // 하이라이트된 매치
                    const highlight = document.createElement('mark');
                    highlight.className = 'search-highlight';
                    highlight.style.backgroundColor = this.options.highlightColor;
                    highlight.style.padding = '2px 0';
                    highlight.setAttribute('data-search-index', this.results.length);
                    highlight.textContent = match[0];
                    fragment.appendChild(highlight);
                    
                    this.results.push({
                        text: match[0],
                        element: highlight,
                        index: this.results.length
                    });
                    
                    lastIndex = matchEnd;
                });
                
                // 매치 이후 남은 텍스트
                if (lastIndex < text.length) {
                    fragment.appendChild(
                        document.createTextNode(text.substring(lastIndex))
                    );
                }
                
                parent.replaceChild(fragment, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // 자식 노드 재귀 검색
            Array.from(node.childNodes).forEach(child => {
                this.searchInNode(child, pattern);
            });
        }
    }
    
    /**
     * 다음 검색 결과로 이동
     */
    next() {
        if (this.results.length === 0) {
            return null;
        }
        
        // 현재 하이라이트 제거
        if (this.currentIndex >= 0 && this.currentIndex < this.results.length) {
            this.results[this.currentIndex].element.classList.remove('current');
        }
        
        // 다음 인덱스
        this.currentIndex = (this.currentIndex + 1) % this.results.length;
        
        const result = this.results[this.currentIndex];
        result.element.classList.add('current');
        result.element.style.backgroundColor = '#ff9800';
        result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        logger.debug(`Navigated to result ${this.currentIndex + 1}/${this.results.length}`);
        
        return result;
    }
    
    /**
     * 이전 검색 결과로 이동
     */
    previous() {
        if (this.results.length === 0) {
            return null;
        }
        
        // 현재 하이라이트 제거
        if (this.currentIndex >= 0 && this.currentIndex < this.results.length) {
            this.results[this.currentIndex].element.classList.remove('current');
        }
        
        // 이전 인덱스
        this.currentIndex = this.currentIndex - 1;
        if (this.currentIndex < 0) {
            this.currentIndex = this.results.length - 1;
        }
        
        const result = this.results[this.currentIndex];
        result.element.classList.add('current');
        result.element.style.backgroundColor = '#ff9800';
        result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        logger.debug(`Navigated to result ${this.currentIndex + 1}/${this.results.length}`);
        
        return result;
    }
    
    /**
     * 하이라이트 제거
     */
    clearHighlights() {
        document.querySelectorAll('.search-highlight').forEach(highlight => {
            const text = document.createTextNode(highlight.textContent);
            highlight.parentNode.replaceChild(text, highlight);
        });
        
        // 인접한 텍스트 노드 병합
        document.querySelectorAll('.hwp-paragraph, .hwp-run').forEach(el => {
            el.normalize();
        });
        
        this.results = [];
        this.currentIndex = -1;
        
        logger.debug('Highlights cleared');
    }
    
    /**
     * 검색 옵션 설정
     */
    setOptions(options) {
        this.options = { ...this.options, ...options };
        logger.debug('Search options updated', this.options);
    }
    
    /**
     * 검색 결과 개수
     */
    getResultCount() {
        return this.results.length;
    }
    
    /**
     * 현재 결과 인덱스
     */
    getCurrentIndex() {
        return this.currentIndex;
    }
}

export default AdvancedSearch;

