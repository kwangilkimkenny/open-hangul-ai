/**
 * Container Renderer
 * HWPX 컨테이너를 HTML 요소로 렌더링
 * 
 * @module renderers/container
 * @version 2.0.0
 */

import { renderParagraph } from './paragraph.js';
import { renderImage } from './image.js';
import { renderShape } from './shape.js';
import { renderTable } from './table.js';

/**
 * 컨테이너 렌더링
 * @param {Object} container - 컨테이너 객체
 * @param {Array} container.elements - 요소 배열
 * @returns {HTMLDivElement} 렌더링된 컨테이너
 */
export function renderContainer(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'hwp-container';

    // ✅ Container는 기본적으로 relative positioning으로 자식 요소들의 기준점이 됨
    wrapper.style.position = 'relative';

    // Apply container size
    // ✅ Use container's own size (don't expand to children)
    // Children (especially images) should fit within the container
    const items = container.elements || container.children || [];
    
    if (container.width) {
        wrapper.style.width = typeof container.width === 'number' 
            ? `${container.width}px` 
            : container.width;
    }
    if (container.height) {
        wrapper.style.height = typeof container.height === 'number' 
            ? `${container.height}px` 
            : container.height;
    }

    // ✅ Container 자체의 positioning (treatAsChar or absolute)
    if (container.position) {
        if (container.position.treatAsChar) {
            // Inline with text
            wrapper.style.display = 'inline-block';
            wrapper.style.verticalAlign = 'middle';
        } else if (container.position.x !== undefined || container.position.y !== undefined) {
            // Absolute positioning
            wrapper.style.position = 'absolute';
            if (container.position.x !== undefined) {
                wrapper.style.left = `${container.position.x}px`;
            }
            if (container.position.y !== undefined) {
                wrapper.style.top = `${container.position.y}px`;
            }
        }
    }
    
    // ✅ Allow children to overflow for proper layering
    wrapper.style.overflow = 'visible';

    // Render elements (support both 'elements' and 'children' for backward compatibility)
    items.forEach((element, idx) => {
        let renderedElement;

        switch (element.type) {
        case 'paragraph':
            renderedElement = renderParagraph(element);
            break;
        case 'image':
            renderedElement = renderImage(element);
            break;
        case 'shape':
            renderedElement = renderShape(element);
            break;
        case 'table':
            renderedElement = renderTable(element);
            break;
        case 'container':
            renderedElement = renderContainer(element); // Recursive
            break;
        default:
            console.warn(`[Container] Unknown element type: ${element.type}`);
            return;
        }

        if (renderedElement) {
            // ✅ Set z-index for proper layering: images first (lower), then shapes/containers (higher)
            // Images should be behind, shapes and containers should be on top
            if (element.type === 'image') {
                renderedElement.style.zIndex = '1';
            } else if (element.type === 'container' || element.type === 'shape' || element.type === 'table') {
                renderedElement.style.zIndex = '10';
            }

            wrapper.appendChild(renderedElement);
        }
    });

    return wrapper;
}

export default { renderContainer };

