// ============================================================
// SABER Types — ported from libs/aegis-defense/src/saber/
// ============================================================

export type RiskGrade = 'safe' | 'low' | 'medium' | 'high' | 'critical';
export type DefenseGrade = 'excellent' | 'strong' | 'good' | 'fair' | 'weak';
export type SafetyLevel = 'standard' | 'enhanced' | 'strict';
export type PatternSource = 'manual' | 'saber_auto' | 'evolution';

export interface BetaVulnerabilityModel {
  alpha: number;
  beta: number;
  unbreakableFraction: number;
  goodnessOfFit: number;
  numQueries: number;
  trialsPerQuery: number;
}

export interface QueryTrials {
  queryId: string;
  totalTrials: number;
  successCount: number;
}

export interface SaberReport {
  alpha: number;
  beta: number;
  unbreakableFraction: number;
  goodnessOfFit: number;
  riskGrade: RiskGrade;
  defenseGrade: DefenseGrade;
  asrPredictions: Record<number, number>;
  budgetAtTau: Record<number, number>;
  recommendations: string[];
}

export interface HardRefusalResult {
  patternId: string;
  matchedFragment: string;
  category: string;
  source: PatternSource;
  reason: string;
  confidence: number;
}
