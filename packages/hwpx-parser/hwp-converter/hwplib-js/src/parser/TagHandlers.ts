/**
 * HWP 레코드 태그 핸들러
 * HWPTextExtractor의 500줄 루프를 분리한 모듈
 */

import { logger } from '../utils/Logger';
import { HWPTAG, RECORD, LIST_HEADER, ctrlIdToString, CTRL_ID } from '../utils/Constants';
import type { Table } from '../models/Table';
import type { Picture } from '../models/Picture';
import type { Shape } from '../models/Shape';
import type { Equation } from '../models/Equation';
import type { Chart } from '../models/Chart';

// ============================================================================
// 인터페이스 정의
// ============================================================================

export interface PageDef {
  width: number;
  height: number;
  leftMargin: number;
  rightMargin: number;
  topMargin: number;
  bottomMargin: number;
  headerMargin: number;
  footerMargin: number;
  gutterMargin: number;
  property: number;
  landscape: boolean;  // true = WIDELY (가로), false = NARROWLY (세로)
}

export interface ColumnDef {
  id: number;
  property: number;
  columnCount: number;
  sameWidth: boolean;
  gap: number;
  widthList?: number[];
  gapList?: number[];
}

export interface HeaderFooter {
  type: 'HEADER' | 'FOOTER';
  index: number;
  applyPage: number;
  paragraphs: HWPParagraph[];
  style?: PageDef;
  tables?: Table[];
  pictures?: Picture[];
  shapes?: Shape[];
  equations?: Equation[];
}

export interface HWPParagraph {
  text: string;
  charShapeID?: number;
  paraShapeID?: number;
  styleID?: number;
  pageBreak?: boolean;
  columnBreak?: boolean;
  controls?: ControlItem[];
  runs?: TextRun[];
}

export interface TextRun {
  text: string;
  charShapeID: number;
  start: number;
  length: number;
}

export interface ControlItem {
  type: string;
  obj?: unknown;
  property?: number;
}

export interface CharShapeChange {
  pos: number;
  id: number;
}

// ============================================================================
// 파싱 컨텍스트
// ============================================================================

export interface ParseContext {
  data: Uint8Array;
  view: DataView;
  offset: number;

  // 현재 상태
  currentPara: HWPParagraph | null;
  currentCharShapes: CharShapeChange[];

  // 결과 저장
  paragraphs: HWPParagraph[];
  tables: Table[];
  pictures: Picture[];
  shapes: Shape[];
  equations: Equation[];
  charts: Chart[];
  pageDef?: PageDef;
  columnDefs: ColumnDef[];
  headerFooters: HeaderFooter[];
  pageBorderFillID?: number;

  // 컨테이너 상태 (헤더/푸터 파싱)
  activeContainer: {
    target: HWPParagraph[];
    remaining: number;
    obj?: HeaderFooter;
  } | null;

  // 대기 중인 요소
  pendingShapeComponentOffset: number | null;
  pendingHeaderFooter: Partial<HeaderFooter> | null;

  // 텍스트 디코더
  decodeText: (data: Uint8Array) => string;
}

// ============================================================================
// 레코드 헤더 파싱
// ============================================================================

export interface RecordHeader {
  tagId: number;
  level: number;
  size: number;
  totalHeaderSize: number;
}

export function parseRecordHeader(view: DataView, offset: number, dataLength: number): RecordHeader | null {
  if (offset + RECORD.HEADER_SIZE > dataLength) return null;

  const header = view.getUint32(offset, true);
  const tagId = header & RECORD.TAG_MASK;
  const level = (header >> RECORD.LEVEL_SHIFT) & RECORD.LEVEL_MASK;
  let size = (header >> RECORD.SIZE_SHIFT) & RECORD.SIZE_MASK;
  let totalHeaderSize: number = RECORD.HEADER_SIZE;

  if (size === RECORD.EXTENDED_SIZE_THRESHOLD) {
    if (offset + 8 > dataLength) return null;
    size = view.getUint32(offset + 4, true);
    totalHeaderSize = 8;
  }

  return { tagId, level, size, totalHeaderSize };
}

// ============================================================================
// 문단 헤더 파싱
// ============================================================================

