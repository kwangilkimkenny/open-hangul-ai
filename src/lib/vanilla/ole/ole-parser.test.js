/**
 * Unit tests for ole-parser.js
 *
 * 본 테스트는 외부 OLE 픽스처 없이 동작한다.
 * - CFB 컨테이너는 cfb.utils.cfb_new + cfb_add 로 즉석 생성한다.
 * - CompObj 스트림 바이트는 직접 조립한다.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import CFB from 'cfb';
import {
  parseOle,
  parseCompObjStream,
  classifyOleType,
  isOleBinData,
  inferOleTypeFromExtension,
  findPreviewStream,
  serializeOLE,
  OLE_EXTENSIONS
} from './ole-parser.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * CompObj 스트림 바이트 생성 (간단 버전)
 * header(28) + LE-u32 len + ASCII + 0x00 ... 3회
 */
function buildCompObj(userType, fmtOrClsid, progId) {
  const header = new Uint8Array(28);
  header[0] = 0x01;
  header[2] = 0xfe;
  header[3] = 0xff;

  const enc = s => {
    const buf = new Uint8Array(4 + s.length + 1);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, s.length + 1, true);
    for (let i = 0; i < s.length; i++) buf[4 + i] = s.charCodeAt(i);
    buf[4 + s.length] = 0x00;
    return buf;
  };

  const parts = [header, enc(userType), enc(fmtOrClsid), enc(progId)];
  const total = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function makeCfbWithCompObj({ userType, fmt, progId, preview = null, previewName = '/EMF' } = {}) {
  const c = CFB.utils.cfb_new();
  CFB.utils.cfb_add(c, '/CompObj', buildCompObj(userType, fmt, progId));
  if (preview) CFB.utils.cfb_add(c, previewName, preview);
  const written = CFB.write(c, { type: 'array' });
  return written instanceof Uint8Array ? written : new Uint8Array(written);
}

// ---------------------------------------------------------------------------
// isOleBinData / inferOleTypeFromExtension
// ---------------------------------------------------------------------------

describe('isOleBinData', () => {
  it('OLE 확장자 모두 true', () => {
    for (const ext of OLE_EXTENSIONS) {
      expect(isOleBinData(`BinData/embed.${ext}`)).toBe(true);
    }
  });
  it('이미지/PDF 확장자는 false', () => {
    expect(isOleBinData('BinData/foo.png')).toBe(false);
    expect(isOleBinData('BinData/foo.pdf')).toBe(false);
    expect(isOleBinData('')).toBe(false);
    expect(isOleBinData(null)).toBe(false);
  });
});

