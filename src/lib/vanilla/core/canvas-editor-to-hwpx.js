/**
 * canvas-editor IEditorData → HWPX-shaped document converter
 *
 * Inverse of hwpx-to-canvas-editor.js. Produces a document object that
 * matches the shape parser.js emits, so that downstream HWPX writers /
 * AI pipelines / serializers can keep using their existing entry points.
 *
 * The output is intentionally lossy compared to the original HWPX:
 * canvas-editor does not retain HWPX-specific concepts (paraPrIDRef,
 * borderFills, named styles). Anything not representable in canvas-editor
 * is dropped on the round trip.
 */

const ROW_FLEX_TO_TEXT_ALIGN = {
  left: 'left',
  center: 'center',
  right: 'right',
  justify: 'justify',
  alignment: 'justify',
};

function elementStyleToRunStyle(el) {
  const style = {};
  if (typeof el.size === 'number') style.fontSize = `${el.size}pt`;
  if (el.font) style.fontFamily = el.font;
  if (el.color) style.color = el.color;
  if (el.bold) style.bold = true;
  if (el.italic) style.italic = true;
  if (el.underline) style.underline = true;
  if (el.strikeout) style.strikethrough = true;
  if (el.highlight) style.backgroundColor = el.highlight;
  return style;
}

function styleSignature(style) {
  const keys = Object.keys(style).sort();
  return keys.map(k => `${k}=${style[k]}`).join('|');
}

function isPlainTextElement(el) {
  if (!el) return false;
  const t = el.type;
  return !t || t === 'text';
}

function newParagraph() {
  return { type: 'paragraph', runs: [], style: {} };
}

function flushTextBuffer(buffer, runs) {
  if (!buffer.text) return;
  runs.push({ text: buffer.text, style: buffer.style });
  buffer.text = '';
  buffer.style = {};
  buffer.signature = '';
}

function appendChar(buffer, runs, ch, style) {
  const sig = styleSignature(style);
  if (buffer.text && sig !== buffer.signature) {
    flushTextBuffer(buffer, runs);
  }
  if (!buffer.text) {
    buffer.style = { ...style };
    buffer.signature = sig;
  }
  buffer.text += ch;
}

function elementsToCellOrSection(elementList) {
  const out = [];
  let para = newParagraph();
  const buffer = { text: '', style: {}, signature: '' };

  const finishParagraph = rowFlex => {
    flushTextBuffer(buffer, para.runs);
    if (rowFlex && ROW_FLEX_TO_TEXT_ALIGN[rowFlex]) {
      para.style.textAlign = ROW_FLEX_TO_TEXT_ALIGN[rowFlex];
    }
    para.text = para.runs
      .filter(r => r.text !== undefined && r.type !== 'tab')
      .map(r => r.text)
      .join('');
    out.push(para);
    para = newParagraph();
  };

  for (const el of elementList || []) {
    if (!el) continue;

    if (el.type === 'image') {
      flushTextBuffer(buffer, para.runs);
      out.push({
        type: 'image',
        src: el.value || '',
        width: el.width,
        height: el.height,
        style: {},
      });
      continue;
    }

    if (el.type === 'table') {
      flushTextBuffer(buffer, para.runs);
      out.push(canvasTableToHwpxTable(el));
      continue;
    }

    if (el.type === 'tab') {
      flushTextBuffer(buffer, para.runs);
      para.runs.push({ type: 'tab', style: {} });
      continue;
    }

    if (el.type === 'pageBreak') {
      flushTextBuffer(buffer, para.runs);
      para.runs.push({ type: 'pagebreak' });
      continue;
    }

    if (el.type === 'hyperlink') {
      flushTextBuffer(buffer, para.runs);
      const text = (el.valueList || []).map(v => v?.value || '').join('');
      const style = el.valueList && el.valueList[0] ? elementStyleToRunStyle(el.valueList[0]) : {};
      para.runs.push({
        text,
        hyperlink: { url: el.url || '', text },
        style,
      });
      continue;
    }

    if (isPlainTextElement(el)) {
      const value = el.value || '';
      const style = elementStyleToRunStyle(el);
      for (const ch of value) {
        if (ch === '\n') {
          finishParagraph(el.rowFlex);
        } else {
          appendChar(buffer, para.runs, ch, style);
        }
      }
    }
  }

  flushTextBuffer(buffer, para.runs);
  if (para.runs.length > 0) {
    para.text = para.runs
      .filter(r => r.text !== undefined && r.type !== 'tab')
      .map(r => r.text)
      .join('');
    out.push(para);
  }

  return out;
}

function canvasTableToHwpxTable(tableEl) {
  const trList = tableEl.trList || [];
  const colgroup = tableEl.colgroup || [];
  const totalWidth = colgroup.reduce((sum, c) => sum + (c.width || 0), 0);

  const rows = trList.map(tr => {
    const cells = (tr.tdList || []).map(td => ({
      elements: elementsToCellOrSection(td.value || []),
      colSpan: td.colspan && td.colspan > 1 ? td.colspan : undefined,
      rowSpan: td.rowspan && td.rowspan > 1 ? td.rowspan : undefined,
      style: {},
    }));
    return {
      cells,
      style: tr.height ? { height: `${tr.height}px` } : {},
    };
  });

  return {
    type: 'table',
    rows,
    style: totalWidth ? { width: `${totalWidth}px` } : {},
  };
}

/**
 * Convert canvas-editor IEditorData back to a HWPX-shaped document.
 *
 * @param {{ main: object[], header?: object[], footer?: object[] }} data
 * @returns {{ sections: Array<{ elements: object[], pageSettings: object, headers: object, footers: object }> }}
 */
export function canvasEditorToHwpx(data) {
  const main = data?.main || [];
  const elements = elementsToCellOrSection(main);

  return {
    sections: [
      {
        elements,
        pageSettings: {},
        headers: { both: null, odd: null, even: null },
        footers: { both: null, odd: null, even: null },
        footnotes: [],
        endnotes: [],
        pageNum: null,
        colPr: null,
      },
    ],
  };
}

export default canvasEditorToHwpx;
