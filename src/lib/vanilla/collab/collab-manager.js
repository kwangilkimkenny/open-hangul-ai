/**
 * CollabManager — Yjs 기반 실시간 협업 매니저 (Phase 1)
 *
 * 역할
 *  - HWPX 문서를 Y.Doc 로 변환하여 들고 있는다.
 *  - y-websocket Provider 를 통해 외부 서버와 동기화 (옵션).
 *  - 로컬/원격 변경을 같은 'change' 콜백으로 emit (UI 가 doc 을 패치할 때 사용).
 *  - Presence (다른 사용자 커서/색) 를 'presence' 콜백으로 emit.
 *
 * 사용 예
 *   const collab = new CollabManager({
 *     roomId: 'doc-123',
 *     wsUrl: 'ws://localhost:1234',
 *     userInfo: { id: 'u1', name: 'Alice' },
 *   });
 *   collab.attachDocument(hwpxDoc);
 *   const off = collab.on('change', changes => render(changes.patchedDoc));
 *   collab.applyLocalChange('s0-p0', 'Hello world');
 *   collab.disconnect();
 *
 * 옵션
 *  - wsUrl 가 비어 있으면 standalone (서버 미연결) 모드 → 두 CollabManager
 *    인스턴스를 동일 Y.Doc 로 묶고 싶을 때는 `sharedDoc` 옵션을 전달한다.
 *
 * 디자인 메모
 *  - 외부 의존(y-websocket) 은 동적 import 로 로드 → 테스트에서 모킹 가능.
 *  - applyLocalChange 는 Y.Text 의 전체 교체로 단순화 (정교한 diff 는 다음 트랙).
 *
 * @module collab/collab-manager
 */

import * as Y from 'yjs';
import {
  hwpxToYDoc,
  applyYDocToHwpx,
  setParagraphText,
  setParagraphAlign,
  getOrderedParagraphIds,
} from './yjs-doc-mapper.js';
import { Presence } from './presence.js';

const VALID_EVENTS = new Set(['change', 'presence', 'status']);

/**
 * @typedef {Object} CollabManagerOptions
 * @property {string} [roomId]
 * @property {string} [wsUrl]
 * @property {object} [userInfo]
 * @property {Y.Doc} [sharedDoc]    - 외부에서 주입할 Y.Doc (테스트/멀티 클라이언트)
 * @property {object} [provider]    - 미리 만든 provider (의존성 주입; awareness 만 사용)
 * @property {object} [awareness]   - awareness 직접 주입 (provider 없이도 사용)
 * @property {boolean} [autoConnect]
 */

export class CollabManager {
  /**
   * @param {CollabManagerOptions} [opts]
   */
  constructor(opts = {}) {
    this._opts = { autoConnect: true, ...opts };
    this._roomId = opts.roomId || 'default-room';
    this._wsUrl = opts.wsUrl || '';
    this._userInfo = opts.userInfo || {};

    this._ydoc = opts.sharedDoc instanceof Y.Doc ? opts.sharedDoc : new Y.Doc();
    this._provider = opts.provider || null;
    this._awareness = opts.awareness || (this._provider && this._provider.awareness) || null;

    this._presence = new Presence({ awareness: this._awareness, userInfo: this._userInfo });
    this._presenceOff = this._presence.onChange(users => this._emit('presence', users));

    this._listeners = {
      change: new Set(),
      presence: new Set(),
      status: new Set(),
    };

    this._attachedDoc = null;
    this._yObserverDeep = null;

    // 원격(외부) origin 식별자. transact(origin) 시 같은 origin 이면 echo 방지.
    this._localOrigin = Symbol('local');

    this._connected = false;
    this._destroyed = false;

    if (this._opts.autoConnect && this._wsUrl && !this._provider) {
      // Lazy-connect: 호출 시점 await 가 필요하므로 fire-and-forget
      this.connect().catch(err => this._emit('status', { type: 'error', error: err }));
    }
  }

