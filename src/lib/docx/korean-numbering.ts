/**
 * Korean Numbering Format Mapping
 * -------------------------------
 * HWPX 의 한국어식 번호 (가/나/다, ㄱ/ㄴ/ㄷ, 一/二/三 등) 와 DOCX 의
 * w:numFmt 값 (Office Open XML — `koreanCounting`, `ganada`, `chosung` …)
 * 사이의 양방향 매핑을 한 곳에 모아 둔다.
 *
 * - HWPX 측 코드(`KOREAN_DIGITAL` 같은 enum-like string)는 SimpleHWPXParser
 *   / HwpxSafeExporter 가 사용하는 이름을 그대로 사용한다.
 * - DOCX 측 값은 docx 9.x 의 `LevelFormat` 상수 문자열이다 (e.g. "koreanCounting").
 *
 * Korean format catalogue:
 *   HWPX `KOREAN_DIGITAL`     ↔ DOCX `koreanDigital`      (1, 2, 3 — 한자 숫자)
 *   HWPX `KOREAN_COUNTING`    ↔ DOCX `koreanCounting`     (하나, 둘, 셋)
 *   HWPX `KOREAN_LEGAL`       ↔ DOCX `koreanLegal`        (壹, 貳, 參 등 법적 한자)
 *   HWPX `GANADA`             ↔ DOCX `ganada`             (가, 나, 다…)
 *   HWPX `CHOSUNG`            ↔ DOCX `chosung`            (ㄱ, ㄴ, ㄷ…)
 *   HWPX `HANGUL_SYLLABLE`    → DOCX `koreanCounting`     (한컴 호환 fallback)
 *   HWPX `IDEOGRAPH`          ↔ DOCX `ideographDigital`   (一, 二, 三…)
 *   HWPX `IROHA`(없음)        → DOCX `iroha`              (일본어 — fallback)
 *
 * Spec references:
 *   - HWPML §5.7.3 NumberingMethod / NumberingChar
 *   - ECMA-376 Part 1 §17.9.27 (numFmt)
 *
 * @module lib/docx/korean-numbering
 */

/** HWPX 측 한국어 번호 코드 (parser/exporter 가 사용하는 enum-like). */
export const HwpxNumFormat = {
  DECIMAL: 'DECIMAL',
  UPPER_ROMAN: 'UPPER_ROMAN',
  LOWER_ROMAN: 'LOWER_ROMAN',
  UPPER_LETTER: 'UPPER_LETTER',
  LOWER_LETTER: 'LOWER_LETTER',
  GANADA: 'GANADA',
  CHOSUNG: 'CHOSUNG',
  KOREAN_DIGITAL: 'KOREAN_DIGITAL',
  KOREAN_COUNTING: 'KOREAN_COUNTING',
  KOREAN_LEGAL: 'KOREAN_LEGAL',
  HANGUL_SYLLABLE: 'HANGUL_SYLLABLE',
  IDEOGRAPH: 'IDEOGRAPH',
  IROHA: 'IROHA',
  BULLET: 'BULLET',
  NONE: 'NONE',
} as const;

export type HwpxNumFormatCode = (typeof HwpxNumFormat)[keyof typeof HwpxNumFormat];

/** DOCX (Office Open XML) 측 numFmt 값. docx 9.x `LevelFormat` 과 1:1. */
export type DocxNumFormatCode =
  | 'decimal'
  | 'upperRoman'
  | 'lowerRoman'
  | 'upperLetter'
  | 'lowerLetter'
  | 'ganada'
  | 'chosung'
  | 'koreanCounting'
  | 'koreanDigital'
  | 'koreanLegal'
  | 'ideographDigital'
  | 'iroha'
  | 'bullet'
  | 'none';

/**
 * HWPX → DOCX
 * `HANGUL_SYLLABLE` / `IROHA` 처럼 1:1 대응이 없는 항목은 한컴 호환 fallback
 * 으로 매핑한다 (`koreanCounting`).
 */
const HWPX_TO_DOCX: Record<HwpxNumFormatCode, DocxNumFormatCode> = {
  DECIMAL: 'decimal',
  UPPER_ROMAN: 'upperRoman',
  LOWER_ROMAN: 'lowerRoman',
  UPPER_LETTER: 'upperLetter',
  LOWER_LETTER: 'lowerLetter',
  GANADA: 'ganada',
  CHOSUNG: 'chosung',
  KOREAN_DIGITAL: 'koreanDigital',
  KOREAN_COUNTING: 'koreanCounting',
  KOREAN_LEGAL: 'koreanLegal',
  HANGUL_SYLLABLE: 'koreanCounting', // 한컴 호환 fallback
  IDEOGRAPH: 'ideographDigital',
  IROHA: 'iroha', // 일본어 — 기록만 유지하고 한국어 fallback 은 호출자가 선택
  BULLET: 'bullet',
  NONE: 'none',
};

/**
 * DOCX → HWPX
 * `iroha`, `aiueo` 같은 일본어식은 의도적으로 한국어 fallback 으로 보낸다 —
 * 한컴 한글에서 일본어 번호를 직접 렌더링하지 않기 때문이다.
 */
const DOCX_TO_HWPX: Record<DocxNumFormatCode, HwpxNumFormatCode> = {
  decimal: 'DECIMAL',
  upperRoman: 'UPPER_ROMAN',
  lowerRoman: 'LOWER_ROMAN',
  upperLetter: 'UPPER_LETTER',
  lowerLetter: 'LOWER_LETTER',
  ganada: 'GANADA',
  chosung: 'CHOSUNG',
  koreanCounting: 'KOREAN_COUNTING',
  koreanDigital: 'KOREAN_DIGITAL',
  koreanLegal: 'KOREAN_LEGAL',
  ideographDigital: 'IDEOGRAPH',
  iroha: 'HANGUL_SYLLABLE', // 한국어 fallback
  bullet: 'BULLET',
  none: 'NONE',
};

