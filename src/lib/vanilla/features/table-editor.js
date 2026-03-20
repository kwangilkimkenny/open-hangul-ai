/**
 * Table Editor
 * 테이블 행/열 추가/삭제 기능
 *
 * @module features/table-editor
 * @version 2.0.0 - HistoryManager 통합
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TableEditor');

/**
 * 테이블 편집기 클래스
 * ✅ v2.0.0: HistoryManager 통합으로 Undo/Redo 지원
 */
export class TableEditor {
    constructor(viewer) {
        this.viewer = viewer;
        logger.info('🔧 TableEditor initialized (v2.0.0 with History support)');
    }

    /**
     * 테이블 데이터 깊은 복사
     * @param {Object} tableData - 원본 테이블 데이터
     * @returns {Object} 복사된 테이블 데이터
     */
    _cloneTableData(tableData) {
        return JSON.parse(JSON.stringify(tableData));
    }

    /**
     * 테이블 데이터 복원
     * @param {Object} tableData - 대상 테이블 데이터 객체
     * @param {Object} clonedData - 복원할 데이터
     */
    _restoreTableData(tableData, clonedData) {
        // 기존 데이터를 모두 지우고 복원
        Object.keys(tableData).forEach(key => delete tableData[key]);
        Object.assign(tableData, clonedData);
    }

