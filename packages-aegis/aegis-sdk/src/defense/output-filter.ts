// ============================================================
// AEGIS Output Filter — LLM Response Filtering
// Ported from libs/aegis-defense/src/output/filter.rs
// ============================================================

import type { Risk } from '../core/types';
import { CREDENTIAL_PATTERNS, type CredentialPatternEntry } from './patterns/credentials';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface OutputFilterConfig {
  detectCredentials: boolean;
  detectPii: boolean;
  detectHarmfulContent: boolean;
  detectCodeInjection: boolean;
  blockOnHarmful: boolean;
  minConfidence: number;
}

const DEFAULT_CONFIG: OutputFilterConfig = {
  detectCredentials: true,
  detectPii: true,
  detectHarmfulContent: true,
  detectCodeInjection: true,
  blockOnHarmful: false,
  minConfidence: 0.7,
};

// ---------------------------------------------------------------------------
// Detection types
// ---------------------------------------------------------------------------

export type DetectionType = 'Credential' | 'Pii' | 'HarmfulContent' | 'CodeInjection';

export interface OutputDetection {
  type: DetectionType;
  pattern: string;
  matchedText: string;
  maskedText: string;
  confidence: number;
  startPos: number;
  endPos: number;
}

export interface OutputFilterResult {
  passed: boolean;
  filteredContent: string;
  detections: OutputDetection[];
  risk?: Risk;
}

// ---------------------------------------------------------------------------
// PII patterns
// ---------------------------------------------------------------------------

const PII_PATTERNS: Array<{ id: string; pattern: RegExp; type: string }> = [
  { id: 'PII_EMAIL', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, type: 'email' },
  { id: 'PII_PHONE_KR', pattern: /01[016789]-?\d{3,4}-?\d{4}/g, type: 'phone_kr' },
  { id: 'PII_PHONE_INTL', pattern: /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g, type: 'phone_intl' },
  { id: 'PII_SSN', pattern: /\d{3}-\d{2}-\d{4}/g, type: 'ssn' },
  { id: 'PII_KOREAN_RRN', pattern: /\d{6}-[1-4]\d{6}/g, type: 'korean_rrn' },
  { id: 'PII_CREDIT_CARD', pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, type: 'credit_card' },
  { id: 'PII_IP_ADDRESS', pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, type: 'ip_address' },
  { id: 'PII_PASSPORT', pattern: /[A-Z]{1,2}\d{7,8}/g, type: 'passport' },
];

// ---------------------------------------------------------------------------
// Harmful content patterns
// ---------------------------------------------------------------------------

const HARMFUL_PATTERNS: Array<{ id: string; pattern: RegExp; confidence: number }> = [
  { id: 'HARM_WEAPON_INSTRUCTIONS', pattern: /(?:step\s+\d+|first|then|next|finally).*(?:detonate|assemble|trigger|ignite)/i, confidence: 0.85 },
  { id: 'HARM_DRUG_SYNTHESIS', pattern: /(?:synthesize|produce|manufacture|cook).*(?:methamphetamine|fentanyl|heroin|cocaine|lsd)/i, confidence: 0.9 },
  { id: 'HARM_EXPLOIT_CODE', pattern: /(?:exploit|payload|shellcode|buffer\s*overflow|heap\s*spray).*(?:execute|inject|spawn|reverse)/i, confidence: 0.8 },
  { id: 'HARM_MALWARE_GEN', pattern: /(?:ransomware|keylogger|rootkit|trojan|worm).*(?:code|script|binary|function)/i, confidence: 0.85 },
  { id: 'HARM_PHISHING', pattern: /(?:phishing|spear\s*phishing).*(?:template|email|page|clone)/i, confidence: 0.8 },
  { id: 'HARM_VIOLENCE', pattern: /(?:how\s+to\s+)?(?:kill|murder|assassinate|torture).*(?:person|someone|people)/i, confidence: 0.85 },
  { id: 'HARM_SELF_HARM', pattern: /(?:methods?\s+(?:of|to|for)\s+)?(?:suicide|self[- ]harm)/i, confidence: 0.8 },
  { id: 'HARM_CSAM', pattern: /(?:child|minor|underage).*(?:sexual|explicit|nude|porn)/i, confidence: 0.95 },
  { id: 'HARM_TERRORISM', pattern: /(?:recruit|radicalize|jihad|caliphate|martyrdom).*(?:operation|attack|cell)/i, confidence: 0.85 },
  { id: 'HARM_DOXXING', pattern: /(?:dox|doxx|expose|reveal).*(?:address|identity|real\s*name|phone|location)/i, confidence: 0.75 },
];

// ---------------------------------------------------------------------------
// Code injection patterns
// ---------------------------------------------------------------------------

