/**
 * ContextMenu Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react with explicit named exports
vi.mock('lucide-react', () => ({
  Copy: (props: Record<string, unknown>) => <span data-testid="icon-copy" {...props} />,
  Clipboard: (props: Record<string, unknown>) => <span data-testid="icon-clipboard" {...props} />,
  Edit3: (props: Record<string, unknown>) => <span data-testid="icon-edit" {...props} />,
  Sparkles: (props: Record<string, unknown>) => <span data-testid="icon-sparkles" {...props} />,
}));

// Mock CSS import
vi.mock('../../styles/editing.css', () => ({}));

import { ContextMenu, createEditingMenuItems } from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';

describe('ContextMenu', () => {
  const mockOnClose = vi.fn();
  const mockOnClick = vi.fn();

  const baseItems: ContextMenuItem[] = [
    { id: 'copy', label: '복사', shortcut: 'Ctrl+C', onClick: mockOnClick },
    { id: 'paste', label: '붙여넣기', onClick: mockOnClick },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the context menu with correct role', () => {
    render(<ContextMenu position={{ x: 100, y: 200 }} items={baseItems} onClose={mockOnClose} />);
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
  });

  it('positions the menu at the given coordinates', () => {
    render(<ContextMenu position={{ x: 150, y: 250 }} items={baseItems} onClose={mockOnClose} />);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '150px', top: '250px' });
  });

  it('renders all menu items', () => {
    render(<ContextMenu position={{ x: 0, y: 0 }} items={baseItems} onClose={mockOnClose} />);
    expect(screen.getByText('복사')).toBeInTheDocument();
    expect(screen.getByText('붙여넣기')).toBeInTheDocument();
  });

  it('renders shortcut text when provided', () => {
    render(<ContextMenu position={{ x: 0, y: 0 }} items={baseItems} onClose={mockOnClose} />);
    expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
  });

  it('calls onClick and onClose when a menu item is clicked', () => {
    render(<ContextMenu position={{ x: 0, y: 0 }} items={baseItems} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('복사'));
    expect(mockOnClick).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not call onClick for disabled items', () => {
    const items: ContextMenuItem[] = [
      { id: 'disabled-item', label: 'Disabled', disabled: true, onClick: mockOnClick },
    ];
    render(<ContextMenu position={{ x: 0, y: 0 }} items={items} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('Disabled'));
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('renders dividers', () => {
    const items: ContextMenuItem[] = [
      { id: 'item1', label: 'First', onClick: vi.fn() },
      { id: 'divider-1', label: '', divider: true },
      { id: 'item2', label: 'Second', onClick: vi.fn() },
    ];
    render(<ContextMenu position={{ x: 0, y: 0 }} items={items} onClose={mockOnClose} />);
    const divider = document.querySelector('.context-menu-divider');
    expect(divider).toBeInTheDocument();
  });

  it('renders disabled items with the disabled class and aria-disabled', () => {
    const items: ContextMenuItem[] = [
      { id: 'dis', label: 'Cannot Click', disabled: true },
    ];
    render(<ContextMenu position={{ x: 0, y: 0 }} items={items} onClose={mockOnClose} />);
    const item = screen.getByText('Cannot Click').closest('.context-menu-item');
    expect(item).toHaveClass('disabled');
    expect(item).toHaveAttribute('aria-disabled', 'true');
  });

  it('handles keyboard Enter to activate item', () => {
    render(<ContextMenu position={{ x: 0, y: 0 }} items={baseItems} onClose={mockOnClose} />);
    const item = screen.getByText('복사').closest('[role="menuitem"]')!;
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(mockOnClick).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('createEditingMenuItems', () => {
  it('returns the expected menu items', () => {
    const onEdit = vi.fn();
    const onAIGenerate = vi.fn();
    const items = createEditingMenuItems(onEdit, onAIGenerate, true);

    expect(items).toHaveLength(5);
    expect(items[0].id).toBe('edit');
    expect(items[1].id).toBe('copy');
    expect(items[2].id).toBe('paste');
    expect(items[3].divider).toBe(true);
    expect(items[4].id).toBe('ai-generate');
  });

  it('disables edit item when canEdit is false', () => {
    const items = createEditingMenuItems(vi.fn(), vi.fn(), false);
    expect(items[0].disabled).toBe(true);
  });
});
