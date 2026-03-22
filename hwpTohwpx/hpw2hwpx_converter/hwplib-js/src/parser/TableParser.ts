/**
 * TableParser.ts (Enhanced for 100% extraction)
 * HWP 파일에서 테이블 구조 파싱 - 병합 셀 및 다중 문단 완벽 지원
 */

import { logger } from '../utils/Logger';
import { HWPTAG, LIST_HEADER, TABLE_RECORD, RECORD } from '../utils/Constants';
import { decodeHWPText } from './TagHandlers';
import { Table, TableRow, TableCell, CellParagraph } from '../models/Table';

export class TableParser {
  private view: DataView;
  private data: Uint8Array;
  private offset: number;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.offset = 0;
  }

  public getOffset(): number {
    return this.offset;
  }

  /**
   * 테이블 파싱 (개선된 버전 - 100% 추출)
   * - 병합 셀 완벽 지원
   * - 다중 문단 지원
   * - 정확한 셀 경계 감지 (LIST_HEADER 기반)
   */
  parseTable(startOffset: number): Table | null {
    this.offset = startOffset;

    try {
      const header = this.view.getUint32(this.offset, true);
      this.offset += 4;

      const tagId = header & RECORD.TAG_MASK;
      let size = (header >> RECORD.SIZE_SHIFT) & RECORD.SIZE_MASK;

      if (size === RECORD.EXTENDED_SIZE_THRESHOLD) {
        size = this.view.getUint32(this.offset, true);
        this.offset += 4;
      }

      if (tagId !== HWPTAG.TABLE) {
        return null;
      }

      logger.debug('TABLE 파싱 시작 (Enhanced 100%)');

      const tableView = new DataView(this.data.buffer, this.data.byteOffset + this.offset, size);

      const flags = tableView.getUint32(TABLE_RECORD.FLAGS, true);
      const rowCount = tableView.getUint16(TABLE_RECORD.ROW_COUNT, true);
      const colCount = tableView.getUint16(TABLE_RECORD.COL_COUNT, true);
      const rowSpacing = tableView.getUint16(TABLE_RECORD.ROW_SPACING, true);
      const colSpacing = tableView.getUint16(TABLE_RECORD.COL_SPACING, true);
      const borderFillIDRef = size >= TABLE_RECORD.MIN_SIZE ? tableView.getUint16(TABLE_RECORD.BORDER_FILL_ID, true) : 1;

      const repeatHeader = (flags & 0x01) !== 0;
      const noAdjust = (flags & 0x02) !== 0;
      const pageBreak = (flags >> 2) & 0x03;

      // 병합 셀의 경우 실제 셀 수는 rowCount * colCount보다 적을 수 있음
      // LIST_HEADER 개수로 실제 셀 수를 세므로 상한값으로만 사용
      const maxCellCount = rowCount * colCount;

      logger.debug(`테이블: ${rowCount}행 x ${colCount}열 (최대 ${maxCellCount}개 셀)`);

      const table: Table = {
        id: 0,
        rowCnt: rowCount,
        colCnt: colCount,
        cellSpacing: rowSpacing + colSpacing,
        borderFillIDRef: borderFillIDRef,
        pageBreak: pageBreak,
        repeatHeader: repeatHeader,
        noAdjust: noAdjust,
        inMarginLeft: 0,
        inMarginRight: 0,
        inMarginTop: 0,
        inMarginBottom: 0,
        rows: []
      };

      this.offset += size;

      // 개선된 셀 파싱 - LIST_HEADER 태그 기반
      const cells: TableCell[] = [];
      let currentCell: TableCell | null = null;
      let currentParagraphs: CellParagraph[] = [];
      let currentParagraphText = '';
      let currentParaShapeID = 1;  // 현재 문단의 ParaShapeID
      let currentCharShapeID = 1;  // 현재 문단의 CharShapeID
      let inCell = false;
      const tableStartOffset = this.offset;
      const tableLevel = 1; // 테이블의 레코드 레벨

      // 테이블 끝까지 파싱 (레벨 1 미만 레코드 또는 데이터 끝까지)
      while (this.offset < this.data.byteLength - 4) {
        const recordHeader = this.view.getUint32(this.offset, true);
        const recordOffset = this.offset;
        this.offset += 4;

        const recordTagId = recordHeader & RECORD.TAG_MASK;
        const recordLevel = (recordHeader >> RECORD.LEVEL_SHIFT) & RECORD.LEVEL_MASK;
        let recordSize = (recordHeader >> RECORD.SIZE_SHIFT) & RECORD.SIZE_MASK;

        if (recordSize === RECORD.EXTENDED_SIZE_THRESHOLD) {
          recordSize = this.view.getUint32(this.offset, true);
          this.offset += 4;
        }

        if (this.offset + recordSize > this.data.byteLength) break;

        // 테이블 종료 조건: 레벨 1 미만의 레코드 (테이블 외부)
        if (recordLevel < tableLevel) {
          // 현재 셀 저장
          this.finalizeCell(currentCell, currentParagraphs, currentParagraphText, cells);
          // 오프셋을 레코드 시작으로 되돌림 (다음 파서가 사용할 수 있도록)
          this.offset = recordOffset;
          break;
        }

        // LIST_HEADER (레벨 2): 새 셀 시작
        if (recordTagId === HWPTAG.LIST_HEADER && recordLevel === 2) {
          // 이전 셀 저장
          if (inCell && currentCell) {
            this.finalizeCell(currentCell, currentParagraphs, currentParagraphText, cells);
          }

          // 새 셀 시작
          currentCell = this.parseCellMetadata(this.offset, recordSize, cells.length);
          currentParagraphs = [];
          currentParagraphText = '';
          inCell = true;

          this.offset += recordSize;
          continue;
        }

        // PARA_HEADER: 새 문단 시작 (셀 내부)
        if (recordTagId === HWPTAG.PARA_HEADER && inCell) {
          // 현재 문단 저장 (텍스트가 있으면)
          if (currentParagraphText.trim()) {
            currentParagraphs.push({
              text: currentParagraphText.trim(),
              paraShapeID: currentParaShapeID,
              charShapeID: currentCharShapeID
            });
            currentParagraphText = '';
          }

          // PARA_HEADER에서 paraShapeID, charShapeID 파싱
          // PARA_HEADER 구조: nCharCnt(4) + ControlMask(4) + ParaShapeID(2) + ParaStyleID(1) + padding(1) + breakSetting(4) + CharShapeID(2) + ...
          if (recordSize >= 18) {
            const paraView = new DataView(this.data.buffer, this.data.byteOffset + this.offset, recordSize);
            currentParaShapeID = paraView.getUint16(8, true); // offset 8-9: ParaShapeID
            currentCharShapeID = paraView.getUint16(16, true); // offset 16-17: CharShapeID
          } else if (recordSize >= 10) {
            const paraView = new DataView(this.data.buffer, this.data.byteOffset + this.offset, recordSize);
            currentParaShapeID = paraView.getUint16(8, true);
            currentCharShapeID = 1; // 기본값
          } else {
            currentParaShapeID = 1;
            currentCharShapeID = 1;
          }

          this.offset += recordSize;
          continue;
        }

        // PARA_TEXT: 문단 텍스트 (셀 내부)
        if (recordTagId === HWPTAG.PARA_TEXT && inCell) {
          const textData = this.data.slice(this.offset, this.offset + recordSize);
          const text = decodeHWPText(textData);
          currentParagraphText += text;
          this.offset += recordSize;
          continue;
        }

        // 레벨 1 레코드 (테이블 내부지만 셀 외부) - 셀 완료 처리
        if (recordLevel === 1 && inCell) {
          this.finalizeCell(currentCell, currentParagraphs, currentParagraphText, cells, currentParaShapeID, currentCharShapeID);
          currentCell = null;
          currentParagraphs = [];
          currentParagraphText = '';
          inCell = false;
        }

        // 기타 레코드 스킵
        this.offset += recordSize;
      }

      // 마지막 셀 저장
      if (inCell && currentCell) {
        this.finalizeCell(currentCell, currentParagraphs, currentParagraphText, cells);
      }

      logger.debug(`${cells.length}개 셀 파싱 완료 (병합 셀 포함)`);

      // 행/열 구조 재구성
      const rows = this.buildTableRows(cells);
      table.rows = rows;

      // 실제 발견된 열 수로 colCnt 업데이트
      if (rows.length > 0 && cells.length > 0) {
        const maxCol = Math.max(...cells.map(c => c.colAddr + (c.colSpan || 1)));
        if (maxCol > table.colCnt) {
          table.colCnt = maxCol;
        }
      }

      return table;

    } catch (error) {
      logger.error('테이블 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 현재 셀 완료 및 저장
   */
  private finalizeCell(
    cell: TableCell | null,
    paragraphs: CellParagraph[],
    lastText: string,
    cells: TableCell[],
    paraShapeID: number = 1,
    charShapeID: number = 1
  ): void {
    if (!cell) return;

    // 마지막 문단 텍스트 추가
    if (lastText.trim()) {
      paragraphs.push({
        text: lastText.trim(),
        paraShapeID: paraShapeID,
        charShapeID: charShapeID
      });
    }

    // 문단이 없으면 빈 문단 추가
    if (paragraphs.length === 0) {
      paragraphs.push({
        text: '',
        paraShapeID: paraShapeID,
        charShapeID: charShapeID
      });
    }

    cell.paragraphs = [...paragraphs];
    cells.push(cell);

    const firstText = paragraphs[0]?.text || '';
    const displayText = firstText.length > 30 ? firstText.substring(0, 30) + '...' : firstText;
    logger.trace(`셀 [${cell.rowAddr},${cell.colAddr}]: "${displayText}" (${paragraphs.length}개 문단)`);
  }

  /**
   * 셀 목록을 행 구조로 재구성
   */
  private buildTableRows(cells: TableCell[]): TableRow[] {
    const rowMap = new Map<number, TableCell[]>();

    cells.forEach(cell => {
      if (!rowMap.has(cell.rowAddr)) {
        rowMap.set(cell.rowAddr, []);
      }
      rowMap.get(cell.rowAddr)!.push(cell);
    });

    const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
    const rows: TableRow[] = [];

    sortedRowIndices.forEach(rIdx => {
      const rowCells = rowMap.get(rIdx)!.sort((a, b) => a.colAddr - b.colAddr);
      rows.push({ index: rIdx, cells: rowCells });
    });

    return rows;
  }

  /**
   * 셀 메타데이터 파싱
   */
  private parseCellMetadata(startOffset: number, size: number, cellIndex: number): TableCell | null {
    try {
      const listView = new DataView(this.data.buffer, this.data.byteOffset + startOffset, size);

      const attributes = listView.getUint32(LIST_HEADER.ATTRIBUTES, true);
      const textDirection = (attributes >> 4) & 0x03;
      const lineWrap = (attributes >> 6) & 0x03;
      const vertAlign = (attributes >> 8) & 0x03;

      const colAddr = listView.getUint16(LIST_HEADER.COL_ADDR, true);
      const rowAddr = listView.getUint16(LIST_HEADER.ROW_ADDR, true);
      const colSpan = listView.getUint16(LIST_HEADER.COL_SPAN, true);
      const rowSpan = listView.getUint16(LIST_HEADER.ROW_SPAN, true);
      const width = listView.getUint32(LIST_HEADER.WIDTH, true);
      const height = listView.getUint32(LIST_HEADER.HEIGHT, true);
      const marginLeft = listView.getUint16(LIST_HEADER.MARGIN_LEFT, true);
      const marginRight = listView.getUint16(LIST_HEADER.MARGIN_RIGHT, true);
      const marginTop = listView.getUint16(LIST_HEADER.MARGIN_TOP, true);
      const marginBottom = listView.getUint16(LIST_HEADER.MARGIN_BOTTOM, true);
      const borderFillIDRef = size >= LIST_HEADER.MIN_SIZE ? listView.getUint16(LIST_HEADER.BORDER_FILL_ID, true) : 1;

      const cell: TableCell = {
        id: cellIndex,
        colAddr,
        rowAddr,
        colSpan: colSpan || 1,
        rowSpan: rowSpan || 1,
        width,
        height,
        marginLeft,
        marginRight,
        marginTop,
        marginBottom,
        borderFillIDRef,
        textDirection,
        lineWrap,
        vertAlign,
        header: false,
        hasMargin: marginLeft > 0 || marginRight > 0 || marginTop > 0 || marginBottom > 0,
        protect: false,
        editable: true,
        paragraphs: []
      };

      return cell;

    } catch (error) {
      logger.error('셀 파싱 오류:', error);
      return null;
    }
  }
}
