/**
 * Draft Generator — Vertex AI 초안 생성 오케스트레이션
 *
 * 파이프라인:
 *   1. 토큰 예산 계산 (AI Quota)
 *   2. 참조 문서 트리밍 (초과 시)
 *   3. 프롬프트 조립 (system + 참조 + 사용자 요청)
 *   4. Vertex AI streamGenerateContent 호출
 *   5. 텍스트 스트림 → JSON 파싱 → HWPXDocument 변환
 *
 * @module lib/ai/draft-generator
 */

import type { HWPXDocument } from '../../types/hwpx';
import type {
  DraftRequest,
  DraftStreamEvent,
  ReferenceDoc,
  TokenBudget,
  VertexModel,
} from '../../types/ai-draft';
import { VertexClient, type VertexRequest } from './vertex-client';
import { computeBudget, trimReferencesToFit, estimateTokens } from './ai-quota';
import {
  SYSTEM_INSTRUCTION,
  DRAFT_FUNCTION_DECLARATION,
  validateDraft,
  draftToHwpx,
  type DraftOutput,
} from './hwpx-schema';

export interface GenerateOptions {
  signal?: AbortSignal;
  onEvent?: (e: DraftStreamEvent) => void;
}

export interface GenerateResult {
  document: HWPXDocument;
  draft: DraftOutput;
  tokensUsed: number;
  budget: TokenBudget;
  droppedReferences: ReferenceDoc[];
}

export class DraftGenerator {
  private client: VertexClient;

  constructor(client?: VertexClient) {
    this.client = client ?? new VertexClient();
  }

  async generate(req: DraftRequest, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const model: VertexModel = req.model ?? 'gemini-2.5-pro';
    const requestId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 1. 예산 + 트리밍
    const { kept, dropped } = trimReferencesToFit(req.references, model, req.prompt, req.maxOutputTokens);
    const budget = computeBudget({
      model,
      prompt: req.prompt,
      references: kept,
      reservedForOutput: req.maxOutputTokens,
    });

    opts.onEvent?.({ type: 'start', requestId, model, budget });

    if (budget.overflow) {
      const err: DraftStreamEvent = {
        type: 'error',
        code: 'CONTEXT_OVERFLOW',
        message: `컨텍스트 초과: ${Math.abs(budget.remaining).toLocaleString()} 토큰 부족`,
      };
      opts.onEvent?.(err);
      throw new Error(err.message);
    }

    // 2. Vertex 요청 조립
    const vertexReq = this.buildRequest(req, kept, model);

    // 3. 스트림 수신 + 누적
    let fullText = '';
    let promptTokens = 0;
    let outputTokens = 0;

    for await (const chunk of this.client.streamGenerate(vertexReq, { signal: opts.signal })) {
      if (chunk.text) {
        fullText += chunk.text;
        opts.onEvent?.({ type: 'delta', text: chunk.text });
      }
      if (chunk.functionCall?.args) {
        const maybe = chunk.functionCall.args as unknown;
        if (validateDraft(maybe)) {
          fullText = JSON.stringify(maybe);
        }
      }
      if (chunk.usageMetadata) {
        promptTokens = chunk.usageMetadata.promptTokenCount ?? 0;
        outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
        opts.onEvent?.({ type: 'usage', promptTokens, outputTokens });
      }
    }

    // 4. JSON 파싱
    const draft = this.parseDraft(fullText);
    const document = draftToHwpx(draft);
    const tokensUsed = promptTokens + outputTokens || estimateTokens(fullText);

    opts.onEvent?.({ type: 'done', document, tokensUsed });

    return { document, draft, tokensUsed, budget, droppedReferences: dropped };
  }

  private buildRequest(req: DraftRequest, refs: ReferenceDoc[], model: VertexModel): VertexRequest {
    const userParts: string[] = [];

    if (refs.length > 0) {
      userParts.push('## 참조 문서');
      refs.forEach((r, i) => {
        userParts.push(`### [${i + 1}] ${r.fileName}\n${r.text}`);
      });
      userParts.push('');
    }

    userParts.push('## 작성 요청');
    userParts.push(req.prompt);
    userParts.push('');
    userParts.push('위 요청에 따라 JSON 스키마를 준수해 초안을 작성하세요.');

    return {
      model,
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: userParts.join('\n') }] }],
      generationConfig: {
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxOutputTokens ?? 16384,
        responseMimeType: 'application/json',
        responseSchema: DRAFT_FUNCTION_DECLARATION.parameters,
      },
    };
  }

  private parseDraft(text: string): DraftOutput {
    const trimmed = this.stripMarkdownFence(text.trim());
    try {
      const parsed = JSON.parse(trimmed);
      if (!validateDraft(parsed)) {
        throw new Error('응답이 HWPX draft 스키마를 만족하지 않습니다');
      }
      return parsed;
    } catch (err) {
      throw new Error(`JSON 파싱 실패: ${(err as Error).message}\n내용: ${trimmed.slice(0, 200)}`);
    }
  }

  private stripMarkdownFence(s: string): string {
    const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```$/;
    const m = s.match(fence);
    return m ? m[1] : s;
  }
}

export function createDraftGenerator(): DraftGenerator {
  return new DraftGenerator();
}
