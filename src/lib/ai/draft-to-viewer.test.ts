/**
 * DraftGenerator → Viewer loadDocument 엔드투엔드 계약 테스트
 *
 * 완전한 E2E 는 Playwright 가 담당하고, 여기서는 타입/스키마 계약만 검증:
 *   1. DraftGenerator 가 만든 HWPXDocument 는 viewer.loadDocument 가 기대하는 구조와 맞는가
 *   2. HWPXDocument 의 sections 배열이 렌더 가능한 형태인가
 */

import { describe, it, expect, vi } from 'vitest';
import { DraftGenerator } from './draft-generator';
import { VertexClient, type VertexChunk } from './vertex-client';
import { draftToHwpx, type DraftOutput } from './hwpx-schema';

async function* mockStream(chunks: VertexChunk[]): AsyncGenerator<VertexChunk> {
  for (const c of chunks) yield c;
}

function mockClient(chunks: VertexChunk[]): VertexClient {
  const c = new VertexClient('http://test');
  vi.spyOn(c, 'streamGenerate').mockImplementation(() => mockStream(chunks));
  return c;
}

describe('Draft → Viewer loadDocument 계약', () => {
  it('생성된 document 에 sections 배열이 존재', async () => {
    const draft: DraftOutput = {
      title: '테스트',
      sections: [
        {
          elements: [
            { type: 'heading', level: 1, text: '개요' },
            { type: 'paragraph', text: '본문입니다.' },
          ],
        },
      ],
    };
    const gen = new DraftGenerator(mockClient([
      { text: JSON.stringify(draft) },
      { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 } },
    ]));

    const result = await gen.generate({ prompt: 'test', references: [] });

    // viewer.loadDocument 가 요구하는 최소 계약
    expect(Array.isArray(result.document.sections)).toBe(true);
    expect(result.document.sections.length).toBeGreaterThan(0);
    expect(result.document.images).toBeInstanceOf(Map);
  });

  it('draftToHwpx 출력 — 각 section.elements 는 type 을 가짐', () => {
    const draft: DraftOutput = {
      title: '다요소',
      subtitle: '부제',
      sections: [
        {
          elements: [
            { type: 'heading', level: 2, text: '1. 목적' },
            { type: 'paragraph', text: '본 문서의 목적은 ...', alignment: 'left' },
            { type: 'bullet-list', items: ['A', 'B', 'C'] },
            {
              type: 'table',
              table: { headers: ['항목', '값'], rows: [['매출', '10억']] },
            },
          ],
        },
      ],
    };
    const doc = draftToHwpx(draft);

    for (const section of doc.sections) {
      for (const el of section.elements) {
        expect(typeof el.type).toBe('string');
        expect(['paragraph', 'table'].includes(el.type)).toBe(true);
      }
    }
  });

  it('빈 draft 도 subtitle 없이 유효한 document 생성', () => {
    const draft: DraftOutput = {
      title: '최소',
      sections: [{ elements: [{ type: 'paragraph', text: '한 줄' }] }],
    };
    const doc = draftToHwpx(draft);
    expect(doc.sections).toHaveLength(1);
    // title paragraph 가 맨 앞에 삽입됨
    const first = doc.sections[0].elements[0] as { runs: Array<{ text: string }> };
    expect(first.runs[0].text).toBe('최소');
  });

  it('title + subtitle 모두 있을 때 — 둘 다 section 최상단에 삽입', () => {
    const draft: DraftOutput = {
      title: '제목',
      subtitle: '부제',
      sections: [{ elements: [{ type: 'paragraph', text: '본문' }] }],
    };
    const doc = draftToHwpx(draft);
    const els = doc.sections[0].elements;
    const texts = els.map(e => {
      if ('runs' in e) return (e.runs as Array<{ text: string }>)[0]?.text;
      return null;
    });
    expect(texts[0]).toBe('제목');
    expect(texts[1]).toBe('부제');
    expect(texts[2]).toBe('본문');
  });
});
