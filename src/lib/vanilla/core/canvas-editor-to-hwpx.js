/**
 * canvas-editor IEditorData → HWPX-shaped document converter
 *
 * Inverse of hwpx-to-canvas-editor.js. Produces a document object that
 * matches the shape parser.js emits, so that downstream HWPX writers /
 * AI pipelines / serializers can keep using their existing entry points.
 *
 * Phase 2 보강:
 *   - 트레일링 newline 의 `_meta.numbering` → para.numPr / numberingDef / numberingLevel
 *   - `hwpxNote` 엘리먼트 → footnote / endnote 런 + 섹션 레벨 note body 복원
 *   - `hwpxField` 엘리먼트 → field 런 (`type: 'field', fieldType, ...`) 복원
 *   - data._sectionMeta → 섹션 헤더/푸터/페이지 설정/노트 복원
 *
 * 여전히 lossy 한 영역:
 *   - canvas-editor 가 모르는 paraPrIDRef / borderFills / named styles
 *   - 복잡한 floating object positioning
 *   - OLE / encryption / 매크로
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

function elementsToCellOrSection(elementList, collectedNotes) {
  const out = [];
  let para = newParagraph();
  const buffer = { text: '', style: {}, signature: '' };

  const finishParagraph = (rowFlex, meta) => {
    flushTextBuffer(buffer, para.runs);
    if (rowFlex && ROW_FLEX_TO_TEXT_ALIGN[rowFlex]) {
      para.style.textAlign = ROW_FLEX_TO_TEXT_ALIGN[rowFlex];
    }
    // Phase 2: trailing newline 의 _meta 에 numbering 이 실려 있으면 복원.
    if (meta?.numbering) {
      const n = meta.numbering;
      if (n.numPr) para.numPr = { ...n.numPr };
      if (n.numberingDef) para.numberingDef = n.numberingDef;
      if (n.numberingLevel) para.numberingLevel = n.numberingLevel;
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

    // Phase 2: footnote / endnote 복원
    if (el.type === 'hwpxNote') {
      flushTextBuffer(buffer, para.runs);
      const meta = el._meta?.footnote || {};
      const kind = meta.kind === 'endnote' ? 'endnote' : 'footnote';
      const run = {
        type: kind,
        number: meta.number || null,
        text: el.value || (meta.number ? `[${meta.number}]` : ''),
        style: elementStyleToRunStyle(el),
      };
      para.runs.push(run);
      if (collectedNotes && meta.number) {
        const bucket = kind === 'endnote' ? collectedNotes.endnotes : collectedNotes.footnotes;
        // 컨텐츠 본문이 있다면 보존 (round-trip 입력에 _meta.body 가 있을 때만)
        bucket.push({
          type: kind,
          number: meta.number,
          id: meta.id || null,
          paragraphs: meta.paragraphs || [],
        });
      }
      continue;
    }

    // Phase 2: field 런 복원
    if (el.type === 'hwpxField') {
      flushTextBuffer(buffer, para.runs);
      const meta = el._meta?.field || {};
      para.runs.push({
        type: 'field',
        fieldType: meta.fieldType || 'UNKNOWN',
        text: el.value || '',
        style: elementStyleToRunStyle(el),
        ...(meta.dateFormat ? { dateFormat: meta.dateFormat } : {}),
        ...(meta.fieldName ? { fieldName: meta.fieldName } : {}),
        ...(meta.hyperlink ? { hyperlink: meta.hyperlink } : {}),
      });
      continue;
    }

    if (el.type === 'hwpxShape') {
      // 라운드트립 보존: hwpx-to-canvas-editor 가 _shape 메타에 원본 도형을 넣어둔다.
      // 인라인이었으면 (treatAsChar) 현재 단락에 shape 런으로 부착하고,
      // 그 외에는 섹션 레벨 standalone shape 으로 emit 한다.
      flushTextBuffer(buffer, para.runs);
      const shape = el._shape || {
        type: 'shape',
        shapeType: 'rectangle',
        style: {},
        position: {},
        drawText: null,
        borderRadius: 0,
        width: el.width,
        height: el.height,
      };
      // 새 객체로 복사하여 원본 오염 방지
      const restored = { ...shape };
      if (restored.treatAsChar) {
        if (!para.shapes) para.shapes = [];
        para.shapes.push(restored);
        para.runs.push({ text: '', hasShape: true, style: {} });
      } else {
        out.push(restored);
      }
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
          finishParagraph(el.rowFlex, el._meta);
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
 * @param {{ main: object[], header?: object[], footer?: object[], _sectionMeta?: object[] }} data
 * @returns {{ sections: Array<{ elements: object[], pageSettings: object, headers: object, footers: object, footnotes: object[], endnotes: object[] }> }}
 */
export function canvasEditorToHwpx(data) {
  const main = data?.main || [];
  const collected = { footnotes: [], endnotes: [] };
  const elements = elementsToCellOrSection(main, collected);

  // Phase 2: _sectionMeta 가 있으면 그대로 흡수 (hwpxToCanvasEditor 가 채움).
  // 없으면 호환을 위해 기존 빈 객체 유지.
  const sectionMeta =
    Array.isArray(data?._sectionMeta) && data._sectionMeta.length > 0 ? data._sectionMeta[0] : null;

  // 노트 본문: _sectionMeta 의 footnotes/endnotes (원본 파라그래프 포함)
  // 가 우선이며, 없으면 본문 안 hwpxNote 마커에서 수집한 stub 을 사용.
  const footnotes =
    sectionMeta?.footnotes && sectionMeta.footnotes.length > 0
      ? sectionMeta.footnotes
      : collected.footnotes;
  const endnotes =
    sectionMeta?.endnotes && sectionMeta.endnotes.length > 0
      ? sectionMeta.endnotes
      : collected.endnotes;

  return {
    sections: [
      {
        elements,
        pageSettings: sectionMeta?.pageSettings || {},
        headers: sectionMeta?.headers || { both: null, odd: null, even: null },
        footers: sectionMeta?.footers || { both: null, odd: null, even: null },
        footnotes,
        endnotes,
        pageNum: sectionMeta?.pageNum || null,
        colPr: sectionMeta?.colPr || null,
      },
    ],
  };
}

export default canvasEditorToHwpx;
