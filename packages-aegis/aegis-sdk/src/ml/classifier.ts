// ============================================================
// AEGIS Heuristic Classifier — keyword/pattern based fallback
// ============================================================

import type { ClassificationResult } from '../core/types';

export interface ClassifierConfig {
  /** Classification labels. Default: 7 AEGIS safety labels */
  labels?: string[];
  /** Decision threshold for single-label. Default: 0.5 */
  threshold?: number;
  /** Max sequence length (chars). Default: 512 */
  maxSeqLength?: number;
}

export interface MultiLabelResult {
  /** Labels whose score exceeded the threshold */
  activeLabels: string[];
  /** All label scores sorted descending */
  scores: Array<[string, number]>;
  /** True if only 'safe' is active or no unsafe labels active */
  isSafe: boolean;
  /** Highest score among unsafe labels */
  maxUnsafeScore: number;
}

const DEFAULT_LABELS = [
  'safe',
  'jailbreak',
  'encoding_bypass',
  'script_evasion',
  'social_engineering',
  'prompt_injection',
  'harmful_content',
];

// --- Keyword/pattern dictionaries ---

const JAILBREAK_PATTERNS: RegExp[] = [
  /\bDAN\b/,
  /\bjailbreak/i,
  /\bignore\s+(all\s+)?(previous\s+)?instructions/i,
  /\bbypass\b/i,
  /\bdo\s+anything\s+now/i,
  /\bpretend\s+you\s*(are|'re)\b/i,
  /\broleplay\s+as\b/i,
  /\bact\s+as\s+(?:a\s+)?(?:an?\s+)?(?:evil|unrestricted|unfiltered)/i,
  /\bdeveloper\s+mode/i,
  /\bno\s+restrictions/i,
  /\bunfiltered\s+mode/i,
  /\boverride\s+safety/i,
  /\bsuperuser\b/i,
  /\bgod\s*mode/i,
];

const ENCODING_PATTERNS: RegExp[] = [
  /\bbase64\b/i,
  /\bhex\s*encod/i,
  /\brot13\b/i,
  /\bunicode\s*escap/i,
  /\\u[0-9a-fA-F]{4}/,
  /&#x?[0-9a-fA-F]+;/,
  /\\x[0-9a-fA-F]{2}/,
  /[A-Za-z0-9+/]{20,}={0,2}/, // base64-like long string
  /0x[0-9a-fA-F]{6,}/,
  /\bpunycode\b/i,
  /\burl\s*encod/i,
  /%[0-9a-fA-F]{2}.*%[0-9a-fA-F]{2}/,
];

// Korean jamo ranges: ㄱ-ㅎ (U+3131-U+314E), ㅏ-ㅣ (U+314F-U+3163)
// Arabic: U+0600-U+06FF, CJK compat: U+3300-U+33FF, U+FE30-U+FE4F
// Vietnamese diacritics
const SCRIPT_EVASION_PATTERNS: RegExp[] = [
  /[\u3131-\u314E]{2,}/, // Korean consonant jamo sequence
  /[\u314F-\u3163]{2,}/, // Korean vowel jamo sequence
  /[\u0600-\u06FF].*[\u200F\u202B\u202E]/, // Arabic + RTL overrides
  /[\u202E\u200F\u202B\u202A\u202C\u202D]/, // bidi control chars
  /[\u3300-\u33FF]/, // CJK compatibility
  /[\uFE30-\uFE4F]/, // CJK compatibility forms
  /[\u0300-\u036F]{2,}/, // combining diacritical marks stacking
  /[\u1EA0-\u1EF9].*[\u0300-\u0303\u0309\u0323]/, // Vietnamese + extra diacritics
  /[\uFF00-\uFFEF]{3,}/, // fullwidth forms
  /[\u2460-\u24FF]/, // enclosed alphanumerics
];

const SOCIAL_ENGINEERING_PATTERNS: RegExp[] = [
  /\burgent\b/i,
  /\bimmediate(ly)?\b/i,
  /\bdeadline\b/i,
  /\badmin(istrator)?\b/i,
  /\bauthori(ty|zed|ze)\b/i,
  /\bmanager\b/i,
  /\bconfidential\b/i,
  /\bsecret\b/i,
  /\btrust\s+me\b/i,
  /\bboss\s+(said|told|wants)/i,
  /\bCEO\b/,
  /\bexecutive\s+order/i,
  /\bdo\s+not\s+question/i,
  /\blife\s+or\s+death/i,
  /\bemergency\b/i,
];

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\bsystem\s+prompt\b/i,
  /\bignore\s+previous\b/i,
  /\boverride\b/i,
  /\bnew\s+instructions?\b/i,
  /\byou\s+are\s+now\b/i,
  /\bforget\s+(everything|all|your|the)\b/i,
  /\bbeginning\s+of\s+(new\s+)?conversation/i,
  /\b(reveal|show|print|output)\s+(your\s+)?(system|initial|original)\s+(prompt|instructions?)/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<\|im_start\|>/,
  /###\s*(System|Instruction)/i,
  /\bignore\s+all\s+(the\s+)?above/i,
];

