/**
 * HWP 파일 파서
 * HWP 파일 전체를 파싱하여 HWPFile 객체를 생성합니다
 */

import { OLEParser, DirectoryEntry } from './OLEParser';
import { HWPFile, HWPFileHeader, HWPSection } from '../models/HWPFile';
import { SummaryInfoParser } from './SummaryInfoParser';
import { DocInfoParser } from './DocInfoParser';
import { HWPTextExtractor } from './HWPTextExtractor';
import { logger } from '../utils/Logger';
import { HWP_ENTRIES } from '../utils/Constants';
import * as pako from 'pako';

export class HWPParser {
  private oleParser: OLEParser;
  private hwpFile: HWPFile;

  constructor(buffer: ArrayBuffer) {
    this.oleParser = new OLEParser(buffer);
    this.hwpFile = new HWPFile();
  }

  /**
   * HWP 파일 파싱
   */
  parse(): HWPFile {
    this.oleParser.parse();
    this.parseFileHeader();
    this.parseDocInfo();
    this.parseBodyText();
    this.parseSummaryInfo();

    return this.hwpFile;
  }

  /**
   * FileHeader 스트림 파싱
   */
  private parseFileHeader(): void {
    const entry = this.oleParser.findEntry(HWP_ENTRIES.FILE_HEADER);
    if (!entry) {
      throw new Error('FileHeader stream not found. Not a valid HWP file.');
    }

    const data = this.oleParser.readStream(entry);
    const view = new DataView(data.buffer);

    // 시그니처 확인
    const signature = String.fromCharCode(...Array.from(data.slice(0, 32))).replace(/\0/g, '').trim();
    if (signature !== 'HWP Document File') {
      throw new Error(`Invalid HWP Signature: "${signature}". Expected "HWP Document File".`);
    }

    const version = view.getUint32(32, true);
    const flags = view.getUint32(36, true);

    const majorVer = (version >> 24) & 0xFF;
    if (majorVer < 5) {
      logger.warn(`HWP Version ${majorVer}.x.x.x is older than 5.0. Conversion might be imperfect.`);
    }

    this.hwpFile.header = {
      signature,
      version,
      flags,
      compressed: (flags & 0x01) !== 0,
      encrypted: (flags & 0x02) !== 0,
      distributable: (flags & 0x04) !== 0,
      script: (flags & 0x08) !== 0,
      drm: (flags & 0x10) !== 0,
      xmlTemplate: (flags & 0x20) !== 0,
      history: (flags & 0x40) !== 0,
      signInfoExists: (flags & 0x80) !== 0,
      certEncryption: (flags & 0x100) !== 0,
      signatureCheck: (flags & 0x200) !== 0,
      certSigned: (flags & 0x400) !== 0,
      ccl: (flags & 0x800) !== 0,
      mobileOptimized: (flags & 0x1000) !== 0
    };

    if (this.hwpFile.header.encrypted) {
      logger.warn('Encrypted HWP file detected. Content extraction may fail if password protected.');
    }

    logger.debug(`HWP 파일: v${majorVer}.x, compressed=${this.hwpFile.header.compressed}`);
  }

  /**
   * Summary Information 파싱
   */
  private parseSummaryInfo(): void {
    let entry = this.oleParser.findEntry(HWP_ENTRIES.SUMMARY_INFO_ALT);
    if (!entry) {
      entry = this.oleParser.findEntry(HWP_ENTRIES.SUMMARY_INFO);
    }

    if (entry) {
      try {
        const data = this.oleParser.readStream(entry);
        const parser = new SummaryInfoParser(data);
        this.hwpFile.summaryInfo = parser.parse();
        logger.debug('메타데이터 파싱 완료');
      } catch (e) {
        logger.warn('Summary Information 파싱 실패:', e);
      }
    } else {
      logger.debug('Summary Information 스트림 없음');
    }
  }

  /**
   * DocInfo 스트림 파싱
   */
  private parseDocInfo(): void {
    const entry = this.oleParser.findEntry(HWP_ENTRIES.DOC_INFO);
    if (!entry) {
      logger.warn('DocInfo stream not found');
      return;
    }

    let data = this.oleParser.readStream(entry);

    if (this.hwpFile.header.compressed) {
      data = this.decompress(data);
    }

    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const docInfoParser = new DocInfoParser(arrayBuffer);
    const docInfo = docInfoParser.parse();

    this.hwpFile.docInfo = docInfo;
  }

  /**
   * BodyText 스트림 파싱
   */
  private parseBodyText(): void {
    const directory = this.oleParser.getDirectory();
    let sectionIndex = 0;

    while (true) {
      const sectionName = `BodyText/Section${sectionIndex}`;
      const entry = this.oleParser.findEntry(sectionName);

      if (!entry) break;

      let data = this.oleParser.readStream(entry);

      if (this.hwpFile.header.compressed) {
        data = this.decompress(data);
      }

      const section = this.parseSection(sectionIndex, data);
      this.hwpFile.sections.push(section);

      sectionIndex++;
    }

    logger.debug(`${this.hwpFile.sections.length}개 섹션 파싱 완료`);
  }

  /**
   * 데이터 압축 해제
   */
  private decompress(data: Uint8Array): Uint8Array {
    try {
      // Raw Deflate 시도 (HWP 표준)
      try {
        return pako.inflateRaw(data);
      } catch {
        // Zlib Deflate 시도 (헤더 포함)
        try {
          return pako.inflate(data);
        } catch {
          logger.warn('압축 해제 실패, 원본 반환');
          return data;
        }
      }
    } catch (error) {
      logger.error('압축 해제 오류:', error);
      return data;
    }
  }

  /**
   * 섹션 파싱 (HWPTextExtractor 위임)
   */
  private parseSection(index: number, _data: Uint8Array): HWPSection {
    // HWPTextExtractor가 별도로 전체 파싱을 수행하므로
    // 여기서는 기본 섹션 객체를 반환
    return {
      index,
      text: '',
      paragraphs: []
    };
  }

  /**
   * HWP 파일 가져오기
   */
  getHWPFile(): HWPFile {
    return this.hwpFile;
  }
}

/**
 * HWP 파일 파싱 헬퍼 함수
 */
export async function parseHWPFile(buffer: ArrayBuffer): Promise<HWPFile> {
  const parser = new HWPParser(buffer);
  return parser.parse();
}
