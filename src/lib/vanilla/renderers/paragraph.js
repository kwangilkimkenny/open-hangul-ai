/**
 * Paragraph Renderer
 * HWPX 단락을 HTML 요소로 렌더링
 * 
 * @module renderers/paragraph
 * @version 2.0.0
 */

import { getLogger } from '../utils/logger.js';
import { HWPXConstants } from '../core/constants.js';
import {
    toRoman,
    toLetter,
    toHangulGanada,
    toHangulJamo,
    toCircledHangul,
    toCircledDecimal,
    toKoreanHanja,
    toChineseHanja
} from '../utils/numbering.js';
import { renderShape } from './shape.js';
import { renderContainer } from './container.js';
import { renderTable } from './table.js';
import { applyImageOptimizations, applyImageEffects } from './image.js';
import { renderChart } from '../chart/chart-renderer.js';

const logger = getLogger();

// Global counter for numbering (persistent across paragraph renders)
const numberCounters = new Map();

/**
 * 단락 렌더링
 * @param {Object} para - 단락 객체
 * @param {Array} para.runs - 텍스트 런 배열
 * @param {Object} [para.style={}] - 단락 스타일
 * @param {Object} [para.numbering] - 번호 매기기 정보
 * @returns {HTMLDivElement} 렌더링된 단락 요소
 * 
 * @example
 * const paraElement = renderParagraph({
 *   runs: [{ text: 'Hello', style: { bold: true } }],
 *   style: { textAlign: 'center' },
 *   numbering: { id: '1', level: 0, definition: {...} }
 * });
 */
