/**
 * yjs-doc-mapper.test.js — HWPX ↔ Y.Doc 라운드트립 검증
 */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  hwpxToYDoc,
  applyYDocToHwpx,
  extractParagraphText,
  extractParagraphAlign,
  normalizeAlign,
  getOrderedParagraphIds,
  getParagraphYText,
  setParagraphText,
  setParagraphAlign,
  patchParagraphTextAndAlign,
  getParagraphId,
} from './yjs-doc-mapper.js';

function sampleDoc() {
  return {
    sections: [
      {
        paragraphs: [
          {
            type: 'paragraph',
            runs: [{ text: 'Hello ' }, { text: 'world' }],
            style: { textAlign: 'left' },
          },
          {
            type: 'paragraph',
            runs: [{ text: '안녕하세요' }],
            style: { textAlign: 'center' },
          },
          {
            // 첫 번째 run 이 도형 — 비-텍스트 보존 검증용
            type: 'paragraph',
            runs: [
              { hasShape: true, text: '', style: {} },
              { text: '캡션' },
            ],
            style: {},
          },
        ],
      },
      {
        paragraphs: [
          {
            type: 'paragraph',
            id: 'fixed-id-A',
            runs: [{ text: 'second section' }],
            style: { textAlign: 'right' },
          },
        ],
      },
    ],
  };
}

describe('yjs-doc-mapper :: helpers', () => {
  it('extractParagraphText concatenates run.text values', () => {
    expect(extractParagraphText({ runs: [{ text: 'A' }, { text: 'B' }] })).toBe('AB');
  });

  it('extractParagraphAlign normalizes case', () => {
    expect(extractParagraphAlign({ style: { textAlign: 'CENTER' } })).toBe('center');
    expect(extractParagraphAlign({ style: {} })).toBe('left');
  });

  it('normalizeAlign clamps unknown values to left', () => {
    expect(normalizeAlign('justify')).toBe('justify');
    expect(normalizeAlign('weird')).toBe('left');
    expect(normalizeAlign(null)).toBe('left');
  });

  it('getParagraphId prefers explicit id over generated', () => {
    expect(getParagraphId({ id: 'X' }, 0, 0)).toBe('X');
    expect(getParagraphId({}, 1, 2)).toBe('s1-p2');
  });
});

describe('yjs-doc-mapper :: hwpxToYDoc', () => {
  it('builds paragraphs and order map', () => {
    const ydoc = hwpxToYDoc(sampleDoc());
    const order = getOrderedParagraphIds(ydoc);
    expect(order.length).toBe(4);
    expect(order).toEqual(['s0-p0', 's0-p1', 's0-p2', 'fixed-id-A']);
  });

  it('initial Y.Text content matches concatenated runs', () => {
    const ydoc = hwpxToYDoc(sampleDoc());
    const yText = getParagraphYText(ydoc, 's0-p0');
    expect(yText).toBeInstanceOf(Y.Text);
    expect(yText.toString()).toBe('Hello world');
    expect(getParagraphYText(ydoc, 's0-p1').toString()).toBe('안녕하세요');
  });

  it('reusing target Y.Doc clears previous state', () => {
    const ydoc = new Y.Doc();
    hwpxToYDoc({ sections: [{ paragraphs: [{ runs: [{ text: 'A' }] }] }] }, ydoc);
    hwpxToYDoc({ sections: [{ paragraphs: [{ runs: [{ text: 'B' }] }] }] }, ydoc);
    const ids = getOrderedParagraphIds(ydoc);
    expect(ids).toEqual(['s0-p0']);
    expect(getParagraphYText(ydoc, 's0-p0').toString()).toBe('B');
  });
});

describe('yjs-doc-mapper :: applyYDocToHwpx', () => {
  it('round-trips text + align unchanged', () => {
    const original = sampleDoc();
    const ydoc = hwpxToYDoc(original);
    const back = applyYDocToHwpx(ydoc, original);
    expect(back.sections[0].paragraphs[0].runs.map(r => r.text).join('')).toBe('Hello world');
    expect(back.sections[0].paragraphs[1].style.textAlign).toBe('center');
    expect(back.sections[1].paragraphs[0].style.textAlign).toBe('right');
  });

  it('preserves non-text runs on paragraph with shape', () => {
    const original = sampleDoc();
    const ydoc = hwpxToYDoc(original);
    setParagraphText(ydoc, 's0-p2', '새 캡션');
    const back = applyYDocToHwpx(ydoc, original);
    const para = back.sections[0].paragraphs[2];
    // hasShape run 보존 + 텍스트 run 한 개로 통합
    const shapeRun = para.runs.find(r => r.hasShape);
    const textRun = para.runs.find(r => typeof r.text === 'string' && r.text.length > 0);
    expect(shapeRun).toBeTruthy();
    expect(textRun.text).toBe('새 캡션');
  });

  it('updates align after setParagraphAlign', () => {
    const original = sampleDoc();
    const ydoc = hwpxToYDoc(original);
    setParagraphAlign(ydoc, 's0-p0', 'justify');
    const back = applyYDocToHwpx(ydoc, original);
    expect(back.sections[0].paragraphs[0].style.textAlign).toBe('justify');
  });

  it('handles paragraphs with no text runs by prepending one', () => {
    const para = patchParagraphTextAndAlign(
      { runs: [{ hasShape: true }], style: {} },
      '신규 텍스트',
      'right'
    );
    expect(para.runs[0].text).toBe('신규 텍스트');
    expect(para.runs[1].hasShape).toBe(true);
    expect(para.style.textAlign).toBe('right');
  });
});

describe('yjs-doc-mapper :: edits propagate', () => {
  it('setParagraphText replaces content', () => {
    const ydoc = hwpxToYDoc(sampleDoc());
    setParagraphText(ydoc, 's0-p0', '교체됨');
    expect(getParagraphYText(ydoc, 's0-p0').toString()).toBe('교체됨');
  });
});
