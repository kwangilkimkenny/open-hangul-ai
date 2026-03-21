import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// Suppress console.error output from React's error boundary logging
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** A component that throws on render */
function ThrowingComponent({ message }: { message: string }) {
  throw new Error(message);
}

/** A component that conditionally throws */
function ConditionalThrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('conditional error');
  }
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  // 1. Renders children when no error
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  // 2. Catches error and shows fallback UI
  it('catches error and shows fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="test error" />
      </ErrorBoundary>,
    );

    // The default fallback has role="alert"
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // 3. Shows error message in fallback
  it('shows the error message in the fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Something broke" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  // 4. Has retry and reload buttons
  it('has retry and reload buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="error" />
      </ErrorBoundary>,
    );

    // Korean button labels from the source
    expect(screen.getByText('다시 시도')).toBeInTheDocument();
    expect(screen.getByText('페이지 새로고침')).toBeInTheDocument();
  });

  // 5. Error info is displayed (technical details section exists)
  it('displays technical details section', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="detailed error" />
      </ErrorBoundary>,
    );

    // The details/summary element for stack trace
    expect(screen.getByText('기술적 세부사항')).toBeInTheDocument();
  });

  // 6. Recovers after reset (retry button)
  it('recovers after clicking retry button', () => {
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) {
        throw new Error('temporary error');
      }
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );

    // Error state should be shown
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Fix the error condition before retrying
    shouldThrow = false;

    // Click retry button
    fireEvent.click(screen.getByText('다시 시도'));

    // Should now render the recovered component
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
