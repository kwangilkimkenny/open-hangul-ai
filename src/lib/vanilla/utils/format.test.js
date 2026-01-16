/**
 * Format Utilities Tests
 * @jest-environment jsdom
 */

import {
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
} from './format.js';

describe('Format Utilities', () => {
    describe('formatFileSize', () => {
        it('should format 0 bytes', () => {
            expect(formatFileSize(0)).toBe('0 Bytes');
        });

        it('should format bytes', () => {
            expect(formatFileSize(512)).toBe('512.00 Bytes');
        });

        it('should format kilobytes', () => {
            expect(formatFileSize(1024)).toBe('1.00 KB');
            expect(formatFileSize(1536)).toBe('1.50 KB');
        });

        it('should format megabytes', () => {
            expect(formatFileSize(1048576)).toBe('1.00 MB');
            expect(formatFileSize(1536000)).toBe('1.46 MB');
        });

        it('should format gigabytes', () => {
            expect(formatFileSize(1073741824)).toBe('1.00 GB');
        });

        it('should handle custom decimals', () => {
            expect(formatFileSize(1536, 1)).toBe('1.5 KB');
            expect(formatFileSize(1536, 0)).toBe('2 KB');
        });

        it('should handle negative values', () => {
            expect(formatFileSize(-100)).toBe('Invalid size');
        });

        it('should handle very large values', () => {
            const result = formatFileSize(1099511627776); // 1 TB
            expect(result).toBe('1.00 TB');
        });
    });

    describe('formatDate', () => {
        it('should format date with default format', () => {
            const date = new Date('2024-11-18T10:30:45');
            expect(formatDate(date)).toBe('2024-11-18');
        });

        it('should format date with custom format', () => {
            const date = new Date('2024-11-18T10:30:45');
            expect(formatDate(date, 'YYYY-MM-DD HH:mm')).toBe('2024-11-18 10:30');
        });

        it('should format date with full format', () => {
            const date = new Date('2024-11-18T10:30:45');
            expect(formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-11-18 10:30:45');
        });

        it('should handle ISO string', () => {
            const result = formatDate('2024-11-18T10:30:45');
            expect(result).toBe('2024-11-18');
        });

        it('should handle timestamp', () => {
            const timestamp = new Date('2024-11-18').getTime();
            const result = formatDate(timestamp);
            expect(result).toBe('2024-11-18');
        });

        it('should handle invalid date', () => {
            expect(formatDate('invalid')).toBe('Invalid date');
        });
    });

    describe('formatNumber', () => {
        it('should format with default separator', () => {
            expect(formatNumber(1234567)).toBe('1,234,567');
        });

        it('should format with custom separator', () => {
            expect(formatNumber(1234567, '.')).toBe('1.234.567');
        });

        it('should handle zero', () => {
            expect(formatNumber(0)).toBe('0');
        });

        it('should handle negative numbers', () => {
            expect(formatNumber(-1234567)).toBe('-1,234,567');
        });

        it('should handle NaN', () => {
            expect(formatNumber(NaN)).toBe('0');
        });

        it('should handle non-number input', () => {
            expect(formatNumber('abc')).toBe('0');
        });
    });

    describe('formatPercent', () => {
        it('should format 0-1 based value', () => {
            expect(formatPercent(0.756)).toBe('76%');
        });

        it('should format with decimals', () => {
            expect(formatPercent(0.756, 1)).toBe('75.6%');
            expect(formatPercent(0.756, 2)).toBe('75.60%');
        });

        it('should format 100-based value', () => {
            expect(formatPercent(75.6, 1, true)).toBe('75.6%');
        });

        it('should handle zero', () => {
            expect(formatPercent(0)).toBe('0%');
        });

        it('should handle 100%', () => {
            expect(formatPercent(1)).toBe('100%');
        });

        it('should handle NaN', () => {
            expect(formatPercent(NaN)).toBe('0%');
        });
    });

    describe('formatDuration', () => {
        it('should format milliseconds', () => {
            expect(formatDuration(500)).toBe('500ms');
        });

        it('should format seconds', () => {
            expect(formatDuration(1500)).toBe('1s');
            expect(formatDuration(45000)).toBe('45s');
        });

        it('should format minutes', () => {
            expect(formatDuration(65000)).toBe('1m 5s');
        });

        it('should format hours', () => {
            expect(formatDuration(3665000)).toBe('1h 1m 5s');
        });

        it('should handle zero', () => {
            expect(formatDuration(0)).toBe('0ms');
        });

        it('should handle negative values', () => {
            expect(formatDuration(-100)).toBe('0s');
        });
    });

    describe('getFileExtension', () => {
        it('should extract extension', () => {
            expect(getFileExtension('document.hwpx')).toBe('.hwpx');
            expect(getFileExtension('file.txt')).toBe('.txt');
        });

        it('should handle multiple dots', () => {
            expect(getFileExtension('file.tar.gz')).toBe('.gz');
        });

        it('should handle no extension', () => {
            expect(getFileExtension('README')).toBe('');
        });

        it('should handle empty string', () => {
            expect(getFileExtension('')).toBe('');
        });

        it('should handle null/undefined', () => {
            expect(getFileExtension(null)).toBe('');
            expect(getFileExtension(undefined)).toBe('');
        });
    });

    describe('removeFileExtension', () => {
        it('should remove extension', () => {
            expect(removeFileExtension('document.hwpx')).toBe('document');
        });

        it('should handle multiple dots', () => {
            expect(removeFileExtension('file.tar.gz')).toBe('file.tar');
        });

        it('should handle no extension', () => {
            expect(removeFileExtension('README')).toBe('README');
        });

        it('should handle empty string', () => {
            expect(removeFileExtension('')).toBe('');
        });
    });

    describe('truncateString', () => {
        it('should truncate long string', () => {
            expect(truncateString('Hello World', 8)).toBe('Hello...');
        });

        it('should not truncate short string', () => {
            expect(truncateString('Short', 10)).toBe('Short');
        });

        it('should handle custom suffix', () => {
            expect(truncateString('Hello World', 8, '…')).toBe('Hello W…');
        });

        it('should handle empty string', () => {
            expect(truncateString('', 10)).toBe('');
        });

        it('should handle null/undefined', () => {
            expect(truncateString(null, 10)).toBe('');
            expect(truncateString(undefined, 10)).toBe('');
        });
    });

    describe('Base64 Encoding/Decoding', () => {
        it('should encode bytes to base64', () => {
            const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
            const base64 = bytesToBase64(bytes);
            expect(base64).toBe('SGVsbG8=');
        });

        it('should decode base64 to bytes', () => {
            const bytes = base64ToBytes('SGVsbG8=');
            expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
        });

        it('should handle round-trip encoding', () => {
            const original = new Uint8Array([1, 2, 3, 4, 5]);
            const base64 = bytesToBase64(original);
            const decoded = base64ToBytes(base64);
            expect(Array.from(decoded)).toEqual(Array.from(original));
        });

        it('should handle ArrayBuffer', () => {
            const buffer = new ArrayBuffer(5);
            const view = new Uint8Array(buffer);
            view.set([72, 101, 108, 108, 111]);
            const base64 = bytesToBase64(buffer);
            expect(base64).toBe('SGVsbG8=');
        });
    });
});

