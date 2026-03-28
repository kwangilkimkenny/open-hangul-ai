/**
 * Command Adapt
 * 실제 명령 구현 및 히스토리 관리
 * Canvas-editor의 CommandAdapt를 참고하여 구현
 *
 * @module command/command-adapt
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * CommandAdapt 클래스
 * 모든 편집 명령의 실제 구현을 담당
 */
export class CommandAdapt {
    /**
     * CommandAdapt 생성자
     * @param {Object} viewer - HWPX Viewer 인스턴스
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.historyManager = viewer.historyManager;
        this.positionManager = viewer.positionManager;
        this.rangeManager = viewer.rangeManager;

        logger.info('⚙️ CommandAdapt initialized');
    }

    // ===========================
    // Lazy Loading Helpers
    // ===========================

    /**
     * Ensure ImageEditor is loaded
     * @returns {Promise<void>}
     * @private
     */
    async _ensureImageEditor() {
        if (!this.viewer.imageEditor) {
            logger.info('⚡ ImageEditor not loaded, loading now...');
            await this.viewer.loadImageEditor();
        }
    }

    /**
     * Ensure ShapeEditor is loaded
     * @returns {Promise<void>}
     * @private
     */
    async _ensureShapeEditor() {
        if (!this.viewer.shapeEditor) {
            logger.info('⚡ ShapeEditor not loaded, loading now...');
            await this.viewer.loadShapeEditor();
        }
    }

    // ===========================
    // History Commands
    // ===========================

    /**
     * Undo 실행
     */
    executeUndo() {
        return this.historyManager.undo();
    }

    /**
     * Redo 실행
     */
    executeRedo() {
        return this.historyManager.redo();
    }

    // ===========================
    // Range Commands
    // ===========================

    /**
     * 범위 설정
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     */
    executeSetRange(startIndex, endIndex) {
        if (!this.rangeManager) {
            logger.warn('⚠️ RangeManager not available');
            return;
        }

        const oldRange = this.rangeManager.getRange();

        // Execute
        const execute = () => {
            this.rangeManager.setRange(startIndex, endIndex);
        };

        // Undo
        const undo = () => {
            this.rangeManager.setRange(oldRange.startIndex, oldRange.endIndex);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Set Range');
    }

    /**
     * 전체 선택
     */
    executeSelectAll() {
        if (!this.rangeManager) {
            logger.warn('⚠️ RangeManager not available');
            return;
        }

        const oldRange = this.rangeManager.getRange();

        const execute = () => {
            this.rangeManager.selectAll();
        };

        const undo = () => {
            this.rangeManager.setRange(oldRange.startIndex, oldRange.endIndex);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Select All');
    }

    /**
     * 선택 해제
     */
    executeClearSelection() {
        if (!this.rangeManager) {
            return;
        }

        const oldRange = this.rangeManager.getRange();

        const execute = () => {
            this.rangeManager.clearSelection();
        };

        const undo = () => {
            this.rangeManager.setRange(oldRange.startIndex, oldRange.endIndex);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Clear Selection');
    }

    // ===========================
    // Format Commands
    // ===========================

    /**
     * Bold 적용/해제
     * @param {boolean} value - Bold 활성화 여부
     */
    executeBold(value = true) {
        this._executeFormat('bold', value, 'Bold');
    }

    /**
     * Italic 적용/해제
     * @param {boolean} value - Italic 활성화 여부
     */
    executeItalic(value = true) {
        this._executeFormat('italic', value, 'Italic');
    }

    /**
     * Underline 적용/해제
     * @param {boolean} value - Underline 활성화 여부
     */
    executeUnderline(value = true) {
        this._executeFormat('underline', value, 'Underline');
    }

    /**
     * Strikethrough 적용/해제
     * @param {boolean} value - Strikethrough 활성화 여부
     */
    executeStrikethrough(value = true) {
        this._executeFormat('strikethrough', value, 'Strikethrough');
    }

    /**
     * 색상 변경
     * @param {string} color - 색상 값
     */
    executeColor(color) {
        this._executeFormat('color', color, 'Color');
    }

    /**
     * 형광펜 (배경색) 적용
     * @param {string} color - 배경 색상 값 (null이면 제거)
     */
    executeHighlight(color) {
        this._executeFormat('backgroundColor', color, 'Highlight');
    }

    /**
     * 위 첨자 적용/해제
     * @param {boolean} value - 위 첨자 활성화 여부
     */
    executeSuperscript(value = true) {
        const verticalAlign = value ? 'super' : 'baseline';
        this._executeFormat('verticalAlign', verticalAlign, 'Superscript');
    }

    /**
     * 아래 첨자 적용/해제
     * @param {boolean} value - 아래 첨자 활성화 여부
     */
    executeSubscript(value = true) {
        const verticalAlign = value ? 'sub' : 'baseline';
        this._executeFormat('verticalAlign', verticalAlign, 'Subscript');
    }

    // ===========================
    // List Commands
    // ===========================

    /**
     * 글머리 기호 적용
     * @param {string} bulletType - 기호 종류 ('bullet', 'circle', 'square')
     */
    executeBulletList(bulletType = 'bullet') {
        const bulletMap = {
            bullet: '●',
            circle: '○',
            square: '■'
        };

        const symbol = bulletMap[bulletType] || '●';
        this._applyListFormatting('BULLET', symbol, 'Bullet List');
    }

    /**
     * 번호 매기기 적용
     * @param {string} numberType - 번호 형식 ('decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman')
     */
    executeNumberedList(numberType = 'decimal') {
        const formatMap = {
            'decimal': 'DECIMAL',
            'lower-alpha': 'LOWER_ALPHA',
            'upper-alpha': 'UPPER_ALPHA',
            'lower-roman': 'LOWER_ROMAN',
            'upper-roman': 'UPPER_ROMAN'
        };

        const format = formatMap[numberType] || 'DECIMAL';
        this._applyListFormatting(format, '%d.', 'Numbered List');
    }

    /**
     * 목록 제거
     */
    executeRemoveList() {
        this._removeListFormatting('Remove List');
    }

    /**
     * 목록 들여쓰기 증가
     */
    executeIncreaseIndent() {
        this._adjustIndentLevel(1, 'Increase Indent');
    }

    /**
     * 목록 들여쓰기 감소
     */
    executeDecreaseIndent() {
        this._adjustIndentLevel(-1, 'Decrease Indent');
    }

    /**
     * 목록 포맷 적용 헬퍼
     * @private
     */
    _applyListFormatting(format, numberFormat, actionName) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('⚠️ No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 목록 ID 생성
        const listId = `list-${Date.now()}`;

        // 각 단락에 numbering 적용
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;

            if (!para.numbering) {
                para.numbering = {
                    id: listId,
                    level: 0,
                    definition: {
                        start: 1,
                        levels: []
                    }
                };
            }

            // 레벨 정의 추가/업데이트
            const levelData = {
                level: para.numbering.level,
                format: format,
                numberFormat: numberFormat,
                indent: para.numbering.level * 20
            };

            const existingLevelIndex = para.numbering.definition.levels.findIndex(
                l => l.level === para.numbering.level
            );

            if (existingLevelIndex >= 0) {
                para.numbering.definition.levels[existingLevelIndex] = levelData;
            } else {
                para.numbering.definition.levels.push(levelData);
            }
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, actionName);

        logger.info(`✅ Applied ${actionName}`);
    }

    /**
     * 목록 제거 헬퍼
     * @private
     */
    _removeListFormatting(actionName) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('⚠️ No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 각 단락의 numbering 제거
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;
            delete para.numbering;
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, actionName);

        logger.info(`✅ ${actionName}`);
    }

    /**
     * 들여쓰기 레벨 조정 헬퍼
     * @private
     */
    _adjustIndentLevel(delta, actionName) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('⚠️ No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 각 단락의 레벨 조정
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;

            if (para.numbering) {
                const newLevel = Math.max(0, Math.min(8, para.numbering.level + delta));
                para.numbering.level = newLevel;

                // 레벨 정의 추가 (없으면)
                const levelData = para.numbering.definition.levels.find(l => l.level === newLevel);
                if (!levelData) {
                    const currentLevelData = para.numbering.definition.levels.find(
                        l => l.level === (newLevel - delta)
                    ) || para.numbering.definition.levels[0];

                    if (currentLevelData) {
                        para.numbering.definition.levels.push({
                            level: newLevel,
                            format: currentLevelData.format,
                            numberFormat: currentLevelData.numberFormat,
                            indent: newLevel * 20
                        });
                    }
                }
            }
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, actionName);

        logger.info(`✅ ${actionName}`);
    }

