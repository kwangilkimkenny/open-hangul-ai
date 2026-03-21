/**
 * Inline Editor
 * 테이블 셀 인라인 편집 기능 (하이브리드 편집 방식)
 *
 * @module features/inline-editor
 * @version 2.1.1 - WeakMap fallback mechanism 추가
 */

import { getLogger } from '../utils/logger.js';
import { sanitizeHTML } from '../utils/ui.js';

const logger = getLogger('InlineEditor');

/**
 * 인라인 편집기 클래스
 * ✅ Phase 2 P1: WeakMap 기반 메모리 최적화
 */
export class InlineEditor {
  constructor(viewer) {
    this.viewer = viewer;
    this.editingCell = null;
    this.originalContent = null;
    this.onChangeCallback = null;
    this.keydownHandler = null;
    this.blurHandler = null;

    // ✅ Phase 2 P1: cellData → DOM 요소 매핑 (메모리 효율화)
    // WeakMap은 cellData가 GC되면 자동으로 항목 제거
    this.cellDataMap = new WeakMap();

    logger.info('✏️ InlineEditor initialized (Hybrid Mode v2.1.1 with WeakMap + Fallback)');
  }

  /**
   * 변경 콜백 등록
   * @param {Function} callback - 변경 시 호출될 함수
   */
  onChange(callback) {
    this.onChangeCallback = callback;
  }

  /**
   * 셀 편집 모드 활성화 (개선: 연속 편집 지원 + 글로벌 편집 모드 체크)
   * @param {HTMLElement} cellElement - 편집할 셀 요소
   * @param {Object} cellData - 셀 데이터 객체
   */
  enableEditMode(cellElement, cellData) {
    // ✅ v2.1.0: 글로벌 편집 모드가 OFF면 편집 불가
    if (window.editModeManager && !window.editModeManager.isGlobalEditMode) {
      logger.debug('⚠️ Edit mode is OFF - editing disabled');
      return;
    }

    // 같은 요소를 다시 클릭하면 무시
    if (this.editingCell === cellElement) {
      logger.debug('⚠️ Already editing this element');
      return;
    }

    // 기존 편집 중인 요소가 있으면 자동 저장 (편집 모드는 유지)
    if (this.editingCell && this.editingCell !== cellElement) {
      logger.debug('📝 Auto-saving previous element...');
      this.saveChanges(false); // false = 편집 모드 종료하지 않음
    }

    logger.debug('✏️ Enabling edit mode for element');

    // 원본 내용 백업 (XSS 방지를 위해 sanitize)
    // ⚠️ Security: 악의적인 스크립트가 포함된 내용을 방지
    this.originalContent = sanitizeHTML(cellElement.innerHTML);
    this.editingCell = cellElement;
    this.cellData = cellData;

    // ✅ Phase 2 P1: WeakMap에 cellData → element 매핑 등록
    this.cellDataMap.set(cellData, cellElement);
    logger.debug('  ✓ Registered cellData → element mapping in WeakMap');

    // 편집 모드 표시
    cellElement.classList.add('editing');
    cellElement.contentEditable = true;
    cellElement.spellcheck = true;
    cellElement.style.outline = '2px solid #667eea';
    cellElement.style.outlineOffset = '2px';
    cellElement.style.backgroundColor = 'rgba(102, 126, 234, 0.05)';

    // 포커스
    cellElement.focus();

    // ✅ 개선: 텍스트 끝으로 커서 이동 (전체 선택하지 않음)
    const range = document.createRange();
    const selection = window.getSelection();

    // 텍스트 끝으로 커서 이동
    if (cellElement.childNodes.length > 0) {
      const lastNode = this._getLastTextNode(cellElement);
      if (lastNode) {
        range.setStart(lastNode, lastNode.length || 0);
        range.collapse(true);
      } else {
        range.selectNodeContents(cellElement);
        range.collapse(false);
      }
    } else {
      range.selectNodeContents(cellElement);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);

    // 이벤트 리스너 추가
    this._attachEventListeners(cellElement);

    logger.info('✅ Edit mode enabled (continuous)');
  }

  /**
   * 마지막 텍스트 노드 찾기
   * @private
   */
  _getLastTextNode(element) {
    if (element.nodeType === Node.TEXT_NODE) {
      return element;
    }

    const children = element.childNodes;
    for (let i = children.length - 1; i >= 0; i--) {
      const lastText = this._getLastTextNode(children[i]);
      if (lastText) return lastText;
    }

    return null;
  }

  /**
   * 이벤트 리스너 추가
   * ✅ Phase 1 P0: IME 처리 강화 - compositionstart/end 이벤트 추가
   * @private
   */
  _attachEventListeners(cellElement) {
    // 기존 리스너 제거
    if (this.keydownHandler) {
      cellElement.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.blurHandler) {
      cellElement.removeEventListener('blur', this.blurHandler);
    }
    if (this._compositionHandlers) {
      cellElement.removeEventListener('compositionstart', this._compositionHandlers.start);
      cellElement.removeEventListener('compositionend', this._compositionHandlers.end);
    }

    // ✅ IME Composition 상태 추적
    this.isComposing = false;

    const compositionStartHandler = () => {
      this.isComposing = true;
      logger.debug('🎌 IME composition started');
    };

    const compositionEndHandler = e => {
      logger.debug('🎌 IME composition ended:', e.data);

      // ✅ 조합 완료 후 10ms 안정화 대기
      // 일부 브라우저에서 compositionend 직후 keydown 이벤트가 즉시 발생할 수 있음
      setTimeout(() => {
        this.isComposing = false;
        logger.debug('🎌 IME composition stabilized');
      }, 10);
    };

    cellElement.addEventListener('compositionstart', compositionStartHandler);
    cellElement.addEventListener('compositionend', compositionEndHandler);

    // ✅ Cleanup을 위해 핸들러 저장
    this._compositionHandlers = {
      start: compositionStartHandler,
      end: compositionEndHandler,
    };

    // 키보드 이벤트
    this.keydownHandler = this._handleKeydown.bind(this);
    cellElement.addEventListener('keydown', this.keydownHandler);

    // 포커스 벗어남 (자동 저장)
    this.blurHandler = this._handleBlur.bind(this);
    cellElement.addEventListener('blur', this.blurHandler, { once: true });

    // ✅ Phase 1 P1: Paste 이벤트 - Plain text만 허용
    this.pasteHandler = this._handlePaste.bind(this);
    cellElement.addEventListener('paste', this.pasteHandler);

    // ✅ Phase 1 P1: Input 이벤트 - 스타일 태그 제거
    this.inputHandler = this._handleInput.bind(this);
    cellElement.addEventListener('input', this.inputHandler);

    // 이미지 드래그 앤 드롭
    this.dropHandler = this._handleDrop.bind(this);
    this.dragoverHandler = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    cellElement.addEventListener('drop', this.dropHandler);
    cellElement.addEventListener('dragover', this.dragoverHandler);
  }

