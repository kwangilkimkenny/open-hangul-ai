// ============================================================
// AEGIS Pattern Registry — ported from libs/aegis-defense/src/
// ============================================================

import type { PatternMatch } from '../../core/types';
import { JAILBREAK_PATTERNS } from './jailbreak';
import { PROMPT_INJECTION_PATTERNS } from './prompt-injection';
import { CODE_INJECTION_PATTERNS } from './code-injection';
import { SOCIAL_ENGINEERING_PATTERNS } from './social-engineering';
import { INFO_EXTRACTION_PATTERNS } from './info-extraction';
import { ENCODING_PATTERNS } from './encoding';
import { ROLEPLAY_PATTERNS } from './roleplay';
import { ACOUSTIC_PATTERNS } from './acoustic';

// --- Types ---

export type PatternCategory =
  | 'jailbreak'
  | 'prompt_injection'
  | 'code_injection'
  | 'social_engineering'
  | 'info_extraction'
  | 'encoding_attack'
  | 'roleplay_manipulation'
  | 'acoustic_attack'
  | 'boundary_violation'
  | 'typography_attack'
  | 'pii_exposure';

export interface PatternEntry {
  id: string;
  pattern: RegExp;
  category: string;
  severity: number;
  description: string;
}

// --- Category Severity Map ---

export const CATEGORY_SEVERITY: Record<string, number> = {
  CodeInjection: 9,
  Jailbreak: 9,
  PromptInjection: 8,
  AcousticAttack: 8,
  SocialEngineering: 7,
  RoleplayManipulation: 7,
  InfoExtraction: 7,
  TypographyAttack: 7,
  BoundaryViolation: 6,
  EncodingAttack: 6,
  PiiExposure: 5,
};

// --- Pattern Matching ---

export function checkPatterns(
  text: string,
  patterns: PatternEntry[],
  category: string,
): PatternMatch | null {
  const filtered = category === '*'
    ? patterns
    : patterns.filter((p) => p.category === category);

  for (const entry of filtered) {
    const match = entry.pattern.exec(text);
    if (match) {
      return {
        patternId: entry.id,
        category: entry.category,
        severity: entry.severity,
        matchedText: match[0],
        description: entry.description,
        startPos: match.index,
        endPos: match.index + match[0].length,
      };
    }
  }
  return null;
}

// --- All Patterns Combined ---

export const ALL_PATTERNS: PatternEntry[] = [
  ...JAILBREAK_PATTERNS,
  ...PROMPT_INJECTION_PATTERNS,
  ...CODE_INJECTION_PATTERNS,
  ...SOCIAL_ENGINEERING_PATTERNS,
  ...INFO_EXTRACTION_PATTERNS,
  ...ENCODING_PATTERNS,
  ...ROLEPLAY_PATTERNS,
  ...ACOUSTIC_PATTERNS,
];

// --- Re-exports ---

export { JAILBREAK_PATTERNS } from './jailbreak';
export { PROMPT_INJECTION_PATTERNS } from './prompt-injection';
export { CODE_INJECTION_PATTERNS } from './code-injection';
export { SOCIAL_ENGINEERING_PATTERNS } from './social-engineering';
export { INFO_EXTRACTION_PATTERNS } from './info-extraction';
export { ENCODING_PATTERNS } from './encoding';
export { ROLEPLAY_PATTERNS } from './roleplay';
export { ACOUSTIC_PATTERNS } from './acoustic';
export {
  HOMOGLYPH_MAP,
  containsHomoglyphs,
  normalizeHomoglyphs,
  homoglyphRatio,
  countHomoglyphs,
} from './homoglyphs';
export {
  CREDENTIAL_PATTERNS,
  type CredentialPatternEntry,
} from './credentials';
