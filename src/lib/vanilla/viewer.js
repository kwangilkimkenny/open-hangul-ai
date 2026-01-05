/**
 * HWPX Viewer
 * 메인 진입점 - 모든 모듈 통합
 * 
 * @module viewer
 * @version 2.0.0
 */

// Core modules
import { HWPXConstants } from './core/constants.js';
import { SimpleHWPXParser } from './core/parser.js';
import { WorkerManager } from './core/worker-manager.js';
import { DocumentRenderer } from './core/renderer.js';
import { AIDocumentController } from './ai/ai-controller.js';
import { ChatPanel } from './ui/chat-panel.js';
import { ContextMenu } from './ui/context-menu.js';
import { SearchDialog } from './ui/search-dialog.js';
import { InlineEditor } from './features/inline-editor.js';
import { HistoryManager } from './features/history-manager.js';
import { HistoryManagerV2 } from './features/history-manager-v2.js';
import { EditModeManager } from './features/edit-mode-manager.js';
import { Command } from './command/command.js';
import { CommandAdapt } from './command/command-adapt.js';
import { HwpxExporter } from './export/hwpx-exporter.js';
import { AutoSaveManager } from './features/autosave-manager.js';
import { TableEditor } from './features/table-editor.js';
import { ImageEditor } from './features/image-editor.js';
import { ShapeEditor } from './features/shape-editor.js';
import { AdvancedSearch } from './features/advanced-search.js';
import { BookmarkManager } from './features/bookmark-manager.js';
import { ThemeManager } from './ui/theme-manager.js';
import { PositionManager } from './features/position-manager.js';
import { RangeManager } from './features/range-manager.js';
import { SearchManager } from './features/search-manager.js';
import { Cursor } from './features/cursor.js';

// Utils
import { getLogger, resetLogger } from './utils/logger.js';
import { formatFileSize, formatDate } from './utils/format.js';
import { ErrorType, HWPXError, getErrorHandler } from './utils/error.js';
import {
    showToast,
    showLoading,
    updateStatus,
    showProgress,
    showConfirm,
    showAlert
} from './utils/ui.js';

// Renderers (일부는 DocumentRenderer 내부에서 사용)
// import {
//     renderParagraph,
//     renderImage,
//     renderTable,
//     renderShape,
//     renderContainer
// } from './renderers/index.js';

const logger = getLogger();

/**
 * HWPX 뷰어 클래스
 * 
 * @class HWPXViewer
 * 
 * @example
 * const viewer = new HWPXViewer({
 *   container: '#viewer',
 *   onLoad: (doc) => console.log('Loaded:', doc),
 *   onError: (err) => console.error('Error:', err)
 * });
 * 
 * await viewer.loadFile(file);
 */
