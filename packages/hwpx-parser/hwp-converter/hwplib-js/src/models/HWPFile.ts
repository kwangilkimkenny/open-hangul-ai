/**
 * HWP 파일 구조 모델
 */

export interface HWPFileHeader {
  signature: string;
  version: number;
  flags: number;
  compressed: boolean;
  encrypted: boolean;
  distributable: boolean;
  script: boolean;
  drm: boolean;
  xmlTemplate: boolean;
  history: boolean;
  signInfoExists: boolean;
  certEncryption: boolean;
  signatureCheck: boolean;
  certSigned: boolean;
  ccl: boolean;
  mobileOptimized: boolean;
}

export interface HWPDocInfo {
  idMappings: Map<number, any>;
  binData: Map<number, Uint8Array>;
  faceNames: Map<number, string>;
  borderFills: any[];
  charShapes: any[];
  tabDefs: any[];
  numberings: any[];
  bullets: any[];
  paraShapes: any[];
  styles: any[];
  memo: any;
}

export interface HWPSection {
  index: number;
  paragraphs: HWPParagraph[];
}

export interface HWPParagraph {
  text: string;
  charShape: number;
  paraShape: number;
  controls: any[];
}

export interface SummaryInfo {
  title?: string;
  subject?: string;
  author?: string;
  keywords?: string;
  comments?: string;
  template?: string;
  lastSavedBy?: string;
  revisionNumber?: string;
  totalTime?: number;
  lastPrinted?: Date;
  created?: Date;
  lastSaved?: Date;
  pages?: number;
  words?: number;
  chars?: number;
  security?: number;
}

export class HWPFile {
  header: HWPFileHeader = {
    signature: '',
    version: 0,
    flags: 0,
    compressed: false,
    encrypted: false,
    distributable: false,
    script: false,
    drm: false,
    xmlTemplate: false,
    history: false,
    signInfoExists: false,
    certEncryption: false,
    signatureCheck: false,
    certSigned: false,
    ccl: false,
    mobileOptimized: false
  };

  docInfo: HWPDocInfo = {
    idMappings: new Map(),
    binData: new Map(), // Map<number, Uint8Array>로 초기화
    faceNames: new Map(),
    borderFills: [],
    charShapes: [],
    paraShapes: [],
    styles: [],
    tabDefs: [],
    numberings: [],
    bullets: [],
    memo: null
  };

  sections: HWPSection[] = [];

  summaryInfo?: SummaryInfo;

  constructor() {
    // 초기화
  }
}
