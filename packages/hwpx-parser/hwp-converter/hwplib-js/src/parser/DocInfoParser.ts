/**
 * HWP DocInfo 파서
 * DocInfo 스트림에서 문자/문단 서식, 글꼴, 스타일 등을 추출
 */

import { logger } from '../utils/Logger';
import { RECORD } from '../utils/Constants';
import {
  DocInfo,
  FaceName,
  BorderFill,
  Border,
  CharShape,
  CharShapeAttribute,
  ParaShape,
  Style,
  TabDef,
  Numbering,
  BinData,
  HWPTag
} from '../models/DocInfo';

export class DocInfoParser {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  /**
   * DocInfo 전체 파싱
   */
  parse(): DocInfo {
    logger.debug(`DocInfo 파싱 시작: ${this.buffer.byteLength} bytes`);

    const docInfo: DocInfo = {
      faceNames: new Map(),
      borderFills: new Map(),
      charShapes: new Map(),
      paraShapes: new Map(),
      styles: new Map(),
      tabDefs: new Map(),
      numberings: new Map(),
      binDataList: new Map()
    };

    while (this.offset < this.buffer.byteLength - 4) {
      try {
        const header = this.view.getUint32(this.offset, true);
        this.offset += 4;

        const tagId = header & RECORD.TAG_MASK;
        const level = (header >> RECORD.LEVEL_SHIFT) & RECORD.LEVEL_MASK;
        let recordSize = (header >> RECORD.SIZE_SHIFT) & RECORD.SIZE_MASK;

        if (recordSize === RECORD.EXTENDED_SIZE_THRESHOLD) {
          if (this.offset + 4 > this.buffer.byteLength) break;
          recordSize = this.view.getUint32(this.offset, true);
          this.offset += 4;
        }

        // 디버깅: 태그 순회 로그
        console.log(`[DocInfoLoop] Offset=${this.offset}, Tag=${tagId}, Size=${recordSize}`);

        if (this.offset + recordSize > this.buffer.byteLength) {
          logger.warn(`레코드 범위 초과: tagId=${tagId}, size=${recordSize}`);
          break;
        }

        const recordData = new Uint8Array(this.buffer, this.offset, recordSize);

        switch (tagId) {
          case HWPTag.HWPTAG_FACE_NAME:
          case HWPTag.HWPTAG_FACE_NAME_OLD:
            this.parseFaceName(recordData, docInfo);
            break;
          case HWPTag.HWPTAG_BORDER_FILL:
          case HWPTag.HWPTAG_BORDER_FILL_OLD:
            this.parseBorderFill(recordData, docInfo);
            break;
          case HWPTag.HWPTAG_CHAR_SHAPE:
          case HWPTag.HWPTAG_CHAR_SHAPE_OLD:
            this.parseCharShape(recordData, docInfo);
            break;
          case HWPTag.HWPTAG_PARA_SHAPE:
          case HWPTag.HWPTAG_PARA_SHAPE_OLD:
            this.parseParaShape(recordData, docInfo);
            break;
          case HWPTag.HWPTAG_STYLE:
          case HWPTag.HWPTAG_STYLE_OLD:
            this.parseStyle(recordData, docInfo);
            break;
          case HWPTag.HWPTAG_TAB_DEF:
          case HWPTag.HWPTAG_TAB_DEF_OLD:
            this.parseTabDef(recordData, docInfo);
            break;
          case HWPTag.HWPTAG_NUMBERING:
          case HWPTag.HWPTAG_NUMBERING_OLD:
            this.parseNumbering(recordData, docInfo);
            break;
          case HWPTag.HWPTAG_BIN_DATA:
          case 18:
            this.parseBinData(recordData, docInfo);
            break;
        }

        this.offset += recordSize;

      } catch (error) {
        logger.error(`DocInfo 레코드 파싱 오류 at offset ${this.offset}:`, error);
        break;
      }
    }

    logger.debug(`DocInfo 파싱 완료: FaceNames=${docInfo.faceNames.size}, CharShapes=${docInfo.charShapes.size}, ParaShapes=${docInfo.paraShapes.size}`);

    return docInfo;
  }

  /**
   * 글꼴 이름 파싱
   */
  private parseFaceName(data: Uint8Array, docInfo: DocInfo): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const faceName: FaceName = {
      id: docInfo.faceNames.size,
      name: '',
      fontType: 0,
      isEmbedded: false
    };

    const attribute = view.getUint8(offset);
    faceName.fontType = attribute & 0x07;
    faceName.isEmbedded = (attribute & 0x80) !== 0;
    offset += 1;

