/**
 * Enhanced Base Provider - 모든 LLM Provider의 기본 클래스
 */

import type {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMGenerateOptions,
  LLMProviderInterface,
  LLMProvider,
} from '../../../types/universal-llm';
import {
  LLMError,
  LLMErrorType,
  createLLMErrorFromResponse,
  createLLMErrorFromNetworkError,
  DefaultErrorRecoveryStrategy,
  ConsoleErrorReporter,
  type ErrorRecoveryStrategy,
  type ErrorReporter,
} from '../errors';

export abstract class BaseProvider implements LLMProviderInterface {
  abstract name: LLMProvider;
  abstract displayName: string;
  abstract icon: string;
  abstract supportedFeatures: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
    json: boolean;
  };

  protected errorReporter: ErrorReporter = new ConsoleErrorReporter();
  protected recoveryStrategy: ErrorRecoveryStrategy = new DefaultErrorRecoveryStrategy();

  abstract generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse>;

  abstract streamText(
    messages: LLMMessage[],
    config: LLMConfig,
    options?: LLMGenerateOptions
  ): AsyncGenerator<LLMStreamChunk>;

  abstract validateConfig(config: LLMConfig): Promise<boolean>;

  abstract getModels(): Promise<string[]>;

  /**
   * 사용 가능한 모델 목록 조회 (provider별 구현 선택사항)
   */
  getAvailableModels?(config: LLMConfig): Promise<string[]>;

  /**
   * API 키 검증 (공통 로직)
   */
  protected validateApiKey(apiKey?: string): void {
    if (!apiKey || apiKey.trim() === '') {
      throw new LLMError(
        'API 키가 설정되지 않았습니다',
        LLMErrorType.VALIDATION,
        this.name,
        undefined,
        undefined,
        false,
        '설정에서 API 키를 입력해주세요'
      );
    }
  }

  /**
   * 표준 HTTP 헤더 생성
   */
  protected createStandardHeaders(apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `HanView-AI/${this.name}`,
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  /**
   * 공통 메시지 변환 (OpenAI 형식으로)
   */
  protected convertToOpenAIMessages(
    messages: LLMMessage[]
  ): Array<{ role: string; content: string }> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * 향상된 에러 처리
   */
  protected handleError(
    error: unknown,
    response?: Response,
    errorData?: { error?: { message?: string }; message?: string } | null
  ): never {
    let llmError: LLMError;
    const err = (error || {}) as { code?: string; message?: string };

    if (response && !response.ok) {
      llmError = createLLMErrorFromResponse(response, this.name, errorData);
    } else if (
      error instanceof Error ||
      (error && (typeof err.code === 'string' || typeof err.message === 'string'))
    ) {
      llmError = createLLMErrorFromNetworkError(error, this.name);
    } else {
      llmError = new LLMError(
        err.message || '알 수 없는 오류',
        LLMErrorType.UNKNOWN,
        this.name,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }

    this.errorReporter.reportError(llmError);
    throw llmError;
  }

  /**
   * 재시도 가능한 요청 래퍼
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string = 'request'
  ): Promise<T> {
    let lastError: LLMError;
    let attemptCount = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        lastError =
          error instanceof LLMError
            ? error
            : new LLMError(
                (error as { message?: string })?.message || '요청 실패',
                LLMErrorType.UNKNOWN,
                this.name,
                undefined,
                error instanceof Error ? error : new Error(String(error))
              );

        attemptCount++;

        if (!this.recoveryStrategy.shouldRetry(lastError, attemptCount)) {
          throw lastError;
        }

        const delay = this.recoveryStrategy.getRetryDelay(lastError, attemptCount);
        console.log(
          `[${this.name}] ${context} 재시도 ${attemptCount}/${this.recoveryStrategy.getMaxRetries(lastError)} (${delay}ms 대기)`
        );
        await this.sleep(delay);
      }
    }
  }

  /**
   * 향상된 fetch - 자동 에러 처리 및 재시도
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = 30000
  ): Promise<Response> {
    return this.executeWithRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: options.signal || controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: response.statusText };
          }
          this.handleError(null, response, errorData);
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        this.handleError(error);
      }
    }, 'fetch');
  }

  /**
   * 응답 JSON 파싱 (에러 처리 포함)
   */
  protected async parseResponseJSON(response: Response): Promise<unknown> {
    try {
      const text = await response.text();
      if (!text.trim()) {
        throw new LLMError(
          '서버에서 빈 응답을 받았습니다',
          LLMErrorType.SERVER_ERROR,
          this.name,
          response.status
        );
      }
      return JSON.parse(text);
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(
        '응답 파싱 실패: 유효하지 않은 JSON',
        LLMErrorType.SERVER_ERROR,
        this.name,
        response.status,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * 스트림 이벤트 파싱
   */
  protected parseSSEEvent(eventString: string): unknown {
    const lines = eventString.trim().split('\n');
    let data = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        data = line.slice(6).trim();
        break;
      }
    }

    if (!data || data === '[DONE]') {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * 스트림 리더 처리
   */
  protected async *processStream(
    response: Response,
    parseChunk: (data: unknown) => LLMStreamChunk | null,
    options: LLMGenerateOptions = {}
  ): AsyncGenerator<LLMStreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMError(
        '스트림을 읽을 수 없습니다',
        LLMErrorType.SERVER_ERROR,
        this.name,
        response.status
      );
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;

          const data = this.parseSSEEvent(event);
          if (!data) continue;

          const chunk = parseChunk(data);
          if (chunk) {
            options.onChunk?.(chunk);
            yield chunk;
          }
        }
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 토큰 수 추정 (개선된 알고리즘)
   */
  protected estimateTokenCount(text: string): number {
    if (!text) return 0;

    // 영어와 한국어 혼합 텍스트 고려
    const koreanChars = (text.match(/[\u3131-\uD79D]/g) || []).length;
    const englishWords = text
      .replace(/[\u3131-\uD79D]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0).length;

    // 한국어는 토큰당 평균 1.5자, 영어는 토큰당 평균 4자
    return Math.ceil(koreanChars / 1.5 + englishWords);
  }

  /**
   * 비용 계산 (개선된 정확도)
   */
  protected calculateCost(
    promptTokens: number,
    completionTokens: number,
    inputCostPer1K?: number,
    outputCostPer1K?: number
  ): number {
    if (!inputCostPer1K || !outputCostPer1K) return 0;
    return Number(
      (
        (promptTokens / 1000) * inputCostPer1K +
        (completionTokens / 1000) * outputCostPer1K
      ).toFixed(6)
    );
  }

  /**
   * 설정 검증을 위한 간단한 테스트 요청
   */
  protected async testConnection(config: LLMConfig): Promise<boolean> {
    try {
      const testMessages: LLMMessage[] = [
        { role: 'user', content: 'Test connection. Reply with "OK".' },
      ];

      const response = await this.generateText(testMessages, {
        ...config,
        maxTokens: 10,
        temperature: 0,
      });

      return response.content.toLowerCase().includes('ok');
    } catch (error) {
      console.debug(
        `[${this.name}] Connection test failed:`,
        (error as { message?: string })?.message
      );
      return false;
    }
  }

  /**
   * 일시정지 (비동기)
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 요청 메트릭 로깅
   */
  protected logRequestMetrics(
    startTime: number,
    endTime: number,
    tokenCount: number,
    cost: number
  ): void {
    const duration = endTime - startTime;
    const tokensPerSecond = tokenCount > 0 ? Math.round(tokenCount / (duration / 1000)) : 0;

    console.debug(`[${this.name}] Request completed:`, {
      duration: `${duration}ms`,
      tokens: tokenCount,
      tokensPerSecond,
      cost: `$${cost.toFixed(6)}`,
    });
  }

  /**
   * 설정값 검증
   */
  protected validateSettings(config: LLMConfig): void {
    if (config.temperature < 0 || config.temperature > 2) {
      throw new LLMError('Temperature must be between 0 and 2', LLMErrorType.VALIDATION, this.name);
    }

    if (config.maxTokens <= 0 || config.maxTokens > 100000) {
      throw new LLMError(
        'Max tokens must be between 1 and 100000',
        LLMErrorType.VALIDATION,
        this.name
      );
    }

    if (config.topP && (config.topP <= 0 || config.topP > 1)) {
      throw new LLMError('Top P must be between 0 and 1', LLMErrorType.VALIDATION, this.name);
    }
  }
}
