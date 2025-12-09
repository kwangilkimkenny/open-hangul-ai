/**
 * Document Viewer Component
 * HWPX 문서를 렌더링하는 메인 컴포넌트
 * 
 * @module components/viewer/DocumentViewer
 * @version 1.0.0
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { SimpleHWPXParser } from '../../lib/core/parser';
import { getLogger } from '../../lib/utils/logger';
import { PageContainer } from './PageContainer';
import { FileDropZone } from './FileDropZone';
import { LoadingOverlay } from '../common/LoadingOverlay';
import '../../styles/viewer.css';

const logger = getLogger();

export function DocumentViewer() {
  const { 
    document, 
    isLoading, 
    error,
    setDocument, 
    setOriginalFile, 
    setLoading, 
    setError 
  } = useDocumentStore();
  
  const { zoom, showToast } = useUIStore();
  
  const parserRef = useRef<SimpleHWPXParser | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Parser 초기화
  useEffect(() => {
    parserRef.current = new SimpleHWPXParser();
    return () => {
      parserRef.current?.cleanup();
    };
  }, []);

  // 파일 로드 핸들러
  const handleFileLoad = useCallback(async (file: File) => {
    if (!parserRef.current) {
      parserRef.current = new SimpleHWPXParser();
    }

    logger.info(`📄 Loading file: ${file.name}`);
    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const doc = await parserRef.current.parse(buffer);
      
      setDocument(doc);
      setOriginalFile(file);
      
      showToast('success', '성공', `${file.name} 파일을 불러왔습니다.`);
      logger.info(`✅ File loaded: ${doc.sections.length} sections`);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : '파일을 불러오는데 실패했습니다.';
      setError(message);
      showToast('error', '오류', message);
      logger.error('❌ File load error:', err);
    } finally {
      setLoading(false);
    }
  }, [setDocument, setOriginalFile, setLoading, setError, showToast]);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileLoad(file);
    }
  }, [handleFileLoad]);

  // 드래그 앤 드롭 핸들러
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.hwpx')) {
      handleFileLoad(file);
    } else {
      showToast('warning', '경고', 'HWPX 파일만 지원합니다.');
    }
  }, [handleFileLoad, showToast]);

  // 이미지 URL Map 생성 (HWPXImageInfo -> URL string)
  const imageUrls = useMemo(() => {
    const urlMap = new Map<string, string>();
    if (document?.images) {
      document.images.forEach((imageInfo, key) => {
        if (typeof imageInfo === 'string') {
          // 이미 string인 경우 (하위 호환성)
          urlMap.set(key, imageInfo);
        } else {
          // HWPXImageInfo 객체인 경우
          urlMap.set(key, imageInfo.url);
        }
      });
    }
    return urlMap;
  }, [document?.images]);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="document-viewer">
        <LoadingOverlay message="문서를 불러오는 중..." />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="document-viewer">
        <div className="viewer-error">
          <div className="error-icon">⚠️</div>
          <h2>오류가 발생했습니다</h2>
          <p>{error}</p>
          <button onClick={() => setError(null)} className="retry-button">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 문서가 없는 경우
  if (!document) {
    return (
      <FileDropZone 
        onFileDrop={handleFileLoad}
        onFileSelect={handleFileSelect}
      />
    );
  }

  // 문서 렌더링
  return (
    <div 
      ref={viewerRef}
      className="document-viewer"
      style={{ 
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center'
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="pages-container">
        {document.sections.map((section, index) => (
          <PageContainer
            key={section.id || `section-${index}`}
            section={section}
            pageNumber={index + 1}
            images={imageUrls}
            sectionIndex={index}
          />
        ))}
      </div>
    </div>
  );
}

export default DocumentViewer;

