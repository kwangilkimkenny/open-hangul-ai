/**
 * RecordParser - HWP 바이너리 레코드 파서
 *
 * HWP 5.0 파일의 레코드 구조를 파싱하는 저수준 파서
 *
 * 레코드 헤더 구조 (4 또는 8 바이트):
 * - Bits 0-9 (10 bits): TagID
 * - Bits 10-19 (10 bits): Level
 * - Bits 20-31 (12 bits): Size (0xFFF이면 다음 4바이트가 크기)
 *
 * 참조: https://github.com/nicosrm/hwp-rs/blob/main/docs/hwp/5.0/record.md
 */

import { HWP_TAG_ID, type HwpRecord } from '../adapters/IHwpParser';

/**
 * HWP 레코드 파서
 */
export class RecordParser {
    private data: Uint8Array;
    private view: DataView;
    private offset: number = 0;

    constructor(data: Uint8Array) {
        this.data = data;
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    /**
     * 현재 위치에서 레코드 헤더를 파싱
     */
    parseRecordHeader(): HwpRecord | null {
        if (this.offset >= this.data.length) {
            return null;
        }

        // 최소 4바이트 필요
        if (this.offset + 4 > this.data.length) {
            return null;
        }

        const recordStart = this.offset;
        const header = this.view.getUint32(this.offset, true);

        // 레코드 헤더 파싱
        const tagId = header & 0x3FF;           // Bits 0-9
        const level = (header >> 10) & 0x3FF;   // Bits 10-19
        let size = (header >> 20) & 0xFFF;      // Bits 20-31
        let headerSize = 4;

        // Size가 0xFFF면 확장 크기 사용
        if (size === 0xFFF) {
            if (this.offset + 8 > this.data.length) {
                return null;
            }
            size = this.view.getUint32(this.offset + 4, true);
            headerSize = 8;
        }

        // 데이터 범위 검증
        if (this.offset + headerSize + size > this.data.length) {
            console.warn(`[RecordParser] Record exceeds buffer: offset=${this.offset}, headerSize=${headerSize}, size=${size}, total=${this.data.length}`);
            return null;
        }

        // 레코드 데이터 추출
        const dataStart = this.offset + headerSize;
        const recordData = this.data.slice(dataStart, dataStart + size);

        // 오프셋 이동
        this.offset = dataStart + size;

        return {
            tagId,
            level,
            size,
            data: recordData,
            headerSize,
            offset: recordStart
        };
    }

    /**
     * 모든 레코드를 파싱
     */
    parseAll(): HwpRecord[] {
        const records: HwpRecord[] = [];
        this.offset = 0;

        while (this.offset < this.data.length) {
            const record = this.parseRecordHeader();
            if (!record) break;
            records.push(record);
        }

        return records;
    }

    /**
     * 특정 TagID의 레코드만 필터링하여 파싱
     */
    parseByTag(...tagIds: number[]): HwpRecord[] {
        const tagSet = new Set(tagIds);
        return this.parseAll().filter(r => tagSet.has(r.tagId));
    }

    /**
     * 레코드를 계층 구조로 그룹화
     * 부모-자식 관계는 level 필드로 결정
     */
    parseHierarchy(): RecordNode[] {
        const records = this.parseAll();
        const roots: RecordNode[] = [];
        const stack: RecordNode[] = [];

        for (const record of records) {
            const node: RecordNode = {
                record,
                children: []
            };

            // 현재 레벨보다 높거나 같은 레벨의 노드를 스택에서 제거
            while (stack.length > 0 && stack[stack.length - 1].record.level >= record.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                // 루트 레벨
                roots.push(node);
            } else {
                // 부모의 자식으로 추가
                stack[stack.length - 1].children.push(node);
            }

            stack.push(node);
        }

        return roots;
    }

    /**
     * 현재 오프셋 가져오기
     */
    get currentOffset(): number {
        return this.offset;
    }

    /**
     * 오프셋 설정
     */
    seek(offset: number): void {
        if (offset < 0 || offset > this.data.length) {
            throw new Error(`Invalid offset: ${offset}`);
        }
        this.offset = offset;
    }

    /**
     * 남은 바이트 수
     */
    get remaining(): number {
        return this.data.length - this.offset;
    }

    /**
     * TagID를 사람이 읽을 수 있는 이름으로 변환
     */
    static getTagName(tagId: number): string {
        for (const [name, id] of Object.entries(HWP_TAG_ID)) {
            if (id === tagId) return name;
        }
        return `UNKNOWN_${tagId}`;
    }

    /**
     * 레코드 디버그 출력
     */
    static debugRecord(record: HwpRecord): string {
        const tagName = RecordParser.getTagName(record.tagId);
        return `[${tagName}] Level=${record.level}, Size=${record.size}, Offset=${record.offset}`;
    }
}

/**
 * 계층적 레코드 노드
 */
export interface RecordNode {
    record: HwpRecord;
    children: RecordNode[];
}

/**
 * 레코드 데이터 리더 유틸리티
 * 버퍼 경계 체크 및 안전한 읽기 메서드 지원
 */
export class RecordDataReader {
    private data: Uint8Array;
    private view: DataView;
    private offset: number = 0;
    private _strict: boolean;

