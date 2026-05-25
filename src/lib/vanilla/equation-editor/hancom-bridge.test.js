/**
 * hancom-bridge unit tests
 *
 * 트랙 J 의 변환기를 합성한 양방향 라운드트립을 검증한다.
 */

import { describe, it, expect } from 'vitest';
import {
    hancomScriptToLatex,
    latexToHancomScript,
    latexToHancomScriptSync,
    roundTrip,
} from './hancom-bridge.js';

describe('hancom-bridge :: hancomScriptToLatex()', () => {
    it('returns empty string for empty input', () => {
        expect(hancomScriptToLatex('')).toBe('');
        expect(hancomScriptToLatex(null)).toBe('');
    });

    it('converts FRAC into \\frac', () => {
        const latex = hancomScriptToLatex('FRAC {a} {b}');
        expect(latex).toContain('\\frac');
        expect(latex).toMatch(/\{a\}/);
        expect(latex).toMatch(/\{b\}/);
    });

    it('converts SQRT into \\sqrt', () => {
        const latex = hancomScriptToLatex('SQRT {x+1}');
        expect(latex).toContain('\\sqrt');
        expect(latex).toMatch(/x/);
    });

    it('converts SUM_{i=0}^{n} into \\sum_{...}^{...}', () => {
        const latex = hancomScriptToLatex('SUM_{i=0}^{n} {i}');
        expect(latex).toMatch(/\\sum/);
    });

    it('converts greek keywords to LaTeX macros', () => {
        const latex = hancomScriptToLatex('alpha + beta');
        expect(latex).toMatch(/\\alpha/);
        expect(latex).toMatch(/\\beta/);
    });
});

describe('hancom-bridge :: latexToHancomScript() (sync fallback)', () => {
    it('returns empty string for empty input', () => {
        expect(latexToHancomScript('')).toBe('');
    });

    it('converts \\frac{a}{b} into FRAC {a} {b}', () => {
        const out = latexToHancomScriptSync('\\frac{a}{b}');
        expect(out).toContain('FRAC');
        expect(out).toContain('{a}');
        expect(out).toContain('{b}');
    });

    it('converts \\sqrt{x} into SQRT {x}', () => {
        const out = latexToHancomScriptSync('\\sqrt{x}');
        expect(out).toContain('SQRT');
        expect(out).toContain('{x}');
    });

    it('converts \\sqrt[n]{x} into ROOT {n} OF {x}', () => {
        const out = latexToHancomScriptSync('\\sqrt[3]{x}');
        expect(out).toContain('ROOT');
        expect(out).toContain('OF');
    });

    it('maps greek macros to hancom keywords', () => {
        const out = latexToHancomScriptSync('\\alpha + \\beta');
        expect(out.toLowerCase()).toContain('alpha');
        expect(out.toLowerCase()).toContain('beta');
    });

    it('maps \\sum/\\int/\\prod/\\lim into upper-case', () => {
        const out = latexToHancomScriptSync('\\sum + \\int + \\prod + \\lim');
        expect(out).toContain('SUM');
        expect(out).toContain('INT');
        expect(out).toContain('PROD');
        expect(out).toContain('LIM');
    });

    it('converts \\begin{matrix} … \\end{matrix} into MATRIX { … # … ## … # … }', () => {
        const out = latexToHancomScriptSync('\\begin{matrix} a & b \\\\ c & d \\end{matrix}');
        expect(out).toContain('MATRIX');
        expect(out).toContain('#');
        expect(out).toContain('##');
    });

    it('roundTrip() returns latex + restored hancom script', () => {
        const result = roundTrip('FRAC {a} {b}');
        expect(typeof result.latex).toBe('string');
        expect(typeof result.restored).toBe('string');
        expect(result.restored).toContain('FRAC');
    });
});
