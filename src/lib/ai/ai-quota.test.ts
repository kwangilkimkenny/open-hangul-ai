import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  computeBudget,
  canConsume,
  remainingDaily,
  trimReferencesToFit,
  MODEL_LIMITS,
  DEFAULT_FREE_TIER_DAILY,
} from './ai-quota';
import type { ReferenceDoc } from '../../types/ai-draft';

function mkRef(name: string, tokens: number, text = 'x'): ReferenceDoc {
  return {
    fileId: name,
    fileName: name,
    mimeType: 'text/plain',
    tokenCount: tokens,
    text,
    uploadedAt: new Date().toISOString(),
  };
}

describe('AI Quota', () => {
  it('estimateTokens — 한국어 vs 영어', () => {
    const ko = estimateTokens('안녕하세요 반갑습니다');
    const en = estimateTokens('hello world foo');
    expect(ko).toBeGreaterThan(0);
    expect(en).toBeGreaterThan(0);
  });

  it('estimateTokens — 빈 문자열', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('computeBudget — 정상 요청 (overflow=false)', () => {
    const b = computeBudget({
      model: 'gemini-2.5-pro',
      prompt: '보고서 작성',
      references: [mkRef('a', 100_000), mkRef('b', 200_000)],
    });
    expect(b.overflow).toBe(false);
    expect(b.contextLimit).toBe(MODEL_LIMITS['gemini-2.5-pro'].input);
    expect(b.referenceTokens).toBe(300_000);
    expect(b.remaining).toBeGreaterThan(0);
  });

  it('computeBudget — overflow 감지', () => {
    const b = computeBudget({
      model: 'gemini-2.5-flash',
      prompt: '요청',
      references: [mkRef('a', 1_500_000)],
    });
    expect(b.overflow).toBe(true);
    expect(b.remaining).toBeLessThan(0);
  });

  it('canConsume / remainingDaily', () => {
    const q = { dailyLimit: 500_000, usedToday: 100_000, resetAt: new Date().toISOString() };
    expect(canConsume(q, 300_000)).toBe(true);
    expect(canConsume(q, 500_000)).toBe(false);
    expect(remainingDaily(q)).toBe(400_000);
  });

  it('DEFAULT_FREE_TIER_DAILY', () => {
    expect(DEFAULT_FREE_TIER_DAILY).toBe(500_000);
  });

  it('trimReferencesToFit — 큰 참조는 버려짐', () => {
    // 2M 한도 - 8K output = ~1.99M 가용. 두 개 합치면 초과.
    const refs = [mkRef('a', 1_500_000), mkRef('b', 800_000), mkRef('small', 10_000)];
    const { kept, dropped } = trimReferencesToFit(refs, 'gemini-2.5-pro', 'x');
    expect(kept).toContain(refs[2]);       // 10K 는 무조건 fit
    expect(dropped.length).toBeGreaterThanOrEqual(1);
    const keptTokens = kept.reduce((s, r) => s + r.tokenCount, 0);
    expect(keptTokens).toBeLessThanOrEqual(2_000_000 - 8192);
  });
});
