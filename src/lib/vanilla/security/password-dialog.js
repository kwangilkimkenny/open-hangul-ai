/**
 * Password Dialog
 *
 * 암호화된 HWP/HWPX 문서를 열 때 사용자로부터 비밀번호를 입력 받기 위한
 * 경량 모달. 입력값은 메모리(클로저)에만 보관되며 localStorage / sessionStorage
 * 등 어떤 영구 저장소에도 기록되지 않는다.
 *
 * 사용 예:
 *   const pwd = await promptPassword('secret.hwpx', {
 *       verify: async (p) => tryDecryptOnce(p)
 *   });
 *   if (pwd === null) {  사용자가 취소함 }
 *
 * @module security/password-dialog
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

const MAX_ATTEMPTS = 3;
const DIALOG_CLASS = 'hwpx-password-dialog';

/**
 * 비밀번호 입력 모달을 띄우고 사용자가 입력/취소할 때까지 대기한다.
 *
 * 옵션의 `verify` 콜백을 지정하면, 입력된 비밀번호가 실제 키 유도/복호화에
 * 성공하는지 확인할 기회를 가질 수 있다. 콜백이 false 를 반환하거나 예외를
 * 던지면 동일 모달 내에서 재시도(최대 3회) 한다.
 *
 * @param {string} documentName 문서 표시 이름
 * @param {Object} [options]
 * @param {(password: string) => Promise<boolean>} [options.verify]
 *        비밀번호 검증 함수. true 반환 시 confirm, false/예외 시 재시도.
 * @param {number} [options.maxAttempts=3]
 * @param {Document} [options.document]  주입 가능한 document (테스트용)
 * @returns {Promise<string | null>}  성공한 비밀번호, 취소/실패면 null
 */
export async function promptPassword(documentName, options = {}) {
    const doc = ('document' in options)
        ? options.document
        : (typeof document !== 'undefined' ? document : null);
    if (!doc) {
        // 헤드리스(노드) 환경 — UI 없이 즉시 null
        logger.warn('🔒 promptPassword: no document available, returning null');
        return null;
    }
    const verify = typeof options.verify === 'function' ? options.verify : null;
    const maxAttempts = Number.isInteger(options.maxAttempts) && options.maxAttempts > 0
        ? options.maxAttempts
        : MAX_ATTEMPTS;

    const safeName = String(documentName || '문서');

    return new Promise(resolve => {
        const { root, input, errorEl, submitBtn, cancelBtn, attemptsEl, cleanup } =
            buildDialog(doc, safeName, maxAttempts);

        let attemptsRemaining = maxAttempts;

        // 클로저 변수에만 비밀번호가 잠시 머문다. cleanup 시 명시적으로 비운다.
        let currentPassword = '';

        const finish = (value) => {
            currentPassword = '';                       // 메모리 1회 덮어쓰기
            input.value = '';                           // DOM 값 제거
            cleanup();
            resolve(value);
        };

        const onSubmit = async (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();

            currentPassword = input.value || '';
            if (!currentPassword) {
                showError(errorEl, '비밀번호를 입력해 주세요.');
                return;
            }

            if (!verify) {
                // 검증 콜백이 없으면 입력값만 신뢰하고 즉시 반환
                const out = currentPassword;
                finish(out);
                return;
            }

            disable(submitBtn, true);
            try {
                const ok = await verify(currentPassword);
                if (ok) {
                    const out = currentPassword;
                    finish(out);
                    return;
                }
                throw new Error('verify returned false');
            } catch (err) {
                attemptsRemaining = Math.max(0, attemptsRemaining - 1);
                logger.debug('🔒 password verify failed:', err && err.message);
                if (attemptsRemaining <= 0) {
                    showError(errorEl, '비밀번호가 올바르지 않습니다. 최대 시도 횟수를 초과했습니다.');
                    // 잠시 후 자동 취소
                    setTimeout(() => finish(null), 600);
                    return;
                }
                attemptsEl.textContent = `남은 시도: ${attemptsRemaining}회`;
                showError(errorEl, '비밀번호가 올바르지 않습니다. 다시 시도해 주세요.');
                input.value = '';
                input.focus();
            } finally {
                disable(submitBtn, false);
            }
        };

        const onCancel = () => finish(null);

        const onKey = (e) => {
            if (e.key === 'Escape') onCancel();
            else if (e.key === 'Enter') onSubmit(e);
        };

        submitBtn.addEventListener('click', onSubmit);
        cancelBtn.addEventListener('click', onCancel);
        root.addEventListener('keydown', onKey);
        // form 의 기본 submit 동작 차단 (Enter 키 폴백)
        const form = root.querySelector('form');
        if (form) form.addEventListener('submit', onSubmit);

        // 마운트 직후 포커스
        setTimeout(() => input.focus(), 0);
    });
}