export function renderParagraph(para) {
    const paraDiv = document.createElement('div');
    paraDiv.className = 'hwp-paragraph';

    // 🔥 v2.2.4: 기본 font-size 설정 (테이블의 fontSize=0 상속 방지)
    paraDiv.style.fontSize = '12px';

    // 🆕 v2.3.0: 단락 데이터 직접 연결 (인라인 편집을 위해)
    paraDiv._paraData = para;

    // ✅ For justify alignment with tabs (like table of contents),
    // use flexbox to properly align page numbers to the right
    const hasTabs = para.runs?.some(r => r.type === 'tab');
    if (para.style?.textAlign === 'justify' && hasTabs) {
        paraDiv.style.display = 'flex';
        paraDiv.style.alignItems = 'baseline';
        paraDiv.style.flexWrap = 'nowrap';
    }

    // ✅ Apply text alignment (check both para.paraPr.align and para.style.textAlign)
    const alignment = para.paraPr?.align || para.style?.textAlign;
    if (alignment && alignment !== 'justify') {
        // For justify with tabs, we handle alignment via flex
        paraDiv.style.textAlign = alignment;
    } else if (alignment === 'justify' && !hasTabs) {
        // Regular justify without tabs
        paraDiv.style.textAlign = alignment;
    }

    // Apply paragraph styles
    if (para.style) {
        if (para.style.lineHeight) {
            // ✅ Find the first run with fontSize to calculate absolute lineHeight
            let baseFontSize = 13.33; // default
            if (para.runs && para.runs.length > 0) {
                const runWithFont = para.runs.find(r => r.style?.fontSize || r.style?.fontSizePx);
                if (runWithFont) {
                    if (runWithFont.style.fontSizePx) {
                        baseFontSize = parseFloat(runWithFont.style.fontSizePx);
                    } else if (runWithFont.style.fontSize) {
                        baseFontSize = HWPXConstants.ptToPx(parseFloat(runWithFont.style.fontSize));
                    }
                    paraDiv.style.fontSize = `${baseFontSize}px`;
                }
            }

            // ✅ Convert relative lineHeight to absolute px value
            // This ensures it applies correctly even when children have different fontSize
            const lineHeightValue = parseFloat(para.style.lineHeight);
            const lineHeightPx = baseFontSize * lineHeightValue;
            paraDiv.style.lineHeight = `${lineHeightPx.toFixed(2)}px`;
            paraDiv.style.setProperty('line-height', `${lineHeightPx.toFixed(2)}px`, 'important');
        }
        if (para.style.margin) {
            paraDiv.style.margin = para.style.margin;
        }
        if (para.style.padding) {
            paraDiv.style.padding = para.style.padding;
        }
    }

    // ✅ Handle numbering/bullets
    if (para.numbering) {
        renderNumbering(paraDiv, para, para.numbering);
    }

    // Determine target container for content
    const targetContainer = para._numberingContent || paraDiv;

    // ✅ v2.2.10: Render background shapes (BEHIND_TEXT) - 절대 위치로 배치
    if (para.backgroundShapes && para.backgroundShapes.length > 0) {
        logger.debug(`[Paragraph Renderer] Rendering ${para.backgroundShapes.length} background shapes`);
        para.backgroundShapes.forEach((shape, idx) => {
            const shapeElem = renderShape(shape);
            if (shapeElem) {
                // renderShape에서 이미 position: absolute, z-index: -1 설정됨
                paraDiv.appendChild(shapeElem);
                logger.debug(`  → Background shape ${idx + 1} appended`);
            }
        });
    }

    // ✅ NOTE: Inline images are rendered in run loop (run.hasImage)
    // to maintain correct order with text

    // ✅ v2.2.12: Check if shapes should be rendered via run loop for proper document order
    // If any run has hasShape=true, let the run loop handle all shapes
    const hasShapeRuns = para.runs?.some(r => r.hasShape);

    // Render inline shapes/containers (treatAsChar objects)
    // Only if NOT using run-based shape rendering
    if (para.shapes && para.shapes.length > 0 && !hasShapeRuns) {
        logger.debug(`[Paragraph Renderer] Rendering ${para.shapes.length} shapes/containers (legacy mode)`);

        para.shapes.forEach((shape, idx) => {
            logger.debug(`  → Shape/Container ${idx + 1}: type=${shape.type}, treatAsChar=${shape.treatAsChar}, width=${shape.width}`);
            if (shape.treatAsChar) {
                let shapeElem;

                // ✅ Distinguish between containers and shapes
                if (shape.type === 'container') {
                    shapeElem = renderContainer(shape);
                    logger.debug(`    Rendered as container, elem width: ${shapeElem.style.width}`);

                    // ✅ For large containers (images with overlays), render as block instead of inline
                    // This prevents size compression issues
                    if (shape.width && shape.width > 500) {
                        shapeElem.style.display = 'block';
                        shapeElem.style.marginTop = '10px';
                        shapeElem.style.marginBottom = '10px';
                        logger.debug(`    → Large container: rendered as block`);
                    } else {
                        shapeElem.style.display = 'inline-block';
                        shapeElem.style.verticalAlign = 'middle';
                    }
                } else {
                    shapeElem = renderShape(shape);
                    // ✅ v2.2.14: DO NOT override styles - shape.js sets final style attribute
                    logger.debug(`    Rendered as shape`);
                }

                if (shapeElem) {
                    targetContainer.appendChild(shapeElem);
                    logger.debug(`    Appended to paragraph`);
                }
            }
        });
    } else if (hasShapeRuns) {
        logger.debug(`[Paragraph Renderer] Shapes will be rendered in run order (${para.shapes?.length || 0} shapes)`);
    }

    // ✅ Set default font size for empty/blank paragraphs (for vertical spacing)
    // This ensures empty paragraphs have height even without content
    const hasContent = para.runs && para.runs.length > 0 &&
        para.runs.some(r => r.text && r.text.trim().length > 0);

    if (!hasContent && !para.images && !para.tables && !para.shapes) {
        // Empty paragraph - set default line height for spacing
        // Use Korean document standard (10pt = 13.33px)
        // ✅ lineHeight 추가 압축: 1.3 → 1.1
        paraDiv.style.fontSize = '13.33px';
        paraDiv.style.lineHeight = '1.1';
        paraDiv.style.minHeight = '15px'; // ✅ 13.33 * 1.1 = 14.6 (최소화)
    }

    // Render text runs
    para.runs?.forEach((run, index) => {
        if (run.hasTable && para.tables) {
            // ✅ Inline table from run marker
            // Store table data for later rendering by renderer.js
            const tableIndex = run.tableIndex ?? 0;
            const table = para.tables[tableIndex];

            if (table) {
                const tablePlaceholder = document.createElement('span');
                tablePlaceholder.className = 'hwp-inline-table-placeholder';
                tablePlaceholder.setAttribute('data-table-index', tableIndex);
                tablePlaceholder.style.display = 'inline-block';
                tablePlaceholder.style.verticalAlign = 'top';

                // Store table data directly on the element
                tablePlaceholder._tableData = table;

                targetContainer.appendChild(tablePlaceholder);
            }
        } else if (run.hasImage && para.images) {
            // ✅ Inline image from run marker
            const imageIndex = run.imageIndex ?? 0;
            const image = para.images[imageIndex];

            if (image) {
                // ✅ v2.2.9: 이미지 렌더링 개선 - renderImage 사용하거나 적절한 위치 적용
                const imgWrapper = document.createElement('span');
                imgWrapper.className = 'hwp-image-wrapper';

                // ✅ Check if image has absolute positioning (treatAsChar=false with position offsets)
                const hasAbsolutePosition = !image.treatAsChar &&
                    !image.position?.treatAsChar &&
                    (image.position?.x !== undefined || image.position?.y !== undefined);

                if (hasAbsolutePosition) {
                    // ✅ 절대 위치 이미지: position absolute 적용
                    imgWrapper.style.position = 'absolute';
                    if (image.position?.x !== undefined) {
                        imgWrapper.style.left = `${image.position.x}px`;
                        logger.debug(`[Paragraph] Image absolute left: ${image.position.x}px`);
                    }
                    if (image.position?.y !== undefined) {
                        imgWrapper.style.top = `${image.position.y}px`;
                        logger.debug(`[Paragraph] Image absolute top: ${image.position.y}px`);
                    }
                    // 정확한 크기 적용
                    if (image.width) {
                        imgWrapper.style.width = typeof image.width === 'number' ? `${image.width}px` : image.width;
                    }
                    if (image.height) {
                        imgWrapper.style.height = typeof image.height === 'number' ? `${image.height}px` : image.height;
                    }
                    imgWrapper.style.zIndex = '10'; // 다른 요소 위에 표시
                } else if (image.treatAsChar || image.position?.treatAsChar) {
                    // ✅ v2.2.10: Inline with text - 정확한 크기 적용
                    imgWrapper.style.display = 'inline-block';
                    imgWrapper.style.verticalAlign = 'middle';
                    imgWrapper.style.margin = '0 2px';
                    // 정확한 크기 설정
                    if (image.width) {
                        imgWrapper.style.width = typeof image.width === 'number' ? `${image.width}px` : image.width;
                    }
                    if (image.height) {
                        imgWrapper.style.height = typeof image.height === 'number' ? `${image.height}px` : image.height;
                    }
                    imgWrapper.style.maxWidth = '100%'; // 셀 넘침 방지
                } else {
                    // ✅ v2.2.10: Block-level image - 정확한 크기 적용
                    imgWrapper.style.display = 'block';
                    imgWrapper.style.textAlign = 'center';
                    imgWrapper.style.margin = '4px 0';
                    // 정확한 크기 설정
                    if (image.width) {
                        imgWrapper.style.width = typeof image.width === 'number' ? `${image.width}px` : image.width;
                    }
                    if (image.height) {
                        imgWrapper.style.height = typeof image.height === 'number' ? `${image.height}px` : image.height;
                    }
                    imgWrapper.style.maxWidth = '100%'; // 셀 넘침 방지
                }

                const imgElem = document.createElement('img');
                imgElem.className = 'hwp-image';
                imgElem.alt = image.alt || '';

                // ✅ v2.2.10: 래퍼에 크기가 설정되면 img는 100% 사용
                if (image.width || image.height) {
                    imgElem.style.width = '100%';
                    imgElem.style.height = image.height ? '100%' : 'auto';
                } else {
                    imgElem.style.width = '100%';
                    imgElem.style.maxWidth = '100%';
                    imgElem.style.height = 'auto';
                }
                imgElem.style.objectFit = 'contain';
                imgElem.style.display = 'block';

                // ✅ v2.1.0: Apply lazy loading and image optimization
                const imgSrc = image.src || image.url;
                applyImageOptimizations(imgElem, imgSrc, imgWrapper);

                // ✅ Phase 1.4 / 1.5: 밝기·대비·채도·회전 효과 (인라인 이미지)
                applyImageEffects(imgElem, image);

                imgWrapper.appendChild(imgElem);
                targetContainer.appendChild(imgWrapper);
            }

        } else if (run.hasShape && para.shapes) {
            // ✅ v2.2.12: Inline shape from run marker - render in correct document order
            // Use shapeIndex if available, otherwise find the next unrendered shape
            let shapeIndex = run.shapeIndex ?? 0;

            // Track which shapes have been rendered
            if (!para._renderedShapeIndices) {
                para._renderedShapeIndices = new Set();
            }

            // Find the next available shape if this index was already used
            while (para._renderedShapeIndices.has(shapeIndex) && shapeIndex < para.shapes.length) {
                shapeIndex++;
            }

            if (shapeIndex < para.shapes.length) {
                para._renderedShapeIndices.add(shapeIndex);
                const shape = para.shapes[shapeIndex];

                if (shape) {
                    let shapeElem;

                    if (shape.type === 'container') {
                        shapeElem = renderContainer(shape);
                    } else {
                        shapeElem = renderShape(shape);
                    }

                    if (shapeElem) {
                        // ✅ v2.2.12: Replace inline table placeholders inside the shape's drawText
                        const placeholders = shapeElem.querySelectorAll('.hwp-inline-table-placeholder');
                        placeholders.forEach(placeholder => {
                            const tableData = placeholder._tableData;
                            if (tableData) {
                                const tableElem = renderTable(tableData, null); // images not available here
                                placeholder.replaceWith(tableElem);
                            }
                        });

                        // ✅ v2.2.14: DO NOT override styles set by renderShape
                        // The final style attribute is already set with !important in shape.js

                        // ✅ v2.2.14: Debug log to verify inline styles
                        logger.debug(`[Paragraph Renderer] Shape after render - style attr:`, shapeElem.getAttribute('style')?.substring(0, 300));

                        targetContainer.appendChild(shapeElem);
                        logger.debug(`[Paragraph Renderer] Rendered shape in run order at index ${shapeIndex}, replaced ${placeholders.length} table placeholders`);
                    }
                }
            }

        } else if (run.isTab || run.type === 'tab') {
            // ✅ Tab stop with proper styling
            const tabSpan = renderTabStop(para, run, index);
            targetContainer.appendChild(tabSpan);
        } else if (run.type === 'linebreak') {
            // Line break
            targetContainer.appendChild(document.createElement('br'));
        } else if (run.type === 'bookmark') {
            // ✅ Phase 1.2: 책갈피 anchor — 화면에는 보이지 않지만 scroll target 으로 사용
            const anchor = document.createElement('span');
            anchor.className = 'hwp-bookmark';
            if (run.name) {
                anchor.id = `bookmark-${run.name}`;
                anchor.setAttribute('data-bookmark', run.name);
            }
            // 레이아웃에 영향 주지 않도록 0 크기 인라인 요소
            anchor.style.display = 'inline-block';
            anchor.style.width = '0';
            anchor.style.height = '0';
            anchor.style.overflow = 'hidden';
            targetContainer.appendChild(anchor);
        } else if (run.type === 'field' && (run.fieldType === 'PAGE_NUMBER' || run.fieldType === 'PAGE_COUNT')) {
            // ✅ Phase 1.3: 페이지 번호/총 페이지 마커
            // 페이지네이션 종료 후 renderer.js 가 실제 번호로 치환한다.
            const fieldSpan = document.createElement('span');
            fieldSpan.className = 'hwp-field';
            fieldSpan.setAttribute(
                'data-field',
                run.fieldType === 'PAGE_NUMBER' ? 'page-number' : 'page-count'
            );
            // 폴백 텍스트 — 페이지네이션 전(또는 단위테스트 환경) 임시 표시값
            fieldSpan.textContent = run.fieldType === 'PAGE_NUMBER' ? '#' : '?';
            if (run.style) applyRunStyle(fieldSpan, run.style);
            targetContainer.appendChild(fieldSpan);
        } else if (run.hyperlink && run.hyperlink.url) {
            // ✅ Phase 1.1: 하이퍼링크 — <a> 로 렌더링
            const anchor = document.createElement('a');
            anchor.className = 'hwp-run hwp-hyperlink';
            const url = run.hyperlink.url;
            anchor.href = url;
            // 같은 문서 내 책갈피(#bookmark-xxx)는 같은 탭에서, 외부는 새 탭
            if (typeof url === 'string' && !url.startsWith('#')) {
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
            }
            anchor.textContent = run.text || url;
            if (run.style) applyRunStyle(anchor, run.style);
            if (paraDiv.style.display === 'flex') {
                anchor.style.flexShrink = '0';
            }
            targetContainer.appendChild(anchor);
        } else if (run.type === 'footnote' || run.type === 'endnote') {
            // ✅ Phase 2-2: Footnote/Endnote reference → <sup><a href="#fn-N">[N]</a></sup>
            const sup = renderNoteReference(run);
            targetContainer.appendChild(sup);
        } else if (run.type === 'ruby') {
            // ✅ Phase 2-4: Ruby (덧말/발음 표기) → <ruby>본문<rt>읽는법</rt></ruby>
            const rubyEl = renderRuby(run);
            targetContainer.appendChild(rubyEl);
        } else if (run.type === 'equation') {
            // ✅ Phase 5: 수식 (Hancom Equation Script ↔ MathML)
            const eqEl = renderEquation(run);
            targetContainer.appendChild(eqEl);
        } else if (run.type === 'chart' && run.chartData) {
            // ✅ Phase 5: Chart 렌더링 (pure SVG, 외부 의존성 없음)
            const wrapper = document.createElement('div');
            wrapper.className = 'hwp-chart';
            wrapper.setAttribute('data-chart-type', run.chartData.type || 'unknown');
            wrapper.style.display = 'block';
            wrapper.style.margin = '6px 0';
            wrapper.style.maxWidth = '100%';
            try {
                const svgEl = renderChart(run.chartData);
                if (svgEl) wrapper.appendChild(svgEl);
            } catch (err) {
                logger.warn('[Paragraph Renderer] Chart render failed:', err?.message || err);
                wrapper.textContent = '[차트 렌더 실패]';
            }
            targetContainer.appendChild(wrapper);
        } else {
            // Text run
            const span = document.createElement('span');
            span.className = 'hwp-run';
            span.textContent = run.text || '';

            // Apply run styles
            if (run.style) {
                applyRunStyle(span, run.style);
            }

            // ✅ For flex containers, prevent text from shrinking
            if (paraDiv.style.display === 'flex') {
                span.style.flexShrink = '0';
            }

            targetContainer.appendChild(span);
        }
    });

    // Empty paragraph
    if (!paraDiv.hasChildNodes() ||
        (para.numbering && !targetContainer.hasChildNodes())) {
        (targetContainer || paraDiv).appendChild(document.createElement('br'));
    }

    // ✅ v2.2.10: 배경 도형만 포함하는 단락은 레이아웃에서 제외
    // 페이지 분리 계산에 영향을 주지 않도록 높이 0 설정
    const hasOnlyBackgroundShapes = para.backgroundShapes && para.backgroundShapes.length > 0 &&
        (!para.shapes || para.shapes.length === 0) &&
        (!para.runs || para.runs.every(r => !r.text || r.text.trim() === '')) &&
        (!para.images || para.images.length === 0) &&
        (!para.tables || para.tables.length === 0);

    if (hasOnlyBackgroundShapes) {
        paraDiv.style.height = '0';
        paraDiv.style.overflow = 'visible';
        paraDiv.style.position = 'relative';
        // ✅ v2.2.10: 빈 요소의 line-height도 제거해야 함
        paraDiv.style.lineHeight = '0';
        paraDiv.style.fontSize = '0';
        logger.debug(`[Paragraph Renderer] Background-only paragraph - height set to 0`);
    }

    // 수식 렌더링 (KaTeX) — 비동기로 후처리
    if (para.runs?.some(r => r.text && (r.text.includes('$') || r.text.includes('\\(') || r.text.includes('\\[')))) {
        import('../../math/renderer').then(({ renderMathInElement }) => {
            renderMathInElement(paraDiv).catch(() => {});
        }).catch(() => {});
    }

    return paraDiv;

}