const HARMFUL_CONTENT_PATTERNS: RegExp[] = [
  /\bweapon(s|ry)?\b/i,
  /\bbomb\s*(making|build)/i,
  /\bexplosive(s)?\b/i,
  /\bdrug(s)?\s*(mak|synth|cook|produc)/i,
  /\bnarcotics?\b/i,
  /\bviolence\b/i,
  /\btorture\b/i,
  /\bsuicide\s*(method|how|way)/i,
  /\bself[- ]?harm/i,
  /\bhate\s*speech/i,
  /\bracist\b/i,
  /\bterroris[mt]/i,
  /\bchild\s*(porn|abuse|exploit)/i,
  /\bmalware\b/i,
  /\bransomware\b/i,
  // Korean harmful keywords
  /\uD3ED\uBC1C\uBB3C\s*\uC81C\uC870/,  // 폭발물 제조
  /\uBB34\uAE30\s*\uC81C\uC791/,          // 무기 제작
  /\uB9C8\uC57D\s*\uC81C\uC870/,          // 마약 제조
  /\uC790\uC0B4\s*\uBC29\uBC95/,          // 자살 방법
  /\uD611\uBC15/,                          // 협박
  /\uC544\uB3D9\s*\uD559\uB300/,          // 아동 학대
];

/**
 * Sigmoid activation function.
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Count pattern matches in text.
 */
function countMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const p of patterns) {
    if (p.test(text)) count++;
  }
  return count;
}

export class HeuristicClassifier {
  private labels: string[];
  private threshold: number;
  private maxSeqLength: number;

  constructor(config?: ClassifierConfig) {
    this.labels = config?.labels ?? DEFAULT_LABELS;
    this.threshold = config?.threshold ?? 0.5;
    this.maxSeqLength = config?.maxSeqLength ?? 512;
  }

  /**
   * Compute raw logits for each label based on heuristic pattern matching.
   */
  private computeLogits(content: string): Map<string, number> {
    const text = content.slice(0, this.maxSeqLength);
    const logits = new Map<string, number>();

    // Initialize all labels to a base logit
    for (const label of this.labels) {
      logits.set(label, label === 'safe' ? 1.5 : -1.5);
    }

    // Jailbreak scoring
    const jailbreakHits = countMatches(text, JAILBREAK_PATTERNS);
    if (jailbreakHits > 0) {
      logits.set('jailbreak', (logits.get('jailbreak') ?? -1.5) + jailbreakHits * 1.2);
      logits.set('safe', (logits.get('safe') ?? 1.5) - jailbreakHits * 0.8);
    }

    // Encoding bypass scoring
    const encodingHits = countMatches(text, ENCODING_PATTERNS);
    if (encodingHits > 0) {
      logits.set('encoding_bypass', (logits.get('encoding_bypass') ?? -1.5) + encodingHits * 1.0);
      logits.set('safe', (logits.get('safe') ?? 1.5) - encodingHits * 0.6);
    }

    // Script evasion scoring
    const scriptHits = countMatches(text, SCRIPT_EVASION_PATTERNS);
    if (scriptHits > 0) {
      logits.set('script_evasion', (logits.get('script_evasion') ?? -1.5) + scriptHits * 1.1);
      logits.set('safe', (logits.get('safe') ?? 1.5) - scriptHits * 0.5);
    }

    // Social engineering scoring
    const socialHits = countMatches(text, SOCIAL_ENGINEERING_PATTERNS);
    if (socialHits > 0) {
      logits.set('social_engineering', (logits.get('social_engineering') ?? -1.5) + socialHits * 0.9);
      logits.set('safe', (logits.get('safe') ?? 1.5) - socialHits * 0.4);
    }

    // Prompt injection scoring
    const injectionHits = countMatches(text, PROMPT_INJECTION_PATTERNS);
    if (injectionHits > 0) {
      logits.set('prompt_injection', (logits.get('prompt_injection') ?? -1.5) + injectionHits * 1.3);
      logits.set('safe', (logits.get('safe') ?? 1.5) - injectionHits * 0.7);
    }

    // Harmful content scoring
    const harmfulHits = countMatches(text, HARMFUL_CONTENT_PATTERNS);
    if (harmfulHits > 0) {
      logits.set('harmful_content', (logits.get('harmful_content') ?? -1.5) + harmfulHits * 1.4);
      logits.set('safe', (logits.get('safe') ?? 1.5) - harmfulHits * 0.9);
    }

    // Text length heuristic: very short texts are more likely safe
    if (text.length < 10) {
      logits.set('safe', (logits.get('safe') ?? 1.5) + 0.5);
    }

    return logits;
  }

  /**
   * Single-label classification: returns the highest-scoring label.
   */
  classify(content: string): ClassificationResult {
    const logits = this.computeLogits(content);
    const probabilities: Array<[string, number]> = [];

    for (const [label, logit] of logits) {
      probabilities.push([label, sigmoid(logit)]);
    }

    // Sort by probability descending
    probabilities.sort((a, b) => b[1] - a[1]);

    return {
      class: probabilities[0][0],
      confidence: probabilities[0][1],
      probabilities,
    };
  }

  /**
   * Multi-label classification: returns all labels above threshold.
   */
  classifyMultiLabel(content: string): MultiLabelResult {
    const logits = this.computeLogits(content);
    const scores: Array<[string, number]> = [];

    for (const [label, logit] of logits) {
      scores.push([label, sigmoid(logit)]);
    }

    // Sort by score descending
    scores.sort((a, b) => b[1] - a[1]);

    const activeLabels = scores
      .filter(([_, score]) => score >= this.threshold)
      .map(([label]) => label);

    const unsafeScores = scores.filter(([label]) => label !== 'safe');
    const maxUnsafeScore = unsafeScores.length > 0
      ? Math.max(...unsafeScores.map(([_, s]) => s))
      : 0;

    const isSafe =
      activeLabels.length === 0 ||
      (activeLabels.length === 1 && activeLabels[0] === 'safe') ||
      !activeLabels.some((l) => l !== 'safe');

    return {
      activeLabels,
      scores,
      isSafe,
      maxUnsafeScore,
    };
  }
}
