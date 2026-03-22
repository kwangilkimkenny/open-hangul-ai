/**
 * DocInfo 스트림 생성기
 *
 * HWPX header.xml의 정보를 HWP DocInfo 바이너리 레코드로 변환
 *
 * DocInfo 레코드 순서:
 * 1. DOCUMENT_PROPERTIES (TagID=16)
 * 2. ID_MAPPINGS (TagID=17)
 * 3. BIN_DATA (TagID=18) × N
 * 4. FACE_NAME (TagID=19) × 7 언어 × N 폰트
 * 5. BORDER_FILL (TagID=20) × N
 * 6. CHAR_SHAPE (TagID=21) × N
 * 7. TAB_DEF (TagID=22) × N
 * 8. NUMBERING (TagID=23) × N
 * 9. BULLET (TagID=24) × N
 * 10. PARA_SHAPE (TagID=25) × N
 * 11. STYLE (TagID=26) × N
 *
 * @module WriterBinary
 */

import { RecordWriter } from './RecordWriter';
import { RecordDataWriter } from './RecordDataWriter';
import type {
    HwpxHeader,
    HwpxBinData
} from '../parser-hwpx/types';

/** HWP 레코드 TagID */
const TAG_ID = {
    DOCUMENT_PROPERTIES: 16,
    ID_MAPPINGS: 17,
    BIN_DATA: 18,
    FACE_NAME: 19,
    BORDER_FILL: 20,
    CHAR_SHAPE: 21,
    TAB_DEF: 22,
    NUMBERING: 23,
    BULLET: 24,
    PARA_SHAPE: 25,
    STYLE: 26
};

/** 언어 코드 순서 */
const LANG_ORDER = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'];

/**
 * DocInfo 스트림 생성기
 */
export class DocInfoWriter {
    private recordWriter: RecordWriter;
    private header: HwpxHeader;
    private binDataList: HwpxBinData[];

    constructor(header: HwpxHeader, binDataList: HwpxBinData[] = []) {
        this.recordWriter = new RecordWriter();
        this.header = header;
        // BinData를 ID 순으로 정렬 (DocInfo 레코드 순서가 파일 ID와 일치해야 함)
        this.binDataList = [...binDataList].sort((a, b) => a.id - b.id);
    }

    /**
     * DocInfo 스트림 바이너리 생성
     */
    generate(): Uint8Array {
        // 1. DOCUMENT_PROPERTIES
        this.writeDocumentProperties();

        // 2. ID_MAPPINGS
        this.writeIdMappings();

        // 3. BIN_DATA
        this.writeBinDataRecords();

        // 4. FACE_NAME (언어별)
        this.writeFaceNames();

        // 5. BORDER_FILL
        this.writeBorderFills();

        // 6. CHAR_SHAPE
        this.writeCharShapes();

        // 7. TAB_DEF
        this.writeTabDefs();

        // 8. NUMBERING
        this.writeNumberings();

        // 9. BULLET
        this.writeBullets();

        // 10. PARA_SHAPE
        this.writeParaShapes();

        // 11. STYLE
        this.writeStyles();

        return this.recordWriter.toBuffer();
    }

    /**
     * DOCUMENT_PROPERTIES 레코드 작성
     */
    private writeDocumentProperties(): void {
        const data = new RecordDataWriter();

        // 섹션 개수 (2바이트)
        data.writeUint16(this.header.secCnt);

        // 시작 번호 설정 (각 2바이트 × 5)
        data.writeUint16(1); // 페이지 번호 시작
        data.writeUint16(1); // 각주 번호 시작
        data.writeUint16(1); // 미주 번호 시작
        data.writeUint16(1); // 그림 번호 시작
        data.writeUint16(1); // 표 번호 시작

        // 캐럿 위치 (4바이트 × 3)
        data.writeUint32(0); // 리스트 ID
        data.writeUint32(0); // 문단 ID
        data.writeUint32(0); // 문단 내 글자 위치

        this.recordWriter.writeRecord(TAG_ID.DOCUMENT_PROPERTIES, 0, data.toBuffer());
    }

    /**
     * ID_MAPPINGS 레코드 작성
     */
    private writeIdMappings(): void {
        const data = new RecordDataWriter();

        // 각 항목의 개수 (4바이트씩)
        data.writeInt32(this.binDataList.length);  // BinData 개수

        // 폰트 개수 (언어별)
        for (const lang of LANG_ORDER) {
            const fontface = this.header.fontfaces.find(f => f.lang === lang);
            data.writeInt32(fontface?.fonts.length || 0);
        }

        data.writeInt32(this.header.borderFills.length);  // BorderFill 개수
        data.writeInt32(this.header.charShapes.length);   // CharShape 개수
        data.writeInt32(this.header.tabProperties.length); // TabDef 개수
        data.writeInt32(this.header.numberings.length);   // Numbering 개수
        data.writeInt32(this.header.bullets.length);      // Bullet 개수
        data.writeInt32(this.header.paraShapes.length);   // ParaShape 개수
        data.writeInt32(this.header.styles.length);       // Style 개수
        data.writeInt32(0);  // MemoShape 개수

        this.recordWriter.writeRecord(TAG_ID.ID_MAPPINGS, 0, data.toBuffer());
    }

