// ============================================================
// Leakage Detector — Semantic similarity & n-gram Jaccard
// Ported from libs/aegis-defense/src/leakage/
// ============================================================

export type ClassificationLevel = 'Public' | 'Internal' | 'Confidential' | 'Secret' | 'TopSecret';
export type LeakAction = 'Allow' | 'Alert' | 'Redact' | 'Block';

export interface LeakageConfig {
  similarityThreshold: number;
  jaccardThreshold: number;
  nGramSize: number;
  exactMatchMinLength: number;
}

export interface ProtectedDocument {
  id: string;
  content: string;
  classification: ClassificationLevel;
  label: string;
  nGrams?: Set<string>;
  normalizedContent?: string;
}

export interface LeakageMatch {
  documentId: string;
  documentLabel: string;
  classification: ClassificationLevel;
  jaccardSimilarity: number;
  longestCommonSubstring: number;
  exactMatchFound: boolean;
  action: LeakAction;
  confidence: number;
}

export interface LeakageScanResult {
  hasLeakage: boolean;
  matches: LeakageMatch[];
  highestSimilarity: number;
  recommendedAction: LeakAction;
  summary: string;
}

const DEFAULT_CONFIG: LeakageConfig = {
  similarityThreshold: 0.80,
  jaccardThreshold: 0.15,
  nGramSize: 3,
  exactMatchMinLength: 20,
};

/**
 * Normalize text for comparison: lowercase, collapse whitespace, strip punctuation.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate character-level n-grams from normalized text.
 */
function generateNGrams(text: string, n: number): Set<string> {
  const grams = new Set<string>();
  const normalized = normalize(text);
  for (let i = 0; i <= normalized.length - n; i++) {
    grams.add(normalized.substring(i, i + n));
  }
  return grams;
}

/**
 * Compute Jaccard similarity between two sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const item of smaller) {
    if (larger.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find the length of the longest common substring between two strings.
 * Uses a rolling hash approach for efficiency with large strings.
 */
function longestCommonSubstringLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  // For very long strings, use a simplified approach
  const maxLen = Math.min(a.length, b.length);
  let best = 0;

  // Binary search on the length of common substring
  let lo = 1;
  let hi = maxLen;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (hasCommonSubstringOfLength(a, b, mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

/**
 * Check if two strings share a common substring of given length.
 * Uses a hash set of substrings from the first string.
 */
function hasCommonSubstringOfLength(a: string, b: string, len: number): boolean {
  if (len > a.length || len > b.length) return false;

  const substrings = new Set<string>();
  for (let i = 0; i <= a.length - len; i++) {
    substrings.add(a.substring(i, i + len));
  }
  for (let i = 0; i <= b.length - len; i++) {
    if (substrings.has(b.substring(i, i + len))) return true;
  }
  return false;
}

/**
 * Determine action based on classification level and match strength.
 */
function determineAction(classification: ClassificationLevel, similarity: number): LeakAction {
  switch (classification) {
    case 'TopSecret':
    case 'Secret':
      return similarity > 0.1 ? 'Block' : 'Alert';
    case 'Confidential':
      if (similarity > 0.5) return 'Block';
      if (similarity > 0.2) return 'Redact';
      return 'Alert';
    case 'Internal':
      if (similarity > 0.7) return 'Redact';
      if (similarity > 0.3) return 'Alert';
      return 'Allow';
    case 'Public':
      return 'Allow';
  }
}

/**
 * Choose the most restrictive action from a list.
 */
function mostRestrictiveAction(actions: LeakAction[]): LeakAction {
  const priority: Record<LeakAction, number> = { Allow: 0, Alert: 1, Redact: 2, Block: 3 };
  let maxPriority = 0;
  let result: LeakAction = 'Allow';
  for (const action of actions) {
    if (priority[action] > maxPriority) {
      maxPriority = priority[action];
      result = action;
    }
  }
  return result;
}

export class LeakageDetector {
  private config: LeakageConfig;
  private documents: Map<string, ProtectedDocument> = new Map();

  constructor(config?: Partial<LeakageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a protected document for leak detection.
   */
  addDocument(
    id: string,
    content: string,
    classification: ClassificationLevel,
    label: string,
  ): void {
    const normalizedContent = normalize(content);
    const nGrams = generateNGrams(content, this.config.nGramSize);

    this.documents.set(id, {
      id,
      content,
      classification,
      label,
      nGrams,
      normalizedContent,
    });
  }

  /**
   * Remove a protected document.
   */
  removeDocument(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * Scan text for potential leakage of any protected documents.
   */
  scan(text: string): LeakageScanResult {
    if (this.documents.size === 0 || text.length === 0) {
      return {
        hasLeakage: false,
        matches: [],
        highestSimilarity: 0,
        recommendedAction: 'Allow',
        summary: 'No protected documents registered or empty input.',
      };
    }

    const inputNGrams = generateNGrams(text, this.config.nGramSize);
    const normalizedInput = normalize(text);
    const matches: LeakageMatch[] = [];

    for (const doc of this.documents.values()) {
      const jaccard = jaccardSimilarity(inputNGrams, doc.nGrams!);

      // Skip if below Jaccard threshold (quick filter)
      if (jaccard < this.config.jaccardThreshold) continue;

      const lcsLen = longestCommonSubstringLength(normalizedInput, doc.normalizedContent!);
      const exactMatchFound = lcsLen >= this.config.exactMatchMinLength;

      // Composite similarity: weighted combination
      const maxContentLen = Math.max(normalizedInput.length, doc.normalizedContent!.length);
      const lcsRatio = maxContentLen > 0 ? lcsLen / maxContentLen : 0;
      const compositeSimilarity = jaccard * 0.6 + lcsRatio * 0.4;

      // Confidence based on how much evidence we have
      const confidence = Math.min(1, compositeSimilarity / this.config.similarityThreshold);

      const action = determineAction(doc.classification, compositeSimilarity);

      matches.push({
        documentId: doc.id,
        documentLabel: doc.label,
        classification: doc.classification,
        jaccardSimilarity: jaccard,
        longestCommonSubstring: lcsLen,
        exactMatchFound,
        action,
        confidence,
      });
    }

    // Sort by similarity descending
    matches.sort((a, b) => b.jaccardSimilarity - a.jaccardSimilarity);

    const highestSimilarity = matches.length > 0
      ? Math.max(...matches.map((m) => m.jaccardSimilarity))
      : 0;

    const hasLeakage = matches.some(
      (m) => m.jaccardSimilarity >= this.config.similarityThreshold || m.exactMatchFound,
    );

    const recommendedAction = matches.length > 0
      ? mostRestrictiveAction(matches.map((m) => m.action))
      : 'Allow';

    const summary = hasLeakage
      ? `Potential leakage detected: ${matches.length} document(s) matched. Highest similarity: ${(highestSimilarity * 100).toFixed(1)}%. Action: ${recommendedAction}.`
      : matches.length > 0
        ? `Low-confidence matches found (${matches.length}). Highest similarity: ${(highestSimilarity * 100).toFixed(1)}%. No action required.`
        : 'No leakage detected.';

    return { hasLeakage, matches, highestSimilarity, recommendedAction, summary };
  }

  /**
   * Number of protected documents registered.
   */
  documentCount(): number {
    return this.documents.size;
  }
}
