/**
 * EnhancedAdapter - 향상된 HWP 파서 어댑터
 *
 * hwplib-js의 OLE 파싱과 DocInfo 추출 기능을 활용하면서,
 * BodyText 파싱은 커스텀 파서를 사용하여 hwplib-js의 한계를 극복
 *
 * 개선된 기능:
 * - CharPosShape 완전 파싱 (문단 내 스타일 변경점)
 * - 모든 테이블 추출
 * - 모든 문단 추출
 * - 중첩 테이블 지원
 */

import { OLEParser, HWPParser, HWPFile, SummaryInfoParser } from 'hwplib-js';
import type { DirectoryEntry } from 'hwplib-js';

import { extractBinData as extractBinDataUtil, type BinDataOLEParser } from '../util/BinDataExtractor';
import { tryInflate } from '../wasm/CompressionHelper';

import type {
    IHwpParser,
    ParsedHwp,
    DocInfo,
    EnhancedSection,
    BinDataItem,
    SummaryInfo,
    ParserCapabilities,
    RawDocInfo,
    DocumentProperties,
    IdMappings,
    FontFace,
    BorderFill,
    CharShape,
    ParaShape,
    Style,
    Numbering,
    Bullet,
    TabDef,
    MemoShape,
    TrackChange,
    TrackChangeAuthor
} from './IHwpParser';

import { ENHANCED_CAPABILITIES } from './IHwpParser';
import { HwplibAdapter } from './HwplibAdapter';
import { BodyTextParser } from '../parser/BodyTextParser';

/**
 * Extended HWPFile interface to access docInfo property
 * Note: Doesn't extend HWPFile to avoid type incompatibility with docInfo
 */
interface HWPFileWithDocInfo {
    header?: unknown;
    docInfo?: RawDocInfo;
    binData?: Map<number, unknown>;
    sections?: unknown[];
    summaryInfo?: unknown;
    [key: string]: unknown;
}

/**
 * Extended RawDocInfo with documentProperties for compression flag
 */
interface RawDocInfoWithProperties extends RawDocInfo {
    documentProperties?: {
        property?: number;
        [key: string]: unknown;
    };
}

/**
 * Extended SummaryInfo from parser
 */
interface ExtendedParsedSummary {
    title?: string;
    subject?: string;
    author?: string;
    keywords?: string;
    comments?: string;
    lastAuthor?: string;
    appName?: string;
    created?: Date;
    createDate?: Date;
    lastSaved?: Date;
    lastSaveDate?: Date;
}

/**
 * BorderFill with fillBrush for image fill fix
 */
interface BorderFillWithBrush {
    fillBrush?: {
        type?: number;
        imgBrush?: {
            mode: number;
            binItemId: number;
            alpha: number;
        };
    };
}

/**
 * 향상된 HWP 파서 어댑터
 *
 * 하이브리드 접근: hwplib-js (OLE/DocInfo) + 커스텀 파서 (BodyText)
 */
export class EnhancedAdapter implements IHwpParser {
    readonly name = 'enhanced';
    readonly version = '1.0.0';
    readonly capabilities: ParserCapabilities = ENHANCED_CAPABILITIES;

    // hwplib-js 어댑터 (DocInfo/BinData 추출용)
    private hwplibAdapter: HwplibAdapter;

    constructor() {
        this.hwplibAdapter = new HwplibAdapter();
    }

