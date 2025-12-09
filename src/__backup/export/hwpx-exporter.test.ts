/**
 * HwpxExporter 단위 테스트
 * 
 * @module lib/export/hwpx-exporter.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HwpxExporter } from './hwpx-exporter';
import type { HWPXDocument } from '../../types/hwpx';

// Mock document.createElement and related DOM methods
const mockLink = {
  href: '',
  download: '',
  style: { display: '' },
  click: vi.fn(),
};

vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'a') {
    return mockLink as unknown as HTMLAnchorElement;
  }
  return document.createElement(tagName);
});

vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);

describe('HwpxExporter', () => {
  let exporter: HwpxExporter;
  let mockDocument: HWPXDocument;

  beforeEach(() => {
    exporter = new HwpxExporter();
    mockDocument = {
      sections: [
        {
          id: 'section-0',
          elements: [
            {
              type: 'paragraph',
              runs: [{ text: '테스트 문서', style: {} }]
            }
          ]
        }
      ],
      images: new Map()
    };
    
    vi.clearAllMocks();
  });

  // ===========================
  // 기본 기능 테스트
  // ===========================
  describe('constructor', () => {
    it('인스턴스가 정상적으로 생성되어야 합니다', () => {
      expect(exporter).toBeInstanceOf(HwpxExporter);
    });
  });

  // ===========================
  // createHwpxZip 테스트
  // ===========================
  describe('createHwpxZip', () => {
    it('JSZip 객체를 반환해야 합니다', async () => {
      const zip = await exporter.createHwpxZip(mockDocument);
      
      expect(zip).toBeDefined();
      expect(typeof zip.generateAsync).toBe('function');
    });

    it('필수 파일들이 포함되어야 합니다', async () => {
      const zip = await exporter.createHwpxZip(mockDocument);
      const files = Object.keys(zip.files);
      
      expect(files).toContain('mimetype');
      expect(files).toContain('version.xml');
      expect(files).toContain('settings.xml');
      expect(files).toContain('Contents/header.xml');
      expect(files).toContain('Contents/section0.xml');
      expect(files).toContain('Contents/content.hpf');
    });

    it('META-INF 파일들이 포함되어야 합니다', async () => {
      const zip = await exporter.createHwpxZip(mockDocument);
      const files = Object.keys(zip.files);
      
      expect(files).toContain('META-INF/container.xml');
      expect(files).toContain('META-INF/manifest.xml');
      expect(files).toContain('META-INF/container.rdf');
    });

    it('Preview 파일이 포함되어야 합니다', async () => {
      const zip = await exporter.createHwpxZip(mockDocument);
      const files = Object.keys(zip.files);
      
      expect(files).toContain('Preview/PrvText.txt');
    });

    it('다중 섹션을 처리해야 합니다', async () => {
      const multiSectionDoc: HWPXDocument = {
        sections: [
          { id: 'section-0', elements: [] },
          { id: 'section-1', elements: [] },
          { id: 'section-2', elements: [] }
        ],
        images: new Map()
      };
      
      const zip = await exporter.createHwpxZip(multiSectionDoc);
      const files = Object.keys(zip.files);
      
      expect(files).toContain('Contents/section0.xml');
      expect(files).toContain('Contents/section1.xml');
      expect(files).toContain('Contents/section2.xml');
    });
  });

  // ===========================
  // exportToFile 테스트
  // ===========================
  describe('exportToFile', () => {
    it('성공 결과를 반환해야 합니다', async () => {
      const result = await exporter.exportToFile(mockDocument, 'test.hwpx');
      
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test.hwpx');
      expect(result.size).toBeGreaterThan(0);
      expect(result.message).toContain('성공');
    });

    it('.hwpx 확장자가 없으면 추가해야 합니다', async () => {
      const result = await exporter.exportToFile(mockDocument, 'test');
      
      expect(result.filename).toBe('test.hwpx');
    });

    it('기본 파일명을 사용해야 합니다', async () => {
      const result = await exporter.exportToFile(mockDocument);
      
      expect(result.filename).toBe('document.hwpx');
    });

    it('다운로드 링크가 클릭되어야 합니다', async () => {
      await exporter.exportToFile(mockDocument, 'test.hwpx');
      
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  // ===========================
  // export 테스트 (alias)
  // ===========================
  describe('export', () => {
    it('exportToFile과 동일하게 작동해야 합니다', async () => {
      const result = await exporter.export(mockDocument, 'alias-test.hwpx');
      
      expect(result.success).toBe(true);
      expect(result.filename).toBe('alias-test.hwpx');
    });
  });

  // ===========================
  // toBlob 테스트
  // ===========================
  describe('toBlob', () => {
    it('Blob 객체를 반환해야 합니다', async () => {
      const blob = await exporter.toBlob(mockDocument);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('올바른 MIME 타입을 가져야 합니다', async () => {
      const blob = await exporter.toBlob(mockDocument);
      
      // JSZip은 기본적으로 application/zip 타입으로 생성
      expect(blob.type).toBe('application/zip');
    });
  });

  // ===========================
  // getPreviewUrl 테스트
  // ===========================
  describe('getPreviewUrl', () => {
    it('Blob URL을 반환해야 합니다', async () => {
      const url = await exporter.getPreviewUrl(mockDocument);
      
      expect(url).toBe('blob:mock-url');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  // ===========================
  // downloadBlob 테스트
  // ===========================
  describe('downloadBlob', () => {
    it('다운로드를 트리거해야 합니다', () => {
      const blob = new Blob(['test'], { type: 'application/zip' });
      
      exporter.downloadBlob(blob, 'download-test.hwpx');
      
      expect(mockLink.download).toBe('download-test.hwpx');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('.hwpx 확장자가 없으면 추가해야 합니다', () => {
      const blob = new Blob(['test'], { type: 'application/zip' });
      
      exporter.downloadBlob(blob, 'no-extension');
      
      expect(mockLink.download).toBe('no-extension.hwpx');
    });
  });

  // ===========================
  // 에러 처리 테스트
  // ===========================
  describe('error handling', () => {
    it('빈 섹션 문서를 처리해야 합니다', async () => {
      const emptyDoc: HWPXDocument = {
        sections: [],
        images: new Map()
      };
      
      const result = await exporter.exportToFile(emptyDoc, 'empty.hwpx');
      
      expect(result.success).toBe(true);
    });

    it('null 요소가 있어도 처리해야 합니다', async () => {
      const docWithNulls: HWPXDocument = {
        sections: [
          {
            id: 'section-0',
            elements: [
              {
                type: 'paragraph',
                runs: [{ text: '', style: {} }]
              }
            ]
          }
        ],
        images: new Map()
      };
      
      const result = await exporter.exportToFile(docWithNulls, 'nulls.hwpx');
      
      expect(result.success).toBe(true);
    });
  });
});

