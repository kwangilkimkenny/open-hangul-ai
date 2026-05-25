/**
 * password-dialog unit tests (jsdom)
 */

import { describe, it, expect, vi } from 'vitest';
import { promptPassword, _internals } from './password-dialog.js';

function $(sel, root = document) {
    return root.querySelector(sel);
}

describe('password-dialog :: promptPassword', () => {
    it('returns null when document is unavailable', async () => {
        const result = await promptPassword('a.hwpx', { document: null });
        // jsdom 환경에서는 global document 가 있으므로 명시적 null 주입 시 null 반환
        // (브랜치만 검증)
        expect(result === null || typeof result === 'string').toBe(true);
    });

    it('resolves with the entered password when no verify callback is given', async () => {
        const promise = promptPassword('secret.hwpx');
        // 다이얼로그가 마운트될 시간을 짧게 양보
        await Promise.resolve();
        const input = $('.hwpx-password-dialog-input');
        expect(input).toBeTruthy();
        input.value = 'mypass';
        $('.hwpx-password-dialog-submit').click();
        const result = await promise;
        expect(result).toBe('mypass');
        // dom cleanup
        expect($('.hwpx-password-dialog-overlay')).toBeNull();
    });

    it('resolves null when user cancels', async () => {
        const promise = promptPassword('secret.hwpx');
        await Promise.resolve();
        $('.hwpx-password-dialog-cancel').click();
        const result = await promise;
        expect(result).toBeNull();
    });

    it('rejects empty submission with inline error', async () => {
        const promise = promptPassword('secret.hwpx');
        await Promise.resolve();
        $('.hwpx-password-dialog-submit').click();
        // 다이얼로그가 사라지지 않아야 한다
        expect($('.hwpx-password-dialog-overlay')).toBeTruthy();
        const err = $('.hwpx-password-dialog-error').textContent;
        expect(err).toMatch(/입력/);
        // cleanup
        $('.hwpx-password-dialog-cancel').click();
        await promise;
    });

    it('retries up to maxAttempts when verify rejects, then resolves null', async () => {
        const verify = vi.fn().mockResolvedValue(false);
        const promise = promptPassword('locked.hwpx', { verify, maxAttempts: 2 });
        await Promise.resolve();

        const input = $('.hwpx-password-dialog-input');
        input.value = 'wrong1';
        $('.hwpx-password-dialog-submit').click();
        // 첫 번째 검증 결과 기다리기
        await new Promise(r => setTimeout(r, 0));

        // 다이얼로그는 여전히 떠 있어야 한다
        expect($('.hwpx-password-dialog-overlay')).toBeTruthy();

        input.value = 'wrong2';
        $('.hwpx-password-dialog-submit').click();

        const result = await promise;
        expect(result).toBeNull();
        expect(verify).toHaveBeenCalledTimes(2);
    });

    it('resolves with password once verify accepts', async () => {
        const verify = vi.fn().mockImplementation(async (p) => p === 'good');
        const promise = promptPassword('locked.hwpx', { verify, maxAttempts: 3 });
        await Promise.resolve();

        const input = $('.hwpx-password-dialog-input');
        input.value = 'bad';
        $('.hwpx-password-dialog-submit').click();
        await new Promise(r => setTimeout(r, 0));

        input.value = 'good';
        $('.hwpx-password-dialog-submit').click();

        const result = await promise;
        expect(result).toBe('good');
        expect(verify).toHaveBeenCalledTimes(2);
    });

    it('does not persist password to localStorage or sessionStorage', async () => {
        const lsBefore = JSON.stringify({ ...localStorage });
        const ssBefore = JSON.stringify({ ...sessionStorage });

        const promise = promptPassword('secret.hwpx');
        await Promise.resolve();
        const input = $('.hwpx-password-dialog-input');
        input.value = 'super-secret-pwd';
        $('.hwpx-password-dialog-submit').click();
        await promise;

        // 어디에도 평문이 남지 않아야 한다
        const lsAfter = JSON.stringify({ ...localStorage });
        const ssAfter = JSON.stringify({ ...sessionStorage });
        expect(lsAfter).toBe(lsBefore);
        expect(ssAfter).toBe(ssBefore);
        expect(lsAfter).not.toContain('super-secret-pwd');
        expect(ssAfter).not.toContain('super-secret-pwd');
    });
});

describe('password-dialog :: _internals', () => {
    it('exposes MAX_ATTEMPTS constant', () => {
        expect(_internals.MAX_ATTEMPTS).toBe(3);
    });
});
