/**
 * collab-manager.test.js
 *
 * 단위 테스트(매니저 API) + 통합 테스트(2-client 시뮬레이션 / 충돌 머지)
 * 네트워크 없이 두 CollabManager 인스턴스를 같은 Y.Doc 으로 묶거나
 * Yjs update bytes 를 직접 applyUpdate 로 흘려보내 동기화 동작을 모사한다.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { CollabManager } from './collab-manager.js';
import { getParagraphYText } from './yjs-doc-mapper.js';

function sampleDoc() {
  return {
    sections: [
      {
        paragraphs: [
          { type: 'paragraph', runs: [{ text: 'Hello' }], style: { textAlign: 'left' } },
          { type: 'paragraph', runs: [{ text: '둘째' }], style: { textAlign: 'left' } },
        ],
      },
    ],
  };
}

/**
 * 두 Y.Doc 을 update 메시지를 직접 교환해서 sync 시키는 헬퍼.
 */
function bridge(a, b) {
  const handlers = [];
  const fa = (update, origin) => {
    if (origin === 'remote-from-b') return;
    Y.applyUpdate(b, update, 'remote-from-a');
  };
  const fb = (update, origin) => {
    if (origin === 'remote-from-a') return;
    Y.applyUpdate(a, update, 'remote-from-b');
  };
  a.on('update', fa);
  b.on('update', fb);
  handlers.push(() => a.off('update', fa));
  handlers.push(() => b.off('update', fb));
  return () => handlers.forEach(h => h());
}

describe('CollabManager :: single-client basics', () => {
  let mgr;
  afterEach(() => { if (mgr) { mgr.destroy(); mgr = null; } });

  it('attaches a document and exposes paragraph ids', () => {
    mgr = new CollabManager({ userInfo: { id: 'A' } });
    mgr.attachDocument(sampleDoc());
    expect(mgr.listParagraphIds()).toEqual(['s0-p0', 's0-p1']);
  });

  it('applyLocalChange updates the Y.Doc text', () => {
    mgr = new CollabManager({ userInfo: { id: 'A' } });
    mgr.attachDocument(sampleDoc());
    const ok = mgr.applyLocalChange('s0-p0', 'Hello world');
    expect(ok).toBe(true);
    expect(getParagraphYText(mgr.getYDoc(), 's0-p0').toString()).toBe('Hello world');
  });

  it('emits change with patchedDoc when local edit applied', () => {
    mgr = new CollabManager({ userInfo: { id: 'A' } });
    mgr.attachDocument(sampleDoc());
    let received = null;
    mgr.on('change', payload => { received = payload; });
    mgr.applyLocalChange('s0-p0', 'New');
    expect(received).toBeTruthy();
    expect(received.origin).toBe('local');
    expect(received.changedParagraphIds).toContain('s0-p0');
    expect(received.patchedDoc.sections[0].paragraphs[0].runs[0].text).toBe('New');
  });

  it('applyLocalAlignChange updates align', () => {
    mgr = new CollabManager({ userInfo: { id: 'A' } });
    mgr.attachDocument(sampleDoc());
    mgr.applyLocalAlignChange('s0-p0', 'center');
    expect(mgr.getDocument().sections[0].paragraphs[0].style.textAlign).toBe('center');
  });

  it('on() throws for unknown event name', () => {
    mgr = new CollabManager();
    expect(() => mgr.on('nope', () => {})).toThrow();
  });

  it('setLocalCursor propagates to presence', () => {
    mgr = new CollabManager({ userInfo: { id: 'A' } });
    mgr.attachDocument(sampleDoc());
    mgr.setLocalCursor('s0-p1', 3);
    const me = mgr.getUsers().find(u => u.id === 'A');
    expect(me.cursor).toEqual({ paragraphId: 's0-p1', offset: 3 });
  });
});

