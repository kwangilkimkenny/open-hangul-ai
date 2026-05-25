import { describe, it, expect } from 'vitest';
import {
  buildShapePath,
  buildRect,
  buildEllipse,
  buildLine,
  buildPolygon,
  buildPolyline,
  buildCurve,
  buildArc,
  buildFreeform,
} from './shape-path-builder.js';

describe('shape-path-builder', () => {
  describe('buildRect', () => {
    it('should return a rect element with width/height', () => {
      const r = buildRect({ width: 200, height: 100 });
      expect(r.element).toBe('rect');
      expect(r.attrs.width).toBe(200);
      expect(r.attrs.height).toBe(100);
      expect(r.attrs.x).toBe(0);
      expect(r.attrs.y).toBe(0);
      expect(r.viewBox).toEqual({ width: 200, height: 100 });
    });

    it('should add rx/ry when borderRadius is set (HWPX ratio)', () => {
      const r = buildRect({ width: 200, height: 100, borderRadius: 50 });
      // minDim=100, rx = (50/100) * 100 * 0.7 = 35
      expect(r.attrs.rx).toBeCloseTo(35);
      expect(r.attrs.ry).toBeCloseTo(35);
    });

    it('should accept rx/ry directly', () => {
      const r = buildRect({ width: 100, height: 100, rx: 10 });
      expect(r.attrs.rx).toBe(10);
      expect(r.attrs.ry).toBe(10);
    });

    it('should clamp width/height to at least 1', () => {
      const r = buildRect({ width: 0, height: -5 });
      expect(r.attrs.width).toBeGreaterThanOrEqual(1);
      expect(r.attrs.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe('buildEllipse', () => {
    it('should return an ellipse with cx/cy at center', () => {
      const e = buildEllipse({ width: 100, height: 60 });
      expect(e.element).toBe('ellipse');
      expect(e.attrs.cx).toBe(50);
      expect(e.attrs.cy).toBe(30);
      expect(e.attrs.rx).toBe(50);
      expect(e.attrs.ry).toBe(30);
    });
  });

  describe('buildLine', () => {
    it('should produce coords relative to bounding box origin', () => {
      const l = buildLine({ x0: 20, y0: 10, x1: 120, y1: 60 });
      expect(l.element).toBe('line');
      expect(l.attrs.x1).toBe(0);
      expect(l.attrs.y1).toBe(0);
      expect(l.attrs.x2).toBe(100);
      expect(l.attrs.y2).toBe(50);
      expect(l.viewBox.width).toBe(100);
      expect(l.viewBox.height).toBe(50);
      expect(l.translate).toEqual({ x: 20, y: 10 });
    });

    it('should accept start/end object', () => {
      const l = buildLine({ start: { x: 0, y: 0 }, end: { x: 50, y: 50 } });
      expect(l.attrs.x2).toBe(50);
    });
  });

  describe('buildPolygon', () => {
    it('should produce polygon points', () => {
      const p = buildPolygon({
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 10 },
          { x: 30, y: 40 },
        ],
      });
      expect(p.element).toBe('polygon');
      expect(p.attrs.points).toContain('0,0');
      expect(p.attrs.points).toContain('40,0');
      expect(p.attrs.points).toContain('20,30');
      expect(p.viewBox.width).toBe(40);
      expect(p.viewBox.height).toBe(30);
    });

    it('should accept [[x,y]] array tuples', () => {
      const p = buildPolygon({
        points: [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
      });
      expect(p.element).toBe('polygon');
      expect(p.attrs.points).toContain('0,0');
      expect(p.attrs.points).toContain('10,10');
    });

    it('should fallback to rect when not enough points', () => {
      const p = buildPolygon({ points: [{ x: 0, y: 0 }], width: 50, height: 50 });
      expect(p.element).toBe('rect');
    });
  });

  describe('buildPolyline', () => {
    it('should produce polyline element', () => {
      const p = buildPolyline({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      });
      expect(p.element).toBe('polyline');
    });
  });

  describe('buildCurve', () => {
    it('should produce a path with Bezier C commands for >=3 points', () => {
      const c = buildCurve({
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 30 },
        ],
      });
      expect(c.element).toBe('path');
      expect(c.attrs.d).toContain('M ');
      expect(c.attrs.d).toContain('C ');
    });

    it('should fallback to polyline for exactly 2 points', () => {
      const c = buildCurve({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      });
      expect(c.element).toBe('polyline');
    });

    it('should fallback to rect for 1 point', () => {
      const c = buildCurve({ points: [{ x: 0, y: 0 }], width: 50, height: 50 });
      expect(c.element).toBe('rect');
    });
  });

  describe('buildArc', () => {
    it('should produce path with arc A command', () => {
      const a = buildArc({ width: 100, height: 100, startAngle: 0, endAngle: 180 });
      expect(a.element).toBe('path');
      expect(a.attrs.d).toContain('A ');
    });

    it('should use default angles when missing', () => {
      const a = buildArc({ width: 100, height: 100 });
      expect(a.element).toBe('path');
      expect(a.attrs.d).toContain('A ');
    });
  });

  describe('buildFreeform', () => {
    it('should use pathData if provided', () => {
      const f = buildFreeform({ pathData: 'M0 0 L 10 10', width: 50, height: 50 });
      expect(f.element).toBe('path');
      expect(f.attrs.d).toBe('M0 0 L 10 10');
    });

    it('should use curve fallback when many points', () => {
      const f = buildFreeform({
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 30 },
          { x: 0, y: 30 },
        ],
      });
      expect(f.element).toBe('path');
    });
  });

  describe('buildShapePath', () => {
    it('should dispatch to rect for rect/rectangle', () => {
      expect(buildShapePath({ shapeType: 'rect', width: 10, height: 10 }).element).toBe('rect');
      expect(buildShapePath({ shapeType: 'rectangle', width: 10, height: 10 }).element).toBe(
        'rect'
      );
    });

    it('should dispatch to ellipse for ellipse/circle', () => {
      expect(buildShapePath({ shapeType: 'ellipse', width: 10, height: 10 }).element).toBe(
        'ellipse'
      );
      expect(buildShapePath({ shapeType: 'circle', width: 10, height: 10 }).element).toBe(
        'ellipse'
      );
    });

    it('should dispatch to line', () => {
      expect(buildShapePath({ shapeType: 'line', x0: 0, y0: 0, x1: 10, y1: 10 }).element).toBe(
        'line'
      );
    });

    it('should dispatch to polygon', () => {
      const r = buildShapePath({
        shapeType: 'polygon',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      });
      expect(r.element).toBe('polygon');
    });

    it('should dispatch to arc', () => {
      const r = buildShapePath({ shapeType: 'arc', width: 100, height: 100 });
      expect(r.element).toBe('path');
    });

    it('should dispatch to curve', () => {
      const r = buildShapePath({
        shapeType: 'curve',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      });
      expect(r.element).toBe('path');
    });

    it('should dispatch to freeform', () => {
      const r = buildShapePath({ shapeType: 'freeform', pathData: 'M 0 0', width: 10, height: 10 });
      expect(r.element).toBe('path');
    });

    it('should fallback to rect for unknown types', () => {
      const r = buildShapePath({ shapeType: 'mystery', width: 30, height: 30 });
      expect(r.element).toBe('rect');
    });

    it('should return null for null input', () => {
      expect(buildShapePath(null)).toBeNull();
    });
  });
});
