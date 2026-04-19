/**
 * Azure OpenAI Provider - Azure에서 호스팅되는 OpenAI 모델 지원
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

export class AzureOpenAIProvider extends BaseProvider {
  name: LLMProvider = 'azure-openai';
  displayName = '☁️ Azure OpenAI';
  icon = '☁️';
  supportedFeatures = {
    streaming: true,
    functionCalling: true,
    vision: true,
    json: true,
  };

  async generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    const { endpoint, apiKey } = this.parseAzureConfig(config);

    const requestBody = {
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
        endpoint,
        {
          method: 'POST',
          headers: {
            'api-key': apiKey,
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
        throw new Error('Azure OpenAI 응답에 choices가 없습니다');
      }

      const choice = data.choices[0];
      const usage = data.usage || {};
      const modelInfo = PROVIDER_MODELS['azure-openai'].find(m => m.id === config.model);

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
    const { endpoint, apiKey } = this.parseAzureConfig(config);

    const requestBody = {
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
        endpoint,
        {
          method: 'POST',
          headers: {
            'api-key': apiKey,
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
              console.warn('Azure OpenAI 스트림 파싱 오류:', parseError);
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
    try {
      const { endpoint, apiKey } = this.parseAzureConfig(config);
      if (!endpoint || !apiKey) return false;

      // 모델이 지원되는지 확인
      const supportedModels = PROVIDER_MODELS['azure-openai'].map(m => m.id);
      if (!supportedModels.includes(config.model)) {
        return false;
      }

      return await this.testConnection(config);
    } catch {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    return PROVIDER_MODELS['azure-openai'].map(m => m.id);
  }

  /**
   * Azure OpenAI 설정 파싱
   * endpoint 형식: https://<resource-name>.openai.azure.com/openai/deployments/<deployment-name>/chat/completions?api-version=2024-02-15-preview
   */
  private parseAzureConfig(config: LLMConfig): { endpoint: string; apiKey: string } {
    if (!config.endpoint) {
      throw new Error('Azure OpenAI endpoint가 설정되지 않았습니다');
    }
    if (!config.apiKey) {
      throw new Error('Azure OpenAI API 키가 설정되지 않았습니다');
    }

    let endpoint = config.endpoint;

    // API 버전이 없으면 추가
    if (!endpoint.includes('api-version')) {
      const separator = endpoint.includes('?') ? '&' : '?';
      endpoint += `${separator}api-version=2024-02-15-preview`;
    }

    return {
      endpoint,
      apiKey: config.apiKey,
    };
  }

  /**
   * Azure 리소스 정보 반환
   */
  getAzureResourceInfo(config: LLMConfig): {
    resourceName?: string;
    deploymentName?: string;
    region?: string;
  } {
    if (!config.endpoint) return {};

    try {
      const url = new URL(config.endpoint);
      const resourceName = url.hostname.split('.')[0];
      const pathParts = url.pathname.split('/');
      const deploymentIndex = pathParts.indexOf('deployments');
      const deploymentName = deploymentIndex >= 0 ? pathParts[deploymentIndex + 1] : undefined;

      return {
        resourceName,
        deploymentName,
        region: url.hostname.includes('.openai.azure.com') ? 'Azure' : undefined,
      };
    } catch {
      return {};
    }
  }
}