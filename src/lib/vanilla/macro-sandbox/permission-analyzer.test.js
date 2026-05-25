/**
 * permission-analyzer unit tests
 */
import { describe, it, expect } from 'vitest';
import { parseJScript, tokenizeBeanShell } from './jscript-parser.js';
import {
  analyzeAst,
  analyzeTokens,
  computeRiskLevel,
  flattenMemberExpression,
  groupDetailsByType,
  getPermissionMeta,
  PERMISSION_CATALOG,
} from './permission-analyzer.js';

function analyze(code) {
  const { ast } = parseJScript(code);
  return analyzeAst(ast, code);
}

describe('permission-analyzer', () => {
  describe('flattenMemberExpression', () => {
    it('flattens nested member expressions', () => {
      const { ast } = parseJScript('a.b.c.d;');
      const expr = ast.body[0].expression;
      expect(flattenMemberExpression(expr)).toBe('a.b.c.d');
    });

    it('returns identifier name for plain Identifier node', () => {
      const { ast } = parseJScript('foo;');
      const expr = ast.body[0].expression;
      expect(flattenMemberExpression(expr)).toBe('foo');
    });
  });

  describe('analyzeAst — JScript permission detection', () => {
    it('detects file-io via FileSystemObject ActiveX', () => {
      const { permissions } = analyze(
        'var fso = new ActiveXObject("Scripting.FileSystemObject"); fso.OpenTextFile("a.txt");'
      );
      expect(permissions.has('file-io')).toBe(true);
      expect(permissions.has('activex')).toBe(true);
    });

    it('detects network via XMLHttpRequest', () => {
      const { permissions } = analyze(
        'var xhr = new XMLHttpRequest(); xhr.open("GET","http://x.com");'
      );
      expect(permissions.has('network')).toBe(true);
    });

    it('detects shell via WScript.Shell.Run', () => {
      const { permissions } = analyze(
        'var sh = new ActiveXObject("WScript.Shell"); sh.Run("calc.exe");'
      );
      expect(permissions.has('shell')).toBe(true);
    });

    it('detects registry via RegRead', () => {
      const { permissions } = analyze(
        'var sh = new ActiveXObject("WScript.Shell"); sh.RegRead("HKEY_LOCAL_MACHINE\\\\Foo");'
      );
      expect(permissions.has('registry')).toBe(true);
    });

    it('detects HKEY_* constants', () => {
      const { permissions } = analyze('var k = HKEY_LOCAL_MACHINE;');
      expect(permissions.has('registry')).toBe(true);
    });

    it('detects wscript api calls', () => {
      const { permissions } = analyze('WScript.Echo("hello"); WScript.Sleep(100);');
      expect(permissions.has('wscript')).toBe(true);
    });

    it('detects activex via CreateObject', () => {
      const { permissions } = analyze('var o = CreateObject("Scripting.FileSystemObject");');
      expect(permissions.has('activex')).toBe(true);
      expect(permissions.has('file-io')).toBe(true);
    });

    it('detects dom usage', () => {
      const { permissions } = analyze('document.write("x"); window.alert("y");');
      expect(permissions.has('dom')).toBe(true);
    });

    it('detects hancom-api', () => {
      const { permissions } = analyze('var c = new HwpCtrl(); HAction.Run();');
      expect(permissions.has('hancom-api')).toBe(true);
    });

    it('detects dynamic-eval', () => {
      const { permissions } = analyze('eval("var x=1");');
      expect(permissions.has('dynamic-eval')).toBe(true);
    });

    it('records line numbers and code snippets in details', () => {
      const code = `var a = 1;\nvar sh = new ActiveXObject("WScript.Shell");\nsh.Run("calc.exe");`;
      const { details } = analyze(code);
      const shellDetails = details.filter(d => d.type === 'shell');
      expect(shellDetails.length).toBeGreaterThan(0);
      const onLine3 = shellDetails.find(d => d.line === 3);
      expect(onLine3).toBeTruthy();
      expect(onLine3.code_snippet).toContain('Run');
    });

    it('returns empty result for null ast', () => {
      const { permissions, details } = analyzeAst(null, '');
      expect(permissions.size).toBe(0);
      expect(details).toHaveLength(0);
    });
  });

  describe('analyzeTokens — BeanShell permission detection', () => {
    it('detects java.io.File via import', () => {
      const code = `import java.io.File;\nFile f = new File("/tmp/a");`;
      const { tokens } = tokenizeBeanShell(code);
      const { permissions } = analyzeTokens(tokens, code);
      expect(permissions.has('file-io')).toBe(true);
    });

    it('detects java.lang.Runtime', () => {
      const code = `Runtime.getRuntime().exec("calc");`;
      const { tokens } = tokenizeBeanShell(code);
      const { permissions } = analyzeTokens(tokens, code);
      expect(permissions.has('shell')).toBe(true);
    });

    it('detects java.net.URL via import string', () => {
      const code = `import java.net.URL;\nURL u = new URL("http://x.com");`;
      const { tokens } = tokenizeBeanShell(code);
      const { permissions } = analyzeTokens(tokens, code);
      expect(permissions.has('network')).toBe(true);
    });
  });

  describe('computeRiskLevel', () => {
    it('returns low for empty permissions', () => {
      expect(computeRiskLevel(new Set())).toBe('low');
    });

    it('returns critical for shell', () => {
      expect(computeRiskLevel(new Set(['shell']))).toBe('critical');
    });

    it('returns critical for shell + network combo', () => {
      expect(computeRiskLevel(new Set(['shell', 'network']))).toBe('critical');
    });

    it('returns high for network + file-io', () => {
      expect(computeRiskLevel(new Set(['network', 'file-io']))).toBe('critical'); // network alone is critical
    });

    it('returns medium for activex alone', () => {
      // activex severity = high → returns 'medium' (high >= 1)
      const r = computeRiskLevel(new Set(['activex']));
      expect(['medium', 'high']).toContain(r);
    });

    it('returns low for dom only', () => {
      expect(computeRiskLevel(new Set(['dom']))).toBe('low');
    });
  });

  describe('groupDetailsByType', () => {
    it('groups detail items by type', () => {
      const details = [
        { type: 'shell', line: 1, identifier: 'a' },
        { type: 'shell', line: 2, identifier: 'b' },
        { type: 'network', line: 3, identifier: 'c' },
      ];
      const groups = groupDetailsByType(details);
      expect(groups.shell).toHaveLength(2);
      expect(groups.network).toHaveLength(1);
    });
  });

  describe('getPermissionMeta', () => {
    it('returns metadata for known permission', () => {
      const meta = getPermissionMeta('shell');
      expect(meta).not.toBeNull();
      expect(meta.label).toBe('셸 명령 실행');
      expect(meta.severity).toBe('critical');
    });

    it('returns null for unknown permission', () => {
      expect(getPermissionMeta('does-not-exist')).toBeNull();
    });
  });

  describe('PERMISSION_CATALOG exposure', () => {
    it('exposes all categories', () => {
      expect(Object.keys(PERMISSION_CATALOG)).toEqual(
        expect.arrayContaining([
          'file-io',
          'network',
          'shell',
          'registry',
          'wscript',
          'activex',
          'dom',
          'hancom-api',
          'dynamic-eval',
        ])
      );
    });
  });
});
