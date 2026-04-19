/**
 * Table Commands Module
 * 테이블 관련 명령
 *
 * @module command/table-commands
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 테이블 명령 클래스
 */
export class TableCommands {
    constructor(viewer) {
        this.viewer = viewer;
        this.historyManager = viewer.historyManager;
    }

    /**
     * 행 추가 (위)
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeAddRowAbove(cellElement) {
        try {
            this._executeTableCommand('addRowAbove', cellElement, 'Add Row Above');
            logger.debug('Row added above', { cellElement });
        } catch (error) {
            logger.error('Failed to add row above', error);
            throw error;
        }
    }

    /**
     * 행 추가 (아래)
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeAddRowBelow(cellElement) {
        try {
            this._executeTableCommand('addRowBelow', cellElement, 'Add Row Below');
            logger.debug('Row added below', { cellElement });
        } catch (error) {
            logger.error('Failed to add row below', error);
            throw error;
        }
    }

    /**
     * 열 추가 (왼쪽)
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeAddColumnLeft(cellElement) {
        try {
            this._executeTableCommand('addColumnLeft', cellElement, 'Add Column Left');
            logger.debug('Column added left', { cellElement });
        } catch (error) {
            logger.error('Failed to add column left', error);
            throw error;
        }
    }

    /**
     * 열 추가 (오른쪽)
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeAddColumnRight(cellElement) {
        try {
            this._executeTableCommand('addColumnRight', cellElement, 'Add Column Right');
            logger.debug('Column added right', { cellElement });
        } catch (error) {
            logger.error('Failed to add column right', error);
            throw error;
        }
    }

    /**
     * 행 삭제
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeDeleteRow(cellElement) {
        try {
            this._executeTableCommand('deleteRow', cellElement, 'Delete Row');
            logger.debug('Row deleted', { cellElement });
        } catch (error) {
            logger.error('Failed to delete row', error);
            throw error;
        }
    }

    /**
     * 열 삭제
     * @param {HTMLElement} cellElement - 기준 셀
     */
    executeDeleteColumn(cellElement) {
        try {
            this._executeTableCommand('deleteColumn', cellElement, 'Delete Column');
            logger.debug('Column deleted', { cellElement });
        } catch (error) {
            logger.error('Failed to delete column', error);
            throw error;
        }
    }

    /**
     * 테이블 삽입
     * @param {number} rows - 행 수
     * @param {number} cols - 열 수
     */
    executeInsertTable(rows = 3, cols = 3) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('TableEditor not available');
            return;
        }

        try {
            // 현재 편집 중인 내용을 먼저 저장 (텍스트 유실 방지)
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
            logger.debug('Table inserted', { rows, cols });

        } catch (error) {
            logger.error('Failed to insert table', error);
            throw error;
        }
    }

    /**
     * 테이블 삭제
     * @param {HTMLElement} cellElement - 테이블 내 셀
     */
    executeDeleteTable(cellElement) {
        try {
            this._executeTableCommand('deleteTable', cellElement, 'Delete Table');
            logger.debug('Table deleted', { cellElement });
        } catch (error) {
            logger.error('Failed to delete table', error);
            throw error;
        }
    }

    /**
     * 셀 병합
     * @param {HTMLElement[]} cells - 병합할 셀들
     */
    executeMergeCells(cells) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('TableEditor not available');
            return;
        }

        try {
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
            logger.debug('Cells merged', { cellCount: cells.length });

        } catch (error) {
            logger.error('Failed to merge cells', error);
            throw error;
        }
    }

    /**
     * 셀 분할
     * @param {HTMLElement} cellElement - 분할할 셀
     */
    executeSplitCell(cellElement) {
        try {
            this._executeTableCommand('splitCell', cellElement, 'Split Cell');
            logger.debug('Cell split', { cellElement });
        } catch (error) {
            logger.error('Failed to split cell', error);
            throw error;
        }
    }

    /**
     * 셀 배경색 설정
     * @param {HTMLElement} cellElement - 대상 셀
     * @param {string} color - 배경색
     */
    executeSetCellBackgroundColor(cellElement, color) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('TableEditor not available');
            return;
        }

        try {
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
            logger.debug('Cell background color set', { cellElement, color });

        } catch (error) {
            logger.error('Failed to set cell background color', error);
            throw error;
        }
    }

    /**
     * 셀 테두리 설정
     * @param {HTMLElement} cellElement - 대상 셀
     * @param {Object} borders - 테두리 설정
     */
    executeSetCellBorders(cellElement, borders) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('TableEditor not available');
            return;
        }

        try {
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
            logger.debug('Cell borders set', { cellElement, borders });

        } catch (error) {
            logger.error('Failed to set cell borders', error);
            throw error;
        }
    }

    /**
     * 테이블 명령 헬퍼
     * @private
     */
    _executeTableCommand(commandName, cellElement, actionName) {
        const tableEditor = this.viewer.tableEditor;
        if (!tableEditor) {
            logger.warn('TableEditor not available');
            return;
        }

        try {
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
            logger.debug(`Table command executed: ${commandName}`, { actionName });

        } catch (error) {
            logger.error(`Failed to execute table command: ${commandName}`, error);
            throw error;
        }
    }

    /**
     * 테이블 존재 여부 확인
     */
    hasTable() {
        return !!this.viewer.tableEditor;
    }

    /**
     * 현재 셀이 테이블 내부인지 확인
     */
    isInTable(element) {
        if (!element) return false;

        let current = element;
        while (current && current !== document.body) {
            if (current.tagName === 'TABLE' || current.classList.contains('hwp-table')) {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    }

    /**
     * 현재 셀 정보 가져오기
     */
    getCurrentCell() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        let element = range.commonAncestorContainer;

        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }

        while (element && !this.isCellElement(element)) {
            element = element.parentElement;
        }

        return element;
    }

    /**
     * 요소가 셀인지 확인
     */
    isCellElement(element) {
        return element && (
            element.tagName === 'TD' ||
            element.tagName === 'TH' ||
            element.classList.contains('hwp-cell')
        );
    }
}

export default TableCommands;