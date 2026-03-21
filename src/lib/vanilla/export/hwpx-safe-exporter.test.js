/**
 * HwpxSafeExporter Unit Tests
 *
 * Tests for safe HWPX export pipeline that modifies section XML
 * within an original HWPX ZIP archive.
 *
 * @module export/hwpx-safe-exporter.test
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
  }),
}));

const { mockFileAsync, mockFile, mockGenerateAsync, mockZipInstance } = vi.hoisted(() => {
  const mockFileAsync = vi.fn().mockResolvedValue('<?xml version="1.0"?><section/>');
  const mockFile = vi.fn().mockReturnValue({ async: mockFileAsync });
  const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['mock-zip-content']));
  const mockZipInstance = {
    files: {
      'Contents/section0.xml': {},
      'BinData/image1.png': {},
      'BinData/image2.jpg': {},
    },
    file: mockFile,
    generateAsync: mockGenerateAsync,
  };
  return { mockFileAsync, mockFile, mockGenerateAsync, mockZipInstance };
});

vi.mock('jszip', () => ({
  default: {
    loadAsync: vi.fn().mockResolvedValue(mockZipInstance),
  },
}));

vi.mock('../utils/error.js', () => ({
  HWPXError: class extends Error {
    constructor(type, msg, cause) {
      super(msg);
      this.type = type;
      this.cause = cause;
    }
  },
  ErrorType: {
    EXPORT_ERROR: 'EXPORT_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
  },
}));

vi.mock('./header-based-replacer.js', () => ({
  HeaderBasedReplacer: class {
    constructor() {}
    replaceTextInXml(originalXml, section) {
      return originalXml;
    }
    extractTableCells() { return []; }
    createHeaderSectionPairs() { return []; }
    replaceSectionContent() { return true; }
  },
}));

import JSZip from 'jszip';
import { HwpxSafeExporter } from './hwpx-safe-exporter.js';

// ──────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────

describe('HwpxSafeExporter', () => {
  let exporter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations to defaults after clearAllMocks
    mockFileAsync.mockResolvedValue('<?xml version="1.0"?><section/>');
    mockFile.mockReturnValue({ async: mockFileAsync });
    mockGenerateAsync.mockResolvedValue(new Blob(['mock-zip-content']));
    JSZip.loadAsync.mockResolvedValue(mockZipInstance);

    exporter = new HwpxSafeExporter();

    // Stub downloadBlob to prevent DOM operations in tests
    exporter.downloadBlob = vi.fn();
  });

  // ──────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────

  describe('constructor', () => {
    it('should initialize with a HeaderBasedReplacer instance', () => {
      expect(exporter.headerReplacer).toBeDefined();
      expect(exporter.headerReplacer.constructor).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // exportModifiedHwpx
  // ──────────────────────────────────────────────

  describe('exportModifiedHwpx', () => {
    const fakeFile = new Blob(['fake-hwpx'], { type: 'application/octet-stream' });
    const minimalDocument = {
      sections: [
        {
          elements: [
            { type: 'paragraph', runs: [{ text: 'hello' }] },
          ],
        },
      ],
    };

    it('should load the original ZIP file via JSZip.loadAsync', async () => {
      await exporter.exportModifiedHwpx(fakeFile, minimalDocument, 'test.hwpx');

      expect(JSZip.loadAsync).toHaveBeenCalledWith(fakeFile);
    });

    it('should read each section XML from the original ZIP', async () => {
      await exporter.exportModifiedHwpx(fakeFile, minimalDocument, 'test.hwpx');

      // Should call file() for the header fixup and once for section0.xml
      expect(mockFile).toHaveBeenCalledWith('Contents/section0.xml', expect.anything());
    });

    it('should process all sections in the modified document', async () => {
      const multiSectionDoc = {
        sections: [
          { elements: [{ type: 'paragraph', runs: [{ text: 'sec0' }] }] },
          { elements: [{ type: 'paragraph', runs: [{ text: 'sec1' }] }] },
        ],
      };

      await exporter.exportModifiedHwpx(fakeFile, multiSectionDoc, 'test.hwpx');

      // file() should be called with section0.xml and section1.xml for reading
      const fileCalls = mockFile.mock.calls.map(c => c[0]);
      expect(fileCalls).toContain('Contents/section0.xml');
      expect(fileCalls).toContain('Contents/section1.xml');
    });

    it('should generate a new ZIP blob with DEFLATE compression', async () => {
      await exporter.exportModifiedHwpx(fakeFile, minimalDocument, 'test.hwpx');

      expect(mockGenerateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'blob',
          compression: 'DEFLATE',
        })
      );
    });

    it('should call downloadBlob with the generated blob and filename', async () => {
      await exporter.exportModifiedHwpx(fakeFile, minimalDocument, 'output.hwpx');

      expect(exporter.downloadBlob).toHaveBeenCalledTimes(1);
      const [blob, filename] = exporter.downloadBlob.mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(filename).toBe('output.hwpx');
    });

    it('should preserve BinData image files by not removing them from the ZIP', async () => {
      await exporter.exportModifiedHwpx(fakeFile, minimalDocument, 'test.hwpx');

      // The original zip instance is reused; BinData files should still be present
      expect(mockZipInstance.files['BinData/image1.png']).toBeDefined();
      expect(mockZipInstance.files['BinData/image2.jpg']).toBeDefined();
    });

    it('should handle missing sections gracefully without throwing', async () => {
      // file() returns an object whose async() resolves to null-ish content
      mockFile.mockReturnValue({
        async: vi.fn().mockResolvedValue(null),
      });

      // Should not throw even when section XML content is null
      await expect(
        exporter.exportModifiedHwpx(fakeFile, minimalDocument, 'test.hwpx')
      ).resolves.not.toThrow();
    });

    it('should use default filename when none is provided', async () => {
      await exporter.exportModifiedHwpx(fakeFile, minimalDocument);

      expect(exporter.downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'document.hwpx'
      );
    });
  });

  // ──────────────────────────────────────────────
  // Error handling
  // ──────────────────────────────────────────────

  describe('error handling', () => {
    it('should throw HWPXError when the original file cannot be loaded', async () => {
      JSZip.loadAsync.mockRejectedValue(new Error('corrupt zip'));

      await expect(
        exporter.exportModifiedHwpx('bad-data', { sections: [] }, 'test.hwpx')
      ).rejects.toThrow();
    });

    it('should throw HWPXError when generateAsync fails', async () => {
      mockGenerateAsync.mockRejectedValue(new Error('generation failed'));

      await expect(
        exporter.exportModifiedHwpx(
          new Blob(['data']),
          { sections: [{ elements: [] }] },
          'test.hwpx'
        )
      ).rejects.toThrow();
    });

    it('should propagate errors from section XML reading', async () => {
      mockFile.mockReturnValue({
        async: vi.fn().mockRejectedValue(new Error('read error')),
      });

      await expect(
        exporter.exportModifiedHwpx(
          new Blob(['data']),
          { sections: [{ elements: [] }] },
          'test.hwpx'
        )
      ).rejects.toThrow();
    });
  });

  // ──────────────────────────────────────────────
  // downloadBlob
  // ──────────────────────────────────────────────

  describe('downloadBlob', () => {
    let realExporter;

    beforeEach(() => {
      realExporter = new HwpxSafeExporter();
    });

    it('should append .hwpx extension if missing', () => {
      // Mock DOM APIs
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      realExporter.downloadBlob(new Blob(['data']), 'myfile');

      expect(mockLink.download).toBe('myfile.hwpx');

      vi.restoreAllMocks();
    });

    it('should not double-append .hwpx if already present', () => {
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      realExporter.downloadBlob(new Blob(['data']), 'myfile.hwpx');

      expect(mockLink.download).toBe('myfile.hwpx');

      vi.restoreAllMocks();
    });

    it('should create a link element, click it, and schedule cleanup', () => {
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      realExporter.downloadBlob(new Blob(['data']), 'test.hwpx');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.style.display).toBe('none');
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  // ──────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────

  describe('edge cases', () => {
    const fakeFile = new Blob(['fake-hwpx']);

    it('should handle an empty document (no sections)', async () => {
      await expect(
        exporter.exportModifiedHwpx(fakeFile, { sections: [] }, 'empty.hwpx')
      ).resolves.not.toThrow();

      // generateAsync should still be called to produce the output ZIP
      expect(mockGenerateAsync).toHaveBeenCalled();
      expect(exporter.downloadBlob).toHaveBeenCalled();
    });

    it('should handle a document with undefined sections property', async () => {
      await expect(
        exporter.exportModifiedHwpx(fakeFile, {}, 'no-sections.hwpx')
      ).resolves.not.toThrow();

      expect(mockGenerateAsync).toHaveBeenCalled();
    });

    it('should handle a section with mixed paragraph and table elements', async () => {
      const doc = {
        sections: [
          {
            elements: [
              { type: 'paragraph', runs: [{ text: 'intro' }] },
              {
                type: 'table',
                rows: [{ cells: [{ text: 'cell' }] }],
              },
              { type: 'paragraph', runs: [{ text: 'outro' }] },
            ],
          },
        ],
      };

      await expect(
        exporter.exportModifiedHwpx(fakeFile, doc, 'mixed.hwpx')
      ).resolves.not.toThrow();

      expect(exporter.downloadBlob).toHaveBeenCalled();
    });

    it('should handle a section with elements containing linebreak runs', async () => {
      const doc = {
        sections: [
          {
            elements: [
              {
                type: 'paragraph',
                runs: [
                  { text: 'Line 1' },
                  { type: 'linebreak' },
                  { text: 'Line 2' },
                ],
              },
            ],
          },
        ],
      };

      await expect(
        exporter.exportModifiedHwpx(fakeFile, doc, 'linebreak.hwpx')
      ).resolves.not.toThrow();
    });

    it('should handle multiple sections each written back to the ZIP', async () => {
      const doc = {
        sections: [
          { elements: [{ type: 'paragraph', runs: [{ text: 'A' }] }] },
          { elements: [{ type: 'paragraph', runs: [{ text: 'B' }] }] },
          { elements: [{ type: 'paragraph', runs: [{ text: 'C' }] }] },
        ],
      };

      await exporter.exportModifiedHwpx(fakeFile, doc, 'multi.hwpx');

      // file() is called to write each modified section back; each call
      // with two args (filename, content) is a write operation.
      const writeCalls = mockFile.mock.calls.filter(c => c.length === 2);
      const writtenPaths = writeCalls.map(c => c[0]);
      expect(writtenPaths).toContain('Contents/section0.xml');
      expect(writtenPaths).toContain('Contents/section1.xml');
      expect(writtenPaths).toContain('Contents/section2.xml');
    });

    it('should handle section with empty elements array', async () => {
      const doc = {
        sections: [{ elements: [] }],
      };

      await expect(
        exporter.exportModifiedHwpx(fakeFile, doc, 'empty-elements.hwpx')
      ).resolves.not.toThrow();
    });

    it('should handle table with no rows', async () => {
      const doc = {
        sections: [
          {
            elements: [
              { type: 'table', rows: [] },
            ],
          },
        ],
      };

      await expect(
        exporter.exportModifiedHwpx(fakeFile, doc, 'empty-table.hwpx')
      ).resolves.not.toThrow();
    });

    it('should handle Korean content in sections', async () => {
      const doc = {
        sections: [
          {
            elements: [
              {
                type: 'paragraph',
                runs: [{ text: '한글 문서 내용입니다' }],
              },
            ],
          },
        ],
      };

      await expect(
        exporter.exportModifiedHwpx(fakeFile, doc, '한글문서.hwpx')
      ).resolves.not.toThrow();

      expect(exporter.downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        '한글문서.hwpx'
      );
    });
  });
});
