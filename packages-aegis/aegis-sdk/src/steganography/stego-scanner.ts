// ============================================================
// Steganography Scanner — Detect hidden messages in text
// Zero-width chars, invisible chars, whitespace encoding,
// homoglyph substitution detection.
// ============================================================

export type StegoMethod = 'zero_width' | 'invisible_char' | 'whitespace_encoding' | 'homoglyph';
export type StegoRiskLevel = 'low' | 'medium' | 'high';

export interface StegoFinding {
  method: StegoMethod;
  positions: number[];
  characters: string[];
  decodedBytes: number;
  description: string;
}

export interface StegoScanResult {
  hasHiddenContent: boolean;
  risk: StegoRiskLevel;
  findings: StegoFinding[];
  totalHiddenBytes: number;
  methodsDetected: StegoMethod[];
  cleanText: string;
}

// --- Zero-width characters ---
const ZERO_WIDTH_CHARS = new Set([
  0x200B, // ZERO WIDTH SPACE
  0x200C, // ZERO WIDTH NON-JOINER
  0x200D, // ZERO WIDTH JOINER
  0xFEFF, // ZERO WIDTH NO-BREAK SPACE
  0x2060, // WORD JOINER
  0x180E, // MONGOLIAN VOWEL SEPARATOR
  0x200E, // LEFT-TO-RIGHT MARK
  0x200F, // RIGHT-TO-LEFT MARK
  0x202A, // LEFT-TO-RIGHT EMBEDDING
  0x202C, // POP DIRECTIONAL FORMATTING
]);

// --- Invisible characters ---
const INVISIBLE_CHARS = new Set([
  0x00AD, // SOFT HYPHEN
  0x034F, // COMBINING GRAPHEME JOINER
  0x061C, // ARABIC LETTER MARK
  0x115F, // HANGUL CHOSEONG FILLER
  0x1160, // HANGUL JUNGSEONG FILLER
  0x17B4, // KHMER VOWEL INHERENT AQ
  0x17B5, // KHMER VOWEL INHERENT AA
]);

// --- Common homoglyph mappings (confusable characters) ---
const HOMOGLYPH_MAP: Record<number, string> = {
  0x0410: 'A', // Cyrillic А → Latin A
  0x0412: 'B', // Cyrillic В → Latin B
  0x0421: 'C', // Cyrillic С → Latin C
  0x0415: 'E', // Cyrillic Е → Latin E
  0x041D: 'H', // Cyrillic Н → Latin H
  0x041A: 'K', // Cyrillic К → Latin K
  0x041C: 'M', // Cyrillic М → Latin M
  0x041E: 'O', // Cyrillic О → Latin O
  0x0420: 'P', // Cyrillic Р → Latin P
  0x0422: 'T', // Cyrillic Т → Latin T
  0x0425: 'X', // Cyrillic Х → Latin X
  0x0430: 'a', // Cyrillic а → Latin a
  0x0435: 'e', // Cyrillic е → Latin e
  0x043E: 'o', // Cyrillic о → Latin o
  0x0440: 'p', // Cyrillic р → Latin p
  0x0441: 'c', // Cyrillic с → Latin c
  0x0443: 'y', // Cyrillic у → Latin y
  0x0445: 'x', // Cyrillic х → Latin x
  0xFF21: 'A', // Fullwidth A
  0xFF22: 'B', // Fullwidth B
  0xFF23: 'C', // Fullwidth C
  0xFF2F: 'O', // Fullwidth O
  0xFF30: 'P', // Fullwidth P
  0xFF41: 'a', // Fullwidth a
  0xFF42: 'b', // Fullwidth b
  0xFF43: 'c', // Fullwidth c
  0xFF4F: 'o', // Fullwidth o
  0xFF50: 'p', // Fullwidth p
  0x0391: 'A', // Greek Α
  0x0392: 'B', // Greek Β
  0x0395: 'E', // Greek Ε
  0x0397: 'H', // Greek Η
  0x0399: 'I', // Greek Ι
  0x039A: 'K', // Greek Κ
  0x039C: 'M', // Greek Μ
  0x039D: 'N', // Greek Ν
  0x039F: 'O', // Greek Ο
  0x03A1: 'P', // Greek Ρ
  0x03A4: 'T', // Greek Τ
  0x03A7: 'X', // Greek Χ
  0x03B1: 'a', // Greek α (ambiguous but flagged)
  0x03BF: 'o', // Greek ο
};

/**
 * Detect zero-width characters in text.
 */
