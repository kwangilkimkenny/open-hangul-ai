/**
 * Special Character Picker
 * 특수문자 선택 UI (Ctrl+F10)
 *
 * @module features/special-character-picker
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('SpecialCharacterPicker');

/**
 * 특수문자 선택기 클래스
 */
export class SpecialCharacterPicker {
  constructor(viewer) {
    this.viewer = viewer;
    this.isOpen = false;
    this.pickerElement = null;
    this.currentCategory = 'symbols';

    // 특수문자 카테고리별 정의
    this.characters = {
      symbols: {
        name: '기호',
        chars: [
          '★',
          '☆',
          '○',
          '●',
          '◎',
          '◇',
          '◆',
          '□',
          '■',
          '△',
          '▲',
          '▽',
          '▼',
          '♠',
          '♣',
          '♥',
          '♦',
          '♤',
          '♧',
          '♡',
          '♢',
          '◈',
          '▣',
          '◐',
          '◑',
          '☎',
          '☏',
          '✓',
          '✗',
          '✔',
          '✘',
          '□',
          '■',
          '▪',
          '▫',
          '◯',
          '⊙',
          '⊕',
          '⊖',
          '⊗',
          '⊘',
          '⊚',
          '⊛',
          '⊜',
          '⊝',
          '⊞',
          '⊟',
          '⊠',
          '⊡',
        ],
      },
      arrows: {
        name: '화살표',
        chars: [
          '←',
          '→',
          '↑',
          '↓',
          '↔',
          '↕',
          '↖',
          '↗',
          '↘',
          '↙',
          '⇐',
          '⇒',
          '⇑',
          '⇓',
          '⇔',
          '⇕',
          '⇖',
          '⇗',
          '⇘',
          '⇙',
          '➔',
          '➜',
          '➝',
          '➞',
          '➟',
          '➠',
          '➡',
          '➢',
          '➣',
          '➤',
          '⬅',
          '➡',
          '⬆',
          '⬇',
          '↩',
          '↪',
          '↺',
          '↻',
          '⟲',
          '⟳',
        ],
      },
      math: {
        name: '수학',
        chars: [
          '±',
          '×',
          '÷',
          '≠',
          '≤',
          '≥',
          '≡',
          '≒',
          '∞',
          '∴',
          '∵',
          '∈',
          '∋',
          '⊂',
          '⊃',
          '⊆',
          '⊇',
          '∪',
          '∩',
          '∧',
          '∨',
          '¬',
          '⇒',
          '⇔',
          '∀',
          '∃',
          '∄',
          '∅',
          '∑',
          '∏',
          '√',
          '∛',
          '∜',
          '∫',
          '∬',
          '∭',
          '∮',
          '∯',
          '∰',
          '∂',
          '∇',
          '∝',
          '∟',
          '∠',
          '∡',
          '∢',
          'π',
          'Σ',
          'α',
          'β',
        ],
      },
      currency: {
        name: '통화',
        chars: [
          '₩',
          '$',
          '€',
          '£',
          '¥',
          '₽',
          '₹',
          '₪',
          '฿',
          '₫',
          '₦',
          '₱',
          '₲',
          '₳',
          '₴',
          '₵',
          '₶',
          '₷',
          '₸',
          '₺',
          '¢',
          '₠',
          '₡',
          '₢',
          '₣',
          '₤',
          '₥',
          '₧',
          '₨',
          '₭',
        ],
      },
      punctuation: {
        name: '구두점',
        chars: [
          '「',
          '」',
          '『',
          '』',
          '【',
          '】',
          '〔',
          '〕',
          '〈',
          '〉',
          '《',
          '》',
          '〖',
          '〗',
          '〘',
          '〙',
          '〚',
          '〛',
          '＂',
          '＇',
          '…',
          '‥',
          '·',
          '•',
          '§',
          '¶',
          '†',
          '‡',
          '※',
          '〃',
          '〆',
          '〒',
          '〓',
          '〄',
          '〠',
          '々',
          '〡',
          '〢',
          '〣',
          '〤',
        ],
      },
      korean: {
        name: '한글',
        chars: [
          '㉠',
          '㉡',
          '㉢',
          '㉣',
          '㉤',
          '㉥',
          '㉦',
          '㉧',
          '㉨',
          '㉩',
          '㉪',
          '㉫',
          '㉬',
          '㉭',
          '㈀',
          '㈁',
          '㈂',
          '㈃',
          '㈄',
          '㈅',
          '㈆',
          '㈇',
          '㈈',
          '㈉',
          '㈊',
          '㈋',
          '㈌',
          '㈍',
          '㈎',
          '㈏',
          '㈐',
          '㈑',
          '㈒',
          '㈓',
          '㈔',
          '㈕',
          '㈖',
          '㈗',
          '㈘',
          '㈙',
        ],
      },
      numbers: {
        name: '숫자',
        chars: [
          '①',
          '②',
          '③',
          '④',
          '⑤',
          '⑥',
          '⑦',
          '⑧',
          '⑨',
          '⑩',
          '⑪',
          '⑫',
          '⑬',
          '⑭',
          '⑮',
          '⑯',
          '⑰',
          '⑱',
          '⑲',
          '⑳',
          '❶',
          '❷',
          '❸',
          '❹',
          '❺',
          '❻',
          '❼',
          '❽',
          '❾',
          '❿',
          'Ⅰ',
          'Ⅱ',
          'Ⅲ',
          'Ⅳ',
          'Ⅴ',
          'Ⅵ',
          'Ⅶ',
          'Ⅷ',
          'Ⅸ',
          'Ⅹ',
        ],
      },
      units: {
        name: '단위',
        chars: [
          '㎜',
          '㎝',
          '㎞',
          '㎟',
          '㎠',
          '㎢',
          '㎣',
          '㎤',
          '㎥',
          '㎦',
          '㎎',
          '㎏',
          '㎐',
          '㎑',
          '㎒',
          '㎓',
          '㎔',
          '㎕',
          '㎖',
          '㎗',
          '㎘',
          '㎙',
          '㎚',
          '㎛',
          '㎜',
          '㎝',
          '㎞',
          '㎟',
          '㎠',
          '℃',
          '℉',
          '㏄',
          '㏅',
          '㏆',
          '㏇',
          '㏈',
          '㏉',
          '㏊',
          '㏋',
          '㏌',
        ],
      },
    };

    logger.info('🔤 SpecialCharacterPicker initialized');
  }

