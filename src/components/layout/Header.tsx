/**
 * Header Component
 * 상단 헤더 - 로고, 파일 정보, 액션 버튼
 *
 * @module components/layout/Header
 * @version 1.0.0
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { FolderOpen, Printer, Download, Save, FileDown, FileText, Loader2 } from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { SimpleHWPXParser } from '../../lib/core/parser';
import { PdfExporter } from '../../lib/export/pdf-exporter';
import { HwpxExporter } from '../../lib/export/hwpx-exporter';
import { useAutoSave } from '../../hooks/useAutoSave';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parserRef = useRef<SimpleHWPXParser | null>(null);

  const [isSavingHwpx, setIsSavingHwpx] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingMd, setIsSavingMd] = useState(false);

  const {
    document,
    fileName,
    isLoading,
    isDirty,
    setDocument,
    setOriginalFile,
    setLoading,
    setError,
    setDirty,
  } = useDocumentStore();

  const { showToast } = useUIStore();

  const { lastSaveTime, isInitialized } = useAutoSave({ enabled: true });

  // 파일 열기
  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!parserRef.current) {
        parserRef.current = new SimpleHWPXParser();
      }

      setLoading(true);
      setError(null);

      try {
        const buffer = await file.arrayBuffer();
        const doc = await parserRef.current.parse(buffer);

        setDocument(doc);
        setOriginalFile(file);
        showToast('success', '성공', `${file.name} 파일을 불러왔습니다.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : '파일을 불러오는데 실패했습니다.';
        setError(message);
        showToast('error', '오류', message);
      } finally {
        setLoading(false);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [setDocument, setOriginalFile, setLoading, setError, showToast]
  );

  // HWPX 저장
  const handleSaveHwpx = useCallback(
    async (skipPrompt: boolean = false) => {
      if (!document) {
        showToast('warning', '경고', '저장할 문서가 없습니다.');
        return;
      }

      let finalFileName: string;

      if (skipPrompt && fileName) {
        // 단축키로 빠른 저장 (파일명 재사용)
        finalFileName = fileName.replace('.hwpx', '');
      } else {
        // 일반 저장 (파일명 입력)
        const defaultName = fileName || '문서.hwpx';
        const inputName = prompt('HWPX 파일명을 입력하세요:', defaultName.replace('.hwpx', ''));
        if (!inputName) return;
        finalFileName = inputName;
      }

      setIsSavingHwpx(true);
      try {
        const exporter = new HwpxExporter();
        const result = (await exporter.exportToFile(document, finalFileName)) as unknown as {
          filename: string;
          blob: Blob;
          method?: string;
        };

        // 저장 후 dirty 상태 초기화
        setDirty(false);

        showToast('success', 'HWPX 저장 완료', `${result.filename} 파일이 저장되었습니다.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'HWPX 저장에 실패했습니다.';
        showToast('error', '저장 실패', message);
      } finally {
        setIsSavingHwpx(false);
      }
    },
    [document, fileName, showToast, setDirty]
  );

  // PDF 다운로드
  const handleDownloadPdf = useCallback(async () => {
    if (!document) return;

    const defaultName = fileName?.replace('.hwpx', '') || '문서';
    const inputName = prompt('PDF 파일명을 입력하세요:', defaultName);
    if (!inputName) return;

    setIsSavingPdf(true);
    try {
      const exporter = new PdfExporter();
      const result = await exporter.exportDocument('.document-viewer', {
        filename: inputName,
      });

      if (result.method === 'print') {
        showToast('info', 'PDF 내보내기', '인쇄 대화상자에서 "PDF로 저장"을 선택하세요.');
      } else {
        showToast('success', 'PDF 완료', `${result.filename} 파일이 저장되었습니다.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF 내보내기에 실패했습니다.';
      showToast('error', '내보내기 실패', message);
    } finally {
      setIsSavingPdf(false);
    }
  }, [document, fileName, showToast]);

  // Markdown 내보내기
  const handleExportMd = useCallback(async () => {
    if (!document) return;

    const defaultName = fileName?.replace(/\.(hwpx|hwp)$/i, '') || '문서';
    const inputName = prompt('Markdown 파일명을 입력하세요:', defaultName);
    if (!inputName) return;

    setIsSavingMd(true);
    try {
      const { exportToMarkdown } = await import('../../lib/markdown/parser');
      const md = exportToMarkdown(document as any);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = inputName.endsWith('.md') ? inputName : `${inputName}.md`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', 'Markdown 저장 완료', `${a.download} 파일이 저장되었습니다.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Markdown 내보내기에 실패했습니다.';
      showToast('error', '내보내기 실패', message);
    } finally {
      setIsSavingMd(false);
    }
  }, [document, fileName, showToast]);

  // 인쇄
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // 자동 저장 시간 포맷
  const formatLastSaveTime = () => {
    if (!lastSaveTime) return '저장 대기';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaveTime.getTime()) / 1000);

    if (diff < 60) return '방금 저장됨';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전 저장`;
    return lastSaveTime.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 키보드 단축키 핸들러
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+S: HWPX 저장
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (document) {
          handleSaveHwpx(true); // 빠른 저장 (프롬프트 스킵)
        }
      }

      // Ctrl+P: 인쇄
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (document) {
          handlePrint();
        }
      }

      // Ctrl+O: 파일 열기
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
      }
    },
    [document, handleSaveHwpx, handlePrint, handleOpenFile]
  );

  // 키보드 단축키 등록
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <header className={`viewer-header ${className || ''}`}>
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".hwpx,.hwp,.md"
        onChange={handleFileSelect}
        aria-label="Load HWPX file"
        style={{ display: 'none' }}
      />

      {/* 로고 */}
      <h1 className="header-logo">
        ISMHAN
        <span className="version-badge">v4.0.0</span>
      </h1>

      {/* 파일 정보 */}
      {document && fileName && (
        <div className="file-info">
          <div className="file-info-item">
            <strong>파일:</strong>
            <span>{fileName}</span>
          </div>
          <div className="file-info-item">
            <strong>페이지:</strong>
            <span>{document.sections?.length || 0} 페이지</span>
          </div>
        </div>
      )}

      {/* 헤더 액션 버튼들 */}
      <div className="header-actions">
        <button
          className="header-btn primary"
          onClick={handleOpenFile}
          disabled={isLoading}
          title="파일 열기 (Ctrl+O)"
        >
          <FolderOpen className="btn-icon" size={18} />
          <span className="btn-text">파일 열기</span>
        </button>

        <div className="header-divider" />

        {document && (
          <>
            <button
              className={`header-btn success ${isDirty ? 'dirty' : ''}`}
              onClick={() => handleSaveHwpx(false)}
              disabled={!document || isSavingHwpx}
              title="HWPX 파일로 저장 (Ctrl+S)"
            >
              {isSavingHwpx ? (
                <Loader2 className="btn-icon spinning" size={18} />
              ) : (
                <FileDown className="btn-icon" size={18} />
              )}
              <span className="btn-text">HWPX 저장</span>
              {isDirty && <span className="dirty-indicator" aria-label="저장되지 않은 변경사항 있음">●</span>}
            </button>

            <button
              className="header-btn"
              onClick={handleDownloadPdf}
              disabled={!document || isSavingPdf}
              title="PDF로 다운로드"
            >
              {isSavingPdf ? (
                <Loader2 className="btn-icon spinning" size={18} />
              ) : (
                <Download className="btn-icon" size={18} />
              )}
              <span className="btn-text">PDF 다운로드</span>
            </button>

            <button
              className="header-btn"
              onClick={handleExportMd}
              disabled={!document || isSavingMd}
              title="Markdown으로 내보내기"
            >
              {isSavingMd ? (
                <Loader2 className="btn-icon spinning" size={18} />
              ) : (
                <FileText className="btn-icon" size={18} />
              )}
              <span className="btn-text">MD 저장</span>
            </button>

            <button
              className="header-btn"
              onClick={handlePrint}
              disabled={!document}
              title="인쇄 (Ctrl+P)"
            >
              <Printer className="btn-icon" size={18} />
              <span className="btn-text">인쇄</span>
            </button>

            <div className="header-divider" />
          </>
        )}

        {/* 자동 저장 상태 */}
        {document && isInitialized && (
          <div className="autosave-status" aria-live="polite" aria-atomic="true">
            <Save className="autosave-icon" size={18} aria-hidden="true" />
            <span className="autosave-text">{formatLastSaveTime()}</span>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
