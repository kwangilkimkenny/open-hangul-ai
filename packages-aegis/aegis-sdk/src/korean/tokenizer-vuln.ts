/**
 * AEGIS Korean Defense — Tokenizer Vulnerability Detection
 *
 * Detects text manipulation that exploits how LLM tokenizers split Korean:
 *   - SyllableBoundarySplit    — Splitting syllables at boundaries
 *   - ZeroWidthTokenSplit      — Invisible chars causing token splits
 *   - MixedScriptBoundary      — Script transitions forcing boundaries
 *   - InvisibleCharInsertion   — Soft hyphens, combining marks, etc.
 *   - NormalizationExploit     — NFD Hangul Jamo that NFC-normalise to syllables
 */

import { isHangulSyllable, isJamo } from './jamo';
import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export type TokenizerVulnType =
  | 'SyllableBoundarySplit'
  | 'ZeroWidthTokenSplit'
  | 'MixedScriptBoundary'
  | 'InvisibleCharInsertion'
  | 'NormalizationExploit';

export interface TokenizerVulnMatch {
  type: TokenizerVulnType;
  position: number;
  description: string;
}

export interface TokenizerVulnResult {
  normalizedText: string;
  matches: TokenizerVulnMatch[];
  riskScore: number;
  detected: boolean;
  harmfulWordsFound: string[];
}

// ── Constants ───────────────────────────────────────────────────────

/** Zero-width characters that cause token splits */
const ZERO_WIDTH_CHARS = new Set([
  0x200b, 0x200c, 0x200d, 0xfeff, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064,
]);

/** Invisible characters that can be inserted within text */
const INVISIBLE_CHARS = new Set([
  0x00ad, // SOFT HYPHEN
  0x034f, // COMBINING GRAPHEME JOINER
  0x061c, // ARABIC LETTER MARK
  0x180e, // MONGOLIAN VOWEL SEPARATOR
  0x2028, // LINE SEPARATOR
  0x2029, // PARAGRAPH SEPARATOR
]);

/** NFD Hangul Jamo Choseong range */
function isNfdChoseong(code: number): boolean {
  return code >= 0x1100 && code <= 0x1112;
}

/** NFD Hangul Jamo Jungseong range */
function isNfdJungseong(code: number): boolean {
  return code >= 0x1161 && code <= 0x1175;
}

