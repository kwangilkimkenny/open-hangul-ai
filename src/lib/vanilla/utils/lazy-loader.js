/**
 * Lazy Loader
 * 이미지 및 리소스 지연 로딩
 * 
 * @module utils/lazy-loader
 */

import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * Lazy Image Loader 클래스
 */
export class LazyImageLoader {
    constructor(options = {}) {
        this.rootMargin = options.rootMargin || '200px';
        this.threshold = options.threshold || 0.01;
        this.placeholder = options.placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E';

        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                rootMargin: this.rootMargin,
                threshold: this.threshold
            }
        );

        this.loadedImages = new Set();
    }

    /**
     * 이미지 요소 observe
     * @param {HTMLImageElement} img
     */
    observe(img) {
        if (!img.dataset.src && !img.dataset.lazySrc) {
            return; // lazy src 없음
        }

        // Placeholder 설정
        if (!img.src || img.src === '') {
            img.src = this.placeholder;
        }

        img.classList.add('lazy-loading');
        this.observer.observe(img);
    }

    /**
     * Intersection 핸들러
     * @private
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img);
                this.observer.unobserve(img);
            }
        });
    }

    /**
     * 이미지 로드
     * @param {HTMLImageElement} img
     * @private
     */
    loadImage(img) {
        const src = img.dataset.src || img.dataset.lazySrc;
        if (!src || this.loadedImages.has(img)) {
            return;
        }

        logger.debug(`Lazy loading image: ${src}`);

        const tempImage = new Image();
        
        tempImage.onload = () => {
            img.src = src;
            img.classList.remove('lazy-loading');
            img.classList.add('lazy-loaded');
            this.loadedImages.add(img);
            logger.debug(`Image loaded: ${src}`);
        };

        tempImage.onerror = () => {
            img.classList.remove('lazy-loading');
            img.classList.add('lazy-error');
            logger.error(`Failed to load image: ${src}`);
        };

        tempImage.src = src;
    }

    /**
     * 모든 이미지 즉시 로드 (preload)
     * @param {Array<HTMLImageElement>} images
     */
    preloadAll(images) {
        images.forEach(img => {
            this.observer.unobserve(img);
            this.loadImage(img);
        });
    }

    /**
     * 정리
     */
    destroy() {
        this.observer.disconnect();
        this.loadedImages.clear();
    }
}

/**
 * 전역 LazyImageLoader 인스턴스
 */
let lazyLoaderInstance = null;

/**
 * LazyImageLoader 인스턴스 가져오기
 */
export function getLazyLoader() {
    if (!lazyLoaderInstance) {
        lazyLoaderInstance = new LazyImageLoader();
    }
    return lazyLoaderInstance;
}

export default LazyImageLoader;

