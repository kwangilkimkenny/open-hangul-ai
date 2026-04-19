/**
 * Claude Provider - Anthropic Claude 모델 지원
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

export class ClaudeProvider extends BaseProvider {
  name: LLMProvider = 'claude';
  displayName = '🎭 Anthropic Claude';
  icon = '🎭';
  supportedFeatures = {
    streaming: true,
    functionCalling: true,
    vision: true,
    json: true,
  };

  private readonly defaultEndpoint = 'https://api.anthropic.com/v1/messages';

  async generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error('Claude API 키가 설정되지 않았습니다');
    }

    const { system, messages: claudeMessages } = this.convertToClaudeMessages(messages);

    const requestBody = {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP || 1.0,
      messages: claudeMessages,
      ...(system && { system }),
      stream: false,
    };

    try {
      const response = await this.fetchWithTimeout(
        config.endpoint || this.defaultEndpoint,
        {
          method: 'POST',
          headers: {
            'x-api-key': config.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(requestBody),
        },
        options.timeout || 60000 // Claude는 응답이 느릴 수 있어 더 긴 타임아웃
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.content || data.content.length === 0) {
        throw new Error('Claude 응답에 content가 없습니다');
      }

      const textContent = data.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('');

      const usage = data.usage || {};
      const modelInfo = PROVIDER_MODELS.claude.find(m => m.id === config.model);

      return {
        content: textContent,
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
        model: data.model,
        finishReason: data.stop_reason,
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
      throw new Error('Claude API 키가 설정되지 않았습니다');
    }

    const { system, messages: claudeMessages } = this.convertToClaudeMessages(messages);

    const requestBody = {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP || 1.0,
      messages: claudeMessages,
      ...(system && { system }),
      stream: true,
    };

    try {
      const response = await this.fetchWithTimeout(
        config.endpoint || this.defaultEndpoint,
        {
          method: 'POST',
          headers: {
            'x-api-key': config.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(requestBody),
        },
        options.timeout || 60000
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
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
            if (trimmed === '' || !trimmed.startsWith('data: ')) continue;

            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);

              if (data.type === 'content_block_delta' && data.delta?.text) {
                const chunk: LLMStreamChunk = {
                  delta: data.delta.text,
                };

                options.onChunk?.(chunk);
                yield chunk;
              } else if (data.type === 'message_stop') {
                const chunk: LLMStreamChunk = {
                  delta: '',
                  finishReason: 'stop',
                };

                if (data.usage) {
                  chunk.usage = {
                    promptTokens: data.usage.input_tokens,
                    completionTokens: data.usage.output_tokens,
                    totalTokens: data.usage.input_tokens + data.usage.output_tokens,
                  };
                }

                options.onChunk?.(chunk);
                yield chunk;
                break;
              } else if (data.type === 'error') {
                throw new Error(data.error?.message || 'Claude 스트림 오류');
              }
            } catch (parseError) {
              console.warn('Claude 스트림 파싱 오류:', parseError);
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

    // 모델이 지원되는지 확인
    const supportedModels = PROVIDER_MODELS.claude.map(m => m.id);
    if (!supportedModels.includes(config.model)) {
      return false;
    }

    // 실제 API 키 검증
    return await this.testConnection(config);
  }

  async getModels(): Promise<string[]> {
    return PROVIDER_MODELS.claude.map(m => m.id);
  }

  /**
   * LLM 메시지를 Claude 형식으로 변환
   */
  private convertToClaudeMessages(messages: LLMMessage[]): {
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    let system: string | undefined;
    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Claude는 system 메시지를 별도로 처리
        system = message.content;
      } else if (message.role === 'user' || message.role === 'assistant') {
        claudeMessages.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    // Claude는 user 메시지로 시작해야 함
    if (claudeMessages.length === 0 || claudeMessages[0].role !== 'user') {
      claudeMessages.unshift({
        role: 'user',
        content: 'Please respond to the following:',
      });
    }

    return { system, messages: claudeMessages };
  }
}