/**
 * Table Renderer
 * HWPX 테이블을 HTML 요소로 렌더링 (v2.0 Professional)
 * 
 * @module renderers/table
 * @version 2.0.0
 */

import { renderParagraph } from './paragraph.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('TableRenderer');

/**
 * 테이블 렌더링
 * @param {Object} table - 테이블 객체
 * @param {Array} table.rows - 행 배열
 * @param {Map} images - 이미지 맵 (배경 이미지용)
 * @returns {HTMLTableElement} 렌더링된 테이블
 */
export function renderTable(table, images) {
    logger.debug('🔷 Rendering table...');
    
    // ✅ images가 Map이 아닐 경우 빈 Map으로 대체
    if (!images || !(images instanceof Map)) {
        logger.warn('⚠️ Images is not a Map, using empty Map');
        images = new Map();
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'hwp-table-wrapper';
    wrapper.style.maxWidth = '100%'; // ✅ 페이지 폭 절대 초과 금지
    wrapper.style.overflowX = 'auto'; // ✅ 스크롤 가능하게 (이미지가 잘리지 않도록)

    const tableEl = document.createElement('table');
    tableEl.className = 'hwp-table';

    // ✅ 테이블 데이터 연결 (InlineEditor에서 사용)
    tableEl._tableData = table;
    
    // Apply table-level styles for maximum precision
    tableEl.style.borderCollapse = 'separate';
    tableEl.style.borderSpacing = '0';
    tableEl.style.tableLayout = 'fixed';
    tableEl.style.boxSizing = 'border-box';
    tableEl.style.position = 'relative';
    // 🔥 fontSize = '0' 제거 및 기본값 설정: AI 생성 텍스트가 보이지 않는 문제 해결 (v2.2.4)
    tableEl.style.fontSize = '12px'; // 최소 폰트 크기 명시적 설정

    // Apply table width
    if (table.style && table.style.width) {
        tableEl.style.width = '100%';
        tableEl.style.maxWidth = '100%'; // ✅ wrapper 크기에 맞춤
        logger.debug(`  Table width: ${table.style.width}`);
    } else {
        tableEl.style.width = '100%';
    }

    // Apply table height
    if (table.style && table.style.height) {
        tableEl.style.height = table.style.height;
        tableEl.style.maxHeight = table.style.height;
        logger.debug(`  Table height: ${table.style.height}`);
    }

    // Create colgroup for explicit column widths
    // Use percentage for better responsive behavior (like v1.0)
    if (table.colWidthsPercent && table.colWidthsPercent.length > 0) {
        const colgroup = document.createElement('colgroup');
        table.colWidthsPercent.forEach((widthPercent, colIndex) => {
            const col = document.createElement('col');
            col.style.width = widthPercent;
            colgroup.appendChild(col);
        });
        tableEl.appendChild(colgroup);
        logger.debug(`  Created colgroup with ${table.colWidthsPercent.length} columns (percentage)`);
    } else if (table.colWidths && table.colWidths.length > 0) {
        // Fallback to pixel widths
        const colgroup = document.createElement('colgroup');
        table.colWidths.forEach((width, colIndex) => {
            const col = document.createElement('col');
            col.style.width = width; // Already converted to px string
            colgroup.appendChild(col);
        });
        tableEl.appendChild(colgroup);
        logger.debug(`  Created colgroup with ${table.colWidths.length} columns (pixels)`);
    }

    // Render rows
    if (table.rows && table.rows.length > 0) {
        table.rows.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            tr.className = 'hwp-table-row';

            // Calculate row height from cells (maximum cell height with rowSpan=1)
            if (row.cells && row.cells.length > 0) {
                let maxHeight = 0;
                row.cells.forEach(cell => {
                    const cellRowSpan = cell.rowSpan || 1;
                    if (cellRowSpan === 1 && cell.style && cell.style.height) {
                        const heightPx = parseInt(cell.style.height);
                        if (heightPx > maxHeight) {
                            maxHeight = heightPx;
                        }
                    }
                });
                if (maxHeight > 0) {
                    tr.style.height = maxHeight + 'px';
                    tr.style.maxHeight = maxHeight + 'px';
                    tr.style.minHeight = maxHeight + 'px';
                }
            }

            // Render cells
            if (row.cells && row.cells.length > 0) {
                row.cells.forEach((cell, cellIndex) => {
                    const td = document.createElement('td');
                    td.className = 'hwp-table-cell';
                    td.setAttribute('lang', 'ko');

                    // Apply colspan/rowspan
                    if (cell.colSpan) {
                        td.colSpan = cell.colSpan;
                    }
                    if (cell.rowSpan) {
                        td.rowSpan = cell.rowSpan;
                    }

                    // Apply cell styles
                    if (cell.style) {
                        // Background (priority: image > gradient > solid color)
                        if (cell.style.backgroundImage && images) {
                            // 🆕 Image background
                            const binaryItemIDRef = cell.style.backgroundImage.binaryItemIDRef;
                            const mode = cell.style.backgroundImage.mode || 'TILE';
                            
                            // Get image by ID (stored as 'image1', 'image2', etc.)
                            const imageData = images.get(binaryItemIDRef);
                            
                            if (imageData && imageData.url) {
                                // Apply as background-image
                                const backgroundSize = mode === 'TOTAL' ? 'cover' : 
                                                      mode === 'TILE' ? 'auto' : 
                                                      mode === 'CENTER' ? 'contain' : '100% 100%';
                                const backgroundRepeat = mode === 'TILE' ? 'repeat' : 'no-repeat';
                                const backgroundPosition = mode === 'CENTER' ? 'center' : '0 0';
                                
                                td.style.backgroundImage = `url(${imageData.url})`;
                                td.style.backgroundSize = backgroundSize;
                                td.style.backgroundRepeat = backgroundRepeat;
                                td.style.backgroundPosition = backgroundPosition;
                                td.style.setProperty('background-image', `url(${imageData.url})`, 'important');
                                td.style.setProperty('background-size', backgroundSize, 'important');
                                
                                logger.debug(`  🖼️ Applied background image: ${binaryItemIDRef} (mode: ${mode})`);
                            }
                        } else if (cell.style.backgroundGradient) {
                            td.style.background = cell.style.backgroundGradient;
                            td.style.setProperty('background', cell.style.backgroundGradient, 'important');
                        } else if (cell.style.backgroundColor) {
                            td.style.backgroundColor = cell.style.backgroundColor;
                            td.style.setProperty('background-color', cell.style.backgroundColor, 'important');
                            
                            // Apply opacity if available
                            if (cell.style.opacity !== undefined && cell.style.opacity !== 1.0) {
                                td.style.opacity = cell.style.opacity;
                            }
                        }

                        // Pattern fill
                        if (cell.style.patternType && cell.style.patternForeground) {
                            const baseColor = cell.style.backgroundColor || '#ffffff';
                            const patternColor = cell.style.patternForeground;
                            td.style.backgroundColor = baseColor;
                            td.style.backgroundImage = `repeating-linear-gradient(45deg, ${patternColor}20, ${patternColor}20 2px, transparent 2px, transparent 10px)`;
                            td.style.setProperty('background-image', `repeating-linear-gradient(45deg, ${patternColor}20, ${patternColor}20 2px, transparent 2px, transparent 10px)`, 'important');
                        }

                        // ✅ v2.2.7g: 정교한 텍스트 정렬 (기본값 제거, 원본 유지)
                        // Text alignment - HWPX에서 명시된 경우에만 적용
                        if (cell.style.textAlign) {
                            td.style.textAlign = cell.style.textAlign;
                            td.style.setProperty('text-align', cell.style.textAlign, 'important');
                        }
                        // ❌ 기본값 제거: 원본 정렬 유지

                        // Vertical alignment - HWPX에서 명시된 경우에만 적용
                        if (cell.style.verticalAlign) {
                            td.style.verticalAlign = cell.style.verticalAlign;
                            td.style.setProperty('vertical-align', cell.style.verticalAlign, 'important');
                            if (cell.style.verticalAlign === 'middle') {
                                td.style.display = 'table-cell';
                            }
                        }
                        // ❌ 기본값 제거: 원본 정렬 유지

                        // Width (use percentage for precision)
                        if (cell.style.widthPercent) {
                            td.style.width = cell.style.widthPercent;
                        } else if (cell.style.width) {
                            td.style.width = cell.style.width;
                        }

                        // Word wrap
                        td.style.wordBreak = 'break-word';
                        td.style.wordWrap = 'break-word';

                        // Height (only for rowSpan=1 cells)
                        // ✅ AI 생성 내용 대응: 고정 높이 제거, 자동 확장
                        if (cell.style.height) {
                            const cellRowSpan = cell.rowSpan || 1;
                            if (cellRowSpan === 1) {
                                // td.style.height = cell.style.height; // ❌ 고정 높이 제거
                                // td.style.maxHeight = cell.style.height; // ❌ 최대 높이 제거
                                td.style.minHeight = cell.style.height; // ✅ 최소 높이만 유지
                                td.style.height = 'auto'; // ✅ 내용에 따라 자동 확장
                                td.style.boxSizing = 'border-box';
                            }
                        }

                        // Enhanced cell positioning
                        td.style.position = 'relative';
                        td.style.fontSize = '13.33px'; // Reset font size from table (default)
                        td.style.lineHeight = '1.1'; // ✅ 추가 압축: 1.15 → 1.1

                        // Individual borders (from borderFillDef)
                        // Only apply borders if explicitly defined in HWPX
                        if (cell.style.borderLeftDef) {
                            const borderCSS = cell.style.borderLeftDef.css;
                            td.style.borderLeft = borderCSS;
                            td.style.setProperty('border-left', borderCSS, 'important');
                        } else {
                            td.style.borderLeft = 'none';
                        }

                        if (cell.style.borderRightDef) {
                            const borderCSS = cell.style.borderRightDef.css;
                            td.style.borderRight = borderCSS;
                            td.style.setProperty('border-right', borderCSS, 'important');
                        } else {
                            td.style.borderRight = 'none';
                        }

                        if (cell.style.borderTopDef) {
                            const borderCSS = cell.style.borderTopDef.css;
                            td.style.borderTop = borderCSS;
                            td.style.setProperty('border-top', borderCSS, 'important');
                        } else {
                            td.style.borderTop = 'none';
                        }

                        if (cell.style.borderBottomDef) {
                            const borderCSS = cell.style.borderBottomDef.css;
                            td.style.borderBottom = borderCSS;
                            td.style.setProperty('border-bottom', borderCSS, 'important');
                        } else {
                            td.style.borderBottom = 'none';
                        }

                        // Cell padding (from cellMargin)
                        if (cell.style.padding) {
                            td.style.padding = cell.style.padding;
                        } else {
                            // Apply default padding if not specified
                            td.style.padding = '3px 5px';
                        }

                    // Diagonal lines (slash, backSlash)
                    // ✅ Only render if visible=true (prevent empty SVG creation)
                    if ((cell.style.slashDef && cell.style.slashDef.visible) || 
                        (cell.style.backSlashDef && cell.style.backSlashDef.visible)) {
                        renderDiagonalLines(td, cell.style);
                    }
                }

                // ✅ 셀 데이터 연결 (InlineEditor에서 사용)
                td._cellData = cell;

                // Render cell content with enhanced styling
                if (cell.elements && cell.elements.length > 0) {
                        cell.elements.forEach((element, elementIndex) => {
                            if (element.type === 'paragraph') {
                                const paraDiv = renderParagraph(element);
                                
                                // ✅ Replace inline table placeholders with actual tables
                                if (paraDiv) {
                                    const placeholders = paraDiv.querySelectorAll('.hwp-inline-table-placeholder');
                                    placeholders.forEach(placeholder => {
                                        const tableData = placeholder._tableData;
                                        if (tableData) {
                                            const inlineTableElem = renderTable(tableData, images);
                                            // Wrap in span to maintain inline display
                                            const wrapper = document.createElement('span');
                                            wrapper.style.display = 'inline-block';
                                            wrapper.style.verticalAlign = 'top';
                                            wrapper.style.margin = '5px 10px';
                                            wrapper.appendChild(inlineTableElem);
                                            placeholder.replaceWith(wrapper);
                                        }
                                    });
                                }
                                
                                // Enhanced paragraph styling for table cells
                                enhanceParagraphInCell(paraDiv, element, cell, elementIndex);
                                
                                td.appendChild(paraDiv);
                            } else if (element.type === 'table') {
                                // Nested table
                                td.appendChild(renderTable(element, images));
                            }
                        });
                    }
                    
                    // ✅ 긴 내용 셀 추가 압축 (놀이방법(전개), 놀이속배움 등)
                    const cellTextLength = cell.elements?.reduce((total, elem) => {
                        if (elem.type === 'paragraph' && elem.runs) {
                            return total + elem.runs.reduce((sum, run) => 
                                sum + (run.text?.length || 0), 0);
                        }
                        return total;
                    }, 0) || 0;
                    
                    // 긴 내용(100자 이상)이면 초압축 모드
                    if (cellTextLength > 100) {
                        td.style.padding = '0'; // 여백 완전 제거
                        td.style.lineHeight = '1.1'; // 최소 줄간격
                        
                        // 내부 모든 단락에도 적용
                        const paragraphs = td.querySelectorAll('.hwp-paragraph');
                        paragraphs.forEach((para, idx) => {
                            para.style.lineHeight = '1.1';
                            para.style.margin = '0';
                            para.style.padding = '0';
                            if (idx > 0) {
                                para.style.marginTop = '0'; // 단락 간격도 제거
                            }
                        });
                    }

                    tr.appendChild(td);
                });
            }

            tableEl.appendChild(tr);
        });
    }

    // ✅ Render table caption (if exists)
    if (table.caption && table.caption.paragraphs) {
        const captionDiv = document.createElement('div');
        captionDiv.className = 'hwp-table-caption';
        captionDiv.style.textAlign = 'center';
        captionDiv.style.marginBottom = '8px';
        captionDiv.style.fontSize = '13.33px';
        captionDiv.style.lineHeight = '1.5';
        
        // Render each paragraph in caption
        table.caption.paragraphs.forEach(para => {
            const paraDiv = renderParagraph(para, images);
            captionDiv.appendChild(paraDiv);
        });
        
        // Insert caption based on side (TOP or BOTTOM)
        if (table.caption.side === 'BOTTOM') {
            wrapper.appendChild(tableEl);
            wrapper.appendChild(captionDiv);
        } else {
            // TOP (default)
            wrapper.appendChild(captionDiv);
            wrapper.appendChild(tableEl);
        }
        
        logger.debug(`  ✅ Caption rendered (side: ${table.caption.side})`);
    } else {
        wrapper.appendChild(tableEl);
    }
    
    return wrapper;
}

