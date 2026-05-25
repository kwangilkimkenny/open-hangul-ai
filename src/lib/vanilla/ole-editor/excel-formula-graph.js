/**
 * Excel Formula Dependency Graph
 * ─────────────────────────────────────────────────────────────────────────────
 * `ExcelEditor` 의 시트(sheet) 단위 수식 의존성 그래프.
 *
 * 트랙 DD `table-formula/dependency-graph.js` 가 일반 DAG 관리에 가깝다면,
 * 본 클래스는 Excel-스타일 시트(`rows[row-1][col-1]`)에 특화되어
 *
 *   - 시트 전체 스캔으로 1회 그래프 빌드
 *   - 단일 셀 변경의 **forward dirty propagation** (영향받는 셀 closure)
 *   - **3-color DFS** 순환 참조 감지
 *   - dirty 셀만 evaluator 콜백으로 재평가 (전체 재렌더 회피)
 *
 * 가벼운 설계 원칙
 *   - 단일 시트 키: `"row:col"` (1-based)
 *   - 다중 시트 키: `"sheet|row|col"` (다른 sheet 지원을 위해 setSheet 로 prefix 가능)
 *   - 트랙 DD `formula-engine`/`cell-address` 는 **import 만** (수정 X)
 *
 * @module vanilla/ole-editor/excel-formula-graph
 */

import { cellAddrToIndex, expandRange, isCellAddr } from '../table-formula/cell-address.js';

/**
 * 단일 시트 셀 키: row, col 1-based.
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
export function cellKey(row, col) {
  return `${row}:${col}`;
}

/**
 * formula 문자열을 토큰 단위로 훑어 셀 / 범위 참조를 추출한다.
 * formula-engine 의 토크나이저 대신 가벼운 정규식 — 본 그래프는
 * "어떤 셀이 참조되는가" 만 알면 충분하기 때문에 평가는 하지 않는다.
 *
 * 지원
 *   - `A1`, `$A$1`, `AA10` (절대/혼합 주소)
 *   - `A1:B10` 범위 → expandRange 로 풀어줌
 *   - 따옴표 문자열 안의 패턴은 무시
 *
 * @param {string} formula
 * @returns {string[]} 정규화된 셀 주소 (e.g. ['A1', 'B2'])
 */
export function extractReferences(formula) {
  if (typeof formula !== 'string') return [];
  let src = formula.trim();
  if (src.startsWith('=')) src = src.slice(1);

  // strip "...." string literals to avoid false positives
  let cleaned = '';
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      if (inStr && src[i + 1] === '"') {
        // escaped quote — keep skipping
        i++;
        continue;
      }
      inStr = !inStr;
      continue;
    }
    if (!inStr) cleaned += ch;
  }

  const out = new Set();
  const RANGE_RE = /\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+/g;
  const CELL_RE = /\$?[A-Za-z]+\$?\d+/g;

  // Collect ranges first, then strip them so subsequent cell scan doesn't
  // double-count.
  const consumed = [];
  let m;
  while ((m = RANGE_RE.exec(cleaned)) !== null) {
    consumed.push([m.index, m.index + m[0].length]);
    const normalized = m[0].replace(/\$/g, '').toUpperCase();
    try {
      const cells = expandRange(normalized);
      for (const c of cells) out.add(c);
    } catch (_e) {
      /* invalid range — ignore */
    }
  }

  // Mask out range spans
  let masked = cleaned;
  for (const [s, e] of consumed.sort((a, b) => b[0] - a[0])) {
    masked = masked.slice(0, s) + ' '.repeat(e - s) + masked.slice(e);
  }

  while ((m = CELL_RE.exec(masked)) !== null) {
    const norm = m[0].replace(/\$/g, '').toUpperCase();
    if (isCellAddr(norm)) out.add(norm);
  }

  return Array.from(out);
}

/**
 * 주소(A1) → 단일 시트 셀 키(`"row:col"`).
 * 트랙 DD `cell-address.cellAddrToIndex` 활용 (0-based → 1-based 변환).
 * @param {string} addr
 * @returns {string|null}
 */
export function addrToKey(addr) {
  try {
    const { row, col } = cellAddrToIndex(addr);
    return cellKey(row + 1, col + 1);
  } catch (_e) {
    return null;
  }
}

/**
 * Excel 의존성 그래프.
 *
 * @example
 *   const g = new ExcelFormulaGraph();
 *   g.build(sheet);
 *   const dirty = g.getDirtyCells('2:2');
 *   g.recomputeDirty(sheet, dirty, evalFn);
 */
