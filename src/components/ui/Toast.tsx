/**
 * Toast Component
 * 토스트 알림 컴포넌트
 * 
 * @module components/ui/Toast
 * @version 1.0.0
 */

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore, type ToastMessage } from '../../stores/uiStore';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onClose={() => removeToast(toast.id)} 
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: ToastMessage;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
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
    <div className={`toast-item ${toast.type}`}>
      <div className="toast-content">
        {getIcon()}
        <div className="toast-text">
          <span className="toast-title">{toast.title}</span>
          {toast.message && (
            <span className="toast-message">{toast.message}</span>
          )}
        </div>
      </div>
      <button className="toast-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}

export default ToastContainer;

