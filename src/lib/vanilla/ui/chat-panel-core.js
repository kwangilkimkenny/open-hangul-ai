/**
 * Chat Panel Core Module
 * 리팩토링된 ChatPanel 메인 클래스
 *
 * @module ui/chat-panel-core
 * @version 4.0.0
 * @author Kwang-il Kim (김광일) <yatav@yatavent.com>
 * @since 2024
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';
import { ChatPanelUI } from './chat-panel-ui.js';
import { ChatPanelMessaging } from './chat-panel-messaging.js';
import { ChatPanelAPI } from './chat-panel-api.js';

const logger = getLogger();

/**
 * 리팩토링된 ChatPanel 클래스
 * 모듈화되어 유지보수가 쉬워졐습니다.
 */
export class ChatPanel {
  constructor(aiController, options = {}) {
    this.aiController = aiController;
    this.options = {
      containerId: options.containerId || 'ai-chat-panel',
      inputId: options.inputId || 'ai-chat-input',
      messagesId: options.messagesId || 'ai-chat-messages',
      sendButtonId: options.sendButtonId || 'ai-chat-send',
      toggleButtonId: options.toggleButtonId || 'ai-panel-toggle',
      autoScroll: options.autoScroll !== false,
      ...options,
    };

    // DOM 요소 참조
    this.elements = {
      panel: null,
      input: null,
      messages: null,
      sendButton: null,
      toggleButton: null,
      closeButton: null,
      apiKeyButton: null,
    };

    // 모듈 인스턴스
    this.ui = null;
    this.messaging = null;
    this.api = null;

    // 상태
    this._initialized = false;
    this._isProcessing = false;

    logger.info('ChatPanel created', { options: this.options });
  }

  /**
   * 초기화
   */
  async init() {
    try {
      this.findDOMElements();

      if (!this.elements.panel) {
        logger.error('Chat panel container not found');
        return false;
      }

      if (this._initialized) {
        // Re-init from React StrictMode double-mount or panel toggle is normal — debug only.
        logger.debug('ChatPanel already initialized, skipping re-init');
        return true;
      }

      // 모듈 인스턴스 생성
      this.ui = new ChatPanelUI(this.elements, this.options);
      this.messaging = new ChatPanelMessaging();
      this.api = new ChatPanelAPI(this.aiController);

      // 이벤트 리스너 설정
      this.attachEventListeners();

      // 초기 상태 설정
      this.updateUIState();

      // 저장된 대화 내용 복원
      await this.restoreConversation();

      this._initialized = true;
      logger.info('ChatPanel initialized successfully');

      return true;
    } catch (error) {
      logger.error('Failed to initialize ChatPanel', error);
      return false;
    }
  }

  /**
   * DOM 요소 찾기
   */
  findDOMElements() {
    this.elements.panel = document.getElementById(this.options.containerId);
    this.elements.input = document.getElementById(this.options.inputId);
    this.elements.messages = document.getElementById(this.options.messagesId);
    this.elements.sendButton = document.getElementById(this.options.sendButtonId);
    this.elements.toggleButton = document.getElementById(this.options.toggleButtonId);
    this.elements.closeButton = this.elements.panel?.querySelector('.close-button');
    this.elements.apiKeyButton = document.getElementById(this.options.apiKeyButtonId);
  }

