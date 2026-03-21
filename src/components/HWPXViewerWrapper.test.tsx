/**
 * HWPXViewerWrapper Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  devLog: vi.fn(),
  devError: vi.fn(),
  devWarn: vi.fn(),
}));

// Mock all CSS imports
vi.mock('../styles/vanilla/variables.css', () => ({ default: '' }));
vi.mock('../styles/vanilla/viewer.css', () => ({ default: '' }));
vi.mock('../styles/vanilla/ai-chat.css', () => ({ default: '' }));
vi.mock('../styles/vanilla/ai-editor.css', () => ({ default: '' }));
vi.mock('../styles/vanilla/ai-text-editor.css', () => ({ default: '' }));
vi.mock('../styles/vanilla/edit-mode.css', () => ({ default: '' }));
vi.mock('../styles/vanilla/cell-selector.css', () => ({ default: '' }));
vi.mock('../styles/vanilla/external-api.css', () => ({ default: '' }));

// Store references for captured callbacks
const viewerState: {
  onLoad?: (doc: unknown) => void;
  onError?: (err: Error) => void;
  destroy: ReturnType<typeof vi.fn>;
  loadFile: ReturnType<typeof vi.fn>;
} = {
  destroy: vi.fn(),
  loadFile: vi.fn(),
};

// Mock HWPXViewer as a class
vi.mock('../lib/vanilla/viewer.js', () => {
  return {
    default: vi.fn().mockImplementation(function (this: Record<string, unknown>, opts: Record<string, unknown>) {
      // Use a globally accessible state object
      const state = (globalThis as Record<string, unknown>).__viewerState as typeof viewerState;
      state.onLoad = opts.onLoad as typeof viewerState.onLoad;
      state.onError = opts.onError as typeof viewerState.onError;
      this.destroy = state.destroy;
      this.loadFile = state.loadFile;
      return this;
    }),
  };
});

// Make viewerState accessible to the mock
(globalThis as Record<string, unknown>).__viewerState = viewerState;

// Suppress jsdom "Not implemented" alert warning
vi.spyOn(window, 'alert').mockImplementation(() => {});

import { HWPXViewerWrapper } from './HWPXViewerWrapper';
import HWPXViewer from '../lib/vanilla/viewer.js';

const MockViewer = HWPXViewer as unknown as ReturnType<typeof vi.fn>;

describe('HWPXViewerWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    viewerState.onLoad = undefined;
    viewerState.onError = undefined;
    viewerState.destroy = vi.fn();
    viewerState.loadFile = vi.fn();
    // Re-suppress alert after clearAllMocks
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    delete (window as Record<string, unknown>).__DEBUG_HWPX;
    delete (window as Record<string, unknown>).__hwpxViewer;
    delete (window as Record<string, unknown>).__loadHWPXFile;
  });

  it('renders the viewer container div with correct id', () => {
    render(<HWPXViewerWrapper />);
    const container = document.getElementById('hwpx-viewer-root');
    expect(container).toBeInTheDocument();
  });

  it('applies custom className to the container', () => {
    render(<HWPXViewerWrapper className="my-custom-class" />);
    const container = document.getElementById('hwpx-viewer-root');
    expect(container).toHaveClass('my-custom-class');
  });

  it('creates a HWPXViewer instance on mount', () => {
    render(<HWPXViewerWrapper />);
    expect(MockViewer).toHaveBeenCalledTimes(1);
    expect(MockViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        enableAI: true,
        useWorker: true,
      })
    );
  });

  it('passes enableAI=false to the viewer when specified', () => {
    render(<HWPXViewerWrapper enableAI={false} />);
    expect(MockViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        enableAI: false,
      })
    );
  });

  it('calls onDocumentLoad with viewer instance after init', () => {
    const onDocumentLoad = vi.fn();
    render(<HWPXViewerWrapper onDocumentLoad={onDocumentLoad} />);
    expect(onDocumentLoad).toHaveBeenCalledTimes(1);
    // The callback receives the viewer instance (which is `this` from the constructor)
    expect(onDocumentLoad.mock.calls[0][0]).toBeDefined();
  });

  it('invokes onError callback when viewer reports an error', () => {
    const onError = vi.fn();
    render(<HWPXViewerWrapper onError={onError} />);
    expect(viewerState.onError).toBeDefined();

    const testError = new Error('test error');
    viewerState.onError!(testError);
    expect(onError).toHaveBeenCalledWith(testError);
  });

  it('calls destroy on the viewer instance when unmounting', () => {
    const { unmount } = render(<HWPXViewerWrapper />);
    unmount();
    expect(viewerState.destroy).toHaveBeenCalled();
  });

  it('renders the AI panel toggle button when enableAI is true', () => {
    render(<HWPXViewerWrapper enableAI={true} />);
    const aiButton = screen.getByTitle('AI 패널 열기');
    expect(aiButton).toBeInTheDocument();
  });

  it('does not render the AI panel toggle button when enableAI is false', () => {
    render(<HWPXViewerWrapper enableAI={false} />);
    expect(screen.queryByTitle('AI 패널 열기')).not.toBeInTheDocument();
  });

  it('renders the status text bar', () => {
    render(<HWPXViewerWrapper />);
    const statusText = document.getElementById('status-text');
    expect(statusText).toBeInTheDocument();
    expect(statusText).toHaveTextContent('준비됨');
  });
});
