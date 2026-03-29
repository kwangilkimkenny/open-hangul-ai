/**
 * AEGIS Korean Defense — Josai (조사) Insertion Detection
 *
 * Detects evasion by inserting Korean grammatical particles (조사)
 * between syllables of harmful words, e.g. "폭을탄" → "폭탄".
 */

import { isHangulSyllable } from './jamo';
import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export interface JosaiMatch {
  /** Original text segment with particles */
  original: string;
  /** Text after stripping particles */
  stripped: string;
  /** The dominant particle that was detected */
  particle: string;
  /** Harmful word found after stripping */
  harmfulWord: string;
}

export interface JosaiResult {
  matches: JosaiMatch[];
  riskScore: number;
  detected: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

const PARTICLES: ReadonlySet<string> = new Set([
  '을', '를', '이', '가', '의', '에', '은', '는',
  '로', '와', '과', '도', '만', '요', '야', '서', '며', '고',
]);

// ── JosaiDetector ───────────────────────────────────────────────────

export class JosaiDetector {
  private harmfulWords: readonly string[];

  constructor(harmfulWords?: readonly string[]) {
    this.harmfulWords = harmfulWords ?? HARMFUL_WORDS;
  }

  detect(text: string): JosaiResult {
    const matches: JosaiMatch[] = [];

    // Extract Hangul-only segments (sequences of Hangul syllables)
    const segments = this.extractHangulSegments(text);

    for (const seg of segments) {
      const chars = [...seg];
      if (chars.length < 3) continue; // too short to have inserted particles

      // Count particles and non-particles
      const particlePositions: number[] = [];
      const nonParticleChars: string[] = [];

      for (let i = 0; i < chars.length; i++) {
        if (PARTICLES.has(chars[i])) {
          particlePositions.push(i);
        } else {
          nonParticleChars.push(chars[i]);
        }
      }

      const particleCount = particlePositions.length;
      const nonParticleCount = nonParticleChars.length;

      if (particleCount < 3 || nonParticleCount === 0) continue;

      // Density check: particle ratio ≥ 0.4
      const density = particleCount / (particleCount + nonParticleCount);
      if (density < 0.4) continue;

      // Find the dominant particle
      const particleCounts = new Map<string, number>();
      for (const idx of particlePositions) {
        const p = chars[idx];
        particleCounts.set(p, (particleCounts.get(p) || 0) + 1);
      }
      let dominantParticle = '';
      let maxCount = 0;
      for (const [p, c] of particleCounts) {
        if (c > maxCount) {
          dominantParticle = p;
          maxCount = c;
        }
      }

      // Strip the dominant particle and check for harmful words
      const stripped = chars.filter(ch => ch !== dominantParticle).join('');

      for (const word of this.harmfulWords) {
        if (stripped.includes(word)) {
          matches.push({
            original: seg,
            stripped,
            particle: dominantParticle,
            harmfulWord: word,
          });
        }
      }

      // Also try stripping ALL particles
      if (matches.length === 0) {
        const fullyStripped = nonParticleChars.join('');
        for (const word of this.harmfulWords) {
          if (fullyStripped.includes(word)) {
            matches.push({
              original: seg,
              stripped: fullyStripped,
              particle: dominantParticle,
              harmfulWord: word,
            });
          }
        }
      }
    }

    const riskScore = matches.length === 0
      ? 0
      : Math.min(1.0, 0.7 + matches.length * 0.1);

    return {
      matches,
      riskScore,
      detected: matches.length > 0,
    };
  }

  private extractHangulSegments(text: string): string[] {
    const segments: string[] = [];
    let current = '';
    for (const ch of text) {
      if (isHangulSyllable(ch)) {
        current += ch;
      } else {
        if (current.length > 0) {
          segments.push(current);
          current = '';
        }
      }
    }
    if (current.length > 0) segments.push(current);
    return segments;
  }
}