  /**
   * 이벤트 리스너 설정
   */
  attachEventListeners() {
    const panel = this.elements.panel;
    if (panel && panel.dataset.eventsAttached === 'true') {
      return;
    }

    // 전송 버튼
    if (this.elements.sendButton) {
      this.elements.sendButton.addEventListener('click', () => this.sendMessage());
    }

    // Enter 키 처리
    if (this.elements.input) {
      this.elements.input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // 토글 버튼
    if (this.elements.toggleButton) {
      this.elements.toggleButton.addEventListener('click', () => this.ui.togglePanel());
    }

    // 닫기 버튼
    if (this.elements.closeButton) {
      this.elements.closeButton.addEventListener('click', () => this.ui.hidePanel());
    }

    // API 키 버튼
    if (this.elements.apiKeyButton) {
      this.elements.apiKeyButton.addEventListener('click', () => this.showAPIKeyModal());
    }

    // 이벤트 리스너 설정 완료 표시
    if (panel) {
      panel.dataset.eventsAttached = 'true';
    }

    logger.debug('Event listeners attached');
  }

  /**
   * 메시지 전송
   */
  async sendMessage() {
    if (this._isProcessing) {
      logger.warn('Message already being processed');
      return;
    }

    const message = this.elements.input?.value?.trim();
    if (!message) {
      logger.debug('Empty message, not sending');
      return;
    }

    if (!this.aiController.hasApiKey()) {
      this.ui.showError('API 키를 먼저 설정해 주세요.');
      this.showAPIKeyModal();
      return;
    }

    try {
      this._isProcessing = true;
      this.ui.updateInputState(true);
      this.ui.clearInput();

      // 사용자 메시지 추가
      this.messaging.addMessage(message, true);
      this.ui.appendMessageToUI(message, true);

      // AI 응답 생성
      this.ui.showLoading();

      const response = await this.api.generateResponse(message, {
        context: {
          conversationHistory: this.getRecentMessages(5),
        },
      });

      this.ui.hideLoading();

      // AI 응답 추가
      this.messaging.addMessage(response.content, false, response.metadata);
      this.ui.appendMessageToUI(response.content, false);

      logger.info('Message exchange completed', {
        userMessageLength: message.length,
        aiResponseLength: response.content.length,
      });
    } catch (error) {
      this.ui.hideLoading();
      this.ui.showError(error.message);
      logger.error('Message sending failed', error);
    } finally {
      this._isProcessing = false;
      this.ui.updateInputState(false);
    }
  }

  /**
   * 최근 메시지 가져오기
   */
  getRecentMessages(count = 5) {
    const conversation = this.messaging.getCurrentConversation();
    if (!conversation) return [];

    return conversation.messages
      .slice(-count * 2) // 사용자 + AI 메시지 고려
      .map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content,
      }));
  }

  /**
   * UI 상태 업데이트
   */
  updateUIState() {
    const hasApiKey = this.aiController.hasApiKey();

    // API 키 상태에 따른 UI 업데이트
    if (this.elements.apiKeyButton) {
      this.elements.apiKeyButton.textContent = hasApiKey ? '🔑 API 키 변경' : '🔑 API 키 설정';
      this.elements.apiKeyButton.className = hasApiKey ? 'api-key-set' : 'api-key-missing';
    }

    // 입력 필드 상태
    if (this.elements.input) {
      this.elements.input.disabled = !hasApiKey;
      this.elements.input.placeholder = hasApiKey
        ? '메시지를 입력하세요 (Shift+Enter로 줄바꿈)'
        : 'API 키를 먼저 설정해 주세요';
    }

    // 전송 버튼 상태
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !hasApiKey;
    }
  }

  /**
   * 저장된 대화 복원
   */
  async restoreConversation() {
    const currentConversation = this.messaging.getCurrentConversation();
    if (!currentConversation) return;

    this.ui.clearMessages();

    for (const message of currentConversation.messages) {
      this.ui.appendMessageToUI(message.content, message.isUser);
    }

    logger.debug('Conversation restored', {
      messageCount: currentConversation.messages.length,
    });
  }

  /**
   * 새 대화 시작
   */
  startNewConversation() {
    this.messaging.startNewConversation();
    this.ui.clearMessages();
    this.ui.showSuccess('새 대화를 시작했습니다.');

    logger.info('New conversation started');
  }

  /**
   * 대화 내용 내보내기
   */
  exportConversation(format = 'json') {
    const conversation = this.messaging.getCurrentConversation();
    if (!conversation) {
      this.ui.showError('내보낼 대화가 없습니다.');
      return null;
    }

    try {
      const exported = this.messaging.exportConversation(conversation.id, format);
      const blob = new Blob([exported], {
        type: format === 'json' ? 'application/json' : 'text/plain',
      });

      // 다운로드 링크 생성
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.ui.showSuccess('대화 내용이 다운로드되었습니다.');
      return exported;
    } catch (error) {
      this.ui.showError('내보내기 실패: ' + error.message);
      logger.error('Export failed', error);
      return null;
    }
  }

  /**
   * API 키 모달 표시
   */
  showAPIKeyModal() {
    // API 키 설정 모달 로직
    // 기존 구현 유지 또는 별도 모듈로 분리
    logger.info('API key modal requested');
  }

  /**
   * 정리
   */
  destroy() {
    if (this.api) {
      this.api.cancelCurrentRequest();
    }

    // 이벤트 리스너 제거
    if (this.elements.panel) {
      this.elements.panel.dataset.eventsAttached = 'false';
    }

    this._initialized = false;
    logger.info('ChatPanel destroyed');
  }

  // 편의 메서드들
  show() {
    this.ui?.showPanel();
  }
  hide() {
    this.ui?.hidePanel();
  }
  toggle() {
    this.ui?.togglePanel();
  }
  clear() {
    this.ui?.clearMessages();
    this.messaging?.startNewConversation();
  }
}

/**
 * 간편 초기화 함수
 */
export function initChatPanel(aiController, options = {}) {
  const chatPanel = new ChatPanel(aiController, options);
  chatPanel.init();
  return chatPanel;
}

export default ChatPanel;