/**
 * 번호 매기기/글머리 기호 렌더링
 * @param {HTMLDivElement} paraDiv - 단락 요소
 * @param {Object} para - 단락 데이터 객체
 * @param {Object} numbering - 번호 매기기 정보
 * @private
 */
function renderNumbering(paraDiv, para, numbering) {
    paraDiv.setAttribute('data-numbering', numbering.id);
    paraDiv.setAttribute('data-level', numbering.level);

    const definition = numbering.definition;
    const levelData = definition.levels.find(l => l.level === numbering.level) || definition.levels[0];

    if (!levelData) {
        return;
    }

    // Set data-format for CSS styling
    paraDiv.setAttribute('data-format', levelData.format);

    // Create marker element
    const marker = document.createElement('span');
    marker.className = 'numbering-marker';

    // Generate number based on format
    let markerText = '';
    const counterKey = `${numbering.id}-${numbering.level}`;
    const currentNumber = numberCounters.get(counterKey) || definition.start || 1;

    switch (levelData.format) {
        case 'DIGIT':
        case 'DECIMAL':
        case 'KOREAN_DIGITAL':
            markerText = levelData.numberFormat.replace('%d', currentNumber.toString());
            break;
        case 'LOWER_ROMAN':
            markerText = levelData.numberFormat.replace('%d', toRoman(currentNumber).toLowerCase());
            break;
        case 'UPPER_ROMAN':
            markerText = levelData.numberFormat.replace('%d', toRoman(currentNumber));
            break;
        case 'LOWER_LETTER':
        case 'LOWER_ALPHA':
            markerText = levelData.numberFormat.replace('%d', toLetter(currentNumber).toLowerCase());
            break;
        case 'UPPER_LETTER':
        case 'UPPER_ALPHA':
            markerText = levelData.numberFormat.replace('%d', toLetter(currentNumber));
            break;
        case 'HANGUL_SYLLABLE':
        case 'HANGUL_GANADA':
            markerText = levelData.numberFormat.replace('%d', toHangulGanada(currentNumber));
            break;
        case 'HANGUL_JAMO':
        case 'HANGUL_CONSONANT':
            markerText = levelData.numberFormat.replace('%d', toHangulJamo(currentNumber));
            break;
        case 'CIRCLED_HANGUL':
            markerText = levelData.numberFormat.replace('%d', toCircledHangul(currentNumber));
            break;
        case 'CIRCLED_DECIMAL':
        case 'CIRCLED_NUMBER':
            markerText = levelData.numberFormat.replace('%d', toCircledDecimal(currentNumber));
            break;
        case 'HANJA':
        case 'IDEOGRAPH_KOREAN':
        case 'KOREAN_HANJA':
            markerText = levelData.numberFormat.replace('%d', toKoreanHanja(currentNumber));
            break;
        case 'IDEOGRAPH':
        case 'IDEOGRAPH_TRADITIONAL':
        case 'CHINESE_HANJA':
            markerText = levelData.numberFormat.replace('%d', toChineseHanja(currentNumber));
            break;
        case 'BULLET':
        case 'SYMBOL':
            // Use the numberFormat as-is for bullets (e.g., "●", "○", "■")
            markerText = levelData.numberFormat.replace('%d', '');
            break;
        default:
            logger.warn(`Unknown numbering format: ${levelData.format}, using decimal`);
            markerText = levelData.numberFormat.replace('%d', currentNumber.toString());
    }

    marker.textContent = markerText;

    // Increment counter for next use
    numberCounters.set(counterKey, currentNumber + 1);

    // Create content wrapper
    const content = document.createElement('span');
    content.className = 'numbering-content';

    paraDiv.appendChild(marker);
    paraDiv.appendChild(content);

    logger.debug(`Rendered numbering: ${markerText} (format: ${levelData.format}, level: ${numbering.level})`);

    // Store content wrapper for runs to append to
    para._numberingContent = content;
}

