/**
 * AI Text Selector
 * 텍스트 선택 감지 및 AI 편집 툴바 표시
 * 
 * @module features/ai-text-selector
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('AITextSelector');

/**
 * AI 텍스트 선택 관리자
 */
export class AITextSelector {
    constructor(aiEditToolbar, editModeManager) {
        this.aiEditToolbar = aiEditToolbar;
        this.editModeManager = editModeManager;
        
        this.selectedRange = null;
        this.selectedText = '';
        this.selectedElement = null;
        this.selectionRect = null;
        this.isActive = false;
        
        this._init();
        logger.info('🎯 AITextSelector initialized');
    }
    
    /**
     * 초기화
     * @private
     */
    _init() {
        // 텍스트 선택 이벤트 리스너
        document.addEventListener('mouseup', this._handleMouseUp.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
        
        // 선택 해제 이벤트
        document.addEventListener('mousedown', (e) => {
            // AI 툴바 클릭이 아니면 숨기기
            if (!e.target.closest('.ai-edit-toolbar')) {
                this._hideToolbar();
            }
        });
        
        logger.debug('✅ Event listeners attached');
    }
    
    /**
     * 마우스업 이벤트 핸들러
     * @private
     */
    _handleMouseUp(e) {
        // 편집 모드가 OFF면 무시
        if (!this.editModeManager?.isGlobalEditMode) {
            return;
        }
        
        // AI 툴바나 다이얼로그 클릭이면 무시
        if (e.target.closest('.ai-edit-toolbar') || 
            e.target.closest('.ai-edit-dialog') ||
            e.target.closest('.modal')) {
            return;
        }
        
        setTimeout(() => {
            this._processSelection();
        }, 10);
    }
    
    /**
     * 키업 이벤트 핸들러 (Shift + 화살표 등)
     * @private
     */
    _handleKeyUp(e) {
        // 편집 모드가 OFF면 무시
        if (!this.editModeManager?.isGlobalEditMode) {
            return;
        }
        
        // Shift 키 조합만 처리
        if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            setTimeout(() => {
                this._processSelection();
            }, 10);
        }
    }
    
    /**
     * 선택 처리
     * @private
     */
    _processSelection() {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        // 텍스트가 선택되지 않았으면 툴바 숨기기
        if (text.length === 0) {
            this._hideToolbar();
            return;
        }
        
        // 최소 2글자 이상 선택되어야 함
        if (text.length < 2) {
            logger.debug('⚠️ Selection too short (< 2 chars)');
            return;
        }
        
        // 선택 범위 저장
        try {
            this.selectedText = text;
            this.selectedRange = selection.getRangeAt(0).cloneRange();
            this.selectedElement = this._findEditableElement(selection);
            
            // 선택 범위의 화면 위치
            const rects = this.selectedRange.getClientRects();
            if (rects.length === 0) {
                logger.warn('⚠️ No selection rectangles found');
                return;
            }
            
            // 첫 번째와 마지막 rect를 사용하여 전체 범위 계산
            const firstRect = rects[0];
            const lastRect = rects[rects.length - 1];
            
            this.selectionRect = {
                left: firstRect.left,
                top: firstRect.top,
                right: lastRect.right,
                bottom: lastRect.bottom,
                width: lastRect.right - firstRect.left,
                height: lastRect.bottom - firstRect.top
            };
            
            logger.info(`✅ Text selected: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
            logger.debug(`   Length: ${text.length} chars`);
            logger.debug(`   Element: ${this.selectedElement?.tagName || 'unknown'}`);
            
            // AI 툴바 표시
            this._showToolbar();
            
        } catch (error) {
            logger.error('❌ Error processing selection:', error);
        }
    }
    
    /**
     * 편집 가능한 요소 찾기
     * @private
     */
    _findEditableElement(selection) {
        const anchorNode = selection.anchorNode;
        
        if (!anchorNode) {
            return null;
        }
        
        // 텍스트 노드면 부모 요소 찾기
        let element = anchorNode.nodeType === Node.TEXT_NODE 
            ? anchorNode.parentElement 
            : anchorNode;
        
        // 편집 가능한 요소까지 올라가기
        while (element && !this._isEditableElement(element)) {
            element = element.parentElement;
        }
        
        return element;
    }
    
    /**
     * 편집 가능한 요소인지 확인
     * @private
     */
    _isEditableElement(element) {
        if (!element) return false;
        
        // 테이블 셀
        if ((element.tagName === 'TD' || element.tagName === 'TH') && 
            element.hasAttribute('data-editable')) {
            return true;
        }
        
        // 일반 단락
        if (element.classList.contains('editable-paragraph')) {
            return true;
        }
        
        // hwp-paragraph
        if (element.classList.contains('hwp-paragraph')) {
            return true;
        }
        
        return false;
    }
    
    /**
     * AI 툴바 표시
     * @private
     */
    _showToolbar() {
        if (!this.aiEditToolbar) {
            logger.error('❌ AIEditToolbar not initialized');
            return;
        }
        
        this.isActive = true;
        
        this.aiEditToolbar.show({
            text: this.selectedText,
            rect: this.selectionRect,
            element: this.selectedElement,
            range: this.selectedRange
        });
    }
    
    /**
     * AI 툴바 숨기기
     * @private
     */
    _hideToolbar() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.selectedRange = null;
        this.selectedText = '';
        this.selectedElement = null;
        this.selectionRect = null;
        
        if (this.aiEditToolbar) {
            this.aiEditToolbar.hide();
        }
    }
    
    /**
     * 현재 선택 정보 가져오기
     */
    getSelectionInfo() {
        return {
            text: this.selectedText,
            range: this.selectedRange,
            element: this.selectedElement,
            rect: this.selectionRect,
            isActive: this.isActive
        };
    }
    
    /**
     * 선택 강제 해제
     */
    clearSelection() {
        this._hideToolbar();
        window.getSelection().removeAllRanges();
    }
}

export default AITextSelector;

