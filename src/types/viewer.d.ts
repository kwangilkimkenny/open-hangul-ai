/**
 * HWPX Viewer TypeScript Definitions
 * Vanilla JS Viewer의 TypeScript 인터페이스
 *
 * @module types/viewer
 * @version 1.0.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
// Note: Some `any` types and Function types are intentional for vanilla JS interop
import type { HWPXDocument } from './hwpx';

/**
 * HWPX Viewer 인스턴스 인터페이스
 */
export interface HWPXViewerInstance {
  // Container
  container: HTMLElement | Element;

  // Document Management
  loadFile(file: File): Promise<void>;
  getDocument(): HWPXDocument | null;

  // Save & Export
  saveFile?(filename?: string): Promise<{
    success: boolean;
    filename?: string;
    blob?: Blob;
    error?: string;
  }>;

  exportToPDF?(): Promise<{
    success: boolean;
    blob?: Blob;
    error?: string;
  }>;

  // Rendering
  render?(document: HWPXDocument): Promise<void>;
  rerender?(): Promise<void>;
  renderer?: {
    totalPages: number;
    currentPage?: number;
  };

  // History (Undo/Redo)
  historyManager?: any;
  undo?(): void;
  redo?(): void;
  canUndo?(): boolean;
  canRedo?(): boolean;

  // Search (Advanced Search instance)
  search?: AdvancedSearch;
  clearSearch?(): void;

  // Editing
  enableEditMode?(): void;
  disableEditMode?(): void;
  isEditMode?(): boolean;

  // Selection
  getSelection?(): Selection | null;
  clearSelection?(): void;

  // Position & Range
  getPositionManager?(): PositionManager | null;
  getRangeManager?(): RangeManager | null;

  // Table Editing
  getTableEditor?(): TableEditor | null;

  // AI Features
  getAIController?(): AIController | null;

  // Auto Save
  enableAutoSave?(interval?: number): void;
  disableAutoSave?(): void;

  // Print
  printDocument?(): void;

  // Lifecycle
  destroy(): void;

  // Events
  on?(event: string, callback: (...args: any[]) => void): void;
  off?(event: string, callback: (...args: any[]) => void): void;
  emit?(event: string, ...args: any[]): void;
}

/**
 * Search Options
 */
export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

/**
 * Search Result
 */
export interface SearchResult {
  text: string;
  index: number;
  element: HTMLElement;
}

/**
 * Position Manager Interface
 */
export interface PositionManager {
  getPositionByXY(x: number, y: number): Position | null;
  getPositionByIndex(index: number): Position | null;
  isPositionReady(): boolean;
}

/**
 * Position
 */
export interface Position {
  index: number;
  element: HTMLElement;
  offset: number;
  x: number;
  y: number;
}

/**
 * Range Manager Interface
 */
export interface RangeManager {
  setRange(startIndex: number, endIndex: number): void;
  getRange(): Range;
  clearRange(): void;
  enableSelection(): void;
  disableSelection(): void;
  destroy(): void;
}

/**
 * Range
 */
export interface Range {
  startIndex: number;
  endIndex: number;
  isCollapsed: boolean;
}

/**
 * Table Editor Interface
 */
export interface TableEditor {
  addRowAbove(cell: HTMLElement): Promise<void>;
  addRowBelow(cell: HTMLElement): Promise<void>;
  deleteRow(cell: HTMLElement): Promise<void>;
  addColumnLeft(cell: HTMLElement): Promise<void>;
  addColumnRight(cell: HTMLElement): Promise<void>;
  deleteColumn(cell: HTMLElement): Promise<void>;
}

/**
 * AI Controller Interface
 */
export interface AIController {
  setApiKey(apiKey: string): void;
  hasApiKey(): boolean;
  handleUserRequest(request: string): Promise<void>;
  extractStructure(): any;
  isProcessing(): boolean;
}

/**
 * Advanced Search Interface
 */
export interface AdvancedSearch {
  search(query: string, container: HTMLElement, options?: SearchOptions): SearchResult[];
  next(): void;
  previous(): void;
  clearHighlights(): void;
  getCurrentIndex(): number;
  getTotalResults(): number;
}

/**
 * Selection (native browser Selection API)
 */
export interface Selection {
  rangeCount: number;
  getRangeAt(index: number): any;
  removeAllRanges(): void;
  addRange(range: any): void;
  toString(): string;
}

/**
 * Viewer Options
 */
export interface ViewerOptions {
  container?: HTMLElement | string;
  enableAI?: boolean;
  useWorker?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
  onLoad?: (document: HWPXDocument) => void | Function;
  onError?: (error: Error) => void | Function;
  onSave?: (filename: string) => void;
  parserOptions?: any;
  [key: string]: any;
}

/**
 * Viewer Constructor Type
 */
export interface HWPXViewerConstructor {
  new (options: ViewerOptions): HWPXViewerInstance;
}

/**
 * Default export: Viewer 인스턴스 타입
 */
export type HWPXViewer = HWPXViewerInstance;
