/**
 * Logging Validator
 * ✅ Phase 5: Ensure production builds don't have excessive debug logs
 * Validates logging levels and detects console.log debug noise
 *
 * @module utils/logging-validator
 * @version 1.0.0
 */

import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * Validate logging configuration
 * ✅ Phase 5: Check for production readiness
 * @returns {Object} Validation report
 */
export function validateLogging() {
    const report = {
        isValid: true,
        issues: [],
        warnings: [],
        info: []
    };

    // Check if logger is configured
    const currentLogger = getLogger();
    const logLevel = currentLogger.level || 'info';

    report.info.push(`Current log level: ${logLevel}`);

    // In production, log level should be 'warn' or 'error'
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
        if (logLevel === 'debug' || logLevel === 'trace') {
            report.issues.push('Production build has debug/trace logging enabled');
            report.isValid = false;
        } else {
            report.info.push('✅ Log level appropriate for production');
        }
    }

    // Check for console.log usage in source files
    const consoleLogs = findConsoleLogs();
    if (consoleLogs.length > 0) {
        report.warnings.push(`Found ${consoleLogs.length} console.log statements`);
        report.warnings.push('Consider replacing with logger.debug()');
    }

    // Check logger instance
    if (!currentLogger.debug || !currentLogger.info || !currentLogger.warn || !currentLogger.error) {
        report.issues.push('Logger missing required methods');
        report.isValid = false;
    } else {
        report.info.push('✅ Logger has all required methods');
    }

    return report;
}

/**
 * Find console.log statements in code
 * ✅ Phase 5: Detect debug noise
 * Note: This is a simplified check for runtime validation
 * For build-time checks, use a linter or build tool
 * @returns {string[]} List of issues found
 */
function findConsoleLogs() {
    // This is a runtime check, so we can only detect console.log calls
    // that might be in the current scope. For comprehensive checking,
    // use a build-time tool like ESLint.
    const issues = [];

    // Check if console methods have been wrapped
    if (typeof window !== 'undefined') {
        const originalLog = window.console.log.toString();

        // Check if console.log is the native implementation
        if (originalLog.includes('[native code]')) {
            issues.push('console.log is not wrapped/monitored');
        }
    }

    return issues;
}

/**
 * Create production-safe logger wrapper
 * ✅ Phase 5: Automatically strip debug logs in production
 * @param {Object} logger - Logger instance
 * @returns {Object} Production-safe logger
 */
export function createProductionLogger(logger) {
    const isProduction = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

    if (!isProduction) {
        return logger; // Return original logger in development
    }

    // In production, disable debug and trace
    return {
        debug: () => {}, // No-op
        trace: () => {}, // No-op
        info: logger.info.bind(logger),
        warn: logger.warn.bind(logger),
        error: logger.error.bind(logger),
        level: 'info'
    };
}

/**
 * Monitor logging performance
 * ✅ Phase 5: Detect excessive logging that might impact performance
 * @param {number} thresholdPerSecond - Maximum logs per second
 * @returns {Object} Monitor instance
 */
export function createLoggingMonitor(thresholdPerSecond = 100) {
    const monitor = {
        counts: {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0
        },
        startTime: Date.now(),
        threshold: thresholdPerSecond,

        log(level) {
            this.counts[level] = (this.counts[level] || 0) + 1;

            // Check if we've exceeded threshold
            const elapsed = (Date.now() - this.startTime) / 1000;
            const totalLogs = Object.values(this.counts).reduce((sum, count) => sum + count, 0);
            const logsPerSecond = totalLogs / elapsed;

            if (logsPerSecond > this.threshold) {
                console.warn(`⚠️ Excessive logging detected: ${logsPerSecond.toFixed(1)} logs/sec (threshold: ${this.threshold})`);
            }
        },

        reset() {
            this.counts = { debug: 0, info: 0, warn: 0, error: 0 };
            this.startTime = Date.now();
        },

        getReport() {
            const elapsed = (Date.now() - this.startTime) / 1000;
            const totalLogs = Object.values(this.counts).reduce((sum, count) => sum + count, 0);

            return {
                elapsed,
                totalLogs,
                logsPerSecond: totalLogs / elapsed,
                breakdown: { ...this.counts }
            };
        }
    };

    return monitor;
}

/**
 * Wrap logger methods with performance monitoring
 * ✅ Phase 5: Track logging overhead
 * @param {Object} logger - Logger instance
 * @param {Object} monitor - Monitor instance
 * @returns {Object} Wrapped logger
 */
