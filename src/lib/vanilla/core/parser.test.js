/**
 * HWPX Parser Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimpleHWPXParser } from './parser.js';

// Mock JSZip
vi.mock('jszip');

// Mock logger
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

describe('SimpleHWPXParser', () => {
  let parser;

  beforeEach(() => {
    parser = new SimpleHWPXParser();
  });

  afterEach(() => {
    if (parser) {
      parser.cleanup();
    }
  });

  describe('Constructor', () => {
    it('should create parser with default options', () => {
      expect(parser.options.parseImages).toBe(true);
      expect(parser.options.parseTables).toBe(true);
      expect(parser.options.parseStyles).toBe(true);
    });

    it('should create parser with custom options', () => {
      const customParser = new SimpleHWPXParser({
        parseImages: false,
        parseTables: false,
      });

      expect(customParser.options.parseImages).toBe(false);
      expect(customParser.options.parseTables).toBe(false);
    });

    it('should initialize empty collections', () => {
      expect(parser.entries).toBeInstanceOf(Map);
      expect(parser.images).toBeInstanceOf(Map);
      expect(parser.styles).toBeInstanceOf(Map);
      expect(parser.charProperties).toBeInstanceOf(Map);
    });
  });

  describe('reset()', () => {
    it('should clear all collections', () => {
      parser.entries.set('test', 'data');
      parser.images.set('img1', {});
      parser.styles.set('style1', {});

      parser.reset();

      expect(parser.entries.size).toBe(0);
      expect(parser.images.size).toBe(0);
      expect(parser.styles.size).toBe(0);
    });
  });

  describe('cleanup()', () => {
    it('should revoke Blob URLs', () => {
      const mockURL = 'blob:http://localhost/test';
      global.URL.revokeObjectURL = vi.fn();

      parser.images.set('img1', { url: mockURL });
      parser.cleanup();

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockURL);
    });

    it('should reset after cleanup', () => {
      parser.entries.set('test', 'data');
      parser.cleanup();

      expect(parser.entries.size).toBe(0);
    });
  });

  describe('parseParagraph()', () => {
    it('should parse paragraph with single run', () => {
      // Mock a text element inside a run
      const mockTextElem = {
        localName: 't',
        tagName: 't',
        textContent: 'Hello World',
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      const mockRunElem = {
        getAttribute: vi.fn().mockReturnValue(null),
        querySelector: vi.fn().mockReturnValue(null),
        children: [mockTextElem],
      };
      const mockPElem = {
        getAttribute: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn(selector => {
          if (selector.includes('run')) {
            return [mockRunElem];
          }
          return [];
        }),
      };

      const para = parser.parseParagraph(mockPElem);

      expect(para).toBeTruthy();
      expect(para.type).toBe('paragraph');
      expect(para.runs).toHaveLength(1);
      expect(para.runs[0].text).toBe('Hello World');
    });

    it('should return empty runs for paragraph without runs', () => {
      const mockPElem = {
        getAttribute: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };

      const para = parser.parseParagraph(mockPElem);

      // Parser returns paragraph object with empty runs, not null
      expect(para).toBeTruthy();
      expect(para.type).toBe('paragraph');
      expect(para.runs).toHaveLength(0);
    });

    it('should apply character properties', () => {
      parser.charProperties.set('cp1', {
        fontSize: '12pt',
        bold: true,
      });

      const mockTextElem = {
        localName: 't',
        tagName: 't',
        textContent: 'Bold Text',
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      const mockRunElem = {
        getAttribute: vi.fn().mockReturnValue('cp1'),
        querySelector: vi.fn().mockReturnValue(null),
        children: [mockTextElem],
      };
      const mockPElem = {
        getAttribute: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn(selector => {
          if (selector.includes('run')) {
            return [mockRunElem];
          }
          return [];
        }),
      };

      const para = parser.parseParagraph(mockPElem);

      expect(para.runs).toHaveLength(1);
      expect(para.runs[0].style).toBeTruthy();
      expect(para.runs[0].style.bold).toBe(true);
    });
  });

  describe('parseTable()', () => {
    it('should parse table with rows and cells', () => {
      const mockCell = {
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: vi.fn().mockReturnValue(null),
        getAttribute: vi.fn().mockReturnValue(null),
      };
      const mockRow = {
        querySelectorAll: vi.fn().mockReturnValue([mockCell]),
        querySelector: vi.fn().mockReturnValue(null),
        getAttribute: vi.fn().mockReturnValue(null),
      };
      const mockTblElem = {
        querySelectorAll: vi.fn(selector => {
          if (selector.includes('tr')) {
            return [mockRow];
          }
          return [];
        }),
        querySelector: vi.fn().mockReturnValue(null),
        getAttribute: vi.fn().mockReturnValue(null),
      };

      const table = parser.parseTable(mockTblElem);

      expect(table).toBeTruthy();
      expect(table.type).toBe('table');
      expect(table.rows).toHaveLength(1);
    });

    it('should return null for empty table', () => {
      const mockTblElem = {
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: vi.fn().mockReturnValue(null),
        getAttribute: vi.fn().mockReturnValue(null),
      };

      const table = parser.parseTable(mockTblElem);

      expect(table).toBeNull();
    });
  });

  describe('Options', () => {
    it('should respect parseImages option', () => {
      const parser1 = new SimpleHWPXParser({ parseImages: false });
      expect(parser1.options.parseImages).toBe(false);
    });

    it('should respect parseTables option', () => {
      const parser1 = new SimpleHWPXParser({ parseTables: false });
      expect(parser1.options.parseTables).toBe(false);
    });

    it('should respect parseStyles option', () => {
      const parser1 = new SimpleHWPXParser({ parseStyles: false });
      expect(parser1.options.parseStyles).toBe(false);
    });
  });
});
