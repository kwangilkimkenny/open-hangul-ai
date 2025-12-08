/**
 * Sidebar Component
 * 사이드바 - 문서 정보, 저장 패널, 페이지 썸네일
 * 
 * @module components/layout/Sidebar
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { 
  Save, 
  Trash2, 
  Clock, 
  FileText,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  FileDown,
  Keyboard
} from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { useAutoSave } from '../../hooks/useAutoSave';
import { HwpxExporter } from '../../lib/export/hwpx-exporter';

interface SidebarProps {
  className?: string;
  onPageSelect?: (pageNumber: number) => void;
  currentPage?: number;
}

export function Sidebar({ className, onPageSelect, currentPage = 1 }: SidebarProps) {
  const { document, fileName } = useDocumentStore();
  const { showToast } = useUIStore();
  
  const {
    sessions,
    isInitialized,
    lastSaveTime,
    saveNow,
    restoreSession,
    deleteSession,
    loadSessions,
    formatTimeAgo
  } = useAutoSave({ enabled: true });
  
  // 파일 크기 포맷
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const [showAutoSavePanel, setShowAutoSavePanel] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // HWPX 저장 (Sidebar용)
  const handleSaveHwpx = useCallback(async () => {
    if (!document) {
      showToast('warning', '경고', '저장할 문서가 없습니다.');
      return;
    }

    const defaultName = fileName || '문서.hwpx';
    const inputName = prompt('HWPX 파일명을 입력하세요:', defaultName.replace('.hwpx', ''));
    if (!inputName) return;

    setIsSaving(true);
    try {
      const exporter = new HwpxExporter();
      const result = await exporter.exportToFile(document, inputName);
      
      showToast('success', 'HWPX 저장 완료', `${result.filename} 파일이 저장되었습니다.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'HWPX 저장에 실패했습니다.';
      showToast('error', '저장 실패', message);
    } finally {
      setIsSaving(false);
    }
  }, [document, fileName, showToast]);

  // 자동저장 (IndexedDB)
  const handleAutoSave = useCallback(async () => {
    if (!document) {
      showToast('warning', '경고', '저장할 문서가 없습니다.');
      return;
    }

    try {
      await saveNow();
      showToast('success', '자동저장 완료', '세션이 저장되었습니다.');
    } catch {
      showToast('error', '자동저장 실패', '세션 저장에 실패했습니다.');
    }
  }, [document, saveNow, showToast]);

  // 세션 복원
  const handleRestoreSession = useCallback(async (sessionId: string) => {
    const confirmed = window.confirm('현재 문서를 이 버전으로 복원하시겠습니까?');
    if (!confirmed) return;

    try {
      await restoreSession(sessionId);
      showToast('success', '복원 완료', '문서가 복원되었습니다.');
    } catch {
      showToast('error', '복원 실패', '문서 복원에 실패했습니다.');
    }
  }, [restoreSession, showToast]);

  // 세션 삭제
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const confirmed = window.confirm('이 저장 항목을 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      await deleteSession(sessionId);
      await loadSessions();
      showToast('success', '삭제 완료', '저장 항목이 삭제되었습니다.');
    } catch {
      showToast('error', '삭제 실패', '삭제에 실패했습니다.');
    }
  }, [deleteSession, loadSessions, showToast]);

  // 페이지 선택
  const handlePageClick = useCallback((pageNumber: number) => {
    onPageSelect?.(pageNumber);
  }, [onPageSelect]);

  const totalPages = document?.sections?.length || 0;
  const documentStatus = document ? '로드됨' : '대기 중';
  const imageCount = document?.images?.size || 0;

  return (
    <aside className={`sidebar ${className || ''}`}>
      {/* 사이드바 헤더 */}
      <div className="sidebar-header">
        문서 정보
      </div>

      <div className="sidebar-content">
        {/* 문서 메타데이터 */}
        <div className="document-info">
          <h3>
            <FileText size={16} />
            문서 메타데이터
          </h3>
          <div className="info-row">
            <span className="info-label">상태</span>
            <span className="info-value">{documentStatus}</span>
          </div>
          <div className="info-row">
            <span className="info-label">섹션</span>
            <span className="info-value">{totalPages}</span>
          </div>
          <div className="info-row">
            <span className="info-label">이미지</span>
            <span className="info-value">{imageCount}</span>
          </div>
        </div>

        {/* 저장 액션 패널 */}
        {document && (
          <div className="save-action-panel">
            <button 
              className="sidebar-btn primary" 
              onClick={handleSaveHwpx}
              disabled={isSaving}
              title="HWPX 파일로 저장 (Ctrl+S)"
            >
              <FileDown size={16} />
              <span>HWPX 저장</span>
            </button>
            <button 
              className="sidebar-btn secondary" 
              onClick={handleAutoSave}
              title="자동저장 세션 저장"
            >
              <Save size={16} />
              <span>세션 저장</span>
            </button>
          </div>
        )}

        {/* 키보드 단축키 패널 */}
        <div className="shortcuts-panel">
          <h3 
            className="panel-title clickable"
            onClick={() => setShowShortcuts(!showShortcuts)}
          >
            {showShortcuts ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Keyboard size={16} />
            키보드 단축키
          </h3>

          {showShortcuts && (
            <div className="shortcuts-list">
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>S</kbd>
                <span>HWPX 저장</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>P</kbd>
                <span>인쇄</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>O</kbd>
                <span>파일 열기</span>
              </div>
            </div>
          )}
        </div>

        {/* 자동 저장 패널 */}
        <div className="autosave-panel">
          <h3 
            className="panel-title clickable"
            onClick={() => setShowAutoSavePanel(!showAutoSavePanel)}
          >
            {showAutoSavePanel ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Clock size={16} />
            자동 저장
          </h3>

          {showAutoSavePanel && (
            <div className="autosave-content">
              {/* 현재 상태 */}
              {isInitialized && lastSaveTime && (
                <div className="autosave-status-info">
                  <span className="status-indicator active" />
                  <span>마지막 저장: {formatTimeAgo(lastSaveTime.getTime())}</span>
                </div>
              )}

              {/* 저장 목록 */}
              <div className="autosave-list">
                {sessions.length === 0 ? (
                  <div className="autosave-empty">
                    <Clock size={24} />
                    <p>저장된 버전이 없습니다</p>
                  </div>
                ) : (
                  sessions.slice(0, 5).map((session) => (
                    <div key={session.id} className="autosave-item">
                      <div className="autosave-info">
                        <strong>{session.fileName || '문서'}</strong>
                        <span>
                          {formatTimeAgo(session.timestamp)} · {formatSize(session.size)}
                        </span>
                      </div>
                      <div className="autosave-item-actions">
                        <button 
                          className="restore"
                          onClick={() => handleRestoreSession(session.id)}
                          title="복원"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button 
                          className="delete"
                          onClick={() => handleDeleteSession(session.id)}
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 페이지 썸네일 */}
        {document && totalPages > 0 && (
          <div className="thumbnails-panel">
            <h3 
              className="panel-title clickable"
              onClick={() => setShowThumbnails(!showThumbnails)}
            >
              {showThumbnails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              페이지 미리보기
            </h3>

            {showThumbnails && (
              <div className="thumbnails-container">
                {document.sections.map((_, index) => (
                  <div
                    key={index}
                    className={`thumbnail-item ${currentPage === index + 1 ? 'active' : ''}`}
                    onClick={() => handlePageClick(index + 1)}
                  >
                    <div className="thumbnail-preview">
                      <span className="thumbnail-number">{index + 1}</span>
                    </div>
                    <div className="thumbnail-label">
                      페이지 {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;

