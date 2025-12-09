/**
 * PdfExporter 단위 테스트
 * 
 * @module lib/export/pdf-exporter.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PdfExporter, exportToPdf } from './pdf-exporter';

describe('PdfExporter', () => {
  let exporter: PdfExporter;
  let mockElement: HTMLDivElement;

  beforeEach(() => {
    exporter = new PdfExporter();
    mockElement = document.createElement('div');
    mockElement.innerHTML = '<p>Test content</p>';
    document.body.appendChild(mockElement);
    
    // Mock window.print
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.removeChild(mockElement);
    vi.clearAllMocks();
  });

  // ===========================
  // 생성자 테스트
  // ===========================
  describe('constructor', () => {
    it('기본 옵션으로 인스턴스가 생성되어야 합니다', () => {
      const pdf = new PdfExporter();
      expect(pdf).toBeInstanceOf(PdfExporter);
    });

    it('커스텀 옵션을 적용해야 합니다', () => {
      const pdf = new PdfExporter({
        filename: 'custom.pdf',
        margin: 20,
        format: 'letter',
        orientation: 'landscape'
      });
      expect(pdf).toBeInstanceOf(PdfExporter);
    });
  });

  // ===========================
  // isHtml2PdfAvailable 테스트
  // ===========================
  describe('isHtml2PdfAvailable', () => {
    it('html2pdf가 없으면 false를 반환해야 합니다', () => {
      expect(exporter.isHtml2PdfAvailable()).toBe(false);
    });

    it('html2pdf가 있으면 true를 반환해야 합니다', () => {
      (window as any).html2pdf = vi.fn(() => ({
        set: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        save: vi.fn().mockResolvedValue(undefined)
      }));
      
      expect(exporter.isHtml2PdfAvailable()).toBe(true);
      
      delete (window as any).html2pdf;
    });
  });

  // ===========================
  // exportToPdf 테스트
  // ===========================
  describe('exportToPdf', () => {
    it('요소 없이 호출하면 에러를 던져야 합니다', async () => {
      await expect(
        exporter.exportToPdf(null as unknown as HTMLElement)
      ).rejects.toThrow('PDF로 변환할 요소가 필요합니다');
    });

    it('html2pdf 없이도 print 방식으로 작동해야 합니다', async () => {
      const result = await exporter.exportToPdf(mockElement);
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('print');
      expect(window.print).toHaveBeenCalled();
    });

    it('.pdf 확장자가 없으면 추가해야 합니다', async () => {
      const result = await exporter.exportToPdf(mockElement, {
        filename: 'no-extension'
      });
      
      expect(result.filename).toBe('no-extension.pdf');
    });

    it('html2pdf가 있으면 사용해야 합니다', async () => {
      const mockHtml2Pdf = vi.fn(() => ({
        set: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        save: vi.fn().mockResolvedValue(undefined)
      }));
      (window as any).html2pdf = mockHtml2Pdf;
      
      const result = await exporter.exportToPdf(mockElement);
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('html2pdf');
      expect(mockHtml2Pdf).toHaveBeenCalled();
      
      delete (window as any).html2pdf;
    });

    it('커스텀 옵션을 적용해야 합니다', async () => {
      const result = await exporter.exportToPdf(mockElement, {
        filename: 'custom.pdf',
        format: 'letter',
        orientation: 'landscape'
      });
      
      expect(result.filename).toBe('custom.pdf');
    });
  });

  // ===========================
  // exportDocument 테스트
  // ===========================
  describe('exportDocument', () => {
    it('셀렉터로 요소를 찾아야 합니다', async () => {
      mockElement.className = 'test-container';
      
      const result = await exporter.exportDocument('.test-container');
      
      expect(result.success).toBe(true);
    });

    it('요소를 찾지 못하면 에러를 던져야 합니다', async () => {
      await expect(
        exporter.exportDocument('.non-existent-selector')
      ).rejects.toThrow('요소를 찾을 수 없습니다');
    });

    it('기본 셀렉터를 사용해야 합니다', async () => {
      const viewer = document.createElement('div');
      viewer.className = 'document-viewer';
      document.body.appendChild(viewer);
      
      const result = await exporter.exportDocument();
      
      expect(result.success).toBe(true);
      
      document.body.removeChild(viewer);
    });
  });

  // ===========================
  // exportPages 테스트
  // ===========================
  describe('exportPages', () => {
    it('특정 페이지만 내보내야 합니다', async () => {
      const container = document.createElement('div');
      container.className = 'pages-container';
      
      const page1 = document.createElement('div');
      page1.setAttribute('data-page', '1');
      page1.textContent = 'Page 1';
      
      const page2 = document.createElement('div');
      page2.setAttribute('data-page', '2');
      page2.textContent = 'Page 2';
      
      container.appendChild(page1);
      container.appendChild(page2);
      document.body.appendChild(container);
      
      const result = await exporter.exportPages([1], '.pages-container');
      
      expect(result.success).toBe(true);
      expect(result.filename).toContain('pages_1');
      
      document.body.removeChild(container);
    });

    it('컨테이너를 찾지 못하면 에러를 던져야 합니다', async () => {
      await expect(
        exporter.exportPages([1], '.non-existent')
      ).rejects.toThrow('컨테이너를 찾을 수 없습니다');
    });

    it('선택한 페이지가 없으면 에러를 던져야 합니다', async () => {
      const container = document.createElement('div');
      container.className = 'empty-container';
      document.body.appendChild(container);
      
      await expect(
        exporter.exportPages([99], '.empty-container')
      ).rejects.toThrow('선택한 페이지를 찾을 수 없습니다');
      
      document.body.removeChild(container);
    });

    it('다중 페이지 파일명을 생성해야 합니다', async () => {
      const container = document.createElement('div');
      container.className = 'multi-pages';
      
      [1, 2, 3].forEach(n => {
        const page = document.createElement('div');
        page.setAttribute('data-page', String(n));
        container.appendChild(page);
      });
      
      document.body.appendChild(container);
      
      const result = await exporter.exportPages([1, 2, 3], '.multi-pages');
      
      expect(result.filename).toContain('pages_1_2_3');
      
      document.body.removeChild(container);
    });
  });

  // ===========================
  // toBlob 테스트
  // ===========================
  describe('toBlob', () => {
    it('html2pdf 없이는 null을 반환해야 합니다', async () => {
      const result = await exporter.toBlob(mockElement);
      
      expect(result).toBeNull();
    });

    it('html2pdf가 있으면 Blob을 반환해야 합니다', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      const mockHtml2Pdf = vi.fn(() => ({
        set: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        toPdf: vi.fn().mockReturnThis(),
        output: vi.fn().mockResolvedValue(mockBlob)
      }));
      (window as any).html2pdf = mockHtml2Pdf;
      
      const result = await exporter.toBlob(mockElement);
      
      expect(result).toBeInstanceOf(Blob);
      
      delete (window as any).html2pdf;
    });
  });

  // ===========================
  // exportToPdf 헬퍼 함수 테스트
  // ===========================
  describe('exportToPdf helper', () => {
    it('문자열 셀렉터를 처리해야 합니다', async () => {
      mockElement.className = 'helper-test';
      
      const result = await exportToPdf('.helper-test');
      
      expect(result.success).toBe(true);
    });

    it('HTMLElement를 처리해야 합니다', async () => {
      const result = await exportToPdf(mockElement);
      
      expect(result.success).toBe(true);
    });
  });
});

