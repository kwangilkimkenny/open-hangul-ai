/**
 * Footer Component
 * 하단 푸터 - 페이지 네비게이션, 줌 컨트롤
 * 
 * @module components/layout/Footer
 * @version 1.0.0
 */

import { memo, useCallback, useState, useEffect } from 'react';
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';

// Footer에서 setZoom 사용 (zoomIn/zoomOut만 사용)

interface FooterProps {
  className?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Footer = memo(function Footer({ className, currentPage, totalPages, onPageChange }: FooterProps) {
  const { document } = useDocumentStore();
  const { zoom, zoomIn, zoomOut } = useUIStore();
  
  const [pageInput, setPageInput] = useState(String(currentPage));

  // 현재 페이지가 변경되면 입력 필드 업데이트
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // 첫 페이지로
  const handleFirstPage = useCallback(() => {
    onPageChange(1);
  }, [onPageChange]);

  // 이전 페이지로
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  // 다음 페이지로
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  // 마지막 페이지로
  const handleLastPage = useCallback(() => {
    onPageChange(totalPages);
  }, [totalPages, onPageChange]);

  // 페이지 입력 핸들러
  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  }, []);

  // 페이지 입력 확정
  const handlePageInputSubmit = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = parseInt(pageInput, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        onPageChange(page);
      } else {
        setPageInput(String(currentPage));
      }
    }
  }, [pageInput, totalPages, currentPage, onPageChange]);

  // 페이지 입력 blur 처리
  const handlePageInputBlur = useCallback(() => {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setPageInput(String(currentPage));
    }
  }, [pageInput, totalPages, currentPage, onPageChange]);

  return (
    <footer className={`viewer-footer ${className || ''}`}>
      {/* 왼쪽: 상태 정보 */}
      <div className="footer-info">
        <span>ISMHAN v4.0.0</span>
        <span>{document ? '준비됨' : '대기 중'}</span>
      </div>

      {/* 중앙: 페이지 네비게이션 */}
      {document && totalPages > 0 && (
        <div className="page-navigator" role="navigation" aria-label="페이지 탐색">
          <div className="page-nav-controls">
            <button 
              className="nav-btn first-page" 
              onClick={handleFirstPage}
              disabled={currentPage <= 1}
              title="첫 페이지"
            >
              <ChevronsLeft size={16} />
              <span className="btn-text">처음</span>
            </button>

            <button 
              className="nav-btn prev-page" 
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              title="이전 페이지"
            >
              <ChevronLeft size={16} />
              <span className="btn-text">이전</span>
            </button>

            <div className="page-info">
              <input
                type="number"
                className="page-input"
                value={pageInput}
                onChange={handlePageInputChange}
                onKeyDown={handlePageInputSubmit}
                onBlur={handlePageInputBlur}
                min={1}
                max={totalPages}
                aria-label={`현재 페이지 (총 ${totalPages} 페이지 중)`}
              />
              <span className="page-separator">/</span>
              <span className="total-pages">{totalPages}</span>
            </div>

            <button 
              className="nav-btn next-page" 
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              title="다음 페이지"
            >
              <span className="btn-text">다음</span>
              <ChevronRight size={16} />
            </button>

            <button 
              className="nav-btn last-page" 
              onClick={handleLastPage}
              disabled={currentPage >= totalPages}
              title="마지막 페이지"
            >
              <span className="btn-text">마지막</span>
              <ChevronsRight size={16} />
            </button>
          </div>

          {/* 줌 컨트롤 */}
          <div className="zoom-controls" role="group" aria-label="확대/축소">
            <button 
              className="nav-btn" 
              onClick={zoomOut}
              title="축소"
              disabled={zoom <= 25}
            >
              <ZoomOut size={16} />
            </button>
            
            <span className="zoom-value" aria-live="polite" aria-atomic="true">{zoom}%</span>

            <button 
              className="nav-btn" 
              onClick={zoomIn}
              title="확대"
              disabled={zoom >= 300}
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      )}
    </footer>
  );
});

export default Footer;

