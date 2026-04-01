/**
 * Table Renderer
 * HWPX 테이블을 HTML 요소로 렌더링 (v3.0 Professional)
 *
 * v3.0 Changes:
 * - Row-level attributes: height, heightType (FIXED/MINIMUM/AUTO), header, hidden, background
 * - Table-level: cellSpacing, inMargin/outMargin, position (floating tables), pageBreak
 * - Cell-level: textDirection (vertical writing), lineWrap, protect, header flag
 * - Floating table CSS positioning
 * - Page break policy support (break-inside)
 *
 * @module renderers/table
 * @version 3.0.0
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

    // images가 Map이 아닐 경우 빈 Map으로 대체
    if (!images || !(images instanceof Map)) {
        logger.warn('⚠️ Images is not a Map, using empty Map');
        images = new Map();
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'hwp-table-wrapper';
    wrapper.style.maxWidth = '100%';
    wrapper.style.overflowX = 'auto';

    // ================================================================
    // Table outer margin (outMargin from HWPX)
    // ================================================================
    if (table.style?.outMargin) {
        const om = table.style.outMargin;
        if (om.top) wrapper.style.marginTop = om.top + 'px';
        if (om.bottom) wrapper.style.marginBottom = om.bottom + 'px';
        if (om.left) wrapper.style.marginLeft = om.left + 'px';
        if (om.right) wrapper.style.marginRight = om.right + 'px';
    }

    // ================================================================
    // Floating table positioning
    // ================================================================
    if (table.position && !table.position.treatAsChar) {
        const pos = table.position;
        // Floating table — not inline with text
        if (pos.horzOffset || pos.vertOffset) {
            wrapper.style.position = 'relative';
            if (pos.vertOffset) wrapper.style.top = pos.vertOffset + 'px';
            if (pos.horzOffset) wrapper.style.left = pos.horzOffset + 'px';
        }
        // Horizontal alignment for floating tables
        if (pos.horzAlign === 'CENTER') {
            wrapper.style.marginLeft = 'auto';
            wrapper.style.marginRight = 'auto';
        } else if (pos.horzAlign === 'RIGHT') {
            wrapper.style.marginLeft = 'auto';
            wrapper.style.marginRight = '0';
        }
    }

    const tableEl = document.createElement('table');
    tableEl.className = 'hwp-table';

    // 테이블 데이터 연결 (InlineEditor에서 사용)
    tableEl._tableData = table;

    // Apply table-level styles
    tableEl.style.borderCollapse = 'separate';
    tableEl.style.tableLayout = 'fixed';
    tableEl.style.boxSizing = 'border-box';
    tableEl.style.position = 'relative';
    tableEl.style.fontSize = '12px';

    // cellSpacing from HWPX
    if (table.style?.cellSpacing && table.style.cellSpacing > 0) {
        tableEl.style.borderSpacing = table.style.cellSpacing + 'px';
    } else {
        tableEl.style.borderSpacing = '0';
    }

    // Table width
    if (table.style && table.style.width) {
        tableEl.style.width = '100%';
        tableEl.style.maxWidth = '100%';
        logger.debug(`  Table width: ${table.style.width}`);
    } else {
        tableEl.style.width = '100%';
    }

    // Table height — minHeight only, content expands naturally
    if (table.style && table.style.height) {
        tableEl.style.minHeight = table.style.height;
        logger.debug(`  Table minHeight: ${table.style.height}`);
    }

    // Page break policy
    if (table.style?.pageBreak) {
        if (table.style.pageBreak === 'TABLE') {
            // Entire table must be on one page — avoid breaking inside
            tableEl.style.breakInside = 'avoid';
            tableEl.style.pageBreakInside = 'avoid';
        }
        // CELL = default (allow breaks between rows)
        // NONE = no special handling
    }

    // ================================================================
    // Create colgroup for explicit column widths
    // ================================================================
    if (table.colWidthsPercent && table.colWidthsPercent.length > 0) {
        const colgroup = document.createElement('colgroup');
        table.colWidthsPercent.forEach((widthPercent) => {
            const col = document.createElement('col');
            col.style.width = widthPercent;
            colgroup.appendChild(col);
        });
        tableEl.appendChild(colgroup);
        logger.debug(`  Created colgroup with ${table.colWidthsPercent.length} columns (percentage)`);
    } else if (table.colWidths && table.colWidths.length > 0) {
        const colgroup = document.createElement('colgroup');
        table.colWidths.forEach((width) => {
            const col = document.createElement('col');
            col.style.width = width;
            colgroup.appendChild(col);
        });
        tableEl.appendChild(colgroup);
        logger.debug(`  Created colgroup with ${table.colWidths.length} columns (pixels)`);
    }

    // ================================================================
    // Render rows
    // ================================================================
    let thead = null;
    let tbody = document.createElement('tbody');

    if (table.rows && table.rows.length > 0) {
        table.rows.forEach((row, rowIndex) => {
            // Hidden rows — skip rendering
            if (row.style?.hidden) return;

            const tr = document.createElement('tr');
            tr.className = 'hwp-table-row';

            // --------------------------------------------------------
            // Row height — use explicit row height or calculate from cells
            // --------------------------------------------------------
            let rowHeight = 0;
            const heightType = row.style?.heightType || 'MINIMUM';

            if (row.style?.height && row.style.height > 0) {
                // Use explicitly parsed row height
                rowHeight = row.style.height;
            } else if (row.cells && row.cells.length > 0) {
                // Fallback: calculate from cells (max height of rowSpan=1 cells)
                row.cells.forEach(cell => {
                    if ((cell.rowSpan || 1) === 1 && cell.style?.heightPrecise) {
                        if (cell.style.heightPrecise > rowHeight) {
                            rowHeight = cell.style.heightPrecise;
                        }
                    }
                });
            }

            if (rowHeight > 0) {
                if (heightType === 'FIXED') {
                    // Fixed height — content clips if too large
                    tr.style.height = rowHeight + 'px';
                    tr.style.maxHeight = rowHeight + 'px';
                    tr.style.overflow = 'hidden';
                } else {
                    // MINIMUM or AUTO — minimum height with natural expansion
                    tr.style.minHeight = rowHeight + 'px';
                }
            }

            // Row background color
            if (row.style?.backgroundColor) {
                tr.style.backgroundColor = row.style.backgroundColor;
            }

            // --------------------------------------------------------
            // Render cells
            // --------------------------------------------------------
            if (row.cells && row.cells.length > 0) {
                row.cells.forEach((cell) => {
                    // Skip covered cells (merged region)
                    if (cell.isCovered) return;

                    const td = document.createElement('td');
                    td.className = 'hwp-table-cell';
                    td.setAttribute('lang', 'ko');

                    // Header cell — use <th> semantics via attribute
                    if (cell.isHeader || row.style?.isHeader) {
                        td.setAttribute('data-header', 'true');
                    }

                    // Protected cell
                    if (cell.protect) {
                        td.setAttribute('data-protect', 'true');
                    }

                    // Colspan/rowspan
                    if (cell.colSpan) td.colSpan = cell.colSpan;
                    if (cell.rowSpan) td.rowSpan = cell.rowSpan;

                    // Apply cell styles
                    if (!cell.style) {
                        td.style.border = '1px solid #000';
                        td.style.padding = '4px 6px';
                    }
                    if (cell.style) {
                        // ====================================================
                        // Background (priority: image > gradient > solid color)
                        // ====================================================
                        applyBackground(td, cell.style, images);

                        // Pattern fill
                        if (cell.style.patternType && cell.style.patternForeground) {
                            const baseColor = cell.style.backgroundColor || '#ffffff';
                            const patternColor = cell.style.patternForeground;
                            td.style.backgroundColor = baseColor;
                            td.style.backgroundImage = `repeating-linear-gradient(45deg, ${patternColor}20, ${patternColor}20 2px, transparent 2px, transparent 10px)`;
                            td.style.setProperty('background-image', `repeating-linear-gradient(45deg, ${patternColor}20, ${patternColor}20 2px, transparent 2px, transparent 10px)`, 'important');
                        }

                        // ====================================================
                        // Text alignment
                        // ====================================================
                        if (cell.style.textAlign) {
                            td.style.textAlign = cell.style.textAlign;
                            td.style.setProperty('text-align', cell.style.textAlign, 'important');
                        }

                        // Vertical alignment
                        if (cell.style.verticalAlign) {
                            td.style.verticalAlign = cell.style.verticalAlign;
                            td.style.setProperty('vertical-align', cell.style.verticalAlign, 'important');
                            if (cell.style.verticalAlign === 'middle') {
                                td.style.display = 'table-cell';
                            }
                        }

                        // ====================================================
                        // Text direction (세로쓰기 지원)
                        // ====================================================
                        if (cell.style.textDirection) {
                            const dir = cell.style.textDirection.toUpperCase();
                            if (dir === 'VERTICAL' || dir === 'TBRL') {
                                td.style.writingMode = 'vertical-rl';
                                td.style.textOrientation = 'mixed';
                                td.classList.add('hwp-vertical-text');
                            } else if (dir === 'BTLR') {
                                td.style.writingMode = 'vertical-lr';
                                td.style.textOrientation = 'mixed';
                                td.classList.add('hwp-vertical-text');
                            }
                        }

                        // ====================================================
                        // Line wrap policy
                        // ====================================================
                        if (cell.style.lineWrap === 'SQUEEZE') {
                            td.style.whiteSpace = 'nowrap';
                            td.style.overflow = 'hidden';
                            td.style.textOverflow = 'clip';
                        } else if (cell.style.lineWrap === 'NONE') {
                            td.style.whiteSpace = 'nowrap';
                        }
                        // BREAK = default (normal wrapping)

                        // ====================================================
                        // Width
                        // ====================================================
                        if (cell.style.widthPercent) {
                            td.style.width = cell.style.widthPercent;
                        } else if (cell.style.width) {
                            td.style.width = cell.style.width;
                        }

                        // Word wrap
                        td.style.wordBreak = 'break-word';
                        td.style.wordWrap = 'break-word';

                        // ====================================================
                        // Height — respecting row heightType
                        // ====================================================
                        if (cell.style.height) {
                            const cellRowSpan = cell.rowSpan || 1;
                            if (cellRowSpan === 1) {
                                if (heightType === 'FIXED') {
                                    td.style.height = cell.style.height;
                                    td.style.maxHeight = cell.style.height;
                                    td.style.overflow = 'hidden';
                                } else {
                                    td.style.minHeight = cell.style.height;
                                    td.style.height = 'auto';
                                }
                                td.style.boxSizing = 'border-box';
                            }
                        }

                        // Enhanced cell positioning
                        td.style.position = 'relative';
                        td.style.fontSize = '13.33px';
                        td.style.lineHeight = '1.4';

                        // ====================================================
                        // Borders (4 sides individually)
                        // ====================================================
                        ['Left', 'Right', 'Top', 'Bottom'].forEach(side => {
                            const defKey = `border${side}Def`;
                            if (cell.style[defKey]) {
                                const borderCSS = cell.style[defKey].css;
                                td.style[`border${side}`] = borderCSS;
                                td.style.setProperty(`border-${side.toLowerCase()}`, borderCSS, 'important');
                            } else {
                                td.style[`border${side}`] = 'none';
                            }
                        });

                        // ====================================================
                        // Cell padding (from cellMargin)
                        // ====================================================
                        if (cell.style.padding) {
                            td.style.padding = cell.style.padding;
                        } else {
                            td.style.padding = '2px 4px';
                        }

                        // ====================================================
                        // Diagonal lines (slash, backSlash)
                        // ====================================================
                        if ((cell.style.slashDef && cell.style.slashDef.visible) ||
                            (cell.style.backSlashDef && cell.style.backSlashDef.visible)) {
                            renderDiagonalLines(td, cell.style);
                        }
                    }

                    // 셀 데이터 연결 (InlineEditor에서 사용)
                    td._cellData = cell;

                    // ====================================================
                    // Render cell content
                    // ====================================================
                    if (cell.elements && cell.elements.length > 0) {
                        cell.elements.forEach((element, elementIndex) => {
                            if (element.type === 'paragraph') {
                                const paraDiv = renderParagraph(element);

                                // Replace inline table placeholders with actual tables
                                if (paraDiv) {
                                    const placeholders = paraDiv.querySelectorAll('.hwp-inline-table-placeholder');
                                    placeholders.forEach(placeholder => {
                                        const tableData = placeholder._tableData;
                                        if (tableData) {
                                            const inlineTableElem = renderTable(tableData, images);
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

                    // Long content compression (100+ chars)
                    const cellTextLength = cell.elements?.reduce((total, elem) => {
                        if (elem.type === 'paragraph' && elem.runs) {
                            return total + elem.runs.reduce((sum, run) =>
                                sum + (run.text?.length || 0), 0);
                        }
                        return total;
                    }, 0) || 0;

                    if (cellTextLength > 100) {
                        td.style.padding = '1px 2px';
                        td.style.lineHeight = '1.25';

                        const paragraphs = td.querySelectorAll('.hwp-paragraph');
                        paragraphs.forEach((para, idx) => {
                            para.style.lineHeight = '1.25';
                            para.style.margin = '0';
                            para.style.padding = '0';
                            if (idx > 0) {
                                para.style.marginTop = '0';
                            }
                        });
                    }

                    tr.appendChild(td);
                });
            }

            // Append row to thead or tbody
            if ((row.style?.isHeader || (table.repeatHeader && rowIndex === 0)) && !thead) {
                thead = document.createElement('thead');
                thead.appendChild(tr);
            } else if (thead && row.style?.isHeader) {
                thead.appendChild(tr);
            } else {
                tbody.appendChild(tr);
            }
        });
    }

    // Assemble table structure
    if (thead) tableEl.appendChild(thead);
    if (tbody.children.length > 0) tableEl.appendChild(tbody);

    // ================================================================
    // Render table caption
    // ================================================================
    if (table.caption && table.caption.paragraphs) {
        const captionDiv = document.createElement('div');
        captionDiv.className = 'hwp-table-caption';
        captionDiv.style.textAlign = 'center';
        captionDiv.style.fontSize = '13.33px';
        captionDiv.style.lineHeight = '1.5';

        // Caption gap
        const gap = table.caption.gap || 8;

        // Render each paragraph in caption
        table.caption.paragraphs.forEach(para => {
            const paraDiv = renderParagraph(para, images);
            captionDiv.appendChild(paraDiv);
        });

        // Insert caption based on side
        if (table.caption.side === 'BOTTOM') {
            captionDiv.style.marginTop = gap + 'px';
            wrapper.appendChild(tableEl);
            wrapper.appendChild(captionDiv);
        } else {
            captionDiv.style.marginBottom = gap + 'px';
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
 * Apply background styles to element (priority: image > gradient > solid)
 * @param {HTMLElement} el - target element
 * @param {Object} style - style object
 * @param {Map} images - images map
 * @private
 */
