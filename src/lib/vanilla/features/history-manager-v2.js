/**
 * History Manager v2
 * 함수 기반 Undo/Redo 시스템
 * Canvas-editor의 HistoryManager를 참고하여 메모리 효율적으로 구현
 *
 * @module features/history-manager-v2
 * @version 2.3.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 함수 기반 히스토리 관리자
 * 전체 문서를 저장하지 않고 복원 함수만 저장하여 메모리 효율 극대화
 * ✅ Phase 2 P2: Batch Undo/Redo 최적화
 * ✅ Phase 2 P3: React Context 통합
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

        // ✅ Phase 2 P2: 배치 모드 (여러 Undo/Redo를 한 번에 처리)
        this.batchMode = false;
        this.batchUpdates = [];

        // ✅ Phase 2 P3: React Context 콜백
        this.onStateChange = null;

        logger.info('🔄 HistoryManagerV2 initialized (v2.3.0 with React Context support)');
    }

    /**
     * 명령 실행 및 히스토리 저장
     * ✅ Phase 2 P0: Command Pattern 재설계 - execute와 undo 모두 저장
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

            // ✅ Command 객체 저장 (execute와 undo 모두 포함)
            this.undoStack.push({
                execute,  // ✅ Redo를 위해 저장
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
     * ✅ Phase 2 P0: Command Pattern 재설계 - 전체 command 재사용
     * ✅ Phase 2 P2: 배치 모드에서 UI 업데이트 지연
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

            // ✅ Undo 실행 (이전 상태로 복원)
            command.undo();

            // ✅ Redo 스택에 전체 command 추가 (execute 함수 포함)
            this.redoStack.push(command);

            logger.info(`✅ Undone: "${command.actionName}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`);

            // ✅ Phase 2 P2: 배치 모드가 아니면 즉시 UI 업데이트
            if (!this.batchMode) {
                this._updateUI();
            }

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
     * ✅ Phase 2 P0: Command Pattern 재설계 - 전체 command 재사용
     * ✅ Phase 2 P2: 배치 모드에서 UI 업데이트 지연
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

            // ✅ Execute 다시 실행 (변경 재적용)
            command.execute();

            // ✅ Undo 스택에 전체 command 다시 추가
            this.undoStack.push(command);

            logger.info(`✅ Redone: "${command.actionName}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`);

            // ✅ Phase 2 P2: 배치 모드가 아니면 즉시 UI 업데이트
            if (!this.batchMode) {
                this._updateUI();
            }

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
     * ✅ Phase 2 P3: React Context 콜백 지원
     * @private
     */
    _updateUI() {
        // ✅ Phase 2 P3: History state 객체 생성
        const state = {
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0,
            undoAction: this.undoStack.length > 0
                ? this.undoStack[this.undoStack.length - 1]?.actionName
                : null,
            redoAction: this.redoStack.length > 0
                ? this.redoStack[this.redoStack.length - 1]?.actionName
                : null
        };

        // ✅ Phase 2 P3: React 콜백 호출 (있으면)
        if (this.onStateChange) {
            this.onStateChange(state);
        }

        // ✅ 레거시 DOM 업데이트 (하위 호환성 유지)
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.disabled = !state.canUndo;
            undoBtn.title = state.undoAction
                ? `실행 취소: ${state.undoAction}`
                : '실행 취소할 항목 없음';
        }

        const redoBtn = document.getElementById('redo-btn');
        if (redoBtn) {
            redoBtn.disabled = !state.canRedo;
            redoBtn.title = state.redoAction
                ? `다시 실행: ${state.redoAction}`
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

    /**
     * 배치 Undo 시작
     * ✅ Phase 2 P2: 여러 Undo를 한 번에 처리하여 성능 향상
     * @private
     */
    startBatchUndo() {
        this.batchMode = true;
        this.batchUpdates = [];
        logger.debug('📦 Batch undo mode started');
    }

    /**
     * 배치 Undo 완료
     * ✅ Phase 2 P2: 모든 DOM 업데이트를 한 번에 실행
     * @private
     */
    endBatchUndo() {
        this.batchMode = false;

        // ✅ 모든 DOM 업데이트 한 번에 실행
        logger.debug(`📦 Executing ${this.batchUpdates.length} queued updates`);
        this.batchUpdates.forEach(update => update());
        this.batchUpdates = [];

        // UI 업데이트 (한 번만)
        this._updateUI();

        logger.info('✅ Batch undo completed');
    }

    /**
     * 배치 Redo 시작
     * ✅ Phase 2 P2: 여러 Redo를 한 번에 처리하여 성능 향상
     * @private
     */
    startBatchRedo() {
        this.batchMode = true;
        this.batchUpdates = [];
        logger.debug('📦 Batch redo mode started');
    }

    /**
     * 배치 Redo 완료
     * ✅ Phase 2 P2: 모든 DOM 업데이트를 한 번에 실행
     * @private
     */
    endBatchRedo() {
        this.batchMode = false;

        // ✅ 모든 DOM 업데이트 한 번에 실행
        logger.debug(`📦 Executing ${this.batchUpdates.length} queued updates`);
        this.batchUpdates.forEach(update => update());
        this.batchUpdates = [];

        // UI 업데이트 (한 번만)
        this._updateUI();

        logger.info('✅ Batch redo completed');
    }

    /**
     * 여러 개 Undo 실행
     * ✅ Phase 2 P2: 배치 모드로 여러 Undo를 한 번에 처리
     * @param {number} count - Undo 횟수
     * @returns {number} 실제 실행된 횟수
     */
    undoMultiple(count) {
        if (count <= 0) return 0;

        logger.info(`📦 Starting batch undo (${count} commands)`);

        this.startBatchUndo();

        let executed = 0;
        for (let i = 0; i < count && this.canUndo(); i++) {
            if (this.undo()) {
                executed++;
            }
        }

        this.endBatchUndo();

        logger.info(`✅ Batch undo completed: ${executed}/${count} commands`);
        return executed;
    }

    /**
     * 여러 개 Redo 실행
     * ✅ Phase 2 P2: 배치 모드로 여러 Redo를 한 번에 처리
     * @param {number} count - Redo 횟수
     * @returns {number} 실제 실행된 횟수
     */
    redoMultiple(count) {
        if (count <= 0) return 0;

        logger.info(`📦 Starting batch redo (${count} commands)`);

        this.startBatchRedo();

        let executed = 0;
        for (let i = 0; i < count && this.canRedo(); i++) {
            if (this.redo()) {
                executed++;
            }
        }

        this.endBatchRedo();

        logger.info(`✅ Batch redo completed: ${executed}/${count} commands`);
        return executed;
    }
}

export default HistoryManagerV2;
