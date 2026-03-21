/**
 * Image Renderer
 * HWPX 이미지를 HTML 요소로 렌더링
 *
 * @module renderers/image
 * @version 2.1.0
 *
 * Features:
 * - IntersectionObserver-based lazy loading with placeholder
 * - Canvas-based image optimization for large images (>1920px width)
 * - Resized image caching to avoid reprocessing
 * - Graceful fallback to loading="lazy" attribute
 */

import { getLogger } from '../utils/logger.js';
// Import other renderers for children
import { renderShape } from './shape.js';
import { renderContainer } from './container.js';

const logger = getLogger('ImageRenderer');

// ============================================================
// Image optimization constants
// ============================================================
const MAX_OPTIMIZED_WIDTH = 1920;
const OPTIMIZATION_QUALITY = 0.85;

// ============================================================
// Resized image cache (src -> optimized blob URL)
// ============================================================
const resizedImageCache = new Map();

// ============================================================
// Shared IntersectionObserver (one observer for all images)
// ============================================================
let lazyObserver = null;

/**
 * Get or create the shared IntersectionObserver for lazy loading.
 * Images that enter the viewport (with a 200px root margin) are loaded.
 * @returns {IntersectionObserver|null} The observer, or null if unsupported.
 */
function getLazyObserver() {
    if (lazyObserver) {
        return lazyObserver;
    }

    if (typeof IntersectionObserver === 'undefined') {
        logger.warn('[Image Renderer] IntersectionObserver not supported, falling back to eager loading');
        return null;
    }

    lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const wrapper = entry.target;
                const img = wrapper.querySelector('img[data-src]');
                if (img) {
                    loadImage(img);
                }
                lazyObserver.unobserve(wrapper);
            }
        });
    }, {
        rootMargin: '200px 0px', // Start loading 200px before entering viewport
        threshold: 0.01
    });

    return lazyObserver;
}

/**
 * Load an image by moving data-src to src, with optional optimization.
 * @param {HTMLImageElement} img - The image element with a data-src attribute.
 */
function loadImage(img) {
    const src = img.getAttribute('data-src');
    if (!src) return;

    img.removeAttribute('data-src');

    // Show loading state
    const wrapper = img.closest('.hwp-image-wrapper');
    if (wrapper) {
        wrapper.classList.remove('hwp-lazy-placeholder');
        wrapper.classList.add('hwp-lazy-loading');
    }

    // Check cache first
    const cached = resizedImageCache.get(src);
    if (cached) {
        img.src = cached;
        logger.debug('[Image Renderer] Using cached optimized image');
        return;
    }

    img.src = src;

    // After load, check if optimization is needed
    img.addEventListener('load', function onLoad() {
        img.removeEventListener('load', onLoad);
        if (img.naturalWidth > MAX_OPTIMIZED_WIDTH) {
            optimizeImage(img, src);
        }
    }, { once: true });
}

/**
 * Optimize a loaded image by scaling it down via canvas.
 * The result is cached so the same source is not reprocessed.
 * @param {HTMLImageElement} img - The already-loaded image element.
 * @param {string} originalSrc - The original source URL (cache key).
 */
function optimizeImage(img, originalSrc) {
    try {
        const ratio = MAX_OPTIMIZED_WIDTH / img.naturalWidth;
        const newWidth = MAX_OPTIMIZED_WIDTH;
        const newHeight = Math.round(img.naturalHeight * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            logger.warn('[Image Renderer] Canvas 2D context not available, skipping optimization');
            return;
        }

        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        canvas.toBlob((blob) => {
            if (!blob) return;

            const optimizedUrl = URL.createObjectURL(blob);
            resizedImageCache.set(originalSrc, optimizedUrl);
            img.src = optimizedUrl;

            logger.debug(
                `[Image Renderer] Optimized image: ${img.naturalWidth}x${img.naturalHeight} -> ${newWidth}x${newHeight}`
            );
        }, 'image/jpeg', OPTIMIZATION_QUALITY);
    } catch (err) {
        logger.warn('[Image Renderer] Image optimization failed:', err.message);
    }
}

