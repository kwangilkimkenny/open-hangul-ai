/**
 * formula-engine.test.js
 */
import { describe, it, expect } from 'vitest';
import {
  tokenize,
  parse,
  evaluateFormula,
  extractDependencies,
} from './formula-engine.js';

function ctx(cells = {}) {
  return { getCellValue: (a) => (a in cells ? cells[a] : null) };
}

describe('tokenize', () => {
  it('strips leading = and tokenizes numbers + operators', () => {
    const toks = tokenize('=1+2*3').filter(t => t.type !== 'EOF');
    expect(toks.map(t => t.type)).toEqual(['NUMBER', 'OP', 'NUMBER', 'OP', 'NUMBER']);
  });

  it('recognizes cell references and ranges', () => {
    const toks = tokenize('=SUM(A1:B2)').filter(t => t.type !== 'EOF');
    expect(toks[0]).toMatchObject({ type: 'FUNC', value: 'SUM' });
    expect(toks.find(t => t.type === 'RANGE').value).toBe('A1:B2');
  });

  it('parses quoted strings with escaped quote', () => {
    const toks = tokenize('"hi ""you"""').filter(t => t.type !== 'EOF');
    expect(toks[0]).toMatchObject({ type: 'STRING', value: 'hi "you"' });
  });
});

describe('parse', () => {
  it('parses arithmetic precedence: 1+2*3', () => {
    const ast = parse('=1+2*3');
    expect(ast.kind).toBe('Bin');
    expect(ast.op).toBe('+');
    expect(ast.right.op).toBe('*');
  });

  it('parses unary minus', () => {
    const ast = parse('=-5');
    expect(ast.kind).toBe('Unary');
    expect(ast.op).toBe('-');
  });

  it('parses function call with multiple args', () => {
    const ast = parse('=IF(A1>1, "yes", "no")');
    expect(ast.kind).toBe('Call');
    expect(ast.name).toBe('IF');
    expect(ast.args).toHaveLength(3);
  });
});

describe('evaluateFormula — arithmetic', () => {
  it('addition', () => {
    expect(evaluateFormula('=1+2', ctx())).toBe(3);
  });
  it('precedence: 1+2*3 = 7', () => {
    expect(evaluateFormula('=1+2*3', ctx())).toBe(7);
  });
  it('parentheses: (1+2)*3 = 9', () => {
    expect(evaluateFormula('=(1+2)*3', ctx())).toBe(9);
  });
  it('exponent right-assoc: 2^3^2 = 512', () => {
    expect(evaluateFormula('=2^3^2', ctx())).toBe(512);
  });
  it('unary minus', () => {
    expect(evaluateFormula('=-5+3', ctx())).toBe(-2);
  });
  it('division by zero throws #DIV/0!', () => {
    expect(() => evaluateFormula('=1/0', ctx())).toThrow(/DIV\/0/);
  });
});

describe('evaluateFormula — cell references', () => {
  it('reads single cell', () => {
    expect(evaluateFormula('=A1+B1', ctx({ A1: 10, B1: 5 }))).toBe(15);
  });
  it('treats blank cell as 0 in arithmetic', () => {
    expect(evaluateFormula('=A1+5', ctx({}))).toBe(5);
  });
});

describe('evaluateFormula — aggregate functions', () => {
  const cells = { A1: 1, A2: 2, A3: 3, A4: 4 };

  it('SUM range', () => {
    expect(evaluateFormula('=SUM(A1:A4)', ctx(cells))).toBe(10);
  });
  it('AVERAGE range', () => {
    expect(evaluateFormula('=AVERAGE(A1:A4)', ctx(cells))).toBe(2.5);
  });
  it('AVG alias', () => {
    expect(evaluateFormula('=AVG(A1:A4)', ctx(cells))).toBe(2.5);
  });
  it('MIN / MAX', () => {
    expect(evaluateFormula('=MIN(A1:A4)', ctx(cells))).toBe(1);
    expect(evaluateFormula('=MAX(A1:A4)', ctx(cells))).toBe(4);
  });
  it('COUNT counts numbers only', () => {
    expect(evaluateFormula('=COUNT(A1:A4)', ctx({ A1: 1, A2: 'x', A3: 3, A4: null }))).toBe(2);
  });
  it('COUNTA counts non-empty', () => {
    expect(evaluateFormula('=COUNTA(A1:A4)', ctx({ A1: 1, A2: 'x', A3: null, A4: '' }))).toBe(2);
  });
  it('SUM mixed args', () => {
    expect(evaluateFormula('=SUM(A1:A2, 10)', ctx(cells))).toBe(13);
  });
});

describe('evaluateFormula — logical', () => {
  it('IF true branch', () => {
    expect(evaluateFormula('=IF(1>0, "yes", "no")', ctx())).toBe('yes');
  });
  it('IF false branch', () => {
    expect(evaluateFormula('=IF(1<0, "yes", "no")', ctx())).toBe('no');
  });
  it('AND / OR / NOT', () => {
    expect(evaluateFormula('=AND(1, 1, 0)', ctx())).toBe(false);
    expect(evaluateFormula('=AND(1, 1, 1)', ctx())).toBe(true);
    expect(evaluateFormula('=OR(0, 0, 1)', ctx())).toBe(true);
    expect(evaluateFormula('=NOT(0)', ctx())).toBe(true);
  });
  it('comparison operators', () => {
    expect(evaluateFormula('=1=1', ctx())).toBe(true);
    expect(evaluateFormula('=1<>2', ctx())).toBe(true);
    expect(evaluateFormula('=2>=2', ctx())).toBe(true);
    expect(evaluateFormula('=1<=0', ctx())).toBe(false);
  });
});

describe('evaluateFormula — string + misc', () => {
  it('CONCAT joins strings', () => {
    expect(evaluateFormula('=CONCAT("Hello, ", "World")', ctx())).toBe('Hello, World');
  });
  it('ROUND with digits', () => {
    expect(evaluateFormula('=ROUND(3.14159, 2)', ctx())).toBe(3.14);
    expect(evaluateFormula('=ROUND(3.5)', ctx())).toBe(4);
  });
  it('ABS', () => {
    expect(evaluateFormula('=ABS(-7)', ctx())).toBe(7);
  });
  it('boolean literal TRUE/FALSE', () => {
    expect(evaluateFormula('=TRUE', ctx())).toBe(true);
    expect(evaluateFormula('=FALSE', ctx())).toBe(false);
  });
  it('unknown function throws', () => {
    expect(() => evaluateFormula('=FOOBAR()', ctx())).toThrow(/Unknown function/);
  });
});

describe('extractDependencies', () => {
  it('returns single cell refs', () => {
    expect(extractDependencies('=A1+B2').sort()).toEqual(['A1', 'B2']);
  });
  it('expands ranges', () => {
    expect(extractDependencies('=SUM(A1:A3)').sort()).toEqual(['A1', 'A2', 'A3']);
  });
  it('dedupes', () => {
    expect(extractDependencies('=A1+A1+A1')).toEqual(['A1']);
  });
});
