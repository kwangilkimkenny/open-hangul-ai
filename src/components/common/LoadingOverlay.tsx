/**
 * Loading Overlay Component
 * 로딩 오버레이 컴포넌트
 * 
 * @module components/common/LoadingOverlay
 * @version 1.0.0
 */

import { memo } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingOverlay = memo(function LoadingOverlay({
  message = '로딩 중...',
  fullScreen = false
}: LoadingOverlayProps) {
  const className = fullScreen
    ? 'loading-overlay loading-overlay-fullscreen'
    : 'loading-overlay';

  return (
    <div className={className} role="status" aria-live="polite" aria-label={message}>
      <div className="loading-content">
        <Loader2 className="loading-spinner" size={48} aria-hidden="true" />
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
});

export default LoadingOverlay;

