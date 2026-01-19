/**
 * Editing Toolbar
 * 편집 도구 UI 툴바 (굵게, 기울임, 밑줄, 정렬, 특수문자 등)
 *
 * @module ui/editing-toolbar
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('EditingToolbar');

/**
 * 편집 도구 툴바 클래스
 */
export class EditingToolbar {
  constructor(viewer) {
    this.viewer = viewer;
    this.toolbarElement = null;
    this.isVisible = true;

    // 버튼 상태
    this.activeStates = {
      bold: false,
      italic: false,
      underline: false,
      alignLeft: true,
      alignCenter: false,
      alignRight: false,
    };

    this._init();
    logger.info('🔧 EditingToolbar initialized');
  }

  /**
   * 툴바 초기화
   * @private
   */
  _init() {
    this._createToolbar();
    this._attachToDOM();
    this._bindEvents();
  }

  /**
   * 툴바 DOM 생성
   * @private
   */
  _createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'hwpx-editing-toolbar';
    toolbar.innerHTML = `
            <style>
                .hwpx-editing-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    flex-wrap: wrap;
                }
                .hwpx-toolbar-group {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    background: rgba(255,255,255,0.15);
                    border-radius: 6px;
                    padding: 4px;
                }
                .hwpx-toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: rgba(255,255,255,0.3);
                    margin: 0 8px;
                }
                .hwpx-toolbar-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: transparent;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .hwpx-toolbar-btn:hover {
                    background: rgba(255,255,255,0.25);
                }
                .hwpx-toolbar-btn.active {
                    background: rgba(255,255,255,0.35);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
                }
                .hwpx-toolbar-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .hwpx-toolbar-btn svg {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
                }
                .hwpx-toolbar-label {
                    color: rgba(255,255,255,0.9);
                    font-size: 12px;
                    margin-right: 8px;
                    font-weight: 500;
                }
                /* Tablet - ensure minimum touch target size (44px) */
                @media (min-width: 768px) and (max-width: 1023px) {
                    .hwpx-toolbar-btn {
                        width: 44px;
                        height: 44px;
                    }
                    .hwpx-toolbar-btn svg {
                        width: 20px;
                        height: 20px;
                    }
                }
            </style>
            
            <!-- 서식 그룹 -->
            <span class="hwpx-toolbar-label">서식</span>
            <div class="hwpx-toolbar-group">
                <button class="hwpx-toolbar-btn" data-action="bold" title="굵게 (Ctrl+B)">
                    <strong>B</strong>
                </button>
                <button class="hwpx-toolbar-btn" data-action="italic" title="기울임 (Ctrl+I)">
                    <em>I</em>
                </button>
                <button class="hwpx-toolbar-btn" data-action="underline" title="밑줄 (Ctrl+U)">
                    <u>U</u>
                </button>
            </div>
            
            <div class="hwpx-toolbar-divider"></div>
            
            <!-- 정렬 그룹 -->
            <span class="hwpx-toolbar-label">정렬</span>
            <div class="hwpx-toolbar-group">
                <button class="hwpx-toolbar-btn active" data-action="alignLeft" title="왼쪽 정렬">
                    <svg viewBox="0 0 24 24"><path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/></svg>
                </button>
                <button class="hwpx-toolbar-btn" data-action="alignCenter" title="가운데 정렬">
                    <svg viewBox="0 0 24 24"><path d="M3 3h18v2H3V3zm3 4h12v2H6V7zm-3 4h18v2H3v-2zm3 4h12v2H6v-2zm-3 4h18v2H3v-2z"/></svg>
                </button>
                <button class="hwpx-toolbar-btn" data-action="alignRight" title="오른쪽 정렬">
                    <svg viewBox="0 0 24 24"><path d="M3 3h18v2H3V3zm6 4h12v2H9V7zm-6 4h18v2H3v-2zm6 4h12v2H9v-2zm-6 4h18v2H3v-2z"/></svg>
                </button>
            </div>
            
            <div class="hwpx-toolbar-divider"></div>
            
            <!-- 기능 그룹 -->
            <span class="hwpx-toolbar-label">도구</span>
            <div class="hwpx-toolbar-group">
                <button class="hwpx-toolbar-btn" data-action="specialChar" title="특수문자 (Ctrl+F10)">
                    Ω
                </button>
                <button class="hwpx-toolbar-btn" data-action="copyFormat" title="서식 복사 (Alt+C)">
                    <svg viewBox="0 0 24 24"><path d="M17 7h-4V3h4v4zm-6 0H7V3h4v4zm6 6h-4V9h4v4zm-6 0H7V9h4v4zm6 6h-4v-4h4v4zm-6 0H7v-4h4v4z"/></svg>
                </button>
            </div>
            
            <div class="hwpx-toolbar-divider"></div>
            
            <!-- 실행취소 그룹 -->
            <div class="hwpx-toolbar-group">
                <button class="hwpx-toolbar-btn" data-action="undo" title="실행취소 (Ctrl+Z)">
                    <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
                </button>
                <button class="hwpx-toolbar-btn" data-action="redo" title="다시실행 (Ctrl+Y)">
                    <svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22l2.36.78c1.05-3.19 4.06-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
                </button>
            </div>
        `;

