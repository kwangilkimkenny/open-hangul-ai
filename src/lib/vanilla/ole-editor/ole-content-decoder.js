/**
 * OLE 콘텐츠 디코더
 * ─────────────────────────────────────────────────────────────────────────────
 * 트랙 M (`vanilla/ole/ole-parser.js`)는 OLE 컨테이너의 메타데이터 + 미리보기만
 * 추출한다. 이 모듈은 OLE 객체 안에 들어 있는 *실제 콘텐츠* (Excel 시트, Word
 * 문서, PowerPoint 슬라이드) 를 브라우저에서 편집 가능한 자료구조로 디코딩한다.
 *
 *  - CFB(.xls/.doc/.ppt) → 본 구현에서는 OLE-Native 스트림이 OOXML zip 일 때만
 *    네이티브 디코딩하고, 그 외에는 `unsupported` 로 반환한다.
 *  - OOXML zip(.xlsx/.docx/.pptx) → exceljs / docx-zip / pptx zip 으로 직접 디코딩.
 *
 * 출력 스키마
 *   decodeExcel       → { type:'excel', sheets:[{name,rows:[[{value,formula?,style?}]]}], activeSheet }
 *   decodeWord        → { type:'word', paragraphs:[{runs:[{text,bold?,italic?,underline?}], align?}] }
 *   decodePowerPoint  → { type:'powerpoint', slides:[{title?, body:[string]}] }
 *   unsupported       → { type:'unsupported', message, oleType? }
 *
 * 보안
 *   - 매크로/VBA/외부 링크는 절대 평가하지 않는다.
 *   - 외부 fetch/네트워크 호출 없음.
 *
 * @module vanilla/ole-editor/ole-content-decoder
 */

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseOle } from '../ole/ole-parser.js';
import { detectOleContainerFormat } from '../utils/file-format-detector.js';

// ============================================================================
// Container sniffing
// ============================================================================

function toUint8(input) {
  if (!input) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input;
  if (input?.data instanceof Uint8Array) return input.data;
  if (Array.isArray(input)) return new Uint8Array(input);
  if (input?.buffer) return new Uint8Array(input.buffer);
  return new Uint8Array(0);
}

/**
 * OLE bytes 가 OOXML zip 인지, CFB 인지, raw 메타파일(EMF/WMF)인지 분류.
 *
 * 실제 매직넘버 매칭은 `../utils/file-format-detector.js` 의 단일 카탈로그에
 * 위임한다. 이 함수는 OLE 콘텐츠 분기 친화적 라벨(ooxml/cfb/metafile)로
 * 매핑하는 얇은 어댑터다.
 *
 * @param {Uint8Array} bytes
 * @returns {'ooxml'|'cfb'|'metafile'|'unknown'}
 */
export function detectOleContainer(bytes) {
  return detectOleContainerFormat(bytes);
}

/**
 * OLE 메타 + container 판별. 실패 시 null.
 *
 * @param {Uint8Array|{data:Uint8Array, filename?:string}} input
 * @param {string} [filename]
 * @returns {{bytes:Uint8Array, container:string, oleType:string, filename:string}|null}
 */
export function sniffOleContent(input, filename) {
  const bytes = toUint8(input);
  if (bytes.byteLength === 0) return null;
  const meta = parseOle(input, filename);
  const oleType = meta?.type || 'unknown';
  const container = detectOleContainer(bytes);
  return {
    bytes,
    container,
    oleType,
    filename: meta?.metadata?.originalName || filename || '',
  };
}

// ============================================================================
// Excel decoding (exceljs)
// ============================================================================

/**
 * 단일 worksheet 를 `{name, rows}` 모델로 변환.
 *
 * R6 후속: 시트별 변환을 외부로 노출 가능한 단위로 분리하여 lazy load 시
 * 재사용 가능하도록 했다.
 *
 * @param {ExcelJS.Worksheet} ws
 * @param {number} [fallbackIndex]
 * @returns {{name:string, rows:Array<Array<{value:any,formula?:string}>>}}
 */
