/**
 * HAN-View React App
 * Vanilla JS Viewer를 React Wrapper로 통합
 * 
 * @version 2.0.0
 */

import { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import SimpleHeader from './components/SimpleHeader';
import HWPXViewerWrapper from './components/HWPXViewerWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import type { HWPXViewerInstance } from './types/viewer';

// ✅ 전역 스타일 (레이아웃만)
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewerInstance, setViewerInstance] = useState<HWPXViewerInstance | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    console.log('📁 File selected:', file.name);
    setSelectedFile(file);
  }, []);

  const handleViewerReady = useCallback((viewer: HWPXViewerInstance) => {
    console.log('✅ Viewer instance ready:', viewer);
    setViewerInstance(viewer);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('❌ Error in App:', error);
  }, []);

  return (
    <ErrorBoundary>
      <div className="app-container">
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
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

        {/* Header */}
        <SimpleHeader 
          onFileSelect={handleFileSelect}
          viewer={viewerInstance}
        />

        {/* HWPX Viewer (Vanilla JS Wrapper) */}
        <HWPXViewerWrapper
          className="main-viewer"
          file={selectedFile}
          onDocumentLoad={handleViewerReady}
          onError={handleError}
          enableAI={true}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
