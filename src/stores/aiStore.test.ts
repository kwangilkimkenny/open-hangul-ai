/**
 * AI Store tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from './aiStore';
import { act } from '@testing-library/react';

describe('useAIStore', () => {
  beforeEach(() => {
    act(() => {
      const store = useAIStore.getState();
      store.clearApiKey();
      store.clearMessages();
      store.setProcessing(false);
      store.setPanelOpen(false);
      store.setCustomApi(false);
    });
  });

  // 1. Initial state correct
  it('should have correct initial state', () => {
    const state = useAIStore.getState();
    expect(state.isProcessing).toBe(false);
    expect(state.apiKey).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.isPanelOpen).toBe(false);
  });

  // 2. setApiKey stores key
  it('should store API key via setApiKey', () => {
    act(() => {
      useAIStore.getState().setApiKey('sk-test-key-123');
    });
    expect(useAIStore.getState().apiKey).toBe('sk-test-key-123');
  });

  // 3. clearApiKey resets to null
  it('should reset API key to null via clearApiKey', () => {
    act(() => {
      useAIStore.getState().setApiKey('sk-test');
    });
    act(() => {
      useAIStore.getState().clearApiKey();
    });
    expect(useAIStore.getState().apiKey).toBeNull();
  });

  // 4. hasApiKey() returns false when no key
  it('should return false from hasApiKey when no key set', () => {
    expect(useAIStore.getState().hasApiKey()).toBe(false);
  });

  // 5. hasApiKey() returns true when key set
  it('should return true from hasApiKey when key is set', () => {
    act(() => {
      useAIStore.getState().setApiKey('sk-key');
    });
    expect(useAIStore.getState().hasApiKey()).toBe(true);
  });

  // 6. hasApiKey() returns true with custom API key
  it('should return true from hasApiKey with custom API key', () => {
    act(() => {
      useAIStore.getState().setCustomApi(true, 'https://custom.api/v1', 'custom-key-123');
    });
    expect(useAIStore.getState().hasApiKey()).toBe(true);
  });

  // 7. setCustomApi stores endpoint and key
  it('should store custom API settings', () => {
    act(() => {
      useAIStore.getState().setCustomApi(true, 'https://my-api.com/v1', 'my-key');
    });
    const state = useAIStore.getState();
    expect(state.customApiEnabled).toBe(true);
    expect(state.customEndpoint).toBe('https://my-api.com/v1');
    expect(state.customApiKey).toBe('my-key');
  });

  // 8. getActiveEndpoint returns default when no custom
  it('should return default endpoint when custom not enabled', () => {
    const endpoint = useAIStore.getState().getActiveEndpoint();
    expect(endpoint).toBe('https://api.openai.com/v1/chat/completions');
  });

  // 9. getActiveEndpoint returns custom when enabled
  it('should return custom endpoint when enabled', () => {
    act(() => {
      useAIStore.getState().setCustomApi(true, 'https://custom.api/chat', 'key');
    });
    expect(useAIStore.getState().getActiveEndpoint()).toBe('https://custom.api/chat');
  });

  // 10. getActiveApiKey returns apiKey normally
  it('should return standard apiKey from getActiveApiKey', () => {
    act(() => {
      useAIStore.getState().setApiKey('sk-standard');
    });
    expect(useAIStore.getState().getActiveApiKey()).toBe('sk-standard');
  });

  // 11. getActiveApiKey returns customApiKey when custom enabled
  it('should return customApiKey from getActiveApiKey when custom enabled', () => {
    act(() => {
      useAIStore.getState().setApiKey('sk-standard');
      useAIStore.getState().setCustomApi(true, 'https://custom.api', 'sk-custom');
    });
    expect(useAIStore.getState().getActiveApiKey()).toBe('sk-custom');
  });

  // 12. addMessage adds to messages array
  it('should add a message to the messages array', () => {
    let id: string;
    act(() => {
      id = useAIStore.getState().addMessage('user', 'Hello AI');
    });
    const messages = useAIStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('user');
    expect(messages[0].content).toBe('Hello AI');
    expect(messages[0].id).toBe(id!);
    expect(messages[0].timestamp).toBeInstanceOf(Date);
  });

  // 13. updateMessage changes content and clears isLoading
  it('should update message content and clear isLoading', () => {
    let id: string;
    act(() => {
      id = useAIStore.getState().addLoadingMessage();
    });
    expect(useAIStore.getState().messages[0].isLoading).toBe(true);

    act(() => {
      useAIStore.getState().updateMessage(id!, 'AI response text');
    });

    const msg = useAIStore.getState().messages[0];
    expect(msg.content).toBe('AI response text');
    expect(msg.isLoading).toBe(false);
  });

  // 14. removeMessage filters out by id
  it('should remove a message by id', () => {
    let id1: string, id2: string;
    act(() => {
      id1 = useAIStore.getState().addMessage('user', 'First');
      id2 = useAIStore.getState().addMessage('assistant', 'Second');
    });
    expect(useAIStore.getState().messages).toHaveLength(2);

    act(() => {
      useAIStore.getState().removeMessage(id1!);
    });
    const remaining = useAIStore.getState().messages;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2!);
  });

  // 15. clearMessages empties array
  it('should clear all messages', () => {
    act(() => {
      useAIStore.getState().addMessage('user', 'msg1');
      useAIStore.getState().addMessage('assistant', 'msg2');
    });
    expect(useAIStore.getState().messages).toHaveLength(2);

    act(() => {
      useAIStore.getState().clearMessages();
    });
    expect(useAIStore.getState().messages).toEqual([]);
  });

  // 16. addLoadingMessage creates assistant message with isLoading=true
  it('should create a loading assistant message', () => {
    let id: string;
    act(() => {
      id = useAIStore.getState().addLoadingMessage();
    });
    const msg = useAIStore.getState().messages[0];
    expect(msg.id).toBe(id!);
    expect(msg.type).toBe('assistant');
    expect(msg.isLoading).toBe(true);
    expect(msg.content).toBeTruthy();
  });

  // 17. togglePanel flips isPanelOpen
  it('should toggle isPanelOpen', () => {
    expect(useAIStore.getState().isPanelOpen).toBe(false);
    act(() => {
      useAIStore.getState().togglePanel();
    });
    expect(useAIStore.getState().isPanelOpen).toBe(true);
    act(() => {
      useAIStore.getState().togglePanel();
    });
    expect(useAIStore.getState().isPanelOpen).toBe(false);
  });

  // 18. setProcessing updates state
  it('should update isProcessing via setProcessing', () => {
    act(() => {
      useAIStore.getState().setProcessing(true);
    });
    expect(useAIStore.getState().isProcessing).toBe(true);
    act(() => {
      useAIStore.getState().setProcessing(false);
    });
    expect(useAIStore.getState().isProcessing).toBe(false);
  });
});