    /**
     * HWP 파일 파싱
     */
    async parse(data: ArrayBuffer): Promise<ParsedHwp> {
        const uint8Data = new Uint8Array(data);

        // 1. OLE 검증
        if (uint8Data.byteLength < 8) {
            throw new Error('File too small');
        }

        const isOLE = uint8Data[0] === 0xD0 && uint8Data[1] === 0xCF &&
            uint8Data[2] === 0x11 && uint8Data[3] === 0xE0;

        if (!isOLE) {
            console.warn('[EnhancedAdapter] Not an OLE file, falling back to hwplib-js');
            return this.hwplibAdapter.parse(data);
        }

        // 2. OLE 파싱
        const oleParser = new OLEParser(data);
        oleParser.parse();

        // 3. DocInfo 파싱 (hwplib-js 사용)
        const hwpParser = new HWPParser(data);
        const hwpFile: HWPFile | null = await hwpParser.parse();

        if (!hwpFile) {
            throw new Error('HWP parsing failed');
        }

        // Pass oleParser to fix image fill data in borderFills
        const docInfo = this.convertDocInfo((hwpFile as unknown as HWPFileWithDocInfo).docInfo, oleParser);

        // 4. BodyText 스트림 추출 및 파싱 (커스텀 파서)
        const sections = await this.parseBodyText(oleParser, docInfo);

        // Debug: console.log(`[EnhancedAdapter] Extracted ${sections.length} sections with custom parser`);

        // 5. BinData 추출
        const binData = this.extractBinData(oleParser);

        // 6. 요약 정보 추출
        const summaryInfo = this.extractSummaryInfo(oleParser);

        return {
            docInfo,
            sections,
            binData,
            summaryInfo
        };
    }

    /**
     * BodyText 스트림 파싱
     */
    private async parseBodyText(oleParser: OLEParser, docInfo: DocInfo): Promise<EnhancedSection[]> {
        const sections: EnhancedSection[] = [];
        const directory = oleParser.getDirectory() as DirectoryEntry[];

        // BodyText 폴더 찾기
        const bodyTextRoot = directory.find((e: DirectoryEntry) => e.name === 'BodyText' && e.type === 1);

        if (!bodyTextRoot) {
            console.warn('[EnhancedAdapter] BodyText folder not found');
            return sections;
        }

        // Section 스트림 수집
        const sectionEntries: { entry: DirectoryEntry; index: number }[] = [];
        const collectSections = (entryId: number) => {
            if (entryId === 0xFFFFFFFF || entryId >= directory.length) return;
            const entry = directory[entryId];
            if (entry.type === 2 && /^Section\d+$/i.test(entry.name)) {
                const index = parseInt(entry.name.match(/Section(\d+)/i)?.[1] || '0');
                sectionEntries.push({ entry, index });
            }
            if (entry.leftSiblingId !== 0xFFFFFFFF) collectSections(entry.leftSiblingId);
            if (entry.rightSiblingId !== 0xFFFFFFFF) collectSections(entry.rightSiblingId);
        };

        if (bodyTextRoot.childId !== 0xFFFFFFFF) {
            collectSections(bodyTextRoot.childId);
        }

        // 인덱스 순으로 정렬
        sectionEntries.sort((a, b) => a.index - b.index);

        // Debug: console.log(`[EnhancedAdapter] Found ${sectionEntries.length} section streams`);

        // 각 섹션 파싱
        for (const { entry, index } of sectionEntries) {
            try {
                let streamData = oleParser.readStream(entry);

                // 압축 해제 시도 (WASM 가속 지원)
                const isCompressed = this.isDocumentCompressed(docInfo);
                if (isCompressed) {
                    streamData = tryInflate(streamData);
                }

                // 커스텀 파서로 섹션 파싱
                const bodyTextParser = new BodyTextParser(streamData, index);
                const section = bodyTextParser.parse();
                sections.push(section);

            } catch (e) {
                console.error(`[EnhancedAdapter] Failed to parse section ${index}:`, e);
            }
        }

        return sections;
    }

    /**
     * 문서 압축 여부 확인
     */
    private isDocumentCompressed(docInfo: DocInfo): boolean {
        // DocInfo의 documentProperties에서 압축 플래그 확인
        const rawDocInfo = docInfo.raw as RawDocInfoWithProperties | undefined;
        const properties = rawDocInfo?.documentProperties;
        if (properties && typeof properties.property === 'number') {
            // 속성 비트에서 압축 플래그 확인 (bit 1)
            return (properties.property & 0x02) !== 0;
        }
        // 기본적으로 압축되어 있다고 가정
        return true;
    }

