/**
 * Logger - 추상화된 로깅 시스템
 * 프로덕션과 디버그 모드 분리
 */

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

export interface ILogger {
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  trace(message: string, ...args: unknown[]): void;
}

class Logger implements ILogger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.WARN; // 기본: 경고 이상만 출력
  private prefix: string = '[HWPLib]';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(`${this.prefix} ❌ ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`${this.prefix} ⚠️ ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`${this.prefix} ℹ️ ${message}`, ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`${this.prefix} 🔍 ${message}`, ...args);
    }
  }

  trace(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.TRACE) {
      console.log(`${this.prefix} 📋 ${message}`, ...args);
    }
  }
}

// 싱글톤 인스턴스 export
export const logger = Logger.getInstance();

// 편의 함수: 로그 레벨 설정
export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}

// 편의 함수: 디버그 모드 활성화
export function enableDebugMode(): void {
  logger.setLevel(LogLevel.DEBUG);
}

// 편의 함수: 프로덕션 모드 (경고 이상만)
export function enableProductionMode(): void {
  logger.setLevel(LogLevel.WARN);
}

// 편의 함수: 모든 로그 비활성화
export function disableLogging(): void {
  logger.setLevel(LogLevel.NONE);
}
