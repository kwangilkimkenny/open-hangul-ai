/**
 * HWPX Viewer Error Handling
 * 에러 타입 정의 및 처리
 * 
 * @module error
 * @version 2.0.0
 */

/**
 * 에러 타입 상수
 */
export const ErrorType = {
  FILE_SELECT_ERROR: 'FILE_SELECT_ERROR',
  DOCUMENT_LOAD_ERROR: 'DOCUMENT_LOAD_ERROR',
  HWPX_PARSE_ERROR: 'HWPX_PARSE_ERROR',
  DOCUMENT_RENDER_ERROR: 'DOCUMENT_RENDER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AI_ERROR: 'AI_ERROR',
  EXPORT_ERROR: 'EXPORT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorTypeKey = keyof typeof ErrorType;
export type ErrorTypeValue = typeof ErrorType[ErrorTypeKey];

/**
 * HWPX 뷰어 커스텀 에러 클래스
 */
export class HWPXError extends Error {
  type: ErrorTypeValue;
  originalError: Error | null;
  timestamp: string;

  constructor(type: ErrorTypeValue, message: string, originalError: Error | null = null) {
    super(message);
    this.name = 'HWPXError';
    this.type = type;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HWPXError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null
    };
  }
}

interface ErrorRecord {
  error: HWPXError;
  context: Record<string, unknown>;
  handledAt: string;
}

/**
 * 에러 핸들러 클래스
 */
export class ErrorHandler {
  private errors: ErrorRecord[] = [];
  private maxErrors = 100;

  handle(error: Error | HWPXError, context: Record<string, unknown> = {}): HWPXError {
    const hwpxError = error instanceof HWPXError 
      ? error 
      : this.wrapError(error, context);

    this.errors.push({
      error: hwpxError,
      context,
      handledAt: new Date().toISOString()
    });

    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    return hwpxError;
  }

  private wrapError(error: Error, context: Record<string, unknown>): HWPXError {
    const type = this.detectErrorType(error, context);
    const message = this.getUserFriendlyMessage(type, error);
    return new HWPXError(type, message, error);
  }

  private detectErrorType(error: Error, context: Record<string, unknown>): ErrorTypeValue {
    const message = error.message.toLowerCase();

    if (context.type && typeof context.type === 'string') {
      return context.type as ErrorTypeValue;
    }

    if (message.includes('parse') || message.includes('파싱')) {
      return ErrorType.HWPX_PARSE_ERROR;
    }
    if (message.includes('render') || message.includes('렌더링')) {
      return ErrorType.DOCUMENT_RENDER_ERROR;
    }
    if (message.includes('load') || message.includes('로드')) {
      return ErrorType.DOCUMENT_LOAD_ERROR;
    }
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK_ERROR;
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return ErrorType.VALIDATION_ERROR;
    }
    if (message.includes('ai') || message.includes('gpt')) {
      return ErrorType.AI_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  private getUserFriendlyMessage(type: ErrorTypeValue, error: Error): string {
    const messages: Record<ErrorTypeValue, string> = {
      [ErrorType.FILE_SELECT_ERROR]: '파일을 선택하는 중 오류가 발생했습니다.',
      [ErrorType.DOCUMENT_LOAD_ERROR]: '문서를 불러오는 중 오류가 발생했습니다.',
      [ErrorType.HWPX_PARSE_ERROR]: 'HWPX 파일 형식이 올바르지 않습니다.',
      [ErrorType.DOCUMENT_RENDER_ERROR]: '문서를 표시하는 중 오류가 발생했습니다.',
      [ErrorType.NETWORK_ERROR]: '네트워크 연결에 문제가 있습니다.',
      [ErrorType.VALIDATION_ERROR]: '입력값이 올바르지 않습니다.',
      [ErrorType.AI_ERROR]: 'AI 처리 중 오류가 발생했습니다.',
      [ErrorType.EXPORT_ERROR]: '파일 내보내기 중 오류가 발생했습니다.',
      [ErrorType.UNKNOWN_ERROR]: '알 수 없는 오류가 발생했습니다.'
    };

    let baseMessage = messages[type] || messages[ErrorType.UNKNOWN_ERROR];

    if (error.message.includes('not a valid zip')) {
      baseMessage = 'HWPX 파일 형식이 올바르지 않습니다.';
    } else if (error.message.includes('encrypted')) {
      baseMessage = '암호화된 문서는 지원하지 않습니다.';
    } else if (error.message.includes('corrupted')) {
      baseMessage = '손상된 파일입니다.';
    } else if (error.message.includes('size')) {
      baseMessage = '파일 크기가 너무 큽니다.';
    }

    return baseMessage;
  }

  getDetailedMessage(error: HWPXError): string {
    return `[${error.type}] ${error.message}\nTimestamp: ${error.timestamp}\nStack: ${error.stack}`;
  }

  getRecentErrors(count = 10): ErrorRecord[] {
    return this.errors.slice(-count);
  }

  getErrorsByType(type: ErrorTypeValue): ErrorRecord[] {
    return this.errors.filter(e => e.error.type === type);
  }

  clear(): void {
    this.errors = [];
  }

  getStatistics(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.errors.forEach(({ error }) => {
      stats[error.type] = (stats[error.type] || 0) + 1;
    });
    return stats;
  }
}

// 기본 ErrorHandler 인스턴스
let defaultHandler: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
  if (!defaultHandler) {
    defaultHandler = new ErrorHandler();
  }
  return defaultHandler;
}

export function resetErrorHandler(): void {
  defaultHandler = new ErrorHandler();
}

export function handleError(error: Error, context: Record<string, unknown> = {}): HWPXError {
  return getErrorHandler().handle(error, context);
}

export default {
  ErrorType,
  HWPXError,
  ErrorHandler,
  getErrorHandler,
  resetErrorHandler,
  handleError
};

