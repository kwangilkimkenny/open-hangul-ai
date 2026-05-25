/**
 * BaseEditor — 공통 편집기 추상 클래스
 * ─────────────────────────────────────────────────────────────────────────────
 * Excel / Word / 기타 OLE 인플레이스 편집기들이 공유하는 공통 패턴을 정의한다.
 *
 *   - container 보관
 *   - dataModel 정규화 + 깊은 복사 직렬화
 *   - dirty flag
 *   - 이벤트 emitter (`dirty`, `change` 등)
 *   - destroy
 *
 * 서브클래스는 `render()` 와 (선택적으로) `_normalizeModel(m)` 만 구현하면 된다.
 * 모든 다른 메소드는 그대로 상속하거나 필요 시 override 한다.
 *
 * 보안 / 격리
 *   - render 결과 DOM 은 서브클래스가 직접 생성한다 (innerHTML 외부 주입 없음).
 *   - listener fn 에서 throw 가 발생해도 다른 listener 에 영향 없도록 격리.
 *
 * @module vanilla/core/base-editor
 */

/**
 * @typedef {Object} BaseEditorOptions
 * @property {HTMLElement} container
 * @property {any} [dataModel]
 */

export class BaseEditor {
  /**
   * @param {BaseEditorOptions} opts
   */
  constructor(opts) {
    const { container, dataModel } = opts || {};
    if (!container) throw new Error('BaseEditor: container required');
    /** @type {HTMLElement} */
    this.container = container;
    /** @type {any} */
    this.dataModel = this._normalizeModel(dataModel);
    /** @type {boolean} */
    this._dirty = false;
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  // -------------------------------------------------------------------------
  // 추상 — 서브클래스가 반드시/선택적으로 구현
  // -------------------------------------------------------------------------

  /**
   * DOM 렌더. 반드시 서브클래스에서 override.
   * @abstract
   */
  render() {
    throw new Error('render not implemented');
  }

  /**
   * dataModel 정규화. 기본은 그대로 통과.
   * @param {any} m
   * @returns {any}
   */
  _normalizeModel(m) {
    return m;
  }

  // -------------------------------------------------------------------------
  // 공통 — 모델 직렬화 / dirty
  // -------------------------------------------------------------------------

  /**
   * 현재 dataModel 을 JSON-안전한 깊은 복사로 직렬화한다.
   * Map / Set / typed array 는 지원하지 않음 — 그런 모델이 필요한 서브클래스는 override.
   * @returns {any}
   */
  _serializeModel() {
    return this.dataModel == null ? null : JSON.parse(JSON.stringify(this.dataModel));
  }

  /**
   * 외부에 노출되는 모델 접근자. 기본은 직렬화 사본 반환.
   * @returns {any}
   */
  getDataModel() {
    return this._serializeModel();
  }

  /**
   * 모델 교체 + 재렌더 + dirty 마킹.
   * @param {any} model
   */
  setDataModel(model) {
    this.dataModel = this._normalizeModel(model);
    this._markDirty();
    this.render();
  }

  /**
   * @returns {boolean}
   */
  isDirty() {
    return this._dirty;
  }

  /**
   * dirty flag 해제 (보통 외부에서 저장 후 호출).
   */
  markClean() {
    this._dirty = false;
  }

  /**
   * dirty 마킹 + `dirty` 이벤트 발행.
   * @protected
   */
  _markDirty() {
    this._dirty = true;
    this._emit('dirty');
  }

  // -------------------------------------------------------------------------
  // 이벤트
  // -------------------------------------------------------------------------

  /**
   * 이벤트 리스너 등록. unsubscribe 함수를 반환한다.
   * @param {string} event
   * @param {Function} fn
   * @returns {() => void}
   */
  on(event, fn) {
    if (typeof fn !== 'function') return () => {};
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  /**
   * 이벤트 리스너 해제.
   * @param {string} event
   * @param {Function} fn
   */
  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) set.delete(fn);
  }

  /**
   * 이벤트 발행. 각 listener 의 throw 는 무시한다.
   * @protected
   * @param {string} event
   * @param {*} [payload]
   */
  _emit(event, payload) {
    const fns = this._listeners.get(event);
    if (!fns || fns.size === 0) return;
    for (const fn of fns) {
      try {
        fn(payload);
      } catch (_e) {
        /* swallow listener errors so one bad listener can't break others */
      }
    }
  }

  // -------------------------------------------------------------------------
  // 라이프사이클
  // -------------------------------------------------------------------------

  /**
   * 기본 destroy: 리스너 해제 + 컨테이너 비우기.
   * 서브클래스는 자체 키 핸들러 등을 해제한 뒤 super.destroy() 호출.
   */
  destroy() {
    this._listeners.clear();
    if (this.container) {
      try {
        this.container.innerHTML = '';
      } catch (_e) {
        /* ignore (jsdom edge cases) */
      }
    }
  }
}

export default BaseEditor;
