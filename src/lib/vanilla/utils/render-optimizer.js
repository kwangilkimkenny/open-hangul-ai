/**
 * Render Optimizer
 * 렌더링 최적화 유틸리티
 * 
 * @module utils/render-optimizer
 */

/**
 * DocumentFragment를 사용한 배치 DOM 추가
 * @param {HTMLElement} container
 * @param {Array<HTMLElement>} elements
 */
export function batchAppend(container, elements) {
    const fragment = document.createDocumentFragment();
    elements.forEach(el => fragment.appendChild(el));
    container.appendChild(fragment);
}

/**
 * RequestAnimationFrame을 사용한 최적화된 렌더링
 * @param {Function} renderFn
 * @returns {Promise<void>}
 */
export function renderAsync(renderFn) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            renderFn();
            resolve();
        });
    });
}

/**
 * 청크 단위 렌더링 (대량 요소)
 * @param {Array} items
 * @param {Function} renderFn
 * @param {number} chunkSize
 * @returns {Promise<void>}
 */
export async function renderInChunks(items, renderFn, chunkSize = 50) {
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                chunk.forEach(renderFn);
                resolve();
            });
        });
    }
}

/**
 * Layout thrashing 방지 (읽기/쓰기 분리)
 * @param {Array<Function>} readOps - 읽기 작업
 * @param {Array<Function>} writeOps - 쓰기 작업
 */
export function batchReadWrite(readOps, writeOps) {
    // 먼저 모든 읽기
    const readResults = readOps.map(op => op());
    
    // 그 다음 모든 쓰기
    requestAnimationFrame(() => {
        writeOps.forEach((op, index) => op(readResults[index]));
    });
}

/**
 * CSS containment 적용
 * @param {HTMLElement} element
 */
export function applyContainment(element) {
    element.style.contain = 'layout style paint';
}

/**
 * GPU 가속 활성화
 * @param {HTMLElement} element
 */
export function enableGPUAcceleration(element) {
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'transform';
}

/**
 * 메모리 효율적인 이벤트 위임
 * @param {HTMLElement} container
 * @param {string} selector
 * @param {string} eventType
 * @param {Function} handler
 */
export function delegateEvent(container, selector, eventType, handler) {
    container.addEventListener(eventType, (e) => {
        const target = e.target.closest(selector);
        if (target) {
            handler.call(target, e);
        }
    });
}

export default {
    batchAppend,
    renderAsync,
    renderInChunks,
    batchReadWrite,
    applyContainment,
    enableGPUAcceleration,
    delegateEvent
};

