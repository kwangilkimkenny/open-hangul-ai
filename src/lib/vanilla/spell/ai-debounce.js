/**
 * AI 맞춤법 호출 디바운스 + 캐시 + 취소
 *
 * 사용자가 입력을 멈춘 뒤 지정 ms(기본 5000ms) 후에 1회만 LLM 호출하도록 한다.
 * 또한:
 *   - 같은 텍스트(해시) 에 대한 호출은 캐시 결과를 즉시 반환한다.
 *   - 진행 중 호출은 새로운 호출이 들어오면 AbortController 로 취소한다.
 *
 * @module spell/ai-debounce
 * @version 1.0.0
 */

const DEFAULT_DELAY_MS = 5000;
const DEFAULT_CACHE_SIZE = 32;

/**
 * 빠른 비암호 해시 (FNV-1a 32bit). 캐시 키 생성에만 사용.
 * @param {string} s
 * @returns {string}
 */
export function hashText(s) {
  if (typeof s !== 'string' || s.length === 0) return '0';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

/**
 * @typedef {Object} AIDebouncer
 * @property {(text:string, runner:(args:{signal:AbortSignal})=>Promise<any>)=>Promise<any>} schedule
 *   디바운스된 실행기. 호출 시 새 타이머 시작 + 기존 진행 취소.
 *   같은 텍스트 캐시 hit 이면 즉시 반환 (await Promise.resolve).
 * @property {()=>void} cancel             진행 중/예정 중 호출 모두 취소
 * @property {()=>void} clearCache          캐시 비우기
 * @property {()=>number} pendingCount      대기/진행 통계 (테스트용)
 * @property {(text:string)=>any|undefined} peekCache  캐시 조회 (테스트용)
 */

/**
 * AI 디바운서 인스턴스 생성. 인스턴스마다 별도 타이머/캐시/AbortController 보유.
 *
 * @param {{ delay?:number, cacheSize?:number }} [options]
 * @returns {AIDebouncer}
 */
export function createAIDebouncer(options = {}) {
  const delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : DEFAULT_DELAY_MS;
  const cacheSize = Number.isFinite(options.cacheSize)
    ? Math.max(1, options.cacheSize)
    : DEFAULT_CACHE_SIZE;

  /** @type {Map<string, any>} */
  const cache = new Map();

  /** @type {{ timer:any, controller:AbortController|null, pendingReject:Function|null }} */
  const state = { timer: null, controller: null, pendingReject: null };

  function _abortInflight() {
    if (state.controller) {
      try { state.controller.abort(); } catch (_e) { /* ignore */ }
      state.controller = null;
    }
  }

  function _clearTimer() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function _rejectPending(reason) {
    if (state.pendingReject) {
      const fn = state.pendingReject;
      state.pendingReject = null;
      try { fn(reason); } catch (_e) { /* ignore */ }
    }
  }

  function _cacheSet(key, value) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > cacheSize) {
      const first = cache.keys().next().value;
      cache.delete(first);
    }
  }

  /**
   * @param {string} text
   * @param {(args:{signal:AbortSignal})=>Promise<any>} runner
   */
  function schedule(text, runner) {
    if (typeof text !== 'string') text = String(text ?? '');
    const key = hashText(text);

    // 캐시 hit — 즉시 반환 (디바운스 우회)
    if (cache.has(key)) {
      return Promise.resolve(cache.get(key));
    }

    // 새 스케줄: 기존 대기/진행 전부 취소
    _clearTimer();
    _abortInflight();
    _rejectPending(_makeAbortError('AI 호출이 새 입력으로 대체되어 취소되었습니다'));

    return new Promise((resolve, reject) => {
      state.pendingReject = reject;
      state.timer = setTimeout(async () => {
        state.timer = null;
        const controller = new AbortController();
        state.controller = controller;
        // pendingReject 는 in-flight 단계에서도 cancel 호출 시 reject 할 수 있게 유지

        try {
          const result = await runner({ signal: controller.signal });
          if (controller.signal.aborted) {
            reject(_makeAbortError('AI 호출이 취소되었습니다'));
            return;
          }
          _cacheSet(key, result);
          // pending 해제 (정상 완료)
          if (state.pendingReject === reject) state.pendingReject = null;
          if (state.controller === controller) state.controller = null;
          resolve(result);
        } catch (e) {
          if (state.pendingReject === reject) state.pendingReject = null;
          if (state.controller === controller) state.controller = null;
          reject(e);
        }
      }, delay);
    });
  }

  function cancel() {
    _clearTimer();
    _abortInflight();
    _rejectPending(_makeAbortError('AI 호출이 취소되었습니다'));
  }

  function clearCache() {
    cache.clear();
  }

  function pendingCount() {
    let n = 0;
    if (state.timer) n++;
    if (state.controller) n++;
    return n;
  }

  function peekCache(text) {
    return cache.get(hashText(text));
  }

  return { schedule, cancel, clearCache, pendingCount, peekCache };
}

function _makeAbortError(msg) {
  const err = new Error(msg);
  err.name = 'AbortError';
  /** @type {any} */ (err).code = 'AI_SPELL_ABORTED';
  return err;
}

export default { createAIDebouncer, hashText };