function applyBackground(el, style, images) {
    if (style.backgroundImage && images) {
        const binaryItemIDRef = style.backgroundImage.binaryItemIDRef;
        const mode = style.backgroundImage.mode || 'TILE';
        const imageData = images.get(binaryItemIDRef);

        if (imageData && imageData.url) {
            const backgroundSize = mode === 'TOTAL' ? 'cover' :
                mode === 'TILE' ? 'auto' :
                    mode === 'CENTER' ? 'contain' : '100% 100%';
            const backgroundRepeat = mode === 'TILE' ? 'repeat' : 'no-repeat';
            const backgroundPosition = mode === 'CENTER' ? 'center' : '0 0';

            el.style.backgroundImage = `url(${imageData.url})`;
            el.style.backgroundSize = backgroundSize;
            el.style.backgroundRepeat = backgroundRepeat;
            el.style.backgroundPosition = backgroundPosition;
            el.style.setProperty('background-image', `url(${imageData.url})`, 'important');
            el.style.setProperty('background-size', backgroundSize, 'important');

            logger.debug(`  🖼️ Applied background image: ${binaryItemIDRef} (mode: ${mode})`);
        }
    } else if (style.backgroundGradient) {
        el.style.background = style.backgroundGradient;
        el.style.setProperty('background', style.backgroundGradient, 'important');
    } else if (style.backgroundColor) {
        el.style.backgroundColor = style.backgroundColor;
        el.style.setProperty('background-color', style.backgroundColor, 'important');

        if (style.opacity !== undefined && style.opacity !== 1.0) {
            el.style.opacity = style.opacity;
        }
    }
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
        paraDiv.style.lineHeight = '1.4';
    }

    // Korean text support
    paraDiv.style.wordBreak = 'keep-all';
    paraDiv.style.whiteSpace = 'pre-wrap';
    paraDiv.style.overflowWrap = 'break-word';
    paraDiv.style.textRendering = 'optimizeLegibility';
    paraDiv.setAttribute('lang', 'ko');

    // Text alignment priority: paragraph > cell > default
    if (para.style?.textAlign) {
        paraDiv.style.textAlign = para.style.textAlign;
        paraDiv.style.setProperty('text-align', para.style.textAlign, 'important');

        if (para.style.textAlign === 'justify') {
            paraDiv.style.textJustify = 'inter-word';
            paraDiv.style.wordSpacing = 'normal';
        }
    } else if (cell.style?.textAlign) {
        paraDiv.style.textAlign = cell.style.textAlign;
        paraDiv.style.setProperty('text-align', cell.style.textAlign, 'important');

        if (cell.style.textAlign === 'justify') {
            paraDiv.style.textJustify = 'inter-word';
            paraDiv.style.wordSpacing = 'normal';
        }
    }

    // Paragraph spacing — no gap between paragraphs in cells
    if (paraIndex > 0) {
        paraDiv.style.marginTop = '0';
    }
}

/**
 * 셀에 대각선 렌더링 (SVG 사용)
 * @param {HTMLElement} td - 셀 요소
 * @param {Object} style - 스타일 객체
 * @private
 */
function renderDiagonalLines(td, style) {
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
