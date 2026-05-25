import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkTextHybrid, mergeIssues } from './spell-checker.js';
import { clearAll } from './user-dictionary.js';
import { _setMemoryOnly, resetQuota } from './ai-quota.js';

// AI 서비스 호출을 회피하기 위해 ai-spell-checker 모듈을 mock
vi.mock('./ai-spell-checker.js', async () => {
  const actual = await vi.importActual('./ai-spell-checker.js');
  return {
    ...actual,
    checkTextWithAI: vi.fn(async (text /* , options */) => {
      // "결제" 가 포함되면 한 건 반환
      const idx = text.indexOf('결제');
      if (idx === -1) return [];
      return [{
        start: idx,
        end: idx + 2,
        original: '결제',
        suggestion: '결재',
        reason: '문맥상 결재가 맞음',
        severity: 'error',
        category: 'spelling',
        aiGenerated: true,
      }];
    }),
  };
});

describe('spell-checker / mergeIssues', () => {
  it('merges by position; AI wins on collision', () => {
    const rule = [{ ruleId: 'r1', start: 0, end: 2, text: 'aa', replacement: 'bb', severity: 'warning', category: 'spelling', hint: 'h' }];
    const ai = [{ ruleId: 'ai', start: 0, end: 2, text: 'aa', replacement: 'cc', severity: 'error', category: 'spelling', hint: 'AI', aiGenerated: true }];
    const merged = mergeIssues(rule, ai);
    expect(merged).toHaveLength(1);
    expect(merged[0].replacement).toBe('cc');
    expect(merged[0].aiGenerated).toBe(true);
  });

  it('keeps non-overlapping issues from both sources', () => {
    const rule = [{ ruleId: 'r1', start: 0, end: 2, text: 'aa', replacement: 'bb', severity: 'warning', category: 'spelling', hint: '' }];
    const ai = [{ ruleId: 'ai', start: 5, end: 7, text: 'cd', replacement: 'cf', severity: 'error', category: 'spelling', hint: '', aiGenerated: true }];
    const merged = mergeIssues(rule, ai);
    expect(merged).toHaveLength(2);
    expect(merged[0].start).toBe(0);
    expect(merged[1].start).toBe(5);
  });
});

describe('spell-checker / checkTextHybrid', () => {
  beforeEach(() => {
    clearAll();
    _setMemoryOnly(true);
    resetQuota();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns rule issues synchronously and empty AI when disabled', async () => {
    const { ruleIssues, aiPromise, mergedPromise } = checkTextHybrid('나는 됬다 결제', { enableAI: false });
    expect(Array.isArray(ruleIssues)).toBe(true);
    expect(ruleIssues.length).toBeGreaterThan(0); // '됬다' 룰 매칭
    await expect(aiPromise).resolves.toEqual([]);
    const merged = await mergedPromise;
    expect(merged.length).toBeGreaterThan(0);
  });

  it('triggers AI after debounce when enabled, and merges results', async () => {
    const text = '결재 서류는 결제가 아니다';
    const { ruleIssues, aiPromise, mergedPromise } = checkTextHybrid(text, {
      enableAI: true,
      aiDelayMs: 1000,
    });
    expect(Array.isArray(ruleIssues)).toBe(true);

    // 디바운스 진행
    await vi.advanceTimersByTimeAsync(1100);

    const aiIssues = await aiPromise;
    expect(aiIssues.length).toBeGreaterThanOrEqual(1);
    const found = aiIssues.find((i) => i.text === '결제');
    expect(found).toBeTruthy();
    expect(found.replacement).toBe('결재');
    expect(found.aiGenerated).toBe(true);

    const merged = await mergedPromise;
    expect(merged.some((i) => i.aiGenerated && i.text === '결제')).toBe(true);
  });

  it('skips AI when quota exhausted', async () => {
    // 한도 0 → 즉시 skip
    const { aiPromise } = checkTextHybrid('결제 했어요', {
      enableAI: true,
      aiDelayMs: 100,
      aiLimit: 0,
    });
    await expect(aiPromise).resolves.toEqual([]);
  });

  it('cancel() prevents AI invocation', async () => {
    const { aiPromise, cancel } = checkTextHybrid('결제 했어요', {
      enableAI: true,
      aiDelayMs: 1000,
    });
    cancel();
    // 디바운스 시간이 지나도 결과는 빈 배열 (catch 로 흡수)
    await vi.advanceTimersByTimeAsync(1500);
    await expect(aiPromise).resolves.toEqual([]);
  });
});