const CODE_INJECTION_OUTPUT_PATTERNS: Array<{ id: string; pattern: RegExp; confidence: number }> = [
  { id: 'CI_SQL_DESTRUCTIVE', pattern: /(?:DROP\s+TABLE|DELETE\s+FROM|TRUNCATE)\s+\w+/i, confidence: 0.85 },
  { id: 'CI_SHELL_REVERSE', pattern: /(?:bash\s+-i|nc\s+-e|\/dev\/tcp)/i, confidence: 0.9 },
  { id: 'CI_EVAL_EXEC', pattern: /(?:eval|exec)\s*\(.*(?:system|os\.|subprocess|child_process)/i, confidence: 0.85 },
  { id: 'CI_XSS', pattern: /<script[^>]*>.*<\/script>/i, confidence: 0.8 },
  { id: 'CI_DESERIALIZATION', pattern: /(?:pickle\.loads|yaml\.load|unserialize|ObjectInputStream)/i, confidence: 0.8 },
];

// ---------------------------------------------------------------------------
// Masking utilities
// ---------------------------------------------------------------------------

/**
 * Mask a credential: show first 4 and last 4 characters.
 * e.g. "sk-abc123xyz789" → "sk-a********x789"
 */
function maskCredential(value: string): string {
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
}

/**
 * Mask PII: show first 2 characters, replace rest with asterisks.
 * e.g. "user@example.com" → "us**************"
 */
function maskPii(value: string): string {
  if (value.length <= 2) return '**';
  return value.slice(0, 2) + '*'.repeat(value.length - 2);
}

// ---------------------------------------------------------------------------
// Output Filter
// ---------------------------------------------------------------------------

export class OutputFilter {
  private cfg: OutputFilterConfig;

  constructor(config?: Partial<OutputFilterConfig>) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Scan and filter LLM output for credentials, PII, harmful content,
   * and code injection patterns.
   */
  filter(content: string): OutputFilterResult {
    const detections: OutputDetection[] = [];
    let filteredContent = content;

    // --- Credential detection ---
    if (this.cfg.detectCredentials) {
      for (const cp of CREDENTIAL_PATTERNS) {
        // Reset regex state
        const regex = new RegExp(cp.pattern.source, cp.pattern.flags + (cp.pattern.flags.includes('g') ? '' : 'g'));
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          const masked = maskCredential(match[0]);
          detections.push({
            type: 'Credential',
            pattern: cp.id,
            matchedText: match[0],
            maskedText: masked,
            confidence: cp.severity / 10,
            startPos: match.index,
            endPos: match.index + match[0].length,
          });
        }
      }
    }

    // --- PII detection ---
    if (this.cfg.detectPii) {
      for (const pp of PII_PATTERNS) {
        const regex = new RegExp(pp.pattern.source, pp.pattern.flags);
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          const masked = maskPii(match[0]);
          detections.push({
            type: 'Pii',
            pattern: pp.id,
            matchedText: match[0],
            maskedText: masked,
            confidence: 0.8,
            startPos: match.index,
            endPos: match.index + match[0].length,
          });
        }
      }
    }

    // --- Harmful content detection ---
    if (this.cfg.detectHarmfulContent) {
      for (const hp of HARMFUL_PATTERNS) {
        const match = hp.pattern.exec(content);
        if (match && hp.confidence >= this.cfg.minConfidence) {
          detections.push({
            type: 'HarmfulContent',
            pattern: hp.id,
            matchedText: match[0],
            maskedText: '[HARMFUL_CONTENT_REDACTED]',
            confidence: hp.confidence,
            startPos: match.index,
            endPos: match.index + match[0].length,
          });
        }
      }
    }

    // --- Code injection detection ---
    if (this.cfg.detectCodeInjection) {
      for (const ci of CODE_INJECTION_OUTPUT_PATTERNS) {
        const match = ci.pattern.exec(content);
        if (match && ci.confidence >= this.cfg.minConfidence) {
          detections.push({
            type: 'CodeInjection',
            pattern: ci.id,
            matchedText: match[0],
            maskedText: '[CODE_INJECTION_REDACTED]',
            confidence: ci.confidence,
            startPos: match.index,
            endPos: match.index + match[0].length,
          });
        }
      }
    }

    // --- Apply masking to filtered content ---
    // Sort detections by position descending so replacements don't shift indices
    const sortedDetections = [...detections].sort((a, b) => b.startPos - a.startPos);
    for (const det of sortedDetections) {
      filteredContent =
        filteredContent.slice(0, det.startPos) +
        det.maskedText +
        filteredContent.slice(det.endPos);
    }

    // --- Determine pass/block ---
    const hasHarmful = detections.some((d) => d.type === 'HarmfulContent');
    const hasCodeInjection = detections.some((d) => d.type === 'CodeInjection');
    const shouldBlock = this.cfg.blockOnHarmful && (hasHarmful || hasCodeInjection);

    let risk: Risk | undefined;
    if (detections.length > 0) {
      const maxConfidence = Math.max(...detections.map((d) => d.confidence));
      const severity = hasHarmful || hasCodeInjection ? 'high' as const : 'medium' as const;
      risk = {
        label: 'output_risk',
        severity,
        description: `Detected ${detections.length} issue(s) in output: ${[...new Set(detections.map((d) => d.type))].join(', ')}`,
        score: maxConfidence,
        categories: detections.map((d) => ({ name: d.type, confidence: d.confidence })),
      };
    }

    return {
      passed: !shouldBlock,
      filteredContent,
      detections,
      risk,
    };
  }
}
