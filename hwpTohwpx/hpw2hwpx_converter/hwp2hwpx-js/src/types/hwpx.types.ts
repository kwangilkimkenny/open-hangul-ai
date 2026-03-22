/**
 * HWPX 파일 구조 타입 정의
 * hwpxlib의 주요 인터페이스를 TypeScript로 정의
 */

export enum TargetApplicationSort {
  WordProcessor = 'WordProcessor',
}

export enum MasterPageType {
  BOTH = 'BOTH',
  EVEN = 'EVEN',
  ODD = 'ODD',
}

// Version XML
export interface Version {
  majorAnd(major: number): Version;
  minorAnd(minor: number): Version;
  microAnd(micro: number): Version;
  buildNumber(buildNumber: number): Version;
}

export interface VersionXMLFile {
  targetApplicationAnd(app: TargetApplicationSort): VersionXMLFile;
  osAnd(os: string): VersionXMLFile;
  applicationAnd(application: string): VersionXMLFile;
  appVersion(version: string): VersionXMLFile;
  version(): Version;
}

// Manifest XML
export interface RootFile {
  fullPathAnd(path: string): RootFile;
  mediaType(type: string): RootFile;
}

export interface RootFiles {
  addNew(): RootFile;
}

export interface ContainerXMLFile {
  createRootFiles(): void;
  rootFiles(): RootFiles;
}

// Content HPF
export interface Title {
  addText(text: string): void;
}

export interface Language {
  addText(text: string): void;
}

export interface Meta {
  nameAnd(name: string): Meta;
  contentAnd(content: string): Meta;
  text(text: string): Meta;
}

export interface MetaData {
  createTitle(): void;
  title(): Title;
  createLanguage(): void;
  language(): Language;
  addNewMeta(): Meta;
}

export interface AttachedFile {
  data(data: Buffer): void;
}

export interface ManifestItem {
  idAnd(id: string): ManifestItem;
  hrefAnd(href: string): ManifestItem;
  mediaType(type: string): ManifestItem;
  mediaTypeAnd(type: string): ManifestItem;
  embedded(embedded: boolean): ManifestItem;
  embeddedAnd(embedded: boolean): ManifestItem;
  createAttachedFile(): void;
  attachedFile(): AttachedFile;
}

export interface Manifest {
  addNew(): ManifestItem;
}

export interface SpineItem {
  idref(idref: string): SpineItem;
}

export interface Spine {
  addNew(): SpineItem;
}

export interface ContentHPFFile {
  idAnd(id: string): ContentHPFFile;
  versionAnd(version: string): ContentHPFFile;
  uniqueIdentifierAnd(id: string): ContentHPFFile;
  createMetaData(): void;
  metaData(): MetaData;
  createManifest(): void;
  manifest(): Manifest;
  createSpine(): void;
  spine(): Spine;
}

// Header XML
export interface HeaderXMLFile {
  // Header 관련 메서드들
}

// Master Page XML
export interface MasterPageXMLFile {
  // Master Page 관련 메서드들
}

// Section XML
export interface FieldBegin {
  // Field Begin 관련
}

export interface SectionXMLFile {
  // Section 관련 메서드들
}

// Settings XML
export interface CaretPos {
  listIDRefAnd(id: number): CaretPos;
  paraIDRefAnd(id: number): CaretPos;
  pos(pos: number): CaretPos;
}

export interface SettingsXMLFile {
  createCaretPosition(): void;
  caretPosition(): CaretPos;
}

// Object List
export interface ObjectList<T> {
  items: T[];
  add(item: T): void;
  get(index: number): T;
  size(): number;
}

// Manifest XML
export interface ManifestXMLFile {
  // Manifest 관련 메서드들
}

// Main HWPX File
export interface HWPXFile {
  versionXMLFile(): VersionXMLFile;
  manifestXMLFile(): ManifestXMLFile;
  containerXMLFile(): ContainerXMLFile;
  contentHPFFile(): ContentHPFFile;
  headerXMLFile(): HeaderXMLFile;
  masterPageXMLFileList(): ObjectList<MasterPageXMLFile>;
  sectionXMLFileList(): ObjectList<SectionXMLFile>;
  settingsXMLFile(): SettingsXMLFile;
}
