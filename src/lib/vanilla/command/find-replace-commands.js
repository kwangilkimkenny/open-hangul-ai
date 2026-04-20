/**
 * Find/Replace Commands Module
 * 검색 및 치환 명령
 *
 * @module command/find-replace-commands
 * @version 1.0.0
 * @author Kwang-il Kim (김광일) <yatav@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 검색/치환 명령 클래스
 */
export class FindReplaceCommands {
  constructor(viewer) {
    this.viewer = viewer;
    this.historyManager = viewer.historyManager;
    this.positionManager = viewer.positionManager;

    // 내장 검색 상태
    this.searchState = {
      query: '',
      options: {},
      matches: [],
      currentIndex: -1,
      isActive: false,
    };
  }

  /**
   * Find - 텍스트 찾기
   * @param {string} searchText - 검색할 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {number} 찾은 개수
   */
  executeFind(searchText, options = {}) {
    try {
      if (!searchText) {
        logger.warn('No search text provided');
        return 0;
      }

      // SearchManager가 있으면 사용, 없으면 내장 검색 사용
      if (this.viewer.searchManager) {
        const count = this.viewer.searchManager.find(searchText, options);
        logger.debug(`Find: "${searchText}" - ${count} matches`);
        return count;
      }

      // 내장 검색 실행
      const count = this._performInternalSearch(searchText, options);
      logger.debug(`Find (internal): "${searchText}" - ${count} matches`);
      return count;
    } catch (error) {
      logger.error('Failed to execute find', error);
      return 0;
    }
  }

  /**
   * Find Next - 다음 찾기
   * @returns {boolean} 성공 여부
   */
  executeFindNext() {
    try {
      if (this.viewer.searchManager) {
        return this.viewer.searchManager.findNext();
      }

      // 내장 검색에서 다음 매치로 이동
      if (this.searchState.matches.length === 0) {
        return false;
      }

      this.searchState.currentIndex =
        (this.searchState.currentIndex + 1) % this.searchState.matches.length;
      this._highlightCurrentMatch();
      return true;
    } catch (error) {
      logger.error('Failed to find next', error);
      return false;
    }
  }

  /**
   * Find Previous - 이전 찾기
   * @returns {boolean} 성공 여부
   */
  executeFindPrevious() {
    try {
      if (this.viewer.searchManager) {
        return this.viewer.searchManager.findPrevious();
      }

      // 내장 검색에서 이전 매치로 이동
      if (this.searchState.matches.length === 0) {
        return false;
      }

      this.searchState.currentIndex =
        this.searchState.currentIndex <= 0
          ? this.searchState.matches.length - 1
          : this.searchState.currentIndex - 1;
      this._highlightCurrentMatch();
      return true;
    } catch (error) {
      logger.error('Failed to find previous', error);
      return false;
    }
  }

  /**
   * Replace - 현재 매치 교체
   * @param {string} replaceText - 교체할 텍스트
   * @returns {boolean} 성공 여부
   */
  executeReplace(replaceText) {
    try {
      if (this.viewer.searchManager) {
        return this._replaceWithSearchManager(replaceText);
      }

      return this._replaceWithInternalSearch(replaceText);
    } catch (error) {
      logger.error('Failed to replace', error);
      return false;
    }
  }

  /**
   * Replace All - 모두 교체
   * @param {string} searchText - 검색할 텍스트
   * @param {string} replaceText - 교체할 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {number} 교체된 개수
   */
  executeReplaceAll(searchText, replaceText, options = {}) {
    try {
      if (!searchText) {
        logger.warn('No search text provided');
        return 0;
      }

      if (this.viewer.searchManager) {
        return this._replaceAllWithSearchManager(searchText, replaceText, options);
      }

      return this._replaceAllWithInternalSearch(searchText, replaceText, options);
    } catch (error) {
      logger.error('Failed to replace all', error);
      return 0;
    }
  }

  /**
   * Clear Search - 검색 초기화
   */
  executeClearSearch() {
    try {
      if (this.viewer.searchManager) {
        this.viewer.searchManager.clear();
      }

      this._clearInternalSearch();
      logger.debug('Search cleared');
    } catch (error) {
      logger.error('Failed to clear search', error);
    }
  }