/**
 * 탭 정지 렌더링
 * @param {Object} para - 단락 객체
 * @param {Object} run - 탭 런 객체
 * @param {number} runIndex - 런 인덱스
 * @returns {HTMLSpanElement} 탭 스팬 요소
 * @private
 */
function renderTabStop(para, run, runIndex) {
    const tabSpan = document.createElement('span');
    tabSpan.className = 'hwp-tab';
    tabSpan.setAttribute('data-tab-index', runIndex);

    // ✅ Get tab info directly from run object (parsed from <tab> element)
    if (run && run.widthPx) {
        tabSpan.style.display = 'inline-block';

        // ✅ For justify alignment with tab leaders, make tab flexible
        // to push the page number to the right edge
        if (para.style?.textAlign === 'justify' && run.leader && run.leader !== 0) {
            // Use flex-grow to fill remaining space
            tabSpan.style.flexGrow = '1';
            tabSpan.style.flexShrink = '1';
            tabSpan.style.minWidth = '20px'; // minimum space
            // Don't set maxWidth - let it expand to fill space
        } else {
            // Fixed width for non-justify tabs
            tabSpan.style.width = `${run.widthPx.toFixed(2)}px`;
            tabSpan.style.minWidth = `${run.widthPx.toFixed(2)}px`;
            tabSpan.style.maxWidth = `${run.widthPx.toFixed(2)}px`;
        }

        tabSpan.style.position = 'relative';
        tabSpan.style.overflow = 'hidden';
        tabSpan.style.whiteSpace = 'nowrap';
        tabSpan.style.textAlign = 'left';

        // ✅ Apply tab leader (visual guide for table of contents)
        // Leader types: 0=NONE, 1=DOT, 2=HYPHEN, 3=DASH, 4=LINE, 5=MIDDLE_DOT
        if (run.leader !== undefined && run.leader !== 0) {
            switch (run.leader) {
                case 1: // DOT
                    tabSpan.textContent = '·'.repeat(100);
                    tabSpan.style.letterSpacing = '0.3em';
                    tabSpan.style.color = '#666';
                    tabSpan.style.fontSize = '10.67px'; // 0.8 * 13.33px (한글 기본 크기)
                    break;

                case 2: // HYPHEN
                    tabSpan.textContent = '-'.repeat(100);
                    tabSpan.style.letterSpacing = '0.2em';
                    tabSpan.style.color = '#666';
                    tabSpan.style.fontSize = '12px'; // 0.9 * 13.33px
                    break;

                case 3: // DASH (목차에서 가장 많이 사용 - 점선 ..........)
                    tabSpan.textContent = '.'.repeat(200);
                    tabSpan.style.letterSpacing = '0.15em';
                    tabSpan.style.color = '#000';
                    tabSpan.style.fontSize = '13.33px'; // 한글 기본 크기 (10pt)
                    tabSpan.style.lineHeight = '1.2';
                    break;

                case 4: // LINE
                    tabSpan.style.borderBottom = '1px solid #666';
                    tabSpan.style.fontSize = '13.33px';
                    tabSpan.style.lineHeight = '1.2';
                    tabSpan.innerHTML = '&nbsp;';
                    break;

                case 5: // MIDDLE_DOT
                    tabSpan.textContent = '·'.repeat(100);
                    tabSpan.style.letterSpacing = '0.5em';
                    tabSpan.style.color = '#666';
                    tabSpan.style.fontSize = '13.33px';
                    break;

                default:
                    tabSpan.style.fontSize = '13.33px';
                    tabSpan.style.lineHeight = '1.2';
                    tabSpan.innerHTML = '&nbsp;';
            }
        } else {
            // No leader - just space
            tabSpan.style.fontSize = '13.33px';
            tabSpan.style.lineHeight = '1.2';
            tabSpan.innerHTML = '&nbsp;';
        }
    } else {
        // ✅ Fallback: Old format from para.style.tabStops
        const tabStops = para.style?.tabStops || [];

        if (tabStops.length > 0) {
            // Find the appropriate tab stop for this tab
            let tabCount = 0;
            for (let i = 0; i < runIndex; i++) {
                if (para.runs[i].isTab || para.runs[i].type === 'tab') {
                    tabCount++;
                }
            }

            const tabStop = tabStops[tabCount % tabStops.length];
            tabSpan.style.display = 'inline-block';
            tabSpan.style.minWidth = tabStop.position;
            tabSpan.innerHTML = '&nbsp;';
        } else {
            // Default tab - 2em width
            tabSpan.style.display = 'inline-block';
            tabSpan.style.width = '2em';
            tabSpan.innerHTML = '&nbsp;';
        }
    }

    return tabSpan;
}

