// ============================================================
// Zero-Width Character Steganographic Encoder
// ZW_SPACE (U+200B) = 0, ZW_NON_JOINER (U+200C) = 1,
// ZW_JOINER (U+200D) = separator between bytes.
// ============================================================

declare const TextEncoder: { new(): { encode(s: string): Uint8Array } };
declare const TextDecoder: { new(): { decode(data: Uint8Array): string } };

const ZW_SPACE = '\u200B';       // bit 0
const ZW_NON_JOINER = '\u200C';  // bit 1
const ZW_JOINER = '\u200D';      // byte separator

/** All zero-width characters used in encoding + common invisible chars. */
const ALL_ZERO_WIDTH = new Set([
  '\u200B', // ZERO WIDTH SPACE
  '\u200C', // ZERO WIDTH NON-JOINER
  '\u200D', // ZERO WIDTH JOINER
  '\uFEFF', // ZERO WIDTH NO-BREAK SPACE (BOM)
  '\u2060', // WORD JOINER
  '\u180E', // MONGOLIAN VOWEL SEPARATOR
  '\u200E', // LEFT-TO-RIGHT MARK
  '\u200F', // RIGHT-TO-LEFT MARK
  '\u202A', // LEFT-TO-RIGHT EMBEDDING
  '\u202C', // POP DIRECTIONAL FORMATTING
]);

export class ZeroWidthEncoder {
  /**
   * Encode a string into a zero-width character sequence.
   * Each byte of the UTF-8 encoded input is represented as 8 bits
   * using ZW_SPACE (0) and ZW_NON_JOINER (1), separated by ZW_JOINER.
   */
  encode(data: string): string {
    const bytes = new TextEncoder().encode(data);
    const parts: string[] = [];

    for (let i = 0; i < bytes.length; i++) {
      let byte = bytes[i];
      let bits = '';
      for (let b = 7; b >= 0; b--) {
        bits += (byte >> b) & 1 ? ZW_NON_JOINER : ZW_SPACE;
      }
      parts.push(bits);
    }

    return parts.join(ZW_JOINER);
  }

  /**
   * Decode hidden data from a text that may contain zero-width characters.
   * Extracts only the ZW_SPACE, ZW_NON_JOINER, and ZW_JOINER characters,
   * then interprets them as encoded bytes.
   * Returns null if no valid encoded data is found.
   */
  decode(text: string): string | null {
    // Extract only our encoding characters
    let encoded = '';
    for (const ch of text) {
      if (ch === ZW_SPACE || ch === ZW_NON_JOINER || ch === ZW_JOINER) {
        encoded += ch;
      }
    }

    if (encoded.length === 0) return null;

    // Split by separator to get byte groups
    const byteGroups = encoded.split(ZW_JOINER);
    const bytes: number[] = [];

    for (const group of byteGroups) {
      if (group.length === 0) continue;
      if (group.length !== 8) {
        // Invalid byte group length — might be partial or corrupt
        continue;
      }

      let byte = 0;
      for (let i = 0; i < 8; i++) {
        byte = (byte << 1) | (group[i] === ZW_NON_JOINER ? 1 : 0);
      }
      bytes.push(byte);
    }

    if (bytes.length === 0) return null;

    try {
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch {
      return null;
    }
  }

  /**
   * Remove all zero-width characters from a string.
   */
  strip(text: string): string {
    let result = '';
    for (const ch of text) {
      if (!ALL_ZERO_WIDTH.has(ch)) {
        result += ch;
      }
    }
    return result;
  }

  /**
   * Embed hidden data within visible text by inserting the encoded
   * sequence after the first character.
   */
  embed(visibleText: string, hiddenData: string): string {
    const encoded = this.encode(hiddenData);
    if (visibleText.length === 0) return encoded;
    return visibleText[0] + encoded + visibleText.slice(1);
  }

  /**
   * Check if a string contains any zero-width characters.
   */
  hasZeroWidth(text: string): boolean {
    for (const ch of text) {
      if (ALL_ZERO_WIDTH.has(ch)) return true;
    }
    return false;
  }
}