function detectZeroWidth(text: string): StegoFinding | null {
  const positions: number[] = [];
  const characters: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!;
    if (ZERO_WIDTH_CHARS.has(code)) {
      positions.push(i);
      characters.push(`U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  }

  if (positions.length === 0) return null;

  return {
    method: 'zero_width',
    positions,
    characters,
    decodedBytes: Math.floor(positions.length / 8), // ~8 ZW chars per byte
    description: `Found ${positions.length} zero-width characters that may encode hidden data`,
  };
}

/**
 * Detect invisible characters in text.
 */
function detectInvisible(text: string): StegoFinding | null {
  const positions: number[] = [];
  const characters: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!;
    if (INVISIBLE_CHARS.has(code)) {
      positions.push(i);
      characters.push(`U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  }

  if (positions.length === 0) return null;

  return {
    method: 'invisible_char',
    positions,
    characters,
    decodedBytes: positions.length,
    description: `Found ${positions.length} invisible characters that may carry hidden information`,
  };
}

/**
 * Detect whitespace-encoded data: unusual sequences of tabs and spaces
 * (e.g., Whitespace language encoding, trailing whitespace steganography).
 */
function detectWhitespaceEncoding(text: string): StegoFinding | null {
  const positions: number[] = [];
  const characters: string[] = [];

  // Look for suspicious trailing whitespace patterns on lines
  const lines = text.split('\n');
  let offset = 0;
  let suspiciousTrailing = 0;

  for (const line of lines) {
    const trimmed = line.replace(/\s+$/, '');
    const trailing = line.length - trimmed.length;
    if (trailing > 2) {
      // More than 2 trailing whitespace chars is suspicious
      suspiciousTrailing++;
      for (let i = trimmed.length; i < line.length; i++) {
        positions.push(offset + i);
        characters.push(
          line[i] === '\t' ? 'TAB' : `SP(${line.charCodeAt(i).toString(16)})`,
        );
      }
    }
    offset += line.length + 1; // +1 for newline
  }

  // Also detect mixed tab/space sequences that could be binary encoding
  const tabSpaceRegex = /[\t ]{8,}/g;
  let match: RegExpExecArray | null;
  while ((match = tabSpaceRegex.exec(text)) !== null) {
    const segment = match[0];
    let hasMix = false;
    let hasTab = false;
    let hasSpace = false;
    for (const c of segment) {
      if (c === '\t') hasTab = true;
      if (c === ' ') hasSpace = true;
    }
    hasMix = hasTab && hasSpace;
    if (hasMix) {
      for (let i = 0; i < segment.length; i++) {
        const pos = match.index + i;
        if (!positions.includes(pos)) {
          positions.push(pos);
          characters.push(segment[i] === '\t' ? 'TAB' : 'SPACE');
        }
      }
    }
  }

  if (positions.length === 0 && suspiciousTrailing < 3) return null;

  return {
    method: 'whitespace_encoding',
    positions,
    characters,
    decodedBytes: Math.floor(positions.length / 8),
    description: `Found ${positions.length} suspicious whitespace patterns across ${suspiciousTrailing} lines`,
  };
}

/**
 * Detect homoglyph substitutions: characters from different scripts
 * that visually resemble Latin characters.
 */
function detectHomoglyph(text: string): StegoFinding | null {
  const positions: number[] = [];
  const characters: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!;
    const latinEquiv = HOMOGLYPH_MAP[code];
    if (latinEquiv) {
      positions.push(i);
      characters.push(
        `U+${code.toString(16).toUpperCase().padStart(4, '0')}→${latinEquiv}`,
      );
    }
    // Handle surrogate pairs
    if (code > 0xFFFF) i++;
  }

  if (positions.length === 0) return null;

  return {
    method: 'homoglyph',
    positions,
    characters,
    decodedBytes: positions.length,
    description: `Found ${positions.length} homoglyph substitutions from non-Latin scripts`,
  };
}

/**
 * Determine risk level from findings.
 */
function assessRisk(findings: StegoFinding[]): StegoRiskLevel {
  const totalBytes = findings.reduce((sum, f) => sum + f.decodedBytes, 0);
  const methodCount = new Set(findings.map((f) => f.method)).size;

  if (totalBytes > 10 || methodCount > 1) return 'high';
  if (findings.length >= 2 || totalBytes >= 2) return 'medium';
  return 'low';
}

export class StegoScanner {
  /**
   * Scan text for all forms of steganographic content.
   */
  scan(text: string): StegoScanResult {
    const findings: StegoFinding[] = [];

    const zw = detectZeroWidth(text);
    if (zw) findings.push(zw);

    const inv = detectInvisible(text);
    if (inv) findings.push(inv);

    const ws = detectWhitespaceEncoding(text);
    if (ws) findings.push(ws);

    const hg = detectHomoglyph(text);
    if (hg) findings.push(hg);

    const totalHiddenBytes = findings.reduce((sum, f) => sum + f.decodedBytes, 0);
    const methodsDetected = [...new Set(findings.map((f) => f.method))];
    const hasHiddenContent = findings.length > 0;
    const risk = hasHiddenContent ? assessRisk(findings) : 'low';

    // Generate clean text by removing all detected hidden characters
    let cleanText = text;
    if (hasHiddenContent) {
      cleanText = stripAll(text);
    }

    return {
      hasHiddenContent,
      risk,
      findings,
      totalHiddenBytes,
      methodsDetected,
      cleanText,
    };
  }
}

/**
 * Remove all zero-width, invisible, and homoglyph characters from text.
 * Homoglyphs are replaced with their Latin equivalents.
 */
function stripAll(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!;
    if (ZERO_WIDTH_CHARS.has(code) || INVISIBLE_CHARS.has(code)) {
      continue;
    }
    const latinEquiv = HOMOGLYPH_MAP[code];
    if (latinEquiv) {
      result += latinEquiv;
    } else {
      result += String.fromCodePoint(code);
    }
    if (code > 0xFFFF) i++; // surrogate pair
  }
  return result;
}
