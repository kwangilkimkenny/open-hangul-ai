/**
 * HWPX → HWP 역변환 클래스
 *
 * HWPX (ZIP + XML) 파일을 HWP (OLE Compound Document) 형식으로 변환
 *
 * @module Core
 */

import { HwpxParser } from '../parser-hwpx';
import { DocInfoWriter } from '../writer-binary/DocInfoWriter';
import { SectionWriter } from '../writer-binary/SectionWriter';
import { OleAssembler, type BinDataEntry } from '../writer-binary/OleAssembler';
import type { HwpVersion, HwpFlags } from '../writer-binary/FileHeaderWriter';

/**
 * 변환 옵션
 */
export interface Hwpx2HwpOptions {
    /** HWP 버전 설정 */
    hwpVersion?: Partial<HwpVersion>;
    /** 파일 속성 플래그 */
    flags?: Partial<HwpFlags>;
    /** 스트림 압축 여부 (기본값: true) */
    compressStreams?: boolean;
    /** 압축 레벨 (0-9, 기본값: 6) */
    compressionLevel?: number;
    /** 진행률 콜백 */
    onProgress?: (progress: ConversionProgress) => void;
    /** 취소 신호 */
    signal?: AbortSignal;
}

/**
 * 변환 진행률
 */
export interface ConversionProgress {
    /** 현재 단계 */
    stage: 'parsing' | 'docinfo' | 'sections' | 'assembly' | 'complete';
    /** 단계 내 진행률 (0-100) */
    percent: number;
    /** 현재 작업 설명 */
    message: string;
}

/**
 * 변환 결과
 */
export interface ConversionResult {
    /** 변환된 HWP 바이너리 */
    data: Uint8Array;
    /** 변환 통계 */
    stats: {
        /** HWPX 입력 크기 */
        inputSize: number;
        /** HWP 출력 크기 */
        outputSize: number;
        /** 섹션 개수 */
        sectionCount: number;
        /** BinData 개수 */
        binDataCount: number;
        /** 변환 시간 (ms) */
        elapsedMs: number;
    };
}

/**
 * HWPX → HWP 역변환기
 *
 * @example
 * ```typescript
 * import { Hwpx2Hwp } from 'hwp2hwpx-js';
 *
 * const hwpxData = await fs.readFile('document.hwpx');
 * const result = await Hwpx2Hwp.convert(hwpxData, {
 *     onProgress: (p) => console.log(`${p.stage}: ${p.percent}%`)
 * });
 * await fs.writeFile('document.hwp', result.data);
 * ```
 */
export class Hwpx2Hwp {
    /**
     * HWPX → HWP 변환
     *
     * @param data - HWPX 파일 바이너리
     * @param options - 변환 옵션
     * @returns 변환 결과 (HWP 바이너리 + 통계)
     */
    static async convert(
        data: Uint8Array,
        options?: Hwpx2HwpOptions
    ): Promise<ConversionResult> {
        const startTime = Date.now();
        const inputSize = data.length;

        const progress = options?.onProgress || (() => {});

        // 취소 확인
        const checkAbort = () => {
            if (options?.signal?.aborted) {
                throw new Error('변환이 취소되었습니다');
            }
        };

        // 1. HWPX 파싱
        progress({ stage: 'parsing', percent: 0, message: 'HWPX 파일 파싱 중...' });
        checkAbort();

        const parser = new HwpxParser({
            extractBinData: true,
            onProgress: (stage, percent) => {
                progress({ stage: 'parsing', percent: percent * 0.3, message: `${stage}...` });
            }
        });

        const hwpxDoc = await parser.parse(data);
        progress({ stage: 'parsing', percent: 100, message: 'HWPX 파싱 완료' });

        // 2. DocInfo 스트림 생성
        progress({ stage: 'docinfo', percent: 0, message: 'DocInfo 스트림 생성 중...' });
        checkAbort();

        const docInfoWriter = new DocInfoWriter(hwpxDoc.header, hwpxDoc.binData);
        const docInfoData = docInfoWriter.generate();
        progress({ stage: 'docinfo', percent: 100, message: 'DocInfo 생성 완료' });

        // 3. Section 스트림 생성
        progress({ stage: 'sections', percent: 0, message: '섹션 스트림 생성 중...' });
        checkAbort();

        const sectionData: Uint8Array[] = [];
        for (let i = 0; i < hwpxDoc.sections.length; i++) {
            const sectionWriter = new SectionWriter(hwpxDoc.sections[i], hwpxDoc.binData);
            sectionData.push(sectionWriter.generate());

            progress({
                stage: 'sections',
                percent: ((i + 1) / hwpxDoc.sections.length) * 100,
                message: `섹션 ${i + 1}/${hwpxDoc.sections.length} 생성 중...`
            });
            checkAbort();
        }
        progress({ stage: 'sections', percent: 100, message: '섹션 생성 완료' });

        // 4. OLE 컨테이너 조립
        progress({ stage: 'assembly', percent: 0, message: 'HWP 파일 조립 중...' });
        checkAbort();

        const assembler = new OleAssembler({
            version: options?.hwpVersion,
            flags: options?.flags,
            compressStreams: options?.compressStreams ?? true,
            compressionLevel: options?.compressionLevel ?? 6
        });

        // DocInfo 추가
        assembler.addDocInfo(docInfoData);

        // 섹션 추가
        for (let i = 0; i < sectionData.length; i++) {
            assembler.addSection(i, sectionData[i]);
        }

        // BinData 추가
        const binDataEntries: BinDataEntry[] = hwpxDoc.binData.map(bd => ({
            id: bd.id,
            extension: bd.extension,
            data: bd.data,
            compress: false  // 이미지는 보통 압축 안 함
        }));
        assembler.addBinDataEntries(binDataEntries);

        // 최종 HWP 생성
        const hwpData = assembler.toBuffer();
        progress({ stage: 'assembly', percent: 100, message: 'HWP 조립 완료' });

        // 완료
        const elapsedMs = Date.now() - startTime;
        progress({ stage: 'complete', percent: 100, message: `변환 완료 (${elapsedMs}ms)` });

        return {
            data: hwpData,
            stats: {
                inputSize,
                outputSize: hwpData.length,
                sectionCount: hwpxDoc.sections.length,
                binDataCount: hwpxDoc.binData.length,
                elapsedMs
            }
        };
    }

    /**
     * 간단한 변환 (통계 없이 바이너리만 반환)
     *
     * @param data - HWPX 파일 바이너리
     * @param options - 변환 옵션
     * @returns HWP 파일 바이너리
     */
    static async convertSimple(
        data: Uint8Array,
        options?: Omit<Hwpx2HwpOptions, 'onProgress'>
    ): Promise<Uint8Array> {
        const result = await Hwpx2Hwp.convert(data, options);
        return result.data;
    }
}

/**
 * 간편 변환 함수
 *
 * @param hwpxData - HWPX 파일 바이너리
 * @param options - 변환 옵션
 * @returns HWP 파일 바이너리
 */
export async function hwpxToHwp(
    hwpxData: Uint8Array,
    options?: Hwpx2HwpOptions
): Promise<Uint8Array> {
    const result = await Hwpx2Hwp.convert(hwpxData, options);
    return result.data;
}
