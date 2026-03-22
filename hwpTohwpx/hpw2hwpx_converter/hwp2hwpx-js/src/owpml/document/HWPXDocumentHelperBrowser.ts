/**
 * 브라우저용 HWPX 문서 편집 헬퍼
 * File API를 사용하여 브라우저에서 작동
 */

import { HWPXSerializerBrowser } from './HWPXSerializerBrowser';
import { SectionType } from './SectionType';
import { XMLSerializer } from '../serialize/XMLSerializer';
import { OWPMLNamedObject } from '../base/Object';

/**
 * 브라우저용 HWPX 문서 편집 헬퍼
 */
export class HWPXDocumentHelperBrowser {
  private serializer: HWPXSerializerBrowser;
  private currentFile: File | null = null;

  constructor() {
    this.serializer = new HWPXSerializerBrowser();
  }

  /**
   * File 객체로 파일 열기
   */
  async openFile(file: File): Promise<boolean> {
    this.currentFile = file;
    return await this.serializer.openFromFile(file);
  }

  /**
   * ArrayBuffer로 파일 열기
   */
  async openFromBuffer(buffer: ArrayBuffer): Promise<boolean> {
    return await this.serializer.openFromBuffer(buffer);
  }

  /**
   * 섹션 XML 업데이트
   */
  updateSectionXML(sectionIndex: number, sectionXML: string): void {
    this.serializer.setSection(sectionIndex, sectionXML as unknown as SectionType);
  }

  /**
   * 여러 섹션 업데이트
   */
  updateSectionsXML(sectionsMap: Map<number, string>): void {
    const sections: SectionType[] = [];
    const maxIndex = Math.max(...Array.from(sectionsMap.keys()), -1);
    const existingSections = this.serializer.getSections();

    for (let i = 0; i <= maxIndex; i++) {
      if (sectionsMap.has(i)) {
        const section = sectionsMap.get(i);
        if (section) {
          sections.push(section as unknown as SectionType);
        }
      } else if (i < existingSections.length) {
        sections.push(existingSections[i]);
      }
    }

    this.serializer.setSections(sections);
  }

  /**
   * 헤더 XML 업데이트
   */
  updateHeaderXML(headerXML: string): void {
    this.serializer.setHead(headerXML);
  }

  /**
   * 변경사항을 Blob으로 저장
   */
  async saveToBlob(): Promise<Blob | null> {
    return await this.serializer.saveToBlob();
  }

  /**
   * 변경사항을 다운로드
   */
  async saveAsDownload(filename?: string): Promise<boolean> {
    return await this.serializer.saveAsDownload(filename);
  }

  /**
   * 현재 섹션 개수
   */
  getSectionCount(): number {
    return this.serializer.getSections().length;
  }

  /**
   * 섹션 XML 가져오기
   */
  getSectionXML(index: number): string | null {
    const section = this.serializer.getSection(index);
    if (section) {
      if (typeof section === 'string') {
        return section;
      }
      // SectionType을 XML로 변환
      return this.serializeToXML(section);
    }
    return null;
  }

  /**
   * 헤더 XML 가져오기
   */
  getHeaderXML(): string | null {
    const head = this.serializer.getHead();
    if (head) {
      if (typeof head === 'string') {
        return head;
      }
      // Head 객체를 XML로 변환
      return this.serializeHeadToXML(head);
    }
    return null;
  }

  /**
   * 현재 파일 가져오기
   */
  getCurrentFile(): File | null {
    return this.currentFile;
  }

  /**
   * OWPML 객체를 XML 문자열로 직렬화
   */
  private serializeToXML(object: SectionType | unknown): string | null {
    try {
      if (object && typeof (object as OWPMLNamedObject).getElemName === 'function') {
        const serializer = new XMLSerializer();
        serializer.save('', object as OWPMLNamedObject);
        const xml = serializer.getBuffer();
        return xml || null;
      }

      if (typeof object === 'object' && object !== null) {
        return this.objectToSimpleXML(object as Record<string, unknown>, 'section');
      }

      return null;
    } catch (error) {
      console.error('[HWPXDocumentHelperBrowser] Failed to serialize object to XML:', error);
      return null;
    }
  }

  /**
   * Head 객체를 XML로 변환
   */
  private serializeHeadToXML(head: unknown): string | null {
    try {
      if (head && typeof (head as OWPMLNamedObject).getElemName === 'function') {
        const serializer = new XMLSerializer();
        serializer.save('', head as OWPMLNamedObject);
        const xml = serializer.getBuffer();
        return xml || null;
      }

      if (typeof head === 'object' && head !== null) {
        return this.objectToSimpleXML(head as Record<string, unknown>, 'head');
      }

      return null;
    } catch (error) {
      console.error('[HWPXDocumentHelperBrowser] Failed to serialize head to XML:', error);
      return null;
    }
  }

  /**
   * 일반 객체를 간단한 XML로 변환
   */
  private objectToSimpleXML(obj: Record<string, unknown>, rootElement: string): string {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<${rootElement}`;

    const attributes: string[] = [];
    const children: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        children.push(this.objectToSimpleXML(value as Record<string, unknown>, key));
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            children.push(this.objectToSimpleXML(item as Record<string, unknown>, key));
          } else {
            children.push(`  <${key}>${this.escapeXML(String(item))}</${key}>`);
          }
        }
      } else {
        attributes.push(`${key}="${this.escapeXML(String(value))}"`);
      }
    }

    if (attributes.length > 0) {
      xml += ` ${attributes.join(' ')}`;
    }

    if (children.length > 0) {
      xml += '>\n';
      xml += children.join('\n');
      xml += `\n</${rootElement}>`;
    } else {
      xml += '/>';
    }

    return xml;
  }

  /**
   * XML 특수 문자 이스케이프
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

