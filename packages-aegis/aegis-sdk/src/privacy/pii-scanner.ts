// ============================================================
// AEGIS PII Scanner — ported from libs/aegis-defense/src/dlp/
// ============================================================

import type { PiiType, PiiMatch } from '../core/types';

export interface PiiScanConfig {
  koreanRrn?: boolean;
  creditCard?: boolean;
  email?: boolean;
  phoneKr?: boolean;
  phoneIntl?: boolean;
  ssn?: boolean;
  passport?: boolean;
  ipAddress?: boolean;
}

const DEFAULT_CONFIG: Required<PiiScanConfig> = {
  koreanRrn: true,
  creditCard: true,
  email: true,
  phoneKr: true,
  phoneIntl: true,
  ssn: true,
  passport: true,
  ipAddress: true,
};

// --- Luhn checksum ---

function luhn(num: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// --- Validation helpers ---

function validateKoreanRrn(dateStr: string, genderAndSerial: string): boolean {
  const year = parseInt(dateStr.slice(0, 2), 10);
  const month = parseInt(dateStr.slice(2, 4), 10);
  const day = parseInt(dateStr.slice(4, 6), 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const genderDigit = parseInt(genderAndSerial[0], 10);
  return genderDigit >= 1 && genderDigit <= 4;
}

function validateSsn(area: string, group: string, serial: string): boolean {
  const areaNum = parseInt(area, 10);
  if (areaNum === 0 || areaNum === 666) return false;
  if (areaNum >= 900 && areaNum <= 999) return false;
  if (parseInt(group, 10) === 0) return false;
  if (parseInt(serial, 10) === 0) return false;
  return true;
}

function validateIpv4(a: string, b: string, c: string, d: string): boolean {
  const octets = [a, b, c, d].map((o) => parseInt(o, 10));
  return octets.every((o) => o >= 0 && o <= 255);
}

// --- Masking ---

function maskValue(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  const first2 = value.slice(0, 2);
  const last2 = value.slice(-2);
  const middle = '*'.repeat(value.length - 4);
  return first2 + middle + last2;
}

// --- Overlap dedup ---

function pushIfNoOverlap(matches: PiiMatch[], candidate: PiiMatch): void {
  for (const existing of matches) {
    if (candidate.startPos < existing.endPos && candidate.endPos > existing.startPos) {
      return;
    }
  }
  matches.push(candidate);
}

// --- Patterns ---

interface PiiPattern {
  type: PiiType;
  regex: RegExp;
  validate?: (match: RegExpExecArray) => boolean;
}

const PII_PATTERNS: PiiPattern[] = [
  {
    type: 'korean_rrn',
    regex: /(\d{6})-?([1-4]\d{6})/g,
    validate: (m) => validateKoreanRrn(m[1], m[2]),
  },
  {
    type: 'credit_card',
    regex: /\b(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})\b/g,
    validate: (m) => {
      const digits = m[1] + m[2] + m[3] + m[4];
      return luhn(digits);
    },
  },
  {
    type: 'email',
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    type: 'phone_kr',
    regex: /(01[016789])-?(\d{3,4})-?(\d{4})/g,
  },
  {
    type: 'phone_intl',
    regex: /\+\d{1,3}[-. ]?\d{1,4}[-. ]?\d{3,4}[-. ]?\d{3,4}/g,
  },
  {
    type: 'ssn',
    regex: /(\d{3})-(\d{2})-(\d{4})/g,
    validate: (m) => validateSsn(m[1], m[2], m[3]),
  },
  {
    type: 'ip_address',
    regex: /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,
    validate: (m) => validateIpv4(m[1], m[2], m[3], m[4]),
  },
  {
    type: 'passport',
    regex: /\b([A-Z]{1,2}\d{6,9})\b/g,
  },
];

// --- Scanner ---

export class PiiScanner {
  private config: Required<PiiScanConfig>;

  constructor(config?: PiiScanConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private isEnabled(type: PiiType): boolean {
    const mapping: Record<PiiType, keyof PiiScanConfig> = {
      korean_rrn: 'koreanRrn',
      credit_card: 'creditCard',
      email: 'email',
      phone_kr: 'phoneKr',
      phone_intl: 'phoneIntl',
      ssn: 'ssn',
      passport: 'passport',
      ip_address: 'ipAddress',
    };
    return this.config[mapping[type]] === true;
  }

  scan(text: string): PiiMatch[] {
    const matches: PiiMatch[] = [];

    for (const pattern of PII_PATTERNS) {
      if (!this.isEnabled(pattern.type)) continue;

      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let m: RegExpExecArray | null;

      while ((m = regex.exec(text)) !== null) {
        if (pattern.validate && !pattern.validate(m)) continue;

        const value = m[0];
        const candidate: PiiMatch = {
          type: pattern.type,
          value,
          maskedValue: maskValue(value),
          startPos: m.index,
          endPos: m.index + value.length,
        };

        pushIfNoOverlap(matches, candidate);
      }
    }

    matches.sort((a, b) => a.startPos - b.startPos);
    return matches;
  }

  mask(text: string): { masked: string; matches: PiiMatch[] } {
    const matches = this.scan(text);
    let masked = text;
    let offset = 0;

    for (const match of matches) {
      const start = match.startPos + offset;
      const end = match.endPos + offset;
      const replacement = match.maskedValue;
      masked = masked.slice(0, start) + replacement + masked.slice(end);
      offset += replacement.length - (match.endPos - match.startPos);
    }

    return { masked, matches };
  }
}
