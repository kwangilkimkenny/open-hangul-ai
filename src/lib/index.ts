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
  HWPXMetadata
} from '../types/hwpx';

// ✅ 보안 — Invisible Watermark
export {
  embedWatermark,
  extractWatermark,
  hasWatermark,
  stripWatermark,
  encodePayload,
  applyWatermarkToDocument,
  extractWatermarkFromDocument,
} from './security/watermark';
export type { WatermarkPayload, WatermarkOptions } from './security/watermark';

// ✅ OCR — tesseract.js 래퍼 (lazy import)
export {
  recognize as ocrRecognize,
  recognizePdf as ocrRecognizePdf,
  concatResults as ocrConcatResults,
  terminate as ocrTerminate,
} from './ocr/ocr-service';
export type {
  OCRResult,
  OCRLanguage,
  OCROptions,
  OCRProgressEvent,
} from './ocr/ocr-service';

// ✅ 문서 Diff — 구조/서식 인식
export {
  diffDocuments,
  diffDocumentsStructural,
  flattenDocument,
  diffText as diffTextTokens,
  renderDiffHTML,
} from './diff/document-diff';
export type {
  DiffResult,
  DiffChange,
  StructuralDiffResult,
  StructuralDiffEntry,
  DiffBlock,
  TextTokenChange,
  StyleChange,
} from './diff/document-diff';

// ✅ RAG — LLM 입력용 구조화 추출
export {
  RAGExtractor,
  extractForRAG,
  toNDJSON as ragToNDJSON,
  toLangChainDocs,
} from './rag/rag-extractor';
export type {
  RAGDocument,
  RAGChunk,
  RAGExtractorOptions,
  LangChainDoc,
} from './rag/rag-extractor';

// ✅ UI 컴포넌트 — Diff / OCR
export { default as DiffViewer } from '../components/DiffViewer';
export { default as OCRDialog } from '../components/OCRDialog';

// ✅ Vertex AI — 장문 컨텍스트 초안 생성 (v5)
export { VertexClient, parseSSEEvent } from './ai/vertex-client';
export type { VertexRequest, VertexContent, VertexPart, VertexChunk, StreamOptions } from './ai/vertex-client';
export {
  estimateTokens,
  computeBudget,
  canConsume,
  remainingDaily,
  trimReferencesToFit,
  MODEL_LIMITS,
  DEFAULT_FREE_TIER_DAILY,
} from './ai/ai-quota';
export {
  DraftGenerator,
  createDraftGenerator,
} from './ai/draft-generator';
export type { GenerateOptions, GenerateResult } from './ai/draft-generator';
export {
  validateDraft,
  draftToHwpx,
  HWPX_DRAFT_SCHEMA,
  SYSTEM_INSTRUCTION,
  DRAFT_FUNCTION_DECLARATION,
} from './ai/hwpx-schema';
export type {
  DraftOutput,
  DraftSection,
  DraftElement,
  DraftHeading,
  DraftParagraph,
  DraftBulletList,
  DraftTable,
} from './ai/hwpx-schema';

// ✅ v5 UI — CommandPalette / ReferenceUploader / TokenBudgetBar
export { default as CommandPalette } from '../components/CommandPalette';
export type { CommandItem } from '../components/CommandPalette';
export { default as ReferenceUploader } from '../components/ReferenceUploader';
export { default as TokenBudgetBar } from '../components/TokenBudgetBar';
export { default as DraftAIModal } from '../components/DraftAIModal';
export { default as TemplateGallery } from '../components/TemplateGallery';

// ✅ v5 Templates
export {
  DRAFT_TEMPLATES,
  getTemplate,
  getTemplatesByCategory,
  buildPromptFromTemplate,
} from './ai/templates';
export type { DraftTemplate } from './ai/templates';

// ✅ v5 Hooks
export { useHotkeys, parseHotkey, matchHotkey } from '../hooks/useHotkeys';
export type { HotkeyMap, HotkeyOptions } from '../hooks/useHotkeys';
export { useDraftStream } from '../hooks/useDraftStream';
export type { DraftStreamState } from '../hooks/useDraftStream';

// ✅ v5 Store
export { useDraftStore } from '../stores/draftStore';

// ✅ 버전 정보
export const VERSION = '2.0.0';
export const BUILD_DATE = new Date().toISOString().split('T')[0];

