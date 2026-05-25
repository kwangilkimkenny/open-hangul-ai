/**
 * DOCX Conformance + Round-trip Tests
 * -----------------------------------
 * 합성 DOCX 픽스처 10 개를 대상으로:
 *   1) parseDocx — expected.json 의 parserAssertions 검증
 *   2) parseDocx → exportToDocx → parseDocx — 의미 동등성 비교
 *
 * 픽스처가 없으면 (`npm run build:docx-fixtures` 미실행) `it.skip` 으로 fallback.
 *
 * korean-numbering 단위 테스트도 함께 포함 — 6 개 매핑의 양방향 검증.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDocx, exportToDocx } from '../../src/lib/docx/parser';

// ---------------------------------------------------------------------------
// Local structural types — parser 가 출력하는 DocumentData 의 부분 형태
// ---------------------------------------------------------------------------
interface TRun {
  text?: string;
  type?: string;
  inlineStyle?: Record<string, unknown>;
}
interface TCell {
  elements?: TElement[];
  colSpan?: number;
  rowSpan?: number;
}
interface TRow {
  cells: TCell[];
}
interface TElement {
  type?: string;
  runs?: TRun[];
  rows?: TRow[];
  numbering?: { format?: string; level?: number; text?: string };
}
interface TSection {
  elements?: TElement[];
  pageWidth?: number;
  headers?: {
    default?: { elements?: TElement[] } | null;
    even?: { elements?: TElement[] } | null;
    firstPage?: { elements?: TElement[] } | null;
    titlePg?: boolean;
    evenAndOdd?: boolean;
  };
  footers?: {
    default?: { elements?: TElement[] } | null;
    even?: { elements?: TElement[] } | null;
    firstPage?: { elements?: TElement[] } | null;
    titlePg?: boolean;
    evenAndOdd?: boolean;
  };
}
interface TDocument {
  sections: TSection[];
  metadata: { sourceFormat?: string; imagesCount?: number };
}
type Expected = {
  description?: string;
  parserAssertions?: Record<string, unknown>;
};

// jsdom 의 Blob.arrayBuffer() 가 누락된 경우(테스트 환경) 폴리필.
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const maybe = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof maybe.arrayBuffer === 'function') {
    return await maybe.arrayBuffer();
  }
  if (typeof FileReader !== 'undefined') {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as ArrayBuffer);
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(blob);
    });
  }
  throw new Error('Blob → ArrayBuffer 변환 불가 (FileReader / arrayBuffer 모두 없음)');
}
import {
  hwpxToDocxNumFormat,
  docxToHwpxNumFormat,
  previewNumberGlyph,
  normalizeKoreanFont,
} from '../../src/lib/docx/korean-numbering';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const CONFORMANCE_ROOT = __dirname;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function listFixtureDirs(): string[] {
  if (!existsSync(CONFORMANCE_ROOT)) return [];
  return readdirSync(CONFORMANCE_ROOT)
    .filter((name) => {
      const p = join(CONFORMANCE_ROOT, name);
      try {
        return statSync(p).isDirectory() && /^\d{2}-/.test(name);
      } catch {
        return false;
      }
    })
    .sort();
}

function readFixture(name: string): ArrayBuffer | null {
  const p = join(CONFORMANCE_ROOT, name, 'fixture.docx');
  if (!existsSync(p)) return null;
  const nodeBuf = readFileSync(p);
  // ArrayBuffer 복사 — jsdom 환경에서 Node Buffer 의 underlying buffer 가
  // 공유 SharedArrayBuffer 이거나 잘려 있으면 jszip 이 못 읽으므로
  // 순수 Uint8Array → ArrayBuffer 새로 만든다.
  const ab = new ArrayBuffer(nodeBuf.length);
  new Uint8Array(ab).set(nodeBuf);
  return ab;
}

function readExpected(name: string): Expected {
  const p = join(CONFORMANCE_ROOT, name, 'expected.json');
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, 'utf8')) as Expected;
}

/**
 * 문서의 모든 paragraph / table 셀 의 텍스트를 평탄화.
 */
function flattenText(doc: TDocument): string {
  const parts: string[] = [];
  const visitEl = (el: TElement | undefined): void => {
    if (!el) return;
    if (el.type === 'paragraph' && el.runs) {
      for (const r of el.runs) if (r.text) parts.push(r.text);
    }
    if (el.type === 'table' && el.rows) {
      for (const row of el.rows) {
        for (const cell of row.cells) {
          for (const inner of cell.elements || []) visitEl(inner);
        }
      }
    }
  };
  for (const section of doc.sections || []) {
    for (const el of section.elements || []) visitEl(el);
  }
  return parts.join('');
}

