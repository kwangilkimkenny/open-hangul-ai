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

interface HWPXViewerWrapperProps {
  className?: string;
  file?: File | null;
  onDocumentLoad?: (viewer: HWPXViewerInstance) => void;
  onError?: (error: Error) => void;
  enableAI?: boolean;
  showAIPanel?: boolean;
  onToggleAI?: () => void;
}

export function HWPXViewerWrapper({
  className = '',
  file,
  onDocumentLoad,
  onError,
  enableAI = true,
  showAIPanel: showAIPanelProp,
  onToggleAI,
}: HWPXViewerWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HWPXViewerInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ count: 0, current: 0 });
  // AI panel: use prop if provided, otherwise internal state
  const [showAIPanelInternal, setShowAIPanelInternal] = useState(false);
  const showAIPanel = showAIPanelProp !== undefined ? showAIPanelProp : showAIPanelInternal;
  const setShowAIPanel = onToggleAI || (() => setShowAIPanelInternal(prev => !prev));
  const [_aiReady, setAiReady] = useState(false);

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
      toast.loading('문서 로드 중...', { id: 'loading' });

      await viewerRef.current.loadFile(file);

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
          input.accept = '.hwpx';
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
              sections: [{
                elements: [
                  {
                    type: 'paragraph',
                    runs: [{ text: '', style: {} }],
                    text: '',
                    style: { textAlign: 'left', lineHeight: '1.6' }
                  }
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
              }],
              images: new Map(),
              borderFills: new Map(),
              metadata: {
                parsedAt: new Date().toISOString(),
                sectionsCount: 1,
                imagesCount: 0,
                borderFillsCount: 0,
              }
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
      if (!droppedFile.name.toLowerCase().endsWith('.hwpx')) {
        toast.error('HWPX 파일만 지원합니다');
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
      {/* Viewer Container with Drag & Drop */}
      <div
        ref={containerRef}
        id="hwpx-viewer-root"
        className={`hwpx-viewer-wrapper ${className} ${isDragging ? 'dragging' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'auto',
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />

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
              .hwpx 파일만 지원됩니다
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
            <span style={{ fontSize: '13px', color: '#6b7280', minWidth: '60px' }} aria-live="polite" aria-atomic="true">
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
      <div id="status-text" style={{ display: 'none' }}>준비됨</div>

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
          onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.8'; }}
        >
          AI
        </button>
      )}

      {/* ✅ AI Chat Panel (Vanilla JS UI) */}
      {showAIPanel && enableAI && (
        <>
          <div className="ai-chat-panel open" id="ai-chat-panel" role="complementary" aria-label="AI 문서 편집 패널">
            <div className="ai-chat-header">
              <h3 id="ai-chat-panel-title">AI 문서 편집</h3>
              <button className="ai-chat-toggle" id="ai-chat-toggle" aria-label="AI 패널 닫기">
                ✕
              </button>
            </div>

            <div className="ai-chat-messages" id="ai-chat-messages">
              {/* Messages will be dynamically added here */}
            </div>

            {/* Tab switcher: 도구 | 어시스턴트 */}
            <div className="ai-panel-tabs" id="ai-panel-tabs">
              <button className="ai-panel-tab active" id="ai-tab-tools" data-tab="tools">도구</button>
              <button className="ai-panel-tab" id="ai-tab-assistant" data-tab="assistant">어시스턴트</button>
            </div>

            {/* 도구 탭 (기존 버튼들) */}
            <div className="ai-structure-preview ai-tab-content" id="ai-tools-content" data-tab-content="tools">
              <button className="preview-structure-btn" id="preview-structure-btn">문서 구조 보기</button>
              <button className="preview-structure-btn" id="apply-style-btn" title="일관된 서식 자동 적용">스타일 적용</button>
              <button className="ai-save-btn" id="extract-template-btn" title="헤더만 남기고 내용 제거">템플릿 추출</button>
              <button className="ai-save-btn" id="fill-template-btn" title="레이아웃 유지 + AI로 전체 내용 채우기" style={{ background: '#10b981', color: 'white', fontWeight: 600 }}>템플릿 채우기</button>
              <button className="preview-structure-btn" id="cell-select-mode-btn" title="셀 단위로 유지/수정/생성 모드 설정">셀 선택</button>
              <button className="ai-save-btn" id="external-api-btn" title="외부 API에서 JSON 데이터를 가져와 문서에 채우기">외부 API</button>
              <button className="ai-save-btn" id="ai-regenerate-btn" title="다른 주제/난이도로 재생성">다시 생성</button>
              <button className="ai-save-btn" id="partial-edit-btn" title="선택한 항목만 수정">부분 수정</button>
              <button className="ai-save-btn" id="validate-document-btn" title="빈 칸, 오류 검사">검증</button>
              <button className="ai-save-btn" id="batch-generate-btn" title="여러 주제 한 번에 생성">일괄 생성</button>
              <button className="ai-save-btn" id="ai-save-btn">HWPX 저장</button>
            </div>

            {/* 어시스턴트 탭 (NEW) */}
            <div className="ai-assistant-content ai-tab-content" id="ai-assistant-content" data-tab-content="assistant" style={{ display: 'none' }}>
              <div className="ai-assistant-group">
                <div className="ai-assistant-group-label">문서 분석</div>
                <button className="ai-assistant-btn" id="ai-ast-summary" title="문서의 핵심 내용 3줄 요약">핵심 요약</button>
                <button className="ai-assistant-btn" id="ai-ast-keywords" title="주요 키워드/태그 추출">키워드 추출</button>
                <button className="ai-assistant-btn" id="ai-ast-audience" title="난이도/대상 독자 분석">독자 수준 분석</button>
              </div>
              <div className="ai-assistant-group">
                <div className="ai-assistant-group-label">업무 커뮤니케이션</div>
                <button className="ai-assistant-btn" id="ai-ast-forward-email" title="문서 전달용 이메일 본문 생성">전달 메일 작성</button>
                <button className="ai-assistant-btn" id="ai-ast-report-email" title="상사에게 보고할 메일 생성">보고 메일 작성</button>
                <button className="ai-assistant-btn" id="ai-ast-meeting" title="문서를 회의록 형태로 변환">회의록 변환</button>
              </div>
              <div className="ai-assistant-group">
                <div className="ai-assistant-group-label">검토 / 피드백</div>
                <button className="ai-assistant-btn" id="ai-ast-review" title="검토자 관점에서 체크리스트 생성">검토 의견</button>
                <button className="ai-assistant-btn" id="ai-ast-improve" title="문서 품질 개선점 분석">개선 제안</button>
                <button className="ai-assistant-btn" id="ai-ast-actions" title="후속 조치 사항 추출">액션 아이템</button>
              </div>
              <div className="ai-assistant-group">
                <div className="ai-assistant-group-label">변환 / 재작성</div>
                <button className="ai-assistant-btn" id="ai-ast-simplify" title="초등학생 수준으로 재작성">쉽게 풀어쓰기</button>
                <button className="ai-assistant-btn" id="ai-ast-formal" title="격식체 공문서 스타일로 변환">공식 문서화</button>
                <button className="ai-assistant-btn" id="ai-ast-translate" title="영어로 번역">영문 번역</button>
              </div>
            </div>

            <div className="ai-chat-input-container">
              <textarea
                className="ai-chat-input"
                id="ai-chat-input"
                placeholder="예: 이 문서를 초등학생이 이해할 수 있게 쉽게 바꿔줘&#10;(Shift+Enter: 줄바꿈, Enter: 전송)"
                rows={3}
                aria-label="AI에게 보낼 메시지 입력"
              />
              <button className="ai-chat-send" id="ai-chat-send">
                AI로 변경하기
              </button>
            </div>

            <div className="ai-chat-footer">
              <button className="ai-action-btn" id="ai-clear-btn">
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
