import { useState, useEffect, useCallback, memo } from 'react';
import { FileText, Image as ImageIcon, Layout, Cloud } from 'lucide-react';
import type { HWPXViewerInstance } from '../types/viewer';

interface SidebarProps {
  viewer: HWPXViewerInstance | null;
  file?: File | null;
  isOpen?: boolean;
  width?: number;
}

const Sidebar = memo(function Sidebar({ viewer, file, isOpen = true, width = 280 }: SidebarProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [sectionCount, setSectionCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [activePage, setActivePage] = useState(1);

  // 문서 정보 업데이트 함수 (useEffect보다 먼저 선언)
  const updateInfo = useCallback(() => {
    if (viewer && viewer.renderer) {
      setTotalPages(viewer.renderer.totalPages || 0);

      // 파서 정보 접근 (비공개 속성일 수 있으므로 안전하게 접근)
      try {
        const viewerWithParser = viewer as HWPXViewerInstance & {
          parser?: { doc?: { sections?: unknown[]; images?: Record<string, unknown> } };
        };
        const doc = viewerWithParser.parser?.doc;
        if (doc) {
          setSectionCount(doc.sections?.length || 0);
          setImageCount(Object.keys(doc.images || {}).length);
        }
      } catch {
        // 무시
      }
    }
  }, [viewer]);

  // 문서 정보 업데이트
  useEffect(() => {
    if (viewer) {
      // 초기 정보 설정 (requestAnimationFrame으로 다음 프레임에서 실행)
      const rafId = requestAnimationFrame(() => {
        updateInfo();
      });

      // 페이지 스크롤 감지하여 현재 페이지 업데이트
      const container = viewer.container;
      const handleScroll = () => {
        if (!container) return;

        // 현재 뷰포트 중앙에 위치한 페이지 찾기
        const containerRect = container.getBoundingClientRect();
        const center = containerRect.top + containerRect.height / 2;

        const pages = container.querySelectorAll('.hwp-page-container');
        let current = 1;

        pages.forEach((page: Element) => {
          const rect = page.getBoundingClientRect();
          if (rect.top <= center && rect.bottom >= center) {
            current = parseInt(page.getAttribute('data-page-number') || '1', 10);
          }
        });

        setActivePage(current);
      };

      container.addEventListener('scroll', handleScroll);

      // 주기적으로 정보 업데이트 (렌더링 완료 대기)
      const interval = setInterval(updateInfo, 1000);

      return () => {
        cancelAnimationFrame(rafId);
        container.removeEventListener('scroll', handleScroll);
        clearInterval(interval);
      };
    }
  }, [viewer, updateInfo]);

  const handlePageClick = useCallback((pageNum: number) => {
    if (viewer && viewer.container) {
      const pageEl = viewer.container.querySelector(
        `.hwp-page-container[data-page-number="${pageNum}"]`
      );
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActivePage(pageNum);
      }
    }
  }, [viewer]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) {
    return (
      <div
        className="sidebar-collapsed"
        style={{
          width: '0px', // 완전히 숨김
          borderRight: 'none',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
        }}
      />
    );
  }

  return (
    <div
      className="sidebar"
      role="complementary"
      aria-label="문서 정보"
      style={{
        width: `${width}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #e0e0e0',
        backgroundColor: '#f8f9fa',
        transition: 'width 0.3s ease',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Sidebar Header */}
      <div
        className="sidebar-header"
        style={{
          padding: '16px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#fff',
          fontWeight: 600,
          color: '#333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>문서 정보</span>
      </div>

      <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Document Metadata */}
        <div
          className="document-info"
          style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #eee',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={16} /> 기본 정보
          </h3>

          <div
            className="info-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              marginBottom: '8px',
              color: '#666',
            }}
          >
            <span style={{ color: '#888' }}>파일:</span>
            <span
              style={{
                fontWeight: 500,
                maxWidth: '140px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={file?.name || '-'}
            >
              {file?.name || '-'}
            </span>
          </div>
          <div
            className="info-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              marginBottom: '8px',
              color: '#666',
            }}
          >
            <span style={{ color: '#888' }}>크기:</span>
            <span style={{ fontWeight: 500 }}>{file ? formatFileSize(file.size) : '-'}</span>
          </div>
          <div
            className="info-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              marginBottom: '8px',
              color: '#666',
            }}
          >
            <span style={{ color: '#888' }}>페이지:</span>
            <span style={{ fontWeight: 500 }}>{totalPages}쪽</span>
          </div>

          <div style={{ borderTop: '1px solid #eee', margin: '12px 0' }} />

          <div
            className="info-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              marginBottom: '8px',
              color: '#666',
            }}
          >
            <span style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layout size={12} /> 섹션:
            </span>
            <span>{sectionCount}</span>
          </div>
          <div
            className="info-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              marginBottom: '0',
              color: '#666',
            }}
          >
            <span style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ImageIcon size={12} /> 이미지:
            </span>
            <span>{imageCount}</span>
          </div>
        </div>

        {/* Action Buttons (Mock) */}
        <div style={{ marginBottom: '20px' }}>
          <button
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '6px',
              marginBottom: '8px',
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#aaa',
            }}
            disabled
          >
            <Cloud size={16} /> 클라우드 동기화 (준비중)
          </button>
        </div>

        {/* Page Thumbnails (List View) */}
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            color: '#555',
            paddingLeft: '4px',
          }}
        >
          페이지 목록
        </h3>

        <div className="thumbnails-container">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isActive = activePage === pageNum;

            return (
              <div
                key={pageNum}
                className={`thumbnail-item ${isActive ? 'active' : ''}`}
                onClick={() => handlePageClick(pageNum)}
                role="button"
                tabIndex={0}
                aria-label={`페이지 ${pageNum}${isActive ? ' (현재 페이지)' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePageClick(pageNum); } }}
                style={{
                  backgroundColor: isActive ? '#eef2ff' : '#fff',
                  border: `1px solid ${isActive ? '#667eea' : '#e0e0e0'}`,
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: isActive ? '#667eea' : '#f1f3f5',
                    color: isActive ? '#fff' : '#666',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {pageNum}
                </div>
                <div style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, color: '#333' }}>
                  페이지 {pageNum}
                </div>
              </div>
            );
          })}

          {totalPages === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '13px' }}>
              페이지 정보 없음
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Sidebar;
