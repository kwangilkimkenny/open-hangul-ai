/* eslint-disable no-console */
/**
 * HWPX Serializer
 * hwpx-owpml-model의 OWPMLSerialize를 참고하여 포팅
 * HWPX 파일 생성 및 저장을 담당
 */

import JSZip from 'jszip';
import { XMLSerializer } from '../serialize/XMLSerializer';
import { SectionType } from './SectionType';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';

/**
 * Version information type
 */
type VersionType = string | OWPMLLikeObject;

/**
 * Application setting type
 */
type AppSettingType = string | Record<string, unknown>;

/**
 * Package metadata type
 */
type PackageType = string | Record<string, unknown>;

/**
 * Header content type (can be raw XML string or structured object)
 */
type HeadType = string | OWPMLLikeObject;

/**
 * History entry type
 */
type HistoryType = string | Record<string, unknown>;

/**
 * Object that has getElemName method (OWPML-like)
 */
interface OWPMLLikeObject {
  getElemName?: () => string;
  [key: string]: unknown;
}

/**
 * HWPX Serializer 클래스
 */
export class HWPXSerializer {
  private zip: JSZip;
  private serializer: XMLSerializer;
  private sections: SectionType[] = [];
  private version: VersionType | null = null;
  private appSetting: AppSettingType | null = null;
  private package: PackageType | null = null;
  private head: HeadType | null = null;
  private histories: HistoryType[] = [];
  private originalPath: string = '';

  constructor() {
    this.zip = new JSZip();
    this.serializer = new XMLSerializer();
  }

  /**
   * HWPX 파일 열기 (읽기용)
   */
  async open(path: string): Promise<boolean> {
    try {
      this.originalPath = path;
      // ZIP 파일 읽기
      const data = readFileSync(path);
      this.zip = await JSZip.loadAsync(data);

      // 파일 구조 파싱
      return await this.parseHWPX();
    } catch (error) {
      console.error('Failed to open HWPX file:', error);
      return false;
    }
  }

