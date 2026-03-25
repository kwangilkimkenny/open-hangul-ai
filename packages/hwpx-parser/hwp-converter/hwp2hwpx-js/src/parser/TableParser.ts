/**
 * TableParser - HWP 테이블 파서
 *
 * 테이블 구조:
 * - CTRL_HEADER (ctrlId='tbl '): 테이블 컨트롤 헤더
 * - TABLE (TagID 77): 테이블 메타데이터
 * - LIST_HEADER (TagID 72): 셀 리스트 헤더
 * - PARA_HEADER... : 셀 내부 문단들
 */

import { RecordDataReader, type RecordNode } from './RecordParser';
import { ParagraphParser } from './ParagraphParser';
import {
    HWP_TAG_ID,
    type EnhancedParagraph
} from '../adapters/IHwpParser';

/**
 * 테이블 데이터
 */
export interface ParsedTable {
    /** 테이블 ID */
    id?: number;

    /** 테이블 너비 (HWPUNIT) */
    width: number;

    /** 테이블 높이 (HWPUNIT) */
    height: number;

    /** 행 개수 */
    rowCount: number;

    /** 열 개수 */
    colCount: number;

    /** 셀 간격 */
    cellSpacing: number;

    /** 셀 목록 */
    cells: ParsedTableCell[];

    /** 행 높이 배열 */
    rowHeights?: number[];

    /** 열 너비 배열 */
    colWidths?: number[];

    /** 테두리/배경 ID */
    borderFillID?: number;

    /** 구역 여백 (왼쪽/오른쪽/위/아래) */
    margins?: [number, number, number, number];
}

/**
 * 테이블 셀 데이터
 */
export interface ParsedTableCell {
    /** 셀 인덱스 */
    index: number;

    /** 행 인덱스 */
    rowIndex: number;

    /** 열 인덱스 */
    colIndex: number;

    /** 행 병합 */
    rowSpan: number;

    /** 열 병합 */
    colSpan: number;

    /** 셀 너비 */
    width: number;

    /** 셀 높이 */
    height: number;

    /** 셀 내부 문단 */
    paragraphs: EnhancedParagraph[];

    /** 테두리/배경 ID */
    borderFillID?: number;

    /** 셀 여백 */
    margins?: [number, number, number, number];

    /** 셀 이름 */
    name?: string;

    /** 머리글 셀 여부 */
    header?: boolean;
}

/**
 * 테이블 파서
 */
export class TableParser {
    /**
     * 테이블 컨트롤 노드에서 테이블 파싱
     */
    static parseTable(ctrlNode: RecordNode): ParsedTable | null {
        // TABLE 레코드 찾기
        let tableRecord: RecordNode | undefined;
        const listHeaders: RecordNode[] = [];

        for (const child of ctrlNode.children) {
            if (child.record.tagId === HWP_TAG_ID.TABLE) {
                tableRecord = child;
            } else if (child.record.tagId === HWP_TAG_ID.LIST_HEADER) {
                listHeaders.push(child);
            }
        }

        if (!tableRecord) {
            console.warn('[TableParser] TABLE record not found');
            return null;
        }

        // TABLE 레코드 파싱
        const tableData = TableParser.parseTableRecord(tableRecord.record.data);

        // 셀 파싱
        const cells: ParsedTableCell[] = [];
        let cellIndex = 0;

        for (const listHeader of listHeaders) {
            const cell = TableParser.parseCell(listHeader, cellIndex, tableData);
            if (cell) {
                cells.push(cell);
                cellIndex++;
            }
        }

        // 셀 위치 계산 (행/열 인덱스)
        TableParser.calculateCellPositions(cells, tableData.rowCount, tableData.colCount);

        return {
            width: tableData.width,
            height: tableData.height,
            rowCount: tableData.rowCount,
            colCount: tableData.colCount,
            cellSpacing: tableData.cellSpacing,
            cells,
            rowHeights: tableData.rowHeights,
            colWidths: tableData.colWidths,
            borderFillID: tableData.borderFillID,
            margins: tableData.margins
        };
    }

    /**
     * TABLE 레코드 데이터 파싱
     */
    private static parseTableRecord(data: Uint8Array): TableRecordData {
        const reader = new RecordDataReader(data);

        // 테이블 속성
        const property = reader.readUint32();

        // 행/열 개수
        const rowCount = reader.readUint16();
        const colCount = reader.readUint16();

        // 셀 간격
        const cellSpacing = reader.readUint16();

        // 왼쪽/오른쪽/위/아래 여백
        const marginLeft = reader.readUint16();
        const marginRight = reader.readUint16();
        const marginTop = reader.readUint16();
        const marginBottom = reader.readUint16();

        // 행 높이 배열
        const rowHeights: number[] = [];
        for (let i = 0; i < rowCount; i++) {
            if (reader.remaining >= 2) {
                rowHeights.push(reader.readUint16());
            }
        }

        // 테두리/배경 ID
        let borderFillID = 1;
        if (reader.remaining >= 2) {
            borderFillID = reader.readUint16();
        }

        // 열 너비 배열 (확장 속성에 포함될 수 있음)
        const colWidths: number[] = [];

        // 테이블 크기 계산 (열 너비 합 + 여백)
        let width = marginLeft + marginRight + cellSpacing * (colCount - 1);
        for (const cw of colWidths) {
            width += cw;
        }

        // 높이 계산
        let height = marginTop + marginBottom + cellSpacing * (rowCount - 1);
        for (const rh of rowHeights) {
            height += rh;
        }

        return {
            property,
            rowCount,
            colCount,
            cellSpacing,
            marginLeft,
            marginRight,
            marginTop,
            marginBottom,
            rowHeights,
            colWidths,
            borderFillID,
            width,
            height,
            margins: [marginLeft, marginRight, marginTop, marginBottom]
        };
    }

