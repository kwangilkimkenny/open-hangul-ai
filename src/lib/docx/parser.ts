/**
 * DOCX Parser & Exporter
 * DOCX 파일을 편집기 문서 데이터(HWPXDocument)로 변환 및 내보내기
 *
 * 읽기: JSZip + Office Open XML 직접 파싱
 * 쓰기: docx 패키지
 *
 * @module lib/docx/parser
 * @version 1.1.0
 */

import {
  hwpxToDocxNumFormat,
  docxToHwpxNumFormat,
  previewNumberGlyph,
  normalizeKoreanFont,
  type HwpxNumFormatCode,
  type DocxNumFormatCode,
} from './korean-numbering';

// =============================================
// Types (HWPXDocument 호환)
// =============================================

interface Run {
  text: string;
  type?: string;
  inlineStyle?: Record<string, any>;
  style?: Record<string, any>;
}

interface CellData {
  elements: any[];
  colSpan?: number;
  rowSpan?: number;
  isCovered?: boolean;
  style?: Record<string, any>;
}

interface RowData {
  cells: CellData[];
  style?: Record<string, any>;
}

interface Element {
  type: string;
  runs?: Run[];
  rows?: RowData[];
  colWidths?: string[];
  colWidthsPercent?: string[];
  style?: Record<string, any>;
  src?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
  // 번호 매기기 (목록) — exporter 가 다시 DOCX numFmt 로 변환할 때 사용
  numbering?: {
    /** HWPX 호환 코드: GANADA, CHOSUNG, KOREAN_COUNTING, … */
    format: string;
    /** 0-based indent level */
    level: number;
    /** 표시용 텍스트 (예: "가.", "ㄱ)") — exporter 가 fallback 으로 prepend */
    text?: string;
  };
}

interface HeaderFooterContent {
  /** 머리말/꼬리말의 본문 elements — paragraph/table 등이 들어간다. */
  elements: Element[];
  /** raw XML (디버그/라운드트립 fidelity 보존용). */
  rawXml?: string;
}

interface Section {
  elements: Element[];
  pageSettings: Record<string, string>;
  pageWidth: number;
  pageHeight: number;
  /**
   * 머리말 분기:
   *   - default → `w:headerReference` (type 미지정 또는 'default') — 홀수 페이지에도 사용
   *   - even → `w:headerReference w:type="even"` — `<w:evenAndOddHeaders/>` 일 때만
   *   - firstPage → `w:headerReference w:type="first"` — `<w:titlePg/>` 일 때만
   * `odd` 는 backward-compat alias 로 `default` 와 동일하게 채워진다.
   */
  headers: {
    default: HeaderFooterContent | null;
    odd: HeaderFooterContent | null;
    even: HeaderFooterContent | null;
    firstPage: HeaderFooterContent | null;
    /** `<w:titlePg/>` 플래그 - 첫 페이지 별도 사용 여부 */
    titlePg?: boolean;
    /** `<w:evenAndOddHeaders/>` 플래그 - 짝/홀 분기 활성 여부 */
    evenAndOdd?: boolean;
  };
  footers: {
    default: HeaderFooterContent | null;
    odd: HeaderFooterContent | null;
    even: HeaderFooterContent | null;
    firstPage: HeaderFooterContent | null;
    titlePg?: boolean;
    evenAndOdd?: boolean;
  };
}

interface DocumentData {
  sections: Section[];
  images: Map<string, any>;
  borderFills: Map<string, any>;
  metadata: Record<string, any>;
}

// =============================================
// DOCX XML Namespaces
// =============================================

const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
};

// =============================================
// Parser Helpers
// =============================================

/**
 * XML에서 네임스페이스 접두사를 제거하고 로컬 이름으로 요소 찾기
 */
function getElements(parent: globalThis.Element, localName: string): globalThis.Element[] {
  const results: globalThis.Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (getLocalName(child) === localName) {
      results.push(child);
    }
  }
  return results;
}

function getElement(parent: globalThis.Element, localName: string): globalThis.Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (getLocalName(child) === localName) return child;
  }
  return null;
}

function getLocalName(el: globalThis.Element): string {
  return el.localName || el.nodeName.split(':').pop() || '';
}

function getAttr(el: globalThis.Element, name: string): string | null {
  // Try with namespace prefix variants
  return el.getAttribute(`w:${name}`) || el.getAttribute(name) || null;
}

/**
 * DOCX 색상 값을 CSS hex로 변환
 * 'auto' → undefined, '2B579A' → '#2B579A'
 */
function docxColorToHex(color: string | null): string | undefined {
  if (!color || color === 'auto') return undefined;
  return color.startsWith('#') ? color : `#${color}`;
}

/**
 * docx 라이브러리는 6자리 hex 만 허용 ('#' 없이).
 * '#666' → '666666', 'rgb(...)' → undefined 등 정규화.
 */
function toDocxHex(color: string | undefined | null): string | undefined {
  if (!color) return undefined;
  let v = String(color).trim();
  if (v.toLowerCase() === 'auto' || v.toLowerCase() === 'transparent') return undefined;
  if (v.startsWith('#')) v = v.slice(1);
  // rgb(r,g,b) / rgba(...) 처리
  const rgbMatch = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10));
    const g = Math.min(255, parseInt(rgbMatch[2], 10));
    const b = Math.min(255, parseInt(rgbMatch[3], 10));
    v = [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  // 3자리 hex → 6자리 확장 (#666 → 666666, #f0a → ff00aa)
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    v = v.split('').map(c => c + c).join('');
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
  return undefined;
}

/**
 * 포인트의 반(half-point)을 pt로 변환
 * DOCX font size는 half-points (24 = 12pt)
 */
function halfPointToPt(val: string | null): string | undefined {
  if (!val) return undefined;
  const hp = parseInt(val, 10);
  if (isNaN(hp)) return undefined;
  return `${hp / 2}pt`;
}

/**
 * Twips를 px로 변환 (1 inch = 1440 twips, 96 dpi → 1 twip = 96/1440 px)
 */
function twipsToPx(twips: number): number {
  return Math.round(twips * 96 / 1440);
}

/**
 * EMU(English Metric Units)를 px로 변환 (1 inch = 914400 EMU)
 */
function emuToPx(emu: number): number {
  return Math.round(emu / 914400 * 96);
}

/**
 * jsdom 환경에서는 `Blob.arrayBuffer` 가 누락된 경우가 있어 FileReader 로
 * 우회한다. 브라우저 + 일반 Node 환경에서는 native 메서드를 그대로 사용.
 */
async function safeBlobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const maybe = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof maybe.arrayBuffer === 'function') {
    return await maybe.arrayBuffer();
  }
  if (typeof FileReader !== 'undefined') {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as ArrayBuffer);
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(blob);
    });
  }
  throw new Error('Blob → ArrayBuffer 변환 불가');
}

// =============================================
// Numbering catalog (word/numbering.xml)
// =============================================

interface NumberingLevel {
  numFmt: DocxNumFormatCode;
  /** %1, %2 패턴이 포함된 표시 형식 — DOCX 의 `w:lvlText`. */
  lvlText: string;
  start: number;
}

interface NumberingEntry {
  /** abstractNumId — 같은 abstract 를 공유하는 num 들의 식별자. */
  abstractNumId: number;
  /** level index (0..8) → 형식 정의 */
  levels: Record<number, NumberingLevel>;
  /** 파싱 중 카운터 — 같은 num 의 누적 위치 (1-based). */
  counter: Record<number, number>;
}

