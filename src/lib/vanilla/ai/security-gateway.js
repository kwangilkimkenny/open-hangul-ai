/**
 * AEGIS Security Gateway
 * AI 보안 래퍼 - 프롬프트 인젝션, PII 보호, 출력 필터링
 *
 * @module ai/security-gateway
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { AIConfig } from '../config/ai-config.js';

const logger = getLogger('SecurityGateway');

let AegisClass = null;
let PiiProxyClass = null;

/**
 * AEGIS SDK 래퍼 - 오프라인 모드로 동작
 */
export class SecurityGateway {
  constructor() {
    this.aegis = null;
    this.piiProxy = null;
    this._ready = false;
    this._initPromise = this._initialize();
  }

  async _initialize() {
    try {
      const sdk = await import('@aegis-sdk');
      AegisClass = sdk.Aegis;
      PiiProxyClass = sdk.PiiProxyEngine;

      const config = AIConfig.security.aegis.getConfig();
      this.aegis = new AegisClass(config);
      this.piiProxy = new PiiProxyClass();
      this._ready = true;
      logger.info('AEGIS SecurityGateway initialized (offline mode)');
    } catch (error) {
      // Expected on the OSS build — proprietary AEGIS SDK is not bundled.
      // Downgraded from error to info so dev consoles aren't alarmed.
      logger.info('AEGIS SDK unavailable, security features running in no-op mode:', error.message);
      this._ready = false;
    }
  }

  async ensureReady() {
    if (!this._ready) await this._initPromise;
    return this._ready;
  }

  isEnabled() {
    return AIConfig.security.aegis.isEnabled();
  }

  setEnabled(enabled) {
    AIConfig.security.aegis.setEnabled(enabled);
  }

  /**
   * 입력 보안 스캔
   * @param {string} text - 사용자 입력 텍스트
   * @returns {{ allowed: boolean, score: number, reason: string, categories: string[], scanResult: object }}
   */
  scanInput(text) {
    if (!this._ready || !this.aegis) {
      return { allowed: true, score: 0, reason: '', categories: [], scanResult: null };
    }

    try {
      const result = this.aegis.scan(text);
      return {
        allowed: !result.blocked,
        score: result.score,
        reason: result.explanation || '',
        categories: result.categories || [],
        scanResult: result,
      };
    } catch (error) {
      logger.error('AEGIS input scan error:', error);
      return { allowed: true, score: 0, reason: '', categories: [], scanResult: null };
    }
  }

  /**
   * 출력 필터링
   * @param {string} text - AI 생성 텍스트
   * @returns {{ safe: boolean, filtered: string, detections: string[] }}
   */
  filterOutput(text) {
    if (!this._ready || !this.aegis) {
      return { safe: true, filtered: text, detections: [] };
    }

    try {
      const result = this.aegis.scanOutput(text);
      return {
        safe: result.safe,
        filtered: result.filtered || text,
        detections: result.detections?.map(d => d.type || d) || [],
      };
    } catch (error) {
      logger.error('AEGIS output filter error:', error);
      return { safe: true, filtered: text, detections: [] };
    }
  }

  /**
   * PII 가명화
   * @param {string} text - 원본 텍스트
   * @returns {{ pseudonymized: string, sessionId: string, changed: boolean }}
   */
  pseudonymize(text) {
    if (!this._ready || !this.piiProxy) {
      return { pseudonymized: text, sessionId: null, changed: false };
    }

    try {
      const sessionId = `session_${Date.now()}`;
      const result = this.piiProxy.pseudonymize(text, { enabled: true, mode: 'auto' }, sessionId);
      return {
        pseudonymized: result.proxiedText ?? text,
        sessionId,
        changed: (result.proxiedText ?? text) !== text,
      };
    } catch (error) {
      logger.error('AEGIS PII pseudonymize error:', error);
      return { pseudonymized: text, sessionId: null, changed: false };
    }
  }

  /**
   * PII 복원
   * @param {string} text - 가명화된 텍스트
   * @param {string} sessionId - 세션 ID
   * @returns {string} 복원된 텍스트
   */
  restore(text, sessionId) {
    if (!this._ready || !this.piiProxy || !sessionId) {
      return text;
    }

    try {
      return this.piiProxy.restore(text, sessionId);
    } catch (error) {
      logger.error('AEGIS PII restore error:', error);
      return text;
    }
  }
}
