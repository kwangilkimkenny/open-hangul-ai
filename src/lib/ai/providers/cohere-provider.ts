/**
 * Cohere Provider - Cohere Command 모델 지원
 */

import { BaseProvider } from './base-provider';
import type {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMGenerateOptions,
  LLMProvider,
} from '../../../types/universal-llm';
import { PROVIDER_MODELS } from '../../../types/universal-llm';

export class CohereProvider extends BaseProvider {
  name: LLMProvider = 'cohere';
  displayName = '🌐 Cohere';
  icon = '🌐';
  supportedFeatures = {
    streaming: true,
    functionCalling: true,
    vision: false,
    json: true,
  };

  private readonly defaultEndpoint = 'https://api.cohere.com/v2/chat';

  async generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error('Cohere API 키가 설정되지 않았습니다');
    }

    const { system, messages: cohereMessages } = this.convertToCohereMessages(messages);

    const requestBody = {
      model: config.model,
      messages: cohereMessages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      p: config.topP || 1.0,
      ...(system && { system }),
      stream: false,
    };

    try {
      const response = await this.fetchWithTimeout(
        config.endpoint || this.defaultEndpoint,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
        options.timeout || 30000
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.message?.content?.length) {
        throw new Error('Cohere 응답에 content가 없습니다');
      }

      const content = data.message.content[0]?.text || '';
      const usage = data.usage || {};
      const modelInfo = PROVIDER_MODELS.cohere.find(m => m.id === config.model);

      return {
        content,
        usage: {
          promptTokens: usage.input_tokens || 0,
          completionTokens: usage.output_tokens || 0,
          totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
          cost: this.calculateCost(
            usage.input_tokens || 0,
            usage.output_tokens || 0,
            modelInfo?.inputCostPer1K,
            modelInfo?.outputCostPer1K
          ),
        },
        model: config.model,
        finishReason: data.finish_reason,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *streamText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): AsyncGenerator<LLMStreamChunk> {
    if (!config.apiKey) {
      throw new Error('Cohere API 키가 설정되지 않았습니다');
    }

    const { system, messages: cohereMessages } = this.convertToCohereMessages(messages);

    const requestBody = {
      model: config.model,
      messages: cohereMessages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      p: config.topP || 1.0,
      ...(system && { system }),
      stream: true,
    };

    try {
      const response = await this.fetchWithTimeout(
        config.endpoint || this.defaultEndpoint,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
        options.timeout || 30000
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('스트림을 읽을 수 없습니다');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);

              if (data.type === 'content-delta' && data.delta?.message?.content?.text) {
                const chunk: LLMStreamChunk = {
                  delta: data.delta.message.content.text,
                };

                options.onChunk?.(chunk);
                yield chunk;
              } else if (data.type === 'message-end') {
                const chunk: LLMStreamChunk = {
                  delta: '',
                  finishReason: data.delta?.finish_reason || 'stop',
                };

                if (data.delta?.usage) {
                  chunk.usage = {
                    promptTokens: data.delta.usage.input_tokens,
                    completionTokens: data.delta.usage.output_tokens,
                    totalTokens: data.delta.usage.input_tokens + data.delta.usage.output_tokens,
                  };
                }

                options.onChunk?.(chunk);
                yield chunk;
                break;
              }
            } catch (parseError) {
              console.warn('Cohere 스트림 파싱 오류:', parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async validateConfig(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) return false;
    if (!config.model) return false;

    const supportedModels = PROVIDER_MODELS.cohere.map(m => m.id);
    if (!supportedModels.includes(config.model)) {
      return false;
    }

    return await this.testConnection(config);
  }

  async getModels(): Promise<string[]> {
    return PROVIDER_MODELS.cohere.map(m => m.id);
  }

  private convertToCohereMessages(messages: LLMMessage[]): {
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    let system: string | undefined;
    const cohereMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const message of messages) {
      if (message.role === 'system') {
        system = message.content;
      } else if (message.role === 'user' || message.role === 'assistant') {
        cohereMessages.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    return { system, messages: cohereMessages };
  }
}