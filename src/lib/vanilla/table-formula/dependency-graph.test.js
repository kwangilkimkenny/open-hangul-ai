/**
 * dependency-graph.test.js
 */
import { describe, it, expect } from 'vitest';
import { DependencyGraph } from './dependency-graph.js';

describe('DependencyGraph', () => {
  it('addDependency records forward + reverse edges', () => {
    const g = new DependencyGraph();
    g.addDependency('C1', 'A1');
    g.addDependency('C1', 'B1');
    expect(g.getDependencies('C1').sort()).toEqual(['A1', 'B1']);
    expect(g.getDependents('A1')).toEqual(['C1']);
    expect(g.getDependents('B1')).toEqual(['C1']);
  });

  it('clearDependencies removes only the from-cell edges', () => {
    const g = new DependencyGraph();
    g.addDependency('C1', 'A1');
    g.addDependency('D1', 'A1');
    g.clearDependencies('C1');
    expect(g.getDependencies('C1')).toEqual([]);
    expect(g.getDependents('A1')).toEqual(['D1']);
  });

  it('removeCell drops both directions', () => {
    const g = new DependencyGraph();
    g.addDependency('C1', 'A1');
    g.addDependency('D1', 'C1');
    g.removeCell('C1');
    expect(g.getDependencies('D1')).toEqual([]);
    expect(g.getDependents('A1')).toEqual([]);
  });

  it('topologicalOrder visits dependencies before dependents', () => {
    const g = new DependencyGraph();
    // A1 -> none
    // B1 -> A1
    // C1 -> B1
    g.addDependency('B1', 'A1');
    g.addDependency('C1', 'B1');
    const order = g.topologicalOrder(['A1']);
    expect(order.indexOf('B1')).toBeGreaterThan(order.indexOf('A1'));
    expect(order.indexOf('C1')).toBeGreaterThan(order.indexOf('B1'));
  });

  it('topologicalOrder only includes cells affected by seeds', () => {
    const g = new DependencyGraph();
    g.addDependency('B1', 'A1');
    g.addDependency('D1', 'C1'); // unrelated chain
    const order = g.topologicalOrder(['A1']);
    expect(order).toContain('A1');
    expect(order).toContain('B1');
    expect(order).not.toContain('C1');
    expect(order).not.toContain('D1');
  });

  it('detectCycles finds 2-cycle', () => {
    const g = new DependencyGraph();
    g.addDependency('A1', 'B1');
    g.addDependency('B1', 'A1');
    const cycle = g.detectCycles();
    expect(cycle.sort()).toEqual(['A1', 'B1']);
  });

  it('detectCycles finds 3-cycle', () => {
    const g = new DependencyGraph();
    g.addDependency('A1', 'B1');
    g.addDependency('B1', 'C1');
    g.addDependency('C1', 'A1');
    const cycle = g.detectCycles();
    expect(cycle.sort()).toEqual(['A1', 'B1', 'C1']);
  });

  it('detectCycles returns empty for acyclic graph', () => {
    const g = new DependencyGraph();
    g.addDependency('B1', 'A1');
    g.addDependency('C1', 'B1');
    expect(g.detectCycles()).toEqual([]);
  });
});