/**
 * Apply lazy loading to an image element.
 * Uses IntersectionObserver if available, otherwise falls back to native lazy.
 * @param {HTMLImageElement} img - The image element.
 * @param {HTMLElement} wrapper - The wrapper element to observe.
 * @param {string} src - The image source URL.
 */
function applyLazyLoading(img, wrapper, src) {
    const observer = getLazyObserver();

    if (observer) {
        // Store the real src and show placeholder
        img.setAttribute('data-src', src);
        img.src = ''; // Don't load yet
        img.style.backgroundColor = '#f0f0f0';
        img.style.opacity = '0';
        wrapper.classList.add('hwp-lazy-placeholder');

        observer.observe(wrapper);
    } else {
        // Fallback: native lazy loading
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = src;
    }
}

/**
 * 이미지 렌더링
 * @param {Object} image - 이미지 객체
 * @param {string} image.url - 이미지 URL
 * @param {number} [image.width] - 너비
 * @param {number} [image.height] - 높이
 * @returns {HTMLDivElement} 렌더링된 이미지 래퍼
 */
export function renderImage(image) {
    const wrapper = document.createElement('div');
    wrapper.className = 'hwp-image-wrapper';
    wrapper.style.position = 'relative'; // Container for absolute-positioned children

    const img = document.createElement('img');
    img.className = 'hwp-image';
    img.alt = image.alt || '';
    img.decoding = 'async';

    const imgSrc = image.url || image.src;
    if (!imgSrc) {
        logger.error(`[Image Renderer] No src for image!`);
        return null;
    }

    // Fade-in transition on load
    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0';

    img.onload = () => {
        img.style.opacity = '1';
        img.style.backgroundColor = 'transparent';
        const w = img.closest('.hwp-image-wrapper');
        if (w) {
            w.classList.remove('hwp-lazy-loading');
        }
    };

    img.onerror = () => {
        img.style.backgroundColor = '#ffebee';
        img.style.opacity = '1';
        img.alt = '이미지 로드 실패';
        const w = img.closest('.hwp-image-wrapper');
        if (w) {
            w.classList.remove('hwp-lazy-loading', 'hwp-lazy-placeholder');
        }
    };

    // Apply lazy loading (IntersectionObserver or native fallback)
    applyLazyLoading(img, wrapper, imgSrc);

    // ✅ v2.2.7f: Set wrapper dimensions with content area constraint
    // If image is inside a container, use 100% to fit container
    // Otherwise use exact image size (but constrained to content area)
    if (image.width) {
        const widthValue = typeof image.width === 'number' ? image.width : parseFloat(image.width);
        const width = typeof image.width === 'number'
            ? `${image.width}px`
            : image.width;

        // ✅ v2.2.7f: 컨텐츠 영역 제한 (A4 페이지 794px - padding 114px = 680px)
        const MAX_CONTENT_WIDTH = 680; // A4 페이지 실제 컨텐츠 영역

        // Check if this is likely inside a container (has position data)
        if (image.position && (image.position.x !== undefined || image.position.y !== undefined)) {
            // Inside container - fill container
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
        } else {
            // Standalone image - use exact size but constrain to content area
            if (widthValue > MAX_CONTENT_WIDTH) {
                // ✅ 컨텐츠 영역 초과 시: 컨텐츠 영역에 맞추고 높이는 비율 유지
                wrapper.style.maxWidth = `${MAX_CONTENT_WIDTH}px`;
                wrapper.style.width = 'auto';
                // 높이는 비율 유지를 위해 설정하지 않음
            } else {
                // 컨텐츠 영역 이내: 원본 크기 사용
                wrapper.style.width = width;
                wrapper.style.maxWidth = `${MAX_CONTENT_WIDTH}px`; // ✅ 안전장치
                if (image.height) {
                    const height = typeof image.height === 'number'
                        ? `${image.height}px`
                        : image.height;
                    wrapper.style.height = height;
                }
            }
        }
    }

    // Positioning
    if (image.position) {
        if (image.position.treatAsChar) {
            wrapper.style.display = 'inline-block';
            wrapper.style.verticalAlign = 'middle';
        } else {
            // ✅ v2.2.9: IN_FRONT_OF_TEXT 등 절대 위치가 필요한 이미지
            wrapper.style.position = 'absolute';

            // ✅ horzOffset/vertOffset에서 파싱된 위치 적용
            if (image.position.x !== undefined && image.position.x !== null) {
                wrapper.style.left = `${image.position.x}px`;
                logger.debug(`[Image Renderer] Applied left: ${image.position.x}px`);
            } else {
                wrapper.style.left = '0';
            }
            if (image.position.y !== undefined && image.position.y !== null) {
                wrapper.style.top = `${image.position.y}px`;
                logger.debug(`[Image Renderer] Applied top: ${image.position.y}px`);
            } else {
                wrapper.style.top = '0';
            }

            // ✅ 절대 위치 이미지는 정확한 크기 필요
            if (image.width) {
                wrapper.style.width = typeof image.width === 'number' ? `${image.width}px` : image.width;
            }
            if (image.height) {
                wrapper.style.height = typeof image.height === 'number' ? `${image.height}px` : image.height;
            }
        }
    } else {
        // Default to absolute positioning within container
        wrapper.style.position = 'absolute';
        wrapper.style.left = '0';
        wrapper.style.top = '0';
    }


    // ✅ v2.2.7e: Image should fill its wrapper with proper constraints
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = image.height ? '100%' : 'auto'; // ✅ 높이 지정 없으면 비율 유지
    img.style.maxWidth = '100%'; // ✅ 안전장치
    // Use 'contain' to fit within container without cropping
    // Use 'cover' only if we want to fill and potentially crop
    img.style.objectFit = 'contain'; // Fit within wrapper, maintain aspect ratio

    wrapper.appendChild(img);

    // ✅ Render children (shapes/containers overlaid on the image)
    if (image.children && image.children.length > 0) {
        image.children.forEach((child, idx) => {
            let renderedChild;

            if (child.type === 'container') {
                renderedChild = renderContainer(child);
            } else if (child.type === 'shape') {
                renderedChild = renderShape(child);
            }

            if (renderedChild) {
                // ✅ Ensure children are positioned absolutely on top of the image
                renderedChild.style.position = renderedChild.style.position || 'absolute';
                renderedChild.style.zIndex = '10'; // Above the image
                wrapper.appendChild(renderedChild);
            }
        });
    }

    return wrapper;
}

