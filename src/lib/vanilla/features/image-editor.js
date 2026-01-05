/**
 * Image Editor
 * 이미지 삽입/편집/삭제 기능
 *
 * @module features/image-editor
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('ImageEditor');

/**
 * 이미지 편집기 클래스
 */
export class ImageEditor {
    constructor(viewer) {
        this.viewer = viewer;
        logger.info('🖼️ ImageEditor initialized');
    }

    /**
     * 이미지가 속한 요소 찾기
     * @param {HTMLElement} imageElement - IMG 또는 이미지 래퍼 요소
     * @returns {Object|null} { imageElement, imageData, sectionIndex, elementIndex }
     */
    findImageData(imageElement) {
        // 1. DOM에서 이미지 래퍼 찾기
        let wrapper = imageElement;
        if (imageElement.tagName === 'IMG') {
            wrapper = imageElement.closest('.hwp-image-wrapper');
        }
        if (!wrapper) {
            logger.error('Image wrapper not found');
            return null;
        }

        // 2. 문서 데이터에서 해당 이미지 찾기
        const document = this.viewer.getDocument();
        if (!document || !document.sections) {
            logger.error('Document not loaded');
            return null;
        }

        // 이미지 요소의 인덱스를 사용하여 데이터 찾기
        const allImages = this.viewer.container.querySelectorAll('.hwp-image-wrapper');
        const imageIndex = Array.from(allImages).indexOf(wrapper);

        let currentImageIndex = 0;
        for (let sectionIndex = 0; sectionIndex < document.sections.length; sectionIndex++) {
            const section = document.sections[sectionIndex];
            for (let elementIndex = 0; elementIndex < section.elements.length; elementIndex++) {
                const element = section.elements[elementIndex];
                if (element.type === 'image') {
                    if (currentImageIndex === imageIndex) {
                        return {
                            imageElement: wrapper,
                            imageData: element,
                            sectionIndex,
                            elementIndex
                        };
                    }
                    currentImageIndex++;
                }
            }
        }

        logger.error('Image data not found in document');
        return null;
    }

    /**
     * 이미지 삽입
     * @param {string} imageUrl - 이미지 URL (data URL 또는 http URL)
     * @param {Object} options - 옵션 { width, height, position }
     * @returns {boolean} 성공 여부
     */
    async insertImage(imageUrl, options = {}) {
        logger.info('➕ Inserting image...');

        const document = this.viewer.getDocument();
        if (!document || !document.sections || document.sections.length === 0) {
            logger.error('Document not loaded');
            return false;
        }

        // 이미지 데이터 생성
        const imageData = this.createImageData(imageUrl, options);

        // 첫 번째 섹션의 끝에 추가 (간단한 구현)
        const firstSection = document.sections[0];
        if (!firstSection.elements) {
            firstSection.elements = [];
        }

        // 이미지를 elements 배열에 추가
        firstSection.elements.push(imageData);

        logger.info('✅ Image inserted');

        // 재렌더링
        await this.viewer.updateDocument(document);

        return true;
    }

    /**
     * 이미지 데이터 생성
     * @param {string} imageUrl - 이미지 URL
     * @param {Object} options - 옵션
     * @returns {Object} 이미지 데이터
     */
    createImageData(imageUrl, options = {}) {
        return {
            type: 'image',
            url: imageUrl,
            width: options.width || 300,
            height: options.height || 200,
            alt: options.alt || 'Inserted image',
            position: options.position || {
                treatAsChar: true
            }
        };
    }

    /**
     * 이미지 삭제
     * @param {HTMLElement} imageElement - 이미지 요소
     * @returns {boolean} 성공 여부
     */
    async deleteImage(imageElement) {
        logger.info('🗑️ Deleting image...');

        const imageInfo = this.findImageData(imageElement);
        if (!imageInfo) return false;

        const { sectionIndex, elementIndex } = imageInfo;
        const document = this.viewer.getDocument();

        // 이미지 삭제
        document.sections[sectionIndex].elements.splice(elementIndex, 1);

        logger.info(`✅ Image deleted at section ${sectionIndex}, element ${elementIndex}`);

        // 재렌더링
        await this.viewer.updateDocument(document);

        return true;
    }

