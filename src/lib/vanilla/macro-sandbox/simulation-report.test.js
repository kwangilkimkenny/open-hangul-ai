/**
 * simulation-report unit tests
 */
import { describe, it, expect } from 'vitest';
import { generateReport, getRiskBadge } from './simulation-report.js';
import { analyzeMacro } from './index.js';

describe('simulation-report', () => {
  it('generates Korean summary for safe macro (no permissions)', () => {
    const report = generateReport({
      permissions: new Set(),
      details: [],
      language: 'jscript',
    });
    expect(report.riskLevel).toBe('low');
    expect(report.riskLabel).toBe('낮음');
    expect(report.summary).toContain('위험');
  });

  it('generates markdown report with permissions section', () => {
    const report = generateReport({
      permissions: new Set(['shell', 'network']),
      details: [
        { type: 'shell', line: 5, identifier: 'WScript.Shell.Run', code_snippet: 'sh.Run(...)' },
        { type: 'network', line: 12, identifier: 'XMLHttpRequest', code_snippet: 'new XHR()' },
      ],
      language: 'jscript',
    });
    expect(report.markdown).toContain('# 매크로 시뮬레이션 보고서');
    expect(report.markdown).toContain('시도되는 동작');
    expect(report.markdown).toContain('네트워크');
    expect(report.markdown).toContain('셸');
  });

  it('marks risk as critical when shell + network combined', () => {
    const report = generateReport({
      permissions: new Set(['shell', 'network']),
      details: [],
    });
    expect(report.riskLevel).toBe('critical');
    expect(report.warnings.some(w => w.includes('드로퍼') || w.includes('원격'))).toBe(true);
  });

  it('mentions parse errors in the report', () => {
    const report = generateReport({
      permissions: new Set(),
      details: [],
      errors: [{ message: 'unexpected token', line: 3, column: 5 }],
    });
    expect(report.markdown).toContain('파싱 오류');
    expect(report.markdown).toContain('unexpected token');
  });

  it('actions array is sorted by severity (critical first)', () => {
    const report = generateReport({
      permissions: new Set(['dom', 'shell', 'file-io']),
      details: [
        { type: 'dom', line: 1, identifier: 'document' },
        { type: 'shell', line: 2, identifier: 'WScript.Shell' },
        { type: 'file-io', line: 3, identifier: 'FileSystemObject' },
      ],
    });
    expect(report.actions[0].severity).toBe('critical');
    expect(report.actions[report.actions.length - 1].severity).toBe('low');
  });

  it('end-to-end: analyzeMacro produces a report in Korean', () => {
    const code = `var sh = new ActiveXObject("WScript.Shell");\nsh.Run("calc.exe");`;
    const result = analyzeMacro(code, 'jscript');
    expect(result.report.markdown).toContain('매크로 시뮬레이션');
    expect(result.report.riskLevel).toBe('critical');
    // 한국어 키워드 포함
    expect(result.report.markdown).toMatch(/(셸|운영체제)/);
  });

  it('safe macro produces low risk with reassuring summary', () => {
    const result = analyzeMacro('var x = 1 + 2;\nvar y = x * 3;', 'jscript');
    expect(result.report.riskLevel).toBe('low');
    expect(result.report.summary).toMatch(/위험.*낮/);
  });

  it('getRiskBadge returns color metadata', () => {
    expect(getRiskBadge('critical').color).toBe('#dc2626');
    expect(getRiskBadge('low').color).toBe('#16a34a');
    expect(getRiskBadge('unknown-level').color).toBe(getRiskBadge('low').color);
  });
});
