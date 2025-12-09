/**
 * AI Edit Toolbar
 * 선택된 텍스트에 대한 AI 편집 툴바
 * 
 * @module features/ai-edit-toolbar
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { showPrompt } from '../utils/ui.js';

const logger = getLogger('AIEditToolbar');

/**
 * AI 편집 툴바 클래스
 */
export class AIEditToolbar {
    constructor(aiTextEditor) {
        this.aiTextEditor = aiTextEditor;
        this.toolbar = null;
        this.currentSelection = null;
        this.isVisible = false;
        
        this._createToolbar();
        logger.info('🎨 AIEditToolbar initialized');
    }
    
    /**
     * 툴바 생성
     * @private
     */
    _createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'ai-edit-toolbar';
        toolbar.innerHTML = `
            <div class="ai-toolbar-content">
                <button class="ai-toolbar-btn ai-rewrite" data-action="rewrite" title="AI가 다시 작성합니다">
                    <span class="icon">✨</span>
                    <span class="text">다시 작성</span>
                </button>
                <button class="ai-toolbar-btn ai-summarize" data-action="summarize" title="선택한 텍스트를 요약합니다">
                    <span class="icon">📝</span>
                    <span class="text">요약</span>
                </button>
                <button class="ai-toolbar-btn ai-expand" data-action="expand" title="선택한 텍스트를 확장합니다">
                    <span class="icon">📏</span>
                    <span class="text">확장</span>
                </button>
                <button class="ai-toolbar-btn ai-custom" data-action="custom" title="직접 요청사항을 입력합니다">
                    <span class="icon">🎯</span>
                    <span class="text">맞춤 요청</span>
                </button>
                <div class="ai-toolbar-divider"></div>
                <button class="ai-toolbar-btn ai-close" data-action="close" title="닫기">
                    <span class="icon">✕</span>
                </button>
            </div>
        `;
        
        // 이벤트 리스너
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.ai-toolbar-btn');
            if (!btn) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const action = btn.dataset.action;
            this._handleAction(action);
        });
        
        // 마우스다운 이벤트로 선택 해제 방지
        toolbar.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        document.body.appendChild(toolbar);
        this.toolbar = toolbar;
        
        logger.debug('✅ Toolbar created');
    }
    
    /**
     * 툴바 표시
     * @param {Object} selectionInfo - 선택 정보
     */
    show(selectionInfo) {
        this.currentSelection = selectionInfo;
        this.isVisible = true;
        
        // 위치 계산
        const { rect } = selectionInfo;
        const toolbarRect = this.toolbar.getBoundingClientRect();
        
        // 툴바 위치: 선택된 텍스트 위쪽 중앙
        let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);
        let top = rect.top - toolbarRect.height - 10; // 10px 간격
        
        // 화면 경계 체크
        const scrollX = window.pageXOffset || document.documentElement.scrollTop;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        // 왼쪽 경계
        if (left < 10) {
            left = 10;
        }
        
        // 오른쪽 경계
        if (left + toolbarRect.width > window.innerWidth - 10) {
            left = window.innerWidth - toolbarRect.width - 10;
        }
        
        // 위쪽 경계 (위에 공간이 없으면 아래에 표시)
        if (top < scrollY + 10) {
            top = rect.bottom + 10;
            this.toolbar.classList.add('below');
        } else {
            this.toolbar.classList.remove('below');
        }
        
        // 위치 적용
        this.toolbar.style.left = `${left}px`;
        this.toolbar.style.top = `${top + scrollY}px`;
        this.toolbar.style.display = 'block';
        
        // 애니메이션
        setTimeout(() => {
            this.toolbar.classList.add('visible');
        }, 10);
        
        logger.info(`✅ Toolbar shown at (${Math.round(left)}, ${Math.round(top)})`);
    }
    
    /**
     * 툴바 숨기기
     */
    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.toolbar.classList.remove('visible');
        
        setTimeout(() => {
            this.toolbar.style.display = 'none';
            this.currentSelection = null;
        }, 200); // 애니메이션 시간
        
        logger.debug('✅ Toolbar hidden');
    }
    
    /**
     * 액션 처리
     * @private
     */
    async _handleAction(action) {
        if (!this.currentSelection) {
            logger.error('❌ No selection available');
            return;
        }
        
        const { text } = this.currentSelection;
        
        logger.info(`🎯 Action triggered: ${action}`);
        
        try {
            switch (action) {
                case 'rewrite':
                    await this._rewrite(text);
                    break;
                    
                case 'summarize':
                    await this._summarize(text);
                    break;
                    
                case 'expand':
                    await this._expand(text);
                    break;
                    
                case 'custom':
                    await this._custom(text);
                    break;
                    
                case 'close':
                    this.hide();
                    break;
                    
                default:
                    logger.warn(`⚠️ Unknown action: ${action}`);
            }
        } catch (error) {
            logger.error(`❌ Action failed: ${action}`, error);
        }
    }
    
    /**
     * 다시 작성
     * @private
     */
    async _rewrite(text) {
        logger.info('✨ Rewrite requested');
        
        if (!this.aiTextEditor) {
            logger.error('❌ AITextEditor not initialized');
            return;
        }
        
        await this.aiTextEditor.edit(
            text,
            '다음 텍스트를 더 명확하고 전문적으로 다시 작성해주세요.',
            this.currentSelection
        );
        
        this.hide();
    }
    
    /**
     * 요약
     * @private
     */
    async _summarize(text) {
        logger.info('📝 Summarize requested');
        
        if (!this.aiTextEditor) {
            logger.error('❌ AITextEditor not initialized');
            return;
        }
        
        await this.aiTextEditor.edit(
            text,
            '다음 텍스트를 핵심 내용만 간결하게 요약해주세요.',
            this.currentSelection
        );
        
        this.hide();
    }
    
    /**
     * 확장
     * @private
     */
    async _expand(text) {
        logger.info('📏 Expand requested');
        
        if (!this.aiTextEditor) {
            logger.error('❌ AITextEditor not initialized');
            return;
        }
        
        await this.aiTextEditor.edit(
            text,
            '다음 텍스트를 더 자세하고 풍부하게 확장해주세요.',
            this.currentSelection
        );
        
        this.hide();
    }
    
    /**
     * 맞춤 요청
     * @private
     */
    async _custom(text) {
        logger.info('🎯 Custom prompt requested');
        
        // 사용자 입력 받기
        const userPrompt = await showPrompt(
            '🎯 AI 편집 요청',
            '어떻게 수정할까요?',
            '예: 더 전문적으로, 쉽게 설명, 공손하게 등'
        );
        
        if (!userPrompt || userPrompt.trim().length === 0) {
            logger.debug('⚠️ User cancelled custom prompt');
            return;
        }
        
        logger.info(`📝 Custom prompt: "${userPrompt}"`);
        
        if (!this.aiTextEditor) {
            logger.error('❌ AITextEditor not initialized');
            return;
        }
        
        await this.aiTextEditor.edit(
            text,
            userPrompt,
            this.currentSelection
        );
        
        this.hide();
    }
    
    /**
     * 툴바 활성 상태 확인
     */
    isActive() {
        return this.isVisible;
    }
}

export default AIEditToolbar;

