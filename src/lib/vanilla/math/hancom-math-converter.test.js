/**
 * Hancom Math Converter Tests
 */
import { describe, it, expect } from 'vitest';
import {
    tokenize,
    hancomToAst,
    toMathML,
    astToMathml,
    fromMathML,
    toHancomScript,
    hancomToMathML,
} from './hancom-math-converter.js';

describe('tokenize()', () => {
    it('splits keywords, identifiers, numbers, and operators', () => {
        const toks = tokenize('FRAC {1} {2}');
        expect(toks.map((t) => t.type)).toEqual([
            'kw', 'lbrace', 'num', 'rbrace', 'lbrace', 'num', 'rbrace',
        ]);
        expect(toks[0].value).toBe('frac');
    });

    it('recognizes matrix separators', () => {
        const toks = tokenize('a # b ## c');
        const types = toks.map((t) => t.type);
        expect(types).toContain('colsep');
        expect(types).toContain('rowsep');
    });

    it('handles greek with case preserved', () => {
        const toks = tokenize('alpha Alpha');
        expect(toks[0]).toEqual({ type: 'kw', value: 'alpha' });
        expect(toks[1]).toEqual({ type: 'kw', value: 'Alpha' });
    });
});

describe('hancomToAst() → AST shape', () => {
    it('parses FRAC into a fraction node', () => {
        const ast = hancomToAst('FRAC {a} {b}');
        expect(ast.type).toBe('frac');
        expect(ast.num.value).toBe('a');
        expect(ast.den.value).toBe('b');
    });

    it('parses a OVER b as a fraction', () => {
        const ast = hancomToAst('a OVER b');
        expect(ast.type).toBe('frac');
        expect(ast.num.value).toBe('a');
        expect(ast.den.value).toBe('b');
    });

    it('parses SQRT and ROOT OF', () => {
        const s1 = hancomToAst('SQRT {x+1}');
        expect(s1.type).toBe('sqrt');
        const s2 = hancomToAst('ROOT {3} OF {x}');
        expect(s2.type).toBe('sqrt');
        expect(s2.index.value).toBe('3');
    });

    it('parses subsup combinations', () => {
        const ast = hancomToAst('x SUB i SUP 2');
        expect(ast.type).toBe('subsup');
        expect(ast.sub.value).toBe('i');
        expect(ast.sup.value).toBe('2');
    });

    it('parses SUM with sub/sup', () => {
        const ast = hancomToAst('SUM SUB {i=0} SUP {n}');
        expect(ast.type).toBe('bigop');
        expect(ast.op).toBe('sum');
        expect(ast.sub.type).toBe('seq');
        expect(ast.sup.value).toBe('n');
    });

    it('parses MATRIX into rows × cols', () => {
        const ast = hancomToAst('MATRIX {a # b ## c # d}');
        expect(ast.type).toBe('matrix');
        expect(ast.rows.length).toBe(2);
        expect(ast.rows[0].length).toBe(2);
        expect(ast.rows[1][1].value).toBe('d');
    });

    it('parses LEFT ( ... RIGHT )', () => {
        const ast = hancomToAst('LEFT ( x+1 RIGHT )');
        expect(ast.type).toBe('fenced');
        expect(ast.open).toBe('(');
        expect(ast.close).toBe(')');
    });

    it('parses greek symbols', () => {
        const ast = hancomToAst('alpha + beta');
        expect(ast.type).toBe('seq');
        expect(ast.items[0]).toMatchObject({ type: 'sym', name: 'alpha' });
    });
});

describe('toMathML() / astToMathml()', () => {
    it('emits <mfrac> for a fraction', () => {
        const xml = toMathML(hancomToAst('FRAC {1} {2}'));
        expect(xml).toContain('<mfrac>');
        expect(xml).toContain('<mn>1</mn>');
        expect(xml).toContain('<mn>2</mn>');
    });

    it('emits <msqrt> for SQRT and <mroot> for ROOT OF', () => {
        expect(toMathML(hancomToAst('SQRT {a}'))).toContain('<msqrt>');
        expect(toMathML(hancomToAst('ROOT {3} OF {a}'))).toContain('<mroot>');
    });

    it('emits <msubsup> for SUB+SUP', () => {
        const xml = toMathML(hancomToAst('x SUB i SUP 2'));
        expect(xml).toContain('<msubsup>');
    });

    it('emits <munderover> for SUM SUB SUP', () => {
        const xml = toMathML(hancomToAst('SUM SUB {i=0} SUP {n}'));
        expect(xml).toContain('<munderover>');
        expect(xml).toContain('∑');
    });

    it('emits <mtable> for MATRIX', () => {
        const xml = toMathML(hancomToAst('MATRIX {a # b ## c # d}'));
        expect(xml).toContain('<mtable>');
        expect(xml.match(/<mtr>/g)?.length).toBe(2);
        expect(xml.match(/<mtd>/g)?.length).toBe(4);
    });

    it('wraps result in <math> root with namespace', () => {
        const xml = toMathML(hancomToAst('a+b'));
        expect(xml.startsWith('<math')).toBe(true);
        expect(xml).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
    });
});

describe('fromMathML() round-trip', () => {
    it('parses <mfrac> back into a frac AST', () => {
        const xml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>';
        const ast = fromMathML(xml);
        expect(ast.type).toBe('frac');
        expect(ast.num.value).toBe('1');
        expect(ast.den.value).toBe('2');
    });

    it('parses greek <mi>α</mi> back into a sym', () => {
        const xml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>α</mi></math>';
        const ast = fromMathML(xml);
        expect(ast.type).toBe('sym');
        expect(ast.name).toBe('alpha');
    });

    it('hancom → MathML → AST → hancom stays equivalent for FRAC', () => {
        const src = 'FRAC {x} {y}';
        const xml = hancomToMathML(src);
        const ast = fromMathML(xml);
        const back = toHancomScript(ast);
        expect(back).toContain('FRAC');
        expect(back).toContain('{x}');
        expect(back).toContain('{y}');
    });
});

describe('toHancomScript()', () => {
    it('roundtrips simple subscript expression', () => {
        const src = 'x SUB i SUP 2';
        const ast = hancomToAst(src);
        const back = toHancomScript(ast);
        expect(back).toContain('SUB');
        expect(back).toContain('SUP');
    });

    it('emits MATRIX with row/col separators', () => {
        const ast = hancomToAst('MATRIX {a # b ## c # d}');
        const back = toHancomScript(ast);
        expect(back.startsWith('MATRIX')).toBe(true);
        expect(back).toContain('##');
        expect(back).toContain('#');
    });
});
