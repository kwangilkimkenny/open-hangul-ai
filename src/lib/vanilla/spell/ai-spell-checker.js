/**
 * AI 기반 한국어 맞춤법 검사 (정규식 보강용)
 *
 * 트랙 V 의 정규식 룰(120개)이 잡지 못하는 문맥 의존 오류
 *   - 결제 vs 결재
 *   - 되 vs 돼 (받침/어미 결합 판단)
 *   - 데 vs 대 (전언/직접체험)
 *   - -이/-히 어미
 * 등을 LLM 으로 보강한다.
 *
 * 의존: `src/lib/ai/universal-llm-service.ts`
 *
 * 설계 원칙:
 *   - 옵트인: 명시적으로 호출자가 활성화해야 동작
 *   - 그레이스풀: provider 미설정/실패/타임아웃 시 빈 배열 반환 (예외 전파 X)
 *   - 보수적: temperature 0.1, 1000자 초과는 청크 분할(최대 chunkLimit) 또는 거부
 *   - 검증: LLM 응답의 (start, end) 가 텍스트 길이 안에 있고 original 이 실제 슬라이스와 일치해야 채택
 *
 * @module spell/ai-spell-checker
 * @version 1.0.0
 */

/**
 * @typedef {Object} AIIssue
 * @property {number} start
 * @property {number} end
 * @property {string} original
 * @property {string} suggestion
 * @property {string} reason
 * @property {'error'|'warning'} severity
 * @property {'spelling'|'spacing'|'foreign'|'particle'|'grammar'} [category]
 * @property {true} aiGenerated
 */

/**
 * @typedef {Object} AICheckOptions
 * @property {string} [provider='openai']      universal-llm-service Provider (openai|claude|vertex|...)
 * @property {string} [model]                  Provider 기본 모델 사용 시 미지정 가능
 * @property {string} [apiKey]                 명시 시 우선. 없으면 service 측 설정/env 사용
 * @property {number} [maxTokens=2000]
 * @property {number} [temperature=0.1]
 * @property {number} [timeoutMs=20000]
 * @property {number} [chunkLimit=1000]        텍스트 길이 임계값(자)
 * @property {boolean} [allowChunking=true]    초과 시 청크 분할 허용 여부 (false 면 거부 → 빈 배열)
 * @property {AbortSignal} [signal]            외부 취소 신호 (debounce 와 연동)
 * @property {(messages:any[], config:any, options?:any) => Promise<{content:string}>} [_serviceGenerate]
 *   테스트 주입 — universalLLM.generateText 대체. signature: (messages, config, options) => { content }
 */

const PROMPT_TEMPLATE = (text) => `다음 한국어 텍스트의 맞춤법·문법·띄어쓰기 오류를 JSON 배열로 반환하세요.
각 오류: { "start": number, "end": number, "original": string, "suggestion": string, "reason": string, "severity": "error"|"warning" }
포함 대상: 정규식으로 잡기 어려운 문맥 의존 오류 (예: 결제/결재 구분, 되/돼 구분, 데/대 구분, 이/히 구분).
- start/end 는 아래 텍스트 안에서의 0-based 인덱스 (end 는 exclusive).
- original 은 텍스트의 [start, end) 슬라이스와 정확히 일치해야 함.
- 오류가 없으면 빈 배열 [] 을 반환.
- 반환은 순수 JSON 배열만. 코드 펜스/설명/머리말/꼬리말 없이.
텍스트:
---
${text}
---`;

/**
 * 외부에서 universal-llm-service 가져오는 함수.
 * 실패하면 null 반환 (graceful fallback).
 */
async function _resolveService() {
  try {
    const mod = await import('../../ai/universal-llm-service.ts').catch(async () => {
      // 빌드 환경에 따라 ts 확장자 불가 → 절대 경로 추론
      return await import('../../ai/universal-llm-service.js');
    });
    return mod.universalLLM || mod.default || null;
  } catch (_e) {
    return null;
  }
}

/**
 * 응답 문자열에서 JSON 배열 추출.
 * 코드 펜스/머리말이 들어와도 첫 [ ... ] 블록만 시도한다.
 * @param {string} raw
 * @returns {any[]|null}
 */
export function parseAIResponse(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (s.length === 0) return null;

  // 코드 펜스 제거
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

  // 첫 번째 JSON 배열만 추출
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = s.slice(start, end + 1);

  try {
    const parsed = JSON.parse(slice);
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * 후보 객체를 검증 + 정규화. 실패 시 null.
 * @param {any} cand
 * @param {string} text
 * @returns {AIIssue|null}
 */
function _validateIssue(cand, text) {
  if (!cand || typeof cand !== 'object') return null;
  const start = Number(cand.start);
  const end = Number(cand.end);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end > text.length || start >= end) return null;

  const original = typeof cand.original === 'string' ? cand.original : '';
  const suggestion = typeof cand.suggestion === 'string' ? cand.suggestion : '';
  if (!original || !suggestion) return null;

  // original 이 슬라이스와 정확히 일치해야 채택
  if (text.slice(start, end) !== original) return null;

  // 동일 치환은 무의미 → 버림
  if (original === suggestion) return null;

  const severity = cand.severity === 'error' ? 'error'
    : cand.severity === 'warning' ? 'warning'
    : 'warning';

  const reason = typeof cand.reason === 'string' && cand.reason.length > 0
    ? cand.reason
    : 'AI 추천 수정';

  const category = ['spelling', 'spacing', 'foreign', 'particle', 'grammar'].includes(cand.category)
    ? cand.category
    : 'grammar';

  return {
    start, end, original, suggestion, reason, severity, category,
    aiGenerated: true,
  };
}

/**
 * 텍스트를 chunkLimit 단위로 분할. 가능한 한 줄바꿈/문장부호 경계에서 끊는다.
 * 반환은 { text, offset } 배열. offset 은 원문에서 chunk 시작 위치.
 * @param {string} text
 * @param {number} chunkLimit
 * @returns {Array<{text:string, offset:number}>}
 */
export function chunkText(text, chunkLimit) {
  if (typeof text !== 'string' || text.length === 0) return [];
  if (text.length <= chunkLimit) return [{ text, offset: 0 }];

  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const remaining = text.length - i;
    if (remaining <= chunkLimit) {
      chunks.push({ text: text.slice(i), offset: i });
      break;
    }
    let cut = i + chunkLimit;
    // 줄바꿈 우선, 그다음 한국어 종결부호/공백
    const boundary = Math.max(
      text.lastIndexOf('\n', cut - 1),
      text.lastIndexOf('. ', cut - 1),
      text.lastIndexOf('? ', cut - 1),
      text.lastIndexOf('! ', cut - 1),
      text.lastIndexOf('다. ', cut - 1),
    );
    if (boundary > i + Math.floor(chunkLimit / 2)) {
      cut = boundary + 1;
    }
    chunks.push({ text: text.slice(i, cut), offset: i });
    i = cut;
  }
  return chunks;
}

