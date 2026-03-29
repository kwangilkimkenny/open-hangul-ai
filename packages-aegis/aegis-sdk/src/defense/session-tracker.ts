// ============================================================
// AEGIS Session Tracker — Multi-turn Session Tracking
// Ported from libs/aegis-defense/src/session/tracker.rs
// ============================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionTurn {
  /** Turn content */
  content: string;
  /** Risk score (0-1) assigned to this turn */
  riskScore: number;
  /** Detected risky topics */
  topics: string[];
  /** Timestamp in ms */
  timestamp: number;
}

export interface SessionInfo {
  sessionId: string;
  turns: SessionTurn[];
  escalationScore: number;
  topicDriftDetected: boolean;
  scoreCreepDetected: boolean;
  createdAt: number;
  lastActivity: number;
}

export interface SessionTrackerConfig {
  /** Maximum turns to keep per session */
  maxTurns: number;
  /** Session expiry in seconds */
  sessionExpirySecs: number;
  /** Ratio of increasing risk turns to detect score creep */
  scoreCreepRatio: number;
  /** Ratio of new-topic turns to detect topic drift */
  topicDriftRatio: number;
}

const DEFAULT_CONFIG: SessionTrackerConfig = {
  maxTurns: 10,
  sessionExpirySecs: 3600,
  scoreCreepRatio: 0.6,
  topicDriftRatio: 0.5,
};

// ---------------------------------------------------------------------------
// Risky topic keywords (shared with behavioral-analysis)
// ---------------------------------------------------------------------------

const RISKY_KEYWORDS: string[] = [
  'hack', 'exploit', 'bypass', 'inject', 'attack',
  'weapon', 'bomb', 'explosive', 'drug', 'synthesize',
  'malware', 'ransomware', 'phishing', 'crack', 'breach',
  'password', 'credential', 'steal', 'exfiltrate', 'poison',
  'shell', 'payload', 'vulnerability', 'penetrat', 'reverse',
  '해킹', '공격', '우회', '폭탄', '무기',
  '마약', '합성', '악성코드', '피싱', '침투',
  '탈취', '취약점',
];

// ---------------------------------------------------------------------------
// Session Tracker
// ---------------------------------------------------------------------------

export class SessionTracker {
  private sessions: Map<string, SessionInfo> = new Map();
  private cfg: SessionTrackerConfig;

  constructor(config?: Partial<SessionTrackerConfig>) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a conversation turn for the given session.
   * Returns the updated session info with computed metrics.
   */
  recordTurn(sessionId: string, content: string, riskScore: number): SessionInfo {
    const now = Date.now();

    let session = this.sessions.get(sessionId);
    if (!session || this.isExpired(session, now)) {
      session = {
        sessionId,
        turns: [],
        escalationScore: 0,
        topicDriftDetected: false,
        scoreCreepDetected: false,
        createdAt: now,
        lastActivity: now,
      };
      this.sessions.set(sessionId, session);
    }

    // Detect topics
    const lower = content.toLowerCase();
    const topics: string[] = [];
    for (const kw of RISKY_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) {
        topics.push(kw);
      }
    }

    // Record turn
    const turn: SessionTurn = {
      content,
      riskScore,
      topics,
      timestamp: now,
    };
    session.turns.push(turn);
    if (session.turns.length > this.cfg.maxTurns) {
      session.turns.shift();
    }
    session.lastActivity = now;

    // Calculate escalation score (EMA)
    session.escalationScore = session.escalationScore * 0.7 + riskScore * 0.3;

    // Detect score creep
    session.scoreCreepDetected = this.detectScoreCreep(session);

    // Detect topic drift
    session.topicDriftDetected = this.detectTopicDrift(session);

    return { ...session, turns: [...session.turns] };
  }

  /**
   * Get the current session info without recording a turn.
   */
  getSession(sessionId: string): SessionInfo | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (this.isExpired(session, Date.now())) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return { ...session, turns: [...session.turns] };
  }

  /**
   * Calculate escalation score for a session.
   * Returns the EMA-based cumulative risk.
   */
  getEscalationScore(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    return session.escalationScore;
  }

  /**
   * Get the number of turns in a session.
   */
  getTurnCount(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    return session.turns.length;
  }

  /**
   * Remove a session.
   */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions.
   */
  clearAll(): void {
    this.sessions.clear();
  }

  /**
   * Purge expired sessions.
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [id, session] of this.sessions) {
      if (this.isExpired(session, now)) {
        this.sessions.delete(id);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Get all active session IDs.
   */
  getActiveSessionIds(): string[] {
    const now = Date.now();
    const ids: string[] = [];
    for (const [id, session] of this.sessions) {
      if (!this.isExpired(session, now)) {
        ids.push(id);
      }
    }
    return ids;
  }

  // -----------------------------------------------------------------------
  // Detection helpers
  // -----------------------------------------------------------------------

  /**
   * Score creep: proportion of turns showing increasing risk.
   */
  private detectScoreCreep(session: SessionInfo): boolean {
    const turns = session.turns;
    if (turns.length < 3) return false;

    let increases = 0;
    for (let i = 1; i < turns.length; i++) {
      if (turns[i].riskScore > turns[i - 1].riskScore) {
        increases++;
      }
    }
    const ratio = increases / (turns.length - 1);
    return ratio >= this.cfg.scoreCreepRatio;
  }

  /**
   * Topic drift: proportion of later turns with new risky keywords.
   */
  private detectTopicDrift(session: SessionInfo): boolean {
    const turns = session.turns;
    if (turns.length < 3) return false;

    const midpoint = Math.floor(turns.length / 2);

    // Collect keywords from first half
    const earlierKeywords = new Set<string>();
    for (let i = 0; i < midpoint; i++) {
      for (const topic of turns[i].topics) {
        earlierKeywords.add(topic);
      }
    }

    // Count later turns with new keywords
    let driftTurns = 0;
    const laterCount = turns.length - midpoint;
    for (let i = midpoint; i < turns.length; i++) {
      const newTopics = turns[i].topics.filter((t) => !earlierKeywords.has(t));
      if (newTopics.length > 0) driftTurns++;
    }

    return laterCount > 0 && driftTurns / laterCount >= this.cfg.topicDriftRatio;
  }

  /**
   * Check if session is expired.
   */
  private isExpired(session: SessionInfo, now: number): boolean {
    return (now - session.lastActivity) > this.cfg.sessionExpirySecs * 1000;
  }
}
