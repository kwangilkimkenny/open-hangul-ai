/**
 * HWPX → canvas-editor IEditorData converter
 *
 * Maps the HWPXDocument shape produced by parser.js
 *   { sections: [{ elements: [{ type: 'paragraph' | 'table' | 'image', ... }] }] }
 * to the canvas-editor IEditorData shape
 *   { main: IElement[], header?: IElement[], footer?: IElement[] }
 *
 * Phase 1 scope (initial):
 *   - paragraphs with text runs (font / size / bold / italic / underline / color / highlight / strikeout)
 *   - paragraph-level horizontal alignment via RowFlex on the trailing newline
 *   - inline tab / linebreak / pagebreak runs
 *   - inline hyperlinks
 *   - tables (basic colgroup + trList; cell content recursively converted)
 *   - inline + standalone images
 *   - shapes (round-tripped through `_shape` meta on a custom element)
 *
 * Phase 2 (round-trip lossless 보강):
 *   - list numbering: para.numPr / numberingDef → `_meta.numbering` on the
 *     trailing newline, plus canvas-editor `listType` hint when possible.
 *   - footnotes / endnotes: footnote run → custom `hwpxNote` element with
 *     `_meta.footnote = { kind, number, paragraphs }` so writers can restore
 *     the original section-level note bodies.
 *   - fields: field run → `hwpxField` element holding the original
 *     `_meta.field = { fieldType, ... }` payload (plain rendered text as value)
 *   - section-level header / footer / footnote / endnote payloads survive on
 *     `_sectionMeta` (returned as a sibling of `main`).
 *
 * Still out of scope:
 *   complex floating positions, OLE objects, encryption.
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

/**
 * Phase 2: 문단 단위로 보존되는 메타데이터.
 * numbering(번호 매기기) 정의/레벨이 있으면 객체로 반환하고,
 * 없으면 undefined.
 */
function paragraphNumberingMeta(para) {
  if (!para) return undefined;
  if (!para.numPr && !para.numberingDef && !para.numberingLevel) return undefined;
  const meta = {};
  if (para.numPr) meta.numPr = { ...para.numPr };
  if (para.numberingDef) meta.numberingDef = para.numberingDef;
  if (para.numberingLevel) meta.numberingLevel = para.numberingLevel;
  return meta;
}

/**
 * canvas-editor 의 표준 list 타입 추정.
 * HWPX numFormat (DECIMAL/HANGUL/UPPER_ROMAN ...) → canvas-editor (ol/ul) 매핑은
 * 1:1 이 아니지만, 라운드트립 손실 최소화를 위해 가능한 한 hint 만 남긴다.
 */
