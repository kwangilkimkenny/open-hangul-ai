/**
 * Inline Editor
 * 테이블 셀 인라인 편집 기능 (하이브리드 편집 방식)
 *
 * @module features/inline-editor
 * @version 2.0.0
 */

import { getLogger } from '../utils/logger.js';
import { sanitizeHTML } from '../utils/ui.js';

const logger = getLogger('InlineEditor');

/**
 * 인라인 편집기 클래스
 */
export class InlineEditor {
    constructor(viewer) {
        this.viewer = viewer;
        this.editingCell = null;
        this.originalContent = null;
        this.onChangeCallback = null;
        this.keydownHandler = null;
        this.blurHandler = null;

        logger.info('✏️ InlineEditor initialized (Hybrid Mode v2.0)');
    }

    /**
     * 변경 콜백 등록
     * @param {Function} callback - 변경 시 호출될 함수
     */
    onChange(callback) {
        this.onChangeCallback = callback;
    }

    /**
     * 셀 편집 모드 활성화 (개선: 연속 편집 지원 + 글로벌 편집 모드 체크)
     * @param {HTMLElement} cellElement - 편집할 셀 요소
     * @param {Object} cellData - 셀 데이터 객체
     */
    enableEditMode(cellElement, cellData) {
        // ✅ v2.1.0: 글로벌 편집 모드가 OFF면 편집 불가
        if (window.editModeManager && !window.editModeManager.isGlobalEditMode) {
            logger.debug('⚠️ Edit mode is OFF - editing disabled');
            return;
        }

        // 같은 요소를 다시 클릭하면 무시
        if (this.editingCell === cellElement) {
            logger.debug('⚠️ Already editing this element');
            return;
        }

        // 기존 편집 중인 요소가 있으면 자동 저장 (편집 모드는 유지)
        if (this.editingCell && this.editingCell !== cellElement) {
            logger.debug('📝 Auto-saving previous element...');
            this.saveChanges(false);  // false = 편집 모드 종료하지 않음
        }

        logger.debug('✏️ Enabling edit mode for element');

        // 원본 내용 백업 (XSS 방지를 위해 sanitize)
        // ⚠️ Security: 악의적인 스크립트가 포함된 내용을 방지
        this.originalContent = sanitizeHTML(cellElement.innerHTML);
        this.editingCell = cellElement;
        this.cellData = cellData;

        // 편집 모드 표시
        cellElement.classList.add('editing');
        cellElement.contentEditable = true;
        cellElement.style.outline = '2px solid #667eea';
        cellElement.style.outlineOffset = '2px';
        cellElement.style.backgroundColor = 'rgba(102, 126, 234, 0.05)';

        // 포커스
        cellElement.focus();

        // ✅ 개선: 텍스트 끝으로 커서 이동 (전체 선택하지 않음)
        const range = document.createRange();
        const selection = window.getSelection();

        // 텍스트 끝으로 커서 이동
        if (cellElement.childNodes.length > 0) {
            const lastNode = this._getLastTextNode(cellElement);
            if (lastNode) {
                range.setStart(lastNode, lastNode.length || 0);
                range.collapse(true);
            } else {
                range.selectNodeContents(cellElement);
                range.collapse(false);
            }
        } else {
            range.selectNodeContents(cellElement);
            range.collapse(false);
        }

        selection.removeAllRanges();
        selection.addRange(range);

        // 이벤트 리스너 추가
        this._attachEventListeners(cellElement);

        logger.info('✅ Edit mode enabled (continuous)');
    }

    /**
     * 마지막 텍스트 노드 찾기
     * @private
     */
    _getLastTextNode(element) {
        if (element.nodeType === Node.TEXT_NODE) {
            return element;
        }

        const children = element.childNodes;
        for (let i = children.length - 1; i >= 0; i--) {
            const lastText = this._getLastTextNode(children[i]);
            if (lastText) return lastText;
        }

        return null;
    }

