import { describe, it, expect, vi } from 'vitest';
import {
  checkTextWithAI,
  parseAIResponse,
  chunkText,
} from './ai-spell-checker.js';

describe('ai-spell-checker / parseAIResponse', () => {
  it('parses pure JSON array', () => {
    const r = parseAIResponse('[{"start":0,"end":2,"original":"가나","suggestion":"가다","reason":"x","severity":"error"}]');
    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(1);
  });
  it('strips markdown code fence', () => {
    const r = parseAIResponse('```json\n[]\n```');
    expect(r).toEqual([]);
  });
  it('extracts array from text prefix/suffix', () => {
    const r = parseAIResponse('Here you go: [{"x":1}] thanks');
    expect(r).toEqual([{ x: 1 }]);
  });
  it('returns null on invalid input', () => {
    expect(parseAIResponse('')).toBeNull();
    expect(parseAIResponse('not json')).toBeNull();
    expect(parseAIResponse('{"not":"array"}')).toBeNull();
  });
});

describe('ai-spell-checker / chunkText', () => {
  it('returns single chunk under limit', () => {
    const r = chunkText('짧은 글', 100);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ text: '짧은 글', offset: 0 });
  });
  it('splits text exceeding limit', () => {
    const big = 'ㄱ'.repeat(2500);
    const r = chunkText(big, 1000);
    expect(r.length).toBeGreaterThanOrEqual(3);
    // 모든 청크 결합 시 원본 복원 (경계 보정 허용)
    const joined = r.map(c => c.text).join('');
    expect(joined.length).toBe(big.length);
    // offset 단조 증가
    for (let i = 1; i < r.length; i++) {
      expect(r[i].offset).toBeGreaterThan(r[i - 1].offset);
    }
  });
});

describe('ai-spell-checker / checkTextWithAI', () => {
  it('returns [] for empty text', async () => {
    const r = await checkTextWithAI('');
    expect(r).toEqual([]);
  });

  it('returns [] when service unavailable (graceful fallback)', async () => {
    // 주입된 _serviceGenerate 없이 호출 → universalLLM 가 키 없이도 빈 결과
    const fakeService = vi.fn(async () => { throw new Error('no api key'); });
    const r = await checkTextWithAI('테스트', { _serviceGenerate: fakeService });
    expect(r).toEqual([]);
    expect(fakeService).toHaveBeenCalled();
  });

  it('parses valid LLM response and maps to AIIssue', async () => {
    const text = '나는 결제를 받았다';
    // 정상 LLM 응답 mock — original 슬라이스가 텍스트와 정확히 일치해야 채택
    const start = text.indexOf('결제');
    const end = start + 2;
    const fakeService = vi.fn(async () => ({
      content: JSON.stringify([
        { start, end, original: '결제', suggestion: '결재', reason: '문서 승인 맥락', severity: 'error' },
      ]),
    }));

    const r = await checkTextWithAI(text, { _serviceGenerate: fakeService });
    expect(r).toHaveLength(1);
    expect(r[0].original).toBe('결제');
    expect(r[0].suggestion).toBe('결재');
    expect(r[0].aiGenerated).toBe(true);
    expect(r[0].severity).toBe('error');
  });

  it('drops issues whose original does not match text slice', async () => {
    const text = '안녕하세요';
    const fakeService = vi.fn(async () => ({
      content: JSON.stringify([
        { start: 0, end: 2, original: '안녕', suggestion: '안녕!', reason: 'x', severity: 'warning' }, // 정상
        { start: 0, end: 2, original: '다른값', suggestion: 'X', reason: 'x', severity: 'error' },     // 불일치 → 폐기
      ]),
    }));
    const r = await checkTextWithAI(text, { _serviceGenerate: fakeService });
    expect(r).toHaveLength(1);
    expect(r[0].suggestion).toBe('안녕!');
  });

  it('drops issues with same original/suggestion', async () => {
    const text = '같은 단어';
    const fakeService = vi.fn(async () => ({
      content: JSON.stringify([
        { start: 0, end: 2, original: '같은', suggestion: '같은', reason: 'noop', severity: 'warning' },
      ]),
    }));
    const r = await checkTextWithAI(text, { _serviceGenerate: fakeService });
    expect(r).toEqual([]);
  });

  it('rejects text longer than chunkLimit when allowChunking=false', async () => {
    const big = '가'.repeat(1500);
    const fakeService = vi.fn(async () => ({ content: '[]' }));
    const r = await checkTextWithAI(big, {
      _serviceGenerate: fakeService,
      chunkLimit: 1000,
      allowChunking: false,
    });
    expect(r).toEqual([]);
    expect(fakeService).not.toHaveBeenCalled();
  });

  it('chunks long text and aggregates results', async () => {
    const part = '여기 결제 입니다. ';
    const text = part.repeat(80); // ≈ 1200+ chars → 2 chunks
    const fakeService = vi.fn(async (messages) => {
      // 각 청크 안에서 "결제" 의 첫 위치를 찾아 응답
      const userMsg = messages[messages.length - 1].content;
      // prompt body 안의 텍스트는 ---\n{chunk}\n--- 사이
      const m = /---\n([\s\S]*)\n---/.exec(userMsg);
      const chunk = m ? m[1] : '';
      const idx = chunk.indexOf('결제');
      if (idx === -1) return { content: '[]' };
      return {
        content: JSON.stringify([
          { start: idx, end: idx + 2, original: '결제', suggestion: '결재', reason: 'ctx', severity: 'error' },
        ]),
      };
    });
    const r = await checkTextWithAI(text, {
      _serviceGenerate: fakeService,
      chunkLimit: 800,
      allowChunking: true,
    });
    expect(r.length).toBeGreaterThanOrEqual(2);
    // 원문 좌표 검증
    for (const it of r) {
      expect(text.slice(it.start, it.end)).toBe('결제');
    }
    expect(fakeService.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('honors AbortSignal before service call', async () => {
    const controller = new AbortController();
    controller.abort();
    const fakeService = vi.fn(async () => ({ content: '[]' }));
    const r = await checkTextWithAI('hello', {
      _serviceGenerate: fakeService,
      signal: controller.signal,
    });
    expect(r).toEqual([]);
    expect(fakeService).not.toHaveBeenCalled();
  });

  it('swallows malformed LLM response', async () => {
    const fakeService = vi.fn(async () => ({ content: 'this is not json at all' }));
    const r = await checkTextWithAI('text', { _serviceGenerate: fakeService });
    expect(r).toEqual([]);
  });
});