    /**
     * BIN_DATA 레코드 작성
     *
     * 원본 HWP 형식 (12 bytes):
     * - Offset 0-1: type (0x0021 = embedded, compressed)
     * - Offset 2-3: binId (1-based index)
     * - Offset 4-5: extension length (chars)
     * - Offset 6+: extension (UTF-16LE, no null terminator)
     */
    private writeBinDataRecords(): void {
        for (const binData of this.binDataList) {
            const data = new RecordDataWriter();

            // 속성 플래그 (2바이트)
            // 0x0021 = embedded + compressed (원본 HWP 형식)
            data.writeUint16(0x0021);

            // binId (실제 파일 ID 사용, 1-based)
            data.writeUint16(binData.id);

            // 확장자 (길이 + UTF-16LE)
            const ext = binData.extension.toLowerCase();
            data.writeUint16(ext.length);
            for (let j = 0; j < ext.length; j++) {
                data.writeUint16(ext.charCodeAt(j));
            }

            this.recordWriter.writeRecord(TAG_ID.BIN_DATA, 0, data.toBuffer());
        }
    }

    /**
     * FACE_NAME 레코드 작성 (언어별 폰트)
     */
    private writeFaceNames(): void {
        for (const lang of LANG_ORDER) {
            const fontface = this.header.fontfaces.find(f => f.lang === lang);
            if (!fontface) continue;

            for (const font of fontface.fonts) {
                const data = new RecordDataWriter();

                // 속성 (1바이트)
                // Bit 0-4: 대체 폰트 타입
                // Bit 5: 대체 폰트 존재 여부
                // Bit 7: 폰트 타입 정보 존재 여부
                let attr = 0;
                if (font.type === 'HFT') {
                    attr |= 0x80;  // 폰트 타입 정보 존재
                }
                data.writeUint8(attr);

                // 폰트 이름 (문자열)
                data.writeString(font.face);

                // 대체 폰트 정보 (attr의 Bit 5가 1인 경우)
                // 여기서는 간단히 생략

                // 폰트 타입 정보 (attr의 Bit 7이 1인 경우)
                if (font.type === 'HFT') {
                    data.writeUint8(0);  // familyType
                    data.writeUint8(0);  // serifStyle
                    data.writeUint8(0);  // weight
                    data.writeUint8(0);  // proportion
                    data.writeUint8(0);  // contrast
                    data.writeUint8(0);  // strokeVariation
                    data.writeUint8(0);  // armStyle
                    data.writeUint8(0);  // letterform
                    data.writeUint8(0);  // midline
                    data.writeUint8(0);  // xHeight
                }

                this.recordWriter.writeRecord(TAG_ID.FACE_NAME, 0, data.toBuffer());
            }
        }
    }

    /**
     * BORDER_FILL 레코드 작성
     */
    private writeBorderFills(): void {
        for (const bf of this.header.borderFills) {
            const data = new RecordDataWriter();

            // 속성 (2바이트)
            let attr = 0;
            if (bf.threeD) attr |= 0x01;
            if (bf.shadow) attr |= 0x02;
            // Bit 2-3: 대각선
            // Bit 4-6: 역대각선
            data.writeUint16(attr);

            // 왼쪽 테두리 (2바이트 타입 + 1바이트 너비 + 4바이트 색상)
            this.writeBorderInfo(data, bf.borders.left);
            // 오른쪽 테두리
            this.writeBorderInfo(data, bf.borders.right);
            // 위쪽 테두리
            this.writeBorderInfo(data, bf.borders.top);
            // 아래쪽 테두리
            this.writeBorderInfo(data, bf.borders.bottom);
            // 대각선 테두리
            data.writeUint8(0);  // 타입
            data.writeUint8(0);  // 너비
            data.writeUint32(0); // 색상

            // 채우기 정보 (4바이트 타입)
            if (bf.fillType === 'COLOR' && bf.fillColor) {
                data.writeUint32(1);  // 단색 채우기
                // 배경색 (4바이트)
                data.writeColorFromHex(bf.fillColor);
                // 패턴색 (4바이트)
                data.writeUint32(0xFFFFFFFF);
                // 패턴 타입 (4바이트)
                data.writeInt32(-1);
            } else {
                data.writeUint32(0);  // 채우기 없음
            }

            this.recordWriter.writeRecord(TAG_ID.BORDER_FILL, 0, data.toBuffer());
        }
    }