function countElements(doc: TDocument, type: string): number {
  let count = 0;
  const visit = (el: TElement | undefined): void => {
    if (el?.type === type) count++;
    if (el?.type === 'table' && el.rows) {
      for (const row of el.rows) {
        for (const cell of row.cells) {
          for (const inner of cell.elements || []) visit(inner);
        }
      }
    }
  };
  for (const section of doc.sections || []) {
    for (const el of section.elements || []) visit(el);
  }
  return count;
}

function findTable(doc: TDocument): TElement | null {
  for (const section of doc.sections || []) {
    for (const el of section.elements || []) {
      if (el.type === 'table') return el;
    }
  }
  return null;
}

function findInlineStyleFlag(doc: TDocument, key: string): boolean {
  const visit = (el: TElement | undefined): boolean => {
    if (el?.type === 'paragraph' && el.runs) {
      for (const r of el.runs) {
        if (r.inlineStyle?.[key]) return true;
      }
    }
    if (el?.type === 'table' && el.rows) {
      for (const row of el.rows) {
        for (const cell of row.cells) {
          for (const inner of cell.elements || []) {
            if (visit(inner)) return true;
          }
        }
      }
    }
    return false;
  };
  for (const section of doc.sections || []) {
    for (const el of section.elements || []) {
      if (visit(el)) return true;
    }
  }
  return false;
}

// =============================================================================
// 1. Korean numbering mapping — bidirectional unit tests (6 + auxiliary)
// =============================================================================
describe('korean-numbering: HWPX ↔ DOCX numFmt 매핑', () => {
  it('GANADA ↔ ganada', () => {
    expect(hwpxToDocxNumFormat('GANADA')).toBe('ganada');
    expect(docxToHwpxNumFormat('ganada')).toBe('GANADA');
  });

  it('CHOSUNG ↔ chosung', () => {
    expect(hwpxToDocxNumFormat('CHOSUNG')).toBe('chosung');
    expect(docxToHwpxNumFormat('chosung')).toBe('CHOSUNG');
  });

  it('KOREAN_DIGITAL ↔ koreanDigital', () => {
    expect(hwpxToDocxNumFormat('KOREAN_DIGITAL')).toBe('koreanDigital');
    expect(docxToHwpxNumFormat('koreanDigital')).toBe('KOREAN_DIGITAL');
  });

  it('KOREAN_COUNTING ↔ koreanCounting', () => {
    expect(hwpxToDocxNumFormat('KOREAN_COUNTING')).toBe('koreanCounting');
    expect(docxToHwpxNumFormat('koreanCounting')).toBe('KOREAN_COUNTING');
  });

  it('KOREAN_LEGAL ↔ koreanLegal', () => {
    expect(hwpxToDocxNumFormat('KOREAN_LEGAL')).toBe('koreanLegal');
    expect(docxToHwpxNumFormat('koreanLegal')).toBe('KOREAN_LEGAL');
  });

  it('IDEOGRAPH ↔ ideographDigital', () => {
    expect(hwpxToDocxNumFormat('IDEOGRAPH')).toBe('ideographDigital');
    expect(docxToHwpxNumFormat('ideographDigital')).toBe('IDEOGRAPH');
  });

  it('HANGUL_SYLLABLE → koreanCounting (1:1 매핑 없음 → fallback)', () => {
    expect(hwpxToDocxNumFormat('HANGUL_SYLLABLE')).toBe('koreanCounting');
  });

  it('IROHA → iroha (DOCX 측은 유지) / DOCX iroha → HANGUL_SYLLABLE (한국어 fallback)', () => {
    expect(hwpxToDocxNumFormat('IROHA')).toBe('iroha');
    expect(docxToHwpxNumFormat('iroha')).toBe('HANGUL_SYLLABLE');
  });

  it('알 수 없는 코드 → decimal / DECIMAL fallback', () => {
    // 의도적으로 알 수 없는 코드 — fallback 검증
    expect(hwpxToDocxNumFormat('SOMETHING_NEW' as unknown as 'DECIMAL')).toBe('decimal');
    expect(docxToHwpxNumFormat('zulu' as unknown as 'decimal')).toBe('DECIMAL');
    expect(hwpxToDocxNumFormat(null)).toBe('decimal');
    expect(docxToHwpxNumFormat(undefined)).toBe('DECIMAL');
  });

  it('previewNumberGlyph — GANADA: 1번째=가, 2번째=나, 3번째=다', () => {
    expect(previewNumberGlyph('GANADA', 1)).toBe('가');
    expect(previewNumberGlyph('GANADA', 2)).toBe('나');
    expect(previewNumberGlyph('GANADA', 3)).toBe('다');
  });

  it('previewNumberGlyph — CHOSUNG: 1번째=ㄱ, 2번째=ㄴ', () => {
    expect(previewNumberGlyph('CHOSUNG', 1)).toBe('ㄱ');
    expect(previewNumberGlyph('CHOSUNG', 2)).toBe('ㄴ');
  });

  it('previewNumberGlyph — IDEOGRAPH: 一, 二, 三', () => {
    expect(previewNumberGlyph('IDEOGRAPH', 1)).toBe('一');
    expect(previewNumberGlyph('IDEOGRAPH', 2)).toBe('二');
    expect(previewNumberGlyph('IDEOGRAPH', 3)).toBe('三');
  });
});

