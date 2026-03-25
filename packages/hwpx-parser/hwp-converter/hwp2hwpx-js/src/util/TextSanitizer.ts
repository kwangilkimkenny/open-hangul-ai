/**
 * TextSanitizer.ts - 화이트리스트 기반 텍스트 새니타이징
 *
 * Phase 4.1: 데이터 무결성 개선
 * - 유효한 유니코드 범위 화이트리스트 기반 검증
 * - 의심스러운 문자에 대한 경고 생성
 * - HWP 특수 문자 처리 (수식, PUA 등)
 *
 * @module Util
 * @category Sanitizer
 */

/**
 * 유효한 유니코드 범위 목록
 * XML 1.0에서 허용되는 문자 + 다국어 지원
 */
export const VALID_UNICODE_RANGES: ReadonlyArray<readonly [number, number, string]> = [
    // Basic multilingual plane
    [0x0009, 0x0009, 'Tab'],                      // Tab
    [0x000A, 0x000A, 'Line Feed'],                // LF
    [0x000D, 0x000D, 'Carriage Return'],          // CR
    [0x0020, 0x007F, 'Basic Latin'],              // Space to DEL-1
    [0x0080, 0x00FF, 'Latin-1 Supplement'],       // Latin-1
    [0x0100, 0x017F, 'Latin Extended-A'],         // Latin Extended-A
    [0x0180, 0x024F, 'Latin Extended-B'],         // Latin Extended-B
    [0x0250, 0x02AF, 'IPA Extensions'],           // IPA Extensions
    [0x02B0, 0x02FF, 'Spacing Modifiers'],        // Spacing Modifier Letters
    [0x0300, 0x036F, 'Combining Diacriticals'],   // Combining Diacritical Marks
    [0x0370, 0x03FF, 'Greek and Coptic'],         // Greek
    [0x0400, 0x04FF, 'Cyrillic'],                 // Cyrillic
    [0x0500, 0x052F, 'Cyrillic Supplement'],      // Cyrillic Supplement
    [0x0530, 0x058F, 'Armenian'],                 // Armenian
    [0x0590, 0x05FF, 'Hebrew'],                   // Hebrew
    [0x0600, 0x06FF, 'Arabic'],                   // Arabic
    [0x0900, 0x097F, 'Devanagari'],               // Devanagari
    [0x0980, 0x09FF, 'Bengali'],                  // Bengali
    [0x0A00, 0x0A7F, 'Gurmukhi'],                 // Gurmukhi
    [0x0A80, 0x0AFF, 'Gujarati'],                 // Gujarati
    [0x0B00, 0x0B7F, 'Oriya'],                    // Oriya
    [0x0B80, 0x0BFF, 'Tamil'],                    // Tamil
    [0x0C00, 0x0C7F, 'Telugu'],                   // Telugu
    [0x0C80, 0x0CFF, 'Kannada'],                  // Kannada
    [0x0D00, 0x0D7F, 'Malayalam'],                // Malayalam
    [0x0E00, 0x0E7F, 'Thai'],                     // Thai
    [0x0E80, 0x0EFF, 'Lao'],                      // Lao
    [0x0F00, 0x0FFF, 'Tibetan'],                  // Tibetan
    [0x1000, 0x109F, 'Myanmar'],                  // Myanmar
    [0x10A0, 0x10FF, 'Georgian'],                 // Georgian
    [0x1100, 0x11FF, 'Hangul Jamo'],              // Hangul Jamo
    [0x1E00, 0x1EFF, 'Latin Extended Additional'],// Latin Extended Additional
    [0x1F00, 0x1FFF, 'Greek Extended'],           // Greek Extended
    [0x2000, 0x206F, 'General Punctuation'],      // General Punctuation
    [0x2070, 0x209F, 'Super/Subscripts'],         // Superscripts and Subscripts
    [0x20A0, 0x20CF, 'Currency Symbols'],         // Currency Symbols
    [0x20D0, 0x20FF, 'Combining Marks'],          // Combining Diacritical Marks for Symbols
    [0x2100, 0x214F, 'Letterlike Symbols'],       // Letterlike Symbols
    [0x2150, 0x218F, 'Number Forms'],             // Number Forms
    [0x2190, 0x21FF, 'Arrows'],                   // Arrows
    [0x2200, 0x22FF, 'Mathematical Operators'],   // Mathematical Operators
    [0x2300, 0x23FF, 'Miscellaneous Technical'],  // Miscellaneous Technical
    [0x2400, 0x243F, 'Control Pictures'],         // Control Pictures
    [0x2460, 0x24FF, 'Enclosed Alphanumerics'],   // Enclosed Alphanumerics
    [0x2500, 0x257F, 'Box Drawing'],              // Box Drawing
    [0x2580, 0x259F, 'Block Elements'],           // Block Elements
    [0x25A0, 0x25FF, 'Geometric Shapes'],         // Geometric Shapes
    [0x2600, 0x26FF, 'Miscellaneous Symbols'],    // Miscellaneous Symbols
    [0x2700, 0x27BF, 'Dingbats'],                 // Dingbats
    [0x27C0, 0x27EF, 'Math Symbols-A'],           // Miscellaneous Mathematical Symbols-A
    [0x27F0, 0x27FF, 'Supplemental Arrows-A'],    // Supplemental Arrows-A
    [0x2900, 0x297F, 'Supplemental Arrows-B'],    // Supplemental Arrows-B
    [0x2980, 0x29FF, 'Math Symbols-B'],           // Miscellaneous Mathematical Symbols-B
    [0x2A00, 0x2AFF, 'Supplemental Math Operators'], // Supplemental Mathematical Operators
    [0x2E80, 0x2EFF, 'CJK Radicals Supplement'],  // CJK Radicals Supplement
    [0x2F00, 0x2FDF, 'Kangxi Radicals'],          // Kangxi Radicals
    [0x3000, 0x303F, 'CJK Symbols and Punctuation'], // CJK Symbols and Punctuation
    [0x3040, 0x309F, 'Hiragana'],                 // Hiragana
    [0x30A0, 0x30FF, 'Katakana'],                 // Katakana
    [0x3100, 0x312F, 'Bopomofo'],                 // Bopomofo
    [0x3130, 0x318F, 'Hangul Compatibility Jamo'], // Hangul Compatibility Jamo
    [0x3190, 0x319F, 'Kanbun'],                   // Kanbun
    [0x31A0, 0x31BF, 'Bopomofo Extended'],        // Bopomofo Extended
    [0x31F0, 0x31FF, 'Katakana Phonetic Extensions'], // Katakana Phonetic Extensions
    [0x3200, 0x32FF, 'Enclosed CJK Letters'],     // Enclosed CJK Letters and Months
    [0x3300, 0x33FF, 'CJK Compatibility'],        // CJK Compatibility
    [0x3400, 0x4DBF, 'CJK Unified Ideographs Ext A'], // CJK Unified Ideographs Extension A
    [0x4E00, 0x9FFF, 'CJK Unified Ideographs'],   // CJK Unified Ideographs
    [0xA000, 0xA48F, 'Yi Syllables'],             // Yi Syllables
    [0xA490, 0xA4CF, 'Yi Radicals'],              // Yi Radicals
    [0xAC00, 0xD7AF, 'Hangul Syllables'],         // Hangul Syllables
    [0xD7B0, 0xD7FF, 'Hangul Jamo Extended-B'],   // Hangul Jamo Extended-B
    [0xF900, 0xFAFF, 'CJK Compatibility Ideographs'], // CJK Compatibility Ideographs
    [0xFB00, 0xFB4F, 'Alphabetic Presentation Forms'], // Alphabetic Presentation Forms
    [0xFE10, 0xFE1F, 'Vertical Forms'],           // Vertical Forms
    [0xFE30, 0xFE4F, 'CJK Compatibility Forms'],  // CJK Compatibility Forms
    [0xFE50, 0xFE6F, 'Small Form Variants'],      // Small Form Variants
    [0xFF00, 0xFFEF, 'Halfwidth and Fullwidth Forms'], // Halfwidth and Fullwidth Forms
    [0xFFF0, 0xFFFD, 'Specials'],                 // Specials (excluding FFFE, FFFF)
] as const;

