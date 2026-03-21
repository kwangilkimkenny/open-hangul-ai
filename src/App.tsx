/**
 * HAN-View React App
 * Hangul-style UI with Ribbon Toolbar
 *
 * @version 3.0.0
 */

import { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import HangulStyleToolbar from './components/HangulStyleToolbar';
import HangulStatusBar from './components/HangulStatusBar';
import HWPXViewerWrapper from './components/HWPXViewerWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import type { HWPXViewerInstance } from './types/viewer';
import { devLog, devError } from './utils/logger';

// Styles
import './App.css';
import './styles/hangul-toolbar.css';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewerInstance, setViewerInstance] = useState<HWPXViewerInstance | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    devLog('File selected:', file.name);
    setSelectedFile(file);
  }, []);

  const handleViewerReady = useCallback((viewer: HWPXViewerInstance) => {
    devLog('Viewer instance ready');
    setViewerInstance(viewer);
  }, []);

  const handleError = useCallback((error: Error) => {
    devError('Error in App:', error);
  }, []);

  const handleToggleAI = useCallback(() => {
    setShowAIPanel(prev => !prev);
  }, []);

  return (
    <ErrorBoundary>
      <div className="app-container">
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: '#363636', color: '#fff' },
            success: { duration: 2000, iconTheme: { primary: '#4ade80', secondary: '#fff' } },
            error: { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />

        {/* Hangul-Style Toolbar (Menu Bar + Ribbon) */}
        <HangulStyleToolbar
          viewer={viewerInstance}
          onFileSelect={handleFileSelect}
          onToggleAI={handleToggleAI}
          showAIPanel={showAIPanel}
        />

        {/* HWPX Viewer */}
        <HWPXViewerWrapper
          className="main-viewer"
          file={selectedFile}
          onDocumentLoad={handleViewerReady}
          onError={handleError}
          enableAI={true}
          showAIPanel={showAIPanel}
          onToggleAI={handleToggleAI}
        />

        {/* Hangul-Style Status Bar */}
        <HangulStatusBar viewer={viewerInstance} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