export class HWPXViewer {
    /**
     * HWPXViewer 생성자
     * @param {Object} [options={}] - 뷰어 옵션
     * @param {string|HTMLElement} [options.container] - 컨테이너 선택자 또는 요소
     * @param {Function} [options.onLoad] - 문서 로드 완료 콜백
     * @param {Function} [options.onError] - 에러 발생 콜백
     * @param {Object} [options.parserOptions] - 파서 옵션
     */
    constructor(options = {}) {
        this.options = {
            container: options.container || '#hwpx-viewer',
            onLoad: options.onLoad || null,
            onError: options.onError || null,
            onProgress: options.onProgress || null,
            useWorker: options.useWorker !== false, // 기본값: Worker 사용
            enableAI: options.enableAI !== false, // AI 기능 활성화 (기본값: true)
            parserOptions: options.parserOptions || {}
        };

        // Container 초기화
        this.container = typeof this.options.container === 'string'
            ? document.querySelector(this.options.container)
            : this.options.container;

        if (!this.container) {
            throw new Error('Container not found');
        }

        // 파서 생성
        this.parser = new SimpleHWPXParser(this.options.parserOptions);

        // 렌더러 생성
        this.renderer = new DocumentRenderer(this.container, {
            enableAutoPagination: options.enableAutoPagination !== false,
            enableLazyLoading: options.enableLazyLoading !== false
        });

        // Exporter 생성 (수동 편집용 전체 재생성)
        this.fullExporter = new HwpxExporter();

        // Worker Manager (지원되는 경우에만)
        this.workerManager = null;
        if (this.options.useWorker && WorkerManager.isSupported()) {
            this.workerManager = new WorkerManager();
            logger.info('Worker mode enabled');
        } else {
            logger.info('Main thread parsing mode');
        }

        // AI Controller & UI (활성화된 경우)
        this.aiController = null;
        this.chatPanel = null;
        this.contextMenu = null;
        this.searchDialog = null;
        
        // 편집 기능 (항상 활성화)
        this.inlineEditor = null;
        this.historyManager = null;
        this.editModeManager = null;
        this.tableEditor = null;
        this.imageEditor = null;
        this.shapeEditor = null;
        this.search = null;
        this.bookmarkManager = null;
        this.themeManager = null;
        this.positionManager = null;
        this.rangeManager = null;
        this.searchManager = null;
        this.cursor = null;
        this.command = null;
        this.commandAdapt = null;
        
        logger.info(`🔧 enableAI option: ${this.options.enableAI}`);
        
        if (this.options.enableAI) {
            try {
                logger.info('🚀 Initializing AI Controller...');
                this.aiController = new AIDocumentController(this);
                logger.info('✅ AI Controller initialized');
                
                // Chat Panel 초기화
                logger.info('🚀 Initializing Chat Panel...');
                this.chatPanel = new ChatPanel(this.aiController);
                this.chatPanel.init();
                logger.info('✅ Chat Panel initialized');
                
                // Context Menu 초기화 (생성자에서 자동 초기화됨)
                logger.info('🚀 Initializing Context Menu...');
                this.contextMenu = new ContextMenu();
                logger.info('✅ Context Menu initialized');
                
            } catch (error) {
                logger.error('❌ Failed to initialize AI features:', error);
                logger.error('Error details:', error.message, error.stack);
                this.options.enableAI = false;
            }
        } else {
            logger.warn('⚠️ AI features disabled (enableAI = false)');
        }
        
        // 편집 기능 초기화 (AI와 독립적으로 작동)
        try {
            logger.info('🚀 Initializing editing features...');

            this.positionManager = new PositionManager(this);
            logger.info('✅ PositionManager initialized');

            this.rangeManager = new RangeManager(this);
            logger.info('✅ RangeManager initialized');

            this.searchManager = new SearchManager(this);
            logger.info('✅ SearchManager initialized');

            this.cursor = new Cursor(this);
            logger.info('✅ Cursor initialized');

            // HistoryManager V2 (함수 기반)
            this.historyManager = new HistoryManagerV2(this);
            logger.info('✅ HistoryManagerV2 initialized (function-based)');

            // Command 시스템
            this.commandAdapt = new CommandAdapt(this);
            this.command = new Command(this.commandAdapt);
            logger.info('✅ Command system initialized');

            // Search Dialog 초기화
            this.searchDialog = new SearchDialog(this);
            logger.info('✅ SearchDialog initialized');

            this.inlineEditor = new InlineEditor(this);
            logger.info('✅ InlineEditor initialized');

            this.editModeManager = new EditModeManager(this.inlineEditor);
            logger.info('✅ EditModeManager initialized');

            this.tableEditor = new TableEditor(this);
            logger.info('✅ TableEditor initialized');

            this.imageEditor = new ImageEditor(this);
            logger.info('✅ ImageEditor initialized');

            this.shapeEditor = new ShapeEditor(this);
            logger.info('✅ ShapeEditor initialized');

            this.search = new AdvancedSearch();
            logger.info('✅ AdvancedSearch initialized');

            this.bookmarkManager = new BookmarkManager();
            logger.info('✅ BookmarkManager initialized');

            this.themeManager = new ThemeManager();
            logger.info('✅ ThemeManager initialized');
            
            // ✅ 전역으로 노출 (InlineEditor가 참조할 수 있도록)
            if (typeof window !== 'undefined') {
                window.editModeManager = this.editModeManager;
                logger.info('✅ EditModeManager exposed globally');
            }
            
            // 테이블 우클릭 컨텍스트 메뉴 설정
            this._setupTableContextMenu();
            
        } catch (error) {
            logger.error('❌ Failed to initialize editing features:', error);
            logger.error('Error details:', error.message, error.stack);
        }
        
        // 자동저장 관리자 초기화
        this.autoSaveManager = null;
        try {
            this.autoSaveManager = new AutoSaveManager(this, {
                interval: 30000, // 30초
                onSave: (info) => {
                    updateStatus(`자동저장: ${info.fileName}`);
                    showToast('info', '자동저장', `${info.fileName} 저장됨`);
                }
            });
            this.autoSaveManager.initialize().then(() => {
                this.autoSaveManager.enableAutoSave();
                logger.info('✅ AutoSaveManager initialized and enabled');
                
                // 충돌 복구 확인
                this.autoSaveManager.detectCrashRecovery().then(recovery => {
                    if (recovery) {
                        const message = recovery.isCrashRecovery 
                            ? '이전 작업이 비정상 종료되었습니다. 복구하시겠습니까?'
                            : '저장되지 않은 작업이 있습니다. 복구하시겠습니까?';
                        
                        if (confirm(message)) {
                            this.autoSaveManager.performCrashRecovery();
                        }
                    }
                });
            });
        } catch (error) {
            logger.error('❌ Failed to initialize AutoSaveManager:', error);
        }

        // 상태
        this.state = {
            document: null,
            isLoading: false,
            currentFile: null,
            parseProgress: 0
        };

        // ✅ Viewer를 전역으로 노출 (디버깅 및 수동 조작용)
        if (typeof window !== 'undefined') {
            window.viewer = this;
            logger.info('✅ Viewer exposed globally as window.viewer');
        }

        logger.info(`🚀 HWPX Viewer initialized (container: ${this.options.container})`);
    }

