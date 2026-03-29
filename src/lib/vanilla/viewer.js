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
// AI features - lazy loaded dynamically when needed
// import { AIDocumentController } from './ai/ai-controller.js';
// import { ChatPanel } from './ui/chat-panel.js';
import { ContextMenu } from './ui/context-menu.js';
import { SearchDialog } from './ui/search-dialog.js';
import { InlineEditor } from './features/inline-editor.js';
// HistoryManager v1 제거 - v2로 통합 (2026-01-09)
// import { HistoryManager } from './features/history-manager.js';
import { HistoryManagerV2 } from './features/history-manager-v2.js';
import { EditModeManager } from './features/edit-mode-manager.js';
import { Command } from './command/command.js';
import { CommandAdapt } from './command/command-adapt.js';
// Export features - not used directly in viewer (AI controller handles export)
// import { HwpxExporter } from './export/hwpx-exporter.js';
import { AutoSaveManager } from './features/autosave-manager.js';
import { TableEditor } from './features/table-editor.js';
// UI Editors - lazy loaded dynamically when needed
// import { ImageEditor } from './features/image-editor.js';
// import { ShapeEditor } from './features/shape-editor.js';
import { AdvancedSearch } from './features/advanced-search.js';
import { BookmarkManager } from './features/bookmark-manager.js';
import { ThemeManager } from './ui/theme-manager.js';
import { PositionManager } from './features/position-manager.js';
import { RangeManager } from './features/range-manager.js';
import { SearchManager } from './features/search-manager.js';
import { Cursor } from './features/cursor.js';
import { TextFormatter } from './features/text-formatter.js';
import { ClipboardManager } from './features/clipboard-manager.js';
import { SpecialCharacterPicker } from './features/special-character-picker.js';
import { EditingToolbar } from './ui/editing-toolbar.js';

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
  showAlert,
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
      parserOptions: options.parserOptions || {},
    };

    // Container 초기화
    this.container =
      typeof this.options.container === 'string'
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
      enableLazyLoading: options.enableLazyLoading !== false,
    });

    // Exporter는 AI Controller가 처리 (lazy loading으로 최적화됨)
    // this.fullExporter = new HwpxExporter(); // 사용하지 않는 코드 제거

    // Worker Manager (지원되는 경우에만)
    this.workerManager = null;
    if (this.options.useWorker && WorkerManager.isSupported()) {
      this.workerManager = new WorkerManager();
      logger.info('Worker mode enabled');
    } else {
      logger.info('Main thread parsing mode');
    }

    // AI Controller & UI (lazy loaded when needed)
    this.aiController = null;
    this.chatPanel = null;
    this.contextMenu = null;
    this.searchDialog = null;
    this._aiModulesLoading = false; // Track if AI modules are being loaded
    this._aiModulesLoaded = false; // Track if AI modules have been loaded

    // 편집 기능 (항상 활성화)
    this.inlineEditor = null;
    this.historyManager = null;
    this.editModeManager = null;
    this.tableEditor = null;

    // UI Editors (lazy loaded when needed)
    this.imageEditor = null;
    this.shapeEditor = null;
    this._imageEditorLoading = false; // Track if ImageEditor is being loaded
    this._imageEditorLoaded = false; // Track if ImageEditor has been loaded
    this._shapeEditorLoading = false; // Track if ShapeEditor is being loaded
    this._shapeEditorLoaded = false; // Track if ShapeEditor has been loaded
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

    // AI features는 lazy loading으로 변경 - 사용 시점에 동적 로드
    if (this.options.enableAI) {
      logger.info('⚡ AI features will be loaded on demand (lazy loading enabled)');
    } else {
      logger.warn('⚠️ AI features disabled (enableAI = false)');
    }

    // Context Menu는 AI와 독립적으로 초기화
    try {
      logger.info('🚀 Initializing Context Menu...');
      this.contextMenu = new ContextMenu();
      logger.info('✅ Context Menu initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Context Menu:', error);
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

      // ✅ Phase 4 Senior Upgrade: Debounced Pagination Check
      // Debounce helper to reduce layout thrashing during rapid typing
      const debounce = (fn, delay) => {
        let timeoutId;
        return (...args) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
      };

      // Debounced pagination function (300ms delay after user stops typing)
      const debouncedPaginationCheck = debounce(page => {
        if (this.renderer) {
          this.renderer.checkPagination(page);
        }
      }, 300);

      // ✅ 편집 발생 시 자동 페이지 나누기 체크
      this.inlineEditor.onChange(e => {
        const cell = this.inlineEditor.editingCell;
        if (cell) {
          const page = cell.closest('.hwp-page-container');
          if (page) {
            // 페이지 오버플로우 체크 (Debounced)
            debouncedPaginationCheck(page);
          }
        }
      });

      logger.info('✅ InlineEditor initialized');

      this.editModeManager = new EditModeManager(this.inlineEditor);
      logger.info('✅ EditModeManager initialized');

      this.tableEditor = new TableEditor(this);
      logger.info('✅ TableEditor initialized');

      // ✅ Phase 1: Text Formatter (Bold/Italic/Underline)
      this.textFormatter = new TextFormatter(this);
      logger.info('✅ TextFormatter initialized');

      // ✅ Phase 2: Clipboard Manager (서식 포함 복사/붙여넣기, Alt+C)
      this.clipboardManager = new ClipboardManager(this);
      logger.info('✅ ClipboardManager initialized');

      // ✅ Phase 5: Special Character Picker (Ctrl+F10)
      this.specialCharPicker = new SpecialCharacterPicker(this);
      logger.info('✅ SpecialCharacterPicker initialized');

      // ✅ Editing Toolbar UI (편집 도구 버튼)
      this.editingToolbar = new EditingToolbar(this);
      logger.info('✅ EditingToolbar initialized');

      // UI Editors는 lazy loading으로 변경 - 사용 시점에 동적 로드
      logger.info('⚡ ImageEditor and ShapeEditor will be loaded on demand (lazy loading enabled)');

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
        onSave: info => {
          updateStatus(`자동저장: ${info.fileName}`);
          showToast('info', '자동저장', `${info.fileName} 저장됨`);
        },
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
      parseProgress: 0,
    };

    // ✅ Viewer를 전역으로 노출 (디버깅 및 수동 조작용)
    if (typeof window !== 'undefined') {
      window.viewer = this;
      // ✅ 테이블 삽입/리사이즈 후 편집 기능 재등록용 글로벌 함수
      // updateDocument 내부의 100ms setTimeout 이후에 실행되어야 하므로 300ms 사용
      window.reinitializeEditing = () => {
        if (this.inlineEditor) {
          setTimeout(() => {
            this._enableEditingFeatures();
            logger.info('✅ reinitializeEditing: editing features re-enabled');
          }, 300);
        }
      };
      logger.info('✅ Viewer exposed globally as window.viewer');
    }

    logger.info(`🚀 HWPX Viewer initialized (container: ${this.options.container})`);
  }

  /**
   * Lazy load AI features (dynamic import)
   * AI 기능을 동적으로 로드 (사용 시점에만)
   *
   * @returns {Promise<void>}
   * @throws {Error} AI 모듈 로드 실패 시
   *
   * @example
   * await viewer.loadAIFeatures();
   * // Now AI features are available
   */
  async loadAIFeatures() {
    // Already loaded or loading
    if (this._aiModulesLoaded) {
      logger.info('✅ AI features already loaded');
      return;
    }

    if (this._aiModulesLoading) {
      logger.info('⏳ AI features are being loaded, waiting...');
      // Wait for loading to complete
      while (this._aiModulesLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    // AI disabled in options
    if (!this.options.enableAI) {
      logger.warn('⚠️ AI features are disabled in options');
      throw new Error('AI features are disabled');
    }

    this._aiModulesLoading = true;
    logger.info('⚡ Lazy loading AI features...');

    try {
      // Show loading indicator
      showLoading(true, 'AI 기능 로딩 중...');

      // Dynamic import of AI modules
      const [{ AIDocumentController }, { ChatPanel }] = await Promise.all([
        import('./ai/ai-controller.js'),
        import('./ui/chat-panel.js'),
      ]);

      logger.info('✅ AI modules imported');

      // Initialize AI Controller
      logger.info('🚀 Initializing AI Controller...');
      this.aiController = new AIDocumentController(this);
      logger.info('✅ AI Controller initialized');

      // Initialize Chat Panel
      logger.info('🚀 Initializing Chat Panel...');
      this.chatPanel = new ChatPanel(this.aiController);
      this.chatPanel.init();
      logger.info('✅ Chat Panel initialized');

      this._aiModulesLoaded = true;
      logger.info('✅ AI features fully loaded and ready');

      showToast('success', 'AI 기능 활성화', 'AI 기능이 로드되었습니다');
    } catch (error) {
      logger.error('❌ Failed to load AI features:', error);
      logger.error('Error details:', error.message, error.stack);
      this.options.enableAI = false;
      showToast('error', 'AI 로딩 실패', error.message);
      throw error;
    } finally {
      this._aiModulesLoading = false;
      showLoading(false);
    }
  }

  /**
   * Check if AI features are available
   * AI 기능 사용 가능 여부 확인
   *
   * @returns {boolean} AI 기능 사용 가능 여부
   */
  isAIAvailable() {
    return this._aiModulesLoaded && this.aiController !== null;
  }

  /**
   * Lazy load ImageEditor (dynamic import)
   * ImageEditor를 동적으로 로드 (사용 시점에만)
   *
   * @returns {Promise<void>}
   * @throws {Error} ImageEditor 모듈 로드 실패 시
   *
   * @example
   * await viewer.loadImageEditor();
   * // Now ImageEditor is available
   */
  async loadImageEditor() {
    // Already loaded or loading
    if (this._imageEditorLoaded) {
      logger.info('✅ ImageEditor already loaded');
      return;
    }

    if (this._imageEditorLoading) {
      logger.info('⏳ ImageEditor is being loaded, waiting...');
      // Wait for loading to complete
      while (this._imageEditorLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this._imageEditorLoading = true;
    logger.info('⚡ Lazy loading ImageEditor...');

    try {
      // Dynamic import of ImageEditor module
      const { ImageEditor } = await import('./features/image-editor.js');
      logger.info('✅ ImageEditor module imported');

      // Initialize ImageEditor
      logger.info('🚀 Initializing ImageEditor...');
      this.imageEditor = new ImageEditor(this);
      logger.info('✅ ImageEditor initialized');

      this._imageEditorLoaded = true;
    } catch (error) {
      logger.error('❌ Failed to load ImageEditor:', error);
      logger.error('Error details:', error.message, error.stack);
      throw error;
    } finally {
      this._imageEditorLoading = false;
    }
  }

  /**
   * Lazy load ShapeEditor (dynamic import)
   * ShapeEditor를 동적으로 로드 (사용 시점에만)
   *
   * @returns {Promise<void>}
   * @throws {Error} ShapeEditor 모듈 로드 실패 시
   *
   * @example
   * await viewer.loadShapeEditor();
   * // Now ShapeEditor is available
   */
  async loadShapeEditor() {
    // Already loaded or loading
    if (this._shapeEditorLoaded) {
      logger.info('✅ ShapeEditor already loaded');
      return;
    }

    if (this._shapeEditorLoading) {
      logger.info('⏳ ShapeEditor is being loaded, waiting...');
      // Wait for loading to complete
      while (this._shapeEditorLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this._shapeEditorLoading = true;
    logger.info('⚡ Lazy loading ShapeEditor...');

    try {
      // Dynamic import of ShapeEditor module
      const { ShapeEditor } = await import('./features/shape-editor.js');
      logger.info('✅ ShapeEditor module imported');

      // Initialize ShapeEditor
      logger.info('🚀 Initializing ShapeEditor...');
      this.shapeEditor = new ShapeEditor(this);
      logger.info('✅ ShapeEditor initialized');

      this._shapeEditorLoaded = true;
    } catch (error) {
      logger.error('❌ Failed to load ShapeEditor:', error);
      logger.error('Error details:', error.message, error.stack);
      throw error;
    } finally {
      this._shapeEditorLoading = false;
    }
  }

  /**
   * Check if ImageEditor is available
   * ImageEditor 사용 가능 여부 확인
   *
   * @returns {boolean} ImageEditor 사용 가능 여부
   */
  isImageEditorAvailable() {
    return this._imageEditorLoaded && this.imageEditor !== null;
  }

  /**
   * Check if ShapeEditor is available
   * ShapeEditor 사용 가능 여부 확인
   *
   * @returns {boolean} ShapeEditor 사용 가능 여부
   */
  isShapeEditorAvailable() {
    return this._shapeEditorLoaded && this.shapeEditor !== null;
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
      const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();

      logger.time('Total Load Time');

      // 파싱 (Worker 또는 Main Thread)
      let document;

      if (this.workerManager && this.options.useWorker) {
        try {
          // Worker 초기화 (필요시)
          if (!this.workerManager.isReady) {
            await this.workerManager.initialize();
          }

          // Worker에서 파싱
          document = await this.workerManager.parseHWPX(buffer, progress => {
            this.state.parseProgress = progress.percent;
            updateStatus(`${progress.message} (${Math.round(progress.percent)}%)`);

            if (this.options.onProgress) {
              this.options.onProgress(progress);
            }

            showProgress(progress.percent, progress.message);
          });
        } catch (workerError) {
          // Worker 파싱 실패 시 메인 스레드로 자동 폴백
          logger.warn('⚠️ Worker parsing failed, falling back to main thread:', workerError.message);
          document = await this.parser.parse(buffer);
        }
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
        logger.info(
          `📊 Position Stats: ${stats.totalCharacters} chars, ${stats.pages} pages, ${stats.paragraphs} paragraphs, ${stats.tableCells} cells`
        );
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
   * 새 문서 생성 (원본 파일 없이)
   * @param {Object} document - 빈 문서 객체
   * @returns {Promise<void>}
   */
  async createNewDocument(document) {
    logger.info('📄 Creating new document...');

    // 새 문서 플래그 설정 (저장 시 새 HWPX 생성 필요)
    this.state.isNewDocument = true;
    this.state.currentFile = null;

    // 문서 업데이트 및 렌더링
    await this.updateDocument(document);

    // 편집 모드 자동 활성화
    if (this.editModeManager && !this.editModeManager.isGlobalEditMode) {
      this.editModeManager.toggleGlobalEditMode();
    }

    // MutationObserver로 DOM 준비를 확실히 감지한 후 자동 포커스
    const observer = new MutationObserver(() => {
      const firstPara = this.container.querySelector('.hwp-paragraph.editable-paragraph');
      if (firstPara && this.inlineEditor) {
        observer.disconnect();
        // contentEditable이 이미 설정되어 있으므로 바로 포커스
        firstPara.focus();
        // 이벤트 리스너 등록을 위해 enableEditMode 호출
        if (firstPara._paraData) {
          this.inlineEditor.enableEditMode(firstPara, firstPara._paraData);
        }
        logger.info('✅ Auto-focused first paragraph (MutationObserver)');
      }
    });
    observer.observe(this.container, { childList: true, subtree: true });
    // 안전 타임아웃: 3초 후 observer 해제
    setTimeout(() => observer.disconnect(), 3000);

    logger.info('✅ New document created');
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

    // 편집 기능 활성화 (렌더링 후)
    if (this.inlineEditor) {
      setTimeout(() => {
        this._enableEditingFeatures();
      }, 100);
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
          logger.warn(
            `  - Table ${index}: No _tableData attached, attempting to find from document`
          );

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

      logger.info(
        `  - Found ${editableParagraphs.length} editable paragraphs (out of ${allParagraphs.length} total)`
      );

      if (editableParagraphs.length > 0) {
        // _paraData 없는 단락에 기본 데이터 연결 (새 문서 등)
        editableParagraphs.forEach(para => {
          if (!para._paraData) {
            para._paraData = {
              type: 'paragraph',
              runs: [{ text: para.textContent || '', style: {} }],
              text: para.textContent || '',
              style: {}
            };
          }
          para.classList.add('editable-paragraph');
        });
        this.inlineEditor.enableParagraphEditing(editableParagraphs);
      }

      // 페이지 빈 영역 클릭 시 마지막 단락에 포커스
      this._setupPageClickFallback();

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
    this.container.addEventListener('click', e => {
      // Ctrl+Shift+Click으로 디버그 모드
      if (e.ctrlKey && e.shiftKey) {
        e.preventDefault();

        const position = this.positionManager.getPositionByXY(e.clientX, e.clientY);

        if (position) {
          logger.info('📍 Click-to-Position Debug Info:');
          logger.info(
            `  - Character: "${position.value}" (${position.isWhitespace ? 'whitespace' : 'visible'})`
          );
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
          logger.debug('Position Object:', position);
        } else {
          logger.warn('⚠️ No position found at click location');
        }
      }
    });

    logger.info('✅ Click-to-position enabled (Ctrl+Shift+Click to debug)');
  }

  /**
   * 페이지 빈 영역 클릭 시 가장 가까운 단락에 포커스
   * @private
   */
  _setupPageClickFallback() {
    const pages = this.container.querySelectorAll('.hwp-page-container, .hwp-page');
    pages.forEach(page => {
      // 이미 바인딩 되었으면 스킵
      if (page._pageClickBound) return;
      page._pageClickBound = true;

      page.addEventListener('click', (e) => {
        // 단락이나 테이블을 직접 클릭한 경우는 무시 (이미 자체 핸들러 있음)
        const target = e.target;
        if (target.closest('.hwp-paragraph.editable-paragraph') ||
            target.closest('.hwp-table td') ||
            target.closest('.hwp-table th')) {
          return;
        }

        // 페이지 빈 영역 클릭 → 마지막 편집 가능 단락에 포커스
        const editableParagraphs = page.querySelectorAll('.hwp-paragraph.editable-paragraph');
        if (editableParagraphs.length > 0) {
          const lastPara = editableParagraphs[editableParagraphs.length - 1];
          lastPara.focus();
          // 커서를 텍스트 끝으로 배치
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(lastPara);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          // 이벤트 리스너 등록
          if (lastPara._paraData && this.inlineEditor) {
            this.inlineEditor.enableEditMode(lastPara, lastPara._paraData);
          }
        }
      });
    });
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
   * ✅ v2.1.4: DOM에서 문서 구조도 재구성하여 state.document와 동기화
   * @private
   */
  _syncDocumentFromDOM() {
    if (!this.state.document) {
      logger.warn('⚠️ No document to sync');
      return {
        updatedCells: 0,
        updatedParagraphs: 0,
        checkedCells: 0,
        checkedParagraphs: 0,
      };
    }

    let cellsChecked = 0;
    let cellsUpdated = 0;
    let paragraphsChecked = 0;
    let paragraphsUpdated = 0;

    // ✅ v2.1.4: DOM에서 수집한 요소들 (문서 구조 재구성용)
    // Map으로 순서와 데이터를 함께 저장
    const elementMap = new Map();

    try {
      // 1. 테이블 셀 강제 동기화
      const tables = this.container.querySelectorAll('.hwp-table');
      logger.info(`  🔍 Checking ${tables.length} tables...`);

      tables.forEach((tableElement, tableIndex) => {
        // ✅ v2.1.4: 테이블 데이터 수집 (DOM 순서 기준)
        const tableData = tableElement._tableData;
        logger.info(`  🔍 Table ${tableIndex}: _tableData exists = ${!!tableData}`);
        if (tableData) {
          // ✅ v2.1.5: type이 없으면 'table'로 설정 (안전 장치)
          if (!tableData.type) {
            logger.warn(`  ⚠️ Table ${tableIndex}: Missing type, setting to 'table'`);
            tableData.type = 'table';
          }
          // DOM 위치를 키로 사용하여 순서 보존
          elementMap.set(tableElement, tableData);
          logger.info(`  📊 Collected table ${tableIndex} with type: ${tableData.type}`);
        } else {
          logger.warn(`  ⚠️ Table ${tableIndex}: No _tableData attached!`);
        }

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
            logger.info(
              `  📝 Cell [${tableIndex},${cellIndex}]: "${originalText.substring(0, 30)}..." → "${currentText.substring(0, 30)}..."`
            );
            this._updateCellDataFromText(cellData, currentText);
            cellsUpdated++;

            // ✅ 디버그: 업데이트 후 cellData 확인
            const updatedRuns = cellData.elements?.[0]?.runs || [];
            logger.info(`    → Updated runs count: ${updatedRuns.length}`);
            logger.info(`    → Runs: ${JSON.stringify(updatedRuns.slice(0, 3))}...`);
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

        // ✅ v2.1.4: 단락 데이터 수집 (테이블 외부 단락만)
        // 테이블 내부 단락은 이미 tableData에 포함되어 있음
        const isInsideTable = para.closest('.hwp-table');
        logger.debug(`  🔍 Paragraph ${paraIndex}: isInsideTable=${!!isInsideTable}, type=${paraData.type}`);
        if (!isInsideTable) {
          // ✅ v2.1.5: type이 없으면 'paragraph'로 설정 (안전 장치)
          if (!paraData.type) {
            logger.warn(`  ⚠️ Paragraph ${paraIndex}: Missing type, setting to 'paragraph'`);
            paraData.type = 'paragraph';
          }
          if (paraData.type === 'paragraph') {
            elementMap.set(para, paraData);
            logger.info(`  📄 Collected paragraph ${paraIndex}`);
          }
        }

        paragraphsChecked++;
        const currentText = this._extractTextFromElement(para);
        const originalText = this._extractTextFromParaData(paraData);

        // ✅ 강제 업데이트: textContent가 다르면 무조건 업데이트
        if (currentText !== originalText) {
          logger.info(
            `  📝 Paragraph ${paraIndex}: "${originalText.substring(0, 30)}..." → "${currentText.substring(0, 30)}..."`
          );
          this._updateParaDataFromText(paraData, currentText);
          paragraphsUpdated++;
        }
      });

      // ✅ v2.1.4: DOM에서 수집한 요소로 state.document 재구성
      // DOM 순서에 따라 정렬하여 원래 문서 순서 보존
      logger.info(`  🔍 elementMap.size = ${elementMap.size}`);
      if (elementMap.size > 0 && this.state.document.sections?.[0]) {
        const section = this.state.document.sections[0];
        const oldElements = section.elements || [];
        const oldTableCount = oldElements.filter(e => e.type === 'table').length;

        // DOM 요소들을 document order로 정렬
        const sortedElements = Array.from(elementMap.entries())
          .sort((a, b) => {
            // compareDocumentPosition을 사용하여 DOM 순서 비교
            const position = a[0].compareDocumentPosition(b[0]);
            if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
          })
          .map(([_, data]) => data);

        const newTableCount = sortedElements.filter(e => e.type === 'table').length;

        logger.info(`  🔄 Rebuilding document structure from DOM...`);
        logger.info(`    Old: ${oldElements.length} elements, ${oldTableCount} tables`);
        logger.info(`    New: ${sortedElements.length} elements, ${newTableCount} tables`);

        // ✅ v2.1.5: 디버그 - 새 요소들의 타입 출력
        sortedElements.forEach((elem, idx) => {
          logger.info(`      Element ${idx}: type=${elem.type}, rows=${elem.rows?.length || 'N/A'}`);
          if (elem.type === 'table' && elem.rows?.[0]?.cells?.[0]) {
            const firstCell = elem.rows[0].cells[0];
            const runs = firstCell.elements?.[0]?.runs || [];
            const text = runs.map(r => r.text || (r.type === 'linebreak' ? '↵' : '')).join('');
            logger.info(`        First cell: ${runs.length} runs, text="${text.substring(0, 30)}..."`);
          }
        });

        // DOM에서 수집한 요소로 교체
        section.elements = sortedElements;

        logger.info(`  ✅ Document structure rebuilt: ${section.elements.length} elements`);
      } else {
        logger.warn(`  ⚠️ Document structure NOT rebuilt: elementMap.size=${elementMap.size}, sections exist=${!!this.state.document.sections?.[0]}`);
      }

      logger.info(
        `✅ Sync complete: ${cellsUpdated}/${cellsChecked} cells, ${paragraphsUpdated}/${paragraphsChecked} paragraphs updated`
      );

      if (
        cellsUpdated === 0 &&
        paragraphsUpdated === 0 &&
        (cellsChecked > 0 || paragraphsChecked > 0)
      ) {
        logger.info('  ℹ️ No changes detected - all content already synchronized');
      }

      // ✅ 결과 반환
      return {
        updatedCells: cellsUpdated,
        updatedParagraphs: paragraphsUpdated,
        checkedCells: cellsChecked,
        checkedParagraphs: paragraphsChecked,
      };
    } catch (error) {
      logger.error('❌ Failed to sync document from DOM:', error);
      logger.error('Error details:', error.message, error.stack);

      // 에러 시에도 결과 반환
      return {
        updatedCells: 0,
        updatedParagraphs: 0,
        checkedCells: cellsChecked,
        checkedParagraphs: paragraphsChecked,
      };
    }
  }

  /**
   * 요소에서 텍스트 추출 (줄바꿈 보존)
   * ✅ v2.1.2: <br> 태그를 \n으로 변환하여 줄바꿈 보존
   * @private
   */
  _extractTextFromElement(element) {
    // <br> 태그를 \n으로 변환
    const clone = element.cloneNode(true);
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => {
      br.replaceWith('\n');
    });
    return clone.textContent || '';
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
      cellData.elements = [
        {
          type: 'paragraph',
          runs: [],
        },
      ];
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
  /**
   * 문자 위치 목록 가져오기 (command-adapt에서 사용)
   * @returns {Array} 위치 배열
   */
  getCharacterPositions() {
    if (this.positionManager) {
      return this.positionManager.getPositionList() || [];
    }
    return [];
  }

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
    logger.info(`  - isNewDocument: ${!!this.state.isNewDocument}`);
    logger.info(`  - aiController: ${!!this.aiController}`);

    // ✅ 1단계: 현재 편집 중인 셀 강제 저장
    if (this.inlineEditor && this.inlineEditor.isEditing()) {
      logger.info('💾 Saving currently editing cell...');
      this.inlineEditor.finishEditing();
    }

    // ✅ 2단계: DOM의 모든 변경사항을 document에 강제 동기화
    logger.info('🔄 Syncing ALL changes from DOM to document...');
    const syncResult = this._syncDocumentFromDOM();
    logger.info(`✅ Sync complete: ${syncResult.updatedCells} cells, ${syncResult.updatedParagraphs} paragraphs updated`);

    // ✅ 디버그: document 상태 확인
    const doc = this.getDocument();
    if (doc && doc.sections) {
      logger.info(`📊 Document sections: ${doc.sections.length}`);
      doc.sections.forEach((section, sIdx) => {
        if (section.elements) {
          const tables = section.elements.filter(e => e.type === 'table');
          const paragraphs = section.elements.filter(e => e.type === 'paragraph');
          logger.info(`  Section ${sIdx}: ${section.elements.length} elements (${tables.length} tables, ${paragraphs.length} paragraphs)`);
        }
      });
    } else {
      logger.warn(`⚠️ Document is null or has no sections!`);
    }

    // ✅ 새 문서인 경우: 빈 HWPX 템플릿을 생성하여 저장
    if (!this.state.currentFile || this.state.isNewDocument) {
      logger.info('📄 New document - generating HWPX from scratch...');
      return await this._saveNewDocument(filename || '새문서.hwpx');
    }

    // Lazy load AI features if not already loaded
    if (!this.aiController) {
      logger.info('⚡ AI Controller not loaded, loading now...');
      try {
        await this.loadAIFeatures();
      } catch (error) {
        throw new Error('AI 기능을 로드할 수 없어 저장 기능을 사용할 수 없습니다.');
      }
    }

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
   * 새 문서를 HWPX로 저장 (원본 파일 없는 경우)
   * @param {string} filename - 저장할 파일명
   * @returns {Promise<Object>} 저장 결과
   * @private
   */
  async _saveNewDocument(filename) {
    try {
      logger.info('📦 Generating HWPX from template...');

      const JSZip = (await import('jszip')).default;

      let doc = this.getDocument();

      // state.document가 null이지만 렌더링된 DOM이 있는 경우 → DOM에서 문서 재구성
      if ((!doc || !doc.sections || doc.sections.length === 0) && this.container) {
        logger.info('state.document is null but DOM exists, rebuilding from DOM...');
        doc = this._rebuildDocumentFromDOM();
        if (doc) {
          this.state.document = doc;
          logger.info(`Rebuilt document: ${doc.sections?.length || 0} sections`);
        }
      }

      if (!doc || !doc.sections || doc.sections.length === 0) {
        throw new Error('저장할 문서 내용이 없습니다.');
      }

      // 정상 HWPX 템플릿 로드 (한글에서 정상 열리는 구조)
      const { HWPX_TEMPLATE_BASE64 } = await import('./export/hwpx-template.js');
      const templateBuf = Uint8Array.from(atob(HWPX_TEMPLATE_BASE64), c => c.charCodeAt(0));
      const zip = await JSZip.loadAsync(templateBuf);

      // mimetype STORE 보장
      zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

      // 1. 모든 run에서 고유 스타일 수집 + header.xml에 charPr 주입
      const styleMap = this._collectCharStyles(doc);
      logger.info(`Collected ${styleMap.size} char styles for HWPX save`);

      if (styleMap.size > 1) {
        const origHeader = await zip.file('Contents/header.xml').async('string');
        const updatedHeader = this._injectCharPrIntoHeader(origHeader, styleMap);
        zip.file('Contents/header.xml', updatedHeader);
        logger.info('charPr styles injected into header.xml');
      }

      // section XML 생성 (secPr 포함 section header + 텍스트 단락)
      const { SECTION_HEADER_BASE64 } = await import('./export/hwpx-section-header.js');
      const binaryStr = atob(SECTION_HEADER_BASE64);
      const bytesArr = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytesArr[i] = binaryStr.charCodeAt(i);
      const sectionHeader = new TextDecoder('utf-8').decode(bytesArr);

      let bodyContent = '';
      const firstSection = doc.sections[0] || { elements: [] };
      (firstSection.elements || []).forEach(el => {
        if (el.type === 'paragraph') bodyContent += this._generateParagraphXml(el, styleMap);
        else if (el.type === 'table') bodyContent += this._generateTableXmlNative(el, styleMap);
      });
      if (!bodyContent) {
        bodyContent = `<hp:p id="${Math.floor(Math.random()*4e9)}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t></hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="800" spacing="300" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray></hp:p>`;
      }
      const sectionXml = sectionHeader + bodyContent + '</hs:sec>';

      // Python 서버로 HWPX 생성 (한글 호환 ZIP 보장) — 없으면 JSZip fallback
      let blob;
      try {
        const resp = await fetch('/api/generate-hwpx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionXml }),
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        blob = await resp.blob();
        logger.info('HWPX generated via Python server');
      } catch (e) {
        logger.warn('Python server unavailable, using JSZip fallback:', e.message);
        zip.file('Contents/section0.xml', sectionXml);
        zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
        Object.keys(zip.files).forEach(n => { if (zip.files[n].dir) delete zip.files[n]; });
        blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 새 문서 플래그 해제 - 저장된 blob을 currentFile로 설정
      const savedFile = new File([blob], filename, { type: 'application/hwp+zip' });
      this.state.currentFile = savedFile;
      this.state.isNewDocument = false;

      logger.info('✅ New HWPX file saved successfully');
      return { success: true, filename };
    } catch (error) {
      logger.error('❌ Failed to save new document:', error);
      throw error;
    }
  }

  /**
   * DOM에서 문서 구조를 재구성 (state.document가 null일 때 fallback)
   * @returns {Object|null} 재구성된 문서 객체
   * @private
   */
  _rebuildDocumentFromDOM() {
    try {
      const pages = this.container.querySelectorAll('.hwp-page-container');
      if (pages.length === 0) return null;

      const sections = [];
      pages.forEach(page => {
        const elements = [];

        // 테이블 추출
        page.querySelectorAll('.hwp-table').forEach(tableEl => {
          if (tableEl._tableData) {
            elements.push(tableEl._tableData);
            return;
          }
        });

        // 단락 추출 (테이블 외부)
        page.querySelectorAll('.hwp-paragraph.editable-paragraph').forEach(paraEl => {
          if (paraEl.closest('.hwp-table')) return;
          if (paraEl._paraData) {
            elements.push(paraEl._paraData);
          } else {
            elements.push({
              type: 'paragraph',
              runs: [{ text: paraEl.textContent || '', style: {} }],
            });
          }
        });

        sections.push({
          elements,
          pageSettings: {
            width: '794px', height: '1123px',
            marginLeft: '85px', marginRight: '85px',
            marginTop: '71px', marginBottom: '57px',
          },
        });
      });

      if (sections.length === 0 || sections.every(s => s.elements.length === 0)) return null;

      return {
        sections,
        images: new Map(),
        metadata: { rebuiltFromDOM: true, parsedAt: new Date().toISOString() },
      };
    } catch (error) {
      logger.error('❌ Failed to rebuild document from DOM:', error);
      return null;
    }
  }

  /**
   * 섹션 데이터를 HWPX XML로 변환
   * @param {Object} section - 섹션 데이터
   * @returns {string} XML 문자열
   * @private
   */
  _generateSectionXml(section, styleMap) {
    const pageSettings = section.pageSettings || {};
    // px → HWPX 단위 변환: HWPX 단위는 1/7200인치, A4 width=59528, height=84188
    // px 값(~794)과 HWPX 값(~59528)을 구분: 5000 미만이면 px로 판단
    const toHwpUnit = (val) => {
      const num = parseInt(val);
      if (!num) return 0;
      if (num < 5000) return Math.round(num * 75); // px → HWPX (1px ≈ 75 HWP units at 96dpi)
      return num; // 이미 HWPX 단위
    };
    const width = toHwpUnit(pageSettings.width) || 59528;
    const height = toHwpUnit(pageSettings.height) || 84188;
    const marginLeft = toHwpUnit(pageSettings.marginLeft) || 6354;
    const marginRight = toHwpUnit(pageSettings.marginRight) || 6354;
    const marginTop = toHwpUnit(pageSettings.marginTop) || 5314;
    const marginBottom = toHwpUnit(pageSettings.marginBottom) || 4252;

    let bodyContent = '';
    const elements = section.elements || [];

    elements.forEach(element => {
      if (element.type === 'paragraph') {
        bodyContent += this._generateParagraphXml(element, styleMap);
      } else if (element.type === 'table') {
        bodyContent += this._generateTableXmlNative(element, styleMap);
      }
    });

    // 최소 빈 단락 하나는 포함
    if (!bodyContent) {
      const emptyId = Math.floor(Math.random() * 4294967295);
      bodyContent = `<hp:p id="${emptyId}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t></hp:t></hp:run></hp:p>`;
    }

    // 첫 번째 단락에 secPr (섹션 속성)을 삽입하는 HWPX 표준 형식
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page">
  <hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run>
      <hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="${width}" height="${height}" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="${marginLeft}" right="${marginRight}" top="${marginTop}" bottom="${marginBottom}"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr>
    </hp:run>
  </hp:p>
${bodyContent}
</hs:sec>`;
  }

  /**
   * 단락 데이터를 XML로 변환
   * @private
   */
  /**
   * 문서의 모든 run에서 고유 스타일 조합을 수집
   * @returns {Map<string, {id, bold, italic, underline, height, color, fontFamily}>}
   */
  _collectCharStyles(doc) {
    const styleMap = new Map();
    // id=0: 기본 스타일 (항상 존재)
    const defaultKey = 'default';
    styleMap.set(defaultKey, { id: 0, bold: false, italic: false, underline: false, height: 1000, color: '#000000', fontFamily: '' });

    const getStyleKey = (style) => {
      const s = style || {};
      const bold = !!(s.bold || s.fontWeight === 'bold' || (parseInt(s.fontWeight) >= 700));
      const italic = !!(s.italic || s.fontStyle === 'italic');
      const underline = !!(s.underline || (s.textDecoration && s.textDecoration.includes('underline')));
      const fontSize = parseFloat(s.fontSize) || 0;
      const height = fontSize > 0 ? Math.round(fontSize * 100) : 1000; // pt → HWPX (1pt = 100)
      const color = s.color || '#000000';
      return `${bold}|${italic}|${underline}|${height}|${color}`;
    };

    const processRuns = (runs) => {
      if (!runs) return;
      for (const run of runs) {
        if (run.type === 'linebreak') continue;
        const style = run.inlineStyle || run.style || {};
        const key = getStyleKey(style);
        if (key === 'false|false|false|1000|#000000') continue; // 기본 스타일
        if (!styleMap.has(key)) {
          const s = style;
          const bold = !!(s.bold || s.fontWeight === 'bold' || (parseInt(s.fontWeight) >= 700));
          const italic = !!(s.italic || s.fontStyle === 'italic');
          const underline = !!(s.underline || (s.textDecoration && s.textDecoration.includes('underline')));
          const fontSize = parseFloat(s.fontSize) || 0;
          const height = fontSize > 0 ? Math.round(fontSize * 100) : 1000;
          const color = s.color || '#000000';
          styleMap.set(key, { id: styleMap.size, bold, italic, underline, height, color, fontFamily: s.fontFamily || '' });
        }
      }
    };

    for (const section of (doc.sections || [])) {
      for (const el of (section.elements || [])) {
        if (el.type === 'paragraph') processRuns(el.runs);
        if (el.type === 'table' && el.rows) {
          for (const row of el.rows) {
            for (const cell of (row.cells || [])) {
              for (const ce of (cell.elements || [])) {
                if (ce.runs) processRuns(ce.runs);
              }
            }
          }
        }
      }
    }

    logger.info(`Collected ${styleMap.size} unique char styles`);
    return styleMap;
  }

  /**
   * 기존 header.xml에 charPr 정의를 주입 (원본 구조 보존)
   * @param {string} headerXml - 원본 header XML
   * @param {Map} styleMap - 스타일 맵
   * @returns {string} 업데이트된 header XML
   */
  _injectCharPrIntoHeader(headerXml, styleMap) {
    // 기존 charPr 중 가장 큰 id와 기본 fontRef를 찾기
    const existingIds = [...headerXml.matchAll(/<hh:charPr id="(\d+)"/g)].map(m => parseInt(m[1]));
    const maxExistingId = existingIds.length > 0 ? Math.max(...existingIds) : -1;

    // template charPr id=0의 fontRef를 복사해서 새 charPr에 사용
    const fontRefMatch = headerXml.match(/<hh:charPr id="0"[^>]*>.*?<hh:fontRef([^/]*)\/>/) ;
    const fontRefAttrs = fontRefMatch ? fontRefMatch[1] : ' hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"';

    // 기존 charPr id=0의 borderFillIDRef 가져오기
    const bfMatch = headerXml.match(/<hh:charPr id="0"[^>]*borderFillIDRef="(\d+)"/);
    const borderFillRef = bfMatch ? bfMatch[1] : '0';

    // 스타일 맵의 id를 기존 max + 1부터 재배정 (id=0은 template 기존 것 유지)
    let nextId = maxExistingId + 1;
    const idRemap = new Map(); // old id → new id
    idRemap.set(0, 0); // 기본 스타일은 template의 id=0 사용

    let newCharPrXml = '';
    for (const [key, style] of styleMap) {
      if (style.id === 0) {
        // 기본 스타일 → template의 charPr id=0 그대로 사용
        continue;
      }

      const newId = nextId++;
      idRemap.set(style.id, newId);

      const boldAttr = style.bold ? ' bold="1"' : '';
      const italicAttr = style.italic ? ' italic="1"' : '';
      const underType = style.underline ? 'BOTTOM' : 'NONE';
      const color = style.color.startsWith('#') ? style.color : `#${style.color}`;

      newCharPrXml += `<hh:charPr id="${newId}" height="${style.height}" textColor="${color}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="${borderFillRef}"${boldAttr}${italicAttr}><hh:fontRef${fontRefAttrs}/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:underline type="${underType}" shape="SOLID" color="${color}"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/></hh:charPr>`;
    }

    // id 리맵 정보를 styleMap에 반영
    for (const [key, style] of styleMap) {
      if (idRemap.has(style.id)) {
        style.id = idRemap.get(style.id);
      }
    }

    if (!newCharPrXml) {
      return headerXml; // 추가할 스타일 없으면 원본 유지
    }

    // </hh:charProperties> 직전에 새 charPr 삽입 + itemCnt 업데이트
    const totalCount = existingIds.length + (nextId - maxExistingId - 1);
    let result = headerXml.replace(
      /<hh:charProperties itemCnt="\d+"/,
      `<hh:charProperties itemCnt="${totalCount}"`
    );
    result = result.replace('</hh:charProperties>', newCharPrXml + '</hh:charProperties>');

    logger.info(`Injected ${nextId - maxExistingId - 1} new charPr defs (ids ${maxExistingId + 1}-${nextId - 1})`);
    return result;
  }

  /**
   * (레거시) 스타일 맵을 기반으로 header.xml 전체 생성
   */
  _generateHeaderWithStyles(styleMap) {
    let charPrXml = '';
    for (const [key, style] of styleMap) {
      const boldAttr = style.bold ? ' bold="1"' : '';
      const italicAttr = style.italic ? ' italic="1"' : '';
      const underType = style.underline ? 'BOTTOM' : 'NONE';
      const color = style.color.startsWith('#') ? style.color : `#${style.color}`;

      charPrXml += `<hh:charPr id="${style.id}" height="${style.height}" textColor="${color}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0"${boldAttr}${italicAttr}><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:underline type="${underType}" shape="SOLID" color="${color}"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/></hh:charPr>`;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"><hh:beginNum page="1" footnote="1" endnote="1"/><hh:refList><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="함초롬돋움" type="TTF"/></hh:fontface><hh:fontface lang="LATIN"><hh:font id="0" face="함초롬돋움" type="TTF"/></hh:fontface><hh:fontface lang="HANJA"><hh:font id="0" face="함초롬돋움" type="TTF"/></hh:fontface></hh:fontfaces><hh:charProperties itemCnt="${styleMap.size}">${charPrXml}</hh:charProperties><hh:paraProperties><hh:paraPr id="0" align="JUSTIFY"><hh:margin left="0" right="0" indent="0"/><hh:lineSpacing type="PERCENT" value="160"/></hh:paraPr></hh:paraProperties></hh:refList></hh:head>`;
  }

  /**
   * run의 스타일 키를 생성
   * @private
   */
  _getRunStyleKey(run) {
    const s = run.inlineStyle || run.style || {};
    const bold = !!(s.bold || s.fontWeight === 'bold' || (parseInt(s.fontWeight) >= 700));
    const italic = !!(s.italic || s.fontStyle === 'italic');
    const underline = !!(s.underline || (s.textDecoration && s.textDecoration.includes('underline')));
    const fontSize = parseFloat(s.fontSize) || 0;
    const height = fontSize > 0 ? Math.round(fontSize * 100) : 1000;
    const color = s.color || '#000000';
    return `${bold}|${italic}|${underline}|${height}|${color}`;
  }

  /**
   * run의 charPrIDRef를 styleMap에서 찾기
   * @private
   */
  _getCharPrId(run, styleMap) {
    if (!run || run.type === 'linebreak') return 0;
    const key = this._getRunStyleKey(run);
    if (key === 'false|false|false|1000|#000000') return 0;
    const entry = styleMap?.get(key);
    return entry ? entry.id : 0;
  }

  _generateParagraphXml(para, styleMap) {
    const runs = para.runs || [];
    let runContent = '';
    let totalText = '';

    runs.forEach((run) => {
      if (run.type === 'linebreak') {
        runContent += `<hp:run charPrIDRef="0"><hp:t>\n</hp:t></hp:run>`;
        totalText += '\n';
      } else {
        const text = (run.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\t/g, '  ');
        const charId = this._getCharPrId(run, styleMap);
        runContent += `<hp:run charPrIDRef="${charId}"><hp:t>${text}</hp:t></hp:run>`;
        totalText += run.text || '';
      }
    });

    if (!runContent) {
      runContent = `<hp:run charPrIDRef="0"><hp:t></hp:t></hp:run>`;
    }

    // linesegarray: 한글 프로그램이 텍스트 렌더링에 필요한 줄 레이아웃 정보
    const height = 1000;
    const baseline = 800;
    const spacing = 300;
    const lineseg = `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${height}" textheight="${height}" baseline="${baseline}" spacing="${spacing}" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>`;

    const paraId = Math.floor(Math.random() * 4294967295);
    return `<hp:p id="${paraId}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${runContent}${lineseg}</hp:p>`;
  }

  /**
   * 테이블 데이터를 XML로 변환
   * @private
   */
  /**
   * 테이블을 텍스트 단락으로 변환 (한글 호환성 보장)
   * 각 행을 탭 구분 텍스트 단락으로 출력
   */
  /**
   * 테이블을 네이티브 HWPX XML로 변환 (한글 호환)
   */
  _generateTableXmlNative(table, styleMap) {
    const rows = table.rows || [];
    if (rows.length === 0) return '';

    const rowCount = rows.length;
    const colCount = rows[0]?.cells?.length || 1;
    const tblWidth = 42520;
    const colWidth = Math.floor(tblWidth / colCount);
    const rowHeight = 1200;
    const totalHeight = rowHeight * rowCount;
    const tblId = Math.floor(Math.random() * 4294967295);

    // 셀 내부 단락 생성 (스타일 매핑 포함)
    const cellParaFromRuns = (runs, pid) => {
      let runXml = '';
      (runs || []).forEach(run => {
        if (run.type === 'linebreak') return;
        const t = (run.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\t/g, '  ');
        const charId = this._getCharPrId(run, styleMap);
        runXml += `<hp:run charPrIDRef="${charId}"><hp:t>${t}</hp:t></hp:run>`;
      });
      if (!runXml) runXml = `<hp:run charPrIDRef="0"><hp:t></hp:t></hp:run>`;
      return `<hp:p id="${pid}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${runXml}<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="800" spacing="300" horzpos="0" horzsize="${colWidth}" flags="393216"/></hp:linesegarray></hp:p>`;
    };

    // 셀 생성 (runs 배열 전달)
    const makeCell = (runs, col, row, pid) => {
      return `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="1"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${cellParaFromRuns(runs, pid)}</hp:subList><hp:cellAddr colAddr="${col}" rowAddr="${row}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${colWidth}" height="${rowHeight}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`;
    };

    // 테이블 XML 조립
    let tblXml = `<hp:tbl id="${tblId}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="${rowCount}" colCnt="${colCount}" cellSpacing="0" borderFillIDRef="1" noAdjust="0"><hp:sz width="${tblWidth}" widthRelTo="ABSOLUTE" height="${totalHeight}" heightRelTo="ABSOLUTE" protect="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>`;

    let pid = Math.floor(Math.random() * 1000000);
    rows.forEach((row, rIdx) => {
      tblXml += '<hp:tr>';
      (row.cells || []).forEach((cell, cIdx) => {
        // 셀의 runs 추출 (첫 번째 paragraph의 runs)
        let cellRuns = [];
        (cell.elements || []).forEach(el => {
          if (el.runs) cellRuns = cellRuns.concat(el.runs);
        });
        if (cellRuns.length === 0) cellRuns = [{ text: '', style: {} }];
        pid++;
        tblXml += makeCell(cellRuns, cIdx, rIdx, pid);
      });
      tblXml += '</hp:tr>';
    });
    tblXml += '</hp:tbl>';

    // 래핑 단락
    const paraId = Math.floor(Math.random() * 4294967295);
    const tblLineseg = `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${totalHeight}" textheight="${totalHeight}" baseline="0" spacing="0" horzpos="0" horzsize="${tblWidth}" flags="393216"/></hp:linesegarray>`;

    return `<hp:p id="${paraId}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${tblXml}</hp:run>${tblLineseg}</hp:p>`;
  }

  _generateTableAsTextXml(table, styleMap) {
    const rows = table.rows || [];
    if (rows.length === 0) return '';

    let result = '';
    rows.forEach(row => {
      const cellTexts = (row.cells || []).map(cell => {
        const texts = [];
        (cell.elements || []).forEach(el => {
          if (el.runs) {
            el.runs.forEach(r => { if (r.text) texts.push(r.text); });
          }
        });
        return texts.join(' ');
      });
      const lineText = cellTexts.join(' | ');
      result += this._generateParagraphXml({ runs: [{ text: lineText }] }, styleMap);
    });
    return result;
  }

  /**
   * 테이블을 HWPX XML로 변환 (향후 사용)
   */
  _generateTableXml(table, styleMap) {
    const rows = table.rows || [];
    if (rows.length === 0) return '';

    const rowCount = rows.length;
    const colCount = rows[0]?.cells?.length || 1;
    const tableWidth = 42520;
    const colWidth = Math.floor(tableWidth / colCount);
    const rowHeight = 1800;
    const totalHeight = rowHeight * rowCount;

    let colDefs = '';
    for (let i = 0; i < colCount; i++) {
      colDefs += `<hp:gridCol width="${colWidth}"/>`;
    }

    let rowXml = '';
    rows.forEach((row, rIdx) => {
      let cellXml = '';
      (row.cells || []).forEach((cell, cIdx) => {
        const cellElements = cell.elements || [];
        let cellParas = '';
        cellElements.forEach(el => {
          if (el.type === 'paragraph' || el.runs) {
            cellParas += this._generateParagraphXml(el, styleMap);
          }
        });
        if (!cellParas) {
          cellParas = this._generateParagraphXml({ runs: [{ text: '' }] }, styleMap);
        }
        cellXml += `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="1"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${cellParas}</hp:subList></hp:tc>`;
      });
      rowXml += `<hp:tr>${cellXml}</hp:tr>`;
    });

    const tblId = Math.floor(Math.random() * 4294967295);
    const paraId = Math.floor(Math.random() * 4294967295);
    const lineseg = `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${totalHeight}" textheight="${totalHeight}" baseline="0" spacing="0" horzpos="0" horzsize="${tableWidth}" flags="393216"/></hp:linesegarray>`;

    return `<hp:p id="${paraId}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:tbl id="${tblId}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="${rowCount}" colCnt="${colCount}" cellSpacing="0" borderFillIDRef="1" noAdjust="0"><hp:sz width="${tableWidth}" widthRelTo="ABSOLUTE" height="${totalHeight}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/><hp:gridColList>${colDefs}</hp:gridColList>${rowXml}</hp:tbl></hp:run>${lineseg}</hp:p>`;
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
    this.container.addEventListener('contextmenu', e => {
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
          action: target => {
            const cellData = target._cellData;
            if (cellData && this.inlineEditor) {
              this.inlineEditor.enableEditMode(target, cellData);
            }
          },
        },
        { separator: true },
        {
          icon: '⬆️',
          label: '위에 행 추가',
          action: target => this.tableEditor.addRowAbove(target),
        },
        {
          icon: '⬇️',
          label: '아래에 행 추가',
          action: target => this.tableEditor.addRowBelow(target),
        },
        {
          icon: '⬅️',
          label: '왼쪽에 열 추가',
          action: target => this.tableEditor.addColumnLeft(target),
        },
        {
          icon: '➡️',
          label: '오른쪽에 열 추가',
          action: target => this.tableEditor.addColumnRight(target),
        },
        { separator: true },
        {
          icon: '🗑️',
          label: '행 삭제',
          action: target => this.tableEditor.deleteRow(target),
        },
        {
          icon: '🗑️',
          label: '열 삭제',
          action: target => this.tableEditor.deleteColumn(target),
        },
        { separator: true },
        {
          icon: '📋',
          label: '복사',
          shortcut: 'Ctrl+C',
          action: target => {
            const text = target.textContent || '';
            this.contextMenu.copyToClipboard(text);
          },
        },
        {
          icon: '📋',
          label: '붙여넣기',
          shortcut: 'Ctrl+V',
          action: async target => {
            const text = await this.contextMenu.pasteFromClipboard();
            if (text && target) {
              target.textContent = text;
              if (this.autoSaveManager) {
                this.autoSaveManager.markDirty();
              }
            }
          },
        },
        { separator: true },
        {
          icon: '🧹',
          label: '내용 비우기',
          shortcut: 'Delete',
          action: target => {
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
              const clearCellText = elements => {
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
          },
        },
        {
          icon: '🤖',
          label: 'AI로 생성',
          action: target => {
            if (this.chatPanel) {
              this.chatPanel.open();
              const cellText = target.textContent?.trim() || '';
              if (cellText) {
                this.chatPanel.setInput(`"${cellText}" 셀의 내용을 더 상세하게 작성해줘`);
              }
            }
          },
        },
      ];

      this.contextMenu.show(e, menuItems);
    });

    // Delete 키로 셀 내용 비우기
    this.container.addEventListener('keydown', e => {
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
      const clearCellText = elements => {
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
  BUILD_DATE: '2024-11-18',
};

// Default export
export default HWPXViewer;