  /**
   * 특수문자 선택 창 열기
   */
  open() {
    if (this.isOpen) {
      this.close();
      return;
    }

    this._createPicker();
    this.isOpen = true;
    logger.info('🔤 Special character picker opened');
  }

  /**
   * 특수문자 선택 창 닫기
   */
  close() {
    if (this.pickerElement && this.pickerElement.parentNode) {
      this.pickerElement.parentNode.removeChild(this.pickerElement);
    }
    this.pickerElement = null;
    this.isOpen = false;
    logger.info('🔤 Special character picker closed');
  }

  /**
   * 선택 창 토글
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 선택 창 생성
   * @private
   */
  _createPicker() {
    // 기존 picker 제거
    this.close();

    const picker = document.createElement('div');
    picker.className = 'hwpx-special-char-picker';
    picker.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 450px;
            max-height: 400px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

    // 헤더
    const header = document.createElement('div');
    header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #eee;
            background: #f8f9fa;
            border-radius: 8px 8px 0 0;
        `;
    header.innerHTML = `
            <span style="font-weight: 600; font-size: 14px;">특수문자 삽입</span>
            <button class="close-btn" style="
                border: none;
                background: none;
                font-size: 20px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">×</button>
        `;
    picker.appendChild(header);

    // 카테고리 탭
    const tabs = document.createElement('div');
    tabs.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
            background: #fafafa;
        `;

    Object.entries(this.characters).forEach(([key, category]) => {
      const tab = document.createElement('button');
      tab.textContent = category.name;
      tab.style.cssText = `
                padding: 6px 12px;
                border: 1px solid #ddd;
                background: ${key === this.currentCategory ? '#4a90d9' : '#fff'};
                color: ${key === this.currentCategory ? '#fff' : '#333'};
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            `;
      tab.addEventListener('click', () => {
        this.currentCategory = key;
        this._updateCharacterGrid(charGrid);
        // 탭 스타일 업데이트
        tabs.querySelectorAll('button').forEach(btn => {
          btn.style.background = '#fff';
          btn.style.color = '#333';
        });
        tab.style.background = '#4a90d9';
        tab.style.color = '#fff';
      });
      tabs.appendChild(tab);
    });
    picker.appendChild(tabs);

    // 문자 그리드
    const charGrid = document.createElement('div');
    charGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 4px;
            padding: 12px;
            max-height: 250px;
            overflow-y: auto;
        `;
    this._updateCharacterGrid(charGrid);
    picker.appendChild(charGrid);

    // 닫기 버튼 이벤트
    header.querySelector('.close-btn').addEventListener('click', () => this.close());

    // ESC 키로 닫기
    const escHandler = e => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // 바깥 클릭으로 닫기
    setTimeout(() => {
      const clickOutsideHandler = e => {
        if (this.isOpen && this.pickerElement && !this.pickerElement.contains(e.target)) {
          this.close();
          document.removeEventListener('click', clickOutsideHandler);
        }
      };
      document.addEventListener('click', clickOutsideHandler);
    }, 100);

    document.body.appendChild(picker);
    this.pickerElement = picker;
  }

  /**
   * 문자 그리드 업데이트
   * @private
   */
  _updateCharacterGrid(gridElement) {
    gridElement.innerHTML = '';
    const chars = this.characters[this.currentCategory].chars;

    chars.forEach(char => {
      const btn = document.createElement('button');
      btn.textContent = char;
      btn.style.cssText = `
                width: 32px;
                height: 32px;
                border: 1px solid #e0e0e0;
                background: #fff;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s;
            `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#e3f2fd';
        btn.style.borderColor = '#4a90d9';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#fff';
        btn.style.borderColor = '#e0e0e0';
      });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._insertCharacter(char);
      });
      gridElement.appendChild(btn);
    });
  }

  /**
   * 문자 삽입
   * @private
   */
  _insertCharacter(char) {
    try {
      // 현재 편집 중인 요소에 삽입
      const editingCell = this.viewer?.inlineEditor?.editingCell;

      if (editingCell && editingCell.contentEditable === 'true') {
        // contentEditable에 삽입
        document.execCommand('insertText', false, char);
        logger.info(`🔤 Inserted character: ${char}`);
      } else {
        // 클립보드에 복사
        navigator.clipboard.writeText(char).then(() => {
          logger.info(`📋 Character copied to clipboard: ${char}`);
          if (typeof showToast === 'function') {
            showToast(`"${char}" 복사됨`, 'success');
          }
        });
      }

      // History 기록
      if (this.viewer?.historyManager) {
        this.viewer.historyManager.execute(
          () => {},
          () => {
            return () => {};
          },
          `특수문자 삽입: ${char}`
        );
      }

      // 선택 창 닫기
      this.close();
    } catch (error) {
      logger.error('❌ Failed to insert character:', error);
    }
  }

  /**
   * 정리
   */
  destroy() {
    this.close();
    logger.info('🗑️ SpecialCharacterPicker destroyed');
  }
}

export default SpecialCharacterPicker;
