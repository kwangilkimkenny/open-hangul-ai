/**
 * SearchManager
 * 텍스트 검색 및 교체 기능 관리
 *
 * @module features/search-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * SearchManager 클래스
 * 문서 내 텍스트 검색, 교체, 하이라이트 관리
 */
export class SearchManager {
  /**
   * SearchManager 생성자
   * @param {Object} viewer - HWPX Viewer 인스턴스
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.positionManager = viewer.positionManager;
    this.rangeManager = viewer.rangeManager;

    // 검색 상태
    this.searchText = '';
    this.searchOptions = {
      caseSensitive: false,
      wholeWord: false,
      useRegex: false,
    };

    // 검색 결과
    this.matches = [];
    this.currentMatchIndex = -1;

    // 하이라이트 요소들
    this.highlightElements = [];

    logger.info('🔍 SearchManager initialized');
  }

  /**
   * 텍스트 찾기
   * @param {string} searchText - 검색할 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {number} 찾은 개수
   */
  find(searchText, options = {}) {
    if (!searchText || searchText.length === 0) {
      this.clearSearch();
      return 0;
    }

    this.searchText = searchText;
    this.searchOptions = {
      caseSensitive: options.caseSensitive || false,
      wholeWord: options.wholeWord || false,
      useRegex: options.useRegex || false,
    };

    // 검색 실행
    this._performSearch();

    // 첫 번째 결과로 이동
    if (this.matches.length > 0) {
      this.currentMatchIndex = 0;
      this._highlightMatches();
      this._scrollToCurrentMatch();
    }

    logger.debug(`🔍 Found ${this.matches.length} matches for "${searchText}"`);
    return this.matches.length;
  }

  /**
   * 다음 찾기
   * @returns {boolean} 성공 여부
   */
  findNext() {
    if (this.matches.length === 0) {
      return false;
    }

    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
    this._highlightMatches();
    this._scrollToCurrentMatch();

    logger.debug(`🔍 Next match: ${this.currentMatchIndex + 1}/${this.matches.length}`);
    return true;
  }

  /**
   * 이전 찾기
   * @returns {boolean} 성공 여부
   */
  findPrevious() {
    if (this.matches.length === 0) {
      return false;
    }

    this.currentMatchIndex =
      (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
    this._highlightMatches();
    this._scrollToCurrentMatch();

    logger.debug(`🔍 Previous match: ${this.currentMatchIndex + 1}/${this.matches.length}`);
    return true;
  }

  /**
   * 검색 실행
   * @private
   */
  _performSearch() {
    this.matches = [];
    this.currentMatchIndex = -1;

    if (!this.positionManager || !this.positionManager.isPositionReady()) {
      logger.warn('⚠️ PositionManager not ready');
      return;
    }

    const positions = this.positionManager.getPositionList();
    if (!positions || positions.length === 0) {
      return;
    }

    // 전체 텍스트 추출
    const fullText = positions.map(p => p.value).join('');

    // 검색 패턴 생성
    let pattern;
    if (this.searchOptions.useRegex) {
      try {
        const flags = this.searchOptions.caseSensitive ? 'g' : 'gi';
        pattern = new RegExp(this.searchText, flags);
      } catch (error) {
        logger.error('❌ Invalid regex pattern:', error);
        return;
      }
    } else {
      const escapedText = this._escapeRegex(this.searchText);
      const wordBoundary = this.searchOptions.wholeWord ? '\\b' : '';
      const flags = this.searchOptions.caseSensitive ? 'g' : 'gi';
      pattern = new RegExp(`${wordBoundary}${escapedText}${wordBoundary}`, flags);
    }

    // 모든 매치 찾기
    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;

      this.matches.push({
        startIndex,
        endIndex,
        text: match[0],
      });

      // 무한 루프 방지 (빈 문자열 매치)
      if (match[0].length === 0) {
        pattern.lastIndex++;
      }
    }
  }

  /**
   * 정규식 특수문자 이스케이프
   * @private
   */
  _escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 매치 하이라이트 표시
   * @private
   */
  _highlightMatches() {
    // 기존 하이라이트 제거
    this._clearHighlights();

    if (this.matches.length === 0) {
      return;
    }

    // 모든 매치 하이라이트
    this.matches.forEach((match, index) => {
      const isCurrent = index === this.currentMatchIndex;
      this._createHighlight(match, isCurrent);
    });
  }

