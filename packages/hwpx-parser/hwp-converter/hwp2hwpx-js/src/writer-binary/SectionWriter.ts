/**
 * Section 스트림 생성기
 *
 * HWPX section*.xml의 정보를 HWP Section 바이너리 레코드로 변환
 *
 * Section 레코드:
 * - PARA_HEADER (TagID=66) - 문단 헤더
 * - PARA_TEXT (TagID=67) - 문단 텍스트 (UTF-16LE)
 * - PARA_CHAR_SHAPE (TagID=68) - 글자 모양 위치
 * - PARA_LINE_SEG (TagID=69) - 줄 세그먼트
 * - PARA_RANGE_TAG (TagID=70) - 범위 태그
 * - CTRL_HEADER (TagID=71) - 컨트롤 헤더
 * - LIST_HEADER (TagID=72) - 리스트 헤더
 * - PAGE_DEF (TagID=73) - 페이지 정의
 * - TABLE (TagID=77) - 테이블
 * - SHAPE_COMPONENT_* (TagID=78-86) - 도형
 *
 * @module WriterBinary
 */

import { RecordWriter } from './RecordWriter';
import { RecordDataWriter } from './RecordDataWriter';
import type {
    HwpxSection,
    HwpxParagraph,
    HwpxBinData
} from '../parser-hwpx/types';
import { getImageDimensions, HWPUNIT_PER_PIXEL_96DPI } from '../util/ImageDimensions';
import { Logger } from '../util/Logger';

/** HWP 레코드 TagID */
const TAG_ID = {
    PARA_HEADER: 66,
    PARA_TEXT: 67,
    PARA_CHAR_SHAPE: 68,
    PARA_LINE_SEG: 69,
    PARA_RANGE_TAG: 70,
    CTRL_HEADER: 71,
    LIST_HEADER: 72,
    PAGE_DEF: 73,
    FOOTNOTE_SHAPE: 74,
    PAGE_BORDER_FILL: 75,
    SHAPE_COMPONENT: 76,
    TABLE: 77,
    SHAPE_COMPONENT_LINE: 78,
    SHAPE_COMPONENT_RECT: 79,
    SHAPE_COMPONENT_ELLIPSE: 80,
    SHAPE_COMPONENT_ARC: 81,
    SHAPE_COMPONENT_POLYGON: 82,
    SHAPE_COMPONENT_CURVE: 83,
    SHAPE_COMPONENT_OLE: 84,
    SHAPE_COMPONENT_PICTURE: 85,
    SHAPE_COMPONENT_CONTAINER: 86
};

/** 테이블 셀 정보 */
interface TableCell {
    colAddr: number;
    rowAddr: number;
    colSpan: number;
    rowSpan: number;
    width: number;
    height: number;
    marginLeft: number;
    marginRight: number;
    marginTop: number;
    marginBottom: number;
    borderFillIDRef: number;
    vertAlign: string;
    paragraphs: CellParagraph[];
}

/** 셀 내 문단 정보 */
interface CellParagraph {
    id: string;
    paraPrIDRef: number;
    styleIDRef: number;
    text: string;
    charPosShapes: Array<{ position: number; charShapeID: number }>;
}

/** 그림 정보 */
interface PictureInfo {
    instId: number;
    zOrder: number;
    width: number;
    height: number;
    treatAsChar: boolean;
    vertRelTo: number;
    horzRelTo: number;
    vertAlign: number;
    horzAlign: number;
    vertOffset: number;
    horzOffset: number;
    horzFlip: boolean;
    vertFlip: boolean;
    angle: number;
    binDataID: number;
    bright: number;
    contrast: number;
    effect: number;
    alpha: number;
    clipLeft: number;
    clipRight: number;
    clipTop: number;
    clipBottom: number;
    textWrap: number;
    textFlow: number;
    // 원본 이미지 크기 (imgDim에서, HWPUNIT)
    imgWidth: number;
    imgHeight: number;
    // 실제 픽셀 크기 (이미지 바이너리에서 추출)
    pixelWidth: number;
    pixelHeight: number;
}

/** 사각형 정보 */
interface RectangleInfo {
    instId: number;
    zOrder: number;
    width: number;
    height: number;
    x: number;
    y: number;
    treatAsChar: boolean;
    vertRelTo: number;
    horzRelTo: number;
    vertAlign: number;
    horzAlign: number;
    vertOffset: number;
    horzOffset: number;
    horzFlip: boolean;
    vertFlip: boolean;
    angle: number;
    alpha: number;
    textWrap: number;
    textFlow: number;
    // 테두리 정보
    lineColor: number;
    lineWidth: number;
    lineStyle: number;
    // 채우기 정보
    fillType: number;
    fillColor: number;
    // 모서리 둥글기 비율
    cornerRadius: number;
    // 외부 마진
    outMarginLeft: number;
    outMarginRight: number;
    outMarginTop: number;
    outMarginBottom: number;
}

/** 컨트롤 문자 상수 */
const CTRL_CHAR = {
    SECTION_DEF: 0x02,      // 섹션/단 정의
    FIELD_START: 0x03,      // 필드 시작
    FIELD_END: 0x04,        // 필드 끝
    RESERVED_5: 0x05,       // 예약
    RESERVED_6: 0x06,       // 예약
    RESERVED_7: 0x07,       // 예약
    TITLE_MARK: 0x08,       // 제목 표시
    TAB: 0x09,              // 탭
    LINE_BREAK: 0x0A,       // 강제 줄 나눔
    DRAWING_OBJ: 0x0B,      // 그리기 개체 (floating)
    RESERVED_12: 0x0C,      // 예약
    PARA_BREAK: 0x0D,       // 문단 끝
    RESERVED_14: 0x0E,      // 예약
    HIDDEN_DESC: 0x0F,      // 숨은 설명
    HEADER_FOOTER: 0x10,    // 머리글/바닥글
    FOOTNOTE: 0x11,         // 각주/미주
    AUTO_NUMBER: 0x12,      // 자동 번호
    RESERVED_19: 0x13,      // 예약
    RESERVED_20: 0x14,      // 예약
    PAGE_CTRL: 0x15,        // 페이지 컨트롤
    BOOKMARK: 0x16,         // 책갈피/찾아보기 표시
    OBJ_LINK: 0x17,         // 개체 연결
    INLINE_OBJ: 0x18,       // 덧말/글자 겹침/글맵시
    HYPHEN: 0x1E,           // 묶음 빈칸/고정폭 빈칸
    RESERVED_31: 0x1F       // 예약
};

/**
 * Section 스트림 생성기
 */
export class SectionWriter {
    private recordWriter: RecordWriter;
    private section: HwpxSection;
    private currentLevel: number = 0;
    private binDataMap: Map<number, Uint8Array>;

    constructor(section: HwpxSection, binData?: HwpxBinData[]) {
        this.recordWriter = new RecordWriter();
        this.section = section;
        // BinData를 ID로 빠르게 조회할 수 있도록 Map 생성
        this.binDataMap = new Map();
        if (binData) {
            for (const bd of binData) {
                this.binDataMap.set(bd.id, bd.data);
            }
        }
    }

    /**
     * Section 스트림 바이너리 생성
     */
    generate(): Uint8Array {
        // 각 문단 처리
        for (const para of this.section.paragraphs) {
            this.writeParagraph(para);
        }

        return this.recordWriter.toBuffer();
    }

    /**
     * 문단 레코드 작성
     */
    private writeParagraph(para: HwpxParagraph): void {
        // 문단 텍스트 구성
        const { text, charPosShapes, hasControls } = this.buildParagraphText(para);

        // 1. PARA_HEADER
        this.writeParaHeader(para, text.length, hasControls);

        // 2. PARA_TEXT (텍스트가 있는 경우만)
        if (text.length > 0) {
            this.writeParaText(text);
        }

        // 3. PARA_CHAR_SHAPE
        this.writeParaCharShape(charPosShapes);

        // 4. PARA_LINE_SEG (기본 줄 세그먼트)
        this.writeParaLineSeg(text.length);

        // 5. 컨트롤 처리
        for (const run of para.runs) {
            for (const ctrl of run.controls) {
                this.writeControl(ctrl);
            }
        }
    }

    /**
     * 문단 텍스트 및 CharPosShape 구성
     */
    private buildParagraphText(para: HwpxParagraph): {
        text: Uint16Array;
        charPosShapes: Array<{ position: number; charShapeID: number }>;
        hasControls: boolean;
    } {
        const textChars: number[] = [];
        const charPosShapes: Array<{ position: number; charShapeID: number }> = [];
        let currentCharShape = -1;
        let hasControls = false;

        for (const run of para.runs) {
            // CharShape 변경 추적
            if (run.charPrIDRef !== currentCharShape) {
                charPosShapes.push({
                    position: textChars.length,
                    charShapeID: run.charPrIDRef
                });
                currentCharShape = run.charPrIDRef;
            }

            // 텍스트 추가
            for (let i = 0; i < run.text.length; i++) {
                textChars.push(run.text.charCodeAt(i));
            }

            // 컨트롤 처리
            for (const ctrl of run.controls) {
                hasControls = true;

                // 섹션 정의
                if (ctrl.type === 'secPr') {
                    textChars.push(CTRL_CHAR.SECTION_DEF);
                }
                // 테이블
                else if (ctrl.type === 'tbl') {
                    textChars.push(CTRL_CHAR.INLINE_OBJ);
                }
                // 사각형/그림
                else if (ctrl.type === 'rect' || ctrl.type === 'pic') {
                    textChars.push(CTRL_CHAR.DRAWING_OBJ);
                }
                // 단 정의
                else if (ctrl.type === 'colPr') {
                    textChars.push(CTRL_CHAR.SECTION_DEF);
                }
            }
        }

        // 문단 종료 문자
        textChars.push(CTRL_CHAR.PARA_BREAK);

        return {
            text: new Uint16Array(textChars),
            charPosShapes,
            hasControls
        };
    }