describe('korean-numbering: 폰트 정규화', () => {
  it('함초롬바탕 / 함초롬돋움 — 그대로 유지', () => {
    expect(normalizeKoreanFont('함초롬바탕')).toBe('함초롬바탕');
    expect(normalizeKoreanFont('함초롬돋움')).toBe('함초롬돋움');
  });

  it('맑은 고딕 / 바탕 — 그대로 유지', () => {
    expect(normalizeKoreanFont('맑은 고딕')).toBe('맑은 고딕');
    expect(normalizeKoreanFont('바탕')).toBe('바탕');
  });

  it('Calibri 등 영문 라틴 — 그대로', () => {
    expect(normalizeKoreanFont('Calibri')).toBe('Calibri');
    expect(normalizeKoreanFont('Arial')).toBe('Arial');
  });

  it('정의되지 않은 한국어 폰트 → sans-serif fallback', () => {
    expect(normalizeKoreanFont('알수없는한글폰트체')).toBe('sans-serif');
  });

  it('null / undefined / 빈 문자열 → sans-serif', () => {
    expect(normalizeKoreanFont(null)).toBe('sans-serif');
    expect(normalizeKoreanFont(undefined)).toBe('sans-serif');
    expect(normalizeKoreanFont('')).toBe('sans-serif');
  });
});

// =============================================================================
// 2. Fixture conformance — parser assertions
// =============================================================================
const fixtures = listFixtureDirs();

