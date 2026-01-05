/**
 * Edit Mode Manager
 * 글로벌 편집 모드 토글 및 관리
 * 
 * @module features/edit-mode-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('EditModeManager');

/**
 * 편집 모드 관리자 클래스
 */
export class EditModeManager {
    constructor(inlineEditor) {
        this.inlineEditor = inlineEditor;
        this.isGlobalEditMode = true;  // ✅ 기본값을 true로 변경: 편집 모드를 기본으로 활성화

        this._init();
        logger.info('📝 EditModeManager initialized (편집 모드 기본 활성화)');
    }

    /**
     * 초기화
     * @private
     */
    _init() {
        // UI 생성
        this._createToggleUI();

        // 이벤트 리스너 등록
        this._attachEventListeners();
    }

    /**
     * 토글 UI 생성
     * @private
     */
    _createToggleUI() {
        // 이미 있으면 생성하지 않음
        if (document.getElementById('edit-mode-toggle-container')) {
            return;
        }

        const container = document.createElement('div');
        container.id = 'edit-mode-toggle-container';
        container.className = 'editing-mode-toggle';
        container.style.display = 'none';  // 임시로 숨김 (편집 모드는 항상 ON)
        // ✅ 초기 상태를 ON으로 표시 (isGlobalEditMode = true에 맞춤)
        container.innerHTML = `
            <button id="toggle-edit-mode" class="btn btn-primary active">
                <span class="icon">✏️</span>
                <span class="text">편집 모드: ON</span>
            </button>
        `;

        document.body.appendChild(container);

        // ✅ 초기 상태 적용 (편집 모드가 기본으로 활성화되어 있으므로)
        document.body.classList.add('global-edit-mode');
        this._highlightEditableElements(true);
        this._toggleEditableCursor(true);
        this._showEditingGuide();

        logger.debug('✅ Toggle UI created (초기 상태: ON)');
    }

    /**
     * 이벤트 리스너 등록
     * @private
     */
    _attachEventListeners() {
        const toggleBtn = document.getElementById('toggle-edit-mode');
        if (!toggleBtn) {
            logger.error('❌ Toggle button not found');
            return;
        }

        // 버튼 클릭
        toggleBtn.addEventListener('click', () => {
            this.toggleGlobalEditMode();
        });

        // 키보드 단축키: Ctrl/Cmd + E
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.toggleGlobalEditMode();
            }
        });

        logger.debug('✅ Event listeners attached');
    }

    /**
     * 글로벌 편집 모드 토글 (v2.1.0: 편집 불가 상태 강화)
     */
    toggleGlobalEditMode() {
        this.isGlobalEditMode = !this.isGlobalEditMode;

        const toggleBtn = document.getElementById('toggle-edit-mode');
        const textSpan = toggleBtn?.querySelector('.text');

        if (!toggleBtn || !textSpan) {
            logger.error('❌ Toggle button elements not found');
            return;
        }

        if (this.isGlobalEditMode) {
            // 편집 모드 활성화
            document.body.classList.add('global-edit-mode');
            toggleBtn.classList.add('active');
            textSpan.textContent = '편집 모드: ON';

            logger.info('✅ Global edit mode: ON');

            // 모든 편집 가능한 요소 강조
            this._highlightEditableElements(true);

            // ✅ v2.1.0: 편집 가능 커서 스타일 활성화
            this._toggleEditableCursor(true);

            // 편집 가이드 표시
            this._showEditingGuide();
        } else {
            // 편집 모드 비활성화
            document.body.classList.remove('global-edit-mode');
            toggleBtn.classList.remove('active');
            textSpan.textContent = '편집 모드: OFF';

            // 현재 편집 중이면 저장
            if (this.inlineEditor.isEditing()) {
                this.inlineEditor.saveChanges(true);
            }

            logger.info('✅ Global edit mode: OFF');

            // 강조 제거
            this._highlightEditableElements(false);

            // ✅ v2.1.0: 편집 불가 커서 스타일 비활성화
            this._toggleEditableCursor(false);

            // 편집 가이드 제거
            this._hideEditingGuide();
        }
    }

    /**
     * 편집 가능한 요소 강조/해제
     * @param {boolean} highlight - 강조 여부
     * @private
     */
    _highlightEditableElements(highlight) {
        const editableElements = document.querySelectorAll(
            'td[title*="편집"], th[title*="편집"], .hwp-paragraph:not(.hwp-table .hwp-paragraph)[title*="편집"]'
        );

        editableElements.forEach(el => {
            if (highlight) {
                el.classList.add('edit-mode-highlight');
            } else {
                el.classList.remove('edit-mode-highlight');
            }
        });
    }

    /**
     * 편집 모드 상태 확인
     * @returns {boolean}
     */
    isEditMode() {
        return this.isGlobalEditMode;
    }

    /**
     * 편집 모드 강제 설정
     * @param {boolean} enabled - 편집 모드 활성화 여부
     */
    setEditMode(enabled) {
        if (this.isGlobalEditMode !== enabled) {
            this.toggleGlobalEditMode();
        }
    }

    /**
     * 편집 가이드 표시
     * @private
     */
    _showEditingGuide() {
        // 이미 있으면 표시하지 않음
        if (document.getElementById('editing-guide')) {
            return;
        }

        const guide = document.createElement('div');
        guide.id = 'editing-guide';
        guide.className = 'editing-guide';
        guide.innerHTML = `
            <div class="guide-content">
                <div class="guide-item">
                    <kbd>Tab</kbd> <span>다음</span>
                </div>
                <div class="guide-item">
                    <kbd>Shift+Tab</kbd> <span>이전</span>
                </div>
                <div class="guide-item">
                    <kbd>Enter</kbd> <span>저장 후 다음</span>
                </div>
                <div class="guide-item">
                    <kbd>Esc</kbd> <span>종료</span>
                </div>
                <div class="guide-item">
                    <kbd>↑↓←→</kbd> <span>이동</span>
                </div>
            </div>
        `;

        document.body.appendChild(guide);
        logger.debug('✅ Editing guide shown');
    }

    /**
     * 편집 가이드 제거
     * @private
     */
    _hideEditingGuide() {
        const guide = document.getElementById('editing-guide');
        if (guide) {
            guide.remove();
            logger.debug('✅ Editing guide hidden');
        }
    }

    /**
     * 편집 가능한 요소의 커서 스타일 토글 (v2.1.0)
     * @param {boolean} enabled - 편집 가능 상태
     * @private
     */
    _toggleEditableCursor(enabled) {
        // 테이블 셀
        const cells = document.querySelectorAll('td[data-editable="true"], th[data-editable="true"]');
        // 일반 단락
        const paragraphs = document.querySelectorAll('.editable-paragraph');

        const allElements = [...cells, ...paragraphs];

        allElements.forEach(el => {
            if (enabled) {
                // 편집 모드 ON: 텍스트 커서
                el.style.cursor = 'text';
                el.style.opacity = '1';
            } else {
                // 편집 모드 OFF: 기본 커서 + 시각적 비활성화
                el.style.cursor = 'default';
                el.style.opacity = '0.7';
            }
        });

        logger.debug(`✅ Editable cursor toggled: ${enabled ? 'ON' : 'OFF'} (${allElements.length} elements)`);
    }
}

export default EditModeManager;

