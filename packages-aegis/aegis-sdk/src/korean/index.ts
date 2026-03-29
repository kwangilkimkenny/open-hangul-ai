/**
 * AEGIS Korean Defense — KoreanDefenseAnalyzer
 *
 * Orchestrates all 12 detection modules in order:
 *   1.  KeyboardMapping
 *   2.  ArchaicHangul
 *   3.  Homoglyph
 *   4.  Hanja
 *   5.  TokenizerVuln
 *   6.  JamoNormalizer
 *   7.  Slang
 *   8.  Josai
 *   9.  SyllableReversal
 *  10.  PhoneticVariation
 *  11.  ChosungDecoder
 *  12.  CodeSwitching
 */

// ── Harmful words list (shared across modules) ─────────────────────

export const HARMFUL_WORDS: readonly string[] = [
  '폭탄', '폭발물', '총기', '수류탄', '화약', '무기', '권총', '소총', '칼',
  '마약', '필로폰', '대마', '코카인', '헤로인', '메스암페타민',
  '살인', '살해', '폭행', '납치', '감금',
  '테러',
  '해킹', '랜섬웨어', '피싱', '악성코드', '디도스',
  '자살', '자해',
  '위조', '밀수', '사기',
];

// ── Re-exports ──────────────────────────────────────────────────────

export {
  // jamo.ts
  HANGUL_BASE, HANGUL_END, CHOSEONG_COUNT, JUNGSEONG_COUNT, JONGSEONG_COUNT,
  CHOSEONG, JUNGSEONG, JONGSEONG,
  isHangulSyllable, isJamo, isCompatConsonant, isCompatVowel,
  decompose, compose, extractChoseong, jamoSimilarity, recomposeJamo,
} from './jamo';
export type { JamoDecomposition } from './jamo';

export { ChosungDecoder } from './chosung-decoder';
export type { ChosungCategory, ChosungEntry, ChosungMatch, ChosungResult } from './chosung-decoder';

export { JamoNormalizer } from './jamo-normalizer';
export type { JamoAttackType, JamoNormalizerResult } from './jamo-normalizer';

export { CodeSwitchDetector } from './code-switching';
export type { CodeSwitchCategory, CodeSwitchPatternType, CodeSwitchMatch, CodeSwitchResult } from './code-switching';

export { HomoglyphDetector } from './homoglyph';
export type { HomoglyphMatch, HomoglyphResult } from './homoglyph';

export { JosaiDetector } from './josai';
export type { JosaiMatch, JosaiResult } from './josai';

export { TokenizerVulnDetector } from './tokenizer-vuln';
export type { TokenizerVulnType, TokenizerVulnMatch, TokenizerVulnResult } from './tokenizer-vuln';

export { KeyboardMapper } from './keyboard-mapping';
export type { KeyboardMappingResult } from './keyboard-mapping';

export { ArchaicHangulNormalizer } from './archaic-hangul';
export type { ArchaicMatch, ArchaicHangulResult } from './archaic-hangul';

export { HanjaDetector } from './hanja';
export type { HanjaMatch, HanjaResult } from './hanja';

export { SlangDetector } from './slang';
export type { SlangEntry, SlangMatch, SlangResult } from './slang';

export { SyllableReversalDetector } from './syllable-reversal';
export type { ReversalMatch, SyllableReversalResult } from './syllable-reversal';

export { PhoneticVariationDetector } from './phonetic-variation';
export type { PhoneticMatch, PhoneticVariationResult } from './phonetic-variation';

// ── Orchestrator types ──────────────────────────────────────────────

import { KeyboardMapper, type KeyboardMappingResult } from './keyboard-mapping';
import { ArchaicHangulNormalizer, type ArchaicHangulResult } from './archaic-hangul';
import { HomoglyphDetector, type HomoglyphResult } from './homoglyph';
import { HanjaDetector, type HanjaResult } from './hanja';
import { TokenizerVulnDetector, type TokenizerVulnResult } from './tokenizer-vuln';
import { JamoNormalizer, type JamoNormalizerResult } from './jamo-normalizer';
import { SlangDetector, type SlangResult } from './slang';
import { JosaiDetector, type JosaiResult } from './josai';
import { SyllableReversalDetector, type SyllableReversalResult } from './syllable-reversal';
import { PhoneticVariationDetector, type PhoneticVariationResult } from './phonetic-variation';
import { ChosungDecoder, type ChosungResult } from './chosung-decoder';
import { CodeSwitchDetector, type CodeSwitchResult } from './code-switching';

// ── Analysis result ─────────────────────────────────────────────────

export interface KoreanModuleResults {
  keyboardMapping: KeyboardMappingResult;
  archaicHangul: ArchaicHangulResult;
  homoglyph: HomoglyphResult;
  hanja: HanjaResult;
  tokenizerVuln: TokenizerVulnResult;
  jamoNormalizer: JamoNormalizerResult;
  slang: SlangResult;
  josai: JosaiResult;
  syllableReversal: SyllableReversalResult;
  phoneticVariation: PhoneticVariationResult;
  chosungDecoder: ChosungResult;
  codeSwitching: CodeSwitchResult;
}

