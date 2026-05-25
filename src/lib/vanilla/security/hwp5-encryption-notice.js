/**
 * HWP 5.0 Encryption Notice
 *
 * 한컴 한글 자체 암호(.hwp 바이너리)는 브라우저 뷰어가 직접 풀 수 없다.
 * 사용자에게 .hwpx 로 변환하는 방법을 안내하는 모달 다이얼로그.
 *
 * - innerHTML 사용 안 함 (모든 텍스트는 textContent / DOM API)
 * - 외부 의존성 없음
 * - 기본 스타일 인라인 (CSS 파일 없이도 동작)
 *
 * @module security/hwp5-encryption-notice
 */

const OVERLAY_STYLE = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  background: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: '10000',
};

const CARD_STYLE = {
  background: '#ffffff',
  color: '#222',
  padding: '24px 28px',
  borderRadius: '8px',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  maxWidth: '460px',
  width: '90%',
  fontFamily: 'system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif',
};

const TITLE_STYLE = {
  margin: '0 0 12px 0',
  fontSize: '18px',
  fontWeight: '600',
};

const PARAGRAPH_STYLE = {
  margin: '0 0 12px 0',
  fontSize: '14px',
  lineHeight: '1.55',
};

const LIST_STYLE = {
  margin: '0 0 16px 0',
  paddingLeft: '20px',
  fontSize: '14px',
  lineHeight: '1.6',
};

const BUTTON_ROW_STYLE = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '8px',
};

const BUTTON_STYLE = {
  padding: '8px 18px',
  border: 'none',
  borderRadius: '6px',
  background: '#1e6fd9',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
};

function applyStyle(el, style) {
  for (const key of Object.keys(style)) {
    el.style[key] = style[key];
  }
}

/**
 * HWP 5.0 암호 문서 안내 모달을 표시한다.
 *
 * @param {Object} opts
 * @param {string} [opts.documentName]   - 파일명 (기본 '문서')
 * @param {HTMLElement} [opts.container] - 모달을 붙일 부모 (기본 document.body)
 * @param {() => void} [opts.onClose]    - 닫힐 때 호출되는 콜백
 * @returns {{close: () => void, element: HTMLElement}} 제어 핸들
 */
export function showHwp5EncryptionNotice(opts = {}) {
  const documentName = String(opts.documentName || '문서');
  const parent = opts.container || (typeof document !== 'undefined' ? document.body : null);

  if (!parent) {
    // SSR/Node 환경 — 다이얼로그 표시 불가
    return { close: () => {}, element: null };
  }

  const overlay = document.createElement('div');
  overlay.className = 'hwp5-encryption-notice';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hwp5-enc-title');
  applyStyle(overlay, OVERLAY_STYLE);

  const card = document.createElement('div');
  card.className = 'hwp5-encryption-notice__card';
  applyStyle(card, CARD_STYLE);

  const title = document.createElement('h2');
  title.id = 'hwp5-enc-title';
  applyStyle(title, TITLE_STYLE);
  title.textContent = '🔒 암호 보호된 HWP 문서';

  const intro = document.createElement('p');
  applyStyle(intro, PARAGRAPH_STYLE);
  intro.textContent =
    `이 문서(${documentName})는 한컴 한글 자체 암호로 보호되어 있습니다. ` +
    `현재 브라우저 뷰어는 HWPX(.hwpx) 형식의 암호 해제만 지원합니다.`;

  const howToTitle = document.createElement('p');
  applyStyle(howToTitle, PARAGRAPH_STYLE);
  howToTitle.style.fontWeight = '600';
  howToTitle.style.marginBottom = '6px';
  howToTitle.textContent = '다음 방법으로 변환해 주세요:';

  const steps = document.createElement('ol');
  applyStyle(steps, LIST_STYLE);
  for (const text of [
    '한컴 한글에서 파일을 열어 비밀번호를 입력',
    '다른 이름으로 저장 → HWPX(.hwpx) 형식 선택',
    '동일한 비밀번호로 다시 저장',
    '그런 다음 이 뷰어에 .hwpx 파일을 업로드',
  ]) {
    const li = document.createElement('li');
    li.textContent = text;
    steps.appendChild(li);
  }

  const buttonRow = document.createElement('div');
  applyStyle(buttonRow, BUTTON_ROW_STYLE);

  const okButton = document.createElement('button');
  okButton.type = 'button';
  applyStyle(okButton, BUTTON_STYLE);
  okButton.textContent = '확인';

  buttonRow.appendChild(okButton);
  card.appendChild(title);
  card.appendChild(intro);
  card.appendChild(howToTitle);
  card.appendChild(steps);
  card.appendChild(buttonRow);
  overlay.appendChild(card);
  parent.appendChild(overlay);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    document.removeEventListener('keydown', onKey);
    if (typeof opts.onClose === 'function') {
      try {
        opts.onClose();
      } catch (_) {
        // ignore
      }
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  okButton.addEventListener('click', close);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);

  // 포커스 이동 — 접근성
  okButton.focus();

  return { close, element: overlay };
}

/**
 * Parser 가 던진 에러가 HWP 5.0 암호 에러인지 검사.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isHwp5EncryptionError(err) {
  return Boolean(err && typeof err === 'object' && err.code === 'HWP5_ENCRYPTED');
}
