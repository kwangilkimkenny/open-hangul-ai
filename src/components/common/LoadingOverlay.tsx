/**
 * Loading Overlay Component
 * 로딩 오버레이 컴포넌트
 * 
 * @module components/common/LoadingOverlay
 * @version 1.0.0
 */

import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingOverlay({ 
  message = '로딩 중...', 
  fullScreen = false 
}: LoadingOverlayProps) {
  const className = fullScreen 
    ? 'loading-overlay loading-overlay-fullscreen' 
    : 'loading-overlay';

  return (
    <div className={className}>
      <div className="loading-content">
        <Loader2 className="loading-spinner" size={48} />
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
}

export default LoadingOverlay;

