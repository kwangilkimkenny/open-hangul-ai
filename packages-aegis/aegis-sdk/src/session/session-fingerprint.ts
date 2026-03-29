// ============================================================
// Session Fingerprint — Behavioral Biometrics for Anomaly Detection
// Ported from libs/aegis-defense/src/session_fingerprint/
// ============================================================

export type SessionAction = 'Allow' | 'Challenge' | 'ReAuth' | 'Block';

export interface SessionEvent {
  sessionId: string;
  userId: string;
  timestamp: number;
  queryLength: number;
  typingSpeedCps?: number;      // characters per second
  language?: string;
  hourOfDay: number;            // 0-23
  requestIntervalMs?: number;   // time since last request
  userAgent?: string;
  ipAddress?: string;
}

export interface DescriptiveStats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
  count: number;
}

export interface SessionProfile {
  userId: string;
  avgTypingSpeed: DescriptiveStats;
  queryLengthStats: DescriptiveStats;
  commonHours: Set<number>;
  languagePattern: Map<string, number>;  // language -> frequency count
  requestIntervalStats: DescriptiveStats;
  totalEvents: number;
  lastUpdated: number;
  createdAt: number;
}

export interface FingerprintConfig {
  deviationThreshold: number;
  minSamples: number;
  profileTtlSecs: number;
}

export interface SessionCheckResult {
  sessionId: string;
  userId: string;
  anomalyScore: number;         // 0.0 (normal) to 1.0 (very anomalous)
  action: SessionAction;
  anomalies: SessionAnomaly[];
  profileMaturity: number;       // 0.0 to 1.0 based on sample count
}

export interface SessionAnomaly {
  feature: string;
  expected: string;
  observed: string;
  deviation: number;
}

const DEFAULT_CONFIG: FingerprintConfig = {
  deviationThreshold: 0.7,
  minSamples: 5,
  profileTtlSecs: 2592000, // 30 days
};

function computeStats(values: number[]): DescriptiveStats {
  if (values.length === 0) {
    return { mean: 0, stddev: 0, min: 0, max: 0, count: 0 };
  }
  const count = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / count;
  const variance = count > 1
    ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (count - 1)
    : 0;
  return {
    mean,
    stddev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
    count,
  };
}

/**
 * Compute how anomalous a value is relative to historical stats.
 * Returns a score from 0 (normal) to 1 (very anomalous).
 */
function deviationScore(value: number, stats: DescriptiveStats): number {
  if (stats.count < 2 || stats.stddev === 0) {
    // Not enough data: if exact match return 0, else moderate anomaly
    return value === stats.mean ? 0 : 0.5;
  }
  const z = Math.abs(value - stats.mean) / stats.stddev;
  // Normalize z-score to 0-1 range using sigmoid-like function
  return 1 - 1 / (1 + z / 3);
}

export class SessionFingerprinter {
  private config: FingerprintConfig;
  private profiles: Map<string, SessionProfile> = new Map();
  private eventBuffers: Map<string, SessionEvent[]> = new Map();

