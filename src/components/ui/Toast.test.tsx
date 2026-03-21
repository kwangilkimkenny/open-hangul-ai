/**
 * Toast Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react with explicit named exports
vi.mock('lucide-react', () => ({
  X: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => <span data-testid="icon-check" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert-circle" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <span data-testid="icon-alert-triangle" {...props} />,
  Info: (props: Record<string, unknown>) => <span data-testid="icon-info" {...props} />,
}));

// Mock uiStore
const mockRemoveToast = vi.fn();
let mockToasts: Array<{
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}> = [];

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    toasts: mockToasts,
    removeToast: mockRemoveToast,
  })),
}));

import { ToastContainer } from './Toast';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToasts = [];
  });

  it('renders empty container when no toasts', () => {
    render(<ToastContainer />);
    const container = document.querySelector('.toast-container');
    expect(container).toBeInTheDocument();
    expect(container?.children).toHaveLength(0);
  });

  it('renders a success toast with correct content', () => {
    mockToasts = [
      { id: 'toast-1', type: 'success', title: 'Success!', message: 'Operation completed.' },
    ];
    render(<ToastContainer />);
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Operation completed.')).toBeInTheDocument();
  });

  it('renders an error toast', () => {
    mockToasts = [
      { id: 'toast-2', type: 'error', title: 'Error', message: 'Something went wrong.' },
    ];
    render(<ToastContainer />);
    const toastItem = document.querySelector('.toast-item.error');
    expect(toastItem).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders a warning toast', () => {
    mockToasts = [
      { id: 'toast-3', type: 'warning', title: 'Warning' },
    ];
    render(<ToastContainer />);
    const toastItem = document.querySelector('.toast-item.warning');
    expect(toastItem).toBeInTheDocument();
  });

  it('renders an info toast', () => {
    mockToasts = [
      { id: 'toast-4', type: 'info', title: 'Info', message: 'FYI.' },
    ];
    render(<ToastContainer />);
    const toastItem = document.querySelector('.toast-item.info');
    expect(toastItem).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    mockToasts = [
      { id: 'toast-a', type: 'success', title: 'First' },
      { id: 'toast-b', type: 'error', title: 'Second' },
      { id: 'toast-c', type: 'info', title: 'Third' },
    ];
    render(<ToastContainer />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('calls removeToast when close button is clicked', () => {
    mockToasts = [
      { id: 'toast-dismiss', type: 'success', title: 'Dismiss me' },
    ];
    render(<ToastContainer />);
    const closeBtn = screen.getByLabelText('알림 닫기');
    fireEvent.click(closeBtn);
    expect(mockRemoveToast).toHaveBeenCalledWith('toast-dismiss');
  });

  it('renders toast without message when message is undefined', () => {
    mockToasts = [
      { id: 'toast-no-msg', type: 'info', title: 'Title Only' },
    ];
    render(<ToastContainer />);
    expect(screen.getByText('Title Only')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('has the correct ARIA attributes for accessibility', () => {
    render(<ToastContainer />);
    const container = document.querySelector('.toast-container');
    expect(container).toHaveAttribute('aria-live', 'polite');
    expect(container).toHaveAttribute('role', 'status');
  });
});
