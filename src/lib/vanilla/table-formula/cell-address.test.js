/**
 * cell-address.test.js
 */
import { describe, it, expect } from 'vitest';
import {
  columnLettersToIndex,
  columnIndexToLetters,
  cellAddrToIndex,
  indexToCellAddr,
  isCellAddr,
  parseRange,
  expandRange,
} from './cell-address.js';

describe('cell-address', () => {
  it('converts A → 0, Z → 25', () => {
    expect(columnLettersToIndex('A')).toBe(0);
    expect(columnLettersToIndex('Z')).toBe(25);
  });

  it('converts AA → 26, AB → 27', () => {
    expect(columnLettersToIndex('AA')).toBe(26);
    expect(columnLettersToIndex('AB')).toBe(27);
    expect(columnLettersToIndex('AZ')).toBe(51);
    expect(columnLettersToIndex('BA')).toBe(52);
  });

  it('converts index → letters (single + multi)', () => {
    expect(columnIndexToLetters(0)).toBe('A');
    expect(columnIndexToLetters(25)).toBe('Z');
    expect(columnIndexToLetters(26)).toBe('AA');
    expect(columnIndexToLetters(701)).toBe('ZZ');
    expect(columnIndexToLetters(702)).toBe('AAA');
  });

  it('cellAddrToIndex parses simple addresses', () => {
    expect(cellAddrToIndex('A1')).toEqual({ col: 0, row: 0 });
    expect(cellAddrToIndex('B3')).toEqual({ col: 1, row: 2 });
    expect(cellAddrToIndex('AA10')).toEqual({ col: 26, row: 9 });
  });

  it('cellAddrToIndex accepts $ absolute markers', () => {
    expect(cellAddrToIndex('$A$1')).toEqual({ col: 0, row: 0 });
    expect(cellAddrToIndex('$B3')).toEqual({ col: 1, row: 2 });
  });

  it('indexToCellAddr is inverse of cellAddrToIndex', () => {
    for (const addr of ['A1', 'B3', 'AA10', 'ZZ99', 'AAA1']) {
      const { col, row } = cellAddrToIndex(addr);
      expect(indexToCellAddr(col, row)).toBe(addr);
    }
  });

  it('isCellAddr rejects garbage', () => {
    expect(isCellAddr('A1')).toBe(true);
    expect(isCellAddr('1A')).toBe(false);
    expect(isCellAddr('A')).toBe(false);
    expect(isCellAddr('A0')).toBe(false);
    expect(isCellAddr('')).toBe(false);
    expect(isCellAddr(null)).toBe(false);
  });

  it('parseRange normalizes order', () => {
    expect(parseRange('A1:B2')).toEqual({
      start: { col: 0, row: 0 },
      end: { col: 1, row: 1 },
    });
    expect(parseRange('B2:A1')).toEqual({
      start: { col: 0, row: 0 },
      end: { col: 1, row: 1 },
    });
  });

  it('expandRange enumerates every cell in row-major order', () => {
    expect(expandRange('A1:B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
    expect(expandRange('A1:A3')).toEqual(['A1', 'A2', 'A3']);
    expect(expandRange('A1:C1')).toEqual(['A1', 'B1', 'C1']);
  });

  it('throws on invalid address', () => {
    expect(() => cellAddrToIndex('xyz')).toThrow();
    expect(() => indexToCellAddr(-1, 0)).toThrow();
    expect(() => parseRange('A1')).toThrow();
  });
});
