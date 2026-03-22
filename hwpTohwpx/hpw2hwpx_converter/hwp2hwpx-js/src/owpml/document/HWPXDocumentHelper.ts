/**
 * HWPX 문서 편집 헬퍼 클래스
 * AI 편집 후 문서 업데이트를 쉽게 할 수 있도록 도와주는 유틸리티
 */

import { HWPXSerializer } from './HWPXSerializer';
import { SectionType } from './SectionType';
import { XMLSerializer } from '../serialize/XMLSerializer';
import { OWPMLNamedObject } from '../base/Object';
import { Logger } from '../../util/Logger';

/**
 * HWPX 문서 편집 헬퍼
 */
export class HWPXDocumentHelper {
  private serializer: HWPXSerializer;

  constructor() {
    this.serializer = new HWPXSerializer();
  }

  /**
   * HWPX 파일 열기
   */
  async openFile(filePath: string): Promise<boolean> {
    return await this.serializer.open(filePath);
  }

  /**
   * AI 편집 후 섹션 XML 문자열로 업데이트
   * @param sectionIndex 섹션 인덱스
   * @param sectionXML 업데이트된 섹션 XML 문자열
   */
  updateSectionXML(sectionIndex: number, sectionXML: string): void {
    // XML 문자열을 SectionType으로 변환하거나 문자열로 저장
    // 현재는 문자열로 저장 (나중에 파싱 가능)
    this.serializer.setSection(sectionIndex, sectionXML as unknown as SectionType);
  }

  /**
   * AI 편집 후 여러 섹션을 한 번에 업데이트
   * @param sectionsMap 인덱스와 XML 문자열의 맵
   */
  updateSectionsXML(sectionsMap: Map<number, string>): void {
    const sections: SectionType[] = [];
    const maxIndex = Math.max(...Array.from(sectionsMap.keys()), -1);

    // 기존 섹션들 가져오기
    const existingSections = this.serializer.getSections();

    for (let i = 0; i <= maxIndex; i++) {
      if (sectionsMap.has(i)) {
        // 업데이트된 섹션
        const section = sectionsMap.get(i);
        if (section) {
          sections.push(section as unknown as SectionType);
        }
      } else if (i < existingSections.length) {
        // 기존 섹션 유지
        sections.push(existingSections[i]);
      }
    }

    this.serializer.setSections(sections);
  }

  /**
   * AI 편집 후 헤더 XML 업데이트
   * @param headerXML 업데이트된 헤더 XML 문자열
   */
  updateHeaderXML(headerXML: string): void {
    this.serializer.setHead(headerXML);
  }

  /**
   * 변경사항 저장
   * @param filePath 저장할 파일 경로 (없으면 원본 경로에 저장)
   */
  async saveChanges(filePath?: string): Promise<boolean> {
    Logger.debug('[HWPXDocumentHelper] Saving changes...');
    Logger.debug(`[HWPXDocumentHelper] Current sections count: ${this.serializer.getSections().length}`);

    const result = await this.serializer.save(filePath);
    if (result) {
      Logger.info('[HWPXDocumentHelper] Document saved successfully');
    } else {
      Logger.error('[HWPXDocumentHelper] Failed to save document');
    }
    return result;
  }

  /**
   * 현재 섹션 개수 가져오기
   */
  getSectionCount(): number {
    return this.serializer.getSections().length;
  }

  /**
   * 특정 섹션의 XML 가져오기
   */
  getSectionXML(index: number): string | null {
    const section = this.serializer.getSection(index);
    if (section) {
      // SectionType이면 XML로 변환, 문자열이면 그대로 반환
      if (typeof section === 'string') {
        return section;
      }
      // SectionType을 XML로 변환
      return this.serializeToXML(section);
    }
    return null;
  }

  /**
   * OWPML 객체를 XML 문자열로 직렬화
   * @param object OWPML 객체 (SectionType, Head 등)
   * @returns XML 문자열
   */
  private serializeToXML(object: SectionType | unknown): string | null {
    try {
      // OWPMLNamedObject 인터페이스를 구현하는지 확인
      if (object && typeof (object as OWPMLNamedObject).getElemName === 'function') {
        const serializer = new XMLSerializer();
        serializer.save('', object as OWPMLNamedObject);
        const xml = serializer.getBuffer();
        return xml || null;
      }

      // 일반 객체인 경우 간단한 XML 변환
      if (typeof object === 'object' && object !== null) {
        return this.objectToSimpleXML(object as Record<string, unknown>, 'section');
      }

      return null;
    } catch (error) {
      Logger.error('[HWPXDocumentHelper] Failed to serialize object to XML:', error);
      return null;
    }
  }

  /**
   * 일반 객체를 간단한 XML로 변환
   */
  private objectToSimpleXML(obj: Record<string, unknown>, rootElement: string): string {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<${rootElement}`;

    // 속성 추출 (시작 태그에 포함)
    const attributes: string[] = [];
    const children: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        // 하위 객체는 자식 요소로 처리
        children.push(this.objectToSimpleXML(value as Record<string, unknown>, key));
      } else if (Array.isArray(value)) {
        // 배열은 반복 요소로 처리
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            children.push(this.objectToSimpleXML(item as Record<string, unknown>, key));
          } else {
            children.push(`  <${key}>${this.escapeXML(String(item))}</${key}>`);
          }
        }
      } else {
        // 기본 타입은 속성으로 처리
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
   * Head 객체를 XML로 변환
   */
  private serializeHeadToXML(head: unknown): string | null {
    try {
      // OWPMLNamedObject 인터페이스를 구현하는지 확인
      if (head && typeof (head as OWPMLNamedObject).getElemName === 'function') {
        const serializer = new XMLSerializer();
        serializer.save('', head as OWPMLNamedObject);
        const xml = serializer.getBuffer();
        return xml || null;
      }

      // 일반 객체인 경우 간단한 XML 변환
      if (typeof head === 'object' && head !== null) {
        return this.objectToSimpleXML(head as Record<string, unknown>, 'head');
      }

      return null;
    } catch (error) {
      Logger.error('[HWPXDocumentHelper] Failed to serialize head to XML:', error);
      return null;
    }
  }
}

/**
 * AI 편집 결과를 HWPX 문서에 적용하는 함수
 * 
 * @example
 * ```typescript
 * const helper = new HWPXDocumentHelper();
 * await helper.openFile('document.hwpx');
 * 
 * // AI 편집 결과
 * const updatedSections = new Map<number, string>();
 * updatedSections.set(0, '<section>...</section>');
 * updatedSections.set(1, '<section>...</section>');
 * 
 * // 변경사항 적용
 * helper.updateSectionsXML(updatedSections);
 * 
 * // 저장
 * await helper.saveChanges();
 * ```
 */
export async function applyAIEditsToHWPX(
  filePath: string,
  updatedSections: Map<number, string>,
  updatedHeader?: string
): Promise<boolean> {
  const helper = new HWPXDocumentHelper();
  
  // 파일 열기
  const opened = await helper.openFile(filePath);
  if (!opened) {
    Logger.error('Failed to open HWPX file');
    return false;
  }

  // 헤더 업데이트
  if (updatedHeader) {
    helper.updateHeaderXML(updatedHeader);
  }

  // 섹션 업데이트
  if (updatedSections.size > 0) {
    helper.updateSectionsXML(updatedSections);
  }

  // 저장
  return await helper.saveChanges();
}

