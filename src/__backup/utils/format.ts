/**
 * 포맷 유틸리티 함수
 * @module format
 * @version 2.0.0
 */

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 * @param bytes - 바이트 수
 * @returns 포맷된 문자열
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 날짜를 로컬 형식으로 변환
 * @param date - 날짜 객체 또는 문자열
 * @returns 포맷된 날짜 문자열
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 상대 시간 포맷 (예: "5분 전")
 * @param timestamp - 타임스탬프
 * @returns 상대 시간 문자열
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
  
  return new Date(timestamp).toLocaleString('ko-KR');
}

/**
 * 숫자를 천 단위 구분 형식으로 변환
 * @param num - 숫자
 * @returns 포맷된 문자열
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

/**
 * 문자열 자르기 (말줄임표 포함)
 * @param str - 원본 문자열
 * @param maxLength - 최대 길이
 * @returns 잘린 문자열
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * 텍스트에서 HTML 태그 제거
 * @param html - HTML 문자열
 * @returns 순수 텍스트
 */
export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

/**
 * 로마 숫자로 변환
 * @param num - 숫자 (1-3999)
 * @returns 로마 숫자 문자열
 */
export function toRoman(num: number): string {
  if (num < 1 || num > 3999) return String(num);
  
  const romanNumerals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  
  let result = '';
  let n = num;
  
  for (const [value, symbol] of romanNumerals) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  
  return result;
}

/**
 * 알파벳 문자로 변환 (1=A, 2=B, ...)
 * @param num - 숫자
 * @returns 알파벳 문자열
 */
export function toLetter(num: number): string {
  if (num < 1) return String(num);
  
  let result = '';
  let n = num;
  
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  
  return result;
}

/**
 * 한글 숫자로 변환
 * @param num - 숫자
 * @returns 한글 숫자 문자열
 */
export function toKoreanNumber(num: number): string {
  const koreanNumbers = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const units = ['', '십', '백', '천'];
  const bigUnits = ['', '만', '억', '조'];
  
  if (num === 0) return '영';
  
  const numStr = String(num);
  const len = numStr.length;
  let result = '';
  
  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i]);
    const unitIndex = (len - i - 1) % 4;
    const bigUnitIndex = Math.floor((len - i - 1) / 4);
    
    if (digit !== 0) {
      if (digit !== 1 || unitIndex === 0) {
        result += koreanNumbers[digit];
      }
      result += units[unitIndex];
    }
    
    if (unitIndex === 0 && bigUnitIndex > 0 && result.slice(-1) !== bigUnits[bigUnitIndex]) {
      const lastFour = numStr.slice(Math.max(0, i - 3), i + 1);
      if (parseInt(lastFour) > 0) {
        result += bigUnits[bigUnitIndex];
      }
    }
  }
  
  return result || '영';
}

/**
 * 원문자 숫자로 변환 (①, ②, ③...)
 * @param num - 숫자 (1-20)
 * @returns 원문자
 */
export function toCircledNumber(num: number): string {
  if (num < 1 || num > 20) return String(num);
  return String.fromCharCode(0x2460 + num - 1);
}

/**
 * 가나다 순서로 변환
 * @param num - 숫자
 * @returns 한글 문자
 */
export function toKoreanChar(num: number): string {
  const chars = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
  if (num < 1 || num > chars.length) return String(num);
  return chars[num - 1];
}

export default {
  formatFileSize,
  formatDate,
  formatTimeAgo,
  formatNumber,
  truncateString,
  stripHtml,
  toRoman,
  toLetter,
  toKoreanNumber,
  toCircledNumber,
  toKoreanChar
};

