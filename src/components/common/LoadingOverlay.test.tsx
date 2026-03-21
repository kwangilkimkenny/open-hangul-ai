/**
 * LoadingOverlay Component Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock lucide-react with explicit named exports
vi.mock('lucide-react', () => ({
  Loader2: (props: Record<string, unknown>) => <span data-testid="loader-icon" {...props} />,
}));

import { LoadingOverlay } from './LoadingOverlay';

describe('LoadingOverlay', () => {
  it('renders the loading overlay with default message', () => {
    render(<LoadingOverlay />);
    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('renders with a custom message', () => {
    render(<LoadingOverlay message="파일 처리 중..." />);
    expect(screen.getByText('파일 처리 중...')).toBeInTheDocument();
  });

  it('has role="status" for accessibility', () => {
    render(<LoadingOverlay />);
    const overlay = screen.getByRole('status');
    expect(overlay).toBeInTheDocument();
  });

  it('has aria-label matching the message', () => {
    render(<LoadingOverlay message="Saving..." />);
    const overlay = screen.getByRole('status');
    expect(overlay).toHaveAttribute('aria-label', 'Saving...');
  });

  it('applies fullscreen class when fullScreen is true', () => {
    render(<LoadingOverlay fullScreen={true} />);
    const overlay = screen.getByRole('status');
    expect(overlay).toHaveClass('loading-overlay-fullscreen');
  });

  it('does not apply fullscreen class by default', () => {
    render(<LoadingOverlay />);
    const overlay = screen.getByRole('status');
    expect(overlay).toHaveClass('loading-overlay');
    expect(overlay).not.toHaveClass('loading-overlay-fullscreen');
  });

  it('renders the spinner icon with aria-hidden', () => {
    render(<LoadingOverlay />);
    const spinner = screen.getByTestId('loader-icon');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });
});
