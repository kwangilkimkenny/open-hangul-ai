/**
 * OCR Service — tesseract.js 기반 한국어/영어 OCR
 *
 * 이미지 또는 스캔 PDF 페이지를 텍스트로 변환.
 * 워커는 lazy 초기화되어 최초 호출 시에만 로드 (번들 사이즈 영향 최소화).
 *
 * @module lib/ocr/ocr-service
 */

import type { Worker } from 'tesseract.js';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  durationMs: number;
  blocks?: OCRBlock[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export type OCRLanguage = 'kor' | 'eng' | 'kor+eng';

export type OCRInput = File | Blob | HTMLImageElement | HTMLCanvasElement | string;

export interface OCRProgressEvent {
  status: string;
  progress: number;
}

export interface OCROptions {
  language?: OCRLanguage;
  onProgress?: (e: OCRProgressEvent) => void;
}

let workerCache: Map<OCRLanguage, Worker> = new Map();

async function getWorker(lang: OCRLanguage, onProgress?: (e: OCRProgressEvent) => void): Promise<Worker> {
  const cached = workerCache.get(lang);
  if (cached) return cached;

  logger.info(`🔤 OCR 워커 초기화: ${lang}`);
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker(lang, 1, {
    logger: onProgress
      ? (m: { status: string; progress: number }) =>
          onProgress({ status: m.status, progress: m.progress })
      : undefined,
  });

  workerCache.set(lang, worker);
  return worker;
}

/**
 * 이미지 또는 파일에서 텍스트 추출
 */
export async function recognize(input: OCRInput, options: OCROptions = {}): Promise<OCRResult> {
  const language = options.language ?? 'kor+eng';
  const started = performance.now();

  const worker = await getWorker(language, options.onProgress);
  const { data } = await worker.recognize(input as never);

  const blocks: OCRBlock[] = (data.blocks ?? [])
    .filter((b): b is NonNullable<typeof b> => !!b)
    .map(b => ({
      text: b.text ?? '',
      confidence: b.confidence ?? 0,
      bbox: {
        x0: b.bbox?.x0 ?? 0,
        y0: b.bbox?.y0 ?? 0,
        x1: b.bbox?.x1 ?? 0,
        y1: b.bbox?.y1 ?? 0,
      },
    }));

  return {
    text: data.text ?? '',
    confidence: data.confidence ?? 0,
    language,
    durationMs: Math.round(performance.now() - started),
    blocks,
  };
}

/**
 * PDF 전체를 페이지별로 OCR (스캔본 PDF 용도).
 * pdfjs-dist 가 이미 dependency 에 있으므로 재사용.
 */
export async function recognizePdf(
  file: File | Blob,
  options: OCROptions & { scale?: number } = {}
): Promise<OCRResult[]> {
  const pdfjs = await import('pdfjs-dist');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const scale = options.scale ?? 2;
  const results: OCRResult[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    options.onProgress?.({ status: `page ${pageNum}/${pdf.numPages}`, progress: pageNum / pdf.numPages });
    results.push(await recognize(canvas, { language: options.language }));
  }

  return results;
}

/**
 * OCR 결과를 하나의 문자열로 병합
 */
export function concatResults(results: OCRResult[]): string {
  return results.map((r, i) => `--- Page ${i + 1} ---\n${r.text.trim()}`).join('\n\n');
}

/**
 * 워커 해제 — 메모리 반환이 필요할 때 호출 (예: 대용량 작업 종료 후)
 */
export async function terminate(): Promise<void> {
  for (const worker of workerCache.values()) {
    try { await worker.terminate(); } catch { /* noop */ }
  }
  workerCache.clear();
}
