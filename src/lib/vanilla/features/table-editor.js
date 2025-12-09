/**
 * Table Editor
 * 테이블 행/열 추가/삭제 기능
 * 
 * @module features/table-editor
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TableEditor');

/**
 * 테이블 편집기 클래스
 */
export class TableEditor {
    constructor(viewer) {
        this.viewer = viewer;
        logger.info('🔧 TableEditor initialized');
    }

    /**
     * 셀이 속한 테이블 찾기
     * @param {HTMLElement} cell - TD 또는 TH 요소
     * @returns {Object|null} { tableElement, tableData, sectionIndex, elementIndex }
     */
    findTableData(cell) {
        // 1. DOM에서 테이블 요소 찾기
        const tableElement = cell.closest('.hwp-table');
        if (!tableElement) {
            logger.error('Table element not found');
            return null;
        }

        // 2. 문서 데이터에서 해당 테이블 찾기
        const document = this.viewer.getDocument();
        if (!document || !document.sections) {
            logger.error('Document not loaded');
            return null;
        }

        // 테이블 요소의 인덱스를 사용하여 데이터 찾기
        const allTables = this.viewer.container.querySelectorAll('.hwp-table');
        const tableIndex = Array.from(allTables).indexOf(tableElement);

        let currentTableIndex = 0;
        for (let sectionIndex = 0; sectionIndex < document.sections.length; sectionIndex++) {
            const section = document.sections[sectionIndex];
            for (let elementIndex = 0; elementIndex < section.elements.length; elementIndex++) {
                const element = section.elements[elementIndex];
                if (element.type === 'table') {
                    if (currentTableIndex === tableIndex) {
                        return {
                            tableElement,
                            tableData: element,
                            sectionIndex,
                            elementIndex
                        };
                    }
                    currentTableIndex++;
                }
            }
        }

        logger.error('Table data not found in document');
        return null;
    }

    /**
     * 셀의 행/열 인덱스 찾기
     * @param {HTMLElement} cell - TD 또는 TH 요소
     * @returns {Object|null} { rowIndex, colIndex }
     */
    getCellPosition(cell) {
        const row = cell.parentElement;
        const table = row.closest('table');
        
        if (!table || !row) {
            return null;
        }

        const rows = Array.from(table.querySelectorAll('tr'));
        const rowIndex = rows.indexOf(row);
        
        const cells = Array.from(row.querySelectorAll('td, th'));
        const colIndex = cells.indexOf(cell);

        return { rowIndex, colIndex };
    }

    /**
     * 위에 행 추가
     * @param {HTMLElement} cell - 기준 셀
     */
    async addRowAbove(cell) {
        logger.info('➕ Adding row above...');
        
        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return;

        const position = this.getCellPosition(cell);
        if (position === null) return;

        const { tableData } = tableInfo;
        const { rowIndex } = position;

        // 새 행 생성 (기준 행과 같은 열 수)
        const referenceRow = tableData.rows[rowIndex];
        const newRow = this.createEmptyRow(referenceRow);

        // 데이터에 행 추가
        tableData.rows.splice(rowIndex, 0, newRow);

        logger.info(`✅ Row added above at index ${rowIndex}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());
        
        // 🔄 편집 기능 재초기화 (이벤트 리스너 재등록)
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }

        return true;
    }

    /**
     * 아래에 행 추가
     * @param {HTMLElement} cell - 기준 셀
     */
    async addRowBelow(cell) {
        logger.info('➕ Adding row below...');
        
        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return;

        const position = this.getCellPosition(cell);
        if (position === null) return;

        const { tableData } = tableInfo;
        const { rowIndex } = position;

        // 새 행 생성
        const referenceRow = tableData.rows[rowIndex];
        const newRow = this.createEmptyRow(referenceRow);

        // 데이터에 행 추가 (아래)
        tableData.rows.splice(rowIndex + 1, 0, newRow);

        logger.info(`✅ Row added below at index ${rowIndex + 1}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());
        
        // 🔄 편집 기능 재초기화
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }

