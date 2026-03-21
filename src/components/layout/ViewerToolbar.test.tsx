/**
 * ViewerToolbar Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react with explicit named exports
vi.mock('lucide-react', () => ({
  Maximize2: (props: Record<string, unknown>) => <span data-testid="icon-maximize" {...props} />,
  Minimize2: (props: Record<string, unknown>) => <span data-testid="icon-minimize" {...props} />,
  RotateCcw: (props: Record<string, unknown>) => <span data-testid="icon-rotate-ccw" {...props} />,
  RotateCw: (props: Record<string, unknown>) => <span data-testid="icon-rotate-cw" {...props} />,
}));

// Mock uiStore
const mockSetZoom = vi.fn();
const mockSetRotation = vi.fn();

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    zoom: 100,
    setZoom: mockSetZoom,
    rotation: 0,
    setRotation: mockSetRotation,
  })),
}));

import { ViewerToolbar } from './ViewerToolbar';

describe('ViewerToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toolbar with correct role', () => {
    render(<ViewerToolbar />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveClass('viewer-toolbar');
  });

  it('renders fit width and fit page buttons', () => {
    render(<ViewerToolbar />);
    expect(screen.getByTitle('너비 맞춤')).toBeInTheDocument();
    expect(screen.getByTitle('페이지 맞춤')).toBeInTheDocument();
  });

  it('renders zoom select dropdown with predefined values', () => {
    render(<ViewerToolbar />);
    const select = screen.getByLabelText('확대/축소 비율 선택');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('100');
  });

  it('calls setZoom when zoom dropdown is changed', () => {
    render(<ViewerToolbar />);
    const select = screen.getByLabelText('확대/축소 비율 선택');
    fireEvent.change(select, { target: { value: '150' } });
    expect(mockSetZoom).toHaveBeenCalledWith(150);
  });

  it('renders rotation buttons', () => {
    render(<ViewerToolbar />);
    expect(screen.getByTitle('왼쪽 회전')).toBeInTheDocument();
    expect(screen.getByTitle('오른쪽 회전')).toBeInTheDocument();
  });

  it('calls setRotation when rotate right is clicked', () => {
    render(<ViewerToolbar />);
    fireEvent.click(screen.getByTitle('오른쪽 회전'));
    // rotation is 0, so (0 + 90) % 360 = 90
    expect(mockSetRotation).toHaveBeenCalledWith(90);
  });

  it('calls setRotation when rotate left is clicked', () => {
    render(<ViewerToolbar />);
    fireEvent.click(screen.getByTitle('왼쪽 회전'));
    // rotation is 0, so (0 - 90 + 360) % 360 = 270
    expect(mockSetRotation).toHaveBeenCalledWith(270);
  });

  it('applies custom className', () => {
    render(<ViewerToolbar className="custom-toolbar" />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveClass('custom-toolbar');
  });
});
