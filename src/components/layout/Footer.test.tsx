/**
 * Footer Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react with explicit named exports
vi.mock('lucide-react', () => ({
  ChevronsLeft: (props: Record<string, unknown>) => <span data-testid="icon-chevrons-left" {...props} />,
  ChevronLeft: (props: Record<string, unknown>) => <span data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <span data-testid="icon-chevron-right" {...props} />,
  ChevronsRight: (props: Record<string, unknown>) => <span data-testid="icon-chevrons-right" {...props} />,
  ZoomIn: (props: Record<string, unknown>) => <span data-testid="icon-zoom-in" {...props} />,
  ZoomOut: (props: Record<string, unknown>) => <span data-testid="icon-zoom-out" {...props} />,
}));

// Mock stores
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();

vi.mock('../../stores/documentStore', () => ({
  useDocumentStore: vi.fn(() => ({
    document: { sections: [{}, {}] },
  })),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    zoom: 100,
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
  })),
}));

import { Footer } from './Footer';

describe('Footer', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    onPageChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the footer element', () => {
    render(<Footer {...defaultProps} />);
    const footer = document.querySelector('footer');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('viewer-footer');
  });

  it('shows the version text', () => {
    render(<Footer {...defaultProps} />);
    expect(screen.getByText('ISMHAN v4.0.0')).toBeInTheDocument();
  });

  it('shows the current zoom level', () => {
    render(<Footer {...defaultProps} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders page navigation buttons', () => {
    render(<Footer {...defaultProps} />);
    expect(screen.getByTitle('첫 페이지')).toBeInTheDocument();
    expect(screen.getByTitle('이전 페이지')).toBeInTheDocument();
    expect(screen.getByTitle('다음 페이지')).toBeInTheDocument();
    expect(screen.getByTitle('마지막 페이지')).toBeInTheDocument();
  });

  it('disables previous buttons on the first page', () => {
    render(<Footer {...defaultProps} currentPage={1} />);
    expect(screen.getByTitle('첫 페이지')).toBeDisabled();
    expect(screen.getByTitle('이전 페이지')).toBeDisabled();
  });

  it('disables next buttons on the last page', () => {
    render(<Footer {...defaultProps} currentPage={5} totalPages={5} />);
    expect(screen.getByTitle('다음 페이지')).toBeDisabled();
    expect(screen.getByTitle('마지막 페이지')).toBeDisabled();
  });

  it('calls onPageChange when next page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Footer {...defaultProps} currentPage={2} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTitle('다음 페이지'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange when previous page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Footer {...defaultProps} currentPage={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTitle('이전 페이지'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls zoomIn when zoom in button is clicked', () => {
    render(<Footer {...defaultProps} />);
    fireEvent.click(screen.getByTitle('확대'));
    expect(mockZoomIn).toHaveBeenCalled();
  });

  it('calls zoomOut when zoom out button is clicked', () => {
    render(<Footer {...defaultProps} />);
    fireEvent.click(screen.getByTitle('축소'));
    expect(mockZoomOut).toHaveBeenCalled();
  });

  it('displays the total pages count', () => {
    render(<Footer {...defaultProps} totalPages={10} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
