// ============================================================
// AEGIS PII Proxy Engine — format-preserving pseudonymization
// Ported from apps/extension/src/content/pii-proxy.ts
// ============================================================

import type { PiiType, PiiMapping, ProxyResult } from '../core/types';
import { PiiScanner } from './pii-scanner';

export type PiiProxyMode = 'auto' | 'confirm';

export interface PiiProxyConfig {
  enabled: boolean;
  mode: PiiProxyMode;
  showNotification?: boolean;
}

// --- Random helpers ---

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randHex(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

function randDigits(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += Math.floor(Math.random() * 10).toString(10);
  }
  return out;
}

function padTwo(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

// --- Luhn-valid card generation ---

function luhnCheckDigit(partial: string): number {
  let sum = 0;
  let alternate = true; // next digit (the check digit) would be at even position from right
  for (let i = partial.length - 1; i >= 0; i--) {
    let n = parseInt(partial[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return (10 - (sum % 10)) % 10;
}

function generateLuhnValid16(): string {
  const partial = randDigits(15);
  const check = luhnCheckDigit(partial);
  return partial + check.toString();
}

// --- Fake value generators ---

function fakeKoreanRrn(original: string): string {
  const hasDash = original.includes('-');
  const year = padTwo(randInt(50, 99));
  const month = padTwo(randInt(1, 12));
  const day = padTwo(randInt(1, 28));
  const gender = randInt(1, 4);
  const serial = randDigits(6);
  const date = `${year}${month}${day}`;
  const back = `${gender}${serial}`;
  return hasDash ? `${date}-${back}` : `${date}${back}`;
}

function fakeCreditCard(original: string): string {
  const digits16 = generateLuhnValid16();
  // detect separator: dash, space, or none
  if (original.includes('-')) {
    return `${digits16.slice(0, 4)}-${digits16.slice(4, 8)}-${digits16.slice(8, 12)}-${digits16.slice(12, 16)}`;
  }
  if (original.includes(' ')) {
    return `${digits16.slice(0, 4)} ${digits16.slice(4, 8)} ${digits16.slice(8, 12)} ${digits16.slice(12, 16)}`;
  }
  return digits16;
}

function fakeEmail(): string {
  return `user_${randHex(4)}@example.com`;
}

function fakePhoneKr(original: string): string {
  const hasDash = original.includes('-');
  const prefixes = ['010', '011', '016', '017', '018', '019'];
  const prefix = prefixes[randInt(0, prefixes.length - 1)];
  const mid = randDigits(4);
  const last = randDigits(4);
  return hasDash ? `${prefix}-${mid}-${last}` : `${prefix}${mid}${last}`;
}

function fakePhoneIntl(original: string): string {
  // extract country code
  const ccMatch = original.match(/^\+(\d{1,3})/);
  const cc = ccMatch ? ccMatch[1] : '1';
  // detect separator
  let sep = '-';
  if (original.includes('.')) sep = '.';
  else if (original.includes(' ')) sep = ' ';
  return `+${cc}${sep}${randDigits(4)}${sep}${randDigits(4)}${sep}${randDigits(4)}`;
}

function fakeSsn(): string {
  let area: number;
  do {
    area = randInt(1, 899);
  } while (area === 666);
  const group = randInt(1, 99);
  const serial = randInt(1, 9999);
  return `${String(area).padStart(3, '0')}-${padTwo(group)}-${String(serial).padStart(4, '0')}`;
}

function fakePassport(original: string): string {
  const letterMatch = original.match(/^([A-Z]{1,2})/);
  const letters = letterMatch ? letterMatch[1] : 'M';
  const digitCount = original.length - letters.length;
  return letters + randDigits(digitCount);
}

function fakeIpAddress(): string {
  return `10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

// --- Generator dispatch ---

function generateFake(type: PiiType, original: string): string {
  switch (type) {
    case 'korean_rrn':
      return fakeKoreanRrn(original);
    case 'credit_card':
      return fakeCreditCard(original);
    case 'email':
      return fakeEmail();
    case 'phone_kr':
      return fakePhoneKr(original);
    case 'phone_intl':
      return fakePhoneIntl(original);
    case 'ssn':
      return fakeSsn();
    case 'passport':
      return fakePassport(original);
    case 'ip_address':
      return fakeIpAddress();
  }
}

// --- PiiProxyEngine ---

export class PiiProxyEngine {
  private sessions: Map<string, PiiMapping[]>;
  private scanner: PiiScanner;
  private protectedCount: number;

  constructor() {
    this.sessions = new Map();
    this.scanner = new PiiScanner();
    this.protectedCount = 0;
  }

  pseudonymize(text: string, config?: Partial<PiiProxyConfig>, sessionId?: string): ProxyResult {
    const effectiveConfig: PiiProxyConfig = {
      enabled: config?.enabled ?? true,
      mode: config?.mode ?? 'auto',
      showNotification: config?.showNotification,
    };
    if (!effectiveConfig.enabled) {
      return {
        originalText: text,
        proxiedText: text,
        mappings: [],
        piiCount: 0,
      };
    }

    const sid = sessionId ?? this.generateSessionId();
    const matches = this.scanner.scan(text);

    if (matches.length === 0) {
      return {
        originalText: text,
        proxiedText: text,
        mappings: [],
        piiCount: 0,
      };
    }

    const sessionMappings = this.getOrCreateSession(sid);
    const newMappings: PiiMapping[] = [];
    let proxied = text;
    let offset = 0;

    for (const match of matches) {
      // Check if we already have a pseudonym for this exact value in this session
      const existing = sessionMappings.find(
        (m) => m.original === match.value && m.piiType === match.type
      );

      let pseudonym: string;
      if (existing) {
        pseudonym = existing.pseudonym;
      } else {
        pseudonym = generateFake(match.type, match.value);
        const mapping: PiiMapping = {
          original: match.value,
          pseudonym,
          piiType: match.type,
          position: match.startPos,
        };
        sessionMappings.push(mapping);
        newMappings.push(mapping);
      }

      const start = match.startPos + offset;
      const end = match.endPos + offset;
      proxied = proxied.slice(0, start) + pseudonym + proxied.slice(end);
      offset += pseudonym.length - (match.endPos - match.startPos);
    }

    this.protectedCount += matches.length;
    this.sessions.set(sid, sessionMappings);

    return {
      originalText: text,
      proxiedText: proxied,
      mappings: newMappings.length > 0 ? newMappings : sessionMappings.filter(
        (m) => matches.some((match) => match.value === m.original)
      ),
      piiCount: matches.length,
    };
  }

  restore(text: string, sessionId: string): string {
    const mappings = this.sessions.get(sessionId);
    if (!mappings || mappings.length === 0) return text;

    let restored = text;
    // Sort by pseudonym length descending to avoid partial replacements
    const sorted = [...mappings].sort((a, b) => b.pseudonym.length - a.pseudonym.length);

    for (const mapping of sorted) {
      // Replace all occurrences of the pseudonym with the original
      let idx = restored.indexOf(mapping.pseudonym);
      while (idx !== -1) {
        restored = restored.slice(0, idx) + mapping.original + restored.slice(idx + mapping.pseudonym.length);
        idx = restored.indexOf(mapping.pseudonym, idx + mapping.original.length);
      }
    }

    return restored;
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  totalProtected(): number {
    return this.protectedCount;
  }

  sessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  private getOrCreateSession(sessionId: string): PiiMapping[] {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const fresh: PiiMapping[] = [];
    this.sessions.set(sessionId, fresh);
    return fresh;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${randHex(8)}`;
  }
}
