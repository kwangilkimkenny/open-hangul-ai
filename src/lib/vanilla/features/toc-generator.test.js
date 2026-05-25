/**
 * TOC Generator 테스트
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  collectHeadings,
  buildTree,
  generateTOC,
  renderTOC,
  renderCrossReference,
} from './toc-generator.js';

function p(text, opts = {}) {
  const para = { type: 'paragraph', text, runs: [{ text }] };
  if (opts.outlineLevel) para.outlineLevel = opts.outlineLevel;
  if (opts.headingType) para.headingType = opts.headingType;
  if (opts.id) para.id = opts.id;
  return para;
}

describe('toc-generator.collectHeadings', () => {
  it('flattens outline-leveled paragraphs across sections', () => {
    const sections = [
      {
        elements: [
          p('Intro', { outlineLevel: 1, id: 'h1' }),
          p('text body'),
          p('1.1 sub', { outlineLevel: 2, id: 'h11' }),
        ],
      },
      { elements: [p('Chapter 2', { outlineLevel: 1, id: 'h2' })] },
    ];
    const flat = collectHeadings(sections);
    expect(flat.map(e => e.text)).toEqual(['Intro', '1.1 sub', 'Chapter 2']);
    expect(flat[0].level).toBe(1);
    expect(flat[1].level).toBe(2);
    expect(flat[2].paragraphId).toBe('h2');
  });

  it('uses headingType when outlineLevel is missing', () => {
    const sections = [{ elements: [p('Title', { headingType: 'HEADING_3' })] }];
    const flat = collectHeadings(sections);
    expect(flat[0].level).toBe(3);
  });

  it('attaches pageNumber from pageMap', () => {
    const sections = [{ elements: [p('A', { outlineLevel: 1, id: 'pa' })] }];
    const flat = collectHeadings(sections, { pageMap: new Map([['pa', 7]]) });
    expect(flat[0].pageNumber).toBe(7);
  });
});

describe('toc-generator.buildTree', () => {
  it('nests deeper levels under their parents', () => {
    const flat = [
      { level: 1, text: 'A', paragraphId: 'a' },
      { level: 2, text: 'A.1', paragraphId: 'a1' },
      { level: 3, text: 'A.1.1', paragraphId: 'a11' },
      { level: 2, text: 'A.2', paragraphId: 'a2' },
      { level: 1, text: 'B', paragraphId: 'b' },
    ];
    const tree = buildTree(flat);
    expect(tree.length).toBe(2);
    expect(tree[0].text).toBe('A');
    expect(tree[0].children.length).toBe(2);
    expect(tree[0].children[0].children[0].text).toBe('A.1.1');
    expect(tree[1].text).toBe('B');
    expect(tree[1].children.length).toBe(0);
  });
});

describe('toc-generator.renderTOC', () => {
  it('emits nav > ol > li > a structure with page numbers', () => {
    const sections = [
      {
        elements: [
          p('Intro', { outlineLevel: 1, id: 'h1' }),
          p('Body', { outlineLevel: 2, id: 'h11' }),
        ],
      },
    ];
    const { tree } = generateTOC(sections, {
      pageMap: new Map([
        ['h1', 1],
        ['h11', 2],
      ]),
    });
    const nav = renderTOC(tree, { title: '목차' });
    expect(nav.tagName).toBe('NAV');
    expect(nav.classList.contains('hwp-toc')).toBe(true);
    const links = nav.querySelectorAll('a.hwp-toc__link');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('#h1');
    expect(nav.querySelector('.hwp-toc__page').textContent).toBe('1');
    expect(nav.querySelector('.hwp-toc__leader')).not.toBeNull();
  });
});

describe('toc-generator.renderCrossReference', () => {
  it('para-X target → href="#para-X"', () => {
    const a = renderCrossReference('para-5', 'See section 2');
    expect(a.href).toContain('#para-5');
    expect(a.textContent).toBe('See section 2');
  });

  it('bookmark target → href="#bookmark-NAME"', () => {
    const a = renderCrossReference('intro');
    expect(a.href).toContain('#bookmark-intro');
  });
});
