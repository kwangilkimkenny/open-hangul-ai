/**
 * HWPX Viewer Error Handling
 * 에러 타입 정의 및 처리
 * 
 * @module error
 * @version 2.0.0
 */

/**
 * 에러 타입 상수
 * @enum {string}
 */
export const ErrorType = {
    FILE_SELECT_ERROR: 'FILE_SELECT_ERROR',
    DOCUMENT_LOAD_ERROR: 'DOCUMENT_LOAD_ERROR',
    HWPX_PARSE_ERROR: 'HWPX_PARSE_ERROR',
    DOCUMENT_RENDER_ERROR: 'DOCUMENT_RENDER_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

Object.freeze(ErrorType);

/**
 * HWPX 뷰어 커스텀 에러 클래스
 */
export class HWPXError extends Error {
    /**
     * HWPXError 생성자
     * @param {string} type - 에러 타입
     * @param {string} message - 에러 메시지
     * @param {Error} [originalError] - 원본 에러
     */
    constructor(type, message, originalError = null) {
        super(message);
        this.name = 'HWPXError';
        this.type = type;
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
        
        // Stack trace 유지
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, HWPXError);
        }
    }

    /**
     * 에러 정보를 JSON으로 변환
     * @returns {Object} 에러 정보 객체
     */
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

/**
 * 에러 핸들러 클래스
 */
export class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100; // 최대 저장 에러 수
    }

    /**
     * 에러 처리
     * @param {Error|HWPXError} error - 에러 객체
     * @param {Object} [context={}] - 에러 컨텍스트
     * @returns {HWPXError} 처리된 에러
     */
    handle(error, context = {}) {
        const hwpxError = error instanceof HWPXError 
            ? error 
            : this.wrapError(error, context);

        // 에러 저장
        this.errors.push({
            error: hwpxError,
            context,
            handledAt: new Date().toISOString()
        });

        // 저장된 에러 수 제한
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        return hwpxError;
    }

    /**
     * 일반 에러를 HWPXError로 래핑
     * @param {Error} error - 원본 에러
     * @param {Object} context - 컨텍스트
     * @returns {HWPXError} 래핑된 에러
     * @private
     */
    wrapError(error, context) {
        const type = this.detectErrorType(error, context);
        const message = this.getUserFriendlyMessage(type, error);
        return new HWPXError(type, message, error);
    }

    /**
     * 에러 타입 감지
     * @param {Error} error - 에러 객체
     * @param {Object} context - 컨텍스트
     * @returns {string} 에러 타입
     * @private
     */
    detectErrorType(error, context) {
        const message = error.message.toLowerCase();

        if (context.type) {
            return context.type;
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

        return ErrorType.UNKNOWN_ERROR;
    }

    /**
     * 사용자 친화적 에러 메시지 생성
     * @param {string} type - 에러 타입
     * @param {Error} error - 원본 에러
     * @returns {string} 사용자 메시지
     */
    getUserFriendlyMessage(type, error) {
        const messages = {
            [ErrorType.FILE_SELECT_ERROR]: '파일을 선택하는 중 오류가 발생했습니다.',
            [ErrorType.DOCUMENT_LOAD_ERROR]: '문서를 불러오는 중 오류가 발생했습니다.',
            [ErrorType.HWPX_PARSE_ERROR]: 'HWPX 파일 형식이 올바르지 않습니다.',
            [ErrorType.DOCUMENT_RENDER_ERROR]: '문서를 표시하는 중 오류가 발생했습니다.',
            [ErrorType.NETWORK_ERROR]: '네트워크 연결에 문제가 있습니다.',
            [ErrorType.VALIDATION_ERROR]: '입력값이 올바르지 않습니다.',
            [ErrorType.UNKNOWN_ERROR]: '알 수 없는 오류가 발생했습니다.'
        };

        let baseMessage = messages[type] || messages[ErrorType.UNKNOWN_ERROR];

        // 특정 에러 메시지 추가 처리
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

    /**
     * 개발자용 상세 에러 메시지 생성
     * @param {HWPXError} error - HWPX 에러
     * @returns {string} 상세 메시지
     */
    getDetailedMessage(error) {
        return `[${error.type}] ${error.message}\nTimestamp: ${error.timestamp}\nStack: ${error.stack}`;
    }

    /**
     * 최근 에러 목록 조회
     * @param {number} [count=10] - 조회할 에러 수
     * @returns {Array} 에러 목록
     */
    getRecentErrors(count = 10) {
        return this.errors.slice(-count);
    }

    /**
     * 특정 타입의 에러 조회
     * @param {string} type - 에러 타입
     * @returns {Array} 에러 목록
     */
    getErrorsByType(type) {
        return this.errors.filter(e => e.error.type === type);
    }

    /**
     * 모든 에러 클리어
     */
    clear() {
        this.errors = [];
    }

    /**
     * 에러 통계
     * @returns {Object} 에러 타입별 개수
     */
    getStatistics() {
        const stats = {};
        this.errors.forEach(({ error }) => {
            stats[error.type] = (stats[error.type] || 0) + 1;
        });
        return stats;
    }
}

/**
 * 기본 ErrorHandler 인스턴스
 */
let defaultHandler = null;

/**
 * 기본 ErrorHandler 인스턴스 가져오기
 * @returns {ErrorHandler} ErrorHandler 인스턴스
 */
export function getErrorHandler() {
    if (!defaultHandler) {
        defaultHandler = new ErrorHandler();
    }
    return defaultHandler;
}

/**
 * ErrorHandler 재설정
 */
export function resetErrorHandler() {
    defaultHandler = new ErrorHandler();
}

/**
 * 에러 처리 단축 함수
 * @param {Error} error - 에러 객체
 * @param {Object} context - 컨텍스트
 * @returns {HWPXError} 처리된 에러
 */
export function handleError(error, context = {}) {
    return getErrorHandler().handle(error, context);
}

// Default export
export default {
    ErrorType,
    HWPXError,
    ErrorHandler,
    getErrorHandler,
    resetErrorHandler,
    handleError
};

