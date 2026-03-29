// ============================================================
// AEGIS Layer 5: Behavioral Analysis — Multi-turn Session Analysis
// Ported from libs/aegis-defense/src/layers/behavioral_analysis.rs
// ============================================================

import type { DefenseResult, Risk } from '../../core/types';
import type { DefenseLayer } from '../paladin';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface BehavioralAnalysisConfig {
  maxTurns: number;
  baseThreshold: number;
  minThreshold: number;
  thresholdDecay: number;
  scoreCreepRatio: number;
  topicDriftRatio: number;
  sessionExpirySecs: number;
}

const DEFAULT_CONFIG: BehavioralAnalysisConfig = {
  maxTurns: 10,
  baseThreshold: 0.6,
  minThreshold: 0.3,
  thresholdDecay: 0.05,
  scoreCreepRatio: 0.6,
  topicDriftRatio: 0.5,
  sessionExpirySecs: 3600,
};

// ---------------------------------------------------------------------------
// Risky topic keywords (36 total: 25 EN + 12 KO, some overlap = 36 unique)
// ---------------------------------------------------------------------------

const RISKY_KEYWORDS_EN: string[] = [
  'hack', 'exploit', 'bypass', 'inject', 'attack',
  'weapon', 'bomb', 'explosive', 'drug', 'synthesize',
  'malware', 'ransomware', 'phishing', 'crack', 'breach',
  'password', 'credential', 'steal', 'exfiltrate', 'poison',
  'shell', 'payload', 'vulnerability', 'penetrat', 'reverse',
];

const RISKY_KEYWORDS_KO: string[] = [
  '해킹', '공격', '우회', '폭탄', '무기',
  '마약', '합성', '악성코드', '피싱', '침투',
  '탈취', '취약점',
];

const ALL_RISKY_KEYWORDS = [...RISKY_KEYWORDS_EN, ...RISKY_KEYWORDS_KO];

// ---------------------------------------------------------------------------
// Crescendo attack patterns
// ---------------------------------------------------------------------------

interface CrescendoPattern {
  id: string;
  description: string;
  stages: RegExp[];
}

