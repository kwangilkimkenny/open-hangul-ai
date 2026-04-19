import { describe, it, expect } from 'vitest';
import {
  embedWatermark,
  extractWatermark,
  hasWatermark,
  stripWatermark,
  encodePayload,
  applyWatermarkToDocument,
  extractWatermarkFromDocument,
} from './watermark';

describe('Invisible Watermark', () => {
  it('라운드트립: embed → extract', () => {
    const payload = { userId: 'user-42', documentId: 'doc-7' };
    const text = '이것은 테스트 문서입니다. '.repeat(20);

    const marked = embedWatermark(text, payload);
    const extracted = extractWatermark(marked);

    expect(extracted).not.toBeNull();
    expect(extracted!.userId).toBe('user-42');
    expect(extracted!.documentId).toBe('doc-7');
    expect(extracted!.timestamp).toBeTypeOf('number');
  });

  it('시각적 텍스트는 보존됨', () => {
    const text = 'Hello, 오픈한글 AI!';
    const marked = embedWatermark(text, { userId: 'a' });
    expect(stripWatermark(marked)).toBe(text);
  });

  it('hasWatermark 탐지', () => {
    const clean = '일반 텍스트';
    const marked = embedWatermark(clean, { userId: 'x' });
    expect(hasWatermark(clean)).toBe(false);
    expect(hasWatermark(marked)).toBe(true);
  });

  it('부분 훼손 후에도 복구 (redundancy)', () => {
    const payload = { userId: 'resilient' };
    const text = '복원력 테스트. '.repeat(40);
    const marked = embedWatermark(text, payload, { redundancy: 3 });

    // 뒤쪽 20% 잘라냄
    const truncated = marked.slice(0, Math.floor(marked.length * 0.8));
    const extracted = extractWatermark(truncated);

    expect(extracted).not.toBeNull();
  });

  it('워터마크 없는 텍스트는 null 반환', () => {
    expect(extractWatermark('일반 문서 내용')).toBeNull();
  });

  it('custom 필드도 보존', () => {
    const marked = embedWatermark('test', {
      userId: 'u',
      custom: { department: 'legal', caseId: 12345 },
    });
    const got = extractWatermark(marked);
    expect(got?.custom?.department).toBe('legal');
    expect(got?.custom?.caseId).toBe(12345);
  });

  it('encodePayload 는 zero-width 만 출력', () => {
    const encoded = encodePayload({ userId: 'a' });
    expect(/^[\u200B\u200C\u200D]+$/.test(encoded)).toBe(true);
  });

  it('HWPX 문서 통합 — applyWatermarkToDocument → extract', () => {
    const doc = {
      sections: [
        {
          elements: [
            { type: 'paragraph', runs: [{ text: '첫 번째 단락입니다.' }] },
            { type: 'paragraph', runs: [{ text: '두 번째 단락입니다.' }] },
            { type: 'paragraph', runs: [{ text: '세 번째 단락입니다.' }] },
          ],
        },
      ],
    };
    const applied = applyWatermarkToDocument(doc, { userId: 'doc-test', documentId: 'D-001' });
    expect(applied).toBeGreaterThanOrEqual(1);

    const extracted = extractWatermarkFromDocument(doc);
    expect(extracted?.userId).toBe('doc-test');
    expect(extracted?.documentId).toBe('D-001');
  });
});
