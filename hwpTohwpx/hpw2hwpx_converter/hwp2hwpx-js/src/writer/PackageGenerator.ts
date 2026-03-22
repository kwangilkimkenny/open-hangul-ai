import { NAMESPACES } from '../constants/xml-namespaces';
import { StringXmlWriter } from './stream/StringXmlWriter';
import type { SummaryInfo } from '../adapters/IHwpParser';

// Re-export for backward compatibility
export { NAMESPACES };

/**
 * 문서 메타데이터 인터페이스
 */
export interface DocumentMetadata {
    title?: string;
    creator?: string;
    subject?: string;
    description?: string;
    lastSavedBy?: string;
    keywords?: string;
    createdDate?: string;
    modifiedDate?: string;
}

/**
 * SummaryInfo를 DocumentMetadata로 변환
 */
export function summaryInfoToMetadata(summaryInfo?: SummaryInfo): DocumentMetadata {
    if (!summaryInfo) return {};

    return {
        title: summaryInfo.title,
        creator: summaryInfo.author,
        subject: summaryInfo.subject,
        description: summaryInfo.comments,
        lastSavedBy: summaryInfo.lastAuthor,
        keywords: summaryInfo.keywords,
        createdDate: summaryInfo.createDate?.toISOString(),
        modifiedDate: summaryInfo.lastSaveDate?.toISOString()
    };
}

/**
 * version.xml 생성 (Hancom Office 표준 준수)
 */
export function generateVersionXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1" buildNumber="0" os="10" xmlVersion="1.5" application="Hancom Office Hangul" appVersion="1.0.0.0"/>`;
}

/**
 * META-INF/container.xml 생성 (Hancom Office 표준 준수)
 */
export function generateContainerXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/><ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/></ocf:rootfiles></ocf:container>`;
}

/**
 * META-INF/manifest.xml 생성
 */
export function generateManifestXml(_sectionCount: number = 1, _binDataList: { id: number, extension: string }[] = []): string {
    // Hancom Office uses an empty manifest.xml (self-closing tag only)
    // All file references are in content.hpf instead
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`;
}

/**
 * META-INF/container.rdf 생성 (Hancom Office 표준 필수 파일)
 * Optimized with StringBuilder
 */
export function generateContainerRdf(sectionCount: number = 1, masterPageCount: number = 0): string {
    const sb = new StringXmlWriter();

    // Header description
    sb.append(`<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/header.xml"/></rdf:Description>`);
    sb.append(`<rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/></rdf:Description>`);

    // Master page descriptions
    for (let i = 0; i < masterPageCount; i++) {
        sb.append(`<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/masterPage${i}.xml"/></rdf:Description>`);
        sb.append(`<rdf:Description rdf:about="Contents/masterPage${i}.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#MasterPageFile"/></rdf:Description>`);
    }

    // Section descriptions
    for (let i = 0; i < sectionCount; i++) {
        sb.append(`<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/section${i}.xml"/></rdf:Description>`);
        sb.append(`<rdf:Description rdf:about="Contents/section${i}.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/></rdf:Description>`);
    }

    // Document type
    sb.append(`<rdf:Description rdf:about=""><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/></rdf:Description>`);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${sb.toString()}</rdf:RDF>`;
}

/**
 * Preview/PrvText.txt 생성
 */
export function generatePrvText(text: string): string {
    return text.substring(0, 1000);
}

/**
 * settings.xml 생성 (한글 표준 구조)
 */
export function generateSettingsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/><config:config-item-set name="PrintInfo"><config:config-item name="PrintAutoFootNote" type="boolean">false</config:config-item><config:config-item name="PrintAutoHeadNote" type="boolean">false</config:config-item><config:config-item name="PrintMethod" type="short">0</config:config-item><config:config-item name="OverlapSize" type="short">0</config:config-item><config:config-item name="PrintCropMark" type="short">0</config:config-item><config:config-item name="BinderHoleType" type="short">0</config:config-item><config:config-item name="ZoomX" type="short">100</config:config-item><config:config-item name="ZoomY" type="short">100</config:config-item></config:config-item-set></ha:HWPApplicationSetting>`;
}

// MIME type lookup table for binary extensions
// Native Hancom uses "image/jpg" not "image/jpeg"
const MIME_TYPES: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpg',
    'jpeg': 'image/jpg',
    'bmp': 'image/bmp',
    'gif': 'image/gif'
};

/**
 * XML 특수문자 이스케이프
 */
