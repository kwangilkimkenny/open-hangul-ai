/**
 * Cell Selector
 * 템플릿 추출 시 셀 단위로 유지/수정/생성 모드를 수동 설정하는 기능
 * 
 * @module features/cell-selector
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { showToast } from '../utils/ui.js';

const logger = getLogger();

/**
 * 셀 모드 상수
 */
export const CellMode = {
    AUTO: 'auto',        // 자동 감지 (기본)
    KEEP: 'keep',        // 유지 (헤더/고정값)
    EDIT: 'edit',        // 수정 (AI가 기존 내용 기반으로 수정)
    GENERATE: 'generate' // 생성 (AI가 새로운 내용 생성)
};

/**
 * 모드별 설정 (모노톤 아이콘)
 */
const MODE_CONFIG = {
    [CellMode.AUTO]: {
        label: '자동',
        icon: '○',
        color: '#6b7280',
        bgColor: 'rgba(107, 114, 128, 0.08)',
        borderColor: 'rgba(107, 114, 128, 0.25)'
    },
    [CellMode.KEEP]: {
        label: '유지',
        icon: '—',
        color: '#374151',
        bgColor: 'rgba(55, 65, 81, 0.1)',
        borderColor: 'rgba(55, 65, 81, 0.3)'
    },
    [CellMode.EDIT]: {
        label: '수정',
        icon: '/',
        color: '#4b5563',
        bgColor: 'rgba(75, 85, 99, 0.1)',
        borderColor: 'rgba(75, 85, 99, 0.3)'
    },
    [CellMode.GENERATE]: {
        label: '생성',
        icon: '+',
        color: '#111827',
        bgColor: 'rgba(17, 24, 39, 0.1)',
        borderColor: 'rgba(17, 24, 39, 0.3)'
    }
};

/**
 * 셀 선택기 클래스
 */
export class CellSelector {
    /**
     * @param {Object} viewer - HWPX Viewer 인스턴스
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.cellModes = new Map();  // cellId → mode
        this.isActive = false;
        this.onSelectionChange = null;  // 콜백 함수
        
        // 바인딩
        this._handleCellClick = this._handleCellClick.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
        
        logger.info('🎯 CellSelector initialized');
    }
    
    /**
     * 셀 선택 모드 활성화
     */
    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        this._attachEventListeners();
        this._highlightAllCells();
        this._createOverlay();
        