    /**
     * PARA_HEADER 레코드 작성
     */
    private writeParaHeader(
        para: HwpxParagraph,
        textLength: number,
        hasControls: boolean
    ): void {
        const data = new RecordDataWriter();

        // 글자 수 (4바이트)
        // Bit 31이 1이면 컨트롤 마스크 포함
        let charCount = textLength;
        if (hasControls) {
            charCount |= 0x80000000;
        }
        data.writeUint32(charCount);

        // 컨트롤 마스크 (4바이트)
        const ctrlMask = this.buildControlMask(para);
        data.writeUint32(ctrlMask);

        // 문단 모양 ID (2바이트)
        data.writeUint16(para.paraPrIDRef);

        // 스타일 ID (1바이트)
        data.writeUint8(para.styleIDRef);

        // 페이지/단 나눔 (1바이트)
        let breakFlags = 0;
        if (para.pageBreak) breakFlags |= 0x01;
        if (para.columnBreak) breakFlags |= 0x02;
        data.writeUint8(breakFlags);

        // CharShape 개수 (2바이트) - 1개 이상
        data.writeUint16(1);  // 최소 1개

        // RangeTag 개수 (2바이트)
        data.writeUint16(0);

        // 줄 정렬 개수 (2바이트) - 1개 이상
        data.writeUint16(1);  // 최소 1개

        // 문단 인스턴스 ID (4바이트)
        const paraId = parseInt(para.id, 10) || 0;
        data.writeUint32(paraId);

        // 변경 추적 병합 문단 ID (2바이트)
        data.writeUint16(0);

        this.recordWriter.writeRecord(TAG_ID.PARA_HEADER, this.currentLevel, data.toBuffer());
    }

    /**
     * 컨트롤 마스크 구성
     */
    private buildControlMask(para: HwpxParagraph): number {
        let mask = 0;

        for (const run of para.runs) {
            for (const ctrl of run.controls) {
                switch (ctrl.type) {
                    case 'secPr':
                    case 'colPr':
                        mask |= 0x02;  // SECTION_DEF
                        break;
                    case 'tbl':
                        mask |= 0x800;  // TABLE
                        break;
                    case 'rect':
                    case 'line':
                    case 'ellipse':
                    case 'polygon':
                    case 'curve':
                    case 'pic':
                        mask |= 0x800;  // GSO (General Shape Object)
                        break;
                    case 'equation':
                        mask |= 0x80000;  // EQUATION
                        break;
                }
            }
        }

        return mask;
    }

    /**
     * PARA_TEXT 레코드 작성
     */
    private writeParaText(text: Uint16Array): void {
        const data = new RecordDataWriter();

        // UTF-16LE로 텍스트 쓰기
        for (let i = 0; i < text.length; i++) {
            data.writeUint16(text[i]);
        }

        this.recordWriter.writeRecord(TAG_ID.PARA_TEXT, this.currentLevel, data.toBuffer());
    }

    /**
     * PARA_CHAR_SHAPE 레코드 작성
     */
    private writeParaCharShape(
        charPosShapes: Array<{ position: number; charShapeID: number }>
    ): void {
        const data = new RecordDataWriter();

        // CharPosShape 항목 (position: 4바이트, charShapeID: 4바이트)
        // 최소 1개 항목 필요
        if (charPosShapes.length === 0) {
            data.writeUint32(0);  // position
            data.writeUint32(0);  // charShapeID
        } else {
            for (const entry of charPosShapes) {
                data.writeUint32(entry.position);
                data.writeUint32(entry.charShapeID);
            }
        }

        this.recordWriter.writeRecord(TAG_ID.PARA_CHAR_SHAPE, this.currentLevel, data.toBuffer());
    }

    /**
     * PARA_LINE_SEG 레코드 작성 (기본 줄 세그먼트)
     */
    private writeParaLineSeg(textLength: number): void {
        const data = new RecordDataWriter();

        // 줄 세그먼트 (각 32바이트)
        // textStartPos (4바이트)
        data.writeInt32(0);

        // lineVertPos (4바이트)
        data.writeInt32(0);

        // lineHeight (4바이트)
        data.writeInt32(1000);  // 기본 높이

        // textHeight (4바이트)
        data.writeInt32(1000);

        // distBaseLine (4바이트)
        data.writeInt32(850);

        // lineSpacing (4바이트)
        data.writeInt32(600);

        // startPos (4바이트) - 줄의 시작 x좌표
        data.writeInt32(0);

        // lineWidth (4바이트)
        data.writeInt32(48000);  // 기본 너비

        // segFlags (4바이트)
        let segFlags = 0x60000;  // 기본 플래그
        if (textLength <= 1) {
            segFlags |= 0x01;  // 첫 줄
            segFlags |= 0x02;  // 마지막 줄
        }
        data.writeUint32(segFlags);

        this.recordWriter.writeRecord(TAG_ID.PARA_LINE_SEG, this.currentLevel, data.toBuffer());
    }

    /**
     * 컨트롤 레코드 작성
     */
    private writeControl(ctrl: { type: string; element: Element }): void {
        switch (ctrl.type) {
            case 'secPr':
                this.writeSectionDef(ctrl.element);
                break;
            case 'colPr':
                this.writeColumnDef(ctrl.element);
                break;
            case 'tbl':
                this.writeTable(ctrl.element);
                break;
            case 'rect':
                this.writeRectangle(ctrl.element);
                break;
            case 'pic':
                this.writePicture(ctrl.element);
                break;
            // 기타 컨트롤은 필요시 추가
        }
    }

    /**
     * 섹션 정의 컨트롤 작성
     */
    private writeSectionDef(el: Element): void {
        const data = new RecordDataWriter();

        // 컨트롤 ID (4바이트): 'secd'
        data.writeCtrlId('secd');

        // 속성 (4바이트)
        data.writeUint32(0);

        // 컬럼 간격 (2바이트)
        data.writeUint16(1134);

        // 세로 정렬 (2바이트)
        data.writeUint16(0);

        // 가로 크기 (4바이트)
        data.writeUint32(0);

        // 세로 크기 (4바이트)
        data.writeUint32(0);

        // 페이지 가로 크기 (4바이트)
        const width = this.getAttrInt(el, 'pagePr/width', 59528);
        data.writeUint32(width);

        // 페이지 세로 크기 (4바이트)
        const height = this.getAttrInt(el, 'pagePr/height', 84188);
        data.writeUint32(height);

        // 왼쪽 여백 (4바이트)
        data.writeUint32(5669);

        // 오른쪽 여백 (4바이트)
        data.writeUint32(5669);

        // 위 여백 (4바이트)
        data.writeUint32(4819);

        // 아래 여백 (4바이트)
        data.writeUint32(4252);

        // 머리말 여백 (4바이트)
        data.writeUint32(3685);

        // 꼬리말 여백 (4바이트)
        data.writeUint32(2834);

        // 제본 여백 (4바이트)
        data.writeUint32(0);

        // 속성 플래그 (4바이트)
        data.writeUint32(0);

        this.recordWriter.writeRecord(TAG_ID.CTRL_HEADER, this.currentLevel, data.toBuffer());

        // PAGE_DEF 레코드
        this.writePageDef(el);
    }

    /**
     * PAGE_DEF 레코드 작성
     */
    private writePageDef(el: Element): void {
        const data = new RecordDataWriter();

        // 용지 가로 크기 (4바이트)
        const width = this.getAttrInt(el, 'pagePr/width', 59528);
        data.writeUint32(width);

        // 용지 세로 크기 (4바이트)
        const height = this.getAttrInt(el, 'pagePr/height', 84188);
        data.writeUint32(height);

        // 왼쪽 여백 (4바이트)
        data.writeUint32(5669);

        // 오른쪽 여백 (4바이트)
        data.writeUint32(5669);

        // 위쪽 여백 (4바이트)
        data.writeUint32(4819);

        // 아래쪽 여백 (4바이트)
        data.writeUint32(4252);

        // 머리말 여백 (4바이트)
        data.writeUint32(3685);

        // 꼬리말 여백 (4바이트)
        data.writeUint32(2834);

        // 제본 여백 (4바이트)
        data.writeUint32(0);

        // 속성 (4바이트)
        data.writeUint32(0);

        this.recordWriter.writeRecord(TAG_ID.PAGE_DEF, this.currentLevel + 1, data.toBuffer());
    }

