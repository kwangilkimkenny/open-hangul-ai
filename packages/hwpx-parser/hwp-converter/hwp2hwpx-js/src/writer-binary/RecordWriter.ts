/**
 * HWP 레코드 직렬화 (RecordParser의 역방향)
 *
 * HWP 레코드 형식:
 * - TagID: 10 bits (0-1023)
 * - Level: 10 bits (0-1023)
 * - Size: 12 bits (0-4095, 0xFFF면 확장 크기 사용)
 *
 * @module WriterBinary
 */

/**
 * HWP 레코드 쓰기 클래스
 *
 * 레코드 헤더(TagID, Level, Size)와 데이터를 결합하여 바이너리 스트림 생성
 */
export class RecordWriter {
    private chunks: Uint8Array[] = [];
    private totalSize: number = 0;

    /** 확장 크기 사용 임계값 */
    private static readonly EXTENDED_SIZE_THRESHOLD = 0xFFF;

    /**
     * 레코드 쓰기
     *
     * @param tagId - 레코드 태그 ID (0-1023)
     * @param level - 레코드 레벨 (0-1023, 계층 구조)
     * @param data - 레코드 데이터
     */
    writeRecord(tagId: number, level: number, data: Uint8Array): this {
        const size = data.length;

        if (size >= RecordWriter.EXTENDED_SIZE_THRESHOLD) {
            // 확장 크기: 8바이트 헤더
            this.writeExtendedHeader(tagId, level, size);
        } else {
            // 표준 크기: 4바이트 헤더
            this.writeStandardHeader(tagId, level, size);
        }

        // 데이터 추가
        this.chunks.push(data);
        this.totalSize += data.length;

        return this;
    }

    /**
     * 표준 4바이트 헤더 쓰기
     */
    private writeStandardHeader(tagId: number, level: number, size: number): void {
        const header = new Uint8Array(4);
        const view = new DataView(header.buffer);

        // 헤더 형식: [TagID:10][Level:10][Size:12]
        const headerValue =
            (tagId & 0x3FF) |
            ((level & 0x3FF) << 10) |
            ((size & 0xFFF) << 20);

        view.setUint32(0, headerValue, true); // Little-Endian

        this.chunks.push(header);
        this.totalSize += 4;
    }

    /**
     * 확장 8바이트 헤더 쓰기 (큰 레코드용)
     */
    private writeExtendedHeader(tagId: number, level: number, size: number): void {
        const header = new Uint8Array(8);
        const view = new DataView(header.buffer);

        // 첫 4바이트: Size = 0xFFF (확장 표시)
        const headerValue =
            (tagId & 0x3FF) |
            ((level & 0x3FF) << 10) |
            (0xFFF << 20);

        view.setUint32(0, headerValue, true);

        // 다음 4바이트: 실제 크기
        view.setUint32(4, size, true);

        this.chunks.push(header);
        this.totalSize += 8;
    }

    /**
     * 빈 레코드 쓰기 (데이터 없음)
     */
    writeEmptyRecord(tagId: number, level: number): this {
        return this.writeRecord(tagId, level, new Uint8Array(0));
    }

    /**
     * 다른 RecordWriter의 내용 병합
     */
    merge(other: RecordWriter): this {
        const otherBuffer = other.toBuffer();
        this.chunks.push(otherBuffer);
        this.totalSize += otherBuffer.length;
        return this;
    }

    /**
     * 현재까지의 총 크기
     */
    get size(): number {
        return this.totalSize;
    }

    /**
     * 레코드 수 (대략적, 헤더 크기 무시)
     */
    get recordCount(): number {
        return this.chunks.length;
    }

    /**
     * 결합된 버퍼 생성
     */
    toBuffer(): Uint8Array {
        const result = new Uint8Array(this.totalSize);
        let offset = 0;

        for (const chunk of this.chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    }

    /**
     * 버퍼 초기화
     */
    clear(): this {
        this.chunks = [];
        this.totalSize = 0;
        return this;
    }
}

/**
 * 레코드 헤더 파싱 (검증용)
 *
 * @param header - 4바이트 헤더
 * @returns 파싱된 헤더 정보
 */
export function parseRecordHeader(header: Uint8Array): {
    tagId: number;
    level: number;
    size: number;
    isExtended: boolean;
} {
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const value = view.getUint32(0, true);

    const tagId = value & 0x3FF;
    const level = (value >> 10) & 0x3FF;
    const size = (value >> 20) & 0xFFF;

    return {
        tagId,
        level,
        size,
        isExtended: size === 0xFFF
    };
}
