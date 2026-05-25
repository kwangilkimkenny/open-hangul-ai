/**
 * Presence — Yjs awareness 기반 사용자 상태 관리 (Phase 1)
 *
 * y-protocols/awareness 의 Awareness 인스턴스를 wrapping 한다.
 * - 각 사용자: { id, name, color, cursor: { paragraphId, offset } | null }
 * - 변경 이벤트는 'update'/'change' 콜백으로 라우팅.
 * - 색상은 사용자 ID 해시 기반으로 결정적이라 두 클라이언트가 동일 색을 본다.
 *
 * 의존성 그래프:
 *  CollabManager → Presence → y-protocols/awareness
 *
 * @module collab/presence
 */

const DEFAULT_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#9575cd',
  '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1',
  '#4db6ac', '#81c784', '#aed581', '#ffd54f',
  '#ffb74d', '#ff8a65', '#a1887f', '#90a4ae',
];

/**
 * 사용자 ID 를 결정론적 색상으로 매핑.
 */
export function pickColorForId(id) {
  const s = String(id || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % DEFAULT_COLORS.length;
  return DEFAULT_COLORS[idx];
}

/**
 * Presence
 *
 *  - awareness 가 없으면 (서버 미연결) 로컬-only 모드로 동작.
 *  - awareness 가 있으면 setLocalStateField/getStates 위임.
 */
export class Presence {
  constructor({ awareness = null, userInfo = {} } = {}) {
    this._awareness = awareness;
    this._listeners = new Set();
    /** @type {Map<number|string, {id: string, name: string, color: string, cursor: any}>} */
    this._localFallback = new Map();
    this._localUser = this._buildLocalUser(userInfo);

    if (this._awareness && typeof this._awareness.setLocalStateField === 'function') {
      this._awareness.setLocalStateField('user', {
        id: this._localUser.id,
        name: this._localUser.name,
        color: this._localUser.color,
      });
      this._awareness.setLocalStateField('cursor', null);

      this._awarenessChange = () => {
        this._emit();
      };
      this._awareness.on('change', this._awarenessChange);
      this._awareness.on('update', this._awarenessChange);
    } else {
      // Local-only fallback: register self.
      const selfKey = this._localUser.id;
      this._localFallback.set(selfKey, { ...this._localUser, cursor: null });
    }
  }

  _buildLocalUser(userInfo) {
    const id = (userInfo && userInfo.id) || `user-${Math.random().toString(36).slice(2, 10)}`;
    const name = (userInfo && userInfo.name) || `User-${String(id).slice(0, 4)}`;
    const color = (userInfo && userInfo.color) || pickColorForId(id);
    return { id: String(id), name: String(name), color: String(color) };
  }

  /**
   * 다른 사용자(자신 포함) 목록을 평탄화하여 반환.
   * @returns {Array<{id:string,name:string,color:string,cursor:any}>}
   */
  getUsers() {
    if (this._awareness && typeof this._awareness.getStates === 'function') {
      const out = [];
      const states = this._awareness.getStates();
      states.forEach((state /* , clientID */) => {
        const u = state && state.user;
        if (!u || !u.id) return;
        out.push({
          id: String(u.id),
          name: String(u.name || ''),
          color: String(u.color || pickColorForId(u.id)),
          cursor: state.cursor || null,
        });
      });
      // 중복 ID 제거 (한 사용자가 여러 탭으로 접속해도 한 줄로 표시)
      const seen = new Set();
      return out.filter(u => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });
    }
    // Fallback
    return Array.from(this._localFallback.values()).map(u => ({ ...u }));
  }

  /**
   * 로컬 사용자의 cursor 를 갱신.
   * @param {{paragraphId: string, offset: number} | null} cursor
   */
  setLocalCursor(cursor) {
    if (this._awareness && typeof this._awareness.setLocalStateField === 'function') {
      this._awareness.setLocalStateField('cursor', cursor || null);
      // awareness 의 'change' 이벤트가 자동으로 트리거됨
      return;
    }
    const u = this._localFallback.get(this._localUser.id);
    if (u) u.cursor = cursor || null;
    this._emit();
  }

  /**
   * 변경 이벤트 구독.
   * @param {(users: Array) => void} cb
   * @returns {() => void} unsubscribe
   */
  onChange(cb) {
    if (typeof cb !== 'function') return () => {};
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _emit() {
    const users = this.getUsers();
    for (const cb of this._listeners) {
      try {
        cb(users);
      } catch {
        // 콜백 예외는 다른 콜백 실행을 막지 않는다
      }
    }
  }

  /**
   * 로컬-only 모드 전용: 가짜 원격 사용자 추가 (테스트/데모용).
   */
  _addLocalRemoteUser(user) {
    if (this._awareness) return false;
    if (!user || !user.id) return false;
    this._localFallback.set(user.id, {
      id: String(user.id),
      name: String(user.name || `User-${String(user.id).slice(0, 4)}`),
      color: String(user.color || pickColorForId(user.id)),
      cursor: user.cursor || null,
    });
    this._emit();
    return true;
  }

  /**
   * 로컬-only 모드 전용: 원격 사용자 제거.
   */
  _removeLocalRemoteUser(userId) {
    if (this._awareness) return false;
    if (this._localFallback.delete(String(userId))) {
      this._emit();
      return true;
    }
    return false;
  }

  /**
   * 로컬-only 모드 전용: 원격 사용자의 cursor 갱신.
   */
  _setLocalRemoteCursor(userId, cursor) {
    if (this._awareness) return false;
    const u = this._localFallback.get(String(userId));
    if (!u) return false;
    u.cursor = cursor || null;
    this._emit();
    return true;
  }

  getLocalUser() {
    return { ...this._localUser };
  }

  destroy() {
    if (this._awareness && this._awarenessChange) {
      try {
        this._awareness.off('change', this._awarenessChange);
        this._awareness.off('update', this._awarenessChange);
      } catch {
        /* noop */
      }
    }
    this._listeners.clear();
    this._localFallback.clear();
  }
}