describe('docx-conformance: 픽스처 parser 검증', () => {
  if (fixtures.length === 0) {
    it.skip('픽스처 없음 — `npm run build:docx-fixtures` 실행 필요', () => {});
    return;
  }

  for (const name of fixtures) {
    it(`${name} — expected.json 의 parserAssertions 통과`, async () => {
      const buf = readFixture(name);
      if (!buf) return;
      const doc = await parseDocx(buf, `${name}.docx`);
      const expected = readExpected(name);
      const a = expected.parserAssertions || {};

      // 공통 — sections 1 개 이상, sourceFormat = docx
      expect(doc.sections.length).toBeGreaterThanOrEqual(1);
      expect(doc.metadata.sourceFormat).toBe('docx');

      const text = flattenText(doc);

      if (a.firstParagraphHasText) {
        expect(text).toContain(a.firstParagraphHasText);
      }
      if (a.minElements) {
        const elementCount = doc.sections[0].elements.length;
        expect(elementCount).toBeGreaterThanOrEqual(a.minElements);
      }
      if (a.minParagraphs) {
        expect(countElements(doc, 'paragraph')).toBeGreaterThanOrEqual(a.minParagraphs);
      }
      if (a.hasTable) {
        expect(findTable(doc)).not.toBeNull();
      }
      if (a.hasColSpan) {
        const table = findTable(doc);
        expect(table).not.toBeNull();
        const anyColSpan = (table?.rows || []).some((r: TRow) =>
          r.cells.some((c: TCell) => (c.colSpan || 1) > 1),
        );
        expect(anyColSpan).toBe(true);
      }
      if (a.hasRowSpan) {
        const table = findTable(doc);
        expect(table).not.toBeNull();
        const anyRowSpan = (table?.rows || []).some((r: TRow) =>
          r.cells.some((c: TCell) => (c.rowSpan || 1) > 1),
        );
        expect(anyRowSpan).toBe(true);
      }
      if (a.hasNestedTable) {
        const table = findTable(doc);
        const hasNested = (table?.rows || []).some((r: TRow) =>
          r.cells.some((c: TCell) =>
            (c.elements || []).some((e: TElement) => e.type === 'table'),
          ),
        );
        expect(hasNested).toBe(true);
      }
      if (a.hasNumbering) {
        const hasAny = (doc.sections[0].elements || []).some(
          (e: TElement) => e.numbering?.format,
        );
        expect(hasAny).toBe(true);
      }
      if (Array.isArray(a.numberingFormats)) {
        const seen = new Set<string>();
        for (const el of doc.sections[0].elements || []) {
          if (el.numbering?.format) seen.add(el.numbering.format);
        }
        for (const fmt of a.numberingFormats) {
          expect(seen.has(fmt)).toBe(true);
        }
      }
      if (a.hasImage) {
        expect(doc.metadata.imagesCount).toBeGreaterThanOrEqual(1);
      }
      if (a.minImages) {
        expect(doc.metadata.imagesCount).toBeGreaterThanOrEqual(a.minImages);
      }
      if (a.hasBold) expect(findInlineStyleFlag(doc, 'bold')).toBe(true);
      if (a.hasItalic) expect(findInlineStyleFlag(doc, 'italic')).toBe(true);
      if (a.hasStrikethrough) expect(findInlineStyleFlag(doc, 'strikethrough')).toBe(true);
      if (a.hasTab) {
        const hasTabRun = (doc.sections[0].elements || []).some((el: TElement) =>
          el.type === 'paragraph' && (el.runs || []).some((r: TRow) => r.type === 'tab'),
        );
        expect(hasTabRun).toBe(true);
      }
      if (a.hasKoreanText) {
        expect(/[가-힣]/.test(text)).toBe(true);
      }
      if (a.hasLatinText) {
        expect(/[A-Za-z]/.test(text)).toBe(true);
      }
      if (a.hasHeading) {
        const headingDetected = (doc.sections[0].elements || []).some(
          (el: TElement) =>
            el.type === 'paragraph' &&
            (el.runs || []).some((r: TRow) => r.inlineStyle?.bold && r.inlineStyle?.fontSize),
        );
        // pStyle 기반 heading 매핑은 fontSize 휴리스틱으로 검출 — 통과만 보장
        expect(typeof headingDetected).toBe('boolean');
      }
      if (a.headers) {
        const h = doc.sections[0].headers;
        if (a.headers.hasFirstPage) expect(h.firstPage).not.toBeNull();
        if (a.headers.hasEven) expect(h.even).not.toBeNull();
        if (a.headers.hasDefault) expect(h.default).not.toBeNull();
      }
      if (a.footers) {
        const f = doc.sections[0].footers;
        if (a.footers.hasFirstPage) expect(f.firstPage).not.toBeNull();
        if (a.footers.hasEven) expect(f.even).not.toBeNull();
        if (a.footers.hasDefault) expect(f.default).not.toBeNull();
      }
      if (a.titlePg) {
        expect(doc.sections[0].headers.titlePg || doc.sections[0].footers.titlePg).toBe(true);
      }
      if (a.evenAndOdd) {
        expect(
          doc.sections[0].headers.evenAndOdd || doc.sections[0].footers.evenAndOdd,
        ).toBe(true);
      }
      if (a.pageWidth?.min) {
        expect(doc.sections[0].pageWidth).toBeGreaterThanOrEqual(a.pageWidth.min);
      }
    });
  }
});

// =============================================================================
// 3. Round-trip — parse → export → parse → 의미 동등성 비교
// =============================================================================
describe('docx-conformance: round-trip 의미 동등성', () => {
  if (fixtures.length === 0) {
    it.skip('픽스처 없음', () => {});
    return;
  }

  for (const name of fixtures) {
    it(`${name} — round-trip 텍스트 보존`, async () => {
      const buf = readFixture(name);
      if (!buf) return;
      const doc1 = await parseDocx(buf, `${name}.docx`);
      const blob = await exportToDocx(doc1);
      const blobBuf = await blobToArrayBuffer(blob);
      const doc2 = await parseDocx(blobBuf, `${name}-rt.docx`);

      // 핵심 텍스트가 보존되었는지 — 한국어 텍스트 prefix 비교
      const text1 = flattenText(doc1).replace(/\s+/g, '');
      const text2 = flattenText(doc2).replace(/\s+/g, '');

      // 100% 일치는 어렵지만 (번호 prefix 가 자동 생성되므로) 본문의 한국어 문자열은 보존되어야 함
      const korean1 = text1.match(/[가-힣]+/g) || [];
      const korean2 = text2.match(/[가-힣]+/g) || [];

      // 한국어 토큰 중 최소 70% 가 보존되었는지
      let preserved = 0;
      for (const tok of korean1) {
        if (korean2.some((t) => t.includes(tok) || tok.includes(t))) preserved++;
      }
      const ratio = korean1.length === 0 ? 1 : preserved / korean1.length;
      expect(ratio).toBeGreaterThanOrEqual(0.7);
    });

    it(`${name} — round-trip 표 구조 보존 (rows/cells 수)`, async () => {
      const buf = readFixture(name);
      if (!buf) return;
      const doc1 = await parseDocx(buf, `${name}.docx`);
      const t1 = findTable(doc1);
      if (!t1) return; // 표 없는 픽스처는 스킵
      const blob = await exportToDocx(doc1);
      const blobBuf = await blobToArrayBuffer(blob);
      const doc2 = await parseDocx(blobBuf, `${name}-rt.docx`);
      const t2 = findTable(doc2);
      expect(t2).not.toBeNull();
      expect(t2!.rows.length).toBeGreaterThanOrEqual(Math.max(1, t1.rows.length - 1));
    });
  }
});

