/**
 * Range Commands Module
 * 범위 선택 및 관리 명령
 *
 * @module command/range-commands
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 범위 명령 클래스
 */
export class RangeCommands {
    constructor(viewer) {
        this.viewer = viewer;
        this.historyManager = viewer.historyManager;
        this.rangeManager = viewer.rangeManager;
    }

    /**
     * 범위 설정
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     */
    executeSetRange(startIndex, endIndex) {
        if (!this.rangeManager) {
            logger.warn('RangeManager not available');
            return;
        }

        try {
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
            logger.debug('Range set', { startIndex, endIndex });

        } catch (error) {
            logger.error('Failed to set range', error);
            throw error;
        }
    }

    /**
     * 전체 선택
     */
    executeSelectAll() {
        if (!this.rangeManager) {
            logger.warn('RangeManager not available');
            return;
        }

        try {
            const oldRange = this.rangeManager.getRange();

            const execute = () => {
                this.rangeManager.selectAll();
            };

            const undo = () => {
                this.rangeManager.setRange(oldRange.startIndex, oldRange.endIndex);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Select All');
            logger.debug('Select all executed');

        } catch (error) {
            logger.error('Failed to select all', error);
            throw error;
        }
    }

    /**
     * 선택 해제
     */
    executeClearSelection() {
        if (!this.rangeManager) {
            return;
        }

        try {
            const oldRange = this.rangeManager.getRange();

            const execute = () => {
                this.rangeManager.clearSelection();
            };

            const undo = () => {
                this.rangeManager.setRange(oldRange.startIndex, oldRange.endIndex);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Clear Selection');
            logger.debug('Selection cleared');

        } catch (error) {
            logger.error('Failed to clear selection', error);
            throw error;
        }
    }

    /**
     * 현재 선택 영역 가져오기
     */
    getCurrentRange() {
        if (!this.rangeManager) {
            return null;
        }
        return this.rangeManager.getRange();
    }

    /**
     * 선택 영역이 있는지 확인
     */
    hasSelection() {
        if (!this.rangeManager) {
            return false;
        }
        return this.rangeManager.hasSelection();
    }

    /**
     * 선택된 텍스트 가져오기
     */
    getSelectedText() {
        if (!this.rangeManager || !this.rangeManager.hasSelection()) {
            return '';
        }

        try {
            return this.rangeManager.getSelectedText();
        } catch (error) {
            logger.error('Failed to get selected text', error);
            return '';
        }
    }

    /**
     * 커서 위치 이동
     */
    moveCursor(position) {
        if (!this.rangeManager) {
            return;
        }

        try {
            const oldRange = this.rangeManager.getRange();

            const execute = () => {
                this.rangeManager.setCursor(position);
            };

            const undo = () => {
                this.rangeManager.setRange(oldRange.startIndex, oldRange.endIndex);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Move Cursor');
            logger.debug('Cursor moved', { position });

        } catch (error) {
            logger.error('Failed to move cursor', error);
            throw error;
        }
    }
}

export default RangeCommands;