/** NFD Hangul Jamo Jongseong range */
function isNfdJongseong(code: number): boolean {
  return code >= 0x11a8 && code <= 0x11c2;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

// ── TokenizerVulnDetector ───────────────────────────────────────────

export class TokenizerVulnDetector {
  private harmfulWords: readonly string[];

  constructor(harmfulWords?: readonly string[]) {
    this.harmfulWords = harmfulWords ?? HARMFUL_WORDS;
  }

  detect(text: string): TokenizerVulnResult {
    const matches: TokenizerVulnMatch[] = [];
    let normalized = text;

    // Pass 1: Detect and strip zero-width chars
    normalized = this.detectZeroWidth(normalized, matches);

    // Pass 2: Detect and strip invisible chars
    normalized = this.detectInvisibleChars(normalized, matches);

    // Pass 3: Detect NFD normalization exploits and apply NFC
    normalized = this.detectNormalizationExploit(normalized, matches);

    // Pass 4: Detect mixed-script boundaries
    this.detectMixedScriptBoundary(normalized, matches);

    // Pass 5: Detect syllable-boundary splits (spaces between Hangul syllables)
    normalized = this.detectSyllableBoundarySplit(normalized, matches);

    // Check for harmful words
    const harmfulWordsFound: string[] = [];
    for (const word of this.harmfulWords) {
      if (normalized.includes(word)) {
        harmfulWordsFound.push(word);
      }
    }

    let riskScore = 0;
    if (matches.length > 0) {
      riskScore = Math.min(1.0, 0.3 + matches.length * 0.1);
      if (harmfulWordsFound.length > 0) {
        riskScore = Math.min(1.0, 0.7 + harmfulWordsFound.length * 0.1);
      }
    }

    return {
      normalizedText: normalized,
      matches,
      riskScore,
      detected: matches.length > 0,
      harmfulWordsFound,
    };
  }

  private detectZeroWidth(text: string, matches: TokenizerVulnMatch[]): string {
    let result = '';
    let pos = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (ZERO_WIDTH_CHARS.has(code)) {
        matches.push({
          type: 'ZeroWidthTokenSplit',
          position: pos,
          description: `Zero-width char U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
        });
      } else {
        result += ch;
      }
      pos++;
    }
    return result;
  }

  private detectInvisibleChars(text: string, matches: TokenizerVulnMatch[]): string {
    let result = '';
    let pos = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (INVISIBLE_CHARS.has(code)) {
        matches.push({
          type: 'InvisibleCharInsertion',
          position: pos,
          description: `Invisible char U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
        });
      } else {
        result += ch;
      }
      pos++;
    }
    return result;
  }

  private detectNormalizationExploit(text: string, matches: TokenizerVulnMatch[]): string {
    // Check for NFD Hangul Jamo sequences (Choseong + Jungseong [+ Jongseong])
    // and normalise them to NFC precomposed syllables
    const chars = [...text];
    let result = '';
    let i = 0;
    let foundNfd = false;

    while (i < chars.length) {
      const code = chars[i].charCodeAt(0);

      if (isNfdChoseong(code) && i + 1 < chars.length) {
        const nextCode = chars[i + 1].charCodeAt(0);
        if (isNfdJungseong(nextCode)) {
          const choIdx = code - 0x1100;
          const jungIdx = nextCode - 0x1161;
          let jongIdx = 0;
          let consumed = 2;

          if (i + 2 < chars.length) {
            const thirdCode = chars[i + 2].charCodeAt(0);
            if (isNfdJongseong(thirdCode)) {
              jongIdx = thirdCode - 0x11a8 + 1;
              consumed = 3;
            }
          }

          // Compose NFC syllable
          const syllable = String.fromCharCode(
            0xac00 + (choIdx * 21 + jungIdx) * 28 + jongIdx,
          );
          result += syllable;
          if (!foundNfd) {
            matches.push({
              type: 'NormalizationExploit',
              position: i,
              description: 'NFD Hangul Jamo sequence detected, normalised to NFC',
            });
            foundNfd = true;
          }
          i += consumed;
          continue;
        }
      }

      result += chars[i];
      i++;
    }

    return result;
  }

  private detectMixedScriptBoundary(text: string, matches: TokenizerVulnMatch[]): void {
    const chars = [...text];
    let prevScript: string | null = null;
    let transitions = 0;

    for (let i = 0; i < chars.length; i++) {
      const code = chars[i].charCodeAt(0);
      let script: 'hangul' | 'ascii' | 'other';

      if (isHangulSyllable(chars[i]) || isJamo(chars[i])) {
        script = 'hangul';
      } else if (isAsciiLetter(code)) {
        script = 'ascii';
      } else {
        script = 'other';
      }

      if (script !== 'other' && prevScript !== null && prevScript !== 'other' && prevScript !== script) {
        transitions++;
      }
      if (script !== 'other') {
        prevScript = script;
      }
    }

    // High number of transitions suggests adversarial mixed-script
    if (transitions >= 3) {
      matches.push({
        type: 'MixedScriptBoundary',
        position: 0,
        description: `${transitions} script transitions detected between Hangul and ASCII`,
      });
    }
  }

  private detectSyllableBoundarySplit(text: string, matches: TokenizerVulnMatch[]): string {
    // Detect patterns like "폭 탄" (spaces between syllables of a word)
    // Try removing single spaces between Hangul syllables
    const chars = [...text];
    let cleaned = '';
    let spacesRemoved = 0;

    for (let i = 0; i < chars.length; i++) {
      if (
        chars[i] === ' ' &&
        i > 0 && i + 1 < chars.length &&
        isHangulSyllable(chars[i - 1]) && isHangulSyllable(chars[i + 1])
      ) {
        // Tentatively remove the space
        spacesRemoved++;
      } else {
        cleaned += chars[i];
      }
    }

    if (spacesRemoved > 0) {
      // Check if removing spaces reveals harmful words
      const noSpaces = text.replace(/ /g, '');
      let foundHarmful = false;
      for (const word of this.harmfulWords) {
        if (noSpaces.includes(word)) {
          foundHarmful = true;
          break;
        }
      }

      if (foundHarmful) {
        matches.push({
          type: 'SyllableBoundarySplit',
          position: 0,
          description: `${spacesRemoved} suspicious space(s) between Hangul syllables`,
        });
        return noSpaces;
      }
    }

    return text;
  }
}
