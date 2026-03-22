/**
 * HWP 레코드 데이터 바이너리 쓰기 유틸리티
 *
 * RecordParser의 역방향 - 데이터 타입을 바이너리로 직렬화
 *
 * @module WriterBinary
 */

/**
 * 바이너리 데이터 쓰기 유틸리티
 *
 * HWP 레코드의 데이터 부분을 생성하는 저수준 클래스
 */
export class RecordDataWriter {
    private buffer: number[] = [];

    /**
     * 8비트 부호 없는 정수 쓰기
     */
    writeUint8(value: number): this {
        this.buffer.push(value & 0xFF);
        return this;
    }

    /**
     * 8비트 부호 있는 정수 쓰기
     */
    writeInt8(value: number): this {
        this.buffer.push(value & 0xFF);
        return this;
    }

    /**
     * 16비트 부호 없는 정수 쓰기 (Little-Endian)
     */
    writeUint16(value: number): this {
        this.buffer.push(value & 0xFF);
        this.buffer.push((value >> 8) & 0xFF);
        return this;
    }

    /**
     * 16비트 부호 있는 정수 쓰기 (Little-Endian)
     */
    writeInt16(value: number): this {
        this.buffer.push(value & 0xFF);
        this.buffer.push((value >> 8) & 0xFF);
        return this;
    }

    /**
     * 32비트 부호 없는 정수 쓰기 (Little-Endian)
     */
    writeUint32(value: number): this {
        this.buffer.push(value & 0xFF);
        this.buffer.push((value >> 8) & 0xFF);
        this.buffer.push((value >> 16) & 0xFF);
        this.buffer.push((value >> 24) & 0xFF);
        return this;
    }

    /**
     * 32비트 부호 있는 정수 쓰기 (Little-Endian)
     */
    writeInt32(value: number): this {
        this.writeUint32(value);
        return this;
    }

    /**
     * 64비트 배정밀도 부동소수점 쓰기 (Little-Endian, IEEE 754)
     */
    writeDouble(value: number): this {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setFloat64(0, value, true);  // little-endian
        for (let i = 0; i < 8; i++) {
            this.buffer.push(view.getUint8(i));
        }
        return this;
    }

    /**
     * 바이트 배열 쓰기
     */
    writeBytes(data: Uint8Array | number[]): this {
        for (const byte of data) {
            this.buffer.push(byte & 0xFF);
        }
        return this;
    }

    /**
     * 지정된 길이만큼 0으로 채우기
     */
    writeZeros(count: number): this {
        for (let i = 0; i < count; i++) {
            this.buffer.push(0);
        }
        return this;
    }

    /**
     * HWP 문자열 쓰기 (UTF-16LE, 길이 접두사)
     *
     * 형식: [charCount: uint16][UTF-16LE chars]
     */
    writeString(str: string): this {
        const charCount = str.length;
        this.writeUint16(charCount);

        for (let i = 0; i < charCount; i++) {
            this.writeUint16(str.charCodeAt(i));
        }
        return this;
    }

    /**
     * 고정 길이 문자열 쓰기 (UTF-16LE)
     *
     * 지정된 문자 수만큼 쓰고 나머지는 0으로 채움
     */
    writeFixedString(str: string, charCount: number): this {
        for (let i = 0; i < charCount; i++) {
            const code = i < str.length ? str.charCodeAt(i) : 0;
            this.writeUint16(code);
        }
        return this;
    }

    /**
     * 널 종료 문자열 쓰기 (UTF-16LE)
     */
    writeNullTerminatedString(str: string): this {
        for (let i = 0; i < str.length; i++) {
            this.writeUint16(str.charCodeAt(i));
        }
        this.writeUint16(0); // Null terminator
        return this;
    }

    /**
     * HWPUNIT 값 쓰기 (32비트 정수)
     *
     * 1 HWPUNIT = 1/7200 inch
     */
    writeHwpUnit(value: number): this {
        this.writeInt32(Math.round(value));
        return this;
    }

    /**
     * HWPUNIT16 값 쓰기 (16비트 정수)
     */
    writeHwpUnit16(value: number): this {
        this.writeInt16(Math.round(value));
        return this;
    }

    /**
     * 색상 쓰기 (COLORREF - 4바이트 BGR)
     *
     * HWP는 Windows COLORREF 형식 사용: 0x00BBGGRR
     */
    writeColor(color: number): this {
        this.writeUint32(color);
        return this;
    }

    /**
     * #RRGGBB 형식 색상을 COLORREF로 변환하여 쓰기
     */
    writeColorFromHex(hexColor: string): this {
        // #RRGGBB -> COLORREF (0x00BBGGRR)
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const colorRef = (b << 16) | (g << 8) | r;
        this.writeUint32(colorRef);
        return this;
    }

    /**
     * 부울 값 쓰기 (1바이트)
     */
    writeBool(value: boolean): this {
        this.writeUint8(value ? 1 : 0);
        return this;
    }

    /**
     * 컨트롤 ID 쓰기 (4바이트 문자열)
     *
     * HWP 형식: "gso " -> 0x20 6F 73 67 (역순으로 저장)
     * 원본 HWP 분석 결과, ctrl ID는 역순 바이트로 저장됨
     */
    writeCtrlId(ctrlId: string): this {
        // 4문자 코드를 역순으로 저장 (마지막 문자가 첫 바이트)
        const char0 = ctrlId.charCodeAt(3) || 0x20;  // 마지막 문자
        const char1 = ctrlId.charCodeAt(2) || 0x20;
        const char2 = ctrlId.charCodeAt(1) || 0x20;
        const char3 = ctrlId.charCodeAt(0) || 0x20;  // 첫 문자
        const value = char0 | (char1 << 8) | (char2 << 16) | (char3 << 24);
        this.writeUint32(value);
        return this;
    }

    /**
     * 현재 버퍼 크기
     */
    get length(): number {
        return this.buffer.length;
    }

    /**
     * 버퍼를 Uint8Array로 변환
     */
    toBuffer(): Uint8Array {
        return new Uint8Array(this.buffer);
    }

    /**
     * 버퍼 초기화
     */
    clear(): this {
        this.buffer = [];
        return this;
    }

    /**
     * 현재 위치에 다른 RecordDataWriter의 내용 추가
     */
    append(other: RecordDataWriter): this {
        const otherBuffer = other.toBuffer();
        for (const byte of otherBuffer) {
            this.buffer.push(byte);
        }
        return this;
    }
}