  /**
   * SearchManager를 사용한 교체
   * @private
   */
  _replaceWithSearchManager(replaceText) {
    const currentMatch = this.viewer.searchManager.getCurrentMatch();
    if (!currentMatch) {
      logger.debug('No current match to replace');
      return false;
    }

    // 이전 상태 저장
    const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
    const cursor = this.viewer.cursor;
    const oldCursorIndex = cursor ? cursor.getCursorIndex() : -1;

    const execute = () => {
      // 매치 범위 삭제
      this._deleteSelectedRange(currentMatch.startIndex, currentMatch.endIndex);

      // 교체 텍스트 삽입
      const position = this.positionManager.getPositionByIndex(currentMatch.startIndex);
      if (position) {
        if (position.cellData) {
          this._insertTextIntoCell(position.cellData, position, replaceText);
        } else if (position.paraData) {
          this._insertTextIntoParagraph(position.paraData, position, replaceText);
        }
      }

      // DOM 업데이트 및 재렌더링
      this.viewer.updateDocument(this.viewer.getDocument());

      // 위치 정보 재계산
      this.positionManager.computePositions(this.viewer.container).then(() => {
        // 커서를 교체된 텍스트 끝으로 이동
        if (cursor) {
          cursor.setCursorPosition(currentMatch.startIndex + replaceText.length);
        }

        // 검색 하이라이트 갱신
        if (this.viewer.searchManager) {
          this.viewer.searchManager.refreshHighlights();
        }
      });

      logger.debug(`Replaced: "${currentMatch.text}" → "${replaceText}"`);
    };

    const undo = () => {
      // 이전 문서로 복원
      this.viewer.updateDocument(oldDocument);

      // 위치 정보 재계산
      this.positionManager.computePositions(this.viewer.container).then(() => {
        // 커서 위치 복원
        if (cursor && oldCursorIndex >= 0) {
          cursor.setCursorPosition(oldCursorIndex);
        }

        // 검색 하이라이트 갱신
        if (this.viewer.searchManager) {
          this.viewer.searchManager.refreshHighlights();
        }
      });

      logger.debug('Undone replace');
      return execute;
    };

    this.historyManager.execute(execute, undo, 'Replace');
    return true;
  }

  /**
   * SearchManager를 사용한 전체 교체
   * @private
   */
  _replaceAllWithSearchManager(searchText, replaceText, options) {
    // 먼저 검색 실행
    const count = this.viewer.searchManager.find(searchText, options);
    if (count === 0) {
      logger.debug('No matches to replace');
      return 0;
    }

    // 이전 상태 저장
    const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

    const execute = () => {
      const matches = this.viewer.searchManager.getAllMatches();
      let replacedCount = 0;

      // 역순으로 교체 (인덱스 변화 방지)
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        this._replaceMatch(match, replaceText);
        replacedCount++;
      }

      // DOM 업데이트 및 재렌더링
      this.viewer.updateDocument(this.viewer.getDocument());

      // 검색 하이라이트 갱신
      if (this.viewer.searchManager) {
        this.viewer.searchManager.refreshHighlights();
      }

      logger.debug(`Replace all: ${replacedCount} matches replaced`);
      return replacedCount;
    };

    const undo = () => {
      // 이전 문서로 복원
      this.viewer.updateDocument(oldDocument);

      // 검색 하이라이트 갱신
      if (this.viewer.searchManager) {
        this.viewer.searchManager.refreshHighlights();
      }

      logger.debug('Undone replace all');
      return execute;
    };

