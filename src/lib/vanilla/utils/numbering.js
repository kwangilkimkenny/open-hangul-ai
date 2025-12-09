/**
 * Numbering & Bullet Conversion Utilities
 * 번호 매기기 및 글머리 기호 변환 유틸리티
 * 
 * @module utils/numbering
 * @version 2.0.0
 */

import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * Convert number to Roman numerals (I, II, III...)
 * @param {number} num - Number to convert
 * @returns {string} Roman numeral
 * 
 * @example
 * toRoman(1)  // 'I'
 * toRoman(4)  // 'IV'
 * toRoman(9)  // 'IX'
 */
export function toRoman(num) {
    const romanNumerals = [
        ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
        ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
        ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
    ];

    let result = '';
    for (const [roman, value] of romanNumerals) {
        while (num >= value) {
            result += roman;
            num -= value;
        }
    }
    return result;
}

/**
 * Convert number to letter (A, B, C...)
 * @param {number} num - Number to convert
 * @returns {string} Letter
 * 
 * @example
 * toLetter(1)  // 'A'
 * toLetter(26) // 'Z'
 * toLetter(27) // 'AA'
 */
export function toLetter(num) {
    let result = '';
    while (num > 0) {
        num--; // Adjust for 0-indexing
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26);
    }
    return result || 'A';
}

/**
 * Convert number to Korean Ganada (가, 나, 다...)
 * 한글 가나다 순서로 변환
 * 
 * @param {number} num - Number to convert (1-14)
 * @returns {string} Korean Ganada character
 * 
 * @example
 * toHangulGanada(1)  // '가'
 * toHangulGanada(2)  // '나'
 * toHangulGanada(3)  // '다'
 */
export function toHangulGanada(num) {
    // 한글 가나다 순서 (14개)
    const hangul = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
    if (num >= 1 && num <= hangul.length) {
        return hangul[num - 1];
    }
    // 범위를 벗어나면 숫자로 대체
    logger.warn(`toHangulGanada: num ${num} out of range (1-${hangul.length})`);
    return num.toString();
}

/**
 * Convert number to Korean Jamo (ㄱ, ㄴ, ㄷ...)
 * 한글 자음 순서로 변환
 * 
 * @param {number} num - Number to convert (1-14)
 * @returns {string} Korean Jamo character
 * 
 * @example
 * toHangulJamo(1)  // 'ㄱ'
 * toHangulJamo(2)  // 'ㄴ'
 * toHangulJamo(3)  // 'ㄷ'
 */
export function toHangulJamo(num) {
    // 한글 자음 순서 (받침 제외, 14개)
    const jamo = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    if (num >= 1 && num <= jamo.length) {
        return jamo[num - 1];
    }
    logger.warn(`toHangulJamo: num ${num} out of range (1-${jamo.length})`);
    return num.toString();
}

/**
 * Convert number to Circled Hangul (㉮, ㉯, ㉰...)
 * 원문자 한글로 변환
 * 
 * @param {number} num - Number to convert (1-7)
 * @returns {string} Circled Hangul character
 * 
 * @example
 * toCircledHangul(1)  // '㉮'
 * toCircledHangul(2)  // '㉯'
 * toCircledHangul(3)  // '㉰'
 */
export function toCircledHangul(num) {
    // 원문자 한글 (유니코드 U+3260 ~ U+3266, 7개)
    // ㉮, ㉯, ㉰, ㉱, ㉲, ㉳, ㉴
    const circled = ['㉮', '㉯', '㉰', '㉱', '㉲', '㉳', '㉴'];
    if (num >= 1 && num <= circled.length) {
        return circled[num - 1];
    }
    logger.warn(`toCircledHangul: num ${num} out of range (1-${circled.length})`);
    return num.toString();
}

/**
 * Convert number to Circled Decimal (①, ②, ③...)
 * 원문자 숫자로 변환
 * 
 * @param {number} num - Number to convert (1-50)
 * @returns {string} Circled Decimal character
 * 
 * @example
 * toCircledDecimal(1)  // '①'
 * toCircledDecimal(10) // '⑩'
 * toCircledDecimal(20) // '⑳'
 */
export function toCircledDecimal(num) {
    // 원문자 숫자 (유니코드)
    if (num >= 1 && num <= 20) {
        // ① ~ ⑳: U+2460 ~ U+2473
        return String.fromCharCode(0x2460 + num - 1);
    } else if (num >= 21 && num <= 35) {
        // ㉑ ~ ㉟: U+3251 ~ U+325F
        return String.fromCharCode(0x3251 + num - 21);
    } else if (num >= 36 && num <= 50) {
        // ㊱ ~ ㊿: U+32B1 ~ U+32BF
        return String.fromCharCode(0x32B1 + num - 36);
    }
    logger.warn(`toCircledDecimal: num ${num} out of range (1-50)`);
    return num.toString();
}

