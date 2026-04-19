import { describe, it, expect } from 'vitest';
import { RAGExtractor, extractForRAG, toNDJSON, toLangChainDocs } from './rag-extractor';
import type { HWPXDocument } from '../../types/hwpx';

function mkDoc(): HWPXDocument {
  return {
    sections: [
      {
        id: 's0',
        elements: [
          {
            type: 'paragraph',
            runs: [{ text: '2026년 사업계획', style: { fontSize: 20, bold: true } }],
          },
          {
            type: 'paragraph',
            runs: [{ text: '본 문서는 한컴 HWPX 포맷으로 작성된 샘플 보고서입니다. '.repeat(3) }],
          },
          {
            type: 'table',
            rows: [
              { cells: [
                { elements: [{ type: 'paragraph', runs: [{ text: '항목' }] }] },
                { elements: [{ type: 'paragraph', runs: [{ text: '내용' }] }] },
              ]},
              { cells: [
                { elements: [{ type: 'paragraph', runs: [{ text: '매출' }] }] },
                { elements: [{ type: 'paragraph', runs: [{ text: '10억' }] }] },
              ]},
            ],
          },
          {
            type: 'image',
            src: 'data:image/png;base64,xx',
            alt: '매출 그래프',
          },
        ],
      },
    ],
    images: new Map(),
    metadata: { title: '2026 사업계획' },
  };
}

describe('RAG Extractor', () => {
  it('문서 → 청크 변환', () => {
    const rag = extractForRAG(mkDoc());
    expect(rag.chunks.length).toBeGreaterThan(0);
    expect(rag.source.version).toBe('1.0');
    expect(rag.source.title).toMatch(/2026/);
  });

  it('표는 header:content 형태의 table-pair 청크', () => {
    const rag = extractForRAG(mkDoc());
    const tablePair = rag.chunks.find(c => c.type === 'table-pair');
    expect(tablePair).toBeDefined();
    expect(tablePair!.text).toMatch(/매출|항목/);
    expect(tablePair!.metadata.header).toBeDefined();
  });

  it('heading 감지 — fontSize 20 + bold', () => {
    const rag = extractForRAG(mkDoc());
    const heading = rag.chunks.find(c => c.type === 'heading');
    expect(heading).toBeDefined();
    expect(heading!.text).toBe('2026년 사업계획');
  });

  it('이미지 alt 가 있으면 image 청크 생성', () => {
    const rag = extractForRAG(mkDoc());
    const img = rag.chunks.find(c => c.type === 'image');
    expect(img).toBeDefined();
    expect(img!.metadata.alt).toBe('매출 그래프');
  });

  it('includeImages: false — 이미지 제외', () => {
    const rag = extractForRAG(mkDoc(), { includeImages: false });
    expect(rag.chunks.find(c => c.type === 'image')).toBeUndefined();
  });

  it('tokenCount — 한국어 근사 계산', () => {
    const rag = extractForRAG(mkDoc());
    const heading = rag.chunks.find(c => c.type === 'heading');
    expect(heading!.tokenCount).toBeGreaterThan(0);
    expect(heading!.tokenCount).toBeLessThan(20);
  });

  it('NDJSON 포맷 — 줄당 1개 JSON', () => {
    const rag = extractForRAG(mkDoc());
    const nd = toNDJSON(rag);
    const lines = nd.split('\n');
    expect(lines).toHaveLength(rag.chunks.length);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it('LangChain docs 포맷 — pageContent + metadata', () => {
    const rag = extractForRAG(mkDoc());
    const docs = toLangChainDocs(rag);
    expect(docs[0].pageContent).toBeTypeOf('string');
    expect(docs[0].metadata).toHaveProperty('id');
    expect(docs[0].metadata).toHaveProperty('section');
  });

  it('maxTokens 옵션 — 긴 단락 분할', () => {
    const longDoc: HWPXDocument = {
      sections: [
        {
          id: 's0',
          elements: [
            {
              type: 'paragraph',
              runs: [{ text: '매우 긴 단락입니다. '.repeat(200) }],
            },
          ],
        },
      ],
      images: new Map(),
    };
    const extractor = new RAGExtractor({ maxTokens: 50 });
    const rag = extractor.extract(longDoc);
    const paraChunks = rag.chunks.filter(c => c.type === 'paragraph');
    expect(paraChunks.length).toBeGreaterThan(1);
    for (const c of paraChunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(60);
    }
  });
});