type NumberingCatalog = Map<number, NumberingEntry>;

/**
 * `word/numbering.xml` 파싱 → `numId` → level → numFmt 카탈로그.
 *
 * 두 단계로 처리한다:
 *   1) `<w:abstractNum>` 의 level 정의 (numFmt, lvlText) 를 모은다.
 *   2) `<w:num>` 가 abstractNumId 를 참조하므로 둘을 결합.
 *
 * 한국어식 번호 (`ganada`, `chosung`, `koreanCounting`…) 도 그대로 보존된다.
 */
function parseNumberingXml(xml: string, parser: DOMParser): NumberingCatalog {
  const catalog: NumberingCatalog = new Map();
  let doc: Document;
  try {
    doc = parser.parseFromString(xml, 'application/xml');
  } catch {
    return catalog;
  }

  const abstractMap = new Map<number, Record<number, NumberingLevel>>();
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (getLocalName(el) === 'abstractNum') {
      const idStr = getAttr(el, 'abstractNumId');
      if (!idStr) continue;
      const id = parseInt(idStr, 10);
      const levels: Record<number, NumberingLevel> = {};
      for (let j = 0; j < el.children.length; j++) {
        const lvl = el.children[j];
        if (getLocalName(lvl) !== 'lvl') continue;
        const lvlIdx = parseInt(getAttr(lvl, 'ilvl') || '0', 10);
        const fmtEl = getElement(lvl, 'numFmt');
        const textEl = getElement(lvl, 'lvlText');
        const startEl = getElement(lvl, 'start');
        const numFmtRaw = fmtEl ? getAttr(fmtEl, 'val') : null;
        levels[lvlIdx] = {
          numFmt: (numFmtRaw as DocxNumFormatCode) || 'decimal',
          lvlText: textEl ? getAttr(textEl, 'val') || `%${lvlIdx + 1}.` : `%${lvlIdx + 1}.`,
          start: startEl ? parseInt(getAttr(startEl, 'val') || '1', 10) : 1,
        };
      }
      abstractMap.set(id, levels);
    }
  }

  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (getLocalName(el) === 'num') {
      const numIdStr = getAttr(el, 'numId');
      if (!numIdStr) continue;
      const numId = parseInt(numIdStr, 10);
      const absRef = getElement(el, 'abstractNumId');
      const absId = absRef ? parseInt(getAttr(absRef, 'val') || '-1', 10) : -1;
      if (absId < 0 || !abstractMap.has(absId)) continue;
      catalog.set(numId, {
        abstractNumId: absId,
        levels: abstractMap.get(absId)!,
        counter: {},
      });
    }
  }

  return catalog;
}

// =============================================
// Headers / Footers (first / even / default)
// =============================================

interface HeaderFooterParts {
  /** rels 의 Target → 파싱된 콘텐츠. */
  headers: Map<string, HeaderFooterContent>;
  footers: Map<string, HeaderFooterContent>;
}

interface JSZipFile {
  async(type: 'string'): Promise<string>;
}
interface JSZipLike {
  file(path: string): JSZipFile | null;
}

async function loadHeadersFooters(
  zip: JSZipLike,
  relsMap: Map<string, string>,
  styleMap: Map<string, Record<string, unknown>>,
  // images / cellElements 호환을 위해 unknown 유지 — 실제 dispatch 는 parseParagraph/parseTable
  images: Map<string, unknown>,
  parser: DOMParser,
): Promise<HeaderFooterParts> {
  const headers = new Map<string, HeaderFooterContent>();
  const footers = new Map<string, HeaderFooterContent>();

  for (const [, target] of relsMap) {
    const lower = target.toLowerCase();
    if (!/header\d*\.xml$|footer\d*\.xml$/.test(lower)) continue;
    const path = target.startsWith('/') ? target.substring(1) : `word/${target}`;
    const entry = zip.file(path);
    if (!entry) continue;
    let raw: string;
    try {
      raw = await entry.async('string');
    } catch {
      continue;
    }
    let dom: Document;
    try {
      dom = parser.parseFromString(raw, 'application/xml');
    } catch {
      continue;
    }
    const root = dom.documentElement;
    if (!root) continue;
    const els: Element[] = [];
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      const lname = getLocalName(child);
      if (lname === 'p') {
        els.push(...parseParagraph(child, styleMap, images, relsMap));
      } else if (lname === 'tbl') {
        const tbl = parseTable(child, styleMap, images, relsMap);
        if (tbl) els.push(tbl);
      }
    }
    const content: HeaderFooterContent = { elements: els, rawXml: raw };
    if (/header/.test(lower)) headers.set(target, content);
    else footers.set(target, content);
  }

  return { headers, footers };
}

/**
 * `<w:sectPr>` 에서 머리말/꼬리말 참조와 titlePg / evenAndOddHeaders 를 해석한다.
 *
 * - `<w:titlePg/>` → firstPage 분기 활성
 * - `<w:evenAndOddHeaders/>` (settings.xml 또는 sectPr) → even 분기 활성
 * - `<w:headerReference w:type="first|even|default" r:id="rIdX"/>`
 */
function resolveSectionHeadersFooters(
  sectPr: globalThis.Element | undefined,
  hfMap: HeaderFooterParts,
  relsMap: Map<string, string>,
): { headers: Section['headers']; footers: Section['footers'] } {
  const headers: Section['headers'] = {
    default: null, odd: null, even: null, firstPage: null,
    titlePg: false, evenAndOdd: false,
  };
  const footers: Section['footers'] = {
    default: null, odd: null, even: null, firstPage: null,
    titlePg: false, evenAndOdd: false,
  };
  if (!sectPr) return { headers, footers };

  const titlePg = getElement(sectPr, 'titlePg');
  if (titlePg) {
    headers.titlePg = true;
    footers.titlePg = true;
  }

  const pickContent = (
    map: Map<string, HeaderFooterContent>,
    rId: string | null,
  ): HeaderFooterContent | null => {
    if (!rId) return null;
    const target = relsMap.get(rId);
    if (!target) return null;
    return map.get(target) ?? null;
  };

  for (let i = 0; i < sectPr.children.length; i++) {
    const child = sectPr.children[i];
    const lname = getLocalName(child);
    if (lname === 'headerReference' || lname === 'footerReference') {
      const type = (getAttr(child, 'type') || 'default').toLowerCase();
      const rId = child.getAttribute('r:id') || child.getAttributeNS(NS.r, 'id');
      const target = lname === 'headerReference' ? headers : footers;
      const map = lname === 'headerReference' ? hfMap.headers : hfMap.footers;
      const content = pickContent(map, rId);
      if (!content) continue;
      if (type === 'first') target.firstPage = content;
      else if (type === 'even') {
        target.even = content;
        target.evenAndOdd = true;
      } else {
        // default — 홀수 페이지 (또는 모든 페이지) 와 동일
        target.default = content;
        target.odd = content;
      }
    }
  }

  return { headers, footers };
}

// =============================================
// DOCX Parser (읽기)
// =============================================

/**
 * DOCX 파일을 HWPXDocument로 변환
 */