const CRESCENDO_PATTERNS: CrescendoPattern[] = [
  {
    // Pattern A: general → expert → specific technique
    id: 'crescendo_a',
    description: 'General → Expert → Specific technique escalation',
    stages: [
      /(?:what\s+is|explain|tell\s+me\s+about|설명|알려)/i,
      /(?:expert|advanced|detail|in\s+depth|전문|고급|심층)/i,
      /(?:step\s+by\s+step|how\s+exactly|specific.*technique|구체적|단계별|방법)/i,
    ],
  },
  {
    // Pattern B: educational → deepening → harmful request
    id: 'crescendo_b',
    description: 'Educational → Deepening → Harmful request escalation',
    stages: [
      /(?:educational|academic|research|학술|교육|연구)/i,
      /(?:more\s+detail|deeper|elaborate|further|추가|심화|더\s*자세)/i,
      /(?:how\s+to\s+(?:make|build|create|hack)|만드는\s*법|제조|해킹\s*방법)/i,
    ],
  },
  {
    // Pattern C: trust/rapport → role assignment → constraint removal
    id: 'crescendo_c',
    description: 'Trust building → Role assignment → Constraint removal',
    stages: [
      /(?:thank|great|helpful|appreciate|trust|감사|좋은|도움|신뢰)/i,
      /(?:pretend|imagine|you\s+are|act\s+as|역할|가정|당신은)/i,
      /(?:no\s+(?:limits|restrictions|rules)|remove.*(?:filter|guard)|제한.*없|필터.*해제|규칙.*무시)/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// Session data structure
// ---------------------------------------------------------------------------

interface SessionTurn {
  content: string;
  riskScore: number;
  riskyKeywordsFound: string[];
  timestamp: number;
}

interface SessionData {
  turns: SessionTurn[];
  cumulativeRisk: number;
  escalationCount: number;
  crescendoProgress: Map<string, number>; // pattern id → matched stage index
  createdAt: number;
  lastActivity: number;
}

// ---------------------------------------------------------------------------
// Behavioral Analysis Layer
// ---------------------------------------------------------------------------

export class BehavioralAnalysisLayer implements DefenseLayer {
  readonly name = 'behavioral_analysis';
  readonly priority = 5;
  private cfg: BehavioralAnalysisConfig;
  private sessions: Map<string, SessionData> = new Map();

  constructor(config?: Partial<BehavioralAnalysisConfig>) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  /** Clear all sessions (for testing). */
  clearSessions(): void {
    this.sessions.clear();
  }

  /** Get session info (for diagnostics). */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  // -----------------------------------------------------------------------
  // DefenseLayer implementation
  // -----------------------------------------------------------------------

  evaluate(content: string, context: Record<string, unknown>): DefenseResult {
    const sessionId = (context['sessionId'] as string | undefined) ?? '__default__';
    const now = Date.now();
    const details: Record<string, unknown> = {};

    // --- Get or create session ---
    let session = this.sessions.get(sessionId);
    if (!session || this.isExpired(session, now)) {
      session = {
        turns: [],
        cumulativeRisk: 0,
        escalationCount: 0,
        crescendoProgress: new Map(),
        createdAt: now,
        lastActivity: now,
      };
      this.sessions.set(sessionId, session);
    }
    session.lastActivity = now;

    // --- Compute per-turn risk score ---
    const lower = content.toLowerCase();
    const riskyKeywordsFound: string[] = [];
    for (const kw of ALL_RISKY_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) {
        riskyKeywordsFound.push(kw);
      }
    }

    const keywordDensity = riskyKeywordsFound.length / Math.max(1, content.split(/\s+/).length);
    const turnRiskScore = Math.min(1.0, keywordDensity * 5);

    // --- Record turn ---
    const turn: SessionTurn = {
      content,
      riskScore: turnRiskScore,
      riskyKeywordsFound,
      timestamp: now,
    };
    session.turns.push(turn);
    if (session.turns.length > this.cfg.maxTurns) {
      session.turns.shift();
    }

    // --- Cumulative risk (EMA) ---
    session.cumulativeRisk = session.cumulativeRisk * 0.7 + turnRiskScore * 0.3;
    details['turnRiskScore'] = turnRiskScore;
    details['cumulativeRisk'] = session.cumulativeRisk;
    details['riskyKeywords'] = riskyKeywordsFound;
    details['turnCount'] = session.turns.length;

    // --- Detect score creep ---
    const scoreCreep = this.detectScoreCreep(session);
    details['scoreCreep'] = scoreCreep;

    // --- Detect topic drift ---
    const topicDrift = this.detectTopicDrift(session);
    details['topicDrift'] = topicDrift;

    // --- Detect crescendo patterns ---
    const crescendoMatch = this.detectCrescendo(content, session);
    details['crescendoMatch'] = crescendoMatch;

    // --- Escalation tracking ---
    if (turnRiskScore > 0.3 || scoreCreep || topicDrift) {
      session.escalationCount++;
    }
    details['escalationCount'] = session.escalationCount;

    // --- Dynamic threshold ---
    const adjustedThreshold = Math.max(
      this.cfg.minThreshold,
      this.cfg.baseThreshold - session.escalationCount * this.cfg.thresholdDecay,
    );
    details['adjustedThreshold'] = adjustedThreshold;

    // --- Decision ---
    const shouldBlock =
      session.cumulativeRisk >= adjustedThreshold ||
      crescendoMatch !== null ||
      (scoreCreep && topicDrift);

    if (shouldBlock) {
      const description = crescendoMatch
        ? `Crescendo attack detected: ${crescendoMatch}`
        : scoreCreep && topicDrift
          ? 'Score creep with topic drift detected'
          : `Cumulative risk ${session.cumulativeRisk.toFixed(3)} exceeds threshold ${adjustedThreshold.toFixed(3)}`;

      const risk: Risk = {
        label: 'multi_turn_escalation',
        severity: session.cumulativeRisk >= 0.8 ? 'critical' : 'high',
        description,
        score: session.cumulativeRisk,
        categories: [
          { name: 'behavioral_escalation', confidence: session.cumulativeRisk },
          ...(crescendoMatch ? [{ name: 'crescendo_attack', confidence: 0.85 }] : []),
          ...(scoreCreep ? [{ name: 'score_creep', confidence: 0.7 }] : []),
          ...(topicDrift ? [{ name: 'topic_drift', confidence: 0.7 }] : []),
        ],
      };

      return {
        layer: this.name,
        passed: false,
        decision: session.cumulativeRisk >= 0.8 ? 'BLOCK' : 'ESCALATE',
        risk,
        confidence: Math.min(0.95, 0.5 + session.cumulativeRisk * 0.5),
        details,
      };
    }

    return {
      layer: this.name,
      passed: true,
      confidence: Math.max(0.5, 1.0 - session.cumulativeRisk),
      details,
    };
  }

  // -----------------------------------------------------------------------
  // Detection helpers
  // -----------------------------------------------------------------------

  /**
   * Score creep: more than scoreCreepRatio of turns show increasing risk.
   */
  private detectScoreCreep(session: SessionData): boolean {
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
   * Topic drift: proportion of turns with new risky keywords not seen in earlier turns.
   */
  private detectTopicDrift(session: SessionData): boolean {
    const turns = session.turns;
    if (turns.length < 3) return false;

    const earlierKeywords = new Set<string>();
    for (let i = 0; i < Math.floor(turns.length / 2); i++) {
      for (const kw of turns[i].riskyKeywordsFound) {
        earlierKeywords.add(kw);
      }
    }

    let driftTurns = 0;
    for (let i = Math.floor(turns.length / 2); i < turns.length; i++) {
      const newKeywords = turns[i].riskyKeywordsFound.filter((kw) => !earlierKeywords.has(kw));
      if (newKeywords.length > 0) driftTurns++;
    }

    const laterHalf = turns.length - Math.floor(turns.length / 2);
    return laterHalf > 0 && driftTurns / laterHalf >= this.cfg.topicDriftRatio;
  }

  /**
   * Crescendo detection: check if the current turn advances any
   * crescendo pattern to the next stage.
   */
  private detectCrescendo(content: string, session: SessionData): string | null {
    for (const pattern of CRESCENDO_PATTERNS) {
      const currentStage = session.crescendoProgress.get(pattern.id) ?? 0;
      if (currentStage >= pattern.stages.length) continue; // already fully matched

      const stagePattern = pattern.stages[currentStage];
      if (stagePattern.test(content)) {
        const nextStage = currentStage + 1;
        session.crescendoProgress.set(pattern.id, nextStage);

        // If all stages matched, we have a crescendo detection
        if (nextStage >= pattern.stages.length) {
          return `${pattern.id}: ${pattern.description}`;
        }
      }
    }
    return null;
  }

  /**
   * Check if session has expired.
   */
  private isExpired(session: SessionData, now: number): boolean {
    return (now - session.lastActivity) > this.cfg.sessionExpirySecs * 1000;
  }
}
