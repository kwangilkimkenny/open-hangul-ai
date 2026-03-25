/**
 * HWPX Viewer Format Utilities
 * 포맷 변환 및 유틸리티 함수
 * 
 * @module format
 * @version 2.0.0
 */

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 * @param {number} bytes - 바이트 크기
 * @param {number} [decimals=2] - 소수점 자릿수
 * @returns {string} 포맷된 파일 크기 (예: "1.46 MB")
 * 
 * @example
 * formatFileSize(1536000) // "1.46 MB"
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(512, 1) // "512 Bytes"
 */
export function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) {
        return '0 Bytes';
    }

    if (bytes < 0) {
        return 'Invalid size';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Prevent index out of bounds
    const sizeIndex = Math.min(i, sizes.length - 1);
    const value = bytes / Math.pow(k, sizeIndex);
    
    return `${value.toFixed(decimals)} ${sizes[sizeIndex]}`;
}

/**
 * 날짜를 포맷팅
 * @param {Date|string|number} date - 날짜 객체, ISO 문자열, 또는 타임스탬프
 * @param {string} [format='YYYY-MM-DD'] - 포맷 문자열
 * @returns {string} 포맷된 날짜
 * 
 * @example
 * formatDate(new Date()) // "2024-11-18"
 * formatDate('2024-11-18T10:30:00', 'YYYY-MM-DD HH:mm') // "2024-11-18 10:30"
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
    const d = date instanceof Date ? date : new Date(date);

    if (isNaN(d.getTime())) {
        return 'Invalid date';
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * 숫자를 천 단위 구분자와 함께 포맷팅
 * @param {number} num - 숫자
 * @param {string} [separator=','] - 구분자
 * @returns {string} 포맷된 숫자
 * 
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(1234567, '.') // "1.234.567"
 */
export function formatNumber(num, separator = ',') {
    if (typeof num !== 'number' || isNaN(num)) {
        return '0';
    }

    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * 백분율 포맷팅
 * @param {number} value - 값 (0-1 또는 0-100)
 * @param {number} [decimals=0] - 소수점 자릿수
 * @param {boolean} [is100Based=false] - 100 기반 여부 (true면 0-100, false면 0-1)
 * @returns {string} 포맷된 백분율
 * 
 * @example
 * formatPercent(0.756) // "76%"
 * formatPercent(0.756, 1) // "75.6%"
 * formatPercent(75.6, 1, true) // "75.6%"
 */
export function formatPercent(value, decimals = 0, is100Based = false) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0%';
    }

    const percent = is100Based ? value : value * 100;
    return `${percent.toFixed(decimals)}%`;
}

/**
 * 시간을 사람이 읽기 쉬운 형식으로 변환
 * @param {number} milliseconds - 밀리초
 * @returns {string} 포맷된 시간
 * 
 * @example
 * formatDuration(1500) // "1.5s"
 * formatDuration(65000) // "1m 5s"
 * formatDuration(3665000) // "1h 1m 5s"
 */
export function formatDuration(milliseconds) {
    if (typeof milliseconds !== 'number' || milliseconds < 0) {
        return '0s';
    }

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else if (seconds > 0) {
        return `${seconds}s`;
    } else {
        return `${milliseconds}ms`;
    }
}

/**
 * 파일명에서 확장자 추출
 * @param {string} filename - 파일명
 * @returns {string} 확장자 (점 포함)
 * 
 * @example
 * getFileExtension('document.hwpx') // ".hwpx"
 * getFileExtension('file.tar.gz') // ".gz"
 */
export function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
        return '';
    }

    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
}

/**
 * 파일명에서 확장자 제거
 * @param {string} filename - 파일명
 * @returns {string} 확장자가 제거된 파일명
 * 
 * @example
 * removeFileExtension('document.hwpx') // "document"
 * removeFileExtension('file.tar.gz') // "file.tar"
 */
export function removeFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
        return '';
    }

    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

/**
 * 문자열 자르기 (말줄임표 추가)
 * @param {string} str - 문자열
 * @param {number} maxLength - 최대 길이
 * @param {string} [suffix='...'] - 말줄임표
 * @returns {string} 잘린 문자열
 * 
 * @example
 * truncateString('Hello World', 8) // "Hello..."
 * truncateString('Short', 10) // "Short"
 */
export function truncateString(str, maxLength, suffix = '...') {
    if (!str || typeof str !== 'string') {
        return '';
    }

    if (str.length <= maxLength) {
        return str;
    }

    return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 바이트 배열을 Base64로 인코딩
 * @param {Uint8Array|ArrayBuffer} bytes - 바이트 배열
 * @returns {string} Base64 문자열
 */
export function bytesToBase64(bytes) {
    const uint8Array = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

/**
 * Base64를 바이트 배열로 디코딩
 * @param {string} base64 - Base64 문자열
 * @returns {Uint8Array} 바이트 배열
 */
export function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Default export (모든 함수 포함)
export default {
    formatFileSize,
    formatDate,
    formatNumber,
    formatPercent,
    formatDuration,
    getFileExtension,
    removeFileExtension,
    truncateString,
    bytesToBase64,
    base64ToBytes
};