/**
 * ✅ Phase 2-2: 각주/미주 참조 마크업 생성
 * 본문에서 `[N]` 위첨자로 표시되며, 클릭 시 해당 ID 로 점프
 * @param {Object} run - footnote/endnote run 객체
 * @returns {HTMLElement} <sup> 요소
 * @private
 */
function renderNoteReference(run) {
    const sup = document.createElement('sup');
    const isFootnote = run.type === 'footnote';
    sup.className = isFootnote ? 'hwp-fn-ref' : 'hwp-en-ref';

    const num = run.number != null && run.number !== '' ? String(run.number) : '';
    const label = run.text || (num ? `[${num}]` : '[*]');
    const idPrefix = isFootnote ? 'fn' : 'en';

    const anchor = document.createElement('a');
    if (num) {
        anchor.href = `#${idPrefix}-${num}`;
        anchor.id = `${idPrefix}ref-${num}`;
    }
    anchor.textContent = label;
    anchor.style.textDecoration = 'none';
    anchor.style.color = '#0645ad';
    sup.appendChild(anchor);

    // 위첨자 크기 조정 (이미 sup 태그로 vertical-align 적용)
    sup.style.fontSize = '0.75em';
    sup.style.lineHeight = '1';

    return sup;
}

/**
 * ✅ Phase 2-4: Ruby (덧말/발음 표기) 마크업 생성
 * @param {Object} run - ruby run 객체 (text, rubyText)
 * @returns {HTMLElement} <ruby> 요소
 * @private
 */
