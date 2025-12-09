/**
 * HWPX Viewer React Wrapper
 * 기존 작동하는 순수 JS Viewer를 React에서 사용
 * 
 * @version 1.0.0
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';

// ✅ 기존 작동하는 vanilla JS 뷰어 import
import HWPXViewer from '../lib/vanilla/viewer.js';

// ✅ Vanilla CSS import
import '../styles/vanilla/viewer.css';
import '../styles/vanilla/ai-chat.css';
import '../styles/vanilla/ai-editor.css';
import '../styles/vanilla/ai-text-editor.css';
import '../styles/vanilla/edit-mode.css';

interface HWPXViewerWrapperProps {
  className?: string;
  file?: File | null;
  onDocumentLoad?: (viewer: any) => void; // ✅ viewer 인스턴스 전달
  onError?: (error: Error) => void;
  enableAI?: boolean;
}

export function HWPXViewerWrapper({
  className = '',
  file,
  onDocumentLoad,
  onError,
  enableAI = true,
}: HWPXViewerWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Viewer 초기화 (마운트 시 1번만)
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    console.log('🚀 Initializing HWPX Viewer (Vanilla JS)...');

    try {
      // Viewer 인스턴스 생성
      const viewer = new HWPXViewer({
        container: containerRef.current,
        enableAI,
        useWorker: false, // ✅ Worker 비활성화 (Vite 호환성 문제)
        onLoad: (doc: any) => {
          console.log('✅ Document loaded:', doc);
          setIsLoading(false);
          toast.success('문서 로드 완료!');
          // ❌ Document 객체가 아니라 Viewer 인스턴스를 전달해야 함
        },
        onError: (err: Error) => {
          console.error('❌ Viewer error:', err);
          setIsLoading(false);
          toast.error(`오류: ${err.message}`);
          onError?.(err);
        },
      });

      viewerRef.current = viewer;
      setIsInitialized(true);
      console.log('✅ HWPX Viewer initialized');
      
      // ✅ Viewer 인스턴스를 부모 컴포넌트로 전달
      onDocumentLoad?.(viewer);

    } catch (error) {
      console.error('❌ Failed to initialize viewer:', error);
      toast.error('뷰어 초기화 실패');
      setIsInitialized(false);
    }

    // Cleanup (컴포넌트 언마운트 시에만)
    return () => {
      if (viewerRef.current) {
        console.log('🧹 Cleaning up viewer...');
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

    try {
      setIsLoading(true);
      toast.loading('문서 로드 중...', { id: 'loading' });
      
      await viewerRef.current.loadFile(file);
      
      toast.dismiss('loading');
    } catch (error) {
      console.error('❌ Failed to load file:', error);
      toast.dismiss('loading');
      toast.error('파일 로드 실패');
      setIsLoading(false);
    }
  }, []);

  // ✅ 파일 prop 변경 시 자동 로드
  useEffect(() => {
    if (file && viewerRef.current && isInitialized) {
      console.log('📂 Loading file:', file.name);
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

  return (
    <>
      {/* Viewer Container */}
      <div
        ref={containerRef}
        id="hwpx-viewer-root"
        className={`hwpx-viewer-wrapper ${className}`}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'auto',
        }}
      />

      {/* ✅ Vanilla JS 필수 UI 요소들 */}
      
      {/* Toast Container */}
      <div id="toast-container" style={{ 
        position: 'fixed', 
        top: '20px', 
        right: '20px', 
        zIndex: 10000 
      }} />
      
      {/* Loading Overlay */}
      <div 
        id="loading-overlay" 
        style={{ 
          display: isLoading ? 'flex' : 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.95)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            className="loading-spinner"
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e0e0e0',
              borderTop: '4px solid #667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p className="loading-message" style={{ color: '#666', fontSize: '14px' }}>
            문서 로드 중...
          </p>
        </div>
      </div>
      
      {/* Status Text (하단 상태 표시줄) */}
      <div id="status-text" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '32px',
        background: '#f5f5f5',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: '12px',
        color: '#666',
        zIndex: 100
      }}>
        준비됨
      </div>
      
      {/* Progress Container */}
      <div id="progress-container" style={{ display: 'none' }}>
        <div id="progress-bar" style={{ width: '0%' }} />
        <div id="progress-text">0%</div>
      </div>

      {/* ✅ AI Chat Panel (Vanilla JS UI) */}
      {enableAI && (
        <>
          <div className="ai-chat-panel" id="ai-chat-panel">
            <div className="ai-chat-header">
              <h3>AI 문서 편집</h3>
              <button className="ai-chat-toggle" id="ai-chat-toggle">✕</button>
            </div>
            
            <div className="ai-chat-messages" id="ai-chat-messages">
              {/* Messages will be dynamically added here */}
            </div>
            
            <div className="ai-structure-preview">
              <button className="preview-structure-btn" id="preview-structure-btn">
                문서 구조 보기
              </button>
              <button className="preview-structure-btn" id="apply-style-btn" title="일관된 서식 자동 적용">
                스타일 적용
              </button>
              <button className="ai-save-btn" id="extract-template-btn" title="헤더만 남기고 내용 제거">
                템플릿 추출
              </button>
              <button className="ai-save-btn" id="ai-regenerate-btn" title="다른 주제/난이도로 재생성">
                다시 생성
              </button>
              <button className="ai-save-btn" id="partial-edit-btn" title="선택한 항목만 수정">
                부분 수정
              </button>
              <button className="ai-save-btn" id="validate-document-btn" title="빈 칸, 오류 검사">
                검증
              </button>
              <button className="ai-save-btn" id="batch-generate-btn" title="여러 주제 한 번에 생성">
                일괄 생성
              </button>
              <button className="ai-save-btn" id="ai-save-btn">
                HWPX 저장
              </button>
            </div>
            
            <div className="ai-chat-input-container">
              <textarea
                className="ai-chat-input"
                id="ai-chat-input"
                placeholder="예: 이 문서를 초등학생이 이해할 수 있게 쉽게 바꿔줘&#10;(Shift+Enter: 줄바꿈, Enter: 전송)"
                rows={3}
              />
              <button className="ai-chat-send" id="ai-chat-send">AI로 변경하기</button>
            </div>

            <div className="ai-chat-footer">
              <button className="ai-action-btn" id="ai-api-key-btn">
                API 키 설정
              </button>
              <button className="ai-action-btn" id="custom-api-settings-btn">
                커스텀 API
              </button>
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
        
        .hwpx-viewer-wrapper {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
    </>
  );
}

export default HWPXViewerWrapper;

