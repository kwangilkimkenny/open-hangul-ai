import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useUIStore } from './uiStore';

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset to defaults by setting each field explicitly,
    // since the store uses persist middleware and has no reset action.
    act(() => {
      const s = useUIStore.getState();
      s.setTheme('system');
      s.setZoom(100);
      s.setRotation(0);
      s.setSidebarOpen(true);
      s.setAIPanelOpen(false);
      s.setCurrentPage(1);
      s.closeModal();
      s.hideContextMenu();
      s.setGlobalLoading(false);
      // Clear any toasts
      useUIStore.setState({ toasts: [] });
    });
  });

  // 1. Initial state defaults
  it('has correct default state', () => {
    const state = useUIStore.getState();
    expect(state.theme).toBe('system');
    expect(state.zoom).toBe(100);
    expect(state.rotation).toBe(0);
    expect(state.isSidebarOpen).toBe(true);
    expect(state.isAIPanelOpen).toBe(false);
    expect(state.currentPage).toBe(1);
    expect(state.modal.isOpen).toBe(false);
    expect(state.toasts).toEqual([]);
    expect(state.contextMenu.isOpen).toBe(false);
    expect(state.isGlobalLoading).toBe(false);
  });

  // 2. setTheme
  it('setTheme changes theme', () => {
    act(() => {
      useUIStore.getState().setTheme('dark');
    });
    expect(useUIStore.getState().theme).toBe('dark');

    act(() => {
      useUIStore.getState().setTheme('light');
    });
    expect(useUIStore.getState().theme).toBe('light');
  });

  // 3. setZoom clamps
  it('setZoom clamps to min/max (25-400)', () => {
    act(() => {
      useUIStore.getState().setZoom(10);
    });
    expect(useUIStore.getState().zoom).toBe(25);

    act(() => {
      useUIStore.getState().setZoom(500);
    });
    expect(useUIStore.getState().zoom).toBe(400);

    act(() => {
      useUIStore.getState().setZoom(150);
    });
    expect(useUIStore.getState().zoom).toBe(150);
  });

  // 4. zoomIn
  it('zoomIn adds 25', () => {
    act(() => {
      useUIStore.getState().setZoom(100);
      useUIStore.getState().zoomIn();
    });
    expect(useUIStore.getState().zoom).toBe(125);
  });

  // 5. zoomOut
  it('zoomOut subtracts 25', () => {
    act(() => {
      useUIStore.getState().setZoom(100);
      useUIStore.getState().zoomOut();
    });
    expect(useUIStore.getState().zoom).toBe(75);
  });

  // 6. resetZoom
  it('resetZoom sets zoom to 100', () => {
    act(() => {
      useUIStore.getState().setZoom(200);
      useUIStore.getState().resetZoom();
    });
    expect(useUIStore.getState().zoom).toBe(100);
  });

  // 7. toggleSidebar
  it('toggleSidebar flips isSidebarOpen', () => {
    expect(useUIStore.getState().isSidebarOpen).toBe(true);

    act(() => {
      useUIStore.getState().toggleSidebar();
    });
    expect(useUIStore.getState().isSidebarOpen).toBe(false);

    act(() => {
      useUIStore.getState().toggleSidebar();
    });
    expect(useUIStore.getState().isSidebarOpen).toBe(true);
  });

  // 8. toggleAIPanel
  it('toggleAIPanel flips isAIPanelOpen', () => {
    expect(useUIStore.getState().isAIPanelOpen).toBe(false);

    act(() => {
      useUIStore.getState().toggleAIPanel();
    });
    expect(useUIStore.getState().isAIPanelOpen).toBe(true);

    act(() => {
      useUIStore.getState().toggleAIPanel();
    });
    expect(useUIStore.getState().isAIPanelOpen).toBe(false);
  });

  // 9. setCurrentPage minimum 1
  it('setCurrentPage enforces minimum of 1', () => {
    act(() => {
      useUIStore.getState().setCurrentPage(5);
    });
    expect(useUIStore.getState().currentPage).toBe(5);

    act(() => {
      useUIStore.getState().setCurrentPage(0);
    });
    expect(useUIStore.getState().currentPage).toBe(1);

    act(() => {
      useUIStore.getState().setCurrentPage(-3);
    });
    expect(useUIStore.getState().currentPage).toBe(1);
  });

  // 10. openModal / closeModal
  it('openModal and closeModal work correctly', () => {
    act(() => {
      useUIStore.getState().openModal('confirm', { message: 'Are you sure?' });
    });

    const modal = useUIStore.getState().modal;
    expect(modal.isOpen).toBe(true);
    expect(modal.type).toBe('confirm');
    expect(modal.data).toEqual({ message: 'Are you sure?' });

    act(() => {
      useUIStore.getState().closeModal();
    });

    const closed = useUIStore.getState().modal;
    expect(closed.isOpen).toBe(false);
    expect(closed.type).toBeNull();
  });

  // 11. showToast adds a toast
  it('showToast adds a toast to the list', () => {
    act(() => {
      useUIStore.getState().showToast('success', 'Saved', 'Document saved', 0);
    });

    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].title).toBe('Saved');
    expect(toasts[0].message).toBe('Document saved');
  });

  // 12. removeToast removes a toast
  it('removeToast removes a toast by id', () => {
    act(() => {
      useUIStore.getState().showToast('info', 'Info', undefined, 0);
    });

    const id = useUIStore.getState().toasts[0].id;

    act(() => {
      useUIStore.getState().removeToast(id);
    });

    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  // 13. showContextMenu / hideContextMenu
  it('showContextMenu and hideContextMenu work correctly', () => {
    const items = [
      { id: 'copy', label: 'Copy', onClick: () => {} },
    ];

    act(() => {
      useUIStore.getState().showContextMenu(100, 200, items);
    });

    const ctx = useUIStore.getState().contextMenu;
    expect(ctx.isOpen).toBe(true);
    expect(ctx.x).toBe(100);
    expect(ctx.y).toBe(200);
    expect(ctx.items).toHaveLength(1);

    act(() => {
      useUIStore.getState().hideContextMenu();
    });

    const hidden = useUIStore.getState().contextMenu;
    expect(hidden.isOpen).toBe(false);
    expect(hidden.items).toHaveLength(0);
  });

  // 14. setGlobalLoading with message
  it('setGlobalLoading sets loading state with message', () => {
    act(() => {
      useUIStore.getState().setGlobalLoading(true, 'Loading document...');
    });

    const state = useUIStore.getState();
    expect(state.isGlobalLoading).toBe(true);
    expect(state.loadingMessage).toBe('Loading document...');

    act(() => {
      useUIStore.getState().setGlobalLoading(false);
    });

    expect(useUIStore.getState().isGlobalLoading).toBe(false);
    expect(useUIStore.getState().loadingMessage).toBeNull();
  });

  // 15. setRotation wraps at 360
  it('setRotation wraps at 360', () => {
    act(() => {
      useUIStore.getState().setRotation(90);
    });
    expect(useUIStore.getState().rotation).toBe(90);

    act(() => {
      useUIStore.getState().setRotation(360);
    });
    expect(useUIStore.getState().rotation).toBe(0);

    act(() => {
      useUIStore.getState().setRotation(450);
    });
    expect(useUIStore.getState().rotation).toBe(90);
  });
});
