import { describe, it, expect, beforeEach } from 'vitest';
import { ComplianceReporter, getDefaultAppConfig } from './compliance-reporter';
import type { AIActivityLog, AppComplianceConfig, FrameworkType } from '../../types/compliance';

function createLog(overrides: Partial<AIActivityLog> = {}): AIActivityLog {
  return {
    id: `log-${Math.random()}`,
    timestamp: new Date().toISOString(),
    sessionId: 'session-test',
    action: 'generate',
    trigger: 'user_request',
    model: 'gpt-4o',
    modelProvider: 'openai',
    temperature: 0.7,
    maxTokens: 4000,
    inputTokens: 100,
    outputTokens: 200,
    promptHash: 'hash123',
    targetLocation: 'page1.section1',
    generatedText: '생성된 텍스트',
    userReviewed: true,
    userApproved: true,
    userModified: false,
    security: {
      promptInjectionScan: true,
      outputSanitized: true,
      piiDetected: false,
    },
    ...overrides,
  };
}

function createConfig(overrides: Partial<AppComplianceConfig> = {}): AppComplianceConfig {
  return {
    aiWatermarkEnabled: true,
    useProxyServer: true,
    maxTokens: 4000,
    apiTimeout: 120000,
    costLimitEnabled: true,
    costMaxLimit: 10,
    httpsEnabled: true,
    outputSanitizationEnabled: true,
    promptSeparationEnabled: true,
    aiFeatureToggleable: true,
    hallucinationCheckEnabled: true,
    undoRedoEnabled: true,
    ...overrides,
  };
}

