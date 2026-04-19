# API 문서

오픈한글AI(`open-hangul-ai`)의 완전한 API 문서입니다.

## 📋 목차

1. [컴포넌트](#컴포넌트)
2. [훅(Hooks)](#훅-hooks)
3. [유틸리티](#유틸리티)
4. [타입 정의](#타입-정의)
5. [AI 모듈](#ai-모듈)
6. [보안 모듈](#보안-모듈)

## 컴포넌트

### HanViewApp

완전한 문서 편집기 애플리케이션 컴포넌트입니다.

```tsx
interface HanViewAppProps {
  config?: HanViewConfig;
  headerButtons?: HeaderButton[];
  onFileLoad?: (file: File) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

function HanViewApp(props: HanViewAppProps): JSX.Element;
```

#### Props

| 이름 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `config` | `HanViewConfig` | `{}` | 전체 앱 설정 |
| `headerButtons` | `HeaderButton[]` | `[]` | 헤더에 표시할 커스텀 버튼들 |
| `onFileLoad` | `(file: File) => void` | - | 파일 로드 완료 콜백 |
| `onError` | `(error: Error) => void` | - | 에러 발생 콜백 |
| `className` | `string` | - | CSS 클래스명 |
| `style` | `React.CSSProperties` | - | 인라인 스타일 |

#### 예제

```tsx
<HanViewApp
  config={{
    theme: 'dark',
    toolbar: { enabled: true },
    aiPanel: { enabled: true }
  }}
  headerButtons={[
    {
      label: '저장',
      icon: '💾',
      onClick: () => saveDocument()
    }
  ]}
  onFileLoad={(file) => console.log('Loaded:', file.name)}
  onError={(error) => console.error(error)}
/>
```

### HWPXViewer

HWPX 파일 전용 뷰어 컴포넌트입니다.

```tsx
interface HWPXViewerProps {
  fileUrl?: string;
  file?: File;
  width?: string | number;
  height?: string | number;
  config?: Partial<HanViewConfig>;
  onLoad?: (document: HWPXDocument) => void;
  onError?: (error: Error) => void;
  onPageChange?: (pageNumber: number) => void;
  onTextSelect?: (selectedText: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

function HWPXViewer(props: HWPXViewerProps): JSX.Element;
```

#### Props

| 이름 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `fileUrl` | `string` | - | 파일 URL (file과 함께 사용할 수 없음) |
| `file` | `File` | - | File 객체 (fileUrl과 함께 사용할 수 없음) |
| `width` | `string \| number` | `'100%'` | 뷰어 너비 |
| `height` | `string \| number` | `'600px'` | 뷰어 높이 |
| `config` | `Partial<HanViewConfig>` | `{}` | 뷰어 설정 |
| `onLoad` | `(document: HWPXDocument) => void` | - | 문서 로드 완료 콜백 |
| `onError` | `(error: Error) => void` | - | 에러 발생 콜백 |
| `onPageChange` | `(pageNumber: number) => void` | - | 페이지 변경 콜백 |
| `onTextSelect` | `(selectedText: string) => void` | - | 텍스트 선택 콜백 |

### HanViewProvider

Context를 통한 전역 상태 관리 Provider입니다.

```tsx
interface HanViewProviderProps {
  config: HanViewConfig;
  children: React.ReactNode;
}

function HanViewProvider(props: HanViewProviderProps): JSX.Element;
```

### ErrorBoundary

React 에러 경계 컴포넌트입니다.

```tsx
interface ErrorBoundaryProps {
  fallback?: React.ComponentType<{ error: Error }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  children: React.ReactNode;
}

function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element;
```

### SimpleHeader

간단한 헤더 컴포넌트입니다.

```tsx
interface SimpleHeaderProps {
  title?: string;
  buttons?: HeaderButton[];
  className?: string;
  style?: React.CSSProperties;
}

function SimpleHeader(props: SimpleHeaderProps): JSX.Element;
```

## 훅 (Hooks)

### useHanView

HanView Context에 접근하는 메인 훅입니다.

```tsx
interface HanViewContextType {
  currentFile: File | null;
  setFile: (file: File | null) => void;
  isLoading: boolean;
  error: Error | null;
  clearError: () => void;
}

function useHanView(): HanViewContextType;
```

### useHanViewConfig

설정 관련 훅입니다.

```tsx
interface HanViewConfigHook {
  config: HanViewConfig;
  updateConfig: (config: Partial<HanViewConfig>) => void;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

function useHanViewConfig(): HanViewConfigHook;
```

### useHanViewTheme

테마 관리 전용 훅입니다.

```tsx
interface ThemeHook {
  theme: HanViewTheme;
  setTheme: (theme: Partial<HanViewTheme>) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

function useHanViewTheme(): ThemeHook;
```

### useHanViewToolbar

툴바 관리 훅입니다.

```tsx
interface ToolbarHook {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  buttons: ToolbarButton[];
  addButton: (button: ToolbarButton) => void;
  removeButton: (id: string) => void;
}

function useHanViewToolbar(): ToolbarHook;
```

### useHanViewAIPanel

AI 패널 관리 훅입니다.

```tsx
interface AIPanelHook {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  currentProvider: string;
  setProvider: (provider: string) => void;
  isProcessing: boolean;
}

function useHanViewAIPanel(): AIPanelHook;
```

### useHotkeys

핫키 관리 훅입니다.

```tsx
interface HotkeyOptions {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
}

type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

function useHotkeys(
  hotkeys: HotkeyMap, 
  options?: HotkeyOptions
): void;
```

#### 예제

```tsx
useHotkeys({
  'ctrl+s': () => saveDocument(),
  'ctrl+z': () => undo(),
  'ctrl+shift+z': () => redo(),
}, {
  preventDefault: true
});
```

### useDraftStream

AI 문서 생성 스트림 훅입니다.

```tsx
interface DraftStreamState {
  isStreaming: boolean;
  content: string;
  error: string | null;
  progress: number;
}

function useDraftStream(): {
  state: DraftStreamState;
  startStream: (prompt: string, options?: GenerateOptions) => void;
  stopStream: () => void;
  clearContent: () => void;
};
```

## 유틸리티

### HWPXViewerCore

Vanilla JS 코어 뷰어 클래스입니다.

```tsx
class HWPXViewerCore {
  constructor(container: HTMLElement, options?: ViewerOptions);
  
  loadFile(file: File | string): Promise<void>;
  destroy(): void;
  getCurrentPage(): number;
  setPage(pageNumber: number): void;
  zoom(level: number): void;
  search(query: string): SearchResult[];
}
```

### SimpleHWPXParser

HWPX 파일 파서입니다.

```tsx
class SimpleHWPXParser {
  static parse(file: File): Promise<HWPXDocument>;
  static parseFromBuffer(buffer: ArrayBuffer): Promise<HWPXDocument>;
}
```

### DocumentRenderer

문서 렌더러입니다.

```tsx
class DocumentRenderer {
  constructor(container: HTMLElement);
  
  render(document: HWPXDocument): void;
  setTheme(theme: HanViewTheme): void;
  destroy(): void;
}
```

### 포맷팅 유틸리티

```tsx
function formatFileSize(bytes: number): string;
function formatDate(date: Date): string;
```

### 로거

```tsx
interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
}

function getLogger(category?: string): Logger;
```

### 에러 처리

```tsx
enum ErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_FORMAT = 'INVALID_FORMAT',
  PARSE_ERROR = 'PARSE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

class HWPXError extends Error {
  constructor(
    message: string, 
    public type: ErrorType, 
    public originalError?: Error
  );
}
```

## 타입 정의

### HanViewConfig

```tsx
interface HanViewConfig {
  theme?: ThemeType | HanViewTheme;
  layout?: LayoutConfig;
  toolbar?: ToolbarConfig;
  aiPanel?: AIPanelConfig;
  contextMenu?: ContextMenuConfig;
  search?: SearchConfig;
  edit?: EditConfig;
  loading?: LoadingConfig;
  error?: ErrorConfig;
  events?: HanViewEvents;
}

type ThemeType = 'light' | 'dark' | 'auto';
```

### HanViewTheme

```tsx
interface HanViewTheme {
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
}

interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  light: string;
  dark: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
}
```

### ToolbarConfig

```tsx
interface ToolbarConfig {
  enabled: boolean;
  position: 'top' | 'bottom';
  buttons: ToolbarButtonType[];
  customButtons?: ToolbarButton[];
}

type ToolbarButtonType = 
  | 'file-open' | 'save' | 'export' 
  | 'undo' | 'redo' 
  | 'bold' | 'italic' | 'underline'
  | 'ai-assistant' | 'comments' | 'share'
  | 'separator';

interface ToolbarButton {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  position?: 'left' | 'right';
  disabled?: boolean;
}
```

### AIPanelConfig

```tsx
interface AIPanelConfig {
  enabled: boolean;
  position: 'left' | 'right';
  width?: number;
  defaultProvider?: string;
  providers?: AIProvider[];
}

interface AIProvider {
  name: string;
  label: string;
  apiKey?: string;
  endpoint?: string;
}
```

### HeaderButton

```tsx
interface HeaderButton {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}
```

### HWPX 문서 타입

```tsx
interface HWPXDocument {
  metadata: HWPXMetadata;
  sections: HWPXSection[];
}

interface HWPXMetadata {
  title?: string;
  author?: string;
  subject?: string;
  created?: Date;
  modified?: Date;
}

interface HWPXSection {
  id: string;
  elements: HWPXElement[];
}

interface HWPXElement {
  type: 'paragraph' | 'table' | 'image' | 'shape';
  content?: any;
}

interface HWPXParagraph extends HWPXElement {
  type: 'paragraph';
  runs: HWPXRun[];
}

interface HWPXRun {
  text: string;
  style?: TextStyle;
}

interface HWPXTable extends HWPXElement {
  type: 'table';
  rows: HWPXTableRow[];
}

interface HWPXTableRow {
  cells: HWPXTableCell[];
}

interface HWPXTableCell {
  content: HWPXElement[];
  colspan?: number;
  rowspan?: number;
}
```

## AI 모듈

### VertexClient

Google Vertex AI 클라이언트입니다.

```tsx
interface VertexRequest {
  model: string;
  contents: VertexContent[];
  stream?: boolean;
}

interface VertexContent {
  role: 'user' | 'model';
  parts: VertexPart[];
}

interface VertexPart {
  text?: string;
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
}

class VertexClient {
  constructor(options: {
    projectId: string;
    location: string;
    apiKey: string;
  });
  
  generateContent(request: VertexRequest): Promise<string>;
  streamContent(request: VertexRequest): AsyncIterable<VertexChunk>;
}
```

### DraftGenerator

AI 문서 생성기입니다.

```tsx
interface GenerateOptions {
  template?: DraftTemplate;
  references?: File[];
  language?: string;
  tone?: 'formal' | 'casual' | 'technical';
  length?: 'short' | 'medium' | 'long';
}

interface GenerateResult {
  content: string;
  metadata: {
    wordCount: number;
    sections: number;
    confidence: number;
  };
}

class DraftGenerator {
  constructor(client: VertexClient);
  
  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
  generateStream(prompt: string, options?: GenerateOptions): AsyncIterable<string>;
}

function createDraftGenerator(options: {
  provider: 'vertex' | 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}): DraftGenerator;
```

### AI 할당량 관리

```tsx
interface ModelLimits {
  tokensPerMinute: number;
  tokensPerDay: number;
  requestsPerMinute: number;
}

const MODEL_LIMITS: Record<string, ModelLimits>;
const DEFAULT_FREE_TIER_DAILY: number;

function estimateTokens(text: string): number;
function computeBudget(requests: any[]): number;
function canConsume(tokens: number, model: string): boolean;
function remainingDaily(used: number): number;
function trimReferencesToFit(references: File[], maxTokens: number): File[];
```

## 보안 모듈

### 워터마크

```tsx
interface WatermarkPayload {
  userId: string;
  timestamp: number;
  documentId?: string;
  metadata?: Record<string, any>;
}

interface WatermarkOptions {
  strength: number;
  redundancy: number;
  algorithm: 'lsb' | 'dct' | 'dwt';
}

function embedWatermark(
  document: HWPXDocument, 
  payload: WatermarkPayload, 
  options?: WatermarkOptions
): Promise<HWPXDocument>;

function extractWatermark(
  document: HWPXDocument
): Promise<WatermarkPayload | null>;

function hasWatermark(document: HWPXDocument): Promise<boolean>;

function stripWatermark(document: HWPXDocument): Promise<HWPXDocument>;
```

### OCR 서비스

```tsx
type OCRLanguage = 'eng' | 'kor' | 'jpn' | 'chi_sim' | 'chi_tra';

interface OCROptions {
  language: OCRLanguage | OCRLanguage[];
  psm?: number;
  oem?: number;
}

interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
}

interface OCRProgressEvent {
  status: string;
  progress: number;
}

function recognize(
  image: File | string, 
  options?: OCROptions
): Promise<OCRResult>;

function recognizePdf(
  pdf: File, 
  options?: OCROptions
): Promise<OCRResult[]>;

function concatResults(results: OCRResult[]): OCRResult;

function terminate(): Promise<void>;
```

### 문서 Diff

```tsx
interface DiffResult {
  added: DiffChange[];
  removed: DiffChange[];
  modified: DiffChange[];
}

interface DiffChange {
  type: 'text' | 'style' | 'structure';
  path: string;
  oldValue: any;
  newValue: any;
  confidence: number;
}

function diffDocuments(
  docA: HWPXDocument, 
  docB: HWPXDocument
): Promise<DiffResult>;

function diffDocumentsStructural(
  docA: HWPXDocument, 
  docB: HWPXDocument
): Promise<StructuralDiffResult>;

function renderDiffHTML(diff: DiffResult): string;
```

## 상수

```tsx
export const VERSION: string;
export const BUILD_DATE: string;
```

## 예제

### 기본 사용

```tsx
import React from 'react';
import { HanViewApp } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function App() {
  return (
    <HanViewApp
      config={{
        theme: 'light',
        toolbar: { enabled: true },
        aiPanel: { enabled: true }
      }}
    />
  );
}
```

### 고급 사용

```tsx
import React from 'react';
import {
  HanViewProvider,
  useHanView,
  HWPXViewer,
  AIDocumentController
} from 'open-hangul-ai';

function DocumentAnalyzer() {
  const { currentFile } = useHanView();
  
  const analyzeWithAI = async () => {
    if (!currentFile) return;
    
    const ai = new AIDocumentController({
      provider: 'openai',
      apiKey: process.env.REACT_APP_OPENAI_KEY
    });
    
    const analysis = await ai.analyze(currentFile);
    console.log(analysis);
  };

  return (
    <div>
      <button onClick={analyzeWithAI}>
        AI 분석
      </button>
      <HWPXViewer />
    </div>
  );
}

function App() {
  return (
    <HanViewProvider config={{ theme: 'dark' }}>
      <DocumentAnalyzer />
    </HanViewProvider>
  );
}
```

---

더 자세한 정보는 [사용 가이드](./USAGE_GUIDE.md)를 참조하세요.