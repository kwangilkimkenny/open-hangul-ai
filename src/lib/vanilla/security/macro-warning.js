/**
 * Macro Security Warning UI
 *
 * 매크로가 감지된 문서에 대해 **시각적 경고 배너**를 렌더링합니다.
 * 매크로 코드는 **절대 실행되지 않으며**, "자세히 보기" 모달은 HTML 이스케이프된
 * 텍스트만 `<pre>` 안에 표시합니다.
 *
 *  ⚠️  CRITICAL
 *  - innerHTML 으로 매크로 코드를 그대로 삽입하지 않습니다 (textContent 사용)
 *  - "신뢰함" / "실행" 버튼 없음 — UI 차원에서 실행 경로 제공 안 함
 *
 * @module security/macro-warning
 */

import { escapeHtml } from './macro-detector.js';

const BANNER_CLASS = 'hwp-macro-warning-banner';
const MODAL_CLASS = 'hwp-macro-warning-modal';
const STYLE_ID = 'hwp-macro-warning-styles';

/**
 * 인라인 스타일 한 번만 삽입.
 *
 * @param {Document} doc
 */
function ensureStyles(doc) {
    if (!doc || !doc.head) return;
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.${BANNER_CLASS} {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    margin: 0 0 12px 0;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", sans-serif;
    border: 1px solid;
    box-sizing: border-box;
}
.${BANNER_CLASS}--warn {
    background: #fff7e0;
    color: #5a3d00;
    border-color: #f0c14b;
}
.${BANNER_CLASS}--danger {
    background: #fdeaea;
    color: #6b1414;
    border-color: #e08585;
}
.${BANNER_CLASS}__icon {
    flex: 0 0 auto;
    font-size: 18px;
    line-height: 1;
}
.${BANNER_CLASS}__body {
    flex: 1 1 auto;
}
.${BANNER_CLASS}__title {
    font-weight: 600;
    margin-bottom: 2px;
}
.${BANNER_CLASS}__meta {
    font-size: 12px;
    opacity: 0.85;
}
.${BANNER_CLASS}__details-btn {
    flex: 0 0 auto;
    background: transparent;
    border: 1px solid currentColor;
    color: inherit;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
}
.${BANNER_CLASS}__details-btn:hover {
    background: rgba(0,0,0,0.05);
}
.${MODAL_CLASS}__backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}
.${MODAL_CLASS} {
    background: #ffffff;
    color: #222;
    width: min(720px, 92vw);
    max-height: 80vh;
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25);
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", sans-serif;
}
.${MODAL_CLASS}__header {
    padding: 14px 18px;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.${MODAL_CLASS}__title {
    font-weight: 600;
    font-size: 15px;
}
.${MODAL_CLASS}__close {
    background: transparent;
    border: 0;
    font-size: 18px;
    cursor: pointer;
    color: #666;
}
.${MODAL_CLASS}__body {
    padding: 14px 18px;
    overflow: auto;
    font-size: 13px;
}
.${MODAL_CLASS}__section {
    margin-bottom: 14px;
}
.${MODAL_CLASS}__section-title {
    font-weight: 600;
    margin-bottom: 4px;
    font-size: 12px;
    text-transform: uppercase;
    color: #555;
}
.${MODAL_CLASS}__code {
    background: #f5f5f7;
    border: 1px solid #e5e5ea;
    border-radius: 4px;
    padding: 10px 12px;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 320px;
    overflow: auto;
    color: #222;
}
.${MODAL_CLASS}__chip {
    display: inline-block;
    padding: 2px 8px;
    margin: 2px 4px 2px 0;
    border-radius: 10px;
    font-size: 11px;
    background: #fdeaea;
    color: #6b1414;
    border: 1px solid #e08585;
}
.${MODAL_CLASS}__note {
    color: #6b1414;
    font-size: 12px;
    margin-top: 6px;
}
`;
    doc.head.appendChild(style);
}

/**
 * 위험 힌트 한글 라벨.
 *
 * @type {Record<string,string>}
 */
const RISK_LABELS = {
    'file-io': '파일 입출력',
    'network': '네트워크 통신',
    'shell-exec': '셸 명령 실행',
    'registry': '레지스트리 접근',
    'wscript': 'WScript 호출',
    'activex': 'ActiveX / COM',
    'obfuscation': '난독화 / 인코딩',
    'dynamic-eval': '동적 코드 실행',
    'hancom-api': '한컴 자동화 API',
};

/**
 * 매크로 metadata 가 유효한지 확인.
 *
 * @param {*} m
 * @returns {boolean}
 */
function isPresent(m) {
    if (!m) return false;
    if (Array.isArray(m.details) && m.details.length > 0) return true;
    if (m.present === true || m.detected === true) return true;
    return false;
}

/**
 * 매크로 경고 배너 + 모달 렌더링.
 *
 * @param {Object} metadata
 *   `detectMacrosFromEntries` / `detectMacrosFromXml` / `mergeMacroResults` 결과.
 * @param {HTMLElement} container - 배너를 삽입할 부모 요소
 * @param {Object} [options]
 * @param {Document} [options.doc] - 테스트용 document 주입
 * @param {boolean} [options.dangerous] - true 면 빨간 배너, false 면 노란 배너
 * @returns {HTMLElement | null} 생성된 배너 엘리먼트 (없으면 null)
 */
export function renderMacroWarning(metadata, container, options = {}) {
    if (!container || typeof container.appendChild !== 'function') return null;
    if (!isPresent(metadata)) return null;

    const doc = options.doc || container.ownerDocument || globalThis.document;
    if (!doc) return null;

    ensureStyles(doc);

    // 기존 배너 제거 (중복 방지)
    const existing = container.querySelector(`.${BANNER_CLASS}`);
    if (existing && existing.parentNode === container) {
        container.removeChild(existing);
    }

    const details = Array.isArray(metadata.details) ? metadata.details : [];
    const riskHints = Array.isArray(metadata.riskHints)
        ? metadata.riskHints
        : Array.from(new Set(details.flatMap(d => d.riskHints || []))).sort();
    const languages = Array.isArray(metadata.languages)
        ? metadata.languages
        : Array.from(new Set(details.map(d => d.language))).sort();

    const dangerous =
        typeof options.dangerous === 'boolean'
            ? options.dangerous
            : riskHints.some(h =>
                  ['shell-exec', 'network', 'registry', 'dynamic-eval', 'activex'].includes(h)
              );

    const banner = doc.createElement('div');
    banner.className = `${BANNER_CLASS} ${BANNER_CLASS}--${dangerous ? 'danger' : 'warn'}`;
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'polite');
    banner.dataset.macroBanner = 'true';

    const icon = doc.createElement('span');
    icon.className = `${BANNER_CLASS}__icon`;
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = dangerous ? '⛔' : '⚠️';

    const body = doc.createElement('div');
    body.className = `${BANNER_CLASS}__body`;

    const title = doc.createElement('div');
    title.className = `${BANNER_CLASS}__title`;
    title.textContent =
        '이 문서는 매크로를 포함합니다. 매크로는 보안상 실행되지 않습니다.';

    const meta = doc.createElement('div');
    meta.className = `${BANNER_CLASS}__meta`;
    const totalLength = details.reduce((sum, d) => sum + (d.length || 0), 0);
    const riskLabel =
        riskHints.length > 0
            ? riskHints.map(h => RISK_LABELS[h] || h).join(', ')
            : '없음';
    const langLabel = languages.length > 0 ? languages.join(', ') : 'unknown';
    meta.textContent = `언어: ${langLabel} · 매크로 ${details.length}개 · 총 ${totalLength.toLocaleString()}자 · 위험 힌트: ${riskLabel}`;

    body.appendChild(title);
    body.appendChild(meta);

    const detailsBtn = doc.createElement('button');
    detailsBtn.type = 'button';
    detailsBtn.className = `${BANNER_CLASS}__details-btn`;
    detailsBtn.textContent = '자세히 보기';
    detailsBtn.addEventListener('click', () => {
        openMacroDetailsModal(metadata, { doc });
    });

    banner.appendChild(icon);
    banner.appendChild(body);
    banner.appendChild(detailsBtn);

    // 컨테이너 맨 앞에 삽입
    if (container.firstChild) {
        container.insertBefore(banner, container.firstChild);
    } else {
        container.appendChild(banner);
    }

    return banner;
}

/**
 * 매크로 상세 정보 모달 표시. 코드는 HTML 이스케이프 후 `textContent` 로 설정.
 *
 * @param {Object} metadata
 * @param {Object} [options]
 * @param {Document} [options.doc]
 * @returns {HTMLElement | null}
 */
export function openMacroDetailsModal(metadata, options = {}) {
    const doc = options.doc || globalThis.document;
    if (!doc || !isPresent(metadata)) return null;
    ensureStyles(doc);

    const backdrop = doc.createElement('div');
    backdrop.className = `${MODAL_CLASS}__backdrop`;
    backdrop.dataset.macroModal = 'true';

    const modal = doc.createElement('div');
    modal.className = MODAL_CLASS;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const header = doc.createElement('div');
    header.className = `${MODAL_CLASS}__header`;
    const titleEl = doc.createElement('div');
    titleEl.className = `${MODAL_CLASS}__title`;
    titleEl.textContent = '매크로 정보 (실행되지 않음)';
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = `${MODAL_CLASS}__close`;
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    });
    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const body = doc.createElement('div');
    body.className = `${MODAL_CLASS}__body`;

    // 위험 힌트 칩
    const allHints = Array.from(
        new Set(
            (metadata.riskHints || []).concat(
                ...(metadata.details || []).map(d => d.riskHints || [])
            )
        )
    ).sort();

    if (allHints.length > 0) {
        const section = doc.createElement('div');
        section.className = `${MODAL_CLASS}__section`;
        const st = doc.createElement('div');
        st.className = `${MODAL_CLASS}__section-title`;
        st.textContent = '감지된 위험 힌트';
        section.appendChild(st);
        for (const h of allHints) {
            const chip = doc.createElement('span');
            chip.className = `${MODAL_CLASS}__chip`;
            chip.textContent = RISK_LABELS[h] || h;
            section.appendChild(chip);
        }
        body.appendChild(section);
    }

    // 각 매크로 엔트리
    const details = Array.isArray(metadata.details) ? metadata.details : [];
    details.forEach((entry, idx) => {
        const section = doc.createElement('div');
        section.className = `${MODAL_CLASS}__section`;

        const st = doc.createElement('div');
        st.className = `${MODAL_CLASS}__section-title`;
        st.textContent = `매크로 #${idx + 1} — ${entry.language || 'unknown'} · ${(entry.length || 0).toLocaleString()}자`;
        section.appendChild(st);

        const meta = doc.createElement('div');
        const versionLabel = entry.version ? ` · 버전 ${entry.version}` : '';
        meta.textContent = `경로: ${entry.path || '(inline)'}${versionLabel}`;
        section.appendChild(meta);

        if (entry.sanitizedCode) {
            const pre = doc.createElement('pre');
            pre.className = `${MODAL_CLASS}__code`;
            // sanitizedCode 는 이미 HTMLEscape 된 문자열. <pre>.textContent 로 설정해서
            // 실행 컨텍스트(스크립트 / on* 핸들러) 진입을 원천 차단.
            pre.textContent = unescapeForDisplay(entry.sanitizedCode);
            section.appendChild(pre);

            if (entry.truncated) {
                const note = doc.createElement('div');
                note.className = `${MODAL_CLASS}__note`;
                note.textContent = '※ 길이 제한으로 일부만 표시됩니다.';
                section.appendChild(note);
            }
        } else {
            const note = doc.createElement('div');
            note.className = `${MODAL_CLASS}__note`;
            note.textContent = '코드 본문은 보안을 위해 표시되지 않습니다.';
            section.appendChild(note);
        }

        body.appendChild(section);
    });

    const footerNote = doc.createElement('div');
    footerNote.className = `${MODAL_CLASS}__note`;
    footerNote.textContent =
        '이 뷰어는 매크로를 절대 실행하지 않습니다. 위 코드는 정보 제공용 텍스트입니다.';
    body.appendChild(footerNote);

    modal.appendChild(header);
    modal.appendChild(body);
    backdrop.appendChild(modal);

    backdrop.addEventListener('click', e => {
        if (e.target === backdrop) {
            backdrop.parentNode && backdrop.parentNode.removeChild(backdrop);
        }
    });

    (doc.body || doc.documentElement).appendChild(backdrop);
    return backdrop;
}

/**
 * `sanitizedCode` 는 HTMLEscape 된 문자열입니다. `<pre>.textContent` 로 표시할 때는
 * 사용자가 원본 문자를 보길 원하므로 다시 디코드합니다.
 * `textContent` 를 쓰기 때문에 디코드된 문자열이 HTML 로 해석될 위험은 없습니다.
 *
 * @param {string} escaped
 * @returns {string}
 */
function unescapeForDisplay(escaped) {
    if (typeof escaped !== 'string') return '';
    return escaped
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

/**
 * 테스트 / 진단용: 배너에서 사용하는 CSS 클래스 이름 노출.
 */
export const __testHooks = {
    BANNER_CLASS,
    MODAL_CLASS,
    STYLE_ID,
    RISK_LABELS,
    escapeHtml,
};

export default {
    renderMacroWarning,
    openMacroDetailsModal,
};
