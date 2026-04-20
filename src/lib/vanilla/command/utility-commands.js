/**
 * Utility Commands Module
 * 공통 유틸리티 명령들
 *
 * @module command/utility-commands
 * @version 1.0.0
 * @author Kwang-il Kim (김광일) <yatav@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 유틸리티 명령 클래스
 */
export class UtilityCommands {
  constructor(viewer) {
    this.viewer = viewer;
    this.historyManager = viewer.historyManager;
    this.positionManager = viewer.positionManager;
    this.rangeManager = viewer.rangeManager;
  }

  /**
   * 뷰어 줌 인
   * @param {number} factor - 줌 배율 (기본값: 1.2)
   */
  executeZoomIn(factor = 1.2) {
    try {
      const currentZoom = this.viewer.getZoom();
      const newZoom = Math.min(currentZoom * factor, 5.0); // 최대 500%

      this.viewer.setZoom(newZoom);
      logger.debug('Zoom in', { currentZoom, newZoom, factor });
    } catch (error) {
      logger.error('Failed to zoom in', error);
      throw error;
    }
  }

  /**
   * 뷰어 줌 아웃
   * @param {number} factor - 줌 배율 (기본값: 0.8)
   */
  executeZoomOut(factor = 0.8) {
    try {
      const currentZoom = this.viewer.getZoom();
      const newZoom = Math.max(currentZoom * factor, 0.1); // 최소 10%

      this.viewer.setZoom(newZoom);
      logger.debug('Zoom out', { currentZoom, newZoom, factor });
    } catch (error) {
      logger.error('Failed to zoom out', error);
      throw error;
    }
  }

  /**
   * 줌을 기본값으로 설정
   */
  executeZoomReset() {
    try {
      this.viewer.setZoom(1.0);
      logger.debug('Zoom reset to 100%');
    } catch (error) {
      logger.error('Failed to reset zoom', error);
      throw error;
    }
  }

  /**
   * 페이지에 맞춰 줌 설정
   */
  executeZoomToFit() {
    try {
      if (this.viewer.zoomToFit) {
        this.viewer.zoomToFit();
      } else {
        // Fallback: 컨테이너 크기에 맞춰 계산
        const containerWidth = this.viewer.container.clientWidth;
        const pageWidth = this._getPageWidth();

        if (pageWidth > 0) {
          const zoom = (containerWidth - 40) / pageWidth; // 여백 20px씩
          this.viewer.setZoom(Math.max(Math.min(zoom, 5.0), 0.1));
        }
      }
      logger.debug('Zoom to fit executed');
    } catch (error) {
      logger.error('Failed to zoom to fit', error);
      throw error;
    }
  }

  /**
   * 페이지 너비에 맞춰 줌 설정
   */
  executeZoomToWidth() {
    try {
      const containerWidth = this.viewer.container.clientWidth;
      const pageWidth = this._getPageWidth();

      if (pageWidth > 0) {
        const zoom = (containerWidth - 40) / pageWidth;
        this.viewer.setZoom(Math.max(Math.min(zoom, 5.0), 0.1));
      }
      logger.debug('Zoom to width executed');
    } catch (error) {
      logger.error('Failed to zoom to width', error);
      throw error;
    }
  }

  /**
   * 페이지 이동 (다음 페이지)
   */
  executeNextPage() {
    try {
      if (this.viewer.nextPage) {
        this.viewer.nextPage();
      } else {
        const currentPage = this.viewer.getCurrentPage();
        const totalPages = this.viewer.getTotalPages();

        if (currentPage < totalPages) {
          this.viewer.setCurrentPage(currentPage + 1);
        }
      }
      logger.debug('Moved to next page');
    } catch (error) {
      logger.error('Failed to move to next page', error);
      throw error;
    }
  }

  /**
   * 페이지 이동 (이전 페이지)
   */
  executePreviousPage() {
    try {
      if (this.viewer.previousPage) {
        this.viewer.previousPage();
      } else {
        const currentPage = this.viewer.getCurrentPage();

        if (currentPage > 1) {
          this.viewer.setCurrentPage(currentPage - 1);
        }
      }
      logger.debug('Moved to previous page');
    } catch (error) {
      logger.error('Failed to move to previous page', error);
      throw error;
    }
  }