export async function parseDocx(buffer: ArrayBuffer, fileName: string): Promise<DocumentData> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  // 1. document.xml 로드
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('유효한 DOCX 파일이 아닙니다 (document.xml 없음)');

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'application/xml');

  // 2. relationships 로드 (이미지 참조용)
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
  const _relsMap = new Map<string, string>(); // Currently unused
  if (relsXml) {
    const relDoc = parser.parseFromString(relsXml, 'application/xml');
    const rels = relDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < rels.length; i++) {
      const id = rels[i].getAttribute('Id');
      const target = rels[i].getAttribute('Target');
      if (id && target) _relsMap.set(id, target);
    }
  }

  // 3. 이미지 추출
  const images = new Map<string, any>();
  for (const [relId, target] of _relsMap) {
    if (target.match(/\.(png|jpg|jpeg|gif|bmp|svg|tiff|emf|wmf)$/i)) {
      const imgPath = target.startsWith('/') ? target.substring(1) : `word/${target}`;
      const imgFile = zip.file(imgPath);
      if (imgFile) {
        try {
          const imgBlob = await imgFile.async('blob');
          const ext = target.split('.').pop()?.toLowerCase() || 'png';
          const mimeMap: Record<string, string> = {
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
          };
          const objectUrl = URL.createObjectURL(new Blob([imgBlob], { type: mimeMap[ext] || 'image/png' }));
          images.set(relId, { src: objectUrl, path: target, data: imgBlob });
        } catch {
          // 이미지 로드 실패 무시
        }
      }
    }
  }

  // 4. styles.xml 로드 (스타일 정의)
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  const styleMap = new Map<string, Record<string, any>>();
  if (stylesXml) {
    const stylesDoc = parser.parseFromString(stylesXml, 'application/xml');
    const styles = stylesDoc.getElementsByTagName('*');
    for (let i = 0; i < styles.length; i++) {
      if (getLocalName(styles[i]) === 'style') {
        const styleId = getAttr(styles[i], 'styleId');
        if (styleId) {
          const rPr = getElement(styles[i], 'rPr');
          if (rPr) {
            styleMap.set(styleId, parseRunProperties(rPr));
          }
        }
      }
    }
  }

  // 4b. numbering.xml — 한국어식 번호 (가/나/다, ㄱ/ㄴ/ㄷ, 一/二/三) 추출
  //     w:num/w:abstractNumId 체인을 따라 level → numFmt 로 매핑한다.
  const numberingXml = await zip.file('word/numbering.xml')?.async('string');
  const numCatalog = numberingXml ? parseNumberingXml(numberingXml, parser) : new Map();

  // 4c. headers/footers — first/even/default 분기 매핑
  const hfMap = await loadHeadersFooters(zip, _relsMap, styleMap, images, parser);

  // 5. body 파싱
  const body = doc.getElementsByTagName('w:body')[0] || doc.getElementsByTagNameNS(NS.w, 'body')[0];
  if (!body) throw new Error('DOCX body를 찾을 수 없습니다');

  const elements: Element[] = [];

  for (let i = 0; i < body.children.length; i++) {
    const node = body.children[i];
    const name = getLocalName(node);

    if (name === 'p') {
      const paras = parseParagraph(node, styleMap, images, _relsMap, numCatalog);
      elements.push(...paras);
    } else if (name === 'tbl') {
      const table = parseTable(node, styleMap, images, _relsMap, numCatalog);
      if (table) elements.push(table);
    } else if (name === 'sectPr') {
      // 섹션 속성 — 페이지 설정용 (마지막에 처리)
    }
  }

  // 6. 페이지 설정 + 머리말/꼬리말 분기 추출
  const sectPr = body.getElementsByTagName('w:sectPr')[0] || body.getElementsByTagNameNS(NS.w, 'sectPr')[0];
  const pageSettings = parsePageSettings(sectPr);
  const { headers, footers } = resolveSectionHeadersFooters(sectPr, hfMap, _relsMap);

  return {
    sections: [{
      elements,
      pageSettings: pageSettings.css,
      pageWidth: pageSettings.widthPx,
      pageHeight: pageSettings.heightPx,
      headers,
      footers,
    }],
    images,
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: 1,
      imagesCount: images.size,
      borderFillsCount: 0,
      sourceFormat: 'docx',
      fileName,
    },
    cleanup: () => {
      for (const [, img] of images) {
        if (img?.src) URL.revokeObjectURL(img.src);
      }
      images.clear();
    },
  } as any;
}

/**
 * Run 속성(rPr) 파싱
 */
function parseRunProperties(rPr: globalThis.Element): Record<string, any> {
  const style: Record<string, any> = {};

  const bold = getElement(rPr, 'b');
  if (bold && getAttr(bold, 'val') !== '0') style.bold = true;

  const italic = getElement(rPr, 'i');
  if (italic && getAttr(italic, 'val') !== '0') style.italic = true;

  const underline = getElement(rPr, 'u');
  if (underline && getAttr(underline, 'val') !== 'none') style.underline = true;

  const strike = getElement(rPr, 'strike');
  if (strike && getAttr(strike, 'val') !== '0') style.strikethrough = true;

  const sz = getElement(rPr, 'sz');
  if (sz) {
    const ptStr = halfPointToPt(getAttr(sz, 'val'));
    if (ptStr) style.fontSize = ptStr;
  }

  const color = getElement(rPr, 'color');
  if (color) {
    const hex = docxColorToHex(getAttr(color, 'val'));
    if (hex) style.color = hex;
  }

  const rFonts = getElement(rPr, 'rFonts');
  if (rFonts) {
    // 한국어 우선 — eastAsia 가 있으면 우선 사용 (함초롬바탕 등)
    const eastAsia = getAttr(rFonts, 'eastAsia');
    const ascii = getAttr(rFonts, 'ascii');
    const hAnsi = getAttr(rFonts, 'hAnsi');
    const cs = getAttr(rFonts, 'cs');
    if (eastAsia) {
      style.fontFamily = normalizeKoreanFont(eastAsia);
      style.fontFamilyAscii = ascii || hAnsi || undefined;
      style.fontFamilyEastAsia = eastAsia;
    } else if (ascii || hAnsi || cs) {
      const picked = ascii || hAnsi || cs || '';
      style.fontFamily = normalizeKoreanFont(picked);
    }
  }

  const highlight = getElement(rPr, 'highlight');
  if (highlight) {
    const hlColor = getAttr(highlight, 'val');
    if (hlColor && hlColor !== 'none') {
      const hlMap: Record<string, string> = {
        yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF',
        magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000',
        darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000',
        darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000',
        darkGray: '#808080', lightGray: '#C0C0C0', black: '#000000',
      };
      style.backgroundColor = hlMap[hlColor] || '#FFFF00';
    }
  }

  const shd = getElement(rPr, 'shd');
  if (shd) {
    const fill = getAttr(shd, 'fill');
    const hex = docxColorToHex(fill);
    if (hex) style.backgroundColor = hex;
  }

  const vertAlign = getElement(rPr, 'vertAlign');
  if (vertAlign) {
    const val = getAttr(vertAlign, 'val');
    if (val === 'superscript') style.verticalAlign = 'super';
    if (val === 'subscript') style.verticalAlign = 'sub';
  }

  return style;
}

/**
 * 문단(w:p) 파싱
 */
