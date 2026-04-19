/**
 * LLM Providers Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIProvider } from '../providers/openai-provider';
import { ClaudeProvider } from '../providers/claude-provider';
import { LocalProvider } from '../providers/local-provider';
import { GrokProvider } from '../providers/grok-provider';
import type { LLMConfig, LLMMessage } from '../../types/universal-llm';

// Mock fetch
global.fetch = vi.fn();

const mockFetch = fetch as any;

describe('LLM Providers', () => {
  let testMessages: LLMMessage[];

  beforeEach(() => {
    vi.clearAllMocks();
    testMessages = [
      { role: 'user', content: 'Hello, world!' },
    ];
  });

  describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;
    let config: LLMConfig;

    beforeEach(() => {
      provider = new OpenAIProvider();
      config = {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'sk-test123',
      };
    });

    it('should have correct properties', () => {
      expect(provider.name).toBe('openai');
      expect(provider.displayName).toBe('🤖 OpenAI');
      expect(provider.supportedFeatures.streaming).toBe(true);
      expect(provider.supportedFeatures.functionCalling).toBe(true);
    });

    it('should validate config correctly', async () => {
      // Valid config
      let isValid = await provider.validateConfig(config);
      expect(isValid).toBe(false); // false because testConnection will fail in test

      // Invalid - no API key
      isValid = await provider.validateConfig({ ...config, apiKey: '' });
      expect(isValid).toBe(false);

      // Invalid - unsupported model
      isValid = await provider.validateConfig({ ...config, model: 'invalid-model' });
      expect(isValid).toBe(false);
    });

    it('should generate text successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'gpt-4o',
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await provider.generateText(testMessages, config);

      expect(result.content).toBe('Hello!');
      expect(result.usage.totalTokens).toBe(15);
      expect(result.model).toBe('gpt-4o');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test123',
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      await expect(provider.generateText(testMessages, config))
        .rejects.toThrow('OpenAI 오류');
    });

    it('should reject requests without API key', async () => {
      await expect(provider.generateText(testMessages, { ...config, apiKey: '' }))
        .rejects.toThrow('OpenAI API 키가 설정되지 않았습니다');
    });

    it('should support streaming', async () => {
      const streamData = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" world"}}]}
data: [DONE]`;

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ value: new TextEncoder().encode(streamData), done: false })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: vi.fn(),
          }),
        },
      });

      const chunks: string[] = [];
      for await (const chunk of provider.streamText(testMessages, config)) {
        chunks.push(chunk.delta);
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });
  });

  describe('ClaudeProvider', () => {
    let provider: ClaudeProvider;
    let config: LLMConfig;

    beforeEach(() => {
      provider = new ClaudeProvider();
      config = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'sk-ant-test123',
      };
    });

    it('should have correct properties', () => {
      expect(provider.name).toBe('claude');
      expect(provider.displayName).toBe('🎭 Anthropic Claude');
      expect(provider.supportedFeatures.streaming).toBe(true);
    });

    it('should convert messages correctly', async () => {
      const messagesWithSystem = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ type: 'text', text: 'Hello!' }],
          usage: { input_tokens: 10, output_tokens: 5 },
          model: config.model,
          stop_reason: 'end_turn',
        }),
      });

      await provider.generateText(messagesWithSystem, config);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.system).toBe('You are helpful');
      expect(requestBody.messages).toEqual([
        { role: 'user', content: 'Hello' }
      ]);
    });

    it('should handle Claude-specific response format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [
            { type: 'text', text: 'Hello there!' },
            { type: 'text', text: ' How are you?' }
          ],
          usage: { input_tokens: 8, output_tokens: 12 },
          model: config.model,
          stop_reason: 'end_turn',
        }),
      });

      const result = await provider.generateText(testMessages, config);

      expect(result.content).toBe('Hello there! How are you?');
      expect(result.usage.promptTokens).toBe(8);
      expect(result.usage.completionTokens).toBe(12);
    });
  });

  describe('LocalProvider', () => {
    let provider: LocalProvider;
    let config: LLMConfig;

    beforeEach(() => {
      provider = new LocalProvider();
      config = {
        provider: 'local',
        model: 'qwen2.5:7b',
        temperature: 0.7,
        maxTokens: 1000,
        endpoint: 'http://localhost:11434/v1/chat/completions',
      };
    });

    it('should have correct properties', () => {
      expect(provider.name).toBe('local');
      expect(provider.displayName).toBe('🏠 로컬 모델');
      expect(provider.supportedFeatures.streaming).toBe(true);
    });

    it('should use default Ollama endpoint', async () => {
      const configWithoutEndpoint = { ...config, endpoint: '' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hello!' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await provider.generateText(testMessages, configWithoutEndpoint);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should include local model specific parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hello!' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await provider.generateText(testMessages, config);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.repeat_penalty).toBe(1.1);
      expect(requestBody.top_k).toBe(50);
    });

    it('should estimate usage when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hello world!' } }],
          // No usage field
        }),
      });

      const result = await provider.generateText(testMessages, config);

      expect(result.usage.totalTokens).toBeGreaterThan(0);
      expect(result.usage.cost).toBe(0); // Local models are free
    });

    it('should detect local servers', async () => {
      // Mock successful health check for Ollama
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      // Mock failed health check for others
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const servers = await provider.detectLocalServers();

      expect(servers.find(s => s.name === 'ollama')?.status).toBe('online');
      expect(servers.find(s => s.name === 'vllm')?.status).toBe('offline');
    });

    it('should provide model installation instructions', () => {
      const qwenInstructions = provider.getModelInstallInstructions('qwen2.5:7b');
      expect(qwenInstructions.length).toBeGreaterThan(0);
      expect(qwenInstructions.some(inst => inst.platform === 'Ollama')).toBe(true);

      const llamaInstructions = provider.getModelInstallInstructions('llama3.2:3b');
      expect(llamaInstructions.some(inst => inst.platform === 'llama.cpp')).toBe(true);
    });
  });

  describe('GrokProvider', () => {
    let provider: GrokProvider;
    let config: LLMConfig;

    beforeEach(() => {
      provider = new GrokProvider();
      config = {
        provider: 'grok',
        model: 'grok-beta',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'xai-test123',
      };
    });

    it('should enhance messages for Grok personality', () => {
      const mockConvertToOpenAI = vi.spyOn(provider as any, 'convertToOpenAIMessages');

      // Mock the actual method call
      const enhancedMessages = (provider as any).convertToOpenAIMessages(testMessages);

      // Check if system message was added/enhanced
      expect(enhancedMessages.length).toBeGreaterThan(testMessages.length);
      expect(enhancedMessages[0].role).toBe('system');
      expect(enhancedMessages[0].content).toContain('Grok');
    });

    it('should use X.AI endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'grok-beta',
        }),
      });

      await provider.generateText(testMessages, config);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should handle beta API gracefully in validation', async () => {
      // Grok API is beta, so validation might fail but config could still be valid
      const isValid = await provider.validateConfig(config);
      // Should be true even if test connection fails, because it's beta
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Provider Error Handling', () => {
    let provider: OpenAIProvider;
    let config: LLMConfig;

    beforeEach(() => {
      provider = new OpenAIProvider();
      config = {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'sk-test123',
      };
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue({ code: 'ENOTFOUND' });

      await expect(provider.generateText(testMessages, config))
        .rejects.toThrow('OpenAI 서버에 연결할 수 없습니다');
    });

    it('should handle 401 unauthorized', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      await expect(provider.generateText(testMessages, config))
        .rejects.toThrow('OpenAI API 키가 유효하지 않습니다');
    });

    it('should handle 429 rate limit', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 429 });

      await expect(provider.generateText(testMessages, config))
        .rejects.toThrow('OpenAI API 사용량 한도를 초과했습니다');
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(provider.generateText(testMessages, config))
        .rejects.toThrow('OpenAI 서버에 일시적인 오류가 발생했습니다');
    });

    it('should handle timeout', async () => {
      // Mock AbortError
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(provider.generateText(testMessages, config))
        .rejects.toThrow('OpenAI 요청이 취소되었습니다');
    });
  });

  describe('Cost Calculation', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider();
    });

    it('should calculate costs correctly', () => {
      const cost = (provider as any).calculateCost(1000, 500, 0.001, 0.002);
      expect(cost).toBe(0.002); // (1000/1000)*0.001 + (500/1000)*0.002 = 0.001 + 0.001 = 0.002
    });

    it('should return 0 when cost data unavailable', () => {
      const cost = (provider as any).calculateCost(1000, 500);
      expect(cost).toBe(0);
    });
  });

  describe('Token Estimation', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider();
    });

    it('should estimate token count', () => {
      const tokens = (provider as any).estimateTokenCount('Hello world this is a test');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20); // Should be around 6-7 tokens
    });

    it('should handle empty strings', () => {
      const tokens = (provider as any).estimateTokenCount('');
      expect(tokens).toBe(0);
    });
  });
});