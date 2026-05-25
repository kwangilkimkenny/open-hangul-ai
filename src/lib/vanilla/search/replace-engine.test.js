import { describe, it, expect } from 'vitest';
import { replaceOne, replaceAll, expandReplacement } from './replace-engine.js';
import { searchDocument } from './search-engine.js';

function makeDoc(paragraphs) {
  return {
    sections: [
      {
        paragraphs: paragraphs.map(runs => ({ runs })),
      },
    ],
  };
}

describe('expandReplacement', () => {
  it('returns text as-is when no $refs', () => {
    expect(expandReplacement('hello', [])).toBe('hello');
  });

  it('expands $1/$2 capture groups', () => {
    expect(expandReplacement('$2-$1', ['a', 'b'])).toBe('b-a');
  });

  it('treats $$ as literal $', () => {
    expect(expandReplacement('$$1=$1', ['X'])).toBe('$1=X');
  });

  it('missing group → empty', () => {
    expect(expandReplacement('$3', ['a', 'b'])).toBe('');
  });
});

describe('replaceOne', () => {
  it('replaces a single match and preserves style', () => {
    const doc = makeDoc([[{ text: 'hello world', style: { bold: true, color: '#f00' } }]]);
    const matches = searchDocument(doc, 'world');
    expect(matches).toHaveLength(1);
    const { doc: out, replaced } = replaceOne(doc, matches[0], 'universe');
    expect(replaced).toBe(true);
    const run = out.sections[0].paragraphs[0].runs[0];
    expect(run.text).toBe('hello universe');
    expect(run.style).toEqual({ bold: true, color: '#f00' });
    // 원본 doc 은 불변
    expect(doc.sections[0].paragraphs[0].runs[0].text).toBe('hello world');
  });

  it('returns replaced=false when slice mismatches', () => {
    const doc = makeDoc([[{ text: 'abc' }]]);
    const bogus = { sectionIdx: 0, paragraphIdx: 0, runIdx: 0, start: 0, end: 3, text: 'xyz' };
    const { replaced } = replaceOne(doc, bogus, 'XYZ');
    expect(replaced).toBe(false);
  });

  it('replaces with regex capture group expansion', () => {
    const doc = makeDoc([[{ text: 'date: 2025-01-15' }]]);
    const matches = searchDocument(doc, '(\\d{4})-(\\d{2})-(\\d{2})', { regex: true });
    const { doc: out } = replaceOne(doc, matches[0], '$3/$2/$1');
    expect(out.sections[0].paragraphs[0].runs[0].text).toBe('date: 15/01/2025');
  });
});

describe('replaceAll', () => {
  it('replaces all occurrences and returns count', () => {
    const doc = makeDoc([[{ text: 'foo bar foo baz foo' }]]);
    const { doc: out, replaceCount } = replaceAll(doc, 'foo', 'FOO');
    expect(replaceCount).toBe(3);
    expect(out.sections[0].paragraphs[0].runs[0].text).toBe('FOO bar FOO baz FOO');
  });

  it('preserves style for every replaced run', () => {
    const doc = makeDoc([
      [
        { text: 'aaa', style: { bold: true } },
        { text: 'aaa', style: { italic: true } },
      ],
    ]);
    const { doc: out, replaceCount } = replaceAll(doc, 'aaa', 'X');
    expect(replaceCount).toBe(2);
    const runs = out.sections[0].paragraphs[0].runs;
    expect(runs[0].text).toBe('X');
    expect(runs[0].style.bold).toBe(true);
    expect(runs[1].text).toBe('X');
    expect(runs[1].style.italic).toBe(true);
  });

  it('handles multiple matches within same run with overlap-safe order', () => {
    const doc = makeDoc([[{ text: 'aaaa' }]]);
    const { doc: out, replaceCount } = replaceAll(doc, 'a', 'BB');
    expect(replaceCount).toBe(4);
    expect(out.sections[0].paragraphs[0].runs[0].text).toBe('BBBBBBBB');
  });

  it('respects caseSensitive option', () => {
    const doc = makeDoc([[{ text: 'Foo foo FOO' }]]);
    const { replaceCount } = replaceAll(doc, 'foo', 'X', { caseSensitive: true });
    expect(replaceCount).toBe(1);
  });

  it('respects styleFilter option', () => {
    const doc = makeDoc([
      [
        { text: 'tag', style: { bold: true } },
        { text: 'tag', style: {} },
      ],
    ]);
    const { doc: out, replaceCount } = replaceAll(doc, 'tag', 'TAG', { styleFilter: { bold: true } });
    expect(replaceCount).toBe(1);
    const runs = out.sections[0].paragraphs[0].runs;
    expect(runs[0].text).toBe('TAG');
    expect(runs[1].text).toBe('tag');
  });

  it('regex capture groups in replacement', () => {
    const doc = makeDoc([[{ text: 'A1 B2 C3' }]]);
    const { doc: out, replaceCount } = replaceAll(doc, '([A-Z])(\\d)', '$2$1', { regex: true });
    expect(replaceCount).toBe(3);
    expect(out.sections[0].paragraphs[0].runs[0].text).toBe('1A 2B 3C');
  });

  it('returns 0 when query not found', () => {
    const doc = makeDoc([[{ text: 'hello' }]]);
    const { replaceCount } = replaceAll(doc, 'xyz', 'X');
    expect(replaceCount).toBe(0);
  });

  it('returns 0 for empty query', () => {
    const doc = makeDoc([[{ text: 'hello' }]]);
    const { replaceCount } = replaceAll(doc, '', 'X');
    expect(replaceCount).toBe(0);
  });

  it('does not mutate input doc', () => {
    const doc = makeDoc([[{ text: 'foo' }]]);
    replaceAll(doc, 'foo', 'bar');
    expect(doc.sections[0].paragraphs[0].runs[0].text).toBe('foo');
  });
});