/**
 * HWP 수식 폰트에서 사용되는 특수 문자 범위
 * 이 범위의 문자들은 수식 컨텍스트에서만 유효
 */
export const EQUATION_SPECIAL_RANGES: ReadonlyArray<readonly [number, number]> = [
    [0xE000, 0xF8FF],  // Private Use Area (PUA)
] as const;

/**
 * 새니타이징 결과 인터페이스
 */
export interface SanitizeResult {
    /** 새니타이징된 텍스트 */
    sanitized: string;
    /** 제거된 문자에 대한 경고 목록 */
    warnings: SanitizeWarning[];
    /** 원본 텍스트와 동일한지 여부 */
    unchanged: boolean;
    /** 제거된 문자 수 */
    removedCount: number;
}

/**
 * 새니타이징 경고 인터페이스
 */
export interface SanitizeWarning {
    /** 문자의 유니코드 코드포인트 */
    codePoint: number;
    /** 문자의 16진수 표현 */
    hex: string;
    /** 원본 텍스트 내 위치 */
    position: number;
    /** 경고 메시지 */
    message: string;
}

/**
 * 새니타이징 옵션
 */
export interface SanitizeOptions {
    /** PUA (Private Use Area) 문자 허용 여부 - 수식용 */
    allowPUA?: boolean;
    /** 경고 생성 여부 */
    generateWarnings?: boolean;
    /** 알 수 없는 문자를 대체 문자로 치환 (null이면 제거) */
    replacementChar?: string | null;
    /** 최대 경고 수 (성능 최적화) */
    maxWarnings?: number;
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
    allowPUA: false,
    generateWarnings: true,
    replacementChar: null,
    maxWarnings: 100,
};

