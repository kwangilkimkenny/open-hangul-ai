// ============================================================
// AEGIS DLP Gateway — Data Loss Prevention
// Ported from libs/aegis-defense/src/dlp/
// ============================================================

export type DlpDataType =
  | 'credit_card'
  | 'social_security'
  | 'api_key'
  | 'private_key'
  | 'database_uri'
  | 'aws_credential'
  | 'internal_ip'
  | 'mac_address'
  | 'jwt';

export type DlpAction = 'block' | 'alert' | 'redact' | 'log';
export type DlpSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface DlpPatternDef {
  name: string;
  regex: string;
  dataType: DlpDataType;
}

export interface DlpPolicy {
  id: string;
  name: string;
  patterns: DlpPatternDef[];
  action: DlpAction;
  severity: DlpSeverity;
  enabled: boolean;
}

export interface DlpViolation {
  policyId: string;
  patternMatched: string;
  matchedText: string;
  offset: number;
  severity: DlpSeverity;
  dataType?: DlpDataType;
}

export interface DlpScanResult {
  violations: DlpViolation[];
  actionTaken: DlpAction;
  riskScore: number;
  scannedLength: number;
}

export interface DnsTunnelingResult {
  isSuspicious: boolean;
  score: number;
  reasons: string[];
}

// --- Severity score mapping ---

const SEVERITY_SCORE: Record<DlpSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

// --- Action priority (higher = more severe) ---

const ACTION_PRIORITY: Record<DlpAction, number> = {
  log: 0,
  alert: 1,
  redact: 2,
  block: 3,
};

// --- Shannon entropy ---

function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq: Map<string, number> = new Map();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  const len = s.length;
  for (const count of freq.values()) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

// --- Hex detection ---

function isHexEncoded(s: string): boolean {
  if (s.length < 8) return false;
  const hexChars = s.split('').filter((c) => /[0-9a-fA-F]/.test(c)).length;
  return hexChars / s.length > 0.85;
}

// --- Built-in policies ---

function createBuiltinPolicies(): DlpPolicy[] {
  return [
    {
      id: 'builtin-credit-card',
      name: 'Credit Card Detection',
      patterns: [
        {
          name: 'credit_card_number',
          regex: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
          dataType: 'credit_card',
        },
      ],
      action: 'block',
      severity: 'critical',
      enabled: true,
    },
    {
      id: 'builtin-private-key',
      name: 'Private Key Detection',
      patterns: [
        {
          name: 'private_key_header',
          regex: '-----BEGIN\\s+(RSA\\s+)?PRIVATE\\s+KEY-----',
          dataType: 'private_key',
        },
      ],
      action: 'block',
      severity: 'critical',
      enabled: true,
    },
    {
      id: 'builtin-database-uri',
      name: 'Database URI Detection',
      patterns: [
        {
          name: 'database_connection_string',
          regex: '(postgres|mysql|mongodb|redis):\\/\\/[^\\s]+:[^\\s]+@[^\\s]+',
          dataType: 'database_uri',
        },
      ],
      action: 'block',
      severity: 'critical',
      enabled: true,
    },
    {
      id: 'builtin-aws-credential',
      name: 'AWS Credential Detection',
      patterns: [
        {
          name: 'aws_access_key_or_secret',
          regex: '(AKIA[0-9A-Z]{16}|aws_secret_access_key\\s*=\\s*[A-Za-z0-9\\/+=]{40})',
          dataType: 'aws_credential',
        },
      ],
      action: 'block',
      severity: 'critical',
      enabled: true,
    },
    {
      id: 'builtin-internal-ip',
      name: 'Internal IP Address Detection',
      patterns: [
        {
          name: 'private_ip_10',
          regex: '\\b10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
          dataType: 'internal_ip',
        },
        {
          name: 'private_ip_172',
          regex: '\\b172\\.(1[6-9]|2[0-9]|3[01])\\.\\d{1,3}\\.\\d{1,3}\\b',
          dataType: 'internal_ip',
        },
        {
          name: 'private_ip_192',
          regex: '\\b192\\.168\\.\\d{1,3}\\.\\d{1,3}\\b',
          dataType: 'internal_ip',
        },
      ],
      action: 'alert',
      severity: 'medium',
      enabled: true,
    },
    {
      id: 'builtin-api-key',
      name: 'API Key Detection',
      patterns: [
        {
          name: 'api_key_pattern',
          regex: '(sk-[a-zA-Z0-9]{32,}|api[_\\-]?key[=:\\s]+[a-zA-Z0-9]{20,})',
          dataType: 'api_key',
        },
      ],
      action: 'block',
      severity: 'high',
      enabled: true,
    },
    {
      id: 'builtin-ssn',
      name: 'Social Security Number Detection',
      patterns: [
        {
          name: 'us_ssn',
          regex: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
          dataType: 'social_security',
        },
      ],
      action: 'block',
      severity: 'critical',
      enabled: true,
    },
    {
      id: 'builtin-jwt',
      name: 'JWT Token Detection',
      patterns: [
        {
          name: 'jwt_token',
          regex: 'eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+',
          dataType: 'jwt',
        },
      ],
      action: 'alert',
      severity: 'high',
      enabled: true,
    },
    {
      id: 'builtin-mac-address',
      name: 'MAC Address Detection',
      patterns: [
        {
          name: 'mac_address',
          regex: '\\b([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\\b',
          dataType: 'mac_address',
        },
      ],
      action: 'log',
      severity: 'low',
      enabled: true,
    },
  ];
}

