/**
 * Universal LLM Service Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { UniversalLLMService } from '../universal-llm-service';
import type { LLMConfig, LLMMessage } from '../../types/universal-llm';

// Mock providers
const mockOpenAI = {
  name: 'openai',
  displayName: '🤖 OpenAI',
  icon: '🤖',
  supportedFeatures: {
    streaming: true,
    functionCalling: true,
    vision: true,
    json: true,
  },
  generateText: vi.fn(),
  streamText: vi.fn(),
  validateConfig: vi.fn(),
  getModels: vi.fn(),
};

const mockClaude = {
  name: 'claude',
  displayName: '🎭 Anthropic Claude',
  icon: '🎭',
  supportedFeatures: {
    streaming: true,
    functionCalling: true,
    vision: true,
    json: true,
  },
  generateText: vi.fn(),
  streamText: vi.fn(),
  validateConfig: vi.fn(),
  getModels: vi.fn(),
};

// Mock dynamic imports
vi.mock('../providers/openai-provider', () => ({
  OpenAIProvider: vi.fn(() => mockOpenAI),
}));

vi.mock('../providers/claude-provider', () => ({
  ClaudeProvider: vi.fn(() => mockClaude),
}));

vi.mock('../providers/vertex-provider', () => ({
  VertexProvider: vi.fn(() => ({})),
}));

vi.mock('../providers/grok-provider', () => ({
  GrokProvider: vi.fn(() => ({})),
}));

vi.mock('../providers/azure-openai-provider', () => ({
  AzureOpenAIProvider: vi.fn(() => ({})),
}));

vi.mock('../providers/cohere-provider', () => ({
  CohereProvider: vi.fn(() => ({})),
}));

vi.mock('../providers/local-provider', () => ({
  LocalProvider: vi.fn(() => ({})),
}));

describe('UniversalLLMService', () => {
  let service: UniversalLLMService;
  let testConfig: LLMConfig;
  let testMessages: LLMMessage[];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UniversalLLMService();

    testConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1000,
      apiKey: 'test-key',
    };

    testMessages = [
      { role: 'user', content: 'Hello, world!' },
    ];

    // Setup default mock responses
    mockOpenAI.generateText.mockResolvedValue({
      content: 'Hello! How can I help you today?',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30, cost: 0.01 },
      model: 'gpt-4o',
      finishReason: 'stop',
    });

    mockOpenAI.validateConfig.mockResolvedValue(true);
    mockOpenAI.getModels.mockResolvedValue(['gpt-4o', 'gpt-3.5-turbo']);

    mockClaude.generateText.mockResolvedValue({
      content: 'Hello! I\'m Claude, how can I assist you?',
      usage: { promptTokens: 12, completionTokens: 25, totalTokens: 37, cost: 0.02 },
      model: 'claude-3-5-sonnet-20241022',
      finishReason: 'stop',
    });

    mockClaude.validateConfig.mockResolvedValue(true);
    mockClaude.getModels.mockResolvedValue(['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307']);
  });

  describe('Initialization', () => {
    it('should initialize with available providers', async () => {
      const providers = service.getAvailableProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('claude');
    });

    it('should return provider instances', () => {
      const openaiProvider = service.getProvider('openai');
      expect(openaiProvider).toBeTruthy();
      expect(openaiProvider?.name).toBe('openai');
    });

    it('should return models for providers', () => {
      const openaiModels = service.getModelsForProvider('openai');
      expect(openaiModels).toContain('gpt-4o');
      expect(openaiModels).toContain('gpt-4o-mini');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid OpenAI config', async () => {
      const result = await service.validateConfig(testConfig);
      expect(result.valid).toBe(true);
      expect(mockOpenAI.validateConfig).toHaveBeenCalledWith(testConfig);
    });

    it('should reject invalid provider', async () => {
      const invalidConfig = { ...testConfig, provider: 'invalid' as any };
      const result = await service.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should handle provider validation errors', async () => {
      mockOpenAI.validateConfig.mockRejectedValue(new Error('Invalid API key'));
      const result = await service.validateConfig(testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });
  });

  describe('Text Generation', () => {
    it('should generate text with OpenAI', async () => {
      const response = await service.generateText(testMessages, testConfig);

      expect(response.content).toBe('Hello! How can I help you today?');
      expect(response.usage.totalTokens).toBe(30);
      expect(response.model).toBe('gpt-4o');
      expect(mockOpenAI.generateText).toHaveBeenCalledWith(testMessages, testConfig, {});
    });

    it('should generate text with Claude', async () => {
      const claudeConfig = { ...testConfig, provider: 'claude' as any };
      const response = await service.generateText(testMessages, claudeConfig);

      expect(response.content).toBe('Hello! I\'m Claude, how can I assist you?');
      expect(response.usage.totalTokens).toBe(37);
    });

    it('should handle generation errors', async () => {
      mockOpenAI.generateText.mockRejectedValue(new Error('API rate limit'));

      await expect(service.generateText(testMessages, testConfig))
        .rejects.toThrow('openai generation failed: API rate limit');
    });

    it('should reject unavailable providers', async () => {
      const invalidConfig = { ...testConfig, provider: 'invalid' as any };

      await expect(service.generateText(testMessages, invalidConfig))
        .rejects.toThrow('not available');
    });
  });

  describe('Streaming', () => {
    it('should stream text from providers', async () => {
      const chunks = [
        { delta: 'Hello' },
        { delta: ' there!' },
        { delta: '', finishReason: 'stop' },
      ];

      mockOpenAI.streamText.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      });

      const result: string[] = [];
      for await (const chunk of service.streamText(testMessages, testConfig)) {
        result.push(chunk.delta);
      }

      expect(result).toEqual(['Hello', ' there!', '']);
      expect(mockOpenAI.streamText).toHaveBeenCalledWith(testMessages, testConfig, {});
    });

    it('should handle streaming errors', async () => {
      mockOpenAI.streamText.mockImplementation(async function* () {
        throw new Error('Stream error');
      });

      const stream = service.streamText(testMessages, testConfig);
      await expect(stream.next()).rejects.toThrow('openai streaming failed: Stream error');
    });
  });

  describe('Multi-Provider Operations', () => {
    it('should generate with multiple providers', async () => {
      const configs = [
        testConfig,
        { ...testConfig, provider: 'claude' as any },
      ];

      const results = await service.generateWithMultipleProviders(testMessages, configs);

      expect(results).toHaveLength(2);
      expect(results[0].provider).toBe('openai');
      expect(results[0].response.content).toBe('Hello! How can I help you today?');
      expect(results[1].provider).toBe('claude');
      expect(results[1].response.content).toBe('Hello! I\'m Claude, how can I assist you?');
    });

    it('should handle mixed success/failure in multi-provider', async () => {
      mockOpenAI.generateText.mockRejectedValue(new Error('OpenAI error'));

      const configs = [
        testConfig,
        { ...testConfig, provider: 'claude' as any },
      ];

      const results = await service.generateWithMultipleProviders(testMessages, configs);

      expect(results).toHaveLength(2);
      expect(results[0].error).toBeTruthy();
      expect(results[1].error).toBeFalsy();
    });
  });

  describe('Fallback System', () => {
    it('should use fallback on primary failure', async () => {
      mockOpenAI.generateText.mockRejectedValue(new Error('Primary failed'));

      const primary = testConfig;
      const fallbacks = [{ ...testConfig, provider: 'claude' as any }];

      const result = await service.generateWithFallback(testMessages, primary, fallbacks);

      expect(result.usedProvider).toBe('claude');
      expect(result.attempts).toBe(2);
      expect(result.response.content).toBe('Hello! I\'m Claude, how can I assist you?');
    });

    it('should fail when all providers fail', async () => {
      mockOpenAI.generateText.mockRejectedValue(new Error('OpenAI failed'));
      mockClaude.generateText.mockRejectedValue(new Error('Claude failed'));

      const primary = testConfig;
      const fallbacks = [{ ...testConfig, provider: 'claude' as any }];

      await expect(service.generateWithFallback(testMessages, primary, fallbacks))
        .rejects.toThrow('모든 Provider 실패');
    });
  });

  describe('Provider Recommendations', () => {
    it('should recommend fast provider for short prompts', () => {
      const recommendation = service.getRecommendedProvider(100, 'fast');
      expect(recommendation.provider).toBe('claude');
      expect(recommendation.model).toBe('claude-3-haiku-20240307');
      expect(recommendation.reason).toContain('빠른 응답');
    });

    it('should recommend balanced provider for medium prompts', () => {
      const recommendation = service.getRecommendedProvider(5000, 'balanced');
      expect(recommendation.provider).toBe('openai');
      expect(recommendation.model).toBe('gpt-4o-mini');
      expect(recommendation.reason).toContain('균형잡힌');
    });

    it('should recommend best provider for quality', () => {
      const recommendation = service.getRecommendedProvider(10000, 'best');
      expect(recommendation.provider).toBe('openai');
      expect(recommendation.model).toBe('gpt-4o');
      expect(recommendation.reason).toContain('최고 품질');
    });

    it('should recommend local for privacy', () => {
      const recommendation = service.getRecommendedProvider(50000, 'best');
      expect(recommendation.provider).toBe('claude');
      expect(recommendation.model).toBe('claude-3-5-sonnet-20241022');
      expect(recommendation.reason).toContain('긴 컨텍스트');
    });
  });

  describe('Health Checks', () => {
    it('should check provider health', async () => {
      mockOpenAI.validateConfig.mockResolvedValue(true);
      mockClaude.validateConfig.mockRejectedValue(new Error('Claude down'));

      const health = await service.checkProviderHealth();

      expect(health.openai?.status).toBe('ok');
      expect(health.claude?.status).toBe('error');
      expect(health.claude?.error).toContain('Claude down');
    });
  });

  describe('Statistics', () => {
    it('should return usage statistics', () => {
      const stats = service.getUsageStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('successfulRequests');
      expect(stats).toHaveProperty('totalCost');
      expect(stats).toHaveProperty('providerBreakdown');
    });
  });
});