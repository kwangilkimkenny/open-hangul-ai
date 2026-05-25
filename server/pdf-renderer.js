/**
 * Puppeteer 기반 서버 사이드 HWPX → PDF 렌더러
 * -----------------------------------------------------------------------------
 * 기존 클라이언트 사이드 PDF 변환(html2canvas 래스터화)의 한계인
 *   - 본문 텍스트 검색·복사 불가 (이미지)
 *   - 한글 폰트 미임베드
 * 를 해결하기 위해, 트랙 X 헤드리스 HTML exporter 의 결과물을 headless
 * Chromium 에 로드해 `page.pdf()` 로 변환한다.
 *
 * 흐름:
 *   1) parseHwpxHeadless(buffer)  — 트랙 X 의 Node 호환 파서
 *   2) exportHtml(doc, …)         — 트랙 X 의 HTML5 직렬화
 *   3) injectKoreanFonts(html)    — Google Fonts(Noto Sans/Serif KR) link 주입
 *   4) browser.newPage() → setContent(html, { waitUntil: 'networkidle0' })
 *   5) page.pdf({ format, margin, … })  → Uint8Array
 *
 * 설계 원칙:
 *   - 다른 트랙 코드는 import 전용. 절대 수정하지 않음.
 *   - puppeteer 는 devDependency. production 환경에서 사용자가 선택적으로 설치.
 *   - 호출자가 browser 인스턴스를 재사용하고 싶을 때를 위한 `browser` 옵션 지원.
 *   - 한글 폰트가 없는 컨테이너 환경에서도 본문 글리프가 표시되도록
 *     기본적으로 Noto Sans/Serif KR 을 head 에 주입한다.
 *
 * @module server/pdf-renderer
 */

import {
  parseHwpxHeadless,
  exportHtml,
} from '../src/lib/headless/index.js';

/**
 * Google Fonts (Noto Sans/Serif KR) 임베드용 <link> 태그.
 * Chromium 이 페이지 로드 시 폰트 파일을 받아 텍스트를 글리프로 그린다.
 * (오프라인 환경이라면 옵션의 customFontHtml 로 base64 인라인 가능)
 */
const KOREAN_FONTS_HEAD = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
<style>
  html, body { font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "AppleGothic", system-ui, sans-serif; }
  /* PDF 인쇄 시 배경/색 보존 */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
