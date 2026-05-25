/**
 * Dependency Graph
 *
 * 셀 간 수식 의존성을 관리합니다.
 * - addDependency(from, to): from 셀의 수식이 to 셀을 참조함
 * - getDependents(addr): addr이 변경될 때 다시 계산해야 할 셀들 (역방향)
 * - topologicalOrder(seeds): 변경된 seed 셀로부터 영향받는 셀들의 평가 순서
 * - detectCycles(): 순환 참조 감지
 *
 * @module table-formula/dependency-graph
 */

export class DependencyGraph {
  constructor() {
    /** @type {Map<string, Set<string>>} A → cells that A depends on (out-edges) */
    this.deps = new Map();
    /** @type {Map<string, Set<string>>} A → cells that depend on A (in-edges, reverse) */
    this.reverse = new Map();
  }

  /**
   * `from` 셀이 `to` 셀에 의존함을 기록합니다.
   * @param {string} from
   * @param {string} to
   */
  addDependency(from, to) {
    if (!this.deps.has(from)) this.deps.set(from, new Set());
    this.deps.get(from).add(to);
    if (!this.reverse.has(to)) this.reverse.set(to, new Set());
    this.reverse.get(to).add(from);
  }

  /**
   * `from` 셀의 모든 의존성을 제거합니다. 보통 수식이 바뀌었을 때 호출됩니다.
   * @param {string} from
   */
  clearDependencies(from) {
    const outs = this.deps.get(from);
    if (!outs) return;
    for (const to of outs) {
      const rev = this.reverse.get(to);
      if (rev) {
        rev.delete(from);
        if (rev.size === 0) this.reverse.delete(to);
      }
    }
    this.deps.delete(from);
  }

  /**
   * 셀 자체를 그래프에서 완전히 제거합니다.
   * @param {string} addr
   */
  removeCell(addr) {
    this.clearDependencies(addr);
    const ins = this.reverse.get(addr);
    if (ins) {
      for (const from of ins) {
        const outs = this.deps.get(from);
        if (outs) {
          outs.delete(addr);
          if (outs.size === 0) this.deps.delete(from);
        }
      }
      this.reverse.delete(addr);
    }
  }

  /**
   * addr에 직접 의존하는 셀들을 반환합니다. (1-hop)
   * @param {string} addr
   * @returns {string[]}
   */
  getDependents(addr) {
    const set = this.reverse.get(addr);
    return set ? Array.from(set) : [];
  }

  /**
   * addr이 직접 의존하는 셀들을 반환합니다. (1-hop)
   * @param {string} addr
   * @returns {string[]}
   */
  getDependencies(addr) {
    const set = this.deps.get(addr);
    return set ? Array.from(set) : [];
  }

  /**
   * 주어진 seed 셀들이 변경되었을 때, 영향받는 모든 셀(자신 포함)을
   * 평가 순서대로 (의존성 먼저) 반환합니다.
   * 순환 참조가 있으면 throw 합니다.
   *
   * @param {string[]} seeds
   * @returns {string[]}
   */
  topologicalOrder(seeds) {
    // 1) BFS through reverse edges to find affected set
    const affected = new Set();
    const queue = [...seeds];
    while (queue.length > 0) {
      const a = queue.shift();
      if (affected.has(a)) continue;
      affected.add(a);
      const next = this.reverse.get(a);
      if (next) for (const n of next) queue.push(n);
    }
    // 2) Topological sort restricted to affected set, using forward edges (deps)
    const visited = new Set();
    const inProgress = new Set();
    const order = [];

    const visit = (node) => {
      if (visited.has(node)) return;
      if (inProgress.has(node)) {
        throw new Error(`Circular reference detected at ${node}`);
      }
      inProgress.add(node);
      const outs = this.deps.get(node);
      if (outs) {
        for (const dep of outs) {
          if (affected.has(dep)) visit(dep);
        }
      }
      inProgress.delete(node);
      visited.add(node);
      order.push(node);
    };

    for (const node of affected) visit(node);
    return order;
  }

  /**
   * 그래프 전체에서 순환 참조가 있는지 확인합니다.
   * 있으면 해당 셀 목록을, 없으면 빈 배열을 반환합니다.
   *
   * @returns {string[]}
   */
  detectCycles() {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    const cycleNodes = new Set();
    const allNodes = new Set([...this.deps.keys(), ...this.reverse.keys()]);
    for (const n of allNodes) color.set(n, WHITE);

    const dfs = (node, stack) => {
      color.set(node, GRAY);
      stack.push(node);
      const outs = this.deps.get(node);
      if (outs) {
        for (const next of outs) {
          if (color.get(next) === GRAY) {
            // cycle found — record the loop members
            const idx = stack.indexOf(next);
            for (let i = idx; i < stack.length; i++) cycleNodes.add(stack[i]);
          } else if (color.get(next) === WHITE) {
            dfs(next, stack);
          }
        }
      }
      stack.pop();
      color.set(node, BLACK);
    };

    for (const n of allNodes) {
      if (color.get(n) === WHITE) dfs(n, []);
    }
    return Array.from(cycleNodes);
  }

  /**
   * 그래프를 모두 비웁니다.
   */
  clear() {
    this.deps.clear();
    this.reverse.clear();
  }

  /** 디버깅용 노드 수 */
  get size() {
    const all = new Set([...this.deps.keys(), ...this.reverse.keys()]);
    return all.size;
  }
}