        return true;
    }

    /**
     * 행 삭제
     * @param {HTMLElement} cell - 삭제할 행의 셀
     */
    async deleteRow(cell) {
        logger.info('🗑️ Deleting row...');
        
        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return;

        const position = this.getCellPosition(cell);
        if (position === null) return;

        const { tableData } = tableInfo;
        const { rowIndex } = position;

        // 최소 1개 행은 유지
        if (tableData.rows.length <= 1) {
            logger.warn('Cannot delete last row');
            alert('⚠️ 마지막 행은 삭제할 수 없습니다.');
            return false;
        }

        // 행 삭제
        tableData.rows.splice(rowIndex, 1);

        logger.info(`✅ Row deleted at index ${rowIndex}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());
        
        // 🔄 편집 기능 재초기화
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }

        return true;
    }

    /**
     * 왼쪽에 열 추가
     * @param {HTMLElement} cell - 기준 셀
     */
    async addColumnLeft(cell) {
        logger.info('➕ Adding column left...');
        
        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return;

        const position = this.getCellPosition(cell);
        if (position === null) return;

        const { tableData } = tableInfo;
        const { colIndex } = position;

        // 모든 행에 새 셀 추가
        tableData.rows.forEach(row => {
            const newCell = this.createEmptyCell();
            row.cells.splice(colIndex, 0, newCell);
        });

        // colWidths 업데이트
        if (tableData.colWidths) {
            const avgWidth = this.calculateAverageColumnWidth(tableData);
            tableData.colWidths.splice(colIndex, 0, avgWidth);
        }

        // colWidthsPercent 업데이트
        if (tableData.colWidthsPercent) {
            this.recalculateColumnWidthsPercent(tableData);
        }

        logger.info(`✅ Column added left at index ${colIndex}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());
        
        // 🔄 편집 기능 재초기화
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }

        return true;
    }

    /**
     * 오른쪽에 열 추가
     * @param {HTMLElement} cell - 기준 셀
     */
    async addColumnRight(cell) {
        logger.info('➕ Adding column right...');
        
        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return;

        const position = this.getCellPosition(cell);
        if (position === null) return;

        const { tableData } = tableInfo;
        const { colIndex } = position;

        // 모든 행에 새 셀 추가
        tableData.rows.forEach(row => {
            const newCell = this.createEmptyCell();
            row.cells.splice(colIndex + 1, 0, newCell);
        });

        // colWidths 업데이트
        if (tableData.colWidths) {
            const avgWidth = this.calculateAverageColumnWidth(tableData);
            tableData.colWidths.splice(colIndex + 1, 0, avgWidth);
        }

        // colWidthsPercent 업데이트
        if (tableData.colWidthsPercent) {
            this.recalculateColumnWidthsPercent(tableData);
        }

        logger.info(`✅ Column added right at index ${colIndex + 1}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());
        
        // 🔄 편집 기능 재초기화
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }

        return true;
    }

    /**
     * 열 삭제
     * @param {HTMLElement} cell - 삭제할 열의 셀
     */
    async deleteColumn(cell) {
        logger.info('🗑️ Deleting column...');
        
        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return;

        const position = this.getCellPosition(cell);
        if (position === null) return;

        const { tableData } = tableInfo;
        const { colIndex } = position;

        // 최소 1개 열은 유지
        if (tableData.rows[0].cells.length <= 1) {
            logger.warn('Cannot delete last column');
            alert('⚠️ 마지막 열은 삭제할 수 없습니다.');
            return false;
        }

        // 모든 행에서 해당 열 삭제
        tableData.rows.forEach(row => {
            row.cells.splice(colIndex, 1);
        });

        // colWidths 업데이트
        if (tableData.colWidths) {
            tableData.colWidths.splice(colIndex, 1);
        }

        // colWidthsPercent 업데이트
        if (tableData.colWidthsPercent) {
            this.recalculateColumnWidthsPercent(tableData);
        }

        logger.info(`✅ Column deleted at index ${colIndex}`);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());
        
        // 🔄 편집 기능 재초기화
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }

        return true;
    }

    /**
     * 빈 행 생성 (기준 행과 같은 구조)
     * @param {Object} referenceRow - 기준 행
     * @returns {Object} 새 행
     */
    createEmptyRow(referenceRow) {
        const newRow = {
            cells: []
        };

        // 기준 행과 같은 수의 셀 생성
        referenceRow.cells.forEach(refCell => {
            const newCell = this.createEmptyCell();
            
            // 스타일 복사 (선택적)
            if (refCell.style) {
                newCell.style = {
                    ...refCell.style,
                    // 배경색은 복사하지 않음 (빈 셀)
                    backgroundColor: undefined
                };
            }

            // rowSpan, colSpan 기본값
            newCell.rowSpan = 1;
            newCell.colSpan = 1;

            newRow.cells.push(newCell);
        });

        return newRow;
    }

    /**
     * 빈 셀 생성
     * @returns {Object} 새 셀
     */
    createEmptyCell() {
        return {
            rowSpan: 1,
            colSpan: 1,
            elements: [
                {
                    type: 'paragraph',
                    runs: [
                        {
                            text: ''
                        }
                    ]
                }
            ]
        };
    }

    /**
     * 평균 열 너비 계산
     * @param {Object} tableData - 테이블 데이터
     * @returns {string} 평균 너비 (px)
     */
    calculateAverageColumnWidth(tableData) {
        if (!tableData.colWidths || tableData.colWidths.length === 0) {
            return '100px';
        }

        const totalWidth = tableData.colWidths.reduce((sum, width) => {
            const widthValue = parseInt(width);
            return sum + (isNaN(widthValue) ? 100 : widthValue);
        }, 0);

        const avgWidth = Math.round(totalWidth / tableData.colWidths.length);
        return `${avgWidth}px`;
    }

    /**
     * 열 너비 퍼센트 재계산
     * @param {Object} tableData - 테이블 데이터
     */
    recalculateColumnWidthsPercent(tableData) {
        if (!tableData.colWidths) {
            return;
        }

        const totalWidth = tableData.colWidths.reduce((sum, width) => {
            const widthValue = parseInt(width);
            return sum + (isNaN(widthValue) ? 100 : widthValue);
        }, 0);

        tableData.colWidthsPercent = tableData.colWidths.map(width => {
            const widthValue = parseInt(width);
            const percent = ((widthValue / totalWidth) * 100).toFixed(2);
            return `${percent}%`;
        });

        logger.debug(`✓ Column widths recalculated: ${tableData.colWidthsPercent.join(', ')}`);
    }

    /**
     * 테이블 전체 삭제 (선택적 기능)
     * @param {HTMLElement} cell - 테이블 내 셀
     */
    async deleteTable(cell) {
        logger.info('🗑️ Deleting entire table...');
        
        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return;

        const { sectionIndex, elementIndex } = tableInfo;
        const document = this.viewer.getDocument();

        // 확인 대화상자
        const confirmed = confirm('⚠️ 테이블 전체를 삭제하시겠습니까?\n이 작업은 실행 취소할 수 있습니다.');
        if (!confirmed) {
            return false;
        }

        // 테이블 삭제
        document.sections[sectionIndex].elements.splice(elementIndex, 1);

        logger.info(`✅ Table deleted at section ${sectionIndex}, element ${elementIndex}`);

        // 재렌더링
        await this.viewer.updateDocument(document);

        return true;
    }
}

export default TableEditor;

