/**
 * Hangul-Style Status Bar
 * 한글과컴퓨터 한글의 하단 상태 표시줄 재현
 *
 * [페이지: 1/3] [구역:1] [줄:15 칸:23] [삽입] [한글] [===o===== 100%]
 */

import { useState, useEffect, useCallback, memo } from 'react';
import type { HWPXViewerInstance } from '../types/viewer';
import { t } from '../lib/i18n';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface HangulStatusBarProps {
  viewer?: HWPXViewerInstance | null;
}

export const HangulStatusBar = memo(function HangulStatusBar({ viewer }: HangulStatusBarProps) {
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 });
  const [zoom, setZoom] = useState(100);
  const [inputMode, setInputMode] = useState<'insert' | 'overwrite'>('insert');
  const [charCount, setCharCount] = useState(0);

  // Poll page info + char count from viewer
  useEffect(() => {
    const interval = setInterval(() => {
      if (!viewer) return;
      const v = viewer as any;
      const totalPages = v.renderer?.totalPages || v.state?.document?.sections?.length || 1;
      setPageInfo(prev => ({ ...prev, total: totalPages }));
      // 글자수 계산
      const container = document.querySelector('.hwpx-viewer-wrapper');
      if (container) {
        const text = container.textContent || '';
        setCharCount(text.replace(/\s/g, '').length);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [viewer]);

  // Insert key toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert') {
        setInputMode(prev => prev === 'insert' ? 'overwrite' : 'insert');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    const clamped = Math.min(400, Math.max(25, newZoom));
    setZoom(clamped);
    // Apply zoom to viewer
    const container = document.querySelector('.hwpx-viewer-wrapper') as HTMLElement;
    if (container) {
      const pages = container.querySelectorAll('.hwp-page-container') as NodeListOf<HTMLElement>;
      pages.forEach(page => {
        page.style.transform = `scale(${clamped / 100})`;
        page.style.transformOrigin = 'top center';
      });
    }
  }, []);

  return (
    <div className="hwp-statusbar">
      {/* Left: Page info */}
      <div className="hwp-statusbar-left">
        <span className="hwp-statusbar-item">
          <span className="hwp-statusbar-label">{t('status.page')}</span>
          <span className="hwp-statusbar-value">{pageInfo.current} / {pageInfo.total}</span>
        </span>
        <span className="hwp-statusbar-sep" />
        <span className="hwp-statusbar-item">
          <span className="hwp-statusbar-value">{inputMode === 'insert' ? t('status.insert') : t('status.overwrite')}</span>
        </span>
        <span className="hwp-statusbar-sep" />
        <span className="hwp-statusbar-item">
          <span className="hwp-statusbar-label">{t('status.chars')}</span>
          <span className="hwp-statusbar-value">{charCount.toLocaleString()}</span>
        </span>
      </div>

      {/* Right: Zoom */}
      <div className="hwp-statusbar-right">
        <button
          className="hwp-statusbar-zoom-btn"
          onClick={() => handleZoomChange(zoom - 10)}
          title="축소"
          aria-label="축소"
        >
          -
        </button>
        <input
          type="range"
          className="hwp-statusbar-zoom-slider"
          min="25"
          max="400"
          value={zoom}
          onChange={e => handleZoomChange(parseInt(e.target.value))}
          title={`배율 ${zoom}%`}
          aria-label="문서 배율"
        />
        <button
          className="hwp-statusbar-zoom-btn"
          onClick={() => handleZoomChange(zoom + 10)}
          title="확대"
          aria-label="확대"
        >
          +
        </button>
        <span className="hwp-statusbar-zoom-value" onClick={() => handleZoomChange(100)} title="100%로 초기화">
          {zoom}%
        </span>
      </div>
    </div>
  );
});

export default HangulStatusBar;
