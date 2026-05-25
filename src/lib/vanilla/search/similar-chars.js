/**
 * Similar Hangul Character Mapping
 *
 * 한국어 "비슷한 문자 무시" 기능을 위해 자모를 대표 문자로 정규화한다.
 * 한글 음절(가-힣)은 분해 후 자모(L/V/T)에 매핑을 적용해 재합성한다.
 *
 * 그룹:
 *  - 모음 그룹:
 *      ㅏㅐㅑㅒ → ㅏ
 *      ㅓㅔㅕㅖ → ㅓ
 *      ㅗㅘㅙㅚ → ㅗ
 *      ㅜㅝㅞㅟ → ㅜ
 *  - 자음 쌍(된소리/거센소리 → 평음):
 *      ㄱㄲ      → ㄱ
 *      ㄷㄸ      → ㄷ
 *      ㅂㅃ      → ㅂ
 *      ㅅㅆ      → ㅅ
 *      ㅈㅉ      → ㅈ
 *
 * 본 그룹은 휴리스틱이며 한컴 한글 정확한 규칙과는 다를 수 있다.
 *
 * @module search/similar-chars
 * @version 1.0.0
 */

// Hangul syllable block: U+AC00 ~ U+D7A3
const SBase = 0xac00;
const LBase = 0x1100;
const VBase = 0x1161;
const TBase = 0x11a7;
const LCount = 19;
const VCount = 21;
const TCount = 28;
const NCount = VCount * TCount; // 588
const SCount = LCount * NCount; // 11172

// 초성(L) 인덱스 0..18 — ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ
// 평음 그룹: ㄲ→ㄱ(0), ㄸ→ㄷ(3), ㅃ→ㅂ(7), ㅆ→ㅅ(9), ㅉ→ㅈ(12)
const LMap = {
  1: 0, // ㄲ → ㄱ
  4: 3, // ㄸ → ㄷ
  8: 7, // ㅃ → ㅂ
  10: 9, // ㅆ → ㅅ
  13: 12, // ㅉ → ㅈ
};

// 중성(V) 인덱스 0..20 — ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ
// ㅏㅐㅑㅒ → ㅏ (0)
// ㅓㅔㅕㅖ → ㅓ (4)
// ㅗㅘㅙㅚ → ㅗ (8)
// ㅜㅝㅞㅟ → ㅜ (13)
const VMap = {
  1: 0,
  2: 0,
  3: 0, // ㅐㅑㅒ → ㅏ
  5: 4,
  6: 4,
  7: 4, // ㅔㅕㅖ → ㅓ
  9: 8,
  10: 8,
  11: 8, // ㅘㅙㅚ → ㅗ
  14: 13,
  15: 13,
  16: 13, // ㅝㅞㅟ → ㅜ
};

// 호환 자모 (U+3131 ~ U+318E) 일부 매핑
// ㄲ(0x3132)→ㄱ(0x3131), ㄸ(0x3138)→ㄷ(0x3137),
// ㅃ(0x3143)→ㅂ(0x3142), ㅆ(0x3146)→ㅅ(0x3145), ㅉ(0x3149)→ㅈ(0x3148)
// 모음: ㅐ(0x3150)→ㅏ(0x314F), ㅑ(0x3151)→ㅏ, ㅒ(0x3152)→ㅏ
//       ㅔ(0x3154)→ㅓ(0x3153), ㅕ(0x3155)→ㅓ, ㅖ(0x3156)→ㅓ
//       ㅘ(0x3158)→ㅗ(0x3157), ㅙ(0x3159)→ㅗ, ㅚ(0x315A)→ㅗ
//       ㅝ(0x315D)→ㅜ(0x315C), ㅞ(0x315E)→ㅜ, ㅟ(0x315F)→ㅜ
const COMPAT_MAP = new Map([
  [0x3132, 0x3131],
  [0x3138, 0x3137],
  [0x3143, 0x3142],
  [0x3146, 0x3145],
  [0x3149, 0x3148],
  [0x3150, 0x314f],
  [0x3151, 0x314f],
  [0x3152, 0x314f],
  [0x3154, 0x3153],
  [0x3155, 0x3153],
  [0x3156, 0x3153],
  [0x3158, 0x3157],
  [0x3159, 0x3157],
  [0x315a, 0x3157],
  [0x315d, 0x315c],
  [0x315e, 0x315c],
  [0x315f, 0x315c],
]);

/**
 * 단일 한글 음절 정규화.
 * 합성된 음절이면 분해 → L/V 매핑 → 재합성. 종성(T)은 보존.
 *
 * @param {number} code  - 코드포인트 (음절: AC00-D7A3)
 * @returns {number}
 */
function normalizeSyllable(code) {
  const sIndex = code - SBase;
  if (sIndex < 0 || sIndex >= SCount) return code;
  const L = Math.floor(sIndex / NCount);
  const V = Math.floor((sIndex % NCount) / TCount);
  const T = sIndex % TCount;
  const newL = LMap[L] !== undefined ? LMap[L] : L;
  const newV = VMap[V] !== undefined ? VMap[V] : V;
  if (newL === L && newV === V) return code;
  return SBase + (newL * VCount + newV) * TCount + T;
}

/**
 * 텍스트를 비슷한 자모 그룹 대표 문자로 정규화한다.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeForFuzzy(text) {
  if (typeof text !== 'string' || text.length === 0) return text || '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (ch >= SBase && ch <= 0xd7a3) {
      result += String.fromCharCode(normalizeSyllable(ch));
    } else if (COMPAT_MAP.has(ch)) {
      result += String.fromCharCode(COMPAT_MAP.get(ch));
    } else {
      result += text[i];
    }
  }
  return result;
}

/**
 * 두 문자/문자열이 유사 그룹 내에서 일치하는지 검사.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isSimilar(a, b) {
  return normalizeForFuzzy(a) === normalizeForFuzzy(b);
}

export default { normalizeForFuzzy, isSimilar };
