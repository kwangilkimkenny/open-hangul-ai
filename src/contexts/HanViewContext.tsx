/**
 * HAN-View React - Customization Context
 * 커스터마이징 설정을 전역으로 관리
 */

import React, { createContext, useContext, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { HanViewConfig, HanViewCustomization, ThemeVariables } from '../types/customization';

// ============================================
// 기본값 정의
// ============================================

const defaultConfig: HanViewCustomization = {
  theme: 'light',
  
  layout: {
    showHeader: true,
    headerHeight: 60,
    showFooter: true,
    footerHeight: 32,
    showSidebar: false,
    sidebarPosition: 'right',
    sidebarWidth: 300,
    pagePadding: 57,
    pageGap: 20,
  },
  
  toolbar: {
    visible: true,
    position: 'top',
    buttons: {
      open: true,
      save: true,
      print: true,
      download: true,
      zoomIn: true,
      zoomOut: true,
      search: true,
      fullscreen: true,
    },
    customButtons: [],
  },
  
  aiPanel: {
    enabled: true,
    width: 450,
    position: 'right',
    defaultOpen: false,
    features: {
      structureView: true,
      templateExtract: true,
      cellSelection: true,
      externalApi: true,
      batchGenerate: true,
      validation: true,
    },
    headerTitle: 'AI 문서 편집',
  },
  
  contextMenu: {
    enabled: true,
    items: {
      edit: true,
      copy: true,
      paste: true,
      addRow: true,
      addColumn: true,
      deleteRow: true,
      deleteColumn: true,
      aiGenerate: true,
    },
    customItems: [],
  },
  
  search: {
    enabled: true,
    useRegex: false,
    caseSensitive: false,
    highlightColor: '#ffeb3b',
    currentHighlightColor: '#ff9800',
    shortcut: 'ctrl+f',
  },
  
  edit: {
    enabled: true,
    inlineEdit: true,
    tableEdit: true,
    autoSave: {
      enabled: true,
      interval: 30000,
    },
    history: {
      enabled: true,
      maxSteps: 50,
    },
  },
  
  loading: {
    text: '문서 로드 중...',
    spinnerColor: '#111827',
  },
  
  error: {
    retryText: '다시 시도',
    reloadText: '새로고침',
  },
  
  locale: 'ko',
  classPrefix: 'hanview',
};

// ============================================
// Context 타입
// ============================================

interface HanViewContextType {
  config: HanViewCustomization;
  updateConfig: (updates: Partial<HanViewCustomization>) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  toggleAIPanel: () => void;
  isAIPanelOpen: boolean;
}

// ============================================
// Context 생성
// ============================================

const HanViewContext = createContext<HanViewContextType | undefined>(undefined);

// ============================================
// Provider 컴포넌트
// ============================================

interface HanViewProviderProps {
  children: ReactNode;
  config?: Partial<HanViewConfig>;
}

export function HanViewProvider({ children, config: userConfig }: HanViewProviderProps) {
  const [config, setConfig] = React.useState<HanViewCustomization>(() => 
    deepMerge(defaultConfig, userConfig || {}) as HanViewCustomization
  );
  const [isAIPanelOpen, setIsAIPanelOpen] = React.useState(
    userConfig?.aiPanel?.defaultOpen ?? false
  );

  // 테마 적용
  useEffect(() => {
    applyTheme(config.theme);
  }, [config.theme]);

  // CSS 변수 적용
  useEffect(() => {
    if (typeof config.theme === 'object' && config.theme.variables) {
      applyThemeVariables(config.theme.variables);
    }
  }, [config.theme]);

  // 설정 업데이트
  const updateConfig = React.useCallback((updates: Partial<HanViewCustomization>) => {
    setConfig(prev => deepMerge(prev, updates) as HanViewCustomization);
  }, []);

  // 테마 변경
  const setTheme = React.useCallback((theme: 'light' | 'dark' | 'auto') => {
    setConfig(prev => ({ ...prev, theme }));
  }, []);

  // AI 패널 토글
  const toggleAIPanel = React.useCallback(() => {
    setIsAIPanelOpen(prev => !prev);
  }, []);

  const value = useMemo(() => ({
    config,
    updateConfig,
    setTheme,
    toggleAIPanel,
    isAIPanelOpen,
  }), [config, updateConfig, setTheme, toggleAIPanel, isAIPanelOpen]);

  return (
    <HanViewContext.Provider value={value}>
      {children}
    </HanViewContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useHanView(): HanViewContextType {
  const context = useContext(HanViewContext);
  if (!context) {
    throw new Error('useHanView must be used within a HanViewProvider');
  }
  return context;
}

// 개별 설정 접근 훅
export function useHanViewConfig() {
  const { config } = useHanView();
  return config;
}

export function useHanViewTheme() {
  const { config, setTheme } = useHanView();
  return { theme: config.theme, setTheme };
}

export function useHanViewToolbar() {
  const { config, updateConfig } = useHanView();
  
  const setToolbar = React.useCallback((updates: Partial<typeof config.toolbar>) => {
    updateConfig({ toolbar: { ...config.toolbar, ...updates } });
  }, [config.toolbar, updateConfig]);
  
  return { toolbar: config.toolbar, setToolbar };
}

export function useHanViewAIPanel() {
  const { config, updateConfig, isAIPanelOpen, toggleAIPanel } = useHanView();
  
  const setAIPanel = React.useCallback((updates: Partial<typeof config.aiPanel>) => {
    updateConfig({ aiPanel: { ...config.aiPanel, ...updates } });
  }, [config.aiPanel, updateConfig]);
  
  return { 
    aiPanel: config.aiPanel, 
    setAIPanel, 
    isOpen: isAIPanelOpen, 
    toggle: toggleAIPanel 
  };
}

// ============================================
// 유틸리티 함수
// ============================================

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null
      ) {
        result[key] = deepMerge(targetValue as object, sourceValue as object) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }
  
  return result;
}

function applyTheme(theme: HanViewCustomization['theme']) {
  if (typeof theme === 'string') {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } else if (theme && typeof theme === 'object') {
    document.documentElement.setAttribute('data-theme', theme.id);
  }
}

function applyThemeVariables(variables: Partial<ThemeVariables>) {
  const root = document.documentElement;
  
  const variableMap: Record<keyof ThemeVariables, string> = {
    primaryColor: '--hanview-primary-color',
    primaryHover: '--hanview-primary-hover',
    secondaryColor: '--hanview-secondary-color',
    accentColor: '--hanview-accent-color',
    successColor: '--hanview-success-color',
    warningColor: '--hanview-warning-color',
    errorColor: '--hanview-error-color',
    infoColor: '--hanview-info-color',
    containerBg: '--hanview-container-bg',
    pageBg: '--hanview-page-bg',
    headerBg: '--hanview-header-bg',
    textPrimary: '--hanview-gray-900',
    textSecondary: '--hanview-gray-600',
    fontFamily: '--hanview-font-family',
    fontSizeBase: '--hanview-font-size-base',
    aiPanelWidth: '--hanview-ai-panel-width',
    aiPanelBg: '--hanview-ai-panel-bg',
  };
  
  for (const [key, value] of Object.entries(variables)) {
    const cssVar = variableMap[key as keyof ThemeVariables];
    if (cssVar && value) {
      root.style.setProperty(cssVar, value);
    }
  }
}

// ============================================
// 기본 export
// ============================================

export { HanViewContext };
export type { HanViewContextType };

