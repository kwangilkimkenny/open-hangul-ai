/**
 * 매크로 샌드박스 시각화 다이얼로그
 *
 * 분석 결과를 모달 형태로 렌더링합니다.
 * - 매크로 코드 보기 (escapeHtml 후 <pre> 안에만 표시, 실행 없음)
 * - 권한 트리 (카테고리별)
 * - 시뮬레이션 보고서
 * - 위험 등급 배지
 *
 * @module macro-sandbox/sandbox-dialog
 */

import { escapeHtml } from '../../utils/html-escape.js';
import { getRiskBadge } from './simulation-report.js';
import { getPermissionMeta, groupDetailsByType } from './permission-analyzer.js';

const DIALOG_CLASS = 'oha-macro-sandbox-dialog';
const OVERLAY_CLASS = 'oha-macro-sandbox-overlay';

/**
 * 위험도별 색상 매핑.
 */
const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

/**
 * 모달 다이얼로그 생성.
 *
 * @param {Object} analysis
 * @param {string} analysis.code - 원본 매크로 코드 (UI 에서만 escape 후 표시)
 * @param {string} analysis.language
 * @param {Set<string> | string[]} analysis.permissions
 * @param {Array} analysis.details
 * @param {Object} analysis.report - generateReport 결과
 * @param {string} analysis.riskLevel
 * @param {Document} [doc=document]
 * @returns {{ element: HTMLElement, close: () => void }}
 */
export function createSandboxDialog(analysis, doc) {
  const ownerDoc = doc || (typeof document !== 'undefined' ? document : null);
  if (!ownerDoc) {
    throw new Error('createSandboxDialog: document is not available');
  }

  const overlay = ownerDoc.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '매크로 샌드박스 분석');
  applyStyles(overlay, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0, 0, 0, 0.55)',
    zIndex: '9999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  });

  const dialog = ownerDoc.createElement('div');
  dialog.className = DIALOG_CLASS;
  applyStyles(dialog, {
    background: '#ffffff',
    borderRadius: '12px',
    maxWidth: '960px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    padding: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#111827',
  });

  dialog.appendChild(renderHeader(ownerDoc, analysis));
  dialog.appendChild(renderRiskBadge(ownerDoc, analysis));
  dialog.appendChild(renderPermissionTree(ownerDoc, analysis));
  dialog.appendChild(renderSimulationSection(ownerDoc, analysis));
  dialog.appendChild(renderCodeSection(ownerDoc, analysis));
  dialog.appendChild(renderFooter(ownerDoc, () => close()));

  overlay.appendChild(dialog);

  const close = () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  // Esc 키로 닫기
  const onKey = e => {
    if (e.key === 'Escape') {
      close();
      ownerDoc.removeEventListener('keydown', onKey);
    }
  };
  ownerDoc.addEventListener('keydown', onKey);

  return { element: overlay, close };
}

/**
 * 헤더 — 제목 + 보안 안내.
 */
function renderHeader(doc, analysis) {
  const wrap = doc.createElement('div');
  applyStyles(wrap, { marginBottom: '16px' });

  const title = doc.createElement('h2');
  title.textContent = '매크로 샌드박스 분석';
  applyStyles(title, {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: '700',
  });
  wrap.appendChild(title);

  const subtitle = doc.createElement('p');
  subtitle.textContent = `언어: ${analysis.language || 'unknown'} — 이 매크로는 실행되지 않았습니다. 정적 분석 결과만 표시됩니다.`;
  applyStyles(subtitle, {
    margin: '0',
    fontSize: '13px',
    color: '#6b7280',
  });
  wrap.appendChild(subtitle);

  return wrap;
}

/**
 * 위험 등급 배지.
 */
function renderRiskBadge(doc, analysis) {
  const wrap = doc.createElement('div');
  applyStyles(wrap, { marginBottom: '16px' });

  const badge = getRiskBadge(analysis.riskLevel);
  const el = doc.createElement('span');
  el.setAttribute('data-testid', 'risk-badge');
  el.setAttribute('data-risk-level', analysis.riskLevel || 'low');
  el.textContent = `위험 등급: ${badge.text}`;
  applyStyles(el, {
    display: 'inline-block',
    padding: '6px 14px',
    background: badge.color,
    color: '#ffffff',
    borderRadius: '999px',
    fontWeight: '600',
    fontSize: '14px',
  });
  wrap.appendChild(el);

  return wrap;
}

/**
 * 권한 트리.
 */
