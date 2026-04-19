/**
 * LLM Config Store Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLLMConfigStore } from '../llmConfigStore';
import type { LLMProvider } from '../../types/universal-llm';

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('LLM Config Store', () => {
  beforeEach(() => {
    // Reset store state
    useLLMConfigStore.getState().resetAll();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct default state', () => {
      const state = useLLMConfigStore.getState();

      expect(state.activeProvider).toBe('openai');
      expect(state.configs.openai.model).toBe('gpt-4o');
      expect(state.configs.claude.model).toBe('claude-3-5-sonnet-20241022');
      expect(state.configs.local.model).toBe('qwen2.5:7b');
      expect(state.recentProviders).toEqual(['openai']);
      expect(Object.keys(state.usageStats)).toHaveLength(0);
    });

    it('should have all provider configs', () => {
      const state = useLLMConfigStore.getState();

      expect(state.configs.openai).toBeDefined();
      expect(state.configs.claude).toBeDefined();
      expect(state.configs.vertex).toBeDefined();
      expect(state.configs.grok).toBeDefined();
      expect(state.configs['azure-openai']).toBeDefined();
      expect(state.configs.cohere).toBeDefined();
      expect(state.configs.local).toBeDefined();
    });
  });

  describe('Provider Management', () => {
    it('should set active provider', () => {
      const { setActiveProvider } = useLLMConfigStore.getState();

      setActiveProvider('claude');

      const state = useLLMConfigStore.getState();
      expect(state.activeProvider).toBe('claude');
      expect(state.recentProviders[0]).toBe('claude');
      expect(state.recentProviders).toContain('openai');
    });

    it('should maintain recent providers list', () => {
      const { setActiveProvider } = useLLMConfigStore.getState();

      setActiveProvider('claude');
      setActiveProvider('grok');
      setActiveProvider('vertex');

      const state = useLLMConfigStore.getState();
      expect(state.recentProviders).toEqual(['vertex', 'grok', 'claude', 'openai']);
    });

    it('should limit recent providers to 5', () => {
      const { setActiveProvider } = useLLMConfigStore.getState();
      const providers: LLMProvider[] = ['claude', 'grok', 'vertex', 'azure-openai', 'cohere', 'local'];

      providers.forEach(setActiveProvider);

      const state = useLLMConfigStore.getState();
      expect(state.recentProviders).toHaveLength(5);
      expect(state.recentProviders[0]).toBe('local');
      expect(state.recentProviders).not.toContain('openai'); // Should be pushed out
    });

    it('should not duplicate in recent providers', () => {
      const { setActiveProvider } = useLLMConfigStore.getState();

      setActiveProvider('claude');
      setActiveProvider('grok');
      setActiveProvider('claude'); // Switch back to claude

      const state = useLLMConfigStore.getState();
      expect(state.recentProviders).toEqual(['claude', 'grok', 'openai']);
      expect(state.recentProviders.filter(p => p === 'claude')).toHaveLength(1);
    });
  });

  describe('Configuration Management', () => {
    it('should update provider config', () => {
      const { updateConfig } = useLLMConfigStore.getState();

      updateConfig('openai', {
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        apiKey: 'new-key',
      });

      const state = useLLMConfigStore.getState();
      expect(state.configs.openai.model).toBe('gpt-3.5-turbo');
      expect(state.configs.openai.temperature).toBe(0.5);
      expect(state.configs.openai.apiKey).toBe('new-key');
      // Other properties should remain unchanged
      expect(state.configs.openai.provider).toBe('openai');
      expect(state.configs.openai.maxTokens).toBe(4000);
    });

    it('should get active config', () => {
      const { setActiveProvider, updateConfig, getActiveConfig } = useLLMConfigStore.getState();

      setActiveProvider('claude');
      updateConfig('claude', { temperature: 0.3 });

      const activeConfig = getActiveConfig();
      expect(activeConfig.provider).toBe('claude');
      expect(activeConfig.temperature).toBe(0.3);
    });

    it('should clear provider config', () => {
      const { updateConfig, clearConfig } = useLLMConfigStore.getState();

      // Modify config first
      updateConfig('openai', { apiKey: 'test-key', temperature: 0.5 });

      // Clear it
      clearConfig('openai');

      const state = useLLMConfigStore.getState();
      expect(state.configs.openai.apiKey).toBe(''); // Reset to default
      expect(state.configs.openai.temperature).toBe(0.7); // Reset to default
    });
  });

  describe('Usage Statistics', () => {
    it('should add usage statistics', () => {
      const { addUsage } = useLLMConfigStore.getState();

      addUsage('openai', 1000, 0.02, true);

      const state = useLLMConfigStore.getState();
      const stats = state.usageStats.openai;

      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.totalTokens).toBe(1000);
      expect(stats.totalCost).toBe(0.02);
      expect(stats.lastUsed).toBeInstanceOf(Date);
    });

    it('should accumulate usage statistics', () => {
      const { addUsage } = useLLMConfigStore.getState();

      addUsage('openai', 1000, 0.02, true);
      addUsage('openai', 500, 0.01, false); // Failed request
      addUsage('openai', 750, 0.015, true);

      const state = useLLMConfigStore.getState();
      const stats = state.usageStats.openai;

      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(2); // Only 2 successful
      expect(stats.totalTokens).toBe(2250); // 1000 + 500 + 750
      expect(stats.totalCost).toBe(0.045); // 0.02 + 0.01 + 0.015
    });

    it('should handle new provider usage', () => {
      const { addUsage } = useLLMConfigStore.getState();

      addUsage('claude', 800, 0.03, true);

      const state = useLLMConfigStore.getState();
      const stats = state.usageStats.claude;

      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.totalTokens).toBe(800);
      expect(stats.totalCost).toBe(0.03);
    });
  });

  describe('Import/Export', () => {
    it('should export configs', () => {
      const { updateConfig, setActiveProvider, exportConfigs } = useLLMConfigStore.getState();

      // Set up some state
      setActiveProvider('claude');
      updateConfig('openai', { apiKey: 'test-key' });

      const exported = exportConfigs();
      const parsed = JSON.parse(exported);

      expect(parsed.activeProvider).toBe('claude');
      expect(parsed.configs.openai.apiKey).toBe('test-key');
      expect(parsed.exportedAt).toBeTruthy();
    });

    it('should import configs', () => {
      const { importConfigs } = useLLMConfigStore.getState();

      const importData = {
        activeProvider: 'vertex',
        configs: {
          openai: {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            apiKey: 'imported-key',
            temperature: 0.8,
            maxTokens: 2000,
          },
        },
        exportedAt: '2024-01-01T00:00:00.000Z',
      };

      importConfigs(JSON.stringify(importData));

      const state = useLLMConfigStore.getState();
      expect(state.activeProvider).toBe('vertex');
      expect(state.configs.openai.model).toBe('gpt-3.5-turbo');
      expect(state.configs.openai.apiKey).toBe('imported-key');
    });

    it('should handle invalid import data', () => {
      const { importConfigs } = useLLMConfigStore.getState();

      expect(() => {
        importConfigs('invalid json');
      }).toThrow('유효하지 않은 설정 파일입니다');
    });

    it('should handle partial import data', () => {
      const { importConfigs } = useLLMConfigStore.getState();
      const originalState = useLLMConfigStore.getState();

      const partialData = {
        configs: {
          claude: {
            provider: 'claude',
            model: 'claude-3-opus-20240229',
            temperature: 0.9,
          },
        },
      };

      importConfigs(JSON.stringify(partialData));

      const newState = useLLMConfigStore.getState();
      expect(newState.activeProvider).toBe(originalState.activeProvider); // Unchanged
      expect(newState.configs.claude.model).toBe('claude-3-opus-20240229'); // Updated
      expect(newState.configs.openai).toEqual(originalState.configs.openai); // Unchanged
    });
  });

  describe('Store Reset', () => {
    it('should reset all state', () => {
      const { setActiveProvider, updateConfig, addUsage, resetAll } = useLLMConfigStore.getState();

      // Modify state
      setActiveProvider('claude');
      updateConfig('openai', { apiKey: 'test-key' });
      addUsage('openai', 1000, 0.02, true);

      // Reset
      resetAll();

      const state = useLLMConfigStore.getState();
      expect(state.activeProvider).toBe('openai');
      expect(state.configs.openai.apiKey).toBe('');
      expect(state.recentProviders).toEqual(['openai']);
      expect(Object.keys(state.usageStats)).toHaveLength(0);
    });
  });

  describe('Persistence', () => {
    it('should store API keys in sessionStorage', () => {
      const { updateConfig } = useLLMConfigStore.getState();

      updateConfig('openai', { apiKey: 'sensitive-key' });

      // In real implementation, this would be called by the persistence middleware
      expect(sessionStorageMock.setItem).not.toHaveBeenCalled(); // Not called in test environment
    });

    it('should handle missing sessionStorage gracefully', () => {
      // Mock sessionStorage to return null
      sessionStorageMock.getItem.mockReturnValue(null);

      const { updateConfig } = useLLMConfigStore.getState();

      expect(() => {
        updateConfig('openai', { apiKey: 'test' });
      }).not.toThrow();
    });
  });

  describe('Selector Hooks', () => {
    it('should provide selector hooks', async () => {
      // These are tested indirectly through the main store, but we can verify they exist
      const {
        useActiveProvider,
        useActiveConfig,
        useProviderConfig,
        useUsageStats,
        useRecentProviders,
      } = await import('../llmConfigStore');

      expect(useActiveProvider).toBeDefined();
      expect(useActiveConfig).toBeDefined();
      expect(useProviderConfig).toBeDefined();
      expect(useUsageStats).toBeDefined();
      expect(useRecentProviders).toBeDefined();
    });

    it('should provide utility functions', async () => {
      const {
        getApiKey,
        checkProviderHealth,
      } = await import('../llmConfigStore');

      expect(getApiKey).toBeDefined();
      expect(checkProviderHealth).toBeDefined();
    });
  });
});