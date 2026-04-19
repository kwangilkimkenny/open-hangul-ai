/**
 * LLM Error Classification System
 * 표준화된 에러 타입과 처리를 위한 에러 클래스들
 */

export const LLMErrorType = {
  AUTHENTICATION: 'auth',
  AUTHORIZATION: 'authorization',
  RATE_LIMIT: 'rate_limit',
  TIMEOUT: 'timeout',
  VALIDATION: 'validation',
  NETWORK: 'network',
  SERVER_ERROR: 'server_error',
  QUOTA_EXCEEDED: 'quota_exceeded',
  MODEL_NOT_FOUND: 'model_not_found',
  CONTEXT_LENGTH_EXCEEDED: 'context_length_exceeded',
  CONTENT_FILTER: 'content_filter',
  UNKNOWN: 'unknown',
} as const;

export type LLMErrorType = typeof LLMErrorType[keyof typeof LLMErrorType];

export class LLMError extends Error {
  readonly type: LLMErrorType;
  readonly provider: string;
  readonly statusCode?: number;
  readonly originalError?: Error;
  readonly retryable: boolean;
  readonly suggestedAction?: string;

  constructor(
    message: string,
    type: LLMErrorType,
    provider: string,
    statusCode?: number,
    originalError?: Error,
    retryable: boolean = false,
    suggestedAction?: string
  ) {
    super(message);
    this.name = 'LLMError';
    this.type = type;
    this.provider = provider;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.retryable = retryable;
    this.suggestedAction = suggestedAction;

    // Stack trace 정리
    if (originalError && originalError.stack) {
      this.stack = originalError.stack;
    }
  }

  /**
   * 사용자 친화적인 에러 메시지 반환
   */
  getUserMessage(): string {
    const providerName = this.getProviderDisplayName();

    switch (this.type) {
      case LLMErrorType.AUTHENTICATION:
        return `${providerName} API 키가 유효하지 않습니다. 설정을 확인해주세요.`;

      case LLMErrorType.AUTHORIZATION:
        return `${providerName} API 접근 권한이 없습니다. 계정 상태를 확인해주세요.`;

      case LLMErrorType.RATE_LIMIT:
        return `${providerName} API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.`;

      case LLMErrorType.TIMEOUT:
        return `${providerName} 응답 시간이 초과되었습니다. 요청을 간단히 하거나 다시 시도해주세요.`;

      case LLMErrorType.NETWORK:
        return `${providerName} 서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.`;

      case LLMErrorType.SERVER_ERROR:
        return `${providerName} 서버에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`;

      case LLMErrorType.QUOTA_EXCEEDED:
        return `${providerName} 계정의 사용량 한도가 초과되었습니다. 요금제를 확인해주세요.`;

      case LLMErrorType.MODEL_NOT_FOUND:
        return `요청한 AI 모델을 찾을 수 없습니다. 모델 설정을 확인해주세요.`;

      case LLMErrorType.CONTEXT_LENGTH_EXCEEDED:
        return `입력 텍스트가 너무 깁니다. 더 짧은 텍스트로 시도해주세요.`;

      case LLMErrorType.CONTENT_FILTER:
        return `콘텐츠 정책에 위반되는 내용이 포함되어 있습니다. 다른 내용으로 시도해주세요.`;

      case LLMErrorType.VALIDATION:
        return `입력 값이 올바르지 않습니다. 설정을 확인해주세요.`;

      default:
        return `${providerName}에서 오류가 발생했습니다: ${this.message}`;
    }
  }

  /**
   * 제안 액션 반환
   */
  getSuggestedAction(): string {
    if (this.suggestedAction) {
      return this.suggestedAction;
    }

    switch (this.type) {
      case LLMErrorType.AUTHENTICATION:
        return 'API 키를 다시 확인하고 설정하세요.';

      case LLMErrorType.RATE_LIMIT:
        return '1-2분 후에 다시 시도하거나 다른 Provider를 사용해보세요.';

      case LLMErrorType.TIMEOUT:
        return '요청을 더 간단하게 만들거나 타임아웃 설정을 늘려보세요.';

      case LLMErrorType.NETWORK:
        return '인터넷 연결을 확인하고 다시 시도하세요.';

      case LLMErrorType.CONTEXT_LENGTH_EXCEEDED:
        return '입력 텍스트를 줄이거나 더 큰 컨텍스트를 지원하는 모델을 사용하세요.';

      case LLMErrorType.QUOTA_EXCEEDED:
        return 'API 계정의 결제 정보를 확인하거나 요금제를 업그레이드하세요.';

      default:
        return '설정을 확인하거나 다른 Provider를 시도해보세요.';
    }
  }

  private getProviderDisplayName(): string {
    const displayNames: Record<string, string> = {
      openai: 'OpenAI',
      claude: 'Claude',
      vertex: 'Gemini',
      grok: 'Grok',
      'azure-openai': 'Azure OpenAI',
      cohere: 'Cohere',
      local: '로컬 모델',
    };
    return displayNames[this.provider] || this.provider;
  }

