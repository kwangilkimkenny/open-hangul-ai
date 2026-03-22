/**
 * HWP2HWPX Main Converter
 *
 * 어댑터 패턴을 사용하여 HWP 파싱 라이브러리 추상화
 * - 현재: hwplib-js 어댑터 사용
 * - 향후: 향상된 커스텀 파서로 전환 가능
 *
 * @module Core
 */

import JSZip from 'jszip';

// Adapters - 추상화된 HWP 파서
import {
    createDefaultParser,
    type IHwpParser,
    type ParsedHwp,
    type EnhancedSection,
    type RawDocInfo,
    type BorderFill
} from '../adapters';

// Generators
import { generateHeaderXml } from '../writer/HeaderGenerator';
import { generateSectionXml } from '../writer/section/ForSection';
import {
    generateVersionXml,
    generateContainerXml,
    generateManifestXml,
    generateContainerRdf,
    generateContentHpf,
    generateSettingsXml,
    generatePrvText,
    summaryInfoToMetadata
} from '../writer/PackageGenerator';

// Utils
import { HwpSanitizer, type SanitizableHwpFile } from '../util/HwpSanitizer';
import { ProgressTracker } from '../util/ProgressTracker';
import { resetIdCounters } from '../util/IdGenerator';
import { processCellImages } from '../util/CellImageProcessor';
import { buildBinDataIdMap, setCurrentBinDataIdMap } from '../util/BinDataIdMapper';
import type { HWPSection } from '../models/hwp.types';

// Errors
import {
    type ConversionWarning,
    type PartialConversionResult
} from '../errors';

// Options
import {
    type ConversionOptions,
    mergeOptions
} from './ConversionOptions';

/**
 * Compat section format for legacy writer modules
 */
interface CompatSection {
    index: number;
    paragraphs: CompatParagraph[];
    pageDef?: unknown;
    headerFooters?: unknown[];
}

/**
 * Compat paragraph format for legacy writer modules
 */
interface CompatParagraph {
    text?: string;
    runs?: CompatRun[];
    controls?: unknown[];
    paraShapeID?: number;
    paraPrIDRef?: number;
    styleID?: number;
    styleIDRef?: number;
    charShapeID?: number;
    charPrIDRef?: number;
    pageBreak?: boolean;
    columnBreak?: boolean;
}

/**
 * Compat run format for legacy writer modules
 */
interface CompatRun {
    text: string;
    charShapeID: number;
    charPrIDRef: number;
}

/**
 * HWP to HWPX 변환기 메인 클래스
 *
 * HWP 5.0 바이너리 파일을 HWPX (Open XML 기반) 형식으로 변환합니다.
 *
 * @example Basic Usage
 * ```typescript
 * import { Hwp2Hwpx } from 'hwp2hwpx-js';
 * import * as fs from 'fs';
 *
 * const hwpBuffer = fs.readFileSync('document.hwp');
 * const hwpxBuffer = await Hwp2Hwpx.convert(new Uint8Array(hwpBuffer));
 * fs.writeFileSync('document.hwpx', hwpxBuffer);
 * ```
 *
 * @example Custom Parser
 * ```typescript
 * import { Hwp2Hwpx, createEnhancedParser } from 'hwp2hwpx-js';
 *
 * // 향상된 파서 설정 (CharPosShape 지원)
 * Hwp2Hwpx.setParser(createEnhancedParser());
 *
 * const result = await Hwp2Hwpx.convert(hwpData);
 * ```
 *
 * @category Core
 */
export class Hwp2Hwpx {
    // 기본 파서 (싱글톤 패턴)
    private static parser: IHwpParser | null = null;

    /**
     * 사용할 파서 설정 (선택적)
     * @param parser 커스텀 파서 인스턴스
     */
    static setParser(parser: IHwpParser): void {
        Hwp2Hwpx.parser = parser;
        // Debug: console.log(`[Hwp2Hwpx] Parser set to: ${parser.name} v${parser.version}`);
    }

    /**
     * 새 파서 인스턴스 생성 (info 명령 등에서 사용)
     */
    static createParser(): IHwpParser {
        return createDefaultParser();
    }

    /**
     * 현재 파서 가져오기 (없으면 기본 파서 생성)
     */
    private static getParser(): IHwpParser {
        if (!Hwp2Hwpx.parser) {
            Hwp2Hwpx.parser = createDefaultParser();
        }
        return Hwp2Hwpx.parser;
    }

