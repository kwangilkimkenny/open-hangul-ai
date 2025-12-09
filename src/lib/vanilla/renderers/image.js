/**
 * Image Renderer
 * HWPX 이미지를 HTML 요소로 렌더링
 * 
 * @module renderers/image
 * @version 2.0.0
 */

// Import other renderers for children
import { renderShape } from './shape.js';
import { renderContainer } from './container.js';

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
    
    // ✅ 레이지 로딩 적용
    img.loading = 'lazy';
    img.decoding = 'async';
    
    const imgSrc = image.url || image.src;
    if (!imgSrc) {
        console.error(`[Image Renderer] No src for image!`);
        return null;
    }
    
    // ✅ Placeholder 표시 후 이미지 로드
    img.style.backgroundColor = '#f0f0f0';
    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0';
    
    img.onload = () => {
        img.style.opacity = '1';
        img.style.backgroundColor = 'transparent';
    };
    
    img.onerror = () => {
        img.style.backgroundColor = '#ffebee';
        img.alt = '이미지 로드 실패';
    };
    
    img.src = imgSrc;

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
            wrapper.style.position = 'absolute';
            if (image.position.x !== undefined && image.position.x !== null) {
                wrapper.style.left = `${image.position.x}px`;
            }
            if (image.position.y !== undefined && image.position.y !== null) {
                // ✅ Clamp negative y to 0 for images inside containers
                const yPos = image.position.y < 0 ? 0 : image.position.y;
                wrapper.style.top = `${yPos}px`;
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

export default { renderImage };

