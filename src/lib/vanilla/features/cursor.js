/**
 * Cursor
 * 커서 렌더링 및 위치 관리
 * Canvas-editor의 Cursor 시스템을 DOM 기반으로 적용
 *
 * @module features/cursor
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Cursor 클래스
 * 편집 가능한 문서에서 커서 표시 및 관리
 */
export class Cursor {
    /**
     * Cursor 생성자
     * @param {Object} viewer - HWPX Viewer 인스턴스
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.positionManager = viewer.positionManager;
        this.rangeManager = viewer.rangeManager;

        // 커서 상태
        this.cursorIndex = -1;  // 현재 커서 위치 (positionList 인덱스)
        this.isVisible = false;
        this.isBlinking = true;

        // DOM 요소
        this.cursorElement = null;
        this.cursorAgent = null;  // 입력 캡처용 hidden textarea

        // 깜빡임 타이머
        this.blinkTimer = null;
        this.blinkInterval = 530;  // ms

        this._initializeCursor();

        logger.info('📍 Cursor initialized');
    }

    /**
     * 커서 초기화
     * @private
     */
    _initializeCursor() {
        // 커서 DOM 생성
        this.cursorElement = document.createElement('div');
        this.cursorElement.className = 'hwpx-cursor';
        this.cursorElement.style.position = 'absolute';
        this.cursorElement.style.width = '2px';
        this.cursorElement.style.backgroundColor = '#000';
        this.cursorElement.style.pointerEvents = 'none';
        this.cursorElement.style.zIndex = '100';
        this.cursorElement.style.display = 'none';

        // 커서 에이전트 (입력 캡처용) 생성
        this.cursorAgent = document.createElement('textarea');
        this.cursorAgent.className = 'hwpx-cursor-agent';
        this.cursorAgent.style.position = 'fixed';
        this.cursorAgent.style.left = '-9999px';
        this.cursorAgent.style.top = '-9999px';
        this.cursorAgent.style.width = '1px';
        this.cursorAgent.style.height = '1px';
        this.cursorAgent.style.opacity = '0';
        this.cursorAgent.style.zIndex = '-1';

        // 컨테이너에 추가
        this.viewer.container.appendChild(this.cursorElement);
        document.body.appendChild(this.cursorAgent);

        // 이벤트 리스너 등록
        this._setupEventListeners();
    }

    /**
     * 이벤트 리스너 설정
     * @private
     */
    _setupEventListeners() {
        // 커서 에이전트 입력 감지
        this.cursorAgent.addEventListener('input', (e) => {
            this._handleInput(e);
        });

        this.cursorAgent.addEventListener('keydown', (e) => {
            this._handleKeyDown(e);
        });

        // 컨테이너 클릭으로 커서 위치 설정
        this.viewer.container.addEventListener('click', (e) => {
            // Ctrl+Shift+Click은 디버깅용이므로 무시
            if (e.ctrlKey && e.shiftKey) {
                return;
            }

            // 테이블 셀 내부는 인라인 에디터가 처리
            if (e.target.closest('.hwp-table td, .hwp-table th')) {
                this.hide();
                return;
            }

            this._handleContainerClick(e);
        });
    }

    /**
     * 컨테이너 클릭 핸들러
     * @private
     */
    _handleContainerClick(e) {
        if (!this.positionManager || !this.positionManager.isPositionReady()) {
            return;
        }

        const position = this.positionManager.getPositionByXY(e.clientX, e.clientY);
        if (!position) {
            return;
        }

        // 커서 위치 설정
        this.setCursorPosition(position.index);

        // 커서 에이전트에 포커스
        this.cursorAgent.focus();

        // 선택 해제
        if (this.rangeManager) {
            this.rangeManager.clearSelection();
        }
    }

    /**
     * 입력 핸들러
     * @private
     */
    _handleInput(e) {
        const text = this.cursorAgent.value;

        if (text && text.length > 0) {
            logger.debug(`📝 Input: "${text}"`);

            // 텍스트 삽입 명령 실행
            if (this.viewer.command) {
                this.viewer.command.insertText(text);
            }

            // 입력 초기화
            this.cursorAgent.value = '';
        }
    }