    /**
     * 문서 업데이트 및 편집 기능 재초기화
     * @private
     */
    async _updateAndReinitialize() {
        await this.viewer.updateDocument(this.viewer.getDocument());
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }
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
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 기준 셀
     */
    async addRowAbove(cell) {
        logger.info('➕ Adding row above...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (position === null) return false;

        const { tableData } = tableInfo;
        const { rowIndex } = position;

        // ✅ History: 이전 상태 저장
        const oldTableData = this._cloneTableData(tableData);

        // 새 행 생성 (기준 행과 같은 열 수)
        const referenceRow = tableData.rows[rowIndex];
        const newRow = this.createEmptyRow(referenceRow);

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            tableData.rows.splice(rowIndex, 0, newRow);
            logger.info(`✅ Row added above at index ${rowIndex}`);
        };

        const undoFn = () => {
            this._restoreTableData(tableData, oldTableData);
            logger.info(`↶ Row addition undone at index ${rowIndex}`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '행 추가 (위)');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 아래에 행 추가
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 기준 셀
     */
    async addRowBelow(cell) {
        logger.info('➕ Adding row below...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (position === null) return false;

        const { tableData } = tableInfo;
        const { rowIndex } = position;

        // ✅ History: 이전 상태 저장
        const oldTableData = this._cloneTableData(tableData);

        // 새 행 생성
        const referenceRow = tableData.rows[rowIndex];
        const newRow = this.createEmptyRow(referenceRow);

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            tableData.rows.splice(rowIndex + 1, 0, newRow);
            logger.info(`✅ Row added below at index ${rowIndex + 1}`);
        };

        const undoFn = () => {
            this._restoreTableData(tableData, oldTableData);
            logger.info(`↶ Row addition undone at index ${rowIndex + 1}`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '행 추가 (아래)');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 행 삭제
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 삭제할 행의 셀
     */
    async deleteRow(cell) {
        logger.info('🗑️ Deleting row...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (position === null) return false;

        const { tableData } = tableInfo;
        const { rowIndex } = position;

        // 최소 1개 행은 유지
        if (tableData.rows.length <= 1) {
            logger.warn('Cannot delete last row');
            alert('⚠️ 마지막 행은 삭제할 수 없습니다.');
            return false;
        }

        // ✅ History: 이전 상태 저장
        const oldTableData = this._cloneTableData(tableData);

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            tableData.rows.splice(rowIndex, 1);
            logger.info(`✅ Row deleted at index ${rowIndex}`);
        };

        const undoFn = () => {
            this._restoreTableData(tableData, oldTableData);
            logger.info(`↶ Row deletion undone at index ${rowIndex}`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '행 삭제');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 왼쪽에 열 추가
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 기준 셀
     */
    async addColumnLeft(cell) {
        logger.info('➕ Adding column left...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (position === null) return false;

        const { tableData } = tableInfo;
        const { colIndex } = position;

        // ✅ History: 이전 상태 저장
        const oldTableData = this._cloneTableData(tableData);

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
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
        };

        const undoFn = () => {
            this._restoreTableData(tableData, oldTableData);
            logger.info(`↶ Column addition undone at index ${colIndex}`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '열 추가 (왼쪽)');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 오른쪽에 열 추가
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 기준 셀
     */
    async addColumnRight(cell) {
        logger.info('➕ Adding column right...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (position === null) return false;

        const { tableData } = tableInfo;
        const { colIndex } = position;

        // ✅ History: 이전 상태 저장
        const oldTableData = this._cloneTableData(tableData);

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
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
        };

        const undoFn = () => {
            this._restoreTableData(tableData, oldTableData);
            logger.info(`↶ Column addition undone at index ${colIndex + 1}`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '열 추가 (오른쪽)');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 열 삭제
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 삭제할 열의 셀
     */
    async deleteColumn(cell) {
        logger.info('🗑️ Deleting column...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (position === null) return false;

        const { tableData } = tableInfo;
        const { colIndex } = position;

        // 최소 1개 열은 유지
        if (tableData.rows[0].cells.length <= 1) {
            logger.warn('Cannot delete last column');
            alert('⚠️ 마지막 열은 삭제할 수 없습니다.');
            return false;
        }

        // ✅ History: 이전 상태 저장
        const oldTableData = this._cloneTableData(tableData);

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
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
        };

        const undoFn = () => {
            this._restoreTableData(tableData, oldTableData);
            logger.info(`↶ Column deletion undone at index ${colIndex}`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '열 삭제');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
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
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 테이블 내 셀
     */
    async deleteTable(cell) {
        logger.info('🗑️ Deleting entire table...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const { sectionIndex, elementIndex, tableData } = tableInfo;
        const document = this.viewer.getDocument();

        // 확인 대화상자
        const confirmed = confirm('⚠️ 테이블 전체를 삭제하시겠습니까?\n이 작업은 실행 취소할 수 있습니다.');
        if (!confirmed) {
            return false;
        }

        // ✅ History: 이전 상태 저장 (테이블 데이터 전체)
        const oldTableData = this._cloneTableData(tableData);

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            document.sections[sectionIndex].elements.splice(elementIndex, 1);
            logger.info(`✅ Table deleted at section ${sectionIndex}, element ${elementIndex}`);
        };

        const undoFn = () => {
            document.sections[sectionIndex].elements.splice(elementIndex, 0, oldTableData);
            logger.info(`↶ Table deletion undone at section ${sectionIndex}, element ${elementIndex}`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '테이블 삭제');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 테이블 삽입 (커서 위치)
     * ✅ v2.0.0: HistoryManager 통합
     * @param {number} rows - 행 수
     * @param {number} cols - 열 수
     * @returns {boolean} 성공 여부
     */
    async insertTable(rows = 3, cols = 3) {
        logger.info(`➕ Inserting table (${rows}x${cols})...`);

        const document = this.viewer.getDocument();
        if (!document || !document.sections || document.sections.length === 0) {
            logger.error('Document not loaded');
            return false;
        }

        // 테이블 데이터 생성
        const tableData = this.createNewTable(rows, cols);

        // 현재 커서 위치를 가져와서 테이블 삽입
        // 첫 번째 섹션의 끝에 추가 (간단한 구현)
        const firstSection = document.sections[0];
        if (!firstSection.elements) {
            firstSection.elements = [];
        }

        const insertIndex = firstSection.elements.length;

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            firstSection.elements.push(tableData);
            logger.info(`✅ Table inserted (${rows}x${cols})`);
        };

        const undoFn = () => {
            firstSection.elements.pop();
            logger.info(`↶ Table insertion undone`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '테이블 삽입');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 새 테이블 생성
     * @param {number} rows - 행 수
     * @param {number} cols - 열 수
     * @returns {Object} 테이블 데이터
     */
    createNewTable(rows, cols) {
        const colWidth = Math.floor(100 / cols);
        const colWidthsPercent = Array(cols).fill(`${colWidth}%`);

        const tableRows = [];
        for (let r = 0; r < rows; r++) {
            const row = {
                cells: []
            };

            for (let c = 0; c < cols; c++) {
                row.cells.push(this.createEmptyCell());
            }

            tableRows.push(row);
        }

        return {
            type: 'table',
            rows: tableRows,
            colWidthsPercent: colWidthsPercent,
            style: {
                width: '100%'
            }
        };
    }

    /**
     * 셀 병합 (선택된 영역)
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement[]} cells - 병합할 셀들
     * @returns {boolean} 성공 여부
     */
    async mergeCells(cells) {
        logger.info('🔗 Merging cells...');

        if (!cells || cells.length < 2) {
            logger.warn('Need at least 2 cells to merge');
            alert('⚠️ 병합하려면 최소 2개의 셀을 선택해야 합니다.');
            return false;
        }

        const firstCell = cells[0];
        const tableInfo = this.findTableData(firstCell);
        if (!tableInfo) return false;

        const { tableData } = tableInfo;

        // ✅ History: 이전 상태 저장
        const oldTableData = this._cloneTableData(tableData);

        // 선택된 셀들의 위치 파악
        const positions = cells.map(cell => this.getCellPosition(cell));
        const rowIndices = positions.map(p => p.rowIndex);
        const colIndices = positions.map(p => p.colIndex);

        const minRow = Math.min(...rowIndices);
        const maxRow = Math.max(...rowIndices);
        const minCol = Math.min(...colIndices);
        const maxCol = Math.max(...colIndices);

        // 병합할 영역 계산
        const rowSpan = maxRow - minRow + 1;
        const colSpan = maxCol - minCol + 1;

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            // 첫 번째 셀에 rowSpan, colSpan 설정
            const targetCell = tableData.rows[minRow].cells[minCol];
            targetCell.rowSpan = rowSpan;
            targetCell.colSpan = colSpan;

            // 병합된 셀들의 내용을 첫 번째 셀에 합치기
            let mergedContent = [];
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (r === minRow && c === minCol) continue;

                    const cell = tableData.rows[r].cells[c];
                    if (cell && cell.elements) {
                        mergedContent = mergedContent.concat(cell.elements);
                    }
                }
            }

            // 병합된 내용 추가
            if (mergedContent.length > 0) {
                targetCell.elements = targetCell.elements.concat(mergedContent);
            }

            // 병합된 영역의 다른 셀들을 병합 표시
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (r === minRow && c === minCol) continue;

                    const cell = tableData.rows[r].cells[c];
                    if (cell) {
                        cell._merged = true;
                    }
                }
            }

            logger.info(`✅ Cells merged (${rowSpan}x${colSpan})`);
        };

        const undoFn = () => {
            this._restoreTableData(tableData, oldTableData);
            logger.info(`↶ Cell merge undone`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '셀 병합');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 셀 분할 (병합 해제)
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 분할할 셀
     * @returns {boolean} 성공 여부
     */
    async splitCell(cell) {
        logger.info('✂️ Splitting cell...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (!position) return false;

        const { tableData } = tableInfo;
        const { rowIndex, colIndex } = position;

        const targetCell = tableData.rows[rowIndex].cells[colIndex];

        // rowSpan, colSpan이 1보다 큰 경우만 분할 가능
        const rowSpan = targetCell.rowSpan || 1;
        const colSpan = targetCell.colSpan || 1;

        if (rowSpan === 1 && colSpan === 1) {
            logger.warn('Cell is not merged');
            alert('⚠️ 병합되지 않은 셀입니다.');
            return false;
        }

        // ✅ History: 이전 상태 저장
        const oldTableData = this._cloneTableData(tableData);

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            // rowSpan, colSpan을 1로 설정
            targetCell.rowSpan = 1;
            targetCell.colSpan = 1;

            // 병합 표시 제거 및 빈 셀 생성
            for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
                for (let c = colIndex; c < colIndex + colSpan; c++) {
                    if (r === rowIndex && c === colIndex) continue;

                    const cell = tableData.rows[r].cells[c];
                    if (cell && cell._merged) {
                        delete cell._merged;
                        // 빈 셀로 복원
                        cell.elements = [{
                            type: 'paragraph',
                            runs: [{ text: '' }]
                        }];
                    }
                }
            }

            logger.info(`✅ Cell split (was ${rowSpan}x${colSpan})`);
        };

        const undoFn = () => {
            this._restoreTableData(tableData, oldTableData);
            logger.info(`↶ Cell split undone`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '셀 분할');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 셀 배경색 설정
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 대상 셀
     * @param {string} color - 배경색 (hex, rgb, etc.)
     * @returns {boolean} 성공 여부
     */
    async setCellBackgroundColor(cell, color) {
        logger.info(`🎨 Setting cell background color: ${color}`);

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (!position) return false;

        const { tableData } = tableInfo;
        const { rowIndex, colIndex } = position;

        const targetCell = tableData.rows[rowIndex].cells[colIndex];

        // ✅ History: 이전 상태 저장
        const oldColor = targetCell.style?.backgroundColor;

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            // 스타일 객체 생성
            if (!targetCell.style) {
                targetCell.style = {};
            }
            // 배경색 설정
            targetCell.style.backgroundColor = color;
            logger.info(`✅ Cell background color set: ${color}`);
        };

        const undoFn = () => {
            if (!targetCell.style) {
                targetCell.style = {};
            }
            targetCell.style.backgroundColor = oldColor;
            logger.info(`↶ Cell background color undone to: ${oldColor}`);
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '셀 배경색 변경');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 셀 테두리 설정
     * ✅ v2.0.0: HistoryManager 통합
     * @param {HTMLElement} cell - 대상 셀
     * @param {Object} borders - 테두리 설정 { top, bottom, left, right }
     * @returns {boolean} 성공 여부
     */
    async setCellBorders(cell, borders) {
        logger.info('🖼️ Setting cell borders...');

        const tableInfo = this.findTableData(cell);
        if (!tableInfo) return false;

        const position = this.getCellPosition(cell);
        if (!position) return false;

        const { tableData } = tableInfo;
        const { rowIndex, colIndex } = position;

        const targetCell = tableData.rows[rowIndex].cells[colIndex];

        // ✅ History: 이전 상태 저장
        const oldBorders = {
            borderTopDef: targetCell.style?.borderTopDef,
            borderBottomDef: targetCell.style?.borderBottomDef,
            borderLeftDef: targetCell.style?.borderLeftDef,
            borderRightDef: targetCell.style?.borderRightDef
        };

        // ✅ History: execute 및 undo 함수 정의
        const executeFn = () => {
            // 스타일 객체 생성
            if (!targetCell.style) {
                targetCell.style = {};
            }

            // 테두리 설정 (CSS 형식으로 변환)
            if (borders.top) {
                targetCell.style.borderTopDef = this.createBorderDef(borders.top);
            }
            if (borders.bottom) {
                targetCell.style.borderBottomDef = this.createBorderDef(borders.bottom);
            }
            if (borders.left) {
                targetCell.style.borderLeftDef = this.createBorderDef(borders.left);
            }
            if (borders.right) {
                targetCell.style.borderRightDef = this.createBorderDef(borders.right);
            }

            logger.info('✅ Cell borders set');
        };

        const undoFn = () => {
            if (!targetCell.style) {
                targetCell.style = {};
            }
            targetCell.style.borderTopDef = oldBorders.borderTopDef;
            targetCell.style.borderBottomDef = oldBorders.borderBottomDef;
            targetCell.style.borderLeftDef = oldBorders.borderLeftDef;
            targetCell.style.borderRightDef = oldBorders.borderRightDef;
            logger.info('↶ Cell borders undone');
        };

        // ✅ HistoryManager를 통해 실행
        if (this.viewer.historyManager) {
            this.viewer.historyManager.execute(executeFn, undoFn, '셀 테두리 변경');
        } else {
            executeFn();
        }

        // 재렌더링
        await this._updateAndReinitialize();
        return true;
    }

    /**
     * 테두리 정의 생성
     * @param {string} borderCSS - CSS 테두리 문자열 (예: "1px solid #000")
     * @returns {Object} 테두리 정의 객체
     */
    createBorderDef(borderCSS) {
        return {
            css: borderCSS,
            visible: true
        };
    }
}

export default TableEditor;

