import { describe, it, expect } from 'vitest';
import { searchDocument, countMatches } from './search-engine.js';

/**
 * 작은 헬퍼: 텍스트 한 줄 doc 만들기.
 *
 * @param {Array<Array<{text:string, style?:Object, type?:string, name?:string}>>} paragraphs
 *   각 단락은 run 배열. (여러 섹션 X — 단일 섹션)
 * @returns {Object}
 */
function makeDoc(paragraphs) {
  return {
    sections: [
      {
        paragraphs: paragraphs.map(runs => ({ runs, text: runs.map(r => r.text || '').join('') })),
      },
    ],
  };
}

describe('search-engine - basic', () => {
  it('finds plain occurrence', () => {
    const doc = makeDoc([[{ text: '안녕하세요 세계' }]]);
    const matches = searchDocument(doc, '세계');
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('세계');
    expect(matches[0].start).toBe(6);
    expect(matches[0].end).toBe(8);
  });

  it('returns empty for empty query', () => {
    const doc = makeDoc([[{ text: 'abc' }]]);
    expect(searchDocument(doc, '')).toEqual([]);
  });

  it('returns empty for missing doc', () => {
    expect(searchDocument(null, 'foo')).toEqual([]);
    expect(searchDocument({}, 'foo')).toEqual([]);
  });

  it('finds across multiple paragraphs and runs', () => {
    const doc = makeDoc([
      [{ text: 'foo' }, { text: 'bar' }],
      [{ text: 'foobar' }],
    ]);
    const matches = searchDocument(doc, 'foo');
    expect(matches).toHaveLength(2);
    expect(matches[0].paragraphIdx).toBe(0);
    expect(matches[0].runIdx).toBe(0);
    expect(matches[1].paragraphIdx).toBe(1);
  });

  it('includes context around match', () => {
    const doc = makeDoc([[{ text: 'lorem ipsum dolor sit amet' }]]);
    const matches = searchDocument(doc, 'dolor');
    expect(matches[0].context).toContain('dolor');
  });

  it('skips non-text runs (linebreak/bookmark)', () => {
    const doc = makeDoc([
      [{ type: 'linebreak' }, { text: 'foo' }, { type: 'bookmark', name: 'b1', text: '' }],
    ]);
    const matches = searchDocument(doc, 'foo');
    expect(matches).toHaveLength(1);
    expect(matches[0].runIdx).toBe(1);
  });
});

describe('search-engine - case sensitivity', () => {
  it('case-insensitive by default', () => {
    const doc = makeDoc([[{ text: 'Hello World' }]]);
    expect(searchDocument(doc, 'hello')).toHaveLength(1);
    expect(searchDocument(doc, 'WORLD')).toHaveLength(1);
  });

  it('caseSensitive: true respects case', () => {
    const doc = makeDoc([[{ text: 'Hello hello HELLO' }]]);
    const matches = searchDocument(doc, 'hello', { caseSensitive: true });
    expect(matches).toHaveLength(1);
    expect(matches[0].start).toBe(6);
  });
});

describe('search-engine - wholeWord', () => {
  it('whole word matches only at word boundaries', () => {
    const doc = makeDoc([[{ text: 'cat catalog category cat.' }]]);
    const matches = searchDocument(doc, 'cat', { wholeWord: true });
    // "cat" (단독), "cat." 끝 → 2개; catalog/category 는 제외
    expect(matches).toHaveLength(2);
  });

  it('whole word allows hangul boundaries', () => {
    const doc = makeDoc([[{ text: '한국 한국어 한국' }]]);
    const matches = searchDocument(doc, '한국', { wholeWord: true });
    // 한글은 단어문자가 아니므로 양옆 한글이어도 인정
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('search-engine - regex', () => {
  it('regex mode matches pattern', () => {
    const doc = makeDoc([[{ text: 'phone: 010-1234-5678' }]]);
    const matches = searchDocument(doc, '\\d{3}-\\d{4}-\\d{4}', { regex: true });
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('010-1234-5678');
  });

  it('regex with capture groups exposes groups', () => {
    const doc = makeDoc([[{ text: 'a=1 b=22' }]]);
    const matches = searchDocument(doc, '(\\w+)=(\\d+)', { regex: true });
    expect(matches).toHaveLength(2);
    expect(matches[0].groups).toEqual(['a', '1']);
    expect(matches[1].groups).toEqual(['b', '22']);
  });

  it('invalid regex returns empty result', () => {
    const doc = makeDoc([[{ text: 'abc' }]]);
    const matches = searchDocument(doc, '[', { regex: true });
    expect(matches).toEqual([]);
  });
});

describe('search-engine - ignoreSimilarChars', () => {
  it('ignores tense consonants and similar vowels', () => {
    const doc = makeDoc([[{ text: '깡 강 갱' }]]);
    const matches = searchDocument(doc, '강', { ignoreSimilarChars: true });
    // 깡/강/갱 모두 → 강 으로 정규화 매치 (3건)
    expect(matches.length).toBe(3);
  });

  it('without ignoreSimilarChars treats them as different', () => {
    const doc = makeDoc([[{ text: '깡 강 갱' }]]);
    const matches = searchDocument(doc, '강');
    expect(matches.length).toBe(1);
  });
});

describe('search-engine - styleFilter', () => {
  it('matches only when style fits filter', () => {
    const doc = makeDoc([
      [
        { text: 'foo', style: { bold: true } },
        { text: 'foo', style: {} },
      ],
    ]);
    const matches = searchDocument(doc, 'foo', { styleFilter: { bold: true } });
    expect(matches).toHaveLength(1);
    expect(matches[0].runIdx).toBe(0);
  });

  it('matches by color', () => {
    const doc = makeDoc([
      [
        { text: 'a', style: { color: '#ff0000' } },
        { text: 'b', style: { color: '#00ff00' } },
        { text: 'a', style: { color: '#ff0000' } },
      ],
    ]);
    const matches = searchDocument(doc, 'a', { styleFilter: { color: '#ff0000' } });
    expect(matches).toHaveLength(2);
  });
});

describe('search-engine - bookmarkOnly', () => {
  it('returns only matches in paragraphs containing a bookmark run', () => {
    const doc = makeDoc([
      [{ text: 'plain hello' }],
      [{ type: 'bookmark', name: 'b1', text: '' }, { text: 'marked hello' }],
    ]);
    const matches = searchDocument(doc, 'hello', { bookmarkOnly: true });
    expect(matches).toHaveLength(1);
    expect(matches[0].paragraphIdx).toBe(1);
  });
});

describe('search-engine - countMatches', () => {
  it('returns count', () => {
    const doc = makeDoc([[{ text: 'aaa aaa aaa' }]]);
    expect(countMatches(doc, 'aaa')).toBe(3);
  });
});