// 빠른 검색을 위한 범위 캐시 (비트맵 방식)
// BMP (0x0000-0xFFFF) 범위만 캐시
const VALID_CHAR_BITMAP = new Uint8Array(8192); // 65536 / 8 bits

// 범위 캐시 초기화
function initBitmap(): void {
    for (const [start, end] of VALID_UNICODE_RANGES) {
        for (let code = start; code <= end && code <= 0xFFFF; code++) {
            const byteIndex = code >> 3;
            const bitIndex = code & 7;
            VALID_CHAR_BITMAP[byteIndex] |= (1 << bitIndex);
        }
    }
}

// 모듈 로드 시 초기화
initBitmap();

/**
 * 문자가 유효한 유니코드 범위 내에 있는지 확인 (최적화됨)
 */
export function isValidCharacter(code: number, allowPUA: boolean = false): boolean {
    // BMP 범위 (0x0000-0xFFFF)는 비트맵으로 빠르게 확인
    if (code <= 0xFFFF) {
        const byteIndex = code >> 3;
        const bitIndex = code & 7;
        if ((VALID_CHAR_BITMAP[byteIndex] & (1 << bitIndex)) !== 0) {
            return true;
        }
    }

    // PUA 허용 시 체크
    if (allowPUA) {
        for (const [start, end] of EQUATION_SPECIAL_RANGES) {
            if (code >= start && code <= end) {
                return true;
            }
        }
    }

    // Supplementary planes (SMP, SIP, TIP 등) - 서로게이트 페어로 인코딩되는 범위
    // 0x10000-0x10FFFF: 대부분 유효한 문자로 간주
    if (code >= 0x10000 && code <= 0x10FFFF) {
        return true;
    }

    return false;
}

/**
 * 문자가 어떤 유니코드 블록에 속하는지 반환
 */
export function getUnicodeBlockName(code: number): string {
    for (const [start, end, name] of VALID_UNICODE_RANGES) {
        if (code >= start && code <= end) {
            return name;
        }
    }
    if (code >= 0xE000 && code <= 0xF8FF) {
        return 'Private Use Area';
    }
    if (code >= 0x10000 && code <= 0x10FFFF) {
        return 'Supplementary Plane';
    }
    return 'Unknown';
}

