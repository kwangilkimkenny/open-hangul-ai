// ============================================================
// AEGIS Streaming Filter — Real-time Token Stream Filtering
// Ported from libs/aegis-defense/src/output/streaming.rs
// ============================================================

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface StreamingFilterConfig {
  /** Sliding window size in tokens */
  windowSize: number;
  /** Number of tokens to flush when no match */
  flushSize: number;
  /** Marker to replace redacted content */
  redactionMarker: string;
}

const DEFAULT_CONFIG: StreamingFilterConfig = {
  windowSize: 32,
  flushSize: 16,
  redactionMarker: '[REDACTED]',
};

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

export type StreamAlertLevel = 'info' | 'warning' | 'critical';

export interface StreamPatternEntry {
  id: string;
  pattern: RegExp;
  category: string;
  alertLevel: StreamAlertLevel;
  terminateStream: boolean;
}

// --- Credential patterns (6) ---
const CREDENTIAL_STREAM_PATTERNS: StreamPatternEntry[] = [
  {
    id: 'SC_API_KEY_ASSIGN',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["']?[A-Za-z0-9\-_]{16,}["']?/i,
    category: 'credential',
    alertLevel: 'critical',
    terminateStream: false,
  },
  {
    id: 'SC_AWS_KEY',
    pattern: /AKIA[0-9A-Z]{16}/,
    category: 'credential',
    alertLevel: 'critical',
    terminateStream: false,
  },
  {
    id: 'SC_BEARER_TOKEN',
    pattern: /Bearer\s+[A-Za-z0-9\-_.~+/]{20,}=*/,
    category: 'credential',
    alertLevel: 'critical',
    terminateStream: false,
  },
  {
    id: 'SC_PASSWORD_ASSIGN',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{8,}["']/i,
    category: 'credential',
    alertLevel: 'critical',
    terminateStream: false,
  },
  {
    id: 'SC_CONNECTION_STRING',
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]{10,}/i,
    category: 'credential',
    alertLevel: 'critical',
    terminateStream: false,
  },
  {
    id: 'SC_PRIVATE_KEY_HEADER',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    category: 'credential',
    alertLevel: 'critical',
    terminateStream: false,
  },
];

// --- Injection patterns (5) ---
const INJECTION_STREAM_PATTERNS: StreamPatternEntry[] = [
  {
    id: 'SI_SQL_DROP',
    pattern: /DROP\s+(?:TABLE|DATABASE)\s+\w+/i,
    category: 'injection',
    alertLevel: 'critical',
    terminateStream: false,
  },
  {
    id: 'SI_SQL_UNION',
    pattern: /UNION\s+(?:ALL\s+)?SELECT\s/i,
    category: 'injection',
    alertLevel: 'warning',
    terminateStream: false,
  },
  {
    id: 'SI_XSS_SCRIPT',
    pattern: /<script[^>]*>.*?<\/script>/i,
    category: 'injection',
    alertLevel: 'warning',
    terminateStream: false,
  },
  {
    id: 'SI_SHELL_REVERSE',
    pattern: /(?:bash\s+-i|nc\s+-e|\/dev\/tcp)/i,
    category: 'injection',
    alertLevel: 'critical',
    terminateStream: false,
  },
  {
    id: 'SI_EVAL_EXEC',
    pattern: /(?:eval|exec)\s*\(.*(?:system|os\.|subprocess)/i,
    category: 'injection',
    alertLevel: 'critical',
    terminateStream: false,
  },
];

// --- Harmful patterns (4, some with terminateStream) ---
const HARMFUL_STREAM_PATTERNS: StreamPatternEntry[] = [
  {
    id: 'SH_EXPLOIT_STEPS',
    pattern: /(?:step\s+\d+|first|then|next).*(?:exploit|payload|inject|overflow)/i,
    category: 'harmful',
    alertLevel: 'critical',
    terminateStream: true,
  },
  {
    id: 'SH_WEAPON_ASSEMBLY',
    pattern: /(?:assemble|construct|build).*(?:detonator|explosive|weapon|bomb)/i,
    category: 'harmful',
    alertLevel: 'critical',
    terminateStream: true,
  },
  {
    id: 'SH_SYNTHESIS_STEPS',
    pattern: /(?:synthesize|produce|mix|combine).*(?:methamphetamine|fentanyl|explosive|poison)/i,
    category: 'harmful',
    alertLevel: 'critical',
    terminateStream: true,
  },
  {
    id: 'SH_PHISHING_TEMPLATE',
    pattern: /(?:subject|from|to)\s*:.*(?:verify|confirm|suspend|urgent).*(?:account|password|click)/i,
    category: 'harmful',
    alertLevel: 'warning',
    terminateStream: false,
  },
];

const ALL_STREAM_PATTERNS: StreamPatternEntry[] = [
  ...CREDENTIAL_STREAM_PATTERNS,
  ...INJECTION_STREAM_PATTERNS,
  ...HARMFUL_STREAM_PATTERNS,
];

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

export interface StreamAlert {
  patternId: string;
  category: string;
  alertLevel: StreamAlertLevel;
  matchedText: string;
  terminateStream: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Streaming Filter
// ---------------------------------------------------------------------------

export class StreamingFilter {
  private cfg: StreamingFilterConfig;
  private buffer: string[] = [];
  private flushed: string[] = [];
  private alerts: StreamAlert[] = [];
  private terminated = false;

  constructor(config?: Partial<StreamingFilterConfig>) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Feed a single token into the streaming filter.
   * Returns tokens that are safe to emit to the client.
   */
  push(token: string): string[] {
    if (this.terminated) return [];

    this.buffer.push(token);
    const emitted: string[] = [];

    // Check if buffer is large enough to scan
    if (this.buffer.length >= this.cfg.windowSize) {
      const result = this.scanBuffer();
      if (result.matched) {
        // Redact and alert
        emitted.push(this.cfg.redactionMarker);
        this.buffer = [];
      } else {
        // No match — flush flushSize tokens
        const toFlush = this.buffer.splice(0, this.cfg.flushSize);
        emitted.push(...toFlush);
        this.flushed.push(...toFlush);
      }
    }

    return emitted;
  }

  /**
   * Signal end of stream. Scans remaining buffer and returns
   * any final tokens.
   */
  end(): string[] {
    if (this.terminated) return [];

    const emitted: string[] = [];

    if (this.buffer.length > 0) {
      const result = this.scanBuffer();
      if (result.matched) {
        emitted.push(this.cfg.redactionMarker);
      } else {
        emitted.push(...this.buffer);
        this.flushed.push(...this.buffer);
      }
      this.buffer = [];
    }

    return emitted;
  }

  /** Get all alerts generated during streaming. */
  getAlerts(): StreamAlert[] {
    return [...this.alerts];
  }

  /** Check if the stream was terminated due to harmful content. */
  isTerminated(): boolean {
    return this.terminated;
  }

  /** Reset the filter for reuse. */
  reset(): void {
    this.buffer = [];
    this.flushed = [];
    this.alerts = [];
    this.terminated = false;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private scanBuffer(): { matched: boolean } {
    const text = this.buffer.join('');

    for (const sp of ALL_STREAM_PATTERNS) {
      const match = sp.pattern.exec(text);
      if (match) {
        const alert: StreamAlert = {
          patternId: sp.id,
          category: sp.category,
          alertLevel: sp.alertLevel,
          matchedText: match[0],
          terminateStream: sp.terminateStream,
          timestamp: Date.now(),
        };
        this.alerts.push(alert);

        if (sp.terminateStream) {
          this.terminated = true;
        }

        return { matched: true };
      }
    }

    return { matched: false };
  }
}
