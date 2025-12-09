/**
 * Shape Renderer
 * HWPX 도형을 HTML 요소로 렌더링
 * 
 * @module renderers/shape
 * @version 2.0.0
 */

import { HWPXConstants } from '../core/constants.js';
import { renderParagraph } from './paragraph.js';

/**
 * 🆕 Line 렌더링 (SVG)
 * @param {Object} line - Line 객체
 * @returns {SVGElement} SVG line 요소
 */
function renderLine(line) {
    // SVG 컨테이너 생성
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'hwp-shape-line');
    
    // 좌표 추출
    const x0 = line.x0 || line.start?.x || 0;
    const y0 = line.y0 || line.start?.y || 0;
    const x1 = line.x1 || line.end?.x || 100;
    const y1 = line.y1 || line.end?.y || 0;
    
    // SVG 크기 계산
    const minX = Math.min(x0, x1);
    const minY = Math.min(y0, y1);
    const maxX = Math.max(x0, x1);
    const maxY = Math.max(y0, y1);
    const width = maxX - minX || 100;
    const height = maxY - minY || 10;
    
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.display = 'block';
    svg.style.overflow = 'visible';
    
    // 위치 설정
    if (line.position) {
        svg.style.position = 'absolute';
        if (line.position.x !== undefined) {
            svg.style.left = `${line.position.x}px`;
        }
        if (line.position.y !== undefined) {
            svg.style.top = `${line.position.y}px`;
        }
    }
    
    // Line 요소 생성
    const lineElem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lineElem.setAttribute('x1', x0 - minX);
    lineElem.setAttribute('y1', y0 - minY);
    lineElem.setAttribute('x2', x1 - minX);
    lineElem.setAttribute('y2', y1 - minY);
    
    // 스타일 적용
    const color = line.strokeColor || line.color || '#000000';
    const width_stroke = line.strokeWidth || line.width || 1;
    
    lineElem.setAttribute('stroke', color);
    lineElem.setAttribute('stroke-width', width_stroke);
    lineElem.setAttribute('stroke-linecap', 'round');
    
    // 투명도
    if (line.opacity !== undefined) {
        lineElem.setAttribute('opacity', line.opacity);
    }
    
    svg.appendChild(lineElem);
    
    return svg;
}

/**
 * 도형 렌더링
 * @param {Object} shape - 도형 객체
 * @param {Map} images - 이미지 맵 (선택적)
 * @returns {HTMLElement} 렌더링된 도형
 */