/**
 * Convert number to Korean Hanja (일, 이, 삼...)
 * 한글 한자 읽기로 변환
 * 
 * @param {number} num - Number to convert (1-99)
 * @returns {string} Korean Hanja
 * 
 * @example
 * toKoreanHanja(1)  // '일'
 * toKoreanHanja(10) // '십'
 * toKoreanHanja(15) // '십오'
 * toKoreanHanja(21) // '이십일'
 */
export function toKoreanHanja(num) {
    // 한글 한자 읽기
    const hanja = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십'];
    
    if (num >= 1 && num <= 10) {
        return hanja[num];
    } else if (num <= 99) {
        const tens = Math.floor(num / 10);
        const ones = num % 10;
        let result = '';
        
        if (tens > 0) {
            result = (tens > 1 ? hanja[tens] : '') + hanja[10];
        }
        if (ones > 0) {
            result += hanja[ones];
        }
        
        return result;
    }
    
    logger.warn(`toKoreanHanja: num ${num} out of range (1-99)`);
    return num.toString();
}

/**
 * Convert number to Chinese Hanja (一, 二, 三...)
 * 중국식 한자 숫자로 변환
 * 
 * @param {number} num - Number to convert (1-99)
 * @returns {string} Chinese Hanja
 * 
 * @example
 * toChineseHanja(1)  // '一'
 * toChineseHanja(10) // '十'
 * toChineseHanja(15) // '十五'
 * toChineseHanja(21) // '二十一'
 */
export function toChineseHanja(num) {
    // 중국식 한자 숫자
    const hanja = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    
    if (num >= 1 && num <= 10) {
        return hanja[num];
    } else if (num <= 99) {
        const tens = Math.floor(num / 10);
        const ones = num % 10;
        let result = '';
        
        if (tens > 0) {
            result = (tens > 1 ? hanja[tens] : '') + hanja[10];
        }
        if (ones > 0) {
            result += hanja[ones];
        }
        
        return result;
    }
    
    logger.warn(`toChineseHanja: num ${num} out of range (1-99)`);
    return num.toString();
}

/**
 * Convert number based on format type
 * 포맷 타입에 따라 번호 변환
 * 
 * @param {number} num - Number to convert
 * @param {string} format - Format type (DECIMAL, ROMAN, LETTER, HANGUL_GANADA, etc.)
 * @returns {string} Formatted number
 * 
 * @example
 * formatNumber(1, 'DECIMAL')         // '1'
 * formatNumber(1, 'ROMAN')           // 'I'
 * formatNumber(1, 'HANGUL_GANADA')   // '가'
 */
export function formatNumber(num, format) {
    switch (format?.toUpperCase()) {
    case 'DECIMAL':
    case 'NUMBER':
        return num.toString();
            
    case 'ROMAN':
    case 'ROMAN_UPPER':
        return toRoman(num);
            
    case 'ROMAN_LOWER':
        return toRoman(num).toLowerCase();
            
    case 'LETTER':
    case 'LETTER_UPPER':
    case 'ALPHA':
        return toLetter(num);
            
    case 'LETTER_LOWER':
    case 'ALPHA_LOWER':
        return toLetter(num).toLowerCase();
            
    case 'HANGUL_GANADA':
    case 'KOREAN_GANADA':
        return toHangulGanada(num);
            
    case 'HANGUL_JAMO':
    case 'KOREAN_JAMO':
    case 'HANGUL_CONSONANT':
        return toHangulJamo(num);
            
    case 'CIRCLED_HANGUL':
    case 'KOREAN_CIRCLED':
        return toCircledHangul(num);
            
    case 'CIRCLED_DECIMAL':
    case 'CIRCLED_NUMBER':
        return toCircledDecimal(num);
            
    case 'KOREAN_HANJA':
    case 'HANJA':
        return toKoreanHanja(num);
            
    case 'CHINESE_HANJA':
    case 'IDEOGRAPH':
        return toChineseHanja(num);
            
    case 'BULLET':
    case 'SYMBOL':
        return '•';
            
    default:
        logger.warn(`formatNumber: unknown format '${format}', using decimal`);
        return num.toString();
    }
}

/**
 * Get numbering marker with suffix
 * 번호 마커와 접미사 생성
 * 
 * @param {number} num - Number
 * @param {string} format - Format type
 * @param {string} suffix - Suffix (e.g., '.', ')', '-')
 * @returns {string} Formatted marker with suffix
 * 
 * @example
 * getNumberingMarker(1, 'DECIMAL', '.')     // '1.'
 * getNumberingMarker(1, 'ROMAN', ')')       // 'I)'
 * getNumberingMarker(1, 'HANGUL_GANADA', '.') // '가.'
 */
export function getNumberingMarker(num, format, suffix = '.') {
    const formatted = formatNumber(num, format);
    return `${formatted}${suffix}`;
}

// Export all functions
export default {
    toRoman,
    toLetter,
    toHangulGanada,
    toHangulJamo,
    toCircledHangul,
    toCircledDecimal,
    toKoreanHanja,
    toChineseHanja,
    formatNumber,
    getNumberingMarker
};