  /**
   * 특정 페이지로 이동
   * @param {number} pageNumber - 페이지 번호 (1부터 시작)
   */
  executeGoToPage(pageNumber) {
    try {
      const totalPages = this.viewer.getTotalPages();

      if (pageNumber >= 1 && pageNumber <= totalPages) {
        this.viewer.setCurrentPage(pageNumber);
        logger.debug('Moved to page', { pageNumber });
      } else {
        logger.warn('Invalid page number', { pageNumber, totalPages });
      }
    } catch (error) {
      logger.error('Failed to go to page', error);
      throw error;
    }
  }

  /**
   * 첫 페이지로 이동
   */
  executeGoToFirstPage() {
    try {
      this.executeGoToPage(1);
      logger.debug('Moved to first page');
    } catch (error) {
      logger.error('Failed to go to first page', error);
      throw error;
    }
  }

  /**
   * 마지막 페이지로 이동
   */
  executeGoToLastPage() {
    try {
      const totalPages = this.viewer.getTotalPages();
      this.executeGoToPage(totalPages);
      logger.debug('Moved to last page');
    } catch (error) {
      logger.error('Failed to go to last page', error);
      throw error;
    }
  }

  /**
   * 전체화면 토글
   */
  executeToggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        logger.debug('Exited fullscreen');
      } else {
        this.viewer.container.requestFullscreen();
        logger.debug('Entered fullscreen');
      }
    } catch (error) {
      logger.error('Failed to toggle fullscreen', error);
      throw error;
    }
  }

  /**
   * 읽기 모드 토글
   */
  executeToggleReadMode() {
    try {
      if (this.viewer.toggleReadMode) {
        this.viewer.toggleReadMode();
      } else {
        // Fallback: CSS 클래스 토글
        this.viewer.container.classList.toggle('read-mode');
      }
      logger.debug('Read mode toggled');
    } catch (error) {
      logger.error('Failed to toggle read mode', error);
      throw error;
    }
  }

  /**
   * 룰러 표시 토글
   */
  executeToggleRuler() {
    try {
      if (this.viewer.toggleRuler) {
        this.viewer.toggleRuler();
      } else {
        // Fallback: CSS 클래스 토글
        this.viewer.container.classList.toggle('show-ruler');
      }
      logger.debug('Ruler toggled');
    } catch (error) {
      logger.error('Failed to toggle ruler', error);
      throw error;
    }
  }

  /**
   * 격자 표시 토글
   */
  executeToggleGrid() {
    try {
      if (this.viewer.toggleGrid) {
        this.viewer.toggleGrid();
      } else {
        // Fallback: CSS 클래스 토글
        this.viewer.container.classList.toggle('show-grid');
      }
      logger.debug('Grid toggled');
    } catch (error) {
      logger.error('Failed to toggle grid', error);
      throw error;
    }
  }

  /**
   * 문서 정보 가져오기
   */
  executeGetDocumentInfo() {
    try {
      const document = this.viewer.getDocument();
      const info = {
        title: document?.metadata?.title || 'Untitled',
        pages: this.viewer.getTotalPages(),
        currentPage: this.viewer.getCurrentPage(),
        zoom: this.viewer.getZoom(),
        viewMode: this._getViewMode(),
        lastModified: document?.metadata?.modifiedAt,
        created: document?.metadata?.createdAt,
        size: this._getDocumentSize(document),
        wordCount: this._getWordCount(document),
        characterCount: this._getCharacterCount(document),
      };

      logger.debug('Document info retrieved', info);
      return info;
    } catch (error) {
      logger.error('Failed to get document info', error);
      return null;
    }
  }

  /**
   * 환경 설정 적용
   * @param {Object} settings - 설정 객체
   */
  executeApplySettings(settings) {
    try {
      if (settings.zoom !== undefined) {
        this.viewer.setZoom(settings.zoom);
      }

      if (settings.page !== undefined) {
        this.executeGoToPage(settings.page);
      }

      if (settings.showRuler !== undefined) {
        const hasRuler = this.viewer.container.classList.contains('show-ruler');
        if (settings.showRuler !== hasRuler) {
          this.executeToggleRuler();
        }
      }

      if (settings.showGrid !== undefined) {
        const hasGrid = this.viewer.container.classList.contains('show-grid');
        if (settings.showGrid !== hasGrid) {
          this.executeToggleGrid();
        }
      }

      if (settings.readMode !== undefined) {
        const isReadMode = this.viewer.container.classList.contains('read-mode');
        if (settings.readMode !== isReadMode) {
          this.executeToggleReadMode();
        }
      }

      logger.debug('Settings applied', settings);
    } catch (error) {
      logger.error('Failed to apply settings', error);
      throw error;
    }
  }

  /**
   * 성능 정보 가져오기
   */
  executeGetPerformanceInfo() {
    try {
      const info = {
        renderTime: this._getLastRenderTime(),
        documentSize: this._getDocumentMemoryUsage(),
        viewerMemory: this._getViewerMemoryUsage(),
        fps: this._getCurrentFPS(),
        loadTime: this._getLoadTime(),
      };

      logger.debug('Performance info retrieved', info);
      return info;
    } catch (error) {
      logger.error('Failed to get performance info', error);
      return null;
    }
  }

  /**
   * 모듈 상태 확인
   */
  getModuleStatus() {
    return {
      viewer: !!this.viewer,
      historyManager: !!this.historyManager,
      positionManager: !!this.positionManager,
      rangeManager: !!this.rangeManager,
      hasDocument: !!this.viewer?.getDocument(),
      isReady: this._isViewerReady(),
    };
  }

  /**
   * 디버그 정보 수집
   */
  executeCollectDebugInfo() {
    try {
      const debugInfo = {
        timestamp: new Date().toISOString(),
        viewer: {
          zoom: this.viewer.getZoom(),
          currentPage: this.viewer.getCurrentPage(),
          totalPages: this.viewer.getTotalPages(),
          containerSize: {
            width: this.viewer.container.clientWidth,
            height: this.viewer.container.clientHeight,
          },
        },
        document: this.executeGetDocumentInfo(),
        performance: this.executeGetPerformanceInfo(),
        modules: this.getModuleStatus(),
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
        },
        errors: this._getRecentErrors(),
      };

      logger.debug('Debug info collected', debugInfo);
      return debugInfo;
    } catch (error) {
      logger.error('Failed to collect debug info', error);
      return null;
    }
  }

  // Private helper methods

  _getPageWidth() {
    const document = this.viewer.getDocument();
    return document?.settings?.pageSize?.width || 595; // A4 default
  }

  _getViewMode() {
    if (this.viewer.container.classList.contains('read-mode')) return 'read';
    if (this.viewer.container.classList.contains('edit-mode')) return 'edit';
    return 'normal';
  }

  _getDocumentSize(document) {
    if (!document) return 0;
    return JSON.stringify(document).length;
  }

  _getWordCount(document) {
    if (!document || !document.pages) return 0;

    let wordCount = 0;
    for (const page of document.pages) {
      if (page.sections) {
        for (const section of page.sections) {
          if (section.paragraphs) {
            for (const para of section.paragraphs) {
              if (para.runs) {
                for (const run of para.runs) {
                  if (run.text) {
                    wordCount += run.text.split(/\s+/).filter(word => word.length > 0).length;
                  }
                }
              }
            }
          }
        }
      }
    }
    return wordCount;
  }

  _getCharacterCount(document) {
    if (!document || !document.pages) return 0;

    let charCount = 0;
    for (const page of document.pages) {
      if (page.sections) {
        for (const section of page.sections) {
          if (section.paragraphs) {
            for (const para of section.paragraphs) {
              if (para.runs) {
                for (const run of para.runs) {
                  if (run.text) {
                    charCount += run.text.length;
                  }
                }
              }
            }
          }
        }
      }
    }
    return charCount;
  }

  _getLastRenderTime() {
    return this.viewer._lastRenderTime || 0;
  }

  _getDocumentMemoryUsage() {
    try {
      const document = this.viewer.getDocument();
      return document ? JSON.stringify(document).length * 2 : 0; // 대략적인 메모리 사용량
    } catch {
      return 0;
    }
  }

  _getViewerMemoryUsage() {
    try {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
        };
      }
    } catch {
      // Performance API를 지원하지 않는 브라우저
    }
    return null;
  }

  _getCurrentFPS() {
    return this.viewer._currentFPS || 60;
  }

  _getLoadTime() {
    return this.viewer._loadTime || 0;
  }

  _isViewerReady() {
    return !!(this.viewer && this.viewer.getDocument() && this.viewer.container);
  }

  _getRecentErrors() {
    // 최근 에러 로그 (실제 구현에서는 에러 추적 시스템에서 가져옴)
    return [];
  }
}

export default UtilityCommands;
