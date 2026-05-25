/**
 * Autocomplete Trie
 * 단어 자동완성을 위한 Trie(prefix tree) 자료구조 — 빈도 기반 정렬 지원.
 *
 * - 한글/영문/숫자/혼합 어떤 문자열이든 코드포인트 단위로 인덱싱
 * - 노드 단위로 단어 종료 여부(`isEnd`)와 누적 빈도(`frequency`) 관리
 * - `searchPrefix(prefix)` 는 빈도 내림차순(동률 시 사전순)으로 후보 반환
 * - `serialize() / deserialize()` 로 영속화 가능 (autocomplete-mru / 사용자 사전 등)
 *
 * @module autocomplete/trie
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('AutocompleteTrie');

/**
 * @typedef {Object} TrieMatch
 * @property {string} word       전체 단어
 * @property {number} frequency  누적 빈도
 */

/**
 * Trie 내부 노드 — children Map + 단어 종료 플래그 + 빈도.
 * @private
 */
class TrieNode {
  constructor() {
    /** @type {Map<string, TrieNode>} */
    this.children = new Map();
    /** @type {boolean} */
    this.isEnd = false;
    /** @type {number} */
    this.frequency = 0;
  }
}

/**
 * 한글 자동완성용 Trie.
 *
 * @example
 *   const trie = new Trie();
 *   trie.insert('안녕하세요', 3);
 *   trie.searchPrefix('안녕'); // [{ word: '안녕하세요', frequency: 3 }]
 */
export class Trie {
  constructor() {
    /** @type {TrieNode} */
    this.root = new TrieNode();
    /** @type {number} */
    this._size = 0;
  }

  /**
   * 등록된 단어 개수.
   * @returns {number}
   */
  get size() {
    return this._size;
  }

  /**
   * 단어 삽입(이미 있으면 빈도만 누적).
   *
   * @param {string} word
   * @param {number} [frequency=1]
   * @returns {boolean} 신규 단어면 true, 기존 단어 빈도 누적이면 false
   */
  insert(word, frequency = 1) {
    if (typeof word !== 'string' || word.length === 0) return false;
    const freq = Number.isFinite(frequency) && frequency > 0 ? Math.floor(frequency) : 1;

    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    const wasNew = !node.isEnd;
    node.isEnd = true;
    node.frequency += freq;
    if (wasNew) this._size += 1;
    return wasNew;
  }

  /**
   * 단어가 등록되었는지 검사 (정확 매칭).
   * @param {string} word
   * @returns {boolean}
   */
  contains(word) {
    const node = this._traverse(word);
    return !!(node && node.isEnd);
  }

  /**
   * 단어의 현재 빈도.
   * @param {string} word
   * @returns {number} 등록되지 않았으면 0
   */
  getFrequency(word) {
    const node = this._traverse(word);
    return node && node.isEnd ? node.frequency : 0;
  }

  /**
   * 기존 단어 빈도 +1 (단어가 없으면 신규 삽입).
   * @param {string} word
   * @returns {number} 갱신된 빈도
   */
  incrementFrequency(word) {
    if (typeof word !== 'string' || word.length === 0) return 0;
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    if (!node.isEnd) {
      node.isEnd = true;
      this._size += 1;
    }
    node.frequency += 1;
    return node.frequency;
  }

  /**
   * prefix 로 시작하는 단어들을 빈도순으로 반환.
   *
   * @param {string} prefix
   * @param {number} [limit=10]
   * @returns {Array<TrieMatch>}
   */
  searchPrefix(prefix, limit = 10) {
    if (typeof prefix !== 'string' || prefix.length === 0) return [];
    const node = this._traverse(prefix);
    if (!node) return [];

    /** @type {Array<TrieMatch>} */
    const out = [];
    this._collect(node, prefix, out);

    // 빈도 내림차순, 동률은 사전순(오름차순)
    out.sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.word < b.word ? -1 : a.word > b.word ? 1 : 0;
    });

    const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : out.length;
    return out.slice(0, cap);
  }

  /**
   * 단어 제거 (존재하지 않으면 false).
   * 노드 정리(가지치기)는 단순화 — children 이 있으면 isEnd만 해제.
   *
   * @param {string} word
   * @returns {boolean}
   */
  remove(word) {
    const node = this._traverse(word);
    if (!node || !node.isEnd) return false;
    node.isEnd = false;
    node.frequency = 0;
    this._size = Math.max(0, this._size - 1);
    return true;
  }

  /**
   * 전체 초기화.
   */
  clear() {
    this.root = new TrieNode();
    this._size = 0;
  }

  /**
   * Trie 전체를 JSON-직렬화 가능한 객체로 변환.
   * 저장 시 `JSON.stringify(trie.serialize())` 형태로 사용.
   *
   * @returns {{ version:number, words: Array<[string, number]> }}
   */
  serialize() {
    /** @type {Array<[string, number]>} */
    const words = [];
    this._dumpWords(this.root, '', words);
    return { version: 1, words };
  }

  /**
   * 직렬화된 객체에서 Trie 복원 (덮어쓰기).
   *
   * @param {{ version?:number, words?: Array<[string, number]> } | null} data
   * @returns {Trie} this
   */
  deserialize(data) {
    this.clear();
    if (!data || !Array.isArray(data.words)) {
      logger.debug('[Trie] deserialize: empty/invalid payload');
      return this;
    }
    for (const entry of data.words) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const [w, f] = entry;
      if (typeof w !== 'string' || w.length === 0) continue;
      const freq = Number.isFinite(f) && f > 0 ? Math.floor(f) : 1;
      this.insert(w, freq);
    }
    return this;
  }

  /**
   * 디버그용 — 모든 단어 enumerate.
   * @returns {Array<TrieMatch>}
   */
  toArray() {
    /** @type {Array<TrieMatch>} */
    const out = [];
    this._collect(this.root, '', out);
    return out;
  }

  /**
   * prefix 노드까지 이동 (없으면 null).
   * @param {string} word
   * @returns {TrieNode|null}
   * @private
   */
  _traverse(word) {
    if (typeof word !== 'string' || word.length === 0) return null;
    let node = this.root;
    for (const ch of word) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  /**
   * 서브트리 DFS — 단어 종료 노드 수집.
   * @param {TrieNode} node
   * @param {string} prefix
   * @param {Array<TrieMatch>} out
   * @private
   */
  _collect(node, prefix, out) {
    if (node.isEnd) {
      out.push({ word: prefix, frequency: node.frequency });
    }
    for (const [ch, child] of node.children) {
      this._collect(child, prefix + ch, out);
    }
  }

  /**
   * 직렬화용 단어 덤프 (배열 형태).
   * @param {TrieNode} node
   * @param {string} prefix
   * @param {Array<[string, number]>} out
   * @private
   */
  _dumpWords(node, prefix, out) {
    if (node.isEnd) out.push([prefix, node.frequency]);
    for (const [ch, child] of node.children) {
      this._dumpWords(child, prefix + ch, out);
    }
  }
}

/**
 * 새 Trie 인스턴스 생성 helper.
 * @returns {Trie}
 */
export function createTrie() {
  return new Trie();
}

export default Trie;
