/**
 * TruthAnchor (HalluGuard) Hybrid Client
 *
 * 온라인(서버 4레이어) + 오프라인(가드레일+수치+유사도) 하이브리드 검증.
 *
 * @module ai/truthanchor-client
 * @version 5.0.0
 */

import { getLogger } from '../utils/logger.js';
import { AIConfig } from '../config/ai-config.js';

const logger = getLogger('TruthAnchorClient');

/**
 * TruthAnchor 하이브리드 클라이언트
 * - 서버 가용 시: POST /api/v2/validate (온라인 4레이어)
 * - 서버 불가 시: 오프라인 JS 엔진 (가드레일+수치+근거매칭) 자동 전환
 */
export class TruthAnchorClient {
  constructor() {
    this._available = null; // null = 미확인, true/false = 확인됨
    this._healthCheckPromise = null;
    this._offlineEngine = null; // lazy loaded
    this._lastHealthCheck = 0; // 마지막 헬스체크 시각 (ms)
  }

  isEnabled() {
    return AIConfig.security.truthAnchor.isEnabled();
  }

  setEnabled(enabled) {
    AIConfig.security.truthAnchor.setEnabled(enabled);
    if (enabled) {
      this._available = null;
      this.checkHealth(true);
    }
  }

  /**
   * 현재 동작 모드 반환
   * @returns {'online' | 'offline' | 'disabled'}
   */
  getMode() {
    if (!this.isEnabled()) return 'disabled';
    return this._available ? 'online' : 'offline';
  }

  /**
   * 서버 상태 확인
   */
  async checkHealth(force = false) {
    if (this._healthCheckPromise) return this._healthCheckPromise;

    // 이미 오프라인 판별 후 60초 이내면 재시도 안 함 (500 에러 감소)
    if (!force && this._available === false) {
      const elapsed = Date.now() - this._lastHealthCheck;
      if (elapsed < 60_000) {
        return { available: false, mode: 'offline' };
      }
    }

    this._healthCheckPromise = (async () => {
      try {
        const response = await fetch('/health', {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        this._lastHealthCheck = Date.now();
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          // Vite proxy stub은 200 + {available:false}를 반환하므로 본문도 확인
          if (data && data.available === false) {
            this._available = false;
            logger.info('TruthAnchor server not available, using offline mode');
            return { available: false, mode: 'offline' };
          }
          this._available = true;
          logger.info('TruthAnchor server available (online mode)');
          return { available: true, mode: 'online', version: data.version || 'unknown' };
        }
        this._available = false;
        logger.info('TruthAnchor server not available, using offline mode');
        return { available: false, mode: 'offline' };
      } catch (error) {
        this._available = false;
        this._lastHealthCheck = Date.now();
        logger.info('TruthAnchor offline mode (server unreachable)');
        return { available: false, mode: 'offline' };
      } finally {
        this._healthCheckPromise = null;
      }
    })();

    return this._healthCheckPromise;
  }

  /**
   * AI 생성 텍스트를 원본 문서와 대조 검증 (하이브리드)
   * - 서버 가용: 온라인 전체 4레이어 파이프라인
   * - 서버 불가: 오프라인 가드레일+수치+유사도 검증
   */
  async validate(sourceText, llmOutput, domain) {
    const effectiveDomain = domain || AIConfig.security.truthAnchor.getDomain();

    // 서버 상태 미확인이면 먼저 체크
    if (this._available === null) {
      await this.checkHealth();
    }

    // 온라인 모드 시도
    if (this._available) {
      const onlineResult = await this._validateOnline(sourceText, llmOutput, effectiveDomain);
      if (onlineResult.available) {
        onlineResult.mode = 'online';
        return onlineResult;
      }
      // 온라인 실패 → 오프라인 폴백
      this._available = false;
      logger.info('Online validation failed, falling back to offline');
    }

    // 오프라인 검증
    return this._validateOffline(sourceText, llmOutput, effectiveDomain);
  }

  /**
   * 온라인 검증 (기존 서버 API)
   * @private
   */
  async _validateOnline(sourceText, llmOutput, domain) {
    try {
      const response = await fetch('/api/v2/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_text: sourceText,
          llm_output: llmOutput,
          domain: domain,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return { available: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      this._available = true;

      return {
        available: true,
        mode: 'online',
        overallScore: data.overall_score,
        totalClaims: data.total_claims,
        supportedClaims: data.supported_claims,
        contradictedClaims: data.contradicted_claims,
        neutralClaims: data.neutral_claims,
        claims: (data.claims || []).map(c => ({
          text: c.claim_text,
          verdict: c.verdict,
          confidence: c.confidence,
          evidence: c.evidence_text,
          correction: c.suggested_correction,
          order: c.claim_order,
        })),
        multiScores: data.multi_scores || {},
        correctedText: data.corrected_text || '',
        elapsedMs: data.elapsed_ms || 0,
      };
    } catch (error) {
      this._available = false;
      return { available: false, error: error.message };
    }
  }

  /**
   * 오프라인 검증 (JS 엔진)
   * @private
   */
  async _validateOffline(sourceText, llmOutput, domain) {
    try {
      // lazy load 오프라인 엔진
      if (!this._offlineEngine) {
        this._offlineEngine = await import('./truthanchor-offline.js');
        logger.info('TruthAnchor offline engine loaded');
      }

      const result = this._offlineEngine.validateOffline(sourceText, llmOutput, domain);
      return result; // 이미 mode: 'offline' 포함
    } catch (error) {
      logger.error('Offline validation failed:', error.message);
      return {
        available: false,
        mode: 'offline',
        error: 'Offline engine error: ' + error.message,
      };
    }
  }
}
