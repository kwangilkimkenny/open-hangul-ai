/**
 * Tests for DocumentStructureExtractor
 * @module ai/structure-extractor.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

vi.mock('../config/ai-config.js', () => ({
  AIConfig: {
    extraction: {
      slotIdPrefix: 'slot-',
      elementIdPrefix: 'elem-',
      minTextLength: 1,
      maxTextLength: 10000,
      useCache: true,
    },
  },
}));

import { DocumentStructureExtractor, extractDocumentStructure } from './structure-extractor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParagraph(text, style = null) {
  return {
    type: 'paragraph',
    runs: [{ text, style }],
  };
}

function makeTable(rows) {
  return {
    type: 'table',
    rows: rows.map(cells => ({
      cells: cells.map(cellTexts => ({
        elements: (Array.isArray(cellTexts) ? cellTexts : [cellTexts]).map(t =>
          ({ type: 'paragraph', runs: [{ text: t }] })
        ),
      })),
    })),
  };
}

function makeDocument(elements, extra = {}) {
  return {
    sections: [{ elements, ...extra }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentStructureExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new DocumentStructureExtractor({ useCache: false });
  });

  // 1. Export function existence
  it('exports the class and the convenience function', () => {
    expect(DocumentStructureExtractor).toBeDefined();
    expect(typeof extractDocumentStructure).toBe('function');
  });

  // 2. Extract from document with paragraphs
  it('extracts text slots from paragraphs', () => {
    const doc = makeDocument([
      makeParagraph('Hello World'),
      makeParagraph('Second paragraph'),
    ]);

    const result = extractor.extractStructure(doc);

    expect(result.textSlots.size).toBe(2);
    expect(result.structure.sections).toHaveLength(1);
    expect(result.structure.sections[0].elements).toHaveLength(2);

    const slotValues = [...result.textSlots.values()];
    const texts = slotValues.map(s => s.text);
    expect(texts).toContain('Hello World');
    expect(texts).toContain('Second paragraph');
  });

  // 3. Extract from document with tables
  it('extracts text slots from table cells', () => {
    const doc = makeDocument([
      makeTable([
        ['Header1', 'Header2'],
        ['Content1', 'Content2'],
      ]),
    ]);

    const result = extractor.extractStructure(doc);

    // 4 cells -> 4 slots
    expect(result.textSlots.size).toBe(4);

    const slotValues = [...result.textSlots.values()];
    const texts = slotValues.map(s => s.text);
    expect(texts).toContain('Header1');
    expect(texts).toContain('Content2');
  });

  // 4. Header detection: first row is always header
  it('detects first row cells as headers', () => {
    const doc = makeDocument([
      makeTable([
        ['Name', 'Age'],
        ['Alice', '30'],
      ]),
    ]);

    const result = extractor.extractStructure(doc);
    const slotValues = [...result.textSlots.values()];

    const firstRowSlots = slotValues.filter(s => s.path.row === 0);
    firstRowSlots.forEach(slot => {
      expect(slot.context.isHeader).toBe(true);
    });
  });

  // 5. Header-content pairing via extractTableHeaderContentPairs
  it('extracts header-content pairs from two-column tables', () => {
    const doc = makeDocument([
      makeTable([
        ['Name', 'Alice'],
        ['Age', '7'],
      ]),
    ]);

    const pairs = extractor.extractTableHeaderContentPairs(doc);

    expect(pairs.length).toBeGreaterThanOrEqual(2);
    const headers = pairs.map(p => p.header);
    expect(headers).toContain('Name');
    expect(headers).toContain('Age');
  });

  // 6. Empty document handling
  it('returns zero slots for a document with empty sections', () => {
    const doc = { sections: [{ elements: [] }] };
    const result = extractor.extractStructure(doc);
    expect(result.textSlots.size).toBe(0);
    expect(result.structure.sections[0].elements).toHaveLength(0);
  });

  // 7. Document with only tables
  it('handles a document containing only tables', () => {
    const doc = makeDocument([
      makeTable([['A', 'B']]),
      makeTable([['C', 'D']]),
    ]);

    const result = extractor.extractStructure(doc);
    expect(result.textSlots.size).toBe(4);
    expect(result.metadata.stats.tableSlots).toBe(4);
    expect(result.metadata.stats.paragraphSlots).toBe(0);
  });

  // 8. Document with only paragraphs
  it('handles a document containing only paragraphs', () => {
    const doc = makeDocument([
      makeParagraph('One'),
      makeParagraph('Two'),
    ]);

    const result = extractor.extractStructure(doc);
    expect(result.textSlots.size).toBe(2);
    expect(result.metadata.stats.paragraphSlots).toBe(2);
    expect(result.metadata.stats.tableSlots).toBe(0);
  });

  // 9. Multi-section document
  it('extracts from multiple sections', () => {
    const doc = {
      sections: [
        { elements: [makeParagraph('Section1')] },
        { elements: [makeParagraph('Section2')] },
      ],
    };

    const result = extractor.extractStructure(doc);
    expect(result.textSlots.size).toBe(2);
    expect(result.structure.sections).toHaveLength(2);
    expect(result.metadata.documentInfo.sectionsCount).toBe(2);
  });

  // 10. Cache behavior
  it('returns cached result on second call with same document', () => {
    const cachedExtractor = new DocumentStructureExtractor({ useCache: true });
    const doc = makeDocument([makeParagraph('cached')]);

    const first = cachedExtractor.extractStructure(doc);
    const second = cachedExtractor.extractStructure(doc);

    // Same reference means cache was used
    expect(first).toBe(second);
    expect(cachedExtractor.getStatistics().cacheSize).toBe(1);

    cachedExtractor.clearCache();
    expect(cachedExtractor.getStatistics().cacheSize).toBe(0);
  });

  // 11. Nested table handling
  it('extracts text from nested tables', () => {
    const nestedTable = {
      type: 'table',
      rows: [{
        cells: [{
          elements: [{
            type: 'table',
            rows: [{
              cells: [{
                elements: [{ type: 'paragraph', runs: [{ text: 'Nested' }] }],
              }],
            }],
          }],
        }],
      }],
    };

    const doc = makeDocument([nestedTable]);
    const result = extractor.extractStructure(doc);

    const texts = [...result.textSlots.values()].map(s => s.text);
    expect(texts).toContain('Nested');
  });

  // 12. Mixed content types
  it('handles mixed paragraphs, tables, images, and shapes', () => {
    const doc = makeDocument([
      makeParagraph('Para'),
      makeTable([['Cell']]),
      { type: 'image' },
      { type: 'shape' },
      { type: 'container' },
    ]);

    const result = extractor.extractStructure(doc);
    expect(result.structure.sections[0].elements).toHaveLength(5);

    // image/shape/container are preserved, no text slots from them
    const imageElem = result.structure.sections[0].elements[2];
    expect(imageElem.type).toBe('image');
    expect(imageElem.preserveOriginal).toBe(true);

    // Only paragraph + table cell produce text slots
    expect(result.textSlots.size).toBe(2);
  });

  // 13. Text slot extraction preserves style context
  it('preserves style information in text slots', () => {
    const style = { bold: true, fontSize: 12 };
    const doc = makeDocument([makeParagraph('Styled', style)]);

    const result = extractor.extractStructure(doc);
    const slot = [...result.textSlots.values()][0];

    expect(slot.context.style).toEqual(style);
    expect(slot.context.type).toBe('paragraph');
  });

  // 14. Korean text handling
  it('correctly handles Korean text', () => {
    const doc = makeDocument([
      makeParagraph('안녕하세요'),
      makeTable([['활동', '놀이 시간']]),
    ]);

    const result = extractor.extractStructure(doc);
    const texts = [...result.textSlots.values()].map(s => s.text);
    expect(texts).toContain('안녕하세요');
    expect(texts).toContain('활동');
    expect(texts).toContain('놀이 시간');
  });

  // 15. Edge case: null/undefined sections throw
  it('throws when sections is missing from the document', () => {
    expect(() => extractor.extractStructure({})).toThrow();
    expect(() => extractor.extractStructure(null)).toThrow();
  });
});

describe('DocumentStructureExtractor#validateStructure', () => {
  let extractor;

  beforeEach(() => {
    extractor = new DocumentStructureExtractor({ useCache: false });
  });

  it('returns valid for a well-formed structure', () => {
    const structure = {
      sections: [{ id: 'sec-1', elements: [] }],
    };
    const result = extractor.validateStructure(structure);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid when sections is missing', () => {
    const result = extractor.validateStructure({});
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