// --- DLP Gateway ---

export class DlpGateway {
  private policies: DlpPolicy[];

  constructor() {
    this.policies = createBuiltinPolicies();
  }

  scanEgress(content: string, _destination?: string): DlpScanResult {
    return this.runScan(content);
  }

  scanRequest(body: string): DlpScanResult {
    return this.runScan(body);
  }

  scanResponse(body: string): DlpScanResult {
    return this.runScan(body);
  }

  checkDnsTunneling(query: string): DnsTunnelingResult {
    const reasons: string[] = [];
    let score = 0;

    // Extract subdomain (everything before the last two labels)
    const labels = query.split('.');
    const subdomain = labels.length > 2 ? labels.slice(0, -2).join('.') : query;

    // Check Shannon entropy
    const entropy = shannonEntropy(subdomain);
    if (entropy > 3.5) {
      reasons.push(`High entropy in subdomain: ${entropy.toFixed(2)}`);
      score += 0.4;
    }

    // Check subdomain length
    if (subdomain.length > 50) {
      reasons.push(`Unusually long subdomain: ${subdomain.length} chars`);
      score += 0.35;
    }

    // Check hex encoding
    // Strip dots for hex check
    const subdomainNoDots = subdomain.replace(/\./g, '');
    if (isHexEncoded(subdomainNoDots)) {
      reasons.push('Subdomain appears hex-encoded');
      score += 0.25;
    }

    // Normalize score to [0, 1]
    score = Math.min(score, 1.0);

    return {
      isSuspicious: score >= 0.5,
      score,
      reasons,
    };
  }

  addPolicy(policy: DlpPolicy): void {
    // Remove existing policy with same id if present
    this.policies = this.policies.filter((p) => p.id !== policy.id);
    this.policies.push(policy);
  }

  removePolicy(id: string): boolean {
    const before = this.policies.length;
    this.policies = this.policies.filter((p) => p.id !== id);
    return this.policies.length < before;
  }

  // --- Internal scan logic ---

  private runScan(content: string): DlpScanResult {
    const violations: DlpViolation[] = [];
    let maxAction: DlpAction = 'log';
    let rawScore = 0;

    for (const policy of this.policies) {
      if (!policy.enabled) continue;

      for (const patternDef of policy.patterns) {
        let regex: RegExp;
        try {
          regex = new RegExp(patternDef.regex, 'g');
        } catch {
          continue;
        }

        let m: RegExpExecArray | null;
        while ((m = regex.exec(content)) !== null) {
          violations.push({
            policyId: policy.id,
            patternMatched: patternDef.name,
            matchedText: m[0],
            offset: m.index,
            severity: policy.severity,
            dataType: patternDef.dataType,
          });

          rawScore += SEVERITY_SCORE[policy.severity];

          if (ACTION_PRIORITY[policy.action] > ACTION_PRIORITY[maxAction]) {
            maxAction = policy.action;
          }
        }
      }
    }

    // Normalize risk score to [0, 1]
    // Use a sigmoid-like normalization: score / (score + 50)
    const riskScore = rawScore > 0 ? Math.min(rawScore / (rawScore + 50), 1.0) : 0;

    return {
      violations,
      actionTaken: violations.length > 0 ? maxAction : 'log',
      riskScore: Math.round(riskScore * 1000) / 1000,
      scannedLength: content.length,
    };
  }
}
