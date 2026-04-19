/**
 * Image Commands Module
 * 이미지 관련 명령
 *
 * @module command/image-commands
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 이미지 명령 클래스
 */
export class ImageCommands {
    constructor(viewer) {
        this.viewer = viewer;
        this.historyManager = viewer.historyManager;
    }

    /**
     * Ensure ImageEditor is loaded
     * @returns {Promise<void>}
     * @private
     */
    async _ensureImageEditor() {
        if (!this.viewer.imageEditor) {
            logger.info('ImageEditor not loaded, loading now...');
            await this.viewer.loadImageEditor();
        }
    }

    /**
     * 이미지 삽입
     * @param {string} imageUrl - 이미지 URL
     * @param {Object} options - 옵션
     */
    async executeInsertImage(imageUrl, options = {}) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                imageEditor.insertImage(imageUrl, options);
            };

            const undo = () => {
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Insert Image');
            logger.debug('Image inserted', { imageUrl, options });

        } catch (error) {
            logger.error('Failed to insert image', error);
            throw error;
        }
    }

    /**
     * 이미지 삭제
     * @param {HTMLElement} imageElement - 이미지 요소
     */
    async executeDeleteImage(imageElement) {
        try {
            await this._executeImageCommand('deleteImage', imageElement, 'Delete Image');
            logger.debug('Image deleted', { imageElement });
        } catch (error) {
            logger.error('Failed to delete image', error);
            throw error;
        }
    }

    /**
     * 이미지 크기 조정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} width - 너비
     * @param {number} height - 높이
     */
    async executeResizeImage(imageElement, width, height) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                imageEditor.resizeImage(imageElement, width, height);
            };

            const undo = () => {
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, `Resize Image: ${width}x${height}`);
            logger.debug('Image resized', { imageElement, width, height });

        } catch (error) {
            logger.error('Failed to resize image', error);
            throw error;
        }
    }

    /**
     * 이미지 정렬 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} alignment - 정렬
     */
    async executeSetImageAlignment(imageElement, alignment) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                imageEditor.setImageAlignment(imageElement, alignment);
            };

            const undo = () => {
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, `Set Image Alignment: ${alignment}`);
            logger.debug('Image alignment set', { imageElement, alignment });

        } catch (error) {
            logger.error('Failed to set image alignment', error);
            throw error;
        }
    }

    /**
     * 이미지 위치 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    async executeSetImagePosition(imageElement, x, y) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                imageEditor.setImagePosition(imageElement, x, y);
            };

            const undo = () => {
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, `Set Image Position: (${x}, ${y})`);
            logger.debug('Image position set', { imageElement, x, y });

        } catch (error) {
            logger.error('Failed to set image position', error);
            throw error;
        }
    }

    /**
     * 이미지 Alt 텍스트 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} altText - Alt 텍스트
     */
    async executeSetImageAltText(imageElement, altText) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                imageEditor.setImageAltText(imageElement, altText);
            };

            const undo = () => {
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Set Image Alt Text');
            logger.debug('Image alt text set', { imageElement, altText });

        } catch (error) {
            logger.error('Failed to set image alt text', error);
            throw error;
        }
    }

    /**
     * 이미지 회전
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} degrees - 회전 각도
     */
    async executeRotateImage(imageElement, degrees) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                imageEditor.rotateImage(imageElement, degrees);
            };

            const undo = () => {
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, `Rotate Image: ${degrees}°`);
            logger.debug('Image rotated', { imageElement, degrees });

        } catch (error) {
            logger.error('Failed to rotate image', error);
            throw error;
        }
    }

    /**
     * 이미지 테두리 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} border - CSS 테두리 문자열
     */
    async executeSetImageBorder(imageElement, border) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                imageEditor.setImageBorder(imageElement, border);
            };

            const undo = () => {
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Set Image Border');
            logger.debug('Image border set', { imageElement, border });

        } catch (error) {
            logger.error('Failed to set image border', error);
            throw error;
        }
    }

    /**
     * 이미지 불투명도 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} opacity - 불투명도
     */
    async executeSetImageOpacity(imageElement, opacity) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                imageEditor.setImageOpacity(imageElement, opacity);
            };

            const undo = () => {
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, `Set Image Opacity: ${opacity}`);
            logger.debug('Image opacity set', { imageElement, opacity });

        } catch (error) {
            logger.error('Failed to set image opacity', error);
            throw error;
        }
    }

    /**
     * 이미지 명령 헬퍼
     * @private
     */
    async _executeImageCommand(commandName, imageElement, actionName) {
        try {
            // Lazy load ImageEditor if needed
            await this._ensureImageEditor();

            const imageEditor = this.viewer.imageEditor;
            if (!imageEditor) {
                logger.warn('ImageEditor not available');
                return;
            }

            // 현재 문서 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                // ImageEditor 메서드 호출
                imageEditor[commandName](imageElement);
            };

            const undo = () => {
                // 문서 복원
                this.viewer.updateDocument(oldDocument);
                return execute;
            };

            this.historyManager.execute(execute, undo, actionName);
            logger.debug(`Image command executed: ${commandName}`, { actionName });

        } catch (error) {
            logger.error(`Failed to execute image command: ${commandName}`, error);
            throw error;
        }
    }

    /**
     * 이미지가 선택되어 있는지 확인
     */
    hasSelectedImage() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let element = range.commonAncestorContainer;

        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }

        while (element && element !== document.body) {
            if (element.tagName === 'IMG' || element.classList.contains('hwp-image')) {
                return element;
            }
            element = element.parentElement;
        }

        return null;
    }

    /**
     * 현재 선택된 이미지 가져오기
     */
    getSelectedImage() {
        return this.hasSelectedImage();
    }

    /**
     * 이미지 요소인지 확인
     */
    isImageElement(element) {
        return element && (
            element.tagName === 'IMG' ||
            element.classList.contains('hwp-image')
        );
    }

    /**
     * 이미지 정보 가져오기
     */
    getImageInfo(imageElement) {
        if (!this.isImageElement(imageElement)) {
            return null;
        }

        return {
            src: imageElement.src,
            width: imageElement.width || imageElement.style.width,
            height: imageElement.height || imageElement.style.height,
            alt: imageElement.alt,
            opacity: imageElement.style.opacity || 1,
            border: imageElement.style.border,
            alignment: imageElement.style.textAlign || 'left',
            position: {
                x: imageElement.style.left || 0,
                y: imageElement.style.top || 0
            }
        };
    }
}

export default ImageCommands;