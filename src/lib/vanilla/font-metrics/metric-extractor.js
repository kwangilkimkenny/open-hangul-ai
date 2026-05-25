/**
 * Font Metric Extractor
 *
 * opentype.js 를 사용해 TTF/OTF/WOFF/WOFF2 폰트 바이너리에서
 * 한컴 수준의 정확한 메트릭(em, ascent, descent, cap-height, x-height,
 * bounding box, kerning/ligature 지원 여부 등)을 추출한다.
 *
 * 입력은 `ArrayBuffer` 한 가지(폰트 파일 원본). 호출자는 fetch / FileReader
 * 등으로 미리 버퍼를 확보해서 전달한다.
 *
 * 추출된 값은 폰트의 `unitsPerEm` 좌표계 그대로 반환된다 — 1 em 으로
 * 정규화하려면 호출 측에서 `value / unitsPerEm` 으로 변환할 것.
 *
 * @module font-metrics/metric-extractor
 * @version 1.0.0
 */

/**
 * @typedef {Object} FontBBox
 * @property {number} xMin
 * @property {number} yMin
 * @property {number} xMax
 * @property {number} yMax
 */

/**
 * @typedef {Object} FontMetrics
 * @property {string} familyName            패밀리 이름(예: "Noto Sans KR")
 * @property {string} fullName              전체 이름(예: "Noto Sans KR Regular")
 * @property {string} postScriptName        PostScript 이름(예: "NotoSansKR-Regular")
 * @property {number} unitsPerEm            em 좌표계 단위(보통 1000 또는 1024)
 * @property {number} ascent                hhea/OS2 ascender (em 단위)
 * @property {number} descent               hhea/OS2 descender (음수, em 단위)
 * @property {number} lineGap               hhea/OS2 line gap (em 단위)
 * @property {number} capHeight             대문자 높이(없으면 ascent 의 0.7배 추정)
 * @property {number} xHeight               x-height(없으면 ascent 의 0.5배 추정)
 * @property {FontBBox} bbox                head 테이블의 글로벌 bounding box
 * @property {number} weight                OS/2 usWeightClass (100~900)
 * @property {string} style                 "normal" | "italic" | "oblique"
 * @property {number} glyphCount            글리프 개수
 * @property {boolean} hasKerning           kerning 정보 보유 여부
 * @property {boolean} hasLigatures         GSUB 'liga' 또는 'rlig' 보유 여부
 * @property {'opentype'|'catalog'|'canvas'} source   메트릭의 출처
 */

/**
 * 내부에서 opentype.js 모듈을 lazy import 한다 — 테스트에서 모킹하기 쉽도록.
 *
 * @returns {Promise<any>}
 */
async function loadOpenType() {
  const mod = await import('opentype.js');
  return mod && mod.default ? mod.default : mod;
}

/**
 * name 테이블에서 가장 적절한 이름을 골라 반환한다.
 *
 * opentype.js 의 `font.names.fontFamily` 등은 `{ en: 'Foo', ja: '...' }`
 * 형태의 객체이거나 단순 문자열일 수 있다. 우선순위는 한국어(ko) → 영어(en)
 * → 첫 번째 키.
 *
 * @param {any} nameRecord
 * @param {string} fallback
 * @returns {string}
 */
function pickName(nameRecord, fallback) {
  if (!nameRecord) return fallback;
  if (typeof nameRecord === 'string') return nameRecord;
  if (typeof nameRecord === 'object') {
    if (typeof nameRecord.ko === 'string' && nameRecord.ko) return nameRecord.ko;
    if (typeof nameRecord.en === 'string' && nameRecord.en) return nameRecord.en;
    const keys = Object.keys(nameRecord);
    if (keys.length > 0 && typeof nameRecord[keys[0]] === 'string') {
      return nameRecord[keys[0]];
    }
  }
  return fallback;
}

/**
 * GSUB 테이블을 훑어 liga/rlig feature 존재 여부 확인.
 *
 * @param {any} font
 * @returns {boolean}
 */
function detectLigatures(font) {
  try {
    const gsub = font && font.tables && font.tables.gsub;
    if (!gsub || !Array.isArray(gsub.features)) return false;
    return gsub.features.some((f) => {
      const tag = f && f.tag;
      return tag === 'liga' || tag === 'rlig' || tag === 'dlig';
    });
  } catch (_e) {
    return false;
  }
}

/**
 * kern 테이블 또는 GPOS 의 kern feature 존재 여부.
 *
 * @param {any} font
 * @returns {boolean}
 */
