/**
 * HWPX Document Type Definitions
 * @version 2.0.0 (고도화)
 */

// =============================================
// Document Structure
// =============================================

export interface HWPXDocument {
  sections: HWPXSection[];
  images: Map<string, HWPXImageInfo>;
  metadata?: HWPXMetadata;
  rawHeaderXml?: string; // 원본 header.xml 저장 (export용)
}

export interface HWPXMetadata {
  title?: string;
  author?: string;
  createdAt?: string;
  modifiedAt?: string;
  version?: string;
}

export interface HWPXSection {
  id: string;
  pageSettings?: HWPXPageSettings;
  elements: HWPXElement[];
  headers?: HWPXHeaderFooter;
  footers?: HWPXHeaderFooter;
  pageNum?: HWPXPageNumber;
  colPr?: HWPXColumnProperties;
}

export interface HWPXPageSettings {
  width?: string;
  height?: string;
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
  orientation?: 'portrait' | 'landscape';
}

export interface HWPXHeaderFooter {
  both?: HWPXHeaderFooterContent;
  odd?: HWPXHeaderFooterContent;
  even?: HWPXHeaderFooterContent;
}

export interface HWPXHeaderFooterContent {
  elements: HWPXElement[];
  height?: number;
}

export interface HWPXPageNumber {
  pos: 'BOTTOM_CENTER' | 'BOTH_CENTER' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'TOP_CENTER' | 'TOP_LEFT' | 'TOP_RIGHT';
  formatType?: 'DIGIT' | 'LOWER_ROMAN' | 'UPPER_ROMAN' | 'LOWER_LETTER' | 'UPPER_LETTER';
  sideChar?: string;
}

export interface HWPXColumnProperties {
  colCount: number;
  gap?: number;
}

// =============================================
// Element Types
// =============================================

export type HWPXElement = 
  | HWPXParagraph 
  | HWPXTable 
  | HWPXImage 
  | HWPXShape 
  | HWPXContainer;

export interface HWPXBaseElement {
  type: string;
  id?: string;
  style?: Record<string, string | number>;
}

// Paragraph (고도화)
export interface HWPXParagraph extends HWPXBaseElement {
  type: 'paragraph';
  runs: HWPXRun[];
  alignment?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number | string;
  indent?: number;
  numbering?: HWPXNumbering;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  // 인라인 요소들
  images?: HWPXImage[];
  tables?: HWPXTable[];
  shapes?: HWPXShape[];
}

// Run (고도화)
export interface HWPXRun {
  text: string;
  style?: HWPXTextStyle;
  type?: 'text' | 'tab' | 'linebreak' | 'image' | 'table' | 'shape';
  // 탭 관련
  isTab?: boolean;
  widthPx?: number;
  leader?: number;
  // 인라인 요소 참조
  hasImage?: boolean;
  imageIndex?: number;
  hasTable?: boolean;
  tableIndex?: number;
  hasShape?: boolean;
  charPrIDRef?: string;
}

// Text Style (고도화)
export interface HWPXTextStyle {
  fontFamily?: string;
  fontSize?: number | string;
  fontSizePx?: string;
  fontWeight?: 'normal' | 'bold' | string;
  fontStyle?: 'normal' | 'italic' | string;
  color?: string;
  backgroundColor?: string;
  underline?: boolean;
  underlineType?: string;
  underlineColor?: string;
  strikethrough?: boolean;
  strikethroughColor?: string;
  verticalAlign?: 'baseline' | 'superscript' | 'subscript' | 'super' | 'sub' | string;
  // 추가 스타일
  outline?: boolean;
  textShadow?: boolean;
  textShadowValue?: string;
  letterSpacing?: string;
  scaleX?: number;
  bold?: boolean;
  italic?: boolean;
  id?: string;
  fontId?: string;
}

export interface HWPXNumbering {
  type?: string;
  level?: number;
  format?: string;
  prefix?: string;
  suffix?: string;
  id?: string;
  definition?: HWPXNumberingDefinition;
}

export interface HWPXNumberingDefinition {
  start?: number;
  levels: HWPXNumberingLevel[];
}

export interface HWPXNumberingLevel {
  level: number;
  format: string;
  numberFormat: string;
}

