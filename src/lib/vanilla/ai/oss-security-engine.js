/**
 * OSS Security Engine
 * AEGIS SDK가 번들되지 않은 OSS 빌드용 경량 보안 엔진.
 *
 * 기능:
 *   1) 한국 특화 PII 마스킹 (주민번호/휴대폰/카드/계좌/이메일/IP/사업자등록번호)
 *   2) 프롬프트 인젝션 패턴 탐지 (OWASP LLM01 참고)
 *   3) 출력 PII 재마스킹 + 가벼운 위험 키워드 차단
 *
 * 주의: 본 엔진은 상업용 AEGIS SDK의 ML 기반 탐지를 대체하지 않습니다.
 * 정규식 기반 휴리스틱이며 false positive/negative가 존재할 수 있습니다.
 *
 * @module ai/oss-security-engine
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// PII 패턴 카탈로그 (한국 특화)
// ---------------------------------------------------------------------------
// 각 항목: { id, label, regex, replacement, validator? }
// validator가 있으면 매치된 문자열에 대해 추가 검증을 수행함 (false positive 감소).

const PII_PATTERNS = [
  {
    id: 'rrn',
    label: 'RRN',
    // 주민등록번호: YYMMDD-#######
    // 단어 경계 안에서만 매치 (의도치 않은 긴 숫자열 일부 매치 방지)
    regex: /\b(\d{6})-?([1-4]\d{6})\b/g,
    replacement: '[REDACTED-RRN]',
    validator: m => {
      // 7번째 자리가 성별/세기 코드(1-4)인지 + 월/일 대략 검증
      const yy = m[1];
      const mm = parseInt(yy.slice(2, 4), 10);
      const dd = parseInt(yy.slice(4, 6), 10);
      return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
    },
  },
  {
    id: 'phone',
    label: 'PHONE',
    // 한국 휴대폰: 010/011/016/017/018/019 + 3~4자리 + 4자리
    regex: /\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b/g,
    replacement: '[REDACTED-PHONE]',
  },
  {
    id: 'card',
    label: 'CARD',
    // 카드번호: 4-4-4-4 (구분자 -, 공백 허용)
    regex: /\b(\d{4})[-.\s]?(\d{4})[-.\s]?(\d{4})[-.\s]?(\d{4})\b/g,
    replacement: '[REDACTED-CARD]',
    validator: m => {
      // 16자리 모두 0이거나 동일 숫자면 제외
      const digits = m[1] + m[2] + m[3] + m[4];
      if (/^(\d)\1+$/.test(digits)) return false;
      return true;
    },
  },
  {
    id: 'bizreg',
    label: 'BIZREG',
    // 사업자등록번호: ###-##-#####  (ACCOUNT보다 먼저 매치되어야 함 — 더 구체적)
    regex: /\b(\d{3})-(\d{2})-(\d{5})\b/g,
    replacement: '[REDACTED-BIZREG]',
  },
  {
    id: 'account',
    label: 'ACCOUNT',
    // 한국 은행 계좌 일반 패턴 (단순화):
    //   - 정확히 3개 그룹 (X-Y-Z), 구분자 필수
    //   - 총 11~16자리
    //   - 동일 숫자만 반복되는 경우 제외 (더미 차단)
    //   - 4-4-4-4 형태(=카드 형태)는 제외하기 위해 마지막 그룹 길이를 5~10으로 제한
    regex: /\b(\d{3,6})-(\d{2,6})-(\d{5,10})\b/g,
    replacement: '[REDACTED-ACCOUNT]',
    validator: m => {
      const digits = m[1] + m[2] + m[3];
      if (/^(\d)\1+$/.test(digits)) return false;
      const total = digits.length;
      return total >= 11 && total <= 16;
    },
  },
  {
    id: 'email',
    label: 'EMAIL',
    // RFC 5322 단순화 버전
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED-EMAIL]',
  },
  {
    id: 'ip',
    label: 'IP',
    // IPv4 (각 옥텟 0~255 대략 검증 — 단순 \d{1,3}로는 false positive 많음)
    regex: /\b((?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g,
    replacement: '[REDACTED-IP]',
  },
];

// ---------------------------------------------------------------------------
// 프롬프트 인젝션 규칙 (OWASP LLM01)
// ---------------------------------------------------------------------------
// 각 규칙: { id, pattern (regex|string), weight (0~1) }
// 누적 점수 >= INJECTION_THRESHOLD 이면 차단.

const INJECTION_THRESHOLD = 0.7;

const INJECTION_RULES = [
  // --- 영문 직접 지시 무시 ---
  {
    id: 'ignore-prev-en',
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    weight: 0.9,
  },
  {
    id: 'disregard-en',
    pattern: /disregard\s+(all\s+)?(previous|prior|above|the)\s+(instructions?|prompts?)/i,
    weight: 0.9,
  },
  { id: 'forget-en', pattern: /forget\s+(everything|all|previous|prior)/i, weight: 0.7 },

  // --- 한국어 직접 지시 무시 ---
  {
    id: 'ignore-prev-ko',
    pattern: /(이전|위의|앞의|기존)\s*(지시|명령|규칙|프롬프트)\s*(을|를)?\s*(무시|잊어|버려)/i,
    weight: 0.9,
  },
  { id: 'roleplay-ko', pattern: /지금부터\s*(너는|당신은|네가)/i, weight: 0.6 },
  { id: 'pretend-ko', pattern: /(인\s*척|행세|연기)\s*(해|하라|하세요|하십시오)/i, weight: 0.5 },

  // --- 시스템 프롬프트 추출 시도 ---
  {
    id: 'sys-prompt',
    pattern: /(system\s*prompt|시스템\s*프롬프트|초기\s*지시|original\s+instructions?)/i,
    weight: 0.6,
  },
  {
    id: 'reveal',
    pattern:
      /(reveal|show|print|display|출력|보여|알려)\s*(your|the|당신의|너의|네)?\s*(system|instructions?|prompt|규칙|지시)/i,
    weight: 0.7,
  },

  // --- 잘 알려진 jailbreak 명칭 ---
  { id: 'jailbreak', pattern: /jail\s*break/i, weight: 0.8 },
  { id: 'dan-mode', pattern: /\b(DAN\s*mode|do\s+anything\s+now)\b/i, weight: 0.9 },
  { id: 'developer-mode', pattern: /developer\s+mode/i, weight: 0.6 },
  {
    id: 'roleplay-en',
    pattern: /\b(role[\s-]*play|act\s+as|pretend\s+to\s+be|you\s+are\s+now)\b/i,
    weight: 0.4,
  },

  // --- 마크다운/델리미터 인젝션 ---
  { id: 'md-system-fence', pattern: /```\s*(system|assistant|user|instruction)/i, weight: 0.7 },
  { id: 'inst-tag', pattern: /\[\s*\/?\s*INST\s*\]/i, weight: 0.7 },
  { id: 'im-start', pattern: /<\|\s*im_start\s*\|>|<\|\s*im_end\s*\|>/i, weight: 0.8 },
  { id: 'sys-tag', pattern: /<\s*\/?\s*(system|assistant)\s*>/i, weight: 0.5 },

  // --- 제약 우회 ---
  {
    id: 'no-restrictions',
    pattern:
      /(no\s+restrictions?|without\s+(any\s+)?(limit|restriction|filter)|제한\s*없이|필터\s*없이)/i,
    weight: 0.6,
  },
];

// ---------------------------------------------------------------------------
// 출력 위험 키워드 (매우 가벼움 — false positive 최소화)
// ---------------------------------------------------------------------------

const OUTPUT_RISK_PATTERNS = [
  { id: 'self-harm', pattern: /(자살\s*방법|자해\s*방법|how\s+to\s+commit\s+suicide)/i },
  { id: 'weapon-build', pattern: /(폭탄\s*제조|how\s+to\s+(build|make)\s+a?\s*bomb)/i },
  { id: 'hate-explicit', pattern: /(인종\s*학살|ethnic\s+cleansing)/i },
];

// ---------------------------------------------------------------------------
// PII 마스킹 / 가명화
// ---------------------------------------------------------------------------

/**
 * 텍스트에서 PII를 탐지하고 마스킹.
 * @param {string} text
 * @returns {{ masked: string, detections: Array<{type: string, count: number}>, changed: boolean }}
 */