    /**
     * @param data 읽을 데이터
     * @param strict true면 경계 초과 시 예외 발생, false면 기본값 반환
     */
    constructor(data: Uint8Array, strict: boolean = false) {
        this.data = data;
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this._strict = strict;
    }

    /**
     * 경계 체크 - 읽기 전 호출
     */
    private checkBounds(bytesNeeded: number, methodName: string): boolean {
        if (this.offset + bytesNeeded > this.data.length) {
            if (this._strict) {
                throw new BufferUnderflowError(
                    this.offset,
                    this.data.length,
                    bytesNeeded,
                    methodName
                );
            }
            return false;
        }
        return true;
    }

    // ========== 기본 읽기 메서드 (경계 체크 포함) ==========

    readUint8(): number {
        if (!this.checkBounds(1, 'readUint8')) return 0;
        const value = this.data[this.offset];
        this.offset += 1;
        return value;
    }

    readInt16(): number {
        if (!this.checkBounds(2, 'readInt16')) return 0;
        const value = this.view.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readUint16(): number {
        if (!this.checkBounds(2, 'readUint16')) return 0;
        const value = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readInt32(): number {
        if (!this.checkBounds(4, 'readInt32')) return 0;
        const value = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readUint32(): number {
        if (!this.checkBounds(4, 'readUint32')) return 0;
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readBytes(length: number): Uint8Array {
        if (!this.checkBounds(length, 'readBytes')) {
            // 가능한 만큼만 반환
            const available = Math.max(0, this.data.length - this.offset);
            const value = this.data.slice(this.offset, this.offset + available);
            this.offset = this.data.length;
            return value;
        }
        const value = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    // ========== 안전한 읽기 메서드 (기본값 반환) ==========

    /**
     * 안전한 Uint8 읽기 - 경계 초과 시 기본값 반환
     */
    safeReadUint8(defaultValue: number = 0): number {
        if (this.offset + 1 > this.data.length) return defaultValue;
        const value = this.data[this.offset];
        this.offset += 1;
        return value;
    }

    /**
     * 안전한 Int16 읽기
     */
    safeReadInt16(defaultValue: number = 0): number {
        if (this.offset + 2 > this.data.length) return defaultValue;
        const value = this.view.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    /**
     * 안전한 Uint16 읽기
     */
    safeReadUint16(defaultValue: number = 0): number {
        if (this.offset + 2 > this.data.length) return defaultValue;
        const value = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }

    /**
     * 안전한 Int32 읽기
     */
    safeReadInt32(defaultValue: number = 0): number {
        if (this.offset + 4 > this.data.length) return defaultValue;
        const value = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    /**
     * 안전한 Uint32 읽기
     */
    safeReadUint32(defaultValue: number = 0): number {
        if (this.offset + 4 > this.data.length) return defaultValue;
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    /**
     * 안전한 바이트 읽기 - 가능한 만큼만 반환
     */
    safeReadBytes(length: number): Uint8Array {
        const available = Math.min(length, this.data.length - this.offset);
        if (available <= 0) return new Uint8Array(0);
        const value = this.data.slice(this.offset, this.offset + available);
        this.offset += available;
        return value;
    }

    // ========== 검증 메서드 ==========

    /**
     * 읽기 가능 여부 확인
     */
    canRead(bytes: number): boolean {
        return this.offset + bytes <= this.data.length;
    }

    /**
     * 남은 바이트가 충분한지 확인하고 부족하면 경고 로그
     */
    ensureRemaining(bytes: number, context: string = ''): boolean {
        if (this.offset + bytes > this.data.length) {
            const ctxStr = context ? ` (${context})` : '';
            console.warn(
                `[RecordDataReader] 버퍼 부족${ctxStr}: ` +
                `필요=${bytes}, 남음=${this.remaining}, offset=${this.offset}, 전체=${this.data.length}`
            );
            return false;
        }
        return true;
    }

    // ========== HWP 특화 읽기 메서드 ==========

    /**
     * HWP 문자열 읽기 (UTF-16LE, 길이 접두사 포함)
     * 구조: [2바이트 길이] [문자 데이터]
     */
    readString(): string {
        if (!this.canRead(2)) return '';
        const charCount = this.readUint16();
        if (charCount === 0) return '';

        const bytesNeeded = charCount * 2;
        if (!this.canRead(bytesNeeded)) {
            // 가능한 만큼만 읽기
            const available = Math.floor(this.remaining / 2);
            if (available === 0) return '';
            const bytes = this.readBytes(available * 2);
            const decoder = new TextDecoder('utf-16le');
            return decoder.decode(bytes);
        }

        const bytes = this.readBytes(bytesNeeded);
        const decoder = new TextDecoder('utf-16le');
        return decoder.decode(bytes);
    }

    /**
     * 안전한 HWP 문자열 읽기
     */
    safeReadString(maxChars: number = 10000): string {
        if (!this.canRead(2)) return '';
        const charCount = this.safeReadUint16(0);
        if (charCount === 0) return '';

        // 비정상적으로 큰 문자열 방지
        const safeCharCount = Math.min(charCount, maxChars);
        const bytesNeeded = safeCharCount * 2;

        if (!this.canRead(bytesNeeded)) {
            const available = Math.floor(this.remaining / 2);
            if (available === 0) return '';
            const bytes = this.safeReadBytes(available * 2);
            const decoder = new TextDecoder('utf-16le');
            return decoder.decode(bytes);
        }

        const bytes = this.readBytes(bytesNeeded);
        const decoder = new TextDecoder('utf-16le');
        return decoder.decode(bytes);
    }

    /**
     * 고정 길이 HWP 문자열 읽기 (UTF-16LE)
     */
    readFixedString(charCount: number): string {
        if (charCount === 0) return '';
        if (!this.canRead(charCount * 2)) {
            const available = Math.floor(this.remaining / 2);
            if (available === 0) return '';
            const bytes = this.readBytes(available * 2);
            const decoder = new TextDecoder('utf-16le');
            return decoder.decode(bytes).replace(/\0+$/, '');
        }

        const bytes = this.readBytes(charCount * 2);
        const decoder = new TextDecoder('utf-16le');
        // 널 문자 제거
        return decoder.decode(bytes).replace(/\0+$/, '');
    }

    /**
     * HWP 색상 읽기 (4바이트 COLORREF)
     */
    readColor(): number {
        return this.readUint32();
    }

    /**
     * 안전한 HWP 색상 읽기
     */
    safeReadColor(defaultColor: number = 0x000000): number {
        return this.safeReadUint32(defaultColor);
    }

    /**
     * HWPUNIT 읽기 (4바이트, 1/7200 인치 단위)
     */
    readHwpUnit(): number {
        return this.readInt32();
    }

    /**
     * 안전한 HWPUNIT 읽기
     */
    safeReadHwpUnit(defaultValue: number = 0): number {
        return this.safeReadInt32(defaultValue);
    }

    /**
     * 비트 플래그 읽기
     */
    readFlags32(): number {
        return this.readUint32();
    }

    /**
     * 안전한 비트 플래그 읽기
     */
    safeReadFlags32(defaultValue: number = 0): number {
        return this.safeReadUint32(defaultValue);
    }

    // ========== 위치 제어 ==========

    skip(bytes: number): void {
        const newOffset = this.offset + bytes;
        if (newOffset > this.data.length) {
            this.offset = this.data.length;
        } else if (newOffset < 0) {
            this.offset = 0;
        } else {
            this.offset = newOffset;
        }
    }

    /**
     * 안전한 skip - 경계 내에서만 이동
     */
    safeSkip(bytes: number): number {
        const oldOffset = this.offset;
        this.skip(bytes);
        return this.offset - oldOffset;  // 실제 이동한 바이트 수
    }

    get position(): number {
        return this.offset;
    }

    set position(value: number) {
        if (value < 0) {
            this.offset = 0;
        } else if (value > this.data.length) {
            this.offset = this.data.length;
        } else {
            this.offset = value;
        }
    }

    get remaining(): number {
        return Math.max(0, this.data.length - this.offset);
    }

    get eof(): boolean {
        return this.offset >= this.data.length;
    }

    get length(): number {
        return this.data.length;
    }

    /**
     * strict 모드 설정
     */
    setStrict(strict: boolean): void {
        this._strict = strict;
    }

    /**
     * 원본 데이터 접근 (읽기 전용)
     */
    get rawData(): Uint8Array {
        return this.data;
    }
}

/**
 * 버퍼 언더플로우 오류
 */
export class BufferUnderflowError extends Error {
    public readonly offset: number;
    public readonly bufferLength: number;
    public readonly requestedBytes: number;

    constructor(
        offset: number,
        bufferLength: number,
        requestedBytes: number,
        methodName?: string
    ) {
        const methodStr = methodName ? ` in ${methodName}` : '';
        super(
            `버퍼 언더플로우${methodStr}: offset=${offset}, 요청=${requestedBytes}바이트, 버퍼크기=${bufferLength}`
        );
        this.name = 'BufferUnderflowError';
        this.offset = offset;
        this.bufferLength = bufferLength;
        this.requestedBytes = requestedBytes;
    }
}
