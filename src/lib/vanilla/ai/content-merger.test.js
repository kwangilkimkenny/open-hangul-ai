/**
 * Tests for ContentMerger
 * @module ai/content-merger.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

vi.mock('../config/ai-config.js', () => ({
  AIConfig: {
    merging: {
      validateStructure: false,
      saveHistory: false,
      maxHistorySize: 10,
      maxTextLengthRatio: 3.0,
    },
  },
}));

// Mock validation module so mergeGeneratedContent does not actually validate
vi.mock('./validation.js', () => ({
  validateStructure: vi.fn(() => ({ isValid: true, errors: [] })),
  validateSlotData: vi.fn(() => ({ isValid: true, errors: [], warnings: [] })),
}));

vi.mock('../utils/error.js', async () => {
  const actual = await vi.importActual('../utils/error.js');
  return actual;
});

import { ContentMerger, mergeContent } from './content-merger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFixtures() {
  const slotId = 'slot-test-1';

  const originalDocument = {
    sections: [{
      elements: [{
        type: 'paragraph',
        runs: [{ text: 'Original text', style: { bold: true } }],
      }],
    }],
  };

  const textSlots = new Map();
  textSlots.set(slotId, {
    text: 'Original text',
    path: { section: 0, element: 0, run: 0 },
    context: { type: 'paragraph', style: { bold: true } },
  });

  const generatedContent = {
    updatedSlots: [
      { slotId, newText: 'Updated text' },
    ],
  };

  const extractedData = { textSlots };

  return { slotId, originalDocument, generatedContent, extractedData, textSlots };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContentMerger', () => {
  let merger;

  beforeEach(() => {
    merger = new ContentMerger({ validateStructure: false, saveHistory: false });
  });

  // 1. Constructor / initialization
  it('initializes with default statistics', () => {
    expect(merger.stats.totalMerges).toBe(0);
    expect(merger.history).toEqual([]);
    expect(merger.options.validateStructure).toBe(false);
  });

  // 2. Basic merge: replace text in slot
  it('replaces text at the correct path', () => {
    const { originalDocument, generatedContent, extractedData } = buildFixtures();

    const updated = merger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);

    expect(updated.sections[0].elements[0].runs[0].text).toBe('Updated text');
    expect(merger.stats.successfulMerges).toBe(1);
    expect(merger.stats.totalSlotsUpdated).toBe(1);
  });

  // 3. Merge preserving formatting / style
  it('preserves the style object of the original run', () => {
    const { originalDocument, generatedContent, extractedData } = buildFixtures();

    const updated = merger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);

    // Style should be carried over (deep clone keeps it)
    expect(updated.sections[0].elements[0].runs[0].style).toEqual({ bold: true });
  });

  // 4. Missing slot handling (slot not in path map)
  it('skips slots that are not found in the path map', () => {
    const { originalDocument, extractedData } = buildFixtures();

    const generatedContent = {
      updatedSlots: [
        { slotId: 'slot-nonexistent', newText: 'Ghost' },
      ],
    };

    const updated = merger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);

    // Original text should be unchanged
    expect(updated.sections[0].elements[0].runs[0].text).toBe('Original text');
  });

  // 5. Extra slot handling (ignored gracefully)
  it('ignores extra updated slots that do not map to original slots', () => {
    const { originalDocument, generatedContent, extractedData, slotId } = buildFixtures();

    generatedContent.updatedSlots.push({ slotId: 'slot-extra', newText: 'Extra' });

    // Should not throw
    const updated = merger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);
    expect(updated.sections[0].elements[0].runs[0].text).toBe('Updated text');
  });

  // 6. Document structure preservation
  it('preserves the number of sections and elements', () => {
    const { originalDocument, generatedContent, extractedData } = buildFixtures();

    const updated = merger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);

    expect(updated.sections.length).toBe(originalDocument.sections.length);
    expect(updated.sections[0].elements.length).toBe(originalDocument.sections[0].elements.length);
  });

  // 7. Empty updatedSlots array
  it('returns a clone with no changes when updatedSlots is empty', () => {
    const { originalDocument, extractedData } = buildFixtures();
    const generatedContent = { updatedSlots: [] };

    const updated = merger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);

    expect(updated.sections[0].elements[0].runs[0].text).toBe('Original text');
    expect(merger.stats.totalSlotsUpdated).toBe(0);
  });

  // 8. Korean text merge
  it('correctly merges Korean text', () => {
    const slotId = 'slot-kr';
    const originalDocument = {
      sections: [{
        elements: [{
          type: 'paragraph',
          runs: [{ text: '원본 텍스트' }],
        }],
      }],
    };

    const textSlots = new Map();
    textSlots.set(slotId, {
      text: '원본 텍스트',
      path: { section: 0, element: 0, run: 0 },
      context: { type: 'paragraph' },
    });

    const generatedContent = {
      updatedSlots: [{ slotId, newText: '수정된 텍스트' }],
    };

    const updated = merger.mergeGeneratedContent(originalDocument, generatedContent, { textSlots });
    expect(updated.sections[0].elements[0].runs[0].text).toBe('수정된 텍스트');
  });

  // 9. Multiple slots merge
  it('merges multiple slots in one call', () => {
    const slot1 = 'slot-a';
    const slot2 = 'slot-b';

    const originalDocument = {
      sections: [{
        elements: [
          { type: 'paragraph', runs: [{ text: 'AAA' }] },
          { type: 'paragraph', runs: [{ text: 'BBB' }] },
        ],
      }],
    };

    const textSlots = new Map();
    textSlots.set(slot1, { text: 'AAA', path: { section: 0, element: 0, run: 0 }, context: {} });
    textSlots.set(slot2, { text: 'BBB', path: { section: 0, element: 1, run: 0 }, context: {} });

    const generatedContent = {
      updatedSlots: [
        { slotId: slot1, newText: 'aaa' },
        { slotId: slot2, newText: 'bbb' },
      ],
    };

    const updated = merger.mergeGeneratedContent(originalDocument, generatedContent, { textSlots });

    expect(updated.sections[0].elements[0].runs[0].text).toBe('aaa');
    expect(updated.sections[0].elements[1].runs[0].text).toBe('bbb');
    expect(merger.stats.totalSlotsUpdated).toBe(2);
  });

  // 10. Merge with validation enabled
  it('works with validation enabled when validation passes', async () => {
    const { validateStructure, validateSlotData } = await import('./validation.js');
    validateStructure.mockReturnValue({ isValid: true, errors: [] });
    validateSlotData.mockReturnValue({ isValid: true, errors: [], warnings: [] });

    const validatingMerger = new ContentMerger({ validateStructure: true, saveHistory: false });
    const { originalDocument, generatedContent, extractedData } = buildFixtures();

    const updated = validatingMerger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);
    expect(updated.sections[0].elements[0].runs[0].text).toBe('Updated text');
  });

  // 11. Edge cases: null inputs throw
  it('throws when originalDocument is null', () => {
    const { generatedContent, extractedData } = buildFixtures();
    expect(() => merger.mergeGeneratedContent(null, generatedContent, extractedData)).toThrow();
    expect(merger.stats.failedMerges).toBe(1);
  });

  it('throws when generatedContent is null', () => {
    const { originalDocument, extractedData } = buildFixtures();
    expect(() => merger.mergeGeneratedContent(originalDocument, null, extractedData)).toThrow();
  });

  it('throws when extractedData is null', () => {
    const { originalDocument, generatedContent } = buildFixtures();
    expect(() => merger.mergeGeneratedContent(originalDocument, generatedContent, null)).toThrow();
  });

  // 12. Original document not mutated
  it('does not mutate the original document', () => {
    const { originalDocument, generatedContent, extractedData } = buildFixtures();
    const originalText = originalDocument.sections[0].elements[0].runs[0].text;

    merger.mergeGeneratedContent(originalDocument, generatedContent, extractedData);

    expect(originalDocument.sections[0].elements[0].runs[0].text).toBe(originalText);
  });
});

describe('mergeContent convenience function', () => {
  it('delegates to ContentMerger and returns an updated document', () => {
    const { originalDocument, generatedContent, extractedData } = buildFixtures();

    const updated = mergeContent(originalDocument, generatedContent, extractedData, {
      validateStructure: false,
      saveHistory: false,
    });

    expect(updated.sections[0].elements[0].runs[0].text).toBe('Updated text');
  });
});