    /**
     * 파일 로드
     * @param {File|ArrayBuffer} file - HWPX 파일 또는 ArrayBuffer
     * @returns {Promise<Object>} 파싱된 문서
     * 
     * @example
     * const doc = await viewer.loadFile(file);
     * console.log('Sections:', doc.sections.length);
     */
    async loadFile(file) {
        if (this.state.isLoading) {
            throw new Error('Already loading a file');
        }

        this.state.isLoading = true;
        this.state.parseProgress = 0;
        showLoading(true, '문서 로딩 중...');
        updateStatus('로딩 중...');

        try {
            // ArrayBuffer 변환
            const buffer = file instanceof ArrayBuffer 
                ? file 
                : await file.arrayBuffer();

            logger.time('Total Load Time');

            // 파싱 (Worker 또는 Main Thread)
            let document;
            
            if (this.workerManager && this.options.useWorker) {
                // Worker 초기화 (필요시)
                if (!this.workerManager.isReady) {
                    await this.workerManager.initialize();
                }

                // Worker에서 파싱
                document = await this.workerManager.parseHWPX(buffer, (progress) => {
                    this.state.parseProgress = progress.percent;
                    updateStatus(`${progress.message} (${Math.round(progress.percent)}%)`);
                    
                    if (this.options.onProgress) {
                        this.options.onProgress(progress);
                    }
                    
                    showProgress(progress.percent, progress.message);
                });
            } else {
                // Main thread에서 파싱
                document = await this.parser.parse(buffer);
            }

            logger.timeEnd('Total Load Time');

            // 상태 업데이트
            this.state.document = document;
            this.state.currentFile = file;
            
            logger.info(`📁 Current file stored: ${file?.name || 'ArrayBuffer'}`);
            logger.info(`  - File type: ${file?.constructor?.name || typeof file}`);

            // 렌더링
            await this.render(document);

            // ✅ 편집 기능 활성화 (렌더링 후 약간의 딜레이를 두고 실행)
            if (this.inlineEditor) {
                setTimeout(() => {
                    this._enableEditingFeatures();
                }, 100);
            }

            // 콜백 호출
            if (this.options.onLoad) {
                this.options.onLoad(document);
            }

            showLoading(false);
            updateStatus('준비됨');
            showToast('success', '성공', '문서를 성공적으로 불러왔습니다.');

            return document;

        } catch (error) {
            logger.error('Failed to load file:', error);
            
            if (this.options.onError) {
                this.options.onError(error);
            }

            showLoading(false);
            updateStatus('오류 발생');
            showToast('error', '오류', error.message || '문서를 불러오는데 실패했습니다.');

            throw error;

        } finally {
            this.state.isLoading = false;
            this.state.parseProgress = 0;
        }
    }

    /**
     * 문서 렌더링 (v2.0 - 완전한 렌더링 파이프라인 사용)
     * @param {Object} document - 파싱된 문서
     * @returns {Promise<void>}
     * @private
     */
    async render(document) {
        // DocumentRenderer를 사용하여 완전한 렌더링 수행
        // (페이지 컨테이너, 헤더, 푸터, 페이지 번호, 자동 페이지 나누기 등)
        const totalPages = await this.renderer.render(document);

        logger.info(`✅ Rendered ${document.sections?.length || 0} sections, ${totalPages} pages`);

        // 위치 정보 수집
        if (this.positionManager) {
            try {
                await this.positionManager.computePositions(this.container);

                // 통계 정보 출력
                const stats = this.positionManager.getStats();
                logger.info(`📊 Position Stats: ${stats.totalCharacters} chars, ${stats.pages} pages, ${stats.paragraphs} paragraphs, ${stats.tableCells} cells`);
            } catch (error) {
                logger.error('❌ Failed to compute positions:', error);
            }
        }
    }

    /**
     * 현재 문서 가져오기
     * @returns {Object|null} 현재 문서
     */
    getDocument() {
        return this.state.document;
    }

    /**
     * 문서 업데이트 및 재렌더링 (v2.2.2 - AI 통합)
     * @param {Object} document - 업데이트할 문서
     * @returns {Promise<void>}
     */
    async updateDocument(document) {
        logger.info('🔄 Updating document...');
        
        // 🔥 디버깅: 업데이트 전 DOM 상태
        const beforeDom = this.container.innerHTML.substring(0, 200);
        logger.debug(`Before update - DOM sample: "${beforeDom}..."`);
        
        // 🔥 디버깅: 업데이트할 문서 샘플
        if (document.sections && document.sections[0]) {
            const firstTable = document.sections[0].elements.find(e => e.type === 'table');
            if (firstTable && firstTable.rows) {
                logger.debug('Document to render - First row sample:');
                const firstRow = firstTable.rows[0];
                firstRow.cells.forEach((cell, idx) => {
                    const text = cell?.elements?.[0]?.runs?.[0]?.text;
                    logger.debug(`  Cell ${idx}: "${text ? text.substring(0, 40) : '(empty)'}..."`);
                });
            }
        }
        
        // 1. 상태 먼저 업데이트 (중요!)
        this.state.document = document;
        logger.debug('✓ State updated');
        
        // 2. 렌더링
        await this.render(document);
        logger.debug('✓ Render completed');
        
        // 🔥 디버깅: 업데이트 후 DOM 상태
        const afterDom = this.container.innerHTML.substring(0, 200);
        logger.debug(`After update - DOM sample: "${afterDom}..."`);
        
        // 🔥 디버깅: 실제 렌더링된 텍스트 확인
        const renderedTables = this.container.querySelectorAll('table');
        logger.debug(`Found ${renderedTables.length} tables in DOM`);
        if (renderedTables.length > 0) {
            const firstTable = renderedTables[0];
            const firstCell = firstTable.querySelector('td');
            if (firstCell) {
                logger.debug(`First cell text: "${firstCell.textContent.substring(0, 50)}..."`);
            }
        }
        
        logger.info('✅ Document updated and re-rendered');
    }