/**
 * LLM 으로 텍스트를 검사하여 AIIssue 배열 반환.
 * 실패/취소/한도 등 모든 비치명적 상황은 빈 배열 반환 (예외 전파 X).
 *
 * @param {string} text
 * @param {AICheckOptions} [options]
 * @returns {Promise<Array<AIIssue>>}
 */
export async function checkTextWithAI(text, options = {}) {
  if (typeof text !== 'string' || text.trim().length === 0) return [];

  const {
    provider = 'openai',
    model,
    apiKey,
    maxTokens = 2000,
    temperature = 0.1,
    timeoutMs = 20000,
    chunkLimit = 1000,
    allowChunking = true,
    signal,
    _serviceGenerate,
  } = options;

  // 1000자 초과: 청크 분할 or 거부
  if (text.length > chunkLimit && !allowChunking) {
    return [];
  }

  // service 결정
  let serviceGenerate = _serviceGenerate;
  if (!serviceGenerate) {
    const svc = await _resolveService();
    if (!svc || typeof svc.generateText !== 'function') {
      // 그레이스풀 fallback — 정규식 단독 모드
      return [];
    }
    serviceGenerate = svc.generateText.bind(svc);
  }

  const config = {
    provider,
    model: model || _defaultModelFor(provider),
    maxTokens,
    temperature,
  };
  if (apiKey) config.apiKey = apiKey;

  const chunks = chunkText(text, chunkLimit);
  /** @type {AIIssue[]} */
  const collected = [];

  for (const chunk of chunks) {
    if (signal && signal.aborted) return [];

    const messages = [
      { role: 'system', content: '당신은 한국어 맞춤법·문법 검사 보조 AI입니다. 사용자가 지시한 JSON 형식만 반환하세요.' },
      { role: 'user', content: PROMPT_TEMPLATE(chunk.text) },
    ];

    let raw;
    try {
      raw = await _withTimeout(
        serviceGenerate(messages, config, { temperature, maxTokens, signal }),
        timeoutMs,
        signal,
      );
    } catch (_e) {
      // 한 청크 실패해도 다음 청크는 시도
      continue;
    }

    const content = raw && typeof raw === 'object' ? raw.content : null;
    if (typeof content !== 'string' || content.length === 0) continue;

    const arr = parseAIResponse(content);
    if (!Array.isArray(arr)) continue;

    for (const cand of arr) {
      const v = _validateIssue(cand, chunk.text);
      if (!v) continue;
      // 원문 좌표로 변환
      collected.push({
        ...v,
        start: v.start + chunk.offset,
        end: v.end + chunk.offset,
      });
    }
  }

  // 위치순 정렬 + 동일 (start,end) 중복 제거
  collected.sort((a, b) => a.start - b.start || a.end - b.end);
  const dedup = [];
  const seen = new Set();
  for (const it of collected) {
    const k = `${it.start}:${it.end}:${it.suggestion}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(it);
  }
  return dedup;
}

function _defaultModelFor(provider) {
  switch (provider) {
    case 'openai': return 'gpt-4o-mini';
    case 'claude': return 'claude-3-haiku-20240307';
    case 'vertex': return 'gemini-2.5-flash';
    case 'grok': return 'grok-2-mini';
    case 'azure-openai': return 'gpt-4o-mini';
    case 'cohere': return 'command-r';
    case 'local': return 'qwen2.5:7b';
    default: return 'gpt-4o-mini';
  }
}

function _withTimeout(promise, ms, externalSignal) {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error(`AI 호출 타임아웃 (${ms}ms)`);
      /** @type {any} */ (err).code = 'AI_SPELL_TIMEOUT';
      reject(err);
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      const err = new Error('AI 호출이 취소되었습니다');
      err.name = 'AbortError';
      /** @type {any} */ (err).code = 'AI_SPELL_ABORTED';
      reject(err);
    };
    if (externalSignal) {
      if (externalSignal.aborted) { onAbort(); return; }
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }
    Promise.resolve(promise).then((v) => {
      clearTimeout(t);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
      resolve(v);
    }, (e) => {
      clearTimeout(t);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
      reject(e);
    });
  });
}

export default { checkTextWithAI, parseAIResponse, chunkText };
