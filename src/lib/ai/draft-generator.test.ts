import { describe, it, expect, vi } from 'vitest';
import { DraftGenerator } from './draft-generator';
import { VertexClient, type VertexChunk } from './vertex-client';

async function* mockStream(chunks: VertexChunk[]): AsyncGenerator<VertexChunk> {
  for (const c of chunks) yield c;
}

function mockClient(chunks: VertexChunk[]): VertexClient {
  const c = new VertexClient('http://test');
  vi.spyOn(c, 'streamGenerate').mockImplementation(() => mockStream(chunks));
  return c;
}

describe('DraftGenerator', () => {
  it('정상 생성 — JSON 텍스트 → HWPXDocument', async () => {
    const draftJson = JSON.stringify({
      title: '테스트',
      sections: [
        {
          elements: [
            { type: 'heading', level: 1, text: '제1장' },
            { type: 'paragraph', text: '본문입니다.' },
          ],
        },
      ],
    });

    const gen = new DraftGenerator(mockClient([
      { text: draftJson },
      { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 } },
    ]));

    const result = await gen.generate({
      prompt: '테스트 문서 작성',
      references: [],
    });

    expect(result.document.sections).toHaveLength(1);
    expect(result.draft.title).toBe('테스트');
    expect(result.tokensUsed).toBe(150);
    expect(result.budget.overflow).toBe(false);
  });

  it('스트리밍 이벤트 순서 — start → delta → usage → done', async () => {
    const draftJson = JSON.stringify({
      title: '이벤트 테스트',
      sections: [{ elements: [{ type: 'paragraph', text: 'x' }] }],
    });
    const gen = new DraftGenerator(mockClient([
      { text: draftJson },
      { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } },
    ]));

    const events: string[] = [];
    await gen.generate(
      { prompt: 'test', references: [] },
      { onEvent: (e) => events.push(e.type) }
    );

    expect(events[0]).toBe('start');
    expect(events).toContain('delta');
    expect(events).toContain('usage');
    expect(events[events.length - 1]).toBe('done');
  });

  it('CONTEXT_OVERFLOW — 프롬프트만으로 한도 초과 시 에러', async () => {
    const gen = new DraftGenerator(mockClient([]));
    // gemini-2.5-flash = 1M tokens. 한국어 2M자 → 약 1.3M 토큰 → overflow
    const hugePrompt = '한'.repeat(2_000_000);
    await expect(gen.generate({
      prompt: hugePrompt,
      model: 'gemini-2.5-flash',
      references: [],
    })).rejects.toThrow(/컨텍스트 초과/);
  });

  it('잘못된 JSON 응답 — 파싱 에러', async () => {
    const gen = new DraftGenerator(mockClient([{ text: 'not json at all' }]));
    await expect(gen.generate({ prompt: 'x', references: [] }))
      .rejects.toThrow(/JSON 파싱 실패/);
  });

  it('마크다운 울타리 stripping', async () => {
    const draftJson = JSON.stringify({
      title: '펜스',
      sections: [{ elements: [{ type: 'paragraph', text: 'ok' }] }],
    });
    const gen = new DraftGenerator(mockClient([
      { text: '```json\n' + draftJson + '\n```' },
    ]));
    const result = await gen.generate({ prompt: 'x', references: [] });
    expect(result.draft.title).toBe('펜스');
  });
});