    /**
     * 키보드 핸들러
     * @private
     */
    _handleKeyDown(e) {
        if (!this.isVisible || this.cursorIndex < 0) {
            return;
        }

        let handled = false;

        // Clipboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V)
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'c':
                    // Copy
                    this._handleCopy(e);
                    handled = true;
                    break;

                case 'x':
                    if (e.shiftKey) {
                        // Strikethrough (Ctrl+Shift+X)
                        if (this.viewer.command) {
                            this.viewer.command.strikethrough();
                        }
                    } else {
                        // Cut (Ctrl+X)
                        this._handleCut(e);
                    }
                    handled = true;
                    break;

                case 'v':
                    // Paste
                    this._handlePaste(e);
                    handled = true;
                    break;

                case 'z':
                    // Undo
                    if (this.viewer.command) {
                        this.viewer.command.undo();
                    }
                    handled = true;
                    break;

                case 'y':
                    // Redo
                    if (this.viewer.command) {
                        this.viewer.command.redo();
                    }
                    handled = true;
                    break;

                case 'b':
                    // Bold
                    if (this.viewer.command && !e.shiftKey) {
                        this.viewer.command.bold();
                    }
                    handled = true;
                    break;

                case 'i':
                    // Italic
                    if (this.viewer.command && !e.shiftKey) {
                        this.viewer.command.italic();
                    }
                    handled = true;
                    break;

                case 'u':
                    // Underline
                    if (this.viewer.command && !e.shiftKey) {
                        this.viewer.command.underline();
                    }
                    handled = true;
                    break;

                case 'f':
                    // Find
                    if (this.viewer.searchDialog) {
                        this.viewer.searchDialog.show('find');
                    }
                    handled = true;
                    break;

                case 'h':
                    // Replace
                    if (this.viewer.searchDialog) {
                        this.viewer.searchDialog.show('replace');
                    }
                    handled = true;
                    break;

                case '=':
                case '+':
                    // Increase Font Size (Ctrl++ or Ctrl+=)
                    if (this.viewer.command) {
                        this.viewer.command.increaseFontSize();
                    }
                    handled = true;
                    break;

                case '-':
                case '_':
                    // Decrease Font Size (Ctrl+- or Ctrl+_)
                    if (this.viewer.command) {
                        this.viewer.command.decreaseFontSize();
                    }
                    handled = true;
                    break;
            }