    const nameLen = view.getUint16(offset, true);
    offset += 2;

    if (nameLen > 0 && offset + nameLen * 2 <= data.length) {
      const nameBytes = new Uint8Array(data.buffer, data.byteOffset + offset, nameLen * 2);
      faceName.name = new TextDecoder('utf-16le').decode(nameBytes);
      // null 문자 제거
      faceName.name = faceName.name.replace(/\0/g, '');
      offset += nameLen * 2;
    }

    // 디버깅: 파싱된 폰트 이름 출력
    console.log(`[FaceName] ID=${faceName.id}, Name=${faceName.name}`);

    if (offset + 2 <= data.length) {
      const altNameLen = view.getUint16(offset, true);
      offset += 2;
      if (altNameLen > 0 && offset + altNameLen * 2 <= data.length) {
        const altNameBytes = new Uint8Array(data.buffer, data.byteOffset + offset, altNameLen * 2);
        faceName.altName = new TextDecoder('utf-16le').decode(altNameBytes);
        offset += altNameLen * 2;
      }
    }

    if (offset + 10 <= data.length) {
      faceName.panose = Array.from(new Uint8Array(data.buffer, data.byteOffset + offset, 10));
    }

    docInfo.faceNames.set(faceName.id, faceName);
    logger.trace(`FaceName[${faceName.id}]: "${faceName.name}"`);
  }

  /**
   * 테두리/배경 파싱 (HWP 5.0 구조)
   * 구조: 속성(2) + 테두리종류(4) + 테두리굵기(4) + 테두리색상(16) + 대각선(6) + 채우기
   */
  private parseBorderFill(data: Uint8Array, docInfo: DocInfo): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const borderFill: BorderFill = {
      id: docInfo.borderFills.size + 1,
      flags: data.length >= 2 ? view.getUint16(offset, true) : 0,
      leftBorder: { type: 0, width: 0, color: 0 },
      rightBorder: { type: 0, width: 0, color: 0 },
      topBorder: { type: 0, width: 0, color: 0 },
      bottomBorder: { type: 0, width: 0, color: 0 },
      diagonal: { type: 0, width: 0, color: 0 }
    };
    offset += 2;

    // 4방향 테두리선 종류 (UINT8 x 4)
    if (offset + 4 <= data.length) {
      borderFill.leftBorder.type = view.getUint8(offset);
      borderFill.rightBorder.type = view.getUint8(offset + 1);
      borderFill.topBorder.type = view.getUint8(offset + 2);
      borderFill.bottomBorder.type = view.getUint8(offset + 3);
      offset += 4;
    }

    // 4방향 테두리선 굵기 (UINT8 x 4)
    if (offset + 4 <= data.length) {
      borderFill.leftBorder.width = view.getUint8(offset);
      borderFill.rightBorder.width = view.getUint8(offset + 1);
      borderFill.topBorder.width = view.getUint8(offset + 2);
      borderFill.bottomBorder.width = view.getUint8(offset + 3);
      offset += 4;
    }

    // 4방향 테두리선 색상 (COLORREF x 4 = UINT32 x 4)
    if (offset + 16 <= data.length) {
      borderFill.leftBorder.color = view.getUint32(offset, true) & 0xFFFFFF;
      borderFill.rightBorder.color = view.getUint32(offset + 4, true) & 0xFFFFFF;
      borderFill.topBorder.color = view.getUint32(offset + 8, true) & 0xFFFFFF;
      borderFill.bottomBorder.color = view.getUint32(offset + 12, true) & 0xFFFFFF;
      offset += 16;
    }

    // 대각선 종류, 굵기, 색상
    if (offset + 6 <= data.length) {
      borderFill.diagonal.type = view.getUint8(offset);
      borderFill.diagonal.width = view.getUint8(offset + 1);
      borderFill.diagonal.color = view.getUint32(offset + 2, true) & 0xFFFFFF;
      offset += 6;
    }

    // 채우기 정보
    if (offset + 4 <= data.length) {
      const fillType = view.getUint32(offset, true);
      offset += 4;

      borderFill.fillBrush = {
        type: fillType,
        faceColor: 0
      };

      // faceColor (배경색)
      if (offset + 4 <= data.length) {
        borderFill.fillBrush.faceColor = view.getUint32(offset, true) & 0xFFFFFF;
      }
    }

    docInfo.borderFills.set(borderFill.id, borderFill);
  }


  /**
   * 문자 서식 파싱
   */
  private parseCharShape(data: Uint8Array, docInfo: DocInfo): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const charShape: CharShape = {
      id: docInfo.charShapes.size,
      fontIDs: { hangul: 0, latin: 0, hanja: 0, japanese: 0, other: 0, symbol: 0, user: 0 },
      fontSizes: { hangul: 1000, latin: 1000, hanja: 1000, japanese: 1000, other: 1000, symbol: 1000, user: 1000 },
      attribute: 0,
      textColor: 0x000000,
      shadeColor: 0xFFFFFF,
      ratios: { hangul: 100, latin: 100, hanja: 100, japanese: 100, other: 100, symbol: 100, user: 100 },
      spacing: { hangul: 0, latin: 0, hanja: 0, japanese: 0, other: 0, symbol: 0, user: 0 },
      relSizes: { hangul: 100, latin: 100, hanja: 100, japanese: 100, other: 100, symbol: 100, user: 100 },
      offsets: { hangul: 0, latin: 0, hanja: 0, japanese: 0, other: 0, symbol: 0, user: 0 },
      useFontSpace: false,
      useKerning: false,
      symMark: 0,
      borderFillID: 0,
      underlineType: 0,
      underlineShape: 0,
      underlineColor: 0x000000,
      strikeoutType: 0,
      strikeoutColor: 0x000000,
      outlineType: 0,
      shadowType: 0,
      shadowColor: 0xC0C0C0,
      shadowOffsetX: 10,
      shadowOffsetY: 10
    };

    // 글꼴 ID (7개)
    if (offset + 14 <= data.length) {
      const keys = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'] as const;
      for (const key of keys) {
        charShape.fontIDs[key] = view.getUint16(offset, true);
        offset += 2;
      }
    }

    // 장평 (7개)
    if (offset + 7 <= data.length) {
      const keys = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'] as const;
      for (const key of keys) {
        charShape.ratios[key] = view.getUint8(offset);
        offset += 1;
      }
    }

    // 자간 (7개)
    if (offset + 7 <= data.length) {
      const keys = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'] as const;
      for (const key of keys) {
        charShape.spacing[key] = view.getInt8(offset);
        offset += 1;
      }
    }

    // 상대 크기 (7개)
    if (offset + 7 <= data.length) {
      const keys = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'] as const;
      for (const key of keys) {
        charShape.relSizes[key] = view.getUint8(offset);
        offset += 1;
      }
    }

    // 위치 (7개)
    if (offset + 7 <= data.length) {
      const keys = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'] as const;
      for (const key of keys) {
        charShape.offsets[key] = view.getInt8(offset);
        offset += 1;
      }
    }

    // 글자 크기 파싱 (버전에 따라 다름)
    // 구버전(74 bytes): 기본 크기 1개 (4 bytes)
    // 신버전(더 큼): 7개 * 4 bytes = 28 bytes
    const remainingBeforeFontSize = data.length - offset;

    if (remainingBeforeFontSize >= 28 + 4 + 8 + 8) {
      // 신버전: 7개 글자 크기
      const keys = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'] as const;
      for (const key of keys) {
        charShape.fontSizes[key] = view.getInt32(offset, true);
        offset += 4;
      }
    } else if (remainingBeforeFontSize >= 4) {
      // 구버전: 1개 기본 크기 (모든 폰트 타입에 적용)
      const baseSize = view.getInt32(offset, true);
      offset += 4;
      charShape.fontSizes = {
        hangul: baseSize, latin: baseSize, hanja: baseSize,
        japanese: baseSize, other: baseSize, symbol: baseSize, user: baseSize
      };
    }

    // 속성
    if (offset + 4 <= data.length) {
      charShape.attribute = view.getUint32(offset, true);
      offset += 4;
    }

    // 구버전(74바이트): shadeColor/textColor 위치에 다른 데이터 있음
    // 신버전(100+바이트): 실제 shadeColor/textColor 존재
    const isLegacyFormat = data.length <= 80;

    if (isLegacyFormat) {
      // 구버전: 기본값 사용 (shadeColor=none, textColor=black)
      charShape.shadeColor = 0xFFFFFFFF; // none의 의미
      charShape.textColor = 0x000000;
      // 구버전에서 나머지 데이터는 스킵 (밑줄/취소선 정보가 다른 형식)
    } else {
      // 신버전: 실제 색상 파싱
      if (offset + 4 <= data.length) {
        charShape.shadeColor = view.getUint32(offset, true);
        offset += 4;
      }
      if (offset + 4 <= data.length) {
        charShape.textColor = view.getUint32(offset, true) & 0xFFFFFF;
        offset += 4;
      }

      // 밑줄
      if (offset + 8 <= data.length) {
        charShape.underlineType = view.getUint8(offset);
        charShape.underlineShape = view.getUint8(offset + 1);
        charShape.underlineColor = view.getUint32(offset + 4, true) & 0xFFFFFF;
        offset += 8;
      }
    }



    // 취소선
    if (offset + 5 <= data.length) {
      charShape.strikeoutType = view.getUint8(offset);
      charShape.strikeoutColor = view.getUint32(offset + 1, true) & 0xFFFFFF;
      offset += 5;
    }

    // 외곽선
    if (offset + 1 <= data.length) {
      charShape.outlineType = view.getUint8(offset);
      offset += 1;
    }

    // 그림자
    if (offset + 9 <= data.length) {
      charShape.shadowType = view.getUint8(offset);
      charShape.shadowColor = view.getUint32(offset + 1, true) & 0xFFFFFF;
      charShape.shadowOffsetX = view.getInt16(offset + 5, true);
      charShape.shadowOffsetY = view.getInt16(offset + 7, true);
    }

    docInfo.charShapes.set(charShape.id, charShape);
    logger.trace(`CharShape[${charShape.id}]: size=${charShape.fontSizes.hangul}, color=#${charShape.textColor.toString(16).padStart(6, '0')}`);
  }

  /**
   * 문단 서식 파싱
   */
  private parseParaShape(data: Uint8Array, docInfo: DocInfo): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const paraShape: ParaShape = {
      id: docInfo.paraShapes.size,
      align: 0,
      indent: 0,
      leftMargin: 0,
      rightMargin: 0,
      prevSpacing: 0,
      nextSpacing: 0,
      lineSpacing: 160,
      lineSpacingType: 0,
      tabDefID: 0,
      numberingID: 0,
      bulletID: 0,
      borderFillID: 0,
      borderLeft: 0,
      borderRight: 0,
      borderTop: 0,
      borderBottom: 0,
      condense: 0,
      fontLineHeight: false,
      snapToGrid: true,
      suppressLineNumbers: false,
      breakLatinWord: 0,
      breakNonLatinWord: 1,
      widowOrphan: false,
      keepWithNext: false,
      keepLines: false,
      pageBreakBefore: false,
      lineWrap: 0,
      autoSpaceEAsianEng: false,
      autoSpaceEAsianNum: false
    };

    if (offset + 4 <= data.length) {
      const attribute = view.getUint32(offset, true);
      // align은 bits 0-2 (3비트)
      paraShape.align = attribute & 0x07;
      paraShape.fontLineHeight = (attribute & 0x08) !== 0;
      paraShape.snapToGrid = (attribute & 0x10) !== 0;
      paraShape.suppressLineNumbers = (attribute & 0x20) !== 0;
      paraShape.breakLatinWord = (attribute >> 6) & 0x03;
      paraShape.breakNonLatinWord = (attribute >> 8) & 0x03;
      paraShape.widowOrphan = (attribute & 0x400) !== 0;
      paraShape.keepWithNext = (attribute & 0x800) !== 0;
      paraShape.keepLines = (attribute & 0x1000) !== 0;
      paraShape.pageBreakBefore = (attribute & 0x2000) !== 0;
      paraShape.lineWrap = (attribute >> 14) & 0x03;
      paraShape.autoSpaceEAsianEng = (attribute & 0x10000) !== 0;
      paraShape.autoSpaceEAsianNum = (attribute & 0x20000) !== 0;
      offset += 4;
    }

    if (offset + 8 <= data.length) {
      paraShape.leftMargin = view.getInt32(offset, true);
      paraShape.rightMargin = view.getInt32(offset + 4, true);
      offset += 8;
    }

    if (offset + 4 <= data.length) {
      paraShape.indent = view.getInt32(offset, true);
      offset += 4;
    }

    if (offset + 8 <= data.length) {
      paraShape.prevSpacing = view.getInt32(offset, true);
      paraShape.nextSpacing = view.getInt32(offset + 4, true);
      offset += 8;
    }

    if (offset + 4 <= data.length) {
      paraShape.lineSpacing = view.getInt32(offset, true);
      offset += 4;
    }

    if (offset + 2 <= data.length) {
      paraShape.tabDefID = view.getUint16(offset, true);
      offset += 2;
    }

    if (offset + 2 <= data.length) {
      paraShape.numberingID = view.getUint16(offset, true);
      offset += 2;
    }

    if (offset + 2 <= data.length) {
      paraShape.borderFillID = view.getUint16(offset, true);
      offset += 2;
    }

    if (offset + 8 <= data.length) {
      paraShape.borderLeft = view.getInt16(offset, true);
      paraShape.borderRight = view.getInt16(offset + 2, true);
      paraShape.borderTop = view.getInt16(offset + 4, true);
      paraShape.borderBottom = view.getInt16(offset + 6, true);
    }

    docInfo.paraShapes.set(paraShape.id, paraShape);
    logger.trace(`ParaShape[${paraShape.id}]: align=${paraShape.align}, indent=${paraShape.indent}`);
  }

  /**
   * 스타일 파싱
   */
  private parseStyle(data: Uint8Array, docInfo: DocInfo): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const style: Style = {
      id: docInfo.styles.size,
      name: '',
      engName: '',
      type: 0,
      nextStyleID: 0,
      langID: 1042,
      paraPrID: 0,
      charPrID: 0,
      lockForm: false
    };

    const nameLen = view.getUint16(offset, true);
    offset += 2;
    if (nameLen > 0 && offset + nameLen * 2 <= data.length) {
      const nameBytes = new Uint8Array(data.buffer, data.byteOffset + offset, nameLen * 2);
      style.name = new TextDecoder('utf-16le').decode(nameBytes).replace(/\0/g, '');
      offset += nameLen * 2;
    }

    if (offset + 2 <= data.length) {
      const engNameLen = view.getUint16(offset, true);
      offset += 2;
      if (engNameLen > 0 && offset + engNameLen * 2 <= data.length) {
        const engNameBytes = new Uint8Array(data.buffer, data.byteOffset + offset, engNameLen * 2);
        style.engName = new TextDecoder('utf-16le').decode(engNameBytes).replace(/\0/g, '');
        offset += engNameLen * 2;
      }
    }

    if (offset + 1 <= data.length) {
      const attribute = view.getUint8(offset);
      style.type = attribute & 0x03;
      style.lockForm = (attribute & 0x04) !== 0;
      offset += 1;
    }

    if (offset + 8 <= data.length) {
      style.nextStyleID = view.getUint16(offset, true);
      style.langID = view.getUint16(offset + 2, true);
      style.paraPrID = view.getUint16(offset + 4, true);
      style.charPrID = view.getUint16(offset + 6, true);
    }

    docInfo.styles.set(style.id, style);
    logger.trace(`Style[${style.id}]: "${style.name}"`);
  }

  /**
   * 탭 정의 파싱
   */
  private parseTabDef(data: Uint8Array, docInfo: DocInfo): void {
    const tabDef: TabDef = {
      id: docInfo.tabDefs.size,
      autoTabLeft: false,
      autoTabRight: false,
      tabs: []
    };

    docInfo.tabDefs.set(tabDef.id, tabDef);
  }

  /**
   * 번호 매기기 파싱
   */
  private parseNumbering(data: Uint8Array, docInfo: DocInfo): void {
    const numbering: Numbering = {
      id: docInfo.numberings.size + 1,
      start: 0,
      levels: []
    };

    docInfo.numberings.set(numbering.id, numbering);
  }

  /**
   * 이진 데이터 파싱
   */
  private parseBinData(data: Uint8Array, docInfo: DocInfo): void {
    const binData: BinData = {
      id: docInfo.binDataList.size + 1,
      type: 0,
      format: '',
      data: new Uint8Array(0)
    };

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    if (offset + 2 <= data.length) {
      const attribute = view.getUint16(offset, true);
      binData.type = attribute & 0x0F;
      binData.compression = (attribute >> 4) & 0x03;
      offset += 2;
    }

    if (binData.type === 1 || binData.type === 2) {
      if (offset + 4 <= data.length) { // ID(2) + Length(2)
        const binID = view.getUint16(offset, true);
        offset += 2;
        const extLen = view.getUint16(offset, true);
        offset += 2;

        if (extLen > 0 && offset + extLen * 2 <= data.length) {
          const extBytes = new Uint8Array(data.buffer, data.byteOffset + offset, extLen * 2);
          const extension = new TextDecoder('utf-16le').decode(extBytes).replace(/\0/g, '').toLowerCase();

          // 디버깅: Extension Hex 확인 (수정 후)
          // const hex = Array.from(extBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
          // console.log(`[BinData] ID=${binData.id} (BinID=${binID}), Len=${extLen}, Ext="${extension}"`);

          binData.extension = extension;
          binData.format = extension.toUpperCase();
          offset += extLen * 2;
        }
      }
    }

    docInfo.binDataList.set(binData.id, binData);
    logger.trace(`BinData[${binData.id}]: type=${binData.type}, ext=${binData.extension || '(none)'}`);
  }
}
