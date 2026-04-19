/**
 * Invisible Watermark — Zero-Width 문자 기반 문서 스테가노그래피
 *
 * HWPX export 시 사용자ID/타임스탬프 등을 본문에 보이지 않게 삽입.
 * 육안 및 일반 텍스트 편집기에서는 보이지 않지만, extract() 로 완전 복구 가능.
 *
 * 인코딩:
 *   - ZWSP (U+200B) = bit 0
 *   - ZWNJ (U+200C) = bit 1
 *   - ZWJ  (U+200D) = 프레임 마커 (시작/끝)
 *
 * @module lib/security/watermark
 */

const BIT_0 = '\u200B';
const BIT_1 = '\u200C';
const MARKER = '\u200D';
const FRAME_START = MARKER + MARKER;
const FRAME_END = MARKER + BIT_0 + MARKER;

export interface WatermarkPayload {
  userId?: string;
  timestamp?: number;
  documentId?: string;
  custom?: Record<string, string | number>;
}

export interface WatermarkOptions {
  /** 본문 전체 중 워터마크 바이트당 삽입 간격 (기본 32자) */
  spreadInterval?: number;
  /** 페이로드 앞뒤 반복 횟수 — 일부 텍스트 유실에도 복구 가능 (기본 2) */
  redundancy?: number;
}

const DEFAULT_OPTS: Required<WatermarkOptions> = {
  spreadInterval: 32,
  redundancy: 2,
};

/** UTF-8 문자열 → 비트 스트림 */
function stringToBits(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  return bits;
}

/** 비트 스트림 → UTF-8 문자열 */
function bitsToString(bits: string): string {
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
}

/** 비트 문자열 → zero-width 문자열 */
function bitsToZW(bits: string): string {
  let out = '';
  for (const b of bits) out += b === '1' ? BIT_1 : BIT_0;
  return out;
}

/** zero-width 문자열 → 비트 문자열 */
function zwToBits(zw: string): string {
  let bits = '';
  for (const c of zw) {
    if (c === BIT_0) bits += '0';
    else if (c === BIT_1) bits += '1';
  }
  return bits;
}

/** 간단한 16-bit 체크섬 */
function checksum16(s: string): string {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i) * (i + 1)) & 0xffff;
  return sum.toString(2).padStart(16, '0');
}

/**
 * 페이로드를 zero-width 문자열로 인코딩
 */
export function encodePayload(payload: WatermarkPayload): string {
  const normalized: WatermarkPayload = {
    ...payload,
    timestamp: payload.timestamp ?? Date.now(),
  };
  const json = JSON.stringify(normalized);
  const dataBits = stringToBits(json);
  const checkBits = checksum16(json);
  const payloadBits = dataBits + checkBits;

  return FRAME_START + bitsToZW(payloadBits) + FRAME_END;
}

/**
 * 본문 텍스트에 워터마크를 분산 삽입.
 * 전체 프레임(START+data+END)을 redundancy 회 반복해서 본문에 고르게 분산.
 * 문자 유실이나 잘림이 있어도 하나의 프레임만 온전하면 복구 가능.
 */
export function embedWatermark(
  text: string,
  payload: WatermarkPayload,
  options: WatermarkOptions = {}
): string {
  const opts = { ...DEFAULT_OPTS, ...options };
  const encoded = encodePayload(payload);
  const stream = encoded.repeat(Math.max(1, opts.redundancy));

  if (text.length === 0) return stream;

  const interval = Math.max(1, Math.floor(text.length / Math.max(1, stream.length)));
  let out = '';
  let zwIdx = 0;

  for (let i = 0; i < text.length; i++) {
    out += text[i];
    if (zwIdx < stream.length && (i + 1) % interval === 0) {
      out += stream[zwIdx++];
    }
  }
  if (zwIdx < stream.length) out += stream.slice(zwIdx);

  return out;
}

/**
 * 워터마크 추출. 없으면 null.
 * 여러 프레임 중 체크섬을 통과하는 첫 번째 프레임을 반환 — 부분 훼손에 강함.
 */
