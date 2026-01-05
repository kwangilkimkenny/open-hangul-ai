/**
 * HAN-View React - Customization Types
 * UI/UX 커스터마이징을 위한 타입 정의
 */

import { ReactNode, CSSProperties } from 'react';

// ============================================
// 테마 관련 타입
// ============================================

export interface HanViewTheme {
  /** 테마 ID */
  id: string;
  /** 테마 이름 */
  name: string;
  /** CSS 변수 오버라이드 */
  variables?: Partial<ThemeVariables>;
}

export interface ThemeVariables {
  // 색상
  primaryColor: string;
  primaryHover: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
  
  // 배경
  containerBg: string;
  pageBg: string;
  headerBg: string;
  
  // 텍스트
  textPrimary: string;
  textSecondary: string;
  
  // 폰트
  fontFamily: string;
  fontSizeBase: string;
  
  // AI 패널
  aiPanelWidth: string;
  aiPanelBg: string;
}

// ============================================
// 레이아웃 커스터마이징
// ============================================

export interface LayoutConfig {
  /** 헤더 표시 여부 */
  showHeader?: boolean;
  /** 헤더 높이 */
  headerHeight?: number | string;
  /** 커스텀 헤더 컴포넌트 */
  headerComponent?: ReactNode;
  
  /** 푸터 표시 여부 */
  showFooter?: boolean;
  /** 푸터 높이 */
  footerHeight?: number | string;
  /** 커스텀 푸터 컴포넌트 */
  footerComponent?: ReactNode;
  
  /** 사이드바 표시 여부 */
  showSidebar?: boolean;
  /** 사이드바 위치 */
  sidebarPosition?: 'left' | 'right';
  /** 사이드바 너비 */
  sidebarWidth?: number | string;
  /** 커스텀 사이드바 컴포넌트 */
  sidebarComponent?: ReactNode;
  
  /** 페이지 패딩 */
  pagePadding?: number | string;
  /** 페이지 간 간격 */
  pageGap?: number | string;
}

// ============================================
// 툴바 커스터마이징
// ============================================

export interface ToolbarConfig {
  /** 툴바 표시 여부 */
  visible?: boolean;
  /** 툴바 위치 */
  position?: 'top' | 'bottom' | 'floating';
  
  /** 기본 버튼 표시 설정 */
  buttons?: {
    open?: boolean;
    save?: boolean;
    print?: boolean;
    download?: boolean;
    zoomIn?: boolean;
    zoomOut?: boolean;
    search?: boolean;
    fullscreen?: boolean;
  };
  
  /** 커스텀 버튼 추가 */
  customButtons?: ToolbarButton[];
  
  /** 툴바 스타일 */
  style?: CSSProperties;
}

export interface ToolbarButton {
  id: string;
  label: string;
  icon?: ReactNode;
  tooltip?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

// ============================================
// AI 패널 커스터마이징
// ============================================

export interface AIPanelConfig {
  /** AI 패널 활성화 */
  enabled?: boolean;
  /** 패널 너비 */
  width?: number | string;
  /** 패널 위치 */
  position?: 'left' | 'right';
  /** 기본 열림 상태 */
  defaultOpen?: boolean;
  
  /** 기능 토글 */
  features?: {
    structureView?: boolean;
    templateExtract?: boolean;
    cellSelection?: boolean;
    externalApi?: boolean;
    batchGenerate?: boolean;
    validation?: boolean;
  };
  
  /** 커스텀 프롬프트 */
  defaultPrompts?: string[];
  
  /** 헤더 커스터마이징 */
  headerTitle?: string;
  headerIcon?: ReactNode;
  
  /** 스타일 */
  style?: CSSProperties;
}

// ============================================
// 컨텍스트 메뉴 커스터마이징
// ============================================

export interface ContextMenuConfig {
  /** 컨텍스트 메뉴 활성화 */
  enabled?: boolean;
  