describe('inferOleTypeFromExtension', () => {
  it('xlsx/docx/pptx 매핑', () => {
    expect(inferOleTypeFromExtension('a.xlsx')).toBe('excel');
    expect(inferOleTypeFromExtension('a.docx')).toBe('word');
    expect(inferOleTypeFromExtension('a.pptx')).toBe('powerpoint');
  });
  it('emf/wmf 는 unknown', () => {
    expect(inferOleTypeFromExtension('a.emf')).toBe('unknown');
    expect(inferOleTypeFromExtension('a.wmf')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// parseCompObjStream
// ---------------------------------------------------------------------------

describe('parseCompObjStream', () => {
  it('UserType, ProgID 를 읽는다', () => {
    const bytes = buildCompObj('Microsoft Excel Worksheet', 'Biff8', 'Excel.Sheet.12');
    const r = parseCompObjStream(bytes);
    expect(r.userType).toBe('Microsoft Excel Worksheet');
    expect(r.className).toBe('Excel.Sheet.12');
  });
  it('빈/짧은 입력은 안전하게 빈 결과', () => {
    expect(parseCompObjStream(null)).toEqual({ userType: '', className: '' });
    expect(parseCompObjStream(new Uint8Array(4))).toEqual({ userType: '', className: '' });
  });
});

// ---------------------------------------------------------------------------
// classifyOleType
// ---------------------------------------------------------------------------

describe('classifyOleType', () => {
  it('ProgID 우선 분류', () => {
    expect(classifyOleType('Excel.Sheet.12', '')).toBe('excel');
    expect(classifyOleType('Word.Document.12', '')).toBe('word');
    expect(classifyOleType('PowerPoint.Slide.12', '')).toBe('powerpoint');
  });
  it('UserType 한국어 휴리스틱', () => {
    expect(classifyOleType('', 'Microsoft 엑셀 워크시트')).toBe('excel');
    expect(classifyOleType('', 'Microsoft Word Document')).toBe('word');
    expect(classifyOleType('', '파워포인트 슬라이드')).toBe('powerpoint');
  });
  it('알 수 없는 경우 unknown', () => {
    expect(classifyOleType('Foo.Bar', 'Bar')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// findPreviewStream
// ---------------------------------------------------------------------------

describe('findPreviewStream', () => {
  it('EMF 스트림이 있으면 추출', () => {
    const fakeEmf = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x6c, 0x00, 0x00, 0x00]);
    const cfbBytes = makeCfbWithCompObj({
      userType: 'X', fmt: '', progId: 'Excel.Sheet.12',
      preview: fakeEmf, previewName: '/EMF'
    });
    const c = CFB.read(cfbBytes, { type: 'array' });
    const r = findPreviewStream(c);
    expect(r).not.toBeNull();
    expect(r.mimeType).toBe('image/x-emf');
    expect(r.bytes.length).toBe(fakeEmf.length);
  });
  it('미리보기가 없으면 null', () => {
    const cfbBytes = makeCfbWithCompObj({
      userType: 'X', fmt: '', progId: 'Excel.Sheet.12'
    });
    const c = CFB.read(cfbBytes, { type: 'array' });
    expect(findPreviewStream(c)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseOle — end-to-end
// ---------------------------------------------------------------------------

describe('parseOle', () => {
  it('Excel CFB → type=excel, metadata 정확', () => {
    const fakeEmf = new Uint8Array([1, 0, 0, 0, 0x6c, 0, 0, 0, 9, 9, 9, 9]);
    const cfb = makeCfbWithCompObj({
      userType: 'Microsoft Excel Worksheet',
      fmt: 'Biff8',
      progId: 'Excel.Sheet.12',
      preview: fakeEmf
    });
    const ole = parseOle(cfb, 'BinData/embed1.ole');
    expect(ole).not.toBeNull();
    expect(ole.type).toBe('excel');
    expect(ole.metadata.className).toBe('Excel.Sheet.12');
    expect(ole.metadata.userType).toBe('Microsoft Excel Worksheet');
    expect(ole.metadata.originalName).toBe('embed1.ole');
    expect(ole.metadata.fileSize).toBe(cfb.byteLength);
    expect(ole.previewImage).not.toBeNull();
    expect(ole.previewMimeType).toBe('image/x-emf');
    expect(Array.isArray(ole.metadata.streams)).toBe(true);
  });

  it('Word CFB → type=word', () => {
    const cfb = makeCfbWithCompObj({
      userType: 'Microsoft Word Document',
      fmt: '',
      progId: 'Word.Document.12'
    });
    const ole = parseOle(cfb, 'embedWord.ole');
    expect(ole.type).toBe('word');
    expect(ole.metadata.className).toBe('Word.Document.12');
    expect(ole.previewImage).toBeNull();
  });

  it('PowerPoint CFB → type=powerpoint', () => {
    const cfb = makeCfbWithCompObj({
      userType: 'Microsoft PowerPoint Slide',
      fmt: '',
      progId: 'PowerPoint.Slide.12'
    });
    const ole = parseOle(cfb, 'slide.ole');
    expect(ole.type).toBe('powerpoint');
  });

  it('단독 EMF 파일은 previewImage 그대로 반환', () => {
    const emf = new Uint8Array([1, 0, 0, 0, 0x6c, 0, 0, 0, 0, 0, 0, 0]);
    const ole = parseOle(emf, 'preview.emf');
    expect(ole.type).toBe('unknown');
    expect(ole.previewImage).toEqual(emf);
    expect(ole.previewMimeType).toBe('image/x-emf');
  });

  it('OOXML(xlsx) zip 헤더 → type=excel, preview 없음', () => {
    // PK\x03\x04 magic + 더미 바이트
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);
    const ole = parseOle(zip, 'sheet.xlsx');
    expect(ole.type).toBe('excel');
    expect(ole.previewImage).toBeNull();
  });

  it('CFB 도 zip 도 아닌 raw 데이터는 확장자 fallback', () => {
    const bogus = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const ole = parseOle(bogus, 'thing.docx');
    expect(ole.type).toBe('word');
    expect(ole.previewImage).toBeNull();
  });

  it('객체 입력 형태 지원', () => {
    const cfb = makeCfbWithCompObj({
      userType: 'Excel Stuff', fmt: '', progId: 'Excel.Sheet.8'
    });
    const ole = parseOle({ data: cfb, path: 'BinData/foo.ole', filename: 'foo.ole' });
    expect(ole.type).toBe('excel');
    expect(ole.metadata.originalName).toBe('foo.ole');
  });

  it('null/empty 안전', () => {
    expect(parseOle(null)).toBeNull();
    expect(parseOle(undefined, 'foo.ole')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// serializeOLE (skeleton)
// ---------------------------------------------------------------------------

describe('serializeOLE', () => {
  it('CFB 컨테이너를 만들어 다시 parseOle 가능', () => {
    const previewEmf = new Uint8Array([1, 0, 0, 0, 0x6c, 0, 0, 0]);
    const out = serializeOLE({
      type: 'excel',
      previewImage: previewEmf,
      previewMimeType: 'image/x-emf',
      metadata: { className: 'Excel.Sheet.12', userType: 'Microsoft Excel Worksheet' }
    });
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeGreaterThan(0);

    const round = parseOle(out, 'rt.ole');
    expect(round).not.toBeNull();
    expect(round.type).toBe('excel');
    expect(round.metadata.className).toBe('Excel.Sheet.12');
  });

  it('미리보기 없이도 CFB 생성', () => {
    const out = serializeOLE({
      metadata: { className: 'Word.Document.12', userType: 'Word' }
    });
    expect(out.length).toBeGreaterThan(0);
  });
});