    /**
     * 단 정의 컨트롤 작성
     */
    private writeColumnDef(el: Element): void {
        const data = new RecordDataWriter();

        // 컨트롤 ID (4바이트): 'cold'
        data.writeCtrlId('cold');

        // 속성 (2바이트)
        data.writeUint16(0);

        // 단 개수 (2바이트)
        const colCount = this.getAttrInt(el, 'colCount', 1);
        data.writeUint16(colCount);

        // 단 간격 (2바이트)
        data.writeUint16(1134);

        // 속성 (2바이트)
        data.writeUint16(0);

        this.recordWriter.writeRecord(TAG_ID.CTRL_HEADER, this.currentLevel, data.toBuffer());
    }

    /**
     * 테이블 컨트롤 작성
     */
    private writeTable(el: Element): void {
        // 테이블 정보 추출
        const rowCnt = parseInt(el.getAttribute('rowCnt') || '1', 10);
        const colCnt = parseInt(el.getAttribute('colCnt') || '1', 10);
        const cellSpacing = parseInt(el.getAttribute('cellSpacing') || '0', 10);
        const borderFillIDRef = parseInt(el.getAttribute('borderFillIDRef') || '1', 10);

        // 셀 정보 수집
        const cells = this.parseTableCells(el);

        // CTRL_HEADER 작성
        const data = new RecordDataWriter();

        // 컨트롤 ID (4바이트): 'tbl '
        data.writeCtrlId('tbl ');

        // 속성 (4바이트)
        data.writeUint32(0);

        // 열 개수 (2바이트)
        data.writeUint16(colCnt);

        // 행 개수 (2바이트)
        data.writeUint16(rowCnt);

        // 셀 간격 (2바이트)
        data.writeUint16(cellSpacing);

        // 내부 여백 (각 2바이트)
        const inMargin = this.getChildElement(el, 'inMargin');
        data.writeUint16(parseInt(inMargin?.getAttribute('left') || '510', 10));
        data.writeUint16(parseInt(inMargin?.getAttribute('right') || '510', 10));
        data.writeUint16(parseInt(inMargin?.getAttribute('top') || '141', 10));
        data.writeUint16(parseInt(inMargin?.getAttribute('bottom') || '141', 10));

        // 테두리/채우기 ID (2바이트)
        data.writeUint16(borderFillIDRef);

        // 유효 영역 (4바이트)
        data.writeUint32(0);

        this.recordWriter.writeRecord(TAG_ID.CTRL_HEADER, this.currentLevel, data.toBuffer());

        // TABLE 레코드
        this.writeTableRecord(el, rowCnt, colCnt, cells);

        // 각 셀의 LIST_HEADER 및 문단 작성
        for (const cell of cells) {
            this.writeListHeader(cell);

            // 셀 내 문단 작성
            for (const para of cell.paragraphs) {
                this.writeCellParagraph(para);
            }
        }
    }

    /**
     * 테이블 셀 파싱
     */
    private parseTableCells(el: Element): TableCell[] {
        const cells: TableCell[] = [];
        const rows = this.getChildrenByTagName(el, 'tr');

        for (const row of rows) {
            const tcs = this.getChildrenByTagName(row, 'tc');
            for (const tc of tcs) {
                const cell = this.parseTableCell(tc);
                cells.push(cell);
            }
        }

        return cells;
    }

    /**
     * 개별 셀 파싱
     */
    private parseTableCell(tc: Element): TableCell {
        const cellAddr = this.getChildElement(tc, 'cellAddr');
        const cellSpan = this.getChildElement(tc, 'cellSpan');
        const cellSz = this.getChildElement(tc, 'cellSz');
        const cellMargin = this.getChildElement(tc, 'cellMargin');
        const subList = this.getChildElement(tc, 'subList');

        const paragraphs: CellParagraph[] = [];
        if (subList) {
            const pList = this.getChildrenByTagName(subList, 'p');
            for (const p of pList) {
                paragraphs.push(this.parseCellParagraph(p));
            }
        }

        return {
            colAddr: parseInt(cellAddr?.getAttribute('colAddr') || '0', 10),
            rowAddr: parseInt(cellAddr?.getAttribute('rowAddr') || '0', 10),
            colSpan: parseInt(cellSpan?.getAttribute('colSpan') || '1', 10),
            rowSpan: parseInt(cellSpan?.getAttribute('rowSpan') || '1', 10),
            width: parseInt(cellSz?.getAttribute('width') || '1000', 10),
            height: parseInt(cellSz?.getAttribute('height') || '1000', 10),
            marginLeft: parseInt(cellMargin?.getAttribute('left') || '510', 10),
            marginRight: parseInt(cellMargin?.getAttribute('right') || '510', 10),
            marginTop: parseInt(cellMargin?.getAttribute('top') || '141', 10),
            marginBottom: parseInt(cellMargin?.getAttribute('bottom') || '141', 10),
            borderFillIDRef: parseInt(tc.getAttribute('borderFillIDRef') || '1', 10),
            vertAlign: this.getChildElement(tc, 'subList')?.getAttribute('vertAlign') || 'CENTER',
            paragraphs
        };
    }

    /**
     * 셀 내 문단 파싱
     */
    private parseCellParagraph(p: Element): CellParagraph {
        const runs = this.getChildrenByTagName(p, 'run');
        let text = '';
        const charPosShapes: Array<{ position: number; charShapeID: number }> = [];

        for (const run of runs) {
            const charPrIDRef = parseInt(run.getAttribute('charPrIDRef') || '0', 10);
            charPosShapes.push({
                position: text.length,
                charShapeID: charPrIDRef
            });

            const tEl = this.getChildElement(run, 't');
            if (tEl && tEl.textContent) {
                text += tEl.textContent;
            }
        }

        return {
            id: p.getAttribute('id') || '0',
            paraPrIDRef: parseInt(p.getAttribute('paraPrIDRef') || '0', 10),
            styleIDRef: parseInt(p.getAttribute('styleIDRef') || '0', 10),
            text,
            charPosShapes
        };
    }

    /**
     * TABLE 레코드 작성
     */
    private writeTableRecord(
        el: Element,
        rowCnt: number,
        colCnt: number,
        cells: TableCell[]
    ): void {
        const data = new RecordDataWriter();

        // 속성 (4바이트)
        data.writeUint32(0);

        // 행 개수 (2바이트)
        data.writeUint16(rowCnt);

        // 열 개수 (2바이트)
        data.writeUint16(colCnt);

        // 셀 간격 (2바이트)
        data.writeUint16(parseInt(el.getAttribute('cellSpacing') || '0', 10));

        // 내부 여백 (각 2바이트)
        const inMargin = this.getChildElement(el, 'inMargin');
        data.writeUint16(parseInt(inMargin?.getAttribute('left') || '510', 10));
        data.writeUint16(parseInt(inMargin?.getAttribute('right') || '510', 10));
        data.writeUint16(parseInt(inMargin?.getAttribute('top') || '141', 10));
        data.writeUint16(parseInt(inMargin?.getAttribute('bottom') || '141', 10));

        // 행 크기 배열 (각 2바이트)
        // 각 행의 높이 계산 (동일한 rowAddr를 가진 셀들의 첫 번째 높이)
        const rowHeights: number[] = [];
        for (let r = 0; r < rowCnt; r++) {
            const cellsInRow = cells.filter(c => c.rowAddr === r && c.colAddr === 0);
            if (cellsInRow.length > 0) {
                rowHeights.push(cellsInRow[0].height);
            } else {
                // 병합된 셀의 경우 이전 행 높이 사용
                rowHeights.push(rowHeights.length > 0 ? rowHeights[rowHeights.length - 1] : 1000);
            }
        }

        for (const height of rowHeights) {
            data.writeUint16(height);
        }

        // 테두리/채우기 ID (2바이트)
        data.writeUint16(parseInt(el.getAttribute('borderFillIDRef') || '1', 10));

        // 유효 영역 정보 (2바이트)
        data.writeUint16(0);

        this.recordWriter.writeRecord(TAG_ID.TABLE, this.currentLevel + 1, data.toBuffer());
    }

    /**
     * LIST_HEADER 레코드 작성 (테이블 셀용)
     */
    private writeListHeader(cell: TableCell): void {
        const data = new RecordDataWriter();

        // 문단 개수 (2바이트)
        data.writeUint16(cell.paragraphs.length || 1);

        // 속성 (4바이트)
        let flags = 0;
        switch (cell.vertAlign) {
            case 'TOP': flags = 0; break;
            case 'CENTER': flags = 1; break;
            case 'BOTTOM': flags = 2; break;
        }
        data.writeUint32(flags);

        // 셀 주소: colAddr (2바이트)
        data.writeUint16(cell.colAddr);

        // 셀 주소: rowAddr (2바이트)
        data.writeUint16(cell.rowAddr);

        // 열 병합: colSpan (2바이트)
        data.writeUint16(cell.colSpan);

        // 행 병합: rowSpan (2바이트)
        data.writeUint16(cell.rowSpan);

        // 셀 너비 (4바이트)
        data.writeUint32(cell.width);

        // 셀 높이 (4바이트)
        data.writeUint32(cell.height);

        // 왼쪽 여백 (2바이트)
        data.writeUint16(cell.marginLeft);

        // 오른쪽 여백 (2바이트)
        data.writeUint16(cell.marginRight);

        // 위쪽 여백 (2바이트)
        data.writeUint16(cell.marginTop);

        // 아래쪽 여백 (2바이트)
        data.writeUint16(cell.marginBottom);

        // 테두리/채우기 ID (2바이트)
        data.writeUint16(cell.borderFillIDRef);

        // 유효 영역 정보 (2바이트) - 없음
        data.writeUint16(0);

        this.recordWriter.writeRecord(TAG_ID.LIST_HEADER, this.currentLevel + 1, data.toBuffer());
    }