  /**
   * 하이라이트 요소 생성
   * @private
   */
  _createHighlight(match, isCurrent) {
    const positions = this.positionManager.getPositionList();

    // 매치 범위의 모든 position 가져오기
    for (let i = match.startIndex; i < match.endIndex; i++) {
      const position = positions[i];
      if (!position || !position.coordinate) {
        continue;
      }

      const highlight = document.createElement('div');
      highlight.className = isCurrent ? 'hwpx-search-highlight-current' : 'hwpx-search-highlight';
      highlight.style.position = 'absolute';
      highlight.style.pointerEvents = 'none';
      highlight.style.zIndex = '15';

      const container = this.viewer.container;
      const containerRect = container.getBoundingClientRect();

      const coord = position.coordinate;
      const left = coord.left - containerRect.left + container.scrollLeft;
      const top = coord.top - containerRect.top + container.scrollTop;
      const width = coord.width;
      const height = coord.height;

      highlight.style.left = `${left}px`;
      highlight.style.top = `${top}px`;
      highlight.style.width = `${width}px`;
      highlight.style.height = `${height}px`;

      if (isCurrent) {
        highlight.style.backgroundColor = 'rgba(255, 152, 0, 0.4)';
        highlight.style.border = '1px solid #ff9800';
      } else {
        highlight.style.backgroundColor = 'rgba(255, 235, 59, 0.4)';
      }

      container.appendChild(highlight);
      this.highlightElements.push(highlight);
    }
  }

  /**
   * 하이라이트 제거
   * @private
   */
  _clearHighlights() {
    this.highlightElements.forEach(element => {
      if (element && element.parentElement) {
        element.parentElement.removeChild(element);
      }
    });
    this.highlightElements = [];
  }

  /**
   * 현재 매치로 스크롤
   * @private
   */
  _scrollToCurrentMatch() {
    if (this.currentMatchIndex < 0 || this.currentMatchIndex >= this.matches.length) {
      return;
    }

    const match = this.matches[this.currentMatchIndex];
    const positions = this.positionManager.getPositionList();
    const position = positions[match.startIndex];

    if (!position || !position.coordinate) {
      return;
    }

    // 스크롤
    const container = this.viewer.container;
    const coord = position.coordinate;
    const containerRect = container.getBoundingClientRect();

    const targetTop = coord.top - containerRect.top + container.scrollTop;
    const targetLeft = coord.left - containerRect.left + container.scrollLeft;

    // 스크롤 애니메이션
    container.scrollTo({
      top: targetTop - containerRect.height / 2,
      left: targetLeft - containerRect.width / 2,
      behavior: 'smooth',
    });

    // 커서 이동
    if (this.viewer.cursor) {
      this.viewer.cursor.setCursorPosition(match.startIndex);
    }

    // Range 선택
    if (this.rangeManager) {
      this.rangeManager.setRange(match.startIndex, match.endIndex);
    }
  }

  /**
   * 현재 매치 가져오기
   * @returns {Object|null} 현재 매치
   */
  getCurrentMatch() {
    if (this.currentMatchIndex < 0 || this.currentMatchIndex >= this.matches.length) {
      return null;
    }
    return this.matches[this.currentMatchIndex];
  }

  /**
   * 모든 매치 가져오기
   * @returns {Array} 매치 배열
   */
  getMatches() {
    return [...this.matches];
  }

  /**
   * 현재 매치 인덱스 가져오기
   * @returns {number} 현재 인덱스 (0-based)
   */
  getCurrentMatchIndex() {
    return this.currentMatchIndex;
  }

  /**
   * 검색 정보 가져오기
   * @returns {Object} 검색 정보
   */
  getSearchInfo() {
    return {
      searchText: this.searchText,
      options: { ...this.searchOptions },
      matchCount: this.matches.length,
      currentIndex: this.currentMatchIndex,
    };
  }

  /**
   * 검색 초기화
   */
  clearSearch() {
    this.searchText = '';
    this.matches = [];
    this.currentMatchIndex = -1;
    this._clearHighlights();

    // Range 선택 해제
    if (this.rangeManager) {
      this.rangeManager.clearSelection();
    }

    logger.debug('🔍 Search cleared');
  }

