/**
 * ODF Parser
 * ODT/ODS 파일을 편집기 문서 데이터(HWPXDocument)로 변환
 *
 * @module lib/odf/parser
 * @version 1.0.0
 */

interface Run {
  text: string;
  type?: string;
  inlineStyle?: Record<string, any>;
}

interface CellData {
  elements: any[];
  colSpan?: number;
  rowSpan?: number;
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
  colWidthsPercent?: string[];
  style?: Record<string, any>;
  src?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
}

interface Section {
  elements: Element[];
  pageSettings: Record<string, string>;
  pageWidth: number;
  pageHeight: number;
  headers: { both: null; odd: null; even: null };
  footers: { both: null; odd: null; even: null };
}

interface DocumentData {
  sections: Section[];
  images: Map<string, any>;
  borderFills: Map<string, any>;
  metadata: Record<string, any>;
}

// ODF XML Namespaces
const NS = {
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
};

function local(el: globalThis.Element): string {
  return el.localName || el.nodeName.split(':').pop() || '';
}

function nsAttr(el: globalThis.Element, ns: string, name: string): string | null {
  return el.getAttributeNS(ns, name) || el.getAttribute(`${name}`) || null;
}

/**
 * ODT (텍스트 문서) 파싱
 */
export async function parseODT(buffer: ArrayBuffer, fileName: string): Promise<DocumentData> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  const contentXml = await zip.file('content.xml')?.async('string');
  if (!contentXml) throw new Error('유효한 ODT 파일이 아닙니다 (content.xml 없음)');

  const parser = new DOMParser();
  const doc = parser.parseFromString(contentXml, 'application/xml');

  // 스타일 파싱
  const styleMap = parseOdfStyles(doc);

  // 이미지 추출
  const images = new Map<string, any>();
  const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('Pictures/'));
  for (const path of mediaFiles) {
    try {
      const imgBlob = await zip.file(path)!.async('blob');
      const ext = path.split('.').pop()?.toLowerCase() || 'png';
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp',
      };
      const objectUrl = URL.createObjectURL(new Blob([imgBlob], { type: mimeMap[ext] || 'image/png' }));
      images.set(path, { src: objectUrl, path });
    } catch (err) { console.warn(`[ODF Parser] 이미지 로드 실패: ${path}`, err); }
  }

  // body > text 파싱
  const body = doc.getElementsByTagNameNS(NS.office, 'body')[0];
  const textBody = body?.getElementsByTagNameNS(NS.office, 'text')[0];
  if (!textBody) throw new Error('ODT body를 찾을 수 없습니다');

  const elements: Element[] = [];
  for (let i = 0; i < textBody.children.length; i++) {
    const node = textBody.children[i];
    const name = local(node);

    if (name === 'p' || name === 'h') {
      elements.push(parseOdfParagraph(node, styleMap, images, name === 'h'));
    } else if (name === 'table') {
      elements.push(parseOdfTable(node, styleMap, images));
    } else if (name === 'list') {
      elements.push(...parseOdfList(node, styleMap, images));
    }
  }

  return {
    sections: [{
      elements,
      pageSettings: { width: '794px', height: '1123px', marginLeft: '85px', marginRight: '85px', marginTop: '71px', marginBottom: '57px' },
      pageWidth: 794,
      pageHeight: 1123,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    }],
    images,
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: 1,
      imagesCount: images.size,
      borderFillsCount: 0,
      sourceFormat: 'odt',
      fileName,
    },
    cleanup() {
      for (const [, img] of images) {
        if (img?.src) URL.revokeObjectURL(img.src);
      }
      images.clear();
    },
  };
}

/**
 * ODS (스프레드시트) 파싱
 */