function renderPermissionTree(doc, analysis) {
  const wrap = doc.createElement('section');
  applyStyles(wrap, { marginBottom: '16px' });

  const h = doc.createElement('h3');
  h.textContent = '요청 권한 (정적 분석)';
  applyStyles(h, { fontSize: '16px', margin: '0 0 8px 0' });
  wrap.appendChild(h);

  const details = Array.isArray(analysis.details) ? analysis.details : [];
  const groups = groupDetailsByType(details);
  const permIds = Object.keys(groups);

  if (permIds.length === 0) {
    const p = doc.createElement('p');
    p.textContent = '감지된 위험 권한 호출이 없습니다.';
    applyStyles(p, { fontSize: '14px', color: '#6b7280', margin: '0' });
    wrap.appendChild(p);
    return wrap;
  }

  const ul = doc.createElement('ul');
  ul.setAttribute('data-testid', 'permission-tree');
  applyStyles(ul, {
    listStyle: 'none',
    padding: '0',
    margin: '0',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  });

  permIds.forEach((permId, idx) => {
    const meta = getPermissionMeta(permId) || { label: permId, severity: 'low' };
    const entries = groups[permId];

    const li = doc.createElement('li');
    applyStyles(li, {
      padding: '12px 14px',
      borderTop: idx === 0 ? 'none' : '1px solid #e5e7eb',
    });

    const head = doc.createElement('div');
    applyStyles(head, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });

    const left = doc.createElement('div');
    const label = doc.createElement('strong');
    label.textContent = meta.label;
    applyStyles(label, { fontSize: '14px' });
    left.appendChild(label);

    const id = doc.createElement('code');
    id.textContent = ` (${permId})`;
    applyStyles(id, { fontSize: '12px', color: '#6b7280', marginLeft: '6px' });
    left.appendChild(id);

    head.appendChild(left);

    const sev = doc.createElement('span');
    sev.textContent = meta.severity;
    applyStyles(sev, {
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '4px',
      background: SEVERITY_COLORS[meta.severity] || '#6b7280',
      color: '#ffffff',
      fontWeight: '600',
      textTransform: 'uppercase',
    });
    head.appendChild(sev);

    li.appendChild(head);

    const callList = doc.createElement('ul');
    applyStyles(callList, {
      listStyle: 'disc',
      paddingLeft: '20px',
      margin: '8px 0 0 0',
      fontSize: '12px',
      color: '#374151',
    });
    entries.slice(0, 10).forEach(e => {
      const item = doc.createElement('li');
      item.textContent = `라인 ${e.line || '?'}: ${e.identifier}`;
      callList.appendChild(item);
    });
    if (entries.length > 10) {
      const more = doc.createElement('li');
      more.textContent = `... 그 외 ${entries.length - 10}건`;
      applyStyles(more, { color: '#6b7280', listStyle: 'none' });
      callList.appendChild(more);
    }
    li.appendChild(callList);

    ul.appendChild(li);
  });

  wrap.appendChild(ul);
  return wrap;
}

/**
 * 시뮬레이션 보고서.
 */
function renderSimulationSection(doc, analysis) {
  const wrap = doc.createElement('section');
  applyStyles(wrap, { marginBottom: '16px' });

  const h = doc.createElement('h3');
  h.textContent = '시뮬레이션 보고서';
  applyStyles(h, { fontSize: '16px', margin: '0 0 8px 0' });
  wrap.appendChild(h);

  const report = analysis.report || {};
  const pre = doc.createElement('pre');
  pre.setAttribute('data-testid', 'simulation-report');
  pre.textContent = report.text || report.markdown || '(보고서 없음)';
  applyStyles(pre, {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    margin: '0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#111827',
  });
  wrap.appendChild(pre);

  return wrap;
}

/**
 * 매크로 코드 보기 (escapeHtml 후 <pre>, 실행 안 됨).
 */
function renderCodeSection(doc, analysis) {
  const wrap = doc.createElement('section');
  applyStyles(wrap, { marginBottom: '16px' });

  const h = doc.createElement('h3');
  h.textContent = '매크로 원본 코드 (실행되지 않음)';
  applyStyles(h, { fontSize: '16px', margin: '0 0 8px 0' });
  wrap.appendChild(h);

  const pre = doc.createElement('pre');
  pre.setAttribute('data-testid', 'macro-code');
  const safeText = typeof analysis.code === 'string' ? analysis.code : '';
  // innerHTML 대신 textContent 사용 — 더 안전. escapeHtml 은 보조적인 보장.
  pre.textContent = safeText.slice(0, 50000);
  // 그래도 escapeHtml 호출하여 호환성 유지 (테스트에서 escape 결과 검증 가능)
  pre.setAttribute('data-escaped-length', String(escapeHtml(safeText).length));
  applyStyles(pre, {
    background: '#0f172a',
    color: '#e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    maxHeight: '300px',
    overflow: 'auto',
    margin: '0',
    whiteSpace: 'pre',
  });
  wrap.appendChild(pre);

  return wrap;
}

/**
 * 푸터 — 닫기 버튼.
 */
function renderFooter(doc, onClose) {
  const wrap = doc.createElement('div');
  applyStyles(wrap, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid #e5e7eb',
  });

  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.textContent = '닫기';
  btn.setAttribute('data-testid', 'close-button');
  applyStyles(btn, {
    background: '#111827',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  });
  btn.addEventListener('click', () => onClose());
  wrap.appendChild(btn);

  return wrap;
}

/**
 * 인라인 스타일 적용 유틸 (CSS 의존 없이 단독 동작 보장).
 *
 * @param {HTMLElement} el
 * @param {Record<string, string>} styles
 */
function applyStyles(el, styles) {
  if (!el || !el.style) return;
  for (const [k, v] of Object.entries(styles)) {
    el.style[k] = v;
  }
}

/**
 * 분석 결과를 모달로 띄움. body 에 자동 부착.
 *
 * @param {Object} analysis
 * @returns {{ element: HTMLElement, close: () => void } | null}
 */
export function showSandboxDialog(analysis) {
  if (typeof document === 'undefined') return null;
  const handle = createSandboxDialog(analysis, document);
  document.body.appendChild(handle.element);
  return handle;
}

export default {
  createSandboxDialog,
  showSandboxDialog,
};
