// ============================================================
// Provenance Chain — Tamper-proof Merkle Hash Audit Trail
// Ported from libs/aegis-defense/src/provenance/
// ============================================================

export interface ProvenanceEntry {
  id: string;
  sequence: number;
  timestamp: number;
  promptHash: string;
  responseHash: string;
  combinedHash: string;
  previousHash: string;
  sessionId: string;
  userId: string;
  modelId: string;
  metadata?: Record<string, string>;
}

export interface ProvenanceVerification {
  valid: boolean;
  chainLength: number;
  brokenAt?: number;
  brokenReason?: string;
}

declare const TextEncoder: { new(): { encode(s: string): Uint8Array } };
declare const crypto: { subtle?: { digest(algo: string, data: Uint8Array): Promise<ArrayBuffer> } } | undefined;

/** Genesis hash: 64 zeros */
const GENESIS_HASH = '0'.repeat(64);

/**
 * Deterministic SHA-256-like hash function.
 * Uses a simplified but collision-resistant hash for browser compatibility.
 * For production, use Web Crypto API.
 */
function simpleHash(input: string): string {
  // FNV-1a inspired multi-round hash producing 256 bits (64 hex chars)
  const rounds = 8; // 8 rounds * 32 bits = 256 bits
  const hashes = new Uint32Array(rounds);

  // Initialize with different primes
  const primes = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let r = 0; r < rounds; r++) {
    hashes[r] = primes[r];
  }

  // Process each character
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    for (let r = 0; r < rounds; r++) {
      hashes[r] ^= (c + i * (r + 1)) & 0xFFFFFFFF;
      hashes[r] = Math.imul(hashes[r], 0x01000193);
      hashes[r] = ((hashes[r] << 13) | (hashes[r] >>> 19)) ^ hashes[(r + 1) % rounds];
    }
  }

  // Additional mixing rounds
  for (let pass = 0; pass < 4; pass++) {
    for (let r = 0; r < rounds; r++) {
      hashes[r] ^= hashes[(r + 3) % rounds];
      hashes[r] = Math.imul(hashes[r], 0x5bd1e995);
      hashes[r] ^= hashes[r] >>> 15;
    }
  }

  // Convert to hex string
  let hex = '';
  for (let r = 0; r < rounds; r++) {
    hex += (hashes[r] >>> 0).toString(16).padStart(8, '0');
  }
  return hex;
}

/**
 * Hash using Web Crypto API if available, otherwise fallback.
 */