export async function parseODS(buffer: ArrayBuffer, fileName: string): Promise<DocumentData> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  const contentXml = await zip.file('content.xml')?.async('string');
  if (!contentXml) throw new Error('유효한 ODS 파일이 아닙니다 (content.xml 없음)');

  const parser = new DOMParser();
  const doc = parser.parseFromString(contentXml, 'application/xml');
  const styleMap = parseOdfStyles(doc);

  const body = doc.getElementsByTagNameNS(NS.office, 'body')[0];
  const spreadsheet = body?.getElementsByTagNameNS(NS.office, 'spreadsheet')[0];
  if (!spreadsheet) throw new Error('ODS spreadsheet 본문을 찾을 수 없습니다');

  const elements: Element[] = [];
  const tables = spreadsheet.getElementsByTagNameNS(NS.table, 'table');

  for (let t = 0; t < tables.length; t++) {
    const tableNode = tables[t];
    const tableName = nsAttr(tableNode, NS.table, 'name') || `Sheet${t + 1}`;

    // 시트 제목
    elements.push({
      type: 'paragraph',
      runs: [{ text: tableName, inlineStyle: { bold: true, fontSize: '16pt' } }],
      style: { marginTop: t > 0 ? '24px' : '0', marginBottom: '8px' },
    });

    // 테이블 파싱
    const rows: RowData[] = [];
    const tableRows = tableNode.getElementsByTagNameNS(NS.table, 'table-row');

    for (let r = 0; r < tableRows.length && r < 10000; r++) {
      const tr = tableRows[r];
      const repeat = parseInt(nsAttr(tr, NS.table, 'number-rows-repeated') || '1', 10);
      if (repeat > 100) continue; // 빈 행 반복 스킵

      const cells: CellData[] = [];
      const cellNodes = tr.children;

      for (let c = 0; c < cellNodes.length; c++) {
        const tc = cellNodes[c];
        if (local(tc) !== 'table-cell') continue;

        const colRepeat = parseInt(nsAttr(tc, NS.table, 'number-columns-repeated') || '1', 10);
        const colSpan = parseInt(nsAttr(tc, NS.table, 'number-columns-spanned') || '1', 10);
        const rowSpan = parseInt(nsAttr(tc, NS.table, 'number-rows-spanned') || '1', 10);

        // 셀 내용
        const cellElements: any[] = [];
        for (let p = 0; p < tc.children.length; p++) {
          if (local(tc.children[p]) === 'p') {
            cellElements.push(parseOdfParagraph(tc.children[p], styleMap, new Map(), false));
          }
        }

        if (cellElements.length === 0) {
          cellElements.push({ type: 'paragraph', runs: [{ text: '' }] });
        }

        const cellData: CellData = { elements: cellElements, style: { padding: '4px 6px' } };
        if (colSpan > 1) cellData.colSpan = colSpan;
        if (rowSpan > 1) cellData.rowSpan = rowSpan;

        // 빈 셀 반복
        const actualRepeat = Math.min(colRepeat, 50);
        for (let rep = 0; rep < actualRepeat; rep++) {
          cells.push(rep === 0 ? cellData : { ...cellData, elements: [{ type: 'paragraph', runs: [{ text: '' }] }] });
        }
      }

      if (cells.length > 0 && cells.some(c => c.elements.some((e: any) => e.runs?.some((r: any) => r.text.trim())))) {
        rows.push({ cells });
      }
    }

    if (rows.length > 0) {
      elements.push({
        type: 'table',
        rows,
        style: { width: '100%' },
      });
    }
  }

  return {
    sections: [{
      elements,
      pageSettings: { width: '794px', height: '1123px', marginLeft: '40px', marginRight: '40px', marginTop: '40px', marginBottom: '40px' },
      pageWidth: 794,
      pageHeight: 1123,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    }],
    images: new Map(),
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: 1,
      imagesCount: 0,
      borderFillsCount: 0,
      sourceFormat: 'ods',
      fileName,
    },
  };
}

/**
 * ODF 자동 감지 파서
 */
export async function parseODF(buffer: ArrayBuffer, fileName: string): Promise<DocumentData> {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'ods') return parseODS(buffer, fileName);
  return parseODT(buffer, fileName);
}

// =============================================
// Internal Helpers
// =============================================