export function renderShape(shape, images = null) {
    // ✅ images가 Map이 아닐 경우 빈 Map으로 대체
    if (images && !(images instanceof Map)) {
        images = new Map();
    }
    
    const shapeType = shape.shapeType || shape.type || 'unknown';
    
    // 🆕 Line 처리 - SVG로 렌더링
    if (shapeType === 'line') {
        return renderLine(shape);
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = `hwp-shape hwp-shape-${shapeType}`;
    
    // ✅ v2.2.7g: 기본 text-align 제거 (paragraph 정렬 우선)
    wrapper.style.textAlign = 'initial';


    // ✅ v2.2.7h: Dimensions - 원본 크기 유지 (정렬을 위해)
    if (shape.width) {
        wrapper.style.width = typeof shape.width === 'number' 
            ? `${shape.width}px` 
            : shape.width;
        wrapper.style.boxSizing = 'border-box';
    }
    if (shape.height) {
        wrapper.style.height = typeof shape.height === 'number' 
            ? `${shape.height}px` 
            : shape.height;
    }

    // Positioning
    if (shape.position) {
        if (shape.position.treatAsChar || shape.treatAsChar) {
            // ✅ 인라인 Shape - 원본 크기 유지, 내용물 보이기
            wrapper.style.display = 'inline-block';
            wrapper.style.verticalAlign = 'middle';
            wrapper.style.overflow = 'visible'; // 이미지가 보이도록
        } else {
            // ✅ 절대 위치 Shape - 페이지 폭 제한
            wrapper.style.maxWidth = '100%';
            wrapper.style.setProperty('max-width', '100%', 'important');
            wrapper.style.overflow = 'hidden';
            wrapper.style.position = 'absolute';

            // ✅ FIX: Prevent abnormal position values (max 10000px)
            // Values like 33554432px are CSS overflow bugs
            const MAX_POSITION = 10000;

            if (shape.position.x !== undefined && shape.position.x !== null) {
                const x = typeof shape.position.x === 'number' ? shape.position.x : parseFloat(shape.position.x);
                if (x < MAX_POSITION && x > -MAX_POSITION) {
                    wrapper.style.left = `${x}px`;
                }
            }

            if (shape.position.y !== undefined && shape.position.y !== null) {
                let y = typeof shape.position.y === 'number' ? shape.position.y : parseFloat(shape.position.y);
                
                // ✅ Special adjustment for small number boxes (e.g. "1", "2", "3" in circles)
                // These need to be moved up slightly to align with image center
                const isSmallNumberBox = shape.width < 50 && shape.height < 50 && 
                    shape.drawText && shape.drawText.paragraphs && 
                    shape.drawText.paragraphs.length === 1 &&
                    shape.drawText.paragraphs[0].text && 
                    shape.drawText.paragraphs[0].text.trim().length <= 2;
                
                if (isSmallNumberBox) {
                    y = y - 7; // Move up 7px to center with image
                }
                
                if (y < MAX_POSITION && y > -MAX_POSITION) {
                    wrapper.style.top = `${y}px`;
                }
            }
        }
    }

    // Fill color - check multiple sources
    if (shape.fillColor || shape.style?.backgroundColor) {
        wrapper.style.backgroundColor = shape.fillColor || shape.style.backgroundColor;
        
        // ✅ Apply opacity if specified
        if (shape.style?.opacity !== undefined) {
            wrapper.style.opacity = shape.style.opacity;
        }
    }

    // ✅ Shape-specific styling
    if (shapeType === 'ellipse' || shapeType === 'circle') {
        // Make it circular
        wrapper.style.borderRadius = '50%';
    } else if (shapeType === 'rect' || shapeType === 'rectangle') {
        // Rectangle with slight radius for better appearance
        wrapper.style.borderRadius = '2px';
    }

    // Border (check both legacy and new style properties)
    // ✅ Only render border if BOTH color AND width are explicitly defined
    // This prevents unwanted default borders on shapes
    const borderColor = shape.strokeColor || shape.style?.borderColor;
    const borderWidth = shape.strokeWidth || shape.style?.borderWidth;
    const borderStyle = shape.style?.borderStyle || 'solid';

    if (borderColor && borderWidth) {
        const width = typeof borderWidth === 'string' ? borderWidth : `${borderWidth || 1}px`;
        wrapper.style.border = `${width} ${borderStyle} ${borderColor}`;
        // Don't override shape-specific border-radius
        if (!shapeType || shapeType === 'unknown') {
            if (HWPXConstants.SHAPE_BORDER_RADIUS) {
                wrapper.style.borderRadius = `${HWPXConstants.SHAPE_BORDER_RADIUS}px`;
            }
        }
    }

    // ✅ DrawText (text inside shape)
    if (shape.drawText && shape.drawText.paragraphs) {
        
        const textContainer = document.createElement('div');
        textContainer.className = 'hwp-shape-drawtext';
        textContainer.style.width = '100%';
        textContainer.style.height = '100%';
        textContainer.style.maxWidth = '100%'; // 🔧 Prevent overflow
        textContainer.style.boxSizing = 'border-box';
        textContainer.style.overflow = 'visible'; // ✅ 이미지가 보이도록 변경
        textContainer.style.display = 'flex';
        textContainer.style.flexDirection = 'column';
        
        // ✅ v2.2.7g: textAlign 초기화 (paragraph 정렬 우선)
        textContainer.style.textAlign = 'initial';
        textContainer.style.alignItems = 'stretch'; // flex item이 전체 폭 사용
        
        // ✅ Apply vertical alignment from drawText
        const vertAlign = shape.drawText.vertAlign || 'TOP';
        if (vertAlign === 'CENTER') {
            textContainer.style.justifyContent = 'center';
        } else if (vertAlign === 'BOTTOM') {
            textContainer.style.justifyContent = 'flex-end';
        } else {
            textContainer.style.justifyContent = 'flex-start';
        }
        
        // ✅ Apply textMargin (padding)
        // Note: For vertAlign=CENTER, we reduce top padding to move text up
        if (shape.drawText.textMargin) {
            const m = shape.drawText.textMargin;
            // Don't apply top padding when vertically centered - it pushes text down
            // if (m.top !== undefined) textContainer.style.paddingTop = `${m.top}px`;
            if (m.right !== undefined) textContainer.style.paddingRight = `${m.right}px`;
            if (m.bottom !== undefined) textContainer.style.paddingBottom = `${m.bottom}px`;
            if (m.left !== undefined) textContainer.style.paddingLeft = `${m.left}px`;
        }
        
        textContainer.style.boxSizing = 'border-box';

        shape.drawText.paragraphs.forEach((para, idx) => {
            // ✅ Mark paragraph as inside shape for special styling
            para._insideShape = true;
            
            const paraElem = renderParagraph(para);
            
            // ✅ v2.2.7g: Shape 안 paragraph 스타일 강화
            paraElem.style.lineHeight = '1.0';
            paraElem.style.margin = '0';
            paraElem.style.padding = '0';
            paraElem.style.boxSizing = 'border-box';
            paraElem.style.maxWidth = '100%'; // ✅ Shape 폭 제한
            paraElem.style.width = '100%'; // ✅ 전체 폭 사용
            
            // ✅ v2.2.7g: paragraph의 text-align을 강제로 우선 적용
            if (para.style?.textAlign) {
                paraElem.style.setProperty('text-align', para.style.textAlign, 'important');
            }
            
            textContainer.appendChild(paraElem);
        });

        wrapper.appendChild(textContainer);
    }

    return wrapper;
}

export default { renderShape };

