/**
 * Header Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock lucide-react with explicit named exports
vi.mock('lucide-react', () => ({
  FolderOpen: (props: Record<string, unknown>) => <span data-testid="icon-folder-open" {...props} />,
  Printer: (props: Record<string, unknown>) => <span data-testid="icon-printer" {...props} />,
  Download: (props: Record<string, unknown>) => <span data-testid="icon-download" {...props} />,
  Save: (props: Record<string, unknown>) => <span data-testid="icon-save" {...props} />,
  FileDown: (props: Record<string, unknown>) => <span data-testid="icon-file-down" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
}));

// Mock stores
const mockDocumentStore = {
  document: null as unknown,
  fileName: null as string | null,
  isLoading: false,
  isDirty: false,
  setDocument: vi.fn(),
  setOriginalFile: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  setDirty: vi.fn(),
};

vi.mock('../../stores/documentStore', () => ({
  useDocumentStore: vi.fn(() => mockDocumentStore),
}));

const mockShowToast = vi.fn();
vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    showToast: mockShowToast,
  })),
}));

// Mock dependencies
vi.mock('../../lib/core/parser', () => ({
  SimpleHWPXParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn(),
  })),
}));

vi.mock('../../lib/export/pdf-exporter', () => ({
  PdfExporter: vi.fn().mockImplementation(() => ({
    exportDocument: vi.fn(),
  })),
}));

vi.mock('../../lib/export/hwpx-exporter', () => ({
  HwpxExporter: vi.fn().mockImplementation(() => ({
    exportToFile: vi.fn(),
  })),
}));

vi.mock('../../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(() => ({
    lastSaveTime: null,
    isInitialized: false,
  })),
}));

import { Header } from './Header';

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentStore.document = null;
    mockDocumentStore.fileName = null;
    mockDocumentStore.isLoading = false;
    mockDocumentStore.isDirty = false;
  });

  it('renders the header element', () => {
    render(<Header />);
    const header = document.querySelector('header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('viewer-header');
  });

  it('shows the logo text', () => {
    render(<Header />);
    expect(screen.getByText('ISMHAN')).toBeInTheDocument();
  });

  it('shows the version badge', () => {
    render(<Header />);
    expect(screen.getByText('v4.0.0')).toBeInTheDocument();
  });

  it('renders the open file button', () => {
    render(<Header />);
    const openBtn = screen.getByTitle('파일 열기 (Ctrl+O)');
    expect(openBtn).toBeInTheDocument();
    expect(openBtn).not.toBeDisabled();
  });

  it('disables open file button when loading', () => {
    mockDocumentStore.isLoading = true;
    render(<Header />);
    const openBtn = screen.getByTitle('파일 열기 (Ctrl+O)');
    expect(openBtn).toBeDisabled();
  });

  it('shows file info when a document is loaded', () => {
    mockDocumentStore.document = { sections: [{}, {}, {}] };
    mockDocumentStore.fileName = 'test.hwpx';
    render(<Header />);
    expect(screen.getByText('test.hwpx')).toBeInTheDocument();
    expect(screen.getByText('3 페이지')).toBeInTheDocument();
  });

  it('shows save and export buttons when document is loaded', () => {
    mockDocumentStore.document = { sections: [{}] };
    mockDocumentStore.fileName = 'test.hwpx';
    render(<Header />);
    expect(screen.getByTitle('HWPX 파일로 저장 (Ctrl+S)')).toBeInTheDocument();
    expect(screen.getByTitle('PDF로 다운로드')).toBeInTheDocument();
    expect(screen.getByTitle('인쇄 (Ctrl+P)')).toBeInTheDocument();
  });

  it('does not show save buttons when no document is loaded', () => {
    render(<Header />);
    expect(screen.queryByTitle('HWPX 파일로 저장 (Ctrl+S)')).not.toBeInTheDocument();
  });

  it('has a hidden file input for .hwpx files', () => {
    render(<Header />);
    const fileInput = screen.getByLabelText('Load HWPX file');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', '.hwpx,.hwp,.md');
    expect(fileInput).toHaveStyle({ display: 'none' });
  });
});