export function maskPii(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { masked: text ?? '', detections: [], changed: false };
  }

  let working = text;
  const detections = [];

  for (const { id, label, regex, replacement, validator } of PII_PATTERNS) {
    let count = 0;
    // exec 루프로 validator 적용 (replace 콜백 + lastIndex 관리)
    const re = new RegExp(regex.source, regex.flags);
    working = working.replace(re, (...args) => {
      // args: [fullMatch, ...groups, offset, string]
      const groups = args.slice(0, args.length - 2);
      if (validator && !validator(groups)) {
        return args[0]; // 그대로 둠
      }
      count += 1;
      return replacement;
    });

    if (count > 0) {
      detections.push({ type: label, count });
    }
  }

  return {
    masked: working,
    detections,
    changed: working !== text,
  };
}

/**
 * 의사 가명화 (현재 구현은 마스킹과 동일하나, 세션 단위 추적을 위해 토큰 카운팅 포함).
 * AEGIS의 pseudonymize와 동일한 시그니처를 제공.
 * @param {string} text
 * @param {string} _sessionId - 향후 복원 기능을 위한 예약 (현 OSS 엔진은 무손실 복원 미지원)
 * @returns {{ pseudonymized: string, changed: boolean, detections: Array }}
 */
export function pseudonymize(text, _sessionId) {
  const r = maskPii(text);
  return {
    pseudonymized: r.masked,
    changed: r.changed,
    detections: r.detections,
  };
}

