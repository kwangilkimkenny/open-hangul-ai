/**
 * Shape Commands Module
 * 도형 관련 명령
 *
 * @module command/shape-commands
 * @version 1.0.0
 * @author Kwang-il Kim (김광일) <yatav@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 도형 명령 클래스
 */
export class ShapeCommands {
  constructor(viewer) {
    this.viewer = viewer;
    this.historyManager = viewer.historyManager;
  }

  /**
   * Ensure ShapeEditor is loaded
   * @returns {Promise<void>}
   * @private
   */
  async _ensureShapeEditor() {
    if (!this.viewer.shapeEditor) {
      logger.info('ShapeEditor not loaded, loading now...');
      await this.viewer.loadShapeEditor();
    }
  }

  /**
   * 도형 삽입
   * @param {string} shapeType - 도형 타입
   * @param {Object} options - 옵션
   */
  async executeInsertShape(shapeType, options = {}) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape inserted', { shapeType, options });
    } catch (error) {
      logger.error('Failed to insert shape', error);
      throw error;
    }
  }

  /**
   * 도형 삭제
   * @param {HTMLElement} shapeElement - 도형 요소
   */
  async executeDeleteShape(shapeElement) {
    try {
      await this._executeShapeCommand('deleteShape', shapeElement, 'Delete Shape');
      logger.debug('Shape deleted', { shapeElement });
    } catch (error) {
      logger.error('Failed to delete shape', error);
      throw error;
    }
  }

  /**
   * 도형 크기 조정
   * @param {HTMLElement} shapeElement - 도형 요소
   * @param {number} width - 너비
   * @param {number} height - 높이
   */
  async executeResizeShape(shapeElement, width, height) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape resized', { shapeElement, width, height });
    } catch (error) {
      logger.error('Failed to resize shape', error);
      throw error;
    }
  }

  /**
   * 도형 위치 설정
   * @param {HTMLElement} shapeElement - 도형 요소
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   */
  async executeSetShapePosition(shapeElement, x, y) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape position set', { shapeElement, x, y });
    } catch (error) {
      logger.error('Failed to set shape position', error);
      throw error;
    }
  }

  /**
   * 도형 채우기 색상 설정
   * @param {HTMLElement} shapeElement - 도형 요소
   * @param {string} color - 채우기 색상
   */
  async executeSetShapeFillColor(shapeElement, color) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape fill color set', { shapeElement, color });
    } catch (error) {
      logger.error('Failed to set shape fill color', error);
      throw error;
    }
  }

  /**
   * 도형 테두리 설정
   * @param {HTMLElement} shapeElement - 도형 요소
   * @param {string} color - 테두리 색상
   * @param {number} width - 테두리 두께
   */
  async executeSetShapeStroke(shapeElement, color, width) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape stroke set', { shapeElement, color, width });
    } catch (error) {
      logger.error('Failed to set shape stroke', error);
      throw error;
    }
  }

  /**
   * 도형 회전
   * @param {HTMLElement} shapeElement - 도형 요소
   * @param {number} degrees - 회전 각도
   */
  async executeRotateShape(shapeElement, degrees) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape rotated', { shapeElement, degrees });
    } catch (error) {
      logger.error('Failed to rotate shape', error);
      throw error;
    }
  }

  /**
   * 도형 불투명도 설정
   * @param {HTMLElement} shapeElement - 도형 요소
   * @param {number} opacity - 불투명도
   */
  async executeSetShapeOpacity(shapeElement, opacity) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape opacity set', { shapeElement, opacity });
    } catch (error) {
      logger.error('Failed to set shape opacity', error);
      throw error;
    }
  }

  /**
   * 도형 텍스트 설정
   * @param {HTMLElement} shapeElement - 도형 요소
   * @param {string} text - 텍스트
   */
  async executeSetShapeText(shapeElement, text) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape text set', { shapeElement, text });
    } catch (error) {
      logger.error('Failed to set shape text', error);
      throw error;
    }
  }

  /**
   * 도형 테두리 둥글기 설정
   * @param {HTMLElement} shapeElement - 도형 요소
   * @param {number} radius - 둥글기
   */
  async executeSetShapeBorderRadius(shapeElement, radius) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug('Shape border radius set', { shapeElement, radius });
    } catch (error) {
      logger.error('Failed to set shape border radius', error);
      throw error;
    }
  }

  /**
   * 도형 명령 헬퍼
   * @private
   */
  async _executeShapeCommand(commandName, shapeElement, actionName) {
    try {
      // Lazy load ShapeEditor if needed
      await this._ensureShapeEditor();

      const shapeEditor = this.viewer.shapeEditor;
      if (!shapeEditor) {
        logger.warn('ShapeEditor not available');
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
      logger.debug(`Shape command executed: ${commandName}`, { actionName });
    } catch (error) {
      logger.error(`Failed to execute shape command: ${commandName}`, error);
      throw error;
    }
  }

  /**
   * 도형이 선택되어 있는지 확인
   */
  hasSelectedShape() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    let element = range.commonAncestorContainer;

    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }

    while (element && element !== document.body) {
      if (element.classList.contains('hwp-shape') || element.tagName === 'SVG') {
        return element;
      }
      element = element.parentElement;
    }

    return null;
  }

  /**
   * 현재 선택된 도형 가져오기
   */
  getSelectedShape() {
    return this.hasSelectedShape();
  }

  /**
   * 도형 요소인지 확인
   */
  isShapeElement(element) {
    return (
      element &&
      (element.classList.contains('hwp-shape') ||
        element.tagName === 'SVG' ||
        element.tagName === 'CIRCLE' ||
        element.tagName === 'RECT' ||
        element.tagName === 'POLYGON' ||
        element.tagName === 'PATH')
    );
  }

  /**
   * 도형 정보 가져오기
   */
  getShapeInfo(shapeElement) {
    if (!this.isShapeElement(shapeElement)) {
      return null;
    }

    const style = window.getComputedStyle(shapeElement);

    return {
      type: shapeElement.getAttribute('data-shape-type') || 'unknown',
      width: shapeElement.clientWidth || style.width,
      height: shapeElement.clientHeight || style.height,
      position: {
        x: shapeElement.offsetLeft || style.left,
        y: shapeElement.offsetTop || style.top,
      },
      fillColor: style.fill || style.backgroundColor,
      strokeColor: style.stroke || style.borderColor,
      strokeWidth: style.strokeWidth || style.borderWidth,
      opacity: style.opacity || 1,
      rotation: shapeElement.style.transform || '0',
      text: shapeElement.textContent || '',
      borderRadius: style.borderRadius || 0,
    };
  }

  /**
   * Shape Editor 사용 가능 여부 확인
   */
  hasShapeEditor() {
    return !!this.viewer.shapeEditor;
  }

  /**
   * 지원하는 도형 타입 목록
   */
  getSupportedShapeTypes() {
    return [
      'rectangle',
      'circle',
      'ellipse',
      'triangle',
      'polygon',
      'line',
      'arrow',
      'text-box',
      'callout',
    ];
  }
}

export default ShapeCommands;
