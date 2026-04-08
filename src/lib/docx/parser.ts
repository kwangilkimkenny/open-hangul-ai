/**
 * DOCX Parser & Exporter
 * DOCX 파일을 편집기 문서 데이터(HWPXDocument)로 변환 및 내보내기
 *
 * 읽기: JSZip + Office Open XML 직접 파싱
 * 쓰기: docx 패키지
 *
 * @module lib/docx/parser
 * @version 1.0.0
 */

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
  const relsMap = new Map<string, string>();
  if (relsXml) {
    const relDoc = parser.parseFromString(relsXml, 'application/xml');
    const rels = relDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < rels.length; i++) {
      const id = rels[i].getAttribute('Id');
      const target = rels[i].getAttribute('Target');
      if (id && target) relsMap.set(id, target);
    }
  }

  // 3. 이미지 추출
  const images = new Map<string, any>();
  for (const [relId, target] of relsMap) {
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
          images.set(relId, { src: objectUrl, path: target });
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

  // 5. body 파싱
  const body = doc.getElementsByTagName('w:body')[0] || doc.getElementsByTagNameNS(NS.w, 'body')[0];
  if (!body) throw new Error('DOCX body를 찾을 수 없습니다');

  const elements: Element[] = [];

  for (let i = 0; i < body.children.length; i++) {
    const node = body.children[i];
    const name = getLocalName(node);

    if (name === 'p') {
      const paras = parseParagraph(node, styleMap, images, relsMap);
      elements.push(...paras);
    } else if (name === 'tbl') {
      const table = parseTable(node, styleMap, images, relsMap);
      if (table) elements.push(table);
    } else if (name === 'sectPr') {
      // 섹션 속성 — 페이지 설정용 (마지막에 처리)
    }
  }

  // 6. 페이지 설정 추출
  const sectPr = body.getElementsByTagName('w:sectPr')[0] || body.getElementsByTagNameNS(NS.w, 'sectPr')[0];
  const pageSettings = parsePageSettings(sectPr);

  return {
    sections: [{
      elements,
      pageSettings: pageSettings.css,
      pageWidth: pageSettings.widthPx,
      pageHeight: pageSettings.heightPx,
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
      sourceFormat: 'docx',
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
    const fontName = getAttr(rFonts, 'ascii') || getAttr(rFonts, 'eastAsia') || getAttr(rFonts, 'hAnsi');
    if (fontName) style.fontFamily = fontName;
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
  relsMap: Map<string, string>,
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

    // 번호 매기기 (목록)
    const numPr = getElement(pPr, 'numPr');
    if (numPr) {
      const ilvl = getElement(numPr, 'ilvl');
      const level = ilvl ? parseInt(getAttr(ilvl, 'val') || '0', 10) : 0;
      const bullets = ['●', '○', '■', '▪'];
      const bullet = bullets[Math.min(level, bullets.length - 1)];
      runs.push({ text: `${bullet} `, inlineStyle: { color: '#333' } });
      if (!paraStyle.paddingLeft) {
        paraStyle.paddingLeft = `${20 + level * 20}px`;
      }
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
        const imgEl = parseDrawing(drawing, images, relsMap);
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

  // _headingSize, _baseRunStyle 제거 (내부용)
  delete paraStyle._headingSize;
  delete paraStyle._baseRunStyle;

  // 남은 runs가 있거나 이미지만 있는 경우에도 paragraph 추가
  if (runs.length > 0 || resultElements.length === 0) {
    if (runs.length === 0) {
      runs.push({ text: '' });
    }
    resultElements.push({
      type: 'paragraph',
      runs,
      style: Object.keys(paraStyle).length > 0 ? paraStyle : undefined,
    });
  }

  return resultElements;
}

/**
 * 이미지(drawing) 파싱
 */
function parseDrawing(
  drawing: globalThis.Element,
  images: Map<string, any>,
  relsMap: Map<string, string>,
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
  relsMap: Map<string, string>,
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
      let rowSpan: number | undefined;
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
            rowSpan = undefined; // 마크만
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

      // 셀 내용 파싱
      const cellElements: any[] = [];
      for (let i = 0; i < tc.children.length; i++) {
        const child = tc.children[i];
        if (getLocalName(child) === 'p') {
          cellElements.push(...parseParagraph(child, styleMap, images, relsMap));
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
 * DOCX는 vMerge restart/continue 패턴을 사용하므로 후처리 필요
 */
function computeRowSpans(rows: RowData[], tblRows: globalThis.Element[]): void {
  // 각 열 위치별로 vMerge 추적
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
      for (const tc of tcs) {
        const tcPr = getElement(tc, 'tcPr');
        const gridSpan = tcPr ? getElement(tcPr, 'gridSpan') : null;
        const span = gridSpan ? parseInt(getAttr(gridSpan, 'val') || '1', 10) : 1;

        if (currentCol === col) {
          const vMerge = tcPr ? getElement(tcPr, 'vMerge') : null;
          if (vMerge && getAttr(vMerge, 'val') === 'restart') {
            mergeStart = rowIdx;
          } else if (vMerge && mergeStart >= 0) {
            // continue — mergeStart 행의 해당 셀에 rowSpan 증가
          } else {
            if (mergeStart >= 0 && rowIdx > mergeStart) {
              setRowSpanForCell(rows, mergeStart, col, rowIdx - mergeStart);
            }
            mergeStart = -1;
          }
          break;
        }
        currentCol += span;
      }
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
 */
export async function exportToDocx(doc: DocumentData): Promise<Blob> {
  const docxLib = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, HeadingLevel,
    VerticalAlign, ShadingType,
  } = docxLib;

  const children: any[] = [];

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
      }
    }
  }

  const document = new Document({
    sections: [{
      children,
    }],
  });

  return await Packer.toBlob(document);
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

    if (s.color) opts.color = s.color.replace('#', '');
    if (s.fontFamily) opts.font = s.fontFamily;
    if (s.backgroundColor) {
      opts.shading = { fill: s.backgroundColor.replace('#', ''), type: 'clear' as any };
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

      // 셀 내 elements → docx paragraphs
      for (const ce of (cellData.elements || [])) {
        if (ce.type === 'paragraph' && ce.runs) {
          cellChildren.push(buildDocxParagraph(ce, { Paragraph, TextRun, AlignmentType, HeadingLevel: {} }));
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

      if (cs.backgroundColor) {
        cellOpts.shading = {
          fill: cs.backgroundColor.replace('#', ''),
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
          const color = (parts[2] || '#000000').replace('#', '');

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

export default { parseDocx, exportToDocx, downloadDocx };
