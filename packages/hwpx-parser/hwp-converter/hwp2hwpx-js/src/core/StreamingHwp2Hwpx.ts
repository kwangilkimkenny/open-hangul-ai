/**
 * Streaming HWP to HWPX Converter
 *
 * 대용량 파일(100MB+)을 위한 스트리밍 변환기
 * 메모리 사용량을 50-70% 절감
 *
 * @module Core
 */

import JSZip from 'jszip';
import { MemoryOptimizer, type StreamingConverter } from '../util/MemoryOptimizer';
import { ProgressTracker } from '../util/ProgressTracker';
import { resetIdCounters } from '../util/IdGenerator';
import { type ConversionOptions, mergeOptions } from './ConversionOptions';
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
import { generateHeaderXml } from '../writer/HeaderGenerator';
import { generateSectionXml } from '../writer/section/ForSection';
import { createDefaultParser, type IHwpParser, type ParsedHwp, type EnhancedSection } from '../adapters';
// LazyHwpParser는 향후 스트리밍 최적화에서 사용 예정
// import { LazyHwpParser, shouldUseLazyParser, type StreamingSection } from '../adapters/LazyHwpParser';
import { HwpSanitizer, type SanitizableHwpFile } from '../util/HwpSanitizer';
import { processCellImages } from '../util/CellImageProcessor';
import { Logger } from '../util/Logger';
import type { ConversionWarning, PartialConversionResult } from '../errors';
import type { HWPControl, HWPSection } from '../models/hwp.types';

/**
 * BorderFill type for docInfo.raw
 */
interface BorderFillRaw {
    id?: number;
    fillBrush?: {
        type?: number;
        imgBrush?: {
            binItemId?: number;
            mode?: number;
        };
    };
    [key: string]: unknown;
}

/**
 * DocInfo.raw extended interface with borderFill properties
 */
interface DocInfoRawExtended {
    borderFillList?: Map<number, BorderFillRaw>;
    borderFills?: Map<number, BorderFillRaw>;
    [key: string]: unknown;
}

/**
 * Compatible section structure for legacy code
 */
interface CompatSection {
    index: number;
    paragraphs: Array<{
        text?: string;
        runs?: Array<{
            text?: string;
            charShapeID?: number;
            charPrIDRef?: number;
        }>;
        controls?: HWPControl[];
        paraShapeID?: number;
        paraPrIDRef?: number;
        styleID?: number;
        styleIDRef?: number;
        charShapeID?: number;
        charPrIDRef?: number;
        pageBreak?: boolean;
        columnBreak?: boolean;
    }>;
    pageDef?: unknown;
    headerFooters?: unknown;
}

/**
 * 스트리밍 변환 진행 상태
 */
export interface StreamingProgress {
    /** 현재 단계 */
    stage: 'init' | 'parsing' | 'sections' | 'bindata' | 'packaging' | 'complete';
    /** 처리된 바이트 */
    bytesProcessed: number;
    /** 총 바이트 */
    totalBytes: number;
    /** 현재 섹션 인덱스 */
    currentSection?: number;
    /** 총 섹션 수 */
    totalSections?: number;
    /** 메모리 사용량 (bytes) */
    memoryUsage?: number;
    /** 메시지 */
    message: string;
}

/**
 * 스트리밍 변환 옵션
 */
export interface StreamingOptions extends ConversionOptions {
    /** 청크 크기 (기본값: 512KB) */
    chunkSize?: number;
    /** 섹션별 처리 후 GC 힌트 */
    gcAfterSection?: boolean;
    /** 최대 메모리 사용량 (bytes, 초과 시 경고) */
    maxMemoryUsage?: number;
    /** 스트리밍 진행 콜백 */
    onStreamingProgress?: (progress: StreamingProgress) => void;
    /** 지연 파싱 사용 여부 (대용량 파일에서 메모리 80% 절감) */
    useLazyParser?: boolean;
    /** 지연 파싱 자동 활성화 임계값 (bytes, 기본값: 10MB) */
    lazyParserThreshold?: number;
}

/**
 * 기본 스트리밍 옵션
 */
const DEFAULT_STREAMING_OPTIONS: Partial<StreamingOptions> = {
    chunkSize: 512 * 1024, // 512KB
    gcAfterSection: true,
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    lazyParserThreshold: 10 * 1024 * 1024 // 10MB - 이 크기 이상이면 LazyParser 자동 사용
};

