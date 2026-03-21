/**
 * Toast Component
 * 토스트 알림 컴포넌트
 * 
 * @module components/ui/Toast
 * @version 1.0.0
 */

import { memo, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore, type ToastMessage } from '../../stores/uiStore';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  const handleClose = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  return (
    <div className="toast-container" aria-live="polite" aria-relevant="additions removals" role="status">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={handleClose}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const ToastItem = memo(function ToastItem({ toast, onClose }: ToastItemProps) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={20} className="toast-icon success" />;
      case 'error':
        return <AlertCircle size={20} className="toast-icon error" />;
      case 'warning':
        return <AlertTriangle size={20} className="toast-icon warning" />;
      case 'info':
        return <Info size={20} className="toast-icon info" />;
    }
  };

  return (
    <div className={`toast-item ${toast.type}`} role="alert" aria-live="assertive">
      <div className="toast-content">
        {getIcon()}
        <div className="toast-text">
          <span className="toast-title">{toast.title}</span>
          {toast.message && (
            <span className="toast-message">{toast.message}</span>
          )}
        </div>
      </div>
      <button className="toast-close" onClick={() => onClose(toast.id)} aria-label="알림 닫기">
        <X size={16} />
      </button>
    </div>
  );
});

export default ToastContainer;

