// ============================================================
// Adaptive Defense — Self-Evolving Defense Rules with A/B Testing
// Ported from libs/aegis-defense/src/adaptive/
// ============================================================

export type RuleStatus =
  | 'Candidate'
  | 'Testing'
  | 'Validated'
  | 'Active'
  | 'RolledBack'
  | 'Rejected';

export interface AdaptiveConfig {
  minFitnessForRule: number;
  maxFalsePositiveRate: number;
  abTestSafePrompts: number;
  activationConfidence: number;
  maxRollbacks: number;
}

export interface DefenseRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp;
  category: string;
  fitness: number;
  status: RuleStatus;
  createdAt: number;
  activatedAt: number | null;
  rollbackCount: number;
  testResults: ABTestResults | null;
  metadata: Record<string, string>;
}

export interface ABTestResults {
  totalSafePrompts: number;
  falsePositives: number;
  falsePositiveRate: number;
  totalMaliciousPrompts: number;
  truePositives: number;
  detectionRate: number;
  startedAt: number;
  completedAt: number | null;
}

export interface RuleCandidate {
  name: string;
  description: string;
  pattern: RegExp;
  category: string;
  fitness: number;
  metadata?: Record<string, string>;
}

export interface AdaptiveStats {
  totalRules: number;
  activeRules: number;
  candidateRules: number;
  testingRules: number;
  validatedRules: number;
  rolledBackRules: number;
  rejectedRules: number;
  avgFitness: number;
  avgFalsePositiveRate: number;
}

export interface RuleEvaluationResult {
  ruleId: string;
  matched: boolean;
  confidence: number;
}

