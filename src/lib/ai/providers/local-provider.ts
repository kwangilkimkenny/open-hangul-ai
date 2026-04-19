/**
 * Local Model Provider - Ollama, vLLM, TGI 등 로컬 양자화 모델 지원
 *
 * 지원 모델:
 * - Qwen 2.5 7B/14B/32B (GPTQ, AWQ, GGUF)
 * - Llama 3.2 1B/3B/8B/70B
 * - Mistral 7B/8x7B
 * - Phi-3 Mini/Medium/Large
 * - Gemma 2 2B/9B/27B
 * - DeepSeek Coder/Math
 * - CodeLlama 7B/13B/34B
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

export class LocalProvider extends BaseProvider {
  name: LLMProvider = 'local';
  displayName = '🏠 로컬 모델';
  icon = '🏠';
  supportedFeatures = {
    streaming: true,
    functionCalling: false, // 모델에 따라 다름
    vision: false, // 멀티모달 모델만 지원
    json: true, // 대부분 지원
  };

  // 인기 로컬 모델 서버 기본 엔드포인트들
  private readonly defaultEndpoints = {
    ollama: 'http://localhost:11434/v1/chat/completions',
    vllm: 'http://localhost:8000/v1/chat/completions',
    tgi: 'http://localhost:8080/v1/chat/completions',
    'text-generation-webui': 'http://localhost:5000/v1/chat/completions',
    'lm-studio': 'http://localhost:1234/v1/chat/completions',
    llamacpp: 'http://localhost:8080/v1/chat/completions',
  };

  async generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    const endpoint = this.getEndpoint(config);

    const requestBody = {
      model: config.model,
      messages: this.convertToOpenAIMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP || 1.0,
      frequency_penalty: config.frequencyPenalty || 0,
      presence_penalty: config.presencePenalty || 0,
      stream: false,
      // 로컬 모델 특화 파라미터
      repeat_penalty: 1.1,
      top_k: 50,
      ...(config.systemPrompt && { system: config.systemPrompt }),
    };

    try {
      const response = await this.fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 일부 로컬 서버는 Bearer 토큰이 필요할 수 있음
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
          },
          body: JSON.stringify(requestBody),
        },
        options.timeout || 60000 // 로컬 모델은 느릴 수 있음
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('로컬 모델 응답에 choices가 없습니다');
      }

      const choice = data.choices[0];
      const usage = data.usage || this.estimateUsage(messages, choice.message?.content || '');

      return {
        content: choice.message?.content || '',
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
          cost: 0, // 로컬 모델은 무료
        },
        model: config.model,
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
    const endpoint = this.getEndpoint(config);

    const requestBody = {
      model: config.model,
      messages: this.convertToOpenAIMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP || 1.0,
      frequency_penalty: config.frequencyPenalty || 0,
      presence_penalty: config.presencePenalty || 0,
      stream: true,
      repeat_penalty: 1.1,
      top_k: 50,
      ...(config.systemPrompt && { system: config.systemPrompt }),
    };

    try {
      const response = await this.fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
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
              console.warn('로컬 모델 스트림 파싱 오류:', parseError);
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
    if (!config.model) return false;

    const endpoint = this.getEndpoint(config);

    try {
      // 서버 연결 확인
      const response = await fetch(endpoint.replace('/chat/completions', '/models'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        },
      });

      if (!response.ok) {
        // 모델 엔드포인트를 지원하지 않는 서버일 수 있으므로 테스트 요청 시도
        return await this.testConnection(config);
      }

      const data = await response.json();

      // 요청한 모델이 사용 가능한지 확인
      if (data.data && Array.isArray(data.data)) {
        const availableModels = data.data.map((model: any) => model.id);
        return availableModels.includes(config.model) || config.model === 'custom';
      }

      return true;
    } catch {
      // 연결 실패 시 false
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    // 정적 모델 목록 (실제로는 동적으로 가져올 수 있음)
    return PROVIDER_MODELS.local.map(m => m.id);
  }

  /**
   * 자동 모델 서버 감지
   */
  async detectLocalServers(): Promise<Array<{ name: string; endpoint: string; status: 'online' | 'offline' }>> {
    const servers: Array<{ name: string; endpoint: string; status: 'online' | 'offline' }> = Object.entries(this.defaultEndpoints).map(([name, endpoint]) => ({
      name,
      endpoint,
      status: 'offline' as 'online' | 'offline',
    }));

    await Promise.allSettled(
      servers.map(async server => {
        try {
          const response = await fetch(server.endpoint.replace('/chat/completions', '/models'), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            server.status = 'online';
          }
        } catch {
          // 오프라인 상태 유지
        }
      })
    );

    return servers;
  }

  /**
   * 사용 가능한 모델 목록 동적 조회
   */
  async getAvailableModels(config: LLMConfig): Promise<string[]> {
    const endpoint = this.getEndpoint(config);

    try {
      const response = await fetch(endpoint.replace('/chat/completions', '/models'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        },
      });

      if (!response.ok) {
        return this.getModels();
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        return data.data.map((model: any) => model.id);
      }

      return this.getModels();
    } catch {
      return this.getModels();
    }
  }

  /**
   * 모델 다운로드 및 설치 도움
   */
  getModelInstallInstructions(model: string): { platform: string; commands: string[] }[] {
    const instructions: { platform: string; commands: string[] }[] = [];

    if (model.includes('qwen')) {
      instructions.push(
        {
          platform: 'Ollama',
          commands: [
            'curl -fsSL https://ollama.com/install.sh | sh',
            `ollama pull ${model}`,
          ],
        },
        {
          platform: 'vLLM',
          commands: [
            'pip install vllm',
            `python -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-7B-Instruct --quantization gptq`,
          ],
        }
      );
    } else if (model.includes('llama')) {
      instructions.push(
        {
          platform: 'Ollama',
          commands: [
            'curl -fsSL https://ollama.com/install.sh | sh',
            `ollama pull ${model}`,
          ],
        },
        {
          platform: 'llama.cpp',
          commands: [
            'git clone https://github.com/ggerganov/llama.cpp',
            'cd llama.cpp && make',
            `./server -m models/${model}.gguf -c 4096 --port 8080`,
          ],
        }
      );
    }

    return instructions;
  }

  private getEndpoint(config: LLMConfig): string {
    if (config.endpoint) {
      // 사용자 정의 엔드포인트
      return config.endpoint.endsWith('/chat/completions')
        ? config.endpoint
        : `${config.endpoint}/v1/chat/completions`;
    }

    // 기본값: Ollama
    return this.defaultEndpoints.ollama;
  }

  private estimateUsage(messages: LLMMessage[], response: string): any {
    const promptText = messages.map(m => m.content).join('');
    const promptTokens = this.estimateTokenCount(promptText);
    const completionTokens = this.estimateTokenCount(response);

    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    };
  }

  /**
   * 한국어 특화 모델 추천
   */
  getKoreanOptimizedModel(): string {
    // Qwen2.5는 한국어 성능이 우수함
    return 'qwen2.5:7b';
  }

  /**
   * 코딩 특화 모델 추천
   */
  getCodingOptimizedModel(): string {
    return 'codellama:7b';
  }

  /**
   * 수학 특화 모델 추천
   */
  getMathOptimizedModel(): string {
    return 'deepseek-math:7b';
  }
}