    /**
     * LIST_HEADER에서 셀 파싱
     */
    private static parseCell(listNode: RecordNode, index: number, _tableData: TableRecordData): ParsedTableCell | null {
        const data = listNode.record.data;
        if (data.length < 8) return null;

        const reader = new RecordDataReader(data);

        // 문단 개수 (현재 사용하지 않지만 파싱 필요)
        reader.readUint16(); // paraCount

        // 속성
        const property = reader.readUint32();

        // 셀 크기 정보 (추가 데이터에서)
        let colIndex = 0;
        let rowIndex = 0;
        let colSpan = 1;
        let rowSpan = 1;
        let width = 0;
        let height = 0;
        let borderFillID = 1;

        // 확장 셀 정보 읽기 (가능한 경우)
        if (reader.remaining >= 2) colIndex = reader.readUint16();
        if (reader.remaining >= 2) rowIndex = reader.readUint16();
        if (reader.remaining >= 2) colSpan = reader.readUint16();
        if (reader.remaining >= 2) rowSpan = reader.readUint16();
        if (reader.remaining >= 4) width = reader.readUint32();
        if (reader.remaining >= 4) height = reader.readUint32();
        if (reader.remaining >= 2) borderFillID = reader.readUint16();

        // 여백
        let margins: [number, number, number, number] = [0, 0, 0, 0];
        if (reader.remaining >= 8) {
            margins = [
                reader.readUint16(), // left
                reader.readUint16(), // right
                reader.readUint16(), // top
                reader.readUint16()  // bottom
            ];
        }

        // 셀 내 문단 파싱
        const paragraphs: EnhancedParagraph[] = [];
        let paraIdx = 0;

        for (const child of listNode.children) {
            if (child.record.tagId === HWP_TAG_ID.PARA_HEADER) {
                const para = ParagraphParser.parseParagraph(child, paraIdx);
                paragraphs.push(para);
                paraIdx++;
            }
        }

        return {
            index,
            rowIndex,
            colIndex,
            rowSpan: rowSpan || 1,
            colSpan: colSpan || 1,
            width,
            height,
            paragraphs,
            borderFillID,
            margins,
            header: (property & 0x01) !== 0
        };
    }

    /**
     * 셀 위치 계산 (행렬 기반)
     */
    private static calculateCellPositions(cells: ParsedTableCell[], rowCount: number, colCount: number): void {
        // 이미 위치 정보가 있으면 건너뛰기
        if (cells.length > 0 && (cells[0].rowIndex !== 0 || cells[0].colIndex !== 0)) {
            return;
        }

        // 셀 위치 행렬
        const grid: boolean[][] = [];
        for (let r = 0; r < rowCount; r++) {
            grid[r] = new Array(colCount).fill(false);
        }

        let cellIdx = 0;
        for (let r = 0; r < rowCount && cellIdx < cells.length; r++) {
            for (let c = 0; c < colCount && cellIdx < cells.length; c++) {
                if (grid[r][c]) continue;

                const cell = cells[cellIdx];
                cell.rowIndex = r;
                cell.colIndex = c;

                // 병합된 셀 영역 표시
                for (let dr = 0; dr < cell.rowSpan; dr++) {
                    for (let dc = 0; dc < cell.colSpan; dc++) {
                        if (r + dr < rowCount && c + dc < colCount) {
                            grid[r + dr][c + dc] = true;
                        }
                    }
                }

                cellIdx++;
            }
        }
    }

    /**
     * 컨트롤 노드가 테이블인지 확인
     */
    static isTableControl(node: RecordNode): boolean {
        const data = node.record.data;
        if (data.length < 4) return false;

        const ctrlId = String.fromCharCode(data[0], data[1], data[2], data[3]);
        return ctrlId === 'tbl ';
    }
}

/**
 * TABLE 레코드 파싱 결과
 */
interface TableRecordData {
    property: number;
    rowCount: number;
    colCount: number;
    cellSpacing: number;
    marginLeft: number;
    marginRight: number;
    marginTop: number;
    marginBottom: number;
    rowHeights: number[];
    colWidths: number[];
    borderFillID: number;
    width: number;
    height: number;
    margins: [number, number, number, number];
}
