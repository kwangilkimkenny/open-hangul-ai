/**
 * HTML Exporter (Headless)
 * -----------------------------------------------------------------------------
 * parseHwpxHeadless() 결과를 표준 HTML5 문서로 직렬화한다.
 * - 외부 의존성 0
 * - 어디서든 열림 (브라우저/이메일/Chromium-PDF 등)
 * - DOM 없이 순수 문자열 빌드 → Node 에서도 빠르게 동작
 *
 * 옵션:
 *  - inlineStyles  : CSS 를 <style> 가 아닌 각 요소 style="" 로 인라인
 *  - embedImages   : doc.images Map 에 있는 바이너리를 base64 로 인라인
 *  - pageBreaks    : 섹션 사이에 page-break div 삽입
 *  - title         : <title> 텍스트 (기본: "HWPX Document")
 *  - lang          : <html lang="..."> (기본: "ko")
 *
 * @module lib/headless/html-exporter
 */

import { escapeHtml, escapeAttr as _escapeAttrBase } from '../utils/html-escape.js';

// 줄바꿈을 공백으로 변환하는 속성값 escape (HTML 속성에 개행 들어가면 안 됨)
function escapeAttr(s) {
  return _escapeAttrBase(s).replace(/\n/g, ' ');
}

/**
 * 런(run) 의 style 객체를 inline CSS 문자열로 직렬화.
 * SimpleHWPXParser 의 char/paragraph style 키는 이미 CSS 와 호환된다
 * (예: fontSize, fontFamily, color, backgroundColor, textAlign…).
 */
// HWPX 파서가 style 객체에 함께 담는 비-CSS 메타 키 — HTML 출력에서 제외한다.
const NON_CSS_STYLE_KEYS = new Set([
  'id',
  'borderFillId',
  'widthPrecise',
  'heightPrecise',
  'widthRelTo',
  'heightRelTo',
  'isHeader',
  'hidden',
  'protect',
  'heightHWPU',
  'heightType',
  'fontSizePx', // CSS 의 font-size 와 중복
  'lineHeightPx', // CSS 의 line-height 와 중복
  'lineWrap',
  'textWrap',
  'widthPercent',
  'numPr',
  'styleRef',
]);

// 핫패스 — exportHtml 은 문서 단락마다 styleToCss 를 호출하므로 같은 style 객체에
// 대해 결과를 캐시한다. 키는 직렬화된 JSON (작고 빠름).
const _styleCssCache = new Map();
const KEBAB_RE = /[A-Z]/g;
const KEBAB_REPL = m => '-' + m.toLowerCase();

function styleToCss(style) {
  if (!style || typeof style !== 'object') return '';

  const cacheKey = JSON.stringify(style);
  const cached = _styleCssCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const parts = [];
  for (const [k, v] of Object.entries(style)) {
    if (v == null || v === '') continue;
    if (typeof v === 'object') continue; // outMargin/inMargin 등 객체는 skip
    if (typeof v === 'boolean') continue;
    if (NON_CSS_STYLE_KEYS.has(k)) continue;

    let val = v;
    if (typeof v === 'number' && /(width|height|margin|indent|padding|lineHeight)/i.test(k)) {
      val = v + 'px';
    }
    parts.push(`${k.replace(KEBAB_RE, KEBAB_REPL)}: ${escapeAttr(val)}`);
  }
  const result = parts.join('; ');
  _styleCssCache.set(cacheKey, result);
  return result;
}

/**
 * 이미지 바이너리를 data URI 로 변환.
 * doc.images Map: id -> { data: Uint8Array, mimeType: string }
 */
function imageToDataUri(imageEntry) {
  if (!imageEntry) return null;
  const data = imageEntry.data || imageEntry.bytes;
  const mime = imageEntry.mimeType || imageEntry.mime || 'image/png';
  if (!data) return null;
  // Node: Buffer; Browser: Uint8Array
  let b64;
  if (typeof Buffer !== 'undefined' && (Buffer.isBuffer(data) || data instanceof Uint8Array)) {
    b64 = Buffer.from(data).toString('base64');
  } else if (typeof btoa === 'function') {
    let bin = '';
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    b64 = btoa(bin);
  } else {
    return null;
  }
  return `data:${mime};base64,${b64}`;
}

