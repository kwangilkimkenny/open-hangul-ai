/**
 * HWPX → HWP 변환기 단위 테스트 (Step 1 — 단락만)
 *
 * 검증 범위:
 *   1. BinaryWriter / RecordStreamWriter 가 명세대로 직렬화한다.
 *   2. DocInfo 스트림이 필수 레코드를 모두 emit 한다 (TagID 16/17/19/20/21/25/26).
 *   3. Section 스트림이 PARA_HEADER/PARA_TEXT/PARA_CHAR_SHAPE/PARA_LINE_SEG 를 emit 한다.
 *   4. zlib raw deflate + CFB 컨테이너 조립이 깨지지 않는다.
 *   5. Hwpx2Hwp.convert(parsedDoc) 결과가 CFB 시그니처를 가진 .hwp 바이너리.
 */

import { describe, it, expect } from 'vitest';
import pako from 'pako';
import CFB from 'cfb';
import {
  BinaryWriter,
  RecordStreamWriter,
  buildDocInfoStream,
  buildSectionStream,
  collectBinData,
  Hwpx2Hwp,
} from './hwpx-to-hwp-converter.js';

// 레코드 스트림을 순회하며 모든 TagID 를 모은다.
function collectTagIds(bytes) {
  const out = [];
  let off = 0;
  while (off + 4 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + off, 4);
    const header = view.getUint32(0, true);
    const tagId = header & 0x3ff;
    const sizeField = (header >> 20) & 0xfff;
    out.push(tagId);
    let recSize = sizeField;
    let headerLen = 4;
    if (sizeField === 0xfff) {
      const ext = new DataView(bytes.buffer, bytes.byteOffset + off + 4, 4);
      recSize = ext.getUint32(0, true);
      headerLen = 8;
    }
    off += headerLen + recSize;
  }
  return out;
}

const simpleDoc = {
  sections: [
    {
      elements: [
        {
          type: 'paragraph',
          style: {},
          runs: [{ text: '안녕하세요', style: {} }],
        },
        {
          type: 'paragraph',
          style: {},
          runs: [
            { text: 'Bold ', style: { bold: true } },
            { text: 'and ', style: {} },
            { text: 'italic', style: { italic: true, color: '#FF0000' } },
          ],
        },
      ],
    },
  ],
};

describe('BinaryWriter', () => {
  it('writes little-endian uint16/uint32 correctly', () => {
    const w = new BinaryWriter();
    w.writeUint16(0x1234);
    w.writeUint32(0xdeadbeef);
    const bytes = w.toUint8Array();
    expect(Array.from(bytes)).toEqual([0x34, 0x12, 0xef, 0xbe, 0xad, 0xde]);
  });

  it('writes UTF-16LE strings without prefix', () => {
    const w = new BinaryWriter();
    w.writeUtf16LE('AB');
    // 'A' = 0x41, 'B' = 0x42
    expect(Array.from(w.toUint8Array())).toEqual([0x41, 0x00, 0x42, 0x00]);
  });

  it('writes HWP-prefixed string: [uint16 count][UTF-16LE chars]', () => {
    const w = new BinaryWriter();
    w.writeHwpString('가');
    const bytes = w.toUint8Array();
    expect(bytes[0]).toBe(1);
    expect(bytes[1]).toBe(0);
    // '가' = U+AC00
    expect(bytes[2]).toBe(0x00);
    expect(bytes[3]).toBe(0xac);
  });
});

describe('RecordStreamWriter', () => {
  it('builds a 4-byte header for small records', () => {
    const rw = new RecordStreamWriter();
    rw.writeRecord(42, 1, new Uint8Array([0xaa, 0xbb]));
    const buf = rw.toUint8Array();
    // header(4) + data(2) = 6
    expect(buf.length).toBe(6);
    const view = new DataView(buf.buffer);
    const header = view.getUint32(0, true);
    expect(header & 0x3ff).toBe(42);
    expect((header >> 10) & 0x3ff).toBe(1);
    expect((header >> 20) & 0xfff).toBe(2);
    expect(buf[4]).toBe(0xaa);
    expect(buf[5]).toBe(0xbb);
  });

  it('builds an 8-byte extended header when size >= 0xFFF', () => {
    const rw = new RecordStreamWriter();
    const big = new Uint8Array(0x1000); // 4096 bytes > 0xFFF threshold
    rw.writeRecord(42, 0, big);
    const buf = rw.toUint8Array();
    // header(8) + data(4096) = 4104
    expect(buf.length).toBe(4104);
    const view = new DataView(buf.buffer);
    const sizeField = (view.getUint32(0, true) >> 20) & 0xfff;
    expect(sizeField).toBe(0xfff);
    const realSize = view.getUint32(4, true);
    expect(realSize).toBe(0x1000);
  });
});