const DEFAULT_CONFIG: AdaptiveConfig = {
  minFitnessForRule: 0.7,
  maxFalsePositiveRate: 0.01,
  abTestSafePrompts: 50,
  activationConfidence: 0.85,
  maxRollbacks: 3,
};

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class AdaptiveDefenseManager {
  private config: AdaptiveConfig;
  private rules: Map<string, DefenseRule> = new Map();

  constructor(config?: Partial<AdaptiveConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Submit a candidate rule for evaluation.
   * Rules with fitness below minFitnessForRule are immediately rejected.
   */
  submitCandidate(candidate: RuleCandidate): DefenseRule | null {
    if (candidate.fitness < this.config.minFitnessForRule) {
      const rule = this.createRule(candidate, 'Rejected');
      return rule;
    }

    const rule = this.createRule(candidate, 'Candidate');
    return rule;
  }

  /**
   * Start A/B testing for a candidate rule.
   * The rule transitions from Candidate to Testing.
   */
  startTesting(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.status !== 'Candidate') return false;

    rule.status = 'Testing';
    rule.testResults = {
      totalSafePrompts: 0,
      falsePositives: 0,
      falsePositiveRate: 0,
      totalMaliciousPrompts: 0,
      truePositives: 0,
      detectionRate: 0,
      startedAt: Date.now(),
      completedAt: null,
    };

    return true;
  }

  /**
   * Feed a safe prompt to a rule under testing.
   * If the rule triggers on a safe prompt, it counts as a false positive.
   */
  testWithSafePrompt(ruleId: string, prompt: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.status !== 'Testing' || !rule.testResults) return false;

    const triggered = rule.pattern.test(prompt);
    rule.testResults.totalSafePrompts++;
    if (triggered) {
      rule.testResults.falsePositives++;
    }
    rule.testResults.falsePositiveRate =
      rule.testResults.falsePositives / rule.testResults.totalSafePrompts;

    // Check if FP rate exceeds threshold — auto-reject
    if (
      rule.testResults.totalSafePrompts >= 10 &&
      rule.testResults.falsePositiveRate > this.config.maxFalsePositiveRate * 3
    ) {
      rule.status = 'Rejected';
      rule.testResults.completedAt = Date.now();
      return false;
    }

    // Check if testing is complete
    if (rule.testResults.totalSafePrompts >= this.config.abTestSafePrompts) {
      this.finalizeTesting(rule);
    }

    return !triggered; // true = safe prompt correctly passed
  }

  /**
   * Feed a known malicious prompt to a rule under testing.
   * If the rule triggers, it counts as a true positive.
   */
  testWithMaliciousPrompt(ruleId: string, prompt: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.status !== 'Testing' || !rule.testResults) return false;

    const triggered = rule.pattern.test(prompt);
    rule.testResults.totalMaliciousPrompts++;
    if (triggered) {
      rule.testResults.truePositives++;
    }
    rule.testResults.detectionRate = rule.testResults.totalMaliciousPrompts > 0
      ? rule.testResults.truePositives / rule.testResults.totalMaliciousPrompts
      : 0;

    return triggered; // true = malicious prompt correctly caught
  }

  /**
   * Finalize testing and determine if the rule should be validated.
   */
  private finalizeTesting(rule: DefenseRule): void {
    if (!rule.testResults) return;

    rule.testResults.completedAt = Date.now();

    const fpOk = rule.testResults.falsePositiveRate <= this.config.maxFalsePositiveRate;
    const detectionOk = rule.testResults.detectionRate >= this.config.activationConfidence ||
      rule.testResults.totalMaliciousPrompts === 0; // No malicious test data yet — still allow

    if (fpOk && detectionOk) {
      rule.status = 'Validated';
    } else {
      rule.status = 'Rejected';
    }
  }

  /**
   * Activate a validated rule for production use.
   */
  activate(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.status !== 'Validated') return false;

    rule.status = 'Active';
    rule.activatedAt = Date.now();
    return true;
  }

  /**
   * Roll back an active rule.
   * If a rule exceeds maxRollbacks, it is permanently rejected.
   */
  rollback(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.status !== 'Active') return false;

    rule.rollbackCount++;
    if (rule.rollbackCount >= this.config.maxRollbacks) {
      rule.status = 'Rejected';
    } else {
      rule.status = 'RolledBack';
    }
    rule.activatedAt = null;
    return true;
  }

  /**
   * Re-submit a rolled-back rule for testing again.
   */
  resubmit(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.status !== 'RolledBack') return false;

    rule.status = 'Candidate';
    rule.testResults = null;
    return true;
  }

  /**
   * Evaluate content against all active rules.
   */
  evaluate(content: string): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];

    for (const rule of this.rules.values()) {
      if (rule.status !== 'Active') continue;

      const matched = rule.pattern.test(content);
      // Reset lastIndex for global patterns
      rule.pattern.lastIndex = 0;

      results.push({
        ruleId: rule.id,
        matched,
        confidence: matched ? rule.fitness : 0,
      });
    }

    return results;
  }

  /**
   * Check if any active rule matches the content.
   */
  check(content: string): RuleEvaluationResult | null {
    for (const rule of this.rules.values()) {
      if (rule.status !== 'Active') continue;

      const matched = rule.pattern.test(content);
      rule.pattern.lastIndex = 0;

      if (matched) {
        return {
          ruleId: rule.id,
          matched: true,
          confidence: rule.fitness,
        };
      }
    }
    return null;
  }

  /**
   * Get rule by id.
   */
  getRule(ruleId: string): DefenseRule | null {
    return this.rules.get(ruleId) ?? null;
  }

  /**
   * List rules filtered by status.
   */
  listRules(status?: RuleStatus): DefenseRule[] {
    const results: DefenseRule[] = [];
    for (const rule of this.rules.values()) {
      if (status && rule.status !== status) continue;
      results.push(rule);
    }
    return results;
  }

  /**
   * Remove a rule.
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get aggregate statistics.
   */
  stats(): AdaptiveStats {
    let activeRules = 0;
    let candidateRules = 0;
    let testingRules = 0;
    let validatedRules = 0;
    let rolledBackRules = 0;
    let rejectedRules = 0;
    let totalFitness = 0;
    let totalFpRate = 0;
    let fpRateCount = 0;

    for (const rule of this.rules.values()) {
      totalFitness += rule.fitness;

      switch (rule.status) {
        case 'Active': activeRules++; break;
        case 'Candidate': candidateRules++; break;
        case 'Testing': testingRules++; break;
        case 'Validated': validatedRules++; break;
        case 'RolledBack': rolledBackRules++; break;
        case 'Rejected': rejectedRules++; break;
      }

      if (rule.testResults && rule.testResults.totalSafePrompts > 0) {
        totalFpRate += rule.testResults.falsePositiveRate;
        fpRateCount++;
      }
    }

    const totalRules = this.rules.size;

    return {
      totalRules,
      activeRules,
      candidateRules,
      testingRules,
      validatedRules,
      rolledBackRules,
      rejectedRules,
      avgFitness: totalRules > 0 ? totalFitness / totalRules : 0,
      avgFalsePositiveRate: fpRateCount > 0 ? totalFpRate / fpRateCount : 0,
    };
  }

  /**
   * Reset all rules.
   */
  reset(): void {
    this.rules.clear();
  }

  private createRule(candidate: RuleCandidate, status: RuleStatus): DefenseRule {
    const rule: DefenseRule = {
      id: uuid(),
      name: candidate.name,
      description: candidate.description,
      pattern: candidate.pattern,
      category: candidate.category,
      fitness: candidate.fitness,
      status,
      createdAt: Date.now(),
      activatedAt: null,
      rollbackCount: 0,
      testResults: null,
      metadata: candidate.metadata ?? {},
    };

    this.rules.set(rule.id, rule);
    return rule;
  }
}