            if (handled) {
                e.preventDefault();
                return;
            }
        }

        switch (e.key) {
            case 'ArrowLeft':
                if (!e.shiftKey) {
                    this.moveCursor(-1);
                    handled = true;
                }
                break;

            case 'ArrowRight':
                if (!e.shiftKey) {
                    this.moveCursor(1);
                    handled = true;
                }
                break;

            case 'ArrowUp':
                if (!e.shiftKey) {
                    this._moveCursorVertical(-1);
                    handled = true;
                }
                break;

            case 'ArrowDown':
                if (!e.shiftKey) {
                    this._moveCursorVertical(1);
                    handled = true;
                }
                break;

            case 'Home':
                if (!e.shiftKey) {
                    this._moveCursorToLineStart();
                    handled = true;
                }
                break;

            case 'End':
                if (!e.shiftKey) {
                    this._moveCursorToLineEnd();
                    handled = true;
                }
                break;

            case 'Backspace':
                logger.debug('⌫ Backspace');
                if (this.viewer.command) {
                    this.viewer.command.deleteBackward();
                }
                handled = true;
                break;

            case 'Delete':
                logger.debug('⌦ Delete');
                if (this.viewer.command) {
                    this.viewer.command.deleteForward();
                }
                handled = true;
                break;

            case 'Enter':
                logger.debug('↵ Enter');
                if (this.viewer.command) {
                    this.viewer.command.insertLineBreak();
                }
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
        }
    }

    /**
     * Copy 핸들러
     * @private
     */
    async _handleCopy(e) {
        if (!this.viewer.command) {
            return;
        }

        try {
            const text = this.viewer.command.copy();

            if (text && text.length > 0) {
                // 브라우저 클립보드에 복사
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    logger.debug(`📋 Copied to clipboard: "${text}"`);
                } else {
                    logger.warn('⚠️ Clipboard API not available');
                }
            }
        } catch (error) {
            logger.error('❌ Copy failed:', error);
        }
    }

    /**
     * Cut 핸들러
     * @private
     */
    async _handleCut(e) {
        if (!this.viewer.command) {
            return;
        }

        try {
            const text = this.viewer.command.cut();

            if (text && text.length > 0) {
                // 브라우저 클립보드에 복사
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    logger.debug(`✂️ Cut to clipboard: "${text}"`);
                } else {
                    logger.warn('⚠️ Clipboard API not available');
                }
            }
        } catch (error) {
            logger.error('❌ Cut failed:', error);
        }
    }

    /**
     * Paste 핸들러
     * @private
     */
    async _handlePaste(e) {
        if (!this.viewer.command) {
            return;
        }

        try {
            // 브라우저 클립보드에서 텍스트 읽기
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();

                if (text && text.length > 0) {
                    this.viewer.command.paste(text);
                    logger.debug(`📋 Pasted from clipboard: "${text}"`);
                }
            } else {
                logger.warn('⚠️ Clipboard API not available');
            }
        } catch (error) {
            logger.error('❌ Paste failed:', error);
        }
    }

    /**
     * 커서 위치 설정 (인덱스 기반)
     * @param {number} index - Position 인덱스
     */
    setCursorPosition(index) {
        if (!this.positionManager || !this.positionManager.isPositionReady()) {
            logger.warn('⚠️ PositionManager not ready');
            return;
        }

        const positions = this.positionManager.getPositionList();
        if (index < 0 || index >= positions.length) {
            logger.warn(`⚠️ Invalid cursor index: ${index}`);
            return;
        }

        this.cursorIndex = index;
        this._renderCursor();
        this.show();

        logger.debug(`📍 Cursor at index ${index}`);
    }

    /**
     * 커서 렌더링
     * @private
     */
    _renderCursor() {
        if (this.cursorIndex < 0) {
            return;
        }

        const position = this.positionManager.getPositionByIndex(this.cursorIndex);
        if (!position) {
            return;
        }

        const coord = position.coordinate;
        const container = this.viewer.container;
        const containerRect = container.getBoundingClientRect();

        // 커서 위치 계산 (컨테이너 기준)
        const left = coord.left - containerRect.left + container.scrollLeft;
        const top = coord.top - containerRect.top + container.scrollTop;
        const height = coord.height;

        // 커서 스타일 적용
        this.cursorElement.style.left = `${left}px`;
        this.cursorElement.style.top = `${top}px`;
        this.cursorElement.style.height = `${height}px`;

        // 커서 에이전트 위치 (커서 근처에 배치하여 IME 지원)
        this.cursorAgent.style.left = `${containerRect.left + left}px`;
        this.cursorAgent.style.top = `${containerRect.top + top}px`;
    }

    /**
     * 커서 이동 (상대)
     * @param {number} offset - 이동할 문자 수 (+/-)
     */
    moveCursor(offset) {
        if (this.cursorIndex < 0) {
            return;
        }

        const positions = this.positionManager.getPositionList();
        const newIndex = Math.max(0, Math.min(positions.length - 1, this.cursorIndex + offset));

        this.setCursorPosition(newIndex);
    }

    /**
     * 커서 수직 이동 (위/아래)
     * @param {number} direction - 방향 (-1: 위, 1: 아래)
     * @private
     */
    _moveCursorVertical(direction) {
        if (this.cursorIndex < 0) {
            return;
        }

        const currentPos = this.positionManager.getPositionByIndex(this.cursorIndex);
        if (!currentPos) {
            return;
        }

        const currentX = currentPos.coordinate.left;
        const currentY = (currentPos.coordinate.top + currentPos.coordinate.bottom) / 2;

        // 다음 줄의 Y 좌표 계산
        const targetY = currentY + (direction * currentPos.coordinate.height * 1.5);

        // 목표 위치에 가장 가까운 position 찾기
        const targetPos = this.positionManager.getPositionByXY(currentX, targetY);

        if (targetPos) {
            this.setCursorPosition(targetPos.index);
        }
    }

    /**
     * 줄 시작으로 이동
     * @private
     */
    _moveCursorToLineStart() {
        if (this.cursorIndex < 0) {
            return;
        }

        const currentPos = this.positionManager.getPositionByIndex(this.cursorIndex);
        if (!currentPos) {
            return;
        }

        const positions = this.positionManager.getPositionList();
        const currentY = currentPos.coordinate.top;

        // 같은 줄에서 가장 왼쪽 position 찾기
        for (let i = this.cursorIndex; i >= 0; i--) {
            const pos = positions[i];
            if (Math.abs(pos.coordinate.top - currentY) > 5) {
                // 다른 줄로 넘어감
                this.setCursorPosition(i + 1);
                return;
            }
        }

        // 첫 번째 position
        this.setCursorPosition(0);
    }

    /**
     * 줄 끝으로 이동
     * @private
     */
    _moveCursorToLineEnd() {
        if (this.cursorIndex < 0) {
            return;
        }

        const currentPos = this.positionManager.getPositionByIndex(this.cursorIndex);
        if (!currentPos) {
            return;
        }

        const positions = this.positionManager.getPositionList();
        const currentY = currentPos.coordinate.top;

        // 같은 줄에서 가장 오른쪽 position 찾기
        for (let i = this.cursorIndex; i < positions.length; i++) {
            const pos = positions[i];
            if (Math.abs(pos.coordinate.top - currentY) > 5) {
                // 다른 줄로 넘어감
                this.setCursorPosition(i - 1);
                return;
            }
        }

        // 마지막 position
        this.setCursorPosition(positions.length - 1);
    }

    /**
     * 커서 표시
     */
    show() {
        this.isVisible = true;
        this.cursorElement.style.display = 'block';
        this._startBlinking();
    }

    /**
     * 커서 숨기기
     */
    hide() {
        this.isVisible = false;
        this.cursorElement.style.display = 'none';
        this._stopBlinking();
    }

    /**
     * 깜빡임 시작
     * @private
     */
    _startBlinking() {
        this._stopBlinking();

        if (!this.isBlinking) {
            return;
        }

        let visible = true;
        this.blinkTimer = setInterval(() => {
            if (this.isVisible) {
                visible = !visible;
                this.cursorElement.style.opacity = visible ? '1' : '0';
            }
        }, this.blinkInterval);
    }

    /**
     * 깜빡임 중지
     * @private
     */
    _stopBlinking() {
        if (this.blinkTimer) {
            clearInterval(this.blinkTimer);
            this.blinkTimer = null;
        }
        this.cursorElement.style.opacity = '1';
    }

    /**
     * 깜빡임 활성화/비활성화
     * @param {boolean} enabled - 깜빡임 활성화 여부
     */
    setBlinking(enabled) {
        this.isBlinking = enabled;

        if (enabled && this.isVisible) {
            this._startBlinking();
        } else {
            this._stopBlinking();
        }
    }

    /**
     * 커서 색상 변경
     * @param {string} color - CSS 색상
     */
    setColor(color) {
        this.cursorElement.style.backgroundColor = color;
    }

    /**
     * 커서 너비 변경
     * @param {number} width - 픽셀 단위
     */
    setWidth(width) {
        this.cursorElement.style.width = `${width}px`;
    }

    /**
     * 현재 커서 위치 가져오기
     * @returns {number} 커서 인덱스
     */
    getCursorIndex() {
        return this.cursorIndex;
    }

    /**
     * 커서 에이전트에 포커스
     */
    focus() {
        this.cursorAgent.focus();
    }

    /**
     * 커서 에이전트 포커스 해제
     */
    blur() {
        this.cursorAgent.blur();
    }

    /**
     * 커서 가시성 확인
     * @returns {boolean}
     */
    isVisible() {
        return this.isVisible;
    }

    /**
     * 정리
     */
    destroy() {
        this._stopBlinking();

        if (this.cursorElement && this.cursorElement.parentElement) {
            this.cursorElement.parentElement.removeChild(this.cursorElement);
        }

        if (this.cursorAgent && this.cursorAgent.parentElement) {
            this.cursorAgent.parentElement.removeChild(this.cursorAgent);
        }

        this.cursorElement = null;
        this.cursorAgent = null;

        logger.info('🗑️ Cursor destroyed');
    }
}

export default Cursor;
