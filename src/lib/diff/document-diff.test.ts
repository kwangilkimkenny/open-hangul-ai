import { describe, it, expect } from 'vitest';
import {
  diffDocuments,
  diffDocumentsStructural,
  flattenDocument,
  diffText,
} from './document-diff';
import type { HWPXDocument } from '../../types/hwpx';

function makeDoc(paragraphs: Array<{ text: string; bold?: boolean; align?: 'left' | 'right' | 'center' }>): HWPXDocument {
  return {
    sections: [
      {
        id: 's0',
        elements: paragraphs.map(p => ({
          type: 'paragraph' as const,
          runs: [{ text: p.text, style: p.bold ? { bold: true } : undefined }],
          alignment: p.align,
        })),
      },
    ],
    images: new Map(),
  };
}

describe('Document Diff — line-based (legacy)', () => {
  it('동일 문서 — similarity 100%', () => {
    const a = makeDoc([{ text: '안녕' }, { text: '세계' }]);
    const b = makeDoc([{ text: '안녕' }, { text: '세계' }]);
    const diff = diffDocuments(a, b);
    expect(diff.stats.similarity).toBe(100);
    expect(diff.stats.added).toBe(0);
    expect(diff.stats.removed).toBe(0);
  });

  it('단락 추가', () => {
    const a = makeDoc([{ text: '첫째' }]);
    const b = makeDoc([{ text: '첫째' }, { text: '둘째' }]);
    const diff = diffDocuments(a, b);
    expect(diff.stats.added).toBe(1);
  });

  it('단락 삭제 — stats.removed 증가', () => {
    const a = makeDoc([{ text: 'A' }, { text: 'B' }]);
    const b = makeDoc([{ text: 'A' }]);
    const diff = diffDocuments(a, b);
    expect(diff.stats.removed).toBe(1);
  });
});

describe('Document Diff — structural (v2)', () => {
  it('동일 문서 — 모두 equal', () => {
    const a = makeDoc([{ text: '안녕' }, { text: '세계' }]);
    const b = makeDoc([{ text: '안녕' }, { text: '세계' }]);
    const diff = diffDocumentsStructural(a, b);
    expect(diff.summary.unchanged).toBe(2);
  });

  it('단락 수정 — modify 로 병합', () => {
    const a = makeDoc([{ text: '안녕 세계' }]);
    const b = makeDoc([{ text: '안녕 우주' }]);
    const diff = diffDocumentsStructural(a, b);
    expect(diff.summary.modified).toBe(1);
    const modified = diff.entries.find(e => e.op === 'modify');
    expect(modified?.textChanges?.some(c => c.op === 'delete')).toBe(true);
    expect(modified?.textChanges?.some(c => c.op === 'insert')).toBe(true);
  });

  it('서식 변경 탐지 — bold', () => {
    const a = makeDoc([{ text: '강조' }]);
    const b = makeDoc([{ text: '강조', bold: true }]);
    const diff = diffDocumentsStructural(a, b);
    expect(diff.summary.modified).toBe(1);
    const entry = diff.entries.find(e => e.op === 'modify');
    expect(entry?.styleChanges?.some(c => c.property === 'bold')).toBe(true);
  });

  it('정렬 변경 탐지', () => {
    const a = makeDoc([{ text: '테스트', align: 'left' }]);
    const b = makeDoc([{ text: '테스트', align: 'right' }]);
    const diff = diffDocumentsStructural(a, b);
    expect(diff.entries[0].op).toBe('modify');
    expect(diff.entries[0].styleChanges?.some(c => c.property === 'alignment')).toBe(true);
  });

  it('flattenDocument — 표 셀까지 평탄화', () => {
    const doc: HWPXDocument = {
      sections: [
        {
          id: 's0',
          elements: [
            {
              type: 'table',
              rows: [
                { cells: [
                  { elements: [{ type: 'paragraph', runs: [{ text: 'cell1' }] }] },
                  { elements: [{ type: 'paragraph', runs: [{ text: 'cell2' }] }] },
                ] },
              ],
            },
          ],
        },
      ],
      images: new Map(),
    };
    const blocks = flattenDocument(doc);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe('table-cell');
    expect(blocks[0].text).toBe('cell1');
  });

  it('diffText — 토큰 단위 변경', () => {
    const changes = diffText('The quick fox', 'The slow fox');
    expect(changes.some(c => c.op === 'delete' && c.text.includes('quick'))).toBe(true);
    expect(changes.some(c => c.op === 'insert' && c.text.includes('slow'))).toBe(true);
    expect(changes.some(c => c.op === 'equal' && c.text.includes('fox'))).toBe(true);
  });
});
