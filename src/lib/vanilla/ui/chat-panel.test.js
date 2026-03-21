import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn() }) }));
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
            <button id="ai-chat-toggle">Close</button>
            <button id="ai-api-key-btn">API Key</button>
            <button id="custom-api-settings-btn">Custom</button>
            <button id="ai-save-btn">Save</button>
            <button id="preview-structure-btn">Preview</button>
            <button id="apply-style-btn">Style</button>
            <button id="extract-template-btn">Template</button>
            <button id="ai-regenerate-btn">Regen</button>
            <button id="partial-edit-btn">Partial</button>
            <button id="validate-document-btn">Validate</button>
            <button id="batch-generate-btn">Batch</button>
            <button id="ai-clear-btn">Clear</button>
            <button id="cell-select-mode-btn">Cell</button>
            <button id="external-api-btn">External</button>
            <button id="fill-template-btn">Fill</button>
        </div>
    `;
}

describe('ChatPanel', () => {
    let panel;
    let controller;

    beforeEach(() => {
        setupDOM();
        controller = createMockAiController();
        panel = new ChatPanel(controller);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should construct with default options', () => {
        expect(panel.options.containerId).toBe('ai-chat-panel');
        expect(panel.options.inputId).toBe('ai-chat-input');
        expect(panel.options.messagesId).toBe('ai-chat-messages');
        expect(panel.options.autoScroll).toBe(true);
        expect(panel.messageIdCounter).toBe(0);
    });

    it('should accept custom options', () => {
        const custom = new ChatPanel(controller, { containerId: 'my-panel', autoScroll: false });
        expect(custom.options.containerId).toBe('my-panel');
        expect(custom.options.autoScroll).toBe(false);
    });

    it('should bind DOM elements on init()', () => {
        panel.init();

        expect(panel.elements.panel).not.toBeNull();
        expect(panel.elements.input).not.toBeNull();
        expect(panel.elements.messages).not.toBeNull();
        expect(panel.elements.sendButton).not.toBeNull();
    });

    it('should display a system welcome message on init', () => {
        panel.init();

        const messages = panel.elements.messages.querySelectorAll('.ai-message.system');
        expect(messages.length).toBeGreaterThanOrEqual(1);
        expect(messages[0].textContent).toContain('AI 문서 편집 기능');
    });

    it('should add a user message', () => {
        panel.init();
        const id = panel.addUserMessage('Hello');

        expect(id).toBe('msg-2'); // msg-1 is the system welcome message
        const el = document.getElementById(id);
        expect(el).not.toBeNull();
        expect(el.classList.contains('user')).toBe(true);
        expect(el.textContent).toBe('Hello');
    });

    it('should add an assistant message', () => {
        panel.init();
        const id = panel.addAssistantMessage('I can help');

        const el = document.getElementById(id);
        expect(el).not.toBeNull();
        expect(el.classList.contains('assistant')).toBe(true);
        expect(el.textContent).toBe('I can help');
    });

    it('should add a system message', () => {
        panel.init();
        panel.clearMessages();
        const id = panel.addSystemMessage('System notice');

        const el = document.getElementById(id);
        expect(el).not.toBeNull();
        expect(el.classList.contains('system')).toBe(true);
        expect(el.textContent).toBe('System notice');
    });

    it('should increment message IDs', () => {
        panel.init();
        panel.clearMessages();
        const id1 = panel.addMessage('user', 'First');
        const id2 = panel.addMessage('user', 'Second');

        expect(id1).toBe('msg-1');
        expect(id2).toBe('msg-2');
    });

    it('should clear all messages and reset counter', () => {
        panel.init();
        panel.addUserMessage('Test 1');
        panel.addUserMessage('Test 2');
        panel.clearMessages();

        expect(panel.elements.messages.innerHTML).toBe('');
        expect(panel.messageIdCounter).toBe(0);
    });

    it('should open the panel by adding open class', () => {
        panel.init();
        panel.open();

        expect(panel.elements.panel.classList.contains('open')).toBe(true);
    });

    it('should close the panel by removing open class', () => {
        panel.init();
        panel.open();
        panel.close();

        expect(panel.elements.panel.classList.contains('open')).toBe(false);
    });

    it('should toggle the panel open and closed', () => {
        panel.init();

        panel.toggle();
        expect(panel.elements.panel.classList.contains('open')).toBe(true);

        panel.toggle();
        expect(panel.elements.panel.classList.contains('open')).toBe(false);
    });

    it('should update an existing message', () => {
        panel.init();
        panel.clearMessages();
        const id = panel.addMessage('user', 'Original');
        panel.updateMessage(id, 'Updated');

        const el = document.getElementById(id);
        expect(el.textContent).toBe('Updated');
    });

    it('should remove a message by id', () => {
        vi.useFakeTimers();
        panel.init();
        panel.clearMessages();
        const id = panel.addMessage('user', 'To remove');

        panel.removeMessage(id);
        vi.advanceTimersByTime(300);

        expect(document.getElementById(id)).toBeNull();
        vi.useRealTimers();
    });
});
