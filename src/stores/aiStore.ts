/**
 * AI Store
 * AI 기능 상태 관리 (Zustand)
 * 
 * @module stores/aiStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface AIState {
  // State
  isProcessing: boolean;
  apiKey: string | null;
  customApiEnabled: boolean;
  customEndpoint: string | null;
  customApiKey: string | null;
  messages: ChatMessage[];
  isPanelOpen: boolean;
  
  // Actions
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setCustomApi: (enabled: boolean, endpoint?: string, key?: string) => void;
  setProcessing: (processing: boolean) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  
  // Message Actions
  addMessage: (type: ChatMessage['type'], content: string) => string;
  updateMessage: (id: string, content: string) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  addLoadingMessage: () => string;
  
  // Computed
  hasApiKey: () => boolean;
  getActiveEndpoint: () => string;
  getActiveApiKey: () => string | null;
}

const OPENAI_DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export const useAIStore = create<AIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        isProcessing: false,
        apiKey: null,
        customApiEnabled: false,
        customEndpoint: null,
        customApiKey: null,
        messages: [],
        isPanelOpen: false,
        
        // Actions
        setApiKey: (key) => set({ apiKey: key }),
        
        clearApiKey: () => set({ apiKey: null }),
        
        setCustomApi: (enabled, endpoint, key) => set({
          customApiEnabled: enabled,
          customEndpoint: endpoint || null,
          customApiKey: key || null,
        }),
        
        setProcessing: (processing) => set({ isProcessing: processing }),
        
        setPanelOpen: (open) => set({ isPanelOpen: open }),
        
        togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
        
        // Message Actions
        addMessage: (type, content) => {
          const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const message: ChatMessage = {
            id,
            type,
            content,
            timestamp: new Date(),
          };
          
          set((state) => ({
            messages: [...state.messages, message]
          }));
          
          return id;
        },
        
        updateMessage: (id, content) => {
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === id ? { ...msg, content, isLoading: false } : msg
            )
          }));
        },
        
        removeMessage: (id) => {
          set((state) => ({
            messages: state.messages.filter((msg) => msg.id !== id)
          }));
        },
        
        clearMessages: () => set({ messages: [] }),
        
        addLoadingMessage: () => {
          const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const message: ChatMessage = {
            id,
            type: 'assistant',
            content: '처리 중...',
            timestamp: new Date(),
            isLoading: true,
          };
          
          set((state) => ({
            messages: [...state.messages, message]
          }));
          
          return id;
        },
        
        // Computed
        hasApiKey: () => {
          const { apiKey, customApiEnabled, customApiKey } = get();
          if (customApiEnabled) {
            return !!customApiKey;
          }
          return !!apiKey;
        },
        
        getActiveEndpoint: () => {
          const { customApiEnabled, customEndpoint } = get();
          if (customApiEnabled && customEndpoint) {
            return customEndpoint;
          }
          return OPENAI_DEFAULT_ENDPOINT;
        },
        
        getActiveApiKey: () => {
          const { apiKey, customApiEnabled, customApiKey } = get();
          if (customApiEnabled) {
            return customApiKey;
          }
          return apiKey;
        },
      }),
      {
        name: 'ai-store',
        partialize: (state) => ({
          apiKey: state.apiKey,
          customApiEnabled: state.customApiEnabled,
          customEndpoint: state.customEndpoint,
          customApiKey: state.customApiKey,
        }),
      }
    ),
    { name: 'ai-store' }
  )
);

export default useAIStore;

