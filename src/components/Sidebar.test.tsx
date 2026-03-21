import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => ({
  FileText: (props: any) => <span data-testid="icon-filetext" {...props} />,
  Image: (props: any) => <span data-testid="icon-image" {...props} />,
  Layout: (props: any) => <span data-testid="icon-layout" {...props} />,
  Cloud: (props: any) => <span data-testid="icon-cloud" {...props} />,
}));

function createMockViewer(overrides: Record<string, any> = {}) {
  const container = document.createElement('div');
  // Add addEventListener / removeEventListener to the container
  container.addEventListener = vi.fn();
  container.removeEventListener = vi.fn();

  return {
    container,
    loadFile: vi.fn(),
    getDocument: vi.fn(),
    destroy: vi.fn(),
    renderer: {
      totalPages: 0,
      ...overrides.renderer,
    },
    ...overrides,
  };
}

describe('Sidebar', () => {
  // 1. Renders sidebar
  it('renders the sidebar with role complementary', () => {
    const viewer = createMockViewer();
    render(<Sidebar viewer={viewer as any} isOpen={true} />);

    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  // 2. Shows/hides based on isOpen prop
  it('hides when isOpen is false', () => {
    const viewer = createMockViewer();
    const { container } = render(<Sidebar viewer={viewer as any} isOpen={false} />);

    // When closed, the sidebar-collapsed div is rendered with width 0
    const collapsed = container.querySelector('.sidebar-collapsed');
    expect(collapsed).toBeInTheDocument();
    expect(collapsed?.getAttribute('style')).toContain('width: 0px');
  });

  it('shows when isOpen is true', () => {
    const viewer = createMockViewer();
    render(<Sidebar viewer={viewer as any} isOpen={true} />);

    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByText('문서 정보')).toBeInTheDocument();
  });

  // 3. Page list section rendered
  it('renders the page list heading', () => {
    const viewer = createMockViewer();
    render(<Sidebar viewer={viewer as any} isOpen={true} />);

    expect(screen.getByText('페이지 목록')).toBeInTheDocument();
  });

  // 4. Displays file name when file is provided
  it('displays file name when file prop is given', () => {
    const viewer = createMockViewer();
    const file = new File(['data'], 'example.hwpx', { type: 'application/octet-stream' });
    render(<Sidebar viewer={viewer as any} file={file} isOpen={true} />);

    expect(screen.getByText('example.hwpx')).toBeInTheDocument();
  });

  // 5. Shows empty state when no pages
  it('shows empty state text when there are no pages', () => {
    const viewer = createMockViewer({ renderer: { totalPages: 0 } });
    render(<Sidebar viewer={viewer as any} isOpen={true} />);

    expect(screen.getByText('페이지 정보 없음')).toBeInTheDocument();
  });

  // 6. Displays placeholder when no file
  it('shows dash placeholders when no file is loaded', () => {
    const viewer = createMockViewer();
    render(<Sidebar viewer={viewer as any} isOpen={true} />);

    // File name and size should show '-'
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
