/**
 * hwplib-js - HWP File Parser
 */

// Utilities
export { logger, setLogLevel, enableDebugMode, enableProductionMode, disableLogging, LogLevel } from './utils/Logger';
export type { ILogger } from './utils/Logger';
export * from './utils/Constants';

export { OLEParser } from './parser/OLEParser';
export type { OLEHeader, DirectoryEntry } from './parser/OLEParser';

export { HWPParser, parseHWPFile } from './parser/HWPParser';
export { HWPFile } from './models/HWPFile';
export type { HWPFileHeader, HWPDocInfo, HWPSection, HWPParagraph } from './models/HWPFile';

export { HWPTextExtractor, extractHWPText } from './parser/HWPTextExtractor';
export type { HWPSection as ExtractedSection, HWPParagraph as ExtractedParagraph } from './parser/HWPTextExtractor';
export { SummaryInfoParser } from './parser/SummaryInfoParser';
export type { SummaryInfo } from './models/HWPFile';

// DocInfo Parser
export { DocInfoParser } from './parser/DocInfoParser';
export type {
  DocInfo,
  FaceName,
  BorderFill,
  CharShape,
  ParaShape,
  Style,
  TabDef,
  Numbering
} from './models/DocInfo';
export { HWPTag, CharShapeAttribute } from './models/DocInfo';

// Table Parser
export { TableParser } from './parser/TableParser';
export type { Table, TableRow, TableCell, CellParagraph, TableCaption } from './models/Table';

// BinData Parser
export { BinDataParser } from './parser/BinDataParser';
export type { BinData, BinDataType, CompressionType, ImageFormat } from './models/BinData';
export { identifyImageFormat, getExtensionFromName, getExtensionFromFormat } from './models/BinData';

// Picture Parser
export { PictureParser } from './parser/PictureParser';
export type { Picture, ShapeComponent, ShapeComponentPicture } from './models/Picture';
export { WrapType, AnchorType } from './models/Picture';

// Shape Parser
export { ShapeParser } from './parser/ShapeParser';
export type { Shape, ShapeLine, ShapeRectangle, ShapeEllipse, ShapePolygon, ShapeCurve, ShapeConnector, ShapeTextArt, TextArtFontStyle, Point } from './models/Shape';
export { ShapeTagID, LineStyle, FillType, ArrowType, ArcType, ConnectorType, TextArtShapeType, TextArtAlign } from './models/Shape';

// HeaderFooter Parser
export { HeaderFooterParser } from './parser/HeaderFooterParser';
export type { Header, Footer, Footnote, Endnote, HeaderParagraph, FootnoteParagraph, HeaderField } from './models/HeaderFooter';
export { HeaderFooterType, PageApplication, NumberingType, LineType, FieldType, TextAlignment, HeaderFooterTagID, formatPageNumber } from './models/HeaderFooter';

// Advanced Parser
export { AdvancedParser } from './parser/AdvancedParser';
export type { Hyperlink, Bookmark, Field, TextBox, FieldData } from './models/Advanced';
export { HyperlinkType, HyperlinkTarget, AdvancedTagID, isValidUrl, isValidEmail, isValidBookmarkName } from './models/Advanced';

// Special Parser
export { SpecialParser } from './parser/SpecialParser';
export type { OLEObject, Multimedia, FormField } from './models/Special';
export { OLEObjectType, MultimediaType, FormFieldType, SpecialTagID } from './models/Special';

// Equation Parser
export { EquationParser } from './parser/EquationParser';
export type { Equation, HWPEquationToken } from './models/Equation';
export { EquationAlignment, EquationHelper, EquationTagID } from './models/Equation';

// Chart Parser
export { ChartParser } from './parser/ChartParser';
export type { Chart, ChartData, ChartSeries, ChartTitle, ChartLegend, ChartAxes, ChartAxis, ChartPlotArea, ChartGradient, Chart3DEffect, ChartSeriesStyle, ChartAnimation, ChartDataLabel } from './models/Chart';
export { ChartType, ChartHelper, ChartTagID, LegendPosition, MarkerStyle, MarkerType, AnimationEasing, DataLabelPosition } from './models/Chart';
// Note: LineStyle exported from Shape; WrapType, AnchorType from Picture; TextAlignment from HeaderFooter