    /**
     * 테두리 정보 작성
     */
    private writeBorderInfo(
        data: RecordDataWriter,
        border: { type: string; width: string; color: string }
    ): void {
        // 테두리 타입 매핑
        const typeMap: Record<string, number> = {
            'NONE': 0,
            'SOLID': 1,
            'DASH': 2,
            'DOT': 3,
            'DASH_DOT': 4,
            'DASH_DOT_DOT': 5,
            'DOUBLE': 6,
            'THICK_THIN': 7,
            'THIN_THICK': 8,
            'THICK_THIN_THICK': 9,
            'LONG_DASH': 10,
            'CIRCLE': 11,
            'DOUBLE_WAVE': 12,
            'THIN_THICK_THIN': 13,
            'WAVE': 14,
            'THICK_SLIM': 7,
            'SLIM_THICK': 8
        };

        data.writeUint8(typeMap[border.type] || 0);

        // 너비 파싱 (예: "0.1 mm" → 픽셀)
        const widthMatch = border.width.match(/(\d+\.?\d*)/);
        const widthMm = widthMatch ? parseFloat(widthMatch[1]) : 0.1;
        const widthValue = Math.round(widthMm * 283.46 / 7200 * 100);  // mm → HWPUNIT 비율
        data.writeUint8(Math.min(widthValue, 255));

        // 색상 파싱
        data.writeColorFromHex(border.color);
    }

    /**
     * CHAR_SHAPE 레코드 작성
     */
    private writeCharShapes(): void {
        for (const cs of this.header.charShapes) {
            const data = new RecordDataWriter();

            // 폰트 참조 (2바이트 × 7)
            for (let i = 0; i < 7; i++) {
                data.writeUint16(cs.fontRefs[i] || 0);
            }

            // 장평 (1바이트 × 7)
            for (let i = 0; i < 7; i++) {
                data.writeUint8(cs.ratios[i] || 100);
            }

            // 자간 (1바이트 × 7, signed)
            for (let i = 0; i < 7; i++) {
                data.writeInt8(cs.spacings[i] || 0);
            }

            // 상대 크기 (1바이트 × 7)
            for (let i = 0; i < 7; i++) {
                data.writeUint8(cs.relSizes[i] || 100);
            }

            // 위치 (1바이트 × 7, signed)
            for (let i = 0; i < 7; i++) {
                data.writeInt8(cs.offsets[i] || 0);
            }

            // 기준 크기 (4바이트)
            data.writeInt32(cs.height);

            // 속성 (4바이트)
            let attr = 0;
            if (cs.useFontSpace) attr |= 0x20000;
            if (cs.useKerning) attr |= 0x40000;
            data.writeUint32(attr);

            // 그림자 간격 (1바이트 × 2)
            data.writeInt8(0);
            data.writeInt8(0);

            // 텍스트 색상 (4바이트)
            data.writeColorFromHex(cs.textColor);

            // 밑줄 색상 (4바이트)
            data.writeUint32(0);

            // 음영 색상 (4바이트)
            if (cs.shadeColor && cs.shadeColor !== 'none') {
                data.writeColorFromHex(cs.shadeColor);
            } else {
                data.writeUint32(0xFFFFFFFF);  // 투명
            }

            // 그림자 색상 (4바이트)
            data.writeUint32(0xB2B2B2);

            // 테두리/채우기 참조 (2바이트)
            data.writeUint16(cs.borderFillIDRef || 0);

            // 취소선 색상 (4바이트)
            data.writeUint32(0);

            this.recordWriter.writeRecord(TAG_ID.CHAR_SHAPE, 0, data.toBuffer());
        }
    }

    /**
     * TAB_DEF 레코드 작성
     */
    private writeTabDefs(): void {
        for (const tab of this.header.tabProperties) {
            const data = new RecordDataWriter();

            // 속성 (4바이트)
            let attr = 0;
            if (tab.autoTabLeft) attr |= 0x01;
            if (tab.autoTabRight) attr |= 0x02;
            data.writeUint32(attr);

            // 탭 항목 개수 (4바이트)
            data.writeUint32(0);  // 기본 탭만 사용

            this.recordWriter.writeRecord(TAG_ID.TAB_DEF, 0, data.toBuffer());
        }
    }

