/**
 * Autocomplete Word Index
 * 자동완성을 위한 단어 인덱스 — 3개 소스 통합:
 *
 *   1) 문서 내 모든 단어 (열려있는 HWPX/문자열)
 *   2) 사용자 사전 (`spell/user-dictionary` 의 custom 단어)
 *   3) 최근 사용 단어(MRU, 최근 100개) — 영속화는 `persistence` 모듈 사용
 *
 * 빈도 가중치:
 *   - MRU(최근 사용)        : ×3
 *   - 사용자 사전(custom)   : ×2
 *   - 문서 내 등장          : ×1 (등장 횟수 그대로)
 *
 * Note: 다른 트랙(spell-checker, search) 영역은 건드리지 않고
 *       `user-dictionary` 의 listAll() 만 import 한다.
 *
 * @module autocomplete/word-index
 * @version 1.0.0
 */

import { Trie } from './trie.js';
import { listAll as listUserDict } from '../spell/user-dictionary.js';
import * as persistence from './persistence.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('AutocompleteWordIndex');

/** 가중치 상수 — 정렬 시 빈도에 곱해진다. */
export const WEIGHTS = Object.freeze({
  DOCUMENT: 1,
  USER_DICT: 2,
  MRU: 3,
});

const MRU_LIMIT_DEFAULT = 100;

/**
 * 단어 후보 검색 결과.
 * @typedef {Object} WordCandidate
 * @property {string} word
 * @property {number} frequency
 * @property {Array<'document'|'userDict'|'mru'>} sources
 */

/**
 * 단어 인덱스 — Trie 위에 소스 메타데이터 레이어.
 */
