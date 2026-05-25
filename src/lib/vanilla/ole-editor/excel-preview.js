/**
 * Excel OLE 미리보기 컴포넌트
 * ─────────────────────────────────────────────────────────────────────────────
 * 임베디드 .xlsx OLE 오브젝트를 *전체 디코딩 없이* 미리보기로 제공한다.
 *
 *  - 워크북 디코딩은 `decodeExcel(..., { activeSheetOnly:true })` 로 활성 시트만
 *    셀 모델까지 변환하고, 나머지는 `{name, lazy:true}` 메타만 가진다.
 *  - 활성 시트 미리보기 → 첫 5x5 영역만 노출.
 *  - 사용자가 시트 탭을 클릭하면 `loadSheet()` 로 해당 시트만 lazy hydrate
 *    후 캐시한다. 100시트 워크북에서도 초기 페이로드/렌더 비용을 활성 시트
 *    1개 수준으로 유지하기 위한 진입점이다.
 *
 * 출력 스키마
 *   buildExcelPreview(oleData, filename, options): Promise<{
 *     type:'excel-preview',
 *     activeSheet: string,
 *     sheets: Array<{ name:string, loaded:boolean }>,
 *     preview: Array<Array<{value:any, formula?:string}>>,   // 활성 시트 5x5
 *     totalSheets: number,
 *     loadSheet(name): Promise<{name,rows}|null>,
 *   }>
 *
 * 보안/성능
 *   - 외부 fetch 없음, 매크로/VBA 미평가.
 *   - 동일 OLE bytes 에 대해 lazy load 결과를 메모리에 캐시.
 *
 * @module vanilla/ole-editor/excel-preview
 */

import { decodeExcel, loadSheet as decoderLoadSheet } from './ole-content-decoder.js';

const DEFAULT_PREVIEW_ROWS = 5;
const DEFAULT_PREVIEW_COLS = 5;

/**
 * rows 행렬에서 좌상단 NxM 영역만 잘라 반환한다.
 *
 * @param {Array<Array<{value:any}>>} rows
 * @param {number} maxRows
 * @param {number} maxCols
 * @returns {Array<Array<{value:any}>>}
 */
export function sliceForPreview(rows, maxRows = DEFAULT_PREVIEW_ROWS, maxCols = DEFAULT_PREVIEW_COLS) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  const rLimit = Math.min(rows.length, maxRows);
  for (let r = 0; r < rLimit; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) {
      out.push([]);
      continue;
    }
    const cLimit = Math.min(row.length, maxCols);
    const trimmed = [];
    for (let c = 0; c < cLimit; c++) {
      trimmed.push(row[c]);
    }
    out.push(trimmed);
  }
  return out;
}

/**
 * Excel OLE 미리보기 빌더.
 *
 * @param {Uint8Array|{data:Uint8Array, filename?:string}} oleData
 * @param {string} [filename]
 * @param {object} [options]
 * @param {number} [options.previewRows=5]
 * @param {number} [options.previewCols=5]
 * @returns {Promise<object>}
 */
export async function buildExcelPreview(oleData, filename, options = {}) {
  const previewRows = options.previewRows ?? DEFAULT_PREVIEW_ROWS;
  const previewCols = options.previewCols ?? DEFAULT_PREVIEW_COLS;

  const decoded = await decodeExcel(oleData, filename, { activeSheetOnly: true });
  if (decoded.type !== 'excel') {
    return {
      type: 'excel-preview',
      error: decoded.message || 'unsupported',
      activeSheet: '',
      sheets: [],
      preview: [],
      totalSheets: 0,
      loadSheet: async () => null,
    };
  }

  const sheets = decoded.sheets.map(s => ({
    name: s.name,
    loaded: !s.lazy,
  }));

  const active = decoded.sheets.find(s => s.name === decoded.activeSheet);
  const preview = active && active.rows ? sliceForPreview(active.rows, previewRows, previewCols) : [];

  // 메모리 캐시: 동일 OLE bytes 의 시트별 hydrate 결과 재사용.
  const cache = new Map();
  if (active && active.rows) cache.set(active.name, active);

  async function loadSheetCached(name) {
    if (cache.has(name)) return cache.get(name);
    const sheet = await decoderLoadSheet(oleData, name);
    if (sheet) cache.set(name, sheet);
    return sheet;
  }

  return {
    type: 'excel-preview',
    activeSheet: decoded.activeSheet,
    sheets,
    preview,
    totalSheets: decoded._totalSheets ?? sheets.length,
    loadSheet: loadSheetCached,
  };
}