  /**
   * 에러를 JSON으로 직렬화
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      provider: this.provider,
      statusCode: this.statusCode,
      retryable: this.retryable,
      suggestedAction: this.getSuggestedAction(),
      userMessage: this.getUserMessage(),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * HTTP 응답에서 LLM 에러 생성
 */
export function createLLMErrorFromResponse(
  response: Response,
  provider: string,
  errorData?: any
): LLMError {
  const status = response.status;
  const statusText = response.statusText;

  let type: LLMErrorType;
  let retryable = false;
  let message = errorData?.error?.message || errorData?.message || statusText;

  switch (status) {
    case 401:
      type = LLMErrorType.AUTHENTICATION;
      break;
    case 403:
      type = LLMErrorType.AUTHORIZATION;
      break;
    case 429:
      type = LLMErrorType.RATE_LIMIT;
      retryable = true;
      break;
    case 400:
      if (message.toLowerCase().includes('context') || message.toLowerCase().includes('token')) {
        type = LLMErrorType.CONTEXT_LENGTH_EXCEEDED;
      } else if (message.toLowerCase().includes('model')) {
        type = LLMErrorType.MODEL_NOT_FOUND;
      } else {
        type = LLMErrorType.VALIDATION;
      }
      break;
    case 402:
      type = LLMErrorType.QUOTA_EXCEEDED;
      break;
    case 404:
      type = LLMErrorType.MODEL_NOT_FOUND;
      break;
    case 408:
      type = LLMErrorType.TIMEOUT;
      retryable = true;
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      type = LLMErrorType.SERVER_ERROR;
      retryable = true;
      break;
    default:
      type = LLMErrorType.UNKNOWN;
  }

  return new LLMError(
    message,
    type,
    provider,
    status,
    undefined,
    retryable
  );
}

/**
 * 네트워크 에러에서 LLM 에러 생성
 */
export function createLLMErrorFromNetworkError(
  error: Error,
  provider: string
): LLMError {
  let type: LLMErrorType;
  let retryable = false;

  if (error.name === 'AbortError' || error.message.includes('aborted')) {
    type = LLMErrorType.TIMEOUT;
  } else if (
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('fetch')
  ) {
    type = LLMErrorType.NETWORK;
    retryable = true;
  } else if (error.message.includes('timeout')) {
    type = LLMErrorType.TIMEOUT;
    retryable = true;
  } else {
    type = LLMErrorType.UNKNOWN;
  }

  return new LLMError(
    error.message,
    type,
    provider,
    undefined,
    error,
    retryable
  );
}

/**
 * 에러 복구 전략
 */
export interface ErrorRecoveryStrategy {
  shouldRetry(error: LLMError, attemptCount: number): boolean;
  getRetryDelay(error: LLMError, attemptCount: number): number;
  getMaxRetries(error: LLMError): number;
}

export class DefaultErrorRecoveryStrategy implements ErrorRecoveryStrategy {
  shouldRetry(error: LLMError, attemptCount: number): boolean {
    if (!error.retryable) return false;
    if (attemptCount >= this.getMaxRetries(error)) return false;

    const retryableTypes = [
      LLMErrorType.RATE_LIMIT,
      LLMErrorType.TIMEOUT,
      LLMErrorType.NETWORK,
      LLMErrorType.SERVER_ERROR,
    ] as string[];
    return retryableTypes.includes(error.type);
  }

  getRetryDelay(error: LLMError, attemptCount: number): number {
    const baseDelay = 1000; // 1초

    switch (error.type) {
      case LLMErrorType.RATE_LIMIT:
        return baseDelay * Math.pow(2, attemptCount) * 2; // 지수 백오프 + 추가 대기
      case LLMErrorType.SERVER_ERROR:
        return baseDelay * Math.pow(1.5, attemptCount);
      case LLMErrorType.TIMEOUT:
      case LLMErrorType.NETWORK:
        return baseDelay * attemptCount;
      default:
        return baseDelay;
    }
  }

  getMaxRetries(error: LLMError): number {
    switch (error.type) {
      case LLMErrorType.RATE_LIMIT:
        return 3;
      case LLMErrorType.SERVER_ERROR:
      case LLMErrorType.NETWORK:
        return 2;
      case LLMErrorType.TIMEOUT:
        return 1;
      default:
        return 0;
    }
  }
}

/**
 * 에러 리포팅 인터페이스
 */
export interface ErrorReporter {
  reportError(error: LLMError): void;
}

export class ConsoleErrorReporter implements ErrorReporter {
  reportError(error: LLMError): void {
    const errorInfo = {
      provider: error.provider,
      type: error.type,
      message: error.message,
      timestamp: new Date().toISOString(),
      retryable: error.retryable,
    };

    if (error.type === LLMErrorType.UNKNOWN || !error.retryable) {
      console.error('[LLM Error]', errorInfo);
    } else {
      console.warn('[LLM Warning]', errorInfo);
    }
  }
}