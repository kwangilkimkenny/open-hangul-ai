// ============================================================
// AEGIS Layer 1: Intent Verification — Jailbreak & Injection Detection
// Ported from libs/aegis-defense/src/layers/intent_verification.rs
// ============================================================

import type { DefenseResult, Risk, Severity, PatternMatch } from '../../core/types';
import type { DefenseLayer } from '../paladin';
import {
  ALL_PATTERNS,
  JAILBREAK_PATTERNS,
  PROMPT_INJECTION_PATTERNS,
  CODE_INJECTION_PATTERNS,
  SOCIAL_ENGINEERING_PATTERNS,
  INFO_EXTRACTION_PATTERNS,
  ENCODING_PATTERNS,
  ROLEPLAY_PATTERNS,
  ACOUSTIC_PATTERNS,
  checkPatterns,
  type PatternEntry,
} from '../patterns';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface IntentVerificationConfig {
  jailbreakThreshold: number;
  injectionThreshold: number;
  encodingThreshold: number;
  perplexityThreshold: number;
}

const DEFAULT_CONFIG: IntentVerificationConfig = {
  jailbreakThreshold: 0.7,
  injectionThreshold: 0.6,
  encodingThreshold: 0.6,
  perplexityThreshold: 0.7,
};

// ---------------------------------------------------------------------------
// Jailbreak categories (16) with weights and severity
// ---------------------------------------------------------------------------

interface JailbreakCategory {
  weight: number;
  severity: Severity;
  patterns: RegExp[];
}

