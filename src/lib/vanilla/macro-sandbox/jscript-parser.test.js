/**
 * jscript-parser unit tests
 */
import { describe, it, expect } from 'vitest';
import {
  parseJScript,
  parseMacroCode,
  tokenizeBeanShell,
  stripJScriptConditionals,
} from './jscript-parser.js';

describe('jscript-parser', () => {
  describe('parseJScript', () => {
    it('parses simple var assignment', () => {
      const { ast, errors, ok } = parseJScript('var x = 1;');
      expect(ok).toBe(true);
      expect(errors).toHaveLength(0);
      expect(ast).not.toBeNull();
      expect(ast.type).toBe('Program');
      expect(ast.body[0].type).toBe('VariableDeclaration');
    });

    it('parses ActiveXObject creation', () => {
      const code = 'var fso = new ActiveXObject("Scripting.FileSystemObject");';
      const { ast, ok } = parseJScript(code);
      expect(ok).toBe(true);
      expect(ast.body[0].declarations[0].init.type).toBe('NewExpression');
    });

    it('parses function definitions with member calls', () => {
      const code = `function go() {
  var sh = new ActiveXObject("WScript.Shell");
  sh.Run("calc.exe");
}`;
      const { ast, ok } = parseJScript(code);
      expect(ok).toBe(true);
      expect(ast.body[0].type).toBe('FunctionDeclaration');
    });

    it('returns error for syntactically invalid code but still attempts recovery', () => {
      const code = `var x = ;\nvar y = 2;`;
      const { errors, ast } = parseJScript(code);
      expect(errors.length).toBeGreaterThan(0);
      // Recovery: 두 번째 라인은 살아남아야 함
      expect(ast).not.toBeNull();
      expect(ast.body.length).toBeGreaterThan(0);
    });

    it('returns empty result for empty input', () => {
      const { ast, ok, errors } = parseJScript('');
      expect(ok).toBe(false);
      expect(ast).toBeNull();
      expect(errors[0].message).toContain('empty');
    });

    it('strips JScript conditional compilation blocks before parsing', () => {
      const code = `/*@cc_on var ie = true; @*/\nvar y = 2;`;
      const { ast, ok } = parseJScript(code);
      expect(ok).toBe(true);
      // 두 번째 줄의 var y = 2 만 살아남음
      expect(ast.body.length).toBeGreaterThanOrEqual(1);
    });

    it('records line numbers in ast (locations)', () => {
      const code = `var a = 1;\nvar b = 2;`;
      const { ast } = parseJScript(code);
      expect(ast.body[1].loc.start.line).toBe(2);
    });

    it('does NOT execute code under any circumstance', () => {
      // 만약 코드가 실행된다면 이 변수가 변경됨. 절대 그래선 안 됨.
      globalThis.__macroSandboxTestSideEffect = 'untouched';
      const malicious = `globalThis.__macroSandboxTestSideEffect = 'EXECUTED';`;
      parseJScript(malicious);
      expect(globalThis.__macroSandboxTestSideEffect).toBe('untouched');
    });
  });

  describe('tokenizeBeanShell', () => {
    it('extracts import statements', () => {
      const code = `import java.io.File;\nimport java.net.URL;`;
      const { tokens } = tokenizeBeanShell(code);
      const imports = tokens.filter(t => t.type === 'Import');
      expect(imports.length).toBeGreaterThanOrEqual(2);
      expect(imports[0].value).toContain('java.io.File');
    });

    it('extracts call expressions', () => {
      const code = `Runtime.getRuntime().exec("calc.exe");`;
      const { tokens } = tokenizeBeanShell(code);
      const calls = tokens.filter(t => t.type === 'CallExpression');
      expect(calls.length).toBeGreaterThan(0);
    });

    it('returns empty tokens for empty code', () => {
      const { tokens, errors } = tokenizeBeanShell('');
      expect(tokens).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('does not execute beanshell code', () => {
      globalThis.__beanshellTest = 'untouched';
      tokenizeBeanShell(`globalThis.__beanshellTest = "EXEC";`);
      expect(globalThis.__beanshellTest).toBe('untouched');
    });
  });

  describe('stripJScriptConditionals', () => {
    it('replaces /*@...@*/ with whitespace preserving line breaks', () => {
      const code = `/*@cc_on\nvar a = 1;\n@*/\nvar b = 2;`;
      const stripped = stripJScriptConditionals(code);
      // 줄 수 보존
      expect(stripped.split('\n').length).toBe(code.split('\n').length);
      // 내부 식별자는 제거됨
      expect(stripped).not.toContain('cc_on');
    });
  });

  describe('parseMacroCode (unified)', () => {
    it('routes jscript to parser', () => {
      const res = parseMacroCode('var x = 1;', 'jscript');
      expect(res.ast).not.toBeNull();
      expect(res.tokens).toBeNull();
    });

    it('routes beanshell to tokenizer', () => {
      const res = parseMacroCode('import java.io.File;', 'beanshell');
      expect(res.ast).toBeNull();
      expect(res.tokens).not.toBeNull();
    });

    it('defaults unknown to jscript parser', () => {
      const res = parseMacroCode('var x = 1;', 'unknown');
      expect(res.ast).not.toBeNull();
    });
  });
});