/**
 * 셀 안의 단락에 정교한 스타일 적용
 * @param {HTMLElement} paraDiv - 단락 div 요소
 * @param {Object} para - 단락 객체
 * @param {Object} cell - 셀 객체
 * @param {number} paraIndex - 단락 인덱스
 * @private
 */
function enhanceParagraphInCell(paraDiv, para, cell, paraIndex) {
    // Reset margins and padding
    paraDiv.style.margin = '0';
    paraDiv.style.padding = '0';

    // Preserve paragraph's lineHeight, only set default if not specified
    if (!para.style?.lineHeight) {
        paraDiv.style.lineHeight = '1.1'; // ✅ 추가 압축: 1.15 → 1.1
    }

    // Korean text support
    paraDiv.style.wordBreak = 'keep-all'; // Korean word boundary preservation
    paraDiv.style.whiteSpace = 'pre-wrap'; // Preserve whitespace
    paraDiv.style.overflowWrap = 'break-word'; // Handle overflow
    paraDiv.style.textRendering = 'optimizeLegibility';
    paraDiv.setAttribute('lang', 'ko'); // Korean language support

    // Text alignment priority: paragraph > cell > default
    if (para.style?.textAlign) {
        paraDiv.style.textAlign = para.style.textAlign;
        paraDiv.style.setProperty('text-align', para.style.textAlign, 'important');
        
        // Special handling for justify alignment
        if (para.style.textAlign === 'justify') {
            paraDiv.style.textJustify = 'inter-word';
            paraDiv.style.wordSpacing = 'normal';
        }
    } else if (cell.style?.textAlign) {
        paraDiv.style.textAlign = cell.style.textAlign;
        paraDiv.style.setProperty('text-align', cell.style.textAlign, 'important');
        
        // Special handling for justify alignment
        if (cell.style.textAlign === 'justify') {
            paraDiv.style.textJustify = 'inter-word';
            paraDiv.style.wordSpacing = 'normal';
        }
    }

    // Apply minimal spacing between paragraphs
    // ✅ 단락 간격 완전 제거 (긴 내용 대응)
    if (paraIndex > 0) {
        paraDiv.style.marginTop = '0'; // ✅ 압축: 1px → 0 (완전 제거)
    }

    // Note: Images are already rendered by renderParagraph
    // This function only enhances the paragraph styling for table cells
}

/**
 * 셀에 대각선 렌더링 (SVG 사용)
 * @param {HTMLElement} td - 셀 요소
 * @param {Object} style - 스타일 객체
 * @private
 */
function renderDiagonalLines(td, style) {
    // Create SVG for diagonal lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', '0 0 100 100');

    // Slash (top-left to bottom-right: /)
    if (style.slashDef && style.slashDef.visible) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '100');
        line.setAttribute('x2', '100');
        line.setAttribute('y2', '0');
        line.setAttribute('stroke', style.slashDef.color);
        line.setAttribute('stroke-width', style.slashDef.width);
        svg.appendChild(line);
    }

    // BackSlash (top-right to bottom-left: \)
    if (style.backSlashDef && style.backSlashDef.visible) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '0');
        line.setAttribute('x2', '100');
        line.setAttribute('y2', '100');
        line.setAttribute('stroke', style.backSlashDef.color);
        line.setAttribute('stroke-width', style.backSlashDef.width);
        svg.appendChild(line);
    }

    td.style.overflow = 'hidden';
    td.appendChild(svg);
}

export default { renderTable };

