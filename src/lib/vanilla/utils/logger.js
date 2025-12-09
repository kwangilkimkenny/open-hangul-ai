/**
 * HWPX Viewer Logger
 * 로그 레벨 관리 및 조건부 로깅
 * 
 * @module logger
 * @version 2.0.0
 */

/**
 * Logger 클래스
 * 환경별 로그 레벨 관리 및 성능 측정 지원
 * 
 * @example
 * import { Logger } from './logger.js';
 * 
 * const logger = new Logger({
 *   effectiveLogLevel: 'DEBUG',
 *   effectiveConsole: true,
 *   ENABLE_PERFORMANCE_MONITORING: true
 * });
 * 
 * logger.debug('Debug message');
 * logger.info('Info message');
 * logger.error('Error occurred');
 */
export class Logger {
    /**
     * Logger 생성자
     * @param {Object} config - 설정 객체
     * @param {string} [config.effectiveLogLevel='INFO'] - 현재 로그 레벨
     * @param {boolean} [config.effectiveConsole=true] - 콘솔 출력 여부
     * @param {boolean} [config.ENABLE_PERFORMANCE_MONITORING=true] - 성능 측정 여부
     */
    constructor(config = {}) {
        this.config = {
            effectiveLogLevel: config.effectiveLogLevel || 'INFO',
            effectiveConsole: config.effectiveConsole !== false,
            ENABLE_PERFORMANCE_MONITORING: config.ENABLE_PERFORMANCE_MONITORING !== false
        };

        /**
         * 로그 레벨 매핑
         * @type {Object<string, number>}
         */
        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        };

