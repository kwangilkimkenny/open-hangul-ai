import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

vi.mock('../lib/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}));

import { useComplianceStore } from './complianceStore';

function resetStore() {
  act(() => {
    useComplianceStore.getState().clearActivityLogs();
    useComplianceStore.getState().clearReports();
    useComplianceStore.getState().setDashboardOpen(false);
    useComplianceStore.getState().setReportViewOpen(false);
  });
}

describe('useComplianceStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // =========================================
  // Initial State
  // =========================================

  describe('초기 상태', () => {
    it('활동 로그가 비어있어야 한다', () => {
      const state = useComplianceStore.getState();
      expect(state.activityLogs).toEqual([]);
    });

    it('sessionId가 생성되어 있어야 한다', () => {
      const state = useComplianceStore.getState();
      expect(state.sessionId).toBeDefined();
      expect(state.sessionId).toMatch(/^session-/);
    });

    it('리포트가 모두 null이어야 한다', () => {
      const state = useComplianceStore.getState();
      expect(state.reports['eu-ai-act']).toBeNull();
      expect(state.reports['k-ai-act']).toBeNull();
      expect(state.reports['nist-ai-rmf']).toBeNull();
      expect(state.reports['owasp-llm-top10']).toBeNull();
    });

    it('대시보드가 닫혀있어야 한다', () => {
      const state = useComplianceStore.getState();
      expect(state.isDashboardOpen).toBe(false);
      expect(state.isReportViewOpen).toBe(false);
    });
  });

  // =========================================
  // Activity Log CRUD
  // =========================================

  describe('활동 로그 관리', () => {
    const sampleLog = {
      action: 'generate' as const,
      trigger: 'user_request' as const,
      model: 'gpt-4o',
      modelProvider: 'openai',
      temperature: 0.7,
      maxTokens: 4000,
      inputTokens: 100,
      outputTokens: 200,
      promptHash: 'abc123',
      targetLocation: 'page1.section1',
      generatedText: '생성된 텍스트',
      userReviewed: false,
      userApproved: null as boolean | null,
      userModified: false,
      security: {
        promptInjectionScan: true,
        outputSanitized: true,
        piiDetected: false,
      },
    };

    it('addActivityLog로 로그를 추가할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().addActivityLog(sampleLog);
      });
      const logs = useComplianceStore.getState().activityLogs;
      expect(logs).toHaveLength(1);
      expect(logs[0].model).toBe('gpt-4o');
      expect(logs[0].id).toMatch(/^log-/);
      expect(logs[0].timestamp).toBeDefined();
      expect(logs[0].sessionId).toBeDefined();
    });

    it('여러 로그를 추가할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().addActivityLog(sampleLog);
        useComplianceStore.getState().addActivityLog({ ...sampleLog, model: 'claude-sonnet' });
        useComplianceStore.getState().addActivityLog({ ...sampleLog, model: 'gpt-3.5' });
      });
      expect(useComplianceStore.getState().activityLogs).toHaveLength(3);
    });

    it('updateActivityLog로 로그를 수정할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().addActivityLog(sampleLog);
      });
      const logId = useComplianceStore.getState().activityLogs[0].id;

      act(() => {
        useComplianceStore.getState().updateActivityLog(logId, {
          userReviewed: true,
          userApproved: true,
        });
      });
      const updated = useComplianceStore.getState().activityLogs[0];
      expect(updated.userReviewed).toBe(true);
      expect(updated.userApproved).toBe(true);
    });

    it('clearActivityLogs로 모든 로그를 삭제할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().addActivityLog(sampleLog);
        useComplianceStore.getState().addActivityLog(sampleLog);
      });
      expect(useComplianceStore.getState().activityLogs).toHaveLength(2);

      act(() => {
        useComplianceStore.getState().clearActivityLogs();
      });
      expect(useComplianceStore.getState().activityLogs).toHaveLength(0);
    });

    it('clearActivityLogs 시 새로운 sessionId가 생성되어야 한다', () => {
      const oldSessionId = useComplianceStore.getState().sessionId;
      act(() => {
        useComplianceStore.getState().clearActivityLogs();
      });
      expect(useComplianceStore.getState().sessionId).not.toBe(oldSessionId);
    });

    it('getActivityLogs로 로그를 조회할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().addActivityLog(sampleLog);
      });
      const logs = useComplianceStore.getState().getActivityLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('generate');
    });
  });

  // =========================================
  // logAIAction (간편 로그)
  // =========================================

  describe('logAIAction 간편 로그', () => {
    it('간편 로그를 추가하고 ID를 반환해야 한다', () => {
      let logId = '';
      act(() => {
        logId = useComplianceStore.getState().logAIAction({
          action: 'edit',
          trigger: 'user_request',
          model: 'gpt-4o',
          modelProvider: 'openai',
          inputTokens: 50,
          outputTokens: 100,
          targetLocation: 'page1.para2',
          generatedText: '편집 결과',
          originalText: '원본 텍스트',
        });
      });
      expect(logId).toMatch(/^log-/);

      const log = useComplianceStore.getState().activityLogs[0];
      expect(log.action).toBe('edit');
      expect(log.temperature).toBe(0.7); // 기본값
      expect(log.maxTokens).toBe(4000); // 기본값
      expect(log.userReviewed).toBe(false);
      expect(log.userApproved).toBeNull();
      expect(log.security.promptInjectionScan).toBe(true);
    });

    it('커스텀 temperature/maxTokens를 설정할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().logAIAction({
          action: 'generate',
          trigger: 'batch',
          model: 'claude-sonnet',
          modelProvider: 'anthropic',
          inputTokens: 200,
          outputTokens: 500,
          targetLocation: 'page2',
          generatedText: '결과',
          temperature: 0.3,
          maxTokens: 8000,
        });
      });
      const log = useComplianceStore.getState().activityLogs[0];
      expect(log.temperature).toBe(0.3);
      expect(log.maxTokens).toBe(8000);
    });
  });

  // =========================================
  // Reports
  // =========================================

  describe('리포트 관리', () => {
    const mockReport = {
      documentId: 'doc-1',
      documentName: 'test.hwpx',
      generatedAt: new Date().toISOString(),
      framework: 'eu-ai-act' as const,
      overallScore: 85,
      overallStatus: 'compliant' as const,
      categories: [],
      recommendations: [],
      summary: { totalChecks: 10, passed: 8, warned: 1, failed: 1, notApplicable: 0 },
      aiUsageSummary: {
        totalActions: 5,
        model: 'gpt-4o',
        generatedRatio: 0.3,
        allReviewed: true,
        approvalRate: 1,
        avgHallucinationScore: 0.9,
        totalInputTokens: 500,
        totalOutputTokens: 1000,
      },
    };

    it('setReport로 리포트를 저장할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().setReport('eu-ai-act', mockReport);
      });
      expect(useComplianceStore.getState().reports['eu-ai-act']).toEqual(mockReport);
      expect(useComplianceStore.getState().reports['k-ai-act']).toBeNull();
    });

    it('setActiveReport로 활성 리포트를 설정할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().setActiveReport(mockReport);
      });
      expect(useComplianceStore.getState().activeReport).toEqual(mockReport);
    });

    it('clearReports로 모든 리포트를 삭제할 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().setReport('eu-ai-act', mockReport);
        useComplianceStore.getState().setActiveReport(mockReport);
      });

      act(() => {
        useComplianceStore.getState().clearReports();
      });
      const state = useComplianceStore.getState();
      expect(state.reports['eu-ai-act']).toBeNull();
      expect(state.activeReport).toBeNull();
    });
  });

  // =========================================
  // UI State
  // =========================================

  describe('UI 상태', () => {
    it('setDashboardOpen으로 대시보드를 열 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().setDashboardOpen(true);
      });
      expect(useComplianceStore.getState().isDashboardOpen).toBe(true);
    });

    it('setReportViewOpen으로 리포트 뷰를 열 수 있어야 한다', () => {
      act(() => {
        useComplianceStore.getState().setReportViewOpen(true);
      });
      expect(useComplianceStore.getState().isReportViewOpen).toBe(true);
    });
  });

  // =========================================
  // Computed
  // =========================================

  describe('Computed 함수', () => {
    const addLog = (overrides: Record<string, unknown> = {}) => {
      useComplianceStore.getState().addActivityLog({
        action: 'generate',
        trigger: 'user_request',
        model: 'gpt-4o',
        modelProvider: 'openai',
        temperature: 0.7,
        maxTokens: 4000,
        inputTokens: 100,
        outputTokens: 200,
        promptHash: 'hash',
        targetLocation: 'loc',
        generatedText: 'text',
        userReviewed: false,
        userApproved: null,
        userModified: false,
        security: { promptInjectionScan: true, outputSanitized: true, piiDetected: false },
        ...overrides,
      } as any);
    };

    it('getLogCount가 로그 수를 반환해야 한다', () => {
      expect(useComplianceStore.getState().getLogCount()).toBe(0);
      act(() => { addLog(); addLog(); });
      expect(useComplianceStore.getState().getLogCount()).toBe(2);
    });

    it('getReviewedRate가 검토율을 반환해야 한다', () => {
      // 로그 없을 때 1
      expect(useComplianceStore.getState().getReviewedRate()).toBe(1);

      act(() => {
        addLog({ userReviewed: true });
        addLog({ userReviewed: false });
        addLog({ userReviewed: true });
      });
      const rate = useComplianceStore.getState().getReviewedRate();
      expect(rate).toBeCloseTo(2 / 3);
    });

    it('getApprovalRate가 승인율을 반환해야 한다', () => {
      // 로그 없을 때 1
      expect(useComplianceStore.getState().getApprovalRate()).toBe(1);

      act(() => {
        addLog({ userApproved: true });
        addLog({ userApproved: true });
        addLog({ userApproved: false });
        addLog({ userApproved: null }); // 미검토 - 제외
      });
      const rate = useComplianceStore.getState().getApprovalRate();
      expect(rate).toBeCloseTo(2 / 3);
    });

    it('getAvgHallucinationScore가 평균 검증 점수를 반환해야 한다', () => {
      // 로그 없을 때 null
      expect(useComplianceStore.getState().getAvgHallucinationScore()).toBeNull();

      act(() => {
        addLog({ hallucinationCheck: { performed: true, score: 0.9, domain: 'general', claimsTotal: 5, claimsSupported: 4, claimsContradicted: 1 } });
        addLog({ hallucinationCheck: { performed: true, score: 0.8, domain: 'general', claimsTotal: 3, claimsSupported: 2, claimsContradicted: 1 } });
        addLog({}); // 검증 안된 로그 - 제외
      });
      const avg = useComplianceStore.getState().getAvgHallucinationScore();
      expect(avg).toBeCloseTo(0.85);
    });
  });
});
