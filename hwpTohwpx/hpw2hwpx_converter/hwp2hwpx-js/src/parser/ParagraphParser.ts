/**
 * ParagraphParser - HWP 문단 파서
 *
 * BodyText 스트림의 문단 레코드를 파싱하여 구조화된 데이터로 변환
 *
 * 문단 구조:
 * - PARA_HEADER (TagID 66): 문단 메타데이터
 * - PARA_TEXT (TagID 67): 실제 텍스트 (UTF-16LE)
 * - PARA_CHAR_SHAPE (TagID 68): CharPosShape 배열 (문단 내 스타일 변경점)
 * - PARA_LINE_SEG (TagID 69): 줄 구분 정보
 * - PARA_RANGE_TAG (TagID 70): 범위 태그
 */

import { RecordDataReader, type RecordNode } from './RecordParser';
import { HWP_TAG_ID, type HwpRecord, type EnhancedParagraph, type EnhancedRun, type CharPosShapeEntry, type HWPControl } from '../adapters/IHwpParser';

/**
 * PARA_HEADER 구조
 */
export interface ParaHeader {
    /** 텍스트 문자 수 */
    charCount: number;

    /** 컨트롤 마스크 (어떤 컨트롤이 포함되어 있는지) */
    controlMask: number;

    /** 문단 모양 ID (ParaShape 참조) */
    paraShapeID: number;

    /** 스타일 ID */
    styleID: number;

    /** 페이지 나눔 여부 */
    pageBreak: boolean;

    /** 다단 나눔 여부 */
    columnBreak: boolean;

    /** 수직 정렬 */
    vertAlign: number;

    /** 문단 ID (0-based) */
    instanceID?: number;

    /** CharPosShape 개수 (버전 5.0.3.0 이상) */
    charShapeCount?: number;

    /** RangeTag 개수 (버전 5.0.3.0 이상) */
    rangeTagCount?: number;

    /** LineSeg 개수 (버전 5.0.3.0 이상) */
    lineSegCount?: number;
}

/**
 * 컨트롤 마스크 비트 플래그
 */
export const CTRL_MASK = {
    SECTION_COLUMN_DEF: 0x01,
    FIELD_BEGIN: 0x02,
    FIELD_END: 0x04,
    TITLE_MARK: 0x08,
    TAB: 0x10,
    LINE_BREAK: 0x20,
    DRAWING: 0x40,
    BOOKMARK: 0x80,
    DATE_FIXED: 0x100,
    DATE_AUTO: 0x200,
    FOOTNOTE: 0x400,
    PAGE_NUM_CTRL: 0x800,
    PAGE_NUM_POS: 0x1000,
    HEADER_FOOTER: 0x2000,
    PAGE_DEF: 0x4000,
    ENDNOTE: 0x8000,
    HIDDEN_COMMENT: 0x10000,
    AUTONUM: 0x40000,
    EQUATION: 0x80000,
    INDEX_MARK: 0x400000
} as const;

/**
 * HWP 특수 문자 코드
 */
export const CHAR_CODES = {
    LINE: 0x000A,          // 줄 나눔 (Shift+Enter)
    PARA: 0x000D,          // 문단 나눔 (Enter)
    TAB: 0x0009,           // 탭
    DRAWING: 0x0002,       // 그리기 개체
    FIELD_BEGIN: 0x0003,   // 필드 시작
    FIELD_END: 0x0004,     // 필드 끝
    BOOKMARK: 0x0005,      // 책갈피
    FOOTNOTE: 0x0006,      // 각주
    ENDNOTE: 0x0007,       // 미주
    TITLE_MARK: 0x0008,    // 제목 표시 (단순 제어)
    GSO: 0x000B,           // 그리기 개체/표
    AUTO_NUM: 0x0012,      // 자동 번호
    NONBREAK_SPACE: 0x00A0 // 줄바꿈 없는 공백
} as const;

