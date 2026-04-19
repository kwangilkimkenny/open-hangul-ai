/**
 * AI Quota — 토큰 예산 계산 및 사용량 추적
 *
 * Vertex AI / Gemini 의 장문 컨텍스트 특성상 요청 전 토큰 예산 검증이 필수.
 * 한국어는 글자당 ~1 토큰, 영어는 ~0.25 토큰으로 근사 (tiktoken 없이 추정).
 *
 * @module lib/ai/ai-quota
 */

import type { VertexModel, TokenBudget, ReferenceDoc } from '../../types/ai-draft';

export const MODEL_LIMITS: Record<VertexModel, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 2_000_000, output: 32_768 },
  'gemini-2.5-flash': { input: 1_000_000, output: 8_192 },
  'gemini-1.5-pro': { input: 2_000_000, output: 8_192 },
  'gemini-1.5-flash': { input: 1_000_000, output: 8_192 },
};

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let ko = 0, other = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3130 && code <= 0x318F)) ko++;
    else other++;
  }
  return Math.ceil(ko / 1.5 + other / 4);
}

export interface BudgetInput {
  model: VertexModel;
  prompt: string;
  references: ReferenceDoc[];
  reservedForOutput?: number;
}

export function computeBudget(input: BudgetInput): TokenBudget {
  const { model, prompt, references } = input;
  const limits = MODEL_LIMITS[model];
  const reservedForOutput = Math.min(input.reservedForOutput ?? 8192, limits.output);

  const promptTokens = estimateTokens(prompt);
  const referenceTokens = references.reduce((s, r) => s + r.tokenCount, 0);
  const remaining = limits.input - promptTokens - referenceTokens - reservedForOutput;

  return {
    model,
    contextLimit: limits.input,
    promptTokens,
    referenceTokens,
    reservedForOutput,
    remaining,
    overflow: remaining < 0,
  };
}

export interface QuotaState {
  dailyLimit: number;
  usedToday: number;
  resetAt: string;
}

export const DEFAULT_FREE_TIER_DAILY: number = 500_000;

export function canConsume(quota: QuotaState, tokens: number): boolean {
  return quota.usedToday + tokens <= quota.dailyLimit;
}

export function remainingDaily(quota: QuotaState): number {
  return Math.max(0, quota.dailyLimit - quota.usedToday);
}

/**
 * 참조 문서들의 합이 컨텍스트 한계를 초과할 때, 우선순위 낮은 항목부터 버려 fit 시킴.
 * priority 는 낮을수록 우선 제거 대상.
 */
export function trimReferencesToFit(
  references: ReferenceDoc[],
  model: VertexModel,
  prompt: string,
  reservedForOutput = 8192
): { kept: ReferenceDoc[]; dropped: ReferenceDoc[] } {
  const limit = MODEL_LIMITS[model].input;
  const budget = limit - estimateTokens(prompt) - reservedForOutput;

  const sorted = [...references].sort((a, b) => a.tokenCount - b.tokenCount);
  const kept: ReferenceDoc[] = [];
  const dropped: ReferenceDoc[] = [];
  let used = 0;

  for (const ref of sorted) {
    if (used + ref.tokenCount <= budget) {
      kept.push(ref);
      used += ref.tokenCount;
    } else {
      dropped.push(ref);
    }
  }
  return { kept, dropped };
}