export class WordIndex {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.mruLimit=100]
   * @param {boolean} [opts.hangulOnly=false]  한글 단어만 추출/허용
   * @param {boolean} [opts.ignoreCase=false]  대소문자 무시
   * @param {number}  [opts.minLength=2]       최소 단어 길이
   */
  constructor(opts = {}) {
    this.mruLimit = Number.isFinite(opts.mruLimit) ? Math.floor(opts.mruLimit) : MRU_LIMIT_DEFAULT;
    this.hangulOnly = !!opts.hangulOnly;
    this.ignoreCase = !!opts.ignoreCase;
    this.minLength = Number.isFinite(opts.minLength) && opts.minLength > 0 ? Math.floor(opts.minLength) : 2;

    /** @type {Trie} */
    this.trie = new Trie();
    /** @type {Map<string, Set<'document'|'userDict'|'mru'>>} */
    this._sources = new Map();
    /** @type {Array<{ word:string, lastUsed:number }>} */
    this._mruOrder = [];
  }

  /**
   * 문서 텍스트(또는 텍스트 노드 배열) 에서 단어를 추출하고 인덱스에 추가.
   *
   * @param {string | Array<string> | { text?:string, paragraphs?:Array<string> } | null} doc
   * @returns {number} 추가된 unique 단어 수 (이 호출에서 신규로 들어간 단어)
   */
  buildFromDocument(doc) {
    if (!doc) return 0;
    const text = this._normalizeDocInput(doc);
    if (!text) return 0;

    const words = this._extractWords(text);
    let added = 0;
    for (const w of words) {
      const norm = this._normalizeWord(w);
      if (!norm) continue;
      const wasNew = this.trie.insert(norm, WEIGHTS.DOCUMENT);
      if (wasNew) added += 1;
      this._addSource(norm, 'document');
    }
    logger.debug(`[WordIndex] buildFromDocument: ${words.length} tokens, ${added} new`);
    return added;
  }

  /**
   * 사용자 사전(spell/user-dictionary) 의 단어를 인덱스에 병합.
   * @returns {number} 추가된 단어 수
   */
  mergeUserDictionary() {
    let snap;
    try {
      snap = listUserDict();
    } catch (err) {
      logger.warn('[WordIndex] user-dictionary read failed:', err);
      return 0;
    }
    if (!snap || !Array.isArray(snap.custom)) return 0;
    let added = 0;
    for (const w of snap.custom) {
      const norm = this._normalizeWord(w);
      if (!norm) continue;
      const wasNew = this.trie.insert(norm, WEIGHTS.USER_DICT);
      if (wasNew) added += 1;
      this._addSource(norm, 'userDict');
    }
    return added;
  }

  /**
   * persistence(IndexedDB/localStorage/memory)에서 MRU 단어를 로드해 병합.
   *
   * @returns {Promise<number>} 병합된 단어 수
   */
  async loadMru() {
    let list = [];
    try {
      list = await persistence.getMru(this.mruLimit);
    } catch (err) {
      logger.warn('[WordIndex] persistence.getMru failed:', err);
      return 0;
    }
    if (!Array.isArray(list) || list.length === 0) return 0;
    let added = 0;
    for (const rec of list) {
      const norm = this._normalizeWord(rec.word);
      if (!norm) continue;
      const baseFreq = Number.isFinite(rec.frequency) && rec.frequency > 0 ? rec.frequency : 1;
      const wasNew = this.trie.insert(norm, baseFreq * WEIGHTS.MRU);
      if (wasNew) added += 1;
      this._addSource(norm, 'mru');
      this._mruOrder.push({ word: norm, lastUsed: rec.lastUsed || 0 });
    }
    // MRU 시간순 정렬 (최신이 앞)
    this._mruOrder.sort((a, b) => b.lastUsed - a.lastUsed);
    if (this._mruOrder.length > this.mruLimit) {
      this._mruOrder.length = this.mruLimit;
    }
    return added;
  }

  /**
   * 단어 사용 빈도 +1 — MRU 순서도 갱신하고 persistence 에도 비동기 저장.
   *
   * @param {string} word
   * @param {{ persist?: boolean }} [opts]
   * @returns {number} 갱신된 누적 빈도
   */
  incrementUsage(word, opts = {}) {
    const norm = this._normalizeWord(word);
    if (!norm) return 0;
    const persist = opts.persist !== false;

    const newFreq = this.trie.incrementFrequency(norm);
    this._addSource(norm, 'mru');

    // MRU 순서 갱신 — 기존 항목 제거 후 맨 앞에 삽입
    const idx = this._mruOrder.findIndex((r) => r.word === norm);
    if (idx >= 0) this._mruOrder.splice(idx, 1);
    this._mruOrder.unshift({ word: norm, lastUsed: Date.now() });
    if (this._mruOrder.length > this.mruLimit) {
      this._mruOrder.length = this.mruLimit;
    }

    if (persist) {
      // 비동기 — 결과를 기다리지 않음 (실패해도 fire-and-forget)
      persistence
        .put({ word: norm, frequency: newFreq, lastUsed: Date.now() })
        .catch((err) => logger.warn('[WordIndex] persistence.put failed:', err));
    }

    return newFreq;
  }

  /**
   * prefix 기반 후보 검색 — Trie 결과에 소스 메타데이터를 첨부.
   *
   * @param {string} prefix
   * @param {number} [limit=10]
   * @returns {Array<WordCandidate>}
   */
  search(prefix, limit = 10) {
    const norm = this._normalizeWord(prefix);
    if (!norm) return [];
    const matches = this.trie.searchPrefix(norm, limit);
    return matches.map((m) => ({
      word: m.word,
      frequency: m.frequency,
      sources: Array.from(this._sources.get(m.word) || new Set()),
    }));
  }

  /**
   * 등록된 단어 개수.
   * @returns {number}
   */
  get size() {
    return this.trie.size;
  }

  /**
   * 전체 인덱스 초기화 (메모리만 — persistence 는 별도 호출 필요).
   */
  clear() {
    this.trie.clear();
    this._sources.clear();
    this._mruOrder = [];
  }

  /**
   * 디버그/테스트 — 단어별 소스 확인.
   * @param {string} word
   * @returns {Array<'document'|'userDict'|'mru'>}
   */
  sourcesOf(word) {
    const norm = this._normalizeWord(word);
    if (!norm) return [];
    return Array.from(this._sources.get(norm) || new Set());
  }

  /* ─────────────────────────── 내부 유틸 ─────────────────────────── */

  _addSource(word, source) {
    let s = this._sources.get(word);
    if (!s) {
      s = new Set();
      this._sources.set(word, s);
    }
    s.add(source);
  }

  /**
   * 문서 입력을 단일 문자열로 정규화.
   * @param {*} doc
   * @returns {string}
   */
  _normalizeDocInput(doc) {
    if (typeof doc === 'string') return doc;
    if (Array.isArray(doc)) return doc.filter((s) => typeof s === 'string').join('\n');
    if (typeof doc === 'object') {
      if (typeof doc.text === 'string') return doc.text;
      if (Array.isArray(doc.paragraphs)) {
        return doc.paragraphs.filter((s) => typeof s === 'string').join('\n');
      }
    }
    return '';
  }

  /**
   * 단어 정규화 — 옵션에 따라 case/허용 문자 결정.
   * @param {string} word
   * @returns {string}
   */
  _normalizeWord(word) {
    if (typeof word !== 'string') return '';
    let w = word.trim();
    if (w.length < this.minLength) return '';
    if (this.ignoreCase) w = w.toLowerCase();
    if (this.hangulOnly) {
      // 한글 음절(가-힣) + 자모(ㄱ-ㅎ, ㅏ-ㅣ) 만 허용
      if (!/^[가-힣ᄀ-ᇿ㄰-㆏]+$/.test(w)) {
        return '';
      }
    }
    return w;
  }

  /**
   * 텍스트에서 단어 토큰 추출.
   *  - 기본: 공백/구두점 분리, 알파벳·숫자·한글·한자 어절 유지
   *  - hangulOnly=true 면 한글 음절/자모만 매칭
   * @param {string} text
   * @returns {Array<string>}
   */
  _extractWords(text) {
    if (typeof text !== 'string' || text.length === 0) return [];
    const re = this.hangulOnly
      ? /[가-힣ᄀ-ᇿ㄰-㆏]+/g
      : /[\p{L}\p{N}_]+/gu;
    const matched = text.match(re);
    return matched ? matched : [];
  }
}

/**
 * 헬퍼 — 문서로부터 즉시 빌드된 인덱스를 만든다.
 *
 * @param {string | Array<string> | object} doc
 * @param {ConstructorParameters<typeof WordIndex>[0]} [opts]
 * @returns {WordIndex}
 */
export function buildFromDocument(doc, opts) {
  const idx = new WordIndex(opts);
  idx.buildFromDocument(doc);
  return idx;
}

export default WordIndex;
