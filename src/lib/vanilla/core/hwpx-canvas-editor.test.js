import { describe, it, expect } from 'vitest';
import { hwpxToCanvasEditor } from './hwpx-to-canvas-editor.js';
import { canvasEditorToHwpx } from './canvas-editor-to-hwpx.js';

const sampleDoc = {
  sections: [
    {
      elements: [
        {
          type: 'paragraph',
          style: { textAlign: 'center' },
          runs: [
            {
              text: '안녕하세요',
              style: { bold: true, fontSize: '14pt', fontFamily: '맑은 고딕' },
            },
            { text: ' world', style: { italic: true, color: '#FF0000' } },
          ],
        },
        {
          type: 'paragraph',
          style: { textAlign: 'right' },
          runs: [{ text: 'second line', style: {} }],
        },
      ],
    },
  ],
};

const sampleTableDoc = {
  sections: [
    {
      elements: [
        {
          type: 'table',
          style: { width: '300px' },
          rows: [
            {
              style: {},
              cells: [
                {
                  elements: [{ type: 'paragraph', runs: [{ text: 'A1', style: {} }], style: {} }],
                },
                {
                  elements: [
                    { type: 'paragraph', runs: [{ text: 'B1', style: { bold: true } }], style: {} },
                  ],
                },
              ],
            },
            {
              style: {},
              cells: [
                {
                  colSpan: 2,
                  elements: [
                    { type: 'paragraph', runs: [{ text: 'merged', style: {} }], style: {} },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('hwpxToCanvasEditor', () => {
  it('converts paragraphs with style + alignment to canvas-editor IElement[]', () => {
    const data = hwpxToCanvasEditor(sampleDoc);
    expect(data.main).toBeDefined();
    expect(Array.isArray(data.main)).toBe(true);

    const text = data.main.map(el => el.value || '').join('');
    expect(text).toContain('안녕하세요');
    expect(text).toContain('world');
    expect(text).toContain('second line');

    const bolded = data.main.filter(el => el.bold);
    expect(bolded.length).toBeGreaterThan(0);

    const italics = data.main.filter(el => el.italic);
    expect(italics.length).toBeGreaterThan(0);

    const newlines = data.main.filter(el => el.value === '\n');
    expect(newlines.length).toBeGreaterThanOrEqual(2);

    const centered = data.main.find(el => el.rowFlex === 'center');
    expect(centered).toBeDefined();
    const rightAligned = data.main.find(el => el.rowFlex === 'right');
    expect(rightAligned).toBeDefined();
  });

  it('converts tables to TABLE elements with colgroup + trList', () => {
    const data = hwpxToCanvasEditor(sampleTableDoc);
    const table = data.main.find(el => el.type === 'table');
    expect(table).toBeDefined();
    expect(table.colgroup.length).toBe(2);
    expect(table.trList.length).toBe(2);
    expect(table.trList[0].tdList.length).toBe(2);
    expect(table.trList[1].tdList[0].colspan).toBe(2);
  });

  it('handles empty document gracefully', () => {
    const data = hwpxToCanvasEditor(null);
    expect(data.main.length).toBeGreaterThan(0);
    expect(data.main[0].value).toBe('\n');
  });
});

describe('canvasEditorToHwpx', () => {
  it('round-trips paragraphs back to HWPX shape', () => {
    const data = hwpxToCanvasEditor(sampleDoc);
    const hwpx = canvasEditorToHwpx(data);

    expect(hwpx.sections).toBeDefined();
    expect(hwpx.sections[0].elements.length).toBe(2);

    const para1 = hwpx.sections[0].elements[0];
    expect(para1.type).toBe('paragraph');
    expect(para1.style.textAlign).toBe('center');
    expect(para1.text).toBe('안녕하세요 world');

    const boldRun = para1.runs.find(r => r.style?.bold);
    expect(boldRun).toBeDefined();
    expect(boldRun.text).toBe('안녕하세요');
  });

  it('round-trips tables back', () => {
    const data = hwpxToCanvasEditor(sampleTableDoc);
    const hwpx = canvasEditorToHwpx(data);
    const table = hwpx.sections[0].elements.find(e => e.type === 'table');
    expect(table).toBeDefined();
    expect(table.rows.length).toBe(2);
    expect(table.rows[0].cells.length).toBe(2);
    expect(table.rows[1].cells[0].colSpan).toBe(2);
  });
});

describe('shape round-trip', () => {
  const inlineShape = {
    type: 'shape',
    shapeType: 'rectangle',
    treatAsChar: true,
    width: 80,
    height: 40,
    borderRadius: 5,
    style: {
      backgroundColor: '#ffeb3b',
      borderColor: '#000000',
      borderWidth: '1px',
      borderStyle: 'solid',
    },
    position: { textWrap: 'INLINE' },
    drawText: null,
  };
  const standaloneShape = {
    type: 'shape',
    shapeType: 'ellipse',
    width: 120,
    height: 80,
    style: { backgroundColor: '#03a9f4' },
    position: { textWrap: 'SQUARE' },
    drawText: null,
  };
  const docWithShapes = {
    sections: [
      {
        elements: [
          {
            type: 'paragraph',
            style: {},
            runs: [
              { text: '도형: ', style: {} },
              { text: '', hasShape: true, style: {} },
              { text: ' 끝', style: {} },
            ],
            shapes: [inlineShape],
          },
          standaloneShape,
        ],
      },
    ],
  };

  it('preserves inline shape through hwpx → canvas-editor', () => {
    const data = hwpxToCanvasEditor(docWithShapes);
    const shapeEl = data.main.find(el => el.type === 'hwpxShape');
    expect(shapeEl).toBeDefined();
    expect(shapeEl._shape).toBe(inlineShape);
    expect(shapeEl.width).toBe(80);
    expect(shapeEl.height).toBe(40);
  });

  it('preserves standalone shape through hwpx → canvas-editor', () => {
    const data = hwpxToCanvasEditor(docWithShapes);
    const shapeEls = data.main.filter(el => el.type === 'hwpxShape');
    expect(shapeEls.length).toBe(2);
    expect(shapeEls[1]._shape.shapeType).toBe('ellipse');
  });

  it('round-trips inline shapes back into a paragraph with hasShape run', () => {
    const data = hwpxToCanvasEditor(docWithShapes);
    const hwpx = canvasEditorToHwpx(data);

    const paras = hwpx.sections[0].elements.filter(e => e.type === 'paragraph');
    const paraWithShape = paras.find(p => p.shapes && p.shapes.length > 0);
    expect(paraWithShape).toBeDefined();
    expect(paraWithShape.shapes[0].shapeType).toBe('rectangle');
    expect(paraWithShape.shapes[0].borderRadius).toBe(5);
    expect(paraWithShape.shapes[0].style.backgroundColor).toBe('#ffeb3b');

    const shapeRun = paraWithShape.runs.find(r => r.hasShape);
    expect(shapeRun).toBeDefined();
  });

  it('round-trips standalone shapes back as section-level shape', () => {
    const data = hwpxToCanvasEditor(docWithShapes);
    const hwpx = canvasEditorToHwpx(data);

    const shapes = hwpx.sections[0].elements.filter(e => e.type === 'shape');
    expect(shapes.length).toBe(1);
    expect(shapes[0].shapeType).toBe('ellipse');
    expect(shapes[0].style.backgroundColor).toBe('#03a9f4');
  });

  it('does not corrupt the source shape on round-trip', () => {
    const data = hwpxToCanvasEditor(docWithShapes);
    canvasEditorToHwpx(data);
    // 원본 inlineShape 의 treatAsChar 가 변형되지 않아야 한다.
    expect(inlineShape.treatAsChar).toBe(true);
  });
});

describe('Phase 2 round-trip (numbering / footnotes / fields)', () => {
  const numberedDoc = {
    sections: [
      {
        elements: [
          {
            type: 'paragraph',
            style: {},
            runs: [{ text: '첫번째 항목', style: {} }],
            numPr: { numIDRef: 'num1', level: 0 },
            numberingDef: {
              id: 'num1',
              levels: [
                {
                  level: 0,
                  numFormat: 'DECIMAL',
                  start: 1,
                  formatString: '^1.',
                },
              ],
            },
            numberingLevel: { level: 0, numFormat: 'DECIMAL', start: 1, formatString: '^1.' },
          },
          {
            type: 'paragraph',
            style: {},
            runs: [{ text: '두번째 항목', style: {} }],
            numPr: { numIDRef: 'num1', level: 0 },
            numberingDef: {
              id: 'num1',
              levels: [{ level: 0, numFormat: 'DECIMAL', start: 1, formatString: '^1.' }],
            },
            numberingLevel: { level: 0, numFormat: 'DECIMAL', start: 1, formatString: '^1.' },
          },
        ],
      },
    ],
  };

  const fieldDoc = {
    sections: [
      {
        elements: [
          {
            type: 'paragraph',
            style: {},
            runs: [
              { text: '오늘은 ', style: {} },
              {
                type: 'field',
                fieldType: 'DATE',
                dateFormat: 'yyyy-MM-dd',
                text: '2026-05-22',
                style: {},
              },
              { text: ' 입니다', style: {} },
            ],
          },
        ],
      },
    ],
  };

  const noteDoc = {
    sections: [
      {
        elements: [
          {
            type: 'paragraph',
            style: {},
            runs: [
              { text: '본문 텍스트', style: {} },
              { type: 'footnote', number: '1', text: '[1]', style: {} },
            ],
          },
        ],
        footnotes: [
          {
            type: 'footnote',
            number: '1',
            id: 'fn1',
            paragraphs: [
              { type: 'paragraph', style: {}, runs: [{ text: '각주 본문', style: {} }] },
            ],
          },
        ],
      },
    ],
  };

  it('preserves numbering meta on trailing newline element', () => {
    const data = hwpxToCanvasEditor(numberedDoc);
    const taggedNewlines = data.main.filter(el => el.value === '\n' && el._meta?.numbering);
    expect(taggedNewlines.length).toBe(2);
    expect(taggedNewlines[0]._meta.numbering.numPr.numIDRef).toBe('num1');
    expect(taggedNewlines[0]._meta.list).toEqual({ listType: 'ol', listStyle: 'decimal' });
  });

  it('round-trips numbering back into para.numPr / numberingDef', () => {
    const data = hwpxToCanvasEditor(numberedDoc);
    const hwpx = canvasEditorToHwpx(data);
    const paras = hwpx.sections[0].elements.filter(e => e.type === 'paragraph');
    expect(paras.length).toBe(2);
    expect(paras[0].numPr).toEqual({ numIDRef: 'num1', level: 0 });
    expect(paras[0].numberingLevel.numFormat).toBe('DECIMAL');
    expect(paras[1].numPr.numIDRef).toBe('num1');
  });

  it('converts field run → hwpxField element with _meta.field', () => {
    const data = hwpxToCanvasEditor(fieldDoc);
    const fieldEl = data.main.find(el => el.type === 'hwpxField');
    expect(fieldEl).toBeDefined();
    expect(fieldEl.value).toBe('2026-05-22');
    expect(fieldEl._meta.field.fieldType).toBe('DATE');
    expect(fieldEl._meta.field.dateFormat).toBe('yyyy-MM-dd');
  });

  it('round-trips field run back into a paragraph run', () => {
    const data = hwpxToCanvasEditor(fieldDoc);
    const hwpx = canvasEditorToHwpx(data);
    const para = hwpx.sections[0].elements.find(e => e.type === 'paragraph');
    expect(para).toBeDefined();
    const fieldRun = para.runs.find(r => r.type === 'field');
    expect(fieldRun).toBeDefined();
    expect(fieldRun.fieldType).toBe('DATE');
    expect(fieldRun.dateFormat).toBe('yyyy-MM-dd');
    expect(fieldRun.text).toBe('2026-05-22');
  });

  it('converts footnote run → hwpxNote element with _meta.footnote', () => {
    const data = hwpxToCanvasEditor(noteDoc);
    const noteEl = data.main.find(el => el.type === 'hwpxNote');
    expect(noteEl).toBeDefined();
    expect(noteEl._meta.footnote.kind).toBe('footnote');
    expect(noteEl._meta.footnote.number).toBe('1');
  });

  it('round-trips footnote: paragraph run + section-level note body', () => {
    const data = hwpxToCanvasEditor(noteDoc);
    expect(data._sectionMeta).toBeDefined();
    expect(data._sectionMeta[0].footnotes.length).toBe(1);

    const hwpx = canvasEditorToHwpx(data);
    const para = hwpx.sections[0].elements.find(e => e.type === 'paragraph');
    const noteRun = para.runs.find(r => r.type === 'footnote');
    expect(noteRun).toBeDefined();
    expect(noteRun.number).toBe('1');

    // 섹션 레벨 footnote 본문이 그대로 보존되어야 한다.
    expect(hwpx.sections[0].footnotes.length).toBe(1);
    expect(hwpx.sections[0].footnotes[0].paragraphs[0].runs[0].text).toBe('각주 본문');
  });
});

/**
 * 라운드트립 손실률 측정:
 *  - 입력 HWPXDocument 의 핵심 신호(텍스트, 정렬, 기울기, 굵기, 노트, 필드,
 *    번호 매기기) 가 round-trip 후 보존되는지 카운팅.
 *  - Phase 1 의 약속: 손실률 10% 이하.
 */
describe('round-trip loss measurement', () => {
  function buildExpectedSignals(doc) {
    const signals = [];
    for (const section of doc.sections) {
      for (const el of section.elements) {
        if (el.type !== 'paragraph') continue;
        if (el.numPr) signals.push({ kind: 'numbering', key: el.numPr.numIDRef });
        if (el.style?.textAlign) signals.push({ kind: 'align', key: el.style.textAlign });
        for (const run of el.runs) {
          if (run.type === 'field') signals.push({ kind: 'field', key: run.fieldType });
          if (run.type === 'footnote' || run.type === 'endnote') {
            signals.push({ kind: 'note', key: `${run.type}:${run.number}` });
          }
          if (run.style?.bold) signals.push({ kind: 'bold' });
          if (run.style?.italic) signals.push({ kind: 'italic' });
          if (run.text) signals.push({ kind: 'text', key: run.text });
        }
      }
    }
    return signals;
  }

  function buildActualSignals(doc) {
    const signals = [];
    for (const section of doc.sections) {
      for (const el of section.elements) {
        if (el.type !== 'paragraph') continue;
        if (el.numPr) signals.push({ kind: 'numbering', key: el.numPr.numIDRef });
        if (el.style?.textAlign) signals.push({ kind: 'align', key: el.style.textAlign });
        for (const run of el.runs) {
          if (run.type === 'field') signals.push({ kind: 'field', key: run.fieldType });
          if (run.type === 'footnote' || run.type === 'endnote') {
            signals.push({ kind: 'note', key: `${run.type}:${run.number}` });
          }
          if (run.style?.bold) signals.push({ kind: 'bold' });
          if (run.style?.italic) signals.push({ kind: 'italic' });
          if (run.text) signals.push({ kind: 'text', key: run.text });
        }
      }
    }
    return signals;
  }

  const corpus = {
    sections: [
      {
        elements: [
          {
            type: 'paragraph',
            style: { textAlign: 'center' },
            runs: [{ text: '제목', style: { bold: true, fontSize: '14pt' } }],
          },
          {
            type: 'paragraph',
            style: {},
            runs: [
              { text: '본문 ', style: {} },
              { text: '강조', style: { italic: true } },
              { text: ' 입니다.', style: {} },
            ],
          },
          {
            type: 'paragraph',
            style: {},
            runs: [{ text: '첫째 항목', style: {} }],
            numPr: { numIDRef: 'L1', level: 0 },
            numberingDef: {
              id: 'L1',
              levels: [{ level: 0, numFormat: 'DECIMAL', start: 1 }],
            },
            numberingLevel: { level: 0, numFormat: 'DECIMAL', start: 1 },
          },
          {
            type: 'paragraph',
            style: {},
            runs: [{ text: '둘째 항목', style: {} }],
            numPr: { numIDRef: 'L1', level: 0 },
            numberingDef: {
              id: 'L1',
              levels: [{ level: 0, numFormat: 'DECIMAL', start: 1 }],
            },
            numberingLevel: { level: 0, numFormat: 'DECIMAL', start: 1 },
          },
          {
            type: 'paragraph',
            style: {},
            runs: [
              { text: '날짜:', style: {} },
              { type: 'field', fieldType: 'DATE', text: '2026-05-22', style: {} },
              { type: 'footnote', number: '1', text: '[1]', style: {} },
            ],
          },
        ],
        footnotes: [
          {
            type: 'footnote',
            number: '1',
            paragraphs: [{ type: 'paragraph', style: {}, runs: [{ text: '비고', style: {} }] }],
          },
        ],
      },
    ],
  };

  /**
   * Phase 1 시뮬레이션: numbering/footnote/field 메타를 모두 떨궈서
   * 손실률 베이스라인을 측정.
   */
  function simulatePhase1Loss(doc) {
    const expected = buildExpectedSignals(doc);
    // Phase 1 컨버터는 numbering/field/footnote 신호를 보존하지 못한다고 가정.
    const phase1Lost = expected.filter(
      s => s.kind === 'numbering' || s.kind === 'field' || s.kind === 'note'
    ).length;
    return phase1Lost / expected.length;
  }

  it('Phase 1 baseline loss (simulated) is high — establishes regression target', () => {
    const baseline = simulatePhase1Loss(corpus);
    // 코퍼스에는 numbering 2개, field 1개, note 1개 = 4 신호가 Phase 1 에서 손실.
    // 기대치는 약 28%.
    expect(baseline).toBeGreaterThan(0.2);
  });

  it('Phase 2 round-trip loss is below 10% of expected signals', () => {
    const expected = buildExpectedSignals(corpus);
    const ce = hwpxToCanvasEditor(corpus);
    const restored = canvasEditorToHwpx(ce);
    const actual = buildActualSignals(restored);

    // 손실 카운트 = 기대치 multiset 중 actual 에 없는 항목
    const actualMap = new Map();
    for (const s of actual) {
      const k = `${s.kind}|${s.key || ''}`;
      actualMap.set(k, (actualMap.get(k) || 0) + 1);
    }
    let missing = 0;
    for (const s of expected) {
      const k = `${s.kind}|${s.key || ''}`;
      const remaining = actualMap.get(k) || 0;
      if (remaining > 0) {
        actualMap.set(k, remaining - 1);
      } else {
        missing++;
      }
    }
    const lossRatio = missing / expected.length;
    // 기대치: 손실률 ≤ 10%
    expect(lossRatio).toBeLessThanOrEqual(0.1);
  });
});
