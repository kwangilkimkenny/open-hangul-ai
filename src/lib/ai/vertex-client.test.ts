import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VertexClient, parseSSEEvent } from './vertex-client';

describe('parseSSEEvent', () => {
  it('data: JSON → chunk', () => {
    const chunk = parseSSEEvent('data: {"text":"hello"}');
    expect(chunk).toEqual({ text: 'hello' });
  });

  it('[DONE] → null', () => {
    expect(parseSSEEvent('data: [DONE]')).toBeNull();
  });

  it('빈 이벤트 → null', () => {
    expect(parseSSEEvent('')).toBeNull();
  });

  it('잘못된 JSON → null', () => {
    expect(parseSSEEvent('data: {broken')).toBeNull();
  });

  it('multi-line data 합치기', () => {
    const chunk = parseSSEEvent('event: msg\ndata: {"text":"a"}');
    expect(chunk).toEqual({ text: 'a' });
  });
});

describe('VertexClient — streamGenerate', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('SSE 스트림을 파싱해 chunk 생성', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"text":"안녕"}\n\n'));
        controller.enqueue(encoder.encode('data: {"text":"세계"}\n\n'));
        controller.enqueue(encoder.encode('data: {"usageMetadata":{"totalTokenCount":42}}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    }) as unknown as typeof fetch;

    const client = new VertexClient('http://test/proxy');
    const chunks = [];
    for await (const c of client.streamGenerate({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    })) {
      chunks.push(c);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0].text).toBe('안녕');
    expect(chunks[1].text).toBe('세계');
    expect(chunks[2].usageMetadata?.totalTokenCount).toBe(42);
  });

  it('generateText — 텍스트 청크 합산', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"text":"Hello "}\n\n'));
        controller.enqueue(encoder.encode('data: {"text":"World"}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream }) as unknown as typeof fetch;

    const client = new VertexClient('http://test/proxy');
    const text = await client.generateText({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    });
    expect(text).toBe('Hello World');
  });

  it('프록시 에러 → throw', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
      body: null,
    }) as unknown as typeof fetch;

    const client = new VertexClient('http://test/proxy');
    await expect(async () => {
      const gen = client.streamGenerate({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: 'x' }] }],
      });
      for await (const _ of gen) { /* drain */ }
    }).rejects.toThrow(/Vertex proxy error 500/);
  });
});
