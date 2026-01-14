/**
 * Document Renderer
 * v1.0의 완벽한 렌더링 로직을 모듈화
 * 
 * @module renderer
 * @version 2.0.0
 */

import { HWPXConstants } from './constants.js';
import { getLogger } from '../utils/logger.js';
import { withErrorBoundary, withAsyncErrorBoundary, safeDOMOperation } from '../utils/error-boundary.js';

// Renderers
import { renderParagraph } from '../renderers/paragraph.js';
import { renderTable } from '../renderers/table.js';
import { renderImage } from '../renderers/image.js';
import { renderShape } from '../renderers/shape.js';
import { renderContainer } from '../renderers/container.js';

// Numbering helpers
import {
    toRoman,
    toLetter
} from '../utils/numbering.js';

const logger = getLogger();

/**
 * Document Renderer Class
 * HWPX 문서를 완벽하게 렌더링 (페이지, 헤더, 푸터, 자동 페이지 나누기 등)
 */
export class DocumentRenderer {
    /**
     * DocumentRenderer 생성자
     * @param {HTMLElement} container - 렌더링할 컨테이너
     * @param {Object} options - 렌더링 옵션
     */
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            enableAutoPagination: options.enableAutoPagination !== false,
            enableLazyLoading: options.enableLazyLoading !== false,
            a4Width: HWPXConstants.PAGE_WIDTH_A4_PX,
            a4Height: HWPXConstants.PAGE_HEIGHT_A4_PX,
            defaultPadding: HWPXConstants.PAGE_PADDING_DEFAULT,
            ...options
        };

        this.pageNumber = 1;
        this.totalPages = 0;

        // ✅ Phase 4: Dynamic Pagination State
        this.isPaginating = false;          // Pagination lock (semaphore)
        this.paginationQueue = [];          // Queue for delayed pagination requests
        this.dirtyPages = new Set();        // Pages marked as edited (need re-pagination)
        this.paginationDebounceTimer = null; // Debounce timer for pagination checks

        // ✅ Phase 5: Error boundaries for critical methods
        this._wrapCriticalMethodsWithErrorBoundaries();

        logger.info('🎨 DocumentRenderer initialized (with error boundaries)');
    }

    /**
     * Wrap critical methods with error boundaries
     * ✅ Phase 5: Prevent renderer crashes
     * @private
     */
    _wrapCriticalMethodsWithErrorBoundaries() {
        // Wrap rendering methods - check existence first to avoid production build issues
        if (typeof this.render === 'function') {
            const originalRender = this.render.bind(this);
            this.render = withAsyncErrorBoundary(originalRender, 'DocumentRenderer.render', 0);
        }

        if (typeof this.renderSection === 'function') {
            const originalRenderSection = this.renderSection.bind(this);
            this.renderSection = withErrorBoundary(originalRenderSection, 'DocumentRenderer.renderSection', null);
        }

        if (typeof this.checkPagination === 'function') {
            const originalCheckPagination = this.checkPagination.bind(this);
            this.checkPagination = withErrorBoundary(originalCheckPagination, 'DocumentRenderer.checkPagination', false);
        }

        if (typeof this.autoPaginateContent === 'function') {
            const originalAutoPaginate = this.autoPaginateContent.bind(this);
            this.autoPaginateContent = withErrorBoundary(originalAutoPaginate, 'DocumentRenderer.autoPaginateContent', 0);
        }

        logger.debug('✅ Error boundaries installed on critical methods');
    }

    /**
     * 문서 렌더링 (v1.0 로직 완전 이식)
     * @param {Object} hwpxDoc - 파싱된 HWPX 문서
     * @returns {Promise<number>} 총 페이지 수
     */
    async render(hwpxDoc) {
        logger.info('🎨 Starting document rendering...');
        logger.time('Document Render');

        try {
            // 🔥 디버깅: 렌더링할 문서 샘플 확인
            if (hwpxDoc && hwpxDoc.sections && hwpxDoc.sections[0]) {
                const firstTable = hwpxDoc.sections[0].elements.find(e => e.type === 'table');
                if (firstTable && firstTable.rows) {
                    logger.debug('🔍 Renderer received - First row sample:');
                    const firstRow = firstTable.rows[0];
                    firstRow.cells.slice(0, 3).forEach((cell, idx) => {
                        const text = cell?.elements?.[0]?.runs?.[0]?.text;
                        logger.debug(`  Cell ${idx}: "${text ? text.substring(0, 40) : '(empty)'}..."`);
                    });
                }
            }

            this.container.innerHTML = '';
            logger.debug('✓ Container cleared');

            if (!hwpxDoc || !hwpxDoc.sections || hwpxDoc.sections.length === 0) {
                this.container.innerHTML = `
                    <div style="text-align: center; padding: 100px 20px; color: #e74c3c;">
                        <h2>문서 내용이 없습니다</h2>
                        <p>파싱된 문서에 섹션이 없습니다.</p>
                    </div>
                `;
                return 0;
            }

            this.pageNumber = 1;

            // Render each section
            for (const section of hwpxDoc.sections) {
                const pageDiv = this.createPageContainer(section, this.pageNumber);

                // 페이지 설정 적용
                this.applyPageSettings(pageDiv, section);

                // 다단 레이아웃 적용
                this.applyMultiColumnLayout(pageDiv, section);

                // 홀수/짝수 페이지 판별
                const isOddPage = (this.pageNumber % 2 === 1);

                // 헤더 렌더링
                this.renderHeader(pageDiv, section, isOddPage);

                // 페이지 번호 렌더링
                this.renderPageNumber(pageDiv, section, this.pageNumber);

                // 푸터 렌더링
                this.renderFooter(pageDiv, section, isOddPage);

                // 본문 요소 렌더링
                this.renderElements(pageDiv, section, hwpxDoc.images);

                // 컨테이너에 페이지 추가
                this.container.appendChild(pageDiv);

                // 자동 페이지 나누기
                if (this.options.enableAutoPagination) {
                    const createdPages = this.autoPaginateContent(pageDiv, section, this.pageNumber);
                    this.pageNumber += createdPages;
                }

                // 테이블 디버그 (개발 모드)
                this.debugTables(pageDiv);

                this.pageNumber++;
            }

            this.totalPages = this.pageNumber - 1;

            logger.timeEnd('Document Render');
            logger.info(`✅ Document rendering completed: ${this.totalPages} pages`);

            return this.totalPages;

        } catch (error) {
            logger.error('❌ Rendering error:', error);

            this.container.innerHTML = `
                <div style="text-align: center; padding: 100px 20px; color: #e74c3c;">
                    <h2>⚠️ 렌더링 오류</h2>
                    <p>문서를 화면에 표시하는 중 오류가 발생했습니다.</p>
                    <details style="margin-top: 20px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
                        <summary style="cursor: pointer; color: #3498db;">오류 정보</summary>
                        <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; margin-top: 10px;">${error.stack || error.message}</pre>
                    </details>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        페이지 새로고침
                    </button>
                </div>
            `;

            throw error;
        }
    }

    /**
     * 페이지 컨테이너 생성
     * @param {Object} section - 섹션 정보
     * @param {number} pageNumber - 페이지 번호
     * @returns {HTMLElement} 페이지 컨테이너
     * @private
     */
    createPageContainer(section, pageNumber) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'hwp-page-container';
        pageDiv.setAttribute('data-page-number', pageNumber);
        pageDiv.style.position = 'relative';

        // 데이터 참조 저장 (Dynamic Pagination 용)
        pageDiv._section = section;

        return pageDiv;
    }

    /**
     * 페이지 설정 적용 (크기, 여백)
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @param {Object} section - 섹션 정보
     * @private
     */
    applyPageSettings(pageDiv, section) {
        // ... (existing code, no change needed here, just context for tool)
        const defaultWidth = `${this.options.a4Width}px`;
        const defaultHeight = `${this.options.a4Height}px`;
        const defaultPadding = `${this.options.defaultPadding}px`;

        pageDiv.style.boxSizing = 'border-box';

        if (section.pageSettings?.width) {
            pageDiv.style.width = section.pageSettings.width;
        } else {
            pageDiv.style.width = defaultWidth;
        }

        if (section.pageSettings?.height) {
            pageDiv.style.height = section.pageSettings.height;
        } else {
            pageDiv.style.height = defaultHeight;
        }

        if (section.pageSettings && (section.pageSettings.marginLeft || section.pageSettings.marginRight ||
            section.pageSettings.marginTop || section.pageSettings.marginBottom)) {
            const padding = `${section.pageSettings.marginTop || defaultPadding} ${section.pageSettings.marginRight || defaultPadding} ${section.pageSettings.marginBottom || defaultPadding} ${section.pageSettings.marginLeft || defaultPadding}`;
            pageDiv.style.padding = padding;
        } else {
            pageDiv.style.padding = defaultPadding;
        }
    }

    // ... (omitted)

    /**
     * 특정 페이지의 페이지 나누기 체크 (Dynamic Pagination)
     * @param {HTMLElement} pageDiv - 체크할 페이지 요소
     * @returns {boolean} 페이지가 나뉘었는지 여부
     */
    checkPagination(pageDiv) {
        // ✅ Phase 4: Pagination Lock & Queue System
        // Prevent recursive calls and layout thrashing
        if (this.isPaginating) {
            // ✅ Add to queue if not already queued
            if (!this.paginationQueue.includes(pageDiv)) {
                this.paginationQueue.push(pageDiv);
                logger.debug(`📥 Pagination queued (${this.paginationQueue.length} in queue)`);
            }
            return false;
        }

        if (!pageDiv || !pageDiv.classList.contains('hwp-page-container')) {
            logger.warn('⚠️ Invalid page element for pagination check');
            return false;
        }

        const section = pageDiv._section;
        if (!section) {
            logger.warn('⚠️ No section data attached to page');
            return false;
        }

        // ✅ Set pagination lock
        this.isPaginating = true;

        try {
            const pageNum = parseInt(pageDiv.getAttribute('data-page-number')) || 1;

            // ✅ Execute auto-pagination
            const createdPages = this.autoPaginateContent(pageDiv, section, pageNum);

            if (createdPages > 0) {
                logger.info(`📄 Dynamic pagination: ${createdPages} new pages created from page ${pageNum}`);
                this.totalPages += createdPages;
                return true;
            }

            return false;

        } finally {
            // ✅ Release pagination lock
            this.isPaginating = false;

            // ✅ Phase 4: Process queued pagination requests
            if (this.paginationQueue.length > 0) {
                const nextPage = this.paginationQueue.shift();
                logger.debug(`📤 Processing queued pagination (${this.paginationQueue.length} remaining)`);

                // ✅ Schedule next pagination with 10ms delay to prevent UI blocking
                setTimeout(() => {
                    this.checkPagination(nextPage);
                }, 10);
            }
        }
    }

    /**
     * Debounced pagination check (for use in onChange handlers)
     * ✅ Phase 4: Debouncing to prevent layout thrashing on every keystroke
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @param {number} delay - Debounce delay in ms (default: 500ms)
     */
    checkPaginationDebounced(pageDiv, delay = 500) {
        // ✅ Clear existing timer
        if (this.paginationDebounceTimer) {
            clearTimeout(this.paginationDebounceTimer);
        }

        // ✅ Mark page as dirty (needs re-pagination)
        this.markPageDirty(pageDiv);

        // ✅ Schedule pagination check after delay
        this.paginationDebounceTimer = setTimeout(() => {
            logger.debug('⏱️ Debounced pagination triggered');
            this.checkPagination(pageDiv);
            this.paginationDebounceTimer = null;
        }, delay);
    }

    /**
     * Mark a page as dirty (edited, needs re-pagination)
     * ✅ Phase 4: Dirty flag optimization
     * @param {HTMLElement} pageDiv - 페이지 요소
     */
    markPageDirty(pageDiv) {
        if (!pageDiv) return;

        const pageNum = pageDiv.getAttribute('data-page-number');
        if (pageNum) {
            this.dirtyPages.add(pageNum);
            logger.debug(`🏷️ Page ${pageNum} marked dirty`);
        }
    }

    /**
     * Clear dirty flag for a page
     * ✅ Phase 4: Clean page after successful pagination
     * @param {HTMLElement} pageDiv - 페이지 요소
     */
    clearPageDirty(pageDiv) {
        if (!pageDiv) return;

        const pageNum = pageDiv.getAttribute('data-page-number');
        if (pageNum) {
            this.dirtyPages.delete(pageNum);
            logger.debug(`✨ Page ${pageNum} marked clean`);
        }
    }

    /**
     * Check if a page is dirty
     * ✅ Phase 4: Only re-paginate dirty pages
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @returns {boolean}
     */
    isPageDirty(pageDiv) {
        if (!pageDiv) return false;

        const pageNum = pageDiv.getAttribute('data-page-number');
        return pageNum && this.dirtyPages.has(pageNum);
    }

    /**
     * Check pagination for all dirty pages
     * ✅ Phase 4: Batch process dirty pages
     */
    checkAllDirtyPages() {
        if (this.dirtyPages.size === 0) {
            logger.debug('✅ No dirty pages to check');
            return;
        }

        logger.info(`🔄 Checking ${this.dirtyPages.size} dirty pages`);

        const dirtyPageNumbers = Array.from(this.dirtyPages);
        dirtyPageNumbers.forEach(pageNum => {
            const pageDiv = this.container.querySelector(
                `.hwp-page-container[data-page-number="${pageNum}"]`
            );

            if (pageDiv) {
                this.checkPagination(pageDiv);
                this.clearPageDirty(pageDiv);
            }
        });
    }


    /**
     * Enable pagination debug mode
     * ✅ Phase 4: Visual debugging for pagination issues
     * Shows overlay with page height information
     */
    enablePaginationDebug() {
        logger.info('🐛 Pagination debug mode enabled');

        const pages = this.container.querySelectorAll('.hwp-page-container');

        pages.forEach((page, index) => {
            const pageNum = page.getAttribute('data-page-number');
            const scrollHeight = page.scrollHeight;
            const clientHeight = page.clientHeight;
            const overflow = scrollHeight - clientHeight;

            // ✅ Remove existing debug overlay if present
            const existingOverlay = page.querySelector('.pagination-debug-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }

            // ✅ Create debug overlay
            const debugOverlay = document.createElement('div');
            debugOverlay.className = 'pagination-debug-overlay';
            debugOverlay.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(255, 0, 0, 0.9);
                color: white;
                padding: 10px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                z-index: 9999;
                border-radius: 5px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                min-width: 180px;
            `;

            const isDirty = this.isPageDirty(page);
            const overflowStatus = overflow > 50 ? '⚠️ OVERFLOW' : overflow > 0 ? '⚡ Minor' : '✅ OK';

            debugOverlay.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid white; padding-bottom: 5px;">
                    📄 Page ${pageNum || index + 1}
                </div>
                <div style="line-height: 1.4;">
                    Client: ${clientHeight}px<br>
                    Scroll: ${scrollHeight}px<br>
                    Overflow: <span style="font-weight: bold;">${overflow}px</span><br>
                    Status: ${overflowStatus}<br>
                    ${isDirty ? '<span style="color: yellow;">🏷️ DIRTY</span>' : '<span style="color: lightgreen;">✨ CLEAN</span>'}
                </div>
            `;

            page.style.position = 'relative'; // Ensure overlay is positioned correctly
            page.appendChild(debugOverlay);
        });

        logger.info(`✅ Debug overlays added to ${pages.length} pages`);
    }

    /**
     * Disable pagination debug mode
     * ✅ Phase 4: Remove debug overlays
     */
    disablePaginationDebug() {
        logger.info('🐛 Pagination debug mode disabled');

        const overlays = this.container.querySelectorAll('.pagination-debug-overlay');
        overlays.forEach(overlay => overlay.remove());

        logger.info(`✅ Removed ${overlays.length} debug overlays`);
    }

    /**
     * Refresh pagination debug overlays
     * ✅ Phase 4: Update debug info without recreating overlays
     */
    refreshPaginationDebug() {
        const overlays = this.container.querySelectorAll('.pagination-debug-overlay');
        if (overlays.length === 0) return;

        // Debug mode is active, refresh all overlays
        this.disablePaginationDebug();
        this.enablePaginationDebug();
    }


    /**
     * 다단 레이아웃 적용
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @param {Object} section - 섹션 정보
     * @private
     */
    applyMultiColumnLayout(pageDiv, section) {
        if (section.colPr && section.colPr.colCount > 1) {
            pageDiv.style.columnCount = section.colPr.colCount;
            pageDiv.style.columnGap = '20px';
            pageDiv.style.columnRule = '1px solid #e0e0e0';
            logger.debug(`📰 Applied ${section.colPr.colCount}-column layout`);
        }
    }

    /**
     * 헤더 렌더링
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @param {Object} section - 섹션 정보
     * @param {boolean} isOddPage - 홀수 페이지 여부
     * @private
     */
    renderHeader(pageDiv, section, isOddPage) {
        const header = section.headers?.both || (isOddPage ? section.headers?.odd : section.headers?.even);

        if (header?.elements?.length > 0) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'hwp-page-header';
            headerDiv.style.position = 'absolute';
            headerDiv.style.top = '0';
            headerDiv.style.left = section.pageSettings?.marginLeft || '40px';
            headerDiv.style.right = section.pageSettings?.marginRight || '40px';
            headerDiv.style.height = (header.height ? `${header.height}px` : section.pageSettings?.marginTop) || '40px';
            headerDiv.style.overflow = 'visible';

            header.elements.forEach(element => {
                if (element.type === 'container') {
                    headerDiv.appendChild(renderContainer(element));
                }
            });

            pageDiv.appendChild(headerDiv);
            logger.debug(`📄 Header rendered for page ${this.pageNumber} (${isOddPage ? 'ODD' : 'EVEN'})`);
        }
    }

    /**
     * 페이지 번호 렌더링
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @param {Object} section - 섹션 정보
     * @param {number} pageNumber - 페이지 번호
     * @private
     */
    renderPageNumber(pageDiv, section, pageNumber) {
        if (!section.pageNum) {
            return;
        }

        const pageNumDiv = document.createElement('div');
        pageNumDiv.className = 'hwp-page-number';
        pageNumDiv.style.position = 'absolute';
        pageNumDiv.style.fontSize = '10pt';
        pageNumDiv.style.color = '#666';

        // 위치 설정
        const pos = section.pageNum.pos;
        const positions = {
            'BOTTOM_CENTER': { bottom: '10px', left: '50%', transform: 'translateX(-50%)' },
            'BOTH_CENTER': { bottom: '10px', left: '50%', transform: 'translateX(-50%)' },
            'BOTTOM_LEFT': { bottom: '10px', left: '20px' },
            'BOTTOM_RIGHT': { bottom: '10px', right: '20px' },
            'TOP_CENTER': { top: '10px', left: '50%', transform: 'translateX(-50%)' },
            'TOP_LEFT': { top: '10px', left: '20px' },
            'TOP_RIGHT': { top: '10px', right: '20px' }
        };

        if (positions[pos]) {
            Object.assign(pageNumDiv.style, positions[pos]);
        }

        // 번호 포맷
        let number = pageNumber;
        const formatType = section.pageNum.formatType;

        if (formatType === 'LOWER_ROMAN') {
            number = toRoman(pageNumber).toLowerCase();
        } else if (formatType === 'UPPER_ROMAN') {
            number = toRoman(pageNumber);
        } else if (formatType === 'LOWER_LETTER') {
            number = toLetter(pageNumber).toLowerCase();
        } else if (formatType === 'UPPER_LETTER') {
            number = toLetter(pageNumber);
        }

        pageNumDiv.textContent = `${section.pageNum.sideChar}${number}${section.pageNum.sideChar}`;
        pageDiv.appendChild(pageNumDiv);
        logger.debug(`📄 Page number: ${pageNumDiv.textContent} at ${pos}`);
    }

    /**
     * 푸터 렌더링
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @param {Object} section - 섹션 정보
     * @param {boolean} isOddPage - 홀수 페이지 여부
     * @private
     */
    renderFooter(pageDiv, section, isOddPage) {
        const footer = section.footers?.both || (isOddPage ? section.footers?.odd : section.footers?.even);

        if (footer?.elements?.length > 0) {
            const footerDiv = document.createElement('div');
            footerDiv.className = 'hwp-page-footer';
            footerDiv.style.position = 'absolute';
            footerDiv.style.bottom = '0';
            footerDiv.style.left = section.pageSettings?.marginLeft || '40px';
            footerDiv.style.right = section.pageSettings?.marginRight || '40px';
            footerDiv.style.height = (footer.height ? `${footer.height}px` : section.pageSettings?.marginBottom) || '40px';
            footerDiv.style.overflow = 'visible';

            footer.elements.forEach(element => {
                if (element.type === 'container') {
                    footerDiv.appendChild(renderContainer(element));
                }
            });

            pageDiv.appendChild(footerDiv);
            logger.debug(`📄 Footer rendered for page ${this.pageNumber} (${isOddPage ? 'ODD' : 'EVEN'})`);
        }
    }

    /**
     * 본문 요소 렌더링
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @param {Object} section - 섹션 정보
     * @param {Map} images - 이미지 맵
     * @private
     */
    renderElements(pageDiv, section, images) {
        if (!section.elements || section.elements.length === 0) {
            return;
        }

        section.elements.forEach(element => {
            let renderedElement = null;

            switch (element.type) {
                case 'paragraph':
                    renderedElement = renderParagraph(element);

                    // ✅ Replace inline table placeholders with actual tables
                    if (renderedElement) {
                        const placeholders = renderedElement.querySelectorAll('.hwp-inline-table-placeholder');
                        placeholders.forEach(placeholder => {
                            const tableData = placeholder._tableData;
                            if (tableData) {
                                const tableElem = renderTable(tableData, images);
                                placeholder.replaceWith(tableElem);
                            }
                        });
                    }
                    break;
                case 'table':
                    renderedElement = renderTable(element, images);
                    break;
                case 'image':
                    renderedElement = renderImage(element);
                    break;
                case 'shape':
                    renderedElement = renderShape(element, images);
                    break;
                case 'container':
                    renderedElement = renderContainer(element);
                    break;
                default:
                    logger.warn(`Unknown element type: ${element.type}`);
            }

            if (renderedElement) {
                pageDiv.appendChild(renderedElement);
            }
        });
    }

    /**
     * 정확한 요소 높이 계산 (margin collapse 고려)
     * ✅ Phase 3: Margin collapse를 고려한 정확한 높이 계산
     * @param {HTMLElement} element - 높이를 계산할 요소
     * @returns {number} margin을 포함한 전체 높이
     * @private
     */
    _getElementTotalHeight(element) {
        if (!element) return 0;

        const computedStyle = window.getComputedStyle(element);
        const elementHeight = element.offsetHeight;
        const marginTop = parseFloat(computedStyle.marginTop) || 0;
        const marginBottom = parseFloat(computedStyle.marginBottom) || 0;

        // ✅ Margin collapse 고려
        // 다음 형제와의 margin collapse를 Math.max로 근사
        const nextSibling = element.nextElementSibling;
        let effectiveMarginBottom = marginBottom;

        if (nextSibling) {
            const nextMarginTop = parseFloat(window.getComputedStyle(nextSibling).marginTop) || 0;
            // Margin collapse: 인접 margin 중 큰 값만 적용됨
            effectiveMarginBottom = Math.max(marginBottom, nextMarginTop) - nextMarginTop;
        }

        return elementHeight + marginTop + effectiveMarginBottom;
    }

    /**
     * 페이지보다 큰 표를 행 단위로 분할
     * ✅ Phase 3: 큰 표를 여러 페이지로 자동 분할
     * @param {HTMLElement} tableWrapper - 표 래퍼 요소
     * @param {HTMLElement} currentPage - 현재 페이지
     * @param {number} maxHeight - 페이지 최대 높이
     * @param {Object} section - 섹션 정보
     * @returns {number} 생성된 추가 페이지 수
     * @private
     */
    _splitLargeTable(tableWrapper, currentPage, maxHeight, section) {
        const table = tableWrapper.querySelector('.hwp-table');
        if (!table) return 0;

        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) return 0;

        logger.info(`📊 Splitting large table (${rows.length} rows, ${tableWrapper.offsetHeight}px total)`);

        let createdPages = 0;
        let currentTablePage = currentPage;

        // 현재 페이지의 사용된 공간 계산
        const usedHeight = Array.from(currentPage.children)
            .filter(el => el !== tableWrapper)
            .reduce((sum, el) => sum + this._getElementTotalHeight(el), 0);
        let remainingHeight = maxHeight - usedHeight;

        // 표 헤더 감지 (첫 행에 <th>가 있으면 헤더로 간주)
        const headerRow = rows[0].querySelector('th') ? rows[0] : null;
        const headerHeight = headerRow ? headerRow.offsetHeight : 0;

        // 새 표 생성 함수
        const createTableClone = () => {
            const newTable = table.cloneNode(false);
            newTable.innerHTML = '';

            // 두 번째 페이지부터는 헤더 복사
            if (headerRow && currentTablePage !== currentPage) {
                const headerClone = headerRow.cloneNode(true);
                newTable.appendChild(headerClone);
            }

            return newTable;
        };

        let currentClone = createTableClone();
        const newWrapper = tableWrapper.cloneNode(false);
        newWrapper.appendChild(currentClone);
        currentTablePage.appendChild(newWrapper);

        let currentTableHeight = headerRow && currentTablePage === currentPage ? headerHeight : 0;
        const dataRows = headerRow ? rows.slice(1) : rows;

        dataRows.forEach((row, index) => {
            const rowHeight = row.offsetHeight;

            // 페이지 넘침 시 새 페이지 생성
            if (currentTableHeight + rowHeight > remainingHeight && currentTableHeight > 0) {
                logger.debug(`  📄 Table split at row ${index} (${currentTableHeight}px used, ${rowHeight}px needed)`);

                // 새 페이지 생성
                const newPage = document.createElement('div');
                newPage.className = 'hwp-page-container';
                const pageNum = parseInt(currentTablePage.getAttribute('data-page-number')) + 1;
                newPage.setAttribute('data-page-number', pageNum);

                // 스타일 복사
                newPage.style.position = 'relative';
                newPage.style.width = currentTablePage.style.width;
                newPage.style.height = currentTablePage.style.height;
                newPage.style.boxSizing = currentTablePage.style.boxSizing;
                newPage.style.padding = currentTablePage.style.padding;

                currentTablePage.parentElement.insertBefore(newPage, currentTablePage.nextSibling);

                // 새 표 시작
                currentClone = createTableClone();
                const newTableWrapper = tableWrapper.cloneNode(false);
                newTableWrapper.appendChild(currentClone);
                newPage.appendChild(newTableWrapper);

                currentTablePage = newPage;
                currentTableHeight = headerHeight; // 헤더 높이부터 시작
                remainingHeight = maxHeight;
                createdPages++;
            }

            // 행 추가
            const rowClone = row.cloneNode(true);
            currentClone.appendChild(rowClone);
            currentTableHeight += rowHeight;
        });

        logger.info(`✅ Table split into ${createdPages + 1} pages`);

        // 원본 tableWrapper 제거
        tableWrapper.remove();

        return createdPages;
    }

    /**
     * 자동 페이지 나누기 (v1.0 로직 완전 이식)
     * ✅ Phase 3: 무한 재귀 방지, 표 분할, 정확한 높이 계산
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @param {Object} section - 섹션 정보
     * @param {number} currentPageNum - 현재 페이지 번호
     * @param {number} recursionDepth - 재귀 깊이 (무한 루프 방지용)
     * @returns {number} 추가 생성된 페이지 수
     * @private
     */
    autoPaginateContent(pageDiv, section, currentPageNum, recursionDepth = 0) {
        // ✅ Phase 3: 무한 재귀 방지 - 재귀 깊이 제한
        const MAX_RECURSION = 10;
        if (recursionDepth >= MAX_RECURSION) {
            logger.error(`❌ Pagination recursion limit reached (depth: ${recursionDepth})`);
            logger.error(`  Page ${currentPageNum}: Forced termination to prevent infinite loop`);
            return 0;
        }

        if (recursionDepth > 0) {
            logger.debug(`  🔄 Recursive pagination depth: ${recursionDepth}`);
        }

        const container = pageDiv.parentElement;

        // ✅ clientHeight에서 padding을 제외하여 실제 콘텐츠 영역 계산
        // clientHeight는 border를 제외하지만 padding은 포함함
        const computed = window.getComputedStyle(pageDiv);
        const paddingTop = parseFloat(computed.paddingTop) || 0;
        const paddingBottom = parseFloat(computed.paddingBottom) || 0;
        const maxContentHeight = pageDiv.clientHeight - paddingTop - paddingBottom;

        logger.debug(`📐 Auto-pagination: clientHeight=${pageDiv.clientHeight}px, padding=${paddingTop + paddingBottom}px, maxContent=${maxContentHeight}px`);

        // 실제 컨텐츠 높이
        const contentHeight = pageDiv.scrollHeight;

        // clientHeight 기준으로 비교
        const clientHeight = pageDiv.clientHeight;

        // 강제 페이지 나누기 확인
        const elementsWithBreak = pageDiv.querySelectorAll('[data-page-break="true"]');
        const hasPageBreaks = elementsWithBreak.length > 0;

        // ✅ Phase 3: 허용 오차 증가 (20 → 50)
        // 빈 단락의 line-height, margin collapse 등으로 인한 미세 오버플로우 허용
        const ALLOWED_OVERFLOW = 50;


        if (contentHeight <= clientHeight + ALLOWED_OVERFLOW && !hasPageBreaks) {
            // 페이지 나누기 불필요 (허용 오차 범위 내)
            const overflow = contentHeight - clientHeight;
            logger.debug(`📄 No pagination needed: overflow=${overflow}px (within ${ALLOWED_OVERFLOW}px tolerance)`);
            return 0;
        }

        if (hasPageBreaks) {
            logger.debug(`📄 Auto-paginating: ${elementsWithBreak.length} forced page break(s) detected`);
        } else {
            logger.debug(`📄 Auto-paginating: content=${contentHeight}px > client=${clientHeight}px (overflow=${contentHeight - clientHeight}px)`);
        }

        // 헤더, 푸터, 페이지 번호를 제외한 본문 요소만 추출
        const elements = Array.from(pageDiv.children).filter(el =>
            !el.classList.contains('hwp-page-header') &&
            !el.classList.contains('hwp-page-footer') &&
            !el.classList.contains('hwp-page-number')
        );

        // 페이지 배열
        const pages = [pageDiv];
        let currentPage = pageDiv;
        let currentHeight = 0;
        let pageCount = 0;

        elements.forEach(element => {
            const hasPageBreak = element.hasAttribute('data-page-break');

            // ✅ Phase 3: margin collapse를 고려한 정확한 높이 계산
            const elementTotalHeight = this._getElementTotalHeight(element);

            // ✅ Phase 3: 표의 경우 특별 처리
            const isTable = element.classList.contains('hwp-table-wrapper');
            const remainingSpace = maxContentHeight - currentHeight;

            // ✅ Phase 3: 페이지보다 큰 요소 처리
            if (elementTotalHeight > maxContentHeight * 0.95) {
                logger.warn(`⚠️ Element too large for page (${elementTotalHeight.toFixed(1)}px > ${maxContentHeight}px)`);

                // ✅ Phase 3: 표인 경우 행 단위 분할 시도
                if (isTable) {
                    const splitPages = this._splitLargeTable(element, currentPage, maxContentHeight, section);
                    pageCount += splitPages;
                    return; // 다음 요소로
                }

                // 일반 요소는 현재 페이지에 강제 배치 (넘쳐도 허용)
                logger.warn(`  → Forced on current page (may overflow)`);
                currentPage.appendChild(element);
                currentHeight += elementTotalHeight;
                return;
            }

            // 90% 이상 들어가면 현재 페이지에 유지 (첫 페이지 체계도 표 보호)
            const threshold = 0.90;
            const canFitPartially = isTable && remainingSpace > elementTotalHeight * threshold;

            // 페이지 나누기 필요 여부
            if ((hasPageBreak || (currentHeight + elementTotalHeight > maxContentHeight && !canFitPartially)) && currentHeight > 0) {
                if (hasPageBreak) {
                    logger.debug(`  📄 Forced page break detected on element`);
                } else if (canFitPartially) {
                    logger.debug(`  📄 Table kept on current page: remaining=${remainingSpace.toFixed(1)}px, table=${elementTotalHeight.toFixed(1)}px (${(remainingSpace / elementTotalHeight * 100).toFixed(0)}% fits)`);
                } else {
                    logger.debug(`  📄 Breaking page: current=${currentHeight.toFixed(1)}px + element=${elementTotalHeight.toFixed(1)}px > max=${maxContentHeight}px`);
                }

                // 새 페이지 생성
                const newPage = document.createElement('div');
                newPage.className = 'hwp-page-container';
                newPage.setAttribute('data-page-number', currentPageNum + pageCount + 1);
                newPage.style.position = 'relative';

                // ✅ 원본 페이지의 스타일 복사 (minHeight → height)
                newPage.style.width = pageDiv.style.width;
                newPage.style.height = pageDiv.style.height;
                newPage.style.boxSizing = pageDiv.style.boxSizing;
                newPage.style.padding = pageDiv.style.padding;

                // 다음 형제 위치에 삽입
                const nextSibling = currentPage.nextSibling;
                if (nextSibling) {
                    container.insertBefore(newPage, nextSibling);
                } else {
                    container.appendChild(newPage);
                }

                pages.push(newPage);
                currentPage = newPage;
                currentHeight = 0;
                pageCount++;

                logger.debug(`  📄 Created page ${currentPageNum + pageCount} for overflow content`);
            }

            // ✅ FIX: 요소를 현재 페이지로 이동
            // appendChild는 DOM 트리의 끝에 추가하므로 table 안으로 들어갈 수 있음
            // 따라서 명시적으로 page의 직접 자식으로만 추가
            if (element.parentNode !== currentPage) {
                currentPage.appendChild(element);
            }

            // ✅ 요소를 이동한 후 실제 높이 재측정 (margin-collapse 반영)
            const actualHeight = element.offsetHeight;
            const actualMarginTop = parseFloat(window.getComputedStyle(element).marginTop) || 0;
            const actualMarginBottom = parseFloat(window.getComputedStyle(element).marginBottom) || 0;
            const actualTotalHeight = actualHeight + actualMarginTop + actualMarginBottom;

            currentHeight += actualTotalHeight;
        });

        // ✅ 페이지 분할 후 검증 및 재귀적 분할
        logger.debug(`✅ Auto-pagination complete: ${pageCount + 1} pages created`);

        // ✅ Phase 3: 재귀 깊이 전달하여 무한 루프 방지
        // 새로 생성된 페이지들(첫 페이지 제외)에 대해서만 재귀 분할
        let additionalPages = 0;
        pages.slice(1).forEach((page, index) => {
            const pageScrollHeight = page.scrollHeight;
            const pageClientHeight = page.clientHeight;
            const overflow = pageScrollHeight - pageClientHeight;

            if (overflow > ALLOWED_OVERFLOW) {
                logger.debug(`  🔄 Page ${currentPageNum + index + 1} needs further splitting (overflow: ${overflow.toFixed(1)}px, depth: ${recursionDepth + 1})`);

                // ✅ Phase 3: 재귀 깊이 전달
                const extraPages = this.autoPaginateContent(
                    page,
                    section,
                    currentPageNum + index + 1,
                    recursionDepth + 1
                );
                additionalPages += extraPages;
            }
        });

        // 모든 페이지 최종 검증
        pages.forEach((page, index) => {
            const pageScrollHeight = page.scrollHeight;
            const pageClientHeight = page.clientHeight;
            const overflow = pageScrollHeight - pageClientHeight;

            if (overflow > ALLOWED_OVERFLOW) {
                logger.warn(`⚠️  Page ${currentPageNum + index}: overflow still detected (${overflow.toFixed(1)}px, exceeds ${ALLOWED_OVERFLOW}px tolerance)`);
                logger.warn(`    - scrollHeight: ${pageScrollHeight}px`);
                logger.warn(`    - clientHeight: ${pageClientHeight}px`);
            }
        });

        return pageCount + additionalPages;
    }

    /**
     * 테이블 디버그 (개발 모드)
     * @param {HTMLElement} pageDiv - 페이지 요소
     * @private
     */
    debugTables(pageDiv) {
        const tablesInPage = pageDiv.querySelectorAll('.hwp-table');

        if (tablesInPage.length > 0) {
            tablesInPage.forEach((table, idx) => {
                logger.debug(`🔍 TABLE [${idx}] dimensions:`, {
                    widthStyle: table.style.width,
                    computedWidth: `${table.offsetWidth}px`,
                    computedHeight: `${table.offsetHeight}px`,
                    parentWidth: `${table.parentElement?.offsetWidth}px`,
                    isVisible: table.offsetWidth > 0 ? '✅ VISIBLE' : '❌ COLLAPSED'
                });
            });
        }
    }

    /**
     * 총 페이지 수 가져오기
     * @returns {number} 총 페이지 수
     */
    getTotalPages() {
        return this.totalPages;
    }

    /**
     * 현재 페이지 번호 가져오기
     * @returns {number} 현재 페이지 번호
     */
    getCurrentPageNumber() {
        return this.pageNumber;
    }

    /**
     * 렌더러 리셋
     */
    reset() {
        this.pageNumber = 1;
        this.totalPages = 0;
        this.container.innerHTML = '';
        logger.info('🔄 Renderer reset');
    }
}

/**
 * 편의 함수: 문서 렌더링
 * @param {HTMLElement} container - 렌더링할 컨테이너
 * @param {Object} document - 파싱된 문서
 * @param {Object} options - 렌더링 옵션
 * @returns {Promise<number>} 총 페이지 수
 */
export async function renderDocument(container, document, options = {}) {
    const renderer = new DocumentRenderer(container, options);
    return await renderer.render(document);
}

export default DocumentRenderer;

