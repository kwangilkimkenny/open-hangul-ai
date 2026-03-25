/**
 * OLE Compound Document (CFB) 조립기
 *
 * HWP 파일은 OLE (CFB) 형식을 사용
 * cfb 패키지를 사용하여 OLE 컨테이너 생성
 *
 * @module WriterBinary
 */

import CFB from 'cfb';
import { CompressionHelper } from './CompressionHelper';
import { FileHeaderWriter, HwpVersion, HwpFlags, DEFAULT_HWP_VERSION, DEFAULT_HWP_FLAGS } from './FileHeaderWriter';

/**
 * BinData 항목
 */
export interface BinDataEntry {
    /** BinData ID (1-based) */
    id: number;
    /** 파일 확장자 (예: 'png', 'jpg') */
    extension: string;
    /** 바이너리 데이터 */
    data: Uint8Array;
    /** 압축 여부 (기본값: false) */
    compress?: boolean;
}

/**
 * OLE 조립 옵션
 */
export interface OleAssemblerOptions {
    /** HWP 버전 */
    version?: Partial<HwpVersion>;
    /** 파일 속성 플래그 */
    flags?: Partial<HwpFlags>;
    /** 스트림 압축 여부 (기본값: true) */
    compressStreams?: boolean;
    /** 압축 레벨 (0-9, 기본값: 6) */
    compressionLevel?: number;
}

/**
 * OLE Compound Document 조립기
 *
 * HWP 파일 구조:
 * - /FileHeader (40 bytes, 비압축)
 * - /DocInfo (압축)
 * - /BodyText/Section0, Section1... (압축)
 * - /BinData/BIN0001.ext... (선택적 압축)
 * - /\x05SummaryInformation (옵션)
 */
export class OleAssembler {
    private cfb: CFB.CFB$Container;
    private options: Required<OleAssemblerOptions>;

    constructor(options?: OleAssemblerOptions) {
        // CFB 컨테이너 생성
        this.cfb = CFB.utils.cfb_new();

        // 옵션 기본값 설정
        this.options = {
            version: { ...DEFAULT_HWP_VERSION, ...(options?.version || {}) },
            flags: { ...DEFAULT_HWP_FLAGS, ...(options?.flags || {}) },
            compressStreams: options?.compressStreams ?? true,
            compressionLevel: options?.compressionLevel ?? 6
        };

        // 압축 플래그 동기화
        if (this.options.flags) {
            (this.options.flags as HwpFlags).compressed = this.options.compressStreams;
        }
    }

    /**
     * FileHeader 스트림 추가 (자동 호출됨)
     */
    private addFileHeader(): void {
        const fileHeader = FileHeaderWriter.generate(
            this.options.version,
            this.options.flags
        );

        CFB.utils.cfb_add(this.cfb, '/FileHeader', fileHeader);
    }

    /**
     * DocInfo 스트림 추가
     *
     * @param data - DocInfo 레코드 바이너리 (비압축)
     */
    addDocInfo(data: Uint8Array): this {
        const finalData = this.options.compressStreams
            ? CompressionHelper.compress(data, { level: this.options.compressionLevel })
            : data;

        CFB.utils.cfb_add(this.cfb, '/DocInfo', finalData);
        return this;
    }

    /**
     * BodyText 섹션 스트림 추가
     *
     * @param sectionIndex - 섹션 인덱스 (0-based)
     * @param data - 섹션 레코드 바이너리 (비압축)
     */
    addSection(sectionIndex: number, data: Uint8Array): this {
        const finalData = this.options.compressStreams
            ? CompressionHelper.compress(data, { level: this.options.compressionLevel })
            : data;

        CFB.utils.cfb_add(this.cfb, `/BodyText/Section${sectionIndex}`, finalData);
        return this;
    }

    /**
     * BinData 추가
     *
     * @param entry - BinData 항목
     */
    addBinData(entry: BinDataEntry): this {
        const paddedId = entry.id.toString().padStart(4, '0');
        const filename = `BIN${paddedId}.${entry.extension}`;

        const finalData = entry.compress
            ? CompressionHelper.compress(entry.data, { level: this.options.compressionLevel })
            : entry.data;

        CFB.utils.cfb_add(this.cfb, `/BinData/${filename}`, finalData);
        return this;
    }