    this.toolbarElement = toolbar;
  }

  /**
   * DOM에 툴바 추가
   * @private
   */
  _attachToDOM() {
    // 기존 헤더 찾기
    const header = document.querySelector('.hwpx-header, .viewer-header, header');

    if (header) {
      // 헤더 다음에 삽입
      header.insertAdjacentElement('afterend', this.toolbarElement);
    } else {
      // 헤더가 없으면 viewer container 시작 부분에 삽입
      const container =
        this.viewer?.container || document.querySelector('.hwpx-viewer, .viewer-container');
      if (container) {
        container.insertAdjacentElement('afterbegin', this.toolbarElement);
      } else {
        // Fallback: body 시작 부분에 삽입
        document.body.insertAdjacentElement('afterbegin', this.toolbarElement);
      }
    }
  }

  /**
   * 이벤트 바인딩
   * @private
   */
  _bindEvents() {
    this.toolbarElement.addEventListener('click', e => {
      const btn = e.target.closest('.hwpx-toolbar-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      if (action) {
        this._handleAction(action, btn);
      }
    });
  }

  /**
   * 버튼 액션 처리
   * @private
   */
  _handleAction(action, btn) {
    logger.debug(`Toolbar action: ${action}`);

    switch (action) {
      case 'bold':
        if (this.viewer.textFormatter) {
          this.viewer.textFormatter.toggleBold();
          this._toggleActiveState(btn, 'bold');
        }
        break;

      case 'italic':
        if (this.viewer.textFormatter) {
          this.viewer.textFormatter.toggleItalic();
          this._toggleActiveState(btn, 'italic');
        }
        break;

      case 'underline':
        if (this.viewer.textFormatter) {
          this.viewer.textFormatter.toggleUnderline();
          this._toggleActiveState(btn, 'underline');
        }
        break;

      case 'alignLeft':
        this._setAlignment('left');
        this._setAlignmentActive('alignLeft');
        break;

      case 'alignCenter':
        this._setAlignment('center');
        this._setAlignmentActive('alignCenter');
        break;

      case 'alignRight':
        this._setAlignment('right');
        this._setAlignmentActive('alignRight');
        break;

      case 'specialChar':
        if (this.viewer.specialCharPicker) {
          this.viewer.specialCharPicker.toggle();
        }
        break;

      case 'copyFormat':
        if (this.viewer.clipboardManager) {
          this.viewer.clipboardManager.copyFormat();
        }
        break;

      case 'undo':
        if (this.viewer.historyManager) {
          this.viewer.historyManager.undo();
        }
        break;

      case 'redo':
        if (this.viewer.historyManager) {
          this.viewer.historyManager.redo();
        }
        break;

      default:
        logger.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * 서식 버튼 토글 상태
   * @private
   */
  _toggleActiveState(btn, type) {
    this.activeStates[type] = !this.activeStates[type];
    btn.classList.toggle('active', this.activeStates[type]);
  }

  /**
   * 정렬 설정
   * @private
   */
  _setAlignment(align) {
    const editingCell = this.viewer?.inlineEditor?.editingCell;
    if (editingCell) {
      editingCell.style.textAlign = align;
    }
  }

  /**
   * 정렬 버튼 활성화 상태 설정
   * @private
   */
  _setAlignmentActive(activeAlign) {
    ['alignLeft', 'alignCenter', 'alignRight'].forEach(align => {
      const btn = this.toolbarElement.querySelector(`[data-action="${align}"]`);
      if (btn) {
        btn.classList.toggle('active', align === activeAlign);
      }
      this.activeStates[align] = align === activeAlign;
    });
  }

  /**
   * 현재 선택 영역의 서식 상태로 버튼 업데이트
   */
  updateButtonStates() {
    if (!this.viewer.textFormatter) return;

    const format = this.viewer.textFormatter.getSelectionFormat();

    ['bold', 'italic', 'underline'].forEach(type => {
      const btn = this.toolbarElement.querySelector(`[data-action="${type}"]`);
      if (btn) {
        btn.classList.toggle('active', format[type]);
        this.activeStates[type] = format[type];
      }
    });
  }

  /**
   * 툴바 표시/숨기기
   */
  toggle() {
    this.isVisible = !this.isVisible;
    this.toolbarElement.style.display = this.isVisible ? 'flex' : 'none';
  }

  /**
   * 툴바 표시
   */
  show() {
    this.isVisible = true;
    this.toolbarElement.style.display = 'flex';
  }

  /**
   * 툴바 숨기기
   */
  hide() {
    this.isVisible = false;
    this.toolbarElement.style.display = 'none';
  }

  /**
   * 정리
   */
  destroy() {
    if (this.toolbarElement && this.toolbarElement.parentNode) {
      this.toolbarElement.parentNode.removeChild(this.toolbarElement);
    }
    this.toolbarElement = null;
    logger.info('🗑️ EditingToolbar destroyed');
  }
}

export default EditingToolbar;
