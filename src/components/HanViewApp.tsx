/**
 * 오픈한글 AI App - 통합 컴포넌트
 * 헤더 + 뷰어 + AI 패널이 모두 포함된 완성된 앱
 *
 * 사용법:
 * import { HanViewApp } from 'hanview-react';
 * import 'hanview-react/styles';
 *
 * <HanViewApp />
 *
 * @version 2.0.0
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import SimpleHeader from './SimpleHeader';
import HWPXViewerWrapper from './HWPXViewerWrapper';
import ErrorBoundary from './ErrorBoundary';
import Sidebar from './Sidebar';
import { devLog } from '../utils/logger';
import type { HWPXViewerInstance } from '../types/viewer';
import type { HWPXDocument } from '../types/hwpx';

// ============================================
// Props 타입 정의
// ============================================

export interface HanViewAppProps {
  /** 초기 파일 (선택) */
  initialFile?: File | null;

  /** AI 기능 활성화 (기본: true) */
  enableAI?: boolean;

  /** 헤더 표시 여부 (기본: true) */
  showHeader?: boolean;

  /** 헤더 제목 */
  headerTitle?: string;

  /** 헤더 부제목 */
  headerSubtitle?: string;

  /** 헤더 로고 (React 노드 또는 URL) */
  headerLogo?: React.ReactNode | string;

  /** 커스텀 헤더 컴포넌트 (완전 대체) */
  customHeader?: React.ReactNode;

  /** 추가 헤더 버튼 */
  headerButtons?: HeaderButton[];

  /** 테마 (light, dark, auto) */
  theme?: 'light' | 'dark' | 'auto';

  /** 컨테이너 스타일 */
  style?: CSSProperties;

  /** 컨테이너 클래스 */
  className?: string;

  /** 높이 (기본: 100vh) */
  height?: string | number;

  /** 문서 로드 콜백 */
  onDocumentLoad?: (viewer: HWPXViewerInstance, document: HWPXDocument | null) => void;

  /** 문서 저장 콜백 */
  onDocumentSave?: (result: { success: boolean; filename?: string }) => void;

  /** 에러 콜백 */
  onError?: (error: Error) => void;

  /** 파일 선택 콜백 */
  onFileSelect?: (file: File) => void;

  /** Toast 설정 */
  toastPosition?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

  /** Toast 비활성화 */
  disableToast?: boolean;

  /** 사이드바 초기 열림 상태 (기본: true) */
  initialSidebarOpen?: boolean;
}

export interface HeaderButton {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

// ============================================
// 메인 컴포넌트
// ============================================

export function HanViewApp({
  initialFile = null,
  enableAI = true,
  showHeader = true,
  headerTitle = '오픈한글 AI',
  headerSubtitle = 'HWPX Viewer & AI Editor',
  headerLogo,
  customHeader,
  headerButtons = [],
  theme = 'light',
  style,
  className = '',
  height = '100vh',
  onDocumentLoad,
  onDocumentSave,
  onError,
  onFileSelect,
  toastPosition = 'top-right',
  disableToast = false,
  initialSidebarOpen = true,
}: HanViewAppProps) {
  // 상태 관리
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile);
  const [viewerInstance, setViewerInstance] = useState<HWPXViewerInstance | null>(null);
  const [showSidebar, setShowSidebar] = useState(initialSidebarOpen);

  // Note: initialFile은 초기값으로만 사용됨
  // 외부에서 파일을 변경하려면 key prop으로 컴포넌트를 재마운트하거나
  // onFileSelect 콜백을 통해 handleFileSelect를 호출

