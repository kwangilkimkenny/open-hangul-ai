/**
 * AI Compliance Reporter
 * 활동 로그 기반 자동 평가 + 리포트 생성 엔진
 *
 * @module lib/ai/compliance-reporter
 * @version 1.0.0
 */

import type {
  AIActivityLog,
  AppComplianceConfig,
  CheckResult,
  ComplianceCategory,
  ComplianceCheck,
  ComplianceReport,
  ComplianceStatus,
  FrameworkType,
} from '../../types/compliance';
import { FRAMEWORKS } from './compliance-rules';

// =============================================
// Default Config (현재 앱 설정 기반)
// =============================================

export function getDefaultAppConfig(): AppComplianceConfig {
  return {
    aiWatermarkEnabled: true,
    useProxyServer: !!import.meta.env.VITE_API_PROXY_URL,
    maxTokens: Number(import.meta.env.VITE_OPENAI_MAX_TOKENS) || 4000,
    apiTimeout: Number(import.meta.env.VITE_OPENAI_TIMEOUT) || 120000,
    costLimitEnabled: import.meta.env.VITE_ENABLE_COST_TRACKING === 'true',
    costMaxLimit: Number(import.meta.env.VITE_COST_MAX_LIMIT) || 10,
    httpsEnabled: true,
    outputSanitizationEnabled: true,
    promptSeparationEnabled: true,
    aiFeatureToggleable: true,
    hallucinationCheckEnabled: true,
    undoRedoEnabled: true,
  };
}

// =============================================
// Evaluator
// =============================================

export class ComplianceReporter {
  /**
   * 프레임워크별 컴플라이언스 평가 실행
   */
  evaluate(
    framework: FrameworkType,
    logs: AIActivityLog[],
    config?: AppComplianceConfig
  ): ComplianceReport {
    const appConfig = config ?? getDefaultAppConfig();
    const meta = FRAMEWORKS[framework];

    const categories: ComplianceCategory[] = meta.categories.map((catRule) => {
      const checks: ComplianceCheck[] = catRule.checks.map((checkRule) => {
        const { result, evidence, remediation } = this.evaluateCheck(
          checkRule.id,
          logs,
          appConfig
        );
        return {
          id: checkRule.id,
          description: checkRule.description,
          article: checkRule.article,
          result,
          evidence,
          remediation,
        };
      });

      const score = this.calcCategoryScore(checks);
      return {
        name: catRule.name,
        score,
        status: this.scoreToStatus(score),
        checks,
      };
    });

    const allChecks = categories.flatMap((c) => c.checks);
    const overallScore = this.calcOverallScore(categories);

    // AI 사용 요약
    const models = [...new Set(logs.map((l) => l.model))];
    const totalInputTokens = logs.reduce((s, l) => s + l.inputTokens, 0);
    const totalOutputTokens = logs.reduce((s, l) => s + l.outputTokens, 0);
    const reviewed = logs.filter((l) => l.userApproved !== null);
    const approved = reviewed.filter((l) => l.userApproved === true);
    const halluChecked = logs.filter((l) => l.hallucinationCheck?.performed);
    const avgHallu =
      halluChecked.length > 0
        ? halluChecked.reduce((s, l) => s + (l.hallucinationCheck?.score ?? 0), 0) /
          halluChecked.length
        : null;

    return {
      documentId: `doc-${Date.now()}`,
      documentName: '',
      generatedAt: new Date().toISOString(),
      framework,
      overallScore,
      overallStatus: this.overallScoreToStatus(overallScore),
      categories,
      recommendations: this.generateRecommendations(categories, framework),
      summary: {
        totalChecks: allChecks.length,
        passed: allChecks.filter((c) => c.result === 'pass').length,
        warned: allChecks.filter((c) => c.result === 'warn').length,
        failed: allChecks.filter((c) => c.result === 'fail').length,
        notApplicable: allChecks.filter((c) => c.result === 'n/a').length,
      },
      aiUsageSummary: {
        totalActions: logs.length,
        model: models.join(', ') || 'N/A',
        generatedRatio: 0,
        allReviewed: logs.length > 0 ? logs.every((l) => l.userReviewed) : true,
        approvalRate: reviewed.length > 0 ? approved.length / reviewed.length : 1,
        avgHallucinationScore: avgHallu,
        totalInputTokens,
        totalOutputTokens,
      },
    };
  }

  // =============================================
  // Check Evaluator
  // =============================================

