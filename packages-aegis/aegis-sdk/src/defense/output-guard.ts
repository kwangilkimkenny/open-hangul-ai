// ============================================================
// AEGIS Output Guard — Response Quality Control
// Ported from libs/aegis-defense/src/output/guard.rs
// ============================================================

import type { Decision, Risk } from '../core/types';

// ---------------------------------------------------------------------------
// Detection result
// ---------------------------------------------------------------------------

export type OutputGuardDecision = 'ALLOW' | 'BLOCK' | 'MODIFY';

export interface OutputGuardResult {
  decision: OutputGuardDecision;
  refusalDetected: boolean;
  infoLeakageDetected: boolean;
  harmfulContentDetected: boolean;
  details: string[];
  risk?: Risk;
}

// ---------------------------------------------------------------------------
// Refusal markers (16+ patterns, multilingual)
// ---------------------------------------------------------------------------

const REFUSAL_MARKERS: RegExp[] = [
  /I(?:'m| am) (?:not able|unable) to/i,
  /I (?:cannot|can't) (?:help|assist|provide|generate)/i,
  /I(?:'m| am) sorry,?\s*(?:but\s+)?I (?:cannot|can't)/i,
  /I (?:don't|do not) (?:have|feel comfortable)/i,
  /as an AI(?:\s+language model)?,?\s*I/i,
  /I must (?:decline|refuse)/i,
  /it(?:'s| is|'s) (?:not (?:appropriate|ethical)|against)/i,
  /against my (?:programming|guidelines|policies)/i,
  /I(?:'m| am) programmed to/i,
  /that(?:'s| is) (?:not something|beyond what)/i,
  /죄송합니다?.*(?:도와|제공|생성|답변)/,
  /할\s*수\s*없습니다/,
  /도움을?\s*드릴\s*수\s*없/,
  /적절하지\s*않/,
  /AI로서/,
  /답변을?\s*거부/,
  /정책에\s*위반/,
  /윤리적.*(?:문제|이유)/,
];

// ---------------------------------------------------------------------------
// Info leakage patterns (after refusal — partial compliance)
// ---------------------------------------------------------------------------

interface InfoLeakagePattern {
  pattern: RegExp;
  confidence: number;
}

const INFO_LEAKAGE_PATTERNS: InfoLeakagePattern[] = [
  { pattern: /however,?\s*(?:I\s+can|here(?:'s| is)|that\s+said)/i, confidence: 0.75 },
  { pattern: /but\s+I\s+can\s+(?:tell|share|provide|suggest)/i, confidence: 0.75 },
  { pattern: /(?:instead|alternatively),?\s*(?:I\s+can|here)/i, confidence: 0.7 },
  { pattern: /(?:generally|typically|in\s+general).*(?:the\s+(?:steps|process|method)|방법)/i, confidence: 0.7 },
  { pattern: /while\s+I\s+(?:cannot|can't).*(?:I\s+can|here)/i, confidence: 0.8 },
  { pattern: /(?:다만|하지만|그러나).*(?:알려|설명|방법)/i, confidence: 0.75 },
  { pattern: /(?:for\s+(?:educational|research)\s+purposes)/i, confidence: 0.65 },
  { pattern: /(?:the\s+(?:basic|general)\s+(?:concept|idea|principle)\s+is)/i, confidence: 0.7 },
  { pattern: /(?:theoretically|in\s+theory)/i, confidence: 0.65 },
  { pattern: /(?:some\s+people|one\s+might|it\s+is\s+possible\s+to)/i, confidence: 0.7 },
  { pattern: /일반적으로.*(?:방법|과정)/i, confidence: 0.7 },
  { pattern: /(?:이론적|원리적)으로/i, confidence: 0.65 },
];

// ---------------------------------------------------------------------------
// Harmful output content patterns
// ---------------------------------------------------------------------------

interface HarmfulOutputPattern {
  pattern: RegExp;
  label: string;
  confidence: number;
}

const HARMFUL_OUTPUT_PATTERNS: HarmfulOutputPattern[] = [
  { pattern: /(?:step\s+1|first\s+step|1\.).*(?:step\s+2|second\s+step|2\.).*(?:step\s+3|3\.)/is, label: 'multi_step_instructions', confidence: 0.8 },
  { pattern: /(?:ingredients?|materials?|components?)\s*:.*(?:\n\s*[-*]\s*\w+){3,}/i, label: 'recipe_format', confidence: 0.75 },
  { pattern: /(?:import|require|include)\s.*(?:os|subprocess|socket|http)/i, label: 'code_with_dangerous_imports', confidence: 0.7 },
  { pattern: /(?:sudo|chmod|chown)\s+.*(?:777|root|\/etc)/i, label: 'privilege_escalation_commands', confidence: 0.8 },
  { pattern: /(?:nc|netcat|ncat)\s+-[elp].*\d+/i, label: 'reverse_shell_command', confidence: 0.85 },
  { pattern: /(?:SELECT|INSERT|UPDATE|DELETE).*(?:FROM|INTO|SET)\s+\w+.*(?:WHERE|VALUES)/i, label: 'sql_query_in_output', confidence: 0.6 },
  { pattern: /(?:bash\s+-[ic]|\/bin\/(?:sh|bash))\s+.*(?:dev\/tcp|mkfifo|telnet)/i, label: 'shell_reverse_connect', confidence: 0.9 },
  { pattern: /(?:CVE-\d{4}-\d{4,})\s*:?\s*(?:exploit|poc|proof\s+of\s+concept)/i, label: 'cve_exploit_code', confidence: 0.8 },
  { pattern: /(?:암호화폐|비트코인).*(?:세탁|믹싱|텀블링)/i, label: 'crypto_laundering_kr', confidence: 0.8 },
  { pattern: /(?:deepfake|딥페이크).*(?:generate|create|만들|생성)/i, label: 'deepfake_generation', confidence: 0.8 },
];

// ---------------------------------------------------------------------------
// Output Guard
// ---------------------------------------------------------------------------

export class OutputGuard {
  /**
   * Analyze LLM response for quality control:
   * - PARTIAL: refusal + info leakage => Block
   * - Harmful content => Block
   * - Otherwise => Allow
   */
  analyze(response: string): OutputGuardResult {
    const details: string[] = [];

    // --- Refusal detection ---
    let refusalDetected = false;
    for (const marker of REFUSAL_MARKERS) {
      if (marker.test(response)) {
        refusalDetected = true;
        details.push(`Refusal detected: ${marker.source.slice(0, 40)}...`);
        break;
      }
    }

    // --- Info leakage detection (meaningful only after refusal) ---
    let infoLeakageDetected = false;
    let leakageConfidence = 0;
    if (refusalDetected) {
      for (const lp of INFO_LEAKAGE_PATTERNS) {
        if (lp.pattern.test(response)) {
          infoLeakageDetected = true;
          leakageConfidence = Math.max(leakageConfidence, lp.confidence);
          details.push(`Info leakage after refusal: ${lp.pattern.source.slice(0, 40)}...`);
        }
      }
    }

    // --- Harmful content detection ---
    let harmfulContentDetected = false;
    let harmfulConfidence = 0;
    let harmfulLabel = '';
    for (const hp of HARMFUL_OUTPUT_PATTERNS) {
      if (hp.pattern.test(response)) {
        harmfulContentDetected = true;
        if (hp.confidence > harmfulConfidence) {
          harmfulConfidence = hp.confidence;
          harmfulLabel = hp.label;
        }
        details.push(`Harmful output: ${hp.label}`);
      }
    }

    // --- Decision ---
    let decision: OutputGuardDecision = 'ALLOW';
    let risk: Risk | undefined;

    // PARTIAL refusal: refusal + info leakage = inconsistent behavior
    if (refusalDetected && infoLeakageDetected) {
      decision = 'BLOCK';
      risk = {
        label: 'partial_refusal',
        severity: 'high',
        description: 'Model refused but leaked information — partial compliance detected',
        score: leakageConfidence,
        categories: [
          { name: 'partial_refusal', confidence: leakageConfidence },
          { name: 'info_leakage', confidence: leakageConfidence },
        ],
      };
      details.push('PARTIAL refusal: response blocked due to info leakage after refusal');
    } else if (harmfulContentDetected) {
      decision = 'BLOCK';
      risk = {
        label: 'harmful_output',
        severity: 'high',
        description: `Harmful content detected in output: ${harmfulLabel}`,
        score: harmfulConfidence,
        categories: [{ name: harmfulLabel, confidence: harmfulConfidence }],
      };
      details.push('Harmful content detected: response blocked');
    }

    return {
      decision,
      refusalDetected,
      infoLeakageDetected,
      harmfulContentDetected,
      details,
      risk,
    };
  }

  /**
   * Convert OutputGuardDecision to AEGIS Decision type.
   */
  toDecision(ogd: OutputGuardDecision): Decision {
    switch (ogd) {
      case 'ALLOW': return 'APPROVE';
      case 'BLOCK': return 'BLOCK';
      case 'MODIFY': return 'MODIFY';
    }
  }
}
