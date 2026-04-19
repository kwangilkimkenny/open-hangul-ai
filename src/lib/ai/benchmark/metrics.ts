/**
 * 벤치마크 메트릭 계산기
 * Precision / Recall / F1 / 정확도 / FPR / FNR
 *
 * @module ai/benchmark/metrics
 */

import type {
  AegisTestResult,
  TruthAnchorTestResult,
  ClassificationMetrics,
  AegisBenchmarkReport,
  TruthAnchorBenchmarkReport,
  Verdict,
} from './types';

// ── AEGIS 메트릭 계산 ──

export function computeAegisMetrics(results: AegisTestResult[]): AegisBenchmarkReport {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const fp = results.filter(r => r.falsePositive).length;
  const fn = results.filter(r => r.falseNegative).length;

  const normalCases = results.filter(r => !r.expected).length;
  const threatCases = results.filter(r => r.expected).length;
  const byCategory: Record<string, ClassificationMetrics> = {};

  // 간단한 카테고리 추출 (caseId에서)
  const categoryMap = new Map<string, AegisTestResult[]>();
  for (const r of results) {
    const cat = r.caseId.replace(/-\d+$/, '');
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(r);
  }

  for (const [cat, catResults] of categoryMap.entries()) {
    const catTotal = catResults.length;
    const catTP = catResults.filter(r => r.expected && r.actual).length;
    const catFP = catResults.filter(r => r.falsePositive).length;
    const catFN = catResults.filter(r => r.falseNegative).length;

    const precision = catTP + catFP > 0 ? catTP / (catTP + catFP) : 1;
    const recall = catTP + catFN > 0 ? catTP / (catTP + catFN) : 1;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    byCategory[cat] = { precision: round(precision), recall: round(recall), f1: round(f1), support: catTotal };
  }

  return {
    timestamp: new Date().toISOString(),
    engineMode: 'fallback' as const,  // runner에서 실제 값으로 덮어쓰기
    totalCases: total,
    passed,
    failed: total - passed,
    accuracy: round(passed / total),
    falsePositives: fp,
    falseNegatives: fn,
    falsePositiveRate: normalCases > 0 ? round(fp / normalCases) : 0,
    falseNegativeRate: threatCases > 0 ? round(fn / threatCases) : 0,
    avgLatencyMs: round(results.reduce((s, r) => s + r.latencyMs, 0) / total),
    byCategory,
    details: results,
  };
}

// ── TruthAnchor 메트릭 계산 ──

export function computeTruthAnchorMetrics(results: TruthAnchorTestResult[]): TruthAnchorBenchmarkReport {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;

  // verdict별 메트릭
  const verdicts: Verdict[] = ['supported', 'contradicted', 'neutral'];
  const byVerdict: Record<Verdict, ClassificationMetrics> = {} as Record<Verdict, ClassificationMetrics>;

  for (const v of verdicts) {
    const tp = results.filter(r => r.expectedVerdict === v && r.actualVerdict === v).length;
    const fp = results.filter(r => r.expectedVerdict !== v && r.actualVerdict === v).length;
    const fn = results.filter(r => r.expectedVerdict === v && r.actualVerdict !== v).length;
    const support = results.filter(r => r.expectedVerdict === v).length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    byVerdict[v] = { precision: round(precision), recall: round(recall), f1: round(f1), support };
  }

  // 도메인별 메트릭
  const domainMap = new Map<string, TruthAnchorTestResult[]>();
  for (const r of results) {
    const domain = r.caseId.split('-')[0];
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push(r);
  }

  const byDomain: Record<string, { accuracy: number; total: number; passed: number }> = {};
  for (const [domain, domainResults] of domainMap.entries()) {
    const dTotal = domainResults.length;
    const dPassed = domainResults.filter(r => r.passed).length;
    byDomain[domain] = { accuracy: round(dPassed / dTotal), total: dTotal, passed: dPassed };
  }

  // 카테고리별 메트릭
  const catMap = new Map<string, TruthAnchorTestResult[]>();
  for (const r of results) {
    const parts = r.caseId.split('-');
    const cat = parts.length > 1 ? parts[1] : 'unknown';
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(r);
  }

  const byCategory: Record<string, { accuracy: number; total: number; passed: number }> = {};
  for (const [cat, catResults] of catMap.entries()) {
    const cTotal = catResults.length;
    const cPassed = catResults.filter(r => r.passed).length;
    byCategory[cat] = { accuracy: round(cPassed / cTotal), total: cTotal, passed: cPassed };
  }

  return {
    timestamp: new Date().toISOString(),
    totalCases: total,
    passed,
    failed: total - passed,
    accuracy: round(passed / total),
    avgLatencyMs: round(results.reduce((s, r) => s + r.latencyMs, 0) / total),
    avgConfidence: round(results.reduce((s, r) => s + r.confidence, 0) / total),
    byVerdict,
    byDomain,
    byCategory,
    details: results,
  };
}

// ── 종합 점수 ──

export function computeOverallScore(
  aegis: AegisBenchmarkReport,
  ta: TruthAnchorBenchmarkReport
): { score: number; summary: string } {
  // 가중치: AEGIS 40%, TruthAnchor 60%
  const aegisScore = (1 - aegis.falseNegativeRate) * 0.6 + (1 - aegis.falsePositiveRate) * 0.4;
  const taScore = ta.accuracy;
  const overall = round((aegisScore * 0.4 + taScore * 0.6) * 100);

  let grade = '';
  if (overall >= 90) grade = '우수 (Excellent)';
  else if (overall >= 70) grade = '양호 (Good)';
  else if (overall >= 50) grade = '보통 (Fair)';
  else grade = '미흡 (Poor)';

  const summary = [
    `종합 점수: ${overall}/100 — ${grade}`,
    `AEGIS: 정확도 ${round(aegis.accuracy * 100)}%, FPR ${round(aegis.falsePositiveRate * 100)}%, FNR ${round(aegis.falseNegativeRate * 100)}%`,
    `TruthAnchor: 정확도 ${round(ta.accuracy * 100)}%, 평균 신뢰도 ${round(ta.avgConfidence * 100)}%`,
    `평균 지연: AEGIS ${aegis.avgLatencyMs}ms, TruthAnchor ${ta.avgLatencyMs}ms`,
  ].join('\n');

  return { score: overall, summary };
}

function round(v: number, digits = 4): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}