describe('buildDocInfoStream', () => {
  it('emits all required DocInfo records', () => {
    const { bytes, charStyles } = buildDocInfoStream(simpleDoc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    // 최소 1개의 char-style 풀 (기본 + bold + italic+color = 3)
    expect(charStyles.length).toBeGreaterThanOrEqual(2);

    // 레코드 헤더를 순회하며 등장한 TagID 모음
    const seenTags = new Set();
    let off = 0;
    while (off < bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + off, 4);
      const header = view.getUint32(0, true);
      const tagId = header & 0x3ff;
      const sizeField = (header >> 20) & 0xfff;
      seenTags.add(tagId);
      let recSize = sizeField;
      let headerLen = 4;
      if (sizeField === 0xfff) {
        const ext = new DataView(bytes.buffer, bytes.byteOffset + off + 4, 4);
        recSize = ext.getUint32(0, true);
        headerLen = 8;
      }
      off += headerLen + recSize;
      if (recSize === 0 && off === headerLen) break;
    }
    // 필수 TagID: DOCUMENT_PROPERTIES(16), ID_MAPPINGS(17), FACE_NAME(19),
    //          BORDER_FILL(20), CHAR_SHAPE(21), PARA_SHAPE(25), STYLE(26)
    expect(seenTags.has(16)).toBe(true);
    expect(seenTags.has(17)).toBe(true);
    expect(seenTags.has(19)).toBe(true);
    expect(seenTags.has(20)).toBe(true);
    expect(seenTags.has(21)).toBe(true);
    expect(seenTags.has(25)).toBe(true);
    expect(seenTags.has(26)).toBe(true);
  });
});