    /**
     * 이미지 크기 조정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} width - 새 너비
     * @param {number} height - 새 높이
     * @returns {boolean} 성공 여부
     */
    async resizeImage(imageElement, width, height) {
        logger.info(`📏 Resizing image: ${width}x${height}`);

        const imageInfo = this.findImageData(imageElement);
        if (!imageInfo) return false;

        const { imageData } = imageInfo;

        // 크기 업데이트
        if (width) {
            imageData.width = width;
        }
        if (height) {
            imageData.height = height;
        }

        logger.info(`✅ Image resized to ${width}x${height}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 이미지 정렬 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} alignment - 정렬 ('left', 'center', 'right', 'inline')
     * @returns {boolean} 성공 여부
     */
    async setImageAlignment(imageElement, alignment) {
        logger.info(`↔️ Setting image alignment: ${alignment}`);

        const imageInfo = this.findImageData(imageElement);
        if (!imageInfo) return false;

        const { imageData } = imageInfo;

        // 정렬 설정
        if (!imageData.position) {
            imageData.position = {};
        }

        switch (alignment) {
            case 'inline':
                imageData.position.treatAsChar = true;
                imageData.position.x = undefined;
                imageData.position.y = undefined;
                break;
            case 'left':
                imageData.position.treatAsChar = false;
                imageData.position.x = 0;
                imageData.position.y = 0;
                break;
            case 'center':
                imageData.position.treatAsChar = false;
                // Center calculation would need page width
                imageData.position.x = 200; // Approximate center
                imageData.position.y = 0;
                break;
            case 'right':
                imageData.position.treatAsChar = false;
                imageData.position.x = 400; // Approximate right
                imageData.position.y = 0;
                break;
        }

        logger.info(`✅ Image alignment set to ${alignment}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 이미지 위치 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @returns {boolean} 성공 여부
     */
    async setImagePosition(imageElement, x, y) {
        logger.info(`📍 Setting image position: (${x}, ${y})`);

        const imageInfo = this.findImageData(imageElement);
        if (!imageInfo) return false;

        const { imageData } = imageInfo;

        // 위치 설정
        if (!imageData.position) {
            imageData.position = {};
        }

        imageData.position.treatAsChar = false;
        imageData.position.x = x;
        imageData.position.y = y;

        logger.info(`✅ Image position set to (${x}, ${y})`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 이미지 Alt 텍스트 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} altText - Alt 텍스트
     * @returns {boolean} 성공 여부
     */
    async setImageAltText(imageElement, altText) {
        logger.info(`📝 Setting image alt text: ${altText}`);

        const imageInfo = this.findImageData(imageElement);
        if (!imageInfo) return false;

        const { imageData } = imageInfo;

        // Alt 텍스트 설정
        imageData.alt = altText;

        logger.info(`✅ Image alt text set`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 이미지 회전
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} degrees - 회전 각도 (0, 90, 180, 270)
     * @returns {boolean} 성공 여부
     */
    async rotateImage(imageElement, degrees) {
        logger.info(`🔄 Rotating image: ${degrees}°`);

        const imageInfo = this.findImageData(imageElement);
        if (!imageInfo) return false;

        const { imageData } = imageInfo;

        // 회전 설정
        if (!imageData.style) {
            imageData.style = {};
        }

        imageData.style.transform = `rotate(${degrees}deg)`;

        logger.info(`✅ Image rotated to ${degrees}°`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 이미지 테두리 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} border - CSS 테두리 문자열 (예: "2px solid #000")
     * @returns {boolean} 성공 여부
     */
    async setImageBorder(imageElement, border) {
        logger.info(`🖼️ Setting image border: ${border}`);

        const imageInfo = this.findImageData(imageElement);
        if (!imageInfo) return false;

        const { imageData } = imageInfo;

        // 테두리 설정
        if (!imageData.style) {
            imageData.style = {};
        }

        imageData.style.border = border;

        logger.info(`✅ Image border set`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 이미지 불투명도 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} opacity - 불투명도 (0.0 ~ 1.0)
     * @returns {boolean} 성공 여부
     */
    async setImageOpacity(imageElement, opacity) {
        logger.info(`💫 Setting image opacity: ${opacity}`);

        const imageInfo = this.findImageData(imageElement);
        if (!imageInfo) return false;

        const { imageData } = imageInfo;

        // 불투명도 설정
        if (!imageData.style) {
            imageData.style = {};
        }

        imageData.style.opacity = opacity;

        logger.info(`✅ Image opacity set to ${opacity}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }
}

export default ImageEditor;
