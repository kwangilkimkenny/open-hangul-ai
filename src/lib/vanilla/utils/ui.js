/**
 * HWPX Viewer UI Utilities
 * UI 헬퍼 함수 (Toast, Loading, Status 등)
 * 
 * @module ui
 * @version 2.0.0
 */

import { getLogger } from './logger.js';

const logger = getLogger('UI');

/**
 * Toast 타입
 * @enum {string}
 */
export const ToastType = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

Object.freeze(ToastType);

/**
 * Toast 알림 표시
 * @param {string} type - Toast 타입 ('success', 'error', 'warning', 'info')
 * @param {string} title - 제목
 * @param {string} message - 메시지
 * @param {number} [duration=5000] - 표시 시간 (ms)
 * 
 * @example
 * showToast('success', '성공', '문서를 성공적으로 불러왔습니다.');
 * showToast('error', '오류', '파일을 찾을 수 없습니다.', 3000);
 */
export function showToast(type, title, message, duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        logger.warn('Toast container not found');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        [ToastType.SUCCESS]: '✅',
        [ToastType.ERROR]: '❌',
        [ToastType.WARNING]: '⚠️',
        [ToastType.INFO]: 'ℹ️'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons[ToastType.INFO]}</div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" aria-label="Close">×</button>
    `;

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });

    container.appendChild(toast);

    // Auto remove after duration
    const timeoutId = setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Store timeout ID for manual cancellation
    toast.dataset.timeoutId = timeoutId;

    return toast;
}

/**
 * Toast 제거
 * @param {HTMLElement} toast - Toast 요소
 * @private
 */
function removeToast(toast) {
    // Cancel auto-remove timeout
    if (toast.dataset.timeoutId) {
        clearTimeout(parseInt(toast.dataset.timeoutId));
    }

    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
        toast.remove();
    }, 300);
}

/**
 * HTML 이스케이프 (XSS 방지)
 * @param {string} str - 문자열
 * @returns {string} 이스케이프된 문자열
 *
 * @example
 * escapeHtml('<script>alert("XSS")</script>');
 * // Returns: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * HTML 문자열 정화 (기본 XSS 방지)
 * 허용된 태그만 남기고 위험한 속성 제거
 *
 * @param {string} html - HTML 문자열
 * @param {Object} [options={}] - 옵션
 * @param {Array<string>} [options.allowedTags] - 허용할 태그 목록
 * @returns {string} 정화된 HTML
 *
 * @example
 * sanitizeHTML('<p onclick="alert(1)">Hello<script>alert(2)</script></p>');
 * // Returns: '<p>Hello</p>'
 */
export function sanitizeHTML(html, options = {}) {
    if (typeof html !== 'string') return '';

    const allowedTags = options.allowedTags || [
        'p', 'span', 'div', 'br', 'strong', 'em', 'u', 'b', 'i',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'a'  // 링크는 href 속성만 허용
    ];

    // 임시 DOM 생성
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 모든 요소 순회
    const walker = document.createTreeWalker(
        doc.body,
        NodeFilter.SHOW_ELEMENT,
        null
    );

    const elementsToRemove = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;

        // 허용되지 않은 태그는 제거
        if (!allowedTags.includes(node.tagName.toLowerCase())) {
            elementsToRemove.push(node);
            continue;
        }

        // 모든 속성 제거 (a 태그의 href만 예외)
        const attributes = Array.from(node.attributes);
        attributes.forEach(attr => {
            if (node.tagName.toLowerCase() === 'a' && attr.name === 'href') {
                // href는 javascript: 프로토콜 차단
                if (attr.value.toLowerCase().startsWith('javascript:')) {
                    node.removeAttribute(attr.name);
                }
            } else if (attr.name === 'class' || attr.name === 'style') {
                // class와 style은 허용 (CSS injection은 별도 검증 필요)
            } else {
                // 다른 모든 속성 제거 (onclick 등)
                node.removeAttribute(attr.name);
            }
        });
    }

    // 금지된 요소 제거
    elementsToRemove.forEach(el => {
        // 텍스트 내용은 보존
        const textContent = el.textContent;
        const textNode = document.createTextNode(textContent);
        el.parentNode.replaceChild(textNode, el);
    });

    return doc.body.innerHTML;
}

/**
 * 모든 Toast 닫기
 */
export function closeAllToasts() {
    const container = document.getElementById('toast-container');
    if (container) {
        const toasts = container.querySelectorAll('.toast');
        toasts.forEach(toast => removeToast(toast));
    }
}

/**
 * 로딩 오버레이 표시/숨김
 * @param {boolean} show - 표시 여부
 * @param {string} [message=''] - 로딩 메시지
 * 
 * @example
 * showLoading(true, '문서 로딩 중...');
 * showLoading(false);
 */
export function showLoading(show, message = '') {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        logger.warn('Loading overlay not found');
        return;
    }

    if (show) {
        overlay.classList.add('show');
        
        // Update message if provided
        if (message) {
            const messageEl = overlay.querySelector('.loading-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    } else {
        overlay.classList.remove('show');
    }
}

/**
 * 상태 텍스트 업데이트
 * @param {string} text - 상태 텍스트
 * 
 * @example
 * updateStatus('준비됨');
 * updateStatus('문서 로딩 중...');
 */
export function updateStatus(text) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
        statusEl.textContent = text;
    }
}

/**
 * 진행률 표시
 * @param {number} percent - 진행률 (0-100)
 * @param {string} [message=''] - 진행 메시지
 * 
 * @example
 * showProgress(50, '파싱 중...');
 * showProgress(100, '완료');
 */
export function showProgress(percent, message = '') {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }

    if (progressText && message) {
        progressText.textContent = message;
    }
}

/**
 * 진행률 숨기기
 */
export function hideProgress() {
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

/**
 * 확인 다이얼로그
 * @param {string} message - 메시지
 * @param {string} [title='확인'] - 제목
 * @returns {Promise<boolean>} 사용자 응답 (true: 확인, false: 취소)
 * 
 * @example
 * const confirmed = await showConfirm('파일을 삭제하시겠습니까?');
 * if (confirmed) {
 *   // 삭제 처리
 * }
 */
export async function showConfirm(message, title = '확인') {
    // Custom dialog가 있으면 사용, 없으면 브라우저 기본 confirm
    const dialogEl = document.getElementById('confirm-dialog');
    
    if (dialogEl) {
        return new Promise((resolve) => {
            const titleEl = dialogEl.querySelector('.dialog-title');
            const messageEl = dialogEl.querySelector('.dialog-message');
            const confirmBtn = dialogEl.querySelector('.btn-confirm');
            const cancelBtn = dialogEl.querySelector('.btn-cancel');

            if (titleEl) {
                titleEl.textContent = title;
            }
            if (messageEl) {
                messageEl.textContent = message;
            }

            dialogEl.style.display = 'flex';

            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const cleanup = () => {
                dialogEl.style.display = 'none';
                confirmBtn?.removeEventListener('click', handleConfirm);
                cancelBtn?.removeEventListener('click', handleCancel);
            };

            confirmBtn?.addEventListener('click', handleConfirm);
            cancelBtn?.addEventListener('click', handleCancel);
        });
    } else {
        // Fallback to browser confirm
        return Promise.resolve(confirm(`${title}\n\n${message}`));
    }
}

/**
 * 알림 다이얼로그
 * @param {string} message - 메시지
 * @param {string} [title='알림'] - 제목
 * @returns {Promise<void>}
 * 
 * @example
 * await showAlert('저장이 완료되었습니다.');
 */
export async function showAlert(message, title = '알림') {
    const dialogEl = document.getElementById('alert-dialog');
    
    if (dialogEl) {
        return new Promise((resolve) => {
            const titleEl = dialogEl.querySelector('.dialog-title');
            const messageEl = dialogEl.querySelector('.dialog-message');
            const okBtn = dialogEl.querySelector('.btn-ok');

            if (titleEl) {
                titleEl.textContent = title;
            }
            if (messageEl) {
                messageEl.textContent = message;
            }

            dialogEl.style.display = 'flex';

            const handleOk = () => {
                dialogEl.style.display = 'none';
                okBtn?.removeEventListener('click', handleOk);
                resolve();
            };

            okBtn?.addEventListener('click', handleOk);
        });
    } else {
        // Fallback to browser alert
        alert(`${title}\n\n${message}`);
        return Promise.resolve();
    }
}

/**
 * 입력 다이얼로그 (prompt 대체)
 * @param {string} message - 메시지
 * @param {string} [title='입력'] - 제목
 * @param {string} [defaultValue=''] - 기본값
 * @returns {Promise<string|null>} 입력값 (취소시 null)
 * 
 * @example
 * const name = await showPrompt('이름을 입력하세요:', '사용자 정보');
 */
export async function showPrompt(message, title = '입력', defaultValue = '') {
    const dialogEl = document.getElementById('prompt-dialog');
    
    if (dialogEl) {
        return new Promise((resolve) => {
            const titleEl = dialogEl.querySelector('.dialog-title');
            const messageEl = dialogEl.querySelector('.dialog-message');
            const inputEl = dialogEl.querySelector('.dialog-input');
            const confirmBtn = dialogEl.querySelector('.btn-confirm');
            const cancelBtn = dialogEl.querySelector('.btn-cancel');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;
            if (inputEl) {
                inputEl.value = defaultValue;
                setTimeout(() => inputEl.focus(), 100);
            }

            dialogEl.style.display = 'flex';

            const handleConfirm = () => {
                cleanup();
                resolve(inputEl ? inputEl.value : null);
            };

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            const handleKeyDown = (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            const cleanup = () => {
                dialogEl.style.display = 'none';
                confirmBtn?.removeEventListener('click', handleConfirm);
                cancelBtn?.removeEventListener('click', handleCancel);
                inputEl?.removeEventListener('keydown', handleKeyDown);
            };

            confirmBtn?.addEventListener('click', handleConfirm);
            cancelBtn?.addEventListener('click', handleCancel);
            inputEl?.addEventListener('keydown', handleKeyDown);
        });
    } else {
        // Fallback to browser prompt
        return Promise.resolve(prompt(`${title}\n\n${message}`, defaultValue));
    }
}

/**
 * 선택 다이얼로그 (여러 옵션 중 선택)
 * @param {string} message - 메시지
 * @param {Array<{label: string, value: any, description?: string}>} options - 선택지
 * @param {string} [title='선택'] - 제목
 * @returns {Promise<any|null>} 선택된 값 (취소시 null)
 * 
 * @example
 * const style = await showSelect('스타일을 선택하세요:', [
 *   { label: '기본 스타일', value: 'default', description: '깔끔한 스타일' },
 *   { label: '전문가 스타일', value: 'professional', description: '나눔고딕, 큰 글씨' }
 * ]);
 */
export async function showSelect(message, options, title = '선택') {
    const dialogEl = document.getElementById('select-dialog');
    
    if (dialogEl) {
        return new Promise((resolve) => {
            const titleEl = dialogEl.querySelector('.dialog-title');
            const messageEl = dialogEl.querySelector('.dialog-message');
            const optionsEl = dialogEl.querySelector('.dialog-options');
            const cancelBtn = dialogEl.querySelector('.btn-cancel');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;
            
            // 옵션 버튼 생성
            if (optionsEl) {
                optionsEl.innerHTML = '';
                options.forEach(option => {
                    const btn = document.createElement('button');
                    btn.className = 'dialog-option-btn';
                    
                    const labelDiv = document.createElement('div');
                    labelDiv.style.fontWeight = '600';
                    labelDiv.style.marginBottom = option.description ? '4px' : '0';
                    labelDiv.textContent = option.label;
                    btn.appendChild(labelDiv);
                    
                    if (option.description) {
                        const descDiv = document.createElement('div');
                        descDiv.style.fontSize = '13px';
                        descDiv.style.color = '#666';
                        descDiv.style.fontWeight = '400';
                        descDiv.textContent = option.description;
                        btn.appendChild(descDiv);
                    }
                    
                    btn.onclick = () => {
                        cleanup();
                        resolve(option.value);
                    };
                    optionsEl.appendChild(btn);
                });
            }

            dialogEl.style.display = 'flex';

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };
            
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            const cleanup = () => {
                dialogEl.style.display = 'none';
                if (optionsEl) optionsEl.innerHTML = '';
                cancelBtn?.removeEventListener('click', handleCancel);
                document.removeEventListener('keydown', handleEscape);
            };

            cancelBtn?.addEventListener('click', handleCancel);
            document.addEventListener('keydown', handleEscape);
        });
    } else {
        // Fallback
        const labels = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
        const choice = prompt(`${title}\n\n${message}\n\n${labels}\n\n번호를 입력하세요:`);
        if (choice) {
            const index = parseInt(choice) - 1;
            return options[index]?.value || null;
        }
        return null;
    }
}

/**
 * 요소 표시/숨김 토글
 * @param {string|HTMLElement} element - 요소 ID 또는 요소
 * @param {boolean} [show] - 표시 여부 (생략시 토글)
 * 
 * @example
 * toggleElement('sidebar'); // 토글
 * toggleElement('sidebar', true); // 표시
 * toggleElement(document.getElementById('sidebar'), false); // 숨김
 */
export function toggleElement(element, show) {
    const el = typeof element === 'string' 
        ? document.getElementById(element) 
        : element;

    if (!el) {
        return;
    }

    if (show === undefined) {
        el.style.display = el.style.display === 'none' ? '' : 'none';
    } else {
        el.style.display = show ? '' : 'none';
    }
}

/**
 * 요소에 클래스 토글
 * @param {string|HTMLElement} element - 요소 ID 또는 요소
 * @param {string} className - 클래스명
 * @param {boolean} [force] - 강제 추가/제거
 * 
 * @example
 * toggleClass('sidebar', 'active'); // 토글
 * toggleClass('sidebar', 'active', true); // 추가
 */
export function toggleClass(element, className, force) {
    const el = typeof element === 'string' 
        ? document.getElementById(element) 
        : element;

    if (!el) {
        return;
    }

    el.classList.toggle(className, force);
}

/**
 * 스크롤을 특정 요소로 이동
 * @param {string|HTMLElement} element - 요소 ID 또는 요소
 * @param {Object} [options] - 스크롤 옵션
 * @param {string} [options.behavior='smooth'] - 스크롤 동작
 * @param {string} [options.block='start'] - 수직 정렬
 * 
 * @example
 * scrollToElement('page-5');
 * scrollToElement(document.getElementById('page-5'), { behavior: 'instant' });
 */
export function scrollToElement(element, options = {}) {
    const el = typeof element === 'string' 
        ? document.getElementById(element) 
        : element;

    if (!el) {
        return;
    }

    el.scrollIntoView({
        behavior: options.behavior || 'smooth',
        block: options.block || 'start',
        ...options
    });
}

/**
 * 디바운스 함수
 * @param {Function} func - 실행할 함수
 * @param {number} wait - 대기 시간 (ms)
 * @returns {Function} 디바운스된 함수
 * 
 * @example
 * const debouncedSearch = debounce((query) => {
 *   console.log('Searching:', query);
 * }, 300);
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 쓰로틀 함수
 * @param {Function} func - 실행할 함수
 * @param {number} limit - 제한 시간 (ms)
 * @returns {Function} 쓰로틀된 함수
 * 
 * @example
 * const throttledScroll = throttle(() => {
 *   console.log('Scrolling...');
 * }, 100);
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// Default export
export default {
    ToastType,
    showToast,
    closeAllToasts,
    showLoading,
    updateStatus,
    showProgress,
    hideProgress,
    showConfirm,
    showAlert,
    showPrompt,     // 🆕 추가
    showSelect,     // 🆕 추가
    toggleElement,
    toggleClass,
    scrollToElement,
    debounce,
    throttle
};

