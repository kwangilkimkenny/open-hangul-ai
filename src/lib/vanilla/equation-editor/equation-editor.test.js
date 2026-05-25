/**
 * equation-editor unit tests (jsdom)
 *
 * jsdom 환경에는 Custom Element 가 제한적이라 mathlive 가 로드되지 않을 수
 * 있다 — 이 경우 fallback 백엔드(textarea) 로 마운트되며 모든 인터페이스가
 * 동일하게 동작한다.
 */

import { describe, it, expect, vi } from 'vitest';
import { attachEquationEditor, loadMathlive } from './equation-editor.js';

describe('equation-editor :: attachEquationEditor', () => {
    it('throws when no container is given', async () => {
        await expect(attachEquationEditor(null)).rejects.toThrow(/container/);
    });

    it('mounts an editor element into the container', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const ed = await attachEquationEditor(host);
        expect(ed).toBeTruthy();
        expect(ed.element).toBeInstanceOf(HTMLElement);
        expect(host.contains(ed.element)).toBe(true);
        ed.destroy();
        expect(host.contains(ed.element)).toBe(false);
        document.body.removeChild(host);
    });

    it('returns initial value via getValue()', async () => {
        const host = document.createElement('div');
        const ed = await attachEquationEditor(host, { value: 'x^2 + y^2' });
        expect(ed.getValue()).toContain('x^2');
        ed.destroy();
    });

    it('setValue() updates getValue()', async () => {
        const host = document.createElement('div');
        const ed = await attachEquationEditor(host);
        ed.setValue('\\frac{a}{b}');
        expect(ed.getValue()).toContain('frac');
        ed.destroy();
    });

    it('insert() appends LaTeX at the caret', async () => {
        const host = document.createElement('div');
        const ed = await attachEquationEditor(host, { value: 'a' });
        ed.insert('+b');
        expect(ed.getValue()).toMatch(/a.*\+.*b/);
        ed.destroy();
    });

    it('on("change") fires when the value mutates (fallback only)', async () => {
        const host = document.createElement('div');
        const ed = await attachEquationEditor(host);
        // fallback 백엔드일 때만 input 이벤트로 신뢰성 있게 트리거 가능
        if (ed.usesMathlive) {
            ed.destroy();
            return;
        }
        const spy = vi.fn();
        const off = ed.on('change', spy);
        ed.element.value = 'z';
        ed.element.dispatchEvent(new Event('input'));
        expect(spy).toHaveBeenCalled();
        off();
        ed.destroy();
    });

    it('destroy() removes listeners and DOM', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const ed = await attachEquationEditor(host);
        const el = ed.element;
        ed.destroy();
        expect(el.parentNode).toBeNull();
        document.body.removeChild(host);
    });

    it('loadMathlive() returns null or a module (never throws)', async () => {
        const mod = await loadMathlive();
        expect(mod === null || typeof mod === 'object').toBe(true);
    });
});
