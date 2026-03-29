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

import type { DocInfo } from './DocInfo';
import type { Table } from './Table';
import type { Picture } from './Picture';
import type { Shape } from './Shape';
import type { Equation } from './Equation';
import type { Chart } from './Chart';

/** DocInfo는 DocInfoParser의 출력 타입을 그대로 사용 */
export type HWPDocInfo = DocInfo;

export interface HWPSection {
  index: number;
  text: string;
  paragraphs: HWPParagraph[];
  pageDef?: any;
  columnDefs?: any[];
  headerFooters?: any[];
  tables?: Table[];
  pageBorderFillID?: number;
  pictures?: Picture[];
  shapes?: Shape[];
  equations?: Equation[];
  charts?: Chart[];
}

export interface HWPParagraph {
  text: string;
  charShapeID?: number;
  paraShapeID?: number;
  styleID?: number;
  pageBreak?: boolean;
  columnBreak?: boolean;
  controls?: any[];
  runs?: any[];
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
    faceNames: new Map(),
    borderFills: new Map(),
    charShapes: new Map(),
    paraShapes: new Map(),
    styles: new Map(),
    tabDefs: new Map(),
    numberings: new Map(),
    binDataList: new Map()
  };

  sections: HWPSection[] = [];

  summaryInfo?: SummaryInfo;

  constructor() {
    // 초기화
  }
}
