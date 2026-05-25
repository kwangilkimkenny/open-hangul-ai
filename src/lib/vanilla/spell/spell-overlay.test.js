import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderOverlay, clearOverlay, destroyOverlay, bindUnderlineClick } from './spell-overlay.js';

/** @type {HTMLDivElement} */
let container;
/** @type {Text} */
let textNode;

const baseIssue = {
  ruleId: 'sp-doeda',
  start: 3,
  end: 5,
  text: '됬다',
  replacement: '됐다',
  severity: 'error',
  category: 'spelling',
  hint: 'test hint',
};

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  container.style.position = 'relative';
  textNode = document.createTextNode('나는 됬다 어제.');
  container.appendChild(textNode);
  document.body.appendChild(container);
});

afterEach(() => {
  destroyOverlay(container);
  document.body.innerHTML = '';
});

describe('spell-overlay', () => {
  it('renderOverlay creates an overlay root and underline span for each issue', () => {
    const { root, underlines } = renderOverlay(container, [
      { textNode, text: textNode.textContent || '', issues: [baseIssue] },
    ]);
    expect(root).toBeInstanceOf(HTMLDivElement);
    expect(root.classList.contains('spell-overlay')).toBe(true);
    expect(underlines.length).toBeGreaterThanOrEqual(1);
    for (const u of underlines) {
      expect(u.classList.contains('spell-underline')).toBe(true);
      expect(u.classList.contains('spell-underline--error')).toBe(true);
      expect(u.getAttribute('data-rule-id')).toBe('sp-doeda');
      expect(u.getAttribute('data-replacement')).toBe('됐다');
    }
  });

  it('clearOverlay removes all underlines but keeps the root', () => {
    renderOverlay(container, [{ textNode, text: textNode.textContent || '', issues: [baseIssue] }]);
    const before = container.querySelectorAll('.spell-underline').length;
    expect(before).toBeGreaterThan(0);
    clearOverlay(container);
    expect(container.querySelectorAll('.spell-underline').length).toBe(0);
    expect(container.querySelector('.spell-overlay')).not.toBeNull();
  });

  it('destroyOverlay removes the root entirely', () => {
    renderOverlay(container, [{ textNode, text: textNode.textContent || '', issues: [baseIssue] }]);
    destroyOverlay(container);
    expect(container.querySelector('.spell-overlay')).toBeNull();
  });

  it('renderOverlay with no targets clears existing underlines', () => {
    renderOverlay(container, [{ textNode, text: textNode.textContent || '', issues: [baseIssue] }]);
    const { underlines } = renderOverlay(container, []);
    expect(underlines.length).toBe(0);
    expect(container.querySelectorAll('.spell-underline').length).toBe(0);
  });

  it('throws TypeError when container is not an HTMLElement', () => {
    // @ts-expect-error invalid input
    expect(() => renderOverlay(null, [])).toThrow(TypeError);
  });

  it('bindUnderlineClick fires handler with issue metadata on click', () => {
    const { underlines } = renderOverlay(container, [
      { textNode, text: textNode.textContent || '', issues: [baseIssue] },
    ]);
    expect(underlines.length).toBeGreaterThan(0);
    const calls = [];
    const off = bindUnderlineClick(container, (meta) => calls.push(meta));
    underlines[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls.length).toBe(1);
    expect(calls[0].ruleId).toBe('sp-doeda');
    expect(calls[0].replacement).toBe('됐다');
    off();
    underlines[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls.length).toBe(1); // 더 이상 증가하지 않음
  });

  it('skips invalid issues silently', () => {
    const { underlines } = renderOverlay(container, [
      {
        textNode,
        text: textNode.textContent || '',
        issues: [
          // invalid: missing indices
          /** @type {any} */ ({ ruleId: 'x' }),
          baseIssue,
        ],
      },
    ]);
    expect(underlines.length).toBeGreaterThanOrEqual(1);
  });
});
