/**
 * Math Renderer
 * KaTeX 기반 수식 렌더링
 *
 * @module lib/math/renderer
 * @version 1.0.0
 */

let katexLoaded = false;
let katexModule: any = null;

async function ensureKaTeX(): Promise<any> {
  if (katexLoaded && katexModule) return katexModule;
  katexModule = await import('katex');
  katexLoaded = true;

  // KaTeX CSS 로드
  if (typeof document !== 'undefined' && !document.getElementById('katex-css')) {
    const link = document.createElement('link');
    link.id = 'katex-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    document.head.appendChild(link);
  }

  return katexModule;
}

/**
 * LaTeX 문자열을 HTML로 렌더링
 */
export async function renderMath(latex: string, displayMode: boolean = false): Promise<string> {
  const katex = await ensureKaTeX();
  try {
    return katex.default?.renderToString
      ? katex.default.renderToString(latex, { displayMode, throwOnError: false, output: 'html' })
      : katex.renderToString(latex, { displayMode, throwOnError: false, output: 'html' });
  } catch {
    return `<span class="math-error" style="color:#c00;font-style:italic;">${escapeHtml(latex)}</span>`;
  }
}

/**
 * 텍스트에서 수식 감지 및 렌더링
 * 지원 구문: $...$, $$...$$, \(...\), \[...\]
 */
export async function processTextWithMath(text: string): Promise<string> {
  // 수식 패턴이 없으면 바로 반환
  if (!text.match(/\$|\\\(|\\\[/)) return text;

  const katex = await ensureKaTeX();
  const render = (latex: string, display: boolean): string => {
    try {
      const fn = katex.default?.renderToString || katex.renderToString;
      return fn(latex, { displayMode: display, throwOnError: false, output: 'html' });
    } catch {
      return `<span class="math-error">${escapeHtml(latex)}</span>`;
    }
  };

  // 수식이 아닌 텍스트 부분은 HTML 이스케이프
  let result = escapeHtml(text);

  // $$...$$ (display mode) — 먼저 처리 ($ 단일 매칭 방지)
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => render(latex.trim(), true));

  // \[...\] (display mode)
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (_, latex) => render(latex.trim(), true));

  // $...$ (inline mode) — 단어 경계 사이만
  result = result.replace(/(?<![\\$])\$([^\$\n]+?)\$(?!\$)/g, (_, latex) => render(latex.trim(), false));

  // \(...\) (inline mode)
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (_, latex) => render(latex.trim(), false));

  return result;
}

/**
 * DOM 요소 내의 수식을 렌더링
 */
export async function renderMathInElement(element: HTMLElement): Promise<void> {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent && node.textContent.match(/\$|\\\(|\\\[/)) {
      textNodes.push(node);
    }
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    const rendered = await processTextWithMath(text);
    if (rendered !== text) {
      // KaTeX 출력은 신뢰할 수 있는 라이브러리 출력이므로 안전
      // 단, 사용자 입력 텍스트는 processTextWithMath 내부에서 escapeHtml 처리됨
      const template = document.createElement('template');
      template.innerHTML = rendered;
      const fragment = template.content;
      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  }
}

/**
 * 수식 포함 여부 감지
 */
export function containsMath(text: string): boolean {
  return /\$[^\$]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/.test(text);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default { renderMath, processTextWithMath, renderMathInElement, containsMath };
