/**
 * Toolbar Component
 * 상단 도구 모음 컴포넌트
 *
 * @module components/ui/Toolbar
 * @version 2.0.0
 */

import { useRef, useCallback, useState } from 'react';
import {
  FileText,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  FileDown,
  Printer,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { SimpleHWPXParser } from '../../lib/core/parser';
import { HwpxExporter } from '../../lib/export/hwpx-exporter';
import { PdfExporter } from '../../lib/export/pdf-exporter';

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parserRef = useRef<SimpleHWPXParser | null>(null);
  const hwpxExporterRef = useRef<HwpxExporter | null>(null);
  const pdfExporterRef = useRef<PdfExporter | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const {
    document,
    fileName,
    isLoading,
    setDocument,
    setOriginalFile,
    setLoading,
    setError,
    reset,
  } = useDocumentStore();

  const { zoom, zoomIn, zoomOut, resetZoom, theme, setTheme, showToast } = useUIStore();

  // Exporter 초기화
  const getHwpxExporter = useCallback(() => {
    if (!hwpxExporterRef.current) {
      hwpxExporterRef.current = new HwpxExporter();
    }
    return hwpxExporterRef.current;
  }, []);

  const getPdfExporter = useCallback(() => {
    if (!pdfExporterRef.current) {
      pdfExporterRef.current = new PdfExporter();
    }
    return pdfExporterRef.current;
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

      // 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [setDocument, setOriginalFile, setLoading, setError, showToast]
  );

  // 새 문서
  const handleNew = useCallback(() => {
    if (document) {
      const confirmed = window.confirm('현재 문서를 닫으시겠습니까?');
      if (!confirmed) return;
    }
    reset();
    showToast('info', '알림', '새 문서가 준비되었습니다.');
  }, [document, reset, showToast]);

  // HWPX 저장
  const handleSaveHwpx = useCallback(async () => {
    if (!document) {
      showToast('warning', '경고', '저장할 문서가 없습니다.');
      return;
    }

    // 파일명 입력 받기
    const defaultName = fileName?.replace('.hwpx', '') || '문서';
    const inputName = prompt('저장할 파일명을 입력하세요:', defaultName);

    if (!inputName) return; // 취소

    setIsSaving(true);

    try {
      const exporter = getHwpxExporter();
      const result = (await exporter.exportToFile(document, inputName)) as unknown as {
        filename: string;
        blob: Blob;
      };

      showToast('success', '저장 완료', `${result.filename} 파일이 저장되었습니다.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'HWPX 저장에 실패했습니다.';
      showToast('error', '저장 실패', message);
    } finally {
      setIsSaving(false);
    }
  }, [document, fileName, showToast, getHwpxExporter]);

  // PDF 내보내기
  const handleExportPdf = useCallback(async () => {
    if (!document) {
      showToast('warning', '경고', '내보낼 문서가 없습니다.');
      return;
    }

    // 파일명 입력 받기
    const defaultName = fileName?.replace('.hwpx', '') || '문서';
    const inputName = prompt('PDF 파일명을 입력하세요:', defaultName);

    if (!inputName) return; // 취소

    setIsExporting(true);

    try {
      const exporter = getPdfExporter();
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
      setIsExporting(false);
    }
  }, [document, fileName, showToast, getPdfExporter]);

  // 인쇄
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // 테마 토글
  const handleThemeToggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return (
    <div className="toolbar" role="toolbar" aria-label="문서 도구 모음">
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".hwpx"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-label="Load HWPX file"
      />

      {/* 왼쪽 섹션: 파일 작업 */}
      <div className="toolbar-section">
        <button className="toolbar-btn" onClick={handleNew} title="새 문서">
          <FileText size={20} />
          <span className="btn-label">새 문서</span>
        </button>

        <button
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          title="열기"
          disabled={isLoading}
        >
          <Upload size={20} />
          <span className="btn-label">열기</span>
        </button>

        <div className="toolbar-divider" />

        {/* HWPX 저장 버튼 */}
        <button
          className="toolbar-btn"
          onClick={handleSaveHwpx}
          title="HWPX로 저장"
          disabled={!document || isSaving}
        >
          {isSaving ? <Loader2 size={20} className="spinning" /> : <Save size={20} />}
          <span className="btn-label">저장</span>
        </button>

        {/* PDF 내보내기 버튼 */}
        <button
          className="toolbar-btn"
          onClick={handleExportPdf}
          title="PDF로 내보내기"
          disabled={!document || isExporting}
        >
          {isExporting ? <Loader2 size={20} className="spinning" /> : <FileDown size={20} />}
          <span className="btn-label">PDF</span>
        </button>

        <div className="toolbar-divider" />
      </div>

      {/* 중앙 섹션: 파일명 */}
      <div className="toolbar-section toolbar-center">
        {fileName && (
          <span className="file-name" title={fileName}>
            📄 {fileName}
          </span>
        )}
      </div>

      {/* 오른쪽 섹션: 보기 도구 */}
      <div className="toolbar-section">
        <div className="toolbar-divider" />

        <button className="toolbar-btn" onClick={zoomOut} title="축소">
          <ZoomOut size={20} />
        </button>

        <span className="zoom-level" aria-live="polite" aria-atomic="true">{zoom}%</span>

        <button className="toolbar-btn" onClick={zoomIn} title="확대">
          <ZoomIn size={20} />
        </button>

        <button className="toolbar-btn" onClick={resetZoom} title="확대/축소 초기화">
          <RotateCcw size={20} />
        </button>

        <div className="toolbar-divider" />

        <button className="toolbar-btn" onClick={handlePrint} title="인쇄" disabled={!document}>
          <Printer size={20} />
        </button>

        <button
          className="toolbar-btn"
          onClick={handleThemeToggle}
          title={theme === 'light' ? '다크 모드' : '라이트 모드'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
