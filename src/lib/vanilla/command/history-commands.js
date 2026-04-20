/**
 * History Commands Module
 * 히스토리 관리 명령 (Undo/Redo)
 *
 * @module command/history-commands
 * @version 1.0.0
 * @author Kwang-il Kim (김광일) <yatav@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 히스토리 명령 클래스
 */
export class HistoryCommands {
  constructor(viewer) {
    this.viewer = viewer;
    this.historyManager = viewer.historyManager;
  }

  /**
   * Undo 실행
   */
  executeUndo() {
    try {
      const result = this.historyManager.undo();
      logger.debug('Undo executed', { result });
      return result;
    } catch (error) {
      logger.error('Failed to execute undo', error);
      throw error;
    }
  }

  /**
   * Redo 실행
   */
  executeRedo() {
    try {
      const result = this.historyManager.redo();
      logger.debug('Redo executed', { result });
      return result;
    } catch (error) {
      logger.error('Failed to execute redo', error);
      throw error;
    }
  }

  /**
   * 히스토리 상태 확인
   */
  canUndo() {
    return this.historyManager ? this.historyManager.canUndo() : false;
  }

  /**
   * 히스토리 상태 확인
   */
  canRedo() {
    return this.historyManager ? this.historyManager.canRedo() : false;
  }

  /**
   * 히스토리 클리어
   */
  clearHistory() {
    try {
      if (this.historyManager) {
        this.historyManager.clear();
        logger.debug('History cleared');
      }
    } catch (error) {
      logger.error('Failed to clear history', error);
      throw error;
    }
  }
}

export default HistoryCommands;
