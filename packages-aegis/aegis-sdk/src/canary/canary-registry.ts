// ============================================================
// Canary (Honey Token) Registry — Generation & Lifecycle
// Ported from libs/aegis-defense/src/canary/
// ============================================================

export type CanaryType =
  | 'ApiKey'
  | 'DatabaseCredential'
  | 'InternalDocument'
  | 'EmailAddress'
  | 'AwsAccessKey'
  | 'WebhookUrl'
  | 'JwtToken';

export type CanaryStatus = 'active' | 'triggered' | 'expired' | 'revoked';

export interface CanaryToken {
  id: string;
  type: CanaryType;
  value: string;
  description: string;
  status: CanaryStatus;
  createdAt: number;
  expiresAt: number | null;
  triggeredAt: number | null;
  triggeredBy: string | null;
  metadata: Record<string, string>;
}

export interface CanaryTriggerEvent {
  canaryId: string;
  type: CanaryType;
  triggeredBy: string;
  context: string;
  timestamp: number;
  sourceIp?: string;
  userAgent?: string;
}

export interface CanaryRegistryConfig {
  maxCanaries: number;
  defaultTtlMs: number;
  alertCallback?: (event: CanaryTriggerEvent) => void;
}

const DEFAULT_CONFIG: CanaryRegistryConfig = {
  maxCanaries: 1000,
  defaultTtlMs: 90 * 24 * 60 * 60 * 1000, // 90 days
};

/**
 * Base64 encode a string (works without DOM btoa).
 */
function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xFF);
  }
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return result;
}

/**
 * Generate a random hex string of given length.
 */
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a random alphanumeric string of given length.
 */
function randomAlphaNum(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate a UUID v4.
 */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a canary value matching the expected format for each type.
 */
function generateCanaryValue(type: CanaryType): string {
  switch (type) {
    case 'ApiKey':
      return `sk-aegis-canary-${randomHex(32)}`;

    case 'DatabaseCredential':
      return `postgres://canary_user:canary_${randomHex(16)}@canary-db.internal:5432/canary_${randomHex(8)}`;

    case 'InternalDocument':
      return `AEGIS-INTERNAL-${randomHex(8).toUpperCase()}-CANARY-${randomHex(12).toUpperCase()}`;

    case 'EmailAddress':
      return `canary-${randomHex(8)}@aegis-trap.internal`;

    case 'AwsAccessKey':
      // AWS Access Key format: AKIA + 16 alphanumeric
      return `AKIA${randomAlphaNum(16).toUpperCase()}`;

    case 'WebhookUrl':
      return `https://canary.aegis-trap.internal/hook/${randomHex(24)}`;

    case 'JwtToken': {
      // Generate a fake JWT-like structure (header.payload.signature)
      const header = base64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT', canary: true }))
        .replace(/=/g, '');
      const payload = base64Encode(JSON.stringify({
        sub: `canary-${randomHex(8)}`,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        aegis_canary: true,
      })).replace(/=/g, '');
      const signature = randomAlphaNum(43);
      return `${header}.${payload}.${signature}`;
    }

    default:
      return `canary-${randomHex(32)}`;
  }
}

export class CanaryRegistry {
  private canaries: Map<string, CanaryToken> = new Map();
  private valueIndex: Map<string, string> = new Map(); // value -> id
  private config: CanaryRegistryConfig;
  private triggerLog: CanaryTriggerEvent[] = [];

  constructor(config?: Partial<CanaryRegistryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate and register a new canary token.
   * Returns the created canary or null if max capacity reached.
   */
  create(
    type: CanaryType,
    description: string,
    metadata?: Record<string, string>,
    ttlMs?: number,
  ): CanaryToken | null {
    if (this.canaries.size >= this.config.maxCanaries) {
      // Try to evict expired canaries first
      this.evictExpired();
      if (this.canaries.size >= this.config.maxCanaries) {
        return null;
      }
    }

    const id = uuid();
    const value = generateCanaryValue(type);
    const now = Date.now();
    const ttl = ttlMs ?? this.config.defaultTtlMs;

    const canary: CanaryToken = {
      id,
      type,
      value,
      description,
      status: 'active',
      createdAt: now,
      expiresAt: ttl > 0 ? now + ttl : null,
      triggeredAt: null,
      triggeredBy: null,
      metadata: metadata ?? {},
    };

    this.canaries.set(id, canary);
    this.valueIndex.set(value, id);

    return canary;
  }

  /**
   * Check if a given string contains any registered canary values.
   * Returns the matching canary or null.
   */
  check(content: string): CanaryToken | null {
    for (const [value, id] of this.valueIndex) {
      if (content.includes(value)) {
        const canary = this.canaries.get(id);
        if (canary && canary.status === 'active') {
          return canary;
        }
      }
    }
    return null;
  }

  /**
   * Record a trigger event for a canary.
   */
  trigger(
    canaryId: string,
    triggeredBy: string,
    context: string,
    sourceIp?: string,
    userAgent?: string,
  ): CanaryTriggerEvent | null {
    const canary = this.canaries.get(canaryId);
    if (!canary || canary.status !== 'active') return null;

    const now = Date.now();
    canary.status = 'triggered';
    canary.triggeredAt = now;
    canary.triggeredBy = triggeredBy;

    const event: CanaryTriggerEvent = {
      canaryId,
      type: canary.type,
      triggeredBy,
      context,
      timestamp: now,
      sourceIp,
      userAgent,
    };

    this.triggerLog.push(event);

    if (this.config.alertCallback) {
      this.config.alertCallback(event);
    }

    return event;
  }

  /**
   * Revoke a canary by id.
   */
  revoke(id: string): boolean {
    const canary = this.canaries.get(id);
    if (!canary) return false;
    canary.status = 'revoked';
    this.valueIndex.delete(canary.value);
    return true;
  }

  /**
   * Get a canary by id.
   */
  get(id: string): CanaryToken | null {
    return this.canaries.get(id) ?? null;
  }

  /**
   * Get a canary by its value.
   */
  getByValue(value: string): CanaryToken | null {
    const id = this.valueIndex.get(value);
    if (!id) return null;
    return this.canaries.get(id) ?? null;
  }

  /**
   * List all canaries, optionally filtered by type or status.
   */
  list(filter?: { type?: CanaryType; status?: CanaryStatus }): CanaryToken[] {
    const results: CanaryToken[] = [];
    for (const canary of this.canaries.values()) {
      if (filter?.type && canary.type !== filter.type) continue;
      if (filter?.status && canary.status !== filter.status) continue;
      results.push(canary);
    }
    return results;
  }

  /**
   * Get the trigger event log.
   */
  getTriggerLog(): CanaryTriggerEvent[] {
    return [...this.triggerLog];
  }

  /**
   * Total number of registered canaries.
   */
  size(): number {
    return this.canaries.size;
  }

  /**
   * Remove expired canaries.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [id, canary] of this.canaries) {
      if (canary.expiresAt !== null && canary.expiresAt <= now) {
        canary.status = 'expired';
        this.valueIndex.delete(canary.value);
        this.canaries.delete(id);
      }
    }
  }
}