    /**
     * 편집 기능 활성화 (렌더링 후 자동 호출)
     * @private
     */
    _enableEditingFeatures() {
        if (!this.inlineEditor) {
            logger.warn('⚠️ InlineEditor not available');
            return;
        }

        try {
            logger.info('🎯 Enabling editing features...');

            // 클릭-투-포지션 기능 활성화
            this._setupClickToPosition();

            // 범위 선택 기능 활성화
            if (this.rangeManager) {
                this.rangeManager.enableSelection();
                logger.info('  ✅ Range selection enabled');
            }

            // 테이블 편집 활성화
            const tables = this.container.querySelectorAll('.hwp-table');
            logger.info(`  - Found ${tables.length} tables`);
            
            let tablesWithData = 0;
            let tablesWithoutData = 0;
            
            tables.forEach((table, index) => {
                const tableData = table._tableData;
                logger.debug(`  - Table ${index}: Has data = ${!!tableData}`);
                
                if (tableData) {
                    tablesWithData++;
                    this.inlineEditor.enableTableEditing(table, tableData);
                } else {
                    tablesWithoutData++;
                    logger.warn(`  - Table ${index}: No _tableData attached, attempting to find from document`);
                    
                    // 문서에서 테이블 데이터 찾기 시도
                    if (this.state.document && this.state.document.sections) {
                        const foundTableData = this._findTableDataByIndex(index);
                        if (foundTableData) {
                            logger.info(`  - ✅ Found table data from document for table ${index}`);
                            table._tableData = foundTableData;
                            this.inlineEditor.enableTableEditing(table, foundTableData);
                            tablesWithData++;
                            tablesWithoutData--;
                        }
                    }
                }
            });
            
            logger.info(`  - Tables with data: ${tablesWithData}, without data: ${tablesWithoutData}`);

            // 단락 편집 활성화 (모든 단락, 테이블 외부만)
            const allParagraphs = this.container.querySelectorAll('.hwp-paragraph');
            const editableParagraphs = Array.from(allParagraphs).filter(para => {
                // 테이블 내부 단락 제외
                return !para.closest('.hwp-table');
            });
            
            logger.info(`  - Found ${editableParagraphs.length} editable paragraphs (out of ${allParagraphs.length} total)`);
            
            if (editableParagraphs.length > 0) {
                // editable-paragraph 클래스 추가
                editableParagraphs.forEach(para => {
                    para.classList.add('editable-paragraph');
                });
                this.inlineEditor.enableParagraphEditing(editableParagraphs);
            }

            logger.info('✅ Editing features enabled');

        } catch (error) {
            logger.error('❌ Failed to enable editing features:', error);
            logger.error('Error details:', error.message, error.stack);
        }
    }
    
    /**
     * 클릭-투-포지션 기능 설정
     * @private
     */
    _setupClickToPosition() {
        if (!this.positionManager || !this.positionManager.isPositionReady()) {
            logger.warn('⚠️ PositionManager not ready for click-to-position');
            return;
        }

        // 클릭 이벤트 리스너 추가 (Ctrl+Shift+Click으로 위치 정보 확인)
        this.container.addEventListener('click', (e) => {
            // Ctrl+Shift+Click으로 디버그 모드
            if (e.ctrlKey && e.shiftKey) {
                e.preventDefault();

                const position = this.positionManager.getPositionByXY(e.clientX, e.clientY);

                if (position) {
                    logger.info('📍 Click-to-Position Debug Info:');
                    logger.info(`  - Character: "${position.value}" (${position.isWhitespace ? 'whitespace' : 'visible'})`);
                    logger.info(`  - Index: ${position.index}`);
                    logger.info(`  - Page: ${position.pageNumber}`);
                    logger.info(`  - Element Type: ${position.elementType}`);
                    logger.info(`  - Coordinate:`, position.coordinate);

                    // 시각적 하이라이트
                    if (position.parentElement) {
                        const originalBg = position.parentElement.style.backgroundColor;
                        position.parentElement.style.backgroundColor = 'yellow';
                        setTimeout(() => {
                            position.parentElement.style.backgroundColor = originalBg;
                        }, 500);
                    }

                    // 콘솔에 position 객체 전체 출력
                    console.log('Position Object:', position);
                } else {
                    logger.warn('⚠️ No position found at click location');
                }
            }
        });

        logger.info('✅ Click-to-position enabled (Ctrl+Shift+Click to debug)');
    }

