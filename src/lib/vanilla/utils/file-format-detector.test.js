/**
 * Unit tests for file-format-detector.js
 */

import { describe, it, expect } from 'vitest';
import {
  MAGIC_NUMBERS,
  detectFormat,
  detectOleContainerFormat,
  isZip,
  isCfb,
  isEmf,
  isWmf,
  isPng,
  isJpeg,
  isPdf,
} from './file-format-detector.js';

/** 헬퍼: 매직넘버 + 패딩 바이트로 Uint8Array 만들기 */
function withMagic(magic, padding = 16) {
  const out = new Uint8Array(magic.length + padding);
  out.set(magic, 0);
  return out;
}

describe('MAGIC_NUMBERS catalog', () => {
  it('표준 매직 넘버 7종이 정의되어 있다', () => {
    expect(Object.keys(MAGIC_NUMBERS).sort()).toEqual(
      ['CFB', 'EMF', 'JPEG', 'PDF', 'PNG', 'WMF', 'ZIP'].sort()
    );
  });

  it('카탈로그는 불변(frozen)이다', () => {
    expect(Object.isFrozen(MAGIC_NUMBERS)).toBe(true);
  });

  it('ZIP 시그니처는 PK\\x03\\x04', () => {
    expect(MAGIC_NUMBERS.ZIP).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('CFB 시그니처는 8바이트 OLE 헤더', () => {
    expect(MAGIC_NUMBERS.CFB).toEqual([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  });
});

describe('detectFormat', () => {
  it('ZIP 매직넘버 → "zip"', () => {
    expect(detectFormat(withMagic(MAGIC_NUMBERS.ZIP))).toBe('zip');
  });

  it('CFB 매직넘버 → "cfb"', () => {
    expect(detectFormat(withMagic(MAGIC_NUMBERS.CFB))).toBe('cfb');
  });

  it('EMF 매직넘버 → "emf"', () => {
    expect(detectFormat(withMagic(MAGIC_NUMBERS.EMF))).toBe('emf');
  });

  it('WMF Placeable 매직넘버 → "wmf"', () => {
    expect(detectFormat(withMagic(MAGIC_NUMBERS.WMF))).toBe('wmf');
  });

  it('PNG 매직넘버 → "png"', () => {
    expect(detectFormat(withMagic(MAGIC_NUMBERS.PNG))).toBe('png');
  });

  it('JPEG 매직넘버 → "jpeg"', () => {
    expect(detectFormat(withMagic(MAGIC_NUMBERS.JPEG))).toBe('jpeg');
  });

  it('PDF 매직넘버("%PDF") → "pdf"', () => {
    expect(detectFormat(withMagic(MAGIC_NUMBERS.PDF))).toBe('pdf');
  });

  it('빈 입력 → "unknown"', () => {
    expect(detectFormat(new Uint8Array(0))).toBe('unknown');
    expect(detectFormat(null)).toBe('unknown');
  });

  it('너무 짧은 입력은 "unknown"', () => {
    expect(detectFormat(new Uint8Array([0x50, 0x4b]))).toBe('unknown');
  });

  it('알 수 없는 시그니처 → "unknown"', () => {
    expect(detectFormat(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee]))).toBe('unknown');
  });

  it('우선순위: CFB는 ZIP보다 먼저 검사된다', () => {
    // CFB 시그니처가 정확히 일치하면 "cfb" 가 반환되어야 한다.
    const cfb = withMagic(MAGIC_NUMBERS.CFB);
    expect(detectFormat(cfb)).toBe('cfb');
  });
});

describe('타입별 boolean 헬퍼', () => {
  it('isZip은 ZIP에만 true', () => {
    expect(isZip(withMagic(MAGIC_NUMBERS.ZIP))).toBe(true);
    expect(isZip(withMagic(MAGIC_NUMBERS.CFB))).toBe(false);
    expect(isZip(null)).toBe(false);
  });

  it('isCfb는 CFB에만 true', () => {
    expect(isCfb(withMagic(MAGIC_NUMBERS.CFB))).toBe(true);
    expect(isCfb(withMagic(MAGIC_NUMBERS.ZIP))).toBe(false);
  });

  it('isEmf / isWmf 분리 확인', () => {
    expect(isEmf(withMagic(MAGIC_NUMBERS.EMF))).toBe(true);
    expect(isEmf(withMagic(MAGIC_NUMBERS.WMF))).toBe(false);
    expect(isWmf(withMagic(MAGIC_NUMBERS.WMF))).toBe(true);
    expect(isWmf(withMagic(MAGIC_NUMBERS.EMF))).toBe(false);
  });

  it('이미지 헬퍼(isPng/isJpeg) 검증', () => {
    expect(isPng(withMagic(MAGIC_NUMBERS.PNG))).toBe(true);
    expect(isJpeg(withMagic(MAGIC_NUMBERS.JPEG))).toBe(true);
    expect(isJpeg(withMagic(MAGIC_NUMBERS.PNG))).toBe(false);
  });

  it('isPdf("%PDF") 검증', () => {
    expect(isPdf(withMagic(MAGIC_NUMBERS.PDF))).toBe(true);
    expect(isPdf(new Uint8Array([0x25, 0x50, 0x44]))).toBe(false); // 짧음
  });
});

describe('detectOleContainerFormat', () => {
  it('ZIP → "ooxml"', () => {
    expect(detectOleContainerFormat(withMagic(MAGIC_NUMBERS.ZIP))).toBe('ooxml');
  });

  it('CFB → "cfb"', () => {
    expect(detectOleContainerFormat(withMagic(MAGIC_NUMBERS.CFB))).toBe('cfb');
  });

  it('EMF/WMF → "metafile"', () => {
    expect(detectOleContainerFormat(withMagic(MAGIC_NUMBERS.EMF))).toBe('metafile');
    expect(detectOleContainerFormat(withMagic(MAGIC_NUMBERS.WMF))).toBe('metafile');
  });

  it('PNG/JPEG/PDF는 OLE 컨테이너 분류상 "unknown"', () => {
    expect(detectOleContainerFormat(withMagic(MAGIC_NUMBERS.PNG))).toBe('unknown');
    expect(detectOleContainerFormat(withMagic(MAGIC_NUMBERS.JPEG))).toBe('unknown');
    expect(detectOleContainerFormat(withMagic(MAGIC_NUMBERS.PDF))).toBe('unknown');
  });

  it('빈 입력 → "unknown"', () => {
    expect(detectOleContainerFormat(new Uint8Array(0))).toBe('unknown');
  });
});