    /**
     * 이벤트 리스너 추가
     * ✅ Phase 1 P0: IME 처리 강화 - compositionstart/end 이벤트 추가
     * @private
     */
    _attachEventListeners(cellElement) {
        // 기존 리스너 제거
        if (this.keydownHandler) {
            cellElement.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.blurHandler) {
            cellElement.removeEventListener('blur', this.blurHandler);
        }
        if (this._compositionHandlers) {
            cellElement.removeEventListener('compositionstart', this._compositionHandlers.start);
            cellElement.removeEventListener('compositionend', this._compositionHandlers.end);
        }

        // ✅ IME Composition 상태 추적
        this.isComposing = false;

        const compositionStartHandler = () => {
            this.isComposing = true;
            logger.debug('🎌 IME composition started');
        };

        const compositionEndHandler = (e) => {
            logger.debug('🎌 IME composition ended:', e.data);

            // ✅ 조합 완료 후 10ms 안정화 대기
            // 일부 브라우저에서 compositionend 직후 keydown 이벤트가 즉시 발생할 수 있음
            setTimeout(() => {
                this.isComposing = false;
                logger.debug('🎌 IME composition stabilized');
            }, 10);
        };

        cellElement.addEventListener('compositionstart', compositionStartHandler);
        cellElement.addEventListener('compositionend', compositionEndHandler);

        // ✅ Cleanup을 위해 핸들러 저장
        this._compositionHandlers = {
            start: compositionStartHandler,
            end: compositionEndHandler
        };

        // 키보드 이벤트
        this.keydownHandler = this._handleKeydown.bind(this);
        cellElement.addEventListener('keydown', this.keydownHandler);

        // 포커스 벗어남 (자동 저장)
        this.blurHandler = this._handleBlur.bind(this);
        cellElement.addEventListener('blur', this.blurHandler, { once: true });
    }