  // 테마 적용
  useEffect(() => {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(
    (file: File) => {
      devLog('📁 File selected:', file.name);
      setSelectedFile(file);
      onFileSelect?.(file);
    },
    [onFileSelect]
  );

  // 뷰어 준비 완료 핸들러
  const handleViewerReady = useCallback(
    (viewer: HWPXViewerInstance) => {
      devLog('✅ Viewer instance ready');
      setViewerInstance(viewer);

      const document = viewer?.getDocument?.();
      onDocumentLoad?.(viewer, document);
    },
    [onDocumentLoad]
  );

  // 에러 핸들러
  const handleError = useCallback(
    (error: Error) => {
      console.error('❌ Error:', error);
      onError?.(error);

      if (!disableToast) {
        toast.error(`오류: ${error.message}`);
      }
    },
    [onError, disableToast]
  );

  // 저장 핸들러
  const handleSave = useCallback(async () => {
    if (!viewerInstance) {
      toast.error('문서가 로드되지 않았습니다');
      return;
    }

    try {
      const result = await viewerInstance.saveFile?.();
      if (result) {
        onDocumentSave?.(result);

        if (!disableToast && result.success) {
          toast.success('저장 완료!');
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('저장 실패');
      handleError(err);
    }
  }, [viewerInstance, onDocumentSave, disableToast, handleError]);

  // 인쇄 핸들러 (향후 사용 예정)
  // const handlePrint = useCallback(() => {
  //   if (!viewerInstance) {
  //     toast.error('문서가 로드되지 않았습니다');
  //     return;
  //   }
  //   viewerInstance.printDocument?.();
  // }, [viewerInstance]);

  // 컨테이너 스타일
  const containerStyle: CSSProperties = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    height: typeof height === 'number' ? `${height}px` : height,
    width: '100%',
    overflow: 'hidden',
    ...style,
  }), [height, style]);

  // 사이드바 토글 핸들러
  const handleToggleSidebar = useCallback(() => {
    setShowSidebar(prev => !prev);
  }, []);

  // 헤더 버튼 목록 (memoized to prevent unnecessary SimpleHeader re-renders)
  const combinedHeaderButtons = useMemo(() => {
    const toggleSidebarButton: HeaderButton = {
      id: 'toggle-sidebar',
      label: showSidebar ? '정보 숨기기' : '정보 보기',
      icon: <span style={{ fontSize: '16px' }}>ℹ️</span>,
      onClick: handleToggleSidebar,
      variant: 'secondary',
    };

    const saveButton: HeaderButton = {
      id: 'save-document',
      label: '저장',
      icon: <span style={{ fontSize: '16px' }}>💾</span>,
      onClick: handleSave,
      disabled: !viewerInstance,
      variant: 'primary',
    };

    return [saveButton, toggleSidebarButton, ...headerButtons];
  }, [showSidebar, handleToggleSidebar, handleSave, viewerInstance, headerButtons]);

  return (
    <ErrorBoundary>
      <div className={`hanview-app ${className}`} style={containerStyle} data-theme={theme}>
        {/* Toast Notifications */}
        {!disableToast && (
          <Toaster
            position={toastPosition}
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 2000,
                iconTheme: {
                  primary: '#4ade80',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        )}

        {/* Header */}
        {showHeader &&
          (customHeader || (
            <SimpleHeader
              onFileSelect={handleFileSelect}
              viewer={viewerInstance}
              title={headerTitle}
              subtitle={headerSubtitle}
              logo={headerLogo}
              additionalButtons={combinedHeaderButtons}
            />
          ))}

        {/* Viewer Body with Sidebar */}
        <div
          className="viewer-body hanview-body-container"
          style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}
        >
          <Sidebar viewer={viewerInstance} file={selectedFile} isOpen={showSidebar} />

          <div
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <HWPXViewerWrapper
              className="hanview-viewer flex-1"
              file={selectedFile}
              onDocumentLoad={handleViewerReady}
              onError={handleError}
              enableAI={enableAI}
            />
          </div>
        </div>
      </div>

      {/* 전역 스타일 */}
      <style>{`
        .hanview-app {
          font-family: 'Malgun Gothic', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        .hanview-viewer {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </ErrorBoundary>
  );
}

export default HanViewApp;
