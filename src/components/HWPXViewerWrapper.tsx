/**
 * HWPX Viewer React Wrapper
 * 기존 작동하는 순수 JS Viewer를 React에서 사용
 *
 * @version 1.0.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: `any` types are intentional for vanilla JS interop
import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { HWPXViewerInstance } from '../types/viewer';
import { devLog, devError, devWarn } from '../utils/logger';
import { TrackChangesPanel } from './TrackChangesPanel';
import { CommentsPanel } from './CommentsPanel';

// ✅ 기존 작동하는 vanilla JS 뷰어 import
import HWPXViewer from '../lib/vanilla/viewer.js';

// ✅ CSS 변수 (테마 시스템)
import '../styles/vanilla/variables.css';

// ✅ Vanilla CSS import
import '../styles/vanilla/viewer.css';
import '../styles/vanilla/ai-chat.css';
import '../styles/vanilla/ai-editor.css';
import '../styles/vanilla/ai-text-editor.css';
import '../styles/vanilla/edit-mode.css';
import '../styles/vanilla/cell-selector.css';
import '../styles/vanilla/external-api.css';
import '../styles/vanilla/ai-security.css';
import '../styles/vanilla/track-changes.css';
import '../styles/vanilla/comments.css';

// ✅ AI 시맨틱 진단 도구 (window.__runDiagnostic 등록)
import '../lib/ai/diagnostic';

interface HWPXViewerWrapperProps {
  className?: string;
  file?: File | null;
  onDocumentLoad?: (viewer: HWPXViewerInstance) => void;
  onError?: (error: Error) => void;
  enableAI?: boolean;
  showAIPanel?: boolean;
  onToggleAI?: () => void;
  /** 'inline' (default — cell-level editing) | 'canvas' (whole-document via canvas-editor) */
  editorType?: 'inline' | 'canvas';
}