    /**
     * 키보드 이벤트 처리 (Phase 2: 키보드 네비게이션 지원)
     * ✅ Phase 1 P0: IME 처리 강화 - 정확한 상태 추적
     * @private
     */
    _handleKeydown(e) {
        if (!this.editingCell) return;

        // ✅ Phase 1 P0: IME Composition Guard (개선)
        // Korean/Japanese/Chinese input methods use composition events.
        // During composition, ignore ALL key events to prevent double-characters or broken input.
        if (this.isComposing) {
            logger.debug('⏸️  Ignored key during IME composition:', e.key);
            return;
        }

        // Tab: 다음/이전 편집 가능한 요소로 이동
        if (e.key === 'Tab') {
            e.preventDefault();
            this._navigateToNext(e.shiftKey ? 'prev' : 'next');
            return;
        }

        // 화살표 키: 텍스트 끝/시작에 있을 때만 요소 간 이동
        if (e.key === 'ArrowRight' && !e.shiftKey && this._isCursorAtEnd()) {
            e.preventDefault();
            this._navigateToNext('next');
            return;
        }

        if (e.key === 'ArrowLeft' && !e.shiftKey && this._isCursorAtStart()) {
            e.preventDefault();
            this._navigateToNext('prev');
            return;
        }

        if (e.key === 'ArrowDown' && !e.shiftKey && this._isCursorAtEnd()) {
            e.preventDefault();
            this._navigateToNext('down');
            return;
        }

        if (e.key === 'ArrowUp' && !e.shiftKey && this._isCursorAtStart()) {
            e.preventDefault();
            this._navigateToNext('up');
            return;
        }

        // Enter: 현재 요소 저장하고 다음으로 이동 (Shift+Enter는 줄바꿈 허용)
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Shift+Enter: 줄바꿈 삽입
                e.preventDefault();
                e.stopPropagation();
                this._insertNewlineAtCursor();
                return;
            } else {
                e.preventDefault();
                e.stopPropagation();
                this.saveChanges(false);  // 저장만 하고 편집 모드 유지
                this._navigateToNext('next');
                return;
            }
        }

        // Escape: 편집 모드 완전 종료
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.saveChanges(true);  // 저장하고 편집 모드 종료
            return;
        }

        // Undo/Redo (Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey) {
                // Redo
                if (this.viewer.historyManager) this.viewer.historyManager.redo();
            } else {
                // Undo
                if (this.viewer.historyManager) this.viewer.historyManager.undo();
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            e.stopPropagation();
            // Redo
            if (this.viewer.historyManager) this.viewer.historyManager.redo();
            return;
        }
    }

    /**
     * 포커스 벗어남 처리
     * @private
     */
    _handleBlur(e) {
        // blur 이벤트는 자동 저장 (편집 모드 종료)
        setTimeout(() => {
            if (this.editingCell && this.editingCell === e.target) {
                this.saveChanges(true);
            }
        }, 100);
    }

    /**
     * 커서 위치에 줄바꿈 삽입
     * @private
     */
    _insertNewlineAtCursor() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // <br> 태그 생성
        const br = document.createElement('br');

        // 커서 위치에 삽입
        range.deleteContents();
        range.insertNode(br);

        // <br> 뒤로 커서 이동
        range.setStartAfter(br);
        range.collapse(true);

        // 포커스 유지
        selection.removeAllRanges();
        selection.addRange(range);

        // 스크롤 조정 (필요시)
        if (this.editingCell) {
            br.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }

    /**
     * 변경 사항 저장 (개선: 편집 모드 유지 옵션 추가 + HistoryManager 연동)
     * @param {boolean} exitEditMode - 편집 모드 종료 여부 (기본: true)
     */
    saveChanges(exitEditMode = true) {
        if (!this.editingCell) return;

        logger.debug('💾 Saving changes...');

        const newText = this.extractText(this.editingCell);
        const oldText = this.extractText(this._createTempElement(this.originalContent));

        // 원본과 비교를 위해 현재 상태를 캡처
        const currentData = this.cellData;

        // 변경 사항이 있는 경우에만 처리
        if (newText !== oldText) {
            logger.info(`📝 Text changed: "${oldText.substring(0, 20)}..." → "${newText.substring(0, 20)}..."`);

            // HistoryManager를 통한 실행
            if (this.viewer.historyManager) {
                // 클로저로 당시의 데이터와 텍스트를 캡처해야 함
                const captureNewText = newText;
                const captureOldText = oldText;
                const targetData = this.cellData;

                this.viewer.historyManager.execute(
                    // Execute function
                    () => {
                        this._updateCellData(targetData, captureNewText);

                        // 변경 콜백 호출
                        if (this.onChangeCallback) {
                            this.onChangeCallback({
                                type: 'text_edit',
                                cellData: targetData,
                                oldText: captureOldText,
                                newText: captureNewText
                            });
                        }

                        // 자동저장 dirty 플래그
                        if (this.viewer.autoSaveManager) {
                            this.viewer.autoSaveManager.markDirty();
                        }
                    },
                    // Undo function
                    () => {
                        this._updateCellData(targetData, captureOldText);

                        // 편집 중인 셀이라면 화면 업데이트
                        if (this.editingCell && this.cellData === targetData) {
                            // 줄바꿈 보존을 위해 HTML로 변환 (XSS 방지)
                            const safeHTML = sanitizeHTML(captureOldText.replace(/\n/g, '<br>'));
                            this.editingCell.innerHTML = safeHTML;
                        }
                    },
                    '텍스트 편집'
                );
            } else {
                // HistoryManager 없을 때 (기존 로직)
                this._updateCellData(this.cellData, newText);

                if (this.onChangeCallback) {
                    this.onChangeCallback({
                        type: 'text_edit',
                        cellData: this.cellData,
                        oldText,
                        newText
                    });
                }

                if (this.viewer.autoSaveManager) {
                    this.viewer.autoSaveManager.markDirty();
                }
            }
        }

        // ✅ 개선: 편집 모드 유지 옵션
        if (exitEditMode) {
            this._disableEditMode();
            logger.info('✅ Changes saved (edit mode exited)');
        } else {
            // 편집 모드는 유지하고 원본 내용만 업데이트
            this.originalContent = this.editingCell.innerHTML;
            logger.info('✅ Changes saved (edit mode maintained)');
        }
    }

    /**
     * 편집 취소
     */
    cancelEdit() {
        if (!this.editingCell) return;

        logger.debug('❌ Canceling edit...');

        // 원본 내용 복원
        this.editingCell.innerHTML = this.originalContent;
        this._disableEditMode();

        logger.info('✅ Edit canceled');
    }

    /**
     * 편집 모드 비활성화
     * ✅ Phase 1 P0: IME 이벤트 제거 추가
     * @private
     */
    _disableEditMode() {
        if (!this.editingCell) return;

        // 이벤트 리스너 제거
        if (this.keydownHandler) {
            this.editingCell.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.blurHandler) {
            this.editingCell.removeEventListener('blur', this.blurHandler);
        }

        // ✅ IME composition 이벤트 제거
        if (this._compositionHandlers) {
            this.editingCell.removeEventListener('compositionstart', this._compositionHandlers.start);
            this.editingCell.removeEventListener('compositionend', this._compositionHandlers.end);
            this._compositionHandlers = null;
        }

        this.editingCell.classList.remove('editing');
        this.editingCell.contentEditable = false;
        this.editingCell.style.outline = '';
        this.editingCell.style.outlineOffset = '';
        this.editingCell.style.backgroundColor = '';

        this.editingCell = null;
        this.originalContent = null;
        this.cellData = null;
        this.keydownHandler = null;
        this.blurHandler = null;
        this.isComposing = false;
    }

    /**
     * 셀에서 텍스트 추출
     * @private
     */
    extractText(element) {
        if (!element) return '';

        // <br>을 줄바꿈으로, 나머지는 textContent
        const clone = element.cloneNode(true);
        const brs = clone.querySelectorAll('br');
        brs.forEach(br => br.replaceWith('\n'));

        return clone.textContent.trim();
    }

    /**
     * 임시 요소 생성 (HTML → 텍스트 추출용)
     * @private
     */
    _createTempElement(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp;
    }

    /**
     * 셀/단락 데이터 업데이트
     * ✅ Phase 1 P0: 양방향 변환 통일 - 하나의 paragraph에 linebreak run 사용
     * @private
     */
    _updateCellData(data, newText) {
        // 테이블 셀인 경우
        if (data.elements) {
            // 기존 단락의 스타일 정보 가져오기 (첫 번째 단락 기준)
            const firstPara = data.elements.find(e => e.type === 'paragraph');
            const styleProps = firstPara ? {
                paraShapeId: firstPara.paraShapeId,
                styleId: firstPara.styleId,
                charShapeId: firstPara.runs?.[0]?.charShapeId // 첫 번째 run의 스타일
            } : {};

            // ✅ 개선: 하나의 paragraph에 runs 배열로 저장 (여러 paragraph 대신)
            data.elements = data.elements.filter(e => e.type !== 'paragraph');

            // ✅ 줄바꿈을 linebreak run으로 변환
            const runs = [];
            const lines = newText.split('\n');
            lines.forEach((line, idx) => {
                if (idx > 0) {
                    // 줄바꿈 추가
                    runs.push({
                        type: 'linebreak',
                        charShapeId: styleProps.charShapeId
                    });
                }
                // ✅ 빈 줄도 보존 (빈 문자열 허용)
                if (line || idx === lines.length - 1) {
                    runs.push({
                        text: line,
                        charShapeId: styleProps.charShapeId
                    });
                }
            });

            // ✅ 단일 paragraph 추가
            data.elements.push({
                type: 'paragraph',
                paraShapeId: styleProps.paraShapeId,
                styleId: styleProps.styleId,
                runs
            });

            logger.debug(`  ✓ Cell data updated with single paragraph (${lines.length} lines, ${runs.length} runs, style preserved)`);
        }
        // 일반 단락인 경우
        else if (data.runs) {
            // 기존 run의 스타일 정보 (첫 번째 run 기준)
            const firstRun = data.runs[0];
            const charShapeId = firstRun ? firstRun.charShapeId : undefined;

            // runs 배열 업데이트
            data.runs = [];

            // ✅ 줄바꿈 처리: linebreak run 사용
            const lines = newText.split('\n');
            lines.forEach((line, idx) => {
                if (idx > 0) {
                    // 줄바꿈 추가
                    data.runs.push({
                        type: 'linebreak',
                        charShapeId: charShapeId
                    });
                }
                // ✅ 빈 줄도 보존
                if (line || idx === lines.length - 1) {
                    data.runs.push({
                        text: line,
                        charShapeId: charShapeId
                    });
                }
            });

            logger.debug(`  ✓ Paragraph data updated with ${lines.length} lines (${data.runs.length} runs, style preserved)`);
        }
    }

    /**
     * 다음/이전 편집 가능한 요소로 이동 (Phase 2: 키보드 네비게이션)
     * @param {string} direction - 'next', 'prev', 'up', 'down'
     * @private
     */
    _navigateToNext(direction) {
        const current = this.editingCell;
        if (!current) return;

        let target = null;

        // 현재 변경사항 저장 (편집 모드는 유지)
        this.saveChanges(false);

        // 편집 가능한 모든 요소 찾기
        const editableElements = this._getAllEditableElements();
        const currentIndex = editableElements.indexOf(current);

        if (currentIndex === -1) {
            logger.warn('⚠️ Current element not found in editable list');
            return;
        }

        switch (direction) {
            case 'next':
                target = editableElements[currentIndex + 1];
                break;
            case 'prev':
                target = editableElements[currentIndex - 1];
                break;
            case 'down':
                target = this._findElementBelow(current, editableElements);
                break;
            case 'up':
                target = this._findElementAbove(current, editableElements);
                break;
        }

        if (target) {
            // 다음 요소 편집 모드 활성화
            const targetData = target._cellData || target._paraData;
            if (targetData) {
                this.enableEditMode(target, targetData);
                logger.info(`🔀 Navigated to ${direction} element`);
            }
        } else {
            logger.debug(`⚠️ No ${direction} element found`);
            // 마지막 요소이면 편집 모드 종료
            if (direction === 'next' && currentIndex === editableElements.length - 1) {
                this.saveChanges(true);
                logger.info('✅ Reached end of document, edit mode exited');
            }
        }
    }

    /**
     * 모든 편집 가능한 요소 가져오기
     * @private
     */
    _getAllEditableElements() {
        const cells = Array.from(document.querySelectorAll('td[title*="편집"], th[title*="편집"]'));
        const paragraphs = Array.from(document.querySelectorAll('.hwp-paragraph:not(.hwp-table .hwp-paragraph)[title*="편집"]'));

        // DOM 순서대로 정렬
        return [...cells, ...paragraphs].sort((a, b) => {
            return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
    }

    /**
     * 아래쪽 요소 찾기 (테이블 행 고려)
     * @private
     */
    _findElementBelow(current, elements) {
        const rect = current.getBoundingClientRect();

        // 현재 요소보다 아래에 있고, 같은 열에 있는 요소 찾기
        return elements.find(el => {
            if (el === current) return false;
            const elRect = el.getBoundingClientRect();
            return elRect.top > rect.bottom &&
                Math.abs(elRect.left - rect.left) < 50;  // 같은 열 (±50px)
        });
    }

    /**
     * 위쪽 요소 찾기 (테이블 행 고려)
     * @private
     */
    _findElementAbove(current, elements) {
        const rect = current.getBoundingClientRect();

        // 현재 요소보다 위에 있고, 같은 열에 있는 요소 찾기
        const reversed = [...elements].reverse();
        return reversed.find(el => {
            if (el === current) return false;
            const elRect = el.getBoundingClientRect();
            return elRect.bottom < rect.top &&
                Math.abs(elRect.left - rect.left) < 50;
        });
    }

    /**
     * 커서가 텍스트 끝에 있는지 확인
     * @private
     */
    _isCursorAtEnd() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        const clone = range.cloneRange();

        clone.selectNodeContents(this.editingCell);
        clone.setStart(range.endContainer, range.endOffset);

        return clone.toString().trim().length === 0;
    }

    /**
     * 커서가 텍스트 시작에 있는지 확인
     * @private
     */
    _isCursorAtStart() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        const clone = range.cloneRange();

        clone.selectNodeContents(this.editingCell);
        clone.setEnd(range.startContainer, range.startOffset);

        return clone.toString().trim().length === 0;
    }

    /**
     * 테이블 전체에 편집 기능 활성화 (개선: 완벽한 편집 모드)
     * @param {HTMLElement} tableElement - 테이블 요소
     * @param {Object} tableData - 테이블 데이터
     */
    enableTableEditing(tableElement, tableData) {
        const cells = tableElement.querySelectorAll('td, th');
        let enabledCount = 0;
        let failedCount = 0;

        cells.forEach((cell, index) => {
            // cellData 연결
            let cellData = this._findCellData(tableData, index);

            // ✅ cellData가 없으면 빈 구조 생성 (폴백)
            if (!cellData) {
                logger.debug(`⚠️ Cell ${index}: No cellData found, creating empty structure`);
                cellData = {
                    elements: []
                };
                failedCount++;
            }

            // 데이터 참조 저장
            cell._cellData = cellData;

            // ✅ v2.1.0: 싱글클릭 이벤트 (글로벌 편집 모드 체크 포함)
            const clickHandler = (e) => {
                // ✅ 편집 모드가 OFF면 클릭 무시
                if (window.editModeManager && !window.editModeManager.isGlobalEditMode) {
                    logger.debug('⚠️ Edit mode is OFF - cell click ignored');
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                this.enableEditMode(cell, cellData);
            };

            // 기존 리스너 제거 (중복 방지)
            cell.removeEventListener('click', clickHandler);
            cell.addEventListener('click', clickHandler);

            // ✅ cursor 우선순위: text가 항상 우선 (TableResizer보다 우선)
            cell.style.setProperty('cursor', 'text', 'important');

            // ✅ 기존 title 속성 명시적으로 제거 (툴팁 제거)
            cell.removeAttribute('title');

            // 편집 가능 표시 (data attribute)
            cell.setAttribute('data-editable', 'true');

            enabledCount++;
        });

        if (failedCount > 0) {
            logger.warn(`⚠️ ${failedCount} cells created with empty cellData (fallback)`);
        }

        logger.info(`✅ Table editing enabled for ${enabledCount} cells (single-click, ${failedCount} fallback)`);
    }

    /**
     * 일반 단락에 편집 기능 활성화 (개선: 싱글 클릭)
     * @param {NodeList|Array} paragraphs - 단락 요소들
     */
    enableParagraphEditing(paragraphs) {
        if (!paragraphs || paragraphs.length === 0) {
            logger.warn('⚠️ No paragraphs provided for editing');
            return;
        }

        let editableCount = 0;
        let skippedCount = 0;

        paragraphs.forEach((paraElement, index) => {
            // 테이블 내부 단락은 제외 (이미 테이블 편집으로 처리됨)
            if (paraElement.closest('.hwp-table')) {
                skippedCount++;
                return;
            }

            // 단락 데이터 확인 (렌더링 시점에 이미 연결됨)
            const paraData = paraElement._paraData;
            if (!paraData) {
                logger.debug(`⚠️ Paragraph ${index} has no data attached`);
                return;
            }

            // ✅ v2.1.0: 더블클릭 → 싱글클릭 (글로벌 편집 모드 체크 포함)
            paraElement.addEventListener('click', (e) => {
                // ✅ 편집 모드가 OFF면 클릭 무시
                if (window.editModeManager && !window.editModeManager.isGlobalEditMode) {
                    logger.debug('⚠️ Edit mode is OFF - paragraph click ignored');
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                this.enableEditMode(paraElement, paraData);
            });

            // 편집 가능 힌트
            paraElement.style.cursor = 'text';

            // ✅ 기존 title 속성 명시적으로 제거 (툴팁 제거)
            paraElement.removeAttribute('title');

            paraElement.classList.add('editable-paragraph');

            editableCount++;
        });

        logger.info(`✅ Paragraph editing enabled: ${editableCount} editable (single-click), ${skippedCount} skipped (in tables)`);
    }

    /**
     * 셀 데이터 찾기 (개선: 더 robust한 매칭)
     * @private
     */
    _findCellData(tableData, cellIndex) {
        if (!tableData || !tableData.rows) {
            logger.warn('⚠️ Invalid tableData provided');
            return null;
        }

        let currentIndex = 0;
        for (const row of tableData.rows) {
            if (!row.cells) continue;

            for (const cell of row.cells) {
                if (currentIndex === cellIndex) {
                    return cell;
                }
                currentIndex++;
            }
        }

        // ✅ 개선: 인덱스를 찾지 못한 경우 순환 방식으로 재시도
        if (cellIndex >= currentIndex && currentIndex > 0) {
            const cycledIndex = cellIndex % currentIndex;
            logger.debug(`⚠️ Cell ${cellIndex} not found, using cycled index ${cycledIndex}`);

            let idx = 0;
            for (const row of tableData.rows) {
                if (!row.cells) continue;
                for (const cell of row.cells) {
                    if (idx === cycledIndex) {
                        return cell;
                    }
                    idx++;
                }
            }
        }

        logger.debug(`⚠️ Cell ${cellIndex} not found in tableData`);
        return null;
    }

    /**
     * 현재 편집 중인지 확인
     * @returns {boolean}
     */
    isEditing() {
        return this.editingCell !== null;
    }

    /**
     * 모든 편집 종료
     */
    finishEditing() {
        if (this.editingCell) {
            this.saveChanges(true);
        }
    }
}

export default InlineEditor;
