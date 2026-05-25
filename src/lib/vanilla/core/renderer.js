/**
 * Document Renderer
 * v1.0의 완벽한 렌더링 로직을 모듈화
 *
 * @module renderer
 * @version 2.0.0
 */

import { HWPXConstants } from './constants.js';
import { getLogger } from '../utils/logger.js';
import {
  withErrorBoundary,
  withAsyncErrorBoundary,
  safeDOMOperation,
} from '../utils/error-boundary.js';

// Renderers
import { renderParagraph } from '../renderers/paragraph.js';
import { renderTable } from '../renderers/table.js';
import { renderImage, clearImageCache } from '../renderers/image.js';
import { renderShape } from '../renderers/shape.js';
import { renderContainer } from '../renderers/container.js';
import {
  renderFootnoteArea,
  renderEndnoteArea,
  FOOTNOTE_AREA_RESERVE_PX,
} from '../renderers/footnote.js';

// Numbering helpers
import { toRoman, toLetter } from '../utils/numbering.js';

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
      ...options,
    };

    this.pageNumber = 1;
    this.totalPages = 0;

    // ✅ Phase 4: Dynamic Pagination State
    this.isPaginating = false; // Pagination lock (semaphore)
    this.paginationQueue = []; // Queue for delayed pagination requests
    this.dirtyPages = new Set(); // Pages marked as edited (need re-pagination)
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
      this.renderSection = withErrorBoundary(
        originalRenderSection,
        'DocumentRenderer.renderSection',
        null
      );
    }

    if (typeof this.checkPagination === 'function') {
      const originalCheckPagination = this.checkPagination.bind(this);
      this.checkPagination = withErrorBoundary(
        originalCheckPagination,
        'DocumentRenderer.checkPagination',
        false
      );
    }

    if (typeof this.autoPaginateContent === 'function') {
      const originalAutoPaginate = this.autoPaginateContent.bind(this);
      this.autoPaginateContent = withErrorBoundary(
        originalAutoPaginate,
        'DocumentRenderer.autoPaginateContent',
        0
      );
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

      // ✅ Phase 2-2: 미주 수집 (문서 말미 단일 영역에 표시)
      const allEndnotes = [];

      // Render each section
      for (const section of hwpxDoc.sections) {
        const sectionStartPage = this.pageNumber;

        const pageDiv = this.createPageContainer(section, this.pageNumber);

        // 페이지 설정 적용
        this.applyPageSettings(pageDiv, section);

        // 다단 레이아웃 적용
        this.applyMultiColumnLayout(pageDiv, section);

        // 홀수/짝수 페이지 판별
        const isOddPage = this.pageNumber % 2 === 1;

        // ✅ v2.2.12: 페이지 배경 적용
        this.applyPageBackground(pageDiv, section, hwpxDoc.images, isOddPage);

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

        // ✅ Phase 2-2: 섹션 페이지들에 각주 영역 주입
        // 이 시점에서 sectionStartPage..this.pageNumber 가 이 섹션이 차지한 페이지 범위.
        if (section.footnotes && section.footnotes.length > 0) {
          this._attachFootnoteAreasForSection(section, sectionStartPage, this.pageNumber + 1);
        }

        // ✅ Phase 2-2: 미주 누적
        if (section.endnotes && section.endnotes.length > 0) {
          allEndnotes.push(...section.endnotes);
        }

        // 테이블 디버그 (개발 모드)
        this.debugTables(pageDiv);

        this.pageNumber++;
      }

      this.totalPages = this.pageNumber - 1;

      // ✅ Phase 2-2: 문서 말미에 미주 영역 한 번만 추가
      if (allEndnotes.length > 0) {
        const endnoteArea = renderEndnoteArea(allEndnotes);
        if (endnoteArea) {
          const pages = this.container.querySelectorAll('.hwp-page-container');
          const lastPage = pages[pages.length - 1];
          if (lastPage) {
            lastPage.appendChild(endnoteArea);
          } else {
            this.container.appendChild(endnoteArea);
          }
        }
      }

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

    if (
      section.pageSettings &&
      (section.pageSettings.marginLeft ||
        section.pageSettings.marginRight ||
        section.pageSettings.marginTop ||
        section.pageSettings.marginBottom)
    ) {
      const padding = `${section.pageSettings.marginTop || defaultPadding} ${section.pageSettings.marginRight || defaultPadding} ${section.pageSettings.marginBottom || defaultPadding} ${section.pageSettings.marginLeft || defaultPadding}`;
      pageDiv.style.padding = padding;
    } else {
      pageDiv.style.padding = defaultPadding;
    }
  }

  /**
   * ✅ v2.2.12: 페이지 배경 적용 (이미지, 색상, 그라데이션)
   * @param {HTMLElement} pageDiv - 페이지 요소
   * @param {Object} section - 섹션 정보
   * @param {Map} images - 이미지 맵
   * @param {boolean} isOddPage - 홀수 페이지 여부
   * @private
   */
  applyPageBackground(pageDiv, section, images, isOddPage) {
    if (!section.pageBackground) return;

    // Helper to check if bgInfo has actual fill content
    const hasActualFill = bg => bg && (bg.backgroundImage || bg.backgroundColor || bg.gradientCSS);

    // Determine which background to use based on page type
    // Use specific page type if it has actual fill, otherwise fall back to 'both'
    let bgInfo = isOddPage ? section.pageBackground.odd : section.pageBackground.even;
    if (!hasActualFill(bgInfo)) bgInfo = section.pageBackground.both;
    if (!hasActualFill(bgInfo)) return;

    // Apply background image (highest priority)
    if (bgInfo.backgroundImage && images) {
      const binaryItemIDRef = bgInfo.backgroundImage.binaryItemIDRef;
      const mode = bgInfo.backgroundImage.mode || 'TOTAL';
      const imageData = images.get(binaryItemIDRef);

      if (imageData && imageData.url) {
        const backgroundSize =
          mode === 'TOTAL'
            ? 'cover'
            : mode === 'TILE'
              ? 'auto'
              : mode === 'CENTER'
                ? 'contain'
                : '100% 100%';
        const backgroundRepeat = mode === 'TILE' ? 'repeat' : 'no-repeat';
        const backgroundPosition = 'center';

        pageDiv.style.backgroundImage = `url(${imageData.url})`;
        pageDiv.style.backgroundSize = backgroundSize;
        pageDiv.style.backgroundRepeat = backgroundRepeat;
        pageDiv.style.backgroundPosition = backgroundPosition;

        logger.debug(`🖼️ Applied page background image: ${binaryItemIDRef} (mode: ${mode})`);
      }
    }
    // Apply gradient (second priority)
    else if (bgInfo.gradientCSS) {
      pageDiv.style.background = bgInfo.gradientCSS;
      logger.debug(`🎨 Applied page background gradient`);
    }
    // Apply solid color (third priority)
    else if (bgInfo.backgroundColor) {
      pageDiv.style.backgroundColor = bgInfo.backgroundColor;
      logger.debug(`🎨 Applied page background color: ${bgInfo.backgroundColor}`);
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
        logger.info(
          `📄 Dynamic pagination: ${createdPages} new pages created from page ${pageNum}`
        );
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
    const header =
      section.headers?.both || (isOddPage ? section.headers?.odd : section.headers?.even);

    if (header?.elements?.length > 0) {
      const headerDiv = document.createElement('div');
      headerDiv.className = 'hwp-page-header';
      headerDiv.style.position = 'absolute';
      headerDiv.style.top = '0';
      headerDiv.style.left = section.pageSettings?.marginLeft || '40px';
      headerDiv.style.right = section.pageSettings?.marginRight || '40px';
      headerDiv.style.height =
        (header.height ? `${header.height}px` : section.pageSettings?.marginTop) || '40px';
      headerDiv.style.overflow = 'visible';

      header.elements.forEach(element => {
        if (element.type === 'container') {
          headerDiv.appendChild(renderContainer(element));
        }
      });

      pageDiv.appendChild(headerDiv);
      logger.debug(
        `📄 Header rendered for page ${this.pageNumber} (${isOddPage ? 'ODD' : 'EVEN'})`
      );
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
      BOTTOM_CENTER: { bottom: '10px', left: '50%', transform: 'translateX(-50%)' },
      BOTH_CENTER: { bottom: '10px', left: '50%', transform: 'translateX(-50%)' },
      BOTTOM_LEFT: { bottom: '10px', left: '20px' },
      BOTTOM_RIGHT: { bottom: '10px', right: '20px' },
      TOP_CENTER: { top: '10px', left: '50%', transform: 'translateX(-50%)' },
      TOP_LEFT: { top: '10px', left: '20px' },
      TOP_RIGHT: { top: '10px', right: '20px' },
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
    const footer =
      section.footers?.both || (isOddPage ? section.footers?.odd : section.footers?.even);

    if (footer?.elements?.length > 0) {
      const footerDiv = document.createElement('div');
      footerDiv.className = 'hwp-page-footer';
      footerDiv.style.position = 'absolute';
      footerDiv.style.bottom = '0';
      footerDiv.style.left = section.pageSettings?.marginLeft || '40px';
      footerDiv.style.right = section.pageSettings?.marginRight || '40px';
      footerDiv.style.height =
        (footer.height ? `${footer.height}px` : section.pageSettings?.marginBottom) || '40px';
      footerDiv.style.overflow = 'visible';

      footer.elements.forEach(element => {
        if (element.type === 'container') {
          footerDiv.appendChild(renderContainer(element));
        }
      });

      pageDiv.appendChild(footerDiv);
      logger.debug(
        `📄 Footer rendered for page ${this.pageNumber} (${isOddPage ? 'ODD' : 'EVEN'})`
      );
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

          // ✅ v2.2.12: Replace inline table placeholders inside shape's drawText
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
   * 요소의 height/margin metrics를 측정하고 캐시에서 가져오기
   * ✅ Perf: read/write 분리 - layout thrashing 방지
   * @param {HTMLElement} element - 측정 대상
   * @param {WeakMap} [cache] - 한 번의 pagination 사이클 내 측정 캐시
   * @returns {{height:number, marginTop:number, marginBottom:number}}
   * @private
   */
  _measureElement(element, cache) {
    if (!element) return { height: 0, marginTop: 0, marginBottom: 0 };

    if (cache) {
      const cached = cache.get(element);
      if (cached) return cached;
    }

    // ⚠️ 단일 read 시점: offsetHeight + getComputedStyle을 연속 호출하여
    // 브라우저 layout flush 1회로 완료시킨다.
    const computedStyle = window.getComputedStyle(element);
    const metrics = {
      height: element.offsetHeight,
      marginTop: parseFloat(computedStyle.marginTop) || 0,
      marginBottom: parseFloat(computedStyle.marginBottom) || 0,
    };

    if (cache) {
      cache.set(element, metrics);
    }
    return metrics;
  }

  /**
   * 정확한 요소 높이 계산 (margin collapse 고려)
   * ✅ Phase 3: Margin collapse를 고려한 정확한 높이 계산
   * ✅ Perf: 측정 캐시 지원으로 layout reflow 횟수 절감
   * @param {HTMLElement} element - 높이를 계산할 요소
   * @param {WeakMap} [cache] - 측정 캐시 (없으면 즉시 측정)
   * @returns {number} margin을 포함한 전체 높이
   * @private
   */
  _getElementTotalHeight(element, cache) {
    if (!element) return 0;

    const metrics = this._measureElement(element, cache);

    // ✅ Margin collapse 고려
    // 다음 형제와의 margin collapse를 Math.max로 근사
    const nextSibling = element.nextElementSibling;
    let effectiveMarginBottom = metrics.marginBottom;

    if (nextSibling) {
      const nextMetrics = this._measureElement(nextSibling, cache);
      // Margin collapse: 인접 margin 중 큰 값만 적용됨
      effectiveMarginBottom =
        Math.max(metrics.marginBottom, nextMetrics.marginTop) - nextMetrics.marginTop;
    }

    return metrics.height + metrics.marginTop + effectiveMarginBottom;
  }

  /**
   * ✅ Phase 2-2: 섹션의 페이지들에 각주 영역을 주입
   * 각 페이지에서 참조된 footnote 번호만 모아서 그 페이지 하단에 표시.
   * 어떤 페이지에도 매칭되지 않은(번호 누락 등) 각주는 섹션 마지막 페이지에 폴백.
   * @param {Object} section - 섹션 객체 (footnotes 포함)
   * @param {number} startPageNum - 섹션 시작 페이지 번호
   * @param {number} endPageNumExclusive - 섹션 종료 페이지 번호 (다음 섹션 시작)
   * @private
   */
  _attachFootnoteAreasForSection(section, startPageNum, endPageNumExclusive) {
    if (!section?.footnotes || section.footnotes.length === 0) return;

    // 번호 → 각주 객체 맵
    const noteByNumber = new Map();
    const noteByIndex = [];
    section.footnotes.forEach((note, idx) => {
      noteByIndex.push(note);
      const key = note.number != null && note.number !== '' ? String(note.number) : null;
      if (key && !noteByNumber.has(key)) {
        noteByNumber.set(key, note);
      }
    });
    const used = new Set();

    // 섹션 페이지 순회 (현재 페이지 번호 미만까지)
    for (let p = startPageNum; p < endPageNumExclusive; p++) {
      const pageDiv = this.container.querySelector(`.hwp-page-container[data-page-number="${p}"]`);
      if (!pageDiv) continue;

      // 페이지에서 참조된 각주 번호 추출
      const refs = pageDiv.querySelectorAll('.hwp-fn-ref a');
      if (refs.length === 0) continue;

      const pageNotes = [];
      const seenOnPage = new Set();
      refs.forEach(a => {
        // id 는 fnref-N 형식
        const id = a.id || '';
        const match = id.match(/^fnref-(.+)$/);
        const num = match ? match[1] : null;
        if (num && !seenOnPage.has(num) && noteByNumber.has(num)) {
          pageNotes.push(noteByNumber.get(num));
          seenOnPage.add(num);
          used.add(noteByNumber.get(num));
        }
      });

      if (pageNotes.length > 0) {
        const area = renderFootnoteArea(pageNotes);
        if (area) pageDiv.appendChild(area);
      }
    }

    // 매칭되지 않은 각주는 섹션 마지막 페이지에 폴백
    const leftover = noteByIndex.filter(n => !used.has(n));
    if (leftover.length > 0) {
      const lastPage = this.container.querySelector(
        `.hwp-page-container[data-page-number="${endPageNumExclusive - 1}"]`
      );
      if (lastPage) {
        const area = renderFootnoteArea(leftover);
        if (area) lastPage.appendChild(area);
      }
    }
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
  _splitLargeTable(tableWrapper, currentPage, maxHeight, section, measureCache) {
    const table = tableWrapper.querySelector('.hwp-table');
    if (!table) return 0;

    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return 0;

    // ✅ Perf: 행 높이를 한 번의 read 패스로 모두 측정 (layout flush 1회)
    // 분할/append 작업 전에 측정을 끝내야 layout thrashing이 발생하지 않는다.
    const rowHeights = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      rowHeights[i] = rows[i].offsetHeight;
    }
    const tableWrapperHeight = tableWrapper.offsetHeight;

    logger.info(`📊 Splitting large table (${rows.length} rows, ${tableWrapperHeight}px total)`);

    let createdPages = 0;
    let currentTablePage = currentPage;

    // 현재 페이지의 사용된 공간 계산 (캐시 활용)
    const usedHeight = Array.from(currentPage.children)
      .filter(el => el !== tableWrapper)
      .reduce((sum, el) => sum + this._getElementTotalHeight(el, measureCache), 0);
    let remainingHeight = maxHeight - usedHeight;

    // ✅ Phase 2-5: 다중 헤더 행 감지
    //   - <thead> 안의 행 또는 data-header-row="true" / <th> 셀이 있는 행을
    //     모두 헤더로 간주하고, 새 페이지마다 반복 삽입한다.
    //   - 헤더 행은 표의 첫 부분에서만 연속적으로 수집한다.
    const headerRows = [];
    const headerHeights = [];
    let headerEndIndex = 0;
    const thead = table.querySelector('thead');
    if (thead) {
      const theadRows = Array.from(thead.querySelectorAll('tr'));
      theadRows.forEach(tr => {
        const idx = rows.indexOf(tr);
        if (idx !== -1) {
          headerRows.push(tr);
          headerHeights.push(rowHeights[idx]);
        }
      });
      headerEndIndex = theadRows.length;
    } else {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.getAttribute('data-header-row') === 'true' || r.querySelector('th')) {
          headerRows.push(r);
          headerHeights.push(rowHeights[i]);
          headerEndIndex = i + 1;
        } else {
          break;
        }
      }
    }
    const totalHeaderHeight = headerHeights.reduce((s, h) => s + h, 0);

    // ✅ Perf (B): 빈 골격(table 자체) + 헤더 행 클론을 1회만 만들고 재사용
    // 매 페이지마다 table.cloneNode + headerRow.cloneNode를 반복하지 않는다.
    const skeletonTable = table.cloneNode(false);
    skeletonTable.innerHTML = '';
    const headerClonePrototypes = headerRows.map(r => r.cloneNode(true));
    const wrapperSkeleton = tableWrapper.cloneNode(false);

    // 새 표 생성 함수 (캐시된 골격/헤더 재사용).
    // - 원본 페이지에서는 헤더가 이미 본문에 포함되어 있으므로 다시 넣지 않음.
    // - 분할 페이지에서는 thead 를 만들고 헤더 행을 모두 복제 삽입.
    const createTableClone = isSplitPage => {
      const newTable = skeletonTable.cloneNode(false);
      if (isSplitPage && headerClonePrototypes.length > 0) {
        const newThead = document.createElement('thead');
        headerClonePrototypes.forEach(proto => {
          newThead.appendChild(proto.cloneNode(true));
        });
        newTable.appendChild(newThead);
        // 본문 행을 받을 tbody 생성
        const newTbody = document.createElement('tbody');
        newTable.appendChild(newTbody);
      } else {
        // 본문 데이터를 받을 tbody (분할 첫 페이지)
        const newTbody = document.createElement('tbody');
        newTable.appendChild(newTbody);
      }
      return newTable;
    };

    // 분할 첫 표는 헤더가 이미 본문에 들어있는 currentPage 위치에 그대로 둘 수 없으므로,
    // 동일한 구조로 새로 만들면서 헤더+데이터를 함께 채운다.
    let currentClone = createTableClone(false);
    const newWrapper = wrapperSkeleton.cloneNode(false);
    newWrapper.appendChild(currentClone);
    currentTablePage.appendChild(newWrapper);

    // 첫 페이지에도 헤더 행은 표시되어야 한다 → thead 만들어서 복제 삽입
    if (headerClonePrototypes.length > 0) {
      const firstThead = document.createElement('thead');
      headerClonePrototypes.forEach(proto => firstThead.appendChild(proto.cloneNode(true)));
      // tbody 앞에 삽입
      currentClone.insertBefore(firstThead, currentClone.firstChild);
    }

    let currentTableHeight = totalHeaderHeight;
    const dataRows = rows.slice(headerEndIndex);
    const dataRowHeights = rowHeights.slice(headerEndIndex);

    const getTbody = tbl => tbl.querySelector('tbody') || tbl;

    dataRows.forEach((row, index) => {
      // ✅ Perf: 사전 측정값 사용 (offsetHeight 재호출 없음)
      const rowHeight = dataRowHeights[index];

      // 페이지 넘침 시 새 페이지 생성
      if (currentTableHeight + rowHeight > remainingHeight && currentTableHeight > 0) {
        logger.debug(
          `  📄 Table split at row ${index} (${currentTableHeight}px used, ${rowHeight}px needed)`
        );

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

        // 새 표 시작 - ✅ Phase 2-5: 분할 페이지마다 헤더 복제 (다중 헤더 행 지원)
        currentClone = createTableClone(true);
        const newTableWrapper = wrapperSkeleton.cloneNode(false);
        newTableWrapper.appendChild(currentClone);
        newPage.appendChild(newTableWrapper);

        currentTablePage = newPage;
        currentTableHeight = totalHeaderHeight; // 헤더 높이부터 시작
        remainingHeight = maxHeight;
        createdPages++;
      }

      // 행 추가 (tbody 안으로)
      const rowClone = row.cloneNode(true);
      getTbody(currentClone).appendChild(rowClone);
      currentTableHeight += rowHeight;
    });

    logger.info(
      `✅ Table split into ${createdPages + 1} pages (header rows: ${headerRows.length})`
    );

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
    let maxContentHeight = pageDiv.clientHeight - paddingTop - paddingBottom;

    // ✅ Phase 2-2: 섹션에 각주가 있다면 각주 영역 공간을 미리 예약
    if (section?.footnotes && section.footnotes.length > 0) {
      maxContentHeight = Math.max(0, maxContentHeight - FOOTNOTE_AREA_RESERVE_PX);
    }

    logger.debug(
      `📐 Auto-pagination: clientHeight=${pageDiv.clientHeight}px, padding=${paddingTop + paddingBottom}px, maxContent=${maxContentHeight}px`
    );

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
      logger.debug(
        `📄 No pagination needed: overflow=${overflow}px (within ${ALLOWED_OVERFLOW}px tolerance)`
      );
      return 0;
    }

    if (hasPageBreaks) {
      logger.debug(`📄 Auto-paginating: ${elementsWithBreak.length} forced page break(s) detected`);
    } else {
      logger.debug(
        `📄 Auto-paginating: content=${contentHeight}px > client=${clientHeight}px (overflow=${contentHeight - clientHeight}px)`
      );
    }

    // 헤더, 푸터, 페이지 번호를 제외한 본문 요소만 추출
    const elements = Array.from(pageDiv.children).filter(
      el =>
        !el.classList.contains('hwp-page-header') &&
        !el.classList.contains('hwp-page-footer') &&
        !el.classList.contains('hwp-page-number')
    );

    // ✅ Perf (A): 한 번의 read 패스로 모든 요소의 height/margin을 사전 측정.
    //   - 이후 분할 결정/이동 단계에서 element.offsetHeight/getComputedStyle 호출 회피
    //   - WeakMap이므로 GC에 영향 없음; 캐시는 본 함수 호출 동안에만 유효
    const measureCache = new WeakMap();
    for (let i = 0; i < elements.length; i++) {
      this._measureElement(elements[i], measureCache);
    }

    // 페이지 배열
    const pages = [pageDiv];
    let currentPage = pageDiv;
    let currentHeight = 0;
    let pageCount = 0;

    elements.forEach(element => {
      const hasPageBreak = element.hasAttribute('data-page-break');

      // ✅ Phase 3: margin collapse를 고려한 정확한 높이 계산 (캐시 활용)
      const elementTotalHeight = this._getElementTotalHeight(element, measureCache);

      // ✅ Phase 3: 표의 경우 특별 처리
      const isTable = element.classList.contains('hwp-table-wrapper');
      const remainingSpace = maxContentHeight - currentHeight;

      // ✅ Phase 3: 페이지보다 큰 요소 처리
      if (elementTotalHeight > maxContentHeight * 0.95) {
        logger.warn(
          `⚠️ Element too large for page (${elementTotalHeight.toFixed(1)}px > ${maxContentHeight}px)`
        );

        // ✅ Phase 3: 표인 경우 행 단위 분할 시도
        if (isTable) {
          const splitPages = this._splitLargeTable(
            element,
            currentPage,
            maxContentHeight,
            section,
            measureCache
          );
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
      const threshold = 0.9;
      const canFitPartially = isTable && remainingSpace > elementTotalHeight * threshold;

      // 페이지 나누기 필요 여부
      if (
        (hasPageBreak ||
          (currentHeight + elementTotalHeight > maxContentHeight && !canFitPartially)) &&
        currentHeight > 0
      ) {
        if (hasPageBreak) {
          logger.debug(`  📄 Forced page break detected on element`);
        } else if (canFitPartially) {
          logger.debug(
            `  📄 Table kept on current page: remaining=${remainingSpace.toFixed(1)}px, table=${elementTotalHeight.toFixed(1)}px (${((remainingSpace / elementTotalHeight) * 100).toFixed(0)}% fits)`
          );
        } else {
          logger.debug(
            `  📄 Breaking page: current=${currentHeight.toFixed(1)}px + element=${elementTotalHeight.toFixed(1)}px > max=${maxContentHeight}px`
          );
        }

        // 새 페이지 생성
        const newPage = document.createElement('div');
        newPage.className = 'hwp-page-container';
        newPage.setAttribute('data-page-number', currentPageNum + pageCount + 1);
        newPage.style.position = 'relative';

        // 원본 페이지의 스타일 복사
        newPage.style.width = pageDiv.style.width;
        newPage.style.height = pageDiv.style.height;
        newPage.style.boxSizing = pageDiv.style.boxSizing;
        newPage.style.padding = pageDiv.style.padding;

        // 섹션 데이터 연결 (재귀 pagination에 필요)
        newPage._section = section;

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

      // ✅ Perf (A/C): 요소 콘텐츠가 변하지 않았으므로 사전 측정 캐시를 재사용한다.
      //   기존 코드는 매 이동마다 offsetHeight + getComputedStyle x2를 호출해
      //   강제 layout reflow를 일으켰음(요소 N개 = reflow N회).
      //   margin top+bottom 단순 합산은 부모 컨텍스트와 무관하므로 캐시값으로 동일 결과.
      //   (margin collapse는 _getElementTotalHeight가 사전 측정 단계에서 이미 보수적으로 처리)
      const actualMetrics = this._measureElement(element, measureCache);
      const actualTotalHeight =
        actualMetrics.height + actualMetrics.marginTop + actualMetrics.marginBottom;

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
        logger.debug(
          `  🔄 Page ${currentPageNum + index + 1} needs further splitting (overflow: ${overflow.toFixed(1)}px, depth: ${recursionDepth + 1})`
        );

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
        logger.warn(
          `⚠️  Page ${currentPageNum + index}: overflow still detected (${overflow.toFixed(1)}px, exceeds ${ALLOWED_OVERFLOW}px tolerance)`
        );
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
          isVisible: table.offsetWidth > 0 ? '✅ VISIBLE' : '❌ COLLAPSED',
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
    clearImageCache();
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