function escapeXml(str: string | undefined): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Contents/content.hpf 생성 (Hancom Office 표준 준수)
 * Optimized with StringBuilder and MIME lookup table
 * @param sectionCount - 섹션 수
 * @param binDataList - BinData 목록
 * @param metadata - 문서 메타데이터 (선택)
 * @param masterPageCount - 바탕쪽 수 (선택)
 */
export function generateContentHpf(
    sectionCount: number = 1,
    binDataList: { id: number, extension: string }[] = [],
    metadata?: DocumentMetadata,
    masterPageCount: number = 0
): string {
    const now = new Date().toISOString();
    const manifestSb = new StringXmlWriter();
    const spineSb = new StringXmlWriter();

    // Metadata with fallbacks
    const title = escapeXml(metadata?.title);
    const creator = escapeXml(metadata?.creator) || 'HWP2HWPX';
    const subject = escapeXml(metadata?.subject);
    const description = escapeXml(metadata?.description);
    const lastSavedBy = escapeXml(metadata?.lastSavedBy) || 'HWP2HWPX';
    const keywords = escapeXml(metadata?.keywords);
    const createdDate = metadata?.createdDate || now;
    const modifiedDate = metadata?.modifiedDate || now;

    // Generate manifest items
    manifestSb.append(`<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>`);
    spineSb.append(`<opf:itemref idref="header" linear="yes"/>`);

    // Add master page items
    for (let i = 0; i < masterPageCount; i++) {
        manifestSb.append(`<opf:item id="masterPage${i}" href="Contents/masterPage${i}.xml" media-type="application/xml"/>`);
        spineSb.append(`<opf:itemref idref="masterPage${i}" linear="yes"/>`);
    }

    for (let i = 0; i < sectionCount; i++) {
        manifestSb.append(`<opf:item id="section${i}" href="Contents/section${i}.xml" media-type="application/xml"/>`);
        spineSb.append(`<opf:itemref idref="section${i}" linear="yes"/>`);
    }

    manifestSb.append(`<opf:item id="settings" href="settings.xml" media-type="application/xml"/>`);

    // Add BinData items - Native Hancom uses "image1", "image2" format (decimal)
    const binCount = binDataList.length;
    for (let i = 0; i < binCount; i++) {
        const bin = binDataList[i];
        const ext = bin.extension.toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';

        // Native Hancom HWPX uses "image1", "image2" format (decimal)
        const binId = 'image' + bin.id;
        manifestSb.append(`<opf:item id="${binId}" href="BinData/${binId}.${ext}" media-type="${mime}" isEmbeded="1"/>`);
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><opf:package ${NAMESPACES} version="" unique-identifier="" id=""><opf:metadata><opf:title>${title}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">${creator}</opf:meta><opf:meta name="subject" content="text">${subject}</opf:meta><opf:meta name="description" content="text">${description}</opf:meta><opf:meta name="lastsaveby" content="text">${lastSavedBy}</opf:meta><opf:meta name="CreatedDate" content="text">${createdDate}</opf:meta><opf:meta name="ModifiedDate" content="text">${modifiedDate}</opf:meta><opf:meta name="date" content="text">${modifiedDate}</opf:meta><opf:meta name="keyword" content="text">${keywords}</opf:meta></opf:metadata><opf:manifest>${manifestSb.toString()}</opf:manifest><opf:spine>${spineSb.toString()}</opf:spine></opf:package>`;
}

// Content type lookup table
const CONTENT_TYPES: Record<string, string> = {
    'xml': 'application/xml',
    'txt': 'text/plain',
    'hpf': 'application/hwpml-package+xml',
    'png': 'image/png',
    'bmp': 'image/bmp',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif'
};

/**
 * [Content_Types].xml 생성 (OOXML 호환성)
 * Optimized with lookup table and StringBuilder
 */
export function generateContentTypesXml(binDataList: { id: number, extension: string }[] = []): string {
    const extensions = new Set(['xml', 'hpf', 'txt', 'png', 'bmp', 'jpg', 'jpeg', 'gif']);

    const binCount = binDataList.length;
    for (let i = 0; i < binCount; i++) {
        extensions.add(binDataList[i].extension.toLowerCase());
    }

    const sb = new StringXmlWriter();
    for (const ext of extensions) {
        const mime = CONTENT_TYPES[ext] || 'application/xml';
        sb.append(`<Default Extension="${ext}" ContentType="${mime}"/>`);
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${sb.toString()}</Types>`;
}
