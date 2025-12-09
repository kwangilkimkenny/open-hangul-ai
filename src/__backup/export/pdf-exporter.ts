/**
 * PDF Exporter
 * 
 * HWPX 문서를 PDF로 내보내기
 * html2pdf.js 또는 window.print() 사용
 * 
 * @module lib/export/pdf-exporter
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger';

const logger = getLogger();

// html2pdf.js 타입 선언
declare global {
  interface Window {
    html2pdf?: () => Html2PdfInstance;
  }
}

interface Html2PdfInstance {
  set: (options: Html2PdfOptions) => Html2PdfInstance;
  from: (element: HTMLElement) => Html2PdfInstance;
  save: () => Promise<void>;
  toPdf: () => Html2PdfInstance;
  output: (type: string) => Promise<Blob>;
}

interface Html2PdfOptions {
  margin?: number | [number, number, number, number];
  filename?: string;
  image?: { type: string; quality: number };
  html2canvas?: { scale: number; useCORS?: boolean; logging?: boolean };
  jsPDF?: { unit: string; format: string; orientation: string };
  pagebreak?: { mode: string[] };
}

/**
 * PDF 내보내기 옵션
 */
export interface PdfExportOptions {
  filename?: string;
  margin?: number;
  format?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  quality?: number;
  scale?: number;
}

/**
 * PDF 내보내기 결과
 */
export interface PdfExportResult {
  success: boolean;
  filename: string;
  method: 'html2pdf' | 'print';
  message: string;
}

/**
 * PDF Exporter 클래스
 */
export class PdfExporter {
  private options: Required<PdfExportOptions>;

  constructor(options: PdfExportOptions = {}) {
    this.options = {
      filename: options.filename || 'document.pdf',
      margin: options.margin ?? 10,
      format: options.format || 'a4',
      orientation: options.orientation || 'portrait',
      quality: options.quality ?? 2,
      scale: options.scale ?? 2,
    };

    logger.info('📄 PdfExporter initialized');
  }

  /**
   * html2pdf.js 사용 가능 여부 확인
   */
  isHtml2PdfAvailable(): boolean {
    return typeof window.html2pdf === 'function';
  }