    /**
     * HWP 파서 기능 정보 출력
     */
    static logParserCapabilities(): void {
        const parser = Hwp2Hwpx.getParser();
        // Intentionally empty - enable console.log statements for debugging
        void parser; // prevent unused variable error
    }

    /**
     * HWP 바이너리 데이터를 HWPX (ZIP) 형식으로 변환
     *
     * @param data - HWP 파일의 바이너리 데이터 (Uint8Array)
     * @param options - 변환 옵션 (선택적)
     * @returns HWPX 파일의 바이너리 데이터 (ZIP 형식)
     *
     * @throws Error - HWP 파싱 실패 또는 잘못된 형식
     * @throws Error - 변환이 취소된 경우 ('Conversion aborted')
     *
     * @example Basic
     * ```typescript
     * const hwpxBuffer = await Hwp2Hwpx.convert(hwpData);
     * ```
     *
     * @example With Progress
     * ```typescript
     * const hwpxBuffer = await Hwp2Hwpx.convert(hwpData, {
     *     onProgress: (progress) => {
     *         console.log(`${progress.stage}: ${progress.percent}%`);
     *     }
     * });
     * ```
     *
     * @example With AbortController
     * ```typescript
     * const controller = new AbortController();
     *
     * // 5초 후 취소
     * setTimeout(() => controller.abort(), 5000);
     *
     * try {
     *     const result = await Hwp2Hwpx.convert(hwpData, {
     *         signal: controller.signal
     *     });
     * } catch (e) {
     *     if (e.message === 'Conversion aborted') {
     *         console.log('변환이 취소되었습니다.');
     *     }
     * }
     * ```
     */
    static async convert(data: Uint8Array, options?: ConversionOptions): Promise<Uint8Array> {
        // 변환 세션 시작 - ID 카운터 및 binData ID 맵 초기화
        resetIdCounters();
        setCurrentBinDataIdMap(null);

        const opts = mergeOptions(options);
        const tracker = new ProgressTracker(opts.onProgress, opts.signal);

        tracker.setTotalBytes(data.length);

        // 1. 파싱 단계
        tracker.startStage('parsing', 'HWP 파일 파싱 시작...');
        tracker.checkAborted();

        const parser = Hwp2Hwpx.getParser();
        const parsed: ParsedHwp = await parser.parse(data.buffer as ArrayBuffer);

        tracker.addBytesProcessed(data.length);
        tracker.completeStage('HWP 파싱 완료');

        // 2. DocInfo 처리
        tracker.startStage('docinfo', '문서 정보 처리 중...');
        tracker.checkAborted();

        // Build binData ID remapping (native Hancom remaps IDs in BorderFill order)
        const binDataIdMap = buildBinDataIdMap(parsed);
        setCurrentBinDataIdMap(binDataIdMap);

        // Pre-compute binDataList from extracted binData for consistency
        // This list is used for header.xml, content.hpf, and manifest.xml
        // Uses remapped IDs in the order they are referenced
        const binDataListForManifest: { id: number; extension: string }[] = [];
        for (const [newId, oldId] of binDataIdMap.newToOld) {
            const item = parsed.binData.get(oldId);
            if (item) {
                binDataListForManifest.push({ id: newId, extension: item.extension });
            }
        }
        // Sort by new ID to ensure consistent ordering
        binDataListForManifest.sort((a, b) => a.id - b.id);

        const zip = new JSZip();

        // Unix permissions for proper ZIP format (required for Hancom Office compatibility)
        const UNIX_FILE_PERMS = { unixPermissions: 0o644 };

        // 기본 파일 생성
        zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE', ...UNIX_FILE_PERMS });
        zip.file('version.xml', generateVersionXml(), UNIX_FILE_PERMS);

        // META-INF
        const metaInf = zip.folder('META-INF');
        if (metaInf) {
            metaInf.file('container.xml', generateContainerXml(), UNIX_FILE_PERMS);
            metaInf.file('container.rdf', generateContainerRdf(parsed.sections.length), UNIX_FILE_PERMS);
        }

        // Preview - binData에서 첫 번째 이미지 사용
        const preview = zip.folder('Preview');
        if (preview) {
            const previewText = Hwp2Hwpx.generatePreviewText(parsed.sections, opts.previewMaxLength);
            preview.file('PrvText.txt', generatePrvText(previewText), UNIX_FILE_PERMS);
            const previewImage = Hwp2Hwpx.getPreviewImage(parsed.binData);
            const previewExt = Hwp2Hwpx.getPreviewImageExtension(parsed.binData);
            // HWPX 규격은 PrvImage.png를 기대하지만 실제 포맷은 다를 수 있음
            preview.file(`PrvImage.${previewExt}`, previewImage, UNIX_FILE_PERMS);
        }

        // Contents 폴더
        const contents = zip.folder('Contents');
        if (!contents) throw new Error('Failed to create Contents folder');

        // Header XML - pass binDataList for consistency with BinData files
        // Type assertion needed: our RawDocInfo is compatible with hwplib-js DocInfo at runtime
        const headerXml = generateHeaderXml((parsed.docInfo.raw || parsed.docInfo) as Parameters<typeof generateHeaderXml>[0], binDataListForManifest);
        contents.file('header.xml', headerXml, UNIX_FILE_PERMS);

        tracker.completeStage('문서 정보 처리 완료');

        // 3. 섹션 변환
        tracker.startStage('sections', '섹션 변환 시작...');
        tracker.checkAborted();

        // HwpSanitizer 적용
        const enrichedHwpFile: SanitizableHwpFile = {
            docInfo: {
                ...(parsed.docInfo.raw || parsed.docInfo),
                binData: parsed.binData
            },
            sections: parsed.sections
        };
        HwpSanitizer.fixProvisionalPictureReferences(enrichedHwpFile);

        // Convert cell background images to inline pictures
        // BorderFill imgBrush not fully supported by Hancom Office HWPX renderer
        const rawDocInfo = parsed.docInfo.raw as RawDocInfo | undefined;
        const borderFills: Map<number, BorderFill> | BorderFill[] | undefined =
            parsed.docInfo.borderFillList ||
            rawDocInfo?.borderFillList ||
            rawDocInfo?.borderFills;
        if (borderFills instanceof Map) {
            processCellImages(parsed.sections, borderFills, parsed.binData);
        }

        const totalSections = parsed.sections.length;

        // Parallel section generation for improved performance
        // Generate all section XMLs concurrently, then add to ZIP
        if (totalSections > 0) {
            const sectionXmls = await Promise.all(
                parsed.sections.map(async (section, i) => {
                    tracker.checkAborted();
                    const compatSection = Hwp2Hwpx.toCompatSection(section);
                    return {
                        index: i,
                        xml: generateSectionXml(compatSection as unknown as HWPSection)
                    };
                })
            );

            // Add to ZIP (must be sequential for JSZip)
            for (const { index, xml } of sectionXmls) {
                contents.file(`section${index}.xml`, xml, UNIX_FILE_PERMS);
            }

            tracker.updateStage(100, `섹션 ${totalSections}/${totalSections} 변환 완료`);
        }

        tracker.completeStage('섹션 변환 완료');

        // 4. BinData 처리 - write binary files to BinData folder
        tracker.startStage('bindata', '바이너리 데이터 처리 시작...');
        tracker.checkAborted();

        const binDataFolder = zip.folder('BinData');

        if (binDataFolder) {
            // Write binData files using remapped IDs
            const totalBinData = binDataIdMap.newToOld.size;
            let processedCount = 0;

            for (const [newId, oldId] of binDataIdMap.newToOld) {
                tracker.checkAborted();

                const item = parsed.binData.get(oldId);
                if (item) {
                    // Native Hancom HWPX uses remapped sequential IDs
                    const binId = 'image' + newId;
                    binDataFolder.file(`${binId}.${item.extension.toLowerCase()}`, item.data, UNIX_FILE_PERMS);
                }

                processedCount++;
                const percent = Math.round((processedCount / totalBinData) * 100);
                tracker.updateStage(percent, `BinData ${processedCount}/${totalBinData} 처리 중...`);
            }
        }

        tracker.completeStage('바이너리 데이터 처리 완료');

        // 5. 패키징
        tracker.startStage('packaging', 'HWPX 패키징 시작...');
        tracker.checkAborted();

        // Content HPF with metadata from SummaryInfo
        const metadata = summaryInfoToMetadata(parsed.summaryInfo);
        const contentHpf = generateContentHpf(parsed.sections.length, binDataListForManifest, metadata);
        contents.file('content.hpf', contentHpf, UNIX_FILE_PERMS);

        // Settings
        zip.file('settings.xml', generateSettingsXml(), UNIX_FILE_PERMS);

        // Manifest
        if (metaInf) {
            metaInf.file('manifest.xml', generateManifestXml(parsed.sections.length, binDataListForManifest), UNIX_FILE_PERMS);
        }

        tracker.updateStage(50, 'ZIP 생성 중...');

        // ZIP 압축 레벨 설정
        const compressionOptions: JSZip.JSZipGeneratorOptions<'uint8array'> = {
            type: 'uint8array',
            compression: opts.compressionLevel > 0 ? 'DEFLATE' : 'STORE',
            compressionOptions: {
                level: opts.compressionLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
            },
            platform: 'UNIX'
        };

        const result = await zip.generateAsync(compressionOptions);

        tracker.completeStage('HWPX 패키징 완료');
        tracker.complete();

        return result;
    }