/**
 * 확장 제어 문자 (16바이트 추가 데이터가 있는 제어 문자)
 * HWP 5.0 Format: 0x0002~0x0007, 0x000B~0x001F (0x0008, 0x0009, 0x000A, 0x000D 제외)
 */
export const EXTENDED_CTRL_CHARS = new Set([
    0x0002,  // 구역/단 정의
    0x0003,  // 필드 시작
    0x0004,  // 필드 끝
    0x0005,  // 책갈피
    0x0006,  // 각주
    0x0007,  // 미주
    0x000B,  // GSO (그리기 개체/표)
    0x000C,  // 히든 코멘트
    0x000E,  // 머리글/바닥글
    0x000F,  // 각주/미주 번호
    0x0010,  // 자동 번호
    0x0011,  // 새 번호
    0x0012,  // 자동 번호
    0x0013,  // 페이지 컨트롤
    0x0014,  // 예약
    0x0015,  // 예약
    0x0016,  // 예약
    0x0017,  // 예약
    0x0018,  // 예약
    0x0019,  // 예약
    0x001A,  // 예약
    0x001B,  // 예약
    0x001C,  // 예약
    0x001D,  // 예약
    0x001E,  // 예약
    0x001F   // 예약
]);

/**
 * 단순 제어 문자 (추가 데이터 없음)
 * 0x0000, 0x0001, 0x0008, 0x0009, 0x000A, 0x000D
 */
export const SIMPLE_CTRL_CHARS = new Set([
    0x0000,  // NULL
    0x0001,  // 예약
    0x0008,  // 제목 표시
    0x0009,  // 탭
    0x000A,  // 줄 나눔
    0x000D   // 문단 끝
]);

/**
 * 문단 파서
 */
export class ParagraphParser {
    /**
     * PARA_HEADER 레코드 파싱
     */
    static parseParaHeader(record: HwpRecord): ParaHeader {
        const reader = new RecordDataReader(record.data);

        // 텍스트 문자 수 (마지막 문단 종료 문자 포함)
        const charCount = reader.readUint32();

        // 컨트롤 마스크
        const controlMask = reader.readUint32();

        // 문단 모양 ID
        const paraShapeID = reader.readUint16();

        // 스타일 ID
        const styleID = reader.readUint8();

        // 문단 분할 여부 (bit 0: 페이지, bit 1: 다단)
        const divideSort = reader.readUint8();
        const pageBreak = (divideSort & 0x01) !== 0;
        const columnBreak = (divideSort & 0x02) !== 0;

        // 수직 정렬 (2바이트)
        const vertAlign = reader.readUint16();

        const header: ParaHeader = {
            charCount,
            controlMask,
            paraShapeID,
            styleID,
            pageBreak,
            columnBreak,
            vertAlign
        };

        // 추가 필드 (버전에 따라)
        if (reader.remaining >= 4) {
            header.instanceID = reader.readUint32();
        }

        // CharPosShape, RangeTag, LineSeg 개수 (5.0.3.0 이상)
        if (reader.remaining >= 6) {
            header.charShapeCount = reader.readUint16();
            header.rangeTagCount = reader.readUint16();
            header.lineSegCount = reader.readUint16();
        }

        return header;
    }

