/**
 * Shape Editor
 * 도형 삽입/편집/삭제 기능
 *
 * @module features/shape-editor
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('ShapeEditor');

/**
 * 도형 편집기 클래스
 */
export class ShapeEditor {
    constructor(viewer) {
        this.viewer = viewer;
        logger.info('🔷 ShapeEditor initialized');
    }

    /**
     * 도형이 속한 요소 찾기
     * @param {HTMLElement} shapeElement - 도형 요소
     * @returns {Object|null} { shapeElement, shapeData, sectionIndex, elementIndex }
     */
    findShapeData(shapeElement) {
        // 1. DOM에서 도형 래퍼 찾기
        let wrapper = shapeElement;
        if (!wrapper.classList.contains('hwp-shape')) {
            wrapper = shapeElement.closest('.hwp-shape');
        }
        if (!wrapper) {
            logger.error('Shape wrapper not found');
            return null;
        }

        // 2. 문서 데이터에서 해당 도형 찾기
        const document = this.viewer.getDocument();
        if (!document || !document.sections) {
            logger.error('Document not loaded');
            return null;
        }

        // 도형 요소의 인덱스를 사용하여 데이터 찾기
        const allShapes = this.viewer.container.querySelectorAll('.hwp-shape');
        const shapeIndex = Array.from(allShapes).indexOf(wrapper);

        let currentShapeIndex = 0;
        for (let sectionIndex = 0; sectionIndex < document.sections.length; sectionIndex++) {
            const section = document.sections[sectionIndex];
            for (let elementIndex = 0; elementIndex < section.elements.length; elementIndex++) {
                const element = section.elements[elementIndex];
                if (element.type === 'shape') {
                    if (currentShapeIndex === shapeIndex) {
                        return {
                            shapeElement: wrapper,
                            shapeData: element,
                            sectionIndex,
                            elementIndex
                        };
                    }
                    currentShapeIndex++;
                }
            }
        }

        logger.error('Shape data not found in document');
        return null;
    }

    /**
     * 도형 삽입
     * @param {string} shapeType - 도형 타입 ('rectangle', 'ellipse', 'line', 'textbox')
     * @param {Object} options - 옵션 { width, height, x, y, fillColor, strokeColor, strokeWidth, text }
     * @returns {boolean} 성공 여부
     */
    async insertShape(shapeType, options = {}) {
        logger.info(`➕ Inserting shape: ${shapeType}...`);

        const document = this.viewer.getDocument();
        if (!document || !document.sections || document.sections.length === 0) {
            logger.error('Document not loaded');
            return false;
        }

        // 도형 데이터 생성
        const shapeData = this.createShapeData(shapeType, options);

        // 첫 번째 섹션의 끝에 추가
        const firstSection = document.sections[0];
        if (!firstSection.elements) {
            firstSection.elements = [];
        }

        // 도형을 elements 배열에 추가
        firstSection.elements.push(shapeData);

        logger.info(`✅ Shape inserted: ${shapeType}`);

        // 재렌더링
        await this.viewer.updateDocument(document);

        return true;
    }

    /**
     * 도형 데이터 생성
     * @param {string} shapeType - 도형 타입
     * @param {Object} options - 옵션
     * @returns {Object} 도형 데이터
     */
    createShapeData(shapeType, options = {}) {
        const baseShape = {
            type: 'shape',
            shapeType: shapeType,
            width: options.width || 200,
            height: options.height || 150,
            position: {
                treatAsChar: options.treatAsChar !== undefined ? options.treatAsChar : true,
                x: options.x || 0,
                y: options.y || 0
            }
        };

        // Fill color
        if (options.fillColor) {
            baseShape.fillColor = options.fillColor;
        }

        // Stroke
        if (options.strokeColor) {
            baseShape.strokeColor = options.strokeColor;
        }
        if (options.strokeWidth !== undefined) {
            baseShape.strokeWidth = options.strokeWidth;
        }

        // Border radius for rectangles
        if (shapeType === 'rectangle' && options.borderRadius !== undefined) {
            baseShape.borderRadius = options.borderRadius;
        }

        // Text for textbox
        if (shapeType === 'textbox' && options.text) {
            baseShape.drawText = {
                paragraphs: [
                    {
                        type: 'paragraph',
                        runs: [
                            {
                                text: options.text,
                                style: {
                                    fontSize: options.fontSize || '14pt'
                                }
                            }
                        ],
                        style: {
                            textAlign: options.textAlign || 'left'
                        }
                    }
                ],
                vertAlign: options.vertAlign || 'TOP',
                margin: {
                    top: 5,
                    right: 5,
                    bottom: 5,
                    left: 5
                }
            };
        }

        // Line-specific properties
        if (shapeType === 'line') {
            baseShape.x0 = options.x0 || 0;
            baseShape.y0 = options.y0 || 0;
            baseShape.x1 = options.x1 || 100;
            baseShape.y1 = options.y1 || 100;
        }

        return baseShape;
    }