    /**
     * 범위 내 단락들 가져오기
     * @private
     */
    _getParagraphsInRange(range) {
        const positions = this.viewer.getCharacterPositions();
        const paragraphs = [];
        const seenParagraphs = new Set();

        for (let i = range.startIndex; i <= range.endIndex && i < positions.length; i++) {
            const position = positions[i];
            const para = position.paraData;

            if (para && !seenParagraphs.has(para)) {
                paragraphs.push({
                    paraData: para,
                    position: position
                });
                seenParagraphs.add(para);
            }
        }

        return paragraphs;
    }

    // ===========================
    // Line Spacing Commands
    // ===========================

    /**
     * 줄 간격 설정
     * @param {number} lineHeight - 줄 간격 (1.0 = 단일, 1.5 = 1.5줄, 2.0 = 2줄)
     */
    executeLineSpacing(lineHeight) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('⚠️ No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 각 단락에 줄 간격 적용
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;

            if (!para.style) {
                para.style = {};
            }

            para.style.lineHeight = lineHeight.toString();
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, `Line Spacing: ${lineHeight}`);

        logger.info(`✅ Applied line spacing: ${lineHeight}`);
    }

    // ===========================
    // Paragraph Spacing Commands
    // ===========================

    /**
     * 단락 앞 간격 설정
     * @param {number} spacing - 단락 앞 간격 (pt)
     */
    executeParagraphSpaceBefore(spacing) {
        this._applyParagraphSpacing('before', spacing);
    }

    /**
     * 단락 뒤 간격 설정
     * @param {number} spacing - 단락 뒤 간격 (pt)
     */
    executeParagraphSpaceAfter(spacing) {
        this._applyParagraphSpacing('after', spacing);
    }

    /**
     * 단락 간격 설정 (앞/뒤 동시)
     * @param {number} spaceBefore - 단락 앞 간격 (pt)
     * @param {number} spaceAfter - 단락 뒤 간격 (pt)
     */
    executeParagraphSpacing(spaceBefore, spaceAfter) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('⚠️ No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 각 단락에 간격 적용
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;

            if (!para.style) {
                para.style = {};
            }

            // pt to px conversion (1pt = 1.333px)
            const spaceBeforePx = spaceBefore * 1.333;
            const spaceAfterPx = spaceAfter * 1.333;

            // Set margin
            para.style.margin = `${spaceBeforePx}px 0 ${spaceAfterPx}px 0`;
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, `Paragraph Spacing: ${spaceBefore}pt / ${spaceAfter}pt`);

        logger.info(`✅ Applied paragraph spacing: ${spaceBefore}pt / ${spaceAfter}pt`);
    }

    /**
     * 단락 간격 적용 헬퍼
     * @private
     */
    _applyParagraphSpacing(type, spacing) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('⚠️ No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 각 단락에 간격 적용
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;

            if (!para.style) {
                para.style = {};
            }

            // pt to px conversion (1pt = 1.333px)
            const spacingPx = spacing * 1.333;

            // Parse existing margin or set default
            let marginTop = 0;
            let marginBottom = 0;

            if (para.style.margin) {
                const margins = para.style.margin.split(' ');
                if (margins.length >= 1) marginTop = parseFloat(margins[0]) || 0;
                if (margins.length >= 3) marginBottom = parseFloat(margins[2]) || 0;
            }

            // Update the specific margin
            if (type === 'before') {
                marginTop = spacingPx;
            } else if (type === 'after') {
                marginBottom = spacingPx;
            }

            para.style.margin = `${marginTop}px 0 ${marginBottom}px 0`;
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const actionName = type === 'before' ?
            `Paragraph Space Before: ${spacing}pt` :
            `Paragraph Space After: ${spacing}pt`;

        this.historyManager.execute(execute, undo, actionName);

        logger.info(`✅ Applied ${actionName}`);
    }

    /**
     * 포맷 적용 헬퍼
     * @private
     */
    _executeFormat(format, value, actionName) {
        if (!this.rangeManager || !this.rangeManager.hasSelection()) {
            logger.warn('⚠️ No selection to format');
            return;
        }

        // 선택된 요소들과 현재 스타일 저장
        const elements = this.rangeManager.getSelectedElements();
        const oldStyles = elements.map(el => ({
            element: el,
            style: { ...el.style }
        }));

        const execute = () => {
            this.rangeManager.applyFormat(format, value);
        };

        const undo = () => {
            // 이전 스타일 복원
            oldStyles.forEach(({ element, style }) => {
                Object.assign(element.style, style);
            });
            this.viewer.render(this.viewer.getDocument());
            return execute;
        };

        this.historyManager.execute(execute, undo, actionName);
    }

    // ===========================
    // Cell Edit Commands
    // ===========================

    /**
     * 셀 편집
     * @param {HTMLElement} cellElement - 셀 요소
     * @param {string} newText - 새 텍스트
     */
    executeEditCell(cellElement, newText) {
        if (!cellElement || !cellElement._cellData) {
            logger.warn('⚠️ Invalid cell element');
            return;
        }

        const cellData = cellElement._cellData;
        const oldText = this._extractTextFromCellData(cellData);

        const execute = () => {
            // 셀 데이터 업데이트
            this._updateCellDataFromText(cellData, newText);

            // DOM 업데이트
            cellElement.textContent = newText;

            logger.debug(`✏️ Cell edited: "${oldText}" → "${newText}"`);
        };

        const undo = () => {
            // 이전 텍스트 복원
            this._updateCellDataFromText(cellData, oldText);
            cellElement.textContent = oldText;

            logger.debug(`↶ Cell restored: "${newText}" → "${oldText}"`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Edit Cell');
    }

    /**
     * 셀 데이터에서 텍스트 추출
     * @private
     */
    _extractTextFromCellData(cellData) {
        if (!cellData.elements || cellData.elements.length === 0) {
            return '';
        }

        let text = '';
        cellData.elements.forEach(element => {
            if (element.type === 'paragraph' && element.runs) {
                element.runs.forEach(run => {
                    if (run.text) {
                        text += run.text;
                    } else if (run.type === 'linebreak') {
                        text += '\n';
                    }
                });
            }
        });
        return text;
    }

    /**
     * 텍스트로 셀 데이터 업데이트
     * @private
     */
    _updateCellDataFromText(cellData, newText) {
        if (!cellData.elements || cellData.elements.length === 0) {
            cellData.elements = [{
                type: 'paragraph',
                runs: []
            }];
        }

        const paragraph = cellData.elements[0];
        paragraph.runs = [];

        // 줄바꿈 처리
        const lines = newText.split('\n');
        lines.forEach((line, idx) => {
            if (idx > 0) {
                paragraph.runs.push({ type: 'linebreak' });
            }
            if (line) {
                paragraph.runs.push({ text: line });
            }
        });
    }

    // ===========================
    // Table Commands
    // ===========================

    /**
     * 행 추가 (위)
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeAddRowAbove(cellElement) {
        this._executeTableCommand('addRowAbove', cellElement, 'Add Row Above');
    }

    /**
     * 행 추가 (아래)
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeAddRowBelow(cellElement) {
        this._executeTableCommand('addRowBelow', cellElement, 'Add Row Below');
    }

    /**
     * 열 추가 (왼쪽)
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeAddColumnLeft(cellElement) {
        this._executeTableCommand('addColumnLeft', cellElement, 'Add Column Left');
    }

    /**
     * 열 추가 (오른쪽)
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeAddColumnRight(cellElement) {
        this._executeTableCommand('addColumnRight', cellElement, 'Add Column Right');
    }

    /**
     * 행 삭제
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeDeleteRow(cellElement) {
        this._executeTableCommand('deleteRow', cellElement, 'Delete Row');
    }

    /**
     * 열 삭제
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeDeleteColumn(cellElement) {
        this._executeTableCommand('deleteColumn', cellElement, 'Delete Column');
    }

    /**
     * 테이블 삽입
     * @param {number} rows - 행 수
     * @param {number} cols - 열 수
     */
    executeInsertTable(rows = 3, cols = 3) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('⚠️ TableEditor not available');
            return;
        }

        // ✅ 현재 편집 중인 내용을 먼저 저장 (텍스트 유실 방지)
        if (this.viewer.inlineEditor && this.viewer.inlineEditor.isEditing()) {
            this.viewer.inlineEditor.saveChanges(true);
        }
        if (this.viewer._syncDocumentFromDOM) {
            this.viewer._syncDocumentFromDOM();
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            tableEditor.insertTable(rows, cols);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Insert Table (${rows}x${cols})`);
    }

    /**
     * 테이블 삭제
     * @param {HTMLElement} cellElement - 테이블 내 셀
     */
    executeDeleteTable(cellElement) {
        this._executeTableCommand('deleteTable', cellElement, 'Delete Table');
    }

    /**
     * 셀 병합
     * @param {HTMLElement[]} cells - 병합할 셀들
     */
    executeMergeCells(cells) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('⚠️ TableEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            tableEditor.mergeCells(cells);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Merge Cells');
    }

    /**
     * 셀 분할
     * @param {HTMLElement} cellElement - 분할할 셀
     */
    executeSplitCell(cellElement) {
        this._executeTableCommand('splitCell', cellElement, 'Split Cell');
    }

    /**
     * 셀 배경색 설정
     * @param {HTMLElement} cellElement - 대상 셀
     * @param {string} color - 배경색
     */
    executeSetCellBackgroundColor(cellElement, color) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('⚠️ TableEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            tableEditor.setCellBackgroundColor(cellElement, color);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Cell Background: ${color}`);
    }

    /**
     * 셀 테두리 설정
     * @param {HTMLElement} cellElement - 대상 셀
     * @param {Object} borders - 테두리 설정
     */
    executeSetCellBorders(cellElement, borders) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('⚠️ TableEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            tableEditor.setCellBorders(cellElement, borders);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Set Cell Borders');
    }

    /**
     * 테이블 명령 헬퍼
     * @private
     */
    _executeTableCommand(commandName, cellElement, actionName) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('⚠️ TableEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // TableEditor 메서드 호출
            tableEditor[commandName](cellElement);
        };

        const undo = () => {
            // 문서 복원
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, actionName);
    }

    // ===========================
    // Image Commands
    // ===========================

    /**
     * 이미지 삽입
     * @param {string} imageUrl - 이미지 URL
     * @param {Object} options - 옵션
     */
    async executeInsertImage(imageUrl, options = {}) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            imageEditor.insertImage(imageUrl, options);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Insert Image');
    }

    /**
     * 이미지 삭제
     * @param {HTMLElement} imageElement - 이미지 요소
     */
    async executeDeleteImage(imageElement) {
        await this._executeImageCommand('deleteImage', imageElement, 'Delete Image');
    }

    /**
     * 이미지 크기 조정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} width - 너비
     * @param {number} height - 높이
     */
    async executeResizeImage(imageElement, width, height) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            imageEditor.resizeImage(imageElement, width, height);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Resize Image: ${width}x${height}`);
    }

    /**
     * 이미지 정렬 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} alignment - 정렬
     */
    async executeSetImageAlignment(imageElement, alignment) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            imageEditor.setImageAlignment(imageElement, alignment);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Image Alignment: ${alignment}`);
    }

    /**
     * 이미지 위치 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    async executeSetImagePosition(imageElement, x, y) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            imageEditor.setImagePosition(imageElement, x, y);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Image Position: (${x}, ${y})`);
    }

    /**
     * 이미지 Alt 텍스트 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} altText - Alt 텍스트
     */
    async executeSetImageAltText(imageElement, altText) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            imageEditor.setImageAltText(imageElement, altText);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Set Image Alt Text');
    }

    /**
     * 이미지 회전
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} degrees - 회전 각도
     */
    async executeRotateImage(imageElement, degrees) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            imageEditor.rotateImage(imageElement, degrees);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Rotate Image: ${degrees}°`);
    }

    /**
     * 이미지 테두리 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} border - CSS 테두리 문자열
     */
    async executeSetImageBorder(imageElement, border) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            imageEditor.setImageBorder(imageElement, border);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Set Image Border');
    }

    /**
     * 이미지 불투명도 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} opacity - 불투명도
     */
    async executeSetImageOpacity(imageElement, opacity) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            imageEditor.setImageOpacity(imageElement, opacity);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Image Opacity: ${opacity}`);
    }

    /**
     * 이미지 명령 헬퍼
     * @private
     */
    async _executeImageCommand(commandName, imageElement, actionName) {
        // Lazy load ImageEditor if needed
        await this._ensureImageEditor();

        const imageEditor = this.viewer.imageEditor;
        if (!imageEditor) {
            logger.warn('⚠️ ImageEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // ImageEditor 메서드 호출
            imageEditor[commandName](imageElement);
        };

        const undo = () => {
            // 문서 복원
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, actionName);
    }

    // ===========================
    // Shape Commands
    // ===========================

    /**
     * 도형 삽입
     * @param {string} shapeType - 도형 타입
     * @param {Object} options - 옵션
     */
    async executeInsertShape(shapeType, options = {}) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.insertShape(shapeType, options);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Insert Shape: ${shapeType}`);
    }

    /**
     * 도형 삭제
     * @param {HTMLElement} shapeElement - 도형 요소
     */
    async executeDeleteShape(shapeElement) {
        await this._executeShapeCommand('deleteShape', shapeElement, 'Delete Shape');
    }

    /**
     * 도형 크기 조정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} width - 너비
     * @param {number} height - 높이
     */
    async executeResizeShape(shapeElement, width, height) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.resizeShape(shapeElement, width, height);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Resize Shape: ${width}x${height}`);
    }

    /**
     * 도형 위치 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    async executeSetShapePosition(shapeElement, x, y) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.setShapePosition(shapeElement, x, y);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Shape Position: (${x}, ${y})`);
    }

    /**
     * 도형 채우기 색상 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} color - 채우기 색상
     */
    async executeSetShapeFillColor(shapeElement, color) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.setShapeFillColor(shapeElement, color);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Shape Fill: ${color}`);
    }

    /**
     * 도형 테두리 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} color - 테두리 색상
     * @param {number} width - 테두리 두께
     */
    async executeSetShapeStroke(shapeElement, color, width) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.setShapeStroke(shapeElement, color, width);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Set Shape Stroke');
    }

    /**
     * 도형 회전
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} degrees - 회전 각도
     */
    async executeRotateShape(shapeElement, degrees) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.rotateShape(shapeElement, degrees);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Rotate Shape: ${degrees}°`);
    }

    /**
     * 도형 불투명도 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} opacity - 불투명도
     */
    async executeSetShapeOpacity(shapeElement, opacity) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.setShapeOpacity(shapeElement, opacity);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Shape Opacity: ${opacity}`);
    }

    /**
     * 도형 텍스트 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} text - 텍스트
     */
    async executeSetShapeText(shapeElement, text) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.setShapeText(shapeElement, text);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Set Shape Text');
    }

    /**
     * 도형 테두리 둥글기 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} radius - 둥글기
     */
    async executeSetShapeBorderRadius(shapeElement, radius) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            shapeEditor.setShapeBorderRadius(shapeElement, radius);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Border Radius: ${radius}`);
    }

    /**
     * 도형 명령 헬퍼
     * @private
     */
    async _executeShapeCommand(commandName, shapeElement, actionName) {
        // Lazy load ShapeEditor if needed
        await this._ensureShapeEditor();

        const shapeEditor = this.viewer.shapeEditor;
        if (!shapeEditor) {
            logger.warn('⚠️ ShapeEditor not available');
            return;
        }

        // 현재 문서 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // ShapeEditor 메서드 호출
            shapeEditor[commandName](shapeElement);
        };

        const undo = () => {
            // 문서 복원
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, actionName);
    }

    // ===========================
    // Document Commands
    // ===========================

    /**
     * 문서 전체 업데이트
     * @param {Object} newDocument - 새 문서
     * @param {string} actionName - 액션 이름
     */
    executeUpdateDocument(newDocument, actionName = 'Update Document') {
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            this.viewer.updateDocument(newDocument);
        };

        const undo = () => {
            this.viewer.updateDocument(oldDocument);
            return execute;
        };

        this.historyManager.execute(execute, undo, actionName);
    }

    /**
     * 셀 내용 비우기
     * @param {HTMLElement} cellElement - 셀 요소
     */
    executeClearCell(cellElement) {
        if (!cellElement || !cellElement._cellData) {
            return;
        }

        const oldText = this._extractTextFromCellData(cellElement._cellData);

        this.executeEditCell(cellElement, '');
    }

    // ===========================
    // Text Input Commands
    // ===========================

    /**
     * 텍스트 삽입
     * @param {string} text - 삽입할 텍스트
     */
    executeInsertText(text) {
        const cursor = this.viewer.cursor;
        if (!cursor || cursor.getCursorIndex() < 0) {
            logger.warn('⚠️ No cursor position');
            return;
        }

        const cursorIndex = cursor.getCursorIndex();
        const position = this.positionManager.getPositionByIndex(cursorIndex);

        if (!position) {
            logger.warn('⚠️ Invalid cursor position');
            return;
        }

        // 현재 위치의 데이터 구조 파악
        const cellData = position.cellData;
        const paraData = position.paraData;

        if (!cellData && !paraData) {
            logger.warn('⚠️ No editable element at cursor');
            return;
        }

        // 이전 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // 텍스트 삽입
            if (cellData) {
                this._insertTextIntoCell(cellData, position, text);
            } else if (paraData) {
                this._insertTextIntoParagraph(paraData, position, text);
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 삽입된 텍스트 뒤로 이동
                cursor.setCursorPosition(cursorIndex + text.length);
            });

            logger.debug(`✏️ Inserted text: "${text}" at index ${cursorIndex}`);
        };

        const undo = () => {
            // 이전 문서로 복원
            this.viewer.updateDocument(oldDocument);

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                cursor.setCursorPosition(cursorIndex);
            });

            logger.debug(`↶ Undone insert text: "${text}"`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Insert Text');
    }

    /**
     * 셀에 텍스트 삽입
     * @private
     */
    _insertTextIntoCell(cellData, position, text) {
        if (!cellData.elements || cellData.elements.length === 0) {
            cellData.elements = [{
                type: 'paragraph',
                runs: [{ text: '' }]
            }];
        }

        const paragraph = cellData.elements[0];
        if (!paragraph.runs || paragraph.runs.length === 0) {
            paragraph.runs = [{ text: '' }];
        }

        // 현재 run에 텍스트 삽입
        let currentRun = paragraph.runs[0];
        if (!currentRun.text) {
            currentRun.text = '';
        }

        // 텍스트 노드 내 오프셋 계산
        const offset = position.textOffset || 0;
        currentRun.text = currentRun.text.slice(0, offset) + text + currentRun.text.slice(offset);
    }

    /**
     * 단락에 텍스트 삽입
     * @private
     */
    _insertTextIntoParagraph(paraData, position, text) {
        if (!paraData.runs || paraData.runs.length === 0) {
            paraData.runs = [{ text: '' }];
        }

        // 현재 run에 텍스트 삽입
        let currentRun = paraData.runs[0];
        if (!currentRun.text) {
            currentRun.text = '';
        }

        // 텍스트 노드 내 오프셋 계산
        const offset = position.textOffset || 0;
        currentRun.text = currentRun.text.slice(0, offset) + text + currentRun.text.slice(offset);
    }

    /**
     * 이전 문자 삭제 (Backspace)
     */
    executeDeleteBackward() {
        const cursor = this.viewer.cursor;
        if (!cursor || cursor.getCursorIndex() <= 0) {
            logger.warn('⚠️ Cannot delete backward');
            return;
        }

        const cursorIndex = cursor.getCursorIndex();
        const prevPosition = this.positionManager.getPositionByIndex(cursorIndex - 1);

        if (!prevPosition) {
            return;
        }

        // 삭제할 문자
        const deletedChar = prevPosition.value;

        // 이전 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // 이전 문자 삭제
            if (prevPosition.cellData) {
                this._deleteCharFromCell(prevPosition.cellData, prevPosition);
            } else if (prevPosition.paraData) {
                this._deleteCharFromParagraph(prevPosition.paraData, prevPosition);
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 이전 위치로 이동
                cursor.setCursorPosition(cursorIndex - 1);
            });

            logger.debug(`⌫ Deleted backward: "${deletedChar}"`);
        };

        const undo = () => {
            // 이전 문서로 복원
            this.viewer.updateDocument(oldDocument);

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                cursor.setCursorPosition(cursorIndex);
            });

            logger.debug(`↶ Undone delete backward: "${deletedChar}"`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Delete Backward');
    }

    /**
     * 다음 문자 삭제 (Delete)
     */
    executeDeleteForward() {
        const cursor = this.viewer.cursor;
        if (!cursor) {
            return;
        }

        const cursorIndex = cursor.getCursorIndex();
        const positions = this.positionManager.getPositionList();

        if (cursorIndex < 0 || cursorIndex >= positions.length) {
            logger.warn('⚠️ Cannot delete forward');
            return;
        }

        const currentPosition = positions[cursorIndex];
        if (!currentPosition) {
            return;
        }

        // 삭제할 문자
        const deletedChar = currentPosition.value;

        // 이전 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // 현재 문자 삭제
            if (currentPosition.cellData) {
                this._deleteCharFromCell(currentPosition.cellData, currentPosition);
            } else if (currentPosition.paraData) {
                this._deleteCharFromParagraph(currentPosition.paraData, currentPosition);
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 유지 (삭제 후 같은 인덱스)
                cursor.setCursorPosition(cursorIndex);
            });

            logger.debug(`⌦ Deleted forward: "${deletedChar}"`);
        };

        const undo = () => {
            // 이전 문서로 복원
            this.viewer.updateDocument(oldDocument);

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                cursor.setCursorPosition(cursorIndex);
            });

            logger.debug(`↶ Undone delete forward: "${deletedChar}"`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Delete Forward');
    }

    /**
     * 셀에서 문자 삭제
     * @private
     */
    _deleteCharFromCell(cellData, position) {
        if (!cellData.elements || cellData.elements.length === 0) {
            return;
        }

        const paragraph = cellData.elements[0];
        if (!paragraph.runs || paragraph.runs.length === 0) {
            return;
        }

        const run = paragraph.runs[0];
        if (!run.text) {
            return;
        }

        const offset = position.textOffset || 0;
        run.text = run.text.slice(0, offset) + run.text.slice(offset + 1);
    }

    /**
     * 단락에서 문자 삭제
     * @private
     */
    _deleteCharFromParagraph(paraData, position) {
        if (!paraData.runs || paraData.runs.length === 0) {
            return;
        }

        const run = paraData.runs[0];
        if (!run.text) {
            return;
        }

        const offset = position.textOffset || 0;
        run.text = run.text.slice(0, offset) + run.text.slice(offset + 1);
    }

    /**
     * 줄바꿈 삽입 (Enter)
     */
    executeInsertLineBreak() {
        const cursor = this.viewer.cursor;
        if (!cursor || cursor.getCursorIndex() < 0) {
            logger.warn('⚠️ No cursor position');
            return;
        }

        const cursorIndex = cursor.getCursorIndex();
        const position = this.positionManager.getPositionByIndex(cursorIndex);

        if (!position) {
            return;
        }

        // 이전 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // 줄바꿈 삽입
            if (position.cellData) {
                this._insertLineBreakIntoCell(position.cellData, position);
            } else if (position.paraData) {
                // 현재는 linebreak run을 삽입하여 줄바꿈 처리
                // 향후 개선: 단락 분할 및 새 단락 생성으로 리팩토링 가능
                // 이를 위해서는 position 객체에 parentSection 참조 추가 필요
                this._insertLineBreakIntoParagraph(position.paraData, position);
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 다음 줄로 이동
                cursor.setCursorPosition(cursorIndex + 1);
            });

            logger.debug(`↵ Inserted line break at index ${cursorIndex}`);
        };

        const undo = () => {
            // 이전 문서로 복원
            this.viewer.updateDocument(oldDocument);

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                cursor.setCursorPosition(cursorIndex);
            });

            logger.debug(`↶ Undone insert line break`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Insert Line Break');
    }

    /**
     * 셀에 줄바꿈 삽입
     * @private
     */
    _insertLineBreakIntoCell(cellData, position) {
        if (!cellData.elements || cellData.elements.length === 0) {
            cellData.elements = [{
                type: 'paragraph',
                runs: []
            }];
        }

        const paragraph = cellData.elements[0];
        if (!paragraph.runs) {
            paragraph.runs = [];
        }

        // 현재 위치에 linebreak run 삽입
        const offset = position.textOffset || 0;
        const currentRun = paragraph.runs[0] || { text: '' };

        // 텍스트를 줄바꿈 기준으로 분할
        const textBefore = currentRun.text.slice(0, offset);
        const textAfter = currentRun.text.slice(offset);

        // runs 재구성
        paragraph.runs = [
            { text: textBefore },
            { type: 'linebreak' },
            { text: textAfter }
        ];
    }

    /**
     * 단락에 줄바꿈 삽입
     * @private
     */
    _insertLineBreakIntoParagraph(paraData, position) {
        if (!paraData.runs) {
            paraData.runs = [];
        }

        // 현재 위치에 linebreak run 삽입
        const offset = position.textOffset || 0;
        const currentRun = paraData.runs[0] || { text: '' };

        // 텍스트를 줄바꿈 기준으로 분할
        const textBefore = currentRun.text.slice(0, offset);
        const textAfter = currentRun.text.slice(offset);

        // runs 재구성
        paraData.runs = [
            { text: textBefore },
            { type: 'linebreak' },
            { text: textAfter }
        ];
    }

    // ===========================
    // Clipboard Commands
    // ===========================

    /**
     * Copy - 선택된 텍스트 복사
     * @returns {string} 복사된 텍스트
     */
    executeCopy() {
        if (!this.rangeManager) {
            logger.warn('⚠️ RangeManager not available');
            return '';
        }

        const selectedText = this.rangeManager.getSelectedText();

        if (!selectedText || selectedText.length === 0) {
            logger.debug('⚠️ No text selected');
            return '';
        }

        logger.debug(`📋 Copied: "${selectedText}"`);
        return selectedText;
    }

    /**
     * Cut - 선택된 텍스트 잘라내기
     * @returns {string} 잘라낸 텍스트
     */
    executeCut() {
        if (!this.rangeManager) {
            logger.warn('⚠️ RangeManager not available');
            return '';
        }

        const range = this.rangeManager.getRange();
        if (!range || range.startIndex === range.endIndex) {
            logger.debug('⚠️ No text selected');
            return '';
        }

        const selectedText = this.rangeManager.getSelectedText();

        if (!selectedText || selectedText.length === 0) {
            return '';
        }

        // 이전 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
        const cursor = this.viewer.cursor;
        const oldCursorIndex = cursor ? cursor.getCursorIndex() : -1;

        const execute = () => {
            // 선택 영역 삭제
            this._deleteSelectedRange(range.startIndex, range.endIndex);

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 선택 시작 위치로 이동
                if (cursor) {
                    cursor.setCursorPosition(range.startIndex);
                }

                // 선택 해제
                if (this.rangeManager) {
                    this.rangeManager.clearSelection();
                }
            });

            logger.debug(`✂️ Cut: "${selectedText}" (${range.startIndex}-${range.endIndex})`);
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
            });

            logger.debug(`↶ Undone cut`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Cut');

        return selectedText;
    }

    /**
     * Paste - 텍스트 붙여넣기
     * @param {string} text - 붙여넣을 텍스트
     */
    executePaste(text) {
        if (!text || text.length === 0) {
            logger.debug('⚠️ No text to paste');
            return;
        }

        const cursor = this.viewer.cursor;
        if (!cursor) {
            logger.warn('⚠️ Cursor not available');
            return;
        }

        // 선택 영역이 있으면 먼저 삭제
        const range = this.rangeManager ? this.rangeManager.getRange() : null;
        const hasSelection = range && range.startIndex !== range.endIndex;

        if (hasSelection) {
            // 선택 영역 삭제 후 붙여넣기
            this._pasteWithSelection(text, range);
        } else {
            // 커서 위치에 바로 붙여넣기
            this._pasteAtCursor(text);
        }
    }

    /**
     * 선택 영역을 삭제하고 텍스트 붙여넣기
     * @private
     */
    _pasteWithSelection(text, range) {
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
        const cursor = this.viewer.cursor;
        const oldCursorIndex = cursor.getCursorIndex();

        const execute = () => {
            // 선택 영역 삭제
            this._deleteSelectedRange(range.startIndex, range.endIndex);

            // 삭제된 위치에 텍스트 삽입
            const position = this.positionManager.getPositionByIndex(range.startIndex);
            if (position) {
                if (position.cellData) {
                    this._insertTextIntoCell(position.cellData, position, text);
                } else if (position.paraData) {
                    this._insertTextIntoParagraph(position.paraData, position, text);
                }
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 붙여넣은 텍스트 끝으로 이동
                cursor.setCursorPosition(range.startIndex + text.length);

                // 선택 해제
                if (this.rangeManager) {
                    this.rangeManager.clearSelection();
                }
            });

            logger.debug(`📋 Pasted (replace selection): "${text}"`);
        };

        const undo = () => {
            // 이전 문서로 복원
            this.viewer.updateDocument(oldDocument);

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                cursor.setCursorPosition(oldCursorIndex);
            });

            logger.debug(`↶ Undone paste`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Paste');
    }

    /**
     * 커서 위치에 텍스트 붙여넣기
     * @private
     */
    _pasteAtCursor(text) {
        const cursor = this.viewer.cursor;
        const cursorIndex = cursor.getCursorIndex();

        if (cursorIndex < 0) {
            logger.warn('⚠️ Invalid cursor position');
            return;
        }

        const position = this.positionManager.getPositionByIndex(cursorIndex);
        if (!position) {
            return;
        }

        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // 텍스트 삽입
            if (position.cellData) {
                this._insertTextIntoCell(position.cellData, position, text);
            } else if (position.paraData) {
                this._insertTextIntoParagraph(position.paraData, position, text);
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 붙여넣은 텍스트 끝으로 이동
                cursor.setCursorPosition(cursorIndex + text.length);
            });

            logger.debug(`📋 Pasted at cursor: "${text}"`);
        };

        const undo = () => {
            // 이전 문서로 복원
            this.viewer.updateDocument(oldDocument);

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                cursor.setCursorPosition(cursorIndex);
            });

            logger.debug(`↶ Undone paste`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Paste');
    }

    /**
     * 선택된 범위 삭제
     * @private
     */
    _deleteSelectedRange(startIndex, endIndex) {
        if (startIndex >= endIndex) {
            return;
        }

        // 삭제할 범위의 모든 position 가져오기
        const positions = this.positionManager.getPositionList();
        const deleteCount = endIndex - startIndex;

        // 역순으로 삭제 (인덱스 변경 방지)
        for (let i = endIndex - 1; i >= startIndex; i--) {
            const position = positions[i];
            if (!position) continue;

            if (position.cellData) {
                this._deleteCharFromCell(position.cellData, position);
            } else if (position.paraData) {
                this._deleteCharFromParagraph(position.paraData, position);
            }
        }

        logger.debug(`🗑️ Deleted range: ${startIndex}-${endIndex} (${deleteCount} chars)`);
    }

    /**
     * 셀에서 문자 삭제
     * @private
     */
    _deleteCharFromCell(cellData, position) {
        if (!cellData.elements || cellData.elements.length === 0) {
            return;
        }

        const paragraph = cellData.elements[0];
        if (!paragraph.runs || paragraph.runs.length === 0) {
            return;
        }

        const offset = position.textOffset || 0;
        const run = paragraph.runs[0];

        if (run && run.text) {
            // 해당 위치의 문자 삭제
            run.text = run.text.slice(0, offset) + run.text.slice(offset + 1);

            // run이 비면 제거
            if (run.text.length === 0) {
                paragraph.runs.shift();
            }
        }
    }

    /**
     * 단락에서 문자 삭제
     * @private
     */
    _deleteCharFromParagraph(paraData, position) {
        if (!paraData.runs || paraData.runs.length === 0) {
            return;
        }

        const offset = position.textOffset || 0;
        const run = paraData.runs[0];

        if (run && run.text) {
            // 해당 위치의 문자 삭제
            run.text = run.text.slice(0, offset) + run.text.slice(offset + 1);

            // run이 비면 제거
            if (run.text.length === 0) {
                paraData.runs.shift();
            }
        }
    }

    // ===========================
    // Find/Replace Commands
    // ===========================

    /**
     * Find - 텍스트 찾기
     * @param {string} searchText - 검색할 텍스트
     * @param {Object} options - 검색 옵션
     * @returns {number} 찾은 개수
     */
    executeFind(searchText, options = {}) {
        if (!this.viewer.searchManager) {
            logger.warn('⚠️ SearchManager not available');
            return 0;
        }

        const count = this.viewer.searchManager.find(searchText, options);
        logger.debug(`🔍 Find: "${searchText}" - ${count} matches`);
        return count;
    }

    /**
     * Find Next - 다음 찾기
     * @returns {boolean} 성공 여부
     */
    executeFindNext() {
        if (!this.viewer.searchManager) {
            logger.warn('⚠️ SearchManager not available');
            return false;
        }

        return this.viewer.searchManager.findNext();
    }

    /**
     * Find Previous - 이전 찾기
     * @returns {boolean} 성공 여부
     */
    executeFindPrevious() {
        if (!this.viewer.searchManager) {
            logger.warn('⚠️ SearchManager not available');
            return false;
        }

        return this.viewer.searchManager.findPrevious();
    }

    /**
     * Replace - 현재 매치 교체
     * @param {string} replaceText - 교체할 텍스트
     * @returns {boolean} 성공 여부
     */
    executeReplace(replaceText) {
        if (!this.viewer.searchManager) {
            logger.warn('⚠️ SearchManager not available');
            return false;
        }

        const currentMatch = this.viewer.searchManager.getCurrentMatch();
        if (!currentMatch) {
            logger.debug('⚠️ No current match to replace');
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

            logger.debug(`🔄 Replaced: "${currentMatch.text}" → "${replaceText}"`);
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

            logger.debug(`↶ Undone replace`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Replace');
        return true;
    }

    /**
     * Replace All - 모두 교체
     * @param {string} searchText - 검색할 텍스트
     * @param {string} replaceText - 교체할 텍스트
     * @param {Object} options - 검색 옵션
     * @returns {number} 교체된 개수
     */
    executeReplaceAll(searchText, replaceText, options = {}) {
        if (!this.viewer.searchManager) {
            logger.warn('⚠️ SearchManager not available');
            return 0;
        }

        // 먼저 검색 실행
        const count = this.viewer.searchManager.find(searchText, options);
        if (count === 0) {
            logger.debug('⚠️ No matches to replace');
            return 0;
        }

        const matches = this.viewer.searchManager.getMatches();

        // 이전 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
        const cursor = this.viewer.cursor;
        const oldCursorIndex = cursor ? cursor.getCursorIndex() : -1;

        const execute = () => {
            // 역순으로 교체 (인덱스 변경 방지)
            for (let i = matches.length - 1; i >= 0; i--) {
                const match = matches[i];

                // 매치 범위 삭제
                this._deleteSelectedRange(match.startIndex, match.endIndex);

                // 교체 텍스트 삽입
                const position = this.positionManager.getPositionByIndex(match.startIndex);
                if (position) {
                    if (position.cellData) {
                        this._insertTextIntoCell(position.cellData, position, replaceText);
                    } else if (position.paraData) {
                        this._insertTextIntoParagraph(position.paraData, position, replaceText);
                    }
                }
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 첫 번째 교체 위치로 이동
                if (cursor && matches.length > 0) {
                    cursor.setCursorPosition(matches[0].startIndex);
                }

                // 검색 초기화
                if (this.viewer.searchManager) {
                    this.viewer.searchManager.clearSearch();
                }
            });

            logger.debug(`🔄 Replaced all: "${searchText}" → "${replaceText}" (${matches.length} replacements)`);
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

            logger.debug(`↶ Undone replace all`);
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Replace All');
        return matches.length;
    }

    /**
     * Clear Search - 검색 초기화
     */
    executeClearSearch() {
        if (this.viewer.searchManager) {
            this.viewer.searchManager.clearSearch();
        }
    }

    // ===========================
    // Text Alignment Commands
    // ===========================

    /**
     * Align Left - 왼쪽 정렬
     */
    executeAlignLeft() {
        this._executeAlignment('left');
    }

    /**
     * Align Center - 가운데 정렬
     */
    executeAlignCenter() {
        this._executeAlignment('center');
    }

    /**
     * Align Right - 오른쪽 정렬
     */
    executeAlignRight() {
        this._executeAlignment('right');
    }

    /**
     * Align Justify - 양쪽 정렬
     */
    executeAlignJustify() {
        this._executeAlignment('justify');
    }

    /**
     * 정렬 실행
     * @private
     * @param {string} alignment - 'left', 'center', 'right', 'justify'
     */
    _executeAlignment(alignment) {
        const cursor = this.viewer.cursor;
        const rangeManager = this.viewer.rangeManager;

        // 선택 영역이 있으면 선택된 단락들을 정렬
        // 없으면 커서가 있는 단락을 정렬
        const paragraphsToAlign = this._getParagraphsToAlign();

        if (paragraphsToAlign.length === 0) {
            logger.warn('⚠️ No paragraphs to align');
            return;
        }

        // 이전 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
        const oldCursorIndex = cursor ? cursor.getCursorIndex() : -1;

        const execute = () => {
            // 각 단락에 정렬 적용
            paragraphsToAlign.forEach(paraInfo => {
                this._applyAlignmentToParagraph(paraInfo.paraData, alignment);
            });

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                if (cursor && oldCursorIndex >= 0) {
                    cursor.setCursorPosition(oldCursorIndex);
                }
            });

            logger.debug(`⬅️➡️ Applied alignment: ${alignment} to ${paragraphsToAlign.length} paragraph(s)`);
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
            });

            logger.debug(`↶ Undone alignment`);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Align ${alignment}`);
    }

    /**
     * 정렬할 단락들 가져오기
     * @private
     * @returns {Array} 단락 정보 배열
     */
    _getParagraphsToAlign() {
        const paragraphs = [];
        const cursor = this.viewer.cursor;
        const rangeManager = this.viewer.rangeManager;

        // 선택 영역이 있는지 확인
        const range = rangeManager ? rangeManager.getRange() : null;
        const hasSelection = range && range.startIndex !== range.endIndex;

        if (hasSelection) {
            // 선택 영역의 모든 단락 찾기
            const positions = this.positionManager.getPositionList();
            const visitedParas = new Set();

            for (let i = range.startIndex; i <= range.endIndex; i++) {
                const position = positions[i];
                if (!position) continue;

                const paraData = position.paraData;
                const cellData = position.cellData;

                // 중복 방지
                const paraKey = this._getParagraphKey(paraData, cellData);
                if (visitedParas.has(paraKey)) continue;

                visitedParas.add(paraKey);
                paragraphs.push({ paraData, cellData });
            }
        } else if (cursor && cursor.getCursorIndex() >= 0) {
            // 커서가 있는 단락만
            const cursorIndex = cursor.getCursorIndex();
            const position = this.positionManager.getPositionByIndex(cursorIndex);

            if (position && position.paraData) {
                paragraphs.push({
                    paraData: position.paraData,
                    cellData: position.cellData
                });
            }
        }

        return paragraphs;
    }

    /**
     * 단락 키 생성 (중복 방지용)
     * @private
     */
    _getParagraphKey(paraData, cellData) {
        if (cellData) {
            return `cell_${cellData.rowIndex}_${cellData.colIndex}_${paraData.text || ''}`;
        }
        return `para_${paraData.text || ''}`;
    }

    /**
     * 단락에 정렬 적용
     * @private
     */
    _applyAlignmentToParagraph(paraData, alignment) {
        if (!paraData) return;

        // paraPr (단락 속성) 초기화
        if (!paraData.paraPr) {
            paraData.paraPr = {};
        }

        // 정렬 속성 설정
        paraData.paraPr.align = alignment;

        logger.debug(`📝 Applied ${alignment} to paragraph`);
    }

    // ===========================
    // Font Size Commands
    // ===========================

    /**
     * Set Font Size - 글꼴 크기 설정
     * @param {number} size - 글꼴 크기 (pt)
     */
    executeSetFontSize(size) {
        if (!size || size <= 0) {
            logger.warn('⚠️ Invalid font size');
            return;
        }

        const rangeManager = this.rangeManager;
        const cursor = this.viewer.cursor;

        // 선택 영역이 있는지 확인
        const range = rangeManager ? rangeManager.getRange() : null;
        const hasSelection = range && range.startIndex !== range.endIndex;

        if (!hasSelection) {
            logger.debug('⚠️ No text selected for font size change');
            return;
        }

        // 이전 상태 저장
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
        const oldCursorIndex = cursor ? cursor.getCursorIndex() : -1;

        const execute = () => {
            // 선택 영역의 모든 run에 글꼴 크기 적용
            this._applyFontSizeToRange(range.startIndex, range.endIndex, size);

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                if (cursor && oldCursorIndex >= 0) {
                    cursor.setCursorPosition(oldCursorIndex);
                }

                // 선택 영역 유지
                if (rangeManager) {
                    rangeManager.setRange(range.startIndex, range.endIndex);
                }
            });

            logger.debug(`🔤 Applied font size: ${size}pt`);
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

                // 선택 영역 유지
                if (rangeManager) {
                    rangeManager.setRange(range.startIndex, range.endIndex);
                }
            });

            logger.debug(`↶ Undone font size change`);
            return execute;
        };

        this.historyManager.execute(execute, undo, `Set Font Size ${size}pt`);
    }

    /**
     * Increase Font Size - 글꼴 크기 증가
     * @param {number} step - 증가량 (기본값: 2pt)
     */
    executeIncreaseFontSize(step = 2) {
        const currentSize = this._getCurrentFontSize();
        if (currentSize) {
            this.executeSetFontSize(currentSize + step);
        }
    }

    /**
     * Decrease Font Size - 글꼴 크기 감소
     * @param {number} step - 감소량 (기본값: 2pt)
     */
    executeDecreaseFontSize(step = 2) {
        const currentSize = this._getCurrentFontSize();
        if (currentSize && currentSize > step) {
            this.executeSetFontSize(currentSize - step);
        }
    }

    /**
     * 현재 글꼴 크기 가져오기
     * @private
     * @returns {number|null} 현재 글꼴 크기 (pt)
     */
    _getCurrentFontSize() {
        const rangeManager = this.rangeManager;
        const range = rangeManager ? rangeManager.getRange() : null;

        if (!range || range.startIndex === range.endIndex) {
            return null;
        }

        // 선택 영역의 첫 번째 문자의 글꼴 크기 가져오기
        const position = this.positionManager.getPositionByIndex(range.startIndex);
        if (!position) {
            return null;
        }

        // cellData 또는 paraData에서 run 찾기
        let runs = null;
        if (position.cellData && position.cellData.elements && position.cellData.elements.length > 0) {
            runs = position.cellData.elements[0].runs;
        } else if (position.paraData) {
            runs = position.paraData.runs;
        }

        if (!runs || runs.length === 0) {
            return null;
        }

        // 첫 번째 run의 fontSize 가져오기
        const firstRun = runs[0];
        if (firstRun.style?.fontSize) {
            return parseFloat(firstRun.style.fontSize);
        } else if (firstRun.style?.fontSizePx) {
            // px를 pt로 변환 (1pt = 1.333px)
            return parseFloat(firstRun.style.fontSizePx) / 1.333;
        }

        return 12; // 기본값
    }

    /**
     * 범위에 글꼴 크기 적용
     * @private
     */
    _applyFontSizeToRange(startIndex, endIndex, size) {
        const positions = this.positionManager.getPositionList();

        // 각 위치의 run을 찾아서 글꼴 크기 적용
        for (let i = startIndex; i < endIndex; i++) {
            const position = positions[i];
            if (!position) continue;

            // cellData 또는 paraData에서 run 찾기
            let runs = null;
            if (position.cellData && position.cellData.elements && position.cellData.elements.length > 0) {
                runs = position.cellData.elements[0].runs;
            } else if (position.paraData) {
                runs = position.paraData.runs;
            }

            if (!runs || runs.length === 0) continue;

            // 해당 문자가 속한 run 찾기 및 글꼴 크기 적용
            let charCount = 0;
            for (const run of runs) {
                const runLength = run.text?.length || 0;
                const relativeIndex = position.textOffset;

                if (relativeIndex >= charCount && relativeIndex < charCount + runLength) {
                    // 이 run에 글꼴 크기 적용
                    if (!run.style) {
                        run.style = {};
                    }
                    run.style.fontSize = `${size}pt`;
                    run.style.fontSizePx = `${size * 1.333}px`;
                    break;
                }

                charCount += runLength;
            }
        }
    }

    // ===========================
    // Font Family Commands
    // ===========================

    /**
     * 글꼴 종류 설정
     * @param {string} fontFamily - 글꼴 이름 (예: 'Arial', '맑은 고딕')
     */
    executeSetFontFamily(fontFamily) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();
        const hasSelection = range && range.startIndex !== range.endIndex;

        if (!hasSelection) {
            logger.debug('⚠️ No text selected for font family change');
            return;
        }

        logger.info(`🔤 Setting font family to: ${fontFamily}`);

        // 현재 상태 저장 (undo를 위해)
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 글꼴 적용
        this._applyFontFamilyToRange(range.startIndex, range.endIndex, fontFamily);

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, `Set Font Family: ${fontFamily}`);

        logger.debug(`✅ Font family set to: ${fontFamily}`);
    }

    /**
     * 현재 선택된 텍스트의 글꼴 종류 가져오기
     * @returns {string|null} 글꼴 이름 또는 null
     */
    _getCurrentFontFamily() {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range || range.startIndex === range.endIndex) {
            return null;
        }

        // 첫 번째 문자의 글꼴 가져오기
        const positions = this.viewer.getCharacterPositions();
        if (range.startIndex >= positions.length) {
            return null;
        }

        const position = positions[range.startIndex];
        let runs = null;

        if (position.cellData) {
            runs = position.cellData.runs;
        } else if (position.paraData) {
            runs = position.paraData.runs;
        }

        if (!runs || runs.length === 0) {
            return null;
        }

        // 해당 문자가 속한 run 찾기
        let charCount = 0;
        for (const run of runs) {
            const runLength = run.text?.length || 0;
            const relativeIndex = position.textOffset;

            if (relativeIndex >= charCount && relativeIndex < charCount + runLength) {
                return run.style?.fontFamily || null;
            }

            charCount += runLength;
        }

        return null;
    }

    /**
     * 범위에 글꼴 종류 적용
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     * @param {string} fontFamily - 글꼴 이름
     */
    _applyFontFamilyToRange(startIndex, endIndex, fontFamily) {
        const positions = this.viewer.getCharacterPositions();

        for (let i = startIndex; i < endIndex && i < positions.length; i++) {
            const position = positions[i];
            let runs = null;

            if (position.cellData) {
                runs = position.cellData.runs;
            } else if (position.paraData) {
                runs = position.paraData.runs;
            }

            if (!runs || runs.length === 0) continue;

            // 해당 문자가 속한 run 찾기 및 글꼴 적용
            let charCount = 0;
            for (const run of runs) {
                const runLength = run.text?.length || 0;
                const relativeIndex = position.textOffset;

                if (relativeIndex >= charCount && relativeIndex < charCount + runLength) {
                    // 이 run에 글꼴 적용
                    if (!run.style) {
                        run.style = {};
                    }
                    run.style.fontFamily = fontFamily;
                    break;
                }

                charCount += runLength;
            }
        }
    }

    // ===========================
    // Utility Methods
    // ===========================

    /**
     * 현재 문서 가져오기
     * @returns {Object} 문서
     */
    getDocument() {
        return this.viewer.getDocument();
    }

    /**
     * 렌더링
     */
    render() {
        this.viewer.render(this.viewer.getDocument());
    }
}

export default CommandAdapt;
