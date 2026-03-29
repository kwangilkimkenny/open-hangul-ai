/**
 * Hangul-Style Status Bar
 * 한글과컴퓨터 한글의 하단 상태 표시줄 재현
 *
 * [페이지: 1/3] [구역:1] [줄:15 칸:23] [삽입] [한글] [===o===== 100%]
 */

import { useState, useEffect, useCallback, memo } from 'react';
import type { HWPXViewerInstance } from '../types/viewer';
import { t } from '../lib/i18n';
import { useSecurityStatus } from '../hooks/useSecurityStatus';
import type { ServiceState } from '../hooks/useSecurityStatus';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface HangulStatusBarProps {
  viewer?: HWPXViewerInstance | null;
}

// ============================================================================
// Security Indicator (AEGIS + TruthAnchor 상태 표시)
// ============================================================================

const STATE_DOT: Record<ServiceState, string> = {
  online: '#22c55e',
  offline: '#f59e0b',
  disabled: '#94a3b8',
  error: '#ef4444',
};

const STATE_LABEL: Record<ServiceState, string> = {
  online: '온라인',
  offline: '오프라인',
  disabled: 'OFF',
  error: '오류',
};

const SecurityIndicator = memo(function SecurityIndicator() {
  const { status, refresh } = useSecurityStatus();
  const [popupOpen, setPopupOpen] = useState(false);

  const aegis = status.aegis;
  const ta = status.truthAnchor;

  // 둘 다 disabled면 표시하지 않음
  const bothDisabled = aegis.state === 'disabled' && ta.state === 'disabled';

  return (
    <div className="hwp-statusbar-security">
      {/* AEGIS 인디케이터 */}
      {aegis.state !== 'disabled' && (
        <button
          className="hwp-security-badge"
          onClick={() => setPopupOpen((p) => !p)}
          title={`AEGIS: ${STATE_LABEL[aegis.state]}`}
        >
          <span className="hwp-security-dot" style={{ background: STATE_DOT[aegis.state] }} />
          <span className="hwp-security-name">AEGIS</span>
        </button>
      )}

      {/* TruthAnchor 인디케이터 */}
      {ta.state !== 'disabled' && (
        <button
          className="hwp-security-badge"
          onClick={() => setPopupOpen((p) => !p)}
          title={`TruthAnchor: ${STATE_LABEL[ta.state]}`}
        >
          <span className="hwp-security-dot" style={{ background: STATE_DOT[ta.state] }} />
          <span className="hwp-security-name">TruthAnchor</span>
          <span className="hwp-security-mode">{STATE_LABEL[ta.state]}</span>
        </button>
      )}

      {/* 둘 다 비활성이면 간소하게 표시 */}
      {bothDisabled && (
        <span className="hwp-security-badge hwp-security-badge--dim" title="AI 보안 비활성 (채팅 패널에서 활성화)">
          <span className="hwp-security-dot" style={{ background: '#94a3b8' }} />
          <span className="hwp-security-name">AI 보안 OFF</span>
        </span>
      )}

      {/* 상세 팝업 */}
      {popupOpen && (
        <div className="hwp-security-popup">
          <div className="hwp-security-popup__header">
            <strong>AI 보안 시스템 상태</strong>
            <button onClick={() => setPopupOpen(false)} className="hwp-security-popup__close">&times;</button>
          </div>
          <div className="hwp-security-popup__body">
            {/* AEGIS */}
            <div className="hwp-security-popup__row">
              <span className="hwp-security-dot hwp-security-dot--lg" style={{ background: STATE_DOT[aegis.state] }} />
              <div>
                <div className="hwp-security-popup__name">AEGIS Security Gateway</div>
                <div className="hwp-security-popup__detail">
                  상태: {STATE_LABEL[aegis.state]}
                  {aegis.state === 'online' && ' (SDK 로드됨)'}
                  {aegis.state === 'disabled' && ' — 채팅 패널에서 활성화'}
                </div>
                <div className="hwp-security-popup__detail">
                  모드: 오프라인 SDK (클라이언트 사이드)
                </div>
              </div>
            </div>
            {/* TruthAnchor */}
            <div className="hwp-security-popup__row">
              <span className="hwp-security-dot hwp-security-dot--lg" style={{ background: STATE_DOT[ta.state] }} />
              <div>
                <div className="hwp-security-popup__name">TruthAnchor (HalluGuard)</div>
                <div className="hwp-security-popup__detail">
                  상태: {STATE_LABEL[ta.state]}
                  {ta.version && ` v${ta.version}`}
                  {ta.state === 'disabled' && ' — 채팅 패널에서 활성화'}
                </div>
                {ta.latencyMs !== null && (
                  <div className="hwp-security-popup__detail">
                    레이턴시: {ta.latencyMs}ms
                  </div>
                )}
                {ta.lastCheckAt && (
                  <div className="hwp-security-popup__detail">
                    마지막 확인: {new Date(ta.lastCheckAt).toLocaleTimeString('ko-KR')}
                  </div>
                )}
                {ta.state === 'online' && (
                  <div className="hwp-security-popup__detail">
                    파이프라인: 가드레일 → 수치검증 → NLI → LLM
                  </div>
                )}
                {ta.state === 'offline' && (
                  <div className="hwp-security-popup__detail">
                    폴백: 가드레일 + 수치검증 (NLI/LLM 미사용)
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="hwp-security-popup__footer">
            <button className="hwp-security-popup__refresh" onClick={() => { refresh(); }}>
              상태 새로고침
            </button>
            <span className="hwp-security-popup__interval">자동 갱신: 45초</span>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

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

      {/* Center: Security Status */}
      <SecurityIndicator />

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
