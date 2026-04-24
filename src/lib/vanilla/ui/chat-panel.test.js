/**
 * ChatPanel 테스트 (v4 모듈화 아키텍처).
 *
 * 이 테스트는 v3 의 단일-클래스 메시지 API (addUserMessage / clearMessages 등)
 * 를 가정한 구버전 테스트를 v4 의 facade + sub-module 구조에 맞춰 다시 작성한 것이다.
 * v4 에서 메시지 관리는 ChatPanelMessaging, DOM 조작은 ChatPanelUI 가 담당한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
  }),
}));
vi.mock('../utils/ui.js', () => ({ showToast: vi.fn(), escapeHtml: vi.fn(t => t) }));
vi.mock('../config/ai-config.js', () => ({ AIConfig: {} }));
vi.mock('../features/cell-selector.js', () => ({
  CellSelector: vi.fn().mockImplementation(() => ({
    onSelectionChange: null,
    destroy: vi.fn(),
  })),
  CellMode: {},
}));

import { ChatPanel } from './chat-panel.js';

function createMockAiController() {
  return {
    viewer: null,
    setApiKey: vi.fn(),
    hasApiKey: vi.fn().mockReturnValue(false),
  };
}

function setupDOM() {
  document.body.innerHTML = `
        <div id="ai-chat-panel" class="ai-chat-panel">
            <div id="ai-chat-messages"></div>
            <input id="ai-chat-input" type="text" />
            <button id="ai-chat-send">Send</button>
            <button id="ai-panel-toggle">Toggle</button>
            <button class="close-button">Close</button>
        </div>
    `;
}

describe('ChatPanel', () => {
  let panel;
  let controller;

  beforeEach(() => {
    // localStorage 가 messaging 모듈에서 사용되므로 깨끗한 상태에서 시작.
    localStorage.clear();
    setupDOM();
    controller = createMockAiController();
    panel = new ChatPanel(controller);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  describe('construction', () => {
    it('uses default option ids when none are provided', () => {
      expect(panel.options.containerId).toBe('ai-chat-panel');
      expect(panel.options.inputId).toBe('ai-chat-input');
      expect(panel.options.messagesId).toBe('ai-chat-messages');
      expect(panel.options.sendButtonId).toBe('ai-chat-send');
      expect(panel.options.toggleButtonId).toBe('ai-panel-toggle');
      expect(panel.options.autoScroll).toBe(true);
    });

    it('accepts custom options', () => {
      const custom = new ChatPanel(controller, {
        containerId: 'my-panel',
        autoScroll: false,
      });
      expect(custom.options.containerId).toBe('my-panel');
      expect(custom.options.autoScroll).toBe(false);
    });

    it('starts in an uninitialized state with module slots empty', () => {
      expect(panel._initialized).toBe(false);
      expect(panel.ui).toBeNull();
      expect(panel.messaging).toBeNull();
      expect(panel.api).toBeNull();
    });
  });

  describe('init()', () => {
    it('binds DOM elements and creates sub-modules', async () => {
      const ok = await panel.init();

      expect(ok).toBe(true);
      expect(panel._initialized).toBe(true);
      expect(panel.elements.panel).not.toBeNull();
      expect(panel.elements.input).not.toBeNull();
      expect(panel.elements.messages).not.toBeNull();
      expect(panel.elements.sendButton).not.toBeNull();
      expect(panel.ui).not.toBeNull();
      expect(panel.messaging).not.toBeNull();
      expect(panel.api).not.toBeNull();
    });

    it('returns false when the container is missing', async () => {
      document.body.innerHTML = '';
      const ok = await panel.init();
      expect(ok).toBe(false);
      expect(panel._initialized).toBe(false);
    });

    it('is idempotent (re-init is safe under React StrictMode double-mount)', async () => {
      const first = await panel.init();
      const second = await panel.init();
      expect(first).toBe(true);
      expect(second).toBe(true);
      expect(panel._initialized).toBe(true);
    });
  });

  describe('messaging delegation', () => {
    beforeEach(async () => {
      await panel.init();
    });

    it('appends user messages to the DOM via the UI module', () => {
      panel.ui.appendMessageToUI('Hello', true);

      const userMessages = panel.elements.messages.querySelectorAll('.chat-message.user');
      expect(userMessages.length).toBe(1);
      expect(userMessages[0].textContent).toContain('Hello');
    });

    it('appends assistant messages to the DOM via the UI module', () => {
      panel.ui.appendMessageToUI('I can help', false);

      const aiMessages = panel.elements.messages.querySelectorAll('.chat-message.assistant');
      expect(aiMessages.length).toBe(1);
      expect(aiMessages[0].textContent).toContain('I can help');
    });

    it('records messages in the messaging module conversation', () => {
      const message = panel.messaging.addMessage('First', true);

      expect(message.id).toMatch(/^msg-/);
      expect(message.isUser).toBe(true);
      expect(message.content).toBe('First');

      const conversation = panel.messaging.getCurrentConversation();
      expect(conversation.messages.length).toBe(1);
      expect(conversation.messages[0].content).toBe('First');
    });

    it('clears the messages container via ui.clearMessages()', () => {
      panel.ui.appendMessageToUI('one', true);
      panel.ui.appendMessageToUI('two', false);
      expect(panel.elements.messages.children.length).toBe(2);

      panel.ui.clearMessages();
      expect(panel.elements.messages.innerHTML).toBe('');
    });
  });

  describe('panel visibility facades', () => {
    beforeEach(async () => {
      await panel.init();
    });

    it('show() makes the panel visible', () => {
      panel.elements.panel.style.display = 'none';
      panel.show();
      expect(panel.elements.panel.style.display).toBe('block');
    });

    it('hide() hides the panel', () => {
      panel.elements.panel.style.display = 'block';
      panel.hide();
      expect(panel.elements.panel.style.display).toBe('none');
    });

    it('toggle() flips visibility on each call', () => {
      // Initial state has no inline display; first toggle should hide it.
      panel.toggle();
      expect(panel.elements.panel.style.display).toBe('none');

      panel.toggle();
      expect(panel.elements.panel.style.display).toBe('block');
    });
  });

  describe('clear() — full reset', () => {
    beforeEach(async () => {
      await panel.init();
    });

    it('clears the messages DOM and starts a new conversation', () => {
      panel.ui.appendMessageToUI('keep me', true);
      panel.messaging.addMessage('keep me', true);
      const oldConversationId = panel.messaging.currentConversationId;

      panel.clear();

      expect(panel.elements.messages.innerHTML).toBe('');
      expect(panel.messaging.currentConversationId).not.toBe(oldConversationId);
      expect(panel.messaging.getCurrentConversation().messages.length).toBe(0);
    });
  });

  describe('destroy()', () => {
    it('marks the panel as uninitialized and clears event-attachment marker', async () => {
      await panel.init();
      expect(panel._initialized).toBe(true);
      expect(panel.elements.panel.dataset.eventsAttached).toBe('true');

      panel.destroy();

      expect(panel._initialized).toBe(false);
      expect(panel.elements.panel.dataset.eventsAttached).toBe('false');
    });
  });
});
