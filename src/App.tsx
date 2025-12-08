/**
 * HAN-View React App
 * HWPX 문서 뷰어 메인 애플리케이션
 * 
 * @version 2.0.0
 */

import { useEffect, useCallback } from 'react';
import { Header, Sidebar, Footer, ViewerToolbar } from './components/layout';
import { DocumentViewer } from './components/viewer/DocumentViewer';
import { ChatPanel } from './components/ai/ChatPanel';
import { ToastContainer } from './components/ui/Toast';
import { LoadingOverlay } from './components/common/LoadingOverlay';
import { useAutoSave } from './hooks/useAutoSave';
import { useDocumentStore } from './stores/documentStore';
import { useUIStore } from './stores/uiStore';
import './styles/viewer.css';
import './styles/chat-panel.css';
import './styles/toolbar.css';
import './App.css';

function App() {
  const { theme, isGlobalLoading, loadingMessage, currentPage, setCurrentPage, isAIPanelOpen } = useUIStore();
  const { document } = useDocumentStore();
  
  // 자동 저장 훅 초기화
  useAutoSave({ enabled: true, interval: 30000 });

  // 테마 적용
  useEffect(() => {
    const docRoot = window.document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      docRoot.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      docRoot.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    
    // 해당 페이지로 스크롤
    const pageElement = window.document.querySelector(`[data-page-number="${page}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [setCurrentPage]);

  // 페이지 선택 핸들러 (사이드바에서)
  const handlePageSelect = useCallback((pageNumber: number) => {
    handlePageChange(pageNumber);
  }, [handlePageChange]);

  // 총 페이지 수
  const totalPages = document?.sections?.length || 0;

  return (
    <div className={`viewer-container ${isAIPanelOpen ? 'ai-panel-open' : ''}`}>
      {/* 상단 헤더 */}
      <Header />
      
      {/* 뷰어 콘텐츠 영역 */}
      <div className="viewer-content">
        {/* 사이드바 - 항상 렌더링 */}
        <Sidebar 
          currentPage={currentPage}
          onPageSelect={handlePageSelect}
        />
        
        {/* 메인 뷰어 */}
        <div className="viewer-main">
          {/* 뷰어 툴바 */}
          <ViewerToolbar />
          
          {/* 문서 렌더 영역 */}
          <div className="render-container" id="render-container">
            <DocumentViewer />
          </div>
        </div>
      </div>

      {/* 하단 푸터 */}
      <Footer 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* AI 채팅 패널 */}
      <ChatPanel />
      
      {/* 토스트 알림 */}
      <ToastContainer />
      
      {/* 전역 로딩 오버레이 */}
      {isGlobalLoading && (
        <LoadingOverlay 
          fullScreen 
          message={loadingMessage || '처리 중...'} 
        />
      )}
    </div>
  );
}

export default App;