function imageHtml(image, doc, options) {
  if (!image) return '';
  const alt = escapeAttr(image.alt || image.name || '');
  let src = '';
  if (options.embedImages && image.binDataIDRef && doc?.images instanceof Map) {
    const entry = doc.images.get(image.binDataIDRef) || doc.images.get(image.id);
    const uri = imageToDataUri(entry);
    if (uri) src = uri;
  }
  // src 가 비어있으면 자리표시자만 출력 (CLI 에서 누락 알림)
  const w = image.style?.width || (image.currentSize && image.currentSize.w);
  const h = image.style?.height || (image.currentSize && image.currentSize.h);
  const styleBits = [];
  if (w) styleBits.push(`width: ${typeof w === 'number' ? w + 'px' : w}`);
  if (h) styleBits.push(`height: ${typeof h === 'number' ? h + 'px' : h}`);
  const styleAttr = styleBits.length ? ` style="${styleBits.join('; ')}"` : '';
  if (src) {
    return `<img src="${src}" alt="${alt}"${styleAttr} />`;
  }
  return `<span class="hwpx-image-placeholder" data-ref="${escapeAttr(
    image.binDataIDRef || image.id || ''
  )}"${styleAttr}>[image]</span>`;
}

function runHtml(run, para, doc, options) {
  if (!run) return '';

  if (run.hasImage) {
    const img = para?.images?.[run.imageIndex];
    return imageHtml(img, doc, options);
  }
  if (run.hasShape) {
    // 도형은 PDF/렌더 트랙에서 처리. 헤드리스에서는 자리표시자만.
    return `<span class="hwpx-shape-placeholder">[shape]</span>`;
  }

  const text = typeof run.text === 'string' ? run.text : '';
  const safe = escapeHtml(text);

  // hyperlink
  if (run.hyperlink && run.hyperlink.url) {
    const url = escapeAttr(run.hyperlink.url);
    const inner = safe || escapeHtml(run.hyperlink.text || run.hyperlink.url);
    const css = styleToCss(run.style);
    const styleAttr = css ? ` style="${css}"` : '';
    return `<a href="${url}"${styleAttr}>${inner}</a>`;
  }

  // ruby
  if (run.type === 'ruby') {
    const base = escapeHtml(run.baseText || '');
    const top = escapeHtml(run.rubyText || '');
    return `<ruby>${base}<rt>${top}</rt></ruby>`;
  }

  // footnote/endnote
  if (run.type === 'footnote' || run.type === 'endnote') {
    return `<sup class="hwpx-${run.type}">${escapeHtml(run.text || '')}</sup>`;
  }

  // bookmark — 앵커
  if (run.type === 'bookmark') {
    return `<a id="${escapeAttr(run.name || '')}"></a>`;
  }

  if (!safe) return '';
  const css = styleToCss(run.style);
  if (css) {
    return `<span style="${css}">${safe}</span>`;
  }
  return safe;
}

function paragraphHtml(para, doc, options) {
  if (!para) return '';
  const inner = (para.runs || []).map(r => runHtml(r, para, doc, options)).join('');
  const css = styleToCss(para.style);
  const styleAttr = options.inlineStyles && css ? ` style="${css}"` : '';
  const classAttr = options.inlineStyles ? '' : ' class="hwpx-p"';
  // 빈 단락은 <br/> 로 시각적 공간 유지
  const body = inner || '<br/>';
  return `<p${classAttr}${styleAttr}>${body}</p>`;
}