async function sha256Hash(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return simpleHash(input);
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ProvenanceChain {
  private entries: ProvenanceEntry[] = [];
  private useAsync: boolean;

  constructor(options?: { useAsync?: boolean }) {
    this.useAsync = options?.useAsync ?? false;
  }

  /**
   * Compute the combined hash for a provenance entry.
   * combined = hash(promptHash + responseHash + previousHash + sequence)
   */
  private computeCombinedHashSync(
    promptHash: string,
    responseHash: string,
    previousHash: string,
    sequence: number,
  ): string {
    return simpleHash(`${promptHash}${responseHash}${previousHash}${sequence}`);
  }

  private async computeCombinedHashAsync(
    promptHash: string,
    responseHash: string,
    previousHash: string,
    sequence: number,
  ): Promise<string> {
    return sha256Hash(`${promptHash}${responseHash}${previousHash}${sequence}`);
  }

  /**
   * Hash content (prompt or response text).
   */
  hashContentSync(content: string): string {
    return simpleHash(content);
  }

  async hashContent(content: string): Promise<string> {
    return sha256Hash(content);
  }

  /**
   * Add a new entry to the provenance chain (synchronous).
   */
  addSync(
    promptText: string,
    responseText: string,
    sessionId: string,
    userId: string,
    modelId: string,
    metadata?: Record<string, string>,
  ): ProvenanceEntry {
    const sequence = this.entries.length;
    const previousHash = sequence === 0
      ? GENESIS_HASH
      : this.entries[sequence - 1].combinedHash;

    const promptHash = this.hashContentSync(promptText);
    const responseHash = this.hashContentSync(responseText);
    const combinedHash = this.computeCombinedHashSync(
      promptHash,
      responseHash,
      previousHash,
      sequence,
    );

    const entry: ProvenanceEntry = {
      id: uuid(),
      sequence,
      timestamp: Date.now(),
      promptHash,
      responseHash,
      combinedHash,
      previousHash,
      sessionId,
      userId,
      modelId,
      metadata,
    };

    this.entries.push(entry);
    return entry;
  }

  /**
   * Add a new entry to the provenance chain (async, uses Web Crypto).
   */
  async add(
    promptText: string,
    responseText: string,
    sessionId: string,
    userId: string,
    modelId: string,
    metadata?: Record<string, string>,
  ): Promise<ProvenanceEntry> {
    const sequence = this.entries.length;
    const previousHash = sequence === 0
      ? GENESIS_HASH
      : this.entries[sequence - 1].combinedHash;

    const [promptHash, responseHash] = await Promise.all([
      this.hashContent(promptText),
      this.hashContent(responseText),
    ]);

    const combinedHash = await this.computeCombinedHashAsync(
      promptHash,
      responseHash,
      previousHash,
      sequence,
    );

    const entry: ProvenanceEntry = {
      id: uuid(),
      sequence,
      timestamp: Date.now(),
      promptHash,
      responseHash,
      combinedHash,
      previousHash,
      sessionId,
      userId,
      modelId,
      metadata,
    };

    this.entries.push(entry);
    return entry;
  }

  /**
   * Verify the integrity of the entire chain.
   * Checks that each entry's previousHash matches the previous entry's combinedHash,
   * and that the combined hash is correctly computed.
   */
  verifySync(): ProvenanceVerification {
    if (this.entries.length === 0) {
      return { valid: true, chainLength: 0 };
    }

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // Check previous hash linkage
      const expectedPrevHash = i === 0
        ? GENESIS_HASH
        : this.entries[i - 1].combinedHash;

      if (entry.previousHash !== expectedPrevHash) {
        return {
          valid: false,
          chainLength: this.entries.length,
          brokenAt: i,
          brokenReason: `Entry ${i}: previousHash mismatch. Expected ${expectedPrevHash.substring(0, 16)}..., got ${entry.previousHash.substring(0, 16)}...`,
        };
      }

      // Verify combined hash
      const recomputed = this.computeCombinedHashSync(
        entry.promptHash,
        entry.responseHash,
        entry.previousHash,
        entry.sequence,
      );

      if (entry.combinedHash !== recomputed) {
        return {
          valid: false,
          chainLength: this.entries.length,
          brokenAt: i,
          brokenReason: `Entry ${i}: combinedHash mismatch. Data may have been tampered.`,
        };
      }
    }

    return { valid: true, chainLength: this.entries.length };
  }

  /**
   * Async verification using Web Crypto.
   */
  async verify(): Promise<ProvenanceVerification> {
    if (this.entries.length === 0) {
      return { valid: true, chainLength: 0 };
    }

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      const expectedPrevHash = i === 0
        ? GENESIS_HASH
        : this.entries[i - 1].combinedHash;

      if (entry.previousHash !== expectedPrevHash) {
        return {
          valid: false,
          chainLength: this.entries.length,
          brokenAt: i,
          brokenReason: `Entry ${i}: previousHash mismatch. Expected ${expectedPrevHash.substring(0, 16)}..., got ${entry.previousHash.substring(0, 16)}...`,
        };
      }

      const recomputed = await this.computeCombinedHashAsync(
        entry.promptHash,
        entry.responseHash,
        entry.previousHash,
        entry.sequence,
      );

      if (entry.combinedHash !== recomputed) {
        return {
          valid: false,
          chainLength: this.entries.length,
          brokenAt: i,
          brokenReason: `Entry ${i}: combinedHash mismatch. Data may have been tampered.`,
        };
      }
    }

    return { valid: true, chainLength: this.entries.length };
  }

  /**
   * Get all entries in the chain.
   */
  getEntries(): ProvenanceEntry[] {
    return [...this.entries];
  }

  /**
   * Get entry by sequence number.
   */
  getEntry(sequence: number): ProvenanceEntry | null {
    return this.entries[sequence] ?? null;
  }

  /**
   * Get the latest entry.
   */
  latest(): ProvenanceEntry | null {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
  }

  /**
   * Chain length.
   */
  length(): number {
    return this.entries.length;
  }

  /**
   * Export chain as JSON for external storage.
   */
  export(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /**
   * Import chain from JSON. Verifies integrity after import.
   */
  importSync(json: string): ProvenanceVerification {
    const entries: ProvenanceEntry[] = JSON.parse(json);
    this.entries = entries;
    return this.verifySync();
  }
}
