/**
 * print-marks 단위 테스트.
 * 실제 pdf-lib PDFDocument 을 사용해 페이지에 마크를 그린 뒤,
 * pushOperators 호출 횟수 / drawText 호출 여부 등으로 행동을 검증한다.
 */

import { PDFDocument, StandardFonts, PageSizes } from 'pdf-lib';

import {
  addPrintMarks,
  addCropMarks,
  addRegistrationMarks,
  addColorBar,
  addPageInfo,
  MM_TO_PT,
  mm,
} from './print-marks.js';

/**
 * 새 A4 PDF + 1페이지를 만들고 pushOperators / drawText 를 스파이로 감싼 후 반환.
 */
async function makeSpyPage() {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);
  const pushSpy = vi.spyOn(page, 'pushOperators');
  const drawTextSpy = vi.spyOn(page, 'drawText');
  return { doc, page, pushSpy, drawTextSpy };
}

describe('print-marks — 단위 변환', () => {
  it('mm() 가 72/25.4 비율과 일치', () => {
    expect(mm(1)).toBeCloseTo(MM_TO_PT, 6);
    expect(mm(10)).toBeCloseTo(28.346, 2);
    expect(mm(0)).toBe(0);
  });
});

describe('addCropMarks', () => {
  it('네 모서리 × 두 선 = 8회 pushOperators 호출', async () => {
    const { page, pushSpy } = await makeSpyPage();
    addCropMarks(page, { markLengthMm: 10, markOffsetMm: 3 });
    expect(pushSpy).toHaveBeenCalledTimes(8);
  });
});

describe('addRegistrationMarks', () => {
  it('4개 마크 × (원 1 + 십자 2) = 12회 pushOperators 호출', async () => {
    const { page, pushSpy } = await makeSpyPage();
    addRegistrationMarks(page, { markOffsetMm: 3 });
    expect(pushSpy).toHaveBeenCalledTimes(12);
  });
});

describe('addColorBar', () => {
  it('11개 패치 = 11회 drawRectangle (pushOperators)', async () => {
    const { page, pushSpy } = await makeSpyPage();
    addColorBar(page, { markOffsetMm: 3 });
    expect(pushSpy).toHaveBeenCalledTimes(11);
  });
});

describe('addPageInfo', () => {
  it('font 미지정 시 drawText 호출되지 않음', async () => {
    const { page, drawTextSpy } = await makeSpyPage();
    addPageInfo(page, { fileName: 'demo.hwpx' });
    expect(drawTextSpy).not.toHaveBeenCalled();
  });

  it('font 지정 시 drawText 한 줄 호출', async () => {
    const { doc, page, drawTextSpy } = await makeSpyPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    addPageInfo(page, {
      font,
      fileName: 'demo.hwpx',
      date: '2026-05-26',
      pageNumber: 1,
      pageTotal: 5,
    });
    expect(drawTextSpy).toHaveBeenCalledTimes(1);
    const [text] = drawTextSpy.mock.calls[0];
    expect(text).toContain('demo.hwpx');
    expect(text).toContain('2026-05-26');
    expect(text).toContain('Page 1/5');
  });
});

describe('addPrintMarks (통합)', () => {
  it('기본 옵션으로 4종 마크 모두 적용 보고', async () => {
    const { page } = await makeSpyPage();
    const applied = addPrintMarks(page, { fileName: 'x' });
    expect(applied).toEqual({
      cropMarks: true,
      registrationMarks: true,
      colorBar: true,
      pageInfo: true,
    });
  });

  it('선택적으로 마크를 비활성화 가능', async () => {
    const { page } = await makeSpyPage();
    const applied = addPrintMarks(page, {
      cropMarks: false,
      colorBar: false,
    });
    expect(applied.cropMarks).toBe(false);
    expect(applied.colorBar).toBe(false);
    expect(applied.registrationMarks).toBe(true);
    expect(applied.pageInfo).toBe(true);
  });
});
