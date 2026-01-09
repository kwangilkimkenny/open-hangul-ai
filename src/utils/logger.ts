/**
 * Development Logger Utility
 * 개발 환경에서만 로그를 출력하는 유틸리티
 *
 * @module utils/logger
 * @version 1.0.0
 */

/**
 * 개발 모드 확인
 */
const isDevelopment = import.meta.env.DEV;

/**
 * 개발 환경 전용 console.log
 */
export const devLog = (...args: any[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

/**
 * 개발 환경 전용 console.info
 */
export const devInfo = (...args: any[]) => {
  if (isDevelopment) {
    console.info(...args);
  }
};

/**
 * 개발 환경 전용 console.warn
 */
export const devWarn = (...args: any[]) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

/**
 * 에러는 항상 출력 (프로덕션에서도)
 */
export const devError = (...args: any[]) => {
  console.error(...args);
};

/**
 * 개발 환경 전용 console.debug
 */
export const devDebug = (...args: any[]) => {
  if (isDevelopment) {
    console.debug(...args);
  }
};

/**
 * Logger 객체 (Vanilla JS logger와 호환)
 */
export const logger = {
  log: devLog,
  info: devInfo,
  warn: devWarn,
  error: devError,
  debug: devDebug,
};

export default logger;