function parseOdfStyles(doc: Document): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>();
  const styles = doc.getElementsByTagNameNS(NS.style, 'style');

  for (let i = 0; i < styles.length; i++) {
    const el = styles[i];
    const name = nsAttr(el, NS.style, 'name');
    if (!name) continue;

    const props: Record<string, any> = {};
    const textProps = el.getElementsByTagNameNS(NS.style, 'text-properties')[0];
    if (textProps) {
      const bold = nsAttr(textProps, NS.fo, 'font-weight');
      if (bold === 'bold') props.bold = true;

      const italic = nsAttr(textProps, NS.fo, 'font-style');
      if (italic === 'italic') props.italic = true;

      const fontSize = nsAttr(textProps, NS.fo, 'font-size');
      if (fontSize) props.fontSize = fontSize;

      const color = nsAttr(textProps, NS.fo, 'color');
      if (color) props.color = color;

      const fontFamily = nsAttr(textProps, NS.style, 'font-name') || nsAttr(textProps, NS.fo, 'font-family');
      if (fontFamily) props.fontFamily = fontFamily.replace(/'/g, '');

      const underline = nsAttr(textProps, NS.style, 'text-underline-style');
      if (underline && underline !== 'none') props.underline = true;

      const strike = nsAttr(textProps, NS.style, 'text-line-through-style');
      if (strike && strike !== 'none') props.strikethrough = true;
    }

    const paraProps = el.getElementsByTagNameNS(NS.style, 'paragraph-properties')[0];
    if (paraProps) {
      const align = nsAttr(paraProps, NS.fo, 'text-align');
      if (align) {
        const alignMap: Record<string, string> = { start: 'left', center: 'center', end: 'right', justify: 'justify' };
        props.textAlign = alignMap[align] || align;
      }

      const marginLeft = nsAttr(paraProps, NS.fo, 'margin-left');
      if (marginLeft) props.paddingLeft = marginLeft;

      const bg = nsAttr(paraProps, NS.fo, 'background-color');
      if (bg && bg !== 'transparent') props.backgroundColor = bg;
    }

    map.set(name, props);
  }

  return map;
}

function parseOdfParagraph(
  node: globalThis.Element,
  styleMap: Map<string, Record<string, any>>,
  images: Map<string, any>,
  isHeading: boolean,
): Element {
  const runs: Run[] = [];
  const paraStyle: Record<string, any> = {};

  // 스타일 참조
  const styleName = nsAttr(node, NS.text, 'style-name');
  let baseStyle: Record<string, any> = {};
  if (styleName && styleMap.has(styleName)) {
    baseStyle = { ...styleMap.get(styleName)! };
    if (baseStyle.textAlign) { paraStyle.textAlign = baseStyle.textAlign; delete baseStyle.textAlign; }
    if (baseStyle.paddingLeft) { paraStyle.paddingLeft = baseStyle.paddingLeft; delete baseStyle.paddingLeft; }
    if (baseStyle.backgroundColor) { paraStyle.backgroundColor = baseStyle.backgroundColor; delete baseStyle.backgroundColor; }
  }

  // 제목 레벨
  if (isHeading) {
    const level = parseInt(nsAttr(node, NS.text, 'outline-level') || '1', 10);
    const sizeMap: Record<number, string> = { 1: '24pt', 2: '20pt', 3: '16pt', 4: '14pt', 5: '12pt' };
    baseStyle.bold = true;
    baseStyle.fontSize = sizeMap[level] || '12pt';
    paraStyle.marginTop = '12px';
    paraStyle.marginBottom = '6px';
  }

  // 자식 노드 순회
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text) {
        runs.push({
          text,
          inlineStyle: Object.keys(baseStyle).length > 0 ? { ...baseStyle } : undefined,
        });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as globalThis.Element;
      const name = local(el);

      if (name === 'span') {
        const spanStyle = { ...baseStyle };
        const spanStyleName = nsAttr(el, NS.text, 'style-name');
        if (spanStyleName && styleMap.has(spanStyleName)) {
          Object.assign(spanStyle, styleMap.get(spanStyleName));
        }

        const text = el.textContent || '';
        if (text) {
          runs.push({
            text,
            inlineStyle: Object.keys(spanStyle).length > 0 ? spanStyle : undefined,
          });
        }
      } else if (name === 'line-break') {
        runs.push({ text: '', type: 'linebreak' });
      } else if (name === 'tab') {
        runs.push({ text: '\t', type: 'tab' });
      } else if (name === 's') {
        const count = parseInt(nsAttr(el, NS.text, 'c') || '1', 10);
        runs.push({ text: ' '.repeat(count) });
      } else if (name === 'a') {
        runs.push({
          text: el.textContent || '',
          inlineStyle: { color: '#2b579a', underline: true },
        });
      } else if (name === 'frame') {
        // 이미지 프레임
        const imgEl = el.getElementsByTagNameNS(NS.draw, 'image')[0];
        if (imgEl) {
          const href = nsAttr(imgEl, NS.xlink, 'href');
          if (href && images.has(href)) {
            // 이미지는 별도 처리 — 여기서는 플레이스홀더
            runs.push({ text: '[이미지]', inlineStyle: { italic: true, color: '#666' } });
          }
        }
      }
    }
  }

  if (runs.length === 0) {
    runs.push({ text: '' });
  }

  return {
    type: 'paragraph',
    runs,
    style: Object.keys(paraStyle).length > 0 ? paraStyle : undefined,
  };
}

