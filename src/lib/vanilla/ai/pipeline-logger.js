/**
 * AI Pipeline Logger
 * AI 채팅 파이프라인의 각 단계를 추적하는 구조화된 로깅 시스템
 *
 * @module ai/pipeline-logger
 * @version 1.0.0
 */

const LOG_STORAGE_KEY = 'ai_pipeline_logs';
const MAX_SESSIONS = 50;

/**
 * 파이프라인 로그 항목
 * @typedef {Object} PipelineLogEntry
 * @property {string} sessionId - 세션 ID
 * @property {string} step - 파이프라인 단계
 * @property {string} status - 'start' | 'success' | 'error' | 'warn' | 'info'
 * @property {string} message - 로그 메시지
 * @property {Object} [data] - 추가 데이터
 * @property {number} timestamp - 타임스탬프
 * @property {number} [duration] - 소요 시간 (ms)
 */

class PipelineLogger {
  constructor() {
    this._sessions = [];
    this._currentSession = null;
    this._timers = {};
  }

  /**
   * 새 세션 시작 (사용자 요청 1회 = 1 세션)
   * @param {string} type - 'edit' | 'free_chat' | 'create_doc' | 'multi_page' | 'assistant_action'
   * @param {string} userMessage - 사용자 메시지
   * @returns {string} sessionId
   */
  startSession(type, userMessage) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this._currentSession = {
      id: sessionId,
      type,
      userMessage: userMessage.substring(0, 200),
      startTime: Date.now(),
      entries: [],
      result: null,
    };
    this._timers = {};
    this.log('session', 'start', `[${type}] "${userMessage.substring(0, 80)}"`);
    return sessionId;
  }

  /**
   * 세션 종료
   * @param {'success' | 'error'} result
   * @param {Object} [summary] - 결과 요약
   */
  endSession(result, summary = {}) {
    if (!this._currentSession) return;
    const duration = Date.now() - this._currentSession.startTime;
    this._currentSession.result = result;
    this._currentSession.duration = duration;
    this._currentSession.summary = summary;
    this.log('session', result, `Completed in ${duration}ms`, summary);

    // 저장
    this._sessions.push({ ...this._currentSession });
    if (this._sessions.length > MAX_SESSIONS) {
      this._sessions = this._sessions.slice(-MAX_SESSIONS);
    }
    this._persistToStorage();

    // 콘솔에 세션 요약 출력
    this._printSessionSummary();

    this._currentSession = null;
  }

  /**
   * 파이프라인 단계 로그
   * @param {string} step - 단계명 (e.g., 'extract', 'generate', 'merge', 'render')
   * @param {'start' | 'success' | 'error' | 'warn' | 'info'} status
   * @param {string} message
   * @param {Object} [data]
   */
  log(step, status, message, data = null) {
    const entry = {
      step,
      status,
      message,
      data: data ? this._safeSerialize(data) : null,
      timestamp: Date.now(),
      elapsed: this._currentSession ? Date.now() - this._currentSession.startTime : 0,
    };

    if (this._currentSession) {
      this._currentSession.entries.push(entry);
    }

    // 콘솔 출력 (컬러 코딩)
    const prefix = this._getPrefix(step, status);
    const elapsed = entry.elapsed ? ` +${entry.elapsed}ms` : '';
    if (status === 'error') {
      console.error(`${prefix} ${message}${elapsed}`, data || '');
    } else if (status === 'warn') {
      console.warn(`${prefix} ${message}${elapsed}`, data || '');
    } else {
      console.log(`${prefix} ${message}${elapsed}`, data || '');
    }
  }

  /**
   * 타이머 시작
   * @param {string} label
   */
  timeStart(label) {
    this._timers[label] = Date.now();
  }

  /**
   * 타이머 종료 및 로그
   * @param {string} label
   * @param {string} [step]
   * @returns {number} duration in ms
   */
  timeEnd(label, step = 'perf') {
    const start = this._timers[label];
    if (!start) return 0;
    const duration = Date.now() - start;
    delete this._timers[label];
    this.log(step, 'info', `${label}: ${duration}ms`, { duration });
    return duration;
  }

  /**
   * 저장된 모든 세션 로그 조회
   * @returns {Array}
   */
  getSessions() {
    return [...this._sessions];
  }

  /**
   * 마지막 N개 세션 조회
   * @param {number} count
   * @returns {Array}
   */
  getRecentSessions(count = 10) {
    return this._sessions.slice(-count);
  }

  /**
   * 전체 로그 분석 보고서 생성
   * @returns {Object}
   */
  generateReport() {
    const sessions = this._sessions;
    if (sessions.length === 0) return { message: 'No sessions recorded' };

    const successful = sessions.filter(s => s.result === 'success');
    const failed = sessions.filter(s => s.result === 'error');
    const byType = {};
    sessions.forEach(s => {
      byType[s.type] = byType[s.type] || { count: 0, success: 0, fail: 0, totalDuration: 0 };
      byType[s.type].count++;
      if (s.result === 'success') byType[s.type].success++;
      if (s.result === 'error') byType[s.type].fail++;
      byType[s.type].totalDuration += s.duration || 0;
    });

    // 단계별 평균 소요 시간
    const stepDurations = {};
    sessions.forEach(s => {
      (s.entries || []).forEach(e => {
        if (e.data && e.data.duration) {
          stepDurations[e.step] = stepDurations[e.step] || [];
          stepDurations[e.step].push(e.data.duration);
        }
      });
    });
    const stepAvg = {};
    Object.entries(stepDurations).forEach(([step, durations]) => {
      stepAvg[step] = {
        avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        min: Math.min(...durations),
        max: Math.max(...durations),
        count: durations.length,
      };
    });

    // 에러 패턴 분석
    const errorPatterns = {};
    failed.forEach(s => {
      const errEntry = (s.entries || []).find(e => e.status === 'error');
      if (errEntry) {
        const key = `${errEntry.step}: ${errEntry.message.substring(0, 80)}`;
        errorPatterns[key] = (errorPatterns[key] || 0) + 1;
      }
    });

    return {
      totalSessions: sessions.length,
      successRate: `${((successful.length / sessions.length) * 100).toFixed(1)}%`,
      avgDuration: Math.round(sessions.reduce((a, s) => a + (s.duration || 0), 0) / sessions.length),
      byType,
      stepPerformance: stepAvg,
      errorPatterns,
      recentErrors: failed.slice(-5).map(s => ({
        type: s.type,
        message: s.userMessage,
        error: (s.entries || []).find(e => e.status === 'error')?.message,
        time: new Date(s.startTime).toLocaleString(),
      })),
    };
  }

  /**
   * 로그 클리어
   */
  clear() {
    this._sessions = [];
    this._currentSession = null;
    this._clearStorage();
    console.log('[PipelineLogger] All logs cleared');
  }

  /**
   * 콘솔에 보고서 출력
   */
  printReport() {
    const report = this.generateReport();
    console.group('%c[AI Pipeline Report]', 'color: #4CAF50; font-weight: bold; font-size: 14px');
    console.log(`Total Sessions: ${report.totalSessions}`);
    console.log(`Success Rate: ${report.successRate}`);
    console.log(`Avg Duration: ${report.avgDuration}ms`);
    console.log('\nBy Type:');
    console.table(report.byType);
    console.log('\nStep Performance:');
    console.table(report.stepPerformance);
    if (Object.keys(report.errorPatterns).length > 0) {
      console.log('\nError Patterns:');
      console.table(report.errorPatterns);
    }
    if (report.recentErrors.length > 0) {
      console.log('\nRecent Errors:');
      console.table(report.recentErrors);
    }
    console.groupEnd();
    return report;
  }

  // --- Private ---

  _getPrefix(step, status) {
    const icons = {
      session: { start: '[PIPE:SESSION:START]', success: '[PIPE:SESSION:OK]', error: '[PIPE:SESSION:FAIL]' },
      extract: { start: '[PIPE:EXTRACT:START]', success: '[PIPE:EXTRACT:OK]', error: '[PIPE:EXTRACT:FAIL]', info: '[PIPE:EXTRACT]', warn: '[PIPE:EXTRACT:WARN]' },
      generate: { start: '[PIPE:GENERATE:START]', success: '[PIPE:GENERATE:OK]', error: '[PIPE:GENERATE:FAIL]', info: '[PIPE:GENERATE]', warn: '[PIPE:GENERATE:WARN]' },
      api_call: { start: '[PIPE:API:START]', success: '[PIPE:API:OK]', error: '[PIPE:API:FAIL]', info: '[PIPE:API]', warn: '[PIPE:API:WARN]' },
      parse: { start: '[PIPE:PARSE:START]', success: '[PIPE:PARSE:OK]', error: '[PIPE:PARSE:FAIL]', info: '[PIPE:PARSE]' },
      merge: { start: '[PIPE:MERGE:START]', success: '[PIPE:MERGE:OK]', error: '[PIPE:MERGE:FAIL]', info: '[PIPE:MERGE]', warn: '[PIPE:MERGE:WARN]' },
      render: { start: '[PIPE:RENDER:START]', success: '[PIPE:RENDER:OK]', error: '[PIPE:RENDER:FAIL]', info: '[PIPE:RENDER]' },
      perf: { info: '[PIPE:PERF]' },
    };
    return icons[step]?.[status] || `[PIPE:${step.toUpperCase()}:${status.toUpperCase()}]`;
  }

  _safeSerialize(data) {
    try {
      const str = JSON.stringify(data);
      if (str.length > 2000) {
        return JSON.parse(str.substring(0, 2000) + '...(truncated)');
      }
      return JSON.parse(str);
    } catch {
      return { toString: String(data) };
    }
  }

  _persistToStorage() {
    try {
      const data = this._sessions.map(s => ({
        id: s.id,
        type: s.type,
        userMessage: s.userMessage,
        startTime: s.startTime,
        duration: s.duration,
        result: s.result,
        summary: s.summary,
        entryCount: s.entries?.length || 0,
        entries: (s.entries || []).filter(e => e.status === 'error' || e.status === 'warn'),
      }));
      sessionStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage full or unavailable */ }
  }

  _clearStorage() {
    try { sessionStorage.removeItem(LOG_STORAGE_KEY); } catch { /* ignore */ }
  }

  _printSessionSummary() {
    if (!this._currentSession) return;
    const s = this._currentSession;
    const errors = s.entries.filter(e => e.status === 'error');
    const warns = s.entries.filter(e => e.status === 'warn');

    console.group(
      `%c[AI Pipeline] ${s.result === 'success' ? 'SUCCESS' : 'FAILED'} | ${s.type} | ${s.duration}ms`,
      `color: ${s.result === 'success' ? '#4CAF50' : '#F44336'}; font-weight: bold`
    );
    console.log(`Message: "${s.userMessage}"`);
    console.log(`Steps: ${s.entries.length} | Errors: ${errors.length} | Warnings: ${warns.length}`);
    if (s.summary && Object.keys(s.summary).length > 0) {
      console.log('Summary:', s.summary);
    }
    if (errors.length > 0) {
      console.warn('Errors:', errors.map(e => `[${e.step}] ${e.message}`));
    }
    console.groupEnd();
  }
}

// Singleton
export const pipelineLogger = new PipelineLogger();

// window 전역 접근 (개발/디버그용)
if (typeof window !== 'undefined') {
  window.__aiPipelineLogger = pipelineLogger;
}