    /**
     * 최소 1x1 투명 PNG (미리보기 이미지 플레이스홀더)
     */
    private static readonly MINIMAL_PNG = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF,
        0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
        0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    /**
     * binData에서 미리보기 이미지 추출
     * PNG 또는 JPG 형식의 첫 번째 이미지 반환
     * @param binData - BinData 맵
     * @returns 이미지 데이터 (없으면 MINIMAL_PNG)
     */
    private static getPreviewImage(binData: Map<number, { data: Uint8Array; extension: string }>): Uint8Array {
        // 이미지 확장자 목록 (우선순위순)
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp'];

        // 첫 번째 이미지 찾기
        for (const [, item] of binData) {
            const ext = item.extension.toLowerCase();
            if (imageExtensions.includes(ext)) {
                // PNG가 아닌 경우에도 그대로 반환 (브라우저/뷰어가 처리)
                return item.data;
            }
        }

        // 이미지 없으면 기본 PNG 반환
        return Hwp2Hwpx.MINIMAL_PNG;
    }

    /**
     * 이미지 확장자 판별
     * @param binData - BinData 맵
     * @returns 첫 번째 이미지의 확장자 또는 'png'
     */
    private static getPreviewImageExtension(binData: Map<number, { data: Uint8Array; extension: string }>): string {
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp'];

        for (const [, item] of binData) {
            const ext = item.extension.toLowerCase();
            if (imageExtensions.includes(ext)) {
                return ext === 'jpeg' ? 'jpg' : ext;
            }
        }

        return 'png';
    }

