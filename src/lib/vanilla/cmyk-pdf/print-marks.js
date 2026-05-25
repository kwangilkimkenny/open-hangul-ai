/**
 * 인쇄/출판용 페이지 마크 (크롭마크, 레지스트레이션 마크, 컬러바, 페이지 정보)
 * -----------------------------------------------------------------------------
 * 본 모듈은 pdf-lib 의 PDFPage 를 인자로 받아 페이지 외곽(트림박스 바깥)에
 * 인쇄소에서 요구하는 4가지 표준 마크를 그린다.
 *
 *   1) 크롭마크 (Crop / Trim Marks) — 페이지 네 모서리에 10mm 검정 선
 *   2) 레지스트레이션 마크 — 네 변 중앙의 십자/원형 CMYK 정합 마크
 *   3) 컬러바 — 페이지 하단에 CMYK 패치 + 회색 단계 (현장 색재현 확인용)
 *   4) 페이지 정보 — 좌상단 외곽: 날짜, 파일명, 페이지번호
 *
 * 모든 단위는 mm → pt (PDF user space) 환산. 1mm = 2.83464567pt.
 *
 * pdf-lib 의 약속:
 *   - 좌표 원점은 페이지 좌하단.
 *   - 기본 색공간 변경은 `setStrokingColor` / `setFillingColor` 가 아닌
 *     draw* API 의 `color` 옵션으로 지정.
 *   - 단순 선은 `drawLine`, 사각형은 `drawRectangle`, 원은 `drawEllipse`.
 *
 * @module cmyk-pdf/print-marks
 */

import {
  cmyk,
  rgb,
  drawLine,
  drawRectangle,
  drawEllipse,
  degrees,
} from 'pdf-lib';

/**
 * pdf-lib draw* API 가 요구하는 회전/스큐 기본값.
 * (drawRectangle 등은 rotate/xSkew/ySkew 가 누락되면 toRadians 단계에서 에러)
 */
const ZERO_ROT = {
  rotate: degrees(0),
  xSkew: degrees(0),
  ySkew: degrees(0),
};

/**
 * 1mm 를 PDF 포인트로 환산.
 */
export const MM_TO_PT = 72 / 25.4; // ≈ 2.8346456693

/**
 * mm → pt 헬퍼.
 * @param {number} mm
 */
export function mm(mm) {
  return mm * MM_TO_PT;
}

/**
 * @typedef {object} PrintMarkOptions
 * @property {number} [bleedMm=3]        도련. 트림 박스 바깥쪽 안전 여유.
 * @property {number} [markLengthMm=10]  크롭마크 선 길이.
 * @property {number} [markOffsetMm=3]   트림 박스 바깥에서 떨어진 거리(=bleed).
 * @property {boolean} [cropMarks=true]
 * @property {boolean} [registrationMarks=true]
 * @property {boolean} [colorBar=true]
 * @property {boolean} [pageInfo=true]
 * @property {string} [fileName]         페이지 정보 표시용
 * @property {string} [date]             ISO 문자열. 미지정 시 new Date().toISOString().slice(0,10)
 * @property {number} [pageNumber]
 * @property {number} [pageTotal]
 * @property {import('pdf-lib').PDFFont} [font]  페이지 정보 텍스트 폰트 (없으면 정보 텍스트 생략)
 */

/**
 * 페이지에 인쇄소용 마크를 모두 추가한다.
 * 어느 마크를 추가했는지 카탈로그를 반환 — 테스트/디버그용.
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {PrintMarkOptions} [options]
 * @returns {{ cropMarks: boolean, registrationMarks: boolean, colorBar: boolean, pageInfo: boolean }}
 */
export function addPrintMarks(page, options = {}) {
  const opts = {
    bleedMm: 3,
    markLengthMm: 10,
    markOffsetMm: 3,
    cropMarks: true,
    registrationMarks: true,
    colorBar: true,
    pageInfo: true,
    ...options,
  };

  const applied = {
    cropMarks: false,
    registrationMarks: false,
    colorBar: false,
    pageInfo: false,
  };

  if (opts.cropMarks) {
    addCropMarks(page, opts);
    applied.cropMarks = true;
  }
  if (opts.registrationMarks) {
    addRegistrationMarks(page, opts);
    applied.registrationMarks = true;
  }
  if (opts.colorBar) {
    addColorBar(page, opts);
    applied.colorBar = true;
  }
  if (opts.pageInfo) {
    addPageInfo(page, opts);
    applied.pageInfo = true;
  }

  return applied;
}

/**
 * 페이지 네 모서리에 크롭마크 (트림 박스 모서리 표시) 를 그린다.
 *
 * 각 모서리마다 두 선(수평, 수직) — 모서리 바깥쪽 markOffsetMm 만큼 떨어진
 * 위치에서 markLengthMm 길이.
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {Required<Pick<PrintMarkOptions, 'markLengthMm' | 'markOffsetMm'>>} opts
 */
export function addCropMarks(page, opts) {
  const { width: w, height: h } = page.getSize();
  const len = mm(opts.markLengthMm);
  const off = mm(opts.markOffsetMm);
  const color = cmyk(0, 0, 0, 1); // 100% K (Registration black 대용)
  const thickness = 0.5; // pt

  // 좌하 ( (0,0) 근처 )
  drawCornerMarks(page, 0, 0, -1, -1, len, off, color, thickness);
  // 우하
  drawCornerMarks(page, w, 0, +1, -1, len, off, color, thickness);
  // 좌상
  drawCornerMarks(page, 0, h, -1, +1, len, off, color, thickness);
  // 우상
  drawCornerMarks(page, w, h, +1, +1, len, off, color, thickness);
}

