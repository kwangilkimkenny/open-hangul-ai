/**
 * AI Compliance Report Type Definitions
 * EU AI Act, K-AI Act, NIST AI RMF, OWASP LLM Top 10
 *
 * @module types/compliance
 * @version 1.0.0
 */

// =============================================
// Framework Types
// =============================================

export type FrameworkType = 'eu-ai-act' | 'k-ai-act' | 'nist-ai-rmf' | 'owasp-llm-top10';

export type CheckResult = 'pass' | 'warn' | 'fail' | 'n/a';

export type ComplianceStatus = 'compliant' | 'partial' | 'non-compliant';

export type AIActionType = 'generate' | 'edit' | 'correct' | 'suggest' | 'summarize';

export type AITriggerType = 'user_request' | 'auto_suggestion' | 'batch';

// =============================================
// AI Activity Log
// =============================================

export interface AIActivityLog {
  id: string;
  timestamp: string;
  sessionId: string;

  // 행위 정보
  action: AIActionType;
  trigger: AITriggerType;

  // 모델 정보 (EU AI Act: 투명성 / K-AI Act: 투명성)
  model: string;
  modelProvider: string;
  modelVersion?: string;
  temperature: number;
  maxTokens: number;

  // 입출력 추적 (EU AI Act: Data Governance)
  inputTokens: number;
  outputTokens: number;
  promptHash: string;

  // 문서 내 위치
  targetLocation: string;
  originalText?: string;
  generatedText: string;

  // 인간 감독 (EU AI Act: Human Oversight / K-AI Act: 책임성)
  userReviewed: boolean;
  userApproved: boolean | null;
  userModified: boolean;

  // 검증 (K-AI Act: 안전성)
  hallucinationCheck?: {
    performed: boolean;
    score: number;
    domain: string;
    claimsTotal: number;
    claimsSupported: number;
    claimsContradicted: number;
  };

  // 보안 (OWASP LLM Top 10)
  security: {
    promptInjectionScan: boolean;
    outputSanitized: boolean;
    piiDetected: boolean;
    piiAction?: 'masked' | 'removed' | 'warned';
  };
}

// =============================================
// Compliance Check & Category
// =============================================

export interface ComplianceCheck {
  id: string;
  description: string;
  article?: string;
  result: CheckResult;
  evidence: string;
  remediation?: string;
}

export interface ComplianceCheckRule {
  id: string;
  description: string;
  article?: string;
}

export interface ComplianceCategoryRule {
  name: string;
  checks: ComplianceCheckRule[];
}

export interface ComplianceCategory {
  name: string;
  score: number;
  status: CheckResult;
  checks: ComplianceCheck[];
}

// =============================================
// Compliance Report
// =============================================

export interface ComplianceReport {
  documentId: string;
  documentName: string;
  generatedAt: string;
  framework: FrameworkType;

  overallScore: number;
  overallStatus: ComplianceStatus;

  categories: ComplianceCategory[];
  recommendations: string[];

  summary: {
    totalChecks: number;
    passed: number;
    warned: number;
    failed: number;
    notApplicable: number;
  };

  aiUsageSummary: {
    totalActions: number;
    model: string;
    generatedRatio: number;
    allReviewed: boolean;
    approvalRate: number;
    avgHallucinationScore: number | null;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}

// =============================================
// Framework Metadata (UI 카드 표시용)
// =============================================

export interface FrameworkMeta {
  id: FrameworkType;
  name: string;
  subtitle: string;
  description: string;
  version: string;
  icon: string;
  tags: string[];
  categories: ComplianceCategoryRule[];
}

// =============================================
// App Config (평가에 필요한 설정 상태)
// =============================================

export interface AppComplianceConfig {
  aiWatermarkEnabled: boolean;
  useProxyServer: boolean;
  maxTokens: number;
  apiTimeout: number;
  costLimitEnabled: boolean;
  costMaxLimit: number;
  httpsEnabled: boolean;
  outputSanitizationEnabled: boolean;
  promptSeparationEnabled: boolean;
  aiFeatureToggleable: boolean;
  hallucinationCheckEnabled: boolean;
  undoRedoEnabled: boolean;
}
