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
import { InlineEditor } from './features/inline-editor.js';
import { HistoryManager } from './features/history-manager.js';
import { EditModeManager } from './features/edit-mode-manager.js';
import { HwpxExporter } from './export/hwpx-exporter.js';

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
        
        // 편집 기능 (항상 활성화)
        this.inlineEditor = null;
        this.historyManager = null;
        this.editModeManager = null;
        
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
            
            this.inlineEditor = new InlineEditor(this);
            logger.info('✅ InlineEditor initialized');
            
            this.historyManager = new HistoryManager(this);
            logger.info('✅ HistoryManager initialized');
            
            this.editModeManager = new EditModeManager(this.inlineEditor);
            logger.info('✅ EditModeManager initialized');
            
            // ✅ 전역으로 노출 (InlineEditor가 참조할 수 있도록)
            if (typeof window !== 'undefined') {
                window.editModeManager = this.editModeManager;
                logger.info('✅ EditModeManager exposed globally');
            }
            
        } catch (error) {
            logger.error('❌ Failed to initialize editing features:', error);
            logger.error('Error details:', error.message, error.stack);
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
        
        logger.info('🗑️ Viewer destroyed');
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

