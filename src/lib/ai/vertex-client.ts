/**
 * Vertex AI Client (browser)
 *
 * 프론트엔드에서 호출하는 Vertex AI 래퍼.
 * 실제 HTTPS 호출은 server/vertex-proxy.js 로 중계되어 GCP 서비스 계정을 보호.
 * SSE(EventSource) 프로토콜로 토큰 스트리밍 수신.
 *
 * @module lib/ai/vertex-client
 */

import type { VertexModel } from '../../types/ai-draft';

export interface VertexContent {
  role: 'user' | 'model' | 'system';
  parts: VertexPart[];
}

export type VertexPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface VertexRequest {
  model: VertexModel;
  contents: VertexContent[];
  systemInstruction?: { parts: VertexPart[] };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    responseMimeType?: 'text/plain' | 'application/json';
    responseSchema?: unknown;
  };
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: unknown;
    }>;
  }>;
}

export interface VertexChunk {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  finishReason?: string;
}

export interface StreamOptions {
  signal?: AbortSignal;
  onChunk?: (chunk: VertexChunk) => void;
  onError?: (err: Error) => void;
}

const DEFAULT_PROXY_URL =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_VERTEX_PROXY_URL) ||
  '/api/ai/vertex/stream';

export class VertexClient {
  private proxyUrl: string;

  constructor(proxyUrl: string = DEFAULT_PROXY_URL) {
    this.proxyUrl = proxyUrl;
  }

  /**
   * 스트리밍 생성. SSE 응답을 파싱해 각 청크마다 onChunk 호출.
   * 마지막 청크에는 usageMetadata + finishReason 포함.
   */
  async *streamGenerate(req: VertexRequest, opts: StreamOptions = {}): AsyncGenerator<VertexChunk> {
    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify(req),
      signal: opts.signal,
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(`Vertex proxy error ${response.status}: ${text}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const ev of events) {
          const chunk = parseSSEEvent(ev);
          if (!chunk) continue;
          opts.onChunk?.(chunk);
          yield chunk;
        }
      }
    } catch (err) {
      opts.onError?.(err as Error);
      throw err;
    }
  }

  /**
   * 비-스트리밍 편의 함수. 텍스트만 반환.
   */
  async generateText(req: VertexRequest, opts: StreamOptions = {}): Promise<string> {
    let full = '';
    for await (const chunk of this.streamGenerate(req, opts)) {
      if (chunk.text) full += chunk.text;
    }
    return full;
  }
}

export function parseSSEEvent(raw: string): VertexChunk | null {
  const lines = raw.split('\n');
  let data = '';
  for (const line of lines) {
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data) as VertexChunk;
  } catch {
    return null;
  }
}
