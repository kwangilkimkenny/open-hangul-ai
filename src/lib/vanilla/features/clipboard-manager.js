/**
 * Clipboard Manager
 * 서식을 유지한 복사/붙여넣기 및 서식 복사 (Alt+C)
 *
 * @module features/clipboard-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('ClipboardManager');

/**
 * 클립보드 관리 클래스
 * 서식 정보를 포함한 복사/붙여넣기 지원
 */
export class ClipboardManager {
  constructor(viewer) {
    this.viewer = viewer;

    // 내부 클립보드 (서식 포함)
    this.clipboard = null;

    // 서식만 복사용 클립보드 (Alt+C)
    this.formatClipboard = null;

    // 서식 복사 모드 활성화 상태
    this.formatPasteMode = false;

    logger.info('📋 ClipboardManager initialized');
  }

  /**
   * 서식 포함 복사 (Ctrl+C 확장)
   * @returns {boolean} 성공 여부
   */
  copy() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      logger.warn('⚠️ No text selected for copy');
      return false;
    }

    try {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString();

      // 서식 정보 추출
      const formatInfo = this._extractFormatInfo(range);

      // 내부 클립보드에 저장
      this.clipboard = {
        text: selectedText,
        html: this._getSelectionHtml(selection),
        format: formatInfo,
        timestamp: Date.now(),
      };

      // 시스템 클립보드에도 복사 (HTML 포함)
      if (navigator.clipboard && navigator.clipboard.write) {
        const htmlBlob = new Blob([this.clipboard.html], { type: 'text/html' });
        const textBlob = new Blob([selectedText], { type: 'text/plain' });

        navigator.clipboard
          .write([
            new ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob,
            }),
          ])
          .catch(err => {
            // Fallback to execCommand
            document.execCommand('copy');
          });
      } else {
        document.execCommand('copy');
      }

      logger.info(`📋 Copied: "${selectedText.substring(0, 30)}..." with format`);
      return true;
    } catch (error) {
      logger.error('❌ Copy failed:', error);
      return false;
    }
  }

  /**
   * 서식 포함 잘라내기 (Ctrl+X)
   * @returns {boolean} 성공 여부
   */
  cut() {
    const copyResult = this.copy();
    if (copyResult) {
      // 선택 영역 삭제
      document.execCommand('delete');
      logger.info('✂️ Cut completed');
      return true;
    }
    return false;
  }

  /**
   * 서식 포함 붙여넣기 (Ctrl+V 확장)
   * @returns {boolean} 성공 여부
   */
  async paste() {
    const editingCell = this._getEditingCell();
    if (!editingCell) {
      logger.warn('⚠️ No editing cell for paste');
      return false;
    }

    try {
      // 내부 클립보드가 있고 최근 것이면 사용
      if (this.clipboard && Date.now() - this.clipboard.timestamp < 60000) {
        // HTML로 붙여넣기 (서식 유지)
        document.execCommand('insertHTML', false, this.clipboard.html);
        logger.info('📋 Pasted with format from internal clipboard');

        // 변경 콜백 호출
        this._triggerChange('paste');
        return true;
      }

      // 시스템 클립보드에서 읽기
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            const html = await blob.text();
            document.execCommand('insertHTML', false, this._sanitizeHtml(html));
            logger.info('📋 Pasted HTML from system clipboard');
            this._triggerChange('paste');
            return true;
          }
        }
      }

      // Fallback: 일반 붙여넣기
      document.execCommand('paste');
      return true;
    } catch (error) {
      logger.error('❌ Paste failed:', error);
      // Fallback
      document.execCommand('paste');
      return false;
    }
  }

  /**
   * 서식만 복사 (Alt+C) - 한글 고유 기능
   * @returns {boolean} 성공 여부
   */
  copyFormat() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      logger.warn('⚠️ No selection for format copy');
      return false;
    }

    try {
      const range = selection.getRangeAt(0);
      const formatInfo = this._extractFormatInfo(range);

      this.formatClipboard = {
        charShape: formatInfo.charShape,
        paraShape: formatInfo.paraShape,
        timestamp: Date.now(),
      };

      // 서식 붙여넣기 모드 활성화
      this.formatPasteMode = true;

      // 시각적 피드백
      this._showFormatCopyIndicator();

      logger.info('🎨 Format copied (Alt+C mode active)');
      return true;
    } catch (error) {
      logger.error('❌ Format copy failed:', error);
      return false;
    }
  }

  /**
   * 서식 붙여넣기 (Alt+C 후 선택 영역에 적용)
   * @returns {boolean} 성공 여부
   */
  pasteFormat() {
    if (!this.formatClipboard) {
      logger.warn('⚠️ No format in clipboard');
      return false;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      logger.warn('⚠️ No text selected for format paste');
      return false;
    }

    try {
      const range = selection.getRangeAt(0);
      const format = this.formatClipboard.charShape;

      // 선택 영역에 서식 적용
      if (format.bold !== undefined) {
        if (format.bold) document.execCommand('bold', false, null);
      }
      if (format.italic !== undefined) {
        if (format.italic) document.execCommand('italic', false, null);
      }
      if (format.underline !== undefined) {
        if (format.underline) document.execCommand('underline', false, null);
      }
      if (format.fontSize) {
        // fontSize는 직접 스타일 적용 필요
        this._applyStyleToSelection('fontSize', format.fontSize);
      }
      if (format.color) {
        document.execCommand('foreColor', false, format.color);
      }

      // 서식 붙여넣기 모드 비활성화
      this.formatPasteMode = false;
      this._hideFormatCopyIndicator();

      logger.info('🎨 Format pasted');
      this._triggerChange('formatPaste');
      return true;
    } catch (error) {
      logger.error('❌ Format paste failed:', error);
      return false;
    }
  }

  /**
   * 선택 영역에서 서식 정보 추출
   * @private
   */
  _extractFormatInfo(range) {
    const parentElement =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;

    if (!parentElement) {
      return { charShape: {}, paraShape: {} };
    }

    const computedStyle = window.getComputedStyle(parentElement);

    return {
      charShape: {
        bold: computedStyle.fontWeight === 'bold' || parseInt(computedStyle.fontWeight) >= 700,
        italic: computedStyle.fontStyle === 'italic',
        underline: computedStyle.textDecoration.includes('underline'),
        fontSize: computedStyle.fontSize,
        fontFamily: computedStyle.fontFamily,
        color: computedStyle.color,
      },
      paraShape: {
        align: computedStyle.textAlign,
        lineHeight: computedStyle.lineHeight,
        marginLeft: computedStyle.marginLeft,
      },
    };
  }

  /**
   * 선택 영역 HTML 가져오기
   * @private
   */
  _getSelectionHtml(selection) {
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    return container.innerHTML;
  }

  /**
   * HTML 정제 (위험한 태그 제거)
   * @private
   */
  _sanitizeHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // 스크립트 태그 제거
    const scripts = temp.querySelectorAll('script, style, link, meta');
    scripts.forEach(el => el.remove());

    // 허용된 태그만 유지
    const allowedTags = ['span', 'b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div'];
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      if (!allowedTags.includes(el.tagName.toLowerCase())) {
        // 텍스트만 남기고 태그 제거
        el.replaceWith(document.createTextNode(el.textContent));
      }
    });

    return temp.innerHTML;
  }

  /**
   * 현재 편집 중인 셀 가져오기
   * @private
   */
  _getEditingCell() {
    return (
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector('.hwp-table-cell.editing') ||
      this.viewer.inlineEditor?.editingCell
    );
  }

  /**
   * 선택 영역에 스타일 적용
   * @private
   */
  _applyStyleToSelection(property, value) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style[property] = value;

    try {
      range.surroundContents(span);
    } catch (e) {
      // 복잡한 선택의 경우 execCommand 사용
      logger.debug('Fallback to execCommand for style application');
    }
  }

  /**
   * 서식 복사 모드 표시
   * @private
   */
  _showFormatCopyIndicator() {
    // 커서를 브러시 아이콘으로 변경
    document.body.style.cursor = 'copy';

    // 토스트 메시지 표시
    if (typeof showToast === 'function') {
      showToast('서식 복사됨 - 텍스트를 선택하면 서식이 적용됩니다', 'info');
    }
  }

  /**
   * 서식 복사 모드 표시 제거
   * @private
   */
  _hideFormatCopyIndicator() {
    document.body.style.cursor = '';
  }

  /**
   * 변경 콜백 트리거
   * @private
   */
  _triggerChange(type) {
    if (this.viewer.inlineEditor?.onChangeCallback) {
      this.viewer.inlineEditor.onChangeCallback({ type: 'clipboard', action: type });
    }
  }

  /**
   * 서식 복사 모드 여부 확인
   * @returns {boolean}
   */
  isFormatPasteMode() {
    return this.formatPasteMode;
  }

  /**
   * 서식 복사 모드 취소
   */
  cancelFormatPaste() {
    this.formatPasteMode = false;
    this._hideFormatCopyIndicator();
    logger.info('🎨 Format paste mode cancelled');
  }
}

export default ClipboardManager;
