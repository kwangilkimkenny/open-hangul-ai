/**
 * RAG Extractor — HWPX 문서를 RAG / LLM 입력용 청크 JSON 으로 변환
 *
 * 청크 전략:
 *   1. 시맨틱 그리드 기반 표 → 헤더 라벨 포함 "header: content" 청크
 *   2. 단락 → 토큰 길이 기반 머지/분할
 *   3. 이미지 → alt/캡션만 별도 chunk 로 유지
 *
 * 각 청크는 역추적 가능한 path 와 간단한 metadata 를 포함.
 *
 * @module lib/rag/rag-extractor
 */

import type {
  HWPXDocument,
  HWPXSection,
  HWPXParagraph,
  HWPXImage,
  HWPXRun,
} from '../../types/hwpx';
import { DocumentStructureExtractor } from '../ai/structure-extractor';

export interface RAGChunk {
  id: string;
  type: 'paragraph' | 'table-pair' | 'image' | 'heading';
  text: string;
  tokenCount: number;
  path: {
    section: number;
    element: number;
    row?: number;
    cell?: number;
  };
  metadata: {
    header?: string;
    columnHeaders?: string[];
    rowHeaders?: string[];
    contentType?: string;
    alt?: string;
  };
}

export interface RAGDocument {
  source: {
    title?: string;
    documentType?: string;
    totalSections: number;
    totalChunks: number;
    extractedAt: string;
    version: '1.0';
  };
  chunks: RAGChunk[];
}

export interface RAGExtractorOptions {
  /** 최대 청크 토큰 수. 기본 512 (한국어는 대략 1토큰=1.5자) */
  maxTokens?: number;
  /** 최소 청크 토큰 수 — 미만 단락은 다음 단락과 병합 */
  minTokens?: number;
  /** 이미지 청크 포함 여부 (기본 true) */
  includeImages?: boolean;
  /** 헤딩 감지 (font-size 기반) */
  detectHeadings?: boolean;
}

const DEFAULTS: Required<RAGExtractorOptions> = {
  maxTokens: 512,
  minTokens: 20,
  includeImages: true,
  detectHeadings: true,
};

/** 대략적인 토큰 수 추정 — 한국어 1.5자/토큰, 영어 4자/토큰 (tiktoken 없이 근사) */
function estimateTokens(text: string): number {
  const koChars = (text.match(/[\u3130-\u318F\uAC00-\uD7A3]/g) ?? []).length;
  const other = text.length - koChars;
  return Math.ceil(koChars / 1.5 + other / 4);
}

function runsToText(runs: HWPXRun[] | undefined): string {
  return (runs ?? []).map(r => r.text ?? '').join('');
}

function isHeading(para: HWPXParagraph): boolean {
  const firstRun = para.runs?.[0];
  if (!firstRun?.style) return false;
  const size = Number(firstRun.style.fontSize ?? 0);
  const bold = firstRun.style.bold === true || firstRun.style.fontWeight === 'bold';
  return (size > 14 && bold) || size >= 18;
}

export class RAGExtractor {
  private opts: Required<RAGExtractorOptions>;