        logger.info('✅ Cell selection mode activated');
        showToast('info', '템플릿 설정', '셀을 클릭하여 모드를 변경하세요');
    }
    
    /**
     * 셀 선택 모드 비활성화
     */
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this._detachEventListeners();
        this._removeHighlights();
        this._removeOverlay();
        
        logger.info('❌ Cell selection mode deactivated');
    }
    
    /**
     * 토글
     */
    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
        return this.isActive;
    }
    
    /**
     * 이벤트 리스너 등록
     * @private
     */
    _attachEventListeners() {
        // 테이블 셀 클릭 이벤트
        const container = this.viewer.container;
        if (container) {
            container.addEventListener('click', this._handleCellClick, true);
        }
        
        // 키보드 이벤트 (ESC로 종료)
        document.addEventListener('keydown', this._handleKeyDown);
    }
    
    /**
     * 이벤트 리스너 제거
     * @private
     */
    _detachEventListeners() {
        const container = this.viewer.container;
        if (container) {
            container.removeEventListener('click', this._handleCellClick, true);
        }
        document.removeEventListener('keydown', this._handleKeyDown);
    }
    
    /**
     * 셀 클릭 핸들러
     * @private
     */
    _handleCellClick(event) {
        if (!this.isActive) return;
        
        // 테이블 셀 찾기
        const cell = event.target.closest('.table-cell, td');
        if (!cell) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        // 셀 ID 가져오기 또는 생성
        const cellId = this._getCellId(cell);
        
        // 현재 모드 가져오기
        const currentMode = this.cellModes.get(cellId) || CellMode.AUTO;
        
        // 다음 모드로 순환
        const nextMode = this._getNextMode(currentMode);
        
        // 모드 설정
        this.setCellMode(cellId, nextMode, cell);
        
        logger.debug(`Cell ${cellId}: ${currentMode} → ${nextMode}`);
    }
    
    /**
     * 키보드 핸들러
     * @private
     */
    _handleKeyDown(event) {
        if (event.key === 'Escape' && this.isActive) {
            this.deactivate();
        }
    }
    
    /**
     * 셀 ID 생성
     * @private
     */
    _getCellId(cellElement) {
        // data-cell-id가 있으면 사용
        if (cellElement.dataset.cellId) {
            return cellElement.dataset.cellId;
        }
        
        // 없으면 위치 기반으로 생성
        const table = cellElement.closest('.document-table, table');
        if (!table) return `cell-${Date.now()}`;
        
        const tableIndex = Array.from(
            document.querySelectorAll('.document-table, table')
        ).indexOf(table);
        
        const row = cellElement.closest('tr, .table-row');
        const rowIndex = row ? Array.from(row.parentElement.children).indexOf(row) : 0;
        
        const cells = row ? row.querySelectorAll('.table-cell, td') : [];
        const cellIndex = Array.from(cells).indexOf(cellElement);
        
        const cellId = `t${tableIndex}-r${rowIndex}-c${cellIndex}`;
        cellElement.dataset.cellId = cellId;
        
        return cellId;
    }
    
    /**
     * 다음 모드 반환
     * @private
     */
    _getNextMode(currentMode) {
        const modeOrder = [CellMode.AUTO, CellMode.KEEP, CellMode.EDIT, CellMode.GENERATE];
        const currentIndex = modeOrder.indexOf(currentMode);
        const nextIndex = (currentIndex + 1) % modeOrder.length;
        return modeOrder[nextIndex];
    }
    
    /**
     * 셀 모드 설정
     * @param {string} cellId - 셀 ID
     * @param {string} mode - 모드
     * @param {HTMLElement} [cellElement] - 셀 요소 (선택적)
     */
    setCellMode(cellId, mode, cellElement = null) {
        this.cellModes.set(cellId, mode);
        
        // 셀 요소가 없으면 찾기
        if (!cellElement) {
            cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
        }
        
        if (cellElement) {
            this._updateCellVisual(cellElement, mode);
        }
        
        // 콜백 호출
        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelectionSummary());
        }
    }
    
    /**
     * 셀 시각적 업데이트
     * @private
     */
    _updateCellVisual(cellElement, mode) {
        const config = MODE_CONFIG[mode];
        
        // 기존 오버레이 제거
        const existingOverlay = cellElement.querySelector('.cell-mode-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // 배경색 적용
        cellElement.style.backgroundColor = config.bgColor;
        cellElement.style.boxShadow = `inset 0 0 0 2px ${config.borderColor}`;
        cellElement.style.transition = 'all 0.2s ease';
        
        // 모드 오버레이 추가
        const overlay = document.createElement('div');
        overlay.className = 'cell-mode-overlay';
        overlay.innerHTML = `
            <span class="cell-mode-icon">${config.icon}</span>
            <span class="cell-mode-label">${config.label}</span>
        `;
        overlay.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            background: ${config.color};
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 3px;
            z-index: 100;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;
        
        // 셀을 relative로 설정
        if (getComputedStyle(cellElement).position === 'static') {
            cellElement.style.position = 'relative';
        }
        
        cellElement.appendChild(overlay);
    }
    
    /**
     * 모든 셀 하이라이트
     * @private
     */
    _highlightAllCells() {
        const cells = document.querySelectorAll('.table-cell, td');
        
        cells.forEach(cell => {
            // 셀 ID 부여
            const cellId = this._getCellId(cell);
            
            // 기존 모드가 있으면 적용, 없으면 AUTO
            const mode = this.cellModes.get(cellId) || CellMode.AUTO;
            this._updateCellVisual(cell, mode);
            
            // 호버 효과 추가
            cell.classList.add('cell-selectable');
        });
    }
    
    /**
     * 하이라이트 제거
     * @private
     */
    _removeHighlights() {
        const cells = document.querySelectorAll('.table-cell, td');
        
        cells.forEach(cell => {
            // 오버레이 제거
            const overlay = cell.querySelector('.cell-mode-overlay');
            if (overlay) overlay.remove();
            
            // 스타일 초기화
            cell.style.backgroundColor = '';
            cell.style.boxShadow = '';
            cell.classList.remove('cell-selectable');
        });
    }
    
    /**
     * 상단 오버레이 (안내 메시지) 생성
     * @private
     */
    _createOverlay() {
        // 기존 오버레이 제거
        this._removeOverlay();
        
        const overlay = document.createElement('div');
        overlay.id = 'cell-selector-overlay';
        overlay.innerHTML = `
            <div class="cell-selector-header" id="cell-selector-drag-handle">
                <h3>템플릿 설정 <span class="drag-hint">:: 이동</span></h3>
                <button class="cell-minimize-btn" id="cell-selector-minimize" title="최소화">−</button>
            </div>
            <div class="cell-selector-body" id="cell-selector-body">
                <div class="cell-selector-legend">
                    <span class="legend-item">
                        <span class="legend-icon">${MODE_CONFIG[CellMode.AUTO].icon}</span>
                        자동
                    </span>
                    <span class="legend-item">
                        <span class="legend-icon">${MODE_CONFIG[CellMode.KEEP].icon}</span>
                        유지
                    </span>
                    <span class="legend-item">
                        <span class="legend-icon">${MODE_CONFIG[CellMode.EDIT].icon}</span>
                        수정
                    </span>
                    <span class="legend-item">
                        <span class="legend-icon">${MODE_CONFIG[CellMode.GENERATE].icon}</span>
                        생성
                    </span>
                </div>
                <div class="cell-selector-actions">
                    <button id="cell-select-all-keep" class="cell-action-btn keep">— 모두 유지</button>
                    <button id="cell-select-all-edit" class="cell-action-btn edit">/ 모두 수정</button>
                    <button id="cell-select-all-generate" class="cell-action-btn generate">+ 모두 생성</button>
                    <button id="cell-select-reset" class="cell-action-btn reset">× 초기화</button>
                </div>
                <div class="cell-selector-summary" id="cell-selector-summary">
                    선택 현황: 로딩 중...
                </div>
                <div class="cell-selector-footer">
                    <button id="cell-selector-cancel" class="cell-footer-btn cancel">취소</button>
                    <button id="cell-selector-apply" class="cell-footer-btn apply">적용</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 이벤트 바인딩
        this._bindOverlayEvents(overlay);
        
        // 드래그 가능하게 설정
        this._makeDraggable(overlay);
        
        // 요약 업데이트
        this._updateSummary();
    }
    
    /**
     * 드래그 가능하게 만들기
     * @private
     */
    _makeDraggable(overlay) {
        const handle = overlay.querySelector('#cell-selector-drag-handle');
        if (!handle) return;
        
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        const onMouseDown = (e) => {
            // 버튼 클릭은 무시
            if (e.target.tagName === 'BUTTON') return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = overlay.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            
            overlay.style.transition = 'none';
            handle.style.cursor = 'grabbing';
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            
            e.preventDefault();
        };
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newX = initialX + deltaX;
            let newY = initialY + deltaY;
            
            // 화면 경계 체크
            const overlayRect = overlay.getBoundingClientRect();
            const maxX = window.innerWidth - overlayRect.width;
            const maxY = window.innerHeight - overlayRect.height;
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            overlay.style.left = `${newX}px`;
            overlay.style.top = `${newY}px`;
            overlay.style.transform = 'none';
        };
        
        const onMouseUp = () => {
            isDragging = false;
            handle.style.cursor = 'grab';
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        handle.addEventListener('mousedown', onMouseDown);
        handle.style.cursor = 'grab';
    }
    
    /**
     * 오버레이 이벤트 바인딩
     * @private
     */
    _bindOverlayEvents(overlay) {
        // 모두 유지
        overlay.querySelector('#cell-select-all-keep')?.addEventListener('click', () => {
            this.setAllCellsMode(CellMode.KEEP);
        });
        
        // 모두 수정
        overlay.querySelector('#cell-select-all-edit')?.addEventListener('click', () => {
            this.setAllCellsMode(CellMode.EDIT);
        });
        
        // 모두 생성
        overlay.querySelector('#cell-select-all-generate')?.addEventListener('click', () => {
            this.setAllCellsMode(CellMode.GENERATE);
        });
        
        // 초기화
        overlay.querySelector('#cell-select-reset')?.addEventListener('click', () => {
            this.resetAllCells();
        });
        
        // 취소
        overlay.querySelector('#cell-selector-cancel')?.addEventListener('click', () => {
            this.deactivate();
        });
        
        // 적용
        overlay.querySelector('#cell-selector-apply')?.addEventListener('click', () => {
            this._applyAndGenerate();
        });
        
        // 최소화/확장
        const minimizeBtn = overlay.querySelector('#cell-selector-minimize');
        const body = overlay.querySelector('#cell-selector-body');
        
        if (minimizeBtn && body) {
            minimizeBtn.addEventListener('click', () => {
                const isMinimized = body.style.display === 'none';
                
                if (isMinimized) {
                    body.style.display = 'block';
                    minimizeBtn.textContent = '─';
                    minimizeBtn.title = '최소화';
                    overlay.classList.remove('minimized');
                } else {
                    body.style.display = 'none';
                    minimizeBtn.textContent = '□';
                    minimizeBtn.title = '확장';
                    overlay.classList.add('minimized');
                }
            });
        }
    }
    
    /**
     * 오버레이 제거
     * @private
     */
    _removeOverlay() {
        const overlay = document.getElementById('cell-selector-overlay');
        if (overlay) overlay.remove();
    }
    
    /**
     * 모든 셀에 모드 적용
     * @param {string} mode - 적용할 모드
     */
    setAllCellsMode(mode) {
        const cells = document.querySelectorAll('.table-cell, td');
        
        cells.forEach(cell => {
            const cellId = this._getCellId(cell);
            this.setCellMode(cellId, mode, cell);
        });
        
        this._updateSummary();
        showToast('success', '일괄 적용', `모든 셀: ${MODE_CONFIG[mode].label}`);
    }
    
    /**
     * 모든 셀 초기화
     */
    resetAllCells() {
        this.cellModes.clear();
        
        const cells = document.querySelectorAll('.table-cell, td');
        cells.forEach(cell => {
            const cellId = this._getCellId(cell);
            this._updateCellVisual(cell, CellMode.AUTO);
        });
        
        this._updateSummary();
        showToast('info', '초기화', '모든 셀: 자동');
    }
    
    /**
     * 선택 요약 업데이트
     * @private
     */
    _updateSummary() {
        const summary = this.getSelectionSummary();
        const summaryEl = document.getElementById('cell-selector-summary');
        
        if (summaryEl) {
            summaryEl.innerHTML = `
                <span class="summary-item">— 유지 <strong>${summary.keep}</strong></span>
                <span class="summary-divider">·</span>
                <span class="summary-item">/ 수정 <strong>${summary.edit}</strong></span>
                <span class="summary-divider">·</span>
                <span class="summary-item">+ 생성 <strong>${summary.generate}</strong></span>
                <span class="summary-divider">·</span>
                <span class="summary-item">○ 자동 <strong>${summary.auto}</strong></span>
            `;
        }
    }
    
    /**
     * 선택 요약 반환
     * @returns {Object} 요약 정보
     */
    getSelectionSummary() {
        const cells = document.querySelectorAll('.table-cell, td');
        const total = cells.length;
        
        let keep = 0, edit = 0, generate = 0, auto = 0;
        
        cells.forEach(cell => {
            const cellId = this._getCellId(cell);
            const mode = this.cellModes.get(cellId) || CellMode.AUTO;
            
            switch (mode) {
                case CellMode.KEEP: keep++; break;
                case CellMode.EDIT: edit++; break;
                case CellMode.GENERATE: generate++; break;
                default: auto++; break;
            }
        });
        
        return { total, keep, edit, generate, auto };
    }
    
    /**
     * AI 요청용 데이터 생성
     * @returns {Object} AI 요청 데이터
     */
    buildAIRequestData() {
        const document = this.viewer.getDocument();
        if (!document) return null;
        
        const requestData = {
            keepCells: [],      // 유지할 셀 (AI 무시)
            editCells: [],      // 수정할 셀 (기존 내용 포함)
            generateCells: [],  // 생성할 셀 (새 내용 생성)
            autoCells: []       // 자동 감지 셀
        };
        
        const cells = document.querySelectorAll('.table-cell, td');
        
        cells.forEach(cell => {
            const cellId = this._getCellId(cell);
            const mode = this.cellModes.get(cellId) || CellMode.AUTO;
            const content = cell.textContent?.trim() || '';
            
            const cellData = {
                id: cellId,
                content,
                element: cell
            };
            
            // _cellData에서 추가 정보 가져오기
            if (cell._cellData) {
                cellData.path = cell._cellData.path;
                cellData.header = cell._cellData.header;
            }
            
            switch (mode) {
                case CellMode.KEEP:
                    requestData.keepCells.push(cellData);
                    break;
                case CellMode.EDIT:
                    requestData.editCells.push(cellData);
                    break;
                case CellMode.GENERATE:
                    requestData.generateCells.push(cellData);
                    break;
                default:
                    requestData.autoCells.push(cellData);
                    break;
            }
        });
        
        logger.info(`📊 AI Request Data: Keep=${requestData.keepCells.length}, Edit=${requestData.editCells.length}, Generate=${requestData.generateCells.length}, Auto=${requestData.autoCells.length}`);
        
        return requestData;
    }
    
    /**
     * 적용하고 생성 실행
     * @private
     */
    async _applyAndGenerate() {
        const summary = this.getSelectionSummary();
        
        if (summary.generate === 0 && summary.edit === 0 && summary.auto === 0) {
            showToast('warning', '알림', '생성하거나 수정할 셀이 없습니다');
            return;
        }
        
        // 모드 비활성화
        this.deactivate();
        
        // AI 패널의 입력창에 포커스
        const input = document.getElementById('ai-chat-input');
        if (input) {
            input.value = `[템플릿 설정] 선택 영역 기준으로 내용 생성\n유지 ${summary.keep} / 수정 ${summary.edit} / 생성 ${summary.generate}`;
            input.focus();
        }
        
        // 이벤트 발생 (외부에서 처리할 수 있도록)
        const event = new CustomEvent('cellSelectionApplied', {
            detail: {
                summary,
                requestData: this.buildAIRequestData()
            }
        });
        document.dispatchEvent(event);
        
        showToast('success', '적용', '설정 완료. AI 요청을 입력하세요.');
    }
    
    /**
     * 헤더 셀 자동 감지 및 유지 모드 설정
     */
    autoDetectHeaders() {
        const cells = document.querySelectorAll('.table-cell, td');
        
        cells.forEach(cell => {
            const cellId = this._getCellId(cell);
            
            // 첫 번째 행 또는 첫 번째 열은 헤더로 간주
            const row = cell.closest('tr, .table-row');
            const table = cell.closest('table, .document-table');
            
            if (row && table) {
                const rows = table.querySelectorAll('tr, .table-row');
                const rowIndex = Array.from(rows).indexOf(row);
                
                const cellsInRow = row.querySelectorAll('.table-cell, td');
                const cellIndex = Array.from(cellsInRow).indexOf(cell);
                
                // 첫 번째 행 또는 첫 번째 열은 유지
                if (rowIndex === 0 || cellIndex === 0) {
                    this.setCellMode(cellId, CellMode.KEEP, cell);
                } else {
                    // 나머지는 생성
                    this.setCellMode(cellId, CellMode.GENERATE, cell);
                }
            }
        });
        
        this._updateSummary();
        showToast('info', '자동 감지', '헤더: 유지 / 내용: 생성');
    }
    
    /**
     * 현재 상태 저장 (JSON)
     * @returns {string} JSON 문자열
     */
    saveState() {
        const state = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            cellModes: Object.fromEntries(this.cellModes)
        };
        return JSON.stringify(state, null, 2);
    }
    
    /**
     * 상태 불러오기
     * @param {string} jsonString - JSON 문자열
     */
    loadState(jsonString) {
        try {
            const state = JSON.parse(jsonString);
            
            if (state.cellModes) {
                this.cellModes = new Map(Object.entries(state.cellModes));
                
                // 시각적 업데이트
                if (this.isActive) {
                    this._highlightAllCells();
                }
                
                logger.info(`✅ Loaded ${this.cellModes.size} cell modes`);
                showToast('success', '불러오기 완료', `${this.cellModes.size}개 셀 설정 불러옴`);
            }
        } catch (error) {
            logger.error('❌ Failed to load state:', error);
            showToast('error', '오류', '설정 불러오기 실패');
        }
    }
}

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.CellSelector = CellSelector;
    window.CellMode = CellMode;
}

export default CellSelector;