function tableHtml(table, doc, options) {
  if (!table || !Array.isArray(table.rows)) return '';
  const rowsHtml = table.rows
    .map(row => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      const cellsHtml = cells
        .map(cell => {
          const tag = cell?.isHeader || row?.style?.isHeader ? 'th' : 'td';
          const attrs = [];
          if (cell?.colSpan && cell.colSpan > 1) attrs.push(`colspan="${cell.colSpan}"`);
          if (cell?.rowSpan && cell.rowSpan > 1) attrs.push(`rowspan="${cell.rowSpan}"`);
          const css = styleToCss(cell?.style);
          if (options.inlineStyles && css) attrs.push(`style="${css}"`);
          const inner = (cell?.elements || [])
            .map(el => {
              if (el?.type === 'paragraph') return paragraphHtml(el, doc, options);
              if (el?.type === 'table') return tableHtml(el, doc, options);
              return '';
            })
            .join('');
          return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${inner}</${tag}>`;
        })
        .join('');
      return `<tr>${cellsHtml}</tr>`;
    })
    .join('');
  const css = styleToCss(table.style);
  const styleAttr = options.inlineStyles && css ? ` style="${css}"` : '';
  return `<table class="hwpx-table"${styleAttr}>${rowsHtml}</table>`;
}

function sectionHtml(section, doc, options) {
  if (!section) return '';
  const elements = Array.isArray(section.elements) ? section.elements : [];
  const inner = elements
    .map(el => {
      if (!el) return '';
      if (el.type === 'paragraph') return paragraphHtml(el, doc, options);
      if (el.type === 'table') return tableHtml(el, doc, options);
      if (el.type === 'image') return imageHtml(el, doc, options);
      return '';
    })
    .join('\n');
  return `<section class="hwpx-section">\n${inner}\n</section>`;
}

const DEFAULT_CSS = `
.hwpx-document { font-family: "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif; line-height: 1.6; color: #222; max-width: 900px; margin: 0 auto; padding: 2em; }
.hwpx-section { margin-bottom: 2em; }
.hwpx-p { margin: 0 0 0.4em 0; }
.hwpx-table { border-collapse: collapse; margin: 1em 0; }
.hwpx-table td, .hwpx-table th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
.hwpx-table th { background: #f4f4f4; }
.hwpx-page-break { page-break-after: always; height: 0; margin: 0; }
.hwpx-image-placeholder, .hwpx-shape-placeholder { display: inline-block; padding: 2px 6px; background: #eee; color: #666; border: 1px dashed #aaa; font-size: 0.85em; }
.hwpx-footnote, .hwpx-endnote { color: #06c; }
`.trim();

/**
 * 문서 전체를 HTML5 문자열로 export.
 *
 * @param {object} doc          parseHwpxHeadless() 결과
 * @param {object} [options]
 * @param {boolean} [options.inlineStyles=false]
 * @param {boolean} [options.embedImages=false]
 * @param {boolean} [options.pageBreaks=true]
 * @param {string}  [options.title="HWPX Document"]
 * @param {string}  [options.lang="ko"]
 * @returns {string} 완전한 HTML5 문서
 */
export function exportHtml(doc, options = {}) {
  const opts = {
    inlineStyles: !!options.inlineStyles,
    embedImages: !!options.embedImages,
    pageBreaks: options.pageBreaks !== false,
    title: options.title || 'HWPX Document',
    lang: options.lang || 'ko',
  };

  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  const sep = opts.pageBreaks ? '\n<div class="hwpx-page-break"></div>\n' : '\n';
  const body = sections.map(s => sectionHtml(s, doc, opts)).join(sep);

  const styleBlock = opts.inlineStyles ? '' : `<style>${DEFAULT_CSS}</style>`;
  const bodyClass = opts.inlineStyles ? '' : ' class="hwpx-document"';

  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeAttr(opts.lang)}">`,
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    `<title>${escapeHtml(opts.title)}</title>`,
    '<meta name="generator" content="open-hangul-ai headless html-exporter" />',
    styleBlock,
    '</head>',
    `<body${bodyClass}>`,
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export default exportHtml;