export function normalizeSheet(ws, fallbackIndex = 0) {
  const rows = [];
  const maxRow = ws.actualRowCount || ws.rowCount || 0;
  const maxCol = ws.actualColumnCount || ws.columnCount || 0;
  for (let r = 1; r <= Math.max(maxRow, 1); r++) {
    const row = [];
    for (let c = 1; c <= Math.max(maxCol, 1); c++) {
      const cell = ws.getCell(r, c);
      const cellModel = { value: null };
      const raw = cell.value;
      if (raw && typeof raw === 'object') {
        if (typeof raw.formula === 'string') {
          cellModel.formula = raw.formula.startsWith('=') ? raw.formula : `=${raw.formula}`;
          if ('result' in raw) cellModel.value = raw.result ?? null;
        } else if ('text' in raw) {
          cellModel.value = raw.text;
        } else if (raw instanceof Date) {
          cellModel.value = raw.toISOString();
        } else {
          cellModel.value = raw;
        }
      } else {
        cellModel.value = raw === undefined ? null : raw;
      }
      row.push(cellModel);
    }
    rows.push(row);
  }
  return { name: ws.name || `Sheet${ws.id || fallbackIndex + 1}`, rows };
}

/**
 * exceljs 워크북을 단순 JSON 모델로 변환.
 *
 * @param {ExcelJS.Workbook} wb
 * @param {object} [options]
 * @param {boolean} [options.activeSheetOnly=false]  true 면 활성 시트만 normalize,
 *                                                   나머지는 `{name, lazy:true}` 메타만 채운다.
 * @returns {{
 *   sheets:Array<{name:string, rows?:Array, lazy?:boolean}>,
 *   activeSheet:string,
 *   _totalSheets:number,
 *   _loadedSheets:string[]
 * }}
 */
function normalizeWorkbook(wb, { activeSheetOnly = false } = {}) {
  const all = wb.worksheets;
  const visible = all.find(ws => ws.state !== 'hidden');
  const activeName = visible ? visible.name : all[0]?.name || 'Sheet1';
  const sheets = [];
  const loaded = [];
  for (let i = 0; i < all.length; i++) {
    const ws = all[i];
    const name = ws.name || `Sheet${ws.id || i + 1}`;
    if (activeSheetOnly && name !== activeName) {
      sheets.push({ name, lazy: true });
      continue;
    }
    const norm = normalizeSheet(ws, i);
    sheets.push(norm);
    loaded.push(norm.name);
  }
  return {
    sheets,
    activeSheet: activeName,
    _totalSheets: all.length,
    _loadedSheets: loaded,
  };
}

/**
 * Excel OLE 콘텐츠를 디코딩한다.
 *
 * `options.activeSheetOnly` 가 true 면 활성 시트만 셀 모델까지 변환하고,
 * 나머지는 `{name, lazy:true}` 자리표시로만 포함한다. 100시트 워크북의
 * 미리보기 페이로드를 크게 줄이는 데 유용하다. 사용자가 다른 시트를
 * 클릭하면 `loadSheet(bytes, sheetName)` 를 호출해 lazy hydrate 한다.
 *
 * @param {Uint8Array|{data:Uint8Array, filename?:string}} oleData
 * @param {string} [filename]
 * @param {object} [options]
 * @param {boolean} [options.activeSheetOnly=false]
 * @returns {Promise<object>} normalized workbook or unsupported envelope
 */
export async function decodeExcel(oleData, filename, options = {}) {
  const sniff = sniffOleContent(oleData, filename);
  if (!sniff) {
    return { type: 'unsupported', message: 'Empty OLE input' };
  }
  if (sniff.container === 'cfb') {
    return {
      type: 'unsupported',
      message: 'Legacy .xls (BIFF8) is not supported in the browser inline editor',
      oleType: 'excel',
    };
  }
  if (sniff.container !== 'ooxml') {
    return {
      type: 'unsupported',
      message: `Unsupported Excel container: ${sniff.container}`,
      oleType: 'excel',
    };
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(sniff.bytes);
  } catch (err) {
    return {
      type: 'unsupported',
      message: `Failed to parse xlsx: ${err?.message || err}`,
      oleType: 'excel',
    };
  }
  const norm = normalizeWorkbook(wb, { activeSheetOnly: !!options.activeSheetOnly });
  return { type: 'excel', ...norm };
}

