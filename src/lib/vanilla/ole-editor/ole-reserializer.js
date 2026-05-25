/**
 * OLE 재직렬화
 * ─────────────────────────────────────────────────────────────────────────────
 * 인플레이스 편집기에서 수정된 dataModel 을 다시 OLE 바이너리(=OOXML zip)로
 * 직렬화한다.
 *
 *  - Excel → exceljs.workbook.xlsx.writeBuffer()
 *  - Word  → 최소 OOXML zip (word/document.xml + 필수 part) 를 JSZip 로 조립
 *
 * 본 모듈은 새 OOXML 컨테이너를 만들 뿐, HWPX 본문 트랙(I) 으로의 통합은
 * 호출 측에서 처리한다.
 *
 * 입력 dataModel 은 `excel-editor` / `word-editor` 의 `getDataModel()` 출력과
 * 동일 스키마.
 *
 * @module vanilla/ole-editor/ole-reserializer
 */

import ExcelJS from 'exceljs';
import JSZip from 'jszip';

// ============================================================================
// Excel → xlsx
// ============================================================================

/**
 * Excel dataModel → xlsx Uint8Array.
 *
 * @param {{sheets:Array<{name:string,rows:Array<Array<{value:any,formula?:string}>>}>, activeSheet?:string}} dataModel
 * @returns {Promise<Uint8Array>}
 */
export async function serializeExcelToOle(dataModel) {
  if (!dataModel || !Array.isArray(dataModel.sheets)) {
    throw new Error('serializeExcelToOle: invalid dataModel');
  }
  const wb = new ExcelJS.Workbook();
  for (const s of dataModel.sheets) {
    const ws = wb.addWorksheet(s.name || `Sheet${wb.worksheets.length + 1}`);
    for (let r = 0; r < s.rows.length; r++) {
      const row = s.rows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        const target = ws.getCell(r + 1, c + 1);
        if (cell.formula) {
          const formula = cell.formula.startsWith('=') ? cell.formula.slice(1) : cell.formula;
          target.value = { formula, result: cell.value ?? null };
        } else if (cell.value !== null && cell.value !== undefined) {
          target.value = cell.value;
        }
      }
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

// ============================================================================
// Word → docx (minimal OOXML)
// ============================================================================

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
  '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
  '  <Default Extension="xml" ContentType="application/xml"/>\n' +
  '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n' +
  '  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>\n' +
  '</Types>\n';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
  '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n' +
  '</Relationships>\n';

const WORD_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
  '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n' +
  '</Relationships>\n';

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
  '  <w:docDefaults>\n' +
  '    <w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault>\n' +
  '  </w:docDefaults>\n' +
  '</w:styles>\n';

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildRunXml(run) {
  const props = [];
  if (run.bold) props.push('<w:b/>');
  if (run.italic) props.push('<w:i/>');
  if (run.underline) props.push('<w:u w:val="single"/>');
  const rPr = props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  const text = escapeXml(run.text ?? '');
  return `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

function buildParagraphXml(p) {
  const runs = (p.runs && p.runs.length > 0 ? p.runs : [{ text: '' }])
    .map(buildRunXml)
    .join('');
  let pPr = '';
  if (p.align && p.align !== 'left') {
    const val = p.align === 'justify' ? 'both' : p.align;
    pPr = `<w:pPr><w:jc w:val="${escapeXml(val)}"/></w:pPr>`;
  }
  return `<w:p>${pPr}${runs}</w:p>`;
}

/**
 * Word dataModel → docx Uint8Array.
 *
 * @param {{paragraphs:Array<{runs:Array<{text:string,bold?:boolean,italic?:boolean,underline?:boolean}>,align?:string}>}} dataModel
 * @returns {Promise<Uint8Array>}
 */
export async function serializeWordToOle(dataModel) {
  if (!dataModel || !Array.isArray(dataModel.paragraphs)) {
    throw new Error('serializeWordToOle: invalid dataModel');
  }
  const body = dataModel.paragraphs.map(buildParagraphXml).join('\n');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
    '<w:body>\n' +
    body +
    '\n<w:sectPr/></w:body>\n' +
    '</w:document>\n';

  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels').file('.rels', ROOT_RELS_XML);
  const word = zip.folder('word');
  word.file('document.xml', documentXml);
  word.file('styles.xml', STYLES_XML);
  word.folder('_rels').file('document.xml.rels', WORD_RELS_XML);

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return bytes;
}

// ============================================================================
// Dispatcher
// ============================================================================

/**
 * 편집기 dataModel 을 자동 분기하여 OLE 바이너리로 직렬화한다.
 *
 * @param {{type:string}} dataModel
 * @returns {Promise<{bytes:Uint8Array, mimeType:string, extension:string}>}
 */
export async function reserializeOle(dataModel) {
  if (!dataModel || typeof dataModel.type !== 'string') {
    throw new Error('reserializeOle: dataModel.type is required');
  }
  switch (dataModel.type) {
    case 'excel': {
      const bytes = await serializeExcelToOle(dataModel);
      return {
        bytes,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    }
    case 'word': {
      const bytes = await serializeWordToOle(dataModel);
      return {
        bytes,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      };
    }
    default:
      throw new Error(`reserializeOle: unsupported type ${dataModel.type}`);
  }
}
