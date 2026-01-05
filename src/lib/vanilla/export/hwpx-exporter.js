/**
 * HWPX Exporter (브라우저용)
 * 
 * JSON 문서를 HWPX 파일로 변환하여 다운로드합니다.
 * 
 * @module export/hwpx-exporter
 * @version 1.0.0
 * @author HWPX Viewer Team
 */

// ✅ JSZip을 직접 import (패키지에 번들됨)
import JSZip from 'jszip';
import { JsonToXmlConverter } from './json-to-xml.js';
import { getLogger } from '../utils/logger.js';
import { HWPXError, ErrorType } from '../utils/error.js';

const logger = getLogger('HwpxExporter');

/**
 * HWPX 파일 생성 및 다운로드를 담당하는 클래스
 */
export class HwpxExporter {
    constructor() {
        this.xmlConverter = new JsonToXmlConverter();
        // JSZip은 이제 import로 로드됨
    }

    /**
     * JSON 문서를 HWPX 파일로 변환하여 다운로드
     * @param {Object} document - HWPX 문서 JSON 객체
     * @param {string} filename - 저장할 파일명 (기본값: 'document.hwpx')
     * @returns {Promise<void>}
     */
    async exportToFile(document, filename = 'document.hwpx') {
        try {
            logger.info('📦 HWPX 내보내기 시작...');
            logger.time('HWPX Export');

            // 1. HWPX 구조 생성
            const hwpxZip = await this.createHwpxZip(document);

            // 2. Blob 생성
            const blob = await hwpxZip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE'
            });

            logger.info(`✅ HWPX 생성 완료: ${blob.size.toLocaleString()} bytes`);

            // 3. 다운로드
            this.downloadBlob(blob, filename);

            logger.timeEnd('HWPX Export');
            logger.info('✅ HWPX 다운로드 완료!');

        } catch (error) {
            logger.error('❌ HWPX 내보내기 실패:', error);
            throw new HWPXError(
                ErrorType.EXPORT_ERROR,
                'HWPX 파일 내보내기에 실패했습니다',
                error
            );
        }
    }

    /**
     * JSON 문서를 HWPX ZIP 구조로 변환
     * @param {Object} document - HWPX 문서 JSON 객체
     * @returns {Promise<JSZip>} JSZip 객체
     */
    async createHwpxZip(document) {
        // JSZip은 import로 로드됨
        const zip = new JSZip();

        logger.info('  📋 1/6: mimetype 생성...');
        // 1. mimetype (압축 없이 저장)
        zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

        logger.info('  📋 2/6: version.xml 생성...');
        // 2. version.xml
        const versionXml = this.xmlConverter.generateVersionXml(document.version);
        zip.file('version.xml', versionXml, { compression: 'STORE' });

        logger.info('  📋 3/6: settings.xml 생성...');
        // 3. settings.xml
        const settingsXml = this.xmlConverter.generateSettingsXml(document.settings);
        zip.file('settings.xml', settingsXml, { compression: 'DEFLATE' });

        logger.info('  📋 4/6: Contents/header.xml 생성...');
        // 4. Contents/header.xml (원본 사용 우선)
        const headerXml = document.rawHeaderXml || this.xmlConverter.generateHeaderXml(document.header);
        zip.file('Contents/header.xml', headerXml, { compression: 'DEFLATE' });

        logger.info('  📋 5/6: Contents/section*.xml 생성...');
        // 5. Contents/section*.xml
        const sections = document.sections || [];
        sections.forEach((section, idx) => {
            const sectionXml = this.xmlConverter.generateSectionXml(section);
            zip.file(`Contents/section${idx}.xml`, sectionXml, { compression: 'DEFLATE' });
        });

        logger.info('  📋 6/8: META-INF 파일들 생성...');
        // 6. META-INF 파일들 (HWPX 표준)
        this._addMetaInfFiles(zip, sections.length);

        // 7. Preview 파일 (선택사항)
        zip.file('Preview/PrvText.txt', 'HWPX Document Preview', { compression: 'DEFLATE' });

        // 8. Contents/content.hpf (필수)
        const contentHpf = this._generateContentHpf(sections.length);
        zip.file('Contents/content.hpf', contentHpf, { compression: 'DEFLATE' });

        logger.info('  📋 7/8: BinData (이미지) 추가...');
        // 9. BinData (이미지 파일들)
        if (document.images && document.images.size > 0) {
            await this._addImages(zip, document.images);
        }

        logger.info(`  ✅ 총 ${Object.keys(zip.files).length}개 파일 생성 완료`);

        return zip;
    }

    /**
     * META-INF 파일들 추가 (HWPX 표준)
     * @param {JSZip} zip - JSZip 객체
     * @param {number} sectionCount - 섹션 개수
     */
    _addMetaInfFiles(zip, sectionCount) {
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
     * Contents/content.hpf 파일 생성
     * @param {number} sectionCount - 섹션 개수
     * @returns {string} content.hpf 내용
     */
    _generateContentHpf(sectionCount) {
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
     * Blob을 파일로 다운로드
     * @param {Blob} blob - 다운로드할 Blob
     * @param {string} filename - 파일명
     */
    downloadBlob(blob, filename) {
        // 파일명에 .hwpx 확장자가 없으면 추가
        if (!filename.toLowerCase().endsWith('.hwpx')) {
            filename += '.hwpx';
        }

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
     * 현재 문서를 HWPX로 내보내기 (간단 버전)
     * @param {Object} document - HWPX 문서 JSON 객체
     * @param {string} filename - 저장할 파일명
     * @returns {Promise<void>}
     */
    async export(document, filename = 'document.hwpx') {
        return this.exportToFile(document, filename);
    }

    /**
     * 이미지 파일들을 BinData에 추가
     * @param {JSZip} zip - JSZip 객체
     * @param {Map} images - 이미지 맵 (id -> {url, path, filename, ...})
     */
    async _addImages(zip, images) {
        logger.info(`📷 ${images.size}개 이미지 추가 중...`);
        
        for (const [imageId, imageInfo] of images.entries()) {
            try {
                const imageUrl = imageInfo.url || imageInfo;
                
                // Blob URL에서 이미지 데이터 가져오기
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                
                // 파일명 결정 (원본 파일명 또는 imageId 사용)
                const filename = imageInfo.filename || imageInfo.path || `${imageId}`;
                
                // BinData 폴더에 추가
                zip.file(`BinData/${filename}`, arrayBuffer, { binary: true });
                
                const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(2);
                logger.info(`  ✓ ${filename} 추가 완료 (${sizeKB} KB)`);
                
            } catch (error) {
                logger.error(`  ✗ ${imageId} 추가 실패:`, error);
            }
        }
    }

    /**
     * 미리보기 (Blob URL 반환)
     * @param {Object} document - HWPX 문서 JSON 객체
     * @returns {Promise<string>} Blob URL
     */
    async getPreviewUrl(document) {
        try {
            const hwpxZip = await this.createHwpxZip(document);
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

