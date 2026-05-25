/**
 * server/pdf-renderer.js — Puppeteer 기반 HWPX → PDF 통합 테스트.
 *
 * 환경:
 *   - puppeteer + Chromium 다운로드가 필요하다.
 *   - CI/로컬에서 Chromium 이 없거나 PUPPETEER_SKIP_DOWNLOAD=1 인 경우
 *     describe 블록 전체를 skip 한다 (테스트 회귀 0 유지).
 *
 * 검증 포인트:
 *   1) 결과 바이트가 %PDF- 시그니처로 시작
 *   2) pdfjs-dist 로 파싱했을 때 텍스트 레이어가 존재
 *   3) 한국어 본문이 텍스트로 임베드 (이미지 변환 X)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PdfRendererModule {
  renderHwpxToPdf: (
    buffer: Uint8Array | Buffer | ArrayBuffer,
    options?: Record<string, unknown>
  ) => Promise<Uint8Array>;
  injectKoreanFonts: (html: string, extra?: string) => string;
}

interface ChromiumProbe {
  ok: boolean;
  reason?: string;
}

async function probeChromium(): Promise<ChromiumProbe> {
  if (process.env.PUPPETEER_SKIP_DOWNLOAD === '1') {
    return { ok: false, reason: 'PUPPETEER_SKIP_DOWNLOAD=1' };
  }
  let puppeteer: typeof import('puppeteer');
  try {
    puppeteer = (await import('puppeteer')) as unknown as typeof import('puppeteer');
  } catch (e) {
    return { ok: false, reason: 'puppeteer not installed: ' + ((e as Error).message || e) };
  }
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    await browser.close();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'Chromium launch failed: ' + ((e as Error).message || e) };
  }
}

// 최상위 await 대신 beforeAll 안에서 동기 결과를 캡처할 수 없으므로
// `describe.skipIf` 를 활용한다. vitest 4 에서는 `skipIf` 가 지원된다.
const probe = await probeChromium();
const SKIP_REASON = probe.ok ? '' : probe.reason || 'unknown';

describe.skipIf(!probe.ok)(
  'server/pdf-renderer (Puppeteer 통합)',
  { timeout: 120000 },
  () => {
    let renderer: PdfRendererModule;
    let hwpxBytes: Uint8Array;

    beforeAll(async () => {
      const mod = (await import(
        resolve(__dirname, '../../server/pdf-renderer.js') as string
      )) as unknown as PdfRendererModule;
      renderer = mod;
      const buf = await readFile(
        resolve(__dirname, '../golden/01-paragraph/fixture.hwpx')
      );
      hwpxBytes = new Uint8Array(buf);
    });

    it('PDF 바이트 시그니처가 %PDF- 로 시작한다', async () => {
      const pdf = await renderer.renderHwpxToPdf(hwpxBytes, {
        title: 'pdf-renderer-test',
      });
      expect(pdf).toBeInstanceOf(Uint8Array);
      expect(pdf.byteLength).toBeGreaterThan(500);
      const head = String.fromCharCode(...pdf.slice(0, 5));
      expect(head).toBe('%PDF-');
    });

    it('한국어 본문이 텍스트 레이어로 추출된다 (이미지 X)', async () => {
      const pdf = await renderer.renderHwpxToPdf(hwpxBytes, { title: 'text-layer' });

      // pdfjs-dist 로 텍스트 추출 — 본 프로젝트에 이미 dependency
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(
        async () => await import('pdfjs-dist')
      );
      const loadingTask = (pdfjs as { getDocument: (a: unknown) => { promise: Promise<unknown> } })
        .getDocument({
          data: pdf,
          // worker 비활성 — Node 환경에선 fake worker 가 안정적
          disableWorker: true,
          isEvalSupported: false,
          useSystemFonts: true,
        });
      const doc = (await loadingTask.promise) as {
        numPages: number;
        getPage: (n: number) => Promise<{
          getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
        }>;
      };
      expect(doc.numPages).toBeGreaterThan(0);

      let combined = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        combined += tc.items.map(it => it.str).join('');
      }

      // 01-paragraph 픽스처는 "가운데 정렬", "빨강" 등의 한국어 텍스트를 포함한다.
      // (headless-html 테스트에서 동일 토큰을 검증 중)
      expect(combined.length).toBeGreaterThan(0);
      const hasKorean = /[가-힯]/.test(combined);
      expect(hasKorean).toBe(true);
    });

    it('injectKoreanFonts 가 head 에 Google Fonts link 를 주입한다', () => {
      const html = '<!DOCTYPE html><html><head><title>x</title></head><body>안녕</body></html>';
      const out = renderer.injectKoreanFonts(html);
      expect(out).toContain('Noto+Sans+KR');
      expect(out).toContain('data-injected="korean-fonts"');
      // 중복 호출 시에도 한 번만 주입
      const out2 = renderer.injectKoreanFonts(out);
      const occurrences = out2.split('data-injected="korean-fonts"').length - 1;
      expect(occurrences).toBe(1);
    });
  }
);

// 환경상 skip 된 경우, 한 줄짜리 진단 테스트로 이유를 기록 (CI 로그에서 확인 가능).
describe.skipIf(probe.ok)('server/pdf-renderer (skip diagnostic)', () => {
  it(`skipped — ${SKIP_REASON}`, () => {
    expect(probe.ok).toBe(false);
  });
});