    /**
     * PARA_TEXT 레코드 파싱
     * 텍스트와 특수 문자를 분리하여 반환
     *
     * HWP 제어 문자 구조:
     * - 단순 제어 문자 (2바이트): 0x0000, 0x0001, 0x0008, 0x0009, 0x000A, 0x000D
     * - 확장 제어 문자 (2 + 16 = 18바이트): 나머지 0x0002~0x001F
     */
    static parseParaText(record: HwpRecord): ParsedParaText {
        const data = record.data;
        const chars: number[] = [];
        const specialChars: SpecialChar[] = [];

        // UTF-16LE로 읽기
        let i = 0;
        while (i < data.length - 1) {
            const code = data[i] | (data[i + 1] << 8);

            // 특수 문자 처리 (제어 문자 범위: 0x0000 ~ 0x001F)
            if (code < 0x0020) {
                // 단순 제어 문자 (추가 데이터 없음)
                if (SIMPLE_CTRL_CHARS.has(code)) {
                    switch (code) {
                        case CHAR_CODES.PARA:
                            // 문단 종료 - 무시
                            break;
                        case CHAR_CODES.LINE:
                            // 줄 나눔
                            specialChars.push({ position: chars.length, type: 'LINE_BREAK' });
                            // 줄 나눔은 텍스트에 포함하지 않음
                            break;
                        case CHAR_CODES.TAB:
                            // 탭
                            specialChars.push({ position: chars.length, type: 'TAB' });
                            chars.push(0x0009); // 탭 문자로 변환
                            break;
                        case CHAR_CODES.TITLE_MARK:
                            // 제목 표시 - 단순 제어, 무시
                            break;
                        default:
                            // 0x0000, 0x0001 - 무시
                            break;
                    }
                    i += 2; // 2바이트만 스킵
                }
                // 확장 제어 문자 (16바이트 추가 데이터)
                else if (EXTENDED_CTRL_CHARS.has(code)) {
                    // 확장 데이터 추출 (제어 문자 이후 16바이트)
                    const extData = i + 18 <= data.length
                        ? data.slice(i + 2, i + 18)
                        : undefined;

                    // 특수 문자 타입 결정
                    let type: SpecialChar['type'] = 'CONTROL';
                    switch (code) {
                        case CHAR_CODES.DRAWING:
                            type = 'DRAWING';
                            break;
                        case CHAR_CODES.FIELD_BEGIN:
                            type = 'FIELD_BEGIN';
                            break;
                        case CHAR_CODES.FIELD_END:
                            type = 'FIELD_END';
                            break;
                        case CHAR_CODES.FOOTNOTE:
                            type = 'FOOTNOTE';
                            break;
                        case CHAR_CODES.ENDNOTE:
                            type = 'ENDNOTE';
                            break;
                        case CHAR_CODES.GSO:
                            type = 'DRAWING'; // GSO도 그리기 개체로 처리
                            break;
                    }

                    specialChars.push({
                        position: chars.length,
                        type,
                        code,
                        extData
                    });

                    // 확장 제어 문자: 2바이트(제어문자) + 16바이트(확장데이터) = 18바이트 스킵
                    i += 18;
                }
                // 알 수 없는 제어 문자 (안전하게 2바이트만 스킵)
                else {
                    i += 2;
                }
            } else {
                // 일반 문자
                chars.push(code);
                i += 2;
            }
        }

        // 문자 배열을 문자열로 변환 (탭만 허용, 다른 제어문자 제외)
        const text = String.fromCharCode(...chars.filter(c => c >= 0x0020 || c === 0x0009));

        return {
            text,
            chars,
            specialChars
        };
    }

    /**
     * PARA_CHAR_SHAPE 레코드 파싱 (CharPosShape 배열)
     * 핵심 기능: 문단 내 스타일 변경점 파싱
     */
    static parseCharPosShape(record: HwpRecord): CharPosShapeEntry[] {
        const reader = new RecordDataReader(record.data);
        const entries: CharPosShapeEntry[] = [];

        // 각 엔트리는 8바이트: [4바이트 position][4바이트 charShapeID]
        while (reader.remaining >= 8) {
            const position = reader.readUint32();
            const charShapeID = reader.readUint32();
            entries.push({ position, charShapeID });
        }

        return entries;
    }

    /**
     * CharPosShape를 기반으로 텍스트를 runs로 분할
     */
    static buildRuns(text: string, charPosShape: CharPosShapeEntry[]): EnhancedRun[] {
        if (!charPosShape || charPosShape.length === 0) {
            // CharPosShape가 없으면 전체 텍스트를 하나의 run으로
            return [{
                text,
                charShapeID: 0,
                start: 0,
                length: text.length
            }];
        }

        const runs: EnhancedRun[] = [];

        // 정렬 (position 기준)
        const sorted = [...charPosShape].sort((a, b) => a.position - b.position);

        for (let i = 0; i < sorted.length; i++) {
            const entry = sorted[i];
            const nextEntry = sorted[i + 1];

            const start = entry.position;
            const end = nextEntry ? nextEntry.position : text.length;

            if (start < text.length) {
                const runText = text.substring(start, Math.min(end, text.length));
                if (runText.length > 0) {
                    runs.push({
                        text: runText,
                        charShapeID: entry.charShapeID,
                        start,
                        length: runText.length
                    });
                }
            }
        }

        return runs;
    }