// Table (고도화)
export interface HWPXTable extends HWPXBaseElement {
  type: 'table';
  rows: HWPXTableRow[];
  width?: string | number;
  height?: string | number;
  borderStyle?: string;
  cellSpacing?: number;
  colWidths?: string[];
  colWidthsPercent?: string[];
  caption?: HWPXTableCaption;
  // parser runtime properties (set by _buildGridMap)
  gridMap?: any[][];
  colCount?: number;
  rowCount?: number;
}

export interface HWPXTableCaption {
  paragraphs: HWPXParagraph[];
  side: 'TOP' | 'BOTTOM';
}

export interface HWPXTableRow {
  cells: HWPXTableCell[];
  height?: string | number;
}

// Table Cell (고도화)
export interface HWPXTableCell {
  elements: HWPXElement[];
  colSpan?: number;
  rowSpan?: number;
  width?: string | number;
  widthPercent?: string;
  height?: string | number;
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: {
    binaryItemIDRef: string;
    mode: 'TOTAL' | 'TILE' | 'CENTER' | string;
  };
  borderTop?: HWPXBorder;
  borderBottom?: HWPXBorder;
  borderLeft?: HWPXBorder;
  borderRight?: HWPXBorder;
  slashDef?: HWPXDiagonal;
  backSlashDef?: HWPXDiagonal;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  padding?: string;
  opacity?: number;
  // parser runtime properties (set by _buildGridMap)
  logicalRow?: number;
  logicalCol?: number;
  isCovered?: boolean;
}

export interface HWPXBorder {
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted' | 'none' | string;
  color?: string;
  visible?: boolean;
}

export interface HWPXDiagonal {
  visible: boolean;
  color: string;
  width: number;
}

// Image (고도화)
export interface HWPXImage extends HWPXBaseElement {
  type: 'image';
  id?: string;
  src?: string;
  url?: string;
  binaryItemIDRef?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
  position?: 'inline' | 'absolute' | 'relative' | HWPXPosition;
  treatAsChar?: boolean;
  x?: number;
  y?: number;
}

export interface HWPXPosition {
  treatAsChar?: boolean;
  x?: number;
  y?: number;
  type?: string;
}

// Shape (고도화)
export interface HWPXShape extends HWPXBaseElement {
  type: 'shape';
  shapeType: 'rectangle' | 'ellipse' | 'line' | 'polygon' | 'textbox' | 'container' | string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  textStyle?: HWPXTextStyle;
  treatAsChar?: boolean;
  position?: HWPXPosition;
  rotation?: number;
  opacity?: number;
  borderRadius?: number;
  elements?: HWPXElement[];
  paragraphs?: HWPXParagraph[];
}

// Container
export interface HWPXContainer extends HWPXBaseElement {
  type: 'container';
  elements: HWPXElement[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  treatAsChar?: boolean;
}

// =============================================
// AI Related Types
// =============================================

export interface HeaderContentPair {
  header: string;
  content: string | null;
  path: {
    section: number;
    table: number;
    row: number;
    headerCell: number;
    contentCell: number;
  };
}

export interface AIGenerationResult {
  success: boolean;
  updatedDocument?: HWPXDocument;
  metadata?: {
    request: string;
    itemsUpdated: number;
    tokensUsed: number;
    processingTime: number;
  };
  error?: string;
}

export interface MultiPageAnalysis {
  totalPages: number;
  documentType: string;
  overallTheme: string;
  strategy: 'sequential' | 'semi-sequential' | 'parallel';
  pages: PageAnalysis[];
}

export interface PageAnalysis {
  pageNumber: number;
  type: string;
  role: string;
  itemCount: number;
}

// =============================================
// Store Types
// =============================================

export interface DocumentState {
  document: HWPXDocument | null;
  originalFile: File | null;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
}

export interface AIState {
  isProcessing: boolean;
  apiKey: string | null;
  customApiEnabled: boolean;
  customEndpoint: string | null;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface UIState {
  isPanelOpen: boolean;
  activeTab: string;
  theme: 'light' | 'dark';
  zoom: number;
}

// =============================================
// Event Types
// =============================================

export interface DocumentLoadEvent {
  document: HWPXDocument;
  fileName: string;
  fileSize: number;
}

export interface CellEditEvent {
  path: {
    section: number;
    table: number;
    row: number;
    cell: number;
  };
  oldValue: string;
  newValue: string;
}

