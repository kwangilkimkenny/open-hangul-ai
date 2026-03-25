/**
 * JsonToXmlConverter Unit Tests
 *
 * Tests for JSON-to-XML conversion used in the HWPX export pipeline.
 *
 * @module export/json-to-xml.test
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
  }),
}));

import { JsonToXmlConverter } from '../src/export/json-to-xml.js';

describe('JsonToXmlConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new JsonToXmlConverter();
  });

  // ──────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────

  describe('constructor', () => {
    it('should initialize with namespaces object', () => {
      expect(converter.namespaces).toBeDefined();
      expect(converter.namespaces.hp).toBe('http://www.hancom.co.kr/hwpml/2011/hwpml');
      expect(converter.namespaces.hc).toBe('http://www.hancom.co.kr/hwpml/2011/hwpml');
    });
  });

  // ──────────────────────────────────────────────
  // escapeXml
  // ──────────────────────────────────────────────

  describe('escapeXml', () => {
    it('should escape ampersand to &amp;', () => {
      expect(converter.escapeXml('A & B')).toBe('A &amp; B');
    });

    it('should escape less-than to &lt;', () => {
      expect(converter.escapeXml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater-than to &gt;', () => {
      expect(converter.escapeXml('a > b')).toBe('a &gt; b');
    });

    it('should escape double-quote to &quot;', () => {
      expect(converter.escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('should escape single-quote to &#39;', () => {
      expect(converter.escapeXml("it's")).toBe('it&#39;s');
    });

    it('should escape all special characters combined', () => {
      const input = `<div class="a" data='b'> & </div>`;
      const expected = '&lt;div class=&quot;a&quot; data=&#39;b&#39;&gt; &amp; &lt;/div&gt;';
      expect(converter.escapeXml(input)).toBe(expected);
    });

    it('should coerce non-string input to string', () => {
      expect(converter.escapeXml(123)).toBe('123');
      expect(converter.escapeXml(null)).toBe('null');
      expect(converter.escapeXml(undefined)).toBe('undefined');
      expect(converter.escapeXml(true)).toBe('true');
    });

    it('should pass Korean text through unchanged', () => {
      const korean = '한글 문서 테스트';
      expect(converter.escapeXml(korean)).toBe(korean);
    });
  });

  // ──────────────────────────────────────────────
  // generateVersionXml
  // ──────────────────────────────────────────────

  describe('generateVersionXml', () => {
    it('should generate version XML with default values', () => {
      const xml = converter.generateVersionXml();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('version="1.0"');
      expect(xml).toContain('major="1"');
      expect(xml).toContain('minor="0"');
      expect(xml).toContain('micro="0"');
      expect(xml).toContain('build="0"');
      expect(xml).toContain('application="HWPX-Viewer-AI"');
      expect(xml).toContain('xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml"');
    });

    it('should generate version XML with custom values', () => {
      const xml = converter.generateVersionXml({
        version: '2.8',
        major: '2',
        minor: '8',
        micro: '1',
        build: '42',
        application: 'CustomApp',
      });

      expect(xml).toContain('version="2.8"');
      expect(xml).toContain('major="2"');
      expect(xml).toContain('minor="8"');
      expect(xml).toContain('micro="1"');
      expect(xml).toContain('build="42"');
      expect(xml).toContain('application="CustomApp"');
    });
  });

  // ──────────────────────────────────────────────
  // generateSettingsXml
  // ──────────────────────────────────────────────

  describe('generateSettingsXml', () => {
    it('should generate settings XML with default font', () => {
      const xml = converter.generateSettingsXml();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<HWPML');
      expect(xml).toContain('<MAPPINGTABLE>');
      expect(xml).toContain('FontFaces="맑은 고딕"');
      expect(xml).toContain('Id="0"');
      expect(xml).toContain('</MAPPINGTABLE>');
      expect(xml).toContain('</HWPML>');
    });

    it('should generate settings XML with custom fonts', () => {
      const xml = converter.generateSettingsXml({
        fontFaces: [
          { name: '나눔고딕' },
          { name: 'Arial' },
        ],
      });

      expect(xml).toContain('Id="0"');
      expect(xml).toContain('FontFaces="나눔고딕"');
      expect(xml).toContain('Id="1"');
      expect(xml).toContain('FontFaces="Arial"');
      // Should NOT contain the default font since custom fonts were provided
      expect(xml).not.toContain('FontFaces="맑은 고딕"');
    });
  });

  // ──────────────────────────────────────────────
  // generateHeaderXml
  // ──────────────────────────────────────────────

  describe('generateHeaderXml', () => {
    it('should generate header XML with default font face', () => {
      const xml = converter.generateHeaderXml();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<HWPML');
      expect(xml).toContain('<HEAD>');
      expect(xml).toContain('<MAPPINGTABLE>');
      expect(xml).toContain('FontFaces="맑은 고딕"');
      expect(xml).toContain('</MAPPINGTABLE>');
      expect(xml).toContain('</HEAD>');
      expect(xml).toContain('</HWPML>');
    });

    it('should generate header XML with custom font faces', () => {
      const xml = converter.generateHeaderXml({
        fontFaces: [
          { name: '바탕' },
          { name: '돋움' },
        ],
      });

      expect(xml).toContain('Id="0"');
      expect(xml).toContain('FontFaces="바탕"');
      expect(xml).toContain('Id="1"');
      expect(xml).toContain('FontFaces="돋움"');
    });
  });

  // ──────────────────────────────────────────────
  // generateSectionXml
  // ──────────────────────────────────────────────

  describe('generateSectionXml', () => {
    it('should generate XML for a section with a paragraph element', () => {
      const section = {
        elements: [
          {
            type: 'paragraph',
            paraShapeId: 1,
            styleId: 2,
            runs: [
              { charShapeId: 0, text: '안녕하세요' },
            ],
          },
        ],
      };

      const xml = converter.generateSectionXml(section);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<SECTION>');
      expect(xml).toContain('ParaShape="1"');
      expect(xml).toContain('Style="2"');
      expect(xml).toContain('CharShape="0"');
      expect(xml).toContain('안녕하세요');
      expect(xml).toContain('</SECTION>');
    });

    it('should generate XML for a section with a table element', () => {
      const section = {
        elements: [
          {
            type: 'table',
            rows: [
              {
                cells: [
                  { text: '셀A' },
                  { text: '셀B' },
                ],
              },
            ],
          },
        ],
      };

      const xml = converter.generateSectionXml(section);

      expect(xml).toContain('<TABLE>');
      expect(xml).toContain('ColCount="2"');
      expect(xml).toContain('RowCount="1"');
      expect(xml).toContain('셀A');
      expect(xml).toContain('셀B');
      expect(xml).toContain('<ROW>');
      expect(xml).toContain('<CELL');
      expect(xml).toContain('ColAddr="0"');
      expect(xml).toContain('ColAddr="1"');
      expect(xml).toContain('</TABLE>');
    });

    it('should generate XML for an empty section (no elements)', () => {
      const xml = converter.generateSectionXml({ elements: [] });

      expect(xml).toContain('<SECTION>');
      expect(xml).toContain('</SECTION>');
      // Should not contain paragraph or table tags
      expect(xml).not.toContain('<P ');
      expect(xml).not.toContain('<TABLE>');
    });
  });

  // ──────────────────────────────────────────────
  // _generateParagraphXml (internal, tested via generateSectionXml)
  // ──────────────────────────────────────────────

  describe('_generateParagraphXml (via generateSectionXml)', () => {
    it('should handle paragraph with simple text and no runs', () => {
      const section = {
        elements: [
          {
            type: 'paragraph',
            text: '단순 텍스트',
          },
        ],
      };

      const xml = converter.generateSectionXml(section);
      expect(xml).toContain('<TEXT CharShape="0">단순 텍스트</TEXT>');
    });

    it('should handle paragraph with linebreak runs', () => {
      const section = {
        elements: [
          {
            type: 'paragraph',
            runs: [
              { charShapeId: 0, text: 'Line 1' },
              { type: 'linebreak', charShapeId: 0 },
              { charShapeId: 0, text: 'Line 2' },
            ],
          },
        ],
      };

      const xml = converter.generateSectionXml(section);
      expect(xml).toContain('<TEXT CharShape="0">Line 1</TEXT>');
      expect(xml).toContain('<LINEBREAK CharShape="0"/>');
      expect(xml).toContain('<TEXT CharShape="0">Line 2</TEXT>');
    });

    it('should use default paraShapeId and styleId when not provided', () => {
      const section = {
        elements: [
          {
            type: 'paragraph',
            runs: [{ text: 'text' }],
          },
        ],
      };

      const xml = converter.generateSectionXml(section);
      expect(xml).toContain('ParaShape="0"');
      expect(xml).toContain('Style="0"');
    });

    it('should escape special characters in paragraph text', () => {
      const section = {
        elements: [
          {
            type: 'paragraph',
            text: 'A & B < C > D',
          },
        ],
      };

      const xml = converter.generateSectionXml(section);
      expect(xml).toContain('A &amp; B &lt; C &gt; D');
    });
  });

  // ──────────────────────────────────────────────
  // _generateTableXml (internal, tested via generateSectionXml)
  // ──────────────────────────────────────────────

  describe('_generateTableXml (via generateSectionXml)', () => {
    it('should handle table cells with colspan and rowspan', () => {
      const section = {
        elements: [
          {
            type: 'table',
            rows: [
              {
                cells: [
                  { text: 'merged', colSpan: 2, rowSpan: 1 },
                ],
              },
            ],
          },
        ],
      };

      const xml = converter.generateSectionXml(section);
      expect(xml).toContain('ColSpan="2"');
      expect(xml).toContain('RowSpan="1"');
    });

    it('should handle table cells containing paragraph elements', () => {
      const section = {
        elements: [
          {
            type: 'table',
            rows: [
              {
                cells: [
                  {
                    elements: [
                      {
                        type: 'paragraph',
                        paraShapeId: 3,
                        styleId: 1,
                        runs: [{ charShapeId: 2, text: '셀 내용' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const xml = converter.generateSectionXml(section);
      expect(xml).toContain('<SUBLIST>');
      expect(xml).toContain('ParaShape="3"');
      expect(xml).toContain('Style="1"');
      expect(xml).toContain('CharShape="2"');
      expect(xml).toContain('셀 내용');
      expect(xml).toContain('</SUBLIST>');
    });

    it('should handle multiple rows with COLDEF for even column widths', () => {
      const section = {
        elements: [
          {
            type: 'table',
            rows: [
              { cells: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] },
              { cells: [{ text: 'D' }, { text: 'E' }, { text: 'F' }] },
            ],
          },
        ],
      };

      const xml = converter.generateSectionXml(section);

      // 3 columns, each width = Math.floor(60000 / 3) = 20000
      expect(xml).toContain('ColCount="3"');
      expect(xml).toContain('RowCount="2"');
      expect(xml).toContain('Width="20000"');
    });

    it('should handle section with no elements property gracefully', () => {
      const xml = converter.generateSectionXml({});

      expect(xml).toContain('<SECTION>');
      expect(xml).toContain('</SECTION>');
      expect(xml).not.toContain('<P ');
      expect(xml).not.toContain('<TABLE>');
    });
  });
});
