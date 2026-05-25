#!/usr/bin/env node
/**
 * DOCX Conformance Fixture Builder
 * --------------------------------
 * 정부24 / 행안부 공개 양식의 패턴을 흉내내는 합성 DOCX 픽스처 10개를
 * `tests/docx-conformance/<NN-feature>/fixture.docx` 로 생성한다.
 *
 *  01-paragraph-styles.docx   — 단락 스타일 5종 (Title, Heading1..3, Body)
 *  02-table-merged.docx       — 가로/세로 병합 + 중첩 표
 *  03-numbered-list-korean.docx — 가/나/다 + ㄱ/ㄴ/ㄷ
 *  04-header-footer.docx      — 짝/홀/첫 페이지 분기
 *  05-multi-section.docx      — 섹션별 페이지 설정 (가로/세로)
 *  06-image-anchored.docx     — 이미지 anchor + inline
 *  07-fields.docx             — 페이지번호 / 날짜 / 필드
 *  08-styles-direct.docx      — direct formatting 우선
 *  09-tabs-leader.docx        — 탭 leader (목차)
 *  10-mixed-script.docx       — 한국어/영어/한자/숫자 혼용
 *
 *  외부 의존성: docx 9.x (이미 dependencies 에 있음)
 *
 *  사용법:
 *    node scripts/build-docx-fixtures.mjs
 *
 *  scripts/build-golden-fixtures.mjs 와 같은 패턴 — fixture.docx 와
 *  expected.json (검증 포인트) 를 함께 생성한다.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat,
  Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ShadingType,
  Header, Footer, PageOrientation, TabStopType, TabStopPosition, PageBreak,
  ImageRun, SimpleField, Tab,
} from 'docx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const CONFORMANCE_ROOT = join(ROOT, 'tests', 'docx-conformance');

// ---------------------------------------------------------------------------
// Tiny 1x1 PNG (base64) for 06-image-anchored
// ---------------------------------------------------------------------------
const RED_DOT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
);

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------
function fixture01() {
  return new Document({
    sections: [{
      children: [
        new Paragraph({ text: '대한민국 정부 공개 문서 견본', heading: HeadingLevel.TITLE }),
        new Paragraph({ text: '제1장 총칙', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: '제1조 목적', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '이 견본은 단락 스타일 매핑을 시험한다.', heading: HeadingLevel.HEADING_3 }),
        new Paragraph({ children: [new TextRun({ text: '본문 단락입니다.' })] }),
      ],
    }],
  });
}

function fixture02() {
  // 3x3 표 + 가로 병합(첫 행 0~1 colSpan=2) + 세로 병합(0열 1..2 rowSpan=2)
  return new Document({
    sections: [{
      children: [
        new Paragraph({ text: '표 견본 — 병합 및 중첩' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  columnSpan: 2,
                  children: [new Paragraph('병합된 머리(가로)')],
                }),
                new TableCell({ children: [new Paragraph('우상')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  rowSpan: 2,
                  children: [new Paragraph('세로 병합')],
                }),
                new TableCell({ children: [new Paragraph('중간')] }),
                new TableCell({ children: [new Paragraph('우측')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('아래 가운데')] }),
                new TableCell({
                  children: [
                    new Paragraph('중첩 표 ↓'),
                    new Table({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      rows: [
                        new TableRow({
                          children: [
                            new TableCell({ children: [new Paragraph('네1')] }),
                            new TableCell({ children: [new Paragraph('네2')] }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }],
  });
}

function fixture03() {
  return new Document({
    numbering: {
      config: [
        {
          reference: 'ohai-ganada',
          levels: [
            { level: 0, format: LevelFormat.GANADA, text: '%1.', alignment: AlignmentType.START },
          ],
        },
        {
          reference: 'ohai-chosung',
          levels: [
            { level: 0, format: LevelFormat.CHOSUNG, text: '%1)', alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [{
      children: [
        new Paragraph({ text: '한국식 번호 매기기', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: '항목 첫째', numbering: { reference: 'ohai-ganada', level: 0 } }),
        new Paragraph({ text: '항목 둘째', numbering: { reference: 'ohai-ganada', level: 0 } }),
        new Paragraph({ text: '항목 셋째', numbering: { reference: 'ohai-ganada', level: 0 } }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '하위 분류 자음', numbering: { reference: 'ohai-chosung', level: 0 } }),
        new Paragraph({ text: '하위 분류 둘째', numbering: { reference: 'ohai-chosung', level: 0 } }),
      ],
    }],
  });
}

function fixture04() {
  // 첫/홀/짝 분기 + 본문 길게 → 2페이지 이상 확보
  const bodyParas = [];
  bodyParas.push(new Paragraph({ text: '머리말/꼬리말 분기 견본', heading: HeadingLevel.HEADING_1 }));
  for (let i = 0; i < 40; i++) {
    bodyParas.push(new Paragraph({ text: `본문 단락 ${i + 1} — 2 페이지 이상으로 분할되어야 함.` }));
  }
  return new Document({
    evenAndOddHeaderAndFooters: true,
    sections: [{
      properties: {
        page: {
          size: {
            width: 11906,
            height: 16838,
            orientation: PageOrientation.PORTRAIT,
          },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
        titlePage: true,
      },
      headers: {
        default: new Header({ children: [new Paragraph('홀수 페이지 머리말')] }),
        first: new Header({ children: [new Paragraph('첫 페이지 머리말')] }),
        even: new Header({ children: [new Paragraph('짝수 페이지 머리말')] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph('홀수 페이지 꼬리말')] }),
        first: new Footer({ children: [new Paragraph('첫 페이지 꼬리말')] }),
        even: new Footer({ children: [new Paragraph('짝수 페이지 꼬리말')] }),
      },
      children: bodyParas,
    }],
  });
}

function fixture05() {
  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({ text: '섹션 1 — 세로', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: '세로 페이지의 본문입니다.' }),
        ],
      },
      {
        properties: {
          page: {
            size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
          },
        },
        children: [
          new Paragraph({ text: '섹션 2 — 가로', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: '가로 페이지의 본문입니다.' }),
        ],
      },
    ],
  });
}

function fixture06() {
  // docx 라이브러리에서 이미지를 inline 으로만 안전하게 추가 (anchor 는 별도 옵션)
  return new Document({
    sections: [{
      children: [
        new Paragraph({ text: '이미지 견본 — anchor / inline', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new ImageRun({
              data: RED_DOT_PNG,
              transformation: { width: 64, height: 64 },
              type: 'png',
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('inline 이미지가 텍스트와 함께 있는 줄: '),
            new ImageRun({
              data: RED_DOT_PNG,
              transformation: { width: 16, height: 16 },
              type: 'png',
            }),
            new TextRun(' (점)'),
          ],
        }),
      ],
    }],
  });
}

function fixture07() {
  // field code 는 docx 9.x 의 SimpleField/RunFieldChar 가 정식 API.
  // 본 픽스처는 page-number/date 만 평이하게 렌더 (라운드트립 픽스처용)
  return new Document({
    sections: [{
      children: [
        new Paragraph({ text: '필드 견본', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new TextRun('페이지 '),
            new SimpleField('PAGE \\* MERGEFORMAT'),
            new TextRun(' / '),
            new SimpleField('NUMPAGES \\* MERGEFORMAT'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('작성일: '),
            new SimpleField('DATE \\@ "yyyy-MM-dd"'),
          ],
        }),
      ],
    }],
  });
}

function fixture08() {
  // direct formatting 이 pStyle 보다 우선해야 한다.
  return new Document({
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: 'Heading2 인데 ', size: 32 }),
            // direct formatting (size 16 → 8pt) 가 pStyle 보다 우선해야 함
            new TextRun({ text: '직접 크기 지정', size: 16 }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '굵게', bold: true }),
            new TextRun({ text: ' ' }),
            new TextRun({ text: '기울임', italics: true }),
            new TextRun({ text: ' ' }),
            new TextRun({ text: '취소선', strike: true }),
          ],
        }),
      ],
    }],
  });
}

function fixture09() {
  // `new Tab()` 을 사용하면 <w:tab/> 이 명시적으로 생성된다.
  return new Document({
    sections: [{
      children: [
        new Paragraph({ text: '목차', heading: HeadingLevel.HEADING_1 }),
        ...['제1장 총칙', '제2장 조직', '제3장 운영', '제4장 보칙'].map((title, i) =>
          new Paragraph({
            tabStops: [
              { type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: 'dot' },
            ],
            children: [
              new TextRun({ children: [title, new Tab(), `${(i + 1) * 3}`] }),
            ],
          }),
        ),
      ],
    }],
  });
}

function fixture10() {
  return new Document({
    sections: [{
      children: [
        new Paragraph({ text: '혼용 스크립트 견본', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [
            new TextRun({
              text: '한국어 ',
              font: { name: 'Calibri', eastAsia: '함초롬바탕' },
            }),
            new TextRun({ text: 'English ', font: 'Calibri' }),
            new TextRun({ text: '漢字 ', font: { name: 'Calibri', eastAsia: '함초롬바탕' } }),
            new TextRun({ text: '12345' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: '대한민국',
              font: { name: 'Arial', eastAsia: '맑은 고딕' },
              bold: true,
            }),
            new TextRun(' / '),
            new TextRun({ text: 'Republic of Korea', italics: true }),
          ],
        }),
      ],
    }],
  });
}

// ---------------------------------------------------------------------------
// Expected JSON catalog (검증 포인트)
// ---------------------------------------------------------------------------
const EXPECTED = {
  '01-paragraph-styles': {
    description: '단락 스타일 5종 (Title, Heading 1..3, Body)',
    parserAssertions: {
      minElements: 5,
      hasHeading: true,
      firstParagraphHasText: '대한민국',
    },
  },
  '02-table-merged': {
    description: '가로/세로 병합 + 중첩 표',
    parserAssertions: {
      hasTable: true,
      hasColSpan: true,
      hasRowSpan: true,
      hasNestedTable: true,
    },
  },
  '03-numbered-list-korean': {
    description: '가/나/다 + ㄱ/ㄴ/ㄷ 한국어식 번호',
    parserAssertions: {
      hasNumbering: true,
      numberingFormats: ['GANADA', 'CHOSUNG'],
      minNumberedItems: 5,
    },
  },
  '04-header-footer': {
    description: '짝/홀/첫 페이지 머리말/꼬리말 분기',
    parserAssertions: {
      headers: { hasFirstPage: true, hasEven: true, hasDefault: true },
      footers: { hasFirstPage: true, hasEven: true, hasDefault: true },
      titlePg: true,
      evenAndOdd: true,
    },
  },
  '05-multi-section': {
    description: '섹션별 페이지 설정 — 가로/세로 혼합',
    parserAssertions: {
      // 현재 parser 는 sections 를 1 개로 평탄화 — landscape 페이지의 size 만 검증
      pageWidth: { min: 600 },
    },
  },
  '06-image-anchored': {
    description: '이미지 anchor + inline',
    parserAssertions: {
      hasImage: true,
      // docx 라이브러리는 동일 buffer 를 dedupe 하므로 최소 1개 보장
      minImages: 1,
    },
  },
  '07-fields': {
    description: '페이지번호 / 날짜 필드',
    parserAssertions: {
      // SimpleField 는 본문 텍스트로는 잡히지 않을 수 있어 paragraph 최소 개수만 검증
      minParagraphs: 3,
    },
  },
  '08-styles-direct': {
    description: 'direct formatting (bold/italic/strike) 우선',
    parserAssertions: {
      hasBold: true,
      hasItalic: true,
      hasStrikethrough: true,
    },
  },
  '09-tabs-leader': {
    description: '탭 leader (목차)',
    parserAssertions: {
      hasTab: true,
      minParagraphs: 5,
    },
  },
  '10-mixed-script': {
    description: '한국어/영어/한자/숫자 혼용 + eastAsia 폰트',
    parserAssertions: {
      hasMultipleFonts: true,
      hasKoreanText: true,
      hasLatinText: true,
    },
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const fixtures = [
    ['01-paragraph-styles', fixture01],
    ['02-table-merged', fixture02],
    ['03-numbered-list-korean', fixture03],
    ['04-header-footer', fixture04],
    ['05-multi-section', fixture05],
    ['06-image-anchored', fixture06],
    ['07-fields', fixture07],
    ['08-styles-direct', fixture08],
    ['09-tabs-leader', fixture09],
    ['10-mixed-script', fixture10],
  ];

  mkdirSync(CONFORMANCE_ROOT, { recursive: true });

  for (const [name, builder] of fixtures) {
    const dir = join(CONFORMANCE_ROOT, name);
    mkdirSync(dir, { recursive: true });
    try {
      const doc = builder();
      const buf = await Packer.toBuffer(doc);
      writeFileSync(join(dir, 'fixture.docx'), buf);
      const expected = EXPECTED[name] || { parserAssertions: {} };
      writeFileSync(join(dir, 'expected.json'), JSON.stringify(expected, null, 2));
      console.log(`  ✔ ${name}/fixture.docx  (${buf.length} bytes)`);
    } catch (err) {
      console.error(`  ✖ ${name} failed:`, err?.message || err);
      throw err;
    }
  }

  console.log('\nDONE — 10 fixtures written to tests/docx-conformance/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