// ============================================================================
// DOM builder
// ============================================================================

function buildDialog(doc, documentName, maxAttempts) {
    const overlay = doc.createElement('div');
    overlay.className = `${DIALOG_CLASS}-overlay`;
    overlay.setAttribute('role', 'presentation');
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '99999'
    });

    const root = doc.createElement('div');
    root.className = DIALOG_CLASS;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '문서 비밀번호 입력');
    Object.assign(root.style, {
        background: '#fff',
        color: '#222',
        padding: '20px 24px',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        minWidth: '320px',
        maxWidth: '420px',
        fontFamily: 'inherit'
    });

    const title = doc.createElement('h3');
    title.textContent = '암호화된 문서';
    title.style.margin = '0 0 8px 0';
    title.style.fontSize = '16px';

    const desc = doc.createElement('p');
    desc.style.margin = '0 0 12px 0';
    desc.style.fontSize = '13px';
    desc.textContent = `"${documentName}" 은(는) 비밀번호로 보호되어 있습니다. 비밀번호를 입력하세요.`;

    const form = doc.createElement('form');
    form.setAttribute('autocomplete', 'off');

    const input = doc.createElement('input');
    input.type = 'password';
    input.className = `${DIALOG_CLASS}-input`;
    input.setAttribute('aria-label', '비밀번호');
    // 비밀번호 자동저장/관리자 비활성화 (외부 저장 방지)
    input.setAttribute('autocomplete', 'new-password');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('data-1p-ignore', 'true');
    input.setAttribute('data-lpignore', 'true');
    Object.assign(input.style, {
        width: '100%',
        padding: '8px 10px',
        border: '1px solid #c8c8c8',
        borderRadius: '4px',
        fontSize: '14px',
        boxSizing: 'border-box',
        marginBottom: '6px'
    });

    const errorEl = doc.createElement('div');
    errorEl.className = `${DIALOG_CLASS}-error`;
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    Object.assign(errorEl.style, {
        color: '#c0392b',
        fontSize: '12px',
        minHeight: '16px',
        marginBottom: '4px'
    });

    const attemptsEl = doc.createElement('div');
    attemptsEl.className = `${DIALOG_CLASS}-attempts`;
    attemptsEl.textContent = `남은 시도: ${maxAttempts}회`;
    Object.assign(attemptsEl.style, {
        color: '#666',
        fontSize: '12px',
        marginBottom: '12px'
    });

    const help = doc.createElement('p');
    help.className = `${DIALOG_CLASS}-help`;
    help.innerHTML = '<strong>비밀번호를 잊으셨나요?</strong> 한컴 HWP 비밀번호는 분실 시 복구할 수 없습니다. 비밀번호 없이는 문서 내용을 확인할 수 없습니다.';
    Object.assign(help.style, {
        background: '#fff8e1',
        border: '1px solid #ffe082',
        padding: '8px 10px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#5d4037',
        margin: '0 0 12px 0',
        lineHeight: '1.4'
    });

    const actions = doc.createElement('div');
    Object.assign(actions.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px'
    });

    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = `${DIALOG_CLASS}-cancel`;
    cancelBtn.textContent = '취소';
    Object.assign(cancelBtn.style, {
        padding: '6px 14px',
        border: '1px solid #c8c8c8',
        background: '#f6f6f6',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px'
    });

    const submitBtn = doc.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = `${DIALOG_CLASS}-submit`;
    submitBtn.textContent = '확인';
    Object.assign(submitBtn.style, {
        padding: '6px 14px',
        border: '1px solid #1976d2',
        background: '#1976d2',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px'
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);

    form.appendChild(input);
    form.appendChild(errorEl);
    form.appendChild(attemptsEl);
    form.appendChild(help);
    form.appendChild(actions);

    root.appendChild(title);
    root.appendChild(desc);
    root.appendChild(form);
    overlay.appendChild(root);

    (doc.body || doc.documentElement).appendChild(overlay);

    const cleanup = () => {
        try {
            // 입력값 메모리 클리어 (DOM 노드 제거 전 마지막 사용)
            input.value = '';
        } catch (_) { /* noop */ }
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    };

    return { root, input, errorEl, submitBtn, cancelBtn, attemptsEl, cleanup };
}

function showError(el, message) {
    el.textContent = message;
}

function disable(btn, disabled) {
    btn.disabled = !!disabled;
    btn.style.opacity = disabled ? '0.6' : '1';
    btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
}

export const _internals = { buildDialog, MAX_ATTEMPTS };
