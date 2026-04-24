/**
 * Editor Page
 * 기존 에디터를 라우트로 분리
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import HangulStyleToolbar from '../components/HangulStyleToolbar';
import HangulStatusBar from '../components/HangulStatusBar';
import HWPXViewerWrapper from '../components/HWPXViewerWrapper';
import CommandPalette, { type CommandItem } from '../components/CommandPalette';
import DraftAIModal from '../components/DraftAIModal';
import OCRDialog from '../components/OCRDialog';
import CanvasSearchBar from '../components/CanvasSearchBar';
import InlineAIAssistant from '../components/InlineAIAssistant';
import type { HWPXViewerInstance } from '../types/viewer';
import type { HWPXDocument } from '../types/hwpx';
import { devLog, devError } from '../utils/logger';
import { t } from '../lib/i18n';

export function EditorPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewerInstance, setViewerInstance] = useState<HWPXViewerInstance | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftInitialPrompt, setDraftInitialPrompt] = useState('');
  const [ocrOpen, setOcrOpen] = useState(false);

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

  // 에디터 페이지에서만 body에 editor-mode 클래스 추가 (스크롤 잠금)
  useEffect(() => {
    document.body.classList.add('editor-mode');
    return () => {
      document.body.classList.remove('editor-mode');
    };
  }, []);

  const handleDraftComplete = useCallback(
    async (doc: HWPXDocument) => {
      devLog('[Draft] AI 초안 완성 — 뷰어 로드:', doc.sections.length, 'sections');
      if (!viewerInstance) {
        devError('[Draft] viewer 인스턴스 없음');
        return;
      }
      try {
        await viewerInstance.loadDocument(doc, { sourceName: 'AI 초안' });
      } catch (e) {
        devError('[Draft] 뷰어 주입 실패:', e);
      }
    },
    [viewerInstance]
  );

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: 'ai-draft',
        label: 'AI 초안 생성',
        description: 'Vertex AI (Gemini 2.5 Pro · 2M 토큰) 로 문서 초안 작성',
        shortcut: 'Ctrl+⇧+A',
        group: 'AI',
        icon: '✨',
        keywords: ['ai', '초안', '생성', 'draft', 'vertex', 'gemini'],
        action: () => {
          setDraftInitialPrompt('');
          setDraftModalOpen(true);
        },
      },
      {
        id: 'ai-toggle-panel',
        label: 'AI 패널 토글',
        description: '기존 AI 어시스턴트 패널 열기/닫기',
        shortcut: 'Ctrl+⇧+P',
        group: 'AI',
        icon: '💬',
        keywords: ['panel', 'assistant', '어시스턴트'],
        action: () => setShowAIPanel(v => !v),
      },
      {
        id: 'ocr',
        label: 'OCR — 이미지/PDF 텍스트 추출',
        description: '스캔본 PDF 또는 이미지에서 한국어 + 영어 텍스트 인식',
        group: '도구',
        icon: '🔤',
        keywords: ['ocr', 'image', 'pdf', 'scan', '스캔', '인식'],
        action: () => setOcrOpen(true),
      },
      {
        id: 'open-file',
        label: '파일 열기',
        description: 'HWP · HWPX · DOCX · PDF 불러오기',
        shortcut: 'Ctrl+O',
        group: '파일',
        icon: '📂',
        keywords: ['open', 'file', '열기'],
        action: () => document.getElementById('hidden-file-input')?.click(),
      },
      {
        id: 'find',
        label: '찾기',
        description: '문서 내 텍스트 검색',
        shortcut: 'Ctrl+F',
        group: '편집',
        icon: '🔍',
        keywords: ['find', 'search', '찾기'],
        action: () => {
          const v = viewerInstance as {
            searchDialog?: { show?: (mode: string) => void };
            openSearch?: () => void;
          } | null;
          if (v?.searchDialog?.show) {
            v.searchDialog.show('find');
          } else {
            v?.openSearch?.();
          }
        },
      },
    ],
    [viewerInstance]
  );

  const handleAIPrompt = useCallback((prompt: string) => {
    setDraftInitialPrompt(prompt);
    setDraftModalOpen(true);
  }, []);

  return (
    <div className="app-container">
      <a href="#hwpx-viewer-root" className="skip-to-content">
        {t('msg.skipToContent')}
      </a>

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
        editorType="canvas"
      />

      <CanvasSearchBar viewer={viewerInstance} />

      <InlineAIAssistant viewer={viewerInstance} />

      <HangulStatusBar viewer={viewerInstance} />

      <CommandPalette commands={commands} onAIPrompt={handleAIPrompt} />

      <DraftAIModal
        isOpen={draftModalOpen}
        onClose={() => setDraftModalOpen(false)}
        onComplete={handleDraftComplete}
        initialPrompt={draftInitialPrompt}
      />

      <OCRDialog
        isOpen={ocrOpen}
        onClose={() => setOcrOpen(false)}
        onExtracted={text => {
          setDraftInitialPrompt(`다음 내용을 정리해 한컴 문서로 작성해 주세요:\n\n${text}`);
          setOcrOpen(false);
          setDraftModalOpen(true);
        }}
      />

      <input
        id="hidden-file-input"
        type="file"
        accept=".hwp,.hwpx,.docx,.pdf"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFileSelect(f);
        }}
      />
    </div>
  );
}

export default EditorPage;
