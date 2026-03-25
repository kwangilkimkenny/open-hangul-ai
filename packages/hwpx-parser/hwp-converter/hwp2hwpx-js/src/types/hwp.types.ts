/**
 * HWP 파일 구조 타입 정의
 * hwplib의 주요 인터페이스를 TypeScript로 정의
 */

export interface FileVersion {
  getMM(): number;
  getNN(): number;
  getPP(): number;
  getRR(): number;
}

export interface FileHeader {
  getVersion(): FileVersion;
}

export interface CaretPosition {
  getListID(): number;
  getParagraphID(): number;
  getPositionInParagraph(): number;
}

export interface DocumentProperties {
  getCaretPosition(): CaretPosition;
}

export interface BatangPageInfo {
  // 바탕 페이지 정보
  [key: string]: unknown;
}

export interface SectionDefineProperty {
  isApplyBothBatangPage(): boolean;
  isApplyEvenBatangPage(): boolean;
  isApplyOddBatangPage(): boolean;
}

export interface SectionDefineHeader {
  getProperty(): SectionDefineProperty;
}

export interface ControlSectionDefine {
  getHeader(): SectionDefineHeader;
  getBatangPageInfoList(): BatangPageInfo[];
}

export enum ControlType {
  SectionDefine = 'SectionDefine',
  // 다른 타입들 추가 가능
}

export interface Control {
  getType(): ControlType;
}

export interface Paragraph {
  getControlList(): Control[];
}

export interface Section {
  getParagraph(index: number): Paragraph;
}

export interface BodyText {
  getSectionList(): Section[];
}

export interface BinDataProperty {
  getType(): BinDataType;
}

export enum BinDataType {
  Link = 'LINK',
  Embedding = 'EMBEDDING',
  Storage = 'STORAGE',
}

export interface BinData {
  getBinDataID(): number;
  getProperty(): BinDataProperty;
  getAbsolutePathForLink(): string;
  getExtensionForEmbedding(): string;
}

export interface EmbeddedBinaryData {
  getName(): string;
  getData(): Buffer;
}

export interface BinDataList {
  getEmbeddedBinaryDataList(): EmbeddedBinaryData[];
}

export interface DocInfo {
  getDocumentProperties(): DocumentProperties;
  getBinDataList(): BinData[];
}

export interface SummaryInformation {
  getTitle(): string;
  getAuthor(): string;
  getSubject(): string;
  getComments(): string;
  getLastAuthor(): string;
  getKeywords(): string;
  getCreateDateTime(): Date;
  getLastSaveDateTime(): Date;
}

export interface HWPFile {
  getFileHeader(): FileHeader;
  getDocInfo(): DocInfo;
  getBodyText(): BodyText;
  getBinData(): BinDataList;
  getSummaryInformation(): SummaryInformation;
}