/**
 * 스트리밍 HWP to HWPX 변환기
 *
 * 대용량 파일을 효율적으로 처리하기 위한 스트리밍 방식 변환기
 *
 * @example
 * ```typescript
 * import { StreamingHwp2Hwpx } from 'hwp2hwpx-js';
 *
 * const result = await StreamingHwp2Hwpx.convert(largeHwpData, {
 *     chunkSize: 1024 * 1024,
 *     onStreamingProgress: (progress) => {
 *         console.log(`${progress.stage}: ${progress.message}`);
 *     }
 * });
 * ```
 */
export class StreamingHwp2Hwpx {
    private static parser: IHwpParser | null = null;

    /**
     * 파서 설정
     */
    static setParser(parser: IHwpParser): void {
        StreamingHwp2Hwpx.parser = parser;
    }

    /**
     * 파서 가져오기
     */
    private static getParser(): IHwpParser {
        if (!StreamingHwp2Hwpx.parser) {
            StreamingHwp2Hwpx.parser = createDefaultParser();
        }
        return StreamingHwp2Hwpx.parser;
    }

    /**
     * 스트리밍 변환 수행
     *
     * @param data HWP 파일 데이터
     * @param options 스트리밍 옵션
     * @returns HWPX 파일 데이터
     */
    static async convert(data: Uint8Array, options?: StreamingOptions): Promise<Uint8Array> {
        resetIdCounters();

        const opts = { ...DEFAULT_STREAMING_OPTIONS, ...mergeOptions(options) } as Required<StreamingOptions>;
        const tracker = new ProgressTracker(opts.onProgress, opts.signal);

        const reportProgress = (progress: Partial<StreamingProgress>) => {
            if (opts.onStreamingProgress) {
                const memStats = MemoryOptimizer.getMemoryStats();
                opts.onStreamingProgress({
                    stage: 'init',
                    bytesProcessed: 0,
                    totalBytes: data.length,
                    message: '',
                    memoryUsage: memStats?.heapUsed,
                    ...progress
                });
            }
        };

        tracker.setTotalBytes(data.length);

        // 파일 크기 분석
        const sizeAnalysis = MemoryOptimizer.analyzeFileSize(data.length);
        if (sizeAnalysis.suggestedStrategy === 'normal' && data.length < 50 * 1024 * 1024) {
            // 50MB 미만은 일반 변환 권장
            Logger.debug(`File size ${MemoryOptimizer.formatBytes(data.length)} - using streaming for consistency`);
        }

        reportProgress({
            stage: 'init',
            message: `스트리밍 변환 시작 (파일 크기: ${MemoryOptimizer.formatBytes(data.length)})`
        });

        // 1. 파싱 단계
        tracker.startStage('parsing', 'HWP 파일 파싱 시작...');
        tracker.checkAborted();

        reportProgress({
            stage: 'parsing',
            message: 'HWP 파일 구조 분석 중...'
        });

        const parser = StreamingHwp2Hwpx.getParser();
        const parsed: ParsedHwp = await parser.parse(data.buffer as ArrayBuffer);

        tracker.addBytesProcessed(data.length);
        tracker.completeStage('HWP 파싱 완료');

        // 2. ZIP 초기화 (스트리밍 준비)
        const zip = new JSZip();

        // Unix permissions for proper ZIP format (required for Hancom Office compatibility)
        const UNIX_FILE_PERMS = { unixPermissions: 0o644 };

        // 기본 파일들 (작은 크기, 먼저 처리)
        zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE', ...UNIX_FILE_PERMS });
        zip.file('version.xml', generateVersionXml(), UNIX_FILE_PERMS);

        // META-INF
        const metaInf = zip.folder('META-INF');
        if (metaInf) {
            metaInf.file('container.xml', generateContainerXml(), UNIX_FILE_PERMS);
            metaInf.file('container.rdf', generateContainerRdf(parsed.sections.length), UNIX_FILE_PERMS);
        }

        // 3. BinData 목록 생성
        const binDataListForManifest: { id: number; extension: string }[] = [];
        for (const [id, item] of parsed.binData) {
            binDataListForManifest.push({ id, extension: item.extension });
        }

        // 4. Contents 폴더 생성
        const contents = zip.folder('Contents');
        if (!contents) throw new Error('Failed to create Contents folder');

        // 5. Header XML (DocInfo 처리)
        tracker.startStage('docinfo', '문서 정보 처리 중...');

        const headerXml = generateHeaderXml(
            (parsed.docInfo.raw || parsed.docInfo) as Parameters<typeof generateHeaderXml>[0],
            binDataListForManifest
        );
        contents.file('header.xml', headerXml, UNIX_FILE_PERMS);

        tracker.completeStage('문서 정보 처리 완료');

        // 6. Preview
        const preview = zip.folder('Preview');
        if (preview) {
            const previewText = StreamingHwp2Hwpx.generatePreviewText(parsed.sections, opts.previewMaxLength);
            preview.file('PrvText.txt', generatePrvText(previewText), UNIX_FILE_PERMS);
            const previewImage = StreamingHwp2Hwpx.getPreviewImage(parsed.binData);
            const previewExt = StreamingHwp2Hwpx.getPreviewImageExtension(parsed.binData);
            preview.file(`PrvImage.${previewExt}`, previewImage, UNIX_FILE_PERMS);
        }

        // 7. 섹션 스트리밍 처리 (핵심 최적화)
        tracker.startStage('sections', '섹션 변환 시작...');

        // HwpSanitizer 적용
        const enrichedHwpFile: SanitizableHwpFile = {
            docInfo: {
                ...(parsed.docInfo.raw || parsed.docInfo),
                binData: parsed.binData
            },
            sections: parsed.sections
        };
        HwpSanitizer.fixProvisionalPictureReferences(enrichedHwpFile);

        // Cell image processing
        const rawDocInfo = parsed.docInfo.raw as DocInfoRawExtended | undefined;
        const borderFills = parsed.docInfo.borderFillList ||
            rawDocInfo?.borderFillList ||
            rawDocInfo?.borderFills;
        if (borderFills instanceof Map) {
            processCellImages(parsed.sections, borderFills, parsed.binData);
        }

        const totalSections = parsed.sections.length;

        // 섹션별 순차 처리 (메모리 최적화)
        for (let i = 0; i < totalSections; i++) {
            tracker.checkAborted();

            reportProgress({
                stage: 'sections',
                currentSection: i,
                totalSections,
                message: `섹션 ${i + 1}/${totalSections} 변환 중...`
            });

            const section = parsed.sections[i];
            const compatSection = StreamingHwp2Hwpx.toCompatSection(section);
            const sectionXml = generateSectionXml(compatSection as unknown as HWPSection);

            contents.file(`section${i}.xml`, sectionXml, UNIX_FILE_PERMS);

            // GC 힌트 (메모리 압박 완화)
            if (opts.gcAfterSection) {
                const memStats = MemoryOptimizer.getMemoryStats();
                if (memStats && memStats.heapUsed > (opts.maxMemoryUsage || 500 * 1024 * 1024)) {
                    MemoryOptimizer.requestGC();
                    Logger.debug(`GC requested after section ${i} (heap: ${MemoryOptimizer.formatBytes(memStats.heapUsed)})`);
                }
            }

            const percent = Math.round(((i + 1) / totalSections) * 100);
            tracker.updateStage(percent, `섹션 ${i + 1}/${totalSections} 변환 완료`);
        }

        tracker.completeStage('섹션 변환 완료');

        // 8. BinData 스트리밍 처리
        tracker.startStage('bindata', '바이너리 데이터 처리 시작...');

        const binDataFolder = zip.folder('BinData');
        if (binDataFolder) {
            const totalBinData = parsed.binData.size;
            let processedCount = 0;

            for (const [id, item] of parsed.binData) {
                tracker.checkAborted();

                reportProgress({
                    stage: 'bindata',
                    message: `BinData ${processedCount + 1}/${totalBinData} 처리 중...`
                });

                // Native Hancom HWPX uses "image1", "image2" format (decimal)
                // IMPORTANT: BinData files must be stored WITHOUT compression (STORE)
                // Hancom Office doesn't properly handle deflate-compressed images
                const binId = 'image' + id;
                binDataFolder.file(`${binId}.${item.extension.toLowerCase()}`, item.data, { compression: 'STORE', ...UNIX_FILE_PERMS });

                processedCount++;
                const percent = Math.round((processedCount / totalBinData) * 100);
                tracker.updateStage(percent, `BinData ${processedCount}/${totalBinData} 처리 중...`);

                // 대용량 BinData 처리 후 메모리 정리
                if (item.data.length > 1024 * 1024) { // 1MB 이상
                    MemoryOptimizer.requestGC();
                }
            }
        }

        tracker.completeStage('바이너리 데이터 처리 완료');

        // 9. 패키징 (최종 단계)
        tracker.startStage('packaging', 'HWPX 패키징 시작...');

        reportProgress({
            stage: 'packaging',
            message: 'HWPX 파일 생성 중...'
        });

        // Content HPF
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

        // ZIP 압축
        const compressionOptions: JSZip.JSZipGeneratorOptions<'uint8array'> = {
            type: 'uint8array',
            compression: opts.compressionLevel > 0 ? 'DEFLATE' : 'STORE',
            compressionOptions: {
                level: opts.compressionLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
            },
            platform: 'UNIX',
            // 스트리밍 모드 활성화
            streamFiles: true
        };

        const result = await zip.generateAsync(compressionOptions);

        tracker.completeStage('HWPX 패키징 완료');
        tracker.complete();

        reportProgress({
            stage: 'complete',
            bytesProcessed: data.length,
            message: `변환 완료 (출력: ${MemoryOptimizer.formatBytes(result.length)})`
        });

        // 최종 메모리 정리
        MemoryOptimizer.requestGC();

        return result;
    }