    /**
     * NUMBERING 레코드 작성
     */
    private writeNumberings(): void {
        for (const _num of this.header.numberings) {
            const data = new RecordDataWriter();

            // 각 레벨의 속성 (4바이트 × 7 레벨)
            for (let i = 0; i < 7; i++) {
                data.writeUint32(0);  // 기본값
            }

            // 시작 번호 (2바이트 × 7 레벨)
            for (let i = 0; i < 7; i++) {
                data.writeUint16(1);
            }

            this.recordWriter.writeRecord(TAG_ID.NUMBERING, 0, data.toBuffer());
        }
    }

    /**
     * BULLET 레코드 작성
     */
    private writeBullets(): void {
        for (const bullet of this.header.bullets) {
            const data = new RecordDataWriter();

            // 글머리표 문자 (2바이트)
            const char = bullet.char || '●';
            data.writeUint16(char.charCodeAt(0));

            // 속성
            data.writeUint32(0);

            this.recordWriter.writeRecord(TAG_ID.BULLET, 0, data.toBuffer());
        }
    }

    /**
     * PARA_SHAPE 레코드 작성
     */
    private writeParaShapes(): void {
        for (const ps of this.header.paraShapes) {
            const data = new RecordDataWriter();

            // 속성1 (4바이트)
            let attr1 = 0;
            // 정렬
            const alignMap: Record<string, number> = {
                'JUSTIFY': 0,
                'LEFT': 1,
                'RIGHT': 2,
                'CENTER': 3,
                'DISTRIBUTE': 4,
                'DISTRIBUTE_SPACE': 5
            };
            attr1 |= (alignMap[ps.align] || 0);
            // 줄 간격 타입
            const lineSpacingTypeMap: Record<string, number> = {
                'PERCENT': 0,
                'FIXED': 1,
                'ONLY_PARA': 2,
                'AT_LEAST': 3
            };
            attr1 |= ((lineSpacingTypeMap[ps.lineSpacingType] || 0) << 4);
            data.writeUint32(attr1);

            // 왼쪽 여백 (4바이트)
            data.writeInt32(ps.marginLeft);

            // 오른쪽 여백 (4바이트)
            data.writeInt32(ps.marginRight);

            // 들여쓰기/내어쓰기 (4바이트)
            data.writeInt32(ps.indent);

            // 문단 위 간격 (4바이트)
            data.writeInt32(ps.marginPrev);

            // 문단 아래 간격 (4바이트)
            data.writeInt32(ps.marginNext);

            // 줄 간격 (4바이트) - 160% = 16000
            const lineSpacingValue = ps.lineSpacingType === 'PERCENT'
                ? ps.lineSpacingValue * 100
                : ps.lineSpacingValue;
            data.writeInt32(lineSpacingValue);

            // 탭 정의 참조 (2바이트)
            data.writeUint16(ps.tabDefIDRef);

            // 번호 매기기/글머리표 ID (2바이트)
            data.writeUint16(ps.headingIdRef);

            // 테두리/채우기 참조 (2바이트)
            data.writeUint16(ps.borderFillIDRef);

            // 테두리 오프셋 (2바이트 × 4)
            data.writeInt16(0);  // 왼쪽
            data.writeInt16(0);  // 오른쪽
            data.writeInt16(0);  // 위
            data.writeInt16(0);  // 아래

            // 속성2 (4바이트) - HWP 5.0.2.5 이상
            data.writeUint32(0);

            // 속성3 (4바이트) - HWP 5.0.2.5 이상
            data.writeUint32(0);

            // 줄 간격 (4바이트) - HWP 5.0.2.5 이상
            data.writeUint32(lineSpacingValue);

            this.recordWriter.writeRecord(TAG_ID.PARA_SHAPE, 0, data.toBuffer());
        }
    }

    /**
     * STYLE 레코드 작성
     */
    private writeStyles(): void {
        for (const style of this.header.styles) {
            const data = new RecordDataWriter();

            // 스타일 이름 (문자열)
            data.writeString(style.name);

            // 영문 스타일 이름 (문자열)
            data.writeString(style.engName);

            // 속성 (1바이트)
            const typeMap: Record<string, number> = {
                'PARA': 0,
                'CHAR': 1
            };
            data.writeUint8(typeMap[style.type] || 0);

            // 다음 스타일 ID (1바이트)
            data.writeUint8(style.nextStyleIDRef);

            // 언어 ID (2바이트)
            data.writeInt16(style.langId);

            // 문단 모양 ID (2바이트)
            data.writeUint16(style.paraPrIDRef);

            // 글자 모양 ID (2바이트)
            data.writeUint16(style.charPrIDRef);

            // 잠금 (2바이트)
            data.writeUint16(style.lockForm ? 1 : 0);

            this.recordWriter.writeRecord(TAG_ID.STYLE, 0, data.toBuffer());
        }
    }
}
