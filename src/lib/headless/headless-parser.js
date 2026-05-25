/**
 * Headless HWPX Parser
 * -----------------------------------------------------------------------------
 * Node.js (서버) 환경에서 HWPX 문서를 파싱하기 위한 얇은 래퍼.
 *
 * 배경:
 *  - `SimpleHWPXParser`(`src/lib/vanilla/core/parser.js`)는 `DOMParser`/
 *    `querySelectorAll` 등 브라우저 DOM API에 의존한다.
 *  - 따라서 Node 환경에서는 그대로 import 만 해서는 동작하지 않는다.
 *  - 본 모듈은 Node 런타임에서 `jsdom` 을 동적으로 import 해 글로벌
 *    `DOMParser` 를 폴리필한 뒤 기존 파서를 그대로 재사용한다.
 *
 * 설계 원칙:
 *  - 다른 트랙(파서/렌더러/맞춤법 등) 코드는 절대 수정하지 않는다.
 *  - 새 의존성 추가 없음. `jsdom` 은 이미 devDependency 로 존재.
 *  - 브라우저 환경에서 이 파일이 import 되더라도 안전하게 동작한다
 *    (그 경우 글로벌 `DOMParser` 가 이미 존재하므로 폴리필을 건너뜀).
 *  - 입력 타입을 폭넓게 허용: `Buffer | Uint8Array | ArrayBuffer`.
 *
 * @module lib/headless/headless-parser
 */

import { SimpleHWPXParser } from '../vanilla/core/parser.js';

/** 글로벌 폴리필이 이미 완료되었는지 플래그 (중복 작업 방지). */
let _domPolyfillReady = false;

/**
 * Node 환경 감지.
 * @returns {boolean}
 */
function isNodeEnvironment() {
  return (
    typeof process !== 'undefined' &&
    !!process.versions &&
    !!process.versions.node &&
    typeof window === 'undefined'
  );
}

/**
 * 입력 버퍼를 SimpleHWPXParser/JSZip 이 안전하게 받아들이는 타입으로 정규화한다.
 *
 * JSZip 의 `loadAsync` 는 Buffer | Uint8Array | ArrayBuffer | Blob | string 을
 * 모두 지원하므로, 변환 없이 통과시키되 잘못된 타입은 명확히 거부한다.
 *
 * (※ Buffer 의 underlying ArrayBuffer 를 slice 해서 넘기면 일부 환경에서
 *    `Can't read the data` 에러가 발생하므로 원본 그대로 전달한다.)
 *
 * @param {Buffer|Uint8Array|ArrayBuffer} input
 * @returns {Buffer|Uint8Array|ArrayBuffer}
 */
function normalizeInput(input) {
  // ArrayBuffer 는 jsdom/Node 의 realm 충돌(`instanceof ArrayBuffer` 가 false 가 됨)
  // 에서 JSZip 이 "Can't read the data" 로 거부할 수 있다. 항상 Uint8Array 로
  // 래핑하면 모든 realm 에서 안전하다.
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return input;
  if (
    input &&
    typeof input === 'object' &&
    typeof input.byteLength === 'number' &&
    typeof input.slice === 'function'
  ) {
    // Cross-realm ArrayBuffer-like — Uint8Array 로 변환 시도
    try {
      return new Uint8Array(input);
    } catch {
      return input;
    }
  }
  throw new TypeError(
    'parseHwpxHeadless: input must be Buffer, Uint8Array, or ArrayBuffer (got ' +
      Object.prototype.toString.call(input) +
      ')'
  );
}

/**
 * Node 에서 DOMParser/XMLSerializer 폴리필을 설치한다.
 * - jsdom 을 동적 import (top-level CJS 의 비용 회피)
 * - 글로벌에 이미 존재하면 노옵
 *
 * 한 번 설치되면 캐시된다.
 */
export async function ensureDomPolyfill() {
  if (_domPolyfillReady) return;
  if (typeof globalThis.DOMParser !== 'undefined') {
    _domPolyfillReady = true;
    return;
  }
  if (!isNodeEnvironment()) {
    // 브라우저에서 DOMParser 가 없을 수는 없지만, 만약을 위해 명확한 에러.
    throw new Error(
      'headless-parser: DOMParser 가 없는 비-Node 환경입니다. 지원되지 않는 런타임입니다.'
    );
  }

  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const win = dom.window;

  // 필수 폴리필: DOMParser
  globalThis.DOMParser = win.DOMParser;

  // 보조 폴리필: XMLSerializer (수식 mathml 등 일부 분기에서 사용)
  if (typeof globalThis.XMLSerializer === 'undefined') {
    globalThis.XMLSerializer = win.XMLSerializer;
  }

  // 일부 분기는 Document / Element 등의 typeof 확인을 한다 — 함께 노출.
  if (typeof globalThis.Document === 'undefined') {
    globalThis.Document = win.Document;
  }
  if (typeof globalThis.Element === 'undefined') {
    globalThis.Element = win.Element;
  }
  if (typeof globalThis.Node === 'undefined') {
    globalThis.Node = win.Node;
  }

  _domPolyfillReady = true;
}

/**
 * HWPX 문서를 헤드리스(=DOM 폴리필) 환경에서 파싱한다.
 *
 * @param {Buffer|Uint8Array|ArrayBuffer} buffer HWPX 파일 바이트
 * @param {object} [options]
 * @param {boolean} [options.parseImages=true]
 * @param {boolean} [options.parseTables=true]
 * @param {boolean} [options.parseStyles=true]
 * @param {string}  [options.password]          암호화된 HWPX 비밀번호
 * @param {string}  [options.fileName]          에러 메시지용 파일명
 * @returns {Promise<object>} SimpleHWPXParser 의 document 구조 그대로 반환
 */
export async function parseHwpxHeadless(buffer, options = {}) {
  await ensureDomPolyfill();
  const data = normalizeInput(buffer);
  const parser = new SimpleHWPXParser({
    parseImages: options.parseImages !== false,
    parseTables: options.parseTables !== false,
    parseStyles: options.parseStyles !== false,
    password: options.password,
    fileName: options.fileName,
  });
  const doc = await parser.parse(data);
  return doc;
}

/**
 * 문서의 핵심 메타데이터만 빠르게 추출 (`hwpx-cli info` 용).
 *
 * @param {object} doc parseHwpxHeadless 의 반환값
 * @returns {{
 *   sections: number,
 *   paragraphs: number,
 *   tables: number,
 *   images: number,
 *   oleObjects: number,
 *   macrosDetected: boolean,
 *   macroCount: number,
 *   parsedAt: string,
 *   parserVersion: string,
 * }}
 */
export function summarizeDocument(doc) {
  let paragraphs = 0;
  let tables = 0;
  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  for (const sec of sections) {
    const elements = Array.isArray(sec?.elements) ? sec.elements : [];
    for (const el of elements) {
      if (!el || typeof el !== 'object') continue;
      if (el.type === 'paragraph') paragraphs += 1;
      else if (el.type === 'table') tables += 1;
    }
  }
  return {
    sections: sections.length,
    paragraphs,
    tables,
    images: doc?.images instanceof Map ? doc.images.size : doc?.metadata?.imagesCount || 0,
    oleObjects:
      doc?.oleObjects instanceof Map ? doc.oleObjects.size : doc?.metadata?.oleObjectsCount || 0,
    macrosDetected: !!doc?.metadata?.macrosDetected,
    macroCount: doc?.metadata?.macroCount || 0,
    parsedAt: doc?.metadata?.parsedAt || '',
    parserVersion: doc?.metadata?.parserVersion || '',
  };
}

export default parseHwpxHeadless;