/**
 * 이미 로드된 워크북 bytes 에서 특정 시트 1개만 하이드레이트.
 *
 * `decodeExcel(..., { activeSheetOnly:true })` 결과의 lazy 시트를 클릭 시
 * 호출하는 용도. 미리보기 흐름에서 100시트 중 사용자가 본 1~2개만 셀 모델을
 * 만들고 나머지는 메타만 유지하기 위한 진입점이다.
 *
 * @param {Uint8Array|{data:Uint8Array, filename?:string}} oleData
 * @param {string} sheetName
 * @returns {Promise<{name:string, rows:Array}|null>}
 */
export async function loadSheet(oleData, sheetName) {
  const sniff = sniffOleContent(oleData);
  if (!sniff || sniff.container !== 'ooxml') return null;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(sniff.bytes);
  } catch {
    return null;
  }
  const all = wb.worksheets;
  for (let i = 0; i < all.length; i++) {
    if (all[i].name === sheetName) {
      return normalizeSheet(all[i], i);
    }
  }
  return null;
}

// ============================================================================
// Word decoding (OOXML docx via JSZip + XML)
// ============================================================================

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function getElementsByLocalName(node, localName) {
  if (!node || !node.getElementsByTagNameNS) return [];
  const out = [];
  const ns = node.getElementsByTagNameNS(W_NS, localName);
  for (let i = 0; i < ns.length; i++) out.push(ns[i]);
  return out;
}

function hasChild(node, localName) {
  if (!node || !node.getElementsByTagNameNS) return false;
  return node.getElementsByTagNameNS(W_NS, localName).length > 0;
}

function parseRunProperties(run) {
  const rPr = run.getElementsByTagNameNS(W_NS, 'rPr')[0];
  const props = {};
  if (!rPr) return props;
  if (hasChild(rPr, 'b')) props.bold = true;
  if (hasChild(rPr, 'i')) props.italic = true;
  if (hasChild(rPr, 'u')) props.underline = true;
  return props;
}

function parseParagraph(p) {
  const runs = [];
  const runEls = getElementsByLocalName(p, 'r');
  for (const r of runEls) {
    const textEls = r.getElementsByTagNameNS(W_NS, 't');
    let text = '';
    for (let i = 0; i < textEls.length; i++) text += textEls[i].textContent || '';
    if (!text) continue;
    runs.push({ text, ...parseRunProperties(r) });
  }
  // alignment
  const pPr = p.getElementsByTagNameNS(W_NS, 'pPr')[0];
  let align;
  if (pPr) {
    const jc = pPr.getElementsByTagNameNS(W_NS, 'jc')[0];
    if (jc) align = jc.getAttributeNS(W_NS, 'val') || jc.getAttribute('w:val') || undefined;
  }
  return { runs, ...(align ? { align } : {}) };
}

/**
 * Word OLE 콘텐츠를 디코딩한다.
 *
 * @param {Uint8Array|{data:Uint8Array,filename?:string}} oleData
 * @param {string} [filename]
 * @returns {Promise<object>}
 */
export async function decodeWord(oleData, filename) {
  const sniff = sniffOleContent(oleData, filename);
  if (!sniff) {
    return { type: 'unsupported', message: 'Empty OLE input' };
  }
  if (sniff.container === 'cfb') {
    return {
      type: 'unsupported',
      message: 'Legacy .doc (Word97) is not supported in the browser inline editor',
      oleType: 'word',
    };
  }
  if (sniff.container !== 'ooxml') {
    return {
      type: 'unsupported',
      message: `Unsupported Word container: ${sniff.container}`,
      oleType: 'word',
    };
  }

  const zip = new JSZip();
  try {
    await zip.loadAsync(sniff.bytes);
  } catch (err) {
    return {
      type: 'unsupported',
      message: `Failed to open docx zip: ${err?.message || err}`,
      oleType: 'word',
    };
  }
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    return {
      type: 'unsupported',
      message: 'docx missing word/document.xml',
      oleType: 'word',
    };
  }
  let xml = '';
  try {
    xml = await docFile.async('string');
  } catch (err) {
    return {
      type: 'unsupported',
      message: `Failed to read document.xml: ${err?.message || err}`,
      oleType: 'word',
    };
  }
  // 브라우저(jsdom 포함)에는 DOMParser 가 있다. Node 단독에서는 안전 가드.
  if (typeof DOMParser === 'undefined') {
    return {
      type: 'unsupported',
      message: 'DOMParser unavailable in this runtime',
      oleType: 'word',
    };
  }
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const paragraphs = [];
  const pEls = doc.getElementsByTagNameNS(W_NS, 'p');
  for (let i = 0; i < pEls.length; i++) {
    paragraphs.push(parseParagraph(pEls[i]));
  }
  return { type: 'word', paragraphs };
}