/**
 * Apply lazy loading and optimization to an inline image element (used by paragraph.js).
 * This is a helper for images created outside of renderImage().
 * @param {HTMLImageElement} imgElem - The image element to enhance.
 * @param {string} src - The image source URL.
 * @param {HTMLElement} wrapperElem - The wrapper element for observation.
 */
export function applyImageOptimizations(imgElem, src, wrapperElem) {
    if (!src || !imgElem) return;

    imgElem.decoding = 'async';
    imgElem.style.transition = 'opacity 0.3s ease';
    imgElem.style.opacity = '0';

    imgElem.onload = () => {
        imgElem.style.opacity = '1';
        imgElem.style.backgroundColor = 'transparent';
        if (wrapperElem) {
            wrapperElem.classList.remove('hwp-lazy-loading');
        }
    };

    imgElem.onerror = () => {
        imgElem.style.backgroundColor = '#ffebee';
        imgElem.style.opacity = '1';
        imgElem.alt = '이미지 로드 실패';
        if (wrapperElem) {
            wrapperElem.classList.remove('hwp-lazy-loading', 'hwp-lazy-placeholder');
        }
    };

    applyLazyLoading(imgElem, wrapperElem, src);
}

/**
 * Clear the resized image cache and revoke blob URLs.
 * Useful when the viewer is destroyed or a new document is loaded.
 */
export function clearImageCache() {
    resizedImageCache.forEach((blobUrl) => {
        try {
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            // ignore
        }
    });
    resizedImageCache.clear();
    logger.debug('[Image Renderer] Image cache cleared');
}

export default { renderImage, applyImageOptimizations, clearImageCache };