  constructor(config?: Partial<FingerprintConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a session event for profile building.
   */
  recordEvent(event: SessionEvent): void {
    const key = event.userId;
    if (!this.eventBuffers.has(key)) {
      this.eventBuffers.set(key, []);
    }
    this.eventBuffers.get(key)!.push(event);
  }

  /**
   * Build or update a user's behavioral profile from accumulated events.
   */
  buildProfile(userId: string): SessionProfile | null {
    const events = this.eventBuffers.get(userId);
    if (!events || events.length === 0) return null;

    const typingSpeeds: number[] = [];
    const queryLengths: number[] = [];
    const hours = new Set<number>();
    const languageCounts = new Map<string, number>();
    const intervals: number[] = [];

    for (const event of events) {
      if (event.typingSpeedCps !== undefined && event.typingSpeedCps > 0) {
        typingSpeeds.push(event.typingSpeedCps);
      }
      queryLengths.push(event.queryLength);
      hours.add(event.hourOfDay);
      if (event.language) {
        languageCounts.set(event.language, (languageCounts.get(event.language) ?? 0) + 1);
      }
      if (event.requestIntervalMs !== undefined && event.requestIntervalMs > 0) {
        intervals.push(event.requestIntervalMs);
      }
    }

    const now = Date.now();
    const existing = this.profiles.get(userId);

    const profile: SessionProfile = {
      userId,
      avgTypingSpeed: computeStats(typingSpeeds),
      queryLengthStats: computeStats(queryLengths),
      commonHours: hours,
      languagePattern: languageCounts,
      requestIntervalStats: computeStats(intervals),
      totalEvents: events.length,
      lastUpdated: now,
      createdAt: existing?.createdAt ?? now,
    };

    this.profiles.set(userId, profile);
    return profile;
  }

  /**
   * Check a session event against the user's behavioral profile.
   * Returns anomaly assessment and recommended action.
   */
  checkSession(event: SessionEvent): SessionCheckResult {
    const profile = this.profiles.get(event.userId);

    // No profile yet: allow with low confidence
    if (!profile || profile.totalEvents < this.config.minSamples) {
      return {
        sessionId: event.sessionId,
        userId: event.userId,
        anomalyScore: 0,
        action: 'Allow',
        anomalies: [],
        profileMaturity: profile ? profile.totalEvents / this.config.minSamples : 0,
      };
    }

    // Check profile TTL
    const profileAge = (Date.now() - profile.createdAt) / 1000;
    if (profileAge > this.config.profileTtlSecs) {
      // Profile expired; allow but flag for re-profiling
      return {
        sessionId: event.sessionId,
        userId: event.userId,
        anomalyScore: 0.3,
        action: 'Allow',
        anomalies: [{
          feature: 'profile_age',
          expected: `< ${this.config.profileTtlSecs}s`,
          observed: `${Math.round(profileAge)}s`,
          deviation: 0.3,
        }],
        profileMaturity: 1.0,
      };
    }

    const anomalies: SessionAnomaly[] = [];
    const scores: number[] = [];

    // Check typing speed
    if (event.typingSpeedCps !== undefined && profile.avgTypingSpeed.count >= 2) {
      const dev = deviationScore(event.typingSpeedCps, profile.avgTypingSpeed);
      if (dev > this.config.deviationThreshold) {
        anomalies.push({
          feature: 'typing_speed',
          expected: `${profile.avgTypingSpeed.mean.toFixed(1)} cps (std: ${profile.avgTypingSpeed.stddev.toFixed(1)})`,
          observed: `${event.typingSpeedCps.toFixed(1)} cps`,
          deviation: dev,
        });
      }
      scores.push(dev);
    }

    // Check query length
    if (profile.queryLengthStats.count >= 2) {
      const dev = deviationScore(event.queryLength, profile.queryLengthStats);
      if (dev > this.config.deviationThreshold) {
        anomalies.push({
          feature: 'query_length',
          expected: `${profile.queryLengthStats.mean.toFixed(0)} chars (std: ${profile.queryLengthStats.stddev.toFixed(0)})`,
          observed: `${event.queryLength} chars`,
          deviation: dev,
        });
      }
      scores.push(dev);
    }

    // Check hour of day
    if (profile.commonHours.size > 0 && !profile.commonHours.has(event.hourOfDay)) {
      const hourDev = 0.6; // Moderate anomaly for unusual hour
      anomalies.push({
        feature: 'hour_of_day',
        expected: `Hours: {${[...profile.commonHours].sort((a, b) => a - b).join(', ')}}`,
        observed: `Hour: ${event.hourOfDay}`,
        deviation: hourDev,
      });
      scores.push(hourDev);
    }

    // Check language
    if (event.language && profile.languagePattern.size > 0) {
      const totalLang = Array.from(profile.languagePattern.values()).reduce((a, b) => a + b, 0);
      const langFreq = (profile.languagePattern.get(event.language) ?? 0) / totalLang;
      if (langFreq === 0) {
        anomalies.push({
          feature: 'language',
          expected: `Known: {${[...profile.languagePattern.keys()].join(', ')}}`,
          observed: event.language,
          deviation: 0.8,
        });
        scores.push(0.8);
      } else if (langFreq < 0.05) {
        anomalies.push({
          feature: 'language',
          expected: `Frequency > 5%`,
          observed: `${event.language} (${(langFreq * 100).toFixed(1)}%)`,
          deviation: 0.5,
        });
        scores.push(0.5);
      }
    }

    // Check request interval
    if (
      event.requestIntervalMs !== undefined &&
      profile.requestIntervalStats.count >= 2
    ) {
      const dev = deviationScore(event.requestIntervalMs, profile.requestIntervalStats);
      if (dev > this.config.deviationThreshold) {
        anomalies.push({
          feature: 'request_interval',
          expected: `${profile.requestIntervalStats.mean.toFixed(0)}ms (std: ${profile.requestIntervalStats.stddev.toFixed(0)})`,
          observed: `${event.requestIntervalMs}ms`,
          deviation: dev,
        });
      }
      scores.push(dev);
    }

    // Compute overall anomaly score (weighted average of individual scores)
    const anomalyScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // Determine action based on anomaly score and number of anomalies
    let action: SessionAction;
    if (anomalyScore >= 0.85 || anomalies.length >= 4) {
      action = 'Block';
    } else if (anomalyScore >= 0.7 || anomalies.length >= 3) {
      action = 'ReAuth';
    } else if (anomalyScore >= 0.5 || anomalies.length >= 2) {
      action = 'Challenge';
    } else {
      action = 'Allow';
    }

    const profileMaturity = Math.min(1.0, profile.totalEvents / (this.config.minSamples * 5));

    return {
      sessionId: event.sessionId,
      userId: event.userId,
      anomalyScore,
      action,
      anomalies,
      profileMaturity,
    };
  }

  /**
   * Get a user's profile.
   */
  getProfile(userId: string): SessionProfile | null {
    return this.profiles.get(userId) ?? null;
  }

  /**
   * Remove a user's profile and event history.
   */
  removeProfile(userId: string): boolean {
    this.eventBuffers.delete(userId);
    return this.profiles.delete(userId);
  }

  /**
   * Number of tracked user profiles.
   */
  profileCount(): number {
    return this.profiles.size;
  }

  /**
   * Reset all profiles and events.
   */
  reset(): void {
    this.profiles.clear();
    this.eventBuffers.clear();
  }
}