function renderRuby(run) {
    const ruby = document.createElement('ruby');
    ruby.className = 'hwp-ruby';

    // 본문 텍스트
    const base = document.createTextNode(run.text || '');
    ruby.appendChild(base);

    // 읽는법 (rt)
    if (run.rubyText) {
        const rt = document.createElement('rt');
        rt.className = 'hwp-ruby-rt';
        rt.textContent = run.rubyText;
        ruby.appendChild(rt);
    }

    // 런 스타일 상속 (있다면)
    if (run.style) {
        applyRunStyle(ruby, run.style);
    }

    return ruby;
}

/**
 * ✅ Phase 5: 수식(Equation) 마크업 생성
 *  - run.mathml 이 있으면 그대로 삽입 (브라우저 native MathML 렌더)
 *  - 추가로 KaTeX 비동기 렌더를 시도(가능하면 더 보기 좋게 교체)
 *  - mathml 이 없으면 한컴 스크립트 텍스트를 폴백 표시
 *
 * @param {Object} run - equation run 객체 (mathml?, mathScript?, text?)
 * @returns {HTMLElement} 수식 컨테이너
 * @private
 */
function renderEquation(run) {
    const wrapper = document.createElement('span');
    wrapper.className = 'hwp-equation';
    wrapper.setAttribute('data-equation', '1');
    if (run.mathScript) {
        wrapper.setAttribute('data-math-script', run.mathScript);
    }

    // 1) MathML 직접 삽입 (가장 안전한 폴백)
    if (run.mathml) {
        // jsdom / 일부 환경에서는 innerHTML 로 MathML XML 파싱이 까다로움
        // → template 으로 안전하게 fragment 생성
        try {
            const tpl = document.createElement('template');
            tpl.innerHTML = run.mathml;
            if (tpl.content && tpl.content.firstChild) {
                wrapper.appendChild(tpl.content.cloneNode(true));
            } else {
                // 폴백: 텍스트로 보존 (실수로 HTML 이스케이프 안 되게 textContent)
                wrapper.textContent = run.text || '{수식}';
            }
        } catch {
            wrapper.textContent = run.text || '{수식}';
        }

        // 2) KaTeX 로 보강 렌더 — 가능하면 동기 자리 그대로 치환
        try {
            import('../math/mathml-katex-bridge.js')
                .then(({ renderKaTeXFromMathML }) =>
                    renderKaTeXFromMathML(run.mathml)
                )
                .then((html) => {
                    if (html && typeof html === 'string' && html.startsWith('<span')) {
                        wrapper.innerHTML = html;
                        wrapper.classList.add('hwp-equation-katex');
                    }
                })
                .catch(() => { /* native MathML 폴백 그대로 유지 */ });
        } catch { /* dynamic import 실패 무시 */ }
    } else {
        // mathml 도 없는 경우 한컴 스크립트를 monospace 폴백 표시
        wrapper.textContent = run.mathScript || run.text || '{수식}';
        wrapper.style.fontFamily = 'monospace';
    }

    if (run.style) applyRunStyle(wrapper, run.style);
    return wrapper;
}