export function extractWatermark(text: string): WatermarkPayload | null {
  const zwOnly = text.replace(/[^\u200B\u200C\u200D]/g, '');
  if (zwOnly.length === 0) return null;

  let cursor = 0;
  while (cursor < zwOnly.length) {
    const startIdx = zwOnly.indexOf(FRAME_START, cursor);
    if (startIdx < 0) return null;

    const endIdx = zwOnly.indexOf(FRAME_END, startIdx + FRAME_START.length);
    if (endIdx < 0) return null;

    const payloadZw = zwOnly.slice(startIdx + FRAME_START.length, endIdx);
    const bits = zwToBits(payloadZw);

    if (bits.length >= 24) {
      const dataBits = bits.slice(0, -16);
      const checkBits = bits.slice(-16);
      const json = bitsToString(dataBits);
      if (json && checksum16(json) === checkBits) {
        try {
          return JSON.parse(json) as WatermarkPayload;
        } catch {
          // fall through
        }
      }
    }
    cursor = endIdx + FRAME_END.length;
  }
  return null;
}

/**
 * 텍스트에 워터마크 존재 여부만 빠르게 확인
 * (임베딩 시 zero-width 문자가 일반 문자 사이에 분산되므로, zw만 추출해 검사)
 */
export function hasWatermark(text: string): boolean {
  const zwOnly = text.replace(/[^\u200B\u200C\u200D]/g, '');
  return zwOnly.includes(FRAME_START);
}

/**
 * 워터마크 제거 (zero-width 문자 모두 삭제)
 */
export function stripWatermark(text: string): string {
  return text.replace(/[\u200B\u200C\u200D]/g, '');
}

// ─── HWPX Document 통합 헬퍼 ─────────────────────────────────────────────

interface RunLike { text?: string }
interface ParagraphLike { type?: string; runs?: RunLike[] }
interface SectionLike { elements?: ParagraphLike[] }
interface DocumentLike { sections?: SectionLike[] }

/**
 * HWPX 문서에 in-place 로 워터마크를 적용.
 * 전략: 본문 전체 텍스트 길이에 비례해 여러 단락에 분산 삽입.
 * 원본 문자/서식은 보존, zero-width 문자만 추가됨.
 *
 * @returns 적용된 단락 수
 */
export function applyWatermarkToDocument(
  doc: DocumentLike,
  payload: WatermarkPayload,
  options?: WatermarkOptions
): number {
  let applied = 0;

  // 후보 단락 수집 (텍스트가 있는 paragraph)
  const candidates: ParagraphLike[] = [];
  for (const section of doc.sections ?? []) {
    for (const el of section.elements ?? []) {
      if (el.type === 'paragraph' && el.runs && el.runs.length > 0) {
        const hasText = el.runs.some(r => r.text && r.text.trim().length > 0);
        if (hasText) candidates.push(el);
      }
    }
  }
  if (candidates.length === 0) return 0;

  // 최소 2개, 최대 5개 단락에 분산
  const redundancy = options?.redundancy ?? Math.min(5, Math.max(2, Math.ceil(candidates.length / 10)));
  const step = Math.max(1, Math.floor(candidates.length / redundancy));

  for (let i = 0; i < candidates.length; i += step) {
    const para = candidates[i];
    const firstRunWithText = para.runs!.find(r => r.text && r.text.trim().length > 0);
    if (!firstRunWithText || !firstRunWithText.text) continue;
    firstRunWithText.text = embedWatermark(firstRunWithText.text, payload, { redundancy: 1 });
    applied++;
    if (applied >= redundancy) break;
  }

  return applied;
}

/**
 * HWPX 문서에서 워터마크 추출 — 본문 전체를 스캔
 */
export function extractWatermarkFromDocument(doc: DocumentLike): WatermarkPayload | null {
  let combined = '';
  for (const section of doc.sections ?? []) {
    for (const el of section.elements ?? []) {
      if (el.type === 'paragraph' && el.runs) {
        for (const run of el.runs) {
          if (run.text) combined += run.text;
        }
      }
    }
  }
  return extractWatermark(combined);
}