    const result = this.historyManager.execute(execute, undo, `Replace All (${count} matches)`);
    return result || count;
  }

  /**
   * 내장 검색 실행
   * @private
   */
  _performInternalSearch(searchText, options) {
    this.searchState.query = searchText;
    this.searchState.options = options;
    this.searchState.matches = [];
    this.searchState.currentIndex = -1;

    const document = this.viewer.getDocument();
    if (!document) {
      return 0;
    }

    const caseSensitive = options.caseSensitive !== false;
    const wholeWord = options.wholeWord === true;
    const regex = options.regex === true;

    let searchPattern;
    if (regex) {
      try {
        searchPattern = new RegExp(searchText, caseSensitive ? 'g' : 'gi');
      } catch (error) {
        logger.warn('Invalid regex pattern', error);
        return 0;
      }
    } else {
      const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escapedText}\\b` : escapedText;
      searchPattern = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }

    // 문서 전체 텍스트에서 매치 찾기
    const allText = this._extractAllTextFromDocument(document);
    let match;
    while ((match = searchPattern.exec(allText)) !== null) {
      this.searchState.matches.push({
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        text: match[0],
      });
    }

    this.searchState.isActive = this.searchState.matches.length > 0;
    if (this.searchState.isActive) {
      this.searchState.currentIndex = 0;
      this._highlightAllMatches();
    }

    return this.searchState.matches.length;
  }

  /**
   * 내장 검색으로 교체
   * @private
   */
  _replaceWithInternalSearch(replaceText) {
    if (!this.searchState.isActive || this.searchState.currentIndex < 0) {
      return false;
    }

    const currentMatch = this.searchState.matches[this.searchState.currentIndex];
    if (!currentMatch) {
      return false;
    }

    // 이전 상태 저장
    const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

    const execute = () => {
      this._replaceMatch(currentMatch, replaceText);

      // DOM 업데이트
      this.viewer.updateDocument(this.viewer.getDocument());

      // 매치 목록 업데이트 (교체된 텍스트로 인한 인덱스 변화 반영)
      this._updateMatchIndices(currentMatch, replaceText);

      logger.debug(`Replaced: "${currentMatch.text}" → "${replaceText}"`);
    };

    const undo = () => {
      this.viewer.updateDocument(oldDocument);
      // 검색 상태도 복원해야 함
      this._performInternalSearch(this.searchState.query, this.searchState.options);
    };

    this.historyManager.execute(execute, undo, 'Replace');
    return true;
  }

  /**
   * 내장 검색으로 전체 교체
   * @private
   */
  _replaceAllWithInternalSearch(searchText, replaceText, options) {
    const count = this._performInternalSearch(searchText, options);
    if (count === 0) {
      return 0;
    }

    // 이전 상태 저장
    const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

    const execute = () => {
      let replacedCount = 0;

      // 역순으로 교체 (인덱스 변화 방지)
      for (let i = this.searchState.matches.length - 1; i >= 0; i--) {
        const match = this.searchState.matches[i];
        this._replaceMatch(match, replaceText);
        replacedCount++;
      }

      // DOM 업데이트
      this.viewer.updateDocument(this.viewer.getDocument());

      logger.debug(`Replace all: ${replacedCount} matches replaced`);
      return replacedCount;
    };

    const undo = () => {
      this.viewer.updateDocument(oldDocument);
      // 검색 상태도 복원
      this._performInternalSearch(searchText, options);
    };

    const result = this.historyManager.execute(execute, undo, `Replace All (${count} matches)`);
    return result || count;
  }

  /**
   * 문서에서 모든 텍스트 추출
   * @private
   */
  _extractAllTextFromDocument(document) {
    let allText = '';

    if (document.pages) {
      for (const page of document.pages) {
        if (page.sections) {
          for (const section of page.sections) {
            if (section.paragraphs) {
              for (const para of section.paragraphs) {
                if (para.runs) {
                  for (const run of para.runs) {
                    if (run.text) {
                      allText += run.text;
                    }
                  }
                }
                allText += '\n';
              }
            }
          }
        }
      }
    }

    return allText;
  }

  /**
   * 모든 매치 하이라이트
   * @private
   */
  _highlightAllMatches() {
    // 실제 구현에서는 DOM에 하이라이트 추가
    logger.debug(`Highlighting ${this.searchState.matches.length} matches`);
  }

  /**
   * 현재 매치 하이라이트
   * @private
   */
  _highlightCurrentMatch() {
    if (
      this.searchState.currentIndex >= 0 &&
      this.searchState.currentIndex < this.searchState.matches.length
    ) {
      const currentMatch = this.searchState.matches[this.searchState.currentIndex];
      logger.debug(
        `Highlighting current match: ${currentMatch.text} at ${currentMatch.startIndex}`
      );

      // 커서를 매치 위치로 이동
      if (this.viewer.cursor) {
        this.viewer.cursor.setCursorPosition(currentMatch.startIndex);
      }
    }
  }

  /**
   * 내장 검색 초기화
   * @private
   */
  _clearInternalSearch() {
    this.searchState = {
      query: '',
      options: {},
      matches: [],
      currentIndex: -1,
      isActive: false,
    };
  }

  /**
   * 매치 교체 (내부 메서드)
   * @private
   */
  _replaceMatch(match, replaceText) {
    const position = this.positionManager.getPositionByIndex(match.startIndex);
    if (!position) {
      return;
    }

    // 기존 텍스트 삭제
    this._deleteSelectedRange(match.startIndex, match.endIndex);

    // 새 텍스트 삽입
    if (position.cellData) {
      this._insertTextIntoCell(position.cellData, position, replaceText);
    } else if (position.paraData) {
      this._insertTextIntoParagraph(position.paraData, position, replaceText);
    }
  }

  /**
   * 매치 인덱스 업데이트 (교체 후)
   * @private
   */
  _updateMatchIndices(replacedMatch, replaceText) {
    const lengthDiff = replaceText.length - replacedMatch.text.length;

    for (let i = 0; i < this.searchState.matches.length; i++) {
      const match = this.searchState.matches[i];
      if (match.startIndex > replacedMatch.endIndex) {
        match.startIndex += lengthDiff;
        match.endIndex += lengthDiff;
      }
    }
  }

  // 헬퍼 메서드들 (ClipboardCommands에서 재사용)
  _deleteSelectedRange(startIndex, endIndex) {
    // 범위 내의 모든 위치 가져오기
    for (let i = endIndex - 1; i >= startIndex; i--) {
      const position = this.positionManager.getPositionByIndex(i);
      if (position) {
        if (position.cellData) {
          this._deleteCharFromCell(position.cellData, position);
        } else if (position.paraData) {
          this._deleteCharFromParagraph(position.paraData, position);
        }
      }
    }
  }

  _insertTextIntoCell(cellData, position, text) {
    if (!cellData.paragraphs) {
      cellData.paragraphs = [];
    }

    if (cellData.paragraphs.length === 0) {
      cellData.paragraphs.push({ runs: [] });
    }

    const para = cellData.paragraphs[position.paraIndex || 0];
    if (!para.runs) {
      para.runs = [];
    }

    const runIndex = position.runIndex || 0;
    const charIndex = position.charIndex || 0;

    if (runIndex >= para.runs.length) {
      para.runs.push({ text: text, formatting: {} });
    } else {
      const run = para.runs[runIndex];
      const beforeText = run.text.substring(0, charIndex);
      const afterText = run.text.substring(charIndex);
      run.text = beforeText + text + afterText;
    }
  }

  _insertTextIntoParagraph(paraData, position, text) {
    if (!paraData.runs) {
      paraData.runs = [];
    }

    const runIndex = position.runIndex || 0;
    const charIndex = position.charIndex || 0;

    if (runIndex >= paraData.runs.length) {
      paraData.runs.push({ text: text, formatting: {} });
    } else {
      const run = paraData.runs[runIndex];
      const beforeText = run.text.substring(0, charIndex);
      const afterText = run.text.substring(charIndex);
      run.text = beforeText + text + afterText;
    }
  }

  _deleteCharFromCell(cellData, position) {
    if (!cellData.paragraphs || cellData.paragraphs.length === 0) {
      return;
    }

    const para = cellData.paragraphs[position.paraIndex || 0];
    if (!para || !para.runs || para.runs.length === 0) {
      return;
    }

    const run = para.runs[position.runIndex || 0];
    if (!run || !run.text) {
      return;
    }

    const charIndex = position.charIndex || 0;
    if (charIndex < run.text.length) {
      run.text = run.text.substring(0, charIndex) + run.text.substring(charIndex + 1);
    }
  }

  _deleteCharFromParagraph(paraData, position) {
    if (!paraData.runs || paraData.runs.length === 0) {
      return;
    }

    const run = paraData.runs[position.runIndex || 0];
    if (!run || !run.text) {
      return;
    }

    const charIndex = position.charIndex || 0;
    if (charIndex < run.text.length) {
      run.text = run.text.substring(0, charIndex) + run.text.substring(charIndex + 1);
    }
  }

  /**
   * 검색 상태 가져오기
   */
  getSearchState() {
    return { ...this.searchState };
  }

  /**
   * 현재 매치 가져오기
   */
  getCurrentMatch() {
    if (
      this.searchState.currentIndex >= 0 &&
      this.searchState.currentIndex < this.searchState.matches.length
    ) {
      return this.searchState.matches[this.searchState.currentIndex];
    }
    return null;
  }

  /**
   * 검색이 활성화되었는지 확인
   */
  isSearchActive() {
    return this.searchState.isActive;
  }

  /**
   * 매치 개수 가져오기
   */
  getMatchCount() {
    return this.searchState.matches.length;
  }
}

export default FindReplaceCommands;