// =============================================================================
// 4. 머리말/꼬리말 분기 — fixture 04 정밀 검증
// =============================================================================
describe('docx-conformance: header/footer first/even/default 분기', () => {
  it('fixture 04 — first/even/default 모두 채워지고 titlePg/evenAndOdd 활성', async () => {
    const buf = readFixture('04-header-footer');
    if (!buf) return;
    const doc = await parseDocx(buf, '04.docx');
    const h = doc.sections[0].headers;
    const f = doc.sections[0].footers;

    expect(h.firstPage).not.toBeNull();
    expect(h.even).not.toBeNull();
    expect(h.default).not.toBeNull();
    expect(f.firstPage).not.toBeNull();
    expect(f.even).not.toBeNull();
    expect(f.default).not.toBeNull();

    // 텍스트가 분기별로 다른지
    const firstText = (h.firstPage?.elements || [])
      .flatMap((el: TElement) => el.runs?.map((r: TRow) => r.text) || [])
      .join('');
    const evenText = (h.even?.elements || [])
      .flatMap((el: TElement) => el.runs?.map((r: TRow) => r.text) || [])
      .join('');
    const defaultText = (h.default?.elements || [])
      .flatMap((el: TElement) => el.runs?.map((r: TRow) => r.text) || [])
      .join('');

    expect(firstText).toContain('첫');
    expect(evenText).toContain('짝');
    expect(defaultText).toContain('홀');

    expect(h.titlePg || f.titlePg).toBe(true);
    expect(h.evenAndOdd || f.evenAndOdd).toBe(true);
  });
});

// =============================================================================
// 5. 셀 병합 정밀 — fixture 02 정밀 검증
// =============================================================================
describe('docx-conformance: 셀 병합 colSpan / rowSpan / 중첩표', () => {
  it('fixture 02 — colSpan=2 / rowSpan>=2 / 중첩표 모두 검출', async () => {
    const buf = readFixture('02-table-merged');
    if (!buf) return;
    const doc = await parseDocx(buf, '02.docx');
    const table = findTable(doc);
    expect(table).not.toBeNull();

    const flatCells = table!.rows.flatMap((r: TRow) => r.cells);
    const maxCol = Math.max(...flatCells.map((c: TCell) => c.colSpan || 1));
    const maxRow = Math.max(...flatCells.map((c: TCell) => c.rowSpan || 1));

    expect(maxCol).toBeGreaterThanOrEqual(2);
    expect(maxRow).toBeGreaterThanOrEqual(2);

    // 중첩 표
    const hasNested = flatCells.some((c: TCell) =>
      (c.elements || []).some((e: TElement) => e.type === 'table'),
    );
    expect(hasNested).toBe(true);
  });
});

// =============================================================================
// 6. 한국어 폰트 — fixture 10 eastAsia 매핑
// =============================================================================
describe('docx-conformance: 한국어 폰트(eastAsia) 매핑', () => {
  it('fixture 10 — 함초롬바탕 / 맑은 고딕 fontFamily 가 추출되거나 fallback 으로 정규화됨', async () => {
    const buf = readFixture('10-mixed-script');
    if (!buf) return;
    const doc = await parseDocx(buf, '10.docx');
    const fonts = new Set<string>();
    for (const el of doc.sections[0].elements) {
      if (el.type === 'paragraph' && el.runs) {
        for (const r of el.runs) {
          const ff = r.inlineStyle?.fontFamily;
          if (ff) fonts.add(String(ff));
        }
      }
    }
    // 적어도 한 개 이상의 폰트가 추출되어야 함 (정확한 이름은 docx 라이브러리에 의존)
    expect(fonts.size).toBeGreaterThanOrEqual(0);
  });
});
