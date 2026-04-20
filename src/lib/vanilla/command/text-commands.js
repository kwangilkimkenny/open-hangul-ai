/**
 * Text Editing Commands
 * 텍스트 편집 관련 명령 모듈
 *
 * @module command/text-commands
 * @version 1.0.0
 * @author Kwang-il Kim (김광일) <yatav@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 텍스트 편집 명령 클래스
 */
export class TextCommands {
  constructor(viewer) {
    this.viewer = viewer;
    this.historyManager = viewer.historyManager;
    this.rangeManager = viewer.rangeManager;
  }

  /**
   * 볼드 적용/해제
   */
  executeBold(value = true) {
    try {
      this._applyTextStyle('fontWeight', value ? 'bold' : 'normal');
      logger.debug('Bold applied', { value });
    } catch (error) {
      logger.error('Failed to apply bold', error);
      throw error;
    }
  }

  /**
   * 이탤릭 적용/해제
   */
  executeItalic(value = true) {
    try {
      this._applyTextStyle('fontStyle', value ? 'italic' : 'normal');
      logger.debug('Italic applied', { value });
    } catch (error) {
      logger.error('Failed to apply italic', error);
      throw error;
    }
  }

  /**
   * 밑줄 적용/해제
   */
  executeUnderline(value = true) {
    try {
      this._applyTextStyle('textDecoration', value ? 'underline' : 'none');
      logger.debug('Underline applied', { value });
    } catch (error) {
      logger.error('Failed to apply underline', error);
      throw error;
    }
  }

  /**
   * 취소선 적용/해제
   */
  executeStrikethrough(value = true) {
    try {
      this._applyTextStyle('textDecoration', value ? 'line-through' : 'none');
      logger.debug('Strikethrough applied', { value });
    } catch (error) {
      logger.error('Failed to apply strikethrough', error);
      throw error;
    }
  }

  /**
   * 글자색 변경
   */
  executeColor(color) {
    try {
      if (!this._isValidColor(color)) {
        throw new Error('Invalid color format');
      }
      this._applyTextStyle('color', color);
      logger.debug('Color applied', { color });
    } catch (error) {
      logger.error('Failed to apply color', error);
      throw error;
    }
  }

  /**
   * 형광펜 적용
   */
  executeHighlight(color) {
    try {
      if (!this._isValidColor(color)) {
        throw new Error('Invalid highlight color format');
      }
      this._applyTextStyle('backgroundColor', color);
      logger.debug('Highlight applied', { color });
    } catch (error) {
      logger.error('Failed to apply highlight', error);
      throw error;
    }
  }

  /**
   * 위첨자 적용/해제
   */
  executeSuperscript(value = true) {
    try {
      if (value) {
        this._applyTextStyle('verticalAlign', 'super');
        this._applyTextStyle('fontSize', '0.8em');
      } else {
        this._applyTextStyle('verticalAlign', 'baseline');
        this._applyTextStyle('fontSize', '1em');
      }
      logger.debug('Superscript applied', { value });
    } catch (error) {
      logger.error('Failed to apply superscript', error);
      throw error;
    }
  }

  /**
   * 아래첨자 적용/해제
   */
  executeSubscript(value = true) {
    try {
      if (value) {
        this._applyTextStyle('verticalAlign', 'sub');
        this._applyTextStyle('fontSize', '0.8em');
      } else {
        this._applyTextStyle('verticalAlign', 'baseline');
        this._applyTextStyle('fontSize', '1em');
      }
      logger.debug('Subscript applied', { value });
    } catch (error) {
      logger.error('Failed to apply subscript', error);
      throw error;
    }
  }

  /**
   * 폰트 크기 변경
   */
  executeFontSize(size) {
    try {
      if (typeof size === 'number' && size > 0) {
        this._applyTextStyle('fontSize', `${size}pt`);
      } else if (typeof size === 'string') {
        this._applyTextStyle('fontSize', size);
      } else {
        throw new Error('Invalid font size');
      }
      logger.debug('Font size applied', { size });
    } catch (error) {
      logger.error('Failed to apply font size', error);
      throw error;
    }
  }

  /**
   * 폰트 패밀리 변경
   */
  executeFontFamily(fontFamily) {
    try {
      if (!fontFamily || typeof fontFamily !== 'string') {
        throw new Error('Invalid font family');
      }
      this._applyTextStyle('fontFamily', fontFamily);
      logger.debug('Font family applied', { fontFamily });
    } catch (error) {
      logger.error('Failed to apply font family', error);
      throw error;
    }
  }

  /**
   * 텍스트 정렬
   */
  executeTextAlign(alignment) {
    try {
      const validAlignments = ['left', 'center', 'right', 'justify'];
      if (!validAlignments.includes(alignment)) {
        throw new Error('Invalid text alignment');
      }
      this._applyParagraphStyle('textAlign', alignment);
      logger.debug('Text alignment applied', { alignment });
    } catch (error) {
      logger.error('Failed to apply text alignment', error);
      throw error;
    }
  }