    /**
     * DocInfo 변환 (hwplib-js 결과를 그대로 사용)
     */
    private convertDocInfo(rawDocInfo: RawDocInfo | undefined, oleParser?: OLEParser): DocInfo {
        if (!rawDocInfo) {
            return { raw: undefined };
        }

        // Get borderFills from hwplib-js
        let borderFillList: Map<number, BorderFillWithBrush> | BorderFillWithBrush[] | undefined =
            (rawDocInfo.borderFillList || rawDocInfo.borderFills) as
            Map<number, BorderFillWithBrush> | BorderFillWithBrush[] | undefined;

        // Fix image fill data that hwplib-js doesn't parse correctly
        // Only works with Map-based borderFillList
        if (borderFillList && oleParser && borderFillList instanceof Map) {
            borderFillList = this.fixImageFillData(borderFillList, oleParser);
        }

        // Type assertions for RawDocInfo properties (which have [key: string]: unknown)
        return {
            documentProperties: rawDocInfo.documentProperties as DocumentProperties | undefined,
            idMappings: rawDocInfo.idMappings as IdMappings | undefined,
            hanFontFaceList: rawDocInfo.hanFontFaceList as FontFace[] | undefined,
            enFontFaceList: rawDocInfo.enFontFaceList as FontFace[] | undefined,
            hanjaFontFaceList: rawDocInfo.hanjaFontFaceList as FontFace[] | undefined,
            japaneseFontFaceList: rawDocInfo.japaneseFontFaceList as FontFace[] | undefined,
            etcFontFaceList: rawDocInfo.etcFontFaceList as FontFace[] | undefined,
            symbolFontFaceList: rawDocInfo.symbolFontFaceList as FontFace[] | undefined,
            userFontFaceList: rawDocInfo.userFontFaceList as FontFace[] | undefined,
            borderFillList: borderFillList as BorderFill[] | undefined,
            charShapeList: rawDocInfo.charShapeList as CharShape[] | undefined,
            paraShapeList: rawDocInfo.paraShapeList as ParaShape[] | undefined,
            styleList: rawDocInfo.styleList as Style[] | undefined,
            numberingList: rawDocInfo.numberingList as Numbering[] | undefined,
            bulletList: rawDocInfo.bulletList as Bullet[] | undefined,
            tabDefList: rawDocInfo.tabDefList as TabDef[] | undefined,
            memoShapeList: rawDocInfo.memoShapeList as MemoShape[] | undefined,
            trackChangeList: rawDocInfo.trackChangeList as TrackChange[] | undefined,
            trackChangeAuthorList: rawDocInfo.trackChangeAuthorList as TrackChangeAuthor[] | undefined,
            raw: rawDocInfo
        };
    }