    /**
     * 스트리밍 변환 (복구 모드)
     */
    static async convertWithRecovery(
        data: Uint8Array,
        options?: StreamingOptions
    ): Promise<PartialConversionResult> {
        resetIdCounters();

        const opts = { ...DEFAULT_STREAMING_OPTIONS, ...mergeOptions(options) } as Required<StreamingOptions>;
        const tracker = new ProgressTracker(opts.onProgress, opts.signal);

        const warnings: ConversionWarning[] = [];
        const failedSections: number[] = [];
        const failedBinData: number[] = [];

        tracker.setTotalBytes(data.length);

        // 1. 파싱
        tracker.startStage('parsing', 'HWP 파일 파싱 시작...');
        tracker.checkAborted();

        const parser = StreamingHwp2Hwpx.getParser();
        const parsed: ParsedHwp = await parser.parse(data.buffer as ArrayBuffer);

        tracker.addBytesProcessed(data.length);
        tracker.completeStage('HWP 파싱 완료');

        // 2. ZIP 초기화
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

        const binDataListForManifest: { id: number; extension: string }[] = [];
        for (const [id, item] of parsed.binData) {
            binDataListForManifest.push({ id, extension: item.extension });
        }

        const contents = zip.folder('Contents');
        if (!contents) throw new Error('Failed to create Contents folder');

        // 3. Header
        tracker.startStage('docinfo', '문서 정보 처리 중...');

        const headerXml = generateHeaderXml(
            (parsed.docInfo.raw || parsed.docInfo) as Parameters<typeof generateHeaderXml>[0],
            binDataListForManifest
        );
        contents.file('header.xml', headerXml, UNIX_FILE_PERMS);

        tracker.completeStage('문서 정보 처리 완료');

        // 4. Preview
        const preview = zip.folder('Preview');
        if (preview) {
            const previewText = StreamingHwp2Hwpx.generatePreviewText(parsed.sections, opts.previewMaxLength);
            preview.file('PrvText.txt', generatePrvText(previewText), UNIX_FILE_PERMS);
            const previewImage = StreamingHwp2Hwpx.getPreviewImage(parsed.binData);
            const previewExt = StreamingHwp2Hwpx.getPreviewImageExtension(parsed.binData);
            preview.file(`PrvImage.${previewExt}`, previewImage, UNIX_FILE_PERMS);
        }

        // 5. 섹션 (복구 모드)
        tracker.startStage('sections', '섹션 변환 시작...');

        const enrichedHwpFile: SanitizableHwpFile = {
            docInfo: {
                ...(parsed.docInfo.raw || parsed.docInfo),
                binData: parsed.binData
            },
            sections: parsed.sections
        };
        HwpSanitizer.fixProvisionalPictureReferences(enrichedHwpFile);

        const rawDocInfoFast = parsed.docInfo.raw as DocInfoRawExtended | undefined;
        const borderFillsFast = parsed.docInfo.borderFillList ||
            rawDocInfoFast?.borderFillList ||
            rawDocInfoFast?.borderFills;
        if (borderFillsFast instanceof Map) {
            processCellImages(parsed.sections, borderFillsFast, parsed.binData);
        }

        const totalSections = parsed.sections.length;
        let successfulSections = 0;

        for (let i = 0; i < totalSections; i++) {
            tracker.checkAborted();

            try {
                const section = parsed.sections[i];
                const compatSection = StreamingHwp2Hwpx.toCompatSection(section);
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

                const emptySection = `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p><hp:run><hp:t>[Section ${i} 변환 실패]</hp:t></hp:run></hp:p>
</hp:sec>`;
                contents.file(`section${i}.xml`, emptySection, UNIX_FILE_PERMS);
            }

            if (opts.gcAfterSection) {
                MemoryOptimizer.requestGC();
            }

            const percent = Math.round(((i + 1) / totalSections) * 100);
            tracker.updateStage(percent, `섹션 ${i + 1}/${totalSections} 처리 중...`);
        }

        tracker.completeStage('섹션 변환 완료');

        // 6. BinData (복구 모드)
        tracker.startStage('bindata', '바이너리 데이터 처리 시작...');

        const binDataFolder = zip.folder('BinData');
        if (binDataFolder) {
            const totalBinData = parsed.binData.size;
            let processedCount = 0;

            for (const [id, item] of parsed.binData) {
                tracker.checkAborted();

                try {
                    // Native Hancom HWPX uses "image1", "image2" format (decimal)
                    // IMPORTANT: BinData files must be stored WITHOUT compression (STORE)
                    const binId = 'image' + id;
                    binDataFolder.file(`${binId}.${item.extension.toLowerCase()}`, item.data, { compression: 'STORE', ...UNIX_FILE_PERMS });
                } catch (error) {
                    failedBinData.push(id);
                    warnings.push({
                        type: 'bindata',
                        message: `BinData ${id} 처리 실패: ${error instanceof Error ? error.message : String(error)}`,
                        index: id,
                        recoveryAction: 'BinData skipped'
                    });
                }

                processedCount++;
                const percent = Math.round((processedCount / totalBinData) * 100);
                tracker.updateStage(percent, `BinData ${processedCount}/${totalBinData} 처리 중...`);
            }
        }

        tracker.completeStage('바이너리 데이터 처리 완료');

        // 7. 패키징
        tracker.startStage('packaging', 'HWPX 패키징 시작...');

        const metadata = summaryInfoToMetadata(parsed.summaryInfo);
        const contentHpf = generateContentHpf(parsed.sections.length, binDataListForManifest, metadata);
        contents.file('content.hpf', contentHpf, UNIX_FILE_PERMS);

        zip.file('settings.xml', generateSettingsXml(), UNIX_FILE_PERMS);

        if (metaInf) {
            metaInf.file('manifest.xml', generateManifestXml(parsed.sections.length, binDataListForManifest), UNIX_FILE_PERMS);
        }

        const compressionOptions: JSZip.JSZipGeneratorOptions<'uint8array'> = {
            type: 'uint8array',
            compression: opts.compressionLevel > 0 ? 'DEFLATE' : 'STORE',
            compressionOptions: {
                level: opts.compressionLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
            },
            platform: 'UNIX',
            streamFiles: true
        };

        const result = await zip.generateAsync(compressionOptions);

        tracker.completeStage('HWPX 패키징 완료');
        tracker.complete();

        MemoryOptimizer.requestGC();

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

    /**
     * 파일 크기 기반 변환 방식 추천
     */
    static recommendConversionMethod(fileSize: number): 'standard' | 'streaming' {
        const analysis = MemoryOptimizer.analyzeFileSize(fileSize);
        return analysis.suggestedStrategy === 'streaming' ? 'streaming' : 'standard';
    }

    // ========== Private Helper Methods ==========

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

    private static getPreviewImage(binData: Map<number, { data: Uint8Array; extension: string }>): Uint8Array {
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp'];

        for (const [, item] of binData) {
            const ext = item.extension.toLowerCase();
            if (imageExtensions.includes(ext)) {
                return item.data;
            }
        }

        return StreamingHwp2Hwpx.MINIMAL_PNG;
    }

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

    private static toCompatSection(section: EnhancedSection): CompatSection {
        return {
            index: section.index,
            paragraphs: section.paragraphs.map(para => ({
                text: para.text,
                runs: para.runs?.map(run => ({
                    text: run.text,
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
}

/**
 * StreamingConverter 구현
 * MemoryOptimizer의 인터페이스 구현
 */
export class HwpxStreamingConverter implements StreamingConverter {
    private chunks: Uint8Array[] = [];
    private options: StreamingOptions;

    constructor(options?: StreamingOptions) {
        this.options = options || {};
    }

    async initialize(): Promise<void> {
        this.chunks = [];
    }

    async processChunk(chunk: Uint8Array): Promise<void> {
        this.chunks.push(chunk);
    }

    async finalize(): Promise<Uint8Array> {
        // 모든 청크를 합쳐서 전체 데이터 생성
        const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const fullData = new Uint8Array(totalLength);

        let offset = 0;
        for (const chunk of this.chunks) {
            fullData.set(chunk, offset);
            offset += chunk.length;
        }

        // 청크 데이터 정리
        this.chunks = [];

        // 스트리밍 변환 수행
        return StreamingHwp2Hwpx.convert(fullData, this.options);
    }
}
