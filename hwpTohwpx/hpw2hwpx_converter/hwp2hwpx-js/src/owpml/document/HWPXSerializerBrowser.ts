/* eslint-disable no-console */
/**
 * 브라우저 환경용 HWPX Serializer
 * File API를 사용하여 브라우저에서 HWPX 파일을 읽고 쓸 수 있도록 함
 */

import JSZip from 'jszip';
import { XMLSerializer } from '../serialize/XMLSerializer';
import { SectionType } from './SectionType';

/**
 * HWPX Version information (can be structured object or raw XML string)
 */
interface HwpxVersionInfoObject {
  major?: number;
  minor?: number;
  build?: number;
  revision?: number;
  getElemName?: () => string;
  [key: string]: unknown;
}
type HwpxVersionInfo = HwpxVersionInfoObject | string;

/**
 * HWPX Head information (can be structured object or raw XML string)
 */
interface HwpxHeadInfoObject {
  fontfaces?: unknown[];
  charShapes?: unknown[];
  paraShapes?: unknown[];
  styles?: unknown[];
  borderFills?: unknown[];
  getElemName?: () => string;
  [key: string]: unknown;
}
type HwpxHeadInfo = HwpxHeadInfoObject | string;

/**
 * Generic object type for XML serialization
 */
type SerializableObject = Record<string, unknown>;

/**
 * 브라우저용 HWPX Serializer 클래스
 */
export class HWPXSerializerBrowser {
  private zip: JSZip;
  private serializer: XMLSerializer;
  private sections: SectionType[] = [];
  private version: HwpxVersionInfo | null = null;
  private head: HwpxHeadInfo | null = null;
  private originalFile: File | null = null;

  constructor() {
    this.zip = new JSZip();
    this.serializer = new XMLSerializer();
  }

  /**
   * File 객체로부터 HWPX 파일 열기
   */
  async openFromFile(file: File): Promise<boolean> {
    try {
      this.originalFile = file;
      const arrayBuffer = await file.arrayBuffer();
      this.zip = await JSZip.loadAsync(arrayBuffer);

      // 파일 구조 파싱
      return await this.parseHWPX();
    } catch (error) {
      console.error('[HWPXSerializerBrowser] Failed to open file:', error);
      return false;
    }
  }

  /**
   * ArrayBuffer로부터 HWPX 파일 열기
   */
  async openFromBuffer(buffer: ArrayBuffer): Promise<boolean> {
    try {
      this.zip = await JSZip.loadAsync(buffer);
      return await this.parseHWPX();
    } catch (error) {
      console.error('[HWPXSerializerBrowser] Failed to open buffer:', error);
      return false;
    }
  }

  /**
   * HWPX 파일을 Blob으로 저장
   */
  async saveToBlob(): Promise<Blob | null> {
    try {
      // ZIP 파일 생성
      this.zip = new JSZip();

      // MIME 타입 쓰기
      await this.writeMimeType();

      // Version 쓰기
      if (this.version) {
        await this.writeVersion();
      }

      // Container 쓰기
      await this.writeContainer();

      // Manifest 쓰기
      await this.writeManifest();

      // Head 쓰기
      if (this.head) {
        await this.writeHead();
      }

      // Sections 쓰기
      if (this.sections.length > 0) {
        await this.writeSections();
      }

      // Content.hpf 쓰기
      await this.writeContentHPF();

      // ZIP 파일을 Blob으로 생성
      const blob = await this.zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      console.log(`[HWPXSerializerBrowser] ✅ HWPX file saved as Blob (${(blob.size / 1024).toFixed(2)} KB)`);
      return blob;
    } catch (error) {
      console.error('[HWPXSerializerBrowser] Failed to save:', error);
      return null;
    }
  }

  /**
   * HWPX 파일을 다운로드
   */
  async saveAsDownload(filename?: string): Promise<boolean> {
    const blob = await this.saveToBlob();
    if (!blob) {
      return false;
    }

    // 브라우저 환경 체크
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      console.error('[HWPXSerializerBrowser] Browser environment required for download');
      return false;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || this.originalFile?.name || 'document.hwpx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[HWPXSerializerBrowser] ✅ File downloaded: ${a.download}`);
    return true;
  }

  /**
   * Version 설정
   */
  setVersion(version: HwpxVersionInfo): void {
    this.version = version;
  }

  getVersion(): HwpxVersionInfo | null {
    return this.version;
  }

  /**
   * Head 설정
   */
  setHead(head: HwpxHeadInfo): void {
    this.head = head;
  }

  getHead(): HwpxHeadInfo | null {
    return this.head;
  }

  /**
   * Section 추가
   */
  addSection(section: SectionType): void {
    this.sections.push(section);
  }

  /**
   * Section 설정
   */
  setSection(index: number, section: SectionType): void {
    if (index >= 0 && index < this.sections.length) {
      this.sections[index] = section;
    } else if (index === this.sections.length) {
      this.sections.push(section);
    }
  }

  getSection(index: number): SectionType | null {
    if (index >= 0 && index < this.sections.length) {
      return this.sections[index];
    }
    return null;
  }

  getSections(): SectionType[] {
    return [...this.sections];
  }

  setSections(sections: SectionType[]): void {
    this.sections = [...sections];
  }

  /**
   * MIME 타입 쓰기
   */
  private async writeMimeType(): Promise<void> {
    this.zip.file('mimetype', 'application/hwpml-package+xml', {
      compression: 'STORE',
    });
  }