// ============================================================================
// PowerPoint decoding (best-effort, read-only)
// ============================================================================

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';

async function parseSlide(xml) {
  if (typeof DOMParser === 'undefined') return { title: '', body: [] };
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const spEls = doc.getElementsByTagNameNS(P_NS, 'sp');
  let title = '';
  const body = [];
  for (let i = 0; i < spEls.length; i++) {
    const sp = spEls[i];
    const ph = sp.getElementsByTagNameNS(P_NS, 'ph')[0];
    const isTitle = ph && /title/i.test(ph.getAttribute('type') || '');
    const tEls = sp.getElementsByTagNameNS(A_NS, 't');
    let text = '';
    for (let j = 0; j < tEls.length; j++) text += tEls[j].textContent || '';
    if (!text) continue;
    if (isTitle && !title) title = text;
    else body.push(text);
  }
  return { title, body };
}

/**
 * PowerPoint OLE 콘텐츠를 디코딩한다 (읽기 전용 슬라이드 텍스트).
 *
 * @param {Uint8Array|{data:Uint8Array,filename?:string}} oleData
 * @param {string} [filename]
 * @returns {Promise<object>}
 */
export async function decodePowerPoint(oleData, filename) {
  const sniff = sniffOleContent(oleData, filename);
  if (!sniff) return { type: 'unsupported', message: 'Empty OLE input' };
  if (sniff.container !== 'ooxml') {
    return {
      type: 'unsupported',
      message: `PowerPoint container ${sniff.container} not supported`,
      oleType: 'powerpoint',
    };
  }
  const zip = new JSZip();
  try {
    await zip.loadAsync(sniff.bytes);
  } catch (err) {
    return {
      type: 'unsupported',
      message: `Failed to open pptx zip: ${err?.message || err}`,
      oleType: 'powerpoint',
    };
  }
  const slideFiles = Object.keys(zip.files)
    .filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] || 0);
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] || 0);
      return na - nb;
    });
  if (slideFiles.length === 0) {
    return {
      type: 'unsupported',
      message: 'pptx contains no slides',
      oleType: 'powerpoint',
    };
  }
  const slides = [];
  for (const p of slideFiles) {
    const xml = await zip.file(p).async('string');
    slides.push(await parseSlide(xml));
  }
  return { type: 'powerpoint', slides };
}

// ============================================================================
// Dispatcher
// ============================================================================

/**
 * OLE 타입을 자동 감지해 적절한 디코더로 분기한다.
 * @param {Uint8Array|{data:Uint8Array, filename?:string}} input
 * @param {string} [filename]
 * @param {object} [options]  decodeExcel 등 하위 디코더로 전달.
 * @returns {Promise<object>}
 */
export async function decodeOle(input, filename, options = {}) {
  const sniff = sniffOleContent(input, filename);
  if (!sniff) return { type: 'unsupported', message: 'Empty OLE input' };
  switch (sniff.oleType) {
    case 'excel':
      return decodeExcel(input, filename, options);
    case 'word':
      return decodeWord(input, filename);
    case 'powerpoint':
      return decodePowerPoint(input, filename);
    default:
      return {
        type: 'unsupported',
        message: `Unknown OLE type for ${sniff.filename || 'object'}`,
        oleType: sniff.oleType,
      };
  }
}