  /**
   * HWPX 문서를 매니저에 부착.
   * - 처음이라면 Y.Doc 을 초기 sync 한다.
   * - 이후 변경은 'change' 이벤트로 emit.
   */
  attachDocument(hwpxDoc) {
    if (this._destroyed) return;
    this._attachedDoc = hwpxDoc;

    // 이미 sync 된 Y.Doc 이 비어있는 경우에만 초기 채우기 → race-condition 회피.
    const rootMap = this._ydoc.getMap('hwpx');
    const existing = rootMap.get('paragraphs');
    const isEmpty = !existing || (existing instanceof Y.Map && existing.size === 0);
    if (isEmpty) {
      hwpxToYDoc(hwpxDoc, this._ydoc);
    }

    // deep observer: 어떤 자식 변경에도 'change' 콜백을 호출.
    const root = this._ydoc.getMap('hwpx');
    this._yObserverDeep = (events, transaction) => {
      // 로컬 transact 라면 echo 하지 않는다 — UI 는 이미 알고 있음.
      if (transaction && transaction.origin === this._localOrigin) return;
      const changedIds = collectChangedParagraphIds(events);
      const patchedDoc = applyYDocToHwpx(this._ydoc, this._attachedDoc || hwpxDoc);
      this._attachedDoc = patchedDoc;
      this._emit('change', {
        changedParagraphIds: Array.from(changedIds),
        patchedDoc,
        origin: 'remote',
      });
    };
    root.observeDeep(this._yObserverDeep);
  }

  /**
   * 로컬 텍스트 변경을 Y.Doc 에 반영.
   */
  applyLocalChange(paragraphId, newText) {
    if (this._destroyed) return false;
    let ok = false;
    this._ydoc.transact(() => {
      ok = setParagraphText(this._ydoc, paragraphId, newText);
    }, this._localOrigin);
    if (ok && this._attachedDoc) {
      this._attachedDoc = applyYDocToHwpx(this._ydoc, this._attachedDoc);
      this._emit('change', {
        changedParagraphIds: [paragraphId],
        patchedDoc: this._attachedDoc,
        origin: 'local',
      });
    }
    return ok;
  }

  /**
   * 로컬 정렬 변경.
   */
  applyLocalAlignChange(paragraphId, align) {
    if (this._destroyed) return false;
    let ok = false;
    this._ydoc.transact(() => {
      ok = setParagraphAlign(this._ydoc, paragraphId, align);
    }, this._localOrigin);
    if (ok && this._attachedDoc) {
      this._attachedDoc = applyYDocToHwpx(this._ydoc, this._attachedDoc);
      this._emit('change', {
        changedParagraphIds: [paragraphId],
        patchedDoc: this._attachedDoc,
        origin: 'local',
      });
    }
    return ok;
  }

  /**
   * 현재 cursor 위치 broadcast.
   */
  setLocalCursor(paragraphId, offset) {
    if (this._destroyed) return;
    if (!paragraphId) {
      this._presence.setLocalCursor(null);
      return;
    }
    this._presence.setLocalCursor({
      paragraphId: String(paragraphId),
      offset: Number.isFinite(offset) ? offset : 0,
    });
  }

  /**
   * y-websocket provider 를 동적 import 로 만든다.
   * 의존성 주입을 위해 분리.
   */
  async connect() {
    if (this._destroyed || this._connected || !this._wsUrl) return false;
    try {
      // y-websocket 의 default export 는 환경에 따라 다른 형태.
      const mod = await import('y-websocket');
      const WebsocketProvider = mod.WebsocketProvider || (mod.default && mod.default.WebsocketProvider);
      if (!WebsocketProvider) throw new Error('WebsocketProvider not found in y-websocket');
      this._provider = new WebsocketProvider(this._wsUrl, this._roomId, this._ydoc, {
        connect: true,
      });
      this._awareness = this._provider.awareness;
      // Awareness 가 늦게 들어오면 Presence 재초기화
      this._reinitPresence();
      if (typeof this._provider.on === 'function') {
        this._provider.on('status', (evt) => this._emit('status', evt));
      }
      this._connected = true;
      this._emit('status', { type: 'connected', roomId: this._roomId });
      return true;
    } catch (err) {
      this._emit('status', { type: 'error', error: err });
      return false;
    }
  }