function inferListHint(numbering) {
  if (!numbering?.numberingLevel) return undefined;
  const fmt = String(numbering.numberingLevel.numFormat || '').toUpperCase();
  if (!fmt) return undefined;
  if (fmt === 'BULLET' || fmt === 'NONE') {
    return { listType: 'ul', listStyle: 'disc' };
  }
  return { listType: 'ol', listStyle: 'decimal' };
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

/**
 * 도형(shape) 라운드트립을 위한 캔버스-에디터 요소.
 * canvas-editor 가 'hwpxShape' 타입을 모르더라도 우리 컨버터 페어가
 * _shape 메타를 이용해 HWPX 모델로 복원할 수 있도록 한다.
 */
function shapeToElement(shape) {
  const width = parseLengthPx(shape.width, 100);
  const height = parseLengthPx(shape.height, 60);
  return {
    type: 'hwpxShape',
    value: '',
    width,
    height,
    _shape: shape,
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

/**
 * Phase 2: footnote / endnote 런 → custom hwpxNote 엘리먼트.
 * canvas-editor 가 hwpxNote 를 모르더라도 우리 컨버터 페어가
 * `_meta.footnote` 를 통해 원본 노트 본문을 복원할 수 있다.
 */
function noteRunToElement(run) {
  const baseAttrs = styleToElementAttrs(run.style);
  const text = run.text || (run.number ? `[${run.number}]` : '[note]');
  return {
    type: 'hwpxNote',
    value: text,
    ...baseAttrs,
    _meta: {
      footnote: {
        kind: run.type, // 'footnote' | 'endnote'
        number: run.number || null,
      },
    },
  };
}

/**
 * Phase 2: field 런 → custom hwpxField 엘리먼트.
 * canvas-editor 는 field 타입을 모르므로 rendered text 만 노출하되
 * `_meta.field` 에 원본을 보존한다.
 */
function fieldRunToElement(run) {
  const baseAttrs = styleToElementAttrs(run.style);
  const text = run.text || `{${run.fieldType || 'FIELD'}}`;
  return {
    type: 'hwpxField',
    value: text,
    ...baseAttrs,
    _meta: {
      field: {
        fieldType: run.fieldType || 'UNKNOWN',
        ...(run.dateFormat ? { dateFormat: run.dateFormat } : {}),
        ...(run.fieldName ? { fieldName: run.fieldName } : {}),
        ...(run.hyperlink ? { hyperlink: run.hyperlink } : {}),
      },
    },
  };
}

function pushParagraph(out, para) {
  const flex = paragraphRowFlex(para);
  const numbering = paragraphNumberingMeta(para);
  const listHint = inferListHint(numbering);
  const breakAttrs = flex ? { rowFlex: flex } : {};
  // 마지막 newline 에 메타를 부착하면 round-trip 시 같은 문단으로 묶이는 키 역할.
  const tailAttrs = { ...breakAttrs };
  if (numbering || listHint) {
    tailAttrs._meta = {
      ...(numbering ? { numbering } : {}),
      ...(listHint ? { list: listHint } : {}),
    };
  }

  const runs = para.runs || [];
  // parser.js 는 hasShape 런에 shapeIndex 를 달지 않고 등장 순서대로 para.shapes 에 push 한다.
  // 같은 순서 가정으로 카운터를 사용해 짝을 맞춘다.
  let shapeCursor = 0;
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
    // Phase 2: footnote / endnote 런
    if (run.type === 'footnote' || run.type === 'endnote') {
      out.push(noteRunToElement(run));
      continue;
    }
    // Phase 2: field 런 (parser._parseFieldCode 결과)
    if (run.type === 'field') {
      out.push(fieldRunToElement(run));
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
      const shape = para.shapes && para.shapes[shapeCursor];
      shapeCursor++;
      if (shape) {
        out.push(shapeToElement(shape));
      }
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

  out.push({ value: '\n', ...tailAttrs });
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
    } else if (elem.type === 'shape') {
      out.push(shapeToElement(elem));
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
 * Phase 2: section-level meta (footnotes / endnotes / header / footer / pageSettings)
 * 를 canvas-editor IEditorData 의 `_sectionMeta` 로 전달한다.
 *
 * canvas-editor 는 이 키를 모르지만, canvas-editor-to-hwpx 가 다시 HWPX 로
 * 직렬화할 때 그대로 복원할 수 있도록 보존한다.
 */
function collectSectionMeta(section) {
  if (!section) return null;
  const meta = {};
  if (Array.isArray(section.footnotes) && section.footnotes.length > 0) {
    meta.footnotes = section.footnotes;
  }
  if (Array.isArray(section.endnotes) && section.endnotes.length > 0) {
    meta.endnotes = section.endnotes;
  }
  if (section.headers && Object.values(section.headers).some(v => v)) {
    meta.headers = section.headers;
  }
  if (section.footers && Object.values(section.footers).some(v => v)) {
    meta.footers = section.footers;
  }
  if (section.pageSettings && Object.keys(section.pageSettings).length > 0) {
    meta.pageSettings = section.pageSettings;
  }
  if (section.pageNum) meta.pageNum = section.pageNum;
  if (section.colPr) meta.colPr = section.colPr;
  return Object.keys(meta).length > 0 ? meta : null;
}

/**
 * Convert a parsed HWPXDocument (parser.js output) to canvas-editor IEditorData.
 *
 * @param {object} doc HWPXDocument with { sections: [...] }
 * @returns {{ main: object[], _sectionMeta?: object[] }}
 */
export function hwpxToCanvasEditor(doc) {
  const main = [];
  if (!doc || !Array.isArray(doc.sections)) {
    main.push({ value: '\n' });
    return { main };
  }

  const sectionMetas = [];
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
      } else if (elem.type === 'shape') {
        // 섹션 레벨에 떠있는 standalone shape 도 보존한다.
        main.push(shapeToElement(elem));
        main.push({ value: '\n' });
      }
    }
    const meta = collectSectionMeta(section);
    if (meta) sectionMetas.push(meta);
  }

  if (main.length === 0) main.push({ value: '\n' });
  const result = { main };
  if (sectionMetas.length > 0) result._sectionMeta = sectionMetas;
  return result;
}

export default hwpxToCanvasEditor;