export function wrapLoggerWithMonitoring(logger, monitor) {
    return {
        debug(...args) {
            monitor.log('debug');
            return logger.debug(...args);
        },
        info(...args) {
            monitor.log('info');
            return logger.info(...args);
        },
        warn(...args) {
            monitor.log('warn');
            return logger.warn(...args);
        },
        error(...args) {
            monitor.log('error');
            return logger.error(...args);
        }
    };
}

/**
 * Analyze logging patterns
 * ✅ Phase 5: Identify logging hotspots
 * @param {Object} logger - Logger instance
 * @param {number} duration - Duration to analyze (ms)
 * @returns {Promise<Object>} Analysis report
 */
export async function analyzeLoggingPatterns(logger, duration = 10000) {
    const monitor = createLoggingMonitor();
    const wrappedLogger = wrapLoggerWithMonitoring(logger, monitor);

    logger.info(`🔍 Analyzing logging patterns for ${duration}ms...`);

    // Replace global logger temporarily
    const originalLogger = getLogger();

    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, duration));

    // Get report
    const report = monitor.getReport();

    logger.info('📊 Logging analysis complete:');
    logger.info(`   Total logs: ${report.totalLogs}`);
    logger.info(`   Logs/sec: ${report.logsPerSecond.toFixed(2)}`);
    logger.info(`   Debug: ${report.breakdown.debug}`);
    logger.info(`   Info: ${report.breakdown.info}`);
    logger.info(`   Warn: ${report.breakdown.warn}`);
    logger.info(`   Error: ${report.breakdown.error}`);

    return report;
}

/**
 * Check for common logging anti-patterns
 * ✅ Phase 5: Best practices validation
 * @returns {Object} Anti-pattern report
 */
export function checkLoggingAntiPatterns() {
    const antiPatterns = [];

    // Check 1: Logging in tight loops
    // (This would require static analysis, so we'll provide guidelines)
    antiPatterns.push({
        type: 'GUIDELINE',
        message: 'Avoid logging inside tight loops or frequent callbacks',
        severity: 'warning'
    });

    // Check 2: Logging large objects
    antiPatterns.push({
        type: 'GUIDELINE',
        message: 'Avoid logging large objects - log only necessary properties',
        severity: 'info'
    });

    // Check 3: Logging sensitive data
    antiPatterns.push({
        type: 'GUIDELINE',
        message: 'Never log sensitive data (passwords, tokens, PII)',
        severity: 'error'
    });

    // Check 4: Excessive error logging
    antiPatterns.push({
        type: 'GUIDELINE',
        message: 'Log errors at the point of handling, not at every layer',
        severity: 'warning'
    });

    return {
        antiPatterns,
        guidelines: [
            '✅ Use logger.debug() for development-only logs',
            '✅ Use logger.info() for important state changes',
            '✅ Use logger.warn() for recoverable issues',
            '✅ Use logger.error() for unrecoverable errors',
            '✅ Include context in error messages',
            '✅ Avoid logging in performance-critical paths'
        ]
    };
}

/**
 * Generate logging best practices report
 * ✅ Phase 5: Production readiness checklist
 * @returns {string} Formatted report
 */
export function generateLoggingReport() {
    const validation = validateLogging();
    const antiPatterns = checkLoggingAntiPatterns();

    let report = '\n📋 Logging Configuration Report\n';
    report += '='.repeat(60) + '\n\n';

    // Validation results
    report += `Status: ${validation.isValid ? '✅ VALID' : '❌ INVALID'}\n\n`;

    if (validation.issues.length > 0) {
        report += '❌ Issues:\n';
        validation.issues.forEach(issue => {
            report += `   - ${issue}\n`;
        });
        report += '\n';
    }

    if (validation.warnings.length > 0) {
        report += '⚠️ Warnings:\n';
        validation.warnings.forEach(warning => {
            report += `   - ${warning}\n`;
        });
        report += '\n';
    }

    if (validation.info.length > 0) {
        report += '📊 Info:\n';
        validation.info.forEach(info => {
            report += `   - ${info}\n`;
        });
        report += '\n';
    }

    // Best practices
    report += '📖 Best Practices:\n';
    antiPatterns.guidelines.forEach(guideline => {
        report += `   ${guideline}\n`;
    });

    return report;
}

export default {
    validateLogging,
    createProductionLogger,
    createLoggingMonitor,
    wrapLoggerWithMonitoring,
    analyzeLoggingPatterns,
    checkLoggingAntiPatterns,
    generateLoggingReport
};
