/**
 * Tests for validation module
 * @module ai/validation.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

import { validateStructure, validateSlotData, validateChanges, deepCompare } from './validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(elementTypes = ['paragraph']) {
  return {
    sections: [{
      elements: elementTypes.map(type => {
        if (type === 'table') {
          return { type: 'table', rows: [{ cells: [{}] }] };
        }
        return { type, runs: [{ text: 'hello' }] };
      }),
    }],
  };
}

// ---------------------------------------------------------------------------
// validateStructure
// ---------------------------------------------------------------------------

describe('validateStructure', () => {
  // 1. Valid structure passes
  it('returns valid when original and updated have the same structure', () => {
    const doc = makeDoc(['paragraph', 'paragraph']);
    const clone = JSON.parse(JSON.stringify(doc));

    const result = validateStructure(doc, clone);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 2. Missing sections fails
  it('returns invalid when sections is missing', () => {
    const result = validateStructure({}, { sections: [] });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns invalid when either argument is null', () => {
    const result = validateStructure(null, makeDoc());
    expect(result.isValid).toBe(false);
  });

  it('detects section count mismatch', () => {
    const original = { sections: [{ elements: [] }] };
    const updated = { sections: [{ elements: [] }, { elements: [] }] };
    const result = validateStructure(original, updated);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('불일치'))).toBe(true);
  });

  it('detects element count mismatch within a section', () => {
    const original = { sections: [{ elements: [{ type: 'paragraph' }] }] };
    const updated = { sections: [{ elements: [{ type: 'paragraph' }, { type: 'paragraph' }] }] };
    const result = validateStructure(original, updated);
    expect(result.isValid).toBe(false);
  });

  it('detects element type mismatch', () => {
    const original = { sections: [{ elements: [{ type: 'paragraph' }] }] };
    const updated = { sections: [{ elements: [{ type: 'table', rows: [] }] }] };
    const result = validateStructure(original, updated);
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSlotData
// ---------------------------------------------------------------------------

describe('validateSlotData', () => {
  // 3. Matching slots pass
  it('returns valid when all updated slots exist in original map', () => {
    const originalSlots = new Map();
    originalSlots.set('slot-1', { text: 'hello' });

    const updatedSlots = [{ slotId: 'slot-1', newText: 'world' }];

    const result = validateSlotData(updatedSlots, originalSlots);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 4. Missing slots detected (warning, not error)
  it('warns when an updated slot does not exist in original map', () => {
    const originalSlots = new Map();
    const updatedSlots = [{ slotId: 'slot-missing', newText: 'new' }];

    const result = validateSlotData(updatedSlots, originalSlots);
    // It is still valid (only a warning)
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns invalid when updatedSlots is not an array', () => {
    const result = validateSlotData('not-an-array', new Map());
    expect(result.isValid).toBe(false);
  });

  it('returns invalid when originalTextSlots is not a Map', () => {
    const result = validateSlotData([], {});
    expect(result.isValid).toBe(false);
  });

  it('errors when a slot has no slotId', () => {
    const result = validateSlotData([{ newText: 'x' }], new Map());
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('slotId'))).toBe(true);
  });

  it('errors when newText is not a string', () => {
    const result = validateSlotData([{ slotId: 'a', newText: 123 }], new Map());
    expect(result.isValid).toBe(false);
  });

  it('warns when newText is more than 3x the original length', () => {
    const originalSlots = new Map();
    originalSlots.set('slot-1', { text: 'hi' });

    const updatedSlots = [{ slotId: 'slot-1', newText: 'a'.repeat(100) }];

    const result = validateSlotData(updatedSlots, originalSlots);
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// validateChanges
// ---------------------------------------------------------------------------

describe('validateChanges', () => {
  // 5. Returns empty errors for valid changes
  it('returns valid for structurally identical documents', () => {
    const doc = makeDoc(['paragraph']);
    const clone = JSON.parse(JSON.stringify(doc));
    const updatedSlots = [{ slotId: 'a', newText: 'x' }];

    const result = validateChanges(doc, clone, updatedSlots);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.totalSlots).toBe(1);
  });

  // 6. Returns errors for invalid changes (structure mismatch)
  it('returns errors when structure differs', () => {
    const original = { sections: [{ elements: [{ type: 'paragraph' }] }] };
    const updated = { sections: [] };

    const result = validateChanges(original, updated, []);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('counts empty slots', () => {
    const doc = makeDoc();
    const clone = JSON.parse(JSON.stringify(doc));
    const updatedSlots = [
      { slotId: 'a', newText: '' },
      { slotId: 'b', newText: 'hi' },
    ];

    const result = validateChanges(doc, clone, updatedSlots);
    expect(result.stats.emptySlots).toBe(1);
    expect(result.stats.totalSlots).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// deepCompare
// ---------------------------------------------------------------------------

describe('deepCompare', () => {
  // 7. Equal objects return true
  it('returns true for deeply equal objects', () => {
    const a = { x: 1, y: { z: [1, 2, 3] } };
    const b = { x: 1, y: { z: [1, 2, 3] } };
    expect(deepCompare(a, b)).toBe(true);
  });

  // 8. Different objects return false
  it('returns false for different objects', () => {
    expect(deepCompare({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepCompare({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepCompare([1, 2], [1, 3])).toBe(false);
    expect(deepCompare([1], [1, 2])).toBe(false);
  });

  // 9. Ignore paths work
  it('ignores specified keys during comparison', () => {
    const a = { x: 1, timestamp: 'aaa' };
    const b = { x: 1, timestamp: 'bbb' };

    expect(deepCompare(a, b)).toBe(false);
    expect(deepCompare(a, b, ['timestamp'])).toBe(true);
  });

  it('handles null values correctly', () => {
    expect(deepCompare(null, null)).toBe(true);
    expect(deepCompare(null, {})).toBe(false);
    expect(deepCompare({}, null)).toBe(false);
  });

  it('handles primitive values correctly', () => {
    expect(deepCompare(1, 1)).toBe(true);
    expect(deepCompare('a', 'a')).toBe(true);
    expect(deepCompare(1, '1')).toBe(false);
  });

  it('handles nested arrays and objects', () => {
    const a = { items: [{ id: 1 }, { id: 2 }] };
    const b = { items: [{ id: 1 }, { id: 2 }] };
    expect(deepCompare(a, b)).toBe(true);

    const c = { items: [{ id: 1 }, { id: 3 }] };
    expect(deepCompare(a, c)).toBe(false);
  });
});