    /**
     * 셀 내 문단 작성
     */
    private writeCellParagraph(para: CellParagraph): void {
        // 문단 텍스트 + 종료 문자
        const textChars: number[] = [];
        for (let i = 0; i < para.text.length; i++) {
            textChars.push(para.text.charCodeAt(i));
        }
        textChars.push(CTRL_CHAR.PARA_BREAK);  // 문단 종료

        const text = new Uint16Array(textChars);

        // 1. PARA_HEADER
        const headerData = new RecordDataWriter();
        headerData.writeUint32(text.length);  // 글자 수
        headerData.writeUint32(0);  // 컨트롤 마스크
        headerData.writeUint16(para.paraPrIDRef);  // 문단 모양 ID
        headerData.writeUint8(para.styleIDRef);  // 스타일 ID
        headerData.writeUint8(0);  // 페이지/단 나눔
        headerData.writeUint16(para.charPosShapes.length || 1);  // CharShape 개수
        headerData.writeUint16(0);  // RangeTag 개수
        headerData.writeUint16(1);  // 줄 정렬 개수
        headerData.writeUint32(parseInt(para.id, 10) || 0);  // 문단 ID
        headerData.writeUint16(0);  // 변경 추적 병합 문단 ID

        this.recordWriter.writeRecord(TAG_ID.PARA_HEADER, this.currentLevel + 2, headerData.toBuffer());

        // 2. PARA_TEXT
        if (text.length > 0) {
            const textData = new RecordDataWriter();
            for (let i = 0; i < text.length; i++) {
                textData.writeUint16(text[i]);
            }
            this.recordWriter.writeRecord(TAG_ID.PARA_TEXT, this.currentLevel + 2, textData.toBuffer());
        }

        // 3. PARA_CHAR_SHAPE
        const charShapeData = new RecordDataWriter();
        if (para.charPosShapes.length === 0) {
            charShapeData.writeUint32(0);  // position
            charShapeData.writeUint32(0);  // charShapeID
        } else {
            for (const entry of para.charPosShapes) {
                charShapeData.writeUint32(entry.position);
                charShapeData.writeUint32(entry.charShapeID);
            }
        }
        this.recordWriter.writeRecord(TAG_ID.PARA_CHAR_SHAPE, this.currentLevel + 2, charShapeData.toBuffer());

        // 4. PARA_LINE_SEG
        const lineSegData = new RecordDataWriter();
        lineSegData.writeInt32(0);  // textStartPos
        lineSegData.writeInt32(0);  // lineVertPos
        lineSegData.writeInt32(1000);  // lineHeight
        lineSegData.writeInt32(1000);  // textHeight
        lineSegData.writeInt32(850);  // distBaseLine
        lineSegData.writeInt32(600);  // lineSpacing
        lineSegData.writeInt32(0);  // startPos
        lineSegData.writeInt32(para.text.length * 500);  // lineWidth (estimate)
        lineSegData.writeUint32(0x60003);  // segFlags (첫줄 + 마지막줄)

        this.recordWriter.writeRecord(TAG_ID.PARA_LINE_SEG, this.currentLevel + 2, lineSegData.toBuffer());
    }

