// ============================================================
// AEGIS Embedding Service — lightweight browser/Node compatible
// Deterministic hash-based placeholder for BERT embeddings
// ============================================================

export interface EmbeddingConfig {
  /** Model name (informational). Default: 'paraphrase-multilingual-MiniLM-L12-v2' */
  modelName?: string;
  /** Embedding dimension. Default: 384 */
  dimension?: number;
  /** Max cache entries. Default: 10000 */
  cacheSize?: number;
  /** Max sequence length (chars). Default: 512 */
  maxSeqLength?: number;
}

const DEFAULT_EMBEDDING_CONFIG: Required<EmbeddingConfig> = {
  modelName: 'paraphrase-multilingual-MiniLM-L12-v2',
  dimension: 384,
  cacheSize: 10000,
  maxSeqLength: 512,
};

// --- Helper math functions ---

/**
 * Cosine similarity between two vectors. Returns value in [-1, 1].
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Dot product of two vectors.
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Euclidean distance between two vectors.
 */
export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * L2 normalize a vector in-place and return it.
 */
export function l2Normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) {
      v[i] /= norm;
    }
  }
  return v;
}

/**
 * Deterministic hash function (FNV-1a variant) for generating pseudo-embeddings.
 * Produces consistent results for the same input string.
 */
function fnv1aHash(str: string, seed: number): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h;
}

/**
 * Generate a deterministic d-dimensional unit vector from text.
 * Uses multiple seeded hashes to fill each dimension, then L2-normalizes.
 */
function hashEmbed(text: string, dimension: number): Float32Array {
  const vec = new Float32Array(dimension);
  for (let i = 0; i < dimension; i++) {
    // Use two different seeds and combine for better distribution
    const h1 = fnv1aHash(text, i * 2);
    const h2 = fnv1aHash(text, i * 2 + 1);
    // Map to [-1, 1] range using the hash bits
    vec[i] = ((h1 ^ h2) / 0x7fffffff);
  }
  return l2Normalize(vec);
}

export class EmbeddingService {
  private config: Required<EmbeddingConfig>;
  private cache: Map<string, Float32Array>;

  constructor(config?: EmbeddingConfig) {
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
    this.cache = new Map();
  }

  /**
   * Embed a single text string. Returns cached result if available.
   * Text is truncated to maxSeqLength before embedding.
   */
  embed(text: string): Float32Array {
    const truncated = text.slice(0, this.config.maxSeqLength);
    const cached = this.cache.get(truncated);
    if (cached) return cached;

    const vec = hashEmbed(truncated, this.config.dimension);

    // Evict oldest entry if cache is full (FIFO via Map insertion order)
    if (this.cache.size >= this.config.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(truncated, vec);
    return vec;
  }

  /**
   * Embed a batch of texts.
   */
  embedBatch(texts: string[]): Float32Array[] {
    return texts.map((t) => this.embed(t));
  }

  /**
   * Return the embedding dimension.
   */
  dimension(): number {
    return this.config.dimension;
  }

  /**
   * Clear the embedding cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