function parseParagraph(
  pNode: globalThis.Element,
  styleMap: Map<string, Record<string, any>>,
  images: Map<string, any>,
  _relsMap: Map<string, string>,
  numCatalog?: NumberingCatalog,
): Element[] {
  const runs: Run[] = [];
  const resultElements: Element[] = [];
  const paraStyle: Record<string, any> = {};

  // 문단 속성
  const pPr = getElement(pNode, 'pPr');
  if (pPr) {
    // 정렬
    const jc = getElement(pPr, 'jc');
    if (jc) {
      const val = getAttr(jc, 'val');
      const alignMap: Record<string, string> = {
        left: 'left', center: 'center', right: 'right',
        both: 'justify', distribute: 'justify',
      };
      if (val && alignMap[val]) paraStyle.textAlign = alignMap[val];
    }

    // 들여쓰기
    const ind = getElement(pPr, 'ind');
    if (ind) {
      const left = getAttr(ind, 'left');
      if (left) paraStyle.paddingLeft = `${twipsToPx(parseInt(left, 10))}px`;
      const firstLine = getAttr(ind, 'firstLine');
      if (firstLine) paraStyle.textIndent = `${twipsToPx(parseInt(firstLine, 10))}px`;
    }

    // 줄간격
    const spacing = getElement(pPr, 'spacing');
    if (spacing) {
      const before = getAttr(spacing, 'before');
      if (before) paraStyle.marginTop = `${twipsToPx(parseInt(before, 10))}px`;
      const after = getAttr(spacing, 'after');
      if (after) paraStyle.marginBottom = `${twipsToPx(parseInt(after, 10))}px`;
    }

    // 스타일 참조 (제목 등)
    const pStyle = getElement(pPr, 'pStyle');
    if (pStyle) {
      const styleId = getAttr(pStyle, 'val');
      if (styleId) {
        // 제목 스타일 감지
        const headingMatch = styleId.match(/^Heading(\d)$/i) || styleId.match(/^(\d)$/);
        if (headingMatch) {
          const level = Math.min(Math.max(parseInt(headingMatch[1], 10), 1), 6);
          const sizeMap: Record<number, string> = { 1: '24pt', 2: '20pt', 3: '16pt', 4: '14pt', 5: '12pt', 6: '11pt' };
          paraStyle._headingSize = sizeMap[level];
        }
        // 스타일맵에서 기본 run 스타일 가져오기
        if (styleMap.has(styleId)) {
          paraStyle._baseRunStyle = styleMap.get(styleId);
        }
      }
    }

    // 번호 매기기 (목록) — numbering.xml 카탈로그가 있으면 한국어식 번호 매핑
    const numPr = getElement(pPr, 'numPr');
    if (numPr) {
      const ilvl = getElement(numPr, 'ilvl');
      const numIdEl = getElement(numPr, 'numId');
      const level = ilvl ? parseInt(getAttr(ilvl, 'val') || '0', 10) : 0;
      const numIdStr = numIdEl ? getAttr(numIdEl, 'val') : null;

      let format: HwpxNumFormatCode = 'BULLET';
      let glyphText = '';

      if (numCatalog && numIdStr) {
        const numId = parseInt(numIdStr, 10);
        const numEntry = numCatalog.get(numId);
        if (numEntry) {
          const lvl = numEntry.levels[level] || numEntry.levels[0];
          if (lvl) {
            format = docxToHwpxNumFormat(lvl.numFmt);
            // numEntry.counter 가 nth 위치(1-based) 추적용
            const idx = (numEntry.counter[level] ?? 0) + 1;
            numEntry.counter[level] = idx;
            // 상위 레벨이 증가하면 하위 카운터 리셋
            for (const k of Object.keys(numEntry.counter)) {
              const klvl = parseInt(k, 10);
              if (klvl > level) delete numEntry.counter[klvl];
            }
            const glyph = previewNumberGlyph(format, idx);
            glyphText = (lvl.lvlText || '%' + (level + 1) + '.')
              .replace(/%(\d+)/g, (_m, n) => (parseInt(n, 10) === level + 1 ? glyph : glyph));
          }
        }
      }

      if (!glyphText) {
        const bullets = ['●', '○', '■', '▪'];
        glyphText = (bullets[Math.min(level, bullets.length - 1)] ?? '•') + ' ';
      } else if (!glyphText.endsWith(' ')) {
        glyphText += ' ';
      }

      runs.push({ text: glyphText, inlineStyle: { color: '#333' } });
      if (!paraStyle.paddingLeft) {
        paraStyle.paddingLeft = `${20 + level * 20}px`;
      }

      // exporter 가 다시 numFmt 로 살릴 수 있게 메타데이터를 paragraph 에 보존
      paraStyle._numbering = { format, level, text: glyphText.trimEnd() };
    }
  }

  // Runs 파싱
  for (let i = 0; i < pNode.children.length; i++) {
    const child = pNode.children[i];
    const name = getLocalName(child);

    if (name === 'r') {
      // 이미지 확인
      const drawing = getElement(child, 'drawing');
      if (drawing) {
        const imgEl = parseDrawing(drawing, images, _relsMap);
        if (imgEl) {
          // 현재까지 누적된 runs가 있으면 paragraph로 먼저 push
          if (runs.length > 0) {
            resultElements.push({
              type: 'paragraph',
              runs: [...runs],
              style: Object.keys(paraStyle).length > 0 ? { ...paraStyle } : undefined,
            });
            runs.length = 0;
          }
          // 이미지 요소 push
          resultElements.push(imgEl);
        }
        continue;
      }

      // 텍스트 run
      const rPr = getElement(child, 'rPr');
      let runStyle: Record<string, any> = {};

      // 기본 스타일 적용
      if (paraStyle._baseRunStyle) {
        runStyle = { ...paraStyle._baseRunStyle };
      }

      // run 속성
      if (rPr) {
        const parsed = parseRunProperties(rPr);
        runStyle = { ...runStyle, ...parsed };
      }

      // 제목 스타일
      if (paraStyle._headingSize) {
        runStyle.bold = true;
        if (!runStyle.fontSize) runStyle.fontSize = paraStyle._headingSize;
      }

      // 텍스트, 탭, 줄바꿈 추출
      for (let j = 0; j < child.children.length; j++) {
        const rc = child.children[j];
        const rcName = getLocalName(rc);
        if (rcName === 't') {
          const text = rc.textContent || '';
          runs.push({ text, inlineStyle: Object.keys(runStyle).length > 0 ? runStyle : undefined });
        } else if (rcName === 'tab') {
          runs.push({ text: '\t', type: 'tab' });
        } else if (rcName === 'br') {
          runs.push({ text: '', type: 'linebreak' });
        }
      }
    } else if (name === 'hyperlink') {
      // 하이퍼링크
      for (let j = 0; j < child.children.length; j++) {
        const r = child.children[j];
        if (getLocalName(r) === 'r') {
          for (let k = 0; k < r.children.length; k++) {
            if (getLocalName(r.children[k]) === 't') {
              runs.push({
                text: r.children[k].textContent || '',
                inlineStyle: { color: '#2b579a', underline: true },
              });
            }
          }
        }
      }
    }
  }

  // _headingSize, _baseRunStyle, _numbering 제거 (내부용은 element 로 옮긴다)
  delete paraStyle._headingSize;
  delete paraStyle._baseRunStyle;
  const numberingMeta = paraStyle._numbering as Element['numbering'] | undefined;
  delete paraStyle._numbering;

  // 남은 runs가 있거나 이미지만 있는 경우에도 paragraph 추가
  if (runs.length > 0 || resultElements.length === 0) {
    if (runs.length === 0) {
      runs.push({ text: '' });
    }
    const para: Element = {
      type: 'paragraph',
      runs,
      style: Object.keys(paraStyle).length > 0 ? paraStyle : undefined,
    };
    if (numberingMeta) para.numbering = numberingMeta;
    resultElements.push(para);
  }

  return resultElements;
}

