/**
 * LLM Configuration Store - 멀티 LLM 설정 상태 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LLMConfig, LLMProvider } from '../types/universal-llm';

interface LLMConfigState {
  // 현재 활성 Provider
  activeProvider: LLMProvider;

  // Provider별 설정 저장
  configs: Record<LLMProvider, LLMConfig>;

  // 최근 사용 기록
  recentProviders: LLMProvider[];

  // 사용 통계
  usageStats: Record<LLMProvider, {
    totalRequests: number;
    successfulRequests: number;
    totalTokens: number;
    totalCost: number;
    lastUsed: Date;
  }>;

  // Actions
  setActiveProvider: (provider: LLMProvider) => void;
  updateConfig: (provider: LLMProvider, config: Partial<LLMConfig>) => void;
  getActiveConfig: () => LLMConfig;
  addUsage: (provider: LLMProvider, tokens: number, cost: number, success: boolean) => void;
  clearConfig: (provider: LLMProvider) => void;
  exportConfigs: () => string;
  importConfigs: (configsJson: string) => void;
  resetAll: () => void;
}

const DEFAULT_CONFIGS: Record<LLMProvider, LLMConfig> = {
  openai: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    apiKey: '',
  },
  claude: {
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    apiKey: '',
  },
  vertex: {
    provider: 'vertex',
    model: 'gemini-2.5-pro',
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
  },
  grok: {
    provider: 'grok',
    model: 'grok-beta',
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    apiKey: '',
  },
  'azure-openai': {
    provider: 'azure-openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    apiKey: '',
    endpoint: '',
  },
  cohere: {
    provider: 'cohere',
    model: 'command-r-plus',
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    apiKey: '',
  },
  local: {
    provider: 'local',
    model: 'qwen2.5:7b',
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    endpoint: import.meta.env.VITE_LOCAL_LLM_ENDPOINT || 'http://localhost:11434/v1/chat/completions',
  },
};

export const useLLMConfigStore = create<LLMConfigState>()(
  persist(
    (set, get) => ({
      activeProvider: 'openai',
      configs: DEFAULT_CONFIGS,
      recentProviders: ['openai'],
      usageStats: {
    openai: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
    claude: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
    vertex: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
    grok: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
    'azure-openai': { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
    cohere: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
    local: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() }
  },

      setActiveProvider: (provider: LLMProvider) => {
        set(state => {
          const recentProviders = [
            provider,
            ...state.recentProviders.filter(p => p !== provider)
          ].slice(0, 5);

          return {
            activeProvider: provider,
            recentProviders,
          };
        });
      },

      updateConfig: (provider: LLMProvider, configUpdate: Partial<LLMConfig>) => {
        set(state => ({
          configs: {
            ...state.configs,
            [provider]: {
              ...state.configs[provider],
              ...configUpdate,
            },
          },
        }));
      },

      getActiveConfig: () => {
        const state = get();
        return state.configs[state.activeProvider];
      },

      addUsage: (provider: LLMProvider, tokens: number, cost: number, success: boolean) => {
        set(state => {
          const currentStats = state.usageStats[provider] || {
            totalRequests: 0,
            successfulRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            lastUsed: new Date(),
          };

          return {
            usageStats: {
              ...state.usageStats,
              [provider]: {
                totalRequests: currentStats.totalRequests + 1,
                successfulRequests: currentStats.successfulRequests + (success ? 1 : 0),
                totalTokens: currentStats.totalTokens + tokens,
                totalCost: currentStats.totalCost + cost,
                lastUsed: new Date(),
              },
            },
          };
        });
      },

      clearConfig: (provider: LLMProvider) => {
        set(state => ({
          configs: {
            ...state.configs,
            [provider]: DEFAULT_CONFIGS[provider],
          },
        }));
      },

      exportConfigs: () => {
        const state = get();
        const exportData = {
          configs: state.configs,
          activeProvider: state.activeProvider,
          exportedAt: new Date().toISOString(),
        };
        return JSON.stringify(exportData, null, 2);
      },

      importConfigs: (configsJson: string) => {
        try {
          const importData = JSON.parse(configsJson);

          // 기본 검증
          if (importData.configs && typeof importData.configs === 'object') {
            set(state => ({
              configs: {
                ...state.configs,
                ...importData.configs,
              },
              activeProvider: importData.activeProvider || state.activeProvider,
            }));
          }
        } catch (error) {
          console.error('LLM 설정 가져오기 실패:', error);
          throw new Error('유효하지 않은 설정 파일입니다.');
        }
      },

      resetAll: () => {
        set({
          activeProvider: 'openai',
          configs: DEFAULT_CONFIGS,
          recentProviders: ['openai'],
          usageStats: {
            openai: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
            claude: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
            vertex: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
            grok: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
            'azure-openai': { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
            cohere: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() },
            local: { totalRequests: 0, successfulRequests: 0, totalTokens: 0, totalCost: 0, lastUsed: new Date() }
          },
        });
      },
    }),
    {
      name: 'llm-config-storage',
      version: 1,
      // API 키 같은 민감 정보는 sessionStorage에 저장
      storage: {
        getItem: (key) => {
          const value = localStorage.getItem(key);
          if (!value) return null;

          try {
            const parsed = JSON.parse(value);

            // API 키는 sessionStorage에서 복원
            if (parsed.state?.configs) {
              Object.keys(parsed.state.configs).forEach(provider => {
                const apiKey = sessionStorage.getItem(`llm-api-key-${provider}`);
                if (apiKey) {
                  parsed.state.configs[provider].apiKey = apiKey;
                }
              });
            }

            return parsed;
          } catch {
            return value;
          }
        },
        setItem: (key, value) => {
          try {
            // value는 이미 객체 형태로 전달됨
            const data = typeof value === 'string' ? JSON.parse(value) : value;

            // API 키는 sessionStorage에 별도 저장
            if (data.state?.configs) {
              Object.entries(data.state.configs).forEach(([provider, config]: [string, any]) => {
                if (config.apiKey) {
                  sessionStorage.setItem(`llm-api-key-${provider}`, config.apiKey);
                  // localStorage에는 API 키 제외하고 저장
                  config.apiKey = '';
                }
              });
            }

            localStorage.setItem(key, JSON.stringify(data));
          } catch {
            localStorage.setItem(key, String(value));
          }
        },
        removeItem: (key) => {
          localStorage.removeItem(key);
          // 관련 API 키들도 제거
          ['openai', 'claude', 'grok', 'azure-openai', 'cohere'].forEach(provider => {
            sessionStorage.removeItem(`llm-api-key-${provider}`);
          });
        },
      },
    }
  )
);

// Selector hooks for better performance
export const useActiveProvider = () => useLLMConfigStore(state => state.activeProvider);
export const useActiveConfig = () => useLLMConfigStore(state => state.getActiveConfig());
export const useProviderConfig = (provider: LLMProvider) =>
  useLLMConfigStore(state => state.configs[provider]);
export const useUsageStats = () => useLLMConfigStore(state => state.usageStats);
export const useRecentProviders = () => useLLMConfigStore(state => state.recentProviders);

// Actions
export const {
  setActiveProvider,
  updateConfig,
  addUsage,
  clearConfig,
  exportConfigs,
  importConfigs,
  resetAll
} = useLLMConfigStore.getState();

// Utility function to get API key safely
export const getApiKey = (provider: LLMProvider): string => {
  const config = useLLMConfigStore.getState().configs[provider];
  return config.apiKey || sessionStorage.getItem(`llm-api-key-${provider}`) || '';
};

// Provider health check
export const checkProviderHealth = async () => {
  const { universalLLM } = await import('../lib/ai/universal-llm-service');
  return await universalLLM.checkProviderHealth();
};