    /**
     * 레코드 노드 그룹에서 문단 파싱
     * 관련 레코드들을 조합하여 EnhancedParagraph 생성
     */
    static parseParagraph(paraNode: RecordNode, paraIndex: number): EnhancedParagraph {
        const record = paraNode.record;

        // PARA_HEADER 파싱
        const header = ParagraphParser.parseParaHeader(record);

        // 하위 레코드에서 PARA_TEXT, PARA_CHAR_SHAPE 찾기
        let text = '';
        let charPosShape: CharPosShapeEntry[] = [];
        const controls: HWPControl[] = [];
        let specialChars: SpecialChar[] = [];

        for (const child of paraNode.children) {
            switch (child.record.tagId) {
                case HWP_TAG_ID.PARA_TEXT: {
                    const parsed = ParagraphParser.parseParaText(child.record);
                    text = parsed.text;
                    specialChars = parsed.specialChars;
                    break;
                }

                case HWP_TAG_ID.PARA_CHAR_SHAPE:
                    charPosShape = ParagraphParser.parseCharPosShape(child.record);
                    break;

                case HWP_TAG_ID.CTRL_HEADER: {
                    // 컨트롤 파싱 (테이블, 이미지 등)
                    const ctrl = ParagraphParser.parseControlHeader(child);
                    if (ctrl) {
                        controls.push(ctrl);
                    }
                    break;
                }
            }
        }

        // FIELD_END special characters를 컨트롤로 변환
        // FIELD_END는 CTRL_HEADER가 아닌 PARA_TEXT의 특수 문자로 처리됨
        for (const sc of specialChars) {
            if (sc.type === 'FIELD_END') {
                controls.push({
                    type: 'FIELD_END',
                    obj: { id: 0 }  // ID는 XML 생성 시 할당
                });
            }
        }

        // runs 생성
        const runs = ParagraphParser.buildRuns(text, charPosShape);

        // 기본 charShapeID (첫 번째 CharPosShape에서)
        const defaultCharShapeID = charPosShape.length > 0 ? charPosShape[0].charShapeID : 0;

        return {
            id: paraIndex,
            text,
            runs,
            controls,
            charPosShape,
            paraShapeID: header.paraShapeID,
            styleID: header.styleID,
            charShapeID: defaultCharShapeID,
            pageBreak: header.pageBreak,
            columnBreak: header.columnBreak
        };
    }

