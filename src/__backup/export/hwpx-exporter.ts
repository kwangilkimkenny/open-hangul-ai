/**
 * HWPX Exporter (참조 구현 100% 포팅)
 * 
 * JSON 문서를 HWPX 파일로 변환하여 다운로드합니다.
 * 참조: ref/hwp_hwpx_viewer/src/export/hwpx-exporter.js
 * 
 * @module lib/export/hwpx-exporter
 * @version 3.0.0
 */

import JSZip from 'jszip';
import { JsonToXmlConverter } from './json-to-xml';
import { getLogger } from '../utils/logger';
import type { HWPXDocument } from '../../types/hwpx';

const logger = getLogger();

/**
 * 확장된 문서 인터페이스 (저장용 메타데이터 포함)
 */
interface ExportableDocument extends HWPXDocument {
  version?: {
    version?: string;
    major?: string;
    minor?: string;
    micro?: string;
    build?: string;
    application?: string;
  };
  settings?: {
    fontFaces?: Array<{ name: string }>;
  };
  header?: {
    fontFaces?: Array<{ name: string }>;
    borderFills?: Array<{ backgroundColor?: string }>;
    paraProps?: Array<{ align?: string }>;
    charProps?: Array<{
      fontRef?: number;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
    }>;
  };
}

/**
 * 내보내기 결과
 */
interface ExportResult {
  success: boolean;
  filename: string;
  size: number;
  message: string;
}

/**
 * HWPX 파일 생성 및 다운로드를 담당하는 클래스
 * 참조 프로젝트의 검증된 구현을 100% 포팅
 */
export class HwpxExporter {
  private xmlConverter: JsonToXmlConverter;

  constructor() {
    this.xmlConverter = new JsonToXmlConverter();
  }

  /**
   * JSON 문서를 HWPX 파일로 변환하여 다운로드
   * @param document - HWPX 문서 JSON 객체
   * @param filename - 저장할 파일명 (기본값: 'document.hwpx')
   * @returns 내보내기 결과
   */
  async exportToFile(
    document: HWPXDocument, 
    filename: string = 'document.hwpx'
  ): Promise<ExportResult> {
    try {
      logger.info('📦 HWPX 내보내기 시작...');
      logger.time('HWPX Export');

      // 1. HWPX 구조 생성
      const hwpxZip = await this.createHwpxZip(document as ExportableDocument);

      // 2. Blob 생성 (참조 구현과 동일한 압축 설정)
      const blob = await hwpxZip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE'
      });

      logger.info(`✅ HWPX 생성 완료: ${blob.size.toLocaleString()} bytes`);

      // 3. 다운로드
      this.downloadBlob(blob, filename);

      logger.timeEnd('HWPX Export');
      logger.info('✅ HWPX 다운로드 완료!');

