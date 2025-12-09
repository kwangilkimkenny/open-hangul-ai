/**
 * HWPX Viewer Logger
 * 로그 레벨 관리 및 조건부 로깅
 * 
 * @module logger
 * @version 2.0.0
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LoggerConfig {
  effectiveLogLevel?: LogLevel;
  effectiveConsole?: boolean;
  ENABLE_PERFORMANCE_MONITORING?: boolean;
}

/**
 * Logger 클래스
 */
export class Logger {
  private config: Required<LoggerConfig>;
  private levels: Record<LogLevel, number>;
  private currentLevel: number;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      effectiveLogLevel: config.effectiveLogLevel || 'INFO',
      effectiveConsole: config.effectiveConsole !== false,
      ENABLE_PERFORMANCE_MONITORING: config.ENABLE_PERFORMANCE_MONITORING !== false
    };

    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };

    this.currentLevel = this.levels[this.config.effectiveLogLevel] || this.levels.INFO;
  }

  updateConfig(newConfig: Partial<LoggerConfig>): void {
    Object.assign(this.config, newConfig);
    this.currentLevel = this.levels[this.config.effectiveLogLevel] || this.levels.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.config.effectiveConsole && this.levels[level] >= this.currentLevel;
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('INFO')) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('WARN')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('ERROR')) {
      console.error('[ERROR]', ...args);
    }
  }

  time(label: string): void {
    if (this.config.ENABLE_PERFORMANCE_MONITORING) {
      console.time(`[PERF] ${label}`);
    }
  }

  timeEnd(label: string): void {
    if (this.config.ENABLE_PERFORMANCE_MONITORING) {
      console.timeEnd(`[PERF] ${label}`);
    }
  }

  group(label: string): void {
    if (this.shouldLog('DEBUG')) {
      console.group(label);
    }
  }

  groupCollapsed(label: string): void {
    if (this.shouldLog('DEBUG')) {
      console.groupCollapsed(label);
    }
  }

  groupEnd(): void {
    if (this.shouldLog('DEBUG')) {
      console.groupEnd();
    }
  }

  table(data: unknown, columns?: string[]): void {
    if (this.shouldLog('DEBUG')) {
      if (columns) {
        console.table(data, columns);
      } else {
        console.table(data);
      }
    }
  }

  trace(...args: unknown[]): void {
    if (this.shouldLog('DEBUG')) {
      console.trace('[TRACE]', ...args);
    }
  }

  assert(condition: boolean, ...args: unknown[]): void {
    if (this.shouldLog('ERROR')) {
      console.assert(condition, '[ASSERT]', ...args);
    }
  }

  clear(): void {
    if (this.config.effectiveConsole) {
      console.clear();
    }
  }

  count(label = 'default'): void {
    if (this.shouldLog('DEBUG')) {
      console.count(label);
    }
  }

  countReset(label = 'default'): void {
    if (this.shouldLog('DEBUG')) {
      console.countReset(label);
    }
  }
}

// 기본 Logger 인스턴스
let defaultLogger: Logger | null = null;

/**
 * 기본 Logger 인스턴스 가져오기
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger({
      effectiveLogLevel: import.meta.env.DEV ? 'DEBUG' : 'INFO',
      effectiveConsole: true,
      ENABLE_PERFORMANCE_MONITORING: true
    });
  }
  return defaultLogger;
}

/**
 * Logger 인스턴스 재설정
 */
export function resetLogger(config?: LoggerConfig): void {
  defaultLogger = new Logger(config);
}

export default Logger;