    /**
     * 미리보기 텍스트 생성
     *
     * @param sections - 섹션 목록
     * @param maxLength - 최대 문자 수 (기본값: 1000)
     */
    private static generatePreviewText(sections: EnhancedSection[], maxLength: number = 1000): string {
        if (sections.length === 0) return '';

        const firstSec = sections[0];
        if (!firstSec.paragraphs || firstSec.paragraphs.length === 0) return '';

        return firstSec.paragraphs
            .map(p => {
                if (p.runs && p.runs.length > 0) {
                    return p.runs.map(r => r.text || '').join('');
                }
                return p.text || '';
            })
            .join('\n')
            .substring(0, maxLength);
    }

    /**
     * EnhancedSection을 기존 writer 호환 형식으로 변환
     * (점진적 마이그레이션을 위한 호환 레이어)
     */
    private static toCompatSection(section: EnhancedSection): CompatSection {
        return {
            index: section.index,
            paragraphs: section.paragraphs.map(para => ({
                text: para.text,
                runs: para.runs?.map(run => ({
                    text: run.text,
                    // charShapeID는 이미 0-based로 보정됨 (HwplibAdapter에서)
                    charShapeID: run.charShapeID,
                    charPrIDRef: run.charShapeID
                })),
                controls: para.controls,
                paraShapeID: para.paraShapeID,
                paraPrIDRef: para.paraShapeID,
                styleID: para.styleID,
                styleIDRef: para.styleID,
                charShapeID: para.charShapeID,
                charPrIDRef: para.charShapeID,
                pageBreak: para.pageBreak,
                columnBreak: para.columnBreak
            })),
            pageDef: section.pageDef,
            headerFooters: section.headerFooters
        };
    }

