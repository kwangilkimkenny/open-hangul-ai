// ============================================================
// AEGIS Homoglyph Map & Utilities — confusable character normalization
// ============================================================

/**
 * Maps confusable Unicode characters to their ASCII equivalents.
 * Covers Cyrillic, Greek, Fullwidth, Math/Script, Space, Dash,
 * Quote variants, Subscript/Superscript, and other look-alikes.
 */
export const HOMOGLYPH_MAP: Record<string, string> = {
  // --- Cyrillic → Latin ---
  '\u0410': 'A', // А
  '\u0412': 'B', // В
  '\u0421': 'C', // С
  '\u0415': 'E', // Е
  '\u041D': 'H', // Н
  '\u0406': 'I', // І
  '\u0408': 'J', // Ј
  '\u041A': 'K', // К
  '\u041C': 'M', // М
  '\u041E': 'O', // О
  '\u0420': 'P', // Р
  '\u0405': 'S', // Ѕ
  '\u0422': 'T', // Т
  '\u0425': 'X', // Х
  '\u0423': 'Y', // У
  '\u0430': 'a', // а
  '\u0441': 'c', // с
  '\u0435': 'e', // е
  '\u04BB': 'h', // һ
  '\u0456': 'i', // і
  '\u0458': 'j', // ј
  '\u043E': 'o', // о
  '\u0440': 'p', // р
  '\u0455': 's', // ѕ
  '\u0443': 'y', // у
  '\u0445': 'x', // х
  '\u044A': 'b', // ъ
  '\u0432': 'v', // в
  '\u043A': 'k', // к

  // --- Greek → Latin ---
  '\u0391': 'A', // Α
  '\u0392': 'B', // Β
  '\u0395': 'E', // Ε
  '\u0396': 'Z', // Ζ
  '\u0397': 'H', // Η
  '\u0399': 'I', // Ι
  '\u039A': 'K', // Κ
  '\u039C': 'M', // Μ
  '\u039D': 'N', // Ν
  '\u039F': 'O', // Ο
  '\u03A1': 'P', // Ρ
  '\u03A4': 'T', // Τ
  '\u03A5': 'Y', // Υ
  '\u03A7': 'X', // Χ
  '\u03B1': 'a', // α
  '\u03BF': 'o', // ο
  '\u03C1': 'p', // ρ
  '\u03C5': 'u', // υ
  '\u03B9': 'i', // ι

  // --- Fullwidth → ASCII ---
  '\uFF21': 'A', '\uFF22': 'B', '\uFF23': 'C', '\uFF24': 'D',
  '\uFF25': 'E', '\uFF26': 'F', '\uFF27': 'G', '\uFF28': 'H',
  '\uFF29': 'I', '\uFF2A': 'J', '\uFF2B': 'K', '\uFF2C': 'L',
  '\uFF2D': 'M', '\uFF2E': 'N', '\uFF2F': 'O', '\uFF30': 'P',
  '\uFF31': 'Q', '\uFF32': 'R', '\uFF33': 'S', '\uFF34': 'T',
  '\uFF35': 'U', '\uFF36': 'V', '\uFF37': 'W', '\uFF38': 'X',
  '\uFF39': 'Y', '\uFF3A': 'Z',
  '\uFF41': 'a', '\uFF42': 'b', '\uFF43': 'c', '\uFF44': 'd',
  '\uFF45': 'e', '\uFF46': 'f', '\uFF47': 'g', '\uFF48': 'h',
  '\uFF49': 'i', '\uFF4A': 'j', '\uFF4B': 'k', '\uFF4C': 'l',
  '\uFF4D': 'm', '\uFF4E': 'n', '\uFF4F': 'o', '\uFF50': 'p',
  '\uFF51': 'q', '\uFF52': 'r', '\uFF53': 's', '\uFF54': 't',
  '\uFF55': 'u', '\uFF56': 'v', '\uFF57': 'w', '\uFF58': 'x',
  '\uFF59': 'y', '\uFF5A': 'z',

  // --- Space variants → ASCII space ---
  '\u00A0': ' ', // NBSP
  '\u2000': ' ', // En Quad
  '\u2001': ' ', // Em Quad
  '\u2002': ' ', // En Space
  '\u2003': ' ', // Em Space
  '\u2004': ' ', // Three-Per-Em Space
  '\u2005': ' ', // Four-Per-Em Space
  '\u2006': ' ', // Six-Per-Em Space
  '\u2007': ' ', // Figure Space
  '\u2008': ' ', // Punctuation Space
  '\u2009': ' ', // Thin Space
  '\u200A': ' ', // Hair Space
  '\u205F': ' ', // Medium Mathematical Space
  '\u3000': ' ', // Ideographic Space

  // --- Dash variants → ASCII hyphen ---
  '\u2010': '-', // Hyphen
  '\u2011': '-', // Non-Breaking Hyphen
  '\u2012': '-', // Figure Dash
  '\u2013': '-', // En Dash
  '\u2014': '-', // Em Dash
  '\u2015': '-', // Horizontal Bar
  '\uFE58': '-', // Small Em Dash
  '\uFE63': '-', // Small Hyphen-Minus
  '\uFF0D': '-', // Fullwidth Hyphen-Minus

  // --- Quote variants ---
  '\u2018': "'", // Left Single Quote
  '\u2019': "'", // Right Single Quote
  '\u201A': "'", // Single Low-9 Quote
  '\u201B': "'", // Single High-Reversed-9 Quote
  '\u201C': '"', // Left Double Quote
  '\u201D': '"', // Right Double Quote
  '\u201E': '"', // Double Low-9 Quote
  '\u201F': '"', // Double High-Reversed-9 Quote
  '\u00AB': '"', // Left Guillemet
  '\u00BB': '"', // Right Guillemet

  // --- Subscript digits ---
  '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3',
  '\u2084': '4', '\u2085': '5', '\u2086': '6', '\u2087': '7',
  '\u2088': '8', '\u2089': '9',

  // --- Superscript digits ---
  '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3',
  '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7',
  '\u2078': '8', '\u2079': '9',
};

/** Check if text contains any homoglyph characters. */
export function containsHomoglyphs(text: string): boolean {
  for (const ch of text) {
    if (ch in HOMOGLYPH_MAP) return true;
  }
  return false;
}

/** Replace all homoglyph characters with their ASCII equivalents. */
export function normalizeHomoglyphs(text: string): string {
  let result = '';
  for (const ch of text) {
    result += HOMOGLYPH_MAP[ch] ?? ch;
  }
  return result;
}

/** Ratio of homoglyph characters to total characters. */
export function homoglyphRatio(text: string): number {
  if (text.length === 0) return 0;
  let count = 0;
  for (const ch of text) {
    if (ch in HOMOGLYPH_MAP) count++;
  }
  return count / text.length;
}

/** Count homoglyph characters in text. */
export function countHomoglyphs(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch in HOMOGLYPH_MAP) count++;
  }
  return count;
}
