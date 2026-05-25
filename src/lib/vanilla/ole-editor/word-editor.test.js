/**
 * Unit tests for word-editor.js
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WordEditor, __test__ } from './word-editor.js';

const { collectRuns, normalizeWordModel } = __test__;

function baseModel() {
  return {
    type: 'word',
    paragraphs: [
      { runs: [{ text: '제목', bold: true }] },
      { runs: [{ text: '본문 첫째 줄' }], align: 'center' },
      { runs: [{ text: '이탤릭 ', italic: true }, { text: '일반' }] },
    ],
  };
}

describe('normalizeWordModel', () => {
  it('기본 모델 보강', () => {
    const m = normalizeWordModel(null);
    expect(m.type).toBe('word');
    expect(m.paragraphs.length).toBe(1);
  });

  it('잘못된 runs 는 빈 텍스트로 대체', () => {
    const m = normalizeWordModel({ paragraphs: [{ runs: null }] });
    expect(m.paragraphs[0].runs[0]).toEqual({ text: '' });
  });

  it('align 화이트리스트만 통과', () => {
    const m = normalizeWordModel({
      paragraphs: [
        { runs: [{ text: 'x' }], align: 'center' },
        { runs: [{ text: 'y' }], align: 'evil-script' },
      ],
    });
    expect(m.paragraphs[0].align).toBe('center');
    expect(m.paragraphs[1].align).toBeUndefined();
  });
});

describe('collectRuns', () => {
  it('text node → run', () => {
    const t = document.createTextNode('hi');
    expect(collectRuns(t)).toEqual([{ text: 'hi' }]);
  });

  it('<b> 안의 텍스트는 bold 로 마킹', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<b>강조</b>';
    const runs = [];
    for (const c of Array.from(wrap.childNodes)) runs.push(...collectRuns(c));
    expect(runs).toEqual([{ text: '강조', bold: true }]);
  });

  it('중첩 inline 스타일 합성', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<b><i>둘다</i></b>';
    const runs = [];
    for (const c of Array.from(wrap.childNodes)) runs.push(...collectRuns(c));
    expect(runs).toEqual([{ text: '둘다', bold: true, italic: true }]);
  });
});

describe('WordEditor rendering', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('단락을 렌더링한다', () => {
    const editor = new WordEditor({ container, dataModel: baseModel() });
    editor.render();
    const ps = container.querySelectorAll('p.ole-word-editor__para');
    expect(ps.length).toBe(3);
    expect(ps[0].textContent).toBe('제목');
  });

  it('contenteditable 영역과 툴바를 만든다', () => {
    const editor = new WordEditor({ container, dataModel: baseModel() });
    editor.render();
    expect(container.querySelector('[contenteditable="true"]')).toBeTruthy();
    const buttons = container.querySelectorAll('.ole-word-editor__toolbar button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('정렬 변경이 모델에 반영된다', () => {
    const editor = new WordEditor({ container, dataModel: baseModel() });
    editor.render();
    // selection 없이도 첫 단락에 적용
    editor.setAlignment('right');
    const model = editor.getDataModel();
    expect(model.paragraphs[0].align).toBe('right');
  });

  it('setPlainText 가 단락 모델을 교체', () => {
    const editor = new WordEditor({ container, dataModel: baseModel() });
    editor.render();
    editor.setPlainText('첫줄\n둘째줄');
    const m = editor.getDataModel();
    expect(m.paragraphs.length).toBe(2);
    expect(m.paragraphs[0].runs[0].text).toBe('첫줄');
    expect(m.paragraphs[1].runs[0].text).toBe('둘째줄');
  });

  it('getDataModel 은 깊은 복사본을 반환', () => {
    const editor = new WordEditor({ container, dataModel: baseModel() });
    editor.render();
    const m1 = editor.getDataModel();
    m1.paragraphs[0].runs[0].text = 'mutated';
    const m2 = editor.getDataModel();
    expect(m2.paragraphs[0].runs[0].text).toBe('제목');
  });

  it('초기 모델의 bold/italic 정보가 DOM 으로 직렬화된다', () => {
    const editor = new WordEditor({ container, dataModel: baseModel() });
    editor.render();
    const spans = container.querySelectorAll('span.ole-word-editor__run');
    const first = spans[0];
    expect(first.dataset.bold).toBe('1');
    const lastP = container.querySelectorAll('p')[2];
    const italic = lastP.querySelector('span[data-italic="1"]');
    expect(italic).toBeTruthy();
  });

  it('destroy 후에는 컨테이너가 비워진다', () => {
    const editor = new WordEditor({ container, dataModel: baseModel() });
    editor.render();
    editor.destroy();
    expect(container.children.length).toBe(0);
  });
});
