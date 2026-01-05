/**
 * History Manager v2
 * 함수 기반 Undo/Redo 시스템
 * Canvas-editor의 HistoryManager를 참고하여 메모리 효율적으로 구현
 *
 * @module features/history-manager-v2
 * @version 2.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 함수 기반 히스토리 관리자
 * 전체 문서를 저장하지 않고 복원 함수만 저장하여 메모리 효율 극대화
 */
export class HistoryManagerV2 {
    /**
     * HistoryManagerV2 생성자
     * @param {Object} viewer - HWPX Viewer 인스턴스
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;

        // 현재 실행 중인 명령 (중첩 방지)
        this.isExecuting = false;

        logger.info('🔄 HistoryManagerV2 initialized (function-based)');
    }

    /**
     * 명령 실행 및 히스토리 저장
     * @param {Function} execute - 실행할 함수
     * @param {Function} undo - Undo 함수 (이전 상태로 복원)
     * @param {string} actionName - 액션 이름
     */
    execute(execute, undo, actionName = 'Edit') {
        if (this.isExecuting) {
            logger.warn('⚠️ Already executing a command, skipping history');
            execute();
            return;
        }

        this.isExecuting = true;

        try {
            // 명령 실행
            execute();

            // Undo 함수를 스택에 추가
            this.undoStack.push({
                undo,
                actionName,
                timestamp: Date.now()
            });

            // 최대 히스토리 제한
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
                logger.debug(`  📊 History limit reached, removed oldest`);
            }

            // 새 명령 실행 시 redo 스택 초기화
            this.redoStack = [];

            logger.debug(`✅ Executed: "${actionName}" (Undo stack: ${this.undoStack.length})`);

            // UI 업데이트
            this._updateUI();

        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * 실행 취소
     * @returns {boolean} 성공 여부
     */
    undo() {
        if (this.undoStack.length === 0) {
            logger.warn('⚠️ Nothing to undo');
            return false;
        }

        if (this.isExecuting) {
            logger.warn('⚠️ Command is executing, cannot undo');
            return false;
        }

        this.isExecuting = true;

        try {
            const command = this.undoStack.pop();

            logger.info(`↶ Undoing: "${command.actionName}"`);

            // Undo 함수 실행 (이전 상태로 복원)
            // Undo 함수는 redo를 위한 execute 함수를 반환해야 함
            const redo = command.undo();

            // Redo 스택에 추가
            if (redo && typeof redo === 'function') {
                this.redoStack.push({
                    execute: redo,
                    actionName: command.actionName,
                    timestamp: Date.now()
                });
            }

            logger.info(`✅ Undone: "${command.actionName}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`);

            // UI 업데이트
            this._updateUI();

            return true;

        } catch (error) {
            logger.error('❌ Undo failed:', error);
            return false;

        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * 다시 실행
     * @returns {boolean} 성공 여부
     */
    redo() {
        if (this.redoStack.length === 0) {
            logger.warn('⚠️ Nothing to redo');
            return false;
        }

        if (this.isExecuting) {
            logger.warn('⚠️ Command is executing, cannot redo');
            return false;
        }

        this.isExecuting = true;

        try {
            const command = this.redoStack.pop();

            logger.info(`↷ Redoing: "${command.actionName}"`);

            // Execute 함수 실행 (다시 적용)
            // Execute 함수는 undo를 위한 undo 함수를 반환해야 함
            const undo = command.execute();

            // Undo 스택에 추가
            if (undo && typeof undo === 'function') {
                this.undoStack.push({
                    undo,
                    actionName: command.actionName,
                    timestamp: Date.now()
                });
            }

            logger.info(`✅ Redone: "${command.actionName}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`);

            // UI 업데이트
            this._updateUI();

            return true;

        } catch (error) {
            logger.error('❌ Redo failed:', error);
            return false;

        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * UI 버튼 상태 업데이트
     * @private
     */
    _updateUI() {
        // Undo 버튼
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length === 0;
            undoBtn.title = this.undoStack.length > 0
                ? `실행 취소: ${this.undoStack[this.undoStack.length - 1]?.actionName || 'Edit'}`
                : '실행 취소할 항목 없음';
        }

        // Redo 버튼
        const redoBtn = document.getElementById('redo-btn');
        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0;
            redoBtn.title = this.redoStack.length > 0
                ? `다시 실행: ${this.redoStack[this.redoStack.length - 1]?.actionName || 'Edit'}`
                : '다시 실행할 항목 없음';
        }
    }

    /**
     * 이력 초기화
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];

        logger.info('🗑️ History cleared');
        this._updateUI();
    }

    /**
     * 이력 통계
     * @returns {Object} 통계 정보
     */
    getStats() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0,
            lastAction: this.undoStack.length > 0
                ? this.undoStack[this.undoStack.length - 1].actionName
                : null
        };
    }

    /**
     * Undo 가능 여부
     * @returns {boolean}
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Redo 가능 여부
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * 히스토리 목록 가져오기
     * @returns {Object} {undoList, redoList}
     */
    getHistory() {
        return {
            undoList: this.undoStack.map(cmd => ({
                actionName: cmd.actionName,
                timestamp: cmd.timestamp
            })),
            redoList: this.redoStack.map(cmd => ({
                actionName: cmd.actionName,
                timestamp: cmd.timestamp
            }))
        };
    }
}

export default HistoryManagerV2;