function detectKerning(font) {
  try {
    if (font && font.tables && font.tables.kern) return true;
    const gpos = font && font.tables && font.tables.gpos;
    if (gpos && Array.isArray(gpos.features)) {
      return gpos.features.some((f) => f && f.tag === 'kern');
    }
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * OS/2 fsSelection 비트로부터 italic 판별.
 *
 * @param {any} os2
 * @returns {'normal'|'italic'|'oblique'}
 */
function detectStyle(os2) {
  if (!os2) return 'normal';
  // fsSelection bit 0 = italic, bit 9 = oblique
  const fs = typeof os2.fsSelection === 'number' ? os2.fsSelection : 0;
  if (fs & 0x200) return 'oblique';
  if (fs & 0x1) return 'italic';
  return 'normal';
}

/**
 * ArrayBuffer 에서 폰트 메트릭을 추출한다.
 *
 * @param {ArrayBuffer} buffer  TTF/OTF/WOFF 원본 바이너리
 * @returns {Promise<FontMetrics>}
 * @throws 잘못된 폰트이거나 opentype.js 가 로드 불가하면 Error
 */
// 같은 폰트 buffer 가 여러 번 들어와도 opentype.parse 는 1회만.
// 키는 byteLength + 첫 32B 의 fnv-1a 해시 (같은 파일이면 같은 키).
const _parsedMetricsCache = new Map();
const PARSED_CACHE_LIMIT = 32;

function bufferKey(buffer) {
  const view = new Uint8Array(buffer, 0, Math.min(32, buffer.byteLength));
  let hash = 0x811c9dc5;
  for (let i = 0; i < view.length; i++) {
    hash ^= view[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return `${buffer.byteLength}:${hash >>> 0}`;
}

export async function extractFontMetrics(buffer) {
  if (!buffer || !(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
    throw new Error('extractFontMetrics: invalid buffer');
  }

  const key = bufferKey(buffer);
  const cached = _parsedMetricsCache.get(key);
  if (cached) return cached;

  const opentype = await loadOpenType();
  if (!opentype || typeof opentype.parse !== 'function') {
    throw new Error('extractFontMetrics: opentype.js unavailable');
  }

  const font = opentype.parse(buffer);
  if (!font) throw new Error('extractFontMetrics: parse failed');

  const unitsPerEm = typeof font.unitsPerEm === 'number' ? font.unitsPerEm : 1000;
  const os2 = (font.tables && font.tables.os2) || {};
  const hhea = (font.tables && font.tables.hhea) || {};
  const head = (font.tables && font.tables.head) || {};

  // ascent/descent 우선순위: OS/2 typo* → hhea
  const ascent =
    typeof os2.sTypoAscender === 'number' ? os2.sTypoAscender :
    typeof hhea.ascender === 'number' ? hhea.ascender :
    Math.round(unitsPerEm * 0.8);
  const descent =
    typeof os2.sTypoDescender === 'number' ? os2.sTypoDescender :
    typeof hhea.descender === 'number' ? hhea.descender :
    -Math.round(unitsPerEm * 0.2);
  const lineGap =
    typeof os2.sTypoLineGap === 'number' ? os2.sTypoLineGap :
    typeof hhea.lineGap === 'number' ? hhea.lineGap :
    0;

  const capHeight =
    typeof os2.sCapHeight === 'number' && os2.sCapHeight > 0
      ? os2.sCapHeight
      : Math.round(ascent * 0.7);
  const xHeight =
    typeof os2.sxHeight === 'number' && os2.sxHeight > 0
      ? os2.sxHeight
      : Math.round(ascent * 0.5);

  const bbox = {
    xMin: typeof head.xMin === 'number' ? head.xMin : 0,
    yMin: typeof head.yMin === 'number' ? head.yMin : descent,
    xMax: typeof head.xMax === 'number' ? head.xMax : unitsPerEm,
    yMax: typeof head.yMax === 'number' ? head.yMax : ascent,
  };

  const familyName = pickName(font.names && font.names.fontFamily, 'Unknown');
  const fullName = pickName(font.names && font.names.fullName, familyName);
  const postScriptName = pickName(
    font.names && font.names.postScriptName,
    familyName.replace(/\s+/g, '-'),
  );

  const weight =
    typeof os2.usWeightClass === 'number' && os2.usWeightClass > 0
      ? os2.usWeightClass
      : 400;
  const style = detectStyle(os2);

  let glyphCount = 0;
  if (font.glyphs && typeof font.glyphs.length === 'number') {
    glyphCount = font.glyphs.length;
  } else if (font.numGlyphs) {
    glyphCount = font.numGlyphs;
  }

  const metrics = {
    familyName,
    fullName,
    postScriptName,
    unitsPerEm,
    ascent,
    descent,
    lineGap,
    capHeight,
    xHeight,
    bbox,
    weight,
    style,
    glyphCount,
    hasKerning: detectKerning(font),
    hasLigatures: detectLigatures(font),
    source: 'opentype',
  };

  if (_parsedMetricsCache.size >= PARSED_CACHE_LIMIT) {
    const firstKey = _parsedMetricsCache.keys().next().value;
    _parsedMetricsCache.delete(firstKey);
  }
  _parsedMetricsCache.set(key, metrics);
  return metrics;
}

/**
 * 메트릭을 em 단위(0~1)로 정규화한다.
 * @param {FontMetrics} m
 * @returns {{ascent:number,descent:number,lineGap:number,capHeight:number,xHeight:number}}
 */
export function normalizeToEm(m) {
  const u = m.unitsPerEm || 1000;
  return {
    ascent: m.ascent / u,
    descent: m.descent / u,
    lineGap: m.lineGap / u,
    capHeight: m.capHeight / u,
    xHeight: m.xHeight / u,
  };
}

export default { extractFontMetrics, normalizeToEm };