describe('ComplianceReporter', () => {
  let reporter: ComplianceReporter;

  beforeEach(() => {
    reporter = new ComplianceReporter();
  });

  // =========================================
  // 기본 리포트 생성
  // =========================================

  describe('기본 리포트 생성', () => {
    const frameworks: FrameworkType[] = ['eu-ai-act', 'k-ai-act', 'nist-ai-rmf', 'owasp-llm-top10'];

    it.each(frameworks)('%s 리포트를 생성할 수 있어야 한다', (fw) => {
      const report = reporter.evaluate(fw, [], createConfig());
      expect(report).toBeDefined();
      expect(report.framework).toBe(fw);
      expect(report.generatedAt).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.categories.length).toBeGreaterThan(0);
    });

    it.each(frameworks)('%s 리포트의 summary가 정확해야 한다', (fw) => {
      const report = reporter.evaluate(fw, [], createConfig());
      const { totalChecks, passed, warned, failed, notApplicable } = report.summary;
      expect(totalChecks).toBe(passed + warned + failed + notApplicable);
      expect(totalChecks).toBeGreaterThan(0);
    });

    it.each(frameworks)('%s 리포트의 overallStatus가 유효해야 한다', (fw) => {
      const report = reporter.evaluate(fw, [], createConfig());
      expect(['compliant', 'partial', 'non-compliant']).toContain(report.overallStatus);
    });
  });

  // =========================================
  // 로그 없을 때 (빈 활동)
  // =========================================

  describe('로그 없는 상태', () => {
    it('AI 활동이 없으면 n/a 항목이 있어야 한다', () => {
      const report = reporter.evaluate('eu-ai-act', [], createConfig());
      const allChecks = report.categories.flatMap((c) => c.checks);
      const naChecks = allChecks.filter((c) => c.result === 'n/a');
      expect(naChecks.length).toBeGreaterThan(0);
    });

    it('aiUsageSummary.totalActions가 0이어야 한다', () => {
      const report = reporter.evaluate('eu-ai-act', [], createConfig());
      expect(report.aiUsageSummary.totalActions).toBe(0);
      expect(report.aiUsageSummary.model).toBe('N/A');
    });
  });

  // =========================================
  // 로그 있을 때
  // =========================================

  describe('로그가 있는 상태', () => {
    it('AI 활동 로그가 반영되어야 한다', () => {
      const logs = [createLog(), createLog({ model: 'claude-sonnet', modelProvider: 'anthropic' })];
      const report = reporter.evaluate('eu-ai-act', logs, createConfig());
      expect(report.aiUsageSummary.totalActions).toBe(2);
      expect(report.aiUsageSummary.model).toContain('gpt-4o');
      expect(report.aiUsageSummary.model).toContain('claude-sonnet');
    });

    it('토큰 합계가 정확해야 한다', () => {
      const logs = [
        createLog({ inputTokens: 100, outputTokens: 200 }),
        createLog({ inputTokens: 150, outputTokens: 300 }),
      ];
      const report = reporter.evaluate('eu-ai-act', logs, createConfig());
      expect(report.aiUsageSummary.totalInputTokens).toBe(250);
      expect(report.aiUsageSummary.totalOutputTokens).toBe(500);
    });

    it('승인율이 정확해야 한다', () => {
      const logs = [
        createLog({ userApproved: true }),
        createLog({ userApproved: true }),
        createLog({ userApproved: false }),
      ];
      const report = reporter.evaluate('eu-ai-act', logs, createConfig());
      expect(report.aiUsageSummary.approvalRate).toBeCloseTo(2 / 3);
    });

    it('할루시네이션 평균 점수가 정확해야 한다', () => {
      const logs = [
        createLog({ hallucinationCheck: { performed: true, score: 0.9, domain: 'general', claimsTotal: 5, claimsSupported: 4, claimsContradicted: 1 } }),
        createLog({ hallucinationCheck: { performed: true, score: 0.7, domain: 'general', claimsTotal: 3, claimsSupported: 2, claimsContradicted: 1 } }),
        createLog(), // 검증 안됨
      ];
      const report = reporter.evaluate('eu-ai-act', logs, createConfig());
      expect(report.aiUsageSummary.avgHallucinationScore).toBeCloseTo(0.8);
    });
  });

  // =========================================
  // 스코어 계산
  // =========================================

  describe('스코어 계산', () => {
    it('모든 설정이 최적일 때 높은 점수를 받아야 한다', () => {
      const logs = [
        createLog({
          userReviewed: true,
          userApproved: true,
          hallucinationCheck: { performed: true, score: 0.95, domain: 'general', claimsTotal: 10, claimsSupported: 9, claimsContradicted: 1 },
        }),
      ];
      const report = reporter.evaluate('eu-ai-act', logs, createConfig());
      expect(report.overallScore).toBeGreaterThanOrEqual(70);
      expect(report.overallStatus).not.toBe('non-compliant');
    });

    it('설정이 부족할 때 낮은 점수를 받아야 한다', () => {
      const badConfig = createConfig({
        aiWatermarkEnabled: false,
        useProxyServer: false,
        costLimitEnabled: false,
        outputSanitizationEnabled: false,
        promptSeparationEnabled: false,
      });
      const report = reporter.evaluate('eu-ai-act', [], badConfig);
      expect(report.overallScore).toBeLessThanOrEqual(80);
    });

    it('카테고리별 스코어가 0~100 범위여야 한다', () => {
      const report = reporter.evaluate('k-ai-act', [createLog()], createConfig());
      for (const cat of report.categories) {
        expect(cat.score).toBeGreaterThanOrEqual(0);
        expect(cat.score).toBeLessThanOrEqual(100);
      }
    });
  });

  // =========================================
  // 권고사항
  // =========================================

  describe('권고사항 생성', () => {
    it('문제가 없을 때 긍정적 메시지가 나와야 한다', () => {
      const logs = [createLog({
        userReviewed: true,
        hallucinationCheck: { performed: true, score: 0.95, domain: 'general', claimsTotal: 5, claimsSupported: 5, claimsContradicted: 0 },
      })];
      const report = reporter.evaluate('nist-ai-rmf', logs, createConfig());
      // 모든 항목이 pass이면 긍정적 메시지
      if (report.summary.failed === 0 && report.summary.warned === 0) {
        expect(report.recommendations[0]).toContain('충족');
      }
    });

    it('fail/warn 항목이 있을 때 remediation이 권고사항에 포함되어야 한다', () => {
      const badConfig = createConfig({
        aiWatermarkEnabled: false,
        outputSanitizationEnabled: false,
      });
      const report = reporter.evaluate('eu-ai-act', [], badConfig);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  // =========================================
  // 개별 체크 항목 검증
  // =========================================

  describe('EU AI Act 개별 체크', () => {
    it('EU-T1: aiWatermarkEnabled=true이면 pass', () => {
      const report = reporter.evaluate('eu-ai-act', [createLog()], createConfig({ aiWatermarkEnabled: true }));
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'EU-T1');
      expect(check?.result).toBe('pass');
    });

    it('EU-T1: aiWatermarkEnabled=false이면 fail', () => {
      const report = reporter.evaluate('eu-ai-act', [createLog()], createConfig({ aiWatermarkEnabled: false }));
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'EU-T1');
      expect(check?.result).toBe('fail');
      expect(check?.remediation).toBeDefined();
    });

    it('EU-H1: 모두 검토하면 pass', () => {
      const logs = [createLog({ userReviewed: true }), createLog({ userReviewed: true })];
      const report = reporter.evaluate('eu-ai-act', logs, createConfig());
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'EU-H1');
      expect(check?.result).toBe('pass');
    });

    it('EU-H1: 일부만 검토하면 warn 또는 fail', () => {
      const logs = [
        createLog({ userReviewed: true }),
        createLog({ userReviewed: false }),
        createLog({ userReviewed: false }),
        createLog({ userReviewed: false }),
      ];
      const report = reporter.evaluate('eu-ai-act', logs, createConfig());
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'EU-H1');
      expect(['warn', 'fail']).toContain(check?.result);
    });

    it('EU-TR4: apiTimeout > 0이면 pass', () => {
      const report = reporter.evaluate('eu-ai-act', [], createConfig({ apiTimeout: 120000 }));
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'EU-TR4');
      expect(check?.result).toBe('pass');
    });
  });

  describe('OWASP LLM Top 10 개별 체크', () => {
    it('OW-04a: maxTokens > 0이면 pass', () => {
      const report = reporter.evaluate('owasp-llm-top10', [], createConfig({ maxTokens: 4000 }));
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'OW-04a');
      expect(check?.result).toBe('pass');
    });

    it('OW-05b: 프록시 사용 시 pass', () => {
      const report = reporter.evaluate('owasp-llm-top10', [], createConfig({ useProxyServer: true }));
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'OW-05b');
      expect(check?.result).toBe('pass');
    });

    it('OW-05b: 프록시 미사용 시 warn', () => {
      const report = reporter.evaluate('owasp-llm-top10', [], createConfig({ useProxyServer: false }));
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'OW-05b');
      expect(check?.result).toBe('warn');
    });

    it('PII 감지 시 EU-D1이 warn이어야 한다', () => {
      const logs = [createLog({ security: { promptInjectionScan: true, outputSanitized: true, piiDetected: true } })];
      const report = reporter.evaluate('eu-ai-act', logs, createConfig());
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === 'EU-D1');
      expect(check?.result).toBe('warn');
    });
  });

  // =========================================
  // getDefaultAppConfig
  // =========================================

  describe('getDefaultAppConfig', () => {
    it('기본 설정을 반환해야 한다', () => {
      const config = getDefaultAppConfig();
      expect(config.aiWatermarkEnabled).toBe(true);
      expect(config.maxTokens).toBeGreaterThan(0);
      expect(config.apiTimeout).toBeGreaterThan(0);
      expect(config.outputSanitizationEnabled).toBe(true);
    });
  });
});
