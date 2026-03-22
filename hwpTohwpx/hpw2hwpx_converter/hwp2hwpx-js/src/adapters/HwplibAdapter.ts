/**
 * HwplibAdapter - hwplib-js 라이브러리 래핑 어댑터
 *
 * 기존 hwplib-js의 HWPParser, HWPTextExtractor, OLEParser 등을 래핑하여
 * IHwpParser 인터페이스를 구현
 *
 * 한계점:
 * - CharPosShape 미파싱 (runs 분리 불가)
 * - 다중 테이블 부분 지원
 * - 하이퍼링크 미지원
 */

import { OLEParser, HWPParser, HWPFile, SummaryInfoParser, HWPTextExtractor } from 'hwplib-js';
import type { ExtractedSection } from 'hwplib-js';

import { Logger } from '../util/Logger';
import { extractBinData as extractBinDataUtil, type BinDataOLEParser } from '../util/BinDataExtractor';

import type {
    IHwpParser,
    ParsedHwp,
    DocInfo,
    EnhancedSection,
    EnhancedParagraph,
    EnhancedRun,
    BinDataItem,
    SummaryInfo,
    ParserCapabilities,
    FontFace,
    BorderFill,
    CharShape,
    ParaShape,
    Style,
    Numbering,
    Bullet,
    RawDocInfo,
    TabDef,
    MemoShape,
    TrackChange,
    TrackChangeAuthor,
    DocumentProperties,
    IdMappings
} from './IHwpParser';

import { HWPLIB_CAPABILITIES } from './IHwpParser';

/**
 * Extended HWPFile interface to access docInfo property
 * Note: Doesn't extend HWPFile to avoid type incompatibility with docInfo
 */
interface HWPFileWithDocInfo {
    header?: unknown;
    docInfo?: RawDocInfo;
    binData?: Map<number, unknown>;
    sections?: ExtractedSection[];
    summaryInfo?: unknown;
    [key: string]: unknown;
}

/**
 * Extended ExtractedSection with additional properties
 * Note: Doesn't extend ExtractedSection to avoid type incompatibility with paragraphs
 */
interface ExtendedExtractedSection {
    paragraphs?: RawParagraph[];
    pageDef?: unknown;
    headerFooters?: unknown[];
    [key: string]: unknown;
}

/**
 * Raw paragraph from hwplib-js
 */
interface RawParagraph {
    text?: string;
    charShapeID?: number;
    paraShapeID?: number;
    styleID?: number;
    pageBreak?: boolean;
    columnBreak?: boolean;
    runs?: RawRun[];
    controls?: unknown[];
}

/**
 * Raw run from hwplib-js
 */
interface RawRun {
    text?: string;
    charShapeID?: number;
}

/**
 * Raw font face from hwplib-js
 */
interface RawFontFace {
    name?: string;
    fontName?: string;
    type?: number;
    familyType?: number;
    substituteFont?: string;
    defaultFont?: string;
}

/**
 * Raw border fill from hwplib-js
 */
interface RawBorderFill {
    id?: number;
    threeD?: boolean;
    shadow?: boolean;
    leftBorder?: unknown;
    rightBorder?: unknown;
    topBorder?: unknown;
    bottomBorder?: unknown;
    diagonalBorder?: unknown;
    fillInfo?: unknown;
}

/**
 * Raw char shape from hwplib-js
 */
interface RawCharShape {
    id?: number;
    fontId?: number;
    fontRatio?: number;
    fontSpacing?: number;
    fontRelSize?: number;
    fontPosition?: number;
    baseSize?: number;
    charAttr?: number;
    charColor?: number;
    underlineColor?: number;
    shadeColor?: number;
    shadowColor?: number;
    borderFillId?: number;
}

/**
 * Raw para shape from hwplib-js
 */
interface RawParaShape {
    id?: number;
    align?: number;
    lineSpacing?: number;
    lineSpacingType?: number;
    indentLeft?: number;
    indentRight?: number;
    outdent?: number;
    marginTop?: number;
    marginBottom?: number;
    tabDefId?: number;
    numberingId?: number;
    borderFillId?: number;
}

/**
 * Raw style from hwplib-js
 */
interface RawStyle {
    id?: number;
    name?: string;
    engName?: string;
    type?: number;
    nextStyleId?: number;
    langId?: number;
    paraShapeId?: number;
    charShapeId?: number;
}

/**
 * Raw numbering from hwplib-js
 */
interface RawNumbering {
    id?: number;
    start?: number;
    levelNumber?: number[];
}

/**
 * Raw bullet from hwplib-js
 */
