/**
 * UI Store
 * UI 상태 관리 (Zustand)
 * 
 * @module stores/uiStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ModalState {
  isOpen: boolean;
  type: string | null;
  data?: unknown;
}

interface UIState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  
  // Zoom
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  
  // Rotation
  rotation: number;
  setRotation: (rotation: number) => void;
  
  // Sidebar
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  // AI Panel
  isAIPanelOpen: boolean;
  setAIPanelOpen: (open: boolean) => void;
  toggleAIPanel: () => void;
  
  // Current Page
  currentPage: number;
  setCurrentPage: (page: number) => void;
  
  // Modal
  modal: ModalState;
  openModal: (type: string, data?: unknown) => void;
  closeModal: () => void;
  
  // Toast
  toasts: ToastMessage[];
  showToast: (type: ToastMessage['type'], title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  
  // Loading
  isGlobalLoading: boolean;
  loadingMessage: string | null;
  setGlobalLoading: (loading: boolean, message?: string) => void;
  
  // Context Menu
  contextMenu: {
    isOpen: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
  };
  showContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  hideContextMenu: () => void;
  
  // Active Tab (for multi-document support)
  activeTabId: string | null;
  setActiveTab: (id: string) => void;
}

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  divider?: boolean;
}

const ZOOM_MIN = 25;
const ZOOM_MAX = 400;
const ZOOM_STEP = 25;

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Theme
        theme: 'system',
        setTheme: (theme) => set({ theme }),
        
        // Zoom
        zoom: 100,
        setZoom: (zoom) => set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) }),
        zoomIn: () => {
          const { zoom } = get();
          set({ zoom: Math.min(ZOOM_MAX, zoom + ZOOM_STEP) });
        },
        zoomOut: () => {
          const { zoom } = get();
          set({ zoom: Math.max(ZOOM_MIN, zoom - ZOOM_STEP) });
        },
        resetZoom: () => set({ zoom: 100 }),
        
        // Rotation
        rotation: 0,
        setRotation: (rotation) => set({ rotation: rotation % 360 }),
        
        // Sidebar
        isSidebarOpen: true,
        setSidebarOpen: (open) => set({ isSidebarOpen: open }),
        toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
        
        // AI Panel
        isAIPanelOpen: false,
        setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
        toggleAIPanel: () => set((state) => ({ isAIPanelOpen: !state.isAIPanelOpen })),
        
        // Current Page
        currentPage: 1,
        setCurrentPage: (page) => set({ currentPage: Math.max(1, page) }),
        
        // Modal
        modal: { isOpen: false, type: null, data: undefined },
        openModal: (type, data) => set({ modal: { isOpen: true, type, data } }),
        closeModal: () => set({ modal: { isOpen: false, type: null, data: undefined } }),
        
        // Toast
        toasts: [],
        showToast: (type, title, message, duration = 3000) => {
          const id = `toast-${Date.now()}`;
          const toast: ToastMessage = { id, type, title, message, duration };
          
          set((state) => ({
            toasts: [...state.toasts, toast]
          }));
          
          // Auto remove
          if (duration > 0) {
            setTimeout(() => {
              get().removeToast(id);
            }, duration);
          }
        },
        removeToast: (id) => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
          }));
        },
        
        // Loading
        isGlobalLoading: false,
        loadingMessage: null,
        setGlobalLoading: (loading, message) => set({
          isGlobalLoading: loading,
          loadingMessage: message || null
        }),
        
        // Context Menu
        contextMenu: { isOpen: false, x: 0, y: 0, items: [] },
        showContextMenu: (x, y, items) => set({
          contextMenu: { isOpen: true, x, y, items }
        }),
        hideContextMenu: () => set({
          contextMenu: { isOpen: false, x: 0, y: 0, items: [] }
        }),
        
        // Active Tab
        activeTabId: null,
        setActiveTab: (id) => set({ activeTabId: id }),
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          zoom: state.zoom,
          rotation: state.rotation,
          isSidebarOpen: state.isSidebarOpen,
          isAIPanelOpen: state.isAIPanelOpen,
        }),
      }
    ),
    { name: 'ui-store' }
  )
);

export type { ContextMenuItem, ToastMessage };
export default useUIStore;

