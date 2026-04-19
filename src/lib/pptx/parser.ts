/**
 * PPTX Parser
 * PowerPoint 파일을 편집기 문서 데이터(HWPXDocument)로 변환
 *
 * @module lib/pptx/parser
 * @version 1.0.0
 */

interface Run {
  text: string;
  type?: string;
  inlineStyle?: Record<string, any>;
}

interface Element {
  type: string;
  runs?: Run[];
  rows?: any[];
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

// EMU to px (1 inch = 914400 EMU, 96 DPI)
function emuToPx(emu: number): number {
  return Math.round(emu / 914400 * 96);
}

function local(el: globalThis.Element): string {
  return el.localName || el.nodeName.split(':').pop() || '';
}

function findAll(parent: globalThis.Element, localName: string): globalThis.Element[] {
  const results: globalThis.Element[] = [];
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (local(all[i]) === localName) results.push(all[i]);
  }
  return results;
}

function findFirst(parent: globalThis.Element, localName: string): globalThis.Element | null {
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (local(all[i]) === localName) return all[i];
  }
  return null;
}

/**
 * PPTX 파일을 문서 데이터로 변환
 * 각 슬라이드가 하나의 Section이 됨
 */
export async function parsePptx(buffer: ArrayBuffer, fileName: string): Promise<DocumentData> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  // 슬라이드 파일 목록 정렬
  const slideFiles = Object.keys(zip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    throw new Error('유효한 PPTX 파일이 아닙니다 (슬라이드 없음)');
  }

  // 프레젠테이션 크기 (기본 16:9 = 12192000 x 6858000 EMU)
  let slideWidthPx = 960;
  let slideHeightPx = 540;
  try {
    const presXml = await zip.file('ppt/presentation.xml')?.async('string');
    if (presXml) {
      const presDoc = new DOMParser().parseFromString(presXml, 'application/xml');
      const sldSz = findFirst(presDoc.documentElement, 'sldSz');
      if (sldSz) {
        const cx = sldSz.getAttribute('cx');
        const cy = sldSz.getAttribute('cy');
        if (cx) slideWidthPx = emuToPx(parseInt(cx, 10));
        if (cy) slideHeightPx = emuToPx(parseInt(cy, 10));
      }
    }
  } catch (err) { console.warn('[PPTX Parser] 슬라이드 크기 추출 실패, 기본값 사용:', err); }

  // 이미지 추출
  const images = new Map<string, any>();
  const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
  for (const path of mediaFiles) {
    try {
      const blob = await zip.file(path)!.async('blob');
      const ext = path.split('.').pop()?.toLowerCase() || 'png';
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', svg: 'image/svg+xml', emf: 'image/emf', wmf: 'image/wmf',
      };
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: mimeMap[ext] || 'image/png' }));
      // 파일명 기준으로 매핑
      const shortPath = path.replace('ppt/', '');
      images.set(shortPath, { src: objectUrl, path });
    } catch (err) { console.warn('[PPTX Parser] 리소스 로드 실패:', err); }
  }

  // 각 슬라이드별 relationships 로드
  const sections: Section[] = [];

  for (let slideIdx = 0; slideIdx < slideFiles.length; slideIdx++) {
    const slidePath = slideFiles[slideIdx];
    const slideXml = await zip.file(slidePath)?.async('string');
    if (!slideXml) continue;

    // Relationships
    const slideNum = slidePath.match(/slide(\d+)/)?.[1] || '1';
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const relsMap = new Map<string, string>();
    try {
      const relsXml = await zip.file(relsPath)?.async('string');
      if (relsXml) {
        const relDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
        const rels = relDoc.getElementsByTagName('Relationship');
        for (let i = 0; i < rels.length; i++) {
          const id = rels[i].getAttribute('Id');
          const target = rels[i].getAttribute('Target');
          if (id && target) relsMap.set(id, target.replace('../', ''));
        }
      }
    } catch (err) { console.warn('[PPTX Parser] 리소스 로드 실패:', err); }

    const slideDoc = new DOMParser().parseFromString(slideXml, 'application/xml');
    const elements: Element[] = [];

    // 슬라이드 번호 표시
    elements.push({
      type: 'paragraph',
      runs: [{ text: `슬라이드 ${slideIdx + 1}`, inlineStyle: { bold: true, fontSize: '10pt', color: '#888' } }],
      style: { textAlign: 'right', marginBottom: '4px' },
    });

    // 도형(sp) 파싱 — 텍스트 프레임 포함
    const shapes = findAll(slideDoc.documentElement, 'sp');
    for (const sp of shapes) {
      const txBody = findFirst(sp, 'txBody');
      if (!txBody) continue;

      const paragraphs = findAll(txBody, 'p');
      for (const p of paragraphs) {
        const runs: Run[] = [];
        const rNodes = findAll(p, 'r');

        for (const r of rNodes) {
          const text = findFirst(r, 't')?.textContent || '';
          if (!text) continue;

          const rPr = findFirst(r, 'rPr');
          const style: Record<string, any> = {};

          if (rPr) {
            const b = rPr.getAttribute('b');
            if (b === '1') style.bold = true;

            const i = rPr.getAttribute('i');
            if (i === '1') style.italic = true;

            const u = rPr.getAttribute('u');
            if (u && u !== 'none') style.underline = true;

            const sz = rPr.getAttribute('sz');
            if (sz) {
              const pt = parseInt(sz, 10) / 100;
              style.fontSize = `${pt}pt`;
            }

            // 색상
            const solidFill = findFirst(rPr, 'solidFill');
            if (solidFill) {
              const srgbClr = findFirst(solidFill, 'srgbClr');
              if (srgbClr) {
                const val = srgbClr.getAttribute('val');
                if (val) style.color = `#${val}`;
              }
            }
          }

          runs.push({
            text,
            inlineStyle: Object.keys(style).length > 0 ? style : undefined,
          });
        }

        if (runs.length > 0) {
          const pPr = findFirst(p, 'pPr');
          const paraStyle: Record<string, any> = {};

          if (pPr) {
            const algn = pPr.getAttribute('algn');
            if (algn) {
              const alignMap: Record<string, string> = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
              paraStyle.textAlign = alignMap[algn] || 'left';
            }
          }

          elements.push({
            type: 'paragraph',
            runs,
            style: Object.keys(paraStyle).length > 0 ? paraStyle : undefined,
          });
        }
      }
    }

    // 이미지(pic) 파싱
    const pics = findAll(slideDoc.documentElement, 'pic');
    for (const pic of pics) {
      const blipFill = findFirst(pic, 'blipFill');
      if (!blipFill) continue;

      const blip = findFirst(blipFill, 'blip');
      if (!blip) continue;

      const embed = blip.getAttribute('r:embed') || blip.getAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
      if (!embed) continue;

      const target = relsMap.get(embed);
      if (!target || !images.has(target)) continue;

      const imgInfo = images.get(target);

      // 크기 추출
      let widthPx = 400, heightPx = 300;
      const ext = findFirst(pic, 'ext');
      if (ext) {
        const cx = ext.getAttribute('cx');
        const cy = ext.getAttribute('cy');
        if (cx) widthPx = emuToPx(parseInt(cx, 10));
        if (cy) heightPx = emuToPx(parseInt(cy, 10));
      }

      elements.push({
        type: 'image',
        src: imgInfo.src,
        width: Math.min(widthPx, slideWidthPx - 80),
        height: Math.round(Math.min(widthPx, slideWidthPx - 80) * heightPx / widthPx),
        alt: '슬라이드 이미지',
      });
    }

    // 테이블(tbl) 파싱
    const tables = findAll(slideDoc.documentElement, 'tbl');
    for (const tbl of tables) {
      const tblRows = findAll(tbl, 'tr');
      const rows: Array<{ cells: Array<{ elements: Element[]; colSpan?: number; rowSpan?: number; style?: Record<string, any> }> }> = [];

      for (const tr of tblRows) {
        const cells: Array<{ elements: Element[]; colSpan?: number; rowSpan?: number; style?: Record<string, any> }> = [];
        const tcs = findAll(tr, 'tc');

        for (const tc of tcs) {
          const cellElements: Element[] = [];
          const txBody = findFirst(tc, 'txBody');
          if (txBody) {
            const paras = findAll(txBody, 'p');
            for (const p of paras) {
              const runs: Run[] = [];
              const rNodes = findAll(p, 'r');
              for (const r of rNodes) {
                const text = findFirst(r, 't')?.textContent || '';
                if (text) runs.push({ text });
              }
              if (runs.length > 0) {
                cellElements.push({ type: 'paragraph', runs });
              }
            }
          }
          if (cellElements.length === 0) {
            cellElements.push({ type: 'paragraph', runs: [{ text: '' }] });
          }

          const gridSpan = parseInt(tc.getAttribute('gridSpan') || '1', 10);
          const rowSpan = parseInt(tc.getAttribute('rowSpan') || '1', 10);
          const cellData: { elements: Element[]; colSpan?: number; rowSpan?: number; style?: Record<string, any> } = {
            elements: cellElements,
            style: { padding: '4px 6px' },
          };
          if (gridSpan > 1) cellData.colSpan = gridSpan;
          if (rowSpan > 1) cellData.rowSpan = rowSpan;
          cells.push(cellData);
        }

        if (cells.length > 0) rows.push({ cells });
      }

      if (rows.length > 0) {
        elements.push({ type: 'table', rows, style: { width: '100%' } });
      }
    }

    // 빈 슬라이드면 빈 문단 추가
    if (elements.length <= 1) {
      elements.push({ type: 'paragraph', runs: [{ text: '(빈 슬라이드)', inlineStyle: { italic: true, color: '#999' } }] });
    }

    // 슬라이드 구분선
    elements.push({
      type: 'paragraph',
      runs: [{ text: '' }],
      style: { borderBottom: '1px solid #ddd', marginTop: '16px', marginBottom: '16px' },
    });

    sections.push({
      elements,
      pageSettings: {
        width: `${slideWidthPx}px`,
        height: `${slideHeightPx}px`,
        marginLeft: '40px',
        marginRight: '40px',
        marginTop: '30px',
        marginBottom: '30px',
      },
      pageWidth: slideWidthPx,
      pageHeight: slideHeightPx,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    });
  }

  return {
    sections,
    images,
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: sections.length,
      imagesCount: images.size,
      borderFillsCount: 0,
      sourceFormat: 'pptx',
      fileName,
      totalSlides: slideFiles.length,
    },
    cleanup() {
      for (const [, img] of images) {
        if (img?.src) URL.revokeObjectURL(img.src);
      }
      images.clear();
    },
  } as any;
}

export default { parsePptx };