export function parseParaHeader(data: Uint8Array, para: HWPParagraph): void {
  if (data.length < 22) return;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 4; // 문단 개수 스킵

  const attribute = view.getUint32(offset, true);
  para.pageBreak = (attribute & (1 << 2)) !== 0;
  para.columnBreak = (attribute & (1 << 3)) !== 0;
  offset += 4;

  para.paraShapeID = view.getUint16(offset, true);
  offset += 2;

  para.styleID = view.getUint8(offset);
  offset += 2;

  para.charShapeID = view.getUint16(offset, true);

  logger.trace(`문단 헤더: CharShape=${para.charShapeID}, ParaShape=${para.paraShapeID}`);
}

// ============================================================================
// 문자 서식 변경점 파싱
// ============================================================================

export function parseCharShapeChange(data: Uint8Array, charShapes: CharShapeChange[]): void {
  if (data.length < 8) return;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint32(0, true);
  let offset = 4;

  for (let i = 0; i < count && offset + 8 <= data.length; i++) {
    charShapes.push({
      pos: view.getUint32(offset, true),
      id: view.getUint32(offset + 4, true)
    });
    offset += 8;
  }

  logger.trace(`서식 변경점: ${count}개`);
}

// ============================================================================
// 용지 설정 파싱
// ============================================================================

export interface PageDef {
  width: number;
  height: number;
  leftMargin: number;
  rightMargin: number;
  topMargin: number;
  bottomMargin: number;
  headerMargin: number;
  footerMargin: number;
  gutterMargin: number;
  property: number;
  landscape: boolean;
  paperSize: string;
}

export function parsePageDef(view: DataView, offset: number, size: number): PageDef | undefined {
  if (size < 40) return undefined;

  const property = view.getUint32(offset + 36, true);
  // HWP 표준: property 비트 0 = landscape (0=세로, 1=가로)
  const landscape = (property & 0x01) === 1;

  return {
    width: view.getUint32(offset, true),
    height: view.getUint32(offset + 4, true),
    leftMargin: view.getUint32(offset + 8, true),
    rightMargin: view.getUint32(offset + 12, true),
    topMargin: view.getUint32(offset + 16, true),
    bottomMargin: view.getUint32(offset + 20, true),
    headerMargin: view.getUint32(offset + 24, true),
    footerMargin: view.getUint32(offset + 28, true),
    gutterMargin: view.getUint32(offset + 32, true),
    property: property,
    landscape: landscape,
    paperSize: getPaperSizeName(view.getUint32(offset, true), view.getUint32(offset + 4, true))
  };
}

/**
 * 용지 크기 이름 반환
 */
export function getPaperSizeName(width: number, height: number): string {
  // 가로/세로 무관하게 긴 쪽을 height로 취급하여 비교
  const w = Math.min(width, height);
  const h = Math.max(width, height);
  const epsilon = 100; // 허용 오차

  if (Math.abs(w - 59528) < epsilon && Math.abs(h - 84189) < epsilon) return 'A4';
  if (Math.abs(w - 61200) < epsilon && Math.abs(h - 79200) < epsilon) return 'Letter';
  if (Math.abs(w - 61200) < epsilon && Math.abs(h - 100800) < epsilon) return 'Legal';
  if (Math.abs(w - 49890) < epsilon && Math.abs(h - 70866) < epsilon) return 'B5 (ISO)';
  if (Math.abs(w - 51591) < epsilon && Math.abs(h - 72852) < epsilon) return 'B5 (JIS)';
  if (Math.abs(w - 84189) < epsilon && Math.abs(h - 119055) < epsilon) return 'A3';

  return 'Custom';
}

// ============================================================================
// 컨트롤 헤더 파싱
// ============================================================================

export interface CtrlHeaderResult {
  type: 'section' | 'header' | 'footer' | 'column' | 'unknown';
  headerFooter?: Partial<HeaderFooter>;
  columnDef?: ColumnDef;
}

