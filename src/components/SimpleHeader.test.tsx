import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimpleHeader } from './SimpleHeader';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock the dev logger utils
vi.mock('../utils/logger', () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

function createMockViewer(overrides = {}) {
  return {
    container: document.createElement('div'),
    loadFile: vi.fn(),
    getDocument: vi.fn(),
    destroy: vi.fn(),
    saveFile: vi.fn().mockResolvedValue({ success: true }),
    printDocument: vi.fn(),
    ...overrides,
  };
}

describe('SimpleHeader', () => {
  // 1. Renders header
  it('renders the header element', () => {
    render(<SimpleHeader />);

    // The header contains the default title "HAN-View"
    expect(screen.getByText('HAN-View')).toBeInTheDocument();
  });

  // 2. Shows file open button/label
  it('shows the file open label', () => {
    render(<SimpleHeader />);

    expect(screen.getByLabelText('HWPX 파일 열기')).toBeInTheDocument();
  });

  // 3. Shows save button
  it('shows the save button', () => {
    render(<SimpleHeader />);

    expect(screen.getByLabelText('문서 저장 (Ctrl+S)')).toBeInTheDocument();
  });

  // 4. Shows print button (hidden but present in DOM)
  it('has a print button in the DOM', () => {
    render(<SimpleHeader />);

    expect(screen.getByLabelText('인쇄 (Ctrl+P)')).toBeInTheDocument();
  });

  // 5. Custom title is displayed
  it('displays custom title and subtitle', () => {
    render(<SimpleHeader title="My Viewer" subtitle="Custom subtitle" />);

    expect(screen.getByText('My Viewer')).toBeInTheDocument();
    expect(screen.getByText('Custom subtitle')).toBeInTheDocument();
  });

  // 6. Save button calls viewer.saveFile
  it('save button calls viewer.saveFile when clicked', async () => {
    const viewer = createMockViewer();
    render(<SimpleHeader viewer={viewer as any} />);

    fireEvent.click(screen.getByLabelText('문서 저장 (Ctrl+S)'));

    // saveFile is async, but the click triggers the call
    expect(viewer.saveFile).toHaveBeenCalled();
  });
});
