/**
 * Unit tests for base-editor.js
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseEditor } from './base-editor.js';

// 테스트 전용 서브클래스
class DummyEditor extends BaseEditor {
  render() {
    if (this.container) this.container.dataset.rendered = '1';
  }
  _normalizeModel(m) {
    if (!m) return { kind: 'dummy', items: [] };
    return { kind: 'dummy', items: Array.isArray(m.items) ? m.items.slice() : [] };
  }
}

describe('BaseEditor — construction', () => {
  it('container 가 없으면 throw', () => {
    expect(() => new BaseEditor({ container: null })).toThrow(/container required/);
  });

  it('정상 생성 시 dataModel 보관', () => {
    const c = document.createElement('div');
    const e = new DummyEditor({ container: c, dataModel: { items: [1, 2] } });
    expect(e.container).toBe(c);
    expect(e.dataModel.items).toEqual([1, 2]);
    expect(e.isDirty()).toBe(false);
  });

  it('빈 dataModel 도 normalize 결과로 채워진다', () => {
    const c = document.createElement('div');
    const e = new DummyEditor({ container: c });
    expect(e.dataModel.kind).toBe('dummy');
  });
});

describe('BaseEditor — render 추상', () => {
  it('직접 render 호출 시 throw', () => {
    const c = document.createElement('div');
    const b = new BaseEditor({ container: c });
    expect(() => b.render()).toThrow(/render not implemented/);
  });

  it('서브클래스 render 정상 호출', () => {
    const c = document.createElement('div');
    const e = new DummyEditor({ container: c });
    e.render();
    expect(c.dataset.rendered).toBe('1');
  });
});

describe('BaseEditor — dirty flag', () => {
  let editor;
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    editor = new DummyEditor({ container, dataModel: { items: [] } });
  });

  it('초기 dirty 는 false', () => {
    expect(editor.isDirty()).toBe(false);
  });

  it('setDataModel 후 dirty=true', () => {
    editor.setDataModel({ items: [9] });
    expect(editor.isDirty()).toBe(true);
    expect(editor.dataModel.items).toEqual([9]);
  });

  it('markClean 으로 dirty 해제', () => {
    editor.setDataModel({ items: [1] });
    editor.markClean();
    expect(editor.isDirty()).toBe(false);
  });

  it('_markDirty 는 dirty 이벤트 발화', () => {
    let count = 0;
    editor.on('dirty', () => count++);
    editor._markDirty();
    editor._markDirty();
    expect(count).toBe(2);
  });
});

describe('BaseEditor — getDataModel 직렬화', () => {
  it('JSON 안전 깊은 복사', () => {
    const c = document.createElement('div');
    const e = new DummyEditor({ container: c, dataModel: { items: [1, 2, 3] } });
    const m1 = e.getDataModel();
    m1.items.push(999);
    const m2 = e.getDataModel();
    expect(m2.items).toEqual([1, 2, 3]);
  });

  it('null dataModel 도 안전', () => {
    const c = document.createElement('div');
    const b = new BaseEditor({ container: c });
    b.dataModel = null;
    expect(b.getDataModel()).toBeNull();
  });
});

describe('BaseEditor — 이벤트', () => {
  let editor;
  beforeEach(() => {
    editor = new DummyEditor({ container: document.createElement('div') });
  });

  it('on / off / emit 동작', () => {
    let payload = null;
    const fn = p => { payload = p; };
    editor.on('change', fn);
    editor._emit('change', { v: 1 });
    expect(payload).toEqual({ v: 1 });
    editor.off('change', fn);
    editor._emit('change', { v: 2 });
    expect(payload).toEqual({ v: 1 });
  });

  it('on 반환값으로 unsubscribe', () => {
    let count = 0;
    const unsub = editor.on('x', () => count++);
    editor._emit('x');
    unsub();
    editor._emit('x');
    expect(count).toBe(1);
  });

  it('한 리스너가 throw 해도 다른 리스너는 호출됨', () => {
    let ok = 0;
    editor.on('e', () => { throw new Error('bad'); });
    editor.on('e', () => { ok++; });
    editor._emit('e');
    expect(ok).toBe(1);
  });

  it('등록되지 않은 이벤트 emit 도 안전', () => {
    expect(() => editor._emit('nope')).not.toThrow();
  });
});

describe('BaseEditor — destroy', () => {
  it('container 비우고 리스너 해제', () => {
    const c = document.createElement('div');
    c.innerHTML = '<p>x</p>';
    const e = new DummyEditor({ container: c });
    let called = 0;
    e.on('dirty', () => called++);
    e.destroy();
    expect(c.innerHTML).toBe('');
    // destroy 후 emit 해도 호출 안 됨
    e._emit('dirty');
    expect(called).toBe(0);
  });
});
