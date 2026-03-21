/**
 * Sample section with paragraphs, tables, images, and shapes for testing
 */

import { createSampleParagraph, createSampleImage } from './sample-document.js';
import { createSampleTable } from './sample-table.js';

export function createSectionWithMixedContent() {
  return {
    elements: [
      createSampleParagraph({ text: '제목: 테스트 문서' }),
      createSampleParagraph({
        text: '볼드 텍스트',
        runStyle: { bold: true },
      }),
      createSampleParagraph({
        text: '이탤릭 텍스트',
        runStyle: { italic: true },
      }),
      createSampleTable(),
      createSampleImage(),
      createSampleShape(),
      createSampleParagraph({ text: '문서 끝.' }),
    ],
    pageSettings: {
      width: 595,
      height: 842,
      marginTop: 56.7,
      marginBottom: 56.7,
      marginLeft: 56.7,
      marginRight: 56.7,
    },
    header: null,
    footer: null,
  };
}

export function createSampleShape(overrides = {}) {
  return {
    type: 'shape',
    shapeType: overrides.shapeType || 'rect',
    width: overrides.width || 100,
    height: overrides.height || 50,
    position: overrides.position || { treatAsChar: true },
    fillColor: overrides.fillColor || '#3498db',
    strokeColor: overrides.strokeColor || '#2c3e50',
    strokeWidth: overrides.strokeWidth || 1,
    style: overrides.style || {},
    drawText: overrides.drawText || null,
    children: overrides.children || [],
    ...overrides,
  };
}

export function createSectionWithNumbering() {
  return {
    elements: [
      createSampleParagraph({
        text: '첫 번째 항목',
        numbering: { id: '1', level: 0, definition: { type: 'DECIMAL', format: '%1.' } },
      }),
      createSampleParagraph({
        text: '두 번째 항목',
        numbering: { id: '1', level: 0, definition: { type: 'DECIMAL', format: '%1.' } },
      }),
      createSampleParagraph({
        text: '하위 항목',
        numbering: { id: '1', level: 1, definition: { type: 'LOWER_ALPHA', format: '%2)' } },
      }),
    ],
    pageSettings: {
      width: 595,
      height: 842,
      marginTop: 56.7,
      marginBottom: 56.7,
      marginLeft: 56.7,
      marginRight: 56.7,
    },
  };
}

export function createSectionWithStyledParagraphs() {
  return {
    elements: [
      createSampleParagraph({
        text: '중앙 정렬',
        style: { textAlign: 'center' },
      }),
      createSampleParagraph({
        text: '오른쪽 정렬',
        style: { textAlign: 'right' },
      }),
      createSampleParagraph({
        text: '줄간격 2배',
        style: { lineHeight: 2.0 },
      }),
      createSampleParagraph({
        text: '들여쓰기',
        style: { textIndent: '20px', marginLeft: '40px' },
      }),
      createSampleParagraph({
        runs: [
          { text: '멀티 ', style: { bold: true, color: '#ff0000' } },
          { text: '스타일 ', style: { italic: true, color: '#00ff00' } },
          { text: '텍스트', style: { underline: true, color: '#0000ff' } },
        ],
      }),
    ],
    pageSettings: {
      width: 595,
      height: 842,
      marginTop: 56.7,
      marginBottom: 56.7,
      marginLeft: 56.7,
      marginRight: 56.7,
    },
  };
}