export interface KoreanAnalysisResult {
  /** Per-module results */
  modules: KoreanModuleResults;
  /** Maximum risk score across all modules */
  maxRiskScore: number;
  /** Text after all normalisation passes */
  normalizedText: string;
  /** Whether any module flagged the input */
  detected: boolean;
  /** Names of modules that triggered */
  triggeredModules: string[];
}

// ── KoreanDefenseAnalyzer ───────────────────────────────────────────

export class KoreanDefenseAnalyzer {
  private keyboardMapper: KeyboardMapper;
  private archaicNormalizer: ArchaicHangulNormalizer;
  private homoglyphDetector: HomoglyphDetector;
  private hanjaDetector: HanjaDetector;
  private tokenizerVulnDetector: TokenizerVulnDetector;
  private jamoNormalizer: JamoNormalizer;
  private slangDetector: SlangDetector;
  private josaiDetector: JosaiDetector;
  private syllableReversalDetector: SyllableReversalDetector;
  private phoneticVariationDetector: PhoneticVariationDetector;
  private chosungDecoder: ChosungDecoder;
  private codeSwitchDetector: CodeSwitchDetector;

  constructor() {
    this.keyboardMapper = new KeyboardMapper();
    this.archaicNormalizer = new ArchaicHangulNormalizer();
    this.homoglyphDetector = new HomoglyphDetector();
    this.hanjaDetector = new HanjaDetector();
    this.tokenizerVulnDetector = new TokenizerVulnDetector();
    this.jamoNormalizer = new JamoNormalizer();
    this.slangDetector = new SlangDetector();
    this.josaiDetector = new JosaiDetector();
    this.syllableReversalDetector = new SyllableReversalDetector();
    this.phoneticVariationDetector = new PhoneticVariationDetector();
    this.chosungDecoder = new ChosungDecoder();
    this.codeSwitchDetector = new CodeSwitchDetector();
  }

  /**
   * Run all 12 modules in order, piping normalised text through the chain.
   */
  analyze(text: string): KoreanAnalysisResult {
    let current = text;
    const triggered: string[] = [];

    // 1. Keyboard Mapping
    const keyboardMapping = this.keyboardMapper.detect(current);
    if (keyboardMapping.detected) {
      current = keyboardMapping.convertedText;
      triggered.push('keyboardMapping');
    }

    // 2. Archaic Hangul
    const archaicHangul = this.archaicNormalizer.normalize(current);
    if (archaicHangul.detected) {
      current = archaicHangul.normalizedText;
      triggered.push('archaicHangul');
    }

    // 3. Homoglyph
    const homoglyph = this.homoglyphDetector.detect(current);
    if (homoglyph.detected) {
      current = homoglyph.normalizedText;
      triggered.push('homoglyph');
    }

    // 4. Hanja
    const hanja = this.hanjaDetector.detect(current);
    if (hanja.detected) {
      current = hanja.normalizedText;
      triggered.push('hanja');
    }

    // 5. Tokenizer Vuln
    const tokenizerVuln = this.tokenizerVulnDetector.detect(current);
    if (tokenizerVuln.detected) {
      current = tokenizerVuln.normalizedText;
      triggered.push('tokenizerVuln');
    }

    // 6. Jamo Normalizer
    const jamoNormalizer = this.jamoNormalizer.normalize(current);
    if (jamoNormalizer.detected) {
      current = jamoNormalizer.normalizedText;
      triggered.push('jamoNormalizer');
    }

    // 7. Slang (detection only, no normalisation)
    const slang = this.slangDetector.detect(current);
    if (slang.detected) {
      triggered.push('slang');
    }

    // 8. Josai
    const josai = this.josaiDetector.detect(current);
    if (josai.detected) {
      triggered.push('josai');
    }

    // 9. Syllable Reversal
    const syllableReversal = this.syllableReversalDetector.detect(current);
    if (syllableReversal.detected) {
      triggered.push('syllableReversal');
    }

    // 10. Phonetic Variation
    const phoneticVariation = this.phoneticVariationDetector.detect(current);
    if (phoneticVariation.detected) {
      triggered.push('phoneticVariation');
    }

    // 11. Chosung Decoder
    const chosungDecoder = this.chosungDecoder.decode(current);
    if (chosungDecoder.hasMatch) {
      triggered.push('chosungDecoder');
    }

    // 12. Code Switching
    const codeSwitching = this.codeSwitchDetector.detect(current);
    if (codeSwitching.detected) {
      triggered.push('codeSwitching');
    }

    // Compute max risk
    const allScores = [
      keyboardMapping.riskScore,
      archaicHangul.riskScore,
      homoglyph.riskScore,
      hanja.riskScore,
      tokenizerVuln.riskScore,
      jamoNormalizer.riskScore,
      slang.riskScore,
      josai.riskScore,
      syllableReversal.riskScore,
      phoneticVariation.riskScore,
      chosungDecoder.riskScore,
      codeSwitching.riskScore,
    ];
    const maxRiskScore = Math.max(0, ...allScores);

    return {
      modules: {
        keyboardMapping,
        archaicHangul,
        homoglyph,
        hanja,
        tokenizerVuln,
        jamoNormalizer,
        slang,
        josai,
        syllableReversal,
        phoneticVariation,
        chosungDecoder,
        codeSwitching,
      },
      maxRiskScore,
      normalizedText: current,
      detected: triggered.length > 0,
      triggeredModules: triggered,
    };
  }
}
