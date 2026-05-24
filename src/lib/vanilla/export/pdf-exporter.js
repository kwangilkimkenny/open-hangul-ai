/**
 * PDF Exporter (Vanilla) - HWPX를 PDF로 내보내기
 *
 * 내부적으로 `lib/pdf/exporter.ts`의 html2canvas + jsPDF 파이프라인을
 * 동적으로 import해서 사용한다. html2pdf.js 전역 의존을 제거했고,
 * 한글 폰트 임베드 문제는 캔버스 래스터화 경로로 우회된다.
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * PDF Exporter 클래스
 */
export class PDFExporter {
  constructor(options = {}) {
    this.options = {
      filename: 'document.pdf',
      margin: 10, // mm
      format: 'a4',
      orientation: 'portrait', // portrait, landscape
      quality: 2, // 1-5 (jsPDF 스케일링)
      ...options,
    };

    logger.info('PDFExporter initialized');
  }

  /**
   * 라이브러리 옵션 → 내부 exporter 옵션으로 매핑한다.
   */
  _mapOptions(options) {
    const formatMap = { a4: 'A4', letter: 'Letter', legal: 'Legal' };
    const pageSize = formatMap[String(options.format || 'a4').toLowerCase()] || 'A4';
    // quality(1-5) → scale(1-4), JPEG quality는 0.85로 고정
    const scale = Math.max(1, Math.min(4, Math.round(Number(options.quality) || 2)));
    return {
      fileName: options.filename || 'document.pdf',
      pageSize,
      orientation: options.orientation === 'landscape' ? 'landscape' : 'portrait',
      margin: Number(options.margin) || 10,
      quality: 0.92,
      scale,
    };
  }

  /**
   * HTML 요소를 PDF로 변환
   * @param {HTMLElement} element - 변환할 HTML 요소
   * @param {Object} customOptions - 커스텀 옵션
   */
  async exportToPDF(element, customOptions = {}) {
    if (!element) {
      throw new Error('Element is required for PDF export');
    }

    const merged = { ...this.options, ...customOptions };
    const mapped = this._mapOptions(merged);

    try {
      logger.info(`Exporting to PDF: ${mapped.fileName}`);
      const { exportToPDF } = await import('../../pdf/exporter');
      await exportToPDF(element, mapped);
      logger.info('PDF export completed successfully');
      return true;
    } catch (error) {
      logger.error(`PDF export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 문서 전체를 PDF로 내보내기
   * @param {string} selector - 문서 컨테이너 셀렉터
   */
  async exportDocument(selector = '#contentArea') {
    let element = document.querySelector(selector);

    // .hwp-page-container 셀렉터로 들어오면 부모를 잡아야 모든 페이지가 잡힌다
    if (element && selector.includes('hwp-page') && element.parentElement) {
      element = element.parentElement;
    }

    if (!element) {
      // 폴백: 일반적으로 자주 쓰이는 컨테이너들을 순서대로 시도
      for (const sel of ['.document-viewer', '.hwp-page-container', '.hwp-page']) {
        const el = document.querySelector(sel);
        if (el) {
          element = sel.includes('hwp-page') && el.parentElement ? el.parentElement : el;
          break;
        }
      }
    }

    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    return this.exportToPDF(element);
  }

  /**
   * 특정 페이지만 PDF로 내보내기
   * @param {number[]} pageNumbers - 페이지 번호 배열
   */
  async exportPages(pageNumbers, containerSelector = '#contentArea') {
    const container = document.querySelector(containerSelector);

    if (!container) {
      throw new Error(`Container not found: ${containerSelector}`);
    }

    // 임시 컨테이너 생성
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    try {
      // 선택된 페이지만 복사
      pageNumbers.forEach(pageNum => {
        const page = container.querySelector(`[data-page="${pageNum}"]`);
        if (page) {
          tempContainer.appendChild(page.cloneNode(true));
        }
      });

      await this.exportToPDF(tempContainer, {
        filename: `pages_${pageNumbers.join('_')}.pdf`,
      });
    } finally {
      // 임시 컨테이너 제거
      document.body.removeChild(tempContainer);
    }
  }
}

/**
 * 간단한 PDF 내보내기 헬퍼 함수
 */
export async function exportToPDF(elementOrSelector, options = {}) {
  const exporter = new PDFExporter(options);

  if (typeof elementOrSelector === 'string') {
    return exporter.exportDocument(elementOrSelector);
  } else {
    return exporter.exportToPDF(elementOrSelector, options);
  }
}

export default PDFExporter;