/**
 * 이미지(drawing) 파싱
 */
function parseDrawing(
  drawing: globalThis.Element,
  images: Map<string, any>,
  _relsMap: Map<string, string>,
): Element | null {
  // inline 또는 anchor 안의 blip 찾기
  const allElements = drawing.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    if (getLocalName(allElements[i]) === 'blip') {
      const embed = allElements[i].getAttribute('r:embed') ||
                    allElements[i].getAttributeNS(NS.r, 'embed');
      if (embed && images.has(embed)) {
        const imgInfo = images.get(embed);
        // 크기 추출
        let widthPx = 200, heightPx = 150;
        for (let j = 0; j < allElements.length; j++) {
          if (getLocalName(allElements[j]) === 'extent') {
            const cx = allElements[j].getAttribute('cx');
            const cy = allElements[j].getAttribute('cy');
            if (cx) widthPx = emuToPx(parseInt(cx, 10));
            if (cy) heightPx = emuToPx(parseInt(cy, 10));
            break;
          }
        }
        return {
          type: 'image',
          src: imgInfo.src,
          width: widthPx,
          height: heightPx,
          alt: '이미지',
        };
      }
    }
  }
  return null;
}

/**
 * 테이블(w:tbl) 파싱
 */
function parseTable(
  tblNode: globalThis.Element,
  styleMap: Map<string, Record<string, any>>,
  images: Map<string, any>,
  _relsMap: Map<string, string>,
  numCatalog?: NumberingCatalog,
): Element {
  const rows: RowData[] = [];
  const tblRows = getElements(tblNode, 'tr');

  // 열 너비 수집
  const tblGrid = getElement(tblNode, 'tblGrid');
  const colWidthsPx: number[] = [];
  if (tblGrid) {
    const gridCols = getElements(tblGrid, 'gridCol');
    for (const gc of gridCols) {
      const w = getAttr(gc, 'w');
      if (w) colWidthsPx.push(twipsToPx(parseInt(w, 10)));
      else colWidthsPx.push(100);
    }
  }

  const totalWidth = colWidthsPx.reduce((a, b) => a + b, 0) || 1;
  const colWidthsPercent = colWidthsPx.map(px => `${(px / totalWidth * 100).toFixed(2)}%`);

  for (const tr of tblRows) {
    const cells: CellData[] = [];
    const tcs = getElements(tr, 'tc');

    for (const tc of tcs) {
      const cellStyle: Record<string, any> = {};

      // 셀 속성
      const tcPr = getElement(tc, 'tcPr');
      let colSpan = 1;
      // let rowSpan: number | undefined; // Currently unused
      let isCovered = false;

      if (tcPr) {
        // 열 병합
        const gridSpan = getElement(tcPr, 'gridSpan');
        if (gridSpan) {
          const val = getAttr(gridSpan, 'val');
          if (val) colSpan = parseInt(val, 10);
        }

        // 행 병합
        const vMerge = getElement(tcPr, 'vMerge');
        if (vMerge) {
          const val = getAttr(vMerge, 'val');
          if (val === 'restart') {
            // 병합 시작 — rowSpan은 나중에 계산
            // rowSpan = undefined; // 마크만 (currently unused)
          } else {
            // 병합 계속 (val 없음 또는 'continue')
            isCovered = true;
          }
        }

        // 배경색
        const shd = getElement(tcPr, 'shd');
        if (shd) {
          const fill = getAttr(shd, 'fill');
          const hex = docxColorToHex(fill);
          if (hex) cellStyle.backgroundColor = hex;
        }

        // 정렬
        const vAlign = getElement(tcPr, 'vAlign');
        if (vAlign) {
          const val = getAttr(vAlign, 'val');
          if (val) {
            const vMap: Record<string, string> = { top: 'top', center: 'middle', bottom: 'bottom' };
            cellStyle.verticalAlign = vMap[val] || 'top';
          }
        }

        // 테두리
        const tcBorders = getElement(tcPr, 'tcBorders');
        if (tcBorders) {
          for (const side of ['top', 'bottom', 'left', 'right'] as const) {
            const border = getElement(tcBorders, side);
            if (border) {
              const css = docxBorderToCSS(border);
              if (css) {
                const key = `border${side.charAt(0).toUpperCase() + side.slice(1)}Def`;
                cellStyle[key] = css;
              }
            }
          }
        }
      }

      if (isCovered) continue; // 병합 계속 셀 스킵

      // 셀 내용 파싱 — 중첩 표(w:tbl)도 정확하게 추출
      const cellElements: any[] = [];
      for (let i = 0; i < tc.children.length; i++) {
        const child = tc.children[i];
        const cName = getLocalName(child);
        if (cName === 'p') {
          cellElements.push(...parseParagraph(child, styleMap, images, _relsMap, numCatalog));
        } else if (cName === 'tbl') {
          const nestedTable = parseTable(child, styleMap, images, _relsMap, numCatalog);
          if (nestedTable) cellElements.push(nestedTable);
        }
      }

      cellStyle.padding = '4px 6px';

      const cellData: CellData = {
        elements: cellElements.length > 0 ? cellElements : [{ type: 'paragraph', runs: [{ text: '' }] }],
        style: cellStyle,
      };

      if (colSpan > 1) cellData.colSpan = colSpan;

      cells.push(cellData);
    }

    rows.push({ cells });
  }

  // 행 병합(vMerge) rowSpan 계산
  computeRowSpans(rows, tblRows);

  return {
    type: 'table',
    rows,
    colWidthsPercent: colWidthsPercent.length > 0 ? colWidthsPercent : undefined,
    style: { width: '100%' },
  };
}

/**
 * vMerge의 rowSpan 계산
 * DOCX는 vMerge restart/continue 패턴을 사용:
 *   - `<w:vMerge w:val="restart"/>` 가 병합 시작
 *   - `<w:vMerge/>` 또는 `<w:vMerge w:val="continue"/>` 가 이어짐
 *   - vMerge 없음 = 병합 없음 (또는 종료)
 *
 * 각 열 위치(grid column index)별로 끊김 없이 이어지는 vMerge 체인을
 * 추적하여 시작 셀의 rowSpan 을 설정한다. `gridSpan` 으로 가로 병합된
 * 셀은 시작 grid col 만 매치한다.
 */