    /**
     * Fix image fill data in BorderFill records
     * hwplib-js doesn't correctly parse image fill's binDataId
     */
    private fixImageFillData(borderFills: Map<number, BorderFillWithBrush>, oleParser: OLEParser): Map<number, BorderFillWithBrush> {
        try {
            // Parse DocInfo stream to get raw BorderFill data
            const docInfoEntry = oleParser.findEntry('DocInfo');
            if (!docInfoEntry) return borderFills;

            let docInfoData = oleParser.readStream(docInfoEntry);

            // Try to decompress (WASM accelerated)
            docInfoData = tryInflate(docInfoData);

            // Parse records to find BORDER_FILL (tag 20)
            const borderFillRecords: { id: number; data: Uint8Array }[] = [];
            let offset = 0;
            let bfIndex = 0;

            while (offset < docInfoData.length) {
                if (offset + 4 > docInfoData.length) break;

                const header = docInfoData[offset] | (docInfoData[offset + 1] << 8) |
                    (docInfoData[offset + 2] << 16) | (docInfoData[offset + 3] << 24);
                const tagId = header & 0x3FF;
                let size = (header >> 20) & 0xFFF;
                offset += 4;

                if (size === 0xFFF) {
                    size = docInfoData[offset] | (docInfoData[offset + 1] << 8) |
                        (docInfoData[offset + 2] << 16) | (docInfoData[offset + 3] << 24);
                    offset += 4;
                }

                if (offset + size > docInfoData.length) break;

                if (tagId === 20) { // BORDER_FILL
                    bfIndex++;
                    borderFillRecords.push({
                        id: bfIndex, // 1-based ID
                        data: docInfoData.slice(offset, offset + size)
                    });
                }

                offset += size;
            }

            // Fix image fill data for each BorderFill with fillType=2
            for (const bfRecord of borderFillRecords) {
                const data = bfRecord.data;

                // BorderFill structure (47 bytes for image fill):
                // - 2 bytes: flags (offset 0-1)
                // - 6 bytes each: left, right, top, bottom borders (offset 2-25)
                // - 6 bytes: diagonal info (offset 26-31)
                // - 4 bytes: fillType at offset 32
                // For fillType=2 (image):
                // - 4 bytes: imageMode at offset 36
                // - 4 bytes: binDataId at offset 40

                if (data.length >= 44) {
                    const fillType = data[32] | (data[33] << 8) | (data[34] << 16) | (data[35] << 24);

                    if (fillType === 2) {
                        // Image fill - extract binDataId
                        const imageMode = data[36] | (data[37] << 8) | (data[38] << 16) | (data[39] << 24);
                        const binDataId = data[40] | (data[41] << 8) | (data[42] << 16) | (data[43] << 24);

                        // Update the borderFill in the map
                        const bf = borderFills.get(bfRecord.id);
                        if (bf) {
                            if (!bf.fillBrush) {
                                bf.fillBrush = {};
                            }
                            bf.fillBrush.type = 4; // Mark as image type for HWPX writer
                            bf.fillBrush.imgBrush = {
                                mode: imageMode,
                                binItemId: binDataId,
                                alpha: 0
                            };
                        }
                    }
                }
            }

        } catch (e) {
            console.warn('[EnhancedAdapter] Failed to fix image fill data:', e);
        }

        return borderFills;
    }

    /**
     * BinData 추출
     */
    private extractBinData(oleParser: OLEParser): Map<number, BinDataItem> {
        return extractBinDataUtil(
            oleParser as unknown as BinDataOLEParser,
            (msg, e) => console.warn(`[EnhancedAdapter] ${msg}:`, e)
        );
    }

    /**
     * 요약 정보 추출
     */
    private extractSummaryInfo(oleParser: OLEParser): SummaryInfo | undefined {
        try {
            const summaryInfoEntry = oleParser.findEntry('Summary Information');
            if (!summaryInfoEntry) return undefined;

            const summaryData = oleParser.readStream(summaryInfoEntry);
            const summaryParser = new SummaryInfoParser(summaryData);
            const parsed = summaryParser.parse();

            const extParsed = parsed as ExtendedParsedSummary;
            return {
                title: extParsed.title,
                subject: extParsed.subject,
                author: extParsed.author,
                keywords: extParsed.keywords,
                comments: extParsed.comments,
                lastAuthor: extParsed.lastAuthor,
                appName: extParsed.appName,
                createDate: extParsed.created || extParsed.createDate,
                lastSaveDate: extParsed.lastSaved || extParsed.lastSaveDate
            };
        } catch (e) {
            console.warn('[EnhancedAdapter] Summary info extraction failed:', e);
            return undefined;
        }
    }
}

/**
 * 향상된 어댑터 인스턴스 생성 함수
 */
export function createEnhancedAdapterInstance(): IHwpParser {
    return new EnhancedAdapter();
}
