/**
 * Chat Panel UI Module
 * DOM 조작 및 UI 관련 유틸리티
 *
 * @module ui/chat-panel-ui
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { showToast, escapeHtml } from '../utils/ui.js';

const logger = getLogger();

/**
 * ChatPanel UI 관리 클래스
 */
export class ChatPanelUI {
    constructor(elements, options) {
        this.elements = elements;
        this.options = options;
    }

    /**
     * 패널 가시성 토글
     */
    togglePanel() {
        if (!this.elements.panel) return;

        const isVisible = this.elements.panel.style.display !== 'none';
        this.elements.panel.style.display = isVisible ? 'none' : 'block';

        // 토글 버튼 상태 업데이트
        if (this.elements.toggleButton) {
            this.elements.toggleButton.textContent = isVisible ? '📝 AI 채팅' : '✕ 닫기';
        }

        logger.info('Chat panel toggled', { visible: !isVisible });
    }

    /**
     * 패널 표시
     */
    showPanel() {
        if (this.elements.panel) {
            this.elements.panel.style.display = 'block';
        }
    }

    /**
     * 패널 숨김
     */
    hidePanel() {
        if (this.elements.panel) {
            this.elements.panel.style.display = 'none';
        }
    }

    /**
     * 입력 필드 상태 업데이트
     */
    updateInputState(disabled = false) {
        if (this.elements.input) {
            this.elements.input.disabled = disabled;
            this.elements.input.placeholder = disabled ?
                'AI가 응답 중입니다...' :
                '메시지를 입력하세요 (Shift+Enter로 줄바꿈)';
        }

        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = disabled;
            this.elements.sendButton.textContent = disabled ? '⏳ 전송 중...' : '📤 전송';
        }
    }

    /**
     * 메시지를 화면에 추가
     */
    appendMessageToUI(message, isUser = false) {
        if (!this.elements.messages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user' : 'assistant'}`;

        const timestamp = new Date().toLocaleTimeString('ko-KR');
        const avatarIcon = isUser ? '👤' : '🤖';
        const senderLabel = isUser ? '사용자' : 'AI 어시스턴트';

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="avatar">${avatarIcon}</span>
                <span class="sender">${senderLabel}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">
                ${isUser ? escapeHtml(message) : this.formatAIResponse(message)}
            </div>
        `;

        this.elements.messages.appendChild(messageDiv);

        if (this.options.autoScroll) {
            this.scrollToBottom();
        }
    }

    /**
     * AI 응답 포맷팅
     */
    formatAIResponse(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    /**
     * 스크롤을 맨 아래로
     */
    scrollToBottom() {
        if (this.elements.messages) {
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        }
    }

    /**
     * 입력 필드 초기화
     */
    clearInput() {
        if (this.elements.input) {
            this.elements.input.value = '';
            this.elements.input.focus();
        }
    }

    /**
     * 메시지 영역 초기화
     */
    clearMessages() {
        if (this.elements.messages) {
            this.elements.messages.innerHTML = '';
        }
    }

    /**
     * 로딩 인디케이터 표시
     */
    showLoading() {
        if (!this.elements.messages) return;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message assistant loading';
        loadingDiv.id = 'ai-loading-indicator';
        loadingDiv.innerHTML = `
            <div class="message-header">
                <span class="avatar">🤖</span>
                <span class="sender">AI 어시스턴트</span>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                응답 생성 중...
            </div>
        `;

        this.elements.messages.appendChild(loadingDiv);
        this.scrollToBottom();
    }

    /**
     * 로딩 인디케이터 제거
     */
    hideLoading() {
        const loadingElement = document.getElementById('ai-loading-indicator');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    /**
     * 에러 메시지 표시
     */
    showError(message) {
        showToast('error', 'AI 채팅 오류', message);
        this.hideLoading();
        this.updateInputState(false);
    }

    /**
     * 성공 메시지 표시
     */
    showSuccess(message) {
        showToast('success', '성공', message);
    }
}

export default ChatPanelUI;