    /**
     * 도형 삭제
     * @param {HTMLElement} shapeElement - 도형 요소
     * @returns {boolean} 성공 여부
     */
    async deleteShape(shapeElement) {
        logger.info('🗑️ Deleting shape...');

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { sectionIndex, elementIndex } = shapeInfo;
        const document = this.viewer.getDocument();

        // 도형 삭제
        document.sections[sectionIndex].elements.splice(elementIndex, 1);

        logger.info(`✅ Shape deleted at section ${sectionIndex}, element ${elementIndex}`);

        // 재렌더링
        await this.viewer.updateDocument(document);

        return true;
    }

    /**
     * 도형 크기 조정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} width - 새 너비
     * @param {number} height - 새 높이
     * @returns {boolean} 성공 여부
     */
    async resizeShape(shapeElement, width, height) {
        logger.info(`📏 Resizing shape: ${width}x${height}`);

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { shapeData } = shapeInfo;

        // 크기 업데이트
        if (width) {
            shapeData.width = width;
        }
        if (height) {
            shapeData.height = height;
        }

        logger.info(`✅ Shape resized to ${width}x${height}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 도형 위치 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @returns {boolean} 성공 여부
     */
    async setShapePosition(shapeElement, x, y) {
        logger.info(`📍 Setting shape position: (${x}, ${y})`);

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { shapeData } = shapeInfo;

        // 위치 설정
        if (!shapeData.position) {
            shapeData.position = {};
        }

        shapeData.position.treatAsChar = false;
        shapeData.position.x = x;
        shapeData.position.y = y;

        logger.info(`✅ Shape position set to (${x}, ${y})`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 도형 채우기 색상 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} color - 채우기 색상
     * @returns {boolean} 성공 여부
     */
    async setShapeFillColor(shapeElement, color) {
        logger.info(`🎨 Setting shape fill color: ${color}`);

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { shapeData } = shapeInfo;

        // 채우기 색상 설정
        shapeData.fillColor = color;

        logger.info(`✅ Shape fill color set: ${color}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 도형 테두리 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} color - 테두리 색상
     * @param {number} width - 테두리 두께
     * @returns {boolean} 성공 여부
     */
    async setShapeStroke(shapeElement, color, width) {
        logger.info(`🖼️ Setting shape stroke: ${color}, ${width}px`);

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { shapeData } = shapeInfo;

        // 테두리 설정
        if (color) {
            shapeData.strokeColor = color;
        }
        if (width !== undefined) {
            shapeData.strokeWidth = width;
        }

        logger.info(`✅ Shape stroke set`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 도형 회전
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} degrees - 회전 각도
     * @returns {boolean} 성공 여부
     */
    async rotateShape(shapeElement, degrees) {
        logger.info(`🔄 Rotating shape: ${degrees}°`);

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { shapeData } = shapeInfo;

        // 회전 설정
        if (!shapeData.style) {
            shapeData.style = {};
        }

        shapeData.style.transform = `rotate(${degrees}deg)`;

        logger.info(`✅ Shape rotated to ${degrees}°`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 도형 불투명도 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} opacity - 불투명도 (0.0 ~ 1.0)
     * @returns {boolean} 성공 여부
     */
    async setShapeOpacity(shapeElement, opacity) {
        logger.info(`💫 Setting shape opacity: ${opacity}`);

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { shapeData } = shapeInfo;

        // 불투명도 설정
        if (!shapeData.style) {
            shapeData.style = {};
        }

        shapeData.style.opacity = opacity;

        logger.info(`✅ Shape opacity set to ${opacity}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 도형 텍스트 설정 (textbox용)
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} text - 텍스트
     * @returns {boolean} 성공 여부
     */
    async setShapeText(shapeElement, text) {
        logger.info(`📝 Setting shape text: ${text}`);

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { shapeData } = shapeInfo;

        // 텍스트 설정
        if (!shapeData.drawText) {
            shapeData.drawText = {
                paragraphs: [],
                vertAlign: 'TOP',
                margin: { top: 5, right: 5, bottom: 5, left: 5 }
            };
        }

        // 첫 번째 단락 업데이트 또는 생성
        if (shapeData.drawText.paragraphs.length === 0) {
            shapeData.drawText.paragraphs.push({
                type: 'paragraph',
                runs: [],
                style: {}
            });
        }

        shapeData.drawText.paragraphs[0].runs = [
            {
                text: text,
                style: { fontSize: '14pt' }
            }
        ];

        logger.info(`✅ Shape text set`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }

    /**
     * 도형 테두리 둥글기 설정 (rectangle용)
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} radius - 둥글기 (0-100)
     * @returns {boolean} 성공 여부
     */
    async setShapeBorderRadius(shapeElement, radius) {
        logger.info(`⭕ Setting shape border radius: ${radius}`);

        const shapeInfo = this.findShapeData(shapeElement);
        if (!shapeInfo) return false;

        const { shapeData } = shapeInfo;

        // 테두리 둥글기 설정
        shapeData.borderRadius = radius;

        logger.info(`✅ Shape border radius set to ${radius}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());

        return true;
    }
}

export default ShapeEditor;