interface RawBullet {
    id?: number;
    bulletChar?: string;
    imageBullet?: boolean;
    imageBulletId?: number;
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
 * hwplib-js 기반 HWP 파서 어댑터
 */
export class HwplibAdapter implements IHwpParser {
    readonly name = 'hwplib-js';
    readonly version = '1.0.0';
    readonly capabilities: ParserCapabilities = HWPLIB_CAPABILITIES;

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
            Logger.warn('Not an OLE file, might be HWP 5.0 uncompressed');
        }

        // 2. HWPParser로 DocInfo 파싱
        const hwpParser = new HWPParser(data);
        const hwpFile: HWPFile | null = await hwpParser.parse();

        if (!hwpFile) {
            throw new Error('HWP parsing failed');
        }

        // 3. HWPTextExtractor로 BodyText 파싱
        const textExtractor = new HWPTextExtractor(data);
        const extractedSections: ExtractedSection[] = await textExtractor.extract();

        Logger.info(`Extracted ${extractedSections.length} sections`);

        // 4. DocInfo 변환
        const docInfo = this.convertDocInfo((hwpFile as unknown as HWPFileWithDocInfo).docInfo);

        // 5. 섹션 변환
        const sections = this.convertSections(extractedSections);

        // 6. BinData 추출
        const binData = await this.extractBinData(data, isOLE);

        // 7. 요약 정보 추출
        const summaryInfo = await this.extractSummaryInfo(data, isOLE);

