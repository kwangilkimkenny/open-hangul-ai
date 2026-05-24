/**
 * PDF Exporter (Header/Toolbar 어댑터)
 *
 * 실제 구현은 `lib/pdf/exporter.ts` 의 html2canvas + jsPDF 기반 파이프라인을
 * 그대로 사용한다. 한글 폰트는 브라우저 렌더링 단계에서 캔버스로 래스터화되어
 * 별도 폰트 임베드 없이 안전하게 출력된다.
 *
 * @module lib/export/pdf-exporter
 * @version 2.0.0
 */

import { exportToPDF, exportToPDFBlob } from '../pdf/exporter';

export interface PdfExportOptions {
  filename?: string;
  pageSize?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margin?: number; // mm
  quality?: number; // 0-1
  scale?: number;
}

export interface PdfExportResult {
  filename: string;
  /** 항상 'download' 이지만 호출 측 호환을 위해 유니온으로 둔다. */
  method: 'download' | 'print';
  blob?: Blob;
}

const DEFAULT_SELECTORS = ['.document-viewer', '.hwp-page-container', '.hwp-page'];

function resolveContainer(selector?: string): HTMLElement {
  const candidates = selector ? [selector, ...DEFAULT_SELECTORS] : DEFAULT_SELECTORS;
  for (const sel of candidates) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) {
      // .hwp-page-container 류면 부모를 container 로 잡아야 모든 페이지가 잡힌다
      if (sel.includes('hwp-page') && el.parentElement) {
        return el.parentElement;
      }
      return el;
    }
  }
  throw new Error('PDF로 내보낼 문서 컨테이너를 찾을 수 없습니다.');
}

function normalizeFilename(name?: string): string {
  const base = (name || '문서').trim() || '문서';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * PDFExporter — Header/Toolbar 가 기대하는 인터페이스를 유지하면서
 * 내부적으로 html2canvas + jsPDF 파이프라인을 호출한다.
 */
export class PDFExporter {
  private readonly options: PdfExportOptions;

  constructor(options: PdfExportOptions = {}) {
    this.options = {
      pageSize: 'A4',
      orientation: 'portrait',
      margin: 10,
      quality: 0.95,
      scale: 2,
      ...options,
    };
  }

  /**
   * 셀렉터로 식별된 컨테이너를 PDF로 저장한다.
   * 두 번째 인자는 문자열(파일명) 또는 옵션 객체 모두 허용한다.
   */
  async exportDocument(
    selector?: string,
    optionsOrFilename?: PdfExportOptions | string
  ): Promise<PdfExportResult> {
    const opts: PdfExportOptions =
      typeof optionsOrFilename === 'string'
        ? { ...this.options, filename: optionsOrFilename }
        : { ...this.options, ...(optionsOrFilename || {}) };

    const container = resolveContainer(selector);
    const filename = normalizeFilename(opts.filename);

    await exportToPDF(container, {
      fileName: filename,
      pageSize: opts.pageSize,
      orientation: opts.orientation,
      margin: opts.margin,
      quality: opts.quality,
      scale: opts.scale,
    });

    const result: PdfExportResult = { filename, method: 'download' };
    return result;
  }

  /**
   * 임의 요소를 PDF로 저장 (다운로드)
   */
  async exportElement(
    element: HTMLElement,
    options: PdfExportOptions = {}
  ): Promise<PdfExportResult> {
    const opts = { ...this.options, ...options };
    const filename = normalizeFilename(opts.filename);
    await exportToPDF(element, {
      fileName: filename,
      pageSize: opts.pageSize,
      orientation: opts.orientation,
      margin: opts.margin,
      quality: opts.quality,
      scale: opts.scale,
    });
    const result: PdfExportResult = { filename, method: 'download' };
    return result;
  }

  /**
   * PDF Blob을 반환 (다운로드는 호출자가 수행)
   */
  async export(_document?: unknown, options: PdfExportOptions = {}): Promise<Blob> {
    const opts = { ...this.options, ...options };
    const container = resolveContainer();
    return exportToPDFBlob(container, {
      pageSize: opts.pageSize,
      orientation: opts.orientation,
      margin: opts.margin,
      quality: opts.quality,
      scale: opts.scale,
    });
  }
}

// Backward compatible aliases
export type PdfExporter = PDFExporter;
export const PdfExporter = PDFExporter;

export default PDFExporter;