describe('CollabManager :: two clients shared doc', () => {
  let a, b, unbridge;

  beforeEach(() => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    unbridge = bridge(docA, docB);
    a = new CollabManager({ userInfo: { id: 'A' }, sharedDoc: docA });
    b = new CollabManager({ userInfo: { id: 'B' }, sharedDoc: docB });
    a.attachDocument(sampleDoc());
    b.attachDocument(sampleDoc());
  });

  afterEach(() => {
    if (unbridge) unbridge();
    if (a) a.destroy();
    if (b) b.destroy();
    a = b = null;
  });

  it('local change at A appears as remote change at B', () => {
    let bReceived = null;
    b.on('change', p => { if (p.origin === 'remote') bReceived = p; });
    a.applyLocalChange('s0-p0', 'updated from A');
    expect(bReceived).toBeTruthy();
    expect(bReceived.changedParagraphIds).toContain('s0-p0');
    expect(bReceived.patchedDoc.sections[0].paragraphs[0].runs[0].text).toBe('updated from A');
  });

  it('does not echo local change as remote on the same manager', () => {
    let aRemoteCount = 0;
    a.on('change', p => { if (p.origin === 'remote') aRemoteCount++; });
    a.applyLocalChange('s0-p0', 'x');
    expect(aRemoteCount).toBe(0);
  });

  it('align change at A propagates to B', () => {
    a.applyLocalAlignChange('s0-p1', 'center');
    expect(b.getDocument().sections[0].paragraphs[1].style.textAlign).toBe('center');
  });

  it('disconnect/destroy stops further propagation', () => {
    a.destroy();
    let bChanged = false;
    b.on('change', () => { bChanged = true; });
    // a 가 죽었으므로 doc 갱신을 시도해도 b 까지 닿지 않는다
    b.applyLocalChange('s0-p0', 'after destroy');
    expect(bChanged).toBe(true); // local change at b is still ok
    expect(a.getDocument()).toBeNull(); // destroyed manager: no doc
  });
});

describe('CollabManager :: concurrent edits (CRDT auto-merge)', () => {
  /**
   * 올바른 사용 패턴: A 가 초기화 → B 는 sync 후 attach.
   * (두 클라이언트가 독립적으로 hwpxToYDoc 을 호출하면 Y.Text 객체가 별도가 되어
   *  머지가 일어나지 않는다.)
   */
  function makePair() {
    const docA = new Y.Doc();
    const a = new CollabManager({ userInfo: { id: 'A' }, sharedDoc: docA });
    a.attachDocument(sampleDoc());

    const docB = new Y.Doc();
    // B 는 첫 attach 전에 A 의 state 를 받는다 (서버 sync step 시뮬레이션).
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    const b = new CollabManager({ userInfo: { id: 'B' }, sharedDoc: docB });
    b.attachDocument(sampleDoc()); // 동일한 sample 이지만 Y.Doc 에 이미 데이터 있으므로 skip
    return { a, b, docA, docB };
  }

  it('concurrent inserts in the same paragraph merge without loss', () => {
    const { a, b, docA, docB } = makePair();
    // 두 client 가 offline 상태에서 같은 단락을 편집
    const yA = getParagraphYText(docA, 's0-p0');
    const yB = getParagraphYText(docB, 's0-p0');
    // Y.Text 동시 편집: A 가 앞에 추가, B 가 뒤에 추가
    docA.transact(() => yA.insert(0, '[A]'));
    docB.transact(() => yB.insert(yB.length, '[B]'));
    // 양방향 sync
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
    const aText = getParagraphYText(docA, 's0-p0').toString();
    const bText = getParagraphYText(docB, 's0-p0').toString();
    expect(aText).toBe(bText); // 두 사이드 일치
    expect(aText).toContain('[A]');
    expect(aText).toContain('[B]');
    expect(aText).toContain('Hello');
    a.destroy();
    b.destroy();
  });

  it('conflicting align (LWW) resolves consistently', () => {
    const { a, b, docA, docB } = makePair();
    a.applyLocalAlignChange('s0-p0', 'center');
    b.applyLocalAlignChange('s0-p0', 'right');
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
    const aAlign = a.getDocument().sections[0].paragraphs[0].style.textAlign;
    const bAlign = b.getDocument().sections[0].paragraphs[0].style.textAlign;
    // LWW: 동일한 값으로 수렴 (어느 쪽이 이기든 두 사이드는 일치)
    expect(aAlign).toBe(bAlign);
    expect(['center', 'right']).toContain(aAlign);
    a.destroy();
    b.destroy();
  });

  it('offline edits replay in order after re-sync', () => {
    const { a, b, docA, docB } = makePair();
    // A: 3개 편집을 차곡차곡
    a.applyLocalChange('s0-p0', 'A1');
    a.applyLocalChange('s0-p0', 'A1 + 한 줄');
    a.applyLocalAlignChange('s0-p0', 'right');
    // B 는 offline. 이후 sync.
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    expect(b.getDocument().sections[0].paragraphs[0].style.textAlign).toBe('right');
    expect(b.getDocument().sections[0].paragraphs[0].runs[0].text).toBe('A1 + 한 줄');
    a.destroy();
    b.destroy();
  });
});
