/**
 * Unit tests for excel-formula-graph.js
 */

import { describe, it, expect } from 'vitest';
import {
  ExcelFormulaGraph,
  extractReferences,
  addrToKey,
  cellKey,
} from './excel-formula-graph.js';

function buildSheet(cells) {
  // cells: { 'A1': '=SUM(B1:B2)', 'B1': 10, 'B2': 5 }
  const rows = [];
  for (const [addr, val] of Object.entries(cells)) {
    const m = /^([A-Z]+)(\d+)$/.exec(addr);
    if (!m) continue;
    let col = 0;
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    const row = Number(m[2]);
    while (rows.length < row) rows.push([]);
    const r = rows[row - 1];
    while (r.length < col) r.push({ value: null });
    if (typeof val === 'string' && val.startsWith('=')) {
      r[col - 1] = { value: null, formula: val };
    } else {
      r[col - 1] = { value: val };
    }
  }
  return { rows };
}

describe('extractReferences', () => {
  it('단순 셀 참조', () => {
    expect(extractReferences('=A1+B2').sort()).toEqual(['A1', 'B2']);
  });

  it('절대 주소 $A$1', () => {
    expect(extractReferences('=$A$1*2')).toEqual(['A1']);
  });

  it('범위 A1:B2 전개', () => {
    expect(extractReferences('=SUM(A1:B2)').sort()).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('문자열 안의 패턴은 무시', () => {
    expect(extractReferences('=CONCAT("A1=", B1)')).toEqual(['B1']);
  });

  it('비-수식 입력은 빈 배열', () => {
    expect(extractReferences('hello')).toEqual([]);
    expect(extractReferences('')).toEqual([]);
    expect(extractReferences(null)).toEqual([]);
  });

  it('중복 참조 제거', () => {
    expect(extractReferences('=A1+A1+A1')).toEqual(['A1']);
  });
});

describe('addrToKey & cellKey', () => {
  it('A1 → "1:1"', () => {
    expect(addrToKey('A1')).toBe('1:1');
    expect(cellKey(1, 1)).toBe('1:1');
  });

  it('AA10 → "10:27"', () => {
    expect(addrToKey('AA10')).toBe('10:27');
  });

  it('잘못된 주소는 null', () => {
    expect(addrToKey('XYZ')).toBeNull();
  });
});

describe('ExcelFormulaGraph — build', () => {
  it('빈 시트도 안전', () => {
    const g = new ExcelFormulaGraph();
    g.build({ rows: [] });
    expect(g.toJSON().deps).toEqual({});
  });

  it('formula 없는 셀은 그래프에 안 들어감', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A1: 1, B1: 2 }));
    expect(g.toJSON().deps).toEqual({});
  });

  it('단일 의존: A2=A1 → A1 변경 시 A2 dirty', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A1: 1, A2: '=A1' }));
    const dirty = g.getDirtyCells('1:1');
    expect(dirty.has('2:1')).toBe(true);
  });

  it('범위 의존: C1=SUM(A1:B2) → A1, A2, B1, B2 모두 dependent 로 등록', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ C1: '=SUM(A1:B2)' }));
    const dump = g.toJSON();
    expect(dump.deps['1:1']).toContain('1:3'); // A1 changes -> C1 dirty
    expect(dump.deps['2:2']).toContain('1:3');
  });
});

describe('ExcelFormulaGraph — getDirtyCells (forward propagation)', () => {
  it('체인: A2=A1, A3=A2, A4=A3', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A2: '=A1', A3: '=A2', A4: '=A3' }));
    const dirty = g.getDirtyCells('1:1'); // A1 changed
    expect(dirty.has('2:1')).toBe(true);
    expect(dirty.has('3:1')).toBe(true);
    expect(dirty.has('4:1')).toBe(true);
  });

  it('영향 없는 셀은 제외', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A2: '=A1', B2: '=B1' }));
    const dirty = g.getDirtyCells('1:1'); // A1 changed
    expect(dirty.has('2:1')).toBe(true);
    expect(dirty.has('2:2')).toBe(false);
  });

  it('changedCellKey 도 결과에 포함', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A2: '=A1' }));
    const dirty = g.getDirtyCells('1:1');
    expect(dirty.has('1:1')).toBe(true);
  });
});

