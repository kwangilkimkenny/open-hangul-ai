/**
 * HAN-View React Library
 * NPM 패키지 진입점
 * 
 * @version 2.0.0
 * @license Commercial
 */

// ✅ JSZip 자동 로드 (HWPX 파일 처리에 필수)
import JSZip from 'jszip';
if (typeof window !== 'undefined' && !window.JSZip) {
  (window as any).JSZip = JSZip;
}

// ✅ 통합 앱 컴포넌트 (권장 - 완성된 UI)
export { HanViewApp, default as HanViewAppDefault } from '../components/HanViewApp';
export type { HanViewAppProps, HeaderButton } from '../components/HanViewApp';

// ✅ 개별 컴포넌트 (커스터마이징용)
export { HWPXViewerWrapper as HWPXViewer } from '../components/HWPXViewerWrapper';
export { default as HWPXViewerWrapper } from '../components/HWPXViewerWrapper';

// ✅ 에러 바운더리
export { default as ErrorBoundary } from '../components/ErrorBoundary';

// ✅ 헤더 컴포넌트
export { default as SimpleHeader } from '../components/SimpleHeader';

// ✅ 커스터마이징 Context & Hooks
export {
  HanViewProvider,
  useHanView,
  useHanViewConfig,
  useHanViewTheme,
  useHanViewToolbar,
  useHanViewAIPanel,
} from '../contexts/HanViewContext';

// ✅ 커스터마이징 타입
export type {
  HanViewConfig,
  HanViewCustomization,
  HanViewTheme,
  ThemeVariables,
  LayoutConfig,
  ToolbarConfig,
  ToolbarButton,
  AIPanelConfig,
  ContextMenuConfig,
  ContextMenuItem,
  SearchConfig,
  EditConfig,
  LoadingConfig,
  ErrorConfig,
  HanViewEvents,
} from '../types/customization';

// ✅ Vanilla JS 코어 모듈 (고급 사용자용)
export { default as HWPXViewerCore } from './vanilla/viewer.js';
export { SimpleHWPXParser } from './vanilla/core/parser.js';
export { DocumentRenderer } from './vanilla/core/renderer.js';
export { HWPXConstants } from './vanilla/core/constants.js';

// ✅ AI 모듈
export { AIDocumentController } from './vanilla/ai/ai-controller.js';
export { DocumentStructureExtractor } from './vanilla/ai/structure-extractor.js';

// ✅ 유틸리티
export { getLogger } from './vanilla/utils/logger.js';
export { HWPXError, ErrorType } from './vanilla/utils/error.js';
export { formatFileSize, formatDate } from './vanilla/utils/format.js';

// ✅ 기능 모듈
export { InlineEditor } from './vanilla/features/inline-editor.js';
export { TableEditor } from './vanilla/features/table-editor.js';
export { AdvancedSearch } from './vanilla/features/advanced-search.js';
export { BookmarkManager } from './vanilla/features/bookmark-manager.js';
export { AutoSaveManager } from './vanilla/features/autosave-manager.js';
// HistoryManager v1은 deprecated - v2 사용 권장 (2026-01-09)
// export { HistoryManager } from './vanilla/features/history-manager.js';
export { HistoryManagerV2 as HistoryManager } from './vanilla/features/history-manager-v2.js';

// ✅ UI 모듈
export { ChatPanel } from './vanilla/ui/chat-panel.js';
export { ContextMenu } from './vanilla/ui/context-menu.js';
export { ThemeManager } from './vanilla/ui/theme-manager.js';

// ✅ 내보내기 모듈
export { HwpxSafeExporter } from './vanilla/export/hwpx-safe-exporter.js';
export { HwpxExporter } from './vanilla/export/hwpx-exporter.js';

// ✅ 타입 재export
export type {
  HWPXDocument,
  HWPXSection,
  HWPXElement,
  HWPXParagraph,
  HWPXTable,
  HWPXTableRow,
  HWPXTableCell,
  HWPXImage,
  HWPXShape,
  HWPXRun,
  HWPXImageInfo,
  HWPXMetadata
} from '../types/hwpx';

// ✅ 버전 정보
export const VERSION = '2.0.0';
export const BUILD_DATE = new Date().toISOString().split('T')[0];