    /**
     * 여러 BinData 추가
     *
     * @param entries - BinData 항목 배열
     */
    addBinDataEntries(entries: BinDataEntry[]): this {
        for (const entry of entries) {
            this.addBinData(entry);
        }
        return this;
    }

    /**
     * PrvText (미리보기 텍스트) 추가
     *
     * @param text - 미리보기 텍스트
     */
    addPreviewText(text: string): this {
        // UTF-16LE로 인코딩
        const bytes = new Uint8Array(text.length * 2);
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            bytes[i * 2] = code & 0xFF;
            bytes[i * 2 + 1] = (code >> 8) & 0xFF;
        }

        CFB.utils.cfb_add(this.cfb, '/PrvText', bytes);
        return this;
    }

    /**
     * Summary Information 추가 (OLE 표준 메타데이터)
     *
     * @param info - 메타데이터
     */
    addSummaryInfo(info: {
        title?: string;
        subject?: string;
        author?: string;
        keywords?: string;
        comments?: string;
        lastAuthor?: string;
        appName?: string;
    }): this {
        // OLE Summary Information 형식으로 직렬화
        // 간단한 구현 - 필요시 확장
        const data = this.buildSummaryInfo(info);
        if (data.length > 0) {
            CFB.utils.cfb_add(this.cfb, '/\x05SummaryInformation', data);
        }
        return this;
    }

    /**
     * 최종 HWP 바이너리 생성
     *
     * @returns HWP 파일 바이너리
     */
    toBuffer(): Uint8Array {
        // FileHeader는 항상 먼저 추가
        this.addFileHeader();

        // CFB 컨테이너를 바이너리로 변환
        const output = CFB.write(this.cfb, { type: 'buffer' });

        // Node.js Buffer 또는 Uint8Array 반환
        if (output instanceof Uint8Array) {
            return output;
        }

        // Buffer를 Uint8Array로 변환
        return new Uint8Array(output);
    }

    /**
     * Summary Information 빌드 (간단한 구현)
     */
    private buildSummaryInfo(_info: {
        title?: string;
        subject?: string;
        author?: string;
        keywords?: string;
        comments?: string;
        lastAuthor?: string;
        appName?: string;
    }): Uint8Array {
        // OLE Property Set 형식은 복잡하므로 기본 구현만 제공
        // 대부분의 HWP 뷰어에서 이 정보는 선택사항
        // _info 파라미터는 향후 전체 구현 시 사용 예정

        // 필요한 경우 나중에 전체 구현 추가
        // 현재는 빈 배열 반환 (Summary Information 생략)
        return new Uint8Array(0);
    }

    /**
     * 스트림 목록 확인 (디버깅용)
     */
    getStreamList(): string[] {
        const entries: string[] = [];
        CFB.utils.cfb_gc(this.cfb);

        // CFB 엔트리 순회
        const root = this.cfb.FullPaths;
        if (root) {
            for (const path of root) {
                if (path && path !== '/') {
                    entries.push(path);
                }
            }
        }

        return entries;
    }
}

/**
 * 빠른 HWP 생성 (편의 함수)
 *
 * @param docInfo - DocInfo 레코드 바이너리
 * @param sections - 섹션 레코드 바이너리 배열
 * @param binData - BinData 배열 (옵션)
 * @param options - 조립 옵션
 * @returns HWP 파일 바이너리
 */
export function buildHwpFile(
    docInfo: Uint8Array,
    sections: Uint8Array[],
    binData?: BinDataEntry[],
    options?: OleAssemblerOptions
): Uint8Array {
    const assembler = new OleAssembler(options);

    // DocInfo 추가
    assembler.addDocInfo(docInfo);

    // 섹션 추가
    for (let i = 0; i < sections.length; i++) {
        assembler.addSection(i, sections[i]);
    }

    // BinData 추가
    if (binData && binData.length > 0) {
        assembler.addBinDataEntries(binData);
    }

    return assembler.toBuffer();
}
