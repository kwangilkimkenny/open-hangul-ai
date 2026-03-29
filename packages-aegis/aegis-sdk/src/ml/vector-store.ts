// ============================================================
// AEGIS Vector Store — in-memory brute-force cosine similarity
// ============================================================

import { cosineSimilarity } from './embedding';

export interface VectorStoreConfig {
  /** Embedding dimension. Default: 384 */
  dimension?: number;
  /** Max stored vectors. Default: 100000 */
  maxCapacity?: number;
  /** Minimum similarity for search results. Default: 0.0 */
  similarityThreshold?: number;
}

export interface VectorEntry {
  id: string;
  vector: Float32Array;
  content: string;
  metadata: Record<string, string>;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, string>;
}

interface SerializedEntry {
  id: string;
  vector: number[];
  content: string;
  metadata: Record<string, string>;
}

interface SerializedStore {
  dimension: number;
  entries: SerializedEntry[];
}

const DEFAULT_VECTOR_STORE_CONFIG: Required<VectorStoreConfig> = {
  dimension: 384,
  maxCapacity: 100000,
  similarityThreshold: 0.0,
};

export class VectorStore {
  private config: Required<VectorStoreConfig>;
  private entries: Map<string, VectorEntry>;

  constructor(config?: VectorStoreConfig) {
    this.config = { ...DEFAULT_VECTOR_STORE_CONFIG, ...config };
    this.entries = new Map();
  }

  /**
   * Add a vector entry. Validates dimension matches config.
   * Overwrites existing entry with the same id.
   * Throws if store is at max capacity (and id is new).
   */
  add(
    id: string,
    vector: Float32Array,
    content: string,
    metadata: Record<string, string> = {},
  ): void {
    if (vector.length !== this.config.dimension) {
      throw new Error(
        `Dimension mismatch: expected ${this.config.dimension}, got ${vector.length}`,
      );
    }

    if (!this.entries.has(id) && this.entries.size >= this.config.maxCapacity) {
      throw new Error(
        `Vector store at max capacity (${this.config.maxCapacity})`,
      );
    }

    this.entries.set(id, { id, vector, content, metadata });
  }

  /**
   * Remove an entry by id. Returns true if it existed.
   */
  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Get an entry by id.
   */
  get(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Brute-force cosine similarity search. Returns top-K results
   * above the configured similarity threshold, sorted descending by score.
   */
  search(query: Float32Array, topK: number = 10): SearchResult[] {
    if (query.length !== this.config.dimension) {
      throw new Error(
        `Query dimension mismatch: expected ${this.config.dimension}, got ${query.length}`,
      );
    }

    const results: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(query, entry.vector);
      if (score >= this.config.similarityThreshold) {
        results.push({
          id: entry.id,
          score,
          content: entry.content,
          metadata: entry.metadata,
        });
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Search with an additional filter predicate on entries.
   */
  searchWithFilter(
    query: Float32Array,
    topK: number,
    filter: (entry: VectorEntry) => boolean,
  ): SearchResult[] {
    if (query.length !== this.config.dimension) {
      throw new Error(
        `Query dimension mismatch: expected ${this.config.dimension}, got ${query.length}`,
      );
    }

    const results: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      if (!filter(entry)) continue;
      const score = cosineSimilarity(query, entry.vector);
      if (score >= this.config.similarityThreshold) {
        results.push({
          id: entry.id,
          score,
          content: entry.content,
          metadata: entry.metadata,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Serialize the entire store to a JSON string.
   */
  save(): string {
    const serialized: SerializedStore = {
      dimension: this.config.dimension,
      entries: [],
    };

    for (const entry of this.entries.values()) {
      serialized.entries.push({
        id: entry.id,
        vector: Array.from(entry.vector),
        content: entry.content,
        metadata: entry.metadata,
      });
    }

    return JSON.stringify(serialized);
  }

  /**
   * Load entries from a JSON string produced by save().
   * Replaces all current entries.
   */
  load(data: string): void {
    const parsed: SerializedStore = JSON.parse(data);

    if (parsed.dimension !== this.config.dimension) {
      throw new Error(
        `Stored dimension ${parsed.dimension} does not match config dimension ${this.config.dimension}`,
      );
    }

    this.entries.clear();

    for (const entry of parsed.entries) {
      this.entries.set(entry.id, {
        id: entry.id,
        vector: new Float32Array(entry.vector),
        content: entry.content,
        metadata: entry.metadata,
      });
    }
  }

  /**
   * Return the number of stored entries.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Remove all entries.
   */
  clear(): void {
    this.entries.clear();
  }
}
