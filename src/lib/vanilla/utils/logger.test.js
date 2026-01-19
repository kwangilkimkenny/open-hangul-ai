/**
 * Logger Module Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, getLogger, resetLogger } from './logger.js';

// Mock console methods
const mockConsole = () => {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    time: console.time,
    timeEnd: console.timeEnd,
    group: console.group,
    groupCollapsed: console.groupCollapsed,
    groupEnd: console.groupEnd,
    table: console.table,
    trace: console.trace,
    assert: console.assert,
    clear: console.clear,
    count: console.count,
    countReset: console.countReset,
  };

  const mocks = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
    group: vi.fn(),
    groupCollapsed: vi.fn(),
    groupEnd: vi.fn(),
    table: vi.fn(),
    trace: vi.fn(),
    assert: vi.fn(),
    clear: vi.fn(),
    count: vi.fn(),
    countReset: vi.fn(),
  };

  Object.assign(console, mocks);

  return { original, mocks };
};

const restoreConsole = original => {
  Object.assign(console, original);
};

describe('Logger', () => {
  let consoleState;

  beforeEach(() => {
    consoleState = mockConsole();
  });

  afterEach(() => {
    restoreConsole(consoleState.original);
  });

  describe('Constructor', () => {
    it('should create logger with default config', () => {
      const logger = new Logger();
      expect(logger.config.effectiveLogLevel).toBe('INFO');
      expect(logger.config.effectiveConsole).toBe(true);
      expect(logger.config.ENABLE_PERFORMANCE_MONITORING).toBe(true);
    });

    it('should create logger with custom config', () => {
      const logger = new Logger({
        effectiveLogLevel: 'DEBUG',
        effectiveConsole: false,
        ENABLE_PERFORMANCE_MONITORING: false,
      });
      expect(logger.config.effectiveLogLevel).toBe('DEBUG');
      expect(logger.config.effectiveConsole).toBe(false);
      expect(logger.config.ENABLE_PERFORMANCE_MONITORING).toBe(false);
    });

    it('should have correct log levels', () => {
      const logger = new Logger();
      expect(logger.levels).toEqual({
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
      });
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const logger = new Logger({ effectiveLogLevel: 'INFO' });
      logger.updateConfig({ effectiveLogLevel: 'DEBUG' });
      expect(logger.config.effectiveLogLevel).toBe('DEBUG');
    });

    it('should update currentLevel', () => {
      const logger = new Logger({ effectiveLogLevel: 'ERROR' });
      expect(logger.currentLevel).toBe(3);
      logger.updateConfig({ effectiveLogLevel: 'DEBUG' });
      expect(logger.currentLevel).toBe(0);
    });
  });

  describe('Log Level Filtering', () => {
    it('should log DEBUG when level is DEBUG', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      logger.debug('test');
      expect(consoleState.mocks.log).toHaveBeenCalledWith('[DEBUG]', 'test');
    });

    it('should not log DEBUG when level is INFO', () => {
      const logger = new Logger({ effectiveLogLevel: 'INFO' });
      logger.debug('test');
      expect(consoleState.mocks.log).not.toHaveBeenCalled();
    });

    it('should log INFO when level is INFO', () => {
      const logger = new Logger({ effectiveLogLevel: 'INFO' });
      logger.info('test');
      expect(consoleState.mocks.log).toHaveBeenCalledWith('[INFO]', 'test');
    });

    it('should not log INFO when level is WARN', () => {
      const logger = new Logger({ effectiveLogLevel: 'WARN' });
      logger.info('test');
      expect(consoleState.mocks.log).not.toHaveBeenCalled();
    });

    it('should log WARN when level is WARN', () => {
      const logger = new Logger({ effectiveLogLevel: 'WARN' });
      logger.warn('test');
      expect(consoleState.mocks.warn).toHaveBeenCalledWith('[WARN]', 'test');
    });

    it('should log ERROR at any level', () => {
      const logger = new Logger({ effectiveLogLevel: 'ERROR' });
      logger.error('test');
      expect(consoleState.mocks.error).toHaveBeenCalledWith('[ERROR]', 'test');
    });

    it('should not log when effectiveConsole is false', () => {
      const logger = new Logger({
        effectiveLogLevel: 'DEBUG',
        effectiveConsole: false,
      });
      logger.debug('test');
      logger.info('test');
      logger.warn('test');
      logger.error('test');
      expect(consoleState.mocks.log).not.toHaveBeenCalled();
      expect(consoleState.mocks.warn).not.toHaveBeenCalled();
      expect(consoleState.mocks.error).not.toHaveBeenCalled();
    });
  });

  describe('debug()', () => {
    it('should log with multiple arguments', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      logger.debug('test', 123, { foo: 'bar' });
      expect(consoleState.mocks.log).toHaveBeenCalledWith('[DEBUG]', 'test', 123, { foo: 'bar' });
    });
  });

  describe('info()', () => {
    it('should log info messages', () => {
      const logger = new Logger({ effectiveLogLevel: 'INFO' });
      logger.info('Information message');
      expect(consoleState.mocks.log).toHaveBeenCalledWith('[INFO]', 'Information message');
    });
  });

  describe('warn()', () => {
    it('should log warning messages', () => {
      const logger = new Logger({ effectiveLogLevel: 'WARN' });
      logger.warn('Warning message');
      expect(consoleState.mocks.warn).toHaveBeenCalledWith('[WARN]', 'Warning message');
    });
  });

  describe('error()', () => {
    it('should log error messages', () => {
      const logger = new Logger({ effectiveLogLevel: 'ERROR' });
      logger.error('Error message');
      expect(consoleState.mocks.error).toHaveBeenCalledWith('[ERROR]', 'Error message');
    });
  });

  describe('Performance Monitoring', () => {
    it('should call time() when monitoring enabled', () => {
      const logger = new Logger({ ENABLE_PERFORMANCE_MONITORING: true });
      logger.time('test');
      expect(consoleState.mocks.time).toHaveBeenCalledWith('[PERF] test');
    });

    it('should call timeEnd() when monitoring enabled', () => {
      const logger = new Logger({ ENABLE_PERFORMANCE_MONITORING: true });
      logger.timeEnd('test');
      expect(consoleState.mocks.timeEnd).toHaveBeenCalledWith('[PERF] test');
    });

    it('should not call time() when monitoring disabled', () => {
      const logger = new Logger({ ENABLE_PERFORMANCE_MONITORING: false });
      logger.time('test');
      expect(consoleState.mocks.time).not.toHaveBeenCalled();
    });

    it('should not call timeEnd() when monitoring disabled', () => {
      const logger = new Logger({ ENABLE_PERFORMANCE_MONITORING: false });
      logger.timeEnd('test');
      expect(consoleState.mocks.timeEnd).not.toHaveBeenCalled();
    });
  });

  describe('Grouping', () => {
    it('should call group() when DEBUG level', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      logger.group('Test Group');
      expect(consoleState.mocks.group).toHaveBeenCalledWith('Test Group');
    });

    it('should call groupCollapsed() when DEBUG level', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      logger.groupCollapsed('Test Group');
      expect(consoleState.mocks.groupCollapsed).toHaveBeenCalledWith('Test Group');
    });

    it('should call groupEnd() when DEBUG level', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      logger.groupEnd();
      expect(consoleState.mocks.groupEnd).toHaveBeenCalled();
    });

    it('should not call group() when INFO level', () => {
      const logger = new Logger({ effectiveLogLevel: 'INFO' });
      logger.group('Test Group');
      expect(consoleState.mocks.group).not.toHaveBeenCalled();
    });
  });

  describe('Additional Methods', () => {
    it('should call table()', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      const data = [{ name: 'John', age: 30 }];
      logger.table(data);
      expect(consoleState.mocks.table).toHaveBeenCalledWith(data);
    });

    it('should call table() with columns', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      const data = [{ name: 'John', age: 30 }];
      const columns = ['name'];
      logger.table(data, columns);
      expect(consoleState.mocks.table).toHaveBeenCalledWith(data, columns);
    });

    it('should call trace()', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      logger.trace('test trace');
      expect(consoleState.mocks.trace).toHaveBeenCalledWith('[TRACE]', 'test trace');
    });

    it('should call assert()', () => {
      const logger = new Logger({ effectiveLogLevel: 'ERROR' });
      logger.assert(false, 'assertion failed');
      expect(consoleState.mocks.assert).toHaveBeenCalledWith(false, '[ASSERT]', 'assertion failed');
    });

    it('should call clear()', () => {
      const logger = new Logger();
      logger.clear();
      expect(consoleState.mocks.clear).toHaveBeenCalled();
    });

    it('should call count()', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      logger.count('test');
      expect(consoleState.mocks.count).toHaveBeenCalledWith('test');
    });

    it('should call countReset()', () => {
      const logger = new Logger({ effectiveLogLevel: 'DEBUG' });
      logger.countReset('test');
      expect(consoleState.mocks.countReset).toHaveBeenCalledWith('test');
    });
  });

  describe('getLogger()', () => {
    it('should return singleton instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it('should use window.HWPX_VIEWER_CONFIG if available', () => {
      // Set up window config in jsdom environment
      window.HWPX_VIEWER_CONFIG = {
        effectiveLogLevel: 'DEBUG',
        effectiveConsole: true,
        ENABLE_PERFORMANCE_MONITORING: false,
      };

      resetLogger(null); // Reset to force recreation
      const logger = getLogger();

      expect(logger.config.effectiveLogLevel).toBe('DEBUG');
      expect(logger.config.ENABLE_PERFORMANCE_MONITORING).toBe(false);

      delete window.HWPX_VIEWER_CONFIG;
    });
  });

  describe('resetLogger()', () => {
    it('should create new logger instance', () => {
      const logger1 = getLogger();
      resetLogger({ effectiveLogLevel: 'WARN' });
      const logger2 = getLogger();

      expect(logger1).not.toBe(logger2);
      expect(logger2.config.effectiveLogLevel).toBe('WARN');
    });
  });
});
