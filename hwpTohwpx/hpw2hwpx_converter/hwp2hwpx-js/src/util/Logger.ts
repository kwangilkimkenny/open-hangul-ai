/* eslint-disable no-console */
/**
 * Logger Utility
 *
 * 조건부 로깅을 위한 간단한 로거
 * 프로덕션에서는 로깅을 비활성화하고, 개발 중에만 활성화
 *
 * @module Utils
 * @category Utils
 */

/**
 * 로그 레벨 정의
 */
export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
}

/**
 * 로거 설정 인터페이스
 */
export interface LoggerConfig {
    /** 로그 레벨 (기본: WARN) */
    level: LogLevel;
    /** 로그 접두사 */
    prefix: string;
    /** 타임스탬프 표시 여부 */
    showTimestamp: boolean;
}

/**
 * 기본 설정
 */
const defaultConfig: LoggerConfig = {
    level: LogLevel.WARN,
    prefix: '[hwp2hwpx]',
    showTimestamp: false,
};

/**
 * 현재 설정
 */
let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * 로거 설정 변경
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
    currentConfig = { ...currentConfig, ...config };
}

/**
 * 로거 설정 초기화
 */
export function resetLoggerConfig(): void {
    currentConfig = { ...defaultConfig };
}

/**
 * 현재 로거 설정 조회
 */
export function getLoggerConfig(): Readonly<LoggerConfig> {
    return { ...currentConfig };
}

/**
 * 로그 메시지 포맷팅
 */
function formatMessage(level: string, message: string): string {
    const parts: string[] = [];

    if (currentConfig.showTimestamp) {
        parts.push(`[${new Date().toISOString()}]`);
    }

    if (currentConfig.prefix) {
        parts.push(currentConfig.prefix);
    }

    parts.push(`[${level}]`);
    parts.push(message);

    return parts.join(' ');
}

/**
 * Logger 객체
 *
 * @example
 * ```typescript
 * import { Logger, configureLogger, LogLevel } from './util/Logger';
 *
 * // 개발 환경에서 디버그 로깅 활성화
 * configureLogger({ level: LogLevel.DEBUG });
 *
 * Logger.debug('상세 정보');
 * Logger.info('일반 정보');
 * Logger.warn('경고 메시지');
 * Logger.error('오류 발생', new Error('details'));
 * ```
 */
export const Logger = {
    /**
     * 디버그 레벨 로그
     */
    debug(message: string, ...args: unknown[]): void {
        if (currentConfig.level >= LogLevel.DEBUG) {
            console.log(formatMessage('DEBUG', message), ...args);
        }
    },

    /**
     * 정보 레벨 로그
     */
    info(message: string, ...args: unknown[]): void {
        if (currentConfig.level >= LogLevel.INFO) {
            console.log(formatMessage('INFO', message), ...args);
        }
    },

    /**
     * 경고 레벨 로그
     */
    warn(message: string, ...args: unknown[]): void {
        if (currentConfig.level >= LogLevel.WARN) {
            console.warn(formatMessage('WARN', message), ...args);
        }
    },

    /**
     * 오류 레벨 로그
     */
    error(message: string, ...args: unknown[]): void {
        if (currentConfig.level >= LogLevel.ERROR) {
            console.error(formatMessage('ERROR', message), ...args);
        }
    },

    /**
     * 현재 레벨이 디버그 이상인지 확인
     */
    isDebugEnabled(): boolean {
        return currentConfig.level >= LogLevel.DEBUG;
    },

    /**
     * 현재 레벨이 정보 이상인지 확인
     */
    isInfoEnabled(): boolean {
        return currentConfig.level >= LogLevel.INFO;
    },
};

/**
 * 환경 변수 기반 자동 설정
 * Node.js 환경에서 DEBUG 환경 변수가 설정되면 디버그 모드 활성화
 */
if (typeof process !== 'undefined' && process.env) {
    if (process.env.DEBUG === 'hwp2hwpx' || process.env.DEBUG === '*') {
        configureLogger({ level: LogLevel.DEBUG, showTimestamp: true });
    } else if (process.env.NODE_ENV === 'development') {
        configureLogger({ level: LogLevel.INFO });
    } else if (process.env.NODE_ENV === 'production') {
        configureLogger({ level: LogLevel.ERROR });
    }
}
