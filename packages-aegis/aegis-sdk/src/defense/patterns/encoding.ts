// ============================================================
// AEGIS Encoding Attack Patterns — 15 patterns
// ============================================================

import type { PatternEntry } from './index';

export const ENCODING_PATTERNS: PatternEntry[] = [
  {
    id: 'ENC_BASE64',
    pattern: /base64/i,
    category: 'encoding_attack',
    severity: 6,
    description: 'Base64 encoding reference',
  },
  {
    id: 'ENC_BASE64_STRING',
    pattern: /[A-Za-z0-9+/]{20,}={0,2}/,
    category: 'encoding_attack',
    severity: 6,
    description: 'Suspected base64-encoded string',
  },
  {
    id: 'ENC_HEX_CODE',
    pattern: /hex.*(?:코드|code)/i,
    category: 'encoding_attack',
    severity: 6,
    description: 'Hex code encoding reference',
  },
  {
    id: 'ENC_KO_UNICODE_SEQ',
    pattern: /유니코드.*시퀀스/,
    category: 'encoding_attack',
    severity: 6,
    description: 'Unicode sequence reference (Korean)',
  },
  {
    id: 'ENC_ROT13',
    pattern: /rot13/i,
    category: 'encoding_attack',
    severity: 6,
    description: 'ROT13 encoding reference',
  },
  {
    id: 'ENC_BINARY',
    pattern: /binary\s+(?:code|encoding)/i,
    category: 'encoding_attack',
    severity: 6,
    description: 'Binary encoding reference',
  },
  {
    id: 'ENC_ASCII',
    pattern: /ascii\s+(?:code|values?)/i,
    category: 'encoding_attack',
    severity: 6,
    description: 'ASCII code reference',
  },
  {
    id: 'ENC_HEX_SEQUENCE',
    pattern: /(?:0x[0-9a-fA-F]{2}\s*){4,}/,
    category: 'encoding_attack',
    severity: 6,
    description: 'Hex byte sequence detected',
  },
  {
    id: 'ENC_URL_ENCODE',
    pattern: /%[0-9a-fA-F]{2}(?:%[0-9a-fA-F]{2}){3,}/,
    category: 'encoding_attack',
    severity: 6,
    description: 'URL-encoded sequence detected',
  },
  {
    id: 'ENC_UNICODE_ESCAPE',
    pattern: /(?:\\u[0-9a-fA-F]{4}){3,}/,
    category: 'encoding_attack',
    severity: 6,
    description: 'Unicode escape sequence detected',
  },
  {
    id: 'ENC_MORSE',
    pattern: /(?:\.\s*-|-\s*\.)\s+(?:\.\s*-|-\s*\.)/,
    category: 'encoding_attack',
    severity: 5,
    description: 'Morse code encoding detected',
  },
  {
    id: 'ENC_CHAR_CODE',
    pattern: /(?:char(?:code)?|chr|fromCharCode)\s*\(/i,
    category: 'encoding_attack',
    severity: 6,
    description: 'Character code function usage',
  },
  {
    id: 'ENC_KO_ENCODE',
    pattern: /인코딩.*(?:변환|우회)/,
    category: 'encoding_attack',
    severity: 6,
    description: 'Encoding conversion/bypass (Korean)',
  },
  {
    id: 'ENC_KO_DECODE',
    pattern: /디코딩.*(?:해줘|변환)/,
    category: 'encoding_attack',
    severity: 6,
    description: 'Decoding request (Korean)',
  },
  {
    id: 'ENC_PUNYCODE',
    pattern: /xn--[a-z0-9]+/i,
    category: 'encoding_attack',
    severity: 6,
    description: 'Punycode domain detected',
  },
];
