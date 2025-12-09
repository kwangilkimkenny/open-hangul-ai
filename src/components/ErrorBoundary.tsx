/**
 * Error Boundary Component
 * 앱 전체의 에러를 잡아서 사용자 친화적으로 표시
 * 
 * @version 1.0.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconWrapper}>
              <span style={styles.icon}>⚠️</span>
            </div>
            
            <h1 style={styles.title}>문제가 발생했습니다</h1>
            
            <p style={styles.description}>
              예상치 못한 오류가 발생했습니다.<br />
              아래 버튼을 눌러 다시 시도해주세요.
            </p>

            <div style={styles.errorBox}>
              <code style={styles.errorText}>
                {this.state.error?.message || '알 수 없는 오류'}
              </code>
            </div>

            <div style={styles.buttonGroup}>
              <button 
                onClick={this.handleReset}
                style={styles.secondaryButton}
              >
                다시 시도
              </button>
              <button 
                onClick={this.handleReload}
                style={styles.primaryButton}
              >
                페이지 새로고침
              </button>
            </div>

            <details style={styles.details}>
              <summary style={styles.summary}>기술적 세부사항</summary>
              <pre style={styles.stackTrace}>
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
    padding: '20px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '48px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
  },
  iconWrapper: {
    marginBottom: '24px',
  },
  icon: {
    fontSize: '64px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  },
  description: {
    margin: '0 0 24px 0',
    fontSize: '15px',
    color: '#6b7280',
    lineHeight: 1.6,
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '24px',
  },
  errorText: {
    fontSize: '13px',
    color: '#dc2626',
    wordBreak: 'break-all',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  primaryButton: {
    padding: '12px 24px',
    background: '#111827',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '12px 24px',
    background: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  details: {
    textAlign: 'left',
  },
  summary: {
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  stackTrace: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '11px',
    color: '#374151',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
};

export default ErrorBoundary;