  /**
   * HWPX 파일 저장
   */
  async save(path?: string): Promise<boolean> {
    try {
      const savePath = path || this.originalPath;
      if (!savePath) {
        console.error('No path specified for saving');
        return false;
      }

      // ZIP 파일 생성 (항상 새로 생성하여 변경사항 반영)
      // 기존 ZIP을 재사용하면 변경사항이 반영되지 않을 수 있으므로 새로 생성
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

      // Head 쓰기 (변경된 경우에만)
      if (this.head) {
        await this.writeHead();
      }

      // Sections 쓰기 (변경된 경우에만)
      if (this.sections.length > 0) {
        await this.writeSections();
      }

      // Content.hpf 쓰기
      await this.writeContentHPF();

      // ZIP 파일 저장
      const buffer = await this.zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // 디렉토리 생성
      const dir = dirname(savePath);
      if (dir) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(savePath, buffer);
      console.log(`[HWPXSerializer] ✅ HWPX file saved successfully to: ${savePath}`);
      console.log(`[HWPXSerializer] 📊 File size: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`[HWPXSerializer] 📊 Sections: ${this.sections.length}, Head: ${this.head ? 'Yes' : 'No'}`);
      return true;
    } catch (error) {
      console.error('Failed to save HWPX file:', error);
      return false;
    }
  }

  /**
   * Version 설정
   */
  setVersion(version: VersionType): void {
    this.version = version;
  }

  /**
   * Version 가져오기
   */
  getVersion(): VersionType | null {
    return this.version;
  }

  /**
   * Application Setting 설정
   */
  setApplicationSetting(appSetting: AppSettingType): void {
    this.appSetting = appSetting;
  }

  /**
   * Application Setting 가져오기
   */
  getApplicationSetting(): AppSettingType | null {
    return this.appSetting;
  }

  /**
   * Package 설정
   */
  setPackage(pkg: PackageType): void {
    this.package = pkg;
  }

  /**
   * Package 가져오기
   */
  getPackage(): PackageType | null {
    return this.package;
  }

  /**
   * Head 설정
   */
  setHead(head: HeadType): void {
    this.head = head;
  }

  /**
   * Head 가져오기
   */
  getHead(): HeadType | null {
    return this.head;
  }

  /**
   * Section 추가
   */
  addSection(section: SectionType): void {
    this.sections.push(section);
  }

  /**
   * Section 설정 (인덱스로)
   */
  setSection(index: number, section: SectionType): void {
    if (index >= 0 && index < this.sections.length) {
      this.sections[index] = section;
    } else if (index === this.sections.length) {
      this.sections.push(section);
    }
  }

  /**
   * Section 가져오기 (인덱스로)
   */
  getSection(index: number): SectionType | null {
    if (index >= 0 && index < this.sections.length) {
      return this.sections[index];
    }
    return null;
  }

  /**
   * Sections 가져오기
   */
  getSections(): SectionType[] {
    return [...this.sections];
  }

  /**
   * 모든 Sections 교체
   */
  setSections(sections: SectionType[]): void {
    this.sections = [...sections];
  }

  /**
   * History 추가
   */
  addHistory(history: HistoryType): void {
    this.histories.push(history);
  }

  /**
   * Histories 가져오기
   */
  getHistories(): HistoryType[] {
    return [...this.histories];
  }

  /**
   * MIME 타입 쓰기
   */
  private async writeMimeType(): Promise<void> {
    this.zip.file('mimetype', 'application/hwpml-package+xml', {
      compression: 'STORE', // MIME 타입은 압축하지 않음
    });
  }

  /**
   * Version 쓰기
   */
  private async writeVersion(): Promise<void> {
    if (!this.version) {
      return;
    }

    // Version이 문자열인 경우 그대로 사용, 객체인 경우 직렬화
    let xml: string;
    if (typeof this.version === 'string') {
      xml = this.version;
    } else {
      this.serializer.clear();
      const versionObj = this.version as OWPMLLikeObject;
      // Version 객체가 OWPMLNamedObject를 구현했다면
      if (versionObj && typeof versionObj.getElemName === 'function') {
        this.serializer.save('', versionObj as unknown as Parameters<typeof this.serializer.save>[1]);
        xml = this.serializer.getBuffer();
      } else {
        // 일반 객체인 경우 XML로 변환
        xml = this.objectToXML(versionObj as Record<string, unknown>, 'version');
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
    // Manifest XML 생성
    let manifest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<manifest version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <file-entry full-path="/" media-type="application/hwpml-package+xml"/>
  <file-entry full-path="Version/version.xml" media-type="text/xml"/>
  <file-entry full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  <file-entry full-path="Contents/header.xml" media-type="text/xml"/>`;

    // Section 파일들 추가
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
    
    // Head가 문자열인 경우 그대로 사용
    if (typeof this.head === 'string') {
      xml = this.head;
    } else {
      this.serializer.clear();
      const headObj = this.head as OWPMLLikeObject;
      // Head 객체가 OWPMLNamedObject를 구현했다면
      if (headObj && typeof headObj.getElemName === 'function') {
        this.serializer.save('', headObj as unknown as Parameters<typeof this.serializer.save>[1]);
        xml = this.serializer.getBuffer();
      } else {
        // 일반 객체인 경우 XML로 변환
        xml = this.objectToXML(headObj as Record<string, unknown>, 'head');
      }
    }

    if (xml) {
      this.zip.file('Contents/header.xml', xml);
      console.log('Header XML written:', xml.substring(0, 200));
    }
  }

  /**
   * Sections 쓰기
   */
  private async writeSections(): Promise<void> {
    console.log(`[HWPXSerializer] Writing ${this.sections.length} sections...`);
    
    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      let xml: string;

      // Section이 문자열인 경우 그대로 사용
      if (typeof section === 'string') {
        xml = section as unknown as string;
      } else if (section && typeof (section as { getElemName?: () => string }).getElemName === 'function') {
        // Section 객체가 OWPMLNamedObject를 구현했다면
        this.serializer.clear();
        this.serializer.save('', section as unknown as Parameters<typeof this.serializer.save>[1]);
        xml = this.serializer.getBuffer();
      } else {
        // 일반 객체인 경우 XML로 변환
        xml = this.objectToXML(section as unknown as Record<string, unknown>, 'section');
      }

      if (xml) {
        // XML이 유효한지 확인
        if (!xml.trim().startsWith('<?xml') && !xml.trim().startsWith('<section')) {
          console.warn(`[HWPXSerializer] Section ${i} XML may be invalid:`, xml.substring(0, 100));
        }
        
        this.zip.file(`Contents/section${i}.xml`, xml);
        console.log(`[HWPXSerializer] ✅ Section ${i} written (${xml.length} bytes)`);
      } else {
        console.warn(`[HWPXSerializer] ⚠️ Section ${i} is empty or invalid`);
      }
    }
    
    console.log(`[HWPXSerializer] ✅ All ${this.sections.length} sections written`);
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

    // Section 아이템들 추가
    for (let i = 0; i < this.sections.length; i++) {
      content += `\n    <item id="section${i}" href="Contents/section${i}.xml" media-type="text/xml"/>`;
    }

    content += '\n  </manifest>\n  <spine>\n    <itemref idref="header"/>';

    // Section 참조 추가
    for (let i = 0; i < this.sections.length; i++) {
      content += `\n    <itemref idref="section${i}"/>`;
    }

    content += '\n  </spine>\n</content.hpf>';

    this.zip.file('Contents/content.hpf', content);
  }

  /**
   * 객체를 XML 문자열로 변환 (간단한 구현)
   */
  private objectToXML(obj: Record<string, unknown>, rootElement: string): string {
    // 간단한 XML 변환 (실제로는 더 복잡한 로직 필요)
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
   * HWPX 파일 파싱
   */
  private async parseHWPX(): Promise<boolean> {
    try {
      // MIME 타입 확인
      const mimeType = await this.zip.file('mimetype')?.async('string');
      if (mimeType !== 'application/hwpml-package+xml') {
        return false;
      }

      // Container 파싱
      const container = await this.zip.file('META-INF/container.xml')?.async('string');
      if (!container) {
        return false;
      }

      // Content.hpf 파싱
      const contentHPF = await this.zip.file('Contents/content.hpf')?.async('string');
      if (!contentHPF) {
        return false;
      }

      // Version 파싱
      const version = await this.zip.file('Version/version.xml')?.async('string');
      if (version) {
        this.version = version; // 문자열로 저장 (나중에 파싱 가능)
      }

      // Header 파싱
      const header = await this.zip.file('Contents/header.xml')?.async('string');
      if (header) {
        this.head = header; // 문자열로 저장 (나중에 파싱 가능)
      }

      // Sections 파싱
      let sectionIndex = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const sectionFile = await this.zip.file(`Contents/section${sectionIndex}.xml`)?.async('string');
        if (!sectionFile) {
          break;
        }
        // 문자열로 저장 (나중에 SectionType 객체로 파싱 가능)
        // 기존 섹션을 유지하기 위해 배열에 추가
        if (this.sections.length <= sectionIndex) {
          this.sections.push(sectionFile as unknown as SectionType);
        }
        sectionIndex++;
      }
      
      console.log(`[HWPXSerializer] Parsed ${this.sections.length} sections from file`);

      return true;
    } catch (error) {
      console.error('Failed to parse HWPX file:', error);
      return false;
    }
  }
}
