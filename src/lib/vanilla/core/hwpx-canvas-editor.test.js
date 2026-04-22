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