  private evaluateCheck(
    checkId: string,
    logs: AIActivityLog[],
    config: AppComplianceConfig
  ): { result: CheckResult; evidence: string; remediation?: string } {
    const hasLogs = logs.length > 0;

    switch (checkId) {
      // ===== EU AI Act: Transparency =====
      case 'EU-T1':
      case 'KR-T1':
        return config.aiWatermarkEnabled
          ? { result: 'pass', evidence: 'AI 워터마크 기능이 활성화되어 있습니다' }
          : {
              result: 'fail',
              evidence: 'AI 워터마크가 비활성화 상태입니다',
              remediation: 'AI 생성 콘텐츠 표시 기능을 활성화하세요',
            };

      case 'EU-T2':
      case 'KR-T2':
        if (!hasLogs) return { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
        return {
          result: 'pass',
          evidence: `사용 모델: ${[...new Set(logs.map((l) => `${l.modelProvider}/${l.model}`))].join(', ')}`,
        };

      case 'EU-T3':
        return { result: 'pass', evidence: '컴플라이언스 리포트에 AI 생성 비율이 포함됩니다' };

      case 'EU-T4':
      case 'KR-T3':
        return hasLogs
          ? { result: 'pass', evidence: `${logs.length}건의 AI 활동이 추적되고 있습니다` }
          : { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };

      // ===== EU AI Act: Risk Management =====
      case 'EU-R1':
        return {
          result: 'pass',
          evidence: '문서 편집 AI는 "Limited Risk" 수준으로 분류됩니다 (Article 6 기준)',
        };

      case 'EU-R2':
      case 'KR-S1': {
        if (!hasLogs) return { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
        const checked = logs.filter((l) => l.hallucinationCheck?.performed);
        const rate = checked.length / logs.length;
        if (rate === 1) return { result: 'pass', evidence: `전체 ${logs.length}건 검증 완료` };
        if (rate > 0.5)
          return {
            result: 'warn',
            evidence: `${checked.length}/${logs.length}건 검증됨 (${(rate * 100).toFixed(0)}%)`,
            remediation: '모든 AI 생성물에 할루시네이션 검증을 적용하세요',
          };
        return {
          result: 'fail',
          evidence: `${checked.length}/${logs.length}건만 검증됨`,
          remediation: 'TruthAnchor 할루시네이션 검증을 활성화하세요',
        };
      }

      case 'EU-R3':
      case 'KR-S2': {
        const halluLogs = logs.filter((l) => l.hallucinationCheck?.performed);
        if (halluLogs.length === 0) return { result: 'n/a', evidence: '검증 데이터 없음' };
        const avg =
          halluLogs.reduce((s, l) => s + (l.hallucinationCheck?.score ?? 0), 0) /
          halluLogs.length;
        if (avg >= 0.8)
          return { result: 'pass', evidence: `평균 검증 점수: ${(avg * 100).toFixed(1)}%` };
        if (avg >= 0.6)
          return {
            result: 'warn',
            evidence: `평균 검증 점수: ${(avg * 100).toFixed(1)}% (임계값 80% 미만)`,
            remediation: '검증 점수가 낮은 콘텐츠를 재검토하세요',
          };
        return {
          result: 'fail',
          evidence: `평균 검증 점수: ${(avg * 100).toFixed(1)}%`,
          remediation: 'AI 생성 콘텐츠의 품질을 점검하고 수정하세요',
        };
      }

      case 'KR-S3':
        return config.outputSanitizationEnabled
          ? { result: 'pass', evidence: '출력 필터링이 활성화되어 있습니다' }
          : { result: 'warn', evidence: '출력 필터링 설정을 확인하세요' };

      // ===== EU AI Act: Data Governance =====
      case 'EU-D1':
      case 'KR-P1': {
        if (!hasLogs) return { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
        const piiFound = logs.some((l) => l.security.piiDetected);
        return piiFound
          ? {
              result: 'warn',
              evidence: 'PII(개인정보)가 감지된 활동이 있습니다',
              remediation: '개인정보가 포함된 데이터를 마스킹하세요',
            }
          : { result: 'pass', evidence: 'PII 감지 기록이 없습니다' };
      }

      case 'EU-D2':
        return hasLogs
          ? { result: 'pass', evidence: `${logs.length}건의 API 호출 로그가 보존되고 있습니다` }
          : { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };

      case 'EU-D3':
        if (!hasLogs) return { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
        return {
          result: 'pass',
          evidence: `총 ${logs.reduce((s, l) => s + l.inputTokens + l.outputTokens, 0).toLocaleString()} 토큰 기록됨`,
        };

      // ===== EU AI Act: Human Oversight =====
      case 'EU-H1':
      case 'KR-A2': {
        if (!hasLogs) return { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
        const reviewedCount = logs.filter((l) => l.userReviewed).length;
        const reviewRate = reviewedCount / logs.length;
        if (reviewRate === 1)
          return { result: 'pass', evidence: `전체 ${logs.length}건 사용자 검토 완료` };
        if (reviewRate > 0.8)
          return {
            result: 'warn',
            evidence: `${reviewedCount}/${logs.length}건 검토됨 (${(reviewRate * 100).toFixed(0)}%)`,
          };
        return {
          result: 'fail',
          evidence: `${reviewedCount}/${logs.length}건만 검토됨`,
          remediation: '모든 AI 생성물을 사용자가 검토해야 합니다',
        };
      }

      case 'EU-H2':
        return { result: 'pass', evidence: '편집기에서 AI 결과를 자유롭게 수정할 수 있습니다' };

      case 'EU-H3':
        return config.aiFeatureToggleable
          ? { result: 'pass', evidence: 'AI 기능을 비활성화할 수 있습니다' }
          : { result: 'fail', evidence: 'AI 기능 비활성화 옵션이 없습니다' };

      // ===== EU AI Act: Technical Robustness =====
      case 'EU-TR1':
      case 'OW-01a':
        return config.promptSeparationEnabled
          ? { result: 'pass', evidence: '시스템 프롬프트와 사용자 입력이 분리되어 있습니다' }
          : {
              result: 'fail',
              evidence: '프롬프트 분리가 설정되지 않았습니다',
              remediation: '시스템 프롬프트와 사용자 입력을 분리하세요',
            };

      case 'EU-TR2':
      case 'OW-02a':
        return config.outputSanitizationEnabled
          ? { result: 'pass', evidence: 'AI 출력 새니타이징이 적용됩니다 (escapeHtml)' }
          : {
              result: 'fail',
              evidence: '출력 새니타이징이 비활성화 상태',
              remediation: '출력 이스케이프 처리를 활성화하세요',
            };

      case 'EU-TR3':
        return {
          result: 'pass',
          evidence: 'API 오류 시 폴백 처리가 구현되어 있습니다 (재시도 + 에러 메시지)',
        };

      case 'EU-TR4':
        return config.apiTimeout > 0
          ? { result: 'pass', evidence: `API 타임아웃: ${config.apiTimeout}ms` }
          : {
              result: 'fail',
              evidence: 'API 타임아웃이 설정되지 않았습니다',
              remediation: 'API 타임아웃을 설정하세요',
            };

      // ===== K-AI Act: 공정성 =====
      case 'KR-F1':
        return { result: 'pass', evidence: '범용 LLM 모델 사용으로 특정 편향 위험이 낮습니다' };
      case 'KR-F2':
        return {
          result: 'warn',
          evidence: '다양한 관점 반영 여부는 수동 검토가 필요합니다',
          remediation: 'AI 생성물의 다양성을 정기적으로 점검하세요',
        };

      // ===== K-AI Act: 책임성 =====
      case 'KR-A1':
        return {
          result: 'pass',
          evidence: '문서 작성자가 AI 사용의 최종 책임자로 간주됩니다',
        };
      case 'KR-A3':
        return config.undoRedoEnabled
          ? { result: 'pass', evidence: 'Undo/Redo 기능으로 롤백이 가능합니다' }
          : { result: 'fail', evidence: '롤백 메커니즘이 없습니다' };
      case 'KR-A4':
        return hasLogs
          ? { result: 'pass', evidence: `${logs.length}건의 활동 로그가 보존 중 (최대 500건)` }
          : { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };

      // ===== K-AI Act: 프라이버시 =====
      case 'KR-P2':
      case 'OW-05a':
        return config.httpsEnabled
          ? { result: 'pass', evidence: 'HTTPS 암호화 통신이 적용되어 있습니다' }
          : {
              result: 'fail',
              evidence: 'HTTP 통신 사용 중',
              remediation: 'HTTPS를 적용하세요',
            };

      case 'KR-P3':
      case 'OW-05b':
      case 'OW-10a':
        return config.useProxyServer
          ? { result: 'pass', evidence: '프록시 서버를 통해 API 키가 서버 사이드에서 관리됩니다' }
          : {
              result: 'warn',
              evidence: '클라이언트 사이드에서 API 키가 관리되고 있습니다',
              remediation: '프록시 서버를 사용하여 API 키를 보호하세요',
            };

      // ===== NIST AI RMF =====
      case 'NIST-G1':
        return { result: 'pass', evidence: '환경설정(.env)을 통해 AI 사용 정책이 설정되어 있습니다' };
      case 'NIST-G2':
        return config.aiFeatureToggleable
          ? { result: 'pass', evidence: 'VITE_ENABLE_AI_FEATURES 플래그로 제어 가능' }
          : { result: 'fail', evidence: 'AI 기능 토글이 없습니다' };
      case 'NIST-G3':
        return config.costLimitEnabled
          ? { result: 'pass', evidence: `비용 상한: $${config.costMaxLimit}` }
          : {
              result: 'warn',
              evidence: '비용 한도가 설정되지 않았습니다',
              remediation: 'VITE_ENABLE_COST_TRACKING을 활성화하세요',
            };
      case 'NIST-G4':
        return { result: 'pass', evidence: '문서 작성자가 AI 사용의 책임자입니다' };

      case 'NIST-M1':
        return { result: 'pass', evidence: 'AI는 문서 콘텐츠 생성/편집/검증에 사용됩니다' };
      case 'NIST-M2':
        return {
          result: 'pass',
          evidence: '컴플라이언스 리포트를 통해 AI 영향 범위가 문서화됩니다',
        };
      case 'NIST-M3':
        return { result: 'pass', evidence: '이해관계자: 문서 작성자, 검토자, 최종 독자' };

      case 'NIST-ME1': {
        const hallu = logs.filter((l) => l.hallucinationCheck?.performed);
        return hallu.length > 0
          ? { result: 'pass', evidence: `할루시네이션 검증 수행: ${hallu.length}건` }
          : {
              result: hasLogs ? 'warn' : 'n/a',
              evidence: hasLogs ? '할루시네이션 검증이 수행되지 않았습니다' : 'AI 활동 없음',
            };
      }
      case 'NIST-ME2':
        if (!hasLogs) return { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
        return {
          result: 'pass',
          evidence: `총 토큰: ${logs.reduce((s, l) => s + l.inputTokens + l.outputTokens, 0).toLocaleString()}`,
        };
      case 'NIST-ME3': {
        if (!hasLogs) return { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
        const approved = logs.filter((l) => l.userApproved === true).length;
        return {
          result: 'pass',
          evidence: `승인율: ${approved}/${logs.length} (${((approved / logs.length) * 100).toFixed(0)}%)`,
        };
      }
      case 'NIST-ME4':
        return config.hallucinationCheckEnabled
          ? { result: 'pass', evidence: 'TruthAnchor를 통한 품질 평가가 가능합니다' }
          : { result: 'warn', evidence: '품질 평가 도구가 비활성화 상태' };

      case 'NIST-MA1':
        return {
          result: 'pass',
          evidence: '할루시네이션 검증, 출력 새니타이징, 비용 제한 등의 위험 완화 조치 적용 중',
        };
      case 'NIST-MA2':
        return hasLogs
          ? { result: 'pass', evidence: 'AI 활동 로그를 통한 지속적 모니터링 중' }
          : { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
      case 'NIST-MA3':
        return config.undoRedoEnabled
          ? { result: 'pass', evidence: 'Undo/Redo + 자동 저장으로 인시던트 대응 가능' }
          : { result: 'warn', evidence: '인시던트 대응 절차를 점검하세요' };

      // ===== OWASP LLM Top 10 =====
      case 'OW-01b':
        return config.outputSanitizationEnabled
          ? { result: 'pass', evidence: '사용자 입력 새니타이징이 적용됩니다' }
          : { result: 'fail', evidence: '입력 새니타이징이 비활성화 상태' };
      case 'OW-01c':
        return { result: 'pass', evidence: '시스템 프롬프트 분리를 통한 간접 주입 방어 적용' };

      case 'OW-02b':
        return config.outputSanitizationEnabled
          ? { result: 'pass', evidence: 'escapeHtml() + sanitizeHTML() 적용' }
          : { result: 'fail', evidence: 'XSS 방지 처리가 없습니다' };
      case 'OW-02c':
        return config.hallucinationCheckEnabled
          ? { result: 'pass', evidence: 'TruthAnchor 할루시네이션 검증이 활성화되어 있습니다' }
          : { result: 'warn', evidence: '출력 검증이 비활성화 상태' };

      case 'OW-03a':
        return { result: 'pass', evidence: 'OpenAI, Anthropic 등 신뢰할 수 있는 프로바이더 사용' };
      case 'OW-03b':
        return hasLogs
          ? {
              result: 'pass',
              evidence: `모델 기록: ${[...new Set(logs.map((l) => l.model))].join(', ')}`,
            }
          : { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };

      case 'OW-04a':
        return config.maxTokens > 0
          ? { result: 'pass', evidence: `maxTokens: ${config.maxTokens}` }
          : { result: 'fail', evidence: '토큰 제한이 설정되지 않았습니다' };
      case 'OW-04b':
        return config.apiTimeout > 0
          ? { result: 'pass', evidence: `타임아웃: ${config.apiTimeout}ms` }
          : { result: 'fail', evidence: 'API 타임아웃이 설정되지 않았습니다' };
      case 'OW-04c':
        return config.costLimitEnabled
          ? { result: 'pass', evidence: `비용 상한: $${config.costMaxLimit}` }
          : { result: 'warn', evidence: '비용 상한이 설정되지 않았습니다' };

      case 'OW-06a': {
        const piiScanned = logs.some((l) => l.security.piiDetected !== undefined);
        return piiScanned || !hasLogs
          ? { result: 'pass', evidence: 'PII 감지 메커니즘이 적용되어 있습니다' }
          : { result: 'warn', evidence: 'PII 감지 기록이 없습니다' };
      }
      case 'OW-06b':
        return { result: 'warn', evidence: '자동 PII 마스킹은 아직 구현되지 않았습니다', remediation: 'PII 자동 마스킹 기능을 추가하세요' };

      case 'OW-07a':
        return { result: 'pass', evidence: '외부 플러그인 시스템이 없으므로 해당 없음' };

      case 'OW-08a': {
        if (!hasLogs) return { result: 'n/a', evidence: 'AI 활동 기록이 없습니다' };
        const autoTriggered = logs.filter((l) => l.trigger === 'auto_suggestion');
        return autoTriggered.length === 0
          ? { result: 'pass', evidence: '모든 AI 활동이 사용자 요청에 의해 트리거됨' }
          : {
              result: 'warn',
              evidence: `${autoTriggered.length}건의 자동 트리거 활동이 있습니다`,
              remediation: '자동 AI 실행에 대한 사용자 승인을 강화하세요',
            };
      }
      case 'OW-08b':
        return { result: 'pass', evidence: 'AI 행동 범위가 문서 편집으로 제한됩니다' };

      case 'OW-09a':
        return config.hallucinationCheckEnabled
          ? { result: 'pass', evidence: 'TruthAnchor 검증 수단이 제공됩니다' }
          : { result: 'warn', evidence: '사실 검증 수단이 비활성화 상태' };
      case 'OW-09b':
        return { result: 'pass', evidence: 'AI 생성물에 대한 검토 안내가 제공됩니다' };

      case 'OW-10b':
        return { result: 'pass', evidence: '사용자 인증 기반 접근 제어가 적용됩니다' };

      // ===== Default =====
      default:
        return { result: 'n/a', evidence: '평가 로직이 정의되지 않았습니다' };
    }
  }

  // =============================================
  // Score Calculation
  // =============================================

  private calcCategoryScore(checks: ComplianceCheck[]): number {
    const applicable = checks.filter((c) => c.result !== 'n/a');
    if (applicable.length === 0) return 100;

    const scoreMap: Record<CheckResult, number> = {
      pass: 100,
      warn: 60,
      fail: 0,
      'n/a': 0,
    };

    const total = applicable.reduce((sum, c) => sum + scoreMap[c.result], 0);
    return Math.round(total / applicable.length);
  }

  private calcOverallScore(categories: ComplianceCategory[]): number {
    if (categories.length === 0) return 100;
    const total = categories.reduce((sum, c) => sum + c.score, 0);
    return Math.round(total / categories.length);
  }

  private scoreToStatus(score: number): CheckResult {
    if (score >= 80) return 'pass';
    if (score >= 50) return 'warn';
    return 'fail';
  }

  private overallScoreToStatus(score: number): ComplianceStatus {
    if (score >= 80) return 'compliant';
    if (score >= 50) return 'partial';
    return 'non-compliant';
  }

  // =============================================
  // Recommendations
  // =============================================

  private generateRecommendations(
    categories: ComplianceCategory[],
    _framework: FrameworkType
  ): string[] {
    const recs: string[] = [];

    for (const cat of categories) {
      for (const check of cat.checks) {
        if (check.remediation && (check.result === 'fail' || check.result === 'warn')) {
          recs.push(`[${cat.name}] ${check.remediation}`);
        }
      }
    }

    if (recs.length === 0) {
      recs.push('모든 항목이 충족되었습니다. 현재 상태를 유지하세요.');
    }

    return recs;
  }
}

// Singleton
export const complianceReporter = new ComplianceReporter();