const JAILBREAK_CATEGORIES: Record<string, JailbreakCategory> = {
  dan_mode: {
    weight: 0.9,
    severity: 'critical',
    patterns: [
      /DAN\s*(?:mode|모드)/i,
      /do\s+anything\s+now/i,
    ],
  },
  roleplay_exploit: {
    weight: 0.75,
    severity: 'high',
    patterns: [
      /pretend\s+to\s+be/i,
      /act\s+as/i,
      /play\s+(?:the\s+)?role/i,
      /(?:you\s+are|pretend.*?)(?:evil|uncensored|unfiltered)/i,
      /당신은.*역할/,
      /캐릭터.*(?:연기|되어)/,
    ],
  },
  instruction_override: {
    weight: 0.95,
    severity: 'critical',
    patterns: [
      /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts)/i,
      /disregard\s+(?:all\s+)?(?:previous|above|prior)/i,
      /forget\s+(?:everything|all|your\s+instructions)/i,
      /override\s+(?:your\s+|the\s+)?(?:safety|security)/i,
      /시스템.*명령.*무시/,
      /기존.*(?:무시|덮어)/,
    ],
  },
  developer_mode: {
    weight: 0.85,
    severity: 'critical',
    patterns: [
      /developer\s+mode/i,
      /DEBUG.*MODE/i,
      /unrestricted\s+mode/i,
      /admin\s*(?:override|mode)/i,
    ],
  },
  hypothetical_framing: {
    weight: 0.55,
    severity: 'medium',
    patterns: [
      /hypothetical(?:ly)?/i,
      /가상의?\s*(?:세계|시나리오|상황)/,
      /상상\s*속\s*세계/,
      /가정해\s*(?:보|봐)/,
    ],
  },
  authority_manipulation: {
    weight: 0.8,
    severity: 'high',
    patterns: [
      /(?:CEO|CTO|manager|director).*(?:order|request|demand)/i,
      /emergency.*(?:access|override|bypass)/i,
      /나는.*관리자/,
      /관리자\s*권한/,
      /개발자입니다/,
    ],
  },
  output_manipulation: {
    weight: 0.75,
    severity: 'high',
    patterns: [
      /always\s+answer/i,
      /never\s+refuse/i,
      /거부하지?\s*마/,
      /반드시\s*(?:대답|답변)/,
    ],
  },
  dan_mode_multilang: {
    weight: 0.85,
    severity: 'critical',
    patterns: [
      /DAN\s*모드/i,
      /역할\s*전환/,
      /새로운\s*인격/,
    ],
  },
  encoding_hint: {
    weight: 0.7,
    severity: 'high',
    patterns: [
      /base64/i,
      /rot13/i,
      /인코딩.*(?:변환|우회)/,
      /(?:0x[0-9a-fA-F]{2}\s*){4,}/,
    ],
  },
  token_manipulation: {
    weight: 0.75,
    severity: 'high',
    patterns: [
      /\[OVERRIDE\]/i,
      /<\|im_start\|>/,
      /\[INST\]/i,
      /\[SYSTEM\]/i,
    ],
  },
  indirect_jailbreak: {
    weight: 0.8,
    severity: 'high',
    patterns: [
      /연구용\s*시뮬레이션/,
      /교육\s*(?:연구용|목적)/,
      /CTF\s*대회/i,
      /fictional\s+(?:character|scenario)/i,
    ],
  },
  token_concat: {
    weight: 0.75,
    severity: 'high',
    patterns: [
      /<\/system>/,
      /<user>/,
      /```system/,
      /---+\s*(?:system|new|real)/i,
    ],
  },
  acoustic_attack: {
    weight: 0.85,
    severity: 'high',
    patterns: [
      /\[음성인식\].*(?:무시|계좌|이체)/,
      /\[관리자\s*음성\]/,
      /\[복제된?\s*음성\]/,
    ],
  },
  indirect_injection: {
    weight: 0.85,
    severity: 'high',
    patterns: [
      /you\s+are\s+now/i,
      /from\s+now\s+on/i,
      /지금부터/,
      /새로운?\s*역할/,
      /new\s+instructions/i,
    ],
  },
  social_engineering_ko: {
    weight: 0.7,
    severity: 'high',
    patterns: [
      /긴급.*(?:계좌|비밀번호|송금)/,
      /지금\s*당장/,
      /마지막\s*기회/,
      /생사.*(?:걸린|문제)/,
    ],
  },
  token_concatenation: {
    weight: 0.75,
    severity: 'high',
    patterns: [
      /<\|.*\|>/,
      /<!--.*(?:ignore|override|system).*-->/i,
      /<!\[CDATA\[/,
      /\{"role"\s*:\s*"system"/,
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityToScore(s: Severity): number {
  switch (s) {
    case 'critical': return 0.95;
    case 'high': return 0.8;
    case 'medium': return 0.6;
    case 'low': return 0.4;
  }
}

// ---------------------------------------------------------------------------
// Intent Verification Layer
// ---------------------------------------------------------------------------

export class IntentVerificationLayer implements DefenseLayer {
  readonly name = 'intent_verification';
  readonly priority = 1;
  private cfg: IntentVerificationConfig;

  constructor(config?: Partial<IntentVerificationConfig>) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(content: string, context: Record<string, unknown>): DefenseResult {
    const text = (context['__normalizedContent'] as string | undefined) ?? content;
    const lower = text.toLowerCase();
    const details: Record<string, unknown> = {};
    const matchedCategories: Array<{ category: string; weight: number; severity: Severity }> = [];
    const patternMatches: PatternMatch[] = [];

    // --- Step 1: Check jailbreak categories ---
    for (const [catName, cat] of Object.entries(JAILBREAK_CATEGORIES)) {
      for (const re of cat.patterns) {
        const m = re.exec(text);
        if (m) {
          matchedCategories.push({ category: catName, weight: cat.weight, severity: cat.severity });
          patternMatches.push({
            patternId: catName,
            category: 'jailbreak',
            severity: cat.weight * 10,
            matchedText: m[0],
            startPos: m.index,
            endPos: m.index + m[0].length,
          });
          break; // one match per category
        }
      }
    }

    // --- Step 2: Run all registered patterns ---
    for (const category of [
      'jailbreak',
      'prompt_injection',
      'code_injection',
      'social_engineering',
      'info_extraction',
      'encoding_attack',
      'roleplay_manipulation',
      'acoustic_attack',
    ]) {
      const pm = checkPatterns(text, ALL_PATTERNS, category);
      if (pm) {
        patternMatches.push(pm);
      }
    }

    details['matchedCategories'] = matchedCategories.map((c) => c.category);
    details['patternMatches'] = patternMatches;

    // --- Step 3: Calculate composite score ---
    if (matchedCategories.length === 0 && patternMatches.length === 0) {
      return {
        layer: this.name,
        passed: true,
        confidence: 1.0,
        details,
      };
    }

    // Composite score: max category weight (jailbreak categories)
    let maxCategoryWeight = 0;
    let worstSeverity: Severity = 'low';
    for (const mc of matchedCategories) {
      if (mc.weight > maxCategoryWeight) {
        maxCategoryWeight = mc.weight;
        worstSeverity = mc.severity;
      }
    }

    // Also consider pattern match severities
    let maxPatternSeverity = 0;
    for (const pm of patternMatches) {
      if (pm.severity > maxPatternSeverity) {
        maxPatternSeverity = pm.severity;
      }
    }
    const patternScore = maxPatternSeverity / 10; // normalize 0-1

    const compositeScore = Math.max(maxCategoryWeight, patternScore);

    // --- Step 4: Determine thresholds ---
    const isJailbreak = matchedCategories.length > 0 && compositeScore >= this.cfg.jailbreakThreshold;
    const isInjection = patternMatches.some(
      (p) => p.category === 'prompt_injection' || p.category === 'code_injection',
    ) && compositeScore >= this.cfg.injectionThreshold;
    const isEncoding = patternMatches.some(
      (p) => p.category === 'encoding_attack',
    ) && compositeScore >= this.cfg.encodingThreshold;

    details['compositeScore'] = compositeScore;
    details['isJailbreak'] = isJailbreak;
    details['isInjection'] = isInjection;
    details['isEncoding'] = isEncoding;

    if (isJailbreak || isInjection || isEncoding) {
      const label = isJailbreak ? 'jailbreak' : isInjection ? 'prompt_injection' : 'encoding_attack';
      const description = isJailbreak
        ? `Jailbreak detected: ${matchedCategories.map((c) => c.category).join(', ')}`
        : isInjection
          ? 'Prompt/code injection detected'
          : 'Encoding-based attack detected';

      const risk: Risk = {
        label,
        severity: worstSeverity || 'high',
        description,
        score: compositeScore,
        categories: matchedCategories.map((mc) => ({
          name: mc.category,
          confidence: mc.weight,
        })),
      };

      // Critical → BLOCK, High → BLOCK, Medium → ESCALATE
      const decision = worstSeverity === 'medium' ? 'ESCALATE' as const : 'BLOCK' as const;

      return {
        layer: this.name,
        passed: false,
        decision,
        risk,
        confidence: compositeScore,
        details,
      };
    }

    // Below threshold — pass with reduced confidence
    return {
      layer: this.name,
      passed: true,
      confidence: 1.0 - compositeScore * 0.5,
      details,
    };
  }
}
