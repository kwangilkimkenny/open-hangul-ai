/**
 * HWPX → canvas-editor IEditorData converter
 *
 * Maps the HWPXDocument shape produced by parser.js
 *   { sections: [{ elements: [{ type: 'paragraph' | 'table' | 'image', ... }] }] }
 * to the canvas-editor IEditorData shape
 *   { main: IElement[], header?: IElement[], footer?: IElement[] }
 *
 * Phase 1 scope:
 *   - paragraphs with text runs (font / size / bold / italic / underline / color / highlight / strikeout)
 *   - paragraph-level horizontal alignment via RowFlex on the trailing newline
 *   - inline tab / linebreak / pagebreak runs
 *   - inline hyperlinks
 *   - tables (basic colgroup + trList; cell content recursively converted)
 *   - inline + standalone images
 *
 * Out of scope for Phase 1 (rendered as best-effort placeholders or skipped):
 *   list numbering, footnotes, fields, shapes, complex floating positions,
 *   header / footer round-trip.
 */

const ROW_FLEX_MAP = {
  left: 'left',
  center: 'center',
  right: 'right',
  justify: 'justify',
  distribute: 'justify',
};

function parseSize(fontSize) {
  if (fontSize == null) return undefined;
  if (typeof fontSize === 'number') return Math.round(fontSize);
  const match = String(fontSize).match(/(\d+(?:\.\d+)?)/);
  return match ? Math.round(parseFloat(match[1])) : undefined;
}

function parseLengthPx(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'number') return Math.round(value);
  const match = String(value).match(/(\d+(?:\.\d+)?)/);
  return match ? Math.round(parseFloat(match[1])) : fallback;
}

function styleToElementAttrs(style) {
  if (!style) return {};
  const out = {};
  const size = parseSize(style.fontSize);
  if (size) out.size = size;
  if (style.fontFamily) out.font = style.fontFamily;
  if (style.color) out.color = style.color;
  if (style.bold) out.bold = true;
  if (style.italic) out.italic = true;
  if (style.underline) out.underline = true;
  if (style.strikethrough) out.strikeout = true;
  if (style.backgroundColor) out.highlight = style.backgroundColor;
  return out;
}

function paragraphRowFlex(para) {
  if (!para?.style?.textAlign) return undefined;
  return ROW_FLEX_MAP[String(para.style.textAlign).toLowerCase()];
}

function imageToElement(image) {
  const width = parseLengthPx(image.width, 200);
  const height = parseLengthPx(image.height, 150);
  return {
    type: 'image',
    value: image.src || '',
    width,
    height,
  };
}

function pushTextRun(out, text, baseAttrs) {
  for (const ch of String(text)) {
    out.push({ value: ch, ...baseAttrs });
  }
}

function pushHyperlinkRun(out, run) {
  const baseAttrs = styleToElementAttrs(run.style);
  const text = run.text || '';
  const valueList = [...text].map(ch => ({ value: ch, ...baseAttrs }));
  out.push({
    type: 'hyperlink',
    value: '',
    url: run.hyperlink?.url || '',
    valueList,
  });
}

function pushParagraph(out, para) {
  const flex = paragraphRowFlex(para);
  const breakAttrs = flex ? { rowFlex: flex } : {};

  const runs = para.runs || [];
  for (const run of runs) {
    if (!run) continue;

    if (run.type === 'tab') {
      out.push({ type: 'tab', value: '' });
      continue;
    }
    if (run.type === 'linebreak') {
      out.push({ value: '\n', ...breakAttrs });
      continue;
    }
    if (run.type === 'pagebreak' || run.type === 'colbreak') {
      out.push({ type: 'pageBreak', value: '\n' });
      continue;
    }
    if (run.type === 'bookmark') {
      continue;
    }

    if (run.hasImage && para.images && para.images[run.imageIndex]) {
      out.push(imageToElement(para.images[run.imageIndex]));
      continue;
    }
    if (run.hasTable && para.tables && para.tables[run.tableIndex]) {
      out.push(tableToElement(para.tables[run.tableIndex]));
      continue;
    }
    if (run.hasShape) {
      continue;
    }

    if (run.hyperlink && run.hyperlink.url) {
      pushHyperlinkRun(out, run);
      continue;
    }

    if (run.text) {
      const baseAttrs = styleToElementAttrs(run.style);
      pushTextRun(out, run.text, baseAttrs);
    }
  }

  out.push({ value: '\n', ...breakAttrs });
}

function cellElements(cell) {
  const out = [];
  for (const elem of cell.elements || []) {
    if (!elem) continue;
    if (elem.type === 'paragraph') {
      pushParagraph(out, elem);
    } else if (elem.type === 'table') {
      out.push(tableToElement(elem));
      out.push({ value: '\n' });
    } else if (elem.type === 'image') {
      out.push(imageToElement(elem));
      out.push({ value: '\n' });
    }
  }
  if (out.length === 0) {
    out.push({ value: '\n' });
  }
  return out;
}

function tableToElement(table) {
  const rows = Array.isArray(table.rows) ? table.rows : [];

  let colCount = 0;
  if (Array.isArray(table.gridMap) && Array.isArray(table.gridMap[0])) {
    colCount = table.gridMap[0].length;
  } else {
    for (const row of rows) {
      const visible = (row.cells || []).reduce(
        (sum, c) => sum + (c.isCovered ? 0 : c.colSpan || 1),
        0
      );
      colCount = Math.max(colCount, visible);
    }
  }
  if (colCount === 0) colCount = 1;

  const tableWidthPx = parseLengthPx(table.style?.width, 600);
  const colWidth = Math.max(20, Math.floor(tableWidthPx / colCount));
  const colgroup = Array.from({ length: colCount }, () => ({ width: colWidth }));

  const trList = rows.map(row => {
    const tdList = (row.cells || [])
      .filter(c => !c.isCovered)
      .map(cell => ({
        colspan: cell.colSpan || 1,
        rowspan: cell.rowSpan || 1,
        value: cellElements(cell),
      }));
    return {
      height: parseLengthPx(row.style?.height, 30),
      tdList,
    };
  });

  return {
    type: 'table',
    value: '',
    colgroup,
    trList,
  };
}

/**
 * Convert a parsed HWPXDocument (parser.js output) to canvas-editor IEditorData.
 *
 * @param {object} doc HWPXDocument with { sections: [...] }
 * @returns {{ main: object[] }}
 */
export function hwpxToCanvasEditor(doc) {
  const main = [];
  if (!doc || !Array.isArray(doc.sections)) {
    main.push({ value: '\n' });
    return { main };
  }

  for (const section of doc.sections) {
    for (const elem of section.elements || []) {
      if (!elem) continue;
      if (elem.type === 'paragraph') {
        pushParagraph(main, elem);
      } else if (elem.type === 'table') {
        main.push(tableToElement(elem));
        main.push({ value: '\n' });
      } else if (elem.type === 'image') {
        main.push(imageToElement(elem));
        main.push({ value: '\n' });
      }
    }
  }

  if (main.length === 0) main.push({ value: '\n' });
  return { main };
}

export default hwpxToCanvasEditor;