export class ExcelFormulaGraph {
  constructor() {
    /**
     * cellKey → Set<cellKey> : "이 셀이 변경되면 영향받는 셀들" (forward, reverse edges).
     * @type {Map<string, Set<string>>}
     */
    this.deps = new Map();
    /**
     * cellKey → Set<cellKey> : "이 셀이 의존하는 셀들" (forward edges from formula).
     * @type {Map<string, Set<string>>}
     */
    this.reverseDeps = new Map();
    /**
     * cellKey → {value, error?, formula?} : 마지막 평가 결과 캐시.
     * @type {Map<string, {value:any, error?:string, formula?:string}>}
     */
    this.values = new Map();
  }

  /**
   * 모든 그래프 상태를 초기화.
   */
  clear() {
    this.deps.clear();
    this.reverseDeps.clear();
    this.values.clear();
  }

  /**
   * `from` 이 `to` 에 의존함을 기록.
   *   - reverseDeps[from] ⊇ {to}        (forward — from depends on to)
   *   - deps[to] ⊇ {from}                (reverse — change in to affects from)
   *
   * @param {string} from
   * @param {string} to
   */
  addDependency(from, to) {
    if (from === to) {
      // 자기 참조도 사이클이지만 그래프엔 기록해야 detectCycles 가 잡음.
    }
    if (!this.reverseDeps.has(from)) this.reverseDeps.set(from, new Set());
    this.reverseDeps.get(from).add(to);
    if (!this.deps.has(to)) this.deps.set(to, new Set());
    this.deps.get(to).add(from);
  }

  /**
   * `from` 의 모든 outgoing dependency 를 제거 (수식이 바뀌었을 때).
   * @param {string} from
   */
  clearDependenciesOf(from) {
    const outs = this.reverseDeps.get(from);
    if (!outs) return;
    for (const to of outs) {
      const rev = this.deps.get(to);
      if (rev) {
        rev.delete(from);
        if (rev.size === 0) this.deps.delete(to);
      }
    }
    this.reverseDeps.delete(from);
  }