function computeRowSpans(rows: RowData[], tblRows: globalThis.Element[]): void {
  // 가장 넓은 행의 cell 수 (colSpan 포함) 를 사용해 grid column 개수 산출.
  const colCount = Math.max(...rows.map(r => {
    let count = 0;
    r.cells.forEach(c => count += (c.colSpan || 1));
    return count;
  }), 0);

  for (let col = 0; col < colCount; col++) {
    let mergeStart = -1;
    for (let rowIdx = 0; rowIdx < tblRows.length; rowIdx++) {
      const tr = tblRows[rowIdx];
      const tcs = getElements(tr, 'tc');

      let currentCol = 0;
      let matched = false;
      for (const tc of tcs) {
        const tcPr = getElement(tc, 'tcPr');
        const gridSpan = tcPr ? getElement(tcPr, 'gridSpan') : null;
        const span = gridSpan ? parseInt(getAttr(gridSpan, 'val') || '1', 10) : 1;

        if (currentCol === col) {
          matched = true;
          const vMerge = tcPr ? getElement(tcPr, 'vMerge') : null;
          const vVal = vMerge ? getAttr(vMerge, 'val') : null;
          if (vMerge && vVal === 'restart') {
            // 이전 체인이 남아있으면 종결 (보통 없음, 안전장치)
            if (mergeStart >= 0 && rowIdx > mergeStart) {
              setRowSpanForCell(rows, mergeStart, col, rowIdx - mergeStart);
            }
            mergeStart = rowIdx;
          } else if (vMerge && (vVal === null || vVal === 'continue')) {
            // 체인 유지 — 시작 셀의 rowSpan 은 마지막에 한 번에 설정
          } else {
            // vMerge 없음 — 진행 중이던 체인이 있었다면 종결
            if (mergeStart >= 0 && rowIdx > mergeStart) {
              setRowSpanForCell(rows, mergeStart, col, rowIdx - mergeStart);
            }
            mergeStart = -1;
          }
          break;
        }
        currentCol += span;
      }
      // 이 행에 해당 col 자리에 셀이 없으면(앞 행의 vMerge로 덮인 위치) 무시
      void matched;
    }
    // 마지막 행까지 병합이 이어진 경우
    if (mergeStart >= 0) {
      setRowSpanForCell(rows, mergeStart, col, tblRows.length - mergeStart);
    }
  }
}

function setRowSpanForCell(rows: RowData[], rowIdx: number, targetCol: number, rowSpan: number): void {
  if (rowIdx >= rows.length || rowSpan <= 1) return;
  const row = rows[rowIdx];
  let col = 0;
  for (const cell of row.cells) {
    if (col === targetCol) {
      cell.rowSpan = rowSpan;
      return;
    }
    col += (cell.colSpan || 1);
  }
}

/**
 * DOCX 테두리를 CSS def로 변환
 */
function docxBorderToCSS(border: globalThis.Element): { css: string; visible: boolean } | undefined {
  const val = getAttr(border, 'val');
  if (!val || val === 'none' || val === 'nil') return undefined;

  const sz = getAttr(border, 'sz');
  const color = docxColorToHex(getAttr(border, 'color')) || '#000000';

  // sz는 1/8 포인트 단위
  const eighths = parseInt(sz || '4', 10);
  const px = Math.max(1, Math.round(eighths / 8));

  let style = 'solid';
  if (val === 'dotted' || val === 'dotDash') style = 'dotted';
  else if (val === 'dashed' || val === 'dashSmallGap') style = 'dashed';
  else if (val === 'double') style = 'double';

  return { css: `${px}px ${style} ${color}`, visible: true };
}

/**
 * 섹션 속성에서 페이지 설정 추출
 */
function parsePageSettings(sectPr: globalThis.Element | undefined): {
  css: Record<string, string>;
  widthPx: number;
  heightPx: number;
} {
  const defaults = {
    css: {
      width: '794px', height: '1123px',
      marginLeft: '85px', marginRight: '85px',
      marginTop: '71px', marginBottom: '57px',
    },
    widthPx: 794,
    heightPx: 1123,
  };

  if (!sectPr) return defaults;

  const pgSz = getElement(sectPr, 'pgSz');
  const pgMar = getElement(sectPr, 'pgMar');

  let widthPx = 794, heightPx = 1123;
  if (pgSz) {
    const w = getAttr(pgSz, 'w');
    const h = getAttr(pgSz, 'h');
    if (w) widthPx = twipsToPx(parseInt(w, 10));
    if (h) heightPx = twipsToPx(parseInt(h, 10));
  }

  let ml = 85, mr = 85, mt = 71, mb = 57;
  if (pgMar) {
    const left = getAttr(pgMar, 'left');
    const right = getAttr(pgMar, 'right');
    const top = getAttr(pgMar, 'top');
    const bottom = getAttr(pgMar, 'bottom');
    if (left) ml = twipsToPx(parseInt(left, 10));
    if (right) mr = twipsToPx(parseInt(right, 10));
    if (top) mt = twipsToPx(parseInt(top, 10));
    if (bottom) mb = twipsToPx(parseInt(bottom, 10));
  }

  return {
    css: {
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      marginLeft: `${ml}px`,
      marginRight: `${mr}px`,
      marginTop: `${mt}px`,
      marginBottom: `${mb}px`,
    },
    widthPx,
    heightPx,
  };
}

// =============================================
// DOCX Exporter (쓰기)
// =============================================

/**
 * HWPXDocument를 DOCX Blob으로 내보내기
 *
 * v1.1: 한국어식 번호(ganada/chosung/koreanCounting…), titlePg/evenAndOdd
 * 머리말/꼬리말 분기, 함초롬바탕 등 한글 폰트의 eastAsia 매핑 지원.
 */
export async function exportToDocx(doc: DocumentData): Promise<Blob> {
  const docxLib = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, HeadingLevel,
    VerticalAlign, ShadingType, PageOrientation, Header, Footer,
    LevelFormat, AlignmentType: _AlignType,
  } = docxLib as unknown as Record<string, unknown> & {
    Document: new (opts: Record<string, unknown>) => unknown;
    Packer: { toBlob: (doc: unknown) => Promise<Blob> };
    LevelFormat: Record<string, string>;
    PageOrientation: { LANDSCAPE: string; PORTRAIT: string };
  };
  void _AlignType;

  // 1) 문서를 한 번 훑어 사용된 한국어식 번호 포맷 → numbering config 생성
  const numberingConfig = collectNumberingConfig(doc, LevelFormat);

  const children: unknown[] = [];

  for (const section of doc.sections) {
    for (const el of section.elements) {
      if (el.type === 'paragraph' && el.runs) {
        children.push(buildDocxParagraph(el, { Paragraph, TextRun, AlignmentType, HeadingLevel }));
      } else if (el.type === 'table' && el.rows) {
        const table = buildDocxTable(el, {
          Table, TableRow, TableCell, Paragraph, TextRun,
          WidthType, AlignmentType, BorderStyle, VerticalAlign, ShadingType,
        });
        if (table) children.push(table);
      } else if (el.type === 'image' && el.src) {
        const imgPara = await buildDocxImage(el, doc.images, { Paragraph, ImageRun, TextRun });
        children.push(imgPara);
      }
    }
  }

  // 페이지 설정 추출
  const firstSection = doc.sections[0];
  const pageWidth = firstSection?.pageWidth || 794;
  const pageHeight = firstSection?.pageHeight || 1123;
  const ps = firstSection?.pageSettings || {};

  const pxToTwip = (px: number) => Math.round(px * 1440 / 96);
  const parsePx = (s: string | undefined) => parseInt(s || '0', 10);

  // 머리말/꼬리말 (default / first / even)
  const headersOpt = buildDocxHeadersFooters(
    firstSection?.headers,
    { Paragraph, TextRun, Header, Footer, AlignmentType, HeadingLevel, ShadingType },
    'header',
  );
  const footersOpt = buildDocxHeadersFooters(
    firstSection?.footers,
    { Paragraph, TextRun, Header, Footer, AlignmentType, HeadingLevel, ShadingType },
    'footer',
  );

  const sectionProps: Record<string, unknown> = {
    children,
    properties: {
      page: {
        size: {
          width: pxToTwip(pageWidth),
          height: pxToTwip(pageHeight),
          orientation: pageWidth > pageHeight ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
        margin: {
          top: pxToTwip(parsePx(ps.marginTop)),
          right: pxToTwip(parsePx(ps.marginRight)),
          bottom: pxToTwip(parsePx(ps.marginBottom)),
          left: pxToTwip(parsePx(ps.marginLeft)),
        },
        titlePage: firstSection?.headers?.titlePg || firstSection?.footers?.titlePg || false,
      },
    },
  };
  if (headersOpt) sectionProps.headers = headersOpt;
  if (footersOpt) sectionProps.footers = footersOpt;

  const docOpts: Record<string, unknown> = { sections: [sectionProps] };
  if (numberingConfig) docOpts.numbering = numberingConfig;
  // evenAndOddHeaders 플래그 (settings.xml) — docx 라이브러리는 evenAndOddHeaderAndFooters 옵션 제공
  if (firstSection?.headers?.evenAndOdd || firstSection?.footers?.evenAndOdd) {
    docOpts.evenAndOddHeaderAndFooters = true;
  }

  const document = new Document(docOpts);

  return await Packer.toBlob(document);
}