  /**
   * HTML 요소를 PDF로 변환
   * @param element - 변환할 HTML 요소
   * @param customOptions - 커스텀 옵션
   * @returns 내보내기 결과
   */
  async exportToPdf(
    element: HTMLElement,
    customOptions: PdfExportOptions = {}
  ): Promise<PdfExportResult> {
    if (!element) {
      throw new Error('PDF로 변환할 요소가 필요합니다.');
    }

    const options = { ...this.options, ...customOptions };
    const filename = this.ensurePdfExtension(options.filename);

    try {
      logger.info(`📄 PDF 내보내기 시작: ${filename}`);
      logger.time('PDF Export');

      // html2pdf.js 사용 시도
      if (this.isHtml2PdfAvailable()) {
        await this.exportWithHtml2Pdf(element, options, filename);
        
        logger.timeEnd('PDF Export');
        logger.info('✅ PDF 내보내기 완료 (html2pdf)');
        
        return {
          success: true,
          filename,
          method: 'html2pdf',
          message: 'PDF 파일이 성공적으로 저장되었습니다.'
        };
      }

      // html2pdf.js가 없으면 print 대화상자 사용
      logger.warn('html2pdf.js가 로드되지 않아 인쇄 대화상자를 사용합니다.');
      await this.exportWithPrint(element);
      
      logger.timeEnd('PDF Export');
      
      return {
        success: true,
        filename,
        method: 'print',
        message: '인쇄 대화상자에서 PDF로 저장하세요.'
      };

    } catch (error) {
      logger.error('❌ PDF 내보내기 실패:', error);
      throw new Error(
        `PDF 내보내기에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      );
    }
  }

  /**
   * html2pdf.js를 사용하여 PDF 생성
   */
  private async exportWithHtml2Pdf(
    element: HTMLElement,
    options: Required<PdfExportOptions>,
    filename: string
  ): Promise<void> {
    const html2pdf = window.html2pdf!;

    const pdfOptions: Html2PdfOptions = {
      margin: options.margin,
      filename,
      image: { type: 'jpeg', quality: options.quality / 5 },
      html2canvas: { 
        scale: options.scale,
        useCORS: true,
        logging: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: options.format, 
        orientation: options.orientation 
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(pdfOptions).from(element).save();
  }

  /**
   * window.print()를 사용하여 PDF 생성 (폴백)
   */
  private async exportWithPrint(element: HTMLElement): Promise<void> {
    // 프린트할 요소만 보이도록 설정
    const allElements = document.body.children;
    const originalStyles: string[] = [];

    // 다른 요소들 숨기기
    Array.from(allElements).forEach((el, idx) => {
      const htmlEl = el as HTMLElement;
      originalStyles[idx] = htmlEl.style.display;
      if (!element.contains(htmlEl) && htmlEl !== element) {
        htmlEl.style.display = 'none';
      }
    });

    // 프린트 실행
    window.print();

    // 원래 스타일 복원
    Array.from(allElements).forEach((el, idx) => {
      (el as HTMLElement).style.display = originalStyles[idx];
    });
  }

  /**
   * 문서 뷰어 영역을 PDF로 내보내기
   * @param selector - 문서 컨테이너 셀렉터
   * @param options - 내보내기 옵션
   */
  async exportDocument(
    selector: string = '.document-viewer',
    options: PdfExportOptions = {}
  ): Promise<PdfExportResult> {
    const element = document.querySelector(selector) as HTMLElement;

    if (!element) {
      throw new Error(`요소를 찾을 수 없습니다: ${selector}`);
    }

    return this.exportToPdf(element, options);
  }

  /**
   * 특정 페이지들만 PDF로 내보내기
   * @param pageNumbers - 페이지 번호 배열
   * @param containerSelector - 컨테이너 셀렉터
   * @param options - 내보내기 옵션
   */
  async exportPages(
    pageNumbers: number[],
    containerSelector: string = '.pages-container',
    options: PdfExportOptions = {}
  ): Promise<PdfExportResult> {
    const container = document.querySelector(containerSelector) as HTMLElement;

    if (!container) {
      throw new Error(`컨테이너를 찾을 수 없습니다: ${containerSelector}`);
    }

    // 임시 컨테이너 생성
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.backgroundColor = 'white';
    document.body.appendChild(tempContainer);

    try {
      // 선택된 페이지만 복사
      pageNumbers.forEach(pageNum => {
        const page = container.querySelector(`[data-page="${pageNum}"]`) as HTMLElement;
        if (page) {
          const clone = page.cloneNode(true) as HTMLElement;
          clone.style.margin = '0';
          clone.style.pageBreakAfter = 'always';
          tempContainer.appendChild(clone);
        }
      });

      // 페이지가 없으면 에러
      if (tempContainer.children.length === 0) {
        throw new Error('선택한 페이지를 찾을 수 없습니다.');
      }

      const customOptions: PdfExportOptions = {
        ...options,
        filename: options.filename || `pages_${pageNumbers.join('_')}.pdf`
      };

      return await this.exportToPdf(tempContainer, customOptions);

    } finally {
      // 임시 컨테이너 제거
      document.body.removeChild(tempContainer);
    }
  }

  /**
   * PDF Blob 반환 (다운로드 없이)
   * @param element - 변환할 HTML 요소
   * @param options - 옵션
   */
  async toBlob(
    element: HTMLElement,
    options: PdfExportOptions = {}
  ): Promise<Blob | null> {
    if (!this.isHtml2PdfAvailable()) {
      logger.warn('html2pdf.js가 필요합니다.');
      return null;
    }

    const mergedOptions = { ...this.options, ...options };
    const html2pdf = window.html2pdf!;

    const pdfOptions: Html2PdfOptions = {
      margin: mergedOptions.margin,
      image: { type: 'jpeg', quality: mergedOptions.quality / 5 },
      html2canvas: { 
        scale: mergedOptions.scale,
        useCORS: true,
        logging: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: mergedOptions.format, 
        orientation: mergedOptions.orientation 
      }
    };

    return html2pdf()
      .set(pdfOptions)
      .from(element)
      .toPdf()
      .output('blob');
  }

  /**
   * 파일명에 .pdf 확장자 보장
   */
  private ensurePdfExtension(filename: string): string {
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return filename + '.pdf';
    }
    return filename;
  }
}

/**
 * 간단한 PDF 내보내기 헬퍼 함수
 */
export async function exportToPdf(
  elementOrSelector: HTMLElement | string,
  options: PdfExportOptions = {}
): Promise<PdfExportResult> {
  const exporter = new PdfExporter(options);

  if (typeof elementOrSelector === 'string') {
    return exporter.exportDocument(elementOrSelector, options);
  } else {
    return exporter.exportToPdf(elementOrSelector, options);
  }
}

export default PdfExporter;