  /**
   * Sheet 전체를 스캔하여 의존성 그래프를 빌드한다.
   *   - 모든 formula 셀에 대해 extractReferences 로 참조를 뽑아 addDependency
   *   - 기존 그래프는 clear() 됨
   *
   * @param {{rows: Array<Array<{value:any, formula?:string}>>}} sheet
   */
  build(sheet) {
    this.clear();
    if (!sheet || !Array.isArray(sheet.rows)) return;
    for (let r = 0; r < sheet.rows.length; r++) {
      const row = sheet.rows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell || !cell.formula) continue;
        const fromKey = cellKey(r + 1, c + 1);
        const refs = extractReferences(cell.formula);
        for (const ref of refs) {
          const toKey = addrToKey(ref);
          if (toKey) this.addDependency(fromKey, toKey);
        }
        // 평가 결과 캐시 비우기 — recomputeDirty 가 채워준다
        this.values.set(fromKey, { value: null, formula: cell.formula });
      }
    }
  }

  /**
   * 단일 셀의 수식만 그래프에 업데이트한다 (셀 입력 후 호출).
   *   - 기존 outgoing edge 제거
   *   - 새 formula 의 참조로 다시 추가
   *
   * @param {number} row 1-based
   * @param {number} col 1-based
   * @param {string|undefined} formula
   */
  updateCell(row, col, formula) {
    const key = cellKey(row, col);
    this.clearDependenciesOf(key);
    if (typeof formula === 'string' && formula.startsWith('=')) {
      const refs = extractReferences(formula);
      for (const ref of refs) {
        const toKey = addrToKey(ref);
        if (toKey) this.addDependency(key, toKey);
      }
      this.values.set(key, { value: null, formula });
    } else {
      this.values.delete(key);
    }
  }

  /**
   * 셀 변경 시 영향받는 모든 셀 (자기 포함) 을 반환한다.
   * 재귀적으로 dependents 의 dependents 까지 BFS 로 수집.
   *
   * @param {string} changedCellKey
   * @returns {Set<string>}
   */
  getDirtyCells(changedCellKey) {
    const dirty = new Set();
    const queue = [changedCellKey];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (dirty.has(cur)) continue;
      dirty.add(cur);
      const deps = this.deps.get(cur);
      if (!deps) continue;
      for (const next of deps) {
        if (!dirty.has(next)) queue.push(next);
      }
    }
    return dirty;
  }

  /**
   * 3-color DFS 로 모든 순환 참조 셀을 탐지한다.
   * White (방문 안 함) → Gray (스택 위) → Black (완료).
   * Gray → Gray 백 엣지 발견 시 사이클로 간주, 스택의 cell 들을 사이클 집합에 추가.
   *
   * @returns {Set<string>} 순환 참조에 속한 cellKey 집합
   */
  detectCycles() {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    /** @type {Map<string, number>} */
    const color = new Map();
    const cycleNodes = new Set();
    // 모든 노드 (deps + reverseDeps 의 키 합집합) 초기화
    const allNodes = new Set();
    for (const k of this.reverseDeps.keys()) allNodes.add(k);
    for (const k of this.deps.keys()) allNodes.add(k);
    for (const node of allNodes) color.set(node, WHITE);

    // 명시적 스택 DFS — 깊은 그래프에서 call stack overflow 방지
    for (const start of allNodes) {
      if (color.get(start) !== WHITE) continue;
      /** @type {Array<{node:string, itIdx:number, neighbors:string[]}>} */
      const stack = [];
      const outs = Array.from(this.reverseDeps.get(start) || []);
      stack.push({ node: start, itIdx: 0, neighbors: outs });
      color.set(start, GRAY);

      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.itIdx >= top.neighbors.length) {
          color.set(top.node, BLACK);
          stack.pop();
          continue;
        }
        const next = top.neighbors[top.itIdx++];
        const c = color.get(next) ?? WHITE;
        if (c === GRAY) {
          // back edge — 사이클! stack 에서 next 까지의 모든 노드를 사이클로 마킹
          let foundStart = false;
          for (const frame of stack) {
            if (frame.node === next) foundStart = true;
            if (foundStart) cycleNodes.add(frame.node);
          }
          if (!foundStart) {
            // self-loop (next == top.node 가 아닐 수 있지만 GRAY 라면 스택에 있음)
            cycleNodes.add(next);
          }
        } else if (c === WHITE) {
          color.set(next, GRAY);
          const nOuts = Array.from(this.reverseDeps.get(next) || []);
          stack.push({ node: next, itIdx: 0, neighbors: nOuts });
        }
        // BLACK → 이미 탐색 완료, 사이클 아님
      }
    }
    return cycleNodes;
  }

  /**
   * dirty cell 만 evaluator 로 재평가한 뒤 결과 Map 을 반환.
   * dependency-order 정렬은 evaluator 가 다른 셀을 lazy 하게 읽도록 위임 — 단순 셀별 호출.
   * 사이클 셀은 `#CYCLE!` 로 표시 (evaluator 호출 생략).
   *
   * @param {{rows: Array<Array<{value:any, formula?:string}>>}} sheet
   * @param {Set<string>|Iterable<string>} dirtyCells
   * @param {(sheet:object, row:number, col:number) => any} evalFn
   *   formula 평가 콜백 (보통 ExcelEditor 의 computeDisplay 래퍼).
   * @returns {Map<string, {value:any, error?:string}>}
   */
  recomputeDirty(sheet, dirtyCells, evalFn) {
    const cycles = this.detectCycles();
    /** @type {Map<string, {value:any, error?:string}>} */
    const results = new Map();
    if (typeof evalFn !== 'function' || !sheet) return results;
    for (const key of dirtyCells) {
      const [rStr, cStr] = key.split(':');
      const row = Number(rStr);
      const col = Number(cStr);
      if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
      if (cycles.has(key)) {
        const out = { value: '#CYCLE!', error: 'CYCLE' };
        results.set(key, out);
        this.values.set(key, { value: '#CYCLE!', error: 'CYCLE' });
        continue;
      }
      try {
        const value = evalFn(sheet, row, col);
        results.set(key, { value });
        const prev = this.values.get(key) || {};
        this.values.set(key, { ...prev, value });
      } catch (err) {
        const errStr = err && err.message ? err.message : String(err);
        results.set(key, { value: '#ERR!', error: errStr });
        this.values.set(key, { value: '#ERR!', error: errStr });
      }
    }
    return results;
  }

  /**
   * 현재 그래프의 모든 의존성을 요약 객체로 덤프 (디버깅 / 테스트).
   * @returns {{deps: Object<string, string[]>, reverseDeps: Object<string, string[]>}}
   */
  toJSON() {
    const dump = obj => {
      const out = {};
      for (const [k, v] of obj) out[k] = Array.from(v);
      return out;
    };
    return {
      deps: dump(this.deps),
      reverseDeps: dump(this.reverseDeps),
    };
  }
}

export default ExcelFormulaGraph;