  _reinitPresence() {
    if (this._presenceOff) this._presenceOff();
    this._presence.destroy();
    this._presence = new Presence({ awareness: this._awareness, userInfo: this._userInfo });
    this._presenceOff = this._presence.onChange(users => this._emit('presence', users));
  }

  /**
   * 이벤트 구독 등록.
   * @param {'change'|'presence'|'status'} event
   * @param {Function} cb
   * @returns {() => void} unsubscribe
   */
  on(event, cb) {
    if (!VALID_EVENTS.has(event)) {
      throw new Error(`CollabManager.on: unknown event "${event}"`);
    }
    if (typeof cb !== 'function') return () => {};
    this._listeners[event].add(cb);
    return () => this._listeners[event].delete(cb);
  }

  off(event, cb) {
    if (!VALID_EVENTS.has(event)) return;
    this._listeners[event].delete(cb);
  }

  _emit(event, payload) {
    const set = this._listeners[event];
    if (!set) return;
    for (const cb of set) {
      try {
        cb(payload);
      } catch {
        /* swallow */
      }
    }
  }

  /**
   * 현재 부착된 (가장 최신) HWPX 문서 스냅샷.
   * destroy() 후에는 null 을 반환한다.
   */
  getDocument() {
    if (this._destroyed) return null;
    if (!this._attachedDoc) return null;
    return this._attachedDoc;
  }

  /**
   * Y.Doc 핸들 (고급 사용자/테스트용).
   */
  getYDoc() {
    return this._ydoc;
  }

  /**
   * Presence 헬퍼 위임.
   */
  getUsers() {
    return this._presence.getUsers();
  }

  /**
   * 동기화된 문단 ID 목록.
   */
  listParagraphIds() {
    return getOrderedParagraphIds(this._ydoc);
  }

  /**
   * provider 정리 및 자원 해제.
   */
  disconnect() {
    if (this._destroyed) return;
    if (this._provider && typeof this._provider.disconnect === 'function') {
      try { this._provider.disconnect(); } catch { /* noop */ }
    }
    if (this._provider && typeof this._provider.destroy === 'function') {
      try { this._provider.destroy(); } catch { /* noop */ }
    }
    this._connected = false;
    this._emit('status', { type: 'disconnected', roomId: this._roomId });
  }

  /**
   * 완전 파괴 — observer/listener 해제, Y.Doc 도 destroy.
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.disconnect();
    if (this._yObserverDeep) {
      try {
        this._ydoc.getMap('hwpx').unobserveDeep(this._yObserverDeep);
      } catch {
        /* noop */
      }
    }
    if (this._presenceOff) this._presenceOff();
    this._presence.destroy();
    for (const set of Object.values(this._listeners)) set.clear();
    try { this._ydoc.destroy(); } catch { /* noop */ }
  }
}

/**
 * Yjs deep-event 배열에서 변경된 paragraphId 목록을 추출.
 */
function collectChangedParagraphIds(events) {
  const ids = new Set();
  if (!Array.isArray(events)) return ids;
  for (const ev of events) {
    const path = ev && ev.path;
    if (!Array.isArray(path)) continue;
    // 우리 구조에서 paragraphs Map 의 자식: ['paragraphs', '<id>', ...]
    const pIndex = path.indexOf('paragraphs');
    if (pIndex >= 0 && typeof path[pIndex + 1] === 'string') {
      ids.add(path[pIndex + 1]);
      continue;
    }
    // Map level 자체에서 key 추가/삭제
    if (path.length === 1 && path[0] === 'paragraphs' && ev.keys) {
      ev.keys.forEach((_v, k) => ids.add(k));
    }
  }
  return ids;
}

export const _testInternals = { collectChangedParagraphIds };