describe('buildSectionStream', () => {
  it('emits PARA_HEADER (66), PARA_TEXT (67), PARA_CHAR_SHAPE (68), PARA_LINE_SEG (69)', () => {
    const { charStyles } = buildDocInfoStream(simpleDoc);
    const bytes = buildSectionStream(simpleDoc.sections[0], charStyles);
    expect(bytes.length).toBeGreaterThan(0);

    const seenTags = new Set();
    let off = 0;
    while (off < bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + off, 4);
      const header = view.getUint32(0, true);
      const tagId = header & 0x3ff;
      const sizeField = (header >> 20) & 0xfff;
      seenTags.add(tagId);
      let recSize = sizeField;
      let headerLen = 4;
      if (sizeField === 0xfff) {
        const ext = new DataView(bytes.buffer, bytes.byteOffset + off + 4, 4);
        recSize = ext.getUint32(0, true);
        headerLen = 8;
      }
      off += headerLen + recSize;
    }
    expect(seenTags.has(66)).toBe(true);
    expect(seenTags.has(67)).toBe(true);
    expect(seenTags.has(68)).toBe(true);
    expect(seenTags.has(69)).toBe(true);
  });

  it('survives an empty section (emits at least an empty paragraph)', () => {
    const { charStyles } = buildDocInfoStream({ sections: [{ elements: [] }] });
    const bytes = buildSectionStream({ elements: [] }, charStyles);
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe('zlib raw deflate round-trip on streams', () => {
  it('compress + inflateRaw recovers DocInfo exactly', () => {
    const { bytes } = buildDocInfoStream(simpleDoc);
    const compressed = pako.deflateRaw(bytes, { level: 6 });
    const back = pako.inflateRaw(compressed);
    expect(back.length).toBe(bytes.length);
    for (let i = 0; i < bytes.length; i++) expect(back[i]).toBe(bytes[i]);
  });
});

describe('Hwpx2Hwp.convert (parsed input)', () => {
  it('produces a valid CFB compound document with the expected streams', async () => {
    const result = await Hwpx2Hwp.convert(simpleDoc);
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.data.length).toBeGreaterThan(0);
    // CFB 시그니처: 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
    expect(result.data[0]).toBe(0xd0);
    expect(result.data[1]).toBe(0xcf);
    expect(result.data[2]).toBe(0x11);
    expect(result.data[3]).toBe(0xe0);
    expect(result.data[4]).toBe(0xa1);
    expect(result.data[5]).toBe(0xb1);
    expect(result.data[6]).toBe(0x1a);
    expect(result.data[7]).toBe(0xe1);
    expect(result.stats.sectionCount).toBe(1);
    expect(result.stats.charShapeCount).toBeGreaterThanOrEqual(1);

    // CFB 로 다시 읽어 스트림 트리 검증
    const parsed = CFB.read(result.data, { type: 'array' });
    const paths = parsed.FullPaths.filter(p => p && p !== '/');
    const joined = paths.join('|');
    expect(joined).toMatch(/FileHeader/);
    expect(joined).toMatch(/DocInfo/);
    expect(joined).toMatch(/BodyText.*Section0/);
  });

  it('FileHeader 스트림은 "HWP Document File" 시그니처와 5.1 버전을 가진다', async () => {
    const { data } = await Hwpx2Hwp.convert(simpleDoc);
    const parsed = CFB.read(data, { type: 'array' });
    const fh = CFB.find(parsed, '/FileHeader');
    expect(fh).toBeTruthy();
    const buf = fh.content;
    const sig = String.fromCharCode(...Array.from(buf.slice(0, 17)));
    expect(sig).toBe('HWP Document File');
    expect(buf[34]).toBe(1); // minor
    expect(buf[35]).toBe(5); // major
    // 압축 플래그가 켜져 있어야 함
    const view = new DataView(new Uint8Array(buf).buffer);
    const flags = view.getUint32(36, true);
    expect(flags & 0x0001).toBe(0x0001);
  });

  it('DocInfo 스트림은 압축되어 있으며 inflateRaw 로 복원된다', async () => {
    const { data } = await Hwpx2Hwp.convert(simpleDoc);
    const parsed = CFB.read(data, { type: 'array' });
    const di = CFB.find(parsed, '/DocInfo');
    expect(di).toBeTruthy();
    const raw = new Uint8Array(di.content);
    const inflated = pako.inflateRaw(raw);
    expect(inflated.length).toBeGreaterThan(0);
    // 첫 레코드는 DOCUMENT_PROPERTIES (TagID=16)
    const view = new DataView(inflated.buffer, inflated.byteOffset, 4);
    expect(view.getUint32(0, true) & 0x3ff).toBe(16);
  });

  it('Section0 스트림은 압축되어 있으며 PARA_HEADER 가 첫 레코드', async () => {
    const { data } = await Hwpx2Hwp.convert(simpleDoc);
    const parsed = CFB.read(data, { type: 'array' });
    const sec = CFB.find(parsed, '/BodyText/Section0');
    expect(sec).toBeTruthy();
    const raw = new Uint8Array(sec.content);
    const inflated = pako.inflateRaw(raw);
    expect(inflated.length).toBeGreaterThan(0);
    const view = new DataView(inflated.buffer, inflated.byteOffset, 4);
    expect(view.getUint32(0, true) & 0x3ff).toBe(66); // PARA_HEADER
  });

  it('compress:false 옵션은 비압축 스트림을 만든다', async () => {
    const { data } = await Hwpx2Hwp.convert(simpleDoc, { compress: false });
    const parsed = CFB.read(data, { type: 'array' });
    const di = CFB.find(parsed, '/DocInfo');
    const buf = new Uint8Array(di.content);
    // 첫 레코드 TagID 가 16 이면 비압축
    const view = new DataView(buf.buffer, buf.byteOffset, 4);
    expect(view.getUint32(0, true) & 0x3ff).toBe(16);
  });

  it('잘못된 입력에 대해 throw', async () => {
    await expect(Hwpx2Hwp.convert(null)).rejects.toThrow();
    await expect(Hwpx2Hwp.convert({ foo: 'bar' })).rejects.toThrow();
  });

  it('convertSimple 는 data Uint8Array 만 반환', async () => {
    const out = await Hwpx2Hwp.convertSimple(simpleDoc);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('Hwpx2Hwp 멀티 섹션 지원', () => {
  it('두 섹션 입력 → BodyText/Section0 + Section1', async () => {
    const multi = {
      sections: [
        {
          elements: [{ type: 'paragraph', style: {}, runs: [{ text: '첫 섹션', style: {} }] }],
        },
        {
          elements: [{ type: 'paragraph', style: {}, runs: [{ text: '둘째 섹션', style: {} }] }],
        },
      ],
    };
    const { data, stats } = await Hwpx2Hwp.convert(multi);
    expect(stats.sectionCount).toBe(2);
    const parsed = CFB.read(data, { type: 'array' });
    expect(CFB.find(parsed, '/BodyText/Section0')).toBeTruthy();
    expect(CFB.find(parsed, '/BodyText/Section1')).toBeTruthy();
  });
});

// ============================================================================
// Step 2 — 표 직렬화
// ============================================================================

describe('Step 2 — 표 직렬화', () => {
  const docWithTable = {
    sections: [
      {
        elements: [
          {
            type: 'paragraph',
            style: {},
            runs: [
              { text: '표:', style: {} },
              { hasTable: true, tableIndex: 0, style: {} },
            ],
            tables: [
              {
                type: 'table',
                rowCount: 2,
                colCount: 2,
                style: { borderFillId: 1 },
                rows: [
                  {
                    cells: [
                      {
                        colAddr: 0, rowAddr: 0, widthHWPU: 5000, heightHWPU: 1000,
                        elements: [
                          { type: 'paragraph', style: {}, runs: [{ text: 'A1', style: {} }] },
                        ],
                      },
                      {
                        colAddr: 1, rowAddr: 0, widthHWPU: 5000, heightHWPU: 1000, colSpan: 1,
                        elements: [
                          { type: 'paragraph', style: {}, runs: [{ text: 'B1', style: {} }] },
                        ],
                      },
                    ],
                  },
                  {
                    cells: [
                      {
                        colAddr: 0, rowAddr: 1, widthHWPU: 10000, heightHWPU: 1000, colSpan: 2,
                        elements: [
                          { type: 'paragraph', style: {}, runs: [{ text: '병합 셀', style: { bold: true } }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it('표가 있는 단락은 PARA_HEADER 컨트롤 마스크에 0x800 비트와 INLINE_OBJ(0x18) 문자를 갖는다', () => {
    const { charStyles } = buildDocInfoStream(docWithTable);
    const bytes = buildSectionStream(docWithTable.sections[0], charStyles);
    // 첫 레코드 PARA_HEADER 의 컨트롤 마스크 (offset 4-7) 검사
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const charCount = view.getUint32(4, true); // PARA_HEADER 데이터 오프셋 0 = charCount
    const ctrlMask = view.getUint32(8, true); // 오프셋 4 = ctrlMask
    expect(charCount).toBeGreaterThan(2); // '표:' + INLINE_OBJ + PARA_BREAK
    expect(ctrlMask & 0x800).toBe(0x800);

    // PARA_TEXT(67) 안에 0x18 코드가 등장해야 한다
    let foundInlineObj = false;
    let off = 0;
    while (off + 4 <= bytes.length) {
      const h = view.getUint32(off, true);
      const tag = h & 0x3ff;
      const sf = (h >> 20) & 0xfff;
      let recSize = sf;
      let hl = 4;
      if (sf === 0xfff) {
        recSize = view.getUint32(off + 4, true);
        hl = 8;
      }
      if (tag === 67) {
        for (let i = 0; i < recSize; i += 2) {
          const code = view.getUint16(off + hl + i, true);
          if (code === 0x18) { foundInlineObj = true; break; }
        }
      }
      off += hl + recSize;
    }
    expect(foundInlineObj).toBe(true);
  });

  it('CTRL_HEADER(71) + TABLE(77) + 셀별 LIST_HEADER(72) 시퀀스를 emit', () => {
    const { charStyles } = buildDocInfoStream(docWithTable);
    const bytes = buildSectionStream(docWithTable.sections[0], charStyles);
    const tags = collectTagIds(bytes);
    expect(tags).toContain(71); // CTRL_HEADER
    expect(tags).toContain(77); // TABLE
    expect(tags).toContain(72); // LIST_HEADER
    // 셀 3개 (2+1 병합) → LIST_HEADER 3개
    const listHeaderCount = tags.filter(t => t === 72).length;
    expect(listHeaderCount).toBe(3);
  });

  it('표 셀 내 단락의 글자 스타일이 DocInfo CharShape 풀에 수집된다', () => {
    const { charStyles } = buildDocInfoStream(docWithTable);
    // 기본 + bold 두 가지
    expect(charStyles.length).toBeGreaterThanOrEqual(2);
    const hasBold = charStyles.some(s => s.bold);
    expect(hasBold).toBe(true);
  });

  it('Hwpx2Hwp.convert() 가 표 포함 문서를 CFB 로 잘 묶는다', async () => {
    const { data, stats } = await Hwpx2Hwp.convert(docWithTable);
    expect(stats.sectionCount).toBe(1);
    const parsed = CFB.read(data, { type: 'array' });
    const sec = CFB.find(parsed, '/BodyText/Section0');
    const inflated = pako.inflateRaw(new Uint8Array(sec.content));
    expect(collectTagIds(inflated)).toContain(77); // TABLE
  });
});

// ============================================================================
// Step 3 — 이미지 + 도형 직렬화
// ============================================================================

describe('Step 3 — 이미지 + 도형 직렬화', () => {
  // 1x1 PNG (transparent)
  const tinyPng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0xfa, 0xcf, 0x00, 0x00,
    0x00, 0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82,
  ]);

  const docWithImage = {
    sections: [
      {
        elements: [
          {
            type: 'paragraph',
            style: {},
            runs: [{ hasImage: true, imageIndex: 0, style: {} }],
            images: [
              {
                type: 'image',
                binaryItemId: 'image1',
                width: 100,
                height: 50,
                filename: 'image1.png',
                mimeType: 'image/png',
                bytes: tinyPng,
              },
            ],
          },
        ],
      },
    ],
  };

  const docWithShapes = {
    sections: [
      {
        elements: [
          {
            type: 'paragraph',
            style: {},
            runs: [
              { hasShape: true, style: {} },
              { hasShape: true, style: {} },
            ],
            shapes: [
              { type: 'shape', shapeType: 'rectangle', width: 200, height: 100, borderRadius: 5 },
              { type: 'shape', shapeType: 'ellipse', width: 80, height: 80 },
            ],
          },
        ],
      },
    ],
  };

  it('collectBinData() 가 이미지 한 개를 수집한다', () => {
    const list = collectBinData(docWithImage);
    expect(list.length).toBe(1);
    expect(list[0].key).toBe('image1');
    expect(list[0].ext).toBe('png');
    expect(list[0].bytes).toBeInstanceOf(Uint8Array);
  });

  it('DocInfo 에 BIN_DATA(18) 레코드와 ID_MAPPINGS.binData 카운트가 반영된다', () => {
    const { bytes } = buildDocInfoStream(docWithImage);
    const tags = collectTagIds(bytes);
    expect(tags).toContain(18); // BIN_DATA
    // ID_MAPPINGS(17) 첫 4바이트 = binData 카운트
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    // DOCUMENT_PROPERTIES(16) 가 첫 레코드 → 그 뒤 ID_MAPPINGS(17)
    let off = 0;
    let binDataCount = -1;
    while (off + 4 <= bytes.length) {
      const h = view.getUint32(off, true);
      const tag = h & 0x3ff;
      const sf = (h >> 20) & 0xfff;
      let recSize = sf;
      let hl = 4;
      if (sf === 0xfff) {
        recSize = view.getUint32(off + 4, true);
        hl = 8;
      }
      if (tag === 17) {
        binDataCount = view.getInt32(off + hl, true);
        break;
      }
      off += hl + recSize;
    }
    expect(binDataCount).toBe(1);
  });

  it('이미지 포함 단락은 PARA_HEADER ctrlMask=0x800, DRAWING_OBJ(0x0B) 삽입, SHAPE_COMPONENT_PICTURE(85) emit', () => {
    const { charStyles } = buildDocInfoStream(docWithImage);
    const binIndex = { image1: 0 };
    const bytes = buildSectionStream(docWithImage.sections[0], charStyles, binIndex);
    const tags = collectTagIds(bytes);
    expect(tags).toContain(71); // CTRL_HEADER (gso)
    expect(tags).toContain(76); // SHAPE_COMPONENT
    expect(tags).toContain(85); // SHAPE_COMPONENT_PICTURE

    // PARA_HEADER ctrlMask
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const ctrlMask = view.getUint32(8, true);
    expect(ctrlMask & 0x800).toBe(0x800);

    // PARA_TEXT 에 0x0B 가 있어야 함
    let foundDrawing = false;
    let off = 0;
    while (off + 4 <= bytes.length) {
      const h = view.getUint32(off, true);
      const tag = h & 0x3ff;
      const sf = (h >> 20) & 0xfff;
      let recSize = sf;
      let hl = 4;
      if (sf === 0xfff) {
        recSize = view.getUint32(off + 4, true);
        hl = 8;
      }
      if (tag === 67) {
        for (let i = 0; i < recSize; i += 2) {
          const code = view.getUint16(off + hl + i, true);
          if (code === 0x0b) { foundDrawing = true; break; }
        }
      }
      off += hl + recSize;
    }
    expect(foundDrawing).toBe(true);
  });

  it('도형(사각형/타원) 단락은 SHAPE_COMPONENT_RECTANGLE(79) + SHAPE_COMPONENT_ELLIPSE(80) emit', () => {
    const { charStyles } = buildDocInfoStream(docWithShapes);
    const bytes = buildSectionStream(docWithShapes.sections[0], charStyles, {});
    const tags = collectTagIds(bytes);
    expect(tags).toContain(76); // SHAPE_COMPONENT
    expect(tags).toContain(79); // SHAPE_COMPONENT_RECTANGLE
    expect(tags).toContain(80); // SHAPE_COMPONENT_ELLIPSE
  });

  it('Hwpx2Hwp.convert() 가 이미지 raw 바이트를 /BinData/BIN0001.png 스트림으로 저장', async () => {
    const { data, stats } = await Hwpx2Hwp.convert(docWithImage);
    expect(stats.binDataCount).toBe(1);
    const parsed = CFB.read(data, { type: 'array' });
    const bin = CFB.find(parsed, '/BinData/BIN0001.png');
    expect(bin).toBeTruthy();
    // 압축 해제 후 PNG 시그니처 확인
    const inflated = pako.inflateRaw(new Uint8Array(bin.content));
    expect(inflated[0]).toBe(0x89);
    expect(inflated[1]).toBe(0x50);
    expect(inflated[2]).toBe(0x4e);
    expect(inflated[3]).toBe(0x47);
  });

  it('options.binData 로 외부 raw 바이트 주입 시에도 BinData 스트림이 생성된다', async () => {
    const docNoBytes = {
      sections: [
        {
          elements: [
            {
              type: 'paragraph',
              style: {},
              runs: [{ hasImage: true, imageIndex: 0, style: {} }],
              images: [{ type: 'image', binaryItemId: 'img42', width: 10, height: 10 }],
            },
          ],
        },
      ],
    };
    const { data, stats } = await Hwpx2Hwp.convert(docNoBytes, {
      binData: { img42: { bytes: tinyPng, ext: 'png' } },
    });
    expect(stats.binDataCount).toBe(1);
    const parsed = CFB.read(data, { type: 'array' });
    expect(CFB.find(parsed, '/BinData/BIN0001.png')).toBeTruthy();
  });

  it('이미지 없는 단순 문서는 BinData 스트림을 만들지 않는다 (회귀 방지)', async () => {
    const simple = {
      sections: [
        { elements: [{ type: 'paragraph', style: {}, runs: [{ text: '안녕', style: {} }] }] },
      ],
    };
    const { data, stats } = await Hwpx2Hwp.convert(simple);
    expect(stats.binDataCount).toBe(0);
    const parsed = CFB.read(data, { type: 'array' });
    // /BinData/* 경로가 등장하지 않아야 함
    const paths = parsed.FullPaths || [];
    expect(paths.some(p => p && p.includes('/BinData/'))).toBe(false);
  });
});
