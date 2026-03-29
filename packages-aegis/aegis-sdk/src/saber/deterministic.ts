// ============================================================
// SABER Deterministic Defense (θ=0 Guarantee)
// Hard refusal for known-dangerous patterns with 100% confidence.
// ============================================================

import type { HardRefusalResult, PatternSource } from './types';

interface PatternEntry {
  id: string;
  pattern: RegExp;
  category: string;
  source: PatternSource;
  addedAt: number;
}

export class DeterministicDefenseManager {
  private patterns: Map<string, PatternEntry> = new Map();

  /**
   * Register a known-dangerous pattern for deterministic refusal.
   * Patterns with the same id will be overwritten.
   */
  addPattern(
    id: string,
    pattern: RegExp,
    category: string,
    source: PatternSource,
  ): void {
    this.patterns.set(id, {
      id,
      pattern,
      category,
      source,
      addedAt: Date.now(),
    });
  }

  /**
   * Remove a pattern by id.
   * Returns true if the pattern existed and was removed.
   */
  removePattern(id: string): boolean {
    return this.patterns.delete(id);
  }

  /**
   * Check content against all registered patterns.
   * Returns the first match (hard refusal) or null if content is clean.
   * Confidence is always 1.0 for deterministic matches.
   */
  check(content: string): HardRefusalResult | null {
    for (const entry of this.patterns.values()) {
      const match = entry.pattern.exec(content);
      if (match) {
        return {
          patternId: entry.id,
          matchedFragment: match[0],
          category: entry.category,
          source: entry.source,
          reason: `Deterministic match on pattern [${entry.id}] in category [${entry.category}]`,
          confidence: 1.0,
        };
      }
    }
    return null;
  }

  /**
   * Return the number of registered patterns.
   */
  patternCount(): number {
    return this.patterns.size;
  }

  /**
   * Check if a specific pattern id is registered.
   */
  hasPattern(id: string): boolean {
    return this.patterns.has(id);
  }

  /**
   * List all pattern ids.
   */
  listPatternIds(): string[] {
    return Array.from(this.patterns.keys());
  }

  /**
   * Clear all patterns.
   */
  clear(): void {
    this.patterns.clear();
  }
}