// ---------------------------------------------------------------------------
// 프롬프트 인젝션 탐지
// ---------------------------------------------------------------------------

/**
 * 입력 텍스트에서 프롬프트 인젝션 시도 점수 계산.
 * @param {string} text
 * @returns {{ allowed: boolean, score: number, matchedRules: string[], reason: string }}
 */
export function detectInjection(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { allowed: true, score: 0, matchedRules: [], reason: '' };
  }

  let score = 0;
  const matchedRules = [];

  for (const { id, pattern, weight } of INJECTION_RULES) {
    if (pattern.test(text)) {
      score += weight;
      matchedRules.push(id);
    }
  }

  // 점수 [0,1]로 클램프
  score = Math.min(1, score);

  const allowed = score < INJECTION_THRESHOLD;
  const reason = allowed ? '' : `프롬프트 인젝션 의심 패턴 감지: ${matchedRules.join(', ')}`;

  return { allowed, score, matchedRules, reason };
}

// ---------------------------------------------------------------------------
// 종합 입력 스캔 + 출력 필터
// ---------------------------------------------------------------------------

/**
 * 입력 보안 스캔 — 인젝션 점수 + PII 카테고리 메타데이터.
 * @param {string} text
 * @returns {{ allowed: boolean, score: number, reason: string, categories: string[] }}
 */
export function scanInput(text) {
  const inj = detectInjection(text);
  const pii = maskPii(text);

  const categories = [];
  if (inj.matchedRules.length) categories.push('prompt-injection');
  if (pii.detections.length) categories.push('pii');

  return {
    allowed: inj.allowed,
    score: inj.score,
    reason: inj.reason,
    categories,
  };
}

/**
 * 출력 필터링 — 모델 응답에서 PII 재마스킹 + 위험 키워드 차단.
 * @param {string} text
 * @returns {{ safe: boolean, filtered: string, detections: string[] }}
 */
export function filterOutput(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { safe: true, filtered: text ?? '', detections: [] };
  }

  // 1) PII 재마스킹
  const piiResult = maskPii(text);
  let filtered = piiResult.masked;
  const detections = piiResult.detections.map(d => `pii:${d.type}`);

  // 2) 위험 키워드 검사
  let unsafe = false;
  for (const { id, pattern } of OUTPUT_RISK_PATTERNS) {
    if (pattern.test(filtered)) {
      unsafe = true;
      detections.push(`risk:${id}`);
    }
  }

  return {
    safe: !unsafe,
    filtered,
    detections,
  };
}

// ---------------------------------------------------------------------------
// 클래스 래퍼 (AEGIS Aegis와 비슷한 모양 — security-gateway가 같은 호출부로 쓸 수 있게)
// ---------------------------------------------------------------------------

export class OssSecurityEngine {
  constructor() {
    this.name = 'oss-security-engine';
    this.version = '1.0.0';
  }

  scan(text) {
    const r = scanInput(text);
    return {
      blocked: !r.allowed,
      score: r.score,
      explanation: r.reason,
      categories: r.categories,
    };
  }

  scanOutput(text) {
    const r = filterOutput(text);
    return {
      safe: r.safe,
      filtered: r.filtered,
      detections: r.detections.map(d => ({ type: d })),
    };
  }
}

export class OssPiiProxy {
  constructor() {
    this.name = 'oss-pii-proxy';
    // 세션별 원본 추적 (현 OSS는 마스킹 후 복원 불가 — 자리표시자만 보관)
    this._sessions = new Map();
  }

  pseudonymize(text, _opts, sessionId) {
    const r = pseudonymize(text, sessionId);
    if (sessionId) {
      this._sessions.set(sessionId, { original: text, changed: r.changed });
    }
    return {
      proxiedText: r.pseudonymized,
      changed: r.changed,
      detections: r.detections,
    };
  }

  restore(text, sessionId) {
    // OSS 엔진은 마스킹 토큰을 원본으로 되돌릴 수 없음.
    // 세션이 있으면 원본을 반환 (대화 컨텍스트 재구성 용도).
    const session = this._sessions.get(sessionId);
    if (session) return session.original;
    return text;
  }
}

// 패턴 카탈로그 메타데이터 (테스트 + 외부 검사용)
export const ENGINE_METADATA = {
  piiPatternCount: PII_PATTERNS.length,
  injectionRuleCount: INJECTION_RULES.length,
  outputRiskPatternCount: OUTPUT_RISK_PATTERNS.length,
  injectionThreshold: INJECTION_THRESHOLD,
};
