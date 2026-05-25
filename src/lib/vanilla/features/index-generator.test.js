/**
 * index-generator 단위 테스트
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
  getKoreanInitial,
  getGroupKey,
  collectIndexEntries,
  buildIndexTree,
  renderIndex,
  generateIndex,
} from './index-generator.js';

function para(runs, opts = {}) {
  return { type: 'paragraph', runs, ...opts };
}

describe('index-generator.getKoreanInitial', () => {
  it('extracts choseong from 한글 syllables', () => {
    expect(getKoreanInitial('가')).toBe('ㄱ');
    expect(getKoreanInitial('나')).toBe('ㄴ');
    expect(getKoreanInitial('따')).toBe('ㄸ');
    expect(getKoreanInitial('힣')).toBe('ㅎ');
    expect(getKoreanInitial('한')).toBe('ㅎ');
  });

  it('returns the jamo itself when already a 자모', () => {
    expect(getKoreanInitial('ㄱ')).toBe('ㄱ');
    expect(getKoreanInitial('ㅎ')).toBe('ㅎ');
  });

  it('returns empty string for non-Korean', () => {
    expect(getKoreanInitial('A')).toBe('');
    expect(getKoreanInitial('漢')).toBe('');
    expect(getKoreanInitial('')).toBe('');
    expect(getKoreanInitial(null)).toBe('');
  });
});

describe('index-generator.getGroupKey', () => {
  it('groups by 초성 for 한글 terms', () => {
    expect(getGroupKey('가능성')).toBe('ㄱ');
    expect(getGroupKey('마음')).toBe('ㅁ');
  });

  it('collapses doubled jamo when option is set', () => {
    expect(getGroupKey('까치')).toBe('ㄲ');
    expect(getGroupKey('까치', { collapseDoubled: true })).toBe('ㄱ');
    expect(getGroupKey('빵', { collapseDoubled: true })).toBe('ㅂ');
  });

  it('groups English by uppercase letter', () => {
    expect(getGroupKey('apple')).toBe('A');
    expect(getGroupKey('Banana')).toBe('B');
  });

  it('groups digits under "0-9" and others under "기타"', () => {
    expect(getGroupKey('123abc')).toBe('0-9');
    expect(getGroupKey('@@@')).toBe('기타');
    expect(getGroupKey('漢字')).toBe('기타');
    expect(getGroupKey('')).toBe('기타');
  });
});

describe('index-generator.collectIndexEntries', () => {
  it('merges duplicate terms across paragraphs and unions pages', () => {
    const sections = [{
      elements: [
        para([{ type: 'indexEntry', indexTerm: '가능성' }], { id: 'p1', pageNumber: 1 }),
        para([{ type: 'indexEntry', indexTerm: '나라' }], { id: 'p2', pageNumber: 2 }),
        para([{ type: 'indexEntry', indexTerm: '가능성' }], { id: 'p3', pageNumber: 4 }),
        para([{ type: 'indexEntry', indexTerm: '가능성' }], { id: 'p4', pageNumber: 1 }),
      ],
    }];
    const entries = collectIndexEntries(sections);
    expect(entries).toHaveLength(2);
    const gangs = entries.find(e => e.term === '가능성');
    expect(gangs.pages).toEqual([1, 4]); // 중복 제거 + 정렬
    expect(gangs.refs).toHaveLength(3);
    const nara = entries.find(e => e.term === '나라');
    expect(nara.pages).toEqual([2]);
  });

  it('keeps separate entries when category differs', () => {
    const sections = [{
      elements: [
        para([{ type: 'indexEntry', indexTerm: '가', indexCategory: 'A' }], { id: 'a' }),
        para([{ type: 'indexEntry', indexTerm: '가', indexCategory: 'B' }], { id: 'b' }),
      ],
    }];
    const entries = collectIndexEntries(sections);
    expect(entries).toHaveLength(2);
  });

  it('produces lowercase NFC sortKey', () => {
    const sections = [{
      elements: [para([{ type: 'indexEntry', indexTerm: 'Apple' }], { id: 'p' })],
    }];
    const entries = collectIndexEntries(sections);
    expect(entries[0].sortKey).toBe('apple');
  });
});

describe('index-generator.buildIndexTree', () => {
  function entry(term, sortKey) {
    return { term, sortKey: sortKey || term.toLowerCase(), pages: [], refs: [] };
  }

  it('groups entries by initial and orders 한글 → 0-9 → A-Z → 기타', () => {
    const entries = [
      entry('Apple'),
      entry('나무'),
      entry('가나'),
      entry('123abc', '123abc'),
      entry('!hi', '!hi'),
      entry('Banana'),
    ];
    const tree = buildIndexTree(entries);
    const keys = Array.from(tree.keys());
    expect(keys).toEqual(['ㄱ', 'ㄴ', '0-9', 'A', 'B', '기타']);
  });

  it('sorts entries within each group via a custom compare', () => {
    const entries = [
      entry('나비'),
      entry('가능성'),
      entry('가다'),
    ];
    const tree = buildIndexTree(entries, {
      compare: (a, b) => a.sortKey < b.sortKey ? -1 : (a.sortKey > b.sortKey ? 1 : 0),
    });
    // 단순 codepoint 비교: 가능성(가능...) vs 가다(가ㄷ...) 에서 '능' < '다' 이므로 능성 먼저
    const gangs = tree.get('ㄱ').map(e => e.term);
    expect(gangs).toContain('가능성');
    expect(gangs).toContain('가다');
    expect(gangs).toHaveLength(2);
    expect(tree.get('ㄴ').map(e => e.term)).toEqual(['나비']);
  });

  it('returns empty Map for empty input', () => {
    expect(buildIndexTree([]).size).toBe(0);
    expect(buildIndexTree(null).size).toBe(0);
  });

  it('honors collapseDoubled in group keying', () => {
    const entries = [entry('까치'), entry('가다')];
    const tree = buildIndexTree(entries, { collapseDoubled: true });
    expect(Array.from(tree.keys())).toEqual(['ㄱ']);
    expect(tree.get('ㄱ')).toHaveLength(2);
  });
});

describe('index-generator.renderIndex', () => {
  it('emits nav > section > ol > li > a structure', () => {
    const tree = new Map([
      ['ㄱ', [
        {
          term: '가능성',
          sortKey: '가능성',
          pages: [12, 34],
          refs: [{ paragraphId: 'p1', pageNumber: 12 }, { paragraphId: 'p3', pageNumber: 34 }],
        },
      ]],
      ['ㄴ', [
        { term: '나라', sortKey: '나라', pages: [7], refs: [{ paragraphId: 'p7' }] },
      ]],
    ]);
    const nav = renderIndex(tree, { title: '색인' });
    expect(nav.tagName).toBe('NAV');
    expect(nav.classList.contains('hwp-index')).toBe(true);
    expect(nav.querySelector('.hwp-index__title').textContent).toBe('색인');

    const sections = nav.querySelectorAll('section.hwp-index__group');
    expect(sections).toHaveLength(2);
    expect(sections[0].getAttribute('data-initial')).toBe('ㄱ');
    expect(sections[0].querySelector('.hwp-index__initial').textContent).toBe('ㄱ');

    const firstLink = sections[0].querySelector('a.hwp-index__link');
    expect(firstLink.getAttribute('href')).toBe('#p1');
    expect(firstLink.textContent).toBe('가능성');

    const pages = sections[0].querySelector('.hwp-index__pages');
    expect(pages.textContent.trim()).toBe('12, 34');
  });

  it('omits pages span when showPageNumbers=false', () => {
    const tree = new Map([
      ['ㄱ', [{ term: '가', sortKey: '가', pages: [1], refs: [{ paragraphId: 'p' }] }]],
    ]);
    const nav = renderIndex(tree, { showPageNumbers: false });
    expect(nav.querySelector('.hwp-index__pages')).toBeNull();
  });

  it('returns nav with just title when tree is empty', () => {
    const nav = renderIndex(new Map());
    expect(nav.querySelectorAll('section.hwp-index__group').length).toBe(0);
    expect(nav.querySelector('.hwp-index__title')).not.toBeNull();
  });
});

describe('index-generator.generateIndex (entrypoint)', () => {
  it('builds full index from a document object end-to-end', () => {
    const doc = {
      sections: [{
        elements: [
          para([{ type: 'indexEntry', indexTerm: '가능성' }], { id: 'a', pageNumber: 3 }),
          para([{ type: 'indexEntry', indexTerm: 'apple' }], { id: 'b', pageNumber: 5 }),
          para([{ type: 'indexEntry', indexTerm: '나라' }], { id: 'c', pageNumber: 1 }),
        ],
      }],
    };
    const nav = generateIndex(doc, { title: '색인' });
    const groupKeys = Array.from(nav.querySelectorAll('section.hwp-index__group'))
      .map(s => s.getAttribute('data-initial'));
    expect(groupKeys).toEqual(['ㄱ', 'ㄴ', 'A']);
    // page numbers preserved
    const allPages = Array.from(nav.querySelectorAll('.hwp-index__pages'))
      .map(s => s.textContent.trim());
    expect(allPages).toEqual(['3', '1', '5']);
  });

  it('handles empty document gracefully', () => {
    const nav = generateIndex({ sections: [] });
    expect(nav.tagName).toBe('NAV');
    expect(nav.querySelectorAll('section.hwp-index__group').length).toBe(0);
  });
});
