/**
 * Error Boundary Utility
 * ✅ Phase 5: Production-ready error handling
 * Prevents renderer crashes from causing whitespace-of-death
 *
 * @module utils/error-boundary
 * @version 1.0.0
 */

import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * Wrap a function with error boundary
 * ✅ Phase 5: Catch and log errors without crashing the app
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context name for error logging
 * @param {*} fallbackValue - Value to return on error
 * @returns {Function} Wrapped function
 */
export function withErrorBoundary(fn, context = 'Unknown', fallbackValue = null) {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            logger.error(`❌ Error in ${context}:`, error);
            logger.error(`   Stack: ${error.stack}`);

            // Optionally send to error tracking service
            if (typeof window !== 'undefined' && window.errorTracker) {
                window.errorTracker.captureException(error, {
                    context,
                    args: args.map(arg => {
                        try {
                            return JSON.stringify(arg);
                        } catch {
                            return String(arg);
                        }
                    })
                });
            }

            return fallbackValue;
        }
    };
}

/**
 * Async error boundary wrapper
 * ✅ Phase 5: Handle async errors
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context name for error logging
 * @param {*} fallbackValue - Value to return on error
 * @returns {Function} Wrapped async function
 */
export function withAsyncErrorBoundary(fn, context = 'Unknown', fallbackValue = null) {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            logger.error(`❌ Async error in ${context}:`, error);
            logger.error(`   Stack: ${error.stack}`);

            // Optionally send to error tracking service
            if (typeof window !== 'undefined' && window.errorTracker) {
                window.errorTracker.captureException(error, {
                    context,
                    args: args.map(arg => {
                        try {
                            return JSON.stringify(arg);
                        } catch {
                            return String(arg);
                        }
                    })
                });
            }

            return fallbackValue;
        }
    };
}

/**
 * Safe DOM operation wrapper
 * ✅ Phase 5: Prevent DOM crashes
 * @param {Function} fn - DOM operation function
 * @param {string} operation - Operation name
 * @returns {*} Result or null on error
 */
export function safeDOMOperation(fn, operation = 'DOM operation') {
    try {
        return fn();
    } catch (error) {
        logger.warn(`⚠️ Safe DOM operation failed (${operation}):`, error.message);
        return null;
    }
}

/**
 * Global error handler setup
 * ✅ Phase 5: Catch unhandled errors
 */
export function setupGlobalErrorHandler() {
    if (typeof window === 'undefined') return;

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
        logger.error('❌ Unhandled error:', event.error);
        logger.error(`   Message: ${event.message}`);
        logger.error(`   File: ${event.filename}:${event.lineno}:${event.colno}`);

        // Prevent default error display
        event.preventDefault();

        // Show user-friendly message
        showErrorMessage('An unexpected error occurred. Please try refreshing the page.');
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        logger.error('❌ Unhandled promise rejection:', event.reason);

        // Prevent default
        event.preventDefault();

        // Show user-friendly message
        showErrorMessage('An operation failed. Please try again.');
    });

    logger.info('✅ Global error handlers installed');
}

/**
 * Show user-friendly error message
 * ✅ Phase 5: Better UX for errors
 * @param {string} message - Error message to show
 */
function showErrorMessage(message) {
    // Check if a custom error display function exists
    if (typeof window !== 'undefined' && window.showErrorToast) {
        window.showErrorToast(message);
        return;
    }

    // Fallback to console
    console.error('🚨', message);
}

/**
 * Create error boundary for class methods
 * ✅ Phase 5: Decorator-style error boundary
 * @param {Object} instance - Class instance
 * @param {string[]} methods - Method names to wrap
 * @param {string} className - Class name for logging
 */
export function createMethodErrorBoundaries(instance, methods, className) {
    methods.forEach(methodName => {
        const original = instance[methodName];
        if (typeof original !== 'function') {
            logger.warn(`⚠️ Method ${methodName} not found on ${className}`);
            return;
        }

        instance[methodName] = withErrorBoundary(
            original.bind(instance),
            `${className}.${methodName}`,
            null
        );
    });

    logger.debug(`✅ Error boundaries added to ${methods.length} methods in ${className}`);
}

/**
 * Retry a function with exponential backoff
 * ✅ Phase 5: Resilient operations
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} baseDelay - Base delay in ms
 * @param {string} context - Context for logging
 * @returns {Promise<*>} Result or throws after max retries
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 100, context = 'Operation') {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                logger.warn(`⚠️ ${context} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    logger.error(`❌ ${context} failed after ${maxRetries} attempts:`, lastError);
    throw lastError;
}

/**
 * Circuit breaker pattern
 * ✅ Phase 5: Prevent cascading failures
 */
export class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000, context = 'Circuit') {
        this.threshold = threshold;      // Failures before opening circuit
        this.timeout = timeout;          // Time before trying again (ms)
        this.failures = 0;
        this.state = 'CLOSED';           // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = Date.now();
        this.context = context;
    }

    async execute(fn) {
        // Check if circuit is open
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error(`Circuit breaker is OPEN for ${this.context}`);
            }
            // Try half-open
            this.state = 'HALF_OPEN';
            logger.info(`🔄 Circuit breaker ${this.context}: OPEN → HALF_OPEN`);
        }

        try {
            const result = await fn();

            // Success - close circuit
            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.failures = 0;
                logger.info(`✅ Circuit breaker ${this.context}: HALF_OPEN → CLOSED`);
            }

            return result;

        } catch (error) {
            this.failures++;

            if (this.failures >= this.threshold) {
                this.state = 'OPEN';
                this.nextAttempt = Date.now() + this.timeout;
                logger.error(`❌ Circuit breaker ${this.context}: CLOSED → OPEN (${this.failures} failures)`);
            }

            throw error;
        }
    }

    reset() {
        this.failures = 0;
        this.state = 'CLOSED';
        logger.info(`🔄 Circuit breaker ${this.context} reset`);
    }
}

export default {
    withErrorBoundary,
    withAsyncErrorBoundary,
    safeDOMOperation,
    setupGlobalErrorHandler,
    createMethodErrorBoundaries,
    retryWithBackoff,
    CircuitBreaker
};