      return {
        success: true,
        filename: this.ensureHwpxExtension(filename),
        size: blob.size,
        message: `HWPX 파일이 성공적으로 저장되었습니다.`
      };

    } catch (error) {
      logger.error('❌ HWPX 내보내기 실패:', error);
      throw new Error(
        `HWPX 파일 내보내기에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * JSON 문서를 HWPX ZIP 구조로 변환 (참조 구현 포팅)
   * @param document - HWPX 문서 JSON 객체
   * @returns JSZip 객체
   */
  async createHwpxZip(document: ExportableDocument): Promise<JSZip> {
    const zip = new JSZip();

    logger.info('  📋 1/8: mimetype 생성...');
    // 1. mimetype (압축 없이 저장 - HWPX 표준)
    zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

    logger.info('  📋 2/8: version.xml 생성...');
    // 2. version.xml (압축 없이 저장)
    const versionXml = this.xmlConverter.generateVersionXml(document.version);
    zip.file('version.xml', versionXml, { compression: 'STORE' });

    logger.info('  📋 3/8: settings.xml 생성...');
    // 3. settings.xml
    const settingsXml = this.xmlConverter.generateSettingsXml(document.settings);
    zip.file('settings.xml', settingsXml, { compression: 'DEFLATE' });

    logger.info('  📋 4/8: Contents/header.xml 생성...');
    // 4. Contents/header.xml (원본 보존 or 생성)
    const headerXml = (document as any).rawHeaderXml || this.xmlConverter.generateHeaderXml(document.header);
    if ((document as any).rawHeaderXml) {
      logger.info('    ✅ Using original header.xml');
    }
    zip.file('Contents/header.xml', headerXml, { compression: 'DEFLATE' });

    logger.info('  📋 5/8: Contents/section*.xml 생성...');
    // 5. Contents/section*.xml
    const sections = document.sections || [];
    sections.forEach((section, idx) => {
      const sectionXml = this.xmlConverter.generateSectionXml(section);
      zip.file(`Contents/section${idx}.xml`, sectionXml, { compression: 'DEFLATE' });
    });

    logger.info('  📋 6/8: Contents/content.hpf 생성...');
    // 6. Contents/content.hpf (필수)
    const contentHpf = this.generateContentHpf(sections.length);
    zip.file('Contents/content.hpf', contentHpf, { compression: 'DEFLATE' });

    logger.info('  📋 7/8: META-INF 파일들 생성...');
    // 7. META-INF 파일들 (HWPX 표준)
    this.addMetaInfFiles(zip, sections.length);

    logger.info('  📋 8/9: Preview 파일 생성...');
    // 8. Preview 파일 (선택사항)
    zip.file('Preview/PrvText.txt', 'HWPX Document Preview', { compression: 'DEFLATE' });

    logger.info('  📋 9/9: BinData (이미지) 추가...');
    // 9. 이미지 파일들 추가 (매우 중요!)
    if (document.images && document.images.size > 0) {
      logger.info(`  📷 ${document.images.size}개 이미지 추가 중...`);
      
      const imagePromises: Promise<void>[] = [];
      
      document.images.forEach((imageInfo: any, imageName: string) => {
        const promise = (async () => {
          try {
            // 이미지 정보는 { id, url, path, mimeType, size, filename } 형식
            const imageUrl = imageInfo.url || imageInfo.src;
            
            if (!imageUrl) {
              logger.warn(`    ⚠️  ${imageName} URL 없음`);
              return;
            }
            
            // Blob URL에서 실제 데이터 가져오기
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            
            // 파일명 결정 (원본 filename 사용, 확장자는 대문자로)
            let fileName = imageInfo.filename || imageInfo.path?.split('/').pop() || `${imageName}.png`;
            // HWPX 표준: 확장자를 대문자로 변환 (예: image1.PNG)
            const dotIndex = fileName.lastIndexOf('.');
            if (dotIndex > 0) {
              const name = fileName.substring(0, dotIndex);
              const ext = fileName.substring(dotIndex + 1).toUpperCase();
              fileName = `${name}.${ext}`;
            }
            
            // BinData/ 폴더에 이미지 저장 (압축 없이)
            zip.file(`BinData/${fileName}`, bytes, { 
              compression: 'STORE',  // 이미지는 압축하지 않음
              binary: true 
            });
            
            logger.info(`    ✓ ${fileName} 추가 완료 (${(bytes.length / 1024).toFixed(2)} KB)`);
          } catch (error) {
            logger.error(`    ❌ ${imageName} 추가 실패:`, error);
          }
        })();
        
        imagePromises.push(promise);
      });
      
      // 모든 이미지 처리 대기
      await Promise.all(imagePromises);
      
    } else {
      logger.info('  ℹ️  이미지 없음 (건너뜀)');
    }

    logger.info(`  ✅ 총 ${Object.keys(zip.files).length}개 파일 생성 완료`);

    return zip;
  }

  /**
   * META-INF 파일들 추가 (HWPX 표준 - 참조 구현 포팅)
   * @param zip - JSZip 객체
   * @param sectionCount - 섹션 개수
   */
  private addMetaInfFiles(zip: JSZip, sectionCount: number): void {
    // META-INF/container.xml
    const containerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">
  <ocf:rootfiles>
    <ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
    <ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/>
    <ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/>
  </ocf:rootfiles>
</ocf:container>`;
    zip.file('META-INF/container.xml', containerXml, { compression: 'DEFLATE' });

    // META-INF/manifest.xml
    const manifestXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`;
    zip.file('META-INF/manifest.xml', manifestXml, { compression: 'DEFLATE' });

    // META-INF/container.rdf
    let rdfContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`;

    // header.xml 추가
    rdfContent += `
  <rdf:Description rdf:about="">
    <ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/header.xml"/>
  </rdf:Description>
  <rdf:Description rdf:about="Contents/header.xml">
    <rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/>
  </rdf:Description>`;

    // section 파일들 추가
    for (let i = 0; i < sectionCount; i++) {
      rdfContent += `
  <rdf:Description rdf:about="">
    <ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/section${i}.xml"/>
  </rdf:Description>
  <rdf:Description rdf:about="Contents/section${i}.xml">
    <rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/>
  </rdf:Description>`;
    }

    // 문서 타입 정의
    rdfContent += `
  <rdf:Description rdf:about="">
    <rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/>
  </rdf:Description>
</rdf:RDF>`;

    zip.file('META-INF/container.rdf', rdfContent, { compression: 'DEFLATE' });
  }

  /**
   * Contents/content.hpf 파일 생성 (참조 구현 포팅)
   * @param sectionCount - 섹션 개수
   * @returns content.hpf 내용
   */
  private generateContentHpf(sectionCount: number): string {
    let contentHpf = `<?xml version="1.0" encoding="UTF-8"?>
<hpf:HwpPackageFile xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">
  <hpf:FileData>
    <hpf:File href="header.xml"/>`;

    for (let i = 0; i < sectionCount; i++) {
      contentHpf += `\n    <hpf:File href="section${i}.xml"/>`;
    }

    contentHpf += `
  </hpf:FileData>
</hpf:HwpPackageFile>`;

    return contentHpf;
  }

  /**
   * Blob을 파일로 다운로드 (참조 구현 포팅)
   * @param blob - 다운로드할 Blob
   * @param filename - 파일명
   */
  private downloadBlob(blob: Blob, filename: string): void {
    // 파일명에 .hwpx 확장자가 없으면 추가
    filename = this.ensureHwpxExtension(filename);

    // 다운로드 링크 생성
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    // DOM에 추가하고 클릭
    document.body.appendChild(link);
    link.click();

    // 정리
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    logger.info(`📥 다운로드 시작: ${filename}`);
  }

  /**
   * 파일명에 .hwpx 확장자가 있는지 확인하고 없으면 추가
   * @param filename - 파일명
   * @returns .hwpx 확장자를 포함한 파일명
   */
  private ensureHwpxExtension(filename: string): string {
    if (!filename.toLowerCase().endsWith('.hwpx')) {
      return filename + '.hwpx';
    }
    return filename;
  }

  /**
   * 현재 문서를 HWPX로 내보내기 (간단 버전)
   * @param document - HWPX 문서 JSON 객체
   * @param filename - 저장할 파일명
   * @returns 내보내기 결과
   */
  async export(document: HWPXDocument, filename: string = 'document.hwpx'): Promise<ExportResult> {
    return this.exportToFile(document, filename);
  }

  /**
   * 미리보기 (Blob URL 반환)
   * @param document - HWPX 문서 JSON 객체
   * @returns Blob URL
   */
  async getPreviewUrl(document: HWPXDocument): Promise<string> {
    try {
      const hwpxZip = await this.createHwpxZip(document as ExportableDocument);
      const blob = await hwpxZip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE'
      });
      return URL.createObjectURL(blob);
    } catch (error) {
      logger.error('미리보기 생성 실패:', error);
      throw error;
    }
  }
}

export default HwpxExporter;