/**
 * 텍스트를 새니타이징하여 유효한 문자만 유지
 *
 * @param text 원본 텍스트
 * @param options 새니타이징 옵션
 * @returns 새니타이징 결과
 */
export function sanitizeText(text: string, options?: SanitizeOptions): SanitizeResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const warnings: SanitizeWarning[] = [];
    let removedCount = 0;

    if (!text) {
        return {
            sanitized: text || '',
            warnings: [],
            unchanged: true,
            removedCount: 0,
        };
    }

    const result: string[] = [];

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        let code = char.charCodeAt(0);

        // 서로게이트 페어 처리 (이모지 등)
        if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
            const nextCode = text.charCodeAt(i + 1);
            if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                // 서로게이트 페어를 합쳐서 실제 코드포인트 계산
                code = 0x10000 + ((code - 0xD800) << 10) + (nextCode - 0xDC00);
                if (isValidCharacter(code, opts.allowPUA)) {
                    result.push(char);
                    result.push(text[i + 1]);
                } else {
                    removedCount++;
                    if (opts.generateWarnings && warnings.length < opts.maxWarnings) {
                        warnings.push({
                            codePoint: code,
                            hex: `U+${code.toString(16).toUpperCase().padStart(6, '0')}`,
                            position: i,
                            message: `Removed supplementary character ${getUnicodeBlockName(code)}`,
                        });
                    }
                    if (opts.replacementChar !== null) {
                        result.push(opts.replacementChar);
                    }
                }
                i++; // 서로게이트 페어의 두 번째 문자 건너뛰기
                continue;
            }
        }

        if (isValidCharacter(code, opts.allowPUA)) {
            result.push(char);
        } else {
            removedCount++;
            if (opts.generateWarnings && warnings.length < opts.maxWarnings) {
                warnings.push({
                    codePoint: code,
                    hex: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
                    position: i,
                    message: `Removed invalid character at position ${i}`,
                });
            }
            if (opts.replacementChar !== null) {
                result.push(opts.replacementChar);
            }
        }
    }

    const sanitized = result.join('');

    return {
        sanitized,
        warnings,
        unchanged: sanitized === text,
        removedCount,
    };
}

/**
 * 수식 스크립트용 새니타이징 (PUA 문자 허용)
 */
export function sanitizeEquationScript(script: string): SanitizeResult {
    return sanitizeText(script, {
        allowPUA: true,
        generateWarnings: false,
    });
}

/**
 * XML 텍스트 노드용 새니타이징
 * XML 1.0에서 허용되지 않는 문자를 제거하고 특수 문자를 이스케이프
 */
export function sanitizeForXml(text: string): string {
    const { sanitized } = sanitizeText(text, {
        allowPUA: false,
        generateWarnings: false,
    });

    // XML 특수 문자 이스케이프
    return sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * 빠른 유효성 검사 (경고 없이)
 */
export function quickSanitize(text: string): string {
    return sanitizeText(text, {
        generateWarnings: false,
    }).sanitized;
}

/**
 * TextSanitizer 클래스 (기존 HwpSanitizer와 호환)
 */
export class TextSanitizer {
    /**
     * 텍스트에서 유효하지 않은 문자 제거
     */
    static sanitize(text: string): string {
        return quickSanitize(text);
    }

    /**
     * 상세 새니타이징 (경고 포함)
     */
    static sanitizeWithWarnings(text: string): SanitizeResult {
        return sanitizeText(text);
    }

    /**
     * 수식 스크립트 새니타이징
     */
    static sanitizeEquation(script: string): string {
        return sanitizeEquationScript(script).sanitized;
    }

    /**
     * XML용 새니타이징
     */
    static sanitizeXml(text: string): string {
        return sanitizeForXml(text);
    }

    /**
     * 문자 유효성 검사
     */
    static isValid(code: number): boolean {
        return isValidCharacter(code);
    }
}

export default TextSanitizer;
