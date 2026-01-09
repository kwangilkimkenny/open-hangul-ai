/**
 * History Manager
 * Undo/Redo 기능 구현
 * 
 * @module features/history-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('HistoryManager');

/**
 * 이력 관리자 클래스
 */
export class HistoryManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50; // 최대 50단계 저장
        this.currentState = null;
        
        logger.info('↶ HistoryManager initialized');
    }

    /**
     * 현재 상태 저장
     * @param {string} [actionName='편집'] - 액션 이름
     */
    saveState(actionName = '편집') {
        const document = this.viewer.getDocument();
        if (!document) {
            logger.warn('⚠️ No document to save');
            return;
        }

        // 문서 상태 직렬화 (Deep clone)
        const state = {
            document: JSON.parse(JSON.stringify(document)),
            actionName,
            timestamp: Date.now()
        };

        // 현재 상태가 있으면 undo 스택에 추가
        if (this.currentState) {
            this.undoStack.push(this.currentState);
            
            // 최대 이력 제한
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
                logger.debug('  ⚠️ History limit reached, removed oldest');
            }
        }

        this.currentState = state;
        
        // 새 상태 저장 시 redo 스택 초기화
        this.redoStack = [];

        logger.info(`💾 State saved: "${actionName}" (Undo stack: ${this.undoStack.length})`);
        
        // UI 업데이트
        this._updateUI();
    }

    /**
     * 실행 취소 (Undo)
     * @returns {boolean} 성공 여부
     */
    undo() {
        if (this.undoStack.length === 0) {
            logger.warn('⚠️ Nothing to undo');
            return false;
        }

        logger.info('↶ Undoing...');

        // 현재 상태를 redo 스택에 저장
        if (this.currentState) {
            this.redoStack.push(this.currentState);
        }

        // undo 스택에서 이전 상태 가져오기
        const previousState = this.undoStack.pop();
        this.currentState = previousState;

        // 문서 복원
        this.viewer.updateDocument(previousState.document);

        logger.info(`✅ Undone: "${previousState.actionName}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`);
        
        // UI 업데이트
        this._updateUI();
        
        return true;
    }

    /**
     * 다시 실행 (Redo)
     * @returns {boolean} 성공 여부
     */
    redo() {
        if (this.redoStack.length === 0) {
            logger.warn('⚠️ Nothing to redo');
            return false;
        }

        logger.info('↷ Redoing...');

        // 현재 상태를 undo 스택에 저장
        if (this.currentState) {
            this.undoStack.push(this.currentState);
        }

        // redo 스택에서 다음 상태 가져오기
        const nextState = this.redoStack.pop();
        this.currentState = nextState;

        // 문서 복원
        this.viewer.updateDocument(nextState.document);

        logger.info(`✅ Redone: "${nextState.actionName}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`);
        
        // UI 업데이트
        this._updateUI();
        
        return true;
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
                ? `실행 취소: ${this.undoStack[this.undoStack.length - 1]?.actionName || '편집'}`
                : '실행 취소할 항목 없음';
        }

        // Redo 버튼
        const redoBtn = document.getElementById('redo-btn');
        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0;
            redoBtn.title = this.redoStack.length > 0
                ? `다시 실행: ${this.redoStack[this.redoStack.length - 1]?.actionName || '편집'}`
                : '다시 실행할 항목 없음';
        }
    }

    /**
     * 이력 초기화
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentState = null;
        
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
            lastAction: this.currentState?.actionName || null
        };
    }

    /**
     * 초기 상태 설정 (문서 로드 시)
     * @param {Object} document - 초기 문서
     */
    setInitialState(document) {
        this.clear();
        this.currentState = {
            document: JSON.parse(JSON.stringify(document)),
            actionName: '문서 로드',
            timestamp: Date.now()
        };
        
        logger.info('📄 Initial state set');
        this._updateUI();
    }
}

export default HistoryManager;

