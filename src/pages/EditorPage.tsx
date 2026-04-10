/**
 * Editor Page
 * 기존 에디터를 라우트로 분리
 */
import { useState, useCallback } from 'react';
import HangulStyleToolbar from '../components/HangulStyleToolbar';
import HangulStatusBar from '../components/HangulStatusBar';
import HWPXViewerWrapper from '../components/HWPXViewerWrapper';
import type { HWPXViewerInstance } from '../types/viewer';
import { devLog, devError } from '../utils/logger';
import { t } from '../lib/i18n';

export function EditorPage() {
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
    <div className="app-container">
      <a href="#hwpx-viewer-root" className="skip-to-content">{t('msg.skipToContent')}</a>

      <HangulStyleToolbar
        viewer={viewerInstance}
        onFileSelect={handleFileSelect}
        onToggleAI={handleToggleAI}
        showAIPanel={showAIPanel}
      />

      <HWPXViewerWrapper
        className="main-viewer"
        file={selectedFile}
        onDocumentLoad={handleViewerReady}
        onError={handleError}
        enableAI={true}
        showAIPanel={showAIPanel}
        onToggleAI={handleToggleAI}
      />

      <HangulStatusBar viewer={viewerInstance} />
    </div>
  );
}

export default EditorPage;
