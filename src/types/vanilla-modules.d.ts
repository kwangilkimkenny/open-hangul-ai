/**
 * Type declarations for Vanilla JavaScript modules
 * These modules are written in plain JavaScript and don't have TypeScript definitions
 */

// Vanilla viewer and core modules
declare module '../lib/vanilla/viewer.js' {
  export default class HWPXViewer {
    constructor(container: HTMLElement, options?: any);
    loadFile(file: File): Promise<void>;
    saveFile(): Promise<any>;
    getDocument(): any;
    historyManager?: any;
    printDocument?(): void;
    getAIController?(): any;
    container: HTMLElement;
    [key: string]: any;
  }
}

declare module '../lib/vanilla/core/parser.js' {
  export class HWPXParser {
    constructor(options?: any);
    parse(file: File): Promise<any>;
    [key: string]: any;
  }
}

declare module '../lib/vanilla/core/renderer.js' {
  export class DocumentRenderer {
    constructor(container: HTMLElement, options?: any);
    render(document: any): void;
    [key: string]: any;
  }
}

declare module '../lib/vanilla/core/constants.js' {
  export const CONSTANTS: any;
  export const DEFAULT_OPTIONS: any;
}

// AI modules
declare module '../lib/vanilla/ai/ai-controller.js' {
  export class AIController {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module '../lib/vanilla/ai/structure-extractor.js' {
  export class StructureExtractor {
    constructor(options?: any);
    extract(document: any): Promise<any>;
    [key: string]: any;
  }
}

// Utils modules
declare module '../lib/utils/logger' {
  export function devLog(...args: any[]): void;
  export function devWarn(...args: any[]): void;
  export function devError(...args: any[]): void;
  export function getLogger(): any;
  export const logger: any;
}

declare module '../lib/vanilla/utils/logger.js' {
  export function devLog(...args: any[]): void;
  export function devWarn(...args: any[]): void;
  export function devError(...args: any[]): void;
  export function getLogger(): any;
  export const logger: any;
}

// Module paths used in lib/index.ts
declare module './vanilla/viewer.js' {
  export default class HWPXViewer {
    constructor(container: HTMLElement, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/core/parser.js' {
  export class SimpleHWPXParser {
    constructor(options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/core/renderer.js' {
  export class DocumentRenderer {
    constructor(container: HTMLElement, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/core/constants.js' {
  export const HWPXConstants: any;
}

declare module './vanilla/ai/ai-controller.js' {
  export class AIDocumentController {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/ai/structure-extractor.js' {
  export class DocumentStructureExtractor {
    constructor(options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/utils/logger.js' {
  export function getLogger(): any;
}

declare module './vanilla/utils/error.js' {
  export class HWPXError extends Error {}
  export const ErrorType: any;
}

declare module './vanilla/utils/format.js' {
  export function formatFileSize(bytes: number): string;
  export function formatDate(date: Date): string;
}

declare module './vanilla/features/inline-editor.js' {
  export class InlineEditor {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/features/table-editor.js' {
  export class TableEditor {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/features/advanced-search.js' {
  export class AdvancedSearch {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/features/bookmark-manager.js' {
  export class BookmarkManager {
    constructor(viewer: any);
    [key: string]: any;
  }
}

declare module './vanilla/features/autosave-manager.js' {
  export class AutoSaveManager {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/features/history-manager-v2.js' {
  export class HistoryManagerV2 {
    constructor(options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/ui/chat-panel.js' {
  export class ChatPanel {
    constructor(container: HTMLElement, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/ui/context-menu.js' {
  export class ContextMenu {
    constructor(container: HTMLElement, options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/ui/theme-manager.js' {
  export class ThemeManager {
    constructor(options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/export/hwpx-safe-exporter.js' {
  export class HwpxSafeExporter {
    constructor(options?: any);
    [key: string]: any;
  }
}

declare module './vanilla/export/hwpx-exporter.js' {
  export class HwpxExporter {
    constructor(options?: any);
    exportToFile(document: any, filename?: string): Promise<{ filename: string; blob: Blob; method?: string }>;
    [key: string]: any;
  }
}

declare module '../lib/vanilla/utils/error.js' {
  export class HWPXError extends Error {
    constructor(message: string, code?: string);
  }
  export function handleError(error: Error): void;
}

declare module '../lib/vanilla/utils/format.js' {
  export function formatDate(date: Date): string;
  export function formatSize(bytes: number): string;
}

// Feature modules
declare module '../lib/vanilla/features/inline-editor.js' {
  export class InlineEditor {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module '../lib/vanilla/features/table-editor.js' {
  export class TableEditor {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module '../lib/vanilla/features/advanced-search.js' {
  export class AdvancedSearch {
    constructor(viewer: any, options?: any);
    search(query: string, options?: any): any[];
    next(): void;
    previous(): void;
    clearHighlights(): void;
    [key: string]: any;
  }
}

declare module '../lib/vanilla/features/bookmark-manager.js' {
  export class BookmarkManager {
    constructor(viewer: any);
    [key: string]: any;
  }
}

declare module '../lib/vanilla/features/autosave-manager.js' {
  export class AutoSaveManager {
    constructor(viewer: any, options?: any);
    [key: string]: any;
  }
}

declare module '../lib/vanilla/features/history-manager-v2.js' {
  export class HistoryManagerV2 {
    constructor(options?: any);
    execute(executeFn: Function, undoFn: Function, description: string): void;
    undo(): boolean;
    redo(): boolean;
    undoMultiple(count: number): number;
    redoMultiple(count: number): number;
    getStats(): any;
    getHistory(): any;
    [key: string]: any;
  }
  export default HistoryManagerV2;
}

// UI modules
declare module '../lib/vanilla/ui/chat-panel.js' {
  export class ChatPanel {
    constructor(container: HTMLElement, options?: any);
    [key: string]: any;
  }
}

declare module '../lib/vanilla/ui/context-menu.js' {
  export class ContextMenu {
    constructor(container: HTMLElement, options?: any);
    [key: string]: any;
  }
}

declare module '../lib/vanilla/ui/theme-manager.js' {
  export class ThemeManager {
    constructor(options?: any);
    [key: string]: any;
  }
}

// Export modules
declare module '../lib/export/hwpx-exporter' {
  export class HWPXExporter {
    constructor(options?: any);
    export(document: any): Promise<Blob>;
    [key: string]: any;
  }
}

declare module '../lib/export/pdf-exporter' {
  export class PDFExporter {
    constructor(options?: any);
    export(document: any): Promise<Blob>;
    [key: string]: any;
  }
}

declare module '../../lib/export/hwpx-exporter' {
  export class HWPXExporter {
    constructor(options?: any);
    export(document: any): Promise<Blob>;
    [key: string]: any;
  }
}

// Additional path for HWPX exporter
declare module '../lib/export/hwpx-exporter' {
  export class HWPXExporter {
    constructor(options?: any);
    export(document: any): Promise<Blob>;
    [key: string]: any;
  }
}

declare module '../../lib/export/pdf-exporter' {
  export class PDFExporter {
    constructor(options?: any);
    export(document: any): Promise<Blob>;
    [key: string]: any;
  }
}

// Additional path for PDF exporter
declare module '../lib/export/pdf-exporter' {
  export class PDFExporter {
    constructor(options?: any);
    export(document: any): Promise<Blob>;
    [key: string]: any;
  }
}

declare module '../../lib/core/parser' {
  export class HWPXParser {
    constructor(options?: any);
    parse(file: File): Promise<any>;
    [key: string]: any;
  }
}

// Additional path for parser
declare module '../lib/core/parser' {
  export class HWPXParser {
    constructor(options?: any);
    parse(file: File): Promise<any>;
    [key: string]: any;
  }
}

declare module '../lib/vanilla/export/hwpx-safe-exporter.js' {
  export class HWPXSafeExporter {
    constructor(options?: any);
    export(document: any): Promise<Blob>;
    [key: string]: any;
  }
}

declare module '../lib/vanilla/export/hwpx-exporter.js' {
  export class HWPXExporter {
    constructor(options?: any);
    export(document: any): Promise<Blob>;
    exportToFile(document: any, filename?: string): Promise<{ filename: string; blob: Blob; method?: string }>;
    [key: string]: any;
  }
}

// Additional logger paths (most common import error)
declare module '../lib/utils/logger' {
  export function devLog(...args: any[]): void;
  export function devWarn(...args: any[]): void;
  export function devError(...args: any[]): void;
  export function getLogger(): any;
  export const logger: any;
}

declare module '../../lib/utils/logger' {
  export function devLog(...args: any[]): void;
  export function devWarn(...args: any[]): void;
  export function devError(...args: any[]): void;
  export function getLogger(): any;
  export const logger: any;
}

declare module '../utils/logger' {
  export function devLog(...args: any[]): void;
  export function devWarn(...args: any[]): void;
  export function devError(...args: any[]): void;
  export function getLogger(): any;
  export const logger: any;
}

declare module 'src/lib/utils/logger' {
  export function devLog(...args: any[]): void;
  export function devWarn(...args: any[]): void;
  export function devError(...args: any[]): void;
  export function getLogger(): any;
  export const logger: any;
}

// Global JSZip
interface Window {
  JSZip?: any;
}
