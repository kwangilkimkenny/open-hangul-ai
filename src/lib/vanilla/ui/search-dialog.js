/**
 * SearchDialog
 * 찾기/바꾸기 다이얼로그 UI
 *
 * @module ui/search-dialog
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * SearchDialog 클래스
 * 찾기 및 바꾸기 기능의 UI 제공
 */
export class SearchDialog {
    /**
     * SearchDialog 생성자
     * @param {Object} viewer - HWPX Viewer 인스턴스
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.isVisible = false;
        this.mode = 'find'; // 'find' or 'replace'

        // DOM 요소
        this.dialogElement = null;
        this.searchInput = null;
        this.replaceInput = null;
        this.matchCount = null;
        this.currentMatchInfo = null;

        this._createDialog();

        logger.info('🔍 SearchDialog initialized');
    }

    /**
     * 다이얼로그 생성
     * @private
     */
    _createDialog() {
        // 다이얼로그 컨테이너
        this.dialogElement = document.createElement('div');
        this.dialogElement.className = 'hwpx-search-dialog';
        this.dialogElement.style.display = 'none';

        this.dialogElement.innerHTML = `
            <div class="hwpx-search-dialog-header">
                <div class="hwpx-search-dialog-tabs">
                    <button class="hwpx-search-tab active" data-tab="find">찾기</button>
                    <button class="hwpx-search-tab" data-tab="replace">바꾸기</button>
                </div>
                <button class="hwpx-search-close">×</button>
            </div>
            <div class="hwpx-search-dialog-body">
                <div class="hwpx-search-input-group">
                    <input type="text" class="hwpx-search-input" placeholder="찾을 내용" />
                    <div class="hwpx-search-match-info"></div>
                </div>
                <div class="hwpx-replace-input-group" style="display: none;">
                    <input type="text" class="hwpx-replace-input" placeholder="바꿀 내용" />
                </div>
                <div class="hwpx-search-options">
                    <label><input type="checkbox" class="hwpx-option-case" /> 대소문자 구분</label>
                    <label><input type="checkbox" class="hwpx-option-word" /> 전체 단어 일치</label>
                    <label><input type="checkbox" class="hwpx-option-regex" /> 정규식 사용</label>
                </div>
                <div class="hwpx-search-actions">
                    <button class="hwpx-btn hwpx-btn-find">찾기</button>
                    <button class="hwpx-btn hwpx-btn-find-prev">이전</button>
                    <button class="hwpx-btn hwpx-btn-find-next">다음</button>
                    <button class="hwpx-btn hwpx-btn-replace" style="display: none;">교체</button>
                    <button class="hwpx-btn hwpx-btn-replace-all" style="display: none;">모두 교체</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.dialogElement);

        // 요소 참조 저장
        this.searchInput = this.dialogElement.querySelector('.hwpx-search-input');
        this.replaceInput = this.dialogElement.querySelector('.hwpx-replace-input');
        this.matchInfo = this.dialogElement.querySelector('.hwpx-search-match-info');

        // 이벤트 리스너 등록
        this._setupEventListeners();
    }

    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // 탭 전환
        this.dialogElement.querySelectorAll('.hwpx-search-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.tab;
                this.setMode(mode);
            });
        });

        // 닫기 버튼
        this.dialogElement.querySelector('.hwpx-search-close').addEventListener('click', () => {
            this.hide();
        });

        // 찾기 버튼
        this.dialogElement.querySelector('.hwpx-btn-find').addEventListener('click', () => {
            this._handleFind();
        });

        // 이전 버튼
        this.dialogElement.querySelector('.hwpx-btn-find-prev').addEventListener('click', () => {
            this._handleFindPrevious();
        });

        // 다음 버튼
        this.dialogElement.querySelector('.hwpx-btn-find-next').addEventListener('click', () => {
            this._handleFindNext();
        });

        // 교체 버튼
        this.dialogElement.querySelector('.hwpx-btn-replace').addEventListener('click', () => {
            this._handleReplace();
        });

        // 모두 교체 버튼
        this.dialogElement.querySelector('.hwpx-btn-replace-all').addEventListener('click', () => {
            this._handleReplaceAll();
        });

        // Enter 키로 찾기
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) {
                    this._handleFindPrevious();
                } else {
                    this._handleFindNext();
                }
                e.preventDefault();
            }
        });

        // 실시간 검색
        this.searchInput.addEventListener('input', () => {
            if (this.searchInput.value.length > 0) {
                this._handleFind();
            } else {
                this._clearSearch();
            }
        });

        // ESC 키로 닫기
        this.dialogElement.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
                e.preventDefault();
            }
        });
    }

    /**
     * 찾기 처리
     * @private
     */
    _handleFind() {
        const searchText = this.searchInput.value;
        if (!searchText) {
            return;
        }

        const options = this._getSearchOptions();
        const count = this.viewer.command.find(searchText, options);

        this._updateMatchInfo();
        logger.debug(`🔍 Found ${count} matches`);
    }

    /**
     * 다음 찾기 처리
     * @private
     */
    _handleFindNext() {
        if (!this.searchInput.value) {
            return;
        }

        if (!this.viewer.searchManager || this.viewer.searchManager.getMatches().length === 0) {
            this._handleFind();
        } else {
            this.viewer.command.findNext();
            this._updateMatchInfo();
        }
    }

    /**
     * 이전 찾기 처리
     * @private
     */
    _handleFindPrevious() {
        if (!this.searchInput.value) {
            return;
        }

        if (!this.viewer.searchManager || this.viewer.searchManager.getMatches().length === 0) {
            this._handleFind();
        } else {
            this.viewer.command.findPrevious();
            this._updateMatchInfo();
        }
    }

    /**
     * 교체 처리
     * @private
     */
    _handleReplace() {
        const replaceText = this.replaceInput.value;
        const success = this.viewer.command.replace(replaceText);

        if (success) {
            // 다음 매치로 자동 이동
            this._handleFindNext();
        }
    }

    /**
     * 모두 교체 처리
     * @private
     */
    _handleReplaceAll() {
        const searchText = this.searchInput.value;
        const replaceText = this.replaceInput.value;

        if (!searchText) {
            return;
        }

        const options = this._getSearchOptions();
        const count = this.viewer.command.replaceAll(searchText, replaceText, options);

        this._updateMatchInfo();
        logger.debug(`🔄 Replaced ${count} occurrences`);
    }

    /**
     * 검색 옵션 가져오기
     * @private
     */
    _getSearchOptions() {
        return {
            caseSensitive: this.dialogElement.querySelector('.hwpx-option-case').checked,
            wholeWord: this.dialogElement.querySelector('.hwpx-option-word').checked,
            useRegex: this.dialogElement.querySelector('.hwpx-option-regex').checked
        };
    }

    /**
     * 매치 정보 업데이트
     * @private
     */
    _updateMatchInfo() {
        if (!this.viewer.searchManager) {
            return;
        }

        const info = this.viewer.searchManager.getSearchInfo();

        if (info.matchCount === 0) {
            this.matchInfo.textContent = '검색 결과 없음';
            this.matchInfo.style.color = '#999';
        } else {
            this.matchInfo.textContent = `${info.currentIndex + 1} / ${info.matchCount}`;
            this.matchInfo.style.color = '#333';
        }
    }

    /**
     * 검색 초기화
     * @private
     */
    _clearSearch() {
        this.viewer.command.clearSearch();
        this.matchInfo.textContent = '';
    }

    /**
     * 모드 설정
     * @param {string} mode - 'find' 또는 'replace'
     */
    setMode(mode) {
        this.mode = mode;

        // 탭 활성화
        this.dialogElement.querySelectorAll('.hwpx-search-tab').forEach(tab => {
            if (tab.dataset.tab === mode) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // UI 표시/숨김
        const replaceGroup = this.dialogElement.querySelector('.hwpx-replace-input-group');
        const replaceBtn = this.dialogElement.querySelector('.hwpx-btn-replace');
        const replaceAllBtn = this.dialogElement.querySelector('.hwpx-btn-replace-all');

        if (mode === 'replace') {
            replaceGroup.style.display = 'block';
            replaceBtn.style.display = 'inline-block';
            replaceAllBtn.style.display = 'inline-block';
        } else {
            replaceGroup.style.display = 'none';
            replaceBtn.style.display = 'none';
            replaceAllBtn.style.display = 'none';
        }
    }

    /**
     * 다이얼로그 표시
     * @param {string} mode - 'find' 또는 'replace'
     */
    show(mode = 'find') {
        this.setMode(mode);
        this.dialogElement.style.display = 'block';
        this.isVisible = true;

        // 검색 입력에 포커스
        this.searchInput.focus();
        this.searchInput.select();

        logger.debug('🔍 Search dialog shown');
    }

    /**
     * 다이얼로그 숨김
     */
    hide() {
        this.dialogElement.style.display = 'none';
        this.isVisible = false;

        // 검색 초기화
        this._clearSearch();

        logger.debug('🔍 Search dialog hidden');
    }

    /**
     * 토글
     * @param {string} mode - 'find' 또는 'replace'
     */
    toggle(mode = 'find') {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(mode);
        }
    }

    /**
     * 정리
     */
    destroy() {
        if (this.dialogElement && this.dialogElement.parentElement) {
            this.dialogElement.parentElement.removeChild(this.dialogElement);
        }

        this.dialogElement = null;
        logger.info('🗑️ SearchDialog destroyed');
    }
}

export default SearchDialog;