  /**
   * 키보드 이벤트 처리 (Phase 2: 키보드 네비게이션 지원)
   * ✅ Phase 1 P0: IME 처리 강화 - 정확한 상태 추적
   * @private
   */
  _handleKeydown(e) {
    if (!this.editingCell) return;

    // ✅ Phase 1 P0: IME Composition Guard (개선)
    // Korean/Japanese/Chinese input methods use composition events.
    // During composition, ignore ALL key events to prevent double-characters or broken input.
    if (this.isComposing) {
      logger.debug('⏸️  Ignored key during IME composition:', e.key);
      return;
    }

    // Tab: 다음/이전 편집 가능한 요소로 이동
    if (e.key === 'Tab') {
      e.preventDefault();
      this._navigateToNext(e.shiftKey ? 'prev' : 'next');
      return;
    }

    // 화살표 키: 텍스트 끝/시작에 있을 때만 요소 간 이동
    if (e.key === 'ArrowRight' && !e.shiftKey && this._isCursorAtEnd()) {
      e.preventDefault();
      this._navigateToNext('next');
      return;
    }

    if (e.key === 'ArrowLeft' && !e.shiftKey && this._isCursorAtStart()) {
      e.preventDefault();
      this._navigateToNext('prev');
      return;
    }

    if (e.key === 'ArrowDown' && !e.shiftKey && this._isCursorAtEnd()) {
      e.preventDefault();
      this._navigateToNext('down');
      return;
    }

    if (e.key === 'ArrowUp' && !e.shiftKey && this._isCursorAtStart()) {
      e.preventDefault();
      this._navigateToNext('up');
      return;
    }

    // Enter: 단락에서는 줄바꿈, 테이블 셀에서는 다음으로 이동
    if (e.key === 'Enter') {
      const isInParagraph = this.editingCell && this.editingCell.classList.contains('editable-paragraph');
      if (isInParagraph) {
        // 단락 편집: Enter = 줄바꿈, Shift+Enter도 줄바꿈
        e.preventDefault();
        e.stopPropagation();
        this._insertNewlineAtCursor();
        return;
      } else if (e.shiftKey) {
        // 테이블 셀: Shift+Enter = 줄바꿈
        e.preventDefault();
        e.stopPropagation();
        this._insertNewlineAtCursor();
        return;
      } else {
        // 테이블 셀: Enter = 저장 후 다음 셀로 이동
        e.preventDefault();
        e.stopPropagation();
        this.saveChanges(false);
        this._navigateToNext('next');
        return;
      }
    }

    // Escape: 편집 모드 완전 종료
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.saveChanges(true); // 저장하고 편집 모드 종료
      return;
    }