        this.currentLevel = this.levels[this.config.effectiveLogLevel] || this.levels.INFO;
    }

    /**
     * 설정 업데이트
     * @param {Object} newConfig - 새로운 설정
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.currentLevel = this.levels[this.config.effectiveLogLevel] || this.levels.INFO;
    }

    /**
     * 로그 레벨 체크
     * @param {string} level - 체크할 로그 레벨
     * @returns {boolean} 로그 출력 가능 여부
     * @private
     */
    shouldLog(level) {
        return this.config.effectiveConsole && this.levels[level] >= this.currentLevel;
    }

    /**
     * DEBUG 레벨 로그 (개발 모드에서만 출력)
     * @param {...any} args - 로그 메시지
     * 
     * @example
     * logger.debug('Variable value:', myVar);
     */
    debug(...args) {
        if (this.shouldLog('DEBUG')) {
            console.log('[DEBUG]', ...args);
        }
    }

    /**
     * INFO 레벨 로그
     * @param {...any} args - 로그 메시지
     * 
     * @example
     * logger.info('Document loaded successfully');
     */
    info(...args) {
        if (this.shouldLog('INFO')) {
            console.log('[INFO]', ...args);
        }
    }

    /**
     * WARN 레벨 로그
     * @param {...any} args - 로그 메시지
     * 
     * @example
     * logger.warn('Deprecated method called');
     */
    warn(...args) {
        if (this.shouldLog('WARN')) {
            console.warn('[WARN]', ...args);
        }
    }

    /**
     * ERROR 레벨 로그 (항상 출력)
     * @param {...any} args - 로그 메시지
     * 
     * @example
     * logger.error('Failed to parse document:', error);
     */
    error(...args) {
        if (this.shouldLog('ERROR')) {
            console.error('[ERROR]', ...args);
        }
    }

    /**
     * 성능 측정 시작
     * @param {string} label - 측정 레이블
     * 
     * @example
     * logger.time('Document Parse');
     * // ... 작업 ...
     * logger.timeEnd('Document Parse');
     */
    time(label) {
        if (this.config.ENABLE_PERFORMANCE_MONITORING) {
            console.time(`[PERF] ${label}`);
        }
    }

    /**
     * 성능 측정 종료
     * @param {string} label - 측정 레이블
     */
    timeEnd(label) {
        if (this.config.ENABLE_PERFORMANCE_MONITORING) {
            console.timeEnd(`[PERF] ${label}`);
        }
    }

    /**
     * 그룹 시작
     * @param {string} label - 그룹 레이블
     * 
     * @example
     * logger.group('Processing Items');
     * // ... 로그들 ...
     * logger.groupEnd();
     */
    group(label) {
        if (this.shouldLog('DEBUG')) {
            console.group(label);
        }
    }

    /**
     * Collapsed 그룹 시작 (접힌 상태로 시작)
     * @param {string} label - 그룹 레이블
     */
    groupCollapsed(label) {
        if (this.shouldLog('DEBUG')) {
            console.groupCollapsed(label);
        }
    }

    /**
     * 그룹 종료
     */
    groupEnd() {
        if (this.shouldLog('DEBUG')) {
            console.groupEnd();
        }
    }

    /**
     * 테이블 형식 로그
     * @param {Object|Array} data - 테이블로 표시할 데이터
     * @param {Array<string>} [columns] - 표시할 열 (선택)
     * 
     * @example
     * logger.table([
     *   { name: 'John', age: 30 },
     *   { name: 'Jane', age: 25 }
     * ]);
     */
    table(data, columns = null) {
        if (this.shouldLog('DEBUG')) {
            if (columns) {
                console.table(data, columns);
            } else {
                console.table(data);
            }
        }
    }

    /**
     * 스택 트레이스 출력
     * @param {...any} args - 로그 메시지
     * 
     * @example
     * logger.trace('Function called');
     */
    trace(...args) {
        if (this.shouldLog('DEBUG')) {
            console.trace('[TRACE]', ...args);
        }
    }

    /**
     * Assert 체크 (조건이 false면 에러 로그)
     * @param {boolean} condition - 체크할 조건
     * @param {...any} args - 에러 메시지
     * 
     * @example
     * logger.assert(value > 0, 'Value must be positive');
     */
    assert(condition, ...args) {
        if (this.shouldLog('ERROR')) {
            console.assert(condition, '[ASSERT]', ...args);
        }
    }

    /**
     * 모든 콘솔 로그 지우기
     */
    clear() {
        if (this.config.effectiveConsole) {
            console.clear();
        }
    }

    /**
     * 카운터 (동일 레이블 호출 횟수 카운트)
     * @param {string} [label='default'] - 카운터 레이블
     * 
     * @example
     * logger.count('loop'); // loop: 1
     * logger.count('loop'); // loop: 2
     */
    count(label = 'default') {
        if (this.shouldLog('DEBUG')) {
            console.count(label);
        }
    }

    /**
     * 카운터 리셋
     * @param {string} [label='default'] - 카운터 레이블
     */
    countReset(label = 'default') {
        if (this.shouldLog('DEBUG')) {
            console.countReset(label);
        }
    }
}

/**
 * 기본 Logger 인스턴스 생성
 * 브라우저 환경에서 window.HWPX_VIEWER_CONFIG 사용
 */
let defaultLogger = null;

/**
 * 기본 Logger 인스턴스 가져오기
 * @returns {Logger} Logger 인스턴스
 */
export function getLogger() {
    if (!defaultLogger) {
        // 브라우저 환경에서 전역 설정 확인
        if (typeof window !== 'undefined' && window.HWPX_VIEWER_CONFIG) {
            defaultLogger = new Logger(window.HWPX_VIEWER_CONFIG);
        } else {
            // 기본 설정으로 생성
            defaultLogger = new Logger({
                effectiveLogLevel: 'INFO',
                effectiveConsole: true,
                ENABLE_PERFORMANCE_MONITORING: true
            });
        }
    }
    return defaultLogger;
}

/**
 * Logger 인스턴스 재설정
 * @param {Object} config - 새로운 설정
 */
export function resetLogger(config) {
    defaultLogger = new Logger(config);
}

// 기본 export
export default Logger;

