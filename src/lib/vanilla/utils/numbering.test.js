/**
 * Numbering Utils Tests
 * 번호 매기기 유틸리티 테스트
 */

import {
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
} from './numbering.js';

describe('Numbering Utils', () => {
    describe('toRoman', () => {
        it('should convert numbers to Roman numerals', () => {
            expect(toRoman(1)).toBe('I');
            expect(toRoman(4)).toBe('IV');
            expect(toRoman(5)).toBe('V');
            expect(toRoman(9)).toBe('IX');
            expect(toRoman(10)).toBe('X');
            expect(toRoman(40)).toBe('XL');
            expect(toRoman(50)).toBe('L');
            expect(toRoman(90)).toBe('XC');
            expect(toRoman(100)).toBe('C');
            expect(toRoman(400)).toBe('CD');
            expect(toRoman(500)).toBe('D');
            expect(toRoman(900)).toBe('CM');
            expect(toRoman(1000)).toBe('M');
            expect(toRoman(2024)).toBe('MMXXIV');
        });
    });

    describe('toLetter', () => {
        it('should convert numbers to letters', () => {
            expect(toLetter(1)).toBe('A');
            expect(toLetter(2)).toBe('B');
            expect(toLetter(26)).toBe('Z');
            expect(toLetter(27)).toBe('AA');
            expect(toLetter(52)).toBe('AZ');
            expect(toLetter(53)).toBe('BA');
        });
    });

    describe('toHangulGanada', () => {
        it('should convert numbers to Korean Ganada', () => {
            expect(toHangulGanada(1)).toBe('가');
            expect(toHangulGanada(2)).toBe('나');
            expect(toHangulGanada(3)).toBe('다');
            expect(toHangulGanada(14)).toBe('하');
        });

        it('should return number string if out of range', () => {
            expect(toHangulGanada(15)).toBe('15');
            expect(toHangulGanada(0)).toBe('0');
        });
    });

    describe('toHangulJamo', () => {
        it('should convert numbers to Korean Jamo', () => {
            expect(toHangulJamo(1)).toBe('ㄱ');
            expect(toHangulJamo(2)).toBe('ㄴ');
            expect(toHangulJamo(3)).toBe('ㄷ');
            expect(toHangulJamo(14)).toBe('ㅎ');
        });

        it('should return number string if out of range', () => {
            expect(toHangulJamo(15)).toBe('15');
        });
    });

    describe('toCircledHangul', () => {
        it('should convert numbers to Circled Hangul', () => {
            expect(toCircledHangul(1)).toBe('㉮');
            expect(toCircledHangul(2)).toBe('㉯');
            expect(toCircledHangul(7)).toBe('㉴');
        });

        it('should return number string if out of range', () => {
            expect(toCircledHangul(8)).toBe('8');
        });
    });

    describe('toCircledDecimal', () => {
        it('should convert numbers to Circled Decimal', () => {
            expect(toCircledDecimal(1)).toBe('①');
            expect(toCircledDecimal(10)).toBe('⑩');
            expect(toCircledDecimal(20)).toBe('⑳');
            expect(toCircledDecimal(21)).toBe('㉑');
            expect(toCircledDecimal(50)).toBe('㊿');
        });

        it('should return number string if out of range', () => {
            expect(toCircledDecimal(51)).toBe('51');
        });
    });

    describe('toKoreanHanja', () => {
        it('should convert numbers to Korean Hanja', () => {
            expect(toKoreanHanja(1)).toBe('일');
            expect(toKoreanHanja(2)).toBe('이');
            expect(toKoreanHanja(10)).toBe('십');
            expect(toKoreanHanja(11)).toBe('십일');
            expect(toKoreanHanja(20)).toBe('이십');
            expect(toKoreanHanja(21)).toBe('이십일');
            expect(toKoreanHanja(99)).toBe('구십구');
        });

        it('should return number string if out of range', () => {
            expect(toKoreanHanja(100)).toBe('100');
        });
    });

    describe('toChineseHanja', () => {
        it('should convert numbers to Chinese Hanja', () => {
            expect(toChineseHanja(1)).toBe('一');
            expect(toChineseHanja(2)).toBe('二');
            expect(toChineseHanja(10)).toBe('十');
            expect(toChineseHanja(11)).toBe('十一');
            expect(toChineseHanja(20)).toBe('二十');
            expect(toChineseHanja(99)).toBe('九十九');
        });

        it('should return number string if out of range', () => {
            expect(toChineseHanja(100)).toBe('100');
        });
    });

    describe('formatNumber', () => {
        it('should format number based on type', () => {
            expect(formatNumber(5, 'DECIMAL')).toBe('5');
            expect(formatNumber(5, 'ROMAN')).toBe('V');
            expect(formatNumber(5, 'LETTER')).toBe('E');
            expect(formatNumber(5, 'HANGUL_GANADA')).toBe('마');
            expect(formatNumber(5, 'HANGUL_JAMO')).toBe('ㅁ');
            expect(formatNumber(5, 'CIRCLED_DECIMAL')).toBe('⑤');
            expect(formatNumber(5, 'KOREAN_HANJA')).toBe('오');
            expect(formatNumber(5, 'CHINESE_HANJA')).toBe('五');
            expect(formatNumber(1, 'BULLET')).toBe('•');
        });

        it('should handle case-insensitive formats', () => {
            expect(formatNumber(3, 'decimal')).toBe('3');
            expect(formatNumber(3, 'Roman')).toBe('III');
            expect(formatNumber(3, 'HANGUL_GANADA')).toBe('다');
        });

        it('should default to decimal for unknown formats', () => {
            expect(formatNumber(7, 'UNKNOWN')).toBe('7');
            expect(formatNumber(7, null)).toBe('7');
        });
    });

    describe('getNumberingMarker', () => {
        it('should create marker with suffix', () => {
            expect(getNumberingMarker(1, 'DECIMAL', '.')).toBe('1.');
            expect(getNumberingMarker(1, 'ROMAN', ')')).toBe('I)');
            expect(getNumberingMarker(1, 'HANGUL_GANADA', '.')).toBe('가.');
            expect(getNumberingMarker(1, 'LETTER', '-')).toBe('A-');
        });

        it('should use default suffix', () => {
            expect(getNumberingMarker(1, 'DECIMAL')).toBe('1.');
            expect(getNumberingMarker(5, 'KOREAN_HANJA')).toBe('오.');
        });
    });
});