  /** 기본 메뉴 항목 표시 */
  items?: {
    edit?: boolean;
    copy?: boolean;
    paste?: boolean;
    addRow?: boolean;
    addColumn?: boolean;
    deleteRow?: boolean;
    deleteColumn?: boolean;
    aiGenerate?: boolean;
  };
  
  /** 커스텀 메뉴 항목 */
  customItems?: ContextMenuItem[];
  
  /** 스타일 */
  style?: CSSProperties;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string | ReactNode;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  onClick?: (target: HTMLElement) => void;
  children?: ContextMenuItem[];
}

// ============================================
// 검색 커스터마이징
// ============================================

export interface SearchConfig {
  /** 검색 활성화 */
  enabled?: boolean;
  /** 정규식 지원 */
  useRegex?: boolean;
  /** 대소문자 구분 */
  caseSensitive?: boolean;
  /** 하이라이트 색상 */
  highlightColor?: string;
  /** 현재 결과 색상 */
  currentHighlightColor?: string;
  /** 단축키 */
  shortcut?: string;
}

// ============================================
// 편집 커스터마이징
// ============================================

export interface EditConfig {
  /** 편집 활성화 */
  enabled?: boolean;
  /** 인라인 편집 */
  inlineEdit?: boolean;
  /** 테이블 편집 */
  tableEdit?: boolean;
  /** 자동저장 */
  autoSave?: {
    enabled?: boolean;
    interval?: number;
  };
  /** 히스토리 (Undo/Redo) */
  history?: {
    enabled?: boolean;
    maxSteps?: number;
  };
}

// ============================================
// 로딩 커스터마이징
// ============================================

export interface LoadingConfig {
  /** 로딩 오버레이 스타일 */
  overlayStyle?: CSSProperties;
  /** 커스텀 로딩 컴포넌트 */
  component?: ReactNode;
  /** 로딩 텍스트 */
  text?: string;
  /** 스피너 색상 */
  spinnerColor?: string;
}

// ============================================
// 에러 커스터마이징
// ============================================

export interface ErrorConfig {
  /** 커스텀 에러 컴포넌트 */
  component?: ReactNode;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error) => void;
  /** 재시도 버튼 텍스트 */
  retryText?: string;
  /** 새로고침 버튼 텍스트 */
  reloadText?: string;
}

// ============================================
// 전체 커스터마이징 옵션
// ============================================

export interface HanViewCustomization {
  /** 테마 */
  theme?: HanViewTheme | 'light' | 'dark' | 'auto';
  
  /** 레이아웃 */
  layout?: LayoutConfig;
  
  /** 툴바 */
  toolbar?: ToolbarConfig;
  
  /** AI 패널 */
  aiPanel?: AIPanelConfig;
  
  /** 컨텍스트 메뉴 */
  contextMenu?: ContextMenuConfig;
  
  /** 검색 */
  search?: SearchConfig;
  
  /** 편집 */
  edit?: EditConfig;
  
  /** 로딩 */
  loading?: LoadingConfig;
  
  /** 에러 */
  error?: ErrorConfig;
  
  /** 언어/로케일 */
  locale?: 'ko' | 'en' | 'ja' | 'zh';
  
  /** 커스텀 CSS 클래스 프리픽스 */
  classPrefix?: string;
}

// ============================================
// 이벤트 콜백 타입
// ============================================

export interface HanViewEvents {
  /** 문서 로드 */
  onDocumentLoad?: (document: unknown) => void;
  /** 문서 저장 */
  onDocumentSave?: (result: { success: boolean }) => void;
  /** 편집 시작 */
  onEditStart?: (element: HTMLElement) => void;
  /** 편집 종료 */
  onEditEnd?: (element: HTMLElement, content: string) => void;
  /** 변경 감지 */
  onChange?: (changes: unknown) => void;
  /** 페이지 변경 */
  onPageChange?: (pageNumber: number) => void;
  /** AI 응답 */
  onAIResponse?: (response: unknown) => void;
  /** 에러 */
  onError?: (error: Error) => void;
}

// ============================================
// 헬퍼 타입
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type HanViewConfig = DeepPartial<HanViewCustomization> & HanViewEvents;