    /**
     * 자식 요소 가져오기
     */
    private getChildElement(parent: Element, tagName: string): Element | null {
        const children = parent.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) {
                const elem = child as Element;
                const localName = elem.localName || elem.nodeName.split(':').pop();
                if (localName === tagName) {
                    return elem;
                }
            }
        }
        return null;
    }

    /**
     * 직접 자식 요소들 가져오기
     */
    private getChildrenByTagName(parent: Element, tagName: string): Element[] {
        const results: Element[] = [];
        const children = parent.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) {
                const elem = child as Element;
                const localName = elem.localName || elem.nodeName.split(':').pop();
                if (localName === tagName) {
                    results.push(elem);
                }
            }
        }
        return results;
    }

    /**
     * 사각형 컨트롤 작성
     *
     * HWP 사각형 레코드 구조:
     * - CTRL_HEADER (TagID 71) - 'gso ' 컨트롤
     * - SHAPE_COMPONENT (TagID 76) - 도형 속성
     * - SHAPE_COMPONENT_RECT (TagID 79) - 사각형 속성
     */
    private writeRectangle(el: Element): void {
        // 사각형 속성 추출
        const rect = this.parseRectangleElement(el);

        // DEBUG: 파싱 결과 로그
        Logger.debug('writeRectangle rect:', {
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
            vertOffset: rect.vertOffset,
            horzOffset: rect.horzOffset,
            instId: rect.instId,
            lineColor: rect.lineColor.toString(16),
            fillColor: rect.fillColor.toString(16)
        });

        // 1. CTRL_HEADER 레코드 (gso)
        this.writeGsoCtrlHeaderForRect(rect);

        // 2. SHAPE_COMPONENT 레코드
        this.writeShapeComponentForRect(rect);

        // 3. SHAPE_COMPONENT_RECT 레코드
        this.writeShapeComponentRect(rect);

        // 4. LIST_HEADER 레코드 (도형 내부 텍스트 컨테이너)
        this.writeGsoListHeaderForRect(rect);

        // 5. 빈 PARA_HEADER (최소 1개 문단 필요)
        this.writeEmptyParagraph();
    }

    /**
     * 사각형 요소 파싱
     */
    private parseRectangleElement(el: Element): RectangleInfo {
        // hp:sz 요소
        const szEl = this.getChildElement(el, 'sz');
        const width = parseInt(szEl?.getAttribute('width') || '10000', 10);
        const height = parseInt(szEl?.getAttribute('height') || '10000', 10);

        // hp:pos 요소
        const posEl = this.getChildElement(el, 'pos');
        const treatAsChar = posEl?.getAttribute('treatAsChar') === '1';
        const vertRelTo = this.getVertRelTo(posEl?.getAttribute('vertRelTo') || 'PARA');
        const horzRelTo = this.getHorzRelTo(posEl?.getAttribute('horzRelTo') || 'COLUMN');
        const vertAlign = this.getVertAlign(posEl?.getAttribute('vertAlign') || 'TOP');
        const horzAlign = this.getHorzAlign(posEl?.getAttribute('horzAlign') || 'LEFT');
        const vertOffset = parseInt(posEl?.getAttribute('vertOffset') || '0', 10);
        const horzOffset = parseInt(posEl?.getAttribute('horzOffset') || '0', 10);

        // hp:outMargin 요소
        const outMarginEl = this.getChildElement(el, 'outMargin');
        const outMarginLeft = parseInt(outMarginEl?.getAttribute('left') || '0', 10);
        const outMarginRight = parseInt(outMarginEl?.getAttribute('right') || '0', 10);
        const outMarginTop = parseInt(outMarginEl?.getAttribute('top') || '0', 10);
        const outMarginBottom = parseInt(outMarginEl?.getAttribute('bottom') || '0', 10);

        // hp:shapeComponent 요소
        const shapeCompEl = this.getChildElement(el, 'shapeComponent');
        const horzFlip = shapeCompEl?.getAttribute('horzFlip') === '1';
        const vertFlip = shapeCompEl?.getAttribute('vertFlip') === '1';
        const x = parseInt(shapeCompEl?.getAttribute('x') || '0', 10);
        const y = parseInt(shapeCompEl?.getAttribute('y') || '0', 10);
        const alpha = parseInt(shapeCompEl?.getAttribute('alpha') || '100', 10);
        const angle = parseInt(shapeCompEl?.getAttribute('angle') || '0', 10);

        // hc:lineShape 요소 (테두리 정보)
        const lineShapeEl = this.getChildElement(el, 'lineShape');
        const lineColor = this.parseColor(lineShapeEl?.getAttribute('color') || '#000000');
        const lineWidth = this.parseLineWidth(lineShapeEl?.getAttribute('width') || '0.12 mm');
        const lineStyle = this.getLineStyle(lineShapeEl?.getAttribute('style') || 'SOLID');

        // hc:fillBrush 요소 (채우기 정보)
        const fillBrushEl = this.getChildElement(el, 'fillBrush');
        let fillType = 0;  // NONE
        let fillColor = 0xFFFFFF;  // 흰색 기본값
        if (fillBrushEl) {
            const winBrushEl = this.getChildElement(fillBrushEl, 'winBrush');
            if (winBrushEl) {
                fillType = 1;  // SOLID
                fillColor = this.parseColor(winBrushEl.getAttribute('faceColor') || '#FFFFFF');
            }
        }

        // hp:ratio 요소 (모서리 둥글기)
        const ratioEl = this.getChildElement(el, 'ratio');
        const cornerRadius = parseInt(ratioEl?.getAttribute('ratio') || '0', 10);

        // 기타 속성
        const instId = parseInt(el.getAttribute('instid') || el.getAttribute('id') || '0', 10);
        const zOrder = parseInt(el.getAttribute('zOrder') || '0', 10);
        const textWrap = this.getTextWrapType(el.getAttribute('textWrap') || 'TOP_AND_BOTTOM');
        const textFlow = this.getTextFlowType(el.getAttribute('textFlow') || 'BOTH_SIDES');

        return {
            instId,
            zOrder,
            width,
            height,
            x,
            y,
            treatAsChar,
            vertRelTo,
            horzRelTo,
            vertAlign,
            horzAlign,
            vertOffset,
            horzOffset,
            horzFlip,
            vertFlip,
            angle,
            alpha,
            textWrap,
            textFlow,
            lineColor,
            lineWidth,
            lineStyle,
            fillType,
            fillColor,
            cornerRadius,
            outMarginLeft,
            outMarginRight,
            outMarginTop,
            outMarginBottom
        };
    }

    /**
     * GSO CTRL_HEADER 레코드 작성 (사각형용)
     */
    private writeGsoCtrlHeaderForRect(rect: RectangleInfo): void {
        const data = new RecordDataWriter();

        // 컨트롤 ID (4바이트): 'gso '
        data.writeCtrlId('gso ');

        // 속성 비트 (4바이트)
        let objAttr = 0;
        objAttr |= (rect.treatAsChar ? 1 : 0);           // Bit 0: 글자처럼 취급
        objAttr |= ((rect.textWrap & 0x7) << 1);         // Bit 1-3: 텍스트 배치
        objAttr |= ((rect.textFlow & 0x3) << 4);         // Bit 4-5: 텍스트 흐름
        objAttr |= ((rect.vertRelTo & 0x3) << 6);        // Bit 6-7: 세로 기준
        objAttr |= ((rect.horzRelTo & 0x7) << 8);        // Bit 8-10: 가로 기준
        objAttr |= ((rect.vertAlign & 0x7) << 11);       // Bit 11-13: 세로 정렬
        objAttr |= ((rect.horzAlign & 0x7) << 14);       // Bit 14-16: 가로 정렬
        objAttr |= (1 << 17);                            // Bit 17: 줄 간격 영향
        objAttr |= (2 << 18);                            // Bit 18-19: 겹침 허용
        objAttr |= (2 << 20);                            // Bit 20-21: 너비 기준 - 절대값
        objAttr |= (1 << 22);                            // Bit 22-23: 높이 기준 - 절대값
        data.writeUint32(objAttr);

        // 세로 오프셋 (4바이트)
        data.writeInt32(rect.vertOffset);

        // 가로 오프셋 (4바이트)
        data.writeInt32(rect.horzOffset);

        // 너비 (4바이트)
        data.writeUint32(rect.width);

        // 높이 (4바이트)
        data.writeUint32(rect.height);

        // Z-Order (4바이트)
        data.writeInt32(rect.zOrder);

        // 바깥 여백 (각 2바이트 × 4 = 8바이트)
        data.writeInt16(rect.outMarginLeft);
        data.writeInt16(rect.outMarginRight);
        data.writeInt16(rect.outMarginTop);
        data.writeInt16(rect.outMarginBottom);

        // 인스턴스 ID (4바이트)
        data.writeUint32(rect.instId);

        // 캡션 방지 (4바이트)
        data.writeUint32(0);

        // 설명 문자열 길이 (2바이트)
        data.writeUint16(0);

        this.recordWriter.writeRecord(TAG_ID.CTRL_HEADER, this.currentLevel, data.toBuffer());
    }

    /**
     * SHAPE_COMPONENT 레코드 작성 (사각형용)
     */
    private writeShapeComponentForRect(rect: RectangleInfo): void {
        const data = new RecordDataWriter();

        const SHAPE_OBJ_RECT = 0x24726563;  // "$rec"

        // === Shape Object ID & Type ===
        data.writeUint32(SHAPE_OBJ_RECT);
        data.writeUint32(SHAPE_OBJ_RECT);

        // === Position ===
        data.writeInt32(rect.x);  // xPos
        data.writeInt32(rect.y);  // yPos

        // === Scale factor ===
        data.writeUint32(65536);  // 100%

        // === Dimensions ===
        data.writeUint32(rect.width);   // width1 (original)
        data.writeUint32(rect.height);  // height1 (original)
        data.writeUint32(rect.width);   // width2 (current)
        data.writeUint32(rect.height);  // height2 (current)

        // === Additional fields ===
        data.writeUint32(0);
        data.writeUint32(0);
        data.writeUint32(0);

        // === Flags ===
        data.writeUint32(0x00010000);

        // === 첫 번째 변환 행렬 (6 doubles = 48 bytes) ===
        data.writeDouble(1.0);  // a (scale X)
        data.writeDouble(0.0);  // b
        data.writeDouble(0.0);  // c
        data.writeDouble(0.0);  // d
        data.writeDouble(1.0);  // e
        data.writeDouble(0.0);  // f

        // === 두 번째 변환 행렬 (48 bytes) ===
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);

        // === 세 번째 변환 행렬 (32 bytes) ===
        data.writeDouble(1.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);

        // === 네 번째 변환 행렬 (16 bytes) ===
        data.writeDouble(1.0);
        data.writeDouble(0.0);

        this.recordWriter.writeRecord(TAG_ID.SHAPE_COMPONENT, this.currentLevel + 1, data.toBuffer());
    }

    /**
     * SHAPE_COMPONENT_RECT 레코드 작성
     *
     * HWP 사각형 바이너리 구조:
     * - 테두리 색상 (4바이트)
     * - 테두리 두께 (4바이트)
     * - 테두리 속성 (4바이트)
     * - 4개 꼭짓점 좌표 (32바이트)
     * - 모서리 둥글기 (4바이트)
     * - 채우기 정보
     */
    private writeShapeComponentRect(rect: RectangleInfo): void {
        const data = new RecordDataWriter();

        // === 테두리 정보 (12 bytes) ===
        data.writeColor(rect.lineColor);  // 테두리 색상 (4바이트)
        data.writeInt32(rect.lineWidth);  // 테두리 두께 (4바이트)
        data.writeUint32(rect.lineStyle); // 테두리 속성 (4바이트)

        // === 4개 꼭짓점 좌표 (32 bytes) ===
        // 좌상
        data.writeInt32(0);
        data.writeInt32(0);
        // 우상
        data.writeInt32(rect.width);
        data.writeInt32(0);
        // 우하
        data.writeInt32(rect.width);
        data.writeInt32(rect.height);
        // 좌하
        data.writeInt32(0);
        data.writeInt32(rect.height);

        // === 모서리 둥글기 (4 bytes) ===
        data.writeUint32(rect.cornerRadius);

        // === 채우기 정보 ===
        // 채우기 타입 (4바이트)
        data.writeUint32(rect.fillType);

        // 채우기가 있는 경우 추가 정보
        if (rect.fillType > 0) {
            data.writeColor(rect.fillColor);   // 채우기 색상
            data.writeUint8(0);                // 해칭 스타일
            data.writeUint8(rect.alpha);       // 투명도
        }

        this.recordWriter.writeRecord(TAG_ID.SHAPE_COMPONENT_RECT, this.currentLevel + 2, data.toBuffer());
    }

    /**
     * GSO LIST_HEADER 레코드 작성 (사각형용)
     */
    private writeGsoListHeaderForRect(rect: RectangleInfo): void {
        const data = new RecordDataWriter();

        data.writeInt16(1);              // paraCount
        data.writeUint32(0x00200000);    // property
        data.writeUint16(rect.width & 0xFFFF);  // colCount
        data.writeUint16(1);             // rowCount
        data.writeUint16(0);             // cellSpacing
        data.writeUint16(1);             // flags1
        data.writeUint16(1);             // flags2
        data.writeUint32(rect.width);    // width
        data.writeUint32(rect.height);   // height
        data.writeUint16(141);           // margin left
        data.writeUint16(141);           // margin right
        data.writeUint16(141);           // margin top
        data.writeUint16(141);           // margin bottom
        data.writeUint16(5);             // textDirection
        data.writeUint32(rect.width);    // textWidth
        data.writeZeros(9);              // padding

        this.recordWriter.writeRecord(TAG_ID.LIST_HEADER, this.currentLevel + 2, data.toBuffer());
    }

    /**
     * 색상 문자열 파싱 (#RRGGBB 또는 none)
     */
    private parseColor(colorStr: string): number {
        if (!colorStr || colorStr === 'none') {
            return 0x000000;
        }
        if (colorStr.startsWith('#')) {
            return parseInt(colorStr.slice(1), 16);
        }
        return 0x000000;
    }

    /**
     * 선 두께 파싱 (예: "0.12 mm")
     */
    private parseLineWidth(widthStr: string): number {
        if (!widthStr) return 0;
        const match = widthStr.match(/^([\d.]+)\s*(mm|pt|hwpunit)?$/i);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = (match[2] || 'mm').toLowerCase();

        switch (unit) {
            case 'mm':
                // mm를 HWPUNIT로 변환 (1mm = 283.46 HWPUNIT)
                return Math.round(value * 283.46);
            case 'pt':
                // pt를 HWPUNIT로 변환 (1pt = 100 HWPUNIT)
                return Math.round(value * 100);
            case 'hwpunit':
                return Math.round(value);
            default:
                return Math.round(value * 283.46);
        }
    }

    /**
     * 선 스타일 변환
     */
    private getLineStyle(style: string): number {
        switch (style.toUpperCase()) {
            case 'NONE': return 0;
            case 'SOLID': return 1;
            case 'DASH': return 2;
            case 'DOT': return 3;
            case 'DASH_DOT': return 4;
            case 'DASH_DOT_DOT': return 5;
            case 'LONG_DASH': return 6;
            case 'DOUBLE_SLIM': return 7;
            case 'SLIM_THICK': return 8;
            case 'THICK_SLIM': return 9;
            case 'SLIM_THICK_SLIM': return 10;
            case 'CIRCLE': return 11;
            default: return 1;  // SOLID
        }
    }

    /**
     * 그림 컨트롤 작성
     *
     * HWP 그림 레코드 구조:
     * - CTRL_HEADER (TagID 71) - 'gso ' 컨트롤
     * - SHAPE_COMPONENT (TagID 76) - 도형 속성
     * - SHAPE_COMPONENT_PICTURE (TagID 85) - 그림 속성
     */
    private writePicture(el: Element): void {
        // 그림 속성 추출
        const pic = this.parsePictureElement(el);

        // DEBUG: 파싱 결과 로그
        Logger.debug('writePicture pic:', {
            width: pic.width,
            height: pic.height,
            vertOffset: pic.vertOffset,
            horzOffset: pic.horzOffset,
            binDataID: pic.binDataID,
            instId: pic.instId
        });

        // 1. CTRL_HEADER 레코드 (gso)
        this.writeGsoCtrlHeader(pic);

        // 2. SHAPE_COMPONENT 레코드
        this.writeShapeComponent(pic);

        // 3. SHAPE_COMPONENT_PICTURE 레코드
        this.writeShapeComponentPicture(pic);

        // 4. LIST_HEADER 레코드 (그림 내부 텍스트 컨테이너)
        this.writeGsoListHeader(pic);

        // 5. 빈 PARA_HEADER (최소 1개 문단 필요)
        this.writeEmptyParagraph();
    }

    /**
     * 그림 요소 파싱
     */
    private parsePictureElement(el: Element): PictureInfo {
        // hp:sz 요소
        const szEl = this.getChildElement(el, 'sz');
        const width = parseInt(szEl?.getAttribute('width') || '10000', 10);
        const height = parseInt(szEl?.getAttribute('height') || '10000', 10);

        // hp:pos 요소
        const posEl = this.getChildElement(el, 'pos');
        const treatAsChar = posEl?.getAttribute('treatAsChar') === '1';
        const vertRelTo = this.getVertRelTo(posEl?.getAttribute('vertRelTo') || 'PARA');
        const horzRelTo = this.getHorzRelTo(posEl?.getAttribute('horzRelTo') || 'COLUMN');
        const vertAlign = this.getVertAlign(posEl?.getAttribute('vertAlign') || 'TOP');
        const horzAlign = this.getHorzAlign(posEl?.getAttribute('horzAlign') || 'LEFT');
        const vertOffset = parseInt(posEl?.getAttribute('vertOffset') || '0', 10);
        const horzOffset = parseInt(posEl?.getAttribute('horzOffset') || '0', 10);

        // hp:flip 요소
        const flipEl = this.getChildElement(el, 'flip');
        const horzFlip = flipEl?.getAttribute('horizontal') === '1';
        const vertFlip = flipEl?.getAttribute('vertical') === '1';

        // hp:rotationInfo 요소
        const rotationEl = this.getChildElement(el, 'rotationInfo');
        const angle = parseInt(rotationEl?.getAttribute('angle') || '0', 10);

        // hc:img 요소
        const imgEl = this.getChildElement(el, 'img');
        const binaryItemIDRef = imgEl?.getAttribute('binaryItemIDRef') || '';
        const binDataID = this.parseBinDataID(binaryItemIDRef);
        const bright = parseInt(imgEl?.getAttribute('bright') || '0', 10);
        const contrast = parseInt(imgEl?.getAttribute('contrast') || '0', 10);
        const effect = this.getImageEffect(imgEl?.getAttribute('effect') || 'REAL_PIC');
        const alpha = parseInt(imgEl?.getAttribute('alpha') || '0', 10);

        // hp:imgClip 요소
        const clipEl = this.getChildElement(el, 'imgClip');
        const clipLeft = parseInt(clipEl?.getAttribute('left') || '0', 10);
        const clipRight = parseInt(clipEl?.getAttribute('right') || String(width), 10);
        const clipTop = parseInt(clipEl?.getAttribute('top') || '0', 10);
        const clipBottom = parseInt(clipEl?.getAttribute('bottom') || String(height), 10);

        // hp:imgDim 요소 (원본 이미지 크기)
        const imgDimEl = this.getChildElement(el, 'imgDim');
        const imgWidth = parseInt(imgDimEl?.getAttribute('dimwidth') || String(width), 10);
        const imgHeight = parseInt(imgDimEl?.getAttribute('dimheight') || String(height), 10);

        // 기타 속성
        const instId = parseInt(el.getAttribute('instid') || el.getAttribute('id') || '0', 10);
        const zOrder = parseInt(el.getAttribute('zOrder') || '0', 10);
        const textWrap = this.getTextWrapType(el.getAttribute('textWrap') || 'TOP_AND_BOTTOM');
        const textFlow = this.getTextFlowType(el.getAttribute('textFlow') || 'BOTH_SIDES');

        // 실제 이미지 픽셀 크기 추출 (binData에서)
        let pixelWidth = 0;
        let pixelHeight = 0;
        const imageData = this.binDataMap.get(binDataID);
        if (imageData) {
            const dims = getImageDimensions(imageData);
            if (dims) {
                pixelWidth = dims.width;
                pixelHeight = dims.height;
                Logger.debug(`parsePictureElement BIN${binDataID} 픽셀 크기: ${pixelWidth} x ${pixelHeight}`);
            }
        }

        return {
            instId,
            zOrder,
            width,
            height,
            treatAsChar,
            vertRelTo,
            horzRelTo,
            vertAlign,
            horzAlign,
            vertOffset,
            horzOffset,
            horzFlip,
            vertFlip,
            angle,
            binDataID,
            bright,
            contrast,
            effect,
            alpha,
            clipLeft,
            clipRight,
            clipTop,
            clipBottom,
            textWrap,
            textFlow,
            imgWidth,
            imgHeight,
            pixelWidth,
            pixelHeight
        };
    }

    /**
     * GSO CTRL_HEADER 레코드 작성
     *
     * ctrlProperty 비트 구조:
     * - Bit 0: treatAsChar (글자처럼 취급)
     * - Bit 1-3: textWrap (텍스트 배치)
     * - Bit 4-5: textFlow (텍스트 흐름)
     * - Bit 6-7: vertRelTo (세로 기준)
     * - Bit 8-10: horzRelTo (가로 기준)
     * - Bit 11-13: vertAlign (세로 정렬)
     * - Bit 14-16: horzAlign (가로 정렬)
     * - Bit 17: affectLSpacing (줄 간격 영향)
     * - Bit 18-19: allowOverlap (겹침 허용)
     * - Bit 20-21: widthCriteria (너비 기준)
     * - Bit 22-23: heightCriteria (높이 기준)
     * - Bit 24: protect (보호)
     * - Bit 25: numberingSort (번호 정렬)
     */
    private writeGsoCtrlHeader(pic: PictureInfo): void {
        const data = new RecordDataWriter();

        // 컨트롤 ID (4바이트): 'gso '
        data.writeCtrlId('gso ');

        // 속성 비트 (4바이트) - 모든 필드 인코딩
        let objAttr = 0;
        objAttr |= (pic.treatAsChar ? 1 : 0);           // Bit 0: 글자처럼 취급
        objAttr |= ((pic.textWrap & 0x7) << 1);         // Bit 1-3: 텍스트 배치
        objAttr |= ((pic.textFlow & 0x3) << 4);         // Bit 4-5: 텍스트 흐름
        objAttr |= ((pic.vertRelTo & 0x3) << 6);        // Bit 6-7: 세로 기준
        objAttr |= ((pic.horzRelTo & 0x7) << 8);        // Bit 8-10: 가로 기준
        objAttr |= ((pic.vertAlign & 0x7) << 11);       // Bit 11-13: 세로 정렬
        objAttr |= ((pic.horzAlign & 0x7) << 14);       // Bit 14-16: 가로 정렬
        objAttr |= (1 << 17);                           // Bit 17: 줄 간격 영향 (기본값 1)
        objAttr |= (2 << 18);                           // Bit 18-19: 겹침 허용 (기본값 2)
        objAttr |= (2 << 20);                           // Bit 20-21: 너비 기준 - 절대값 (2)
        objAttr |= (1 << 22);                           // Bit 22-23: 높이 기준 - 절대값 (1)
        data.writeUint32(objAttr);

        // 세로 오프셋 (4바이트)
        data.writeInt32(pic.vertOffset);

        // 가로 오프셋 (4바이트)
        data.writeInt32(pic.horzOffset);

        // 너비 (4바이트)
        data.writeUint32(pic.width);

        // 높이 (4바이트)
        data.writeUint32(pic.height);

        // Z-Order (4바이트)
        data.writeInt32(pic.zOrder);

        // 바깥 여백 (각 2바이트 × 4 = 8바이트)
        data.writeInt16(0);  // left
        data.writeInt16(0);  // right
        data.writeInt16(0);  // top
        data.writeInt16(0);  // bottom

        // 인스턴스 ID (4바이트)
        data.writeUint32(pic.instId);

        // 캡션 방지 (4바이트)
        data.writeUint32(0);

        // 설명 문자열 길이 (2바이트)
        data.writeUint16(0);

        const buffer = data.toBuffer();
        Logger.debug('writeGsoCtrlHeader buffer length:', buffer.length);
        Logger.debug('writeGsoCtrlHeader first 20 bytes:', Array.from(buffer.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));

        this.recordWriter.writeRecord(TAG_ID.CTRL_HEADER, this.currentLevel, buffer);
    }

    /**
     * SHAPE_COMPONENT 레코드 작성 (196 bytes)
     *
     * 원본 HWP 구조 분석 결과:
     * - Offset 0-7: shapeObjId, shapeObjType ("$pic")
     * - Offset 8-15: xPos, yPos
     * - Offset 16-19: scale factor (65536 = 100%)
     * - Offset 20-35: width1, height1, width2, height2
     * - Offset 36-51: additional fields + flags
     * - Offset 52-195: transformation matrices (4개의 6x8 행렬)
     */
    private writeShapeComponent(pic: PictureInfo): void {
        const data = new RecordDataWriter();

        const SHAPE_OBJ_PICTURE = 0x24706963;  // "$pic"

        // === Offset 0-7: Shape Object ID & Type ===
        data.writeUint32(SHAPE_OBJ_PICTURE);
        data.writeUint32(SHAPE_OBJ_PICTURE);

        // === Offset 8-15: Position ===
        data.writeInt32(0);  // xPos
        data.writeInt32(0);  // yPos

        // === Offset 16-19: Scale factor ===
        data.writeUint32(65536);  // 100%

        // === Offset 20-35: Dimensions ===
        data.writeUint32(pic.width);   // width1 (original)
        data.writeUint32(pic.height);  // height1 (original)
        data.writeUint32(pic.width);   // width2 (current)
        data.writeUint32(pic.height);  // height2 (current)

        // === Offset 36-47: Additional fields (원본에서 복잡한 값들) ===
        data.writeUint32(0);  // 원본: 큰 값, 우리: 0으로 시작
        data.writeUint32(0);
        data.writeUint32(0);

        // === Offset 48-51: Flags (0x00010000 in original) ===
        data.writeUint32(0x00010000);

        // === Offset 52-99: 첫 번째 변환 행렬 (6 doubles = 48 bytes) ===
        // 2D 아핀 변환 행렬 [a, b, c, d, e, f]
        // [ a  c  e ]   [ 1  0  0 ]
        // [ b  d  f ] = [ 0  1  0 ] (identity)
        data.writeDouble(1.0);  // a (scale X) - offset 52
        data.writeDouble(0.0);  // b - offset 60
        data.writeDouble(0.0);  // c - offset 68
        data.writeDouble(0.0);  // d (should be 1.0) - offset 76
        data.writeDouble(1.0);  // e - offset 84 (original has 1.0 here)
        data.writeDouble(0.0);  // f - offset 92

        // === Offset 100-147: 두 번째 변환 행렬 (48 bytes) ===
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);

        // === Offset 148-179: 세 번째 변환 행렬 (32 bytes - short) ===
        data.writeDouble(1.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);
        data.writeDouble(0.0);

        // === Offset 180-195: 네 번째 변환 행렬 (16 bytes - very short) ===
        data.writeDouble(1.0);
        data.writeDouble(0.0);

        this.recordWriter.writeRecord(TAG_ID.SHAPE_COMPONENT, this.currentLevel + 1, data.toBuffer());
    }

    /**
     * SHAPE_COMPONENT_PICTURE 레코드 작성
     *
     * 원본 HWP 구조 분석 (91 bytes):
     * - Offset 0-11: Border info (color, width, property)
     * - Offset 12-19: Padding/flags
     * - Offset 20-43: Image coordinates (4 points, x/y pairs)
     * - Offset 44-59: Crop info (left, top, right, bottom)
     * - Offset 60-70: Padding
     * - Offset 71: binDataId (1 byte)
     * - Offset 72-73: Padding
     * - Offset 74-77: instId (4 bytes)
     * - Offset 78-90: Additional data
     */
    private writeShapeComponentPicture(pic: PictureInfo): void {
        const data = new RecordDataWriter();

        // === Offset 0-11: 테두리 정보 (12 bytes) ===
        data.writeColor(0x000000);  // 테두리 색상 (4바이트)
        data.writeInt32(0);         // 테두리 두께 (4바이트)
        data.writeUint32(0);        // 테두리 속성 (4바이트)

        // === Offset 12-19: Padding/flags (8 bytes) ===
        data.writeZeros(8);

        // === Offset 20-43: 이미지 좌표 (24 bytes) ===
        // 원본 구조: leftTop.x, leftTop.y, rightTop.x, rightTop.y, leftBottom.y, rightBottom.y
        // 원본 이미지 크기 사용 (표시 크기가 아님!)
        data.writeUint32(pic.imgWidth);   // Offset 20: leftTop.x (원본 이미지 너비)
        data.writeUint32(0);              // Offset 24: leftTop.y
        data.writeUint32(pic.imgWidth);   // Offset 28: rightTop.x
        data.writeUint32(pic.imgHeight);  // Offset 32: rightTop.y (원본 이미지 높이)
        data.writeUint32(0);              // Offset 36: padding
        data.writeUint32(pic.imgHeight);  // Offset 40: rightBottom.y

        // === Offset 44-59: 자르기/클립 정보 (16 bytes) ===
        data.writeInt32(pic.clipLeft);    // Offset 44
        data.writeInt32(pic.clipTop);     // Offset 48
        data.writeInt32(pic.clipRight);   // Offset 52
        data.writeInt32(pic.clipBottom);  // Offset 56

        // === Offset 60-70: Padding (11 bytes) ===
        data.writeZeros(11);

        // === Offset 71: binDataId (1 byte) ===
        data.writeUint8(pic.binDataID & 0xFF);

        // === Offset 72-73: Padding (2 bytes) ===
        data.writeZeros(2);

        // === Offset 74-77: instId (4 bytes) ===
        data.writeUint32(pic.instId);

        // === Offset 78-90: 추가 데이터 (13 bytes) ===
        // 밝기, 명암, 효과, 알파 및 내부 마진/크기
        data.writeInt8(pic.bright);     // Offset 78: 밝기
        data.writeInt8(pic.contrast);   // Offset 79: 명암
        data.writeUint8(pic.effect);    // Offset 80: 효과
        data.writeUint8(pic.alpha);     // Offset 81: 투명도

        // Offset 82-89: 추가 크기 필드 (픽셀 * 75)
        // HWP는 이 필드에 실제 픽셀 크기 * 75 (7200/96 DPI) 값을 사용
        let extraWidth = pic.imgWidth;
        let extraHeight = pic.imgHeight;
        if (pic.pixelWidth > 0 && pic.pixelHeight > 0) {
            extraWidth = pic.pixelWidth * HWPUNIT_PER_PIXEL_96DPI;
            extraHeight = pic.pixelHeight * HWPUNIT_PER_PIXEL_96DPI;
            Logger.debug(`writeShapeComponentPicture 추가 크기 (pixel*75): ${extraWidth} x ${extraHeight}`);
        }

        // Offset 82-85: 추가 너비 (픽셀 * 75)
        data.writeUint32(extraWidth);    // Offset 82-85

        // Offset 86-89: 추가 높이 (픽셀 * 75)
        data.writeUint32(extraHeight);   // Offset 86-89

        // Offset 90: 패딩
        data.writeUint8(0);

        // SHAPE_COMPONENT_PICTURE는 SHAPE_COMPONENT의 하위 레코드 (Level +2)
        this.recordWriter.writeRecord(TAG_ID.SHAPE_COMPONENT_PICTURE, this.currentLevel + 2, data.toBuffer());
    }

    /**
     * GSO LIST_HEADER 레코드 작성
     *
     * 그림 컨트롤 내부의 텍스트 컨테이너를 정의.
     * 원본 HWP 구조: CTRL_HEADER → SHAPE_COMPONENT → SHAPE_PICTURE → LIST_HEADER → PARA...
     *
     * LIST_HEADER 구조 (최소 47 bytes):
     * - Offset 0-1: paraCount (문단 수)
     * - Offset 2-5: property (속성 비트)
     * - Offset 6-7: colCount
     * - Offset 8-9: rowCount
     * - Offset 10-11: cellSpacing
     * - Offset 12-45: 기타 마진/속성
     * - Offset 46: padding
     */
    private writeGsoListHeader(pic: PictureInfo): void {
        const data = new RecordDataWriter();

        // 원본 LIST_HEADER 구조 (47 bytes):
        // +00-01: paraCount (Int16)
        // +02-05: property (Uint32)
        // +06-07: colCount (Uint16)
        // +08-09: rowCount (Uint16)
        // +10-11: cellSpacing (Uint16)
        // +12-13: flags (Uint16)
        // +14-15: flags (Uint16)
        // +16-19: width (Uint32)
        // +20-23: height (Uint32)
        // +24-31: margins (4 x Uint16)
        // +32-33: textDirection (Uint16)
        // +34-37: textWidth (Uint32)
        // +38-46: padding (9 bytes)

        data.writeInt16(1);              // paraCount
        data.writeUint32(0x00200000);    // property
        data.writeUint16(pic.width & 0xFFFF);  // colCount (lower 16 bits)
        data.writeUint16(1);             // rowCount
        data.writeUint16(0);             // cellSpacing
        data.writeUint16(1);             // flags1
        data.writeUint16(1);             // flags2
        data.writeUint32(pic.width);     // width
        data.writeUint32(pic.height);    // height
        data.writeUint16(141);           // margin left (0x8d)
        data.writeUint16(141);           // margin right
        data.writeUint16(141);           // margin top
        data.writeUint16(141);           // margin bottom
        data.writeUint16(5);             // textDirection
        data.writeUint32(pic.width);     // textWidth
        data.writeZeros(9);              // padding (9 bytes to make 47 total)

        this.recordWriter.writeRecord(TAG_ID.LIST_HEADER, this.currentLevel + 2, data.toBuffer());
    }

    /**
     * 빈 문단 레코드 작성 (GSO 내부용)
     *
     * GSO 내부에 최소 1개의 빈 문단이 필요
     */
    private writeEmptyParagraph(): void {
        // PARA_HEADER (24 bytes)
        const paraHeader = new RecordDataWriter();
        paraHeader.writeUint32(0);           // textLength (0 = 빈 문단)
        paraHeader.writeUint32(0x00000001);  // ctrlMask (basic)
        paraHeader.writeUint16(0);           // paraPrIDRef
        paraHeader.writeUint16(0);           // styleIDRef (2 bytes)
        paraHeader.writeUint8(0);            // pageBreak
        paraHeader.writeUint8(0);            // columnBreak
        paraHeader.writeUint16(1);           // charPosShapeCount
        paraHeader.writeUint16(0);           // rangeTagCount
        paraHeader.writeUint16(1);           // lineAlignCount
        paraHeader.writeUint32(0);           // instanceId

        this.recordWriter.writeRecord(TAG_ID.PARA_HEADER, this.currentLevel + 2, paraHeader.toBuffer());

        // PARA_CHAR_SHAPE (8 bytes) - 최소 1개
        const charShape = new RecordDataWriter();
        charShape.writeUint32(0);  // position
        charShape.writeUint32(0);  // charShapeID

        this.recordWriter.writeRecord(TAG_ID.PARA_CHAR_SHAPE, this.currentLevel + 3, charShape.toBuffer());

        // PARA_LINE_SEG (36 bytes)
        const lineSeg = new RecordDataWriter();
        lineSeg.writeUint32(0);      // textStart
        lineSeg.writeInt32(0);       // lineVPos
        lineSeg.writeInt32(1000);    // lineHeight
        lineSeg.writeInt32(860);     // textHeight
        lineSeg.writeInt32(1000);    // baseLineGap
        lineSeg.writeInt32(860);     // lineSpacing
        lineSeg.writeInt32(0);       // columnStart
        lineSeg.writeInt32(0);       // segmentWidth
        lineSeg.writeUint32(0x00300010);  // tag

        this.recordWriter.writeRecord(TAG_ID.PARA_LINE_SEG, this.currentLevel + 3, lineSeg.toBuffer());
    }

    /**
     * BinData ID 파싱
     *
     * HWPX 참조 형식:
     * - "image1", "image2" → 1, 2 (1-indexed, 그대로 사용)
     * - "BIN0001", "BIN0002" → 1, 2 (4자리 형식, 1-indexed)
     * - "BIN0", "BIN1" → 1, 2 (0-indexed, +1 필요)
     *
     * HWP binDataId는 1-based이므로 0-indexed 형식은 변환 필요
     */
    private parseBinDataID(ref: string): number {
        if (!ref) return 0;

        // "image1", "image2" 형식 (1-indexed)
        let match = ref.match(/image(\d+)/i);
        if (match) return parseInt(match[1], 10);

        // "BIN0001" 또는 "BIN0" 형식
        match = ref.match(/BIN(\d+)/i);
        if (match) {
            const num = parseInt(match[1], 10);
            const digitCount = match[1].length;

            // 4자리 형식 (BIN0001): 1-indexed
            if (digitCount >= 4) {
                return num;
            }
            // 짧은 형식 (BIN0, BIN1): 0-indexed → 1-indexed
            return num + 1;
        }

        // 숫자만
        match = ref.match(/(\d+)/);
        if (match) return parseInt(match[1], 10);

        return 0;
    }

    /**
     * 세로 기준 위치 변환
     */
    private getVertRelTo(value: string): number {
        switch (value.toUpperCase()) {
            case 'PAPER': return 0;
            case 'PAGE': return 1;
            case 'PARA': return 2;
            default: return 2;  // PARA
        }
    }

    /**
     * 가로 기준 위치 변환
     */
    private getHorzRelTo(value: string): number {
        switch (value.toUpperCase()) {
            case 'PAPER': return 0;
            case 'PAGE': return 1;
            case 'COLUMN': return 2;
            case 'PARA': return 3;
            default: return 2;  // COLUMN
        }
    }

    /**
     * 세로 정렬 변환
     */
    private getVertAlign(value: string): number {
        switch (value.toUpperCase()) {
            case 'TOP': return 0;
            case 'CENTER': return 1;
            case 'BOTTOM': return 2;
            case 'INSIDE': return 3;
            case 'OUTSIDE': return 4;
            default: return 0;  // TOP
        }
    }

    /**
     * 가로 정렬 변환
     */
    private getHorzAlign(value: string): number {
        switch (value.toUpperCase()) {
            case 'LEFT': return 0;
            case 'CENTER': return 1;
            case 'RIGHT': return 2;
            case 'INSIDE': return 3;
            case 'OUTSIDE': return 4;
            default: return 0;  // LEFT
        }
    }

    /**
     * 이미지 효과 변환
     */
    private getImageEffect(value: string): number {
        switch (value.toUpperCase()) {
            case 'REAL_PIC': return 0;
            case 'GRAY_SCALE': return 1;
            case 'BLACK_WHITE': return 2;
            default: return 0;  // REAL_PIC
        }
    }

    /**
     * 텍스트 배치 타입 변환
     */
    private getTextWrapType(value: string): number {
        switch (value.toUpperCase()) {
            case 'SQUARE': return 0;
            case 'TIGHT': return 1;
            case 'THROUGH': return 2;
            case 'TOP_AND_BOTTOM': return 3;
            case 'BEHIND_TEXT': return 4;
            case 'IN_FRONT_OF_TEXT': return 5;
            default: return 3;  // TOP_AND_BOTTOM
        }
    }

    /**
     * 텍스트 흐름 타입 변환
     */
    private getTextFlowType(value: string): number {
        switch (value.toUpperCase()) {
            case 'BOTH_SIDES': return 0;
            case 'LEFT_ONLY': return 1;
            case 'RIGHT_ONLY': return 2;
            case 'LARGEST_ONLY': return 3;
            default: return 0;  // BOTH_SIDES
        }
    }

    /**
     * 요소에서 속성값 가져오기 (정수)
     */
    private getAttrInt(el: Element, path: string, defaultValue: number): number {
        const parts = path.split('/');
        let current: Element | null = el;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current) break;
            const children = current.childNodes;
            let found = false;
            for (let j = 0; j < children.length; j++) {
                const child = children[j];
                if (child.nodeType === 1) {
                    const elem = child as Element;
                    const localName = elem.localName || elem.nodeName.split(':').pop();
                    if (localName === parts[i]) {
                        current = elem;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                current = null;
            }
        }

        if (!current) return defaultValue;

        const attrName = parts[parts.length - 1];
        const value = current.getAttribute(attrName);
        return value ? parseInt(value, 10) : defaultValue;
    }
}

/**
 * 여러 섹션의 바이너리 스트림 생성
 *
 * @param sections - HWPX 섹션 배열
 * @param binData - BinData 배열 (이미지 등)
 * @returns 섹션별 바이너리 스트림 배열
 */
export function generateSectionStreams(sections: HwpxSection[], binData?: HwpxBinData[]): Uint8Array[] {
    return sections.map(section => {
        const writer = new SectionWriter(section, binData);
        return writer.generate();
    });
}
