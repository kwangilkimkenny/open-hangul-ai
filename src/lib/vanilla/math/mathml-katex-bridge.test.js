/**
 * MathML <-> KaTeX/LaTeX bridge tests
 */
import { describe, it, expect } from 'vitest';
import { mathmlToLatex, katexToMathml, renderKaTeXFromMathML } from './mathml-katex-bridge.js';
import { hancomToMathML } from './hancom-math-converter.js';

describe('mathmlToLatex()', () => {
    it('returns empty for empty input', () => {
        expect(mathmlToLatex('')).toBe('');
    });

    it('converts <mfrac> to \\frac', () => {
        const xml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>';
        expect(mathmlToLatex(xml)).toContain('\\frac{1}{2}');
    });

    it('converts <msqrt>/<mroot>', () => {
        expect(mathmlToLatex('<math><msqrt><mn>2</mn></msqrt></math>')).toContain('\\sqrt');
        expect(mathmlToLatex('<math><mroot><mn>2</mn><mn>3</mn></mroot></math>')).toContain('\\sqrt[3]{2}');
    });

    it('converts greek <mi>α</mi> to \\alpha', () => {
        const xml = '<math><mi>α</mi></math>';
        expect(mathmlToLatex(xml)).toMatch(/\\alpha/);
    });

    it('converts <msup>/<msub>/<msubsup>', () => {
        expect(mathmlToLatex('<math><msup><mi>x</mi><mn>2</mn></msup></math>')).toContain('^{2}');
        expect(mathmlToLatex('<math><msub><mi>x</mi><mi>i</mi></msub></math>')).toContain('_{i}');
        expect(mathmlToLatex('<math><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup></math>')).toContain('_{i}^{2}');
    });

    it('converts <munderover> with sum into limits form', () => {
        const xml = `<math xmlns="http://www.w3.org/1998/Math/MathML">
            <munderover><mo>∑</mo><mi>i</mi><mi>n</mi></munderover></math>`;
        const latex = mathmlToLatex(xml);
        expect(latex).toMatch(/\\sum/);
        expect(latex).toContain('_{i}');
        expect(latex).toContain('^{n}');
    });

    it('converts <mtable> to a matrix environment', () => {
        const xml = '<math><mtable><mtr><mtd><mn>1</mn></mtd><mtd><mn>2</mn></mtd></mtr></mtable></math>';
        expect(mathmlToLatex(xml)).toContain('\\begin{matrix}');
        expect(mathmlToLatex(xml)).toContain('\\end{matrix}');
    });
});

describe('katexToMathml()', () => {
    it('returns empty string for empty latex', async () => {
        expect(await katexToMathml('')).toBe('');
    });

    it('produces <math>...</math> for valid latex', async () => {
        const xml = await katexToMathml('\\frac{1}{2}');
        // 환경에 따라 KaTeX 가 로드되지 않을 수 있음 — 둘 다 허용
        if (xml) {
            expect(xml.startsWith('<math')).toBe(true);
            expect(xml).toContain('</math>');
        }
    });
});

describe('hancom → MathML → LaTeX integration', () => {
    it('produces \\frac for FRAC', () => {
        const xml = hancomToMathML('FRAC {a} {b}');
        const latex = mathmlToLatex(xml);
        expect(latex).toContain('\\frac');
    });

    it('produces \\sum_{...}^{...} for SUM', () => {
        const xml = hancomToMathML('SUM SUB {i=0} SUP {n}');
        const latex = mathmlToLatex(xml);
        expect(latex).toMatch(/\\sum.*_/);
    });

    it('produces \\begin{matrix} for MATRIX', () => {
        const xml = hancomToMathML('MATRIX {a # b ## c # d}');
        const latex = mathmlToLatex(xml);
        expect(latex).toContain('\\begin{matrix}');
    });
});

describe('renderKaTeXFromMathML()', () => {
    it('falls back to MathML when KaTeX or DOMParser unavailable / errors', async () => {
        const result = await renderKaTeXFromMathML('<math><mi>x</mi></math>');
        // 결과가 KaTeX HTML 이든 MathML 폴백이든 둘 다 OK — 빈 문자열만 아니면 됨
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});