  constructor(options: RAGExtractorOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  extract(doc: HWPXDocument): RAGDocument {
    const chunks: RAGChunk[] = [];

    // 1. 표 청크 — 시맨틱 구조 활용
    const structExtractor = new DocumentStructureExtractor();
    const structure = structExtractor.extractEnhancedStructure(doc);
    for (const pair of structure.pairs) {
      if (!pair.header.trim() && !pair.content.trim()) continue;
      const text = pair.header ? `${pair.header}: ${pair.content}` : pair.content;
      chunks.push({
        id: `table-${pair.path.section}-${pair.path.table}-${pair.path.row}-${pair.path.contentCell}`,
        type: 'table-pair',
        text,
        tokenCount: estimateTokens(text),
        path: {
          section: pair.path.section,
          element: pair.path.table,
          row: pair.path.row,
          cell: pair.path.contentCell,
        },
        metadata: {
          header: pair.header,
          columnHeaders: pair.columnHeaders,
          rowHeaders: pair.rowHeaders,
          contentType: pair.contentType,
        },
      });
    }

    // 2. 단락 청크 — 테이블에 이미 포함된 요소는 제외
    doc.sections.forEach((section, sIdx) => {
      this.extractSectionParagraphs(section, sIdx, chunks);
    });

    // 3. 이미지 청크
    if (this.opts.includeImages) {
      this.extractImages(doc, chunks);
    }

    // 4. 인접 작은 단락 병합
    const merged = this.mergeSmallChunks(chunks);

    return {
      source: {
        title: structure.title ?? doc.metadata?.title,
        documentType: structure.documentType,
        totalSections: doc.sections.length,
        totalChunks: merged.length,
        extractedAt: new Date().toISOString(),
        version: '1.0',
      },
      chunks: merged,
    };
  }

  private extractSectionParagraphs(section: HWPXSection, sIdx: number, chunks: RAGChunk[]) {
    section.elements.forEach((el, eIdx) => {
      if (el.type !== 'paragraph') return;
      const para = el as HWPXParagraph;
      const text = runsToText(para.runs).trim();
      if (!text) return;

      const isHead = this.opts.detectHeadings && isHeading(para);
      chunks.push({
        id: `para-${sIdx}-${eIdx}`,
        type: isHead ? 'heading' : 'paragraph',
        text,
        tokenCount: estimateTokens(text),
        path: { section: sIdx, element: eIdx },
        metadata: {},
      });

      // 너무 긴 단락은 분할
      const last = chunks[chunks.length - 1];
      if (last.tokenCount > this.opts.maxTokens) {
        chunks.pop();
        const split = this.splitLongText(last.text, last.id, last.path);
        chunks.push(...split);
      }
    });
  }

  private splitLongText(text: string, baseId: string, path: RAGChunk['path']): RAGChunk[] {
    const sentences = text.split(/(?<=[.!?。])\s+/);
    const out: RAGChunk[] = [];
    let buf = '';
    let idx = 0;

    const flush = () => {
      if (!buf.trim()) return;
      out.push({
        id: `${baseId}-${idx++}`,
        type: 'paragraph',
        text: buf.trim(),
        tokenCount: estimateTokens(buf),
        path,
        metadata: {},
      });
      buf = '';
    };

    for (const sent of sentences) {
      if (estimateTokens(buf + sent) > this.opts.maxTokens && buf) flush();
      buf += (buf ? ' ' : '') + sent;
    }
    flush();
    return out;
  }

  private extractImages(doc: HWPXDocument, chunks: RAGChunk[]) {
    doc.sections.forEach((section, sIdx) => {
      section.elements.forEach((el, eIdx) => {
        if (el.type !== 'image') return;
        const img = el as HWPXImage;
        const alt = img.alt ?? '';
        if (!alt) return;
        chunks.push({
          id: `img-${sIdx}-${eIdx}`,
          type: 'image',
          text: `[이미지] ${alt}`,
          tokenCount: estimateTokens(alt),
          path: { section: sIdx, element: eIdx },
          metadata: { alt },
        });
      });
    });
  }

  private mergeSmallChunks(chunks: RAGChunk[]): RAGChunk[] {
    const out: RAGChunk[] = [];
    for (const c of chunks) {
      const last = out[out.length - 1];
      const canMerge =
        last &&
        last.type === 'paragraph' &&
        c.type === 'paragraph' &&
        last.path.section === c.path.section &&
        last.tokenCount < this.opts.minTokens &&
        last.tokenCount + c.tokenCount <= this.opts.maxTokens;

      if (canMerge) {
        last.text = `${last.text}\n${c.text}`;
        last.tokenCount = estimateTokens(last.text);
      } else {
        out.push({ ...c });
      }
    }
    return out;
  }
}

/** 편의 함수 — 기본 옵션으로 추출 */
export function extractForRAG(doc: HWPXDocument, options?: RAGExtractorOptions): RAGDocument {
  return new RAGExtractor(options).extract(doc);
}

/** NDJSON 포맷으로 내보내기 — 벡터 DB 적재용 */
export function toNDJSON(rag: RAGDocument): string {
  return rag.chunks.map(c => JSON.stringify(c)).join('\n');
}

/** LangChain-style 포맷으로 변환 */
export interface LangChainDoc {
  pageContent: string;
  metadata: Record<string, unknown>;
}

export function toLangChainDocs(rag: RAGDocument): LangChainDoc[] {
  return rag.chunks.map(c => ({
    pageContent: c.text,
    metadata: {
      id: c.id,
      type: c.type,
      ...c.path,
      ...c.metadata,
      source: rag.source.title ?? 'unknown',
    },
  }));
}