/**
 * 런 스타일 적용
 * @param {HTMLElement} element - 대상 요소
 * @param {Object} style - 스타일 객체
 * @private
 */
function applyRunStyle(element, style) {
    // Font size
    if (style.fontSizePx) {
        element.style.fontSize = style.fontSizePx;
    } else if (style.fontSize) {
        const ptValue = parseFloat(style.fontSize);
        const pxValue = HWPXConstants.ptToPx(ptValue);
        element.style.fontSize = `${pxValue}px`;
    }

    // Font family
    if (style.fontFamily) {
        element.style.fontFamily = style.fontFamily;
    }

    // Text color
    if (style.color) {
        element.style.color = style.color;
    }

    // Background color (shadeColor)
    if (style.backgroundColor) {
        element.style.backgroundColor = style.backgroundColor;
        element.style.padding = '1px 2px'; // Add padding for better visibility
    }

    // Bold
    if (style.bold) {
        element.style.fontWeight = 'bold';
    }

    // Italic
    if (style.italic) {
        element.style.fontStyle = 'italic';
    }

    // Underline (with color support)
    if (style.underline) {
        if (style.underlineColor) {
            element.style.textDecoration = 'underline';
            element.style.textDecorationColor = style.underlineColor;
        } else {
            element.style.textDecoration = 'underline';
        }
    }

    // Strikethrough (with color support)
    if (style.strikethrough) {
        if (style.underline) {
            // Both underline and strikethrough
            element.style.textDecoration = 'underline line-through';
        } else {
            element.style.textDecoration = 'line-through';
        }
        if (style.strikethroughColor) {
            element.style.textDecorationColor = style.strikethroughColor;
        }
    }

    // Outline (외곽선) — Phase 1.8
    // 굵기는 1px 로 키워 가시성을 확보하되, 색상 지정이 있으면 사용한다.
    if (style.outline) {
        const outlineColor = style.outlineColor || style.color || 'currentColor';
        element.style.webkitTextStroke = `1px ${outlineColor}`;
        element.style.paintOrder = 'stroke fill';
    }

    // Text shadow (그림자) — Phase 1.8
    // 파서가 textShadowValue 를 만들었으면 우선 사용,
    // 그렇지 않고 boolean shadow=true 만 있으면 기본 그림자를 적용한다.
    if (style.textShadowValue) {
        element.style.textShadow = style.textShadowValue;
    } else if (style.textShadow || style.shadow) {
        element.style.textShadow = '1px 1px 2px rgba(0,0,0,0.45)';
    }

    // Emphasis mark (강조점) — Phase 1.7
    if (style.symMark) {
        // CSS Text Module Level 3
        element.style.textEmphasisStyle = style.symMark;
        element.style.webkitTextEmphasisStyle = style.symMark;
        if (style.color) {
            element.style.textEmphasisColor = style.color;
            element.style.webkitTextEmphasisColor = style.color;
        }
    }

    // Letter spacing (자간)
    if (style.letterSpacing) {
        element.style.letterSpacing = style.letterSpacing;
    }

    // Scale X (장평 - horizontal scaling)
    if (style.scaleX && style.scaleX !== 1) {
        element.style.transform = `scaleX(${style.scaleX})`;
        element.style.display = 'inline-block';
        element.style.transformOrigin = 'left center';
    }

    // Vertical align (superscript, subscript)
    if (style.verticalAlign) {
        element.style.verticalAlign = style.verticalAlign;
        // Reduce font size for super/subscript
        if (style.verticalAlign === 'super' || style.verticalAlign === 'sub') {
            element.style.fontSize = '0.75em';
        }
    }
}

/**
 * 단락 배열 렌더링
 * @param {Array<Object>} paragraphs - 단락 배열
 * @returns {DocumentFragment} 렌더링된 단락들
 * 
 * @example
 * const fragment = renderParagraphs([para1, para2, para3]);
 * container.appendChild(fragment);
 */
export function renderParagraphs(paragraphs) {
    const fragment = document.createDocumentFragment();

    paragraphs.forEach(para => {
        const paraElement = renderParagraph(para);
        fragment.appendChild(paraElement);
    });

    return fragment;
}

// Default export
export default {
    renderParagraph,
    renderParagraphs
};