  /**
   * 하이라이트 갱신 (문서 변경 시)
   */
  refreshHighlights() {
    if (this.searchText && this.searchText.length > 0) {
      this.find(this.searchText, this.searchOptions);
    }
  }

  // ===========================
  // Replace Methods
  // ===========================

  /**
   * 텍스트 교체 (검색 후 현재 매치 교체)
   * Command 시스템을 통해 history/undo와 연동
   *
   * @param {string} searchTerm - 검색할 텍스트
   * @param {string} replaceWith - 바꿀 텍스트
   * @param {Object} [options] - 검색 옵션
   * @param {boolean} [options.caseSensitive=false] - 대소문자 구분
   * @param {boolean} [options.wholeWord=false] - 전체 단어 일치
   * @param {boolean} [options.useRegex=false] - 정규식 사용
   * @returns {boolean} 성공 여부
   */
  replaceText(searchTerm, replaceWith, options = {}) {
    if (!searchTerm) {
      logger.warn('⚠️ replaceText: searchTerm is empty');
      return false;
    }

    // 현재 검색어와 다르면 새로 검색
    if (this.searchText !== searchTerm || this.matches.length === 0) {
      const count = this.find(searchTerm, options);
      if (count === 0) {
        logger.debug(`⚠️ replaceText: No matches found for "${searchTerm}"`);
        return false;
      }
    }

    // Command 시스템을 통해 교체 (history/undo 연동)
    if (this.viewer.command) {
      const result = this.viewer.command.replace(replaceWith);
      logger.info(`🔄 replaceText: "${searchTerm}" → "${replaceWith}" (${result ? '성공' : '실패'})`);
      return result;
    }

    // Command 시스템이 없으면 직접 DOM 교체 (fallback)
    return this._replaceCurrentMatchInDOM(replaceWith);
  }

  /**
   * 현재 매치 바꾸기 (이미 검색된 상태에서 사용)
   * @param {string} replaceWith - 바꿀 텍스트
   * @returns {boolean} 성공 여부
   */
  replaceNext(replaceWith) {
    const currentMatch = this.getCurrentMatch();
    if (!currentMatch) {
      logger.warn('⚠️ No current match to replace');
      return false;
    }

    // Command 시스템을 통해 교체 (history/undo 연동)
    if (this.viewer.command) {
      return this.viewer.command.replace(replaceWith);
    }

    // Fallback: 직접 DOM 교체
    return this._replaceCurrentMatchInDOM(replaceWith);
  }

  /**
   * 모두 바꾸기
   * Command 시스템을 통해 history/undo와 연동
   *
   * @param {string} searchTerm - 검색할 텍스트
   * @param {string} replaceWith - 바꿀 텍스트
   * @param {Object} [options] - 검색 옵션
   * @param {boolean} [options.caseSensitive=false] - 대소문자 구분
   * @param {boolean} [options.wholeWord=false] - 전체 단어 일치
   * @param {boolean} [options.useRegex=false] - 정규식 사용
   * @returns {number} 바꾼 개수
   */
  replaceAll(searchTerm, replaceWith, options = {}) {
    if (!searchTerm) {
      logger.warn('⚠️ replaceAll: searchTerm is empty');
      return 0;
    }

    // Command 시스템을 통해 모두 교체 (history/undo 연동)
    if (this.viewer.command) {
      const count = this.viewer.command.replaceAll(searchTerm, replaceWith, options);
      logger.info(
        `🔄 replaceAll: "${searchTerm}" → "${replaceWith}" (${count}개 교체)`
      );
      return count;
    }

    // Fallback: 직접 교체
    return this._replaceAllInDOM(searchTerm, replaceWith, options);
  }

  /**
   * 찾아서 바꾸기 (한 번에)
   * @param {string} searchTerm - 검색할 텍스트
   * @param {string} replaceWith - 바꿀 텍스트
   * @param {Object} [options] - 검색 옵션
   * @returns {Object} { found: number, replaced: number }
   */
  findAndReplace(searchTerm, replaceWith, options = {}) {
    const found = this.find(searchTerm, options);

    if (found === 0) {
      return { found: 0, replaced: 0 };
    }

    const replaced = this.replaceAll(searchTerm, replaceWith, options);
    return { found, replaced };
  }