  /**
   * Version 쓰기
   */
  private async writeVersion(): Promise<void> {
    if (!this.version) {
      return;
    }

    let xml: string;
    if (typeof this.version === 'string') {
      xml = this.version;
    } else {
      this.serializer.clear();
      const versionObj = this.version as HwpxVersionInfoObject;
      if (versionObj && typeof versionObj.getElemName === 'function') {
        this.serializer.save('', versionObj as unknown as Parameters<typeof this.serializer.save>[1]);
        xml = this.serializer.getBuffer();
      } else {
        xml = this.objectToXML(versionObj as SerializableObject, 'version');
      }
    }

    if (xml) {
      this.zip.file('Version/version.xml', xml);
    }
  }

  /**
   * Container 쓰기
   */
  private async writeContainer(): Promise<void> {
    const container = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  </rootfiles>
</container>`;

    this.zip.file('META-INF/container.xml', container);
  }

  /**
   * Manifest 쓰기
   */
  private async writeManifest(): Promise<void> {
    let manifest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<manifest version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <file-entry full-path="/" media-type="application/hwpml-package+xml"/>
  <file-entry full-path="Version/version.xml" media-type="text/xml"/>
  <file-entry full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  <file-entry full-path="Contents/header.xml" media-type="text/xml"/>`;

    for (let i = 0; i < this.sections.length; i++) {
      manifest += `\n  <file-entry full-path="Contents/section${i}.xml" media-type="text/xml"/>`;
    }

    manifest += '\n</manifest>';
    this.zip.file('META-INF/manifest.xml', manifest);
  }

  /**
   * Head 쓰기
   */
  private async writeHead(): Promise<void> {
    if (!this.head) {
      return;
    }

    let xml: string;
    if (typeof this.head === 'string') {
      xml = this.head;
    } else {
      this.serializer.clear();
      const headObj = this.head as HwpxHeadInfoObject;
      if (headObj && typeof headObj.getElemName === 'function') {
        this.serializer.save('', headObj as unknown as Parameters<typeof this.serializer.save>[1]);
        xml = this.serializer.getBuffer();
      } else {
        xml = this.objectToXML(headObj as SerializableObject, 'head');
      }
    }

    if (xml) {
      this.zip.file('Contents/header.xml', xml);
      console.log('[HWPXSerializerBrowser] Header XML written');
    }
  }

  /**
   * Sections 쓰기
   */
  private async writeSections(): Promise<void> {
    console.log(`[HWPXSerializerBrowser] Writing ${this.sections.length} sections...`);

    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      let xml: string;

      if (typeof section === 'string') {
        xml = section as unknown as string;
      } else if (section && typeof (section as { getElemName?: () => string }).getElemName === 'function') {
        this.serializer.clear();
        this.serializer.save('', section as unknown as Parameters<typeof this.serializer.save>[1]);
        xml = this.serializer.getBuffer();
      } else {
        xml = this.objectToXML(section as unknown as SerializableObject, 'section');
      }

      if (xml) {
        this.zip.file(`Contents/section${i}.xml`, xml);
        console.log(`[HWPXSerializerBrowser] ✅ Section ${i} written (${xml.length} bytes)`);
      }
    }

    console.log(`[HWPXSerializerBrowser] ✅ All ${this.sections.length} sections written`);
  }

  /**
   * Content.hpf 쓰기
   */
  private async writeContentHPF(): Promise<void> {
    let content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<content.hpf version="1.0" xmlns="http://www.hancom.co.kr/hwpml/2011/package">
  <manifest>
    <item id="version" href="Version/version.xml" media-type="text/xml"/>
    <item id="header" href="Contents/header.xml" media-type="text/xml"/>`;

    for (let i = 0; i < this.sections.length; i++) {
      content += `\n    <item id="section${i}" href="Contents/section${i}.xml" media-type="text/xml"/>`;
    }

    content += '\n  </manifest>\n  <spine>\n    <itemref idref="header"/>';

    for (let i = 0; i < this.sections.length; i++) {
      content += `\n    <itemref idref="section${i}"/>`;
    }

    content += '\n  </spine>\n</content.hpf>';

    this.zip.file('Contents/content.hpf', content);
  }

  /**
   * 객체를 XML로 변환
   */
  private objectToXML(obj: SerializableObject, rootElement: string): string {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<${rootElement}>`;

    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' || typeof value === 'number') {
          xml += `\n  <${key}>${this.escapeXML(String(value))}</${key}>`;
        }
      }
    }

    xml += `\n</${rootElement}>`;
    return xml;
  }

  /**
   * XML 이스케이프
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
   * HWPX 파일 파싱
   */
  private async parseHWPX(): Promise<boolean> {
    try {
      const mimeType = await this.zip.file('mimetype')?.async('string');
      if (mimeType !== 'application/hwpml-package+xml') {
        return false;
      }

      const version = await this.zip.file('Version/version.xml')?.async('string');
      if (version) {
        this.version = version;
      }

      const header = await this.zip.file('Contents/header.xml')?.async('string');
      if (header) {
        this.head = header;
      }

      let sectionIndex = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const sectionFile = await this.zip.file(`Contents/section${sectionIndex}.xml`)?.async('string');
        if (!sectionFile) {
          break;
        }
        this.sections.push(sectionFile as unknown as SectionType);
        sectionIndex++;
      }

      console.log(`[HWPXSerializerBrowser] Parsed ${this.sections.length} sections`);
      return true;
    } catch (error) {
      console.error('[HWPXSerializerBrowser] Failed to parse:', error);
      return false;
    }
  }
}