/**
 * HWPX 번호 코드 → DOCX `w:numFmt` 값.
 * 알 수 없는 코드는 `decimal` 로 fallback 한다.
 */
export function hwpxToDocxNumFormat(code: string | null | undefined): DocxNumFormatCode {
  if (!code) return 'decimal';
  const upper = String(code).toUpperCase() as HwpxNumFormatCode;
  return HWPX_TO_DOCX[upper] ?? 'decimal';
}

/**
 * DOCX `w:numFmt` 값 → HWPX 번호 코드.
 * 알 수 없는 값은 `DECIMAL` 로 fallback.
 */
export function docxToHwpxNumFormat(code: string | null | undefined): HwpxNumFormatCode {
  if (!code) return 'DECIMAL';
  const key = String(code) as DocxNumFormatCode;
  return DOCX_TO_HWPX[key] ?? 'DECIMAL';
}

/**
 * 주어진 level / fmt 로 1부터 시작하는 N 번째 번호 문자열을 만든다.
 * 시각화/플레이스홀더용 — DOCX 가 실제 렌더링하는 글리프와 동일하지는 않다.
 *
 * - GANADA: 가, 나, 다, …, 하 (14 글자) → 14 이후엔 모듈러 + 반복
 * - CHOSUNG: ㄱ, ㄴ, ㄷ, …, ㅎ (14 자모)
 * - KOREAN_COUNTING: 하나, 둘, 셋, 넷, 다섯, … (수사)
 * - KOREAN_DIGITAL: 일, 이, 삼, 사, 오, … (한자 숫자 — 한국어 음)
 * - IDEOGRAPH: 一, 二, 三, …
 */
export function previewNumberGlyph(
  fmt: HwpxNumFormatCode | DocxNumFormatCode,
  index1Based: number,
): string {
  const n = Math.max(1, Math.floor(index1Based));
  const ganada = '가나다라마바사아자차카타파하'.split('');
  const chosung = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('');
  const koreanCount = ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
  const koreanDigit = '일이삼사오육칠팔구십'.split('');
  const ideograph = '一二三四五六七八九十'.split('');
  const idx = (n - 1) % 14;
  const idx10 = (n - 1) % 10;

  switch (String(fmt).toUpperCase()) {
    case 'GANADA':
    case 'GANADA'.toLowerCase().toUpperCase():
      return ganada[idx];
    case 'CHOSUNG':
      return chosung[idx];
    case 'KOREAN_COUNTING':
    case 'KOREANCOUNTING':
    case 'HANGUL_SYLLABLE':
      return koreanCount[idx10] ?? String(n);
    case 'KOREAN_DIGITAL':
    case 'KOREANDIGITAL':
    case 'KOREAN_LEGAL':
    case 'KOREANLEGAL':
      return koreanDigit[idx10] ?? String(n);
    case 'IDEOGRAPH':
    case 'IDEOGRAPHDIGITAL':
      return ideograph[idx10] ?? String(n);
    case 'UPPER_ROMAN':
    case 'UPPERROMAN':
      return toRoman(n).toUpperCase();
    case 'LOWER_ROMAN':
    case 'LOWERROMAN':
      return toRoman(n).toLowerCase();
    case 'UPPER_LETTER':
    case 'UPPERLETTER':
      return String.fromCharCode(64 + ((n - 1) % 26) + 1);
    case 'LOWER_LETTER':
    case 'LOWERLETTER':
      return String.fromCharCode(96 + ((n - 1) % 26) + 1);
    case 'BULLET':
      return '•';
    case 'NONE':
      return '';
    default:
      return String(n);
  }
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let s = '';
  let v = n;
  for (const [num, sym] of map) {
    while (v >= num) {
      s += sym;
      v -= num;
    }
  }
  return s;
}

/**
 * Korean font 정규화.
 * DOCX `<w:rFonts w:eastAsia="...">` 가 가리키는 폰트 이름을 정규화 한다.
 *
 * - 정의되지 않은 한국어 폰트는 `'sans-serif'` (system fallback) 로 매핑.
 * - 함초롬바탕/돋움 같은 표준 한컴 폰트는 그대로 유지.
 * - 본고딕 (Noto Sans CJK KR), 나눔/맑은 고딕 등도 정규형으로 보존.
 */
export function normalizeKoreanFont(rawName: string | null | undefined): string {
  if (!rawName) return 'sans-serif';
  const name = String(rawName).trim();
  if (!name) return 'sans-serif';
  // 시스템 또는 generic — 즉시 fallback
  const generic = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  if (generic.has(name.toLowerCase())) return name.toLowerCase();
  // 한컴 표준 한글 폰트 — 그대로 유지
  const koreanKnown = [
    '함초롬바탕', '함초롬돋움', '맑은 고딕', '바탕', '돋움', '굴림', '궁서',
    '나눔고딕', '나눔명조', '본고딕', '본명조', 'Noto Sans CJK KR',
    'Noto Serif CJK KR', 'Malgun Gothic', 'KoPubWorld 돋움체', 'KoPubWorld 바탕체',
  ];
  if (koreanKnown.some(k => k === name || name.startsWith(k))) {
    return name;
  }
  // 영어/라틴/숫자 only — 그대로 (서양식 폰트)
  if (/^[\x20-\x7E]+$/.test(name)) return name;
  // 그 외 식별 안 되는 한국어 폰트 → fallback
  return 'sans-serif';
}

const _internal = {
  HWPX_TO_DOCX,
  DOCX_TO_HWPX,
};
export default _internal;