describe('ExcelFormulaGraph — detectCycles (3-color DFS)', () => {
  it('사이클 없음', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A2: '=A1', A3: '=A2' }));
    expect(g.detectCycles().size).toBe(0);
  });

  it('2-셀 사이클: A1=A2, A2=A1', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A1: '=A2', A2: '=A1' }));
    const cyc = g.detectCycles();
    expect(cyc.has('1:1')).toBe(true);
    expect(cyc.has('2:1')).toBe(true);
  });

  it('3-셀 사이클: A=B, B=C, C=A', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A1: '=B1', B1: '=C1', C1: '=A1' }));
    const cyc = g.detectCycles();
    expect(cyc.size).toBeGreaterThanOrEqual(3);
  });

  it('사이클과 비사이클 혼합', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A1: '=A2', A2: '=A1', B1: '=A1' }));
    const cyc = g.detectCycles();
    expect(cyc.has('1:1')).toBe(true);
    expect(cyc.has('2:1')).toBe(true);
    // B1 은 사이클 노드를 참조하지만 자기 자신은 사이클에 속하지 않음
    expect(cyc.has('1:2')).toBe(false);
  });
});

describe('ExcelFormulaGraph — updateCell', () => {
  it('formula 추가 후 dirty 전파', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A1: 1 }));
    g.updateCell(2, 1, '=A1'); // A2 = A1
    const dirty = g.getDirtyCells('1:1');
    expect(dirty.has('2:1')).toBe(true);
  });

  it('formula 제거 시 의존성 정리', () => {
    const g = new ExcelFormulaGraph();
    g.build(buildSheet({ A1: 1, A2: '=A1' }));
    expect(g.getDirtyCells('1:1').has('2:1')).toBe(true);
    g.updateCell(2, 1, undefined);
    expect(g.getDirtyCells('1:1').has('2:1')).toBe(false);
  });
});

describe('ExcelFormulaGraph — recomputeDirty', () => {
  it('evaluator 콜백 호출', () => {
    const g = new ExcelFormulaGraph();
    const sheet = buildSheet({ A1: 1, A2: '=A1' });
    g.build(sheet);
    const dirty = g.getDirtyCells('1:1');
    const calls = [];
    const results = g.recomputeDirty(sheet, dirty, (_s, r, c) => {
      calls.push([r, c]);
      return r * 10 + c;
    });
    expect(calls.length).toBe(dirty.size);
    expect(results.size).toBe(dirty.size);
  });

  it('사이클 셀은 evaluator 우회 + #CYCLE!', () => {
    const g = new ExcelFormulaGraph();
    const sheet = buildSheet({ A1: '=A2', A2: '=A1' });
    g.build(sheet);
    const dirty = g.getDirtyCells('1:1');
    let calls = 0;
    const results = g.recomputeDirty(sheet, dirty, () => { calls++; return 42; });
    // A1, A2 모두 사이클이므로 evaluator 호출 X
    expect(calls).toBe(0);
    for (const v of results.values()) {
      expect(v.value).toBe('#CYCLE!');
    }
  });

  it('evaluator throw 는 #ERR! 로 변환', () => {
    const g = new ExcelFormulaGraph();
    const sheet = buildSheet({ A1: 1, A2: '=A1' });
    g.build(sheet);
    const dirty = g.getDirtyCells('1:1');
    const results = g.recomputeDirty(sheet, dirty, () => { throw new Error('boom'); });
    for (const v of results.values()) {
      expect(v.value).toBe('#ERR!');
    }
  });
});