export function HWPXViewerWrapper({
  className = '',
  file,
  onDocumentLoad,
  onError,
  enableAI = true,
  showAIPanel: showAIPanelProp,
  onToggleAI,
  editorType = 'inline',
}: HWPXViewerWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HWPXViewerInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ count: 0, current: 0 });
  const [showTrackChanges, setShowTrackChanges] = useState(false);
  const [showComments, setShowComments] = useState(false);
  // AI panel: use prop if provided, otherwise internal state
  const [showAIPanelInternal, setShowAIPanelInternal] = useState(false);
  const showAIPanel = showAIPanelProp !== undefined ? showAIPanelProp : showAIPanelInternal;
  const setShowAIPanel = onToggleAI || (() => setShowAIPanelInternal(prev => !prev));
  const [, setAiReady] = useState(false);

  // ✅ Viewer 초기화 (마운트 시 1번만)
  useEffect(() => {
    // Debug: 글로벌에 상태 저장
    (window as any).__DEBUG_HWPX = {
      hasContainer: !!containerRef.current,
      hasViewer: !!viewerRef.current,
      timestamp: new Date().toISOString(),
    };

    if (!containerRef.current || viewerRef.current) {
      if ((window as any).__DEBUG_HWPX) {
        (window as any).__DEBUG_HWPX.skipped = true;
        (window as any).__DEBUG_HWPX.skipReason = !containerRef.current
          ? 'no container'
          : 'viewer exists';
      }
      return;
    }

    devLog('🚀 Initializing HWPX Viewer (Vanilla JS)...');

    try {
      // Viewer 인스턴스 생성
      const viewer = new HWPXViewer({
        container: containerRef.current,
        enableAI,
        editorType,
        useWorker: true, // ES Module Worker (Vite 호환)
        onLoad: (doc: any) => {
          devLog('✅ Document loaded:', doc);
          setIsLoading(false);
          toast.success('문서 로드 완료!');
          // ❌ Document 객체가 아니라 Viewer 인스턴스를 전달해야 함
        },
        onError: (err: Error) => {
          devError('❌ Viewer error:', err);
          setIsLoading(false);
          toast.error(`오류: ${err.message}`);
          onError?.(err);
        },
      } as any);

      viewerRef.current = viewer as any as HWPXViewerInstance;
      setIsInitialized(true);
      devLog('✅ HWPX Viewer initialized');

      // ✅ 자동저장 활성화
      if ((viewer as any).autoSaveManager) {
        (viewer as any).autoSaveManager.enableAutoSave();
        devLog('✅ AutoSave enabled');
      }

      // ✅ Viewer 인스턴스를 부모 컴포넌트로 전달
      onDocumentLoad?.(viewer as any as HWPXViewerInstance);
    } catch (error: any) {
      devError('❌ Failed to initialize viewer:', error);
      devError('❌ Error message:', error?.message);
      devError('❌ Error stack:', error?.stack);
      // Also show error details in alert for debugging
      alert(`뷰어 초기화 실패:\n${error?.message || error}`);
      toast.error('뷰어 초기화 실패');
      setIsInitialized(false);
    }

    // Cleanup (컴포넌트 언마운트 시에만)
    return () => {
      if (viewerRef.current) {
        devLog('🧹 Cleaning up viewer...');
        viewerRef.current.destroy?.();
        viewerRef.current = null;
        setIsInitialized(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열: 마운트 시 1번만 실행

  // ✅ 파일 열기 핸들러
  const handleFileOpen = useCallback(async (file: File) => {
    if (!viewerRef.current) {
      toast.error('뷰어가 초기화되지 않았습니다');
      return;
    }

    // 🔒 Security: 파일 크기 제한 (최대 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = Math.round(MAX_FILE_SIZE / 1024 / 1024);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      toast.error(
        `파일 크기가 너무 큽니다. 최대 ${maxSizeMB}MB까지 지원됩니다. (현재: ${fileSizeMB}MB)`
      );
      devWarn(`⚠️ File size exceeds limit: ${fileSizeMB}MB (max: ${maxSizeMB}MB)`);
      return;
    }

    try {
      setIsLoading(true);

      const fileToLoad = file;

      // DOCX 파일인 경우 문서 데이터로 직접 변환
      if (file.name.toLowerCase().endsWith('.docx')) {
        toast.loading('DOCX 로드 중...', { id: 'loading' });
        try {
          const buffer = await file.arrayBuffer();
          const { parseDocx } = await import('../lib/docx/parser');
          const docxDocument = await parseDocx(buffer, file.name);
          await viewerRef.current.loadDocument(docxDocument as any);
          (viewerRef.current as any).state.docxSource = true;
          (viewerRef.current as any).state.isNewDocument = true;
          toast.dismiss('loading');
          toast.success('DOCX 문서 로드 완료');
          setIsLoading(false);
          if (
            (viewerRef.current as any).editModeManager &&
            !(viewerRef.current as any).editModeManager.isGlobalEditMode
          ) {
            (viewerRef.current as any).editModeManager.toggleGlobalEditMode();
          }
          document.body.classList.add('global-edit-mode');
        } catch (docxError: any) {
          toast.dismiss('loading');
          devError('DOCX parse failed:', docxError);
          toast.error(`DOCX 로드 실패: ${docxError?.message}`);
          setIsLoading(false);
        }
        return;
      }

      // Excel 파일인 경우 문서 데이터로 직접 변환
      if (file.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
        toast.loading('Excel 로드 중...', { id: 'loading' });
        try {
          const buffer = await file.arrayBuffer();
          const { parseExcel } = await import('../lib/excel/parser');
          const excelDocument = await parseExcel(buffer, file.name);
          await viewerRef.current.loadDocument(excelDocument as any);
          (viewerRef.current as any).state.excelSource = true;
          (viewerRef.current as any).state.isNewDocument = true;
          toast.dismiss('loading');
          toast.success('Excel 문서 로드 완료');
          setIsLoading(false);
          if (
            (viewerRef.current as any).editModeManager &&
            !(viewerRef.current as any).editModeManager.isGlobalEditMode
          ) {
            (viewerRef.current as any).editModeManager.toggleGlobalEditMode();
          }
          document.body.classList.add('global-edit-mode');
        } catch (excelError: any) {
          toast.dismiss('loading');
          devError('Excel parse failed:', excelError);
          toast.error(`Excel 로드 실패: ${excelError?.message}`);
          setIsLoading(false);
        }
        return;
      }

      // Markdown 파일인 경우 문서 데이터로 직접 변환
      if (file.name.toLowerCase().endsWith('.md')) {
        toast.loading('Markdown 로드 중...', { id: 'loading' });
        try {
          const text = await file.text();
          const { parseMarkdown } = await import('../lib/markdown/parser');
          const mdDocument = parseMarkdown(text);
          await viewerRef.current.loadDocument(mdDocument as any);
          // 원본 파일명 저장 (저장 시 참조)
          (viewerRef.current as any).state.markdownSource = true;
          (viewerRef.current as any).state.isNewDocument = true;
          toast.dismiss('loading');
          toast.success('Markdown 문서 로드 완료');
          setIsLoading(false);
          if (
            (viewerRef.current as any).editModeManager &&
            !(viewerRef.current as any).editModeManager.isGlobalEditMode
          ) {
            (viewerRef.current as any).editModeManager.toggleGlobalEditMode();
          }
          document.body.classList.add('global-edit-mode');
        } catch (mdError: any) {
          toast.dismiss('loading');
          devError('Markdown parse failed:', mdError);
          toast.error(`Markdown 로드 실패: ${mdError?.message}`);
          setIsLoading(false);
        }
        return;
      }

      // PDF 파일인 경우 문서 데이터로 직접 변환
      if (file.name.toLowerCase().endsWith('.pdf')) {
        toast.loading('PDF 로드 중...', { id: 'loading' });
        try {
          const buffer = await file.arrayBuffer();
          const { parsePDF } = await import('../lib/pdf/parser');
          const pdfDocument = await parsePDF(buffer, file.name);
          await viewerRef.current.loadDocument(pdfDocument as any);
          (viewerRef.current as any).state.pdfSource = true;
          (viewerRef.current as any).state.isNewDocument = true;
          toast.dismiss('loading');
          toast.success('PDF 문서 로드 완료');
          setIsLoading(false);
          if (
            (viewerRef.current as any).editModeManager &&
            !(viewerRef.current as any).editModeManager.isGlobalEditMode
          ) {
            (viewerRef.current as any).editModeManager.toggleGlobalEditMode();
          }
          document.body.classList.add('global-edit-mode');
        } catch (pdfError: any) {
          toast.dismiss('loading');
          devError('PDF parse failed:', pdfError);
          toast.error(`PDF 로드 실패: ${pdfError?.message}`);
          setIsLoading(false);
        }
        return;
      }

      // ODF 파일인 경우 (ODT/ODS) 문서 데이터로 직접 변환
      if (file.name.toLowerCase().match(/\.(odt|ods|odp)$/)) {
        toast.loading('ODF 로드 중...', { id: 'loading' });
        try {
          const buffer = await file.arrayBuffer();
          const { parseODF } = await import('../lib/odf/parser');
          const odfDocument = await parseODF(buffer, file.name);
          await viewerRef.current.loadDocument(odfDocument as any);
          (viewerRef.current as any).state.odfSource = true;
          (viewerRef.current as any).state.isNewDocument = true;
          toast.dismiss('loading');
          toast.success('ODF 문서 로드 완료');
          setIsLoading(false);
          if (
            (viewerRef.current as any).editModeManager &&
            !(viewerRef.current as any).editModeManager.isGlobalEditMode
          ) {
            (viewerRef.current as any).editModeManager.toggleGlobalEditMode();
          }
          document.body.classList.add('global-edit-mode');
        } catch (odfError: any) {
          toast.dismiss('loading');
          devError('ODF parse failed:', odfError);
          toast.error(`ODF 로드 실패: ${odfError?.message}`);
          setIsLoading(false);
        }
        return;
      }

      // PPTX 파일인 경우 문서 데이터로 직접 변환
      if (file.name.toLowerCase().match(/\.(pptx|ppt)$/)) {
        toast.loading('PPTX 로드 중...', { id: 'loading' });
        try {
          const buffer = await file.arrayBuffer();
          const { parsePptx } = await import('../lib/pptx/parser');
          const pptxDocument = await parsePptx(buffer, file.name);
          await viewerRef.current.loadDocument(pptxDocument as any);
          (viewerRef.current as any).state.pptxSource = true;
          (viewerRef.current as any).state.isNewDocument = true;
          toast.dismiss('loading');
          toast.success('PPTX 문서 로드 완료');
          setIsLoading(false);
          if (
            (viewerRef.current as any).editModeManager &&
            !(viewerRef.current as any).editModeManager.isGlobalEditMode
          ) {
            (viewerRef.current as any).editModeManager.toggleGlobalEditMode();
          }
          document.body.classList.add('global-edit-mode');
        } catch (pptxError: any) {
          toast.dismiss('loading');
          devError('PPTX parse failed:', pptxError);
          toast.error(`PPTX 로드 실패: ${pptxError?.message}`);
          setIsLoading(false);
        }
        return;
      }

      // HWP 파일인 경우 HWPX로 변환
      if (file.name.toLowerCase().endsWith('.hwp')) {
        toast.loading('HWP → HWPX 변환 중...', { id: 'loading' });
        try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // 매직바이트 검증 (OLE Compound Document: D0 CF 11 E0 A1 B1 1A E1 — 8바이트 전체)
          if (
            uint8Array.length < 8 ||
            uint8Array[0] !== 0xd0 ||
            uint8Array[1] !== 0xcf ||
            uint8Array[2] !== 0x11 ||
            uint8Array[3] !== 0xe0 ||
            uint8Array[4] !== 0xa1 ||
            uint8Array[5] !== 0xb1 ||
            uint8Array[6] !== 0x1a ||
            uint8Array[7] !== 0xe1
          ) {
            toast.dismiss('loading');
            toast.error(
              '유효한 HWP 파일이 아닙니다. 파일이 손상되었거나 지원되지 않는 형식입니다.'
            );
            setIsLoading(false);
            return;
          }

          throw new Error('HWP 형식은 현재 지원되지 않습니다. HWPX 로 변환 후 다시 시도해 주세요.');
        } catch (convertError: any) {
          toast.dismiss('loading');
          devError('❌ HWP conversion failed:', convertError);
          toast.error(`HWP 변환 실패: ${convertError?.message || '알 수 없는 오류'}`);
          setIsLoading(false);
          return;
        }
      }

      toast.loading('문서 로드 중...', { id: 'loading' });
      await viewerRef.current.loadFile(fileToLoad);

      toast.dismiss('loading');
    } catch (error) {
      devError('❌ Failed to load file:', error);
      toast.dismiss('loading');
      toast.error('파일 로드 실패');
      setIsLoading(false);
    }
  }, []);

  // ✅ AI 패널 열릴 때 AI 모듈 로드 및 ChatPanel 초기화
  useEffect(() => {
    if (!showAIPanel || !viewerRef.current || !isInitialized) return;

    const viewer = viewerRef.current as any;

    // AI 모듈이 이미 로드되어 ChatPanel이 초기화되었으면 re-init만
    if (viewer._aiModulesLoaded && viewer.chatPanel) {
      // DOM이 React에 의해 재생성되었으므로 ChatPanel re-init 필요
      viewer.chatPanel.init();
      setAiReady(true);
      return;
    }

    // AI 모듈 lazy load
    const initAI = async () => {
      try {
        await viewer.loadAIFeatures();
        // loadAIFeatures 내부에서 chatPanel.init()을 호출하지만
        // React DOM이 아직 마운트 중일 수 있으므로 다음 프레임에 re-init
        requestAnimationFrame(() => {
          if (viewer.chatPanel) {
            viewer.chatPanel.init();
          }
          setAiReady(true);
        });
      } catch (error: any) {
        devError('❌ Failed to load AI features:', error);
        toast.error(`AI 기능 로드 실패: ${error?.message}`);
      }
    };

    // React DOM이 렌더링된 후 init 호출을 위해 다음 프레임 대기
    requestAnimationFrame(() => {
      initAI();
    });
  }, [showAIPanel, isInitialized]);

  // ✅ 파일 prop 변경 시 자동 로드
  useEffect(() => {
    if (file && viewerRef.current && isInitialized) {
      devLog('📂 Loading file:', file.name);
      handleFileOpen(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, isInitialized]); // handleFileOpen은 의존성에서 제외 (안정적)

  // ✅ Public API: 외부에서 파일 로드 가능
  useEffect(() => {
    if (viewerRef.current && isInitialized) {
      // window 객체에 viewer 인스턴스 노출 (디버깅 및 외부 제어용)
      (window as any).__hwpxViewer = viewerRef.current;
      (window as any).__loadHWPXFile = handleFileOpen;
    }
  }, [isInitialized, handleFileOpen]);

  // ✅ 검토 패널 토글 이벤트 리스너
  useEffect(() => {
    const handleToggleTC = () => setShowTrackChanges(prev => !prev);
    const handleToggleComments = () => setShowComments(prev => !prev);
    window.addEventListener('toggle-track-changes-panel', handleToggleTC);
    window.addEventListener('toggle-comments-panel', handleToggleComments);
    return () => {
      window.removeEventListener('toggle-track-changes-panel', handleToggleTC);
      window.removeEventListener('toggle-comments-panel', handleToggleComments);
    };
  }, []);

  // ✅ 미저장 경고 (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const viewer = viewerRef.current as any;
      if (viewer?.autoSaveManager?.isDirty) {
        e.preventDefault();
        return '저장하지 않은 변경사항이 있습니다.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ✅ 키보드 단축키 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd 키 조합
      const isMod = e.ctrlKey || e.metaKey;

      if (!isMod) return;

      switch (e.key.toLowerCase()) {
        case 's':
          // Ctrl+S: 저장
          e.preventDefault();
          if (viewerRef.current?.saveFile) {
            devLog('⌨️ Ctrl+S: 저장');
            viewerRef.current
              .saveFile()
              .then(() => {
                toast.success('저장 완료');
              })
              .catch((err: Error) => {
                toast.error(`저장 실패: ${err.message}`);
              });
          } else {
            toast.error('저장할 문서가 없습니다');
          }
          break;

        case 'z':
          // Ctrl+Z: 실행취소, Ctrl+Shift+Z: 다시실행
          e.preventDefault();
          if (viewerRef.current?.historyManager) {
            if (e.shiftKey) {
              devLog('⌨️ Ctrl+Shift+Z: 다시실행');
              viewerRef.current.historyManager.redo();
              toast('다시실행', { icon: '↷' });
            } else {
              devLog('⌨️ Ctrl+Z: 실행취소');
              viewerRef.current.historyManager.undo();
              toast('실행취소', { icon: '↶' });
            }
          }
          break;

        case 'y':
          // Ctrl+Y: 다시실행
          e.preventDefault();
          if (viewerRef.current?.historyManager) {
            devLog('⌨️ Ctrl+Y: 다시실행');
            viewerRef.current.historyManager.redo();
            toast('다시실행', { icon: '↷' });
          }
          break;

        case 'p':
          // Ctrl+P: 인쇄
          e.preventDefault();
          if (viewerRef.current?.printDocument) {
            devLog('⌨️ Ctrl+P: 인쇄');
            viewerRef.current.printDocument();
          }
          break;

        case 'o': {
          // Ctrl+O: 파일 열기
          e.preventDefault();
          devLog('⌨️ Ctrl+O: 파일 열기');
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.hwpx,.hwp,.md,.xlsx,.xls,.docx,.pdf,.odt,.ods,.pptx';
          input.onchange = ev => {
            const file = (ev.target as HTMLInputElement).files?.[0];
            if (file) handleFileOpen(file);
          };
          input.click();
          break;
        }

        case 'f':
          // Ctrl+F: 검색
          e.preventDefault();
          setShowSearch(true);
          break;

        case 'n': {
          // Ctrl+N: 새 문서
          e.preventDefault();
          const v = viewerRef.current as any;
          if (v) {
            const emptyDocument = {
              sections: [
                {
                  elements: [
                    {
                      type: 'paragraph',
                      runs: [{ text: '', style: {} }],
                      text: '',
                      style: { textAlign: 'left', lineHeight: '1.6' },
                    },
                  ],
                  pageSettings: {
                    width: '794px',
                    height: '1123px',
                    marginLeft: '85px',
                    marginRight: '85px',
                    marginTop: '71px',
                    marginBottom: '57px',
                  },
                  pageWidth: 794,
                  pageHeight: 1123,
                  headers: { both: null, odd: null, even: null },
                  footers: { both: null, odd: null, even: null },
                },
              ],
              images: new Map(),
              borderFills: new Map(),
              metadata: {
                parsedAt: new Date().toISOString(),
                sectionsCount: 1,
                imagesCount: 0,
                borderFillsCount: 0,
              },
            };
            v.createNewDocument(emptyDocument);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFileOpen]);

  // ✅ 드래그 앤 드롭 핸들러
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 실제로 컨테이너를 벗어났는지 확인
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const droppedFile = files[0];

      // HWPX 파일 확인
      if (!droppedFile.name.toLowerCase().match(/\.(hwpx|hwp|md|xlsx|xls|docx)$/)) {
        toast.error('HWP/HWPX/MD/Excel/DOCX 파일만 지원합니다');
        return;
      }

      devLog('📂 File dropped:', droppedFile.name);
      handleFileOpen(droppedFile);
    },
    [handleFileOpen]
  );

  // ✅ 검색 핸들러
  const handleSearch = useCallback((query: string) => {
    if (!viewerRef.current?.search || !viewerRef.current?.container) return;

    const results = viewerRef.current.search.search(
      query,
      viewerRef.current.container as HTMLElement
    );
    setSearchResults({ count: results.length, current: 0 });

    if (results.length > 0) {
      viewerRef.current.search.next();
      setSearchResults({ count: results.length, current: 1 });
    }
  }, []);

  const handleSearchNext = useCallback(() => {
    if (!viewerRef.current?.search) return;
    viewerRef.current.search.next();
    setSearchResults(prev => ({
      ...prev,
      current: (prev.current % prev.count) + 1,
    }));
  }, []);

  const handleSearchPrev = useCallback(() => {
    if (!viewerRef.current?.search) return;
    viewerRef.current.search.previous();
    setSearchResults(prev => ({
      ...prev,
      current: prev.current === 1 ? prev.count : prev.current - 1,
    }));
  }, []);

  const handleCloseSearch = useCallback(() => {
    if (viewerRef.current?.search) {
      viewerRef.current.search.clearHighlights();
    }
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults({ count: 0, current: 0 });
  }, []);

  return (
    <>
      {/* Viewer + Side Panels */}
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {/* Viewer Container with Drag & Drop */}
        <div
          ref={containerRef}
          id="hwpx-viewer-root"
          className={`hwpx-viewer-wrapper ${className} ${isDragging ? 'dragging' : ''}`}
          style={{
            flex: 1,
            height: '100%',
            position: 'relative',
            overflow: 'auto',
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />

        {/* Track Changes Panel */}
        {showTrackChanges && viewerRef.current && (
          <TrackChangesPanel
            viewer={viewerRef.current}
            onClose={() => setShowTrackChanges(false)}
          />
        )}

        {/* Comments Panel */}
        {showComments && viewerRef.current && (
          <CommentsPanel viewer={viewerRef.current} onClose={() => setShowComments(false)} />
        )}
      </div>

      {/* ✅ 드래그 오버레이 */}
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(17, 24, 39, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '48px 64px',
              textAlign: 'center',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
              border: '3px dashed #6b7280',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#111827' }}>
              HWPX 파일을 여기에 놓으세요
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
              .hwp/.hwpx 파일만 지원됩니다
            </div>
          </div>
        </div>
      )}

      {/* ✅ 검색 바 */}
      {showSearch && (
        <div
          role="search"
          aria-label="문서 내 검색"
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #e5e7eb',
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="검색어"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (e.shiftKey) {
                  handleSearchPrev();
                } else if (searchQuery !== e.currentTarget.value || searchResults.count === 0) {
                  handleSearch(e.currentTarget.value);
                } else {
                  handleSearchNext();
                }
              } else if (e.key === 'Escape') {
                handleCloseSearch();
              }
            }}
            placeholder="검색어 입력..."
            autoFocus
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              width: '200px',
              outline: 'none',
            }}
          />

          {searchResults.count > 0 && (
            <span
              style={{ fontSize: '13px', color: '#6b7280', minWidth: '60px' }}
              aria-live="polite"
              aria-atomic="true"
            >
              {searchResults.current}/{searchResults.count}
            </span>
          )}

          <button
            onClick={handleSearchPrev}
            aria-label="이전 검색 결과"
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            title="이전 (Shift+Enter)"
          >
            ▲
          </button>

          <button
            onClick={handleSearchNext}
            aria-label="다음 검색 결과"
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            title="다음 (Enter)"
          >
            ▼
          </button>

          <button
            onClick={handleCloseSearch}
            aria-label="검색 닫기"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#6b7280',
            }}
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </div>
      )}

      {/* ✅ Vanilla JS 필수 UI 요소들 */}

      {/* Toast Container */}
      <div
        id="toast-container"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
        }}
      />

      {/* ✅ 개선된 Loading Overlay */}
      <div
        id="loading-overlay"
        role="status"
        aria-live="polite"
        aria-label={isLoading ? '문서 로드 중' : undefined}
        style={{
          display: isLoading ? 'flex' : 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(17, 24, 39, 0.6)',
          backdropFilter: 'blur(4px)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '40px 56px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* 애니메이션 아이콘 */}
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #111827',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '24px',
              }}
            >
              📄
            </div>
          </div>

          {/* 로딩 텍스트 */}
          <p
            style={{
              color: '#111827',
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            문서 로드 중
          </p>
          <p
            className="loading-message"
            style={{
              color: '#6b7280',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            잠시만 기다려주세요...
          </p>

          {/* 프로그레스 바 */}
          <div
            style={{
              width: '200px',
              height: '4px',
              background: '#e5e7eb',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              id="loading-progress-bar"
              style={{
                width: '30%',
                height: '100%',
                background: '#111827',
                borderRadius: '2px',
                animation: 'loading-progress 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>

      {/* Status Text - now rendered by HangulStatusBar in App.tsx */}
      <div id="status-text" style={{ display: 'none' }}>
        준비됨
      </div>

      {/* Progress Container */}
      <div id="progress-container" style={{ display: 'none' }}>
        <div id="progress-bar" style={{ width: '0%' }} />
        <div id="progress-text">0%</div>
      </div>

      {/* AI Panel Toggle Button (small, unobtrusive) */}
      {enableAI && !showAIPanel && (
        <button
          onClick={() => typeof setShowAIPanel === 'function' && setShowAIPanel()}
          aria-label="AI 패널 열기"
          style={{
            position: 'fixed',
            bottom: '36px',
            right: '12px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#2b579a',
            border: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: 'white',
            zIndex: 9997,
            transition: 'all 0.2s ease',
            opacity: 0.8,
          }}
          title="AI 패널 열기"
          onMouseEnter={e => {
            (e.target as HTMLElement).style.opacity = '1';
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.opacity = '0.8';
          }}
        >
          AI
        </button>
      )}

      {/* ✅ AI Chat Panel (Vanilla JS UI) */}
      {showAIPanel && enableAI && (
        <>
          <div
            className="ai-chat-panel open"
            id="ai-chat-panel"
            role="complementary"
            aria-label="AI 문서 편집 패널"
          >
            <div className="ai-chat-header">
              <h3 id="ai-chat-panel-title">AI 문서 편집</h3>
              <button className="ai-chat-toggle" id="ai-chat-toggle" aria-label="AI 패널 닫기">
                ✕
              </button>
            </div>

            <div className="ai-chat-messages" id="ai-chat-messages">
              {/* Messages will be dynamically added here */}
            </div>

            {/* 어시스턴트 패널 (아코디언) */}
            <div className="ai-assistant-content" id="ai-assistant-content">
              <details className="ai-accordion">
                <summary className="ai-accordion-header">문서 분석</summary>
                <div className="ai-accordion-body">
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-summary"
                    title="문서의 핵심 내용 3줄 요약"
                  >
                    핵심 요약
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-keywords"
                    title="주요 키워드/태그 추출"
                  >
                    키워드 추출
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-audience"
                    title="난이도/대상 독자 분석"
                  >
                    독자 수준 분석
                  </button>
                </div>
              </details>
              <details className="ai-accordion">
                <summary className="ai-accordion-header">업무 커뮤니케이션</summary>
                <div className="ai-accordion-body">
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-forward-email"
                    title="문서 전달용 이메일 본문 생성"
                  >
                    전달 메일 작성
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-report-email"
                    title="상사에게 보고할 메일 생성"
                  >
                    보고 메일 작성
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-meeting"
                    title="문서를 회의록 형태로 변환"
                  >
                    회의록 변환
                  </button>
                </div>
              </details>
              <details className="ai-accordion">
                <summary className="ai-accordion-header">검토 / 피드백</summary>
                <div className="ai-accordion-body">
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-review"
                    title="검토자 관점에서 체크리스트 생성"
                  >
                    검토 의견
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-improve"
                    title="문서 품질 개선점 분석"
                  >
                    개선 제안
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-actions"
                    title="후속 조치 사항 추출"
                  >
                    액션 아이템
                  </button>
                </div>
              </details>
              <details className="ai-accordion">
                <summary className="ai-accordion-header">변환 / 재작성</summary>
                <div className="ai-accordion-body">
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-simplify"
                    title="초등학생 수준으로 재작성"
                  >
                    쉽게 풀어쓰기
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-formal"
                    title="격식체 공문서 스타일로 변환"
                  >
                    공식 문서화
                  </button>
                  <button className="ai-assistant-btn" id="ai-ast-translate" title="영어로 번역">
                    영문 번역
                  </button>
                </div>
              </details>
              <details className="ai-accordion">
                <summary className="ai-accordion-header">AI 문서 품질</summary>
                <div className="ai-accordion-body">
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-refine"
                    title="정부 AI 친화 문서 표준에 따라 문장 교정"
                  >
                    AI 친화 교정
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-readiness"
                    title="문서의 AI 처리 적합도를 5가지 기준으로 평가"
                  >
                    AI 품질 검증
                  </button>
                  <button
                    className="ai-assistant-btn"
                    id="ai-ast-local-check"
                    title="GPT 호출 없이 로컬 규칙으로 빠른 문서 품질 체크"
                  >
                    빠른 검사
                  </button>
                </div>
              </details>
              <details className="ai-accordion" open>
                <summary className="ai-accordion-header">보안 / 검증</summary>
                <div className="ai-accordion-body">
                  <div className="security-toggle-row">
                    <label
                      className="security-toggle-label"
                      title="AEGIS AI 보안 - 프롬프트 인젝션, PII 보호, 출력 필터링"
                    >
                      <input type="checkbox" id="aegis-toggle" className="security-toggle-input" />
                      <span className="security-toggle-switch"></span>
                      <span>AEGIS 보안</span>
                    </label>
                    <label
                      className="security-toggle-label"
                      title="TruthAnchor - AI 생성 텍스트 할루시네이션 검증"
                    >
                      <input
                        type="checkbox"
                        id="truthanchor-toggle"
                        className="security-toggle-input"
                      />
                      <span className="security-toggle-switch"></span>
                      <span>할루시네이션 검증</span>
                    </label>
                  </div>
                  <div className="security-status" id="security-status"></div>
                  <div
                    className="validation-results"
                    id="validation-results"
                    style={{ display: 'none' }}
                  ></div>
                </div>
              </details>
            </div>

            {/* 레퍼런스 파일 업로드 영역 */}
            <div className="ai-ref-upload" id="ai-ref-upload">
              <div className="ai-ref-dropzone" id="ai-ref-dropzone">
                <span className="ai-ref-icon">📎</span>
                <span className="ai-ref-text">레퍼런스 파일 드래그 또는 클릭</span>
                <span className="ai-ref-hint">.hwp .hwpx .txt .md .csv .json</span>
                <input
                  type="file"
                  id="ai-ref-file-input"
                  accept=".hwp,.hwpx,.txt,.md,.csv,.json,.html,.xml"
                  multiple
                  style={{ display: 'none' }}
                />
              </div>
              <div className="ai-ref-files" id="ai-ref-files" style={{ display: 'none' }}></div>
            </div>

            <div className="ai-chat-input-container">
              <textarea
                className="ai-chat-input"
                id="ai-chat-input"
                placeholder="메시지를 입력하세요 (Enter: 전송)"
                rows={3}
                aria-label="AI에게 보낼 메시지 입력"
              />
              <button className="ai-chat-send" id="ai-chat-send" title="전송">
                &#10148;
              </button>
            </div>

            <div className="ai-chat-footer">
              <button className="ai-action-btn ai-clear-btn" id="ai-clear-btn">
                대화 지우기
              </button>
            </div>
          </div>

          {/* AI Toggle Button (floating) */}
          <button className="ai-panel-toggle" id="ai-panel-toggle">
            AI
          </button>
        </>
      )}

      {/* Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes loading-progress {
          0% { 
            width: 0%; 
            margin-left: 0;
          }
          50% { 
            width: 60%; 
            margin-left: 20%;
          }
          100% { 
            width: 0%; 
            margin-left: 100%;
          }
        }
        
        .hwpx-viewer-wrapper {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          transition: all 0.2s ease;
        }
        
        .hwpx-viewer-wrapper.dragging {
          opacity: 0.7;
        }
        
        /* 단축키 힌트 */
        .shortcut-hint {
          position: fixed;
          bottom: 40px;
          right: 20px;
          background: rgba(17, 24, 39, 0.9);
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 12px;
          z-index: 1000;
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.2s ease;
          pointer-events: none;
        }
        
        .shortcut-hint.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </>
  );
}

export default HWPXViewerWrapper;