    /**
     * 인덱스로 테이블 데이터 찾기
     * @private
     */
    _findTableDataByIndex(tableIndex) {
        if (!this.state.document || !this.state.document.sections) {
            return null;
        }
        
        let currentIndex = 0;
        
        for (const section of this.state.document.sections) {
            if (section.elements) {
                for (const element of section.elements) {
                    if (element.type === 'table') {
                        if (currentIndex === tableIndex) {
                            return element;
                        }
                        currentIndex++;
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * DOM의 변경사항을 document에 동기화 (강제 동기화)
     * @private
     */
    _syncDocumentFromDOM() {
        if (!this.state.document) {
            logger.warn('⚠️ No document to sync');
            return {
                updatedCells: 0,
                updatedParagraphs: 0,
                checkedCells: 0,
                checkedParagraphs: 0
            };
        }

        let cellsChecked = 0;
        let cellsUpdated = 0;
        let paragraphsChecked = 0;
        let paragraphsUpdated = 0;

        try {
            // 1. 테이블 셀 강제 동기화
            const tables = this.container.querySelectorAll('.hwp-table');
            logger.info(`  🔍 Checking ${tables.length} tables...`);
            
            tables.forEach((tableElement, tableIndex) => {
                const cells = tableElement.querySelectorAll('td, th');
                
                cells.forEach((cell, cellIndex) => {
                    const cellData = cell._cellData;
                    if (!cellData) {
                        logger.debug(`  ⚠️ Table ${tableIndex}, Cell ${cellIndex}: No cellData`);
                        return;
                    }
                    
                    cellsChecked++;
                    const currentText = this._extractTextFromElement(cell);
                    const originalText = this._extractTextFromCellData(cellData);
                    
                    // ✅ 강제 업데이트: textContent가 다르면 무조건 업데이트
                    if (currentText !== originalText) {
                        logger.info(`  📝 Cell [${tableIndex},${cellIndex}]: "${originalText.substring(0, 30)}..." → "${currentText.substring(0, 30)}..."`);
                        this._updateCellDataFromText(cellData, currentText);
                        cellsUpdated++;
                    }
                });
            });

            // 2. 단락 강제 동기화
            const paragraphs = this.container.querySelectorAll('.hwp-paragraph.editable-paragraph');
            logger.info(`  🔍 Checking ${paragraphs.length} paragraphs...`);
            
            paragraphs.forEach((para, paraIndex) => {
                const paraData = para._paraData;
                if (!paraData) {
                    logger.debug(`  ⚠️ Paragraph ${paraIndex}: No paraData`);
                    return;
                }
                
                paragraphsChecked++;
                const currentText = this._extractTextFromElement(para);
                const originalText = this._extractTextFromParaData(paraData);
                
                // ✅ 강제 업데이트: textContent가 다르면 무조건 업데이트
                if (currentText !== originalText) {
                    logger.info(`  📝 Paragraph ${paraIndex}: "${originalText.substring(0, 30)}..." → "${currentText.substring(0, 30)}..."`);
                    this._updateParaDataFromText(paraData, currentText);
                    paragraphsUpdated++;
                }
            });

            logger.info(`✅ Sync complete: ${cellsUpdated}/${cellsChecked} cells, ${paragraphsUpdated}/${paragraphsChecked} paragraphs updated`);

            if (cellsUpdated === 0 && paragraphsUpdated === 0 && (cellsChecked > 0 || paragraphsChecked > 0)) {
                logger.info('  ℹ️ No changes detected - all content already synchronized');
            }

            // ✅ 결과 반환
            return {
                updatedCells: cellsUpdated,
                updatedParagraphs: paragraphsUpdated,
                checkedCells: cellsChecked,
                checkedParagraphs: paragraphsChecked
            };

        } catch (error) {
            logger.error('❌ Failed to sync document from DOM:', error);
            logger.error('Error details:', error.message, error.stack);
            
            // 에러 시에도 결과 반환
            return {
                updatedCells: 0,
                updatedParagraphs: 0,
                checkedCells: cellsChecked,
                checkedParagraphs: paragraphsChecked
            };
        }
    }

    /**
     * 요소에서 텍스트 추출
     * @private
     */
    _extractTextFromElement(element) {
        return element.textContent || '';
    }

    /**
     * 셀 데이터에서 텍스트 추출
     * @private
     */
    _extractTextFromCellData(cellData) {
        if (!cellData.elements || cellData.elements.length === 0) {
            return '';
        }

        let text = '';
        cellData.elements.forEach(element => {
            if (element.type === 'paragraph' && element.runs) {
                element.runs.forEach(run => {
                    if (run.text) {
                        text += run.text;
                    } else if (run.type === 'linebreak') {
                        text += '\n';
                    }
                });
            }
        });
        return text;
    }

    /**
     * 단락 데이터에서 텍스트 추출
     * @private
     */
    _extractTextFromParaData(paraData) {
        if (!paraData.runs || paraData.runs.length === 0) {
            return '';
        }

        let text = '';
        paraData.runs.forEach(run => {
            if (run.text) {
                text += run.text;
            } else if (run.type === 'linebreak') {
                text += '\n';
            }
        });
        return text;
    }

    /**
     * 텍스트로 셀 데이터 업데이트
     * @private
     */
    _updateCellDataFromText(cellData, newText) {
        if (!cellData.elements || cellData.elements.length === 0) {
            cellData.elements = [{
                type: 'paragraph',
                runs: []
            }];
        }

        const paragraph = cellData.elements[0];
        paragraph.runs = [];

        // 줄바꿈 처리
        const lines = newText.split('\n');
        lines.forEach((line, idx) => {
            if (idx > 0) {
                paragraph.runs.push({ type: 'linebreak' });
            }
            if (line) {
                paragraph.runs.push({ text: line });
            }
        });
    }

    /**
     * 텍스트로 단락 데이터 업데이트
     * @private
     */
    _updateParaDataFromText(paraData, newText) {
        paraData.runs = [];

        // 줄바꿈 처리
        const lines = newText.split('\n');
        lines.forEach((line, idx) => {
            if (idx > 0) {
                paraData.runs.push({ type: 'linebreak' });
            }
            if (line) {
                paraData.runs.push({ text: line });
            }
        });
    }

    /**
     * 총 페이지 수 가져오기
     * @returns {number} 총 페이지 수
     */
    getTotalPages() {
        return this.renderer.getTotalPages();
    }

    /**
     * PositionManager 가져오기
     * @returns {PositionManager|null} PositionManager 인스턴스
     */
    getPositionManager() {
        return this.positionManager;
    }

    /**
     * RangeManager 가져오기
     * @returns {RangeManager|null} RangeManager 인스턴스
     */
    getRangeManager() {
        return this.rangeManager;
    }

    /**
     * Command 가져오기
     * @returns {Command|null} Command 인스턴스
     */
    getCommand() {
        return this.command;
    }

    /**
     * Cursor 가져오기
     * @returns {Cursor|null} Cursor 인스턴스
     */
    getCursor() {
        return this.cursor;
    }

    /**
     * SearchManager 가져오기
     * @returns {SearchManager|null} SearchManager 인스턴스
     */
    getSearchManager() {
        return this.searchManager;
    }

    /**
     * 텍스트 검색 (위치 기반)
     * @param {string} searchText - 검색할 텍스트
     * @param {boolean} caseSensitive - 대소문자 구분 여부
     * @returns {Array} 검색 결과 [{startIndex, endIndex, text}]
     */
    searchText(searchText, caseSensitive = false) {
        if (!this.positionManager) {
            logger.warn('⚠️ PositionManager not available');
            return [];
        }

        return this.positionManager.searchText(searchText, caseSensitive);
    }

    /**
     * 범위 하이라이트
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     * @param {string} color - 하이라이트 색상
     */
    highlightRange(startIndex, endIndex, color = 'yellow') {
        if (!this.positionManager) {
            logger.warn('⚠️ PositionManager not available');
            return;
        }

        this.positionManager.highlightRange(startIndex, endIndex, color);
    }

    /**
     * 하이라이트 제거
     */
    clearHighlight() {
        if (!this.positionManager) {
            return;
        }

        this.positionManager.clearHighlight();
    }

    /**
     * 선택된 텍스트 가져오기
     * @returns {string} 선택된 텍스트
     */
    getSelectedText() {
        if (!this.rangeManager) {
            logger.warn('⚠️ RangeManager not available');
            return '';
        }

        return this.rangeManager.getSelectedText();
    }

    /**
     * 범위 설정
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     */
    setRange(startIndex, endIndex) {
        if (!this.rangeManager) {
            logger.warn('⚠️ RangeManager not available');
            return;
        }

        this.rangeManager.setRange(startIndex, endIndex);
    }

    /**
     * 선택 해제
     */
    clearSelection() {
        if (!this.rangeManager) {
            return;
        }

        this.rangeManager.clearSelection();
    }

    /**
     * 전체 선택
     */
    selectAll() {
        if (!this.rangeManager) {
            logger.warn('⚠️ RangeManager not available');
            return;
        }

        this.rangeManager.selectAll();
    }

    /**
     * 선택 범위에 포맷 적용
     * @param {string} format - 포맷 타입 ('bold', 'italic', 'underline', 'color')
     * @param {*} value - 포맷 값
     */
    applyFormat(format, value = true) {
        if (!this.rangeManager) {
            logger.warn('⚠️ RangeManager not available');
            return;
        }

        this.rangeManager.applyFormat(format, value);
    }

    /**
     * HWPX 파일 저장 (원본 기반 안전한 저장)
     * @param {string} filename - 저장할 파일명 (기본값: 원본 파일명)
     * @returns {Promise<Object>} 저장 결과
     */
    async saveFile(filename) {
        logger.info('💾 saveFile called');
        logger.info(`  - currentFile: ${this.state.currentFile?.name}`);
        logger.info(`  - aiController: ${!!this.aiController}`);
        
        if (!this.state.currentFile) {
            throw new Error('저장할 파일이 없습니다. 먼저 파일을 로드해주세요.');
        }

        if (!this.aiController) {
            throw new Error('AI Controller가 초기화되지 않아 저장 기능을 사용할 수 없습니다.');
        }

        // ✅ 1단계: 현재 편집 중인 셀 강제 저장
        if (this.inlineEditor && this.inlineEditor.isEditing()) {
            logger.info('💾 Saving currently editing cell...');
            this.inlineEditor.finishEditing();
        }

        // ✅ 2단계: DOM의 모든 변경사항을 document에 강제 동기화
        logger.info('🔄 Syncing ALL changes from DOM to document...');
        const { updatedCells, updatedParagraphs } = this._syncDocumentFromDOM();
        logger.info(`✅ Sync complete: ${updatedCells} cells, ${updatedParagraphs} paragraphs updated`);

        const targetFilename = filename || this.state.currentFile.name;
        logger.info(`  - Saving as: ${targetFilename}`);
        
        // ✅ 3단계: 원본 기반 안전한 저장 (HwpxSafeExporter 사용)
        logger.info('🔧 Using SAFE EXPORT mode (original HWPX + modified content)');
        
        try {
            const result = await this.aiController.saveAsHwpx(targetFilename);
            
            if (result && result.success) {
                logger.info('✅ HWPX 파일 저장 완료 (안전 모드)');
            } else {
                logger.error('❌ HWPX 파일 저장 실패:', result?.message || '알 수 없는 오류');
            }
            
            return result;
        } catch (error) {
            logger.error('❌ HWPX 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 문서 인쇄
     */
    printDocument() {
        logger.info('🖨️ Printing document...');
        window.print();
    }

    /**
     * 뷰어 리셋
     */
    reset() {
        this.renderer.reset();
        this.state.document = null;
        this.state.currentFile = null;
        this.parser.reset();

        if (this.positionManager) {
            this.positionManager.reset();
        }

        if (this.rangeManager) {
            this.rangeManager.reset();
        }

        logger.info('🔄 Viewer reset');
    }

    /**
     * 리소스 정리
     */
    destroy() {
        this.reset();
        this.parser.cleanup();

        // Worker 종료
        if (this.workerManager) {
            this.workerManager.terminate();
        }

        // 자동저장 정리
        if (this.autoSaveManager) {
            this.autoSaveManager.dispose();
        }

        // RangeManager 정리
        if (this.rangeManager) {
            this.rangeManager.destroy();
        }

        // Cursor 정리
        if (this.cursor) {
            this.cursor.destroy();
        }

        logger.info('🗑️ Viewer destroyed');
    }
    
    /**
     * 테이블 우클릭 컨텍스트 메뉴 설정
     * @private
     */
    _setupTableContextMenu() {
        if (!this.contextMenu || !this.tableEditor) {
            logger.warn('⚠️ Cannot setup table context menu - missing dependencies');
            return;
        }
        
        // 테이블 셀에 우클릭 이벤트 추가
        this.container.addEventListener('contextmenu', (e) => {
            const cell = e.target.closest('.hwp-table td, .hwp-table th');
            if (!cell) return;
            
            // 글로벌 편집 모드가 아니면 기본 메뉴 허용
            if (window.editModeManager && !window.editModeManager.isGlobalEditMode) {
                return;
            }
            
            e.preventDefault();
            
            const menuItems = [
                {
                    icon: '✏️',
                    label: '셀 편집',
                    shortcut: 'Click',
                    action: (target) => {
                        const cellData = target._cellData;
                        if (cellData && this.inlineEditor) {
                            this.inlineEditor.enableEditMode(target, cellData);
                        }
                    }
                },
                { separator: true },
                {
                    icon: '⬆️',
                    label: '위에 행 추가',
                    action: (target) => this.tableEditor.addRowAbove(target)
                },
                {
                    icon: '⬇️',
                    label: '아래에 행 추가',
                    action: (target) => this.tableEditor.addRowBelow(target)
                },
                {
                    icon: '⬅️',
                    label: '왼쪽에 열 추가',
                    action: (target) => this.tableEditor.addColumnLeft(target)
                },
                {
                    icon: '➡️',
                    label: '오른쪽에 열 추가',
                    action: (target) => this.tableEditor.addColumnRight(target)
                },
                { separator: true },
                {
                    icon: '🗑️',
                    label: '행 삭제',
                    action: (target) => this.tableEditor.deleteRow(target)
                },
                {
                    icon: '🗑️',
                    label: '열 삭제',
                    action: (target) => this.tableEditor.deleteColumn(target)
                },
                { separator: true },
                {
                    icon: '📋',
                    label: '복사',
                    shortcut: 'Ctrl+C',
                    action: (target) => {
                        const text = target.textContent || '';
                        this.contextMenu.copyToClipboard(text);
                    }
                },
                {
                    icon: '📋',
                    label: '붙여넣기',
                    shortcut: 'Ctrl+V',
                    action: async (target) => {
                        const text = await this.contextMenu.pasteFromClipboard();
                        if (text && target) {
                            target.textContent = text;
                            if (this.autoSaveManager) {
                                this.autoSaveManager.markDirty();
                            }
                        }
                    }
                },
                { separator: true },
                {
                    icon: '🧹',
                    label: '내용 비우기',
                    shortcut: 'Delete',
                    action: (target) => {
                        try {
                            logger.info(`🧹 셀 내용 비우기 시작`, target);
                            
                            const cellData = target._cellData;
                            if (!cellData) {
                                logger.info(`📝 셀에 _cellData가 없음, textContent만 비움`);
                                target.textContent = '';
                                if (this.autoSaveManager) {
                                    this.autoSaveManager.markDirty();
                                }
                                return;
                            }
                            
                            logger.info(`📦 셀 데이터 확인:`, cellData);
                            
                            // 셀 데이터의 모든 텍스트 제거 (재귀적)
                            const clearCellText = (elements) => {
                                if (!elements) {
                                    logger.warn(`⚠️ elements가 undefined 또는 null`);
                                    return;
                                }
                                elements.forEach(el => {
                                    if (el.type === 'paragraph' && el.runs) {
                                        el.runs.forEach(run => {
                                            if (run.text) {
                                                run.text = '';
                                            }
                                        });
                                    } else if (el.type === 'container' && el.elements) {
                                        clearCellText(el.elements);
                                    }
                                });
                            };
                            
                            clearCellText(cellData.elements);
                            
                            // UI 업데이트
                            target.textContent = '';
                            
                            // 자동 저장 트리거
                            if (this.autoSaveManager) {
                                this.autoSaveManager.markDirty();
                                logger.info(`💾 자동 저장 트리거됨`);
                            }
                            
                            logger.info(`✅ 셀 내용 비우기 완료`);
                        } catch (error) {
                            logger.error(`❌ 셀 내용 비우기 실패:`, error);
                            // 에러가 발생해도 최소한 UI는 비움
                            target.textContent = '';
                        }
                    }
                },
                {
                    icon: '🤖',
                    label: 'AI로 생성',
                    action: (target) => {
                        if (this.chatPanel) {
                            this.chatPanel.open();
                            const cellText = target.textContent?.trim() || '';
                            if (cellText) {
                                this.chatPanel.setInput(`"${cellText}" 셀의 내용을 더 상세하게 작성해줘`);
                            }
                        }
                    }
                }
            ];
            
            this.contextMenu.show(e, menuItems);
        });
        
        // Delete 키로 셀 내용 비우기
        this.container.addEventListener('keydown', (e) => {
            if (e.key !== 'Delete' && e.key !== 'Backspace') return;
            
            // 편집 모드가 아니면 무시
            if (window.editModeManager && !window.editModeManager.isGlobalEditMode) {
                return;
            }
            
            // 현재 포커스된 셀 찾기
            const activeElement = document.activeElement;
            const cell = activeElement?.closest('.hwp-table td, .hwp-table th');
            
            if (!cell) return;
            
            // 인라인 편집 중이면 무시 (일반 텍스트 삭제)
            if (cell.contentEditable === 'true') {
                return;
            }
            
            e.preventDefault();
            
            const cellData = cell._cellData;
            if (!cellData) {
                cell.textContent = '';
                if (this.autoSaveManager) {
                    this.autoSaveManager.markDirty();
                }
                return;
            }
            
            // 셀 데이터의 모든 텍스트 제거 (재귀적)
            const clearCellText = (elements) => {
                elements?.forEach(el => {
                    if (el.type === 'paragraph' && el.runs) {
                        el.runs.forEach(run => {
                            if (run.text) {
                                run.text = '';
                            }
                        });
                    } else if (el.type === 'container' && el.elements) {
                        clearCellText(el.elements);
                    }
                });
            };
            
            clearCellText(cellData.elements);
            
            // UI 업데이트
            cell.textContent = '';
            
            // 자동 저장 트리거
            if (this.autoSaveManager) {
                this.autoSaveManager.markDirty();
            }
            
            logger.info(`🧹 셀 내용 비우기 완료 (Delete 키)`);
        });
        
        logger.info('✅ Table context menu setup complete');
    }
}

// 네임스페이스 export
export const HWPX = {
    // Classes
    Viewer: HWPXViewer,
    Parser: SimpleHWPXParser,
    Error: HWPXError,

    // Constants
    Constants: HWPXConstants,
    ErrorType,

    // Utils
    formatFileSize,
    formatDate,
    showToast,
    showLoading,
    updateStatus,

    // Version
    VERSION: '2.0.0-alpha',
    BUILD_DATE: '2024-11-18'
};

// Default export
export default HWPXViewer;

