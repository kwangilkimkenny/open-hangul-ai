/**
 * 수식 변환기 (EquationHelper) 테스트
 */

import { EquationHelper } from '../models/Equation';

describe('EquationHelper', () => {
  describe('MathML 변환', () => {
    it('단순 변수를 MathML로 변환한다', () => {
      const result = EquationHelper.convert('x', true);
      expect(result).toContain('<mi>x</mi>');
      expect(result).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
    });

    it('숫자를 <mn>으로 변환한다', () => {
      const result = EquationHelper.convert('42', true);
      expect(result).toContain('<mn>42</mn>');
    });

    it('분수 (over)를 mfrac으로 변환한다', () => {
      const result = EquationHelper.convert('a over b', true);
      expect(result).toContain('<mfrac>');
      expect(result).toContain('<mi>a</mi>');
      expect(result).toContain('<mi>b</mi>');
    });

    it('frac 명령을 mfrac으로 변환한다', () => {
      const result = EquationHelper.convert('frac{1}{2}', true);
      expect(result).toContain('<mfrac>');
      expect(result).toContain('<mn>1</mn>');
      expect(result).toContain('<mn>2</mn>');
    });

    it('제곱근을 msqrt로 변환한다', () => {
      const result = EquationHelper.convert('sqrt{x}', true);
      expect(result).toContain('<msqrt>');
    });

    it('n차 근을 mroot으로 변환한다', () => {
      const result = EquationHelper.convert('root[3]{x}', true);
      expect(result).toContain('<mroot>');
    });

    it('위 첨자를 msup으로 변환한다', () => {
      const result = EquationHelper.convert('x^{2}', true);
      expect(result).toContain('<msup>');
      expect(result).toContain('<mn>2</mn>');
    });

    it('아래 첨자를 msub으로 변환한다', () => {
      const result = EquationHelper.convert('x_{i}', true);
      expect(result).toContain('<msub>');
      expect(result).toContain('<mi>i</mi>');
    });

    it('위+아래 첨자를 msubsup으로 변환한다', () => {
      const result = EquationHelper.convert('x_{i}^{2}', true);
      expect(result).toContain('<msubsup>');
    });

    it('그리스 문자를 변환한다', () => {
      const result = EquationHelper.convert('alpha + beta', true);
      expect(result).toContain('α');
      expect(result).toContain('β');
    });

    it('삼각함수를 올바르게 렌더링한다', () => {
      const result = EquationHelper.convert('sin x', true);
      expect(result).toContain('sin');
      expect(result).toContain('<mi');
    });

    it('적분 기호를 변환한다', () => {
      const result = EquationHelper.convert('int_{0}^{1} x', true);
      expect(result).toContain('∫');
      expect(result).toContain('<munderover>');
    });

    it('합계 기호를 변환한다', () => {
      const result = EquationHelper.convert('sum_{i=1}^{n} x', true);
      expect(result).toContain('∑');
    });

    it('행렬을 mtable로 변환한다', () => {
      const result = EquationHelper.convert('pmatrix{a & b \\\\ c & d}', true);
      expect(result).toContain('<mtable>');
      expect(result).toContain('<mtr>');
      expect(result).toContain('<mtd>');
    });

    it('accent (vec, hat, bar)를 변환한다', () => {
      const vecResult = EquationHelper.convert('vec{x}', true);
      expect(vecResult).toContain('<mover');
      expect(vecResult).toContain('→');

      const hatResult = EquationHelper.convert('hat{x}', true);
      expect(hatResult).toContain('<mover');
    });

    it('left/right 구분자를 변환한다', () => {
      const result = EquationHelper.convert('left( x over y right)', true);
      expect(result).toContain('stretchy="true"');
      expect(result).toContain('<mfrac>');
    });

    it('블록 수식은 display="block"을 가진다', () => {
      const result = EquationHelper.convert('x + y', false);
      expect(result).toContain('display="block"');
    });

    it('빈 문자열은 빈 결과를 반환한다', () => {
      expect(EquationHelper.convert('', true)).toBe('');
      expect(EquationHelper.convert('  ', true)).toBe('');
    });

    it('복합 수식: 이차 방정식 근의 공식', () => {
      const result = EquationHelper.convert('x = {-b pm sqrt{b^{2} - 4ac}} over {2a}', false);
      expect(result).toContain('<mfrac>');
      expect(result).toContain('<msqrt>');
      expect(result).toContain('±');
    });

    it('cases 구조를 변환한다', () => {
      const result = EquationHelper.convert('cases{ x if x > 0 \\\\ -x if x < 0 }', true);
      expect(result).toContain('<mtable');
      expect(result).toContain('{');
    });
  });

  describe('LaTeX 변환', () => {
    it('단순 변수를 LaTeX로 변환한다', () => {
      const result = EquationHelper.convertToLatex('x', true);
      expect(result).toBe('$x$');
    });

    it('분수를 \\frac으로 변환한다', () => {
      const result = EquationHelper.convertToLatex('a over b', true);
      expect(result).toContain('\\frac{');
    });

    it('제곱근을 \\sqrt로 변환한다', () => {
      const result = EquationHelper.convertToLatex('sqrt{x}', true);
      expect(result).toContain('\\sqrt{');
    });

    it('n차 근을 \\sqrt[n]로 변환한다', () => {
      const result = EquationHelper.convertToLatex('root[3]{x}', true);
      expect(result).toContain('\\sqrt[');
    });

    it('위/아래 첨자를 ^/_로 변환한다', () => {
      const result = EquationHelper.convertToLatex('x_{i}^{2}', true);
      expect(result).toContain('_{');
      expect(result).toContain('^{');
    });

    it('그리스 문자를 LaTeX 명령으로 변환한다', () => {
      const result = EquationHelper.convertToLatex('alpha + beta', true);
      expect(result).toContain('\\alpha');
      expect(result).toContain('\\beta');
    });

    it('디스플레이 모드는 $$...$$이다', () => {
      const result = EquationHelper.convertToLatex('x + y', false);
      expect(result).toMatch(/^\$\$.*\$\$$/);
    });

    it('인라인 모드는 $...$이다', () => {
      const result = EquationHelper.convertToLatex('x + y', true);
      expect(result).toMatch(/^\$[^$].*[^$]\$$/);
    });

    it('행렬을 \\begin{pmatrix}로 변환한다', () => {
      const result = EquationHelper.convertToLatex('pmatrix{a & b \\\\ c & d}', true);
      expect(result).toContain('\\begin{pmatrix}');
      expect(result).toContain('\\end{pmatrix}');
    });

    it('accent를 LaTeX 명령으로 변환한다', () => {
      const result = EquationHelper.convertToLatex('vec{x}', true);
      expect(result).toContain('\\vec{');
    });

    it('삼각함수를 LaTeX 명령으로 변환한다', () => {
      const result = EquationHelper.convertToLatex('sin x', true);
      expect(result).toContain('\\sin');
    });

    it('적분을 LaTeX로 변환한다', () => {
      const result = EquationHelper.convertToLatex('int_{0}^{1} x', true);
      expect(result).toContain('\\int');
      expect(result).toContain('_{');
      expect(result).toContain('^{');
    });
  });
});