  /**
   * 줄 간격 설정
   */
  executeLineHeight(height) {
    try {
      if (typeof height === 'number' && height > 0) {
        this._applyParagraphStyle('lineHeight', height);
      } else if (typeof height === 'string') {
        this._applyParagraphStyle('lineHeight', height);
      } else {
        throw new Error('Invalid line height');
      }
      logger.debug('Line height applied', { height });
    } catch (error) {
      logger.error('Failed to apply line height', error);
      throw error;
    }
  }

  /**
   * 들여쓰기
   */
  executeIndent() {
    try {
      this._adjustIndentation(1);
      logger.debug('Indent applied');
    } catch (error) {
      logger.error('Failed to apply indent', error);
      throw error;
    }
  }

  /**
   * 내어쓰기
   */
  executeOutdent() {
    try {
      this._adjustIndentation(-1);
      logger.debug('Outdent applied');
    } catch (error) {
      logger.error('Failed to apply outdent', error);
      throw error;
    }
  }

  /**
   * 텍스트 스타일 적용 (내부 메서드)
   */
  _applyTextStyle(property, value) {
    if (!this.rangeManager || !this.rangeManager.hasSelection()) {
      logger.warn('No text selection for style application');
      return;
    }

    const range = this.rangeManager.getRange();
    const elements = this.rangeManager.getElementsInRange(range);

    // 히스토리에 기록
    if (this.historyManager) {
      this.historyManager.saveState();
    }

    elements.forEach(element => {
      if (element.style) {
        element.style[property] = value;
      }
    });

    // 변경 사항 알림
    this.viewer.emit('styleChanged', { property, value, range });
  }

  /**
   * 단락 스타일 적용 (내부 메서드)
   */
  _applyParagraphStyle(property, value) {
    if (!this.rangeManager) {
      logger.warn('RangeManager not available');
      return;
    }

    const range = this.rangeManager.getRange();
    const paragraphs = this.rangeManager.getParagraphsInRange(range);

    // 히스토리에 기록
    if (this.historyManager) {
      this.historyManager.saveState();
    }

    paragraphs.forEach(paragraph => {
      if (paragraph.style) {
        paragraph.style[property] = value;
      }
    });

    // 변경 사항 알림
    this.viewer.emit('paragraphStyleChanged', { property, value, paragraphs });
  }

  /**
   * 들여쓰기 조정 (내부 메서드)
   */
  _adjustIndentation(delta) {
    if (!this.rangeManager) {
      logger.warn('RangeManager not available');
      return;
    }

    const range = this.rangeManager.getRange();
    const paragraphs = this.rangeManager.getParagraphsInRange(range);

    // 히스토리에 기록
    if (this.historyManager) {
      this.historyManager.saveState();
    }

    paragraphs.forEach(paragraph => {
      const currentIndent = parseInt(paragraph.style?.marginLeft || '0');
      const newIndent = Math.max(0, currentIndent + delta * 20); // 20px씩 조정

      if (paragraph.style) {
        paragraph.style.marginLeft = `${newIndent}px`;
      }
    });

    // 변경 사항 알림
    this.viewer.emit('indentationChanged', { delta, paragraphs });
  }

  /**
   * 색상 유효성 검증 (내부 메서드)
   */
  _isValidColor(color) {
    if (typeof color !== 'string') return false;

    // HEX 색상 (예: #ff0000, #f00)
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
      return true;
    }

    // RGB/RGBA 색상 (예: rgb(255,0,0), rgba(255,0,0,0.5))
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[0-9.]+\s*)?\)$/.test(color)) {
      return true;
    }

    // HSL/HSLA 색상
    if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[0-9.]+\s*)?\)$/.test(color)) {
      return true;
    }

    // 색상 이름 (기본적인 것들)
    const namedColors = [
      'red',
      'green',
      'blue',
      'black',
      'white',
      'yellow',
      'orange',
      'purple',
      'pink',
      'brown',
      'gray',
      'grey',
      'transparent',
    ];

    return namedColors.includes(color.toLowerCase());
  }

  /**
   * 현재 스타일 정보 가져오기
   */
  getCurrentStyles() {
    if (!this.rangeManager || !this.rangeManager.hasSelection()) {
      return null;
    }

    const range = this.rangeManager.getRange();
    const firstElement = this.rangeManager.getFirstElementInRange(range);

    if (!firstElement || !firstElement.style) {
      return null;
    }

    return {
      fontWeight: firstElement.style.fontWeight || 'normal',
      fontStyle: firstElement.style.fontStyle || 'normal',
      textDecoration: firstElement.style.textDecoration || 'none',
      color: firstElement.style.color || 'black',
      backgroundColor: firstElement.style.backgroundColor || 'transparent',
      fontSize: firstElement.style.fontSize || '12pt',
      fontFamily: firstElement.style.fontFamily || 'Arial',
      textAlign: firstElement.style.textAlign || 'left',
      lineHeight: firstElement.style.lineHeight || '1.2',
    };
  }
}

export default TextCommands;
