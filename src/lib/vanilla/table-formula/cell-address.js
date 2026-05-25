/**
 * Cell Address Conversion
 *
 * 한컴 한글 표 셀을 Excel 스타일 주소(A1, B3, AA10 ...)와 0-based {col, row} 인덱스
 * 사이에서 양방향 변환합니다. 다중 자리 알파벳 컬럼 (AA, AB, ZZ, AAA ...)을 지원합니다.
 *
 * @module table-formula/cell-address
 */

const CELL_ADDR_REGEX = /^\$?([A-Z]+)\$?([1-9]\d*)$/;
const CELL_ADDR_FULL_RE = /^([A-Z]+)([1-9]\d*)$/;

/**
 * 'A' -> 0, 'Z' -> 25, 'AA' -> 26 등으로 알파벳 컬럼을 0-based 인덱스로 변환합니다.
 * @param {string} letters
 * @returns {number}
 */
export function columnLettersToIndex(letters) {
  if (!letters || typeof letters !== 'string') {
    throw new Error(`Invalid column letters: ${String(letters)}`);
  }
  const upper = letters.toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) {
    throw new Error(`Invalid column letters: ${letters}`);
  }
  let n = 0;
  for (let i = 0; i < upper.length; i++) {
    n = n * 26 + (upper.charCodeAt(i) - 64); // 'A' = 1
  }
  return n - 1;
}

/**
 * 0-based 컬럼 인덱스를 알파벳 문자열로 변환합니다.
 * 0 -> 'A', 25 -> 'Z', 26 -> 'AA' ...
 * @param {number} index
 * @returns {string}
 */
export function columnIndexToLetters(index) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid column index: ${index}`);
  }
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * 'B3' 등을 {col, row} 0-based 인덱스로 변환합니다.
 * @param {string} addr
 * @returns {{col:number, row:number}}
 */
export function cellAddrToIndex(addr) {
  if (typeof addr !== 'string') {
    throw new Error(`Invalid cell address: ${String(addr)}`);
  }
  const m = addr.toUpperCase().match(CELL_ADDR_REGEX);
  if (!m) {
    throw new Error(`Invalid cell address: ${addr}`);
  }
  const col = columnLettersToIndex(m[1]);
  const row = parseInt(m[2], 10) - 1;
  return { col, row };
}

/**
 * 0-based (col, row)를 'B3' 등의 셀 주소로 변환합니다.
 * @param {number} col
 * @param {number} row
 * @returns {string}
 */
export function indexToCellAddr(col, row) {
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0) {
    throw new Error(`Invalid index: col=${col}, row=${row}`);
  }
  return `${columnIndexToLetters(col)}${row + 1}`;
}

/**
 * 셀 주소가 유효한지 확인합니다.
 * @param {string} addr
 * @returns {boolean}
 */
export function isCellAddr(addr) {
  if (typeof addr !== 'string') return false;
  return CELL_ADDR_FULL_RE.test(addr.toUpperCase());
}

/**
 * 'A1:B10' 범위를 시작/끝 인덱스로 변환합니다.
 * @param {string} range
 * @returns {{start:{col:number,row:number}, end:{col:number,row:number}}}
 */
export function parseRange(range) {
  if (typeof range !== 'string' || !range.includes(':')) {
    throw new Error(`Invalid range: ${range}`);
  }
  const [a, b] = range.split(':');
  const start = cellAddrToIndex(a);
  const end = cellAddrToIndex(b);
  // normalize so start <= end
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  return {
    start: { col: minCol, row: minRow },
    end: { col: maxCol, row: maxRow },
  };
}

/**
 * 범위 안에 포함된 모든 셀 주소를 반환합니다.
 * @param {string} range
 * @returns {string[]}
 */
export function expandRange(range) {
  const { start, end } = parseRange(range);
  const cells = [];
  for (let r = start.row; r <= end.row; r++) {
    for (let c = start.col; c <= end.col; c++) {
      cells.push(indexToCellAddr(c, r));
    }
  }
  return cells;
}