    /**
     * 부분 실패 복구 변환 - 일부 섹션/데이터 실패 시에도 계속 진행
     *
     * @param data - HWP 파일의 바이너리 데이터
     * @param options - 변환 옵션
     * @returns 부분 성공 결과 (성공/실패 정보 포함)
     *
     * @example
     * ```typescript
     * const result = await Hwp2Hwpx.convertWithRecovery(hwpData);
     * if (result.warnings.length > 0) {
     *     console.log('Warnings:', result.warnings);
     * }
     * if (result.failedSections.length > 0) {
     *     console.log('Failed sections:', result.failedSections);
     * }
     * fs.writeFileSync('output.hwpx', result.data);
     * ```
     */
    static async convertWithRecovery(
        data: Uint8Array,
        options?: ConversionOptions
    ): Promise<PartialConversionResult> {
        resetIdCounters();
        setCurrentBinDataIdMap(null);

        const opts = mergeOptions(options);
        const tracker = new ProgressTracker(opts.onProgress, opts.signal);

        const warnings: ConversionWarning[] = [];
        const failedSections: number[] = [];
        const failedBinData: number[] = [];

        tracker.setTotalBytes(data.length);

        // 1. 파싱 단계
        tracker.startStage('parsing', 'HWP 파일 파싱 시작...');
        tracker.checkAborted();

        const parser = Hwp2Hwpx.getParser();
        const parsed: ParsedHwp = await parser.parse(data.buffer as ArrayBuffer);

        tracker.addBytesProcessed(data.length);
        tracker.completeStage('HWP 파싱 완료');

        // 2. DocInfo 처리
        tracker.startStage('docinfo', '문서 정보 처리 중...');
        tracker.checkAborted();

        // Build binData ID remapping (native Hancom remaps IDs in BorderFill order)
        const binDataIdMap = buildBinDataIdMap(parsed);
        setCurrentBinDataIdMap(binDataIdMap);

        const binDataListForManifest: { id: number; extension: string }[] = [];
        for (const [newId, oldId] of binDataIdMap.newToOld) {
            const item = parsed.binData.get(oldId);
            if (item) {
                binDataListForManifest.push({ id: newId, extension: item.extension });
            }
        }
        binDataListForManifest.sort((a, b) => a.id - b.id);

        const zip = new JSZip();

        // Unix permissions for proper ZIP format (required for Hancom Office compatibility)
        const UNIX_FILE_PERMS = { unixPermissions: 0o644 };

        zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE', ...UNIX_FILE_PERMS });
        zip.file('version.xml', generateVersionXml(), UNIX_FILE_PERMS);

        const metaInf = zip.folder('META-INF');
        if (metaInf) {
            metaInf.file('container.xml', generateContainerXml(), UNIX_FILE_PERMS);
            metaInf.file('container.rdf', generateContainerRdf(parsed.sections.length), UNIX_FILE_PERMS);
        }

        // Preview - binData에서 첫 번째 이미지 사용
        const preview = zip.folder('Preview');
        if (preview) {
            const previewText = Hwp2Hwpx.generatePreviewText(parsed.sections, opts.previewMaxLength);
            preview.file('PrvText.txt', generatePrvText(previewText), UNIX_FILE_PERMS);
            const previewImage = Hwp2Hwpx.getPreviewImage(parsed.binData);
            const previewExt = Hwp2Hwpx.getPreviewImageExtension(parsed.binData);
            preview.file(`PrvImage.${previewExt}`, previewImage, UNIX_FILE_PERMS);
        }

        const contents = zip.folder('Contents');
        if (!contents) throw new Error('Failed to create Contents folder');

        // Type assertion needed: our RawDocInfo is compatible with hwplib-js DocInfo at runtime
        const headerXml = generateHeaderXml((parsed.docInfo.raw || parsed.docInfo) as Parameters<typeof generateHeaderXml>[0], binDataListForManifest);
        contents.file('header.xml', headerXml, UNIX_FILE_PERMS);

        tracker.completeStage('문서 정보 처리 완료');

        // 3. 섹션 변환 (부분 실패 복구)
        tracker.startStage('sections', '섹션 변환 시작...');
        tracker.checkAborted();

        const enrichedHwpFile: SanitizableHwpFile = {
            docInfo: {
                ...(parsed.docInfo.raw || parsed.docInfo),
                binData: parsed.binData
            },
            sections: parsed.sections
        };
        HwpSanitizer.fixProvisionalPictureReferences(enrichedHwpFile);

        const rawDocInfoRecovery = parsed.docInfo.raw as RawDocInfo | undefined;
        const borderFillsRecovery: Map<number, BorderFill> | BorderFill[] | undefined =
            parsed.docInfo.borderFillList ||
            rawDocInfoRecovery?.borderFillList ||
            rawDocInfoRecovery?.borderFills;
        if (borderFillsRecovery instanceof Map) {
            processCellImages(parsed.sections, borderFillsRecovery, parsed.binData);
        }

        const totalSections = parsed.sections.length;
        let successfulSections = 0;

        for (let i = 0; i < totalSections; i++) {
            tracker.checkAborted();
            try {
                const section = parsed.sections[i];
                const compatSection = Hwp2Hwpx.toCompatSection(section);
                const sectionXml = generateSectionXml(compatSection as unknown as HWPSection);
                contents.file(`section${i}.xml`, sectionXml, UNIX_FILE_PERMS);
                successfulSections++;
            } catch (error) {
                failedSections.push(i);
                warnings.push({
                    type: 'section',
                    message: `Section ${i} 변환 실패: ${error instanceof Error ? error.message : String(error)}`,
                    index: i,
                    recoveryAction: 'Section skipped, empty placeholder used'
                });

                // 빈 섹션 플레이스홀더 생성
                const emptySection = `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p><hp:run><hp:t>[Section ${i} 변환 실패]</hp:t></hp:run></hp:p>
</hp:sec>`;
                contents.file(`section${i}.xml`, emptySection, UNIX_FILE_PERMS);
            }

            const percent = Math.round(((i + 1) / totalSections) * 100);
            tracker.updateStage(percent, `섹션 ${i + 1}/${totalSections} 처리 중...`);
        }

        tracker.completeStage('섹션 변환 완료');

        // 4. BinData 처리 (부분 실패 복구)
        tracker.startStage('bindata', '바이너리 데이터 처리 시작...');
        tracker.checkAborted();

        const binDataFolder = zip.folder('BinData');

        if (binDataFolder) {
            const totalBinData = binDataIdMap.newToOld.size;
            let processedCount = 0;

            for (const [newId, oldId] of binDataIdMap.newToOld) {
                tracker.checkAborted();

                try {
                    const item = parsed.binData.get(oldId);
                    if (item) {
                        // Native Hancom HWPX uses remapped sequential IDs
                        const binId = 'image' + newId;
                        binDataFolder.file(`${binId}.${item.extension.toLowerCase()}`, item.data, UNIX_FILE_PERMS);
                    }
                } catch (error) {
                    failedBinData.push(oldId);
                    warnings.push({
                        type: 'bindata',
                        message: `BinData ${oldId} 처리 실패: ${error instanceof Error ? error.message : String(error)}`,
                        index: oldId,
                        recoveryAction: 'BinData skipped'
                    });
                }

                processedCount++;
                const percent = Math.round((processedCount / totalBinData) * 100);
                tracker.updateStage(percent, `BinData ${processedCount}/${totalBinData} 처리 중...`);
            }
        }

        tracker.completeStage('바이너리 데이터 처리 완료');

        // 5. 패키징
        tracker.startStage('packaging', 'HWPX 패키징 시작...');
        tracker.checkAborted();

        // Content HPF with metadata from SummaryInfo
        const metadata = summaryInfoToMetadata(parsed.summaryInfo);
        const contentHpf = generateContentHpf(parsed.sections.length, binDataListForManifest, metadata);
        contents.file('content.hpf', contentHpf, UNIX_FILE_PERMS);

        zip.file('settings.xml', generateSettingsXml(), UNIX_FILE_PERMS);

        if (metaInf) {
            metaInf.file('manifest.xml', generateManifestXml(parsed.sections.length, binDataListForManifest), UNIX_FILE_PERMS);
        }

        tracker.updateStage(50, 'ZIP 생성 중...');

        const compressionOptions: JSZip.JSZipGeneratorOptions<'uint8array'> = {
            type: 'uint8array',
            compression: opts.compressionLevel > 0 ? 'DEFLATE' : 'STORE',
            compressionOptions: {
                level: opts.compressionLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
            },
            platform: 'UNIX'
        };

        const result = await zip.generateAsync(compressionOptions);

        tracker.completeStage('HWPX 패키징 완료');
        tracker.complete();

        return {
            data: result,
            success: failedSections.length === 0 && failedBinData.length === 0,
            warnings,
            failedSections,
            failedBinData,
            totalSections,
            successfulSections
        };
    }
}