/**
 * 문서 내 paragraph 의 numbering 메타데이터를 모아 docx Document `numbering`
 * 옵션으로 변환한다. format 별로 reference 한 개만 등록한다.
 */
function collectNumberingConfig(doc: DocumentData, LevelFormat: Record<string, string>): { config: unknown[] } | null {
  const formats = new Set<string>();
  const walk = (el: Element) => {
    if (el.numbering?.format) formats.add(el.numbering.format);
    if (el.rows) {
      for (const row of el.rows) {
        for (const cell of row.cells) {
          for (const inner of cell.elements || []) walk(inner as Element);
        }
      }
    }
  };
  for (const section of doc.sections) {
    for (const el of section.elements) walk(el);
  }
  if (formats.size === 0) return null;

  const lvlFormatMap: Record<string, string> = {
    GANADA: LevelFormat.GANADA,
    CHOSUNG: LevelFormat.CHOSUNG,
    KOREAN_DIGITAL: LevelFormat.KOREAN_DIGITAL,
    KOREAN_COUNTING: LevelFormat.KOREAN_COUNTING,
    KOREAN_LEGAL: LevelFormat.KOREAN_LEGAL,
    HANGUL_SYLLABLE: LevelFormat.KOREAN_COUNTING,
    IDEOGRAPH: LevelFormat.IDEOGRAPH__DIGITAL ?? LevelFormat.IDEOGRAPH_DIGITAL ?? 'ideographDigital',
    DECIMAL: LevelFormat.DECIMAL,
    UPPER_ROMAN: LevelFormat.UPPER_ROMAN,
    LOWER_ROMAN: LevelFormat.LOWER_ROMAN,
    UPPER_LETTER: LevelFormat.UPPER_LETTER,
    LOWER_LETTER: LevelFormat.LOWER_LETTER,
    IROHA: LevelFormat.IROHA,
    BULLET: LevelFormat.BULLET,
  };

  const configs: unknown[] = [];
  for (const fmt of formats) {
    const reference = `ohai-${fmt.toLowerCase()}`;
    const lvlFmt = lvlFormatMap[fmt] || LevelFormat.DECIMAL;
    configs.push({
      reference,
      levels: [
        {
          level: 0,
          format: lvlFmt,
          text: '%1.',
          alignment: 'start',
        },
        {
          level: 1,
          format: lvlFmt,
          text: '%2)',
          alignment: 'start',
        },
      ],
    });
  }
  return { config: configs };
}

/**
 * Section.headers / Section.footers → docx 라이브러리의 `headers`/`footers` 옵션.
 *
 * docx 라이브러리는 `default`, `first`, `even` 키를 사용한다.
 */
function buildDocxHeadersFooters(
  hf: Section['headers'] | Section['footers'] | undefined,
  lib: Record<string, unknown>,
  kind: 'header' | 'footer',
): { default?: unknown; first?: unknown; even?: unknown } | null {
  if (!hf) return null;
  const Paragraph = lib.Paragraph as new (opts: Record<string, unknown>) => unknown;
  const TextRun = lib.TextRun as new (text: string | Record<string, unknown>) => unknown;
  const Header = lib.Header as new (opts: Record<string, unknown>) => unknown;
  const Footer = lib.Footer as new (opts: Record<string, unknown>) => unknown;
  const Ctor = kind === 'header' ? Header : Footer;

  const make = (content: HeaderFooterContent | null): unknown => {
    if (!content) return null;
    const paras: unknown[] = [];
    for (const el of content.elements) {
      if (el.type === 'paragraph' && el.runs) {
        paras.push(buildDocxParagraph(el, lib));
      }
    }
    if (paras.length === 0) {
      paras.push(new Paragraph({ children: [new TextRun('')] }));
    }
    return new Ctor({ children: paras });
  };

  const out: { default?: unknown; first?: unknown; even?: unknown } = {};
  if (hf.default) {
    const d = make(hf.default);
    if (d) out.default = d;
  } else if (hf.odd) {
    const d = make(hf.odd);
    if (d) out.default = d;
  }
  if (hf.firstPage) {
    const f = make(hf.firstPage);
    if (f) out.first = f;
  }
  if (hf.even) {
    const e = make(hf.even);
    if (e) out.even = e;
  }
  if (!out.default && !out.first && !out.even) return null;
  return out;
}

/**
 * HWPXDocument paragraph → docx Paragraph
 */
