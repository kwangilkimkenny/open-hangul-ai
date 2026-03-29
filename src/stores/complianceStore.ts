/**
 * Compliance Store
 * AI 활동 로그 + 컴플라이언스 리포트 상태 관리
 *
 * @module stores/complianceStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  AIActivityLog,
  AIActionType,
  AITriggerType,
  ComplianceReport,
  FrameworkType,
} from '../types/compliance';

interface ComplianceState {
  // AI 활동 로그
  activityLogs: AIActivityLog[];
  sessionId: string;

  // 생성된 리포트 캐시
  reports: Record<FrameworkType, ComplianceReport | null>;
  activeReport: ComplianceReport | null;

  // 대시보드 표시
  isDashboardOpen: boolean;
  isReportViewOpen: boolean;

  // Actions - 활동 로그
  addActivityLog: (log: Omit<AIActivityLog, 'id' | 'timestamp' | 'sessionId'>) => void;
  updateActivityLog: (id: string, updates: Partial<AIActivityLog>) => void;
  clearActivityLogs: () => void;
  getActivityLogs: () => AIActivityLog[];

  // Actions - 간편 로그 추가
  logAIAction: (params: {
    action: AIActionType;
    trigger: AITriggerType;
    model: string;
    modelProvider: string;
    inputTokens: number;
    outputTokens: number;
    targetLocation: string;
    generatedText: string;
    originalText?: string;
    temperature?: number;
    maxTokens?: number;
  }) => string;

  // Actions - 리포트
  setReport: (framework: FrameworkType, report: ComplianceReport) => void;
  setActiveReport: (report: ComplianceReport | null) => void;
  clearReports: () => void;

  // Actions - UI
  setDashboardOpen: (open: boolean) => void;
  setReportViewOpen: (open: boolean) => void;

  // Computed
  getLogCount: () => number;
  getReviewedRate: () => number;
  getApprovalRate: () => number;
  getAvgHallucinationScore: () => number | null;
}

function generateId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export const useComplianceStore = create<ComplianceState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        activityLogs: [],
        sessionId: generateSessionId(),
        reports: {
          'eu-ai-act': null,
          'k-ai-act': null,
          'nist-ai-rmf': null,
          'owasp-llm-top10': null,
        },
        activeReport: null,
        isDashboardOpen: false,
        isReportViewOpen: false,

        // === 활동 로그 ===

        addActivityLog: (log) => {
          const entry: AIActivityLog = {
            ...log,
            id: generateId(),
            timestamp: new Date().toISOString(),
            sessionId: get().sessionId,
          };
          set((state) => ({
            activityLogs: [...state.activityLogs, entry],
          }));
        },

        updateActivityLog: (id, updates) => {
          set((state) => ({
            activityLogs: state.activityLogs.map((log) =>
              log.id === id ? { ...log, ...updates } : log
            ),
          }));
        },

        clearActivityLogs: () => {
          set({ activityLogs: [], sessionId: generateSessionId() });
        },

        getActivityLogs: () => get().activityLogs,

        // === 간편 로그 추가 ===

        logAIAction: (params) => {
          const id = generateId();
          const entry: AIActivityLog = {
            id,
            timestamp: new Date().toISOString(),
            sessionId: get().sessionId,
            action: params.action,
            trigger: params.trigger,
            model: params.model,
            modelProvider: params.modelProvider,
            temperature: params.temperature ?? 0.7,
            maxTokens: params.maxTokens ?? 4000,
            inputTokens: params.inputTokens,
            outputTokens: params.outputTokens,
            promptHash: '',
            targetLocation: params.targetLocation,
            originalText: params.originalText,
            generatedText: params.generatedText,
            userReviewed: false,
            userApproved: null,
            userModified: false,
            security: {
              promptInjectionScan: true,
              outputSanitized: true,
              piiDetected: false,
            },
          };

          set((state) => ({
            activityLogs: [...state.activityLogs, entry],
          }));

          return id;
        },

        // === 리포트 ===

        setReport: (framework, report) => {
          set((state) => ({
            reports: { ...state.reports, [framework]: report },
          }));
        },

        setActiveReport: (report) => set({ activeReport: report }),

        clearReports: () => {
          set({
            reports: {
              'eu-ai-act': null,
              'k-ai-act': null,
              'nist-ai-rmf': null,
              'owasp-llm-top10': null,
            },
            activeReport: null,
          });
        },

        // === UI ===

        setDashboardOpen: (open) => set({ isDashboardOpen: open }),
        setReportViewOpen: (open) => set({ isReportViewOpen: open }),

        // === Computed ===

        getLogCount: () => get().activityLogs.length,

        getReviewedRate: () => {
          const logs = get().activityLogs;
          if (logs.length === 0) return 1;
          return logs.filter((l) => l.userReviewed).length / logs.length;
        },

        getApprovalRate: () => {
          const logs = get().activityLogs;
          const reviewed = logs.filter((l) => l.userApproved !== null);
          if (reviewed.length === 0) return 1;
          return reviewed.filter((l) => l.userApproved === true).length / reviewed.length;
        },

        getAvgHallucinationScore: () => {
          const logs = get().activityLogs;
          const checked = logs.filter((l) => l.hallucinationCheck?.performed);
          if (checked.length === 0) return null;
          const sum = checked.reduce((acc, l) => acc + (l.hallucinationCheck?.score ?? 0), 0);
          return sum / checked.length;
        },
      }),
      {
        name: 'compliance-store',
        partialize: (state) => ({
          activityLogs: state.activityLogs.slice(-500), // 최근 500건만 유지
          sessionId: state.sessionId,
        }),
      }
    ),
    { name: 'compliance-store' }
  )
);

export default useComplianceStore;