    /**
     * CTRL_HEADER 파싱 (기본 정보만)
     */
    static parseControlHeader(ctrlNode: RecordNode): HWPControl | null {
        const data = ctrlNode.record.data;
        if (data.length < 4) return null;

        // 컨트롤 타입 (4바이트 CTRLID) - Little Endian으로 저장됨
        // 'tbl ' -> 0x20 0x6C 0x62 0x74 -> 읽을 때 역순
        // 바이트 배열 그대로 읽어서 역순으로 문자열 생성
        const ctrlIdStr = String.fromCharCode(data[3], data[2], data[1], data[0]);

        // 컨트롤 타입 결정
        let type: HWPControl['type'];

        switch (ctrlIdStr) {
            case 'tbl ':
                type = 'TABLE';
                break;
            case 'gso ':
            case '$pic':
            case 'pic$':
                type = 'PICTURE';
                break;
            case '$eqe':
            case 'eqe$':
            case 'eqed':
                type = 'EQUATION';
                break;
            case 'fn  ':
                type = 'FOOTNOTE';
                break;
            case 'en  ':
                type = 'ENDNOTE';
                break;
            case 'secd':
                // 섹션 정의 컨트롤 - 무시
                return null;
            case 'cold':
                // 다단 정의 컨트롤 - 무시
                return null;
            // Field controls - 필드 컨트롤
            case '%unk':  // 누름틀 (Click here)
            case '%dte':  // 날짜 필드
            case '%tme':  // 시간 필드
            case 'tdtc':  // 표 계산식
            case 'tcmt':  // 메모
                type = 'FIELD_BEGIN';
                break;
            case 'hlnk':  // 하이퍼링크
                type = 'FIELD_BEGIN';
                break;
            case 'bokm':  // 책갈피
                type = 'FIELD_BEGIN';
                break;
            case '%num':  // 쪽 번호
            case '%cnt':  // 총 쪽수
            case '%pgn':  // 페이지 번호
                type = 'FIELD_BEGIN';
                break;
            case '%tit':  // 문서 제목
            case '%aut':  // 저자
            case '%fnm':  // 파일명
            case '%pth':  // 경로
                type = 'FIELD_BEGIN';
                break;
            case 'toc ':  // 목차
            case 'idxm':  // 색인
            case '%xrf':  // 상호참조
            case '%mmg':  // 메일머지
                type = 'FIELD_BEGIN';
                break;
            default:
                // % 로 시작하는 컨트롤은 필드로 처리
                if (ctrlIdStr.startsWith('%')) {
                    type = 'FIELD_BEGIN';
                    break;
                }
                // 알 수 없는 컨트롤 - 디버깅용 로그
                // console.log(`[ParagraphParser] Unknown control: ${ctrlIdStr} (0x${data.slice(0, 4).reduce((s, b) => b.toString(16).padStart(2, '0') + s, '')})`);
                return null;
        }

        // 필드 컨트롤의 경우 추가 정보 파싱
        if (type === 'FIELD_BEGIN') {
            const fieldInfo = ParagraphParser.parseFieldData(data, ctrlIdStr);
            return {
                type,
                obj: {
                    ctrlId: ctrlIdStr,
                    record: ctrlNode.record,
                    children: ctrlNode.children,
                    ...fieldInfo
                }
            };
        }

        return {
            type,
            obj: {
                ctrlId: ctrlIdStr,
                record: ctrlNode.record,
                children: ctrlNode.children
            }
        };
    }

