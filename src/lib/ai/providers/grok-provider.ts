/**
 * Grok Provider - X.AI Grok 모델 지원
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

export class GrokProvider extends BaseProvider {
  name: LLMProvider = 'grok';
  displayName = '❌ Grok (X.AI)';
  icon = '❌';
  supportedFeatures = {
    streaming: true,
    functionCalling: false,
    vision: true, // grok-vision-beta만 지원
    json: true,
  };

  private readonly defaultEndpoint = 'https://api.x.ai/v1/chat/completions';

  async generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error('Grok API 키가 설정되지 않았습니다');
    }

    const requestBody = {
      model: config.model,
      messages: this.convertToOpenAIMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP || 1.0,
      frequency_penalty: config.frequencyPenalty || 0,
      presence_penalty: config.presencePenalty || 0,
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
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('Grok 응답에 choices가 없습니다');
      }

      const choice = data.choices[0];
      const usage = data.usage || {};
      const modelInfo = PROVIDER_MODELS.grok.find(m => m.id === config.model);

      return {
        content: choice.message?.content || '',
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
          cost: this.calculateCost(
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            modelInfo?.inputCostPer1K,
            modelInfo?.outputCostPer1K
          ),
        },
        model: data.model,
        finishReason: choice.finish_reason,
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
      throw new Error('Grok API 키가 설정되지 않았습니다');
    }

    const requestBody = {
      model: config.model,
      messages: this.convertToOpenAIMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP || 1.0,
      frequency_penalty: config.frequencyPenalty || 0,
      presence_penalty: config.presencePenalty || 0,
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
            if (trimmed === '' || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));

              if (data.choices && data.choices[0]) {
                const choice = data.choices[0];
                const delta = choice.delta;

                if (delta?.content) {
                  const chunk: LLMStreamChunk = {
                    delta: delta.content,
                  };

                  if (choice.finish_reason) {
                    chunk.finishReason = choice.finish_reason;
                  }

                  if (data.usage) {
                    chunk.usage = {
                      promptTokens: data.usage.prompt_tokens,
                      completionTokens: data.usage.completion_tokens,
                      totalTokens: data.usage.total_tokens,
                    };
                  }

                  options.onChunk?.(chunk);
                  yield chunk;
                }
              }
            } catch (parseError) {
              console.warn('Grok 스트림 파싱 오류:', parseError);
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
    const supportedModels = PROVIDER_MODELS.grok.map(m => m.id);
    if (!supportedModels.includes(config.model)) {
      return false;
    }

    // 실제 API 키 검증
    try {
      return await this.testConnection(config);
    } catch {
      // Grok API는 아직 베타이므로 실패해도 설정이 올바르면 허용
      return true;
    }
  }

  async getModels(): Promise<string[]> {
    return PROVIDER_MODELS.grok.map(m => m.id);
  }

  /**
   * Grok 특별 처리 (위트 있는 응답 스타일 활성화)
   */
  private enhanceMessagesForGrok(messages: LLMMessage[]): LLMMessage[] {
    const enhanced = [...messages];

    // 시스템 메시지가 있으면 Grok 특성 강화
    const systemIndex = enhanced.findIndex(m => m.role === 'system');
    if (systemIndex >= 0) {
      enhanced[systemIndex] = {
        ...enhanced[systemIndex],
        content: enhanced[systemIndex].content + '\n\n(참고: 유머와 직관적 통찰력을 활용하여 창의적이고 실용적인 답변을 제공해주세요.)',
      };
    } else {
      // 시스템 메시지가 없으면 추가
      enhanced.unshift({
        role: 'system',
        content: 'You are Grok, a witty and helpful AI assistant. Provide creative, practical answers with humor and unique insights.',
      });
    }

    return enhanced;
  }

  protected convertToOpenAIMessages(messages: LLMMessage[]): any[] {
    const enhanced = this.enhanceMessagesForGrok(messages);
    return super.convertToOpenAIMessages(enhanced);
  }
}