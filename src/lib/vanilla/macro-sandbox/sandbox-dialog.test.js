/**
 * sandbox-dialog unit tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createSandboxDialog, showSandboxDialog } from './sandbox-dialog.js';
import { analyzeMacro } from './index.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('sandbox-dialog', () => {
  it('renders dialog with risk badge', () => {
    const analysis = analyzeMacro(
      `var sh = new ActiveXObject("WScript.Shell"); sh.Run("calc.exe");`,
      'jscript'
    );
    const { element, close } = createSandboxDialog(analysis, document);
    document.body.appendChild(element);
    const badge = element.querySelector('[data-testid="risk-badge"]');
    expect(badge).not.toBeNull();
    expect(badge.getAttribute('data-risk-level')).toBe('critical');
    close();
  });

  it('renders permission tree for each category', () => {
    const analysis = analyzeMacro(
      `var x = new XMLHttpRequest(); var f = new ActiveXObject("Scripting.FileSystemObject");`,
      'jscript'
    );
    const { element } = createSandboxDialog(analysis, document);
    document.body.appendChild(element);
    const tree = element.querySelector('[data-testid="permission-tree"]');
    expect(tree).not.toBeNull();
    // network 와 activex / file-io 가 모두 있어야 함
    expect(tree.textContent).toMatch(/네트워크|파일/);
  });

  it('renders simulation report text', () => {
    const analysis = analyzeMacro('eval("var x=1");', 'jscript');
    const { element } = createSandboxDialog(analysis, document);
    document.body.appendChild(element);
    const reportEl = element.querySelector('[data-testid="simulation-report"]');
    expect(reportEl).not.toBeNull();
    expect(reportEl.textContent).toContain('매크로 시뮬레이션 보고서');
  });

  it('renders macro code without executing it (textContent)', () => {
    // 만약 innerHTML 으로 코드를 삽입했다면 이 script 태그가 실행될 위험.
    globalThis.__dialogTestSideEffect = 'untouched';
    const code = `<script>globalThis.__dialogTestSideEffect = "EXEC";</script>`;
    const analysis = analyzeMacro(code, 'jscript');
    const { element } = createSandboxDialog(analysis, document);
    document.body.appendChild(element);
    const codeEl = element.querySelector('[data-testid="macro-code"]');
    expect(codeEl).not.toBeNull();
    // textContent 로만 들어가야 하므로 자식 script 태그는 0 개
    expect(codeEl.querySelectorAll('script').length).toBe(0);
    // 그리고 부수효과 없음
    expect(globalThis.__dialogTestSideEffect).toBe('untouched');
  });

  it('close button removes dialog from DOM', () => {
    const analysis = analyzeMacro('var x = 1;', 'jscript');
    const handle = createSandboxDialog(analysis, document);
    document.body.appendChild(handle.element);
    expect(document.body.contains(handle.element)).toBe(true);
    const btn = handle.element.querySelector('[data-testid="close-button"]');
    btn.click();
    expect(document.body.contains(handle.element)).toBe(false);
  });

  it('showSandboxDialog auto-attaches to body', () => {
    const analysis = analyzeMacro('var x = 1;', 'jscript');
    const handle = showSandboxDialog(analysis);
    expect(handle).not.toBeNull();
    expect(document.body.contains(handle.element)).toBe(true);
    handle.close();
  });
});