    /**
     * 필드 컨트롤 데이터 파싱
     *
     * HWP Field Control Structure:
     * - Offset 0-3: ctrlId (4 bytes)
     * - Offset 4-7: property (4 bytes)
     * - Offset 8+: field-specific data
     */
    static parseFieldData(data: Uint8Array, ctrlId: string): {
        id: number;
        type: number;
        autoUpdate: boolean;
        data?: {
            type: string;
            value?: string;
            format?: string;
            fieldName?: string;
            expression?: string;
        };
    } {
        let type = 0;  // Field type
        let autoUpdate = false;
        let fieldData: { type: string; value?: string; format?: string; fieldName?: string; expression?: string } | undefined;

        // 필드 타입 결정 (ctrlId 기반)
        switch (ctrlId) {
            case '%unk':
                type = 12;  // CLICK_HERE
                fieldData = { type: 'CLICK_HERE' };
                break;
            case '%dte':
                type = 2;   // DATE
                fieldData = { type: 'CREATE_DATE', format: 'YYYY-MM-DD' };
                break;
            case '%tme':
                type = 3;   // TIME
                fieldData = { type: 'CREATE_TIME', format: 'HH:mm:ss' };
                break;
            case '%num':
            case '%pgn':
                type = 0;   // PAGE_NUMBER
                fieldData = { type: 'PAGE_NUMBER' };
                break;
            case '%cnt':
                type = 1;   // TOTAL_PAGES
                fieldData = { type: 'TOTAL_PAGES' };
                break;
            case '%tit':
                type = 4;   // TITLE
                fieldData = { type: 'DOC_TITLE' };
                break;
            case '%aut':
                type = 5;   // AUTHOR
                fieldData = { type: 'DOC_AUTHOR' };
                break;
            case '%fnm':
                type = 6;   // FILENAME
                fieldData = { type: 'FILE_NAME' };
                break;
            case '%pth':
                type = 7;   // PATH
                fieldData = { type: 'FILE_PATH' };
                break;
            case 'hlnk':
                type = 15;  // HYPERLINK
                fieldData = { type: 'HYPERLINK' };
                // 하이퍼링크 URL 추출 시도
                if (data.length > 8) {
                    try {
                        // 하이퍼링크 데이터 구조에서 URL 추출
                        const urlData = ParagraphParser.extractHyperlinkUrl(data);
                        if (urlData) {
                            fieldData.value = urlData;
                        }
                    } catch {
                        // 파싱 실패 시 기본값 사용
                    }
                }
                break;
            case 'bokm':
                type = 8;   // BOOKMARK
                fieldData = { type: 'BOOKMARK' };
                break;
            case 'tdtc':
                type = 11;  // FORMULA
                fieldData = { type: 'FORMULA' };
                break;
            case 'tcmt':
                type = 26;  // MEMO
                fieldData = { type: 'MEMO' };
                break;
            case 'toc ':
                type = 28;  // TABLE_OF_CONTENTS
                fieldData = { type: 'TOC' };
                break;
            case 'idxm':
                type = 29;  // INDEX
                fieldData = { type: 'INDEX' };
                break;
            case '%xrf':
                type = 10;  // CROSS_REF
                fieldData = { type: 'CROSS_REF' };
                break;
            case '%mmg':
                type = 9;   // MAIL_MERGE
                fieldData = { type: 'MAIL_MERGE' };
                break;
            default:
                type = 12;  // CLICK_HERE (default)
                fieldData = { type: 'CLICK_HERE' };
        }

        // autoUpdate 플래그 추출 (property에서)
        if (data.length >= 8) {
            const property = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
            autoUpdate = (property & 0x01) !== 0;
        }

        return {
            id: 0,  // ID는 XML 생성 시 할당
            type,
            autoUpdate,
            data: fieldData
        };
    }

    /**
     * 하이퍼링크 URL 추출
     */
    static extractHyperlinkUrl(data: Uint8Array): string | null {
        if (data.length < 16) return null;

        try {
            // HWP 하이퍼링크 구조:
            // Offset 4-7: property
            // Offset 8-9: unknown
            // Offset 10-11: string length (in characters, not bytes)
            // Offset 12+: URL string (UTF-16LE)

            const strLen = data[10] | (data[11] << 8);
            if (strLen === 0 || strLen > 1000) return null;  // 비정상적인 길이

            const strStart = 12;
            const strEnd = strStart + strLen * 2;  // UTF-16LE = 2 bytes per char

            if (strEnd > data.length) return null;

            // UTF-16LE 디코딩
            const chars: string[] = [];
            for (let i = strStart; i < strEnd; i += 2) {
                const charCode = data[i] | (data[i + 1] << 8);
                if (charCode === 0) break;  // null terminator
                chars.push(String.fromCharCode(charCode));
            }

            return chars.join('');
        } catch {
            return null;
        }
    }
}

/**
 * PARA_TEXT 파싱 결과
 */
export interface ParsedParaText {
    /** 클린 텍스트 */
    text: string;

    /** 원시 문자 코드 배열 */
    chars: number[];

    /** 특수 문자 정보 */
    specialChars: SpecialChar[];
}

/**
 * 특수 문자 정보
 */
export interface SpecialChar {
    /** 문자열 내 위치 */
    position: number;

    /** 특수 문자 타입 */
    type: 'LINE_BREAK' | 'TAB' | 'DRAWING' | 'FIELD_BEGIN' | 'FIELD_END' | 'FOOTNOTE' | 'ENDNOTE' | 'CONTROL';

    /** 원시 문자 코드 */
    code?: number;

    /** 확장 데이터 (8바이트) */
    extData?: Uint8Array;
}