function parseOdfTable(
  tableNode: globalThis.Element,
  styleMap: Map<string, Record<string, any>>,
  images: Map<string, any>,
): Element {
  const rows: RowData[] = [];
  const tableRows = tableNode.getElementsByTagNameNS(NS.table, 'table-row');

  for (let r = 0; r < tableRows.length; r++) {
    const tr = tableRows[r];
    // 같은 table의 직계 row만 처리 (중첩 테이블 방지)
    if (tr.parentElement !== tableNode) continue;

    const cells: CellData[] = [];
    for (let c = 0; c < tr.children.length; c++) {
      const tc = tr.children[c];
      if (local(tc) !== 'table-cell') continue;

      const colSpan = parseInt(nsAttr(tc, NS.table, 'number-columns-spanned') || '1', 10);
      const rowSpan = parseInt(nsAttr(tc, NS.table, 'number-rows-spanned') || '1', 10);

      const cellElements: any[] = [];
      for (let p = 0; p < tc.children.length; p++) {
        if (local(tc.children[p]) === 'p') {
          cellElements.push(parseOdfParagraph(tc.children[p], styleMap, images, false));
        }
      }
      if (cellElements.length === 0) {
        cellElements.push({ type: 'paragraph', runs: [{ text: '' }] });
      }

      const cellData: CellData = { elements: cellElements, style: { padding: '4px 6px' } };
      if (colSpan > 1) cellData.colSpan = colSpan;
      if (rowSpan > 1) cellData.rowSpan = rowSpan;
      cells.push(cellData);
    }

    if (cells.length > 0) {
      rows.push({ cells });
    }
  }

  return { type: 'table', rows, style: { width: '100%' } };
}

function parseOdfList(
  listNode: globalThis.Element,
  styleMap: Map<string, Record<string, any>>,
  images: Map<string, any>,
  level: number = 0,
): Element[] {
  const elements: Element[] = [];
  const bullets = ['●', '○', '■', '▪'];
  const bullet = bullets[Math.min(level, bullets.length - 1)];

  for (let i = 0; i < listNode.children.length; i++) {
    const item = listNode.children[i];
    if (local(item) !== 'list-item') continue;

    for (let j = 0; j < item.children.length; j++) {
      const child = item.children[j];
      if (local(child) === 'p') {
        const para = parseOdfParagraph(child, styleMap, images, false);
        // 목록 불릿 추가
        if (para.runs) {
          para.runs.unshift({ text: `${bullet} `, inlineStyle: { color: '#333' } });
        }
        if (!para.style) para.style = {};
        para.style.paddingLeft = `${20 + level * 20}px`;
        elements.push(para);
      } else if (local(child) === 'list') {
        elements.push(...parseOdfList(child, styleMap, images, level + 1));
      }
    }
  }

  return elements;
}

export default { parseODT, parseODS, parseODF };
