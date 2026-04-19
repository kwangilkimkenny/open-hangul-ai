/**
 * Production Logging System
 * 구조화된 로깅과 레벨별 관리
 *
 * @module lib/logging/logger
 * @version 1.0.0
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageEntries: number;
  environment: 'development' | 'production';
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  enableConsole: true,
  enableStorage: false,
  maxStorageEntries: 1000,
  environment: import.meta.env.MODE === 'development' ? 'development' : 'production'
};

class Logger {
  private config: LoggerConfig;
  private logStorage: LogEntry[] = [];
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.config.level];
  }

  private createLogEntry(
    level: LogLevel,
    module: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      context,
      error
    };
  }

  private outputToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]`;
    const args: any[] = [prefix, entry.message];

    if (entry.context) {
      args.push('\nContext:', entry.context);
    }

    if (entry.error) {
      args.push('\nError:', entry.error);
    }

    switch (entry.level) {
      case 'debug':
        // console.debug가 없는 환경을 위한 폴백
        (console.debug || console.log)(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }

  private storeEntry(entry: LogEntry): void {
    if (!this.config.enableStorage) return;

    this.logStorage.push(entry);

    // 최대 저장 개수 제한
    if (this.logStorage.length > this.config.maxStorageEntries) {
      this.logStorage = this.logStorage.slice(-this.config.maxStorageEntries);
    }
  }

  private log(
    level: LogLevel,
    module: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, module, message, context, error);

    this.outputToConsole(entry);
    this.storeEntry(entry);
  }

  debug(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('debug', module, message, context);
  }

  info(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('info', module, message, context);
  }

  warn(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('warn', module, message, context);
  }

  error(module: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', module, message, context, error);
  }

  /**
   * 설정 업데이트
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 저장된 로그 조회
   */
  getLogs(level?: LogLevel, module?: string): LogEntry[] {
    let logs = this.logStorage;

    if (level) {
      logs = logs.filter(entry => entry.level === level);
    }

    if (module) {
      logs = logs.filter(entry => entry.module === module);
    }

    return logs;
  }

  /**
   * 로그 저장소 비우기
   */
  clearLogs(): void {
    this.logStorage = [];
  }

  /**
   * 모듈별 로거 팩토리
   */
  createModuleLogger(moduleName: string) {
    return {
      debug: (message: string, context?: Record<string, unknown>) =>
        this.debug(moduleName, message, context),
      info: (message: string, context?: Record<string, unknown>) =>
        this.info(moduleName, message, context),
      warn: (message: string, context?: Record<string, unknown>) =>
        this.warn(moduleName, message, context),
      error: (message: string, error?: Error, context?: Record<string, unknown>) =>
        this.error(moduleName, message, error, context),
    };
  }
}

// 싱글톤 로거 인스턴스
const logger = new Logger();

// 환경변수에 따른 설정
const logLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info';
const enableStorage = import.meta.env.VITE_LOG_STORAGE === 'true';

logger.configure({
  level: logLevel,
  enableStorage,
  enableConsole: true,
});

export { logger };
export default logger;

// 편의 함수들
export const getLogger = (moduleName: string) => logger.createModuleLogger(moduleName);
export const configureLogger = (config: Partial<LoggerConfig>) => logger.configure(config);
export const getLogs = (level?: LogLevel, module?: string) => logger.getLogs(level, module);
export const clearLogs = () => logger.clearLogs();