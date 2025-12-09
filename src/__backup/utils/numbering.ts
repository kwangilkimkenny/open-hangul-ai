/**
 * Numbering & Bullet Conversion Utilities
 * 번호 매기기 및 글머리 기호 변환 유틸리티
 * 
 * @module utils/numbering
 * @version 2.0.0
 */

/**
 * Convert number to Roman numerals (I, II, III...)
 */
export function toRoman(num: number): string {
  const romanNumerals: [string, number][] = [
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
 */
export function toLetter(num: number): string {
  let result = '';
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result || 'A';
}

/**
 * Convert number to Korean Ganada (가, 나, 다...)
 */
export function toHangulGanada(num: number): string {
  const hangul = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
  if (num >= 1 && num <= hangul.length) {
    return hangul[num - 1];
  }
  return num.toString();
}

/**
 * Convert number to Korean Jamo (ㄱ, ㄴ, ㄷ...)
 */
export function toHangulJamo(num: number): string {
  const jamo = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  if (num >= 1 && num <= jamo.length) {
    return jamo[num - 1];
  }
  return num.toString();
}

/**
 * Convert number to Circled Hangul (㉮, ㉯, ㉰...)
 */
export function toCircledHangul(num: number): string {
  const circled = ['㉮', '㉯', '㉰', '㉱', '㉲', '㉳', '㉴'];
  if (num >= 1 && num <= circled.length) {
    return circled[num - 1];
  }
  return num.toString();
}

/**
 * Convert number to Circled Decimal (①, ②, ③...)
 */
export function toCircledDecimal(num: number): string {
  if (num >= 1 && num <= 20) {
    return String.fromCharCode(0x2460 + num - 1);
  } else if (num >= 21 && num <= 35) {
    return String.fromCharCode(0x3251 + num - 21);
  } else if (num >= 36 && num <= 50) {
    return String.fromCharCode(0x32B1 + num - 36);
  }
  return num.toString();
}

/**
 * Convert number to Korean Hanja (일, 이, 삼...)
 */
export function toKoreanHanja(num: number): string {
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
  
  return num.toString();
}

/**
 * Convert number to Chinese Hanja (一, 二, 三...)
 */
export function toChineseHanja(num: number): string {
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
  
  return num.toString();
}

/**
 * Convert number based on format type
 */
export function formatNumber(num: number, format?: string): string {
  switch (format?.toUpperCase()) {
    case 'DECIMAL':
    case 'NUMBER':
    case 'DIGIT':
    case 'KOREAN_DIGITAL':
      return num.toString();
        
    case 'ROMAN':
    case 'ROMAN_UPPER':
    case 'UPPER_ROMAN':
      return toRoman(num);
        
    case 'ROMAN_LOWER':
    case 'LOWER_ROMAN':
      return toRoman(num).toLowerCase();
        
    case 'LETTER':
    case 'LETTER_UPPER':
    case 'ALPHA':
    case 'UPPER_LETTER':
    case 'UPPER_ALPHA':
      return toLetter(num);
        
    case 'LETTER_LOWER':
    case 'ALPHA_LOWER':
    case 'LOWER_LETTER':
    case 'LOWER_ALPHA':
      return toLetter(num).toLowerCase();
        
    case 'HANGUL_GANADA':
    case 'KOREAN_GANADA':
    case 'HANGUL_SYLLABLE':
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
    case 'IDEOGRAPH_KOREAN':
      return toKoreanHanja(num);
        
    case 'CHINESE_HANJA':
    case 'IDEOGRAPH':
    case 'IDEOGRAPH_TRADITIONAL':
      return toChineseHanja(num);
        
    case 'BULLET':
    case 'SYMBOL':
      return '•';
        
    default:
      return num.toString();
  }
}

/**
 * Get numbering marker with suffix
 */
export function getNumberingMarker(num: number, format?: string, suffix: string = '.'): string {
  const formatted = formatNumber(num, format);
  return `${formatted}${suffix}`;
}

