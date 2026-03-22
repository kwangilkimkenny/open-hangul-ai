/**
 * HWP 스트림 압축/해제 유틸리티
 *
 * HWP 파일의 DocInfo, BodyText 스트림은 Deflate로 압축됨
 *
 * @module WriterBinary
 */

import pako from 'pako';

/**
 * 압축 옵션
 */
export interface CompressionOptions {
    /** 압축 레벨 (0-9, 기본값: 6) */
    level?: number;
}

/**
 * HWP 스트림 압축/해제 헬퍼
 */
export class CompressionHelper {
    /**
     * 데이터 압축 (Raw Deflate)
     *
     * HWP는 Raw Deflate (zlib 헤더 없음) 사용
     *
     * @param data - 원본 데이터
     * @param options - 압축 옵션
     * @returns 압축된 데이터
     */
    static compress(data: Uint8Array, options?: CompressionOptions): Uint8Array {
        const level = (options?.level ?? 6) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

        try {
            // Raw Deflate (no zlib header)
            return pako.deflateRaw(data, { level });
        } catch (error) {
            throw new Error(`Compression failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 데이터 해제 (Raw Inflate)
     *
     * @param data - 압축된 데이터
     * @returns 원본 데이터
     */
    static decompress(data: Uint8Array): Uint8Array {
        try {
            // Try Raw Inflate first
            return pako.inflateRaw(data);
        } catch {
            try {
                // Fallback to zlib inflate
                return pako.inflate(data);
            } catch (error) {
                throw new Error(`Decompression failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    /**
     * 압축 여부 확인 (휴리스틱)
     *
     * HWP 레코드의 첫 바이트로 압축 여부 추정
     *
     * @param data - 데이터
     * @returns 압축된 것으로 추정되면 true
     */
    static isCompressed(data: Uint8Array): boolean {
        if (data.length < 4) {
            return false;
        }

        // HWP 레코드의 첫 4바이트가 유효한 헤더인지 확인
        // 압축되지 않은 데이터는 TagID가 16-99 범위 내
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const header = view.getUint32(0, true);
        const tagId = header & 0x3FF;

        // 유효한 TagID 범위: 16 (DOCUMENT_PROPERTIES) ~ 99
        // 압축된 데이터는 이 범위를 벗어날 확률이 높음
        if (tagId >= 16 && tagId < 100) {
            return false; // 아마 압축 안 됨
        }

        return true; // 아마 압축됨
    }

    /**
     * 스마트 해제 (압축 여부 자동 감지)
     *
     * @param data - 데이터 (압축 또는 비압축)
     * @returns 압축 해제된 데이터
     */
    static smartDecompress(data: Uint8Array): Uint8Array {
        if (!this.isCompressed(data)) {
            return data;
        }
        return this.decompress(data);
    }

    /**
     * 압축률 계산
     *
     * @param original - 원본 크기
     * @param compressed - 압축 크기
     * @returns 압축률 (0-1, 0.5 = 50% 감소)
     */
    static compressionRatio(original: number, compressed: number): number {
        if (original === 0) return 0;
        return 1 - (compressed / original);
    }
}
