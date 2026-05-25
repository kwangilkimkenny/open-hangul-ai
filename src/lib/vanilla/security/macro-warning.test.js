/**
 * macro-warning UI unit tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    renderMacroWarning,
    openMacroDetailsModal,
    __testHooks,
} from './macro-warning.js';

const { BANNER_CLASS, MODAL_CLASS } = __testHooks;

function makeContainer() {
    const c = document.createElement('div');
    document.body.appendChild(c);
    return c;
}

function makeMetadata(overrides = {}) {
    return {
        present: true,
        detected: true,
        count: 1,
        languages: ['jscript'],
        riskHints: ['file-io'],
        details: [
            {
                present: true,
                path: 'Scripts/DefaultJScript',
                language: 'jscript',
                version: '5.0',
                length: 42,
                riskHints: ['file-io'],
            },
        ],
        ...overrides,
    };
}

describe('macro-warning UI', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        // clean up injected styles for isolation
        const style = document.getElementById('hwp-macro-warning-styles');
        if (style) style.remove();
    });

    it('returns null when metadata is missing / not present', () => {
        const c = makeContainer();
        expect(renderMacroWarning(null, c)).toBeNull();
        expect(renderMacroWarning({}, c)).toBeNull();
        expect(renderMacroWarning({ present: false }, c)).toBeNull();
    });

    it('returns null when container is invalid', () => {
        expect(renderMacroWarning(makeMetadata(), null)).toBeNull();
    });

    it('renders a banner with the required warning text', () => {
        const c = makeContainer();
        const banner = renderMacroWarning(makeMetadata(), c);
        expect(banner).not.toBeNull();
        expect(banner.classList.contains(BANNER_CLASS)).toBe(true);
        // 한국어 경고 메시지
        expect(banner.textContent).toContain('이 문서는 매크로를 포함합니다');
        expect(banner.textContent).toContain('보안상 실행되지 않습니다');
        // 메타 정보
        expect(banner.textContent).toContain('jscript');
    });

    it('uses danger style when high-risk hints are present', () => {
        const c = makeContainer();
        const banner = renderMacroWarning(
            makeMetadata({ riskHints: ['shell-exec'] }),
            c
        );
        expect(banner.className).toContain(`${BANNER_CLASS}--danger`);
    });

    it('uses warn style for benign hints', () => {
        const c = makeContainer();
        const banner = renderMacroWarning(
            makeMetadata({ riskHints: ['file-io'] }),
            c
        );
        expect(banner.className).toContain(`${BANNER_CLASS}--warn`);
    });

    it('does not provide a trust / execute button', () => {
        const c = makeContainer();
        const banner = renderMacroWarning(makeMetadata(), c);
        const buttons = Array.from(banner.querySelectorAll('button'));
        const labels = buttons.map(b => b.textContent.trim());
        // 신뢰함 / 실행 버튼이 절대 없어야 함
        expect(labels.some(l => /신뢰|실행|trust|run|execute/i.test(l))).toBe(
            false
        );
        // 자세히 보기 버튼은 있어야 함
        expect(labels.some(l => l.includes('자세히'))).toBe(true);
    });

    it('clicking "자세히 보기" opens a modal', () => {
        const c = makeContainer();
        const banner = renderMacroWarning(makeMetadata(), c);
        const btn = banner.querySelector('button');
        btn.click();
        const modal = document.querySelector(`.${MODAL_CLASS}`);
        expect(modal).not.toBeNull();
        expect(modal.textContent).toContain('매크로 정보');
        expect(modal.textContent).toContain('실행되지 않음');
    });

    it('modal renders sanitized code as text only — no executable script tags', () => {
        const c = makeContainer();
        // sanitizedCode 는 이미 HTML 이스케이프된 문자열
        const meta = makeMetadata({
            details: [
                {
                    present: true,
                    path: 'Scripts/DefaultJScript',
                    language: 'jscript',
                    version: '',
                    length: 25,
                    riskHints: [],
                    sanitizedCode: '&lt;script&gt;alert(1)&lt;/script&gt;',
                },
            ],
        });
        openMacroDetailsModal(meta);
        const modal = document.querySelector(`.${MODAL_CLASS}`);
        expect(modal).not.toBeNull();
        // 실제 <script> 태그는 DOM 트리에 추가되지 않아야 함
        expect(modal.querySelector('script')).toBeNull();
        // <pre> 의 텍스트에는 원본 형태 (디코드된)가 들어가야 함 — 단 textContent 로
        // 설정되었기 때문에 브라우저가 그것을 HTML 로 해석하지 않음
        const pre = modal.querySelector(`.${MODAL_CLASS}__code`);
        expect(pre).not.toBeNull();
        expect(pre.tagName.toLowerCase()).toBe('pre');
        expect(pre.textContent).toContain('<script>alert(1)</script>');
        // textContent 설정이므로 자식 노드는 단일 텍스트 노드여야 함
        expect(pre.children.length).toBe(0);
    });

    it('removes previous banner before re-rendering (no duplicates)', () => {
        const c = makeContainer();
        renderMacroWarning(makeMetadata(), c);
        renderMacroWarning(makeMetadata(), c);
        const banners = c.querySelectorAll(`.${BANNER_CLASS}`);
        expect(banners.length).toBe(1);
    });

    it('banner is inserted as the first child of the container', () => {
        const c = makeContainer();
        const existingChild = document.createElement('p');
        existingChild.textContent = 'existing content';
        c.appendChild(existingChild);
        const banner = renderMacroWarning(makeMetadata(), c);
        expect(c.firstChild).toBe(banner);
    });

    it('modal closes when backdrop is clicked', () => {
        openMacroDetailsModal(makeMetadata());
        const backdrop = document.querySelector(`.${MODAL_CLASS}__backdrop`);
        expect(backdrop).not.toBeNull();
        backdrop.click();
        expect(document.querySelector(`.${MODAL_CLASS}__backdrop`)).toBeNull();
    });
});
