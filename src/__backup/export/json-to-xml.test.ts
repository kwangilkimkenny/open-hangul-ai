/**
 * JsonToXmlConverter 단위 테스트
 * 
 * @module lib/export/json-to-xml.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JsonToXmlConverter } from './json-to-xml';
import type { HWPXSection, HWPXParagraph, HWPXTable } from '../../types/hwpx';

describe('JsonToXmlConverter', () => {
  let converter: JsonToXmlConverter;

  beforeEach(() => {
    converter = new JsonToXmlConverter();
  });

  // ===========================
  // escapeXml 테스트
  // ===========================
  describe('escapeXml', () => {
    it('특수 문자를 올바르게 이스케이프해야 합니다', () => {
      expect(converter.escapeXml('Hello & World')).toBe('Hello &amp; World');
      expect(converter.escapeXml('<tag>')).toBe('&lt;tag&gt;');
      expect(converter.escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(converter.escapeXml("it's")).toBe("it&#39;s");
    });

    it('문자열이 아닌 입력을 문자열로 변환해야 합니다', () => {
      expect(converter.escapeXml(123)).toBe('123');
      expect(converter.escapeXml(null)).toBe('');
      expect(converter.escapeXml(undefined)).toBe('');
    });

    it('빈 문자열은 그대로 반환해야 합니다', () => {
      expect(converter.escapeXml('')).toBe('');
    });

    it('복합 특수 문자를 올바르게 처리해야 합니다', () => {
      const input = '<script>alert("test & data\'s");</script>';
      const expected = '&lt;script&gt;alert(&quot;test &amp; data&#39;s&quot;);&lt;/script&gt;';
      expect(converter.escapeXml(input)).toBe(expected);
    });
  });

  // ===========================
  // generateVersionXml 테스트
  // ===========================
  describe('generateVersionXml', () => {
    it('기본 버전 XML을 생성해야 합니다', () => {
      const xml = converter.generateVersionXml();
      
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml"');
      expect(xml).toContain('version="2.8"');
      expect(xml).toContain('application="HAN-View-React"');
    });

    it('커스텀 버전 정보를 사용해야 합니다', () => {
      const xml = converter.generateVersionXml({
        version: '3.0',
        major: '3',
        minor: '0',
        application: 'CustomApp'
      });
      
      expect(xml).toContain('version="3.0"');
      expect(xml).toContain('major="3"');
      expect(xml).toContain('minor="0"');
      expect(xml).toContain('application="CustomApp"');
    });
  });

  // ===========================
  // generateSettingsXml 테스트
  // ===========================
  describe('generateSettingsXml', () => {
    it('기본 설정 XML을 생성해야 합니다', () => {
      const xml = converter.generateSettingsXml();
      
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<HWPML');
      expect(xml).toContain('<MAPPINGTABLE>');
      expect(xml).toContain('FontFaces="맑은 고딕"');
    });

    it('커스텀 폰트를 사용해야 합니다', () => {
      const xml = converter.generateSettingsXml({
        fontFaces: [
          { name: '나눔고딕' },
          { name: 'Arial' }
        ]
      });
      
      expect(xml).toContain('FontFaces="나눔고딕"');
      expect(xml).toContain('FontFaces="Arial"');
    });
  });

  // ===========================
  // generateHeaderXml 테스트
  // ===========================
  describe('generateHeaderXml', () => {
    it('기본 헤더 XML을 생성해야 합니다', () => {
      const xml = converter.generateHeaderXml();
      
      expect(xml).toContain('<HEAD>');
      expect(xml).toContain('<MAPPINGTABLE>');
      expect(xml).toContain('<FONTFACE');
      expect(xml).toContain('</HEAD>');
    });

    it('문단 속성을 포함해야 합니다', () => {
      const xml = converter.generateHeaderXml({
        paraProps: [
          { align: 'Center' },
          { align: 'Right' }
        ]
      });
      
      expect(xml).toContain('<PARASHAPE');
      expect(xml).toContain('HorizontalAlign="Center"');
      expect(xml).toContain('HorizontalAlign="Right"');
    });

    it('문자 속성을 포함해야 합니다', () => {
      const xml = converter.generateHeaderXml({
        charProps: [
          { fontSize: 1200, bold: true, italic: false }
        ]
      });
      
      expect(xml).toContain('<CHARSHAPE');
      expect(xml).toContain('Hangul="1200"');
      expect(xml).toContain('<BOLD Hangul="1"');
      expect(xml).toContain('<ITALIC Hangul="0"');
    });
  });

  // ===========================
  // generateSectionXml 테스트
  // ===========================
  describe('generateSectionXml', () => {
    it('빈 섹션 XML을 생성해야 합니다', () => {
      const section: HWPXSection = {
        id: 'section-0',
        elements: []
      };
      
      const xml = converter.generateSectionXml(section);
      
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<SECTION>');
      expect(xml).toContain('</SECTION>');
    });

    it('문단을 포함한 섹션을 생성해야 합니다', () => {
      const section: HWPXSection = {
        id: 'section-0',
        elements: [
          {
            type: 'paragraph',
            runs: [{ text: '테스트 텍스트', style: {} }]
          } as HWPXParagraph
        ]
      };
      
      const xml = converter.generateSectionXml(section);
      
      expect(xml).toContain('<P ParaShape=');
      expect(xml).toContain('<TEXT CharShape=');
      expect(xml).toContain('테스트 텍스트');
    });

    it('테이블을 포함한 섹션을 생성해야 합니다', () => {
      const section: HWPXSection = {
        id: 'section-0',
        elements: [
          {
            type: 'table',
            rows: [
              {
                cells: [
                  { elements: [] },
                  { elements: [] }
                ]
              }
            ]
          } as HWPXTable
        ]
      };
      
      const xml = converter.generateSectionXml(section);
      
      expect(xml).toContain('<TABLE>');
      expect(xml).toContain('<TABLEFORMAT');
      expect(xml).toContain('ColCount="2"');
      expect(xml).toContain('RowCount="1"');
      expect(xml).toContain('<CELL');
    });
  });

  // ===========================
  // generateParagraphXml 테스트
  // ===========================
  describe('generateParagraphXml', () => {
    it('기본 문단을 생성해야 합니다', () => {
      const paragraph: HWPXParagraph = {
        type: 'paragraph',
        runs: [{ text: 'Hello World', style: {} }]
      };
      
      const xml = converter.generateParagraphXml(paragraph);
      
      expect(xml).toContain('<P');
      expect(xml).toContain('Hello World');
      expect(xml).toContain('</P>');
    });

    it('여러 런을 포함한 문단을 생성해야 합니다', () => {
      const paragraph: HWPXParagraph = {
        type: 'paragraph',
        runs: [
          { text: 'First ', style: {} },
          { text: 'Second', style: {} }
        ]
      };
      
      const xml = converter.generateParagraphXml(paragraph);
      
      expect(xml).toContain('First ');
      expect(xml).toContain('Second');
    });

    it('빈 런 배열을 처리해야 합니다', () => {
      const paragraph: HWPXParagraph = {
        type: 'paragraph',
        runs: []
      };
      
      const xml = converter.generateParagraphXml(paragraph);
      
      expect(xml).toContain('<P');
      expect(xml).toContain('<TEXT');
    });

    it('특수 문자를 이스케이프해야 합니다', () => {
      const paragraph: HWPXParagraph = {
        type: 'paragraph',
        runs: [{ text: '<script>alert("XSS")</script>', style: {} }]
      };
      
      const xml = converter.generateParagraphXml(paragraph);
      
      expect(xml).toContain('&lt;script&gt;');
      expect(xml).not.toContain('<script>');
    });
  });

  // ===========================
  // generateTableXml 테스트
  // ===========================
  describe('generateTableXml', () => {
    it('기본 테이블을 생성해야 합니다', () => {
      const table: HWPXTable = {
        type: 'table',
        rows: [
          {
            cells: [
              { elements: [] }
            ]
          }
        ]
      };
      
      const xml = converter.generateTableXml(table);
      
      expect(xml).toContain('<TABLE>');
      expect(xml).toContain('<TABLEFORMAT');
      expect(xml).toContain('ColCount="1"');
      expect(xml).toContain('RowCount="1"');
    });

    it('다중 행/열 테이블을 생성해야 합니다', () => {
      const table: HWPXTable = {
        type: 'table',
        rows: [
          { cells: [{ elements: [] }, { elements: [] }, { elements: [] }] },
          { cells: [{ elements: [] }, { elements: [] }, { elements: [] }] }
        ]
      };
      
      const xml = converter.generateTableXml(table);
      
      expect(xml).toContain('ColCount="3"');
      expect(xml).toContain('RowCount="2"');
      expect(xml.match(/<ROW>/g)?.length).toBe(2);
      // CELL 태그는 여러 번 나타남 (각 셀에 CELLPROPERTY 등 포함)
      expect(xml.match(/ColAddr="/g)?.length).toBe(6);
    });

    it('셀 병합 정보를 포함해야 합니다', () => {
      const table: HWPXTable = {
        type: 'table',
        rows: [
          {
            cells: [
              { elements: [], colSpan: 2, rowSpan: 3 }
            ]
          }
        ]
      };
      
      const xml = converter.generateTableXml(table);
      
      expect(xml).toContain('ColSpan="2"');
      expect(xml).toContain('RowSpan="3"');
    });

    it('셀 내용을 포함해야 합니다', () => {
      const table: HWPXTable = {
        type: 'table',
        rows: [
          {
            cells: [
              {
                elements: [
                  {
                    type: 'paragraph',
                    runs: [{ text: '셀 내용', style: {} }]
                  } as HWPXParagraph
                ]
              }
            ]
          }
        ]
      };
      
      const xml = converter.generateTableXml(table);
      
      expect(xml).toContain('셀 내용');
    });
  });
});

