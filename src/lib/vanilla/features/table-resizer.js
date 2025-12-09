/**
 * Table Resizer
 * 테이블 열/행 크기 조절 기능 (드래그)
 * 
 * @module features/table-resizer
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TableResizer');

/**
 * 테이블 크기 조절기 클래스
 */
export class TableResizer {
    constructor(viewer) {
        this.viewer = viewer;
        this.isResizing = false;
        this.resizeType = null; // 'column' or 'row'
        this.resizeTarget = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.resizeLine = null;
        
        logger.info('📏 TableResizer initialized');
    }

    /**
     * 테이블에 크기 조절 기능 활성화
     * @param {HTMLTableElement} table - 테이블 요소
     */
    enableTableResizing(table) {
        // 열 크기 조절 핸들 추가
        this.addColumnResizeHandles(table);
        
        // 행 크기 조절 핸들 추가
        this.addRowResizeHandles(table);
        
        logger.debug(`✅ Table resizing enabled for table`);
    }

    /**
     * 열 크기 조절 핸들 추가
     * @private
     */
    addColumnResizeHandles(table) {
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) return;

        const firstRow = rows[0];
        const cells = firstRow.querySelectorAll('td, th');

        cells.forEach((cell, index) => {
            // 마지막 셀은 제외 (오른쪽 경계가 테이블 끝)
            if (index === cells.length - 1) return;

            // 셀의 오른쪽 경계에 리사이즈 영역 추가
            this.makeColumnResizable(cell, table);
        });
    }

    /**
     * 행 크기 조절 핸들 추가
     * @private
     */
    addRowResizeHandles(table) {
        const rows = table.querySelectorAll('tr');

        rows.forEach((row, index) => {
            // 마지막 행은 제외
            if (index === rows.length - 1) return;

            // 행의 아래쪽 경계에 리사이즈 영역 추가
            this.makeRowResizable(row, table);
        });
    }

    /**
     * 열 크기 조절 가능하게 만들기
     * @private
     */
    makeColumnResizable(cell, table) {
        // 셀의 오른쪽 경계 영역 (10px)
        cell.addEventListener('mousemove', (e) => {
            if (this.isResizing) return;

            const rect = cell.getBoundingClientRect();
            const isNearRightEdge = e.clientX > rect.right - 10;

            if (isNearRightEdge) {
                cell.style.cursor = 'col-resize';
            } else {
                cell.style.cursor = 'text';
            }
        });

        cell.addEventListener('mousedown', (e) => {
            const rect = cell.getBoundingClientRect();
            const isNearRightEdge = e.clientX > rect.right - 10;

            if (isNearRightEdge) {
                e.preventDefault();
                e.stopPropagation();
                this.startColumnResize(cell, table, e);
            }
        });
    }

    /**
     * 행 크기 조절 가능하게 만들기
     * @private
     */
    makeRowResizable(row, table) {
        const cells = row.querySelectorAll('td, th');

        cells.forEach(cell => {
            // 셀의 아래쪽 경계 영역 (10px)
            cell.addEventListener('mousemove', (e) => {
                if (this.isResizing) return;

                const rect = cell.getBoundingClientRect();
                const isNearBottomEdge = e.clientY > rect.bottom - 10;

                if (isNearBottomEdge) {
                    cell.style.cursor = 'row-resize';
                } else if (cell.style.cursor === 'row-resize') {
                    cell.style.cursor = 'text';
                }
            });

            cell.addEventListener('mousedown', (e) => {
                const rect = cell.getBoundingClientRect();
                const isNearBottomEdge = e.clientY > rect.bottom - 10;

                if (isNearBottomEdge) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.startRowResize(row, table, e);
                }
            });
        });
    }

    /**
     * 열 크기 조절 시작
     * @private
     */
    startColumnResize(cell, table, e) {
        this.isResizing = true;
        this.resizeType = 'column';
        this.resizeTarget = { cell, table };
        this.startX = e.clientX;
        this.startWidth = cell.offsetWidth;

        // 리사이즈 라인 표시
        this.showResizeLine(e.clientX, table, 'vertical');

        // 전역 이벤트 리스너 등록
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);

        // 선택 방지
        document.body.style.userSelect = 'none';
        
        logger.debug(`📏 Column resize started at x=${e.clientX}`);
    }

    /**
     * 행 크기 조절 시작
     * @private
     */
    startRowResize(row, table, e) {
        this.isResizing = true;
        this.resizeType = 'row';
        this.resizeTarget = { row, table };
        this.startY = e.clientY;
        this.startHeight = row.offsetHeight;

        // 리사이즈 라인 표시
        this.showResizeLine(e.clientY, table, 'horizontal');

        // 전역 이벤트 리스너 등록
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);

        // 선택 방지
        document.body.style.userSelect = 'none';
        
        logger.debug(`📏 Row resize started at y=${e.clientY}`);
    }

    /**
     * 마우스 이동 핸들러
     * @private
     */
    handleMouseMove = (e) => {
        if (!this.isResizing) return;

        if (this.resizeType === 'column') {
            this.updateColumnResize(e);
        } else if (this.resizeType === 'row') {
            this.updateRowResize(e);
        }
    }

    /**
     * 마우스 업 핸들러
     * @private
     */
    handleMouseUp = (e) => {
        if (!this.isResizing) return;

        if (this.resizeType === 'column') {
            this.finishColumnResize(e);
        } else if (this.resizeType === 'row') {
            this.finishRowResize(e);
        }

        // 정리
        this.cleanup();
    }

    /**
     * 열 크기 조절 업데이트 (드래그 중)
     * @private
     */
    updateColumnResize(e) {
        const deltaX = e.clientX - this.startX;
        const newWidth = Math.max(30, this.startWidth + deltaX); // 최소 30px

        // 리사이즈 라인 위치 업데이트
        if (this.resizeLine) {
            this.resizeLine.style.left = `${e.clientX}px`;
        }
    }

    /**
     * 행 크기 조절 업데이트 (드래그 중)
     * @private
     */
    updateRowResize(e) {
        const deltaY = e.clientY - this.startY;
        const newHeight = Math.max(20, this.startHeight + deltaY); // 최소 20px

        // 리사이즈 라인 위치 업데이트
        if (this.resizeLine) {
            this.resizeLine.style.top = `${e.clientY}px`;
        }
    }

    /**
     * 열 크기 조절 완료
     * @private
     */
    async finishColumnResize(e) {
        const { cell, table } = this.resizeTarget;
        const deltaX = e.clientX - this.startX;
        const newWidth = Math.max(30, this.startWidth + deltaX);

        logger.info(`📏 Column resize finished: ${this.startWidth}px → ${newWidth}px`);

        // 열 인덱스 찾기
        const row = cell.parentElement;
        const cells = Array.from(row.querySelectorAll('td, th'));
        const colIndex = cells.indexOf(cell);

        // 실제 크기 적용
        await this.applyColumnWidth(table, colIndex, newWidth);
    }

    /**
     * 행 크기 조절 완료
     * @private
     */
    async finishRowResize(e) {
        const { row, table } = this.resizeTarget;
        const deltaY = e.clientY - this.startY;
        const newHeight = Math.max(20, this.startHeight + deltaY);

        logger.info(`📏 Row resize finished: ${this.startHeight}px → ${newHeight}px`);

        // 행 인덱스 찾기
        const rows = Array.from(table.querySelectorAll('tr'));
        const rowIndex = rows.indexOf(row);

        // 실제 크기 적용
        await this.applyRowHeight(table, rowIndex, newHeight);
    }

    /**
     * 열 너비 적용
     * @private
     */
    async applyColumnWidth(table, colIndex, newWidth) {
        // 테이블 데이터 찾기
        const tableData = this.findTableData(table);
        if (!tableData) {
            logger.error('Table data not found');
            return;
        }

        // colWidths 업데이트
        if (!tableData.colWidths) {
            tableData.colWidths = [];
        }

        tableData.colWidths[colIndex] = `${newWidth}px`;

        // colWidthsPercent 재계산
        this.recalculateColumnWidthsPercent(tableData);

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());
        
        // 편집 기능 재초기화
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }
    }

    /**
     * 행 높이 적용
     * @private
     */
    async applyRowHeight(table, rowIndex, newHeight) {
        // 테이블 데이터 찾기
        const tableData = this.findTableData(table);
        if (!tableData) {
            logger.error('Table data not found');
            return;
        }

        // 행 데이터의 모든 셀에 높이 적용
        const rowData = tableData.rows[rowIndex];
        if (rowData && rowData.cells) {
            rowData.cells.forEach(cell => {
                if (!cell.style) {
                    cell.style = {};
                }
                cell.style.height = `${newHeight}px`;
            });
        }

        // 재렌더링
        await this.viewer.updateDocument(this.viewer.getDocument());
        
        // 편집 기능 재초기화
        if (typeof window.reinitializeEditing === 'function') {
            window.reinitializeEditing();
        }
    }

    /**
     * 테이블 데이터 찾기
     * @private
     */
    findTableData(tableElement) {
        const document = this.viewer.getDocument();
        if (!document || !document.sections) return null;

        const allTables = this.viewer.container.querySelectorAll('table.hwp-table');
        const tableIndex = Array.from(allTables).indexOf(tableElement);

        let currentTableIndex = 0;
        for (const section of document.sections) {
            for (const element of section.elements) {
                if (element.type === 'table') {
                    if (currentTableIndex === tableIndex) {
                        return element;
                    }
                    currentTableIndex++;
                }
            }
        }
        return null;
    }

    /**
     * 열 너비 퍼센트 재계산
     * @private
     */
    recalculateColumnWidthsPercent(tableData) {
        if (!tableData.colWidths) return;

        const totalWidth = tableData.colWidths.reduce((sum, width) => {
            const widthValue = parseInt(width);
            return sum + (isNaN(widthValue) ? 100 : widthValue);
        }, 0);

        tableData.colWidthsPercent = tableData.colWidths.map(width => {
            const widthValue = parseInt(width);
            const percent = ((widthValue / totalWidth) * 100).toFixed(2);
            return `${percent}%`;
        });
    }

    /**
     * 리사이즈 라인 표시
     * @private
     */
    showResizeLine(position, table, direction) {
        // 기존 라인 제거
        if (this.resizeLine) {
            this.resizeLine.remove();
        }

        // 새 라인 생성
        const line = document.createElement('div');
        line.className = 'table-resize-line';
        line.style.position = 'fixed';
        line.style.zIndex = '10000';
        line.style.backgroundColor = '#3498db';
        line.style.pointerEvents = 'none';

        if (direction === 'vertical') {
            line.style.width = '2px';
            line.style.height = '100vh';
            line.style.left = `${position}px`;
            line.style.top = '0';
            line.style.cursor = 'col-resize';
        } else {
            line.style.width = '100vw';
            line.style.height = '2px';
            line.style.left = '0';
            line.style.top = `${position}px`;
            line.style.cursor = 'row-resize';
        }

        document.body.appendChild(line);
        this.resizeLine = line;
    }

    /**
     * 정리
     * @private
     */
    cleanup() {
        // 이벤트 리스너 제거
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        // 선택 복원
        document.body.style.userSelect = '';

        // 리사이즈 라인 제거
        if (this.resizeLine) {
            this.resizeLine.remove();
            this.resizeLine = null;
        }

        // 상태 초기화
        this.isResizing = false;
        this.resizeType = null;
        this.resizeTarget = null;
        
        logger.debug('📏 Resize cleanup completed');
    }

    /**
     * 모든 테이블에 크기 조절 기능 활성화
     */
    enableAllTables() {
        const tables = document.querySelectorAll('table.hwp-table');
        tables.forEach(table => {
            this.enableTableResizing(table);
        });
        logger.info(`✅ Resize enabled for ${tables.length} tables`);
    }
}

export default TableResizer;