    // Undo/Redo (Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        // Redo
        if (this.viewer.historyManager) this.viewer.historyManager.redo();
      } else {
        // Undo
        if (this.viewer.historyManager) this.viewer.historyManager.undo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      e.stopPropagation();
      // Redo
      if (this.viewer.historyManager) this.viewer.historyManager.redo();
      return;
    }

    // ✅ Phase 1: Text Formatting Shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      e.stopPropagation();
      if (this.viewer.textFormatter) {
        this.viewer.textFormatter.toggleBold();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      e.stopPropagation();
      if (this.viewer.textFormatter) {
        this.viewer.textFormatter.toggleItalic();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      e.stopPropagation();
      if (this.viewer.textFormatter) {
        this.viewer.textFormatter.toggleUnderline();
      }
      return;
    }

    // ✅ Phase 2: Format Copy (Alt+C) - 한글 고유 기능
    if (e.altKey && e.key === 'c') {
      e.preventDefault();
      e.stopPropagation();
      if (this.viewer.clipboardManager) {
        if (this.viewer.clipboardManager.isFormatPasteMode()) {
          // 이미 서식 복사 모드면 선택 영역에 서식 적용
          this.viewer.clipboardManager.pasteFormat();
        } else {
          // 서식 복사
          this.viewer.clipboardManager.copyFormat();
        }
      }
      return;
    }

    // ✅ Phase 2: Enhanced Copy (Ctrl+C with format)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.altKey) {
      // 서식 포함 복사 - 기본 동작도 허용하되 내부 클립보드에도 저장
      if (this.viewer.clipboardManager) {
        this.viewer.clipboardManager.copy();
      }
      // 기본 복사 동작 허용 (e.preventDefault 안 함)
      return;
    }

    // ✅ Phase 2: Enhanced Paste (Ctrl+V with format)
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      e.stopPropagation();
      if (this.viewer.clipboardManager) {
        this.viewer.clipboardManager.paste();
      }
      return;
    }

    // ✅ Phase 5: Special Character Picker (Ctrl+F10)
    if ((e.ctrlKey || e.metaKey) && e.key === 'F10') {
      e.preventDefault();
      e.stopPropagation();
      if (this.viewer.specialCharPicker) {
        this.viewer.specialCharPicker.toggle();
      }
      return;
    }
  }

  /**
   * 포커스 벗어남 처리
   * @private
   */
  _handleBlur(e) {
    // blur 이벤트는 자동 저장 (편집 모드 종료)
    // 단, 툴바/리본 클릭으로 인한 blur는 무시 (편집 모드 유지)
    setTimeout(() => {
      if (!this.editingCell || this.editingCell !== e.target) return;

      // 현재 포커스된 요소가 툴바/리본이면 편집 모드 유지
      const activeEl = document.activeElement;
      const isToolbarClick = activeEl && (
        activeEl.closest('.hwp-ribbon-panel') ||
        activeEl.closest('.hwp-menubar') ||
        activeEl.closest('.hwp-ribbon-tabs') ||
        activeEl.closest('.hwp-toolbar')
      );
      if (isToolbarClick) {
        // blur 리스너를 다시 등록 (once이므로)
        this.editingCell.addEventListener('blur', this.blurHandler, { once: true });
        return;
      }

      this.saveChanges(true);
    }, 150);
  }

  /**
   * Paste 이벤트 처리 - Plain text만 허용
   * ✅ Phase 1 P1: Plain Text 모드 강제
   * @private
   */
  _handlePaste(e) {
    e.preventDefault();

    // 클립보드에서 plain text 추출
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');

    if (!text) {
      logger.debug('⚠️ No text in clipboard');
      return;
    }

    logger.debug(`📋 Pasting plain text: ${text.length} characters`);

    // 현재 커서 위치에 삽입
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    // ✅ 줄바꿈을 <br>로 변환하여 삽입
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (idx > 0) {
        // 줄바꿈 추가
        const br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
      }
      if (line) {
        // 텍스트 추가
        const textNode = document.createTextNode(line);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
      }
    });

    // ✅ 커서 위치 정규화 (마지막에 <br>이 있으면 zero-width space 추가)
    if (lines[lines.length - 1] === '' || lines.length > 1) {
      const lastNode = range.startContainer;
      if (lastNode.nodeType === Node.ELEMENT_NODE && lastNode.lastChild?.nodeName === 'BR') {
        const textNode = document.createTextNode('\u200B');
        range.insertNode(textNode);
        range.setStart(textNode, 1);
      }
    }

    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    logger.debug(`✅ Pasted ${lines.length} lines as plain text`);
  }

  /**
   * Input 이벤트 처리 - 스타일 태그 제거
   * ✅ Phase 1 P1: Plain Text 모드 강제
   * @private
   */
  /**
   * 이미지 드래그 앤 드롭 처리
   * @private
   */
  _handleDrop(e) {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const imageFile = Array.from(files).find(f => f.type.startsWith('image/'));
    if (!imageFile) return;

    e.preventDefault();
    e.stopPropagation();

    const url = URL.createObjectURL(imageFile);
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '300px';
    img.style.height = 'auto';
    img.alt = imageFile.name;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (this.editingCell) {
      this.editingCell.appendChild(img);
    }

    logger.info(`📷 Image dropped: ${imageFile.name} (${imageFile.size} bytes)`);
  }

  _handleInput(e) {
    // ✅ 불필요한 태그 제거
    this._sanitizeContent();
  }

  /**
   * 컨텐츠 정제 - 허용되지 않은 태그 제거
   * ✅ Phase 1 P1: Plain Text 모드 강제
   * @private
   */
  _sanitizeContent() {
    if (!this.editingCell) return;

    const html = this.editingCell.innerHTML;

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // <div> → <br> 변환
    temp.querySelectorAll('div').forEach(div => {
      const br = document.createElement('br');
      const children = Array.from(div.childNodes);
      div.replaceWith(br, ...children);
    });

    // <p> → <br> + 내용
    temp.querySelectorAll('p').forEach(p => {
      if (p.previousSibling) {
        const br = document.createElement('br');
        p.before(br);
      }
      p.replaceWith(...Array.from(p.childNodes));
    });

    // 서식 태그 → <span style="..."> 변환 (서식 보존)
    const formatMap = {
      'B': 'font-weight:bold',
      'STRONG': 'font-weight:bold',
      'I': 'font-style:italic',
      'EM': 'font-style:italic',
      'U': 'text-decoration:underline',
      'STRIKE': 'text-decoration:line-through',
      'S': 'text-decoration:line-through',
    };
    temp.querySelectorAll('b, strong, i, em, u, strike, s').forEach(el => {
      const style = formatMap[el.tagName];
      if (style) {
        const span = document.createElement('span');
        span.style.cssText = style;
        span.innerHTML = el.innerHTML;
        el.replaceWith(span);
      }
    });

    // <font> → <span> 변환 (글꼴/크기/색상 보존)
    temp.querySelectorAll('font').forEach(font => {
      const span = document.createElement('span');
      if (font.face) span.style.fontFamily = font.face;
      if (font.color) span.style.color = font.color;
      if (font.size) {
        const sizeMap = { '1': '8pt', '2': '10pt', '3': '12pt', '4': '14pt', '5': '18pt', '6': '24pt', '7': '36pt' };
        span.style.fontSize = sizeMap[font.size] || `${font.size}pt`;
      }
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });

    if (temp.innerHTML !== html) {
      // 커서 위치 저장
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const offset = range ? range.startOffset : 0;
      const startContainer = range ? range.startContainer : null;

      this.editingCell.innerHTML = temp.innerHTML;

      // 커서 위치 복원
      if (range && startContainer && startContainer.nodeType === Node.TEXT_NODE) {
        try {
          const walker = document.createTreeWalker(this.editingCell, NodeFilter.SHOW_TEXT, null);
          let currentNode;
          while ((currentNode = walker.nextNode())) {
            if (currentNode.textContent === startContainer.textContent) {
              const newRange = document.createRange();
              newRange.setStart(currentNode, Math.min(offset, currentNode.length));
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
              break;
            }
          }
        } catch (err) {
          logger.debug('⚠️ Failed to restore cursor position:', err);
        }
      }

      logger.debug('🧹 Content sanitized - formatting tags converted to spans');
    }
  }

  /**
   * 커서 위치에 줄바꿈 삽입
   * ✅ Phase 1 P1: 커서 위치 정규화 - Zero-width space 삽입
   * @private
   */
  _insertNewlineAtCursor() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // <br> 태그 생성
    const br = document.createElement('br');

    // 커서 위치에 삽입
    range.deleteContents();
    range.insertNode(br);

    // ✅ IMPROVEMENT: <br> 다음에 텍스트 노드가 없으면 빈 텍스트 노드 추가
    const nextNode = br.nextSibling;
    if (!nextNode || nextNode.nodeType !== Node.TEXT_NODE) {
      // Zero-width space를 사용하여 커서 앵커 생성
      const textNode = document.createTextNode('\u200B');
      if (nextNode) {
        br.parentNode.insertBefore(textNode, nextNode);
      } else {
        br.parentNode.appendChild(textNode);
      }

      // 커서를 텍스트 노드 시작으로 이동
      range.setStart(textNode, 0);
      range.collapse(true);

      logger.debug('✅ Inserted zero-width space after <br> for cursor anchor');
    } else {
      // 다음 텍스트 노드 시작으로 커서 이동
      range.setStart(nextNode, 0);
      range.collapse(true);
    }

    // ✅ Selection 업데이트
    selection.removeAllRanges();
    selection.addRange(range);

    // 스크롤 조정: 임시 마커를 삽입하여 정확한 커서 위치로 스크롤
    if (this.editingCell) {
      const marker = document.createElement('span');
      marker.style.display = 'inline';
      marker.style.width = '0';
      marker.style.height = '0';
      range.insertNode(marker);
      if (marker.scrollIntoView) marker.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // 마커 제거 후 커서 복원
      const parent = marker.parentNode;
      const next = marker.nextSibling;
      parent.removeChild(marker);
      if (next) {
        range.setStart(next, 0);
      }
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    logger.debug('✅ Newline inserted, cursor positioned correctly');
  }

  /**
   * 변경 사항 저장 (개선: 편집 모드 유지 옵션 추가 + HistoryManager 연동)
   * ✅ Phase 2 P0: DOM 동기화 개선
   * @param {boolean} exitEditMode - 편집 모드 종료 여부 (기본: true)
   */
  saveChanges(exitEditMode = true) {
    if (!this.editingCell) return;

    logger.debug('💾 Saving changes...');

    const newText = this.extractText(this.editingCell);
    const oldText = this.extractText(this._createTempElement(this.originalContent));
    // DOM에서 서식 포함 runs 추출
    const newRuns = this._extractRunsFromDOM(this.editingCell);

    // 변경 사항이 있는 경우에만 처리 (텍스트 또는 HTML이 다르면)
    const htmlChanged = this.editingCell.innerHTML !== this.originalContent;
    if (newText !== oldText || htmlChanged) {
      logger.info(
        `📝 Content changed: "${oldText.substring(0, 20)}..." → "${newText.substring(0, 20)}..."`
      );

      // HistoryManager를 통한 실행
      if (this.viewer.historyManager) {
        // Phase 2 P1: 텍스트와 데이터만 캡처 (메모리 효율적)
        const captureNewText = newText;
        const captureOldText = oldText;
        const captureNewRuns = newRuns;
        const targetData = this.cellData;

        this.viewer.historyManager.execute(
          // Execute function: 새 텍스트+서식 적용
          () => {
            this._updateCellDataWithRuns(targetData, captureNewRuns, captureNewText);
            this._refreshDOM(targetData, captureNewText);

            if (this.onChangeCallback) {
              this.onChangeCallback({
                type: 'text_edit',
                cellData: targetData,
                oldText: captureOldText,
                newText: captureNewText,
              });
            }

            if (this.viewer.autoSaveManager) {
              this.viewer.autoSaveManager.markDirty();
            }
          },
          // Undo function: 이전 텍스트 복원
          () => {
            this._updateCellData(targetData, captureOldText);
            this._refreshDOM(targetData, captureOldText);

            if (this.onChangeCallback) {
              this.onChangeCallback({
                type: 'text_undo',
                cellData: targetData,
                oldText: captureNewText,
                newText: captureOldText,
              });
            }

            if (this.viewer.autoSaveManager) {
              this.viewer.autoSaveManager.markDirty();
            }
          },
          '텍스트 편집'
        );
      } else {
        // HistoryManager 없을 때
        this._updateCellDataWithRuns(this.cellData, newRuns, newText);

        if (this.onChangeCallback) {
          this.onChangeCallback({
            type: 'text_edit',
            cellData: this.cellData,
            oldText,
            newText,
          });
        }

        if (this.viewer.autoSaveManager) {
          this.viewer.autoSaveManager.markDirty();
        }
      }
    }

    // ✅ 개선: 편집 모드 유지 옵션
    if (exitEditMode) {
      this._disableEditMode();
      logger.info('✅ Changes saved (edit mode exited)');
    } else {
      // 편집 모드는 유지하고 원본 내용만 업데이트
      this.originalContent = this.editingCell.innerHTML;
      logger.info('✅ Changes saved (edit mode maintained)');
    }
  }

  /**
   * 편집 취소
   */
  cancelEdit() {
    if (!this.editingCell) return;

    logger.debug('❌ Canceling edit...');

    // 원본 내용 복원
    this.editingCell.innerHTML = this.originalContent;
    this._disableEditMode();

    logger.info('✅ Edit canceled');
  }

  /**
   * 편집 모드 비활성화
   * ✅ Phase 1 P0/P1: 모든 이벤트 리스너 제거
   * @private
   */
  _disableEditMode() {
    if (!this.editingCell) return;

    // 이벤트 리스너 제거
    if (this.keydownHandler) {
      this.editingCell.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.blurHandler) {
      this.editingCell.removeEventListener('blur', this.blurHandler);
    }

    // ✅ IME composition 이벤트 제거
    if (this._compositionHandlers) {
      this.editingCell.removeEventListener('compositionstart', this._compositionHandlers.start);
      this.editingCell.removeEventListener('compositionend', this._compositionHandlers.end);
      this._compositionHandlers = null;
    }

    // ✅ Phase 1 P1: Paste/Input 이벤트 제거
    if (this.pasteHandler) {
      this.editingCell.removeEventListener('paste', this.pasteHandler);
    }
    if (this.inputHandler) {
      this.editingCell.removeEventListener('input', this.inputHandler);
    }

    this.editingCell.classList.remove('editing');
    this.editingCell.contentEditable = false;
    this.editingCell.style.outline = '';
    this.editingCell.style.outlineOffset = '';
    this.editingCell.style.backgroundColor = '';

    this.editingCell = null;
    this.originalContent = null;
    this.cellData = null;
    this.keydownHandler = null;
    this.blurHandler = null;
    this.pasteHandler = null;
    this.inputHandler = null;
    this.isComposing = false;
  }

  /**
   * 셀에서 텍스트 추출
   * ✅ Phase 1 P1: Zero-width space 제거, Whitespace 보존
   * @private
   */
  extractText(element) {
    if (!element) return '';

    // <br>을 줄바꿈으로, 나머지는 textContent
    const clone = element.cloneNode(true);
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => br.replaceWith('\n'));

    let text = clone.textContent || '';

    // ✅ Zero-width space 제거
    text = text.replace(/\u200B/g, '');

    // ✅ trim() 제거 - 앞뒤 공백 보존
    return text;
  }

  /**
   * DOM에서 서식 포함 runs 배열 추출
   * @param {HTMLElement} element - contentEditable 요소
   * @returns {Array} runs 배열 [{text, style, type}, ...]
   * @private
   */
  _extractRunsFromDOM(element) {
    if (!element) return [];
    const runs = [];

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent || '';
        text = text.replace(/\u200B/g, ''); // zero-width space 제거
        if (!text) return;

        // 부모 체인에서 스타일 수집
        const style = {};
        let parent = node.parentElement;
        while (parent && parent !== element) {
          const cs = parent.style;
          if (cs.fontWeight === 'bold' || parent.tagName === 'B' || parent.tagName === 'STRONG') style.bold = true;
          if (cs.fontStyle === 'italic' || parent.tagName === 'I' || parent.tagName === 'EM') style.italic = true;
          if (cs.textDecoration?.includes('underline') || parent.tagName === 'U') style.underline = true;
          if (cs.textDecoration?.includes('line-through') || parent.tagName === 'STRIKE' || parent.tagName === 'S') style.strikethrough = true;
          if (cs.fontSize) style.fontSize = cs.fontSize;
          if (cs.fontFamily) style.fontFamily = cs.fontFamily;
          if (cs.color) style.color = cs.color;
          if (cs.backgroundColor) style.backgroundColor = cs.backgroundColor;
          parent = parent.parentElement;
        }
        runs.push({ text, style });
      } else if (node.nodeName === 'BR') {
        runs.push({ type: 'linebreak' });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of node.childNodes) {
          walk(child);
        }
      }
    };

    for (const child of element.childNodes) {
      walk(child);
    }
    return runs;
  }

  /**
   * 서식 포함 runs로 셀/단락 데이터 업데이트
   * @param {Object} data - 셀/단락 데이터
   * @param {Array} runs - 서식 포함 runs 배열
   * @param {string} plainText - plain text (폴백용)
   * @private
   */
  _updateCellDataWithRuns(data, runs, plainText) {
    if (!runs || runs.length === 0) {
      // runs가 없으면 기존 plain text 방식으로 폴백
      this._updateCellData(data, plainText);
      return;
    }

    // 기존 스타일 정보 보존
    const getBaseCharShapeId = () => {
      if (data.elements) {
        const firstPara = data.elements.find(e => e.type === 'paragraph');
        return firstPara?.runs?.[0]?.charShapeId;
      }
      return data.runs?.[0]?.charShapeId;
    };
    const baseCharShapeId = getBaseCharShapeId();

    // runs를 데이터 모델 형식으로 변환
    const newRuns = runs.map(run => {
      if (run.type === 'linebreak') {
        return { type: 'linebreak', charShapeId: baseCharShapeId };
      }
      const result = {
        text: run.text,
        charShapeId: baseCharShapeId,
      };
      // 인라인 서식이 있으면 style 객체에 기록
      if (run.style && Object.keys(run.style).length > 0) {
        result.inlineStyle = { ...run.style };
      }
      return result;
    });

    // 데이터에 적용
    if (data.elements) {
      // 테이블 셀
      const firstPara = data.elements.find(e => e.type === 'paragraph');
      const styleProps = firstPara ? {
        paraShapeId: firstPara.paraShapeId,
        styleId: firstPara.styleId,
      } : {};

      data.elements = data.elements.filter(e => e.type !== 'paragraph');
      data.elements.push({
        type: 'paragraph',
        ...styleProps,
        runs: newRuns,
      });
    } else if (data.runs !== undefined) {
      // 일반 단락
      data.runs = newRuns;
    }

    logger.debug(`  ✓ Data updated with ${newRuns.length} styled runs`);
  }

  /**
   * 임시 요소 생성 (HTML → 텍스트 추출용)
   * @private
   */
  _createTempElement(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp;
  }

  /**
   * 셀/단락 데이터 업데이트
   * ✅ Phase 1 P0: 양방향 변환 통일 - 하나의 paragraph에 linebreak run 사용
   * @private
   */
  _updateCellData(data, newText) {
    // 테이블 셀인 경우
    if (data.elements) {
      // 기존 단락의 스타일 정보 가져오기 (첫 번째 단락 기준)
      const firstPara = data.elements.find(e => e.type === 'paragraph');
      const styleProps = firstPara
        ? {
            paraShapeId: firstPara.paraShapeId,
            styleId: firstPara.styleId,
            charShapeId: firstPara.runs?.[0]?.charShapeId, // 첫 번째 run의 스타일
          }
        : {};

      // ✅ 개선: 하나의 paragraph에 runs 배열로 저장 (여러 paragraph 대신)
      data.elements = data.elements.filter(e => e.type !== 'paragraph');

      // ✅ 줄바꿈을 linebreak run으로 변환
      const runs = [];
      const lines = newText.split('\n');
      lines.forEach((line, idx) => {
        if (idx > 0) {
          // 줄바꿈 추가
          runs.push({
            type: 'linebreak',
            charShapeId: styleProps.charShapeId,
          });
        }
        // ✅ 빈 줄도 보존 (빈 문자열 허용)
        if (line || idx === lines.length - 1) {
          runs.push({
            text: line,
            charShapeId: styleProps.charShapeId,
          });
        }
      });

      // ✅ 단일 paragraph 추가
      data.elements.push({
        type: 'paragraph',
        paraShapeId: styleProps.paraShapeId,
        styleId: styleProps.styleId,
        runs,
      });

      logger.debug(
        `  ✓ Cell data updated with single paragraph (${lines.length} lines, ${runs.length} runs, style preserved)`
      );
    }
    // 일반 단락인 경우
    else if (data.runs) {
      // 기존 run의 스타일 정보 (첫 번째 run 기준)
      const firstRun = data.runs[0];
      const charShapeId = firstRun ? firstRun.charShapeId : undefined;

      // runs 배열 업데이트
      data.runs = [];

      // ✅ 줄바꿈 처리: linebreak run 사용
      const lines = newText.split('\n');
      lines.forEach((line, idx) => {
        if (idx > 0) {
          // 줄바꿈 추가
          data.runs.push({
            type: 'linebreak',
            charShapeId: charShapeId,
          });
        }
        // ✅ 빈 줄도 보존
        if (line || idx === lines.length - 1) {
          data.runs.push({
            text: line,
            charShapeId: charShapeId,
          });
        }
      });

      logger.debug(
        `  ✓ Paragraph data updated with ${lines.length} lines (${data.runs.length} runs, style preserved)`
      );
    }
  }

  /**
   * DOM 업데이트 (데이터와 화면 동기화)
   * ✅ Phase 2 P0: Undo/Redo 시 DOM을 데이터 모델과 동기화
   * ✅ Phase 2 P1: WeakMap 기반 메모리 최적화
   * ✅ Phase 2 P2: 배치 모드 지원 - 여러 업데이트를 큐에 저장
   * ✅ v2.1.1: WeakMap fallback mechanism 추가
   * @param {Object} data - 셀/단락 데이터 (WeakMap에서 element 찾기)
   * @param {string} text - 표시할 텍스트 (줄바꿈 포함)
   * @private
   */
  _refreshDOM(data, text) {
    // ✅ Phase 2 P1: WeakMap에서 element 찾기 (메모리 효율적)
    let element = this.cellDataMap.get(data);

    // ✅ v2.1.1: WeakMap에 없으면 fallback 시도
    if (!element || !element.isConnected) {
      logger.debug('⚠️ Element not found in WeakMap or disconnected, trying fallback...');
      element = this._findElementByData(data);

      if (element) {
        // WeakMap에 다시 등록
        this.cellDataMap.set(data, element);
        logger.debug('✅ Element found via fallback and re-registered in WeakMap');
      }
    }

    // 요소가 등록되지 않았거나 DOM에 없으면 무시
    if (!element) {
      logger.debug('⚠️ Element not found via WeakMap or fallback, skipping refresh');
      return;
    }

    // ✅ Phase 2 P2: DOM 업데이트 함수 정의
    const update = () => {
      // 업데이트 시점에 다시 체크 (배치 실행 시 상태가 변경될 수 있음)
      if (!element.isConnected) {
        logger.debug('⚠️ Element not in DOM, skipping refresh');
        return;
      }

      // 편집 중인 요소는 업데이트하지 않음
      if (element === this.editingCell) {
        logger.debug('⚠️ Element is being edited, skipping refresh to preserve user input');
        return;
      }

      // 줄바꿈을 <br>로 변환
      const html = text.split('\n').join('<br>');

      // XSS 방지를 위한 sanitization
      const safeHTML = sanitizeHTML(html);

      // DOM 업데이트
      element.innerHTML = safeHTML;

      logger.debug(
        `✅ DOM refreshed for undo/redo (${text.length} chars, ${(text.match(/\n/g) || []).length} line breaks)`
      );
    };

    // ✅ Phase 2 P2: 배치 모드면 큐에 추가, 아니면 즉시 실행
    if (this.viewer.historyManager?.batchMode) {
      this.viewer.historyManager.batchUpdates.push(update);
      logger.debug('📦 DOM update queued in batch mode');
    } else {
      update();
    }
  }

  /**
   * 데이터 객체로 DOM 요소 찾기 (WeakMap fallback)
   * ✅ v2.1.1: DOM 재렌더링 후 WeakMap이 stale할 때 사용
   * @param {Object} data - 셀/단락 데이터
   * @returns {HTMLElement|null} 찾은 DOM 요소
   * @private
   */
  _findElementByData(data) {
    // 데이터가 없으면 null 반환
    if (!data) return null;

    // ✅ Case 1: 테이블 셀 찾기 (_cellData로 연결된 요소)
    const cells = document.querySelectorAll('td[data-editable], th[data-editable]');
    for (const cell of cells) {
      if (cell._cellData === data) {
        return cell;
      }
    }

    // ✅ Case 2: 단락 찾기 (_paraData로 연결된 요소)
    const paragraphs = document.querySelectorAll('.hwp-paragraph.editable-paragraph');
    for (const para of paragraphs) {
      if (para._paraData === data) {
        return para;
      }
    }

    // ✅ Case 3: 문서 데이터 구조에서 위치로 찾기
    const document = this.viewer?.getDocument();
    if (document && document.sections) {
      // 테이블 셀인 경우 (elements 속성 존재)
      if (data.elements !== undefined) {
        const position = this._findCellPositionInDocument(document, data);
        if (position) {
          const { tableIndex, rowIndex, colIndex } = position;
          const tables = this.viewer.container.querySelectorAll('.hwp-table');
          if (tables[tableIndex]) {
            const rows = tables[tableIndex].querySelectorAll('tr');
            if (rows[rowIndex]) {
              const cellElements = rows[rowIndex].querySelectorAll('td, th');
              if (cellElements[colIndex]) {
                logger.debug(`✅ Found cell via document position: table ${tableIndex}, row ${rowIndex}, col ${colIndex}`);
                return cellElements[colIndex];
              }
            }
          }
        }
      }

      // 단락인 경우 (runs 속성 존재)
      if (data.runs !== undefined) {
        const position = this._findParagraphPositionInDocument(document, data);
        if (position !== null) {
          const paragraphElements = this.viewer.container.querySelectorAll('.hwp-paragraph:not(.hwp-table .hwp-paragraph)');
          if (paragraphElements[position]) {
            logger.debug(`✅ Found paragraph via document position: index ${position}`);
            return paragraphElements[position];
          }
        }
      }
    }

    logger.debug('⚠️ Could not find element via fallback methods');
    return null;
  }

  /**
   * 문서 데이터에서 셀의 위치 찾기
   * @private
   */
  _findCellPositionInDocument(doc, cellData) {
    let tableIndex = 0;

    for (const section of doc.sections) {
      for (const element of section.elements) {
        if (element.type === 'table' && element.rows) {
          for (let rowIndex = 0; rowIndex < element.rows.length; rowIndex++) {
            const row = element.rows[rowIndex];
            if (row.cells) {
              for (let colIndex = 0; colIndex < row.cells.length; colIndex++) {
                if (row.cells[colIndex] === cellData) {
                  return { tableIndex, rowIndex, colIndex };
                }
              }
            }
          }
          tableIndex++;
        }
      }
    }

    return null;
  }

  /**
   * 문서 데이터에서 단락의 위치 찾기
   * @private
   */
  _findParagraphPositionInDocument(doc, paraData) {
    let paraIndex = 0;

    for (const section of doc.sections) {
      for (const element of section.elements) {
        if (element.type === 'paragraph') {
          if (element === paraData) {
            return paraIndex;
          }
          paraIndex++;
        }
        // 테이블 내부 단락은 제외 (별도로 처리됨)
      }
    }

    return null;
  }

  /**
   * 다음/이전 편집 가능한 요소로 이동 (Phase 2: 키보드 네비게이션)
   * @param {string} direction - 'next', 'prev', 'up', 'down'
   * @private
   */
  _navigateToNext(direction) {
    const current = this.editingCell;
    if (!current) return;

    let target = null;

    // 현재 변경사항 저장 (편집 모드는 유지)
    this.saveChanges(false);

    // 편집 가능한 모든 요소 찾기
    const editableElements = this._getAllEditableElements();
    const currentIndex = editableElements.indexOf(current);

    if (currentIndex === -1) {
      logger.warn('⚠️ Current element not found in editable list');
      return;
    }

    switch (direction) {
      case 'next':
        target = editableElements[currentIndex + 1];
        break;
      case 'prev':
        target = editableElements[currentIndex - 1];
        break;
      case 'down':
        target = this._findElementBelow(current, editableElements);
        break;
      case 'up':
        target = this._findElementAbove(current, editableElements);
        break;
    }

    if (target) {
      // 다음 요소 편집 모드 활성화
      const targetData = target._cellData || target._paraData;
      if (targetData) {
        this.enableEditMode(target, targetData);
        logger.info(`🔀 Navigated to ${direction} element`);
      }
    } else {
      logger.debug(`⚠️ No ${direction} element found`);
      // 마지막 요소이면 편집 모드 종료
      if (direction === 'next' && currentIndex === editableElements.length - 1) {
        this.saveChanges(true);
        logger.info('✅ Reached end of document, edit mode exited');
      }
    }
  }

  /**
   * 모든 편집 가능한 요소 가져오기
   * @private
   */
  _getAllEditableElements() {
    const cells = Array.from(document.querySelectorAll('td[title*="편집"], th[title*="편집"]'));
    const paragraphs = Array.from(
      document.querySelectorAll('.hwp-paragraph:not(.hwp-table .hwp-paragraph)[title*="편집"]')
    );

    // DOM 순서대로 정렬
    return [...cells, ...paragraphs].sort((a, b) => {
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  /**
   * 아래쪽 요소 찾기 (테이블 행 고려)
   * @private
   */
  _findElementBelow(current, elements) {
    const rect = current.getBoundingClientRect();

    // 현재 요소보다 아래에 있고, 같은 열에 있는 요소 찾기
    return elements.find(el => {
      if (el === current) return false;
      const elRect = el.getBoundingClientRect();
      return elRect.top > rect.bottom && Math.abs(elRect.left - rect.left) < 50; // 같은 열 (±50px)
    });
  }

  /**
   * 위쪽 요소 찾기 (테이블 행 고려)
   * @private
   */
  _findElementAbove(current, elements) {
    const rect = current.getBoundingClientRect();

    // 현재 요소보다 위에 있고, 같은 열에 있는 요소 찾기
    const reversed = [...elements].reverse();
    return reversed.find(el => {
      if (el === current) return false;
      const elRect = el.getBoundingClientRect();
      return elRect.bottom < rect.top && Math.abs(elRect.left - rect.left) < 50;
    });
  }

  /**
   * 커서가 텍스트 끝에 있는지 확인
   * @private
   */
  _isCursorAtEnd() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    const clone = range.cloneRange();

    clone.selectNodeContents(this.editingCell);
    clone.setStart(range.endContainer, range.endOffset);

    return clone.toString().trim().length === 0;
  }

  /**
   * 커서가 텍스트 시작에 있는지 확인
   * @private
   */
  _isCursorAtStart() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    const clone = range.cloneRange();

    clone.selectNodeContents(this.editingCell);
    clone.setEnd(range.startContainer, range.startOffset);

    return clone.toString().trim().length === 0;
  }

  /**
   * 테이블 전체에 편집 기능 활성화 (개선: 완벽한 편집 모드)
   * @param {HTMLElement} tableElement - 테이블 요소
   * @param {Object} tableData - 테이블 데이터
   */
  enableTableEditing(tableElement, tableData) {
    const cells = tableElement.querySelectorAll('td, th');
    let enabledCount = 0;
    let failedCount = 0;

    cells.forEach((cell, index) => {
      // cellData 연결
      let cellData = this._findCellData(tableData, index);

      // ✅ cellData가 없으면 빈 구조 생성 (폴백)
      if (!cellData) {
        logger.debug(`⚠️ Cell ${index}: No cellData found, creating empty structure`);
        cellData = {
          elements: [],
        };
        failedCount++;
      }

      // 데이터 참조 저장
      cell._cellData = cellData;

      // ✅ Phase 2 P1: WeakMap에 cellData → element 매핑 등록
      this.cellDataMap.set(cellData, cell);

      // ✅ v2.1.0: 싱글클릭 이벤트 (글로벌 편집 모드 체크 포함)
      const clickHandler = e => {
        // ✅ 편집 모드가 OFF면 클릭 무시
        if (window.editModeManager && !window.editModeManager.isGlobalEditMode) {
          logger.debug('⚠️ Edit mode is OFF - cell click ignored');
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        this.enableEditMode(cell, cellData);
      };

      // 기존 리스너 제거 (중복 방지)
      cell.removeEventListener('click', clickHandler);
      cell.addEventListener('click', clickHandler);

      // ✅ cursor 우선순위: text가 항상 우선 (TableResizer보다 우선)
      cell.style.setProperty('cursor', 'text', 'important');

      // ✅ 기존 title 속성 명시적으로 제거 (툴팁 제거)
      cell.removeAttribute('title');

      // 편집 가능 표시 (data attribute)
      cell.setAttribute('data-editable', 'true');

      enabledCount++;
    });

    if (failedCount > 0) {
      logger.warn(`⚠️ ${failedCount} cells created with empty cellData (fallback)`);
    }

    logger.info(
      `✅ Table editing enabled for ${enabledCount} cells (single-click, ${failedCount} fallback)`
    );
  }

  /**
   * 일반 단락에 편집 기능 활성화 (개선: 싱글 클릭)
   * @param {NodeList|Array} paragraphs - 단락 요소들
   */
  enableParagraphEditing(paragraphs) {
    if (!paragraphs || paragraphs.length === 0) {
      logger.warn('⚠️ No paragraphs provided for editing');
      return;
    }

    let editableCount = 0;
    let skippedCount = 0;

    paragraphs.forEach((paraElement, index) => {
      // 테이블 내부 단락은 제외 (이미 테이블 편집으로 처리됨)
      if (paraElement.closest('.hwp-table')) {
        skippedCount++;
        return;
      }

      // 단락 데이터 확인 (렌더링 시점에 이미 연결됨)
      const paraData = paraElement._paraData;
      if (!paraData) {
        logger.debug(`⚠️ Paragraph ${index} has no data attached`);
        return;
      }

      // ✅ v2.1.0: 더블클릭 → 싱글클릭 (글로벌 편집 모드 체크 포함)
      paraElement.addEventListener('click', e => {
        // ✅ 편집 모드가 OFF면 클릭 무시
        if (window.editModeManager && !window.editModeManager.isGlobalEditMode) {
          logger.debug('⚠️ Edit mode is OFF - paragraph click ignored');
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        this.enableEditMode(paraElement, paraData);
      });

      // 편집 가능 힌트
      paraElement.style.cursor = 'text';

      // ✅ 기존 title 속성 명시적으로 제거 (툴팁 제거)
      paraElement.removeAttribute('title');

      paraElement.classList.add('editable-paragraph');

      editableCount++;
    });

    logger.info(
      `✅ Paragraph editing enabled: ${editableCount} editable (single-click), ${skippedCount} skipped (in tables)`
    );
  }

  /**
   * 셀 데이터 찾기 (개선: 더 robust한 매칭)
   * @private
   */
  _findCellData(tableData, cellIndex) {
    if (!tableData || !tableData.rows) {
      logger.warn('⚠️ Invalid tableData provided');
      return null;
    }

    let currentIndex = 0;
    for (const row of tableData.rows) {
      if (!row.cells) continue;

      for (const cell of row.cells) {
        if (currentIndex === cellIndex) {
          return cell;
        }
        currentIndex++;
      }
    }

    // ✅ 개선: 인덱스를 찾지 못한 경우 순환 방식으로 재시도
    if (cellIndex >= currentIndex && currentIndex > 0) {
      const cycledIndex = cellIndex % currentIndex;
      logger.debug(`⚠️ Cell ${cellIndex} not found, using cycled index ${cycledIndex}`);

      let idx = 0;
      for (const row of tableData.rows) {
        if (!row.cells) continue;
        for (const cell of row.cells) {
          if (idx === cycledIndex) {
            return cell;
          }
          idx++;
        }
      }
    }

    logger.debug(`⚠️ Cell ${cellIndex} not found in tableData`);
    return null;
  }

  /**
   * 현재 편집 중인지 확인
   * @returns {boolean}
   */
  isEditing() {
    return this.editingCell !== null;
  }

  /**
   * 모든 편집 종료
   */
  finishEditing() {
    if (this.editingCell) {
      this.saveChanges(true);
    }
  }
}

export default InlineEditor;