        return {
            docInfo,
            sections,
            binData,
            summaryInfo
        };
    }

    /**
     * DocInfo 변환
     */
    private convertDocInfo(rawDocInfo: RawDocInfo | undefined): DocInfo {
        if (!rawDocInfo) {
            return { raw: undefined };
        }

        // Type assertions for RawDocInfo properties (which have [key: string]: unknown)
        const hanFontFaceList = rawDocInfo.hanFontFaceList as RawFontFace[] | undefined;
        const enFontFaceList = rawDocInfo.enFontFaceList as RawFontFace[] | undefined;
        const hanjaFontFaceList = rawDocInfo.hanjaFontFaceList as RawFontFace[] | undefined;
        const japaneseFontFaceList = rawDocInfo.japaneseFontFaceList as RawFontFace[] | undefined;
        const etcFontFaceList = rawDocInfo.etcFontFaceList as RawFontFace[] | undefined;
        const symbolFontFaceList = rawDocInfo.symbolFontFaceList as RawFontFace[] | undefined;
        const userFontFaceList = rawDocInfo.userFontFaceList as RawFontFace[] | undefined;
        const borderFillList = rawDocInfo.borderFillList as RawBorderFill[] | undefined;
        const charShapeList = rawDocInfo.charShapeList as RawCharShape[] | undefined;
        const paraShapeList = rawDocInfo.paraShapeList as RawParaShape[] | undefined;
        const styleList = rawDocInfo.styleList as RawStyle[] | undefined;
        const numberingList = rawDocInfo.numberingList as RawNumbering[] | undefined;
        const bulletList = rawDocInfo.bulletList as RawBullet[] | undefined;
        const tabDefList = rawDocInfo.tabDefList as TabDef[] | undefined;
        const memoShapeList = rawDocInfo.memoShapeList as MemoShape[] | undefined;
        const trackChangeList = rawDocInfo.trackChangeList as TrackChange[] | undefined;
        const trackChangeAuthorList = rawDocInfo.trackChangeAuthorList as TrackChangeAuthor[] | undefined;

        return {
            documentProperties: rawDocInfo.documentProperties as DocumentProperties | undefined,
            idMappings: rawDocInfo.idMappings as IdMappings | undefined,
            hanFontFaceList: this.convertFontFaces(hanFontFaceList),
            enFontFaceList: this.convertFontFaces(enFontFaceList),
            hanjaFontFaceList: this.convertFontFaces(hanjaFontFaceList),
            japaneseFontFaceList: this.convertFontFaces(japaneseFontFaceList),
            etcFontFaceList: this.convertFontFaces(etcFontFaceList),
            symbolFontFaceList: this.convertFontFaces(symbolFontFaceList),
            userFontFaceList: this.convertFontFaces(userFontFaceList),
            borderFillList: this.convertBorderFills(borderFillList),
            charShapeList: this.convertCharShapes(charShapeList),
            paraShapeList: this.convertParaShapes(paraShapeList),
            styleList: this.convertStyles(styleList),
            numberingList: this.convertNumberings(numberingList),
            bulletList: this.convertBullets(bulletList),
            tabDefList: tabDefList,
            memoShapeList: memoShapeList,
            trackChangeList: trackChangeList,
            trackChangeAuthorList: trackChangeAuthorList,
            raw: rawDocInfo
        };
    }

    /**
     * 폰트 목록 변환
     */
    private convertFontFaces(rawList: RawFontFace[] | undefined): FontFace[] {
        if (!rawList || !Array.isArray(rawList)) return [];
        return rawList.map((f: RawFontFace) => ({
            name: f.name || f.fontName || '',
            type: f.type,
            familyType: f.familyType,
            substituteFont: f.substituteFont,
            defaultFont: f.defaultFont
        }));
    }

    /**
     * BorderFill 목록 변환
     */
    private convertBorderFills(rawList: RawBorderFill[] | undefined): BorderFill[] {
        if (!rawList || !Array.isArray(rawList)) return [];
        return rawList.map((bf: RawBorderFill, idx: number) => ({
            id: bf.id ?? idx + 1,
            threeD: bf.threeD,
            shadow: bf.shadow,
            leftBorder: bf.leftBorder as BorderFill['leftBorder'],
            rightBorder: bf.rightBorder as BorderFill['rightBorder'],
            topBorder: bf.topBorder as BorderFill['topBorder'],
            bottomBorder: bf.bottomBorder as BorderFill['bottomBorder'],
            diagonalBorder: bf.diagonalBorder as BorderFill['diagonalBorder'],
            fillInfo: bf.fillInfo as BorderFill['fillInfo']
        }));
    }

    /**
     * CharShape 목록 변환
     */
    private convertCharShapes(rawList: RawCharShape[] | undefined): CharShape[] {
        if (!rawList || !Array.isArray(rawList)) return [];
        return rawList.map((cs: RawCharShape, idx: number) => ({
            id: cs.id ?? idx,
            fontId: cs.fontId !== undefined ? [cs.fontId] : undefined,
            fontRatio: cs.fontRatio !== undefined ? [cs.fontRatio] : undefined,
            fontSpacing: cs.fontSpacing !== undefined ? [cs.fontSpacing] : undefined,
            fontRelSize: cs.fontRelSize !== undefined ? [cs.fontRelSize] : undefined,
            fontPosition: cs.fontPosition !== undefined ? [cs.fontPosition] : undefined,
            baseSize: cs.baseSize,
            charAttr: cs.charAttr,
            charColor: cs.charColor,
            underlineColor: cs.underlineColor,
            shadeColor: cs.shadeColor,
            shadowColor: cs.shadowColor,
            borderFillId: cs.borderFillId
        }));
    }

    /**
     * ParaShape 목록 변환
     */
    private convertParaShapes(rawList: RawParaShape[] | undefined): ParaShape[] {
        if (!rawList || !Array.isArray(rawList)) return [];
        return rawList.map((ps: RawParaShape, idx: number) => ({
            id: ps.id ?? idx,
            align: ps.align,
            lineSpacing: ps.lineSpacing,
            lineSpacingType: ps.lineSpacingType,
            indentLeft: ps.indentLeft,
            indentRight: ps.indentRight,
            outdent: ps.outdent,
            marginTop: ps.marginTop,
            marginBottom: ps.marginBottom,
            tabDefId: ps.tabDefId,
            numberingId: ps.numberingId,
            borderFillId: ps.borderFillId
        }));
    }

    /**
     * Style 목록 변환
     */
    private convertStyles(rawList: RawStyle[] | undefined): Style[] {
        if (!rawList || !Array.isArray(rawList)) return [];
        return rawList.map((s: RawStyle, idx: number) => ({
            id: s.id ?? idx,
            name: s.name,
            engName: s.engName,
            type: s.type,
            nextStyleId: s.nextStyleId,
            langId: s.langId,
            paraShapeId: s.paraShapeId,
            charShapeId: s.charShapeId
        }));
    }

    /**
     * Numbering 목록 변환
     */
    private convertNumberings(rawList: RawNumbering[] | undefined): Numbering[] {
        if (!rawList || !Array.isArray(rawList)) return [];
        return rawList.map((n: RawNumbering, idx: number) => ({
            id: n.id ?? idx + 1,
            start: n.start,
            levelNumber: n.levelNumber
        }));
    }

    /**
     * Bullet 목록 변환
     */
    private convertBullets(rawList: RawBullet[] | undefined): Bullet[] {
        if (!rawList || !Array.isArray(rawList)) return [];
        return rawList.map((b: RawBullet, idx: number) => ({
            id: b.id ?? idx + 1,
            bulletChar: b.bulletChar,
            imageBullet: b.imageBullet,
            imageBulletId: b.imageBulletId
        }));
    }

    /**
     * 섹션 목록 변환
     */
    private convertSections(extractedSections: ExtractedSection[]): EnhancedSection[] {
        return extractedSections.map((section: ExtractedSection, index: number) => {
            const extSection = section as unknown as ExtendedExtractedSection;
            const paragraphs = this.convertParagraphs(extSection.paragraphs || []);

            return {
                index,
                paragraphs,
                pageDef: extSection.pageDef,
                headerFooters: extSection.headerFooters
            } as EnhancedSection;
        });
    }

    /**
     * 문단 목록 변환
     */
    private convertParagraphs(rawParagraphs: RawParagraph[]): EnhancedParagraph[] {
        if (!rawParagraphs || !Array.isArray(rawParagraphs)) return [];

        return rawParagraphs.map((para: RawParagraph, index: number) => {
            // runs 변환 (hwplib-js는 CharPosShape를 미파싱하므로 단순 변환)
            const runs = this.convertRuns(para);

            // 컨트롤 변환
            const controls = para.controls || [];

            // charShapeID 보정 (hwplib-js가 1-based 반환 시 0-based로 변환)
            const rawCharShapeID = para.charShapeID ?? 0;
            const charShapeID = rawCharShapeID > 0 ? rawCharShapeID - 1 : rawCharShapeID;

            return {
                id: index,
                text: para.text || '',
                runs,
                controls,
                paraShapeID: para.paraShapeID ?? 0,
                styleID: para.styleID ?? 0,
                charShapeID,
                pageBreak: para.pageBreak ?? false,
                columnBreak: para.columnBreak ?? false
            } as EnhancedParagraph;
        });
    }

    /**
     * 텍스트 런 변환
     * hwplib-js는 CharPosShape를 파싱하지 않으므로, runs가 있으면 그대로 사용,
     * 없으면 전체 텍스트를 하나의 run으로 처리
     */
    private convertRuns(para: RawParagraph): EnhancedRun[] {
        if (para.runs && Array.isArray(para.runs) && para.runs.length > 0) {
            let position = 0;
            return para.runs.map((run: RawRun) => {
                const text = run.text || '';
                // charShapeID 보정 (hwplib-js가 1-based 반환 시 0-based로 변환)
                const rawCharShapeID = run.charShapeID ?? para.charShapeID ?? 0;
                const charShapeID = rawCharShapeID > 0 ? rawCharShapeID - 1 : rawCharShapeID;

                const enhancedRun: EnhancedRun = {
                    text,
                    charShapeID,
                    start: position,
                    length: text.length
                };
                position += text.length;
                return enhancedRun;
            });
        }

        // runs가 없으면 전체 텍스트를 하나의 run으로
        const text = para.text || '';
        const rawCharShapeID = para.charShapeID ?? 0;
        const charShapeID = rawCharShapeID > 0 ? rawCharShapeID - 1 : rawCharShapeID;

        if (text.length > 0) {
            return [{
                text,
                charShapeID,
                start: 0,
                length: text.length
            }];
        }

        return [];
    }

    /**
     * BinData 추출
     */
    private async extractBinData(data: ArrayBuffer, isOLE: boolean): Promise<Map<number, BinDataItem>> {
        if (!isOLE) return new Map<number, BinDataItem>();

        try {
            const oleParser = new OLEParser(data);
            oleParser.parse();

            const binDataMap = extractBinDataUtil(
                oleParser as unknown as BinDataOLEParser,
                (msg, e) => Logger.warn(`${msg}:`, e)
            );

            Logger.info(`Extracted ${binDataMap.size} binary files`);
            return binDataMap;
        } catch (e) {
            Logger.warn('BinData extraction failed:', e);
            return new Map<number, BinDataItem>();
        }
    }

    /**
     * 요약 정보 추출
     */
    private async extractSummaryInfo(data: ArrayBuffer, isOLE: boolean): Promise<SummaryInfo | undefined> {
        if (!isOLE) return undefined;

        try {
            const oleParser = new OLEParser(data);
            oleParser.parse();

            const summaryInfoEntry = oleParser.findEntry('Summary Information');
            if (!summaryInfoEntry) return undefined;

            const summaryData = oleParser.readStream(summaryInfoEntry);
            const summaryParser = new SummaryInfoParser(summaryData);
            const parsed = summaryParser.parse();

            const extParsed = parsed as ExtendedParsedSummary;
            return {
                title: parsed.title,
                subject: parsed.subject,
                author: parsed.author,
                keywords: parsed.keywords,
                comments: parsed.comments,
                lastAuthor: extParsed.lastAuthor,
                appName: extParsed.appName,
                createDate: extParsed.created || extParsed.createDate,
                lastSaveDate: extParsed.lastSaved || extParsed.lastSaveDate
            };
        } catch (e) {
            Logger.warn('Summary info extraction failed:', e);
            return undefined;
        }
    }
}

/**
 * 기본 어댑터 인스턴스 생성 함수
 */
export function createHwplibAdapter(): IHwpParser {
    return new HwplibAdapter();
}