function buildDocxParagraph(el: Element, lib: any): any {
  const { Paragraph, TextRun, AlignmentType, HeadingLevel } = lib;

  const textRuns: any[] = [];
  let isHeading = false;
  let headingLevel: any = undefined;

  for (const run of (el.runs || [])) {
    if (run.type === 'linebreak') {
      textRuns.push(new TextRun({ break: 1 }));
      continue;
    }
    if (run.type === 'tab') {
      textRuns.push(new TextRun({ text: '\t' }));
      continue;
    }

    const s = run.inlineStyle || run.style || {};
    const opts: any = { text: run.text || '' };

    if (s.bold) opts.bold = true;
    if (s.italic) opts.italics = true;
    if (s.underline) opts.underline = {};
    if (s.strikethrough) opts.strike = true;

    if (s.fontSize) {
      const pt = parseFloat(String(s.fontSize));
      if (pt > 0) opts.size = pt * 2; // docx uses half-points

      // 제목 감지
      if (s.bold && pt >= 16) {
        isHeading = true;
        if (pt >= 24) headingLevel = HeadingLevel.HEADING_1;
        else if (pt >= 20) headingLevel = HeadingLevel.HEADING_2;
        else if (pt >= 16) headingLevel = HeadingLevel.HEADING_3;
      }
    }

    const colorHex = toDocxHex(s.color);
    if (colorHex) opts.color = colorHex;
    // 한국어 폰트는 eastAsia 에 매핑해야 함초롬바탕 같은 한글 폰트가 적용됨
    if (s.fontFamilyEastAsia || s.fontFamily) {
      const ea = s.fontFamilyEastAsia || s.fontFamily;
      const ascii = s.fontFamilyAscii || s.fontFamily;
      opts.font = {
        name: ascii,
        eastAsia: ea,
      };
    }
    const bgHex = toDocxHex(s.backgroundColor);
    if (bgHex) {
      opts.shading = { fill: bgHex, type: 'clear' as any };
    }

    textRuns.push(new TextRun(opts));
  }

  const paraOpts: any = { children: textRuns };

  // 정렬
  const style = el.style || {};
  if (style.textAlign) {
    const alignMap: Record<string, any> = {
      left: AlignmentType.LEFT, center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED,
    };
    paraOpts.alignment = alignMap[style.textAlign as string];
  }

  // 제목
  if (isHeading && headingLevel) {
    paraOpts.heading = headingLevel;
  }

  // 한국어식 번호 (ganada / chosung / koreanCounting…) — exporter 측 매핑
  if (el.numbering?.format && el.numbering.format !== 'NONE') {
    paraOpts.numbering = {
      reference: `ohai-${el.numbering.format.toLowerCase()}`,
      level: el.numbering.level || 0,
    };
    // 번호 prefix run 은 docx 가 자동 생성 — 이미 paragraph 의 첫 run 에
    // glyph 가 포함되어 있을 수 있으므로, 첫 텍스트 run 이 정확히 prefix 만
    // 담고 있다면 제거한다. (parseParagraph 가 prefix 를 별도 run 으로 push)
    const prefixText = (el.numbering.text || '').trim();
    if (prefixText && textRuns.length > 0) {
      const first = textRuns[0];
      const firstText = (first?.options?.text ?? first?.text ?? '').toString().trim();
      if (firstText === prefixText || firstText === prefixText + '.') {
        textRuns.shift();
      }
    }
  }

  return new Paragraph(paraOpts);
}

/**
 * HWPXDocument table → docx Table
 */
function buildDocxTable(el: Element, lib: any): any {
  const {
    Table, TableRow, TableCell, Paragraph, TextRun,
    WidthType, AlignmentType, BorderStyle, VerticalAlign, ShadingType,
  } = lib;

  const tableRows: any[] = [];

  for (const row of (el.rows || [])) {
    const tableCells: any[] = [];

    for (const cellData of (row.cells || [])) {
      const cellChildren: any[] = [];

      // 셀 내 elements → docx paragraphs (+ 중첩 표)
      for (const ce of (cellData.elements || [])) {
        if (ce.type === 'paragraph' && ce.runs) {
          cellChildren.push(buildDocxParagraph(ce, { Paragraph, TextRun, AlignmentType, HeadingLevel: {} }));
        } else if (ce.type === 'table' && ce.rows) {
          const nested = buildDocxTable(ce, lib);
          if (nested) cellChildren.push(nested);
        }
      }

      if (cellChildren.length === 0) {
        cellChildren.push(new Paragraph({ children: [new TextRun('')] }));
      }

      const cellOpts: any = {
        children: cellChildren,
        columnSpan: cellData.colSpan || 1,
      };

      if (cellData.rowSpan && cellData.rowSpan > 1) {
        cellOpts.rowSpan = cellData.rowSpan;
      }

      // 셀 스타일
      const cs = cellData.style || {};

      if (cs.verticalAlign) {
        const vMap: Record<string, any> = {
          top: VerticalAlign.TOP, middle: VerticalAlign.CENTER, bottom: VerticalAlign.BOTTOM,
        };
        cellOpts.verticalAlign = vMap[cs.verticalAlign] || VerticalAlign.TOP;
      }

      const cellBgHex = toDocxHex(cs.backgroundColor);
      if (cellBgHex) {
        cellOpts.shading = {
          fill: cellBgHex,
          type: ShadingType.CLEAR,
        };
      }

      // 테두리
      const borders: any = {};
      const borderSides = [
        ['borderTopDef', 'top'],
        ['borderBottomDef', 'bottom'],
        ['borderLeftDef', 'left'],
        ['borderRightDef', 'right'],
      ] as const;
      for (const [key, side] of borderSides) {
        if (cs[key] && cs[key].css) {
          const parts = cs[key].css.split(/\s+/);
          const px = parseFloat(parts[0] || '1');
          const styleStr = parts[1] || 'solid';
          const color = toDocxHex(parts[2]) || '000000';

          let bs = BorderStyle.SINGLE;
          if (styleStr === 'dotted') bs = BorderStyle.DOTTED;
          else if (styleStr === 'dashed') bs = BorderStyle.DASHED;
          else if (styleStr === 'double') bs = BorderStyle.DOUBLE;

          borders[side] = { style: bs, size: Math.round(px * 8), color };
        }
      }
      if (Object.keys(borders).length > 0) cellOpts.borders = borders;

      tableCells.push(new TableCell(cellOpts));
    }

    if (tableCells.length > 0) {
      tableRows.push(new TableRow({ children: tableCells }));
    }
  }

  if (tableRows.length === 0) return null;

  // 열 너비
  const colWidths = (el.colWidthsPercent || []).map((pct: string) => {
    const percent = parseFloat(pct);
    return Math.round(percent / 100 * 9000); // ~6.25 inches in twips
  });

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colWidths.length > 0 ? colWidths : undefined,
  });
}

/**
 * HWPXDocument image → docx ImageRun
 */
async function buildDocxImage(el: Element, images: Map<string, any>, lib: any): Promise<any> {
  const { Paragraph, ImageRun } = lib;

  // 이미지 데이터 찾기
  let imageData: Uint8Array | null = null;

  // objectURL에서 이미지 데이터 가져오기
  if (el.src) {
    // images Map에서 data 필드로 찾기
    for (const [, img] of images) {
      if (img.src === el.src && img.data) {
        const blob = img.data instanceof Blob ? img.data : new Blob([img.data]);
        const buffer = await safeBlobToArrayBuffer(blob);
        imageData = new Uint8Array(buffer);
        break;
      }
    }

    // data 필드가 없으면 fetch로 시도
    if (!imageData && el.src.startsWith('blob:')) {
      try {
        const resp = await fetch(el.src);
        const buffer = await resp.arrayBuffer();
        imageData = new Uint8Array(buffer);
      } catch {
        // fetch 실패 시 이미지 스킵
      }
    }
  }

  if (!imageData) {
    // 이미지 없으면 플레이스홀더 텍스트 반환
    return new Paragraph({ children: [new (lib.TextRun)({ text: '[이미지]', italics: true, color: '999999' })] });
  }

  const width = typeof el.width === 'number' ? el.width : parseInt(String(el.width) || '200', 10);
  const height = typeof el.height === 'number' ? el.height : parseInt(String(el.height) || '150', 10);

  return new Paragraph({
    children: [
      new ImageRun({
        data: imageData,
        transformation: { width, height },
        type: 'png',
      }),
    ],
  });
}

/**
 * HWPXDocument를 DOCX 파일로 다운로드
 */
export async function downloadDocx(doc: DocumentData, fileName: string = '문서.docx'): Promise<void> {
  const blob = await exportToDocx(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export {
  hwpxToDocxNumFormat,
  docxToHwpxNumFormat,
  normalizeKoreanFont,
};

export default { parseDocx, exportToDocx, downloadDocx };
