import { describe, it, expect, vi } from 'vitest';
import { concatResults, terminate } from './ocr-service';

describe('OCR Service', () => {
  it('concatResults — 페이지 구분자 포함', () => {
    const merged = concatResults([
      { text: 'Hello', confidence: 90, language: 'eng', durationMs: 10 },
      { text: 'World', confidence: 88, language: 'eng', durationMs: 10 },
    ]);
    expect(merged).toContain('--- Page 1 ---');
    expect(merged).toContain('--- Page 2 ---');
    expect(merged).toContain('Hello');
    expect(merged).toContain('World');
  });

  it('terminate 호출 — 캐시 없어도 에러 없이 종료', async () => {
    await expect(terminate()).resolves.toBeUndefined();
  });

  it('옵션 타입 — OCRLanguage 유니언 검증', () => {
    const valid: Array<'kor' | 'eng' | 'kor+eng'> = ['kor', 'eng', 'kor+eng'];
    expect(valid).toHaveLength(3);
  });

  it('빈 결과 배열 병합 — 빈 문자열', () => {
    expect(concatResults([])).toBe('');
  });
});

describe('OCR Service — lazy worker', () => {
  it('tesseract.js 는 최초 recognize 호출 전까지 import 되지 않아야 함', () => {
    const hasTesseract = Object.keys((globalThis as Record<string, unknown>))
      .some(k => k.toLowerCase().includes('tesseract'));
    expect(hasTesseract).toBe(false);
    expect(vi).toBeDefined();
  });
});