</style>
`;

/**
 * exportHtml() 출력에 한글 폰트 link 를 주입한다.
 * </head> 직전에 끼워 넣되, 이미 같은 marker 가 있으면 중복 삽입 회피.
 *
 * @param {string} html
 * @param {string} [extraHead] customFontHtml 등 추가 head 콘텐츠
 * @returns {string}
 */
function injectKoreanFonts(html, extraHead = '') {
  const marker = 'data-injected="korean-fonts"';
  if (html.includes(marker)) return html;
  const head = `<meta ${marker} content="1" />${KOREAN_FONTS_HEAD}${extraHead || ''}`;
  const idx = html.indexOf('</head>');
  if (idx === -1) {
    // <head> 가 없으면 문서 맨 앞에 prepend (방어적)
    return head + html;
  }
  return html.slice(0, idx) + head + html.slice(idx);
}

/**
 * puppeteer 를 동적으로 import 한다. 미설치 환경에서 친절한 에러를 던진다.
 * @returns {Promise<import('puppeteer')>}
 */
async function loadPuppeteer() {
  try {
    const mod = await import('puppeteer');
    return mod.default || mod;
  } catch (err) {
    const wrapped = new Error(
      'puppeteer 가 설치되어 있지 않습니다. `npm install --save-dev puppeteer` 후 다시 시도하세요. ' +
        '(원인: ' +
        ((err && err.message) || err) +
        ')'
    );
    wrapped.code = 'PUPPETEER_NOT_INSTALLED';
    throw wrapped;
  }
}

/**
 * HWPX 버퍼를 PDF 로 렌더링한다.
 *
 * @param {Buffer|Uint8Array|ArrayBuffer} buffer  HWPX 원본 바이트
 * @param {object} [options]
 * @param {string} [options.password]           암호화된 HWPX 비밀번호
 * @param {string} [options.fileName]           파서/디버그용 파일명 메타
 * @param {string} [options.title]              HTML <title>
 * @param {string} [options.format='A4']        page.pdf() format
 * @param {object} [options.margin]             { top, right, bottom, left } CSS 단위 문자열
 * @param {boolean} [options.printBackground=true]
 * @param {boolean} [options.landscape]
 * @param {boolean} [options.displayHeaderFooter]
 * @param {string} [options.headerTemplate]
 * @param {string} [options.footerTemplate]
 * @param {string} [options.customFontHtml]     오프라인 폰트 등 추가 <head> HTML
 * @param {boolean} [options.skipFontInjection] true 면 Google Fonts 주입을 건너뜀
 * @param {import('puppeteer').Browser} [options.browser]  재사용할 browser
 * @param {string[]} [options.launchArgs]       puppeteer.launch().args 확장
 * @param {string} [options.waitUntil='networkidle0']
 * @param {number} [options.timeoutMs=60000]
 * @returns {Promise<Uint8Array>}               PDF 바이트
 */
export async function renderHwpxToPdf(buffer, options = {}) {
  if (!buffer) {
    throw new Error('renderHwpxToPdf: buffer 인자가 필요합니다.');
  }

  // 1) 파싱
  const doc = await parseHwpxHeadless(buffer, {
    password: options.password,
    fileName: options.fileName,
  });

  // 2) HTML 직렬화
  const baseHtml = exportHtml(doc, {
    inlineStyles: options.inlineStyles ?? false,
    embedImages: options.embedImages !== false, // 기본 true — PDF 는 self-contained
    pageBreaks: options.pageBreaks !== false,
    title: options.title || options.fileName || 'HWPX Document',
    lang: options.lang || 'ko',
  });

  // 3) 한글 폰트 주입
  const finalHtml = options.skipFontInjection
    ? baseHtml
    : injectKoreanFonts(baseHtml, options.customFontHtml || '');

  // 4) Puppeteer 로 PDF 변환
  return await renderHtmlToPdf(finalHtml, options);
}

/**
 * 이미 직렬화된 HTML 문자열을 PDF 로 렌더링한다 (저수준 API).
 * 외부에서 자체 HTML 을 만든 뒤 변환하고 싶을 때 사용.
 *
 * @param {string} html
 * @param {object} [options]  renderHwpxToPdf 와 동일한 puppeteer 옵션
 * @returns {Promise<Uint8Array>}
 */
export async function renderHtmlToPdf(html, options = {}) {
  if (typeof html !== 'string' || !html) {
    throw new Error('renderHtmlToPdf: html 문자열이 필요합니다.');
  }

  const puppeteer = options.browser ? null : await loadPuppeteer();

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--font-render-hinting=none',
    ...(options.launchArgs || []),
  ];

  let browser = options.browser;
  const ownBrowser = !browser;
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: launchArgs,
    });
  }

  try {
    const page = await browser.newPage();
    // 한국어 콘텐츠 — locale 힌트 (폰트 fallback 우선순위에 영향)
    try {
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });
    } catch {
      /* puppeteer 일부 버전에서 setExtraHTTPHeaders 가 불가하면 무시 */
    }

    const waitUntil = options.waitUntil || 'networkidle0';
    const timeout = options.timeoutMs ?? 60000;
    await page.setContent(html, { waitUntil, timeout });

    // 웹폰트 로딩 보장 — document.fonts.ready 가 있을 때만
    try {
      await page.evaluate(async () => {
        const f = /** @type {{ fonts?: { ready?: Promise<unknown> } }} */ (document).fonts;
        if (f && f.ready) await f.ready;
      });
    } catch {
      /* ignore */
    }

    const pdfOptions = {
      format: options.format || 'A4',
      printBackground: options.printBackground !== false,
      landscape: !!options.landscape,
      margin: options.margin || { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: !!options.displayHeaderFooter,
      preferCSSPageSize: !!options.preferCSSPageSize,
    };
    if (options.headerTemplate) pdfOptions.headerTemplate = options.headerTemplate;
    if (options.footerTemplate) pdfOptions.footerTemplate = options.footerTemplate;
    if (options.scale) pdfOptions.scale = options.scale;

    const pdf = await page.pdf(pdfOptions);
    await page.close();

    // page.pdf() 는 Buffer(Node) — Uint8Array 로 정규화
    if (pdf instanceof Uint8Array) return pdf;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(pdf)) {
      return new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength);
    }
    return new Uint8Array(pdf);
  } finally {
    if (ownBrowser && browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * 테스트/외부 사용자가 활용할 수 있도록 head 주입 헬퍼도 export.
 */
export { injectKoreanFonts };

export default renderHwpxToPdf;