  /**
   * 현재 매치를 DOM에서 직접 교체 (Command 시스템 없을 때 fallback)
   * @private
   * @param {string} replaceWith - 바꿀 텍스트
   * @returns {boolean} 성공 여부
   */
  _replaceCurrentMatchInDOM(replaceWith) {
    const currentMatch = this.getCurrentMatch();
    if (!currentMatch) {
      return false;
    }

    try {
      const result = this._replaceMatchInDOM(currentMatch, replaceWith);
      if (result) {
        logger.info(`🔄 DOM Replace: "${currentMatch.text}" → "${replaceWith}"`);

        // 검색 결과 갱신
        this._performSearch();

        if (this.matches.length > 0) {
          this.currentMatchIndex = Math.min(this.currentMatchIndex, this.matches.length - 1);
          this._highlightMatches();
          this._scrollToCurrentMatch();
        } else {
          this._clearHighlights();
        }

        return true;
      }
    } catch (error) {
      logger.error('❌ _replaceCurrentMatchInDOM failed:', error);
    }
    return false;
  }

  /**
   * 모든 매치를 DOM에서 직접 교체 (Command 시스템 없을 때 fallback)
   * @private
   * @param {string} searchTerm - 검색할 텍스트
   * @param {string} replaceWith - 바꿀 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {number} 교체된 개수
   */
  _replaceAllInDOM(searchTerm, replaceWith, options = {}) {
    const count = this.find(searchTerm, options);
    if (count === 0) {
      return 0;
    }

    let replacedCount = 0;

    // 역순으로 교체 (인덱스 유지를 위해)
    const matchesCopy = [...this.matches].reverse();

    for (const match of matchesCopy) {
      const result = this._replaceMatchInDOM(match, replaceWith);
      if (result) {
        replacedCount++;
      }
    }

    logger.info(
      `🔄 DOM Replace All: ${replacedCount} occurrences of "${searchTerm}" → "${replaceWith}"`
    );

    this.clearSearch();
    return replacedCount;
  }

  /**
   * DOM에서 매치된 텍스트 교체
   * @private
   */
  _replaceMatchInDOM(match, replaceWith) {
    try {
      const positions = this.positionManager.getPositionList();
      if (!positions || positions.length === 0) {
        return false;
      }

      // 첫 번째 매치 위치의 element 찾기
      const startPosition = positions[match.startIndex];
      if (!startPosition || !startPosition.element) {
        return this._replaceTextInContainer(match.text, replaceWith);
      }

      // 요소가 텍스트 노드인 경우
      const element = startPosition.element;
      if (element.nodeType === Node.TEXT_NODE) {
        const textContent = element.textContent;
        const index = textContent.indexOf(match.text);
        if (index !== -1) {
          element.textContent =
            textContent.substring(0, index) +
            replaceWith +
            textContent.substring(index + match.text.length);
          return true;
        }
      }

      // 요소가 Element인 경우
      if (element.nodeType === Node.ELEMENT_NODE) {
        const textContent = element.textContent;
        const index = textContent.indexOf(match.text);
        if (index !== -1) {
          element.innerHTML = element.innerHTML.replace(match.text, replaceWith);
          return true;
        }
      }

      // Fallback: container에서 교체
      return this._replaceTextInContainer(match.text, replaceWith);
    } catch (error) {
      logger.error('❌ _replaceMatchInDOM error:', error);
      return false;
    }
  }

  /**
   * 컨테이너 내 텍스트 교체 (Fallback)
   * @private
   */
  _replaceTextInContainer(searchText, replaceWith) {
    const container = this.viewer.container;
    if (!container) return false;

    // TreeWalker를 사용하여 텍스트 노드 순회
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);

    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.includes(searchText)) {
        node.textContent = node.textContent.replace(searchText, replaceWith);
        return true;
      }
    }

    return false;
  }

  /**
   * 정리
   */
  destroy() {
    this.clearSearch();
    logger.info('🗑️ SearchManager destroyed');
  }
}

export default SearchManager;