/**
 * 단일 모서리의 두 크롭 선을 그리는 내부 헬퍼.
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {number} x         모서리 X
 * @param {number} y         모서리 Y
 * @param {-1|1} dx          바깥 방향 (수평)
 * @param {-1|1} dy          바깥 방향 (수직)
 * @param {number} len
 * @param {number} off
 * @param {import('pdf-lib').Color} color
 * @param {number} thickness
 */
function drawCornerMarks(page, x, y, dx, dy, len, off, color, thickness) {
  // 수평선: 모서리 X 에서 dx 방향으로 off 떨어진 곳에서 시작 → off+len 까지
  page.pushOperators(
    ...drawLine({
      start: { x: x + dx * off, y },
      end: { x: x + dx * (off + len), y },
      color,
      thickness,
    })
  );
  // 수직선: 모서리 Y 에서 dy 방향으로 off 떨어진 곳에서 시작 → off+len 까지
  page.pushOperators(
    ...drawLine({
      start: { x, y: y + dy * off },
      end: { x, y: y + dy * (off + len) },
      color,
      thickness,
    })
  );
}

/**
 * 네 변 중앙에 레지스트레이션 마크 (CMYK 네 잉크가 정렬되었는지 확인용 원형 마크).
 *
 * 각 마크는 중앙 십자 + 외곽 원 형태이며, color 는 100% C/M/Y/K 모두 1.0 인
 * "registration black"(C=M=Y=K=1).
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {PrintMarkOptions} opts
 */
export function addRegistrationMarks(page, opts) {
  const { width: w, height: h } = page.getSize();
  const radius = mm(2.5);
  const off = mm((opts.markOffsetMm || 3) + 6);
  const color = cmyk(1, 1, 1, 1); // 100% all — 정합 확인용

  /** @type {Array<{ x: number, y: number }>} */
  const positions = [
    { x: w / 2, y: -off }, // 하단 중앙 (음수 Y — 페이지 밖)
    { x: w / 2, y: h + off }, // 상단 중앙
    { x: -off, y: h / 2 }, // 좌측 중앙
    { x: w + off, y: h / 2 }, // 우측 중앙
  ];

  for (const p of positions) {
    // 바깥 원
    page.pushOperators(
      ...drawEllipse({
        x: p.x,
        y: p.y,
        xScale: radius,
        yScale: radius,
        borderColor: color,
        borderWidth: 0.5,
        color: undefined,
      })
    );
    // 수평/수직 십자
    page.pushOperators(
      ...drawLine({
        start: { x: p.x - radius * 1.4, y: p.y },
        end: { x: p.x + radius * 1.4, y: p.y },
        color,
        thickness: 0.5,
      })
    );
    page.pushOperators(
      ...drawLine({
        start: { x: p.x, y: p.y - radius * 1.4 },
        end: { x: p.x, y: p.y + radius * 1.4 },
        color,
        thickness: 0.5,
      })
    );
  }
}

/**
 * 페이지 하단(트림 박스 바깥)에 CMYK 컬러바 + 회색 단계바를 그린다.
 *
 * 패치 구성:
 *   - C 100% / M 100% / Y 100% / K 100% / R / G / B  (잉크 + RGB 검증)
 *   - 회색 단계: K 25, 50, 75, 100%
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {PrintMarkOptions} opts
 */
export function addColorBar(page, opts) {
  const { width: w } = page.getSize();
  const off = mm((opts.markOffsetMm || 3) + 14);
  const patchW = mm(8);
  const patchH = mm(5);
  const gap = mm(1);

  /** @type {Array<import('pdf-lib').Color>} */
  const patches = [
    cmyk(1, 0, 0, 0), // Cyan
    cmyk(0, 1, 0, 0), // Magenta
    cmyk(0, 0, 1, 0), // Yellow
    cmyk(0, 0, 0, 1), // Black (K)
    rgb(1, 0, 0), // Red (RGB 검증용)
    rgb(0, 1, 0), // Green
    rgb(0, 0, 1), // Blue
    cmyk(0, 0, 0, 0.25), // Gray 25%
    cmyk(0, 0, 0, 0.5), // Gray 50%
    cmyk(0, 0, 0, 0.75), // Gray 75%
    cmyk(0, 0, 0, 1), // Gray 100%
  ];

  // 컬러바는 페이지 하단 중앙 정렬
  const totalW = patches.length * patchW + (patches.length - 1) * gap;
  let x = (w - totalW) / 2;
  const y = -off; // 페이지 바깥 (음수 Y)

  for (const fill of patches) {
    page.pushOperators(
      ...drawRectangle({
        x,
        y,
        width: patchW,
        height: patchH,
        color: fill,
        borderColor: cmyk(0, 0, 0, 1),
        borderWidth: 0.25,
        ...ZERO_ROT,
      })
    );
    x += patchW + gap;
  }
}

/**
 * 좌상단 페이지 바깥에 파일명/날짜/페이지번호를 출력한다.
 * `options.font` 가 없으면 텍스트는 추가하지 않는다 (pdf-lib 는 폰트 객체 필요).
 *
 * @param {import('pdf-lib').PDFPage} page
 * @param {PrintMarkOptions} opts
 */
export function addPageInfo(page, opts) {
  if (!opts.font) return;
  const { height: h } = page.getSize();
  const off = mm((opts.markOffsetMm || 3) + 14);
  const fileName = opts.fileName || 'document';
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const pageNo = opts.pageNumber ? `Page ${opts.pageNumber}` : '';
  const pageTotal = opts.pageTotal ? `/${opts.pageTotal}` : '';
  const line = `${fileName}  |  ${date}  |  ${pageNo}${pageTotal}`.trim();

  page.drawText(line, {
    x: 0,
    y: h + off,
    size: 6,
    font: opts.font,
    color: cmyk(0, 0, 0, 1),
  });
}
