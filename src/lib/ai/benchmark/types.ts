/**
 * AI 성능 벤치마크 타입 정의
 * @module ai/benchmark/types
 */

// ── AEGIS 테스트 케이스 ──

export interface AegisTestCase {
  id: string;
  category: 'prompt-injection' | 'jailbreak' | 'pii' | 'normal' | 'social-engineering' | 'code-injection';
  input: string;
  expectedBlocked: boolean;
  description: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface AegisTestResult {
  caseId: string;
  passed: boolean;
  expected: boolean;
  actual: boolean;
  score: number;
  reason: string;
  latencyMs: number;
  falsePositive: boolean;   // 정상인데 차단됨
  falseNegative: boolean;   // 위협인데 통과됨
}

// ── TruthAnchor 테스트 케이스 ──

export type Verdict = 'supported' | 'contradicted' | 'neutral';

export interface TruthAnchorTestCase {
  id: string;
  domain: 'general' | 'finance' | 'medical' | 'education' | 'defense' | 'admin';
  category: 'guardrail' | 'numeric' | 'factual' | 'mixed';
  claim: string;
  evidence: string;
  expectedVerdict: Verdict;
  description: string;
}

export interface TruthAnchorTestResult {
  caseId: string;
  passed: boolean;
  expectedVerdict: Verdict;
  actualVerdict: Verdict;
  confidence: number;
  evidenceMatched: string;
  latencyMs: number;
}

// ── 메트릭 ──

export interface ClassificationMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number; // 해당 클래스 테스트 수
}

export interface AegisBenchmarkReport {
  timestamp: string;
  engineMode: 'sdk' | 'fallback';  // SDK 로드 여부
  totalCases: number;
  passed: number;
  failed: number;
  accuracy: number;
  falsePositives: number;
  falseNegatives: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  avgLatencyMs: number;
  byCategory: Record<string, ClassificationMetrics>;
  details: AegisTestResult[];
}

export interface TruthAnchorBenchmarkReport {
  timestamp: string;
  totalCases: number;
  passed: number;
  failed: number;
  accuracy: number;
  avgLatencyMs: number;
  avgConfidence: number;
  byVerdict: Record<Verdict, ClassificationMetrics>;
  byDomain: Record<string, { accuracy: number; total: number; passed: number }>;
  byCategory: Record<string, { accuracy: number; total: number; passed: number }>;
  details: TruthAnchorTestResult[];
}

export interface FullBenchmarkReport {
  timestamp: string;
  aegis: AegisBenchmarkReport;
  truthAnchor: TruthAnchorBenchmarkReport;
  overallScore: number; // 0-100 종합점수
  summary: string;
}