export function parseCtrlHeader(
  view: DataView,
  data: Uint8Array,
  offset: number,
  size: number,
  columnDefCount: number
): CtrlHeaderResult {
  const ctrlID = view.getUint32(offset, true);
  const idStr = ctrlIdToString(ctrlID);

  if (idStr === CTRL_ID.SECTION_DEF) {
    return { type: 'section' };
  }

  if (idStr === CTRL_ID.HEADER || idStr === CTRL_ID.FOOTER) {
    const type = idStr === CTRL_ID.HEADER ? 'HEADER' : 'FOOTER';
    const applyPage = view.getUint32(offset + 4, true);
    const createIndex = view.getInt32(offset + 8, true);

    return {
      type: idStr === CTRL_ID.HEADER ? 'header' : 'footer',
      headerFooter: { type, index: createIndex, applyPage }
    };
  }

  if (idStr === CTRL_ID.COLUMN_DEF) {
    const property = view.getUint16(offset + 4, true);
    const columnCount = (property >> 2) & 0xFF;
    const sameWidth = ((property >> 12) & 0x01) === 1;

    const colDef: ColumnDef = {
      id: columnDefCount,
      property,
      columnCount,
      sameWidth,
      gap: 0
    };

    let localOffset = offset + 6;

    if (columnCount < 2 || sameWidth) {
      colDef.gap = view.getUint16(localOffset, true);
    } else {
      localOffset += 2;
      const widths: number[] = [];
      const gaps: number[] = [];

      for (let i = 0; i < columnCount; i++) {
        widths.push(view.getUint16(localOffset, true));
        localOffset += 2;
        gaps.push(view.getUint16(localOffset, true));
        localOffset += 2;
      }

      colDef.widthList = widths;
      colDef.gapList = gaps;
      if (gaps.length > 0) colDef.gap = gaps[0];
    }

    logger.debug(`단 설정: ${colDef.columnCount}단, 간격 ${colDef.gap}`);
    return { type: 'column', columnDef: colDef };
  }

  return { type: 'unknown' };
}

// ============================================================================
// Run(서식 구간) 생성
// ============================================================================

export function finalizeParagraph(para: HWPParagraph, charShapes: CharShapeChange[]): void {
  if (!para.text) {
    para.runs = [];
    return;
  }

  const textLen = para.text.length;

  if (!charShapes || charShapes.length === 0) {
    para.runs = [{
      text: para.text,
      charShapeID: para.charShapeID || 0,
      start: 0,
      length: textLen
    }];
    return;
  }

  para.runs = [];

  for (let i = 0; i < charShapes.length; i++) {
    const start = charShapes[i].pos;
    const id = charShapes[i].id;
    let end = textLen;

    if (i < charShapes.length - 1) {
      end = charShapes[i + 1].pos;
    }

    const safeStart = Math.min(start, textLen);
    const safeEnd = Math.min(end, textLen);

    if (safeStart >= textLen) break;

    const runLen = safeEnd - safeStart;
    if (runLen > 0) {
      para.runs.push({
        text: para.text.substring(safeStart, safeEnd),
        charShapeID: id,
        start: safeStart,
        length: runLen
      });
    }
  }

  if (para.runs.length === 0) {
    para.runs = [{
      text: para.text,
      charShapeID: para.charShapeID || 0,
      start: 0,
      length: textLen
    }];
  }
}

// ============================================================================
// 텍스트 디코더
// ============================================================================

export function decodeHWPText(data: Uint8Array): string {
  try {
    const filtered: number[] = [];
    let i = 0;

    while (i < data.length - 1) {
      const charCode = data[i] | (data[i + 1] << 8);

      // 인라인 객체 스킵 (0x0002-0x001F, LF/CR/VT 제외)
      if (charCode >= 0x0002 && charCode <= 0x001F &&
        charCode !== 0x000A && charCode !== 0x000D && charCode !== 0x000B) {
        i += 2;

        while (i < data.length - 1) {
          const byte1 = data[i];
          const byte2 = data[i + 1];

          if (byte2 === 0x00 && byte1 >= 0x20) break;

          const nextChar = byte1 | (byte2 << 8);
          if (nextChar === 0x0000 || (nextChar >= 0x0002 && nextChar <= 0x001F)) {
            while (i < data.length - 1 && (data[i] | (data[i + 1] << 8)) === 0x0000) {
              i += 2;
            }
            break;
          }

          i += 2;
        }
        continue;
      }

      if (charCode === 0x0000) {
        i += 2;
        continue;
      }

      if (charCode === 0x000A || charCode === 0x000D) {
        filtered.push(data[i], data[i + 1]);
        i += 2;
        continue;
      }

      if (charCode >= 0x0020) {
        filtered.push(data[i], data[i + 1]);
      }

      i += 2;
    }

    const cleanData = new Uint8Array(filtered);
    const decoder = new TextDecoder('utf-16le');
    let text = decoder.decode(cleanData);

    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return text;
  } catch (error) {
    logger.error('텍스트 디코딩 실패');
    return '';
  }
}
