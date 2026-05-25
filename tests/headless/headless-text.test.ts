/**
 * Headless text-extractor 테스트.
 *
 * golden 픽스처의 textSamples (parserAssertions) 가 모두 추출되는지 확인.
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parseHwpxHeadless,
  extractPlainText,
  extractStructuredText,
  extractTables,
} from '../../src/lib/headless/index.js';

interface ExpectedJson {
  parserAssertions?: {
    textSamples?: string[];
    cellTextSamples?: string[];
    rowCount?: number;
    sections?: number;
    paragraphCount?: number;
  };
}

async function loadDoc(name: string) {
  const buf = await readFile(resolve(__dirname, '../golden', name, 'fixture.hwpx'));
  return parseHwpxHeadless(buf);
}

async function loadExpected(name: string): Promise<ExpectedJson> {
  const raw = await readFile(resolve(__dirname, '../golden', name, 'expected.json'), 'utf8');
  return JSON.parse(raw) as ExpectedJson;
}

describe('text-extractor: extractPlainText', () => {
  it('01-paragraph: textSamples 가 모두 포함된다', async () => {
    const doc = await loadDoc('01-paragraph');
    const text = extractPlainText(doc);
    const expected = await loadExpected('01-paragraph');
    for (const sample of expected.parserAssertions?.textSamples ?? []) {
      expect(text).toContain(sample);
    }
  });

  it('02-table: cellTextSamples 가 모두 포함된다', async () => {
    const doc = await loadDoc('02-table');
    const text = extractPlainText(doc);
    const expected = await loadExpected('02-table');
    for (const sample of expected.parserAssertions?.cellTextSamples ?? []) {
      expect(text).toContain(sample);
    }
  });

  it('빈 문서 객체를 받아도 빈 문자열을 반환한다', () => {
    expect(extractPlainText({})).toBe('');
    expect(extractPlainText(null as unknown as object)).toBe('');
    expect(extractPlainText({ sections: [] })).toBe('');
  });
});

describe('text-extractor: extractStructuredText', () => {
  it('01-paragraph 는 3개의 paragraph 항목을 반환', async () => {
    const doc = await loadDoc('01-paragraph');
    const items = extractStructuredText(doc);
    expect(items.length).toBe(3);
    for (const it of items) {
      expect(typeof it.section).toBe('number');
      expect(typeof it.paragraph).toBe('number');
      expect(typeof it.text).toBe('string');
    }
  });

  it('section 인덱스는 0 부터 시작한다', async () => {
    const doc = await loadDoc('01-paragraph');
    const items = extractStructuredText(doc);
    expect(items[0].section).toBe(0);
  });
});

describe('text-extractor: extractTables', () => {
  it('02-table 에서 1개의 2D 표가 추출된다', async () => {
    const doc = await loadDoc('02-table');
    const tables = extractTables(doc);
    expect(tables.length).toBe(1);
    const t = tables[0];
    const expected = await loadExpected('02-table');
    expect(t.length).toBe(expected.parserAssertions?.rowCount);
    // 각 셀 텍스트 검증
    const flat = t.flat().join('|');
    for (const sample of expected.parserAssertions?.cellTextSamples ?? []) {
      expect(flat).toContain(sample);
    }
  });

  it('paragraph 전용 문서는 빈 배열을 반환', async () => {
    const doc = await loadDoc('01-paragraph');
    expect(extractTables(doc)).toEqual([]);
  });
});
