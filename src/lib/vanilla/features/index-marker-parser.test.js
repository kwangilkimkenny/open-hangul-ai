/**
 * index-marker-parser 단위 테스트
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  collectIndexMarkers,
  extractIndexFromRun,
} from './index-marker-parser.js';

function para(runs, opts = {}) {
  return { type: 'paragraph', runs, ...opts };
}

describe('index-marker-parser.extractIndexFromRun', () => {
  it('returns null for plain text runs', () => {
    expect(extractIndexFromRun({ type: 'text', text: '안녕' })).toBeNull();
    expect(extractIndexFromRun(null)).toBeNull();
    expect(extractIndexFromRun({})).toBeNull();
  });

  it('extracts from run.type === "indexEntry"', () => {
    const r = {
      type: 'indexEntry',
      indexTerm: '가능성',
      indexCategory: '명사',
    };
    expect(extractIndexFromRun(r)).toEqual({
      term: '가능성',
      category: '명사',
      sortKey: undefined,
    });
  });

  it('extracts from field type INDEX_ENTRY / IDXMARK', () => {
    expect(extractIndexFromRun({ type: 'field', fieldType: 'INDEX_ENTRY', indexTerm: '가나' }))
      .toMatchObject({ term: '가나' });
    expect(extractIndexFromRun({ type: 'field', fieldType: 'idxmark', indexTerm: '다라' }))
      .toMatchObject({ term: '다라' });
  });

  it('extracts from flat indexTerm/idxMark attributes', () => {
    expect(extractIndexFromRun({ type: 'text', idxMark: '문법' }))
      .toMatchObject({ term: '문법' });
    expect(extractIndexFromRun({ indexMark: '구문' }))
      .toMatchObject({ term: '구문' });
  });

  it('extracts from ruby annotation when _isIndexRuby is true', () => {
    const r = {
      type: 'text',
      text: '韓國',
      _isIndexRuby: true,
      ruby: { text: '한국', category: '국가' },
    };
    expect(extractIndexFromRun(r)).toMatchObject({ term: '한국', category: '국가' });
  });

  it('extracts from preserved XML attrs (hp:indexEntry namespace)', () => {
    const r = {
      type: 'text',
      attrs: { 'hp:indexEntry': '바람', indexCategory: '자연' },
    };
    expect(extractIndexFromRun(r)).toEqual({
      term: '바람',
      category: '자연',
      sortKey: undefined,
    });
  });

  it('trims and normalizes whitespace in term', () => {
    expect(extractIndexFromRun({ indexTerm: '  사과  배  ' }))
      .toMatchObject({ term: '사과 배' });
  });

  it('ignores empty terms', () => {
    expect(extractIndexFromRun({ type: 'indexEntry', indexTerm: '   ' })).toBeNull();
  });
});

describe('index-marker-parser.collectIndexMarkers', () => {
  it('returns [] for invalid input', () => {
    expect(collectIndexMarkers(null)).toEqual([]);
    expect(collectIndexMarkers(undefined)).toEqual([]);
    expect(collectIndexMarkers([])).toEqual([]);
  });

  it('collects markers across sections, attaching paragraphId & indices', () => {
    const sections = [
      {
        elements: [
          para([
            { type: 'text', text: '본문 ' },
            { type: 'indexEntry', indexTerm: '가능성' },
            { type: 'text', text: ' 추가 본문' },
          ], { id: 'p1' }),
          para([{ type: 'text', text: '평범 단락' }]),
          para([
            { type: 'indexEntry', indexTerm: '문법' },
          ]),
        ],
      },
      {
        elements: [
          para([{ idxMark: '바람' }], { id: 'p9' }),
        ],
      },
    ];
    const markers = collectIndexMarkers(sections);
    expect(markers).toHaveLength(3);
    expect(markers[0]).toMatchObject({
      term: '가능성',
      paragraphId: 'p1',
      sectionIndex: 0,
      elementIndex: 0,
      runIndex: 1,
    });
    expect(markers[1]).toMatchObject({
      term: '문법',
      paragraphId: 'para-0-2',
      sectionIndex: 0,
      elementIndex: 2,
    });
    expect(markers[2]).toMatchObject({
      term: '바람',
      paragraphId: 'p9',
      sectionIndex: 1,
      elementIndex: 0,
    });
  });

  it('resolves page numbers from opts.pageMap', () => {
    const sections = [{
      elements: [
        para([{ type: 'indexEntry', indexTerm: '가나' }], { id: 'pp' }),
      ],
    }];
    const markers = collectIndexMarkers(sections, { pageMap: new Map([['pp', 12]]) });
    expect(markers[0].pageNumber).toBe(12);
  });

  it('also picks up paragraph-level indexEntries[] array', () => {
    const sections = [{
      elements: [
        para([{ type: 'text', text: 'x' }], {
          id: 'pa',
          indexEntries: [{ term: '직접' }, { term: '간접', category: '관계' }],
        }),
      ],
    }];
    const markers = collectIndexMarkers(sections);
    expect(markers.map(m => m.term)).toEqual(['직접', '간접']);
    expect(markers[1].category).toBe('관계');
  });
});
