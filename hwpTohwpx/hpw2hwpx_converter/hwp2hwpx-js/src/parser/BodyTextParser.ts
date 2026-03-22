/**
 * BodyTextParser - HWP BodyText 스트림 파서
 *
 * OLE 파일의 BodyText/Section 스트림을 파싱하여 섹션과 문단을 추출
 *
 * BodyText 구조:
 * - 각 Section은 별도의 스트림 (Section0, Section1, ...)
 * - 각 스트림은 레코드들의 연속
 * - 문단은 PARA_HEADER로 시작하고 관련 레코드들이 뒤따름
 */

import { RecordParser, RecordDataReader, type RecordNode } from './RecordParser';
import { ParagraphParser } from './ParagraphParser';
import {
    HWP_TAG_ID,
    type EnhancedSection,
    type EnhancedParagraph,
    type PageDef,
    type HeaderFooter,
    type HWPControl,
    type HwpRecord,
    type PageBorderFill
} from '../adapters/IHwpParser';

/**
 * Parsed picture information from GSO control
 */
interface PictureInfo {
    ctrlId: string;
    record: HwpRecord;
    children: RecordNode[];
    binDataIDRef: number;
    width?: number;
    height?: number;
    vertOffset?: number;
    horzOffset?: number;
    zOrder?: number;
    bright?: number;
    contrast?: number;
    effect?: number;
    alpha?: number;
    cropLeft?: number;
    cropTop?: number;
    cropRight?: number;
    cropBottom?: number;
    treatAsChar?: number;
    textWrap?: number;
    textFlow?: number;
    vertRelTo?: number;
    horzRelTo?: number;
    vertAlign?: number;
    horzAlign?: number;
    imgWidth?: number;
    imgHeight?: number;
}

/**
 * Chart information from OLE control
 */
interface ChartInfo {
    width: number;
    height: number;
    type: number;
    x: number;
    y: number;
    data: {
        categories: unknown[];
        series: unknown[];
    };
}

/**
 * Equation control information
 */
interface EquationInfo {
    version: number;
    baseline: number;
    fontSize: number;
    inline: boolean;
    hwpEquation: string;
    script: string;
    width: number;
    height: number;
}

/**
 * Table row information
 */
interface TableRowInfo {
    cells: TableCellInfo[];
}

/**
 * Table cell information
 */
interface TableCellInfo {
    index: number;
    rowIndex: number;
    colIndex: number;
    rowAddr: number;
    colAddr: number;
    rowSpan: number;
    colSpan: number;
    width: number;
    height: number;
    paragraphs: EnhancedParagraph[];
    borderFillIDRef: number;
    header: boolean;
    protect: boolean;
    vertAlign: string;
    textDirection: string;
    marginLeft: number;
    marginRight: number;
    marginTop: number;
    marginBottom: number;
    hasMargin: boolean;
}

/**
 * Table information
 */
interface TableInfo {
    width: number;
    height: number;
    rowCount: number;
    colCount: number;
    rows: TableRowInfo[];
    borderFillIDRef: number;
}

/**
 * OLE object control information
 */
interface OLEInfo {
    type: 'EMBED';
    binDataIDRef: number;
    objDataBIDRef: number;
    width: number;
    height: number;
    x: number;
    y: number;
    zOrder: number;
    drawAspect: 'CONTENT' | 'ICON';
    programId: string;
    hasMoniker: boolean;
    treatAsChar: boolean;
    textWrap: number;
    vertRelTo: number;
    horzRelTo: number;
    vertAlign: number;
    horzAlign: number;
    vertOffset: number;
    horzOffset: number;
}

/**
 * Form control information
 */
interface FormInfo {
    formType: 'CHECKBOX' | 'RADIO' | 'COMBOBOX' | 'EDIT' | 'LISTBOX' | 'BUTTON';
    name: string;
    width: number;
    height: number;
    value: string;
    checked: boolean;
    items: string[];
    enabled: boolean;
    readonly: boolean;
}

/**
 * Shape base properties (from SHAPE_COMPONENT)
 */
interface ShapeBaseProps {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}

/**
 * Shape information for various shape types
 */
interface ShapeInfo extends ShapeBaseProps {
    type: 'POLYGON' | 'RECTANGLE' | 'ELLIPSE' | 'LINE' | 'CURVE' | 'CONTAINER';
    points?: Array<{ x: number; y: number }>;
    controlPoints?: Array<{ x: number; y: number }>;
    cornerRadius?: number;
    arcType?: string;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    closed?: boolean;
    // Container-specific properties
    children?: HWPControl[];
    groupLevel?: number;
    zOrder?: number;
    lineColor?: number;
    lineWidth?: number;
    lineStyle?: number;
}

/**
 * BodyText 파서
 */
export class BodyTextParser {
    private data: Uint8Array;
    private sectionIndex: number;

    constructor(data: Uint8Array, sectionIndex: number = 0) {
        this.data = data;
        this.sectionIndex = sectionIndex;
    }

    /**
     * 섹션 파싱
     */
    parse(): EnhancedSection {
        const recordParser = new RecordParser(this.data);
        const hierarchy = recordParser.parseHierarchy();

        // Debug: console.log(`[BodyTextParser] Section ${this.sectionIndex}: ${hierarchy.length} top-level records`);

        const paragraphs: EnhancedParagraph[] = [];
        let pageDef: PageDef | undefined;
        let pageBorderFill: PageBorderFill | undefined;
        const headerFooters: HeaderFooter[] = [];

        let paraIndex = 0;

        for (const node of hierarchy) {
            switch (node.record.tagId) {
                case HWP_TAG_ID.PARA_HEADER: {
                    // 문단 파싱 (테이블 포함)
                    const para = this.parseParagraphWithTable(node, paraIndex);
                    paragraphs.push(para);
                    paraIndex++;
                    break;
                }

                case HWP_TAG_ID.PAGE_DEF:
                    // 페이지 정의 파싱
                    pageDef = this.parsePageDef(node);
                    break;

                case HWP_TAG_ID.PAGE_BORDER_FILL:
                    // 페이지 테두리/배경 파싱
                    pageBorderFill = this.parsePageBorderFill(node);
                    break;

                case HWP_TAG_ID.CTRL_HEADER:
                    // 헤더/푸터 등 문단 외 컨트롤
                    this.parseTopLevelControl(node, headerFooters);
                    break;
            }
        }

        // Debug: console.log(`[BodyTextParser] Section ${this.sectionIndex}: ${paragraphs.length} paragraphs extracted`);

        return {
            index: this.sectionIndex,
            paragraphs,
            pageDef,
            pageBorderFill,
            headerFooters,
            rawRecords: hierarchy.map(n => n.record)
        };
    }

    /**
     * 문단 파싱 (테이블 컨트롤 포함)
     */
    private parseParagraphWithTable(paraNode: RecordNode, paraIndex: number): EnhancedParagraph {
        // 기본 문단 파싱
        const para = ParagraphParser.parseParagraph(paraNode, paraIndex);

        // 테이블 및 GSO 컨트롤 찾기 및 상세 파싱
        const enhancedControls: HWPControl[] = [];

        for (const child of paraNode.children) {
            if (child.record.tagId === HWP_TAG_ID.CTRL_HEADER) {
                const ctrlId = this.getControlId(child.record.data);

                if (ctrlId === 'tbl ') {
                    // 테이블 컨트롤 상세 파싱
                    const table = this.parseTableControl(child);
                    if (table) {
                        enhancedControls.push({
                            type: 'TABLE',
                            obj: table
                        });
                    }
                } else if (ctrlId === 'gso ') {
                    // GSO (그리기 개체) 컨트롤 파싱 - 텍스트 박스, 워드아트 등
                    const gso = this.parseGsoControl(child);
                    if (gso) {
                        enhancedControls.push(gso);
                    }
                } else if (ctrlId === 'eqed') {
                    // 수식 컨트롤 파싱
                    const equation = this.parseEquationControl(child);
                    if (equation) {
                        enhancedControls.push({
                            type: 'EQUATION',
                            obj: equation
                        });
                    }
                } else if (ctrlId === 'ole ') {
                    // OLE 객체 컨트롤 파싱 (Excel, Word 등)
                    const ole = this.parseOLEControl(child);
                    if (ole) {
                        enhancedControls.push({
                            type: 'OLE',
                            obj: ole
                        });
                    }
                } else if (this.isFormControl(ctrlId)) {
                    // 양식 컨트롤 파싱 (체크박스, 라디오 등)
                    const form = this.parseFormControl(child, ctrlId);
                    if (form) {
                        enhancedControls.push({
                            type: 'FORM',
                            obj: form
                        });
                    }
                } else if (ctrlId === 'memo') {
                    // 메모(주석) 컨트롤 파싱
                    const memo = this.parseMemoControl(child);
                    if (memo) {
                        enhancedControls.push(memo);
                    }
                } else {
                    // 다른 컨트롤은 ParagraphParser에서 처리된 것 사용
                    // FIELD_BEGIN, FIELD_END 등 기존 컨트롤 찾기
                    const existingCtrls = para.controls.filter(c =>
                        c.type !== 'TABLE' &&
                        c.type !== 'FIELD_BEGIN' &&
                        c.type !== 'FIELD_END'
                    );
                    enhancedControls.push(...existingCtrls);
                }
            }
        }

        // 필드 컨트롤(FIELD_BEGIN, FIELD_END)은 ParagraphParser에서 추출된 것 보존
        const fieldControls = para.controls.filter(c =>
            c.type === 'FIELD_BEGIN' || c.type === 'FIELD_END'
        );

        // 컨트롤이 있으면 controls 교체 (필드 컨트롤 보존)
        if (enhancedControls.length > 0 || fieldControls.length > 0) {
            para.controls = [...enhancedControls, ...fieldControls];
        }

        return para;
    }

    /**
     * GSO (그리기 개체) 컨트롤 파싱
     * 텍스트 박스, 워드아트, 차트, 도형 등에서 타입 구분
     */
    private parseGsoControl(ctrlNode: RecordNode): HWPControl | null {
        // 먼저 차트인지 확인 (OLE 객체 중 차트)
        const chartInfo = this.detectChart(ctrlNode);
        if (chartInfo) {
            return {
                type: 'CHART',
                obj: chartInfo
            };
        }

        // 그림(SHAPE_COMPONENT_PICTURE)인지 확인
        const pictureInfo = this.parsePictureGso(ctrlNode);
        if (pictureInfo) {
            return {
                type: 'PICTURE',
                obj: pictureInfo
            };
        }

        // 도형(SHAPE_COMPONENT_*) 확인 - 다각형, 사각형, 타원, 선 등
        const shapeInfo = this.parseShapeGso(ctrlNode);
        if (shapeInfo) {
            return {
                type: 'SHAPE',
                obj: shapeInfo
            };
        }

        // GSO 내부의 모든 텍스트 수집
        const paragraphs: EnhancedParagraph[] = [];
        this.collectGsoTexts(ctrlNode, paragraphs, 0);

        if (paragraphs.length === 0) {
            // 텍스트가 없는 GSO는 PICTURE로 처리 (fallback)
            return {
                type: 'PICTURE',
                obj: {
                    ctrlId: 'gso ',
                    record: ctrlNode.record,
                    children: ctrlNode.children,
                    binDataIDRef: 0
                }
            };
        }

        // 텍스트가 있는 GSO는 TEXTBOX로 처리
        return {
            type: 'TEXTBOX',
            obj: {
                paragraphs,
                ctrlId: 'gso ',
                record: ctrlNode.record
            }
        };
    }

    /**
     * SHAPE_COMPONENT_* 레코드에서 도형 정보 파싱
     * 지원: POLYGON, RECT, ELLIPSE, LINE, CURVE
     */
    private parseShapeGso(ctrlNode: RecordNode): ShapeInfo | null {
        // 도형 타입별 레코드 찾기
        const result: {
            shapeType: string | null;
            shapeRecord: RecordNode | null;
            componentRecord: RecordNode | null;
        } = {
            shapeType: null,
            shapeRecord: null,
            componentRecord: null
        };

        const findShapeRecords = (node: RecordNode): void => {
            switch (node.record.tagId) {
                case HWP_TAG_ID.SHAPE_COMPONENT:
                    result.componentRecord = node;
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_POLYGON:
                    result.shapeType = 'POLYGON';
                    result.shapeRecord = node;
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_RECT:
                    result.shapeType = 'RECTANGLE';
                    result.shapeRecord = node;
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_ELLIPSE:
                    result.shapeType = 'ELLIPSE';
                    result.shapeRecord = node;
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_LINE:
                    result.shapeType = 'LINE';
                    result.shapeRecord = node;
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_CURVE:
                    result.shapeType = 'CURVE';
                    result.shapeRecord = node;
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_ARC:
                    result.shapeType = 'ELLIPSE'; // Arc는 Ellipse의 일종
                    result.shapeRecord = node;
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_CONTAINER:
                    result.shapeType = 'CONTAINER';
                    result.shapeRecord = node;
                    break;
            }
            for (const child of node.children) {
                findShapeRecords(child);
            }
        };

        findShapeRecords(ctrlNode);

        if (!result.shapeType || !result.shapeRecord) {
            return null; // 지원되는 도형 컴포넌트가 없음
        }

        // SHAPE_COMPONENT에서 기본 도형 속성 추출
        const baseProps = this.parseShapeComponent(result.componentRecord);

        // 도형 타입별 속성 파싱
        switch (result.shapeType) {
            case 'POLYGON':
                return this.parsePolygonShape(result.shapeRecord, baseProps);
            case 'RECTANGLE':
                return this.parseRectangleShape(result.shapeRecord, baseProps);
            case 'ELLIPSE':
                return this.parseEllipseShape(result.shapeRecord, baseProps);
            case 'LINE':
                return this.parseLineShape(result.shapeRecord, baseProps);
            case 'CURVE':
                return this.parseCurveShape(result.shapeRecord, baseProps);
            case 'CONTAINER':
                return this.parseContainerShape(result.shapeRecord, baseProps, ctrlNode);
            default:
                return null;
        }
    }

    /**
     * SHAPE_COMPONENT 레코드에서 기본 도형 속성 추출
     */
    private parseShapeComponent(node: RecordNode | null): ShapeBaseProps {
        const defaultProps: ShapeBaseProps = {
            x: 0, y: 0, width: 10000, height: 10000, rotation: 0
        };

        if (!node) return defaultProps;

        const data = node.record.data;
        if (data.length < 24) return defaultProps;

        try {
            // SHAPE_COMPONENT 구조 (일부):
            // Offset 0-3: x 좌표
            // Offset 4-7: y 좌표
            // Offset 8-9: groupLevel
            // Offset 10-11: localFileVersion
            // Offset 12-15: originWidth
            // Offset 16-19: originHeight
            // Offset 20-21: curWidth
            // Offset 22-23: curHeight
            // Offset 24-25: horzFlip
            // Offset 26-27: vertFlip
            // Offset 28-29: rotation (angle in degrees * 10)
            const x = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
            const y = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);

            let width = 10000, height = 10000, rotation = 0;
            if (data.length >= 20) {
                width = data[12] | (data[13] << 8) | (data[14] << 16) | (data[15] << 24);
                height = data[16] | (data[17] << 8) | (data[18] << 16) | (data[19] << 24);
            }
            if (data.length >= 30) {
                const rotRaw = data[28] | (data[29] << 8);
                rotation = rotRaw / 10; // Convert to degrees
            }

            return { x, y, width: width || 10000, height: height || 10000, rotation };
        } catch {
            return defaultProps;
        }
    }

    /**
     * SHAPE_COMPONENT_POLYGON에서 다각형 정보 파싱
     */
    private parsePolygonShape(node: RecordNode, baseProps: ShapeBaseProps): ShapeInfo {
        const points: Array<{ x: number; y: number }> = [];
        const data = node.record.data;

        if (data.length >= 4) {
            // SHAPE_COMPONENT_POLYGON 구조:
            // Offset 0-3: 점 개수
            // Offset 4+: 점 좌표 (각 8바이트: int32 x, int32 y)
            const pointCount = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
            const validPointCount = Math.min(pointCount, Math.floor((data.length - 4) / 8));

            for (let i = 0; i < validPointCount; i++) {
                const offset = 4 + i * 8;
                if (offset + 8 <= data.length) {
                    const x = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
                    const y = data[offset + 4] | (data[offset + 5] << 8) | (data[offset + 6] << 16) | (data[offset + 7] << 24);
                    points.push({ x, y });
                }
            }
        }

        return {
            type: 'POLYGON',
            ...baseProps,
            points,
            closed: points.length > 2
        };
    }

    /**
     * SHAPE_COMPONENT_RECT에서 사각형 정보 파싱
     */
    private parseRectangleShape(node: RecordNode, baseProps: ShapeBaseProps): ShapeInfo {
        const data = node.record.data;
        let cornerRadius = 0;

        if (data.length >= 4) {
            // SHAPE_COMPONENT_RECT 구조:
            // Offset 0-3: cornerRadius (모서리 곡률)
            cornerRadius = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
        }

        return {
            type: 'RECTANGLE',
            ...baseProps,
            cornerRadius
        };
    }

    /**
     * SHAPE_COMPONENT_ELLIPSE에서 타원 정보 파싱
     */
    private parseEllipseShape(node: RecordNode, baseProps: ShapeBaseProps): ShapeInfo {
        const data = node.record.data;
        let arcType = 'FULL'; // PIE, CHORD, FULL

        if (data.length >= 4) {
            const arcTypeValue = data[0];
            switch (arcTypeValue) {
                case 0: arcType = 'FULL'; break;
                case 1: arcType = 'PIE'; break;
                case 2: arcType = 'CHORD'; break;
            }
        }

        return {
            type: 'ELLIPSE',
            ...baseProps,
            arcType
        };
    }

    /**
     * SHAPE_COMPONENT_LINE에서 선 정보 파싱
     */
    private parseLineShape(node: RecordNode, baseProps: ShapeBaseProps): ShapeInfo {
        const data = node.record.data;
        let startX = 0, startY = 0, endX = baseProps.width, endY = baseProps.height;

        if (data.length >= 16) {
            // SHAPE_COMPONENT_LINE 구조:
            // Offset 0-3: startX
            // Offset 4-7: startY
            // Offset 8-11: endX
            // Offset 12-15: endY
            startX = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
            startY = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
            endX = data[8] | (data[9] << 8) | (data[10] << 16) | (data[11] << 24);
            endY = data[12] | (data[13] << 8) | (data[14] << 16) | (data[15] << 24);
        }

        return {
            type: 'LINE',
            ...baseProps,
            startX, startY, endX, endY
        };
    }

    /**
     * SHAPE_COMPONENT_CURVE에서 곡선 정보 파싱
     */
    private parseCurveShape(node: RecordNode, baseProps: ShapeBaseProps): ShapeInfo {
        const controlPoints: Array<{ x: number; y: number }> = [];
        const data = node.record.data;

        if (data.length >= 4) {
            // SHAPE_COMPONENT_CURVE 구조:
            // Offset 0-3: 점 개수
            // Offset 4+: 제어점 좌표 (각 8바이트: int32 x, int32 y)
            const pointCount = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
            const validPointCount = Math.min(pointCount, Math.floor((data.length - 4) / 8));

            for (let i = 0; i < validPointCount; i++) {
                const offset = 4 + i * 8;
                if (offset + 8 <= data.length) {
                    const x = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
                    const y = data[offset + 4] | (data[offset + 5] << 8) | (data[offset + 6] << 16) | (data[offset + 7] << 24);
                    controlPoints.push({ x, y });
                }
            }
        }

        return {
            type: 'CURVE',
            ...baseProps,
            controlPoints
        };
    }

    /**
     * SHAPE_COMPONENT_PICTURE 레코드에서 그림 정보 파싱
     */
    private parsePictureGso(ctrlNode: RecordNode): PictureInfo | null {
        // SHAPE_COMPONENT_PICTURE와 CTRL_HEADER 찾기
        const result: { pictureRecord: RecordNode | null; ctrlHeaderRecord: RecordNode | null } = {
            pictureRecord: null,
            ctrlHeaderRecord: null
        };

        const findRecords = (node: RecordNode): void => {
            if (node.record.tagId === HWP_TAG_ID.CTRL_HEADER) {
                result.ctrlHeaderRecord = node;
            }
            if (node.record.tagId === HWP_TAG_ID.SHAPE_COMPONENT_PICTURE) {
                result.pictureRecord = node;
            }
            for (const child of node.children) {
                findRecords(child);
            }
        };

        findRecords(ctrlNode);

        if (!result.pictureRecord) {
            return null; // SHAPE_COMPONENT_PICTURE가 없으면 그림 아님
        }

        const data = result.pictureRecord.record.data;
        if (data.length < 72) {
            return null;
        }

        const reader = new RecordDataReader(data);

        // SHAPE_COMPONENT_PICTURE 구조 파싱
        // Offset 0-11: border info (skip)
        reader.skip(12);

        // Offset 12-19: padding
        reader.skip(8);

        // Offset 20-43: image coordinates (6 x 4 bytes)
        const imgCoords = {
            x0: reader.readUint32(),
            y0: reader.readUint32(),
            x1: reader.readUint32(),
            y1: reader.readUint32(),
            x2: reader.readUint32(),
            y2: reader.readUint32()
        };

        // Offset 44-59: clip info
        const clipLeft = reader.readInt32();
        const clipTop = reader.readInt32();
        const clipRight = reader.readInt32();
        const clipBottom = reader.readInt32();

        // Offset 60-65: additional fields
        reader.skip(6);

        // binDataId 추출 (hwplib-js PictureParser 방식 참고)
        // SHAPE_COMPONENT_PICTURE에서 여러 오프셋을 스캔하여 유효한 binDataId 후보 수집
        let binDataId = 0;

        // 여러 오프셋에서 UINT16 값을 읽어 후보 수집
        const candidates: { offset: number, value: number }[] = [];
        for (let i = 0; i <= Math.min(data.length - 2, 80); i += 2) {
            const val = data[i] | (data[i + 1] << 8);
            // 유효한 BinData ID 범위 (1-100)
            if (val >= 1 && val <= 100) {
                candidates.push({ offset: i, value: val });
            }
        }

        // 우선순위: 1-13 범위의 작은 값 (일반적인 BinData ID)
        const smallCandidates = candidates.filter(c => c.value >= 1 && c.value <= 13);
        if (smallCandidates.length > 0) {
            // 가장 앞에 있는 유효한 값 선택
            binDataId = smallCandidates[0].value;
        } else if (candidates.length > 0) {
            // 작은 값이 없으면 첫 번째 후보 사용
            binDataId = candidates[0].value;
        }

        // 이미지 효과 (offset 78-81)
        let bright = 0, contrast = 0, effect = 0, alpha = 0;
        if (data.length >= 82) {
            bright = data[78] > 127 ? data[78] - 256 : data[78];  // signed
            contrast = data[79] > 127 ? data[79] - 256 : data[79];  // signed
            effect = data[80];
            alpha = data[81];
        }

        // CTRL_HEADER에서 크기와 위치 정보 추출
        let width = imgCoords.x1;
        let height = imgCoords.y1;
        let vertOffset = 0;
        let horzOffset = 0;
        let zOrder = 0;

        // objAttr 비트 필드 파싱을 위한 기본값
        let treatAsChar = 0;
        let textWrap = 0;
        let textFlow = 0;
        let vertRelTo = 0;
        let horzRelTo = 0;
        let vertAlign = 0;
        let horzAlign = 0;

        if (result.ctrlHeaderRecord && result.ctrlHeaderRecord.record.data.length >= 32) {
            const ctrlData = result.ctrlHeaderRecord.record.data;
            const ctrlReader = new RecordDataReader(ctrlData);
            ctrlReader.skip(4);  // ctrlId

            // objAttr (ctrlProperty) - 위치/배치 속성 비트 필드
            const objAttr = ctrlReader.readUint32();
            treatAsChar = objAttr & 1;                    // Bit 0
            textWrap = (objAttr >> 1) & 0x7;             // Bit 1-3
            textFlow = (objAttr >> 4) & 0x3;             // Bit 4-5
            vertRelTo = (objAttr >> 6) & 0x3;            // Bit 6-7
            horzRelTo = (objAttr >> 8) & 0x7;            // Bit 8-10
            vertAlign = (objAttr >> 11) & 0x7;           // Bit 11-13
            horzAlign = (objAttr >> 14) & 0x7;           // Bit 14-16

            vertOffset = ctrlReader.readInt32();
            horzOffset = ctrlReader.readInt32();
            width = ctrlReader.readUint32();
            height = ctrlReader.readUint32();
            zOrder = ctrlReader.readInt32();
        }

        return {
            ctrlId: 'gso ',
            record: ctrlNode.record,
            children: ctrlNode.children,
            binDataIDRef: binDataId,
            width,
            height,
            vertOffset,
            horzOffset,
            zOrder,
            bright,
            contrast,
            effect,
            alpha,
            cropLeft: clipLeft,
            cropTop: clipTop,
            cropRight: clipRight,
            cropBottom: clipBottom,
            // 위치/배치 속성
            treatAsChar,
            textWrap,
            textFlow,
            vertRelTo,
            horzRelTo,
            vertAlign,
            horzAlign,
            // 원본 이미지 크기 (SHAPE_COMPONENT_PICTURE의 이미지 좌표에서 추출)
            imgWidth: imgCoords.x0 || imgCoords.x1,  // 원본 이미지 너비
            imgHeight: imgCoords.y1 || imgCoords.y2   // 원본 이미지 높이
        };
    }

    /**
     * GSO 내에서 차트(OLE) 감지
     * 차트는 SHAPE_COMPONENT_OLE (TagID 84) 또는 CHART_DATA (TagID 95) 레코드를 포함
     */
    private detectChart(ctrlNode: RecordNode): ChartInfo | null {
        // CHART_DATA 레코드가 있으면 parseChartData 사용
        let hasChartData = false;
        let hasOleRecord = false;

        const checkForChart = (node: RecordNode): void => {
            if (node.record.tagId === HWP_TAG_ID.CHART_DATA) {
                hasChartData = true;
            }
            if (node.record.tagId === HWP_TAG_ID.SHAPE_COMPONENT_OLE) {
                hasOleRecord = true;
            }
            for (const child of node.children) {
                checkForChart(child);
            }
        };

        checkForChart(ctrlNode);

        // OLE가 없으면 차트 아님
        if (!hasOleRecord) {
            return null;
        }

        // CHART_DATA가 있으면 상세 파싱 사용
        if (hasChartData) {
            return this.parseChartData(ctrlNode);
        }

        // CHART_DATA가 없는 OLE 차트는 기본값으로 처리
        // SHAPE_COMPONENT에서 크기 추출
        let width = 20000;
        let height = 15000;

        const findShapeComponent = (node: RecordNode): RecordNode | null => {
            if (node.record.tagId === HWP_TAG_ID.SHAPE_COMPONENT) {
                return node;
            }
            for (const child of node.children) {
                const found = findShapeComponent(child);
                if (found) return found;
            }
            return null;
        };

        const shapeComponent = findShapeComponent(ctrlNode);
        if (shapeComponent && shapeComponent.record.data.length >= 16) {
            const shapeData = shapeComponent.record.data;
            const reader = new RecordDataReader(shapeData);
            if (reader.remaining >= 16) {
                reader.skip(8);
                width = Math.abs(reader.readInt32()) || 20000;
                height = Math.abs(reader.readInt32()) || 15000;
            }
        }

        return {
            width,
            height,
            type: 0, // ChartType.COLUMN (기본값)
            x: 0,
            y: 0,
            data: {
                categories: [],
                series: []
            }
        };
    }

    /**
     * 수식(Equation) 컨트롤 파싱
     *
     * HWP 수식 레코드 구조:
     * CTRL_HEADER (ctrlId='eqed')
     * ├── CTRL_DATA (TagID 72)
     * └── EQEDIT (TagID 88)
     *     ├── version (4 bytes, uint32)
     *     ├── baseline (2 bytes, uint16)
     *     ├── fontSize (2 bytes, uint16)
     *     ├── inline (1 byte, boolean)
     *     ├── unknown (1 byte)
     *     ├── scriptLen (2 bytes, uint16)
     *     └── script (UTF-16LE string)
     */
    private parseEquationControl(ctrlNode: RecordNode): EquationInfo | null {
        // EQEDIT 레코드 찾기 (TagID 88)
        const EQEDIT_TAG_ID = 88;
        let eqEditRecord: RecordNode | null = null;

        // 자식 노드에서 EQEDIT 찾기
        for (const child of ctrlNode.children) {
            if (child.record.tagId === EQEDIT_TAG_ID) {
                eqEditRecord = child;
                break;
            }
            // 더 깊은 레벨에서 찾기
            for (const grandchild of child.children) {
                if (grandchild.record.tagId === EQEDIT_TAG_ID) {
                    eqEditRecord = grandchild;
                    break;
                }
            }
            if (eqEditRecord) break;
        }

        if (!eqEditRecord || eqEditRecord.record.data.length < 12) {
            return null;
        }

        const data = eqEditRecord.record.data;
        const reader = new RecordDataReader(data);

        // EQEDIT 파싱
        const version = reader.readUint32();
        const baseline = reader.readUint16();
        const fontSize = reader.readUint16();
        const inline = reader.readUint8();
        reader.readUint8(); // unknown byte
        const scriptLen = reader.readUint16();

        // 수식 스크립트 읽기 (UTF-16LE)
        let script = '';
        for (let i = 0; i < scriptLen && reader.remaining >= 2; i++) {
            const ch = reader.readUint16();
            if (ch > 0 && ch < 0xFFFF) {
                script += String.fromCharCode(ch);
            }
        }

        // 수식 크기 파싱 (CTRL_HEADER에서)
        const ctrlData = ctrlNode.record.data;
        let width = 10000;
        let height = 5000;

        // CTRL_HEADER에서 크기 정보 추출 시도
        if (ctrlData.length >= 40) {
            const ctrlReader = new RecordDataReader(ctrlData);
            ctrlReader.skip(4); // ctrlId
            // 속성들 스킵
            ctrlReader.skip(30); // 기타 속성들
            if (ctrlReader.remaining >= 8) {
                width = ctrlReader.readUint32();
                height = ctrlReader.readUint32();
            }
        }

        return {
            version,
            baseline,
            fontSize: fontSize * 10, // pt -> HWPUNIT 변환 (10pt = 100 HWPUNIT에서 height는 1000)
            inline: inline === 1,
            hwpEquation: script,
            script: script,
            width: width || 10000,
            height: height || 5000
        };
    }

    /**
     * GSO 내부에서 텍스트 재귀적으로 수집
     */
    private collectGsoTexts(node: RecordNode, paragraphs: EnhancedParagraph[], paraIndex: number): number {
        // PARA_HEADER를 찾아서 문단 파싱
        if (node.record.tagId === HWP_TAG_ID.PARA_HEADER) {
            const para = ParagraphParser.parseParagraph(node, paraIndex);
            if (para.text && para.text.trim()) {
                paragraphs.push(para);
                paraIndex++;
            }
        }

        // 자식 노드들 재귀 탐색
        for (const child of node.children) {
            paraIndex = this.collectGsoTexts(child, paragraphs, paraIndex);
        }

        return paraIndex;
    }

    /**
     * 컨트롤 ID 추출
     */
    private getControlId(data: Uint8Array): string {
        if (data.length < 4) return '';
        return String.fromCharCode(data[3], data[2], data[1], data[0]);
    }

    /**
     * 문단의 GSO 컨트롤을 텍스트 박스로 변환
     * 테이블 셀 내부의 문단에서도 GSO 텍스트를 추출하기 위함
     */
    private enhanceParagraphWithGso(para: EnhancedParagraph, paraNode: RecordNode): EnhancedParagraph {
        const enhancedControls: HWPControl[] = [];

        for (const child of paraNode.children) {
            if (child.record.tagId === HWP_TAG_ID.CTRL_HEADER) {
                const ctrlId = this.getControlId(child.record.data);

                if (ctrlId === 'gso ') {
                    // GSO 컨트롤 파싱 (텍스트 박스)
                    const gso = this.parseGsoControl(child);
                    if (gso) {
                        enhancedControls.push(gso);
                    }
                } else {
                    // 기존 컨트롤 유지
                    const existingCtrl = para.controls?.find(c =>
                        c.type !== 'TABLE' && c.type !== 'PICTURE'
                    );
                    if (existingCtrl) {
                        enhancedControls.push(existingCtrl);
                    }
                }
            }
        }

        // GSO 컨트롤이 있으면 controls 업데이트
        if (enhancedControls.length > 0) {
            return {
                ...para,
                controls: enhancedControls
            };
        }

        return para;
    }

    /**
     * 테이블 컨트롤 상세 파싱
     *
     * HWP 레코드 구조:
     * CTRL_HEADER
     * ├── TABLE
     * ├── LIST_HEADER (셀1) ← 자식 없음!
     * ├── PARA_HEADER (셀1의 문단) ← LIST_HEADER의 형제
     * ├── LIST_HEADER (셀2)
     * ├── PARA_HEADER (셀2의 문단)
     * ...
     */
    private parseTableControl(ctrlNode: RecordNode): TableInfo | null {
        // TABLE 레코드 찾기 및 셀 정보 수집
        let tableRecord: RecordNode | undefined;

        // 셀 구조: LIST_HEADER와 그 뒤의 PARA_HEADER들을 연결
        interface CellData {
            listNode: RecordNode;
            paraNodes: RecordNode[];
        }
        const cells: CellData[] = [];
        let currentCell: CellData | null = null;

        // 디버그: ctrlNode의 children 개수 확인
        let listHeaderCount = 0;
        let paraHeaderCount = 0;

        for (const child of ctrlNode.children) {
            if (child.record.tagId === HWP_TAG_ID.TABLE) {
                tableRecord = child;
            } else if (child.record.tagId === HWP_TAG_ID.LIST_HEADER) {
                listHeaderCount++;
                // 새 셀 시작
                currentCell = { listNode: child, paraNodes: [] };
                cells.push(currentCell);
            } else if (child.record.tagId === HWP_TAG_ID.PARA_HEADER) {
                paraHeaderCount++;
                // 현재 셀에 문단 추가
                if (currentCell) {
                    currentCell.paraNodes.push(child);
                }
            }
        }

        // Debug: console.log(`[BodyTextParser] CTRL children: ${ctrlNode.children.length}, LIST_HEADER: ${listHeaderCount}, PARA_HEADER: ${paraHeaderCount}`);

        if (!tableRecord) {
            console.warn('[BodyTextParser] TABLE record not found in CTRL_HEADER');
            return null;
        }

        // TABLE 레코드 파싱
        const tableData = this.parseTableRecord(tableRecord.record.data);

        // 셀 파싱
        const rows: TableRowInfo[] = [];
        let cellIndex = 0;

        // Debug: console.log(`[BodyTextParser] Processing ${cells.length} cells for ${tableData.rowCount}x${tableData.colCount} table`);

        for (const cellData of cells) {
            const cell = this.parseTableCellWithParas(cellData.listNode, cellData.paraNodes, cellIndex);
            if (!cell) {
                // Debug: console.log(`[BodyTextParser] Cell ${cellIndex} parsing returned null`);
                cellIndex++;
                continue;
            }

            // HWP 파일에 저장된 셀 위치 사용 (계산하지 않음)
            const row = cell.rowIndex;

            // 행 배열에 추가
            if (!rows[row]) {
                rows[row] = { cells: [] };
            }
            rows[row].cells.push(cell);

            cellIndex++;
        }

        // Debug: console.log(`[BodyTextParser] Parsed table: ${tableData.rowCount}x${tableData.colCount}, ${cellIndex} cells, rows: ${rows.filter(r => r).length}`);

        return {
            width: tableData.width,
            height: tableData.height,
            rowCount: tableData.rowCount,
            colCount: tableData.colCount,
            rows: rows.filter(r => r), // null 제거
            borderFillIDRef: tableData.borderFillID || 3
        };
    }

    /**
     * TABLE 레코드 파싱
     */
    private parseTableRecord(data: Uint8Array): {
        rowCount: number;
        colCount: number;
        borderFillID: number;
        width: number;
        height: number;
    } {
        const reader = new RecordDataReader(data);

        reader.readUint32(); // property (unused)
        const rowCount = reader.readUint16();
        const colCount = reader.readUint16();
        reader.readUint16(); // cellSpacing (unused)

        // 여백
        const marginLeft = reader.readUint16();
        const marginRight = reader.readUint16();
        const marginTop = reader.readUint16();
        const marginBottom = reader.readUint16();

        // 행 높이
        const rowHeights: number[] = [];
        for (let i = 0; i < rowCount && reader.remaining >= 2; i++) {
            rowHeights.push(reader.readUint16());
        }

        // borderFillID
        const borderFillID = reader.remaining >= 2 ? reader.readUint16() : 3;

        // 크기 계산
        const width = marginLeft + marginRight + 42520; // 기본 너비
        const height = rowHeights.reduce((a, b) => a + b, 0) + marginTop + marginBottom;

        return { rowCount, colCount, borderFillID, width, height };
    }

    /**
     * 테이블 셀 파싱 (문단 노드들을 별도로 전달받음)
     *
     * HWP 구조에서 LIST_HEADER의 자식에는 문단이 없고,
     * 문단들은 LIST_HEADER의 형제로 나타남
     *
     * LIST_HEADER 바이너리 구조 (TABLE 내 셀):
     * - Offset 0-1: nPara (2 bytes) - 셀 내 문단 수
     * - Offset 2-5: Property (4 bytes) - 속성 비트필드
     *   - Bits 0-1: listType (0=일반)
     *   - Bits 2-3: vertAlign (0=TOP, 1=CENTER, 2=BOTTOM)
     *   - Bit 4: header (머리글 반복)
     *   - Bit 5: protect (보호)
     *   - Bits 7-9: textDirection (0=가로, 1-6=세로)
     * - Offset 6-7: unknown (2 bytes)
     * - Offset 8-9: colAddr (2 bytes)
     * - Offset 10-11: rowAddr (2 bytes)
     * - Offset 12-13: colSpan (2 bytes)
     * - Offset 14-15: rowSpan (2 bytes)
     * - Offset 16-19: width (4 bytes, HWPUNIT)
     * - Offset 20-23: height (4 bytes, HWPUNIT)
     * - Offset 24-25: leftMargin (2 bytes)
     * - Offset 26-27: rightMargin (2 bytes)
     * - Offset 28-29: topMargin (2 bytes)
     * - Offset 30-31: bottomMargin (2 bytes)
     * - Offset 32-33: borderFillID (2 bytes, 1-based)
     */
    private parseTableCellWithParas(listNode: RecordNode, paraNodes: RecordNode[], index: number): TableCellInfo | null {
        const data = listNode.record.data;
        if (data.length < 8) {
            return null;
        }

        const reader = new RecordDataReader(data);

        // HWP 5.0 LIST_HEADER 구조 (바이너리 분석 결과):
        // - Offset 0-1: nPara (uint16)
        // - Offset 2-3: unknown (uint16)
        // - Offset 4-5: property (uint16)
        // - Offset 6-7: textWidth (uint16)
        // - Offset 8-9: colAddr (uint16)
        // - Offset 10-11: rowAddr (uint16)
        // - Offset 12-13: colSpan (uint16)
        // - Offset 14-15: rowSpan (uint16)
        // - Offset 16-19: width (uint32)
        // - Offset 20-23: height (uint32)
        // - Offset 24-31: margins (uint16 x 4)
        // - Offset 32-33: borderFillID (uint16)

        reader.readUint16(); // nPara (문단은 paraNodes에서 처리)
        reader.readUint16(); // unknown field

        // property (16 bits) 구조:
        // - Bits 0-1: listType
        // - Bits 2-4: unknown
        // - Bits 5-6: textVerticalAlignment (0=TOP, 1=CENTER, 2=BOTTOM)
        // - Bit 7: header
        // - Bit 8: protect
        // - Bits 9-11: textDirection
        const property = reader.readUint16();

        const vertAlignValue = (property >> 5) & 0x03;
        const header = ((property >> 7) & 0x01) === 1;
        const protect = ((property >> 8) & 0x01) === 1;
        const textDirValue = (property >> 9) & 0x07;

        // 세로 정렬 변환 (HWPX 형식)
        const vertAlignMap = ['TOP', 'CENTER', 'BOTTOM'];
        const vertAlign = vertAlignMap[vertAlignValue] || 'CENTER';

        // 텍스트 방향 변환 (HWPX 형식)
        const textDirectionMap = ['HORIZONTAL', 'VERTICAL', 'VERTICAL', 'VERTICAL', 'VERTICAL', 'VERTICAL', 'VERTICAL'];
        const textDirection = textDirectionMap[textDirValue] || 'HORIZONTAL';

        // textWidth 필드 (offset 6-7)
        if (reader.remaining >= 2) {
            reader.readUint16(); // textWidth (현재 미사용)
        }

        // 셀 정보 (offset 8-15: colAddr, rowAddr, colSpan, rowSpan)
        const colIndex = reader.remaining >= 2 ? reader.readUint16() : 0;
        const rowIndex = reader.remaining >= 2 ? reader.readUint16() : 0;
        const colSpan = reader.remaining >= 2 ? reader.readUint16() : 1;
        const rowSpan = reader.remaining >= 2 ? reader.readUint16() : 1;

        // 셀 크기
        const width = reader.remaining >= 4 ? reader.readUint32() : 0;
        const height = reader.remaining >= 4 ? reader.readUint32() : 0;

        // 셀 여백 (레퍼런스 HWPX에서는 일반적으로 283 또는 565 사용)
        const marginLeft = reader.remaining >= 2 ? reader.readUint16() : 283;
        const marginRight = reader.remaining >= 2 ? reader.readUint16() : 283;
        const marginTop = reader.remaining >= 2 ? reader.readUint16() : 283;
        const marginBottom = reader.remaining >= 2 ? reader.readUint16() : 283;

        // BorderFillID (1-based, HWPX에서도 1-based 그대로 사용)
        const borderFillID = reader.remaining >= 2 ? reader.readUint16() : 1;

        // 셀 내 문단 파싱 (전달받은 paraNodes 사용)
        const paragraphs: EnhancedParagraph[] = [];
        let paraIdx = 0;

        for (const paraNode of paraNodes) {
            // 기본 문단 파싱
            const para = ParagraphParser.parseParagraph(paraNode, paraIdx);

            // GSO 컨트롤 처리 (텍스트 박스에서 텍스트 추출)
            const enhancedPara = this.enhanceParagraphWithGso(para, paraNode);
            paragraphs.push(enhancedPara);
            paraIdx++;
        }

        return {
            index,
            rowIndex,
            colIndex,
            // writer가 기대하는 속성명 추가
            rowAddr: rowIndex,
            colAddr: colIndex,
            rowSpan: rowSpan || 1,
            colSpan: colSpan || 1,
            width,
            height,
            paragraphs,
            borderFillIDRef: borderFillID || 1,
            // 추가된 셀 속성들
            header,
            protect,
            vertAlign,
            textDirection,
            marginLeft,
            marginRight,
            marginTop,
            marginBottom,
            hasMargin: marginLeft > 0 || marginRight > 0 || marginTop > 0 || marginBottom > 0
        };
    }

    /**
     * PAGE_DEF 레코드 파싱
     */
    private parsePageDef(node: RecordNode): PageDef {
        const data = node.record.data;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        // PAGE_DEF 구조 (단위: HWPUNIT = 1/7200 인치)
        // Offset 0-3: 용지 너비
        // Offset 4-7: 용지 높이
        // Offset 8-11: 왼쪽 여백
        // Offset 12-15: 오른쪽 여백
        // Offset 16-19: 위 여백
        // Offset 20-23: 아래 여백
        // Offset 24-27: 머리말 여백
        // Offset 28-31: 꼬리말 여백
        // Offset 32-35: 제본 여백
        // Offset 36-39: 속성

        const width = view.getUint32(0, true);
        const height = view.getUint32(4, true);
        const leftMargin = view.getUint32(8, true);
        const rightMargin = view.getUint32(12, true);
        const topMargin = view.getUint32(16, true);
        const bottomMargin = view.getUint32(20, true);
        const headerMargin = view.getUint32(24, true);
        const footerMargin = view.getUint32(28, true);
        const gutterMargin = view.getUint32(32, true);
        const property = data.length >= 40 ? view.getUint32(36, true) : 0;

        // 가로 방향 여부 (bit 0)
        const landscape = (property & 0x01) !== 0;

        return {
            width,
            height,
            leftMargin,
            rightMargin,
            topMargin,
            bottomMargin,
            headerMargin,
            footerMargin,
            gutterMargin,
            property,
            landscape
        };
    }

    /**
     * PAGE_BORDER_FILL 레코드 파싱
     *
     * HWP PAGE_BORDER_FILL 구조 (TagID 75):
     * - Offset 0-3: property (4 bytes, 비트필드)
     *   - Bits 0-1: applyPosition (0=BOTH_PAGES, 1=EVEN_PAGE, 2=ODD_PAGE)
     *   - Bit 2: includeBorderOffset
     *   - Bit 3: includeHeader
     *   - Bit 4: includeFooter
     * - Offset 4-5: borderFillId (2 bytes, 1-based)
     * - Offset 6-9: offsetLeft (4 bytes, HWPUNIT)
     * - Offset 10-13: offsetRight (4 bytes, HWPUNIT)
     * - Offset 14-17: offsetTop (4 bytes, HWPUNIT)
     * - Offset 18-21: offsetBottom (4 bytes, HWPUNIT)
     */
    private parsePageBorderFill(node: RecordNode): PageBorderFill {
        const data = node.record.data;
        const reader = new RecordDataReader(data);

        // property 비트필드
        const property = reader.safeReadUint32(0);
        const posValue = property & 0x03;
        const includeBorderOffset = ((property >> 2) & 0x01) === 1;
        const includeHeader = ((property >> 3) & 0x01) === 1;
        const includeFooter = ((property >> 4) & 0x01) === 1;

        // applyPosition 변환
        const positionMap: Array<'BOTH_PAGES' | 'EVEN_PAGE' | 'ODD_PAGE'> = [
            'BOTH_PAGES', 'EVEN_PAGE', 'ODD_PAGE'
        ];
        const applyPosition = positionMap[posValue] || 'BOTH_PAGES';

        // BorderFill ID (1-based)
        const borderFillIDRef = reader.safeReadUint16(1);

        // 오프셋 값 (HWPUNIT)
        const offsetLeft = reader.safeReadUint32(0);
        const offsetRight = reader.safeReadUint32(0);
        const offsetTop = reader.safeReadUint32(0);
        const offsetBottom = reader.safeReadUint32(0);

        return {
            applyPosition,
            includeBorderOffset,
            includeHeader,
            includeFooter,
            borderFillIDRef,
            offsetLeft,
            offsetRight,
            offsetTop,
            offsetBottom
        };
    }

    /**
     * 최상위 레벨 컨트롤 파싱 (헤더/푸터 등)
     */
    private parseTopLevelControl(node: RecordNode, headerFooters: HeaderFooter[]): void {
        const data = node.record.data;
        if (data.length < 4) return;

        // 컨트롤 타입 읽기
        const ctrlId = String.fromCharCode(
            data[0], data[1], data[2], data[3]
        );

        switch (ctrlId) {
            case 'head':
            case 'foot': {
                // 머리글/바닥글
                const hf = this.parseHeaderFooter(node, ctrlId === 'head' ? 'HEADER' : 'FOOTER');
                if (hf) headerFooters.push(hf);
                break;
            }
        }
    }

    /**
     * 머리글/바닥글 파싱
     */
    private parseHeaderFooter(node: RecordNode, type: 'HEADER' | 'FOOTER'): HeaderFooter | null {
        const paragraphs: EnhancedParagraph[] = [];
        let paraIndex = 0;

        // 하위 레코드에서 문단 찾기
        for (const child of node.children) {
            if (child.record.tagId === HWP_TAG_ID.PARA_HEADER) {
                const para = ParagraphParser.parseParagraph(child, paraIndex);
                paragraphs.push(para);
                paraIndex++;
            }
        }

        if (paragraphs.length === 0) return null;

        return {
            type,
            applyPage: 0, // 모든 페이지
            paragraphs
        };
    }

    /**
     * OLE 객체 컨트롤 파싱
     *
     * HWP OLE 레코드 구조:
     * CTRL_HEADER (ctrlId='ole ')
     * ├── CTRL_DATA
     * ├── SHAPE_COMPONENT
     * │   └── SHAPE_COMPONENT_OLE (TagID 84)
     * └── 내부 문단들 (미리보기용)
     */
    private parseOLEControl(ctrlNode: RecordNode): OLEInfo | null {
        // SHAPE_COMPONENT_OLE 레코드 찾기
        const result: { oleRecord: RecordNode | null; shapeComponent: RecordNode | null } = {
            oleRecord: null,
            shapeComponent: null
        };

        const findOleRecords = (node: RecordNode): void => {
            if (node.record.tagId === HWP_TAG_ID.SHAPE_COMPONENT) {
                result.shapeComponent = node;
            }
            if (node.record.tagId === HWP_TAG_ID.SHAPE_COMPONENT_OLE) {
                result.oleRecord = node;
            }
            for (const child of node.children) {
                findOleRecords(child);
            }
        };

        findOleRecords(ctrlNode);

        const oleRecord = result.oleRecord;
        const shapeComponent = result.shapeComponent;

        // CTRL_HEADER에서 기본 정보 추출
        const ctrlData = ctrlNode.record.data;
        if (ctrlData.length < 32) {
            return null;
        }

        const ctrlReader = new RecordDataReader(ctrlData);
        ctrlReader.skip(4); // ctrlId

        // objAttr (ctrlProperty)
        const objAttr = ctrlReader.readUint32();
        const treatAsChar = objAttr & 1;
        const textWrap = (objAttr >> 1) & 0x7;
        const vertRelTo = (objAttr >> 6) & 0x3;
        const horzRelTo = (objAttr >> 8) & 0x7;
        const vertAlign = (objAttr >> 11) & 0x7;
        const horzAlign = (objAttr >> 14) & 0x7;

        const vertOffset = ctrlReader.readInt32();
        const horzOffset = ctrlReader.readInt32();
        const width = ctrlReader.readUint32();
        const height = ctrlReader.readUint32();
        const zOrder = ctrlReader.readInt32();

        // OLE 특수 속성 파싱
        let binDataIDRef = 0;
        let objDataBIDRef = 0;
        let drawAspect: 'CONTENT' | 'ICON' = 'CONTENT';
        let hasMoniker = false;

        if (oleRecord && oleRecord.record.data.length >= 8) {
            const oleData = oleRecord.record.data;
            const oleReader = new RecordDataReader(oleData);

            // SHAPE_COMPONENT_OLE 구조
            // Offset 0-3: dwExt (확장 플래그)
            const dwExt = oleReader.readUint32();

            // Offset 4-5: binDataIDRef (미리보기 이미지)
            binDataIDRef = oleReader.readUint16();

            // Offset 6-7: borderColor 등
            oleReader.skip(2);

            // objDataBIDRef 추출 (OLE 데이터 참조)
            if (oleReader.remaining >= 2) {
                objDataBIDRef = oleReader.readUint16();
            }

            // drawAspect 파싱 (dwExt에서)
            drawAspect = (dwExt & 0x01) ? 'ICON' : 'CONTENT';
            hasMoniker = (dwExt & 0x02) !== 0;
        }

        // 프로그램 ID 추출 시도 (추가 데이터가 있으면)
        let programId = '';
        if (shapeComponent && shapeComponent.record.data.length > 100) {
            // 일부 HWP 파일에서는 프로그램 ID가 문자열로 저장됨
            // 여기서는 기본값 사용
            programId = 'OLE:EMBED';
        }

        return {
            type: 'EMBED' as const,
            binDataIDRef,
            objDataBIDRef,
            width: width || 20000,
            height: height || 15000,
            x: horzOffset,
            y: vertOffset,
            zOrder,
            drawAspect,
            programId,
            hasMoniker,
            treatAsChar: treatAsChar === 1,
            textWrap,
            vertRelTo,
            horzRelTo,
            vertAlign,
            horzAlign,
            vertOffset,
            horzOffset
        };
    }

    /**
     * 양식 컨트롤인지 확인
     * HWP에서 양식 컨트롤은 특정 ctrlId 패턴을 가짐
     */
    private isFormControl(ctrlId: string): boolean {
        // HWP 양식 컨트롤 ID 패턴
        const formControlIds = [
            '%dte',  // 날짜 필드
            '%unk',  // 미정의 필드
            'fld%',  // 필드
            '%chk',  // 체크박스 (추정)
            '%rad',  // 라디오버튼 (추정)
            '%cmb',  // 콤보박스 (추정)
            '%edt',  // 입력 필드 (추정)
            '%btn',  // 버튼 (추정)
        ];

        // ctrlId가 % 문자를 포함하면 필드 컨트롤
        if (ctrlId.includes('%')) {
            return true;
        }

        // 정확한 매칭
        return formControlIds.some(id =>
            ctrlId === id || ctrlId.startsWith(id.slice(0, 3))
        );
    }

    /**
     * 양식 컨트롤 파싱
     *
     * 양식 컨트롤 유형:
     * - 체크박스: 선택/미선택 상태
     * - 라디오버튼: 그룹 내 선택 상태
     * - 콤보박스: 드롭다운 목록
     * - 입력필드: 텍스트 입력
     */
    private parseFormControl(ctrlNode: RecordNode, ctrlId: string): FormInfo | null {
        const ctrlData = ctrlNode.record.data;
        if (ctrlData.length < 8) {
            return null;
        }

        const ctrlReader = new RecordDataReader(ctrlData);
        ctrlReader.skip(4); // ctrlId

        // CTRL_DATA 레코드 찾기
        let ctrlDataRecord: RecordNode | null = null;
        for (const child of ctrlNode.children) {
            if (child.record.tagId === HWP_TAG_ID.CTRL_DATA) {
                ctrlDataRecord = child;
                break;
            }
        }

        // 기본 크기 정보
        const width = 10000;
        const height = 5000;

        // 양식 타입 결정
        let formType: 'CHECKBOX' | 'RADIO' | 'COMBOBOX' | 'EDIT' | 'LISTBOX' | 'BUTTON' = 'EDIT';
        const value = '';
        let checked = false;
        const items: string[] = [];
        let name = '';

        // ctrlId 패턴으로 타입 결정
        if (ctrlId.includes('chk')) {
            formType = 'CHECKBOX';
        } else if (ctrlId.includes('rad')) {
            formType = 'RADIO';
        } else if (ctrlId.includes('cmb')) {
            formType = 'COMBOBOX';
        } else if (ctrlId.includes('edt')) {
            formType = 'EDIT';
        } else if (ctrlId.includes('btn')) {
            formType = 'BUTTON';
        } else if (ctrlId.includes('dte')) {
            formType = 'EDIT'; // 날짜는 입력 필드로 처리
        }

        // CTRL_DATA에서 상세 정보 추출
        if (ctrlDataRecord && ctrlDataRecord.record.data.length >= 4) {
            const dataReader = new RecordDataReader(ctrlDataRecord.record.data);

            // 양식 데이터 구조 (HWP 형식에 따라 다름)
            // 첫 2바이트: 플래그
            const flags = dataReader.readUint16();
            checked = (flags & 0x01) !== 0;

            // 이름/값 추출 시도
            if (dataReader.remaining >= 2) {
                const nameLen = dataReader.readUint16();
                if (nameLen > 0 && nameLen < 256 && dataReader.remaining >= nameLen * 2) {
                    name = '';
                    for (let i = 0; i < nameLen; i++) {
                        const ch = dataReader.readUint16();
                        if (ch > 0 && ch < 0xFFFF) {
                            name += String.fromCharCode(ch);
                        }
                    }
                }
            }
        }

        return {
            formType,
            name: name || `Form_${ctrlId.trim()}`,
            width,
            height,
            value,
            checked,
            items,
            enabled: true,
            readonly: false
        };
    }

    /**
     * 컨테이너 도형 (그룹 도형) 파싱
     * SHAPE_COMPONENT_CONTAINER (TagID 86)
     * 여러 개의 자식 도형을 포함하는 그룹 도형
     */
    private parseContainerShape(
        shapeRecord: RecordNode,
        baseProps: ShapeBaseProps | null,
        _ctrlNode: RecordNode
    ): ShapeInfo {
        // 자식 도형들 수집
        const childShapes: HWPControl[] = [];

        // 재귀적으로 자식 도형 찾기
        const findChildShapes = (node: RecordNode, level: number): void => {
            // 각 자식 GSO 컨트롤 파싱
            for (const child of node.children) {
                // SHAPE_COMPONENT 레코드가 있으면 도형으로 처리
                if (child.record.tagId === HWP_TAG_ID.SHAPE_COMPONENT) {
                    // 이 SHAPE_COMPONENT 아래에서 실제 도형 찾기
                    const childShape = this.parseShapeFromComponent(child);
                    if (childShape) {
                        childShapes.push(childShape);
                    }
                }
                // 더 깊은 레벨 탐색
                findChildShapes(child, level + 1);
            }
        };

        findChildShapes(shapeRecord, 0);

        // 컨테이너 도형 정보 구성 (ShapeInfo 타입 반환)
        return {
            type: 'CONTAINER',
            x: baseProps?.x || 0,
            y: baseProps?.y || 0,
            width: baseProps?.width || 10000,
            height: baseProps?.height || 10000,
            rotation: baseProps?.rotation || 0,
            zOrder: 0,
            children: childShapes,
            groupLevel: 0,
            lineColor: 0,
            lineWidth: 0,
            lineStyle: 0
        };
    }

    /**
     * SHAPE_COMPONENT에서 도형 파싱 (컨테이너 자식용)
     * ShapeInfo를 HWPControl로 래핑하여 반환
     */
    private parseShapeFromComponent(componentNode: RecordNode): HWPControl | null {
        const baseProps = this.parseShapeComponent(componentNode);

        // 자식에서 실제 도형 타입 찾기
        for (const child of componentNode.children) {
            let shapeInfo: ShapeInfo | null = null;

            switch (child.record.tagId) {
                case HWP_TAG_ID.SHAPE_COMPONENT_POLYGON:
                    shapeInfo = this.parsePolygonShape(child, baseProps);
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_RECT:
                    shapeInfo = this.parseRectangleShape(child, baseProps);
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_ELLIPSE:
                case HWP_TAG_ID.SHAPE_COMPONENT_ARC:
                    shapeInfo = this.parseEllipseShape(child, baseProps);
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_LINE:
                    shapeInfo = this.parseLineShape(child, baseProps);
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_CURVE:
                    shapeInfo = this.parseCurveShape(child, baseProps);
                    break;
                case HWP_TAG_ID.SHAPE_COMPONENT_PICTURE:
                    // 이미지는 별도 처리
                    return null;
            }

            if (shapeInfo) {
                return {
                    type: 'SHAPE',
                    obj: shapeInfo
                };
            }
        }
        return null;
    }

    /**
     * 메모 컨트롤 파싱
     * MEMO_SHAPE (TagID 89), MEMO_LIST (TagID 90)
     */
    private parseMemoControl(ctrlNode: RecordNode): HWPControl | null {
        // MEMO_LIST 레코드 찾기 (객체 패턴으로 타입 추론 문제 해결)
        const result: { memoListRecord: RecordNode | null } = { memoListRecord: null };
        const memoParagraphs: EnhancedParagraph[] = [];

        const findMemoRecords = (node: RecordNode): void => {
            if (node.record.tagId === HWP_TAG_ID.MEMO_LIST) {
                result.memoListRecord = node;
            } else if (node.record.tagId === HWP_TAG_ID.PARA_HEADER) {
                const para = ParagraphParser.parseParagraph(node, memoParagraphs.length);
                memoParagraphs.push(para);
            }
            for (const child of node.children) {
                findMemoRecords(child);
            }
        };

        findMemoRecords(ctrlNode);

        // MEMO_LIST에서 메모 정보 추출
        let memoId = 0;
        let author = '';
        const date = '';

        if (result.memoListRecord && result.memoListRecord.record.data.length >= 4) {
            const reader = new RecordDataReader(result.memoListRecord.record.data);
            memoId = reader.safeReadUint32(0);

            // 작성자 이름
            if (reader.canRead(2)) {
                author = reader.safeReadString(100);
            }
        }

        return {
            type: 'MEMO',
            obj: {
                id: memoId,
                author,
                date,
                paragraphs: memoParagraphs,
                text: memoParagraphs.map(p => p.text || '').join('\n')
            }
        };
    }

    /**
     * 차트 데이터 상세 파싱 (CHART_DATA TagID 95)
     * OLE 컨트롤 내의 차트 데이터를 파싱
     */
    private parseChartData(ctrlNode: RecordNode): ChartInfo | null {
        // CHART_DATA 레코드 찾기 (객체 패턴으로 타입 추론 문제 해결)
        const result: {
            chartDataRecord: RecordNode | null;
            shapeComponentRecord: RecordNode | null;
        } = {
            chartDataRecord: null,
            shapeComponentRecord: null
        };

        const findChartRecords = (node: RecordNode): void => {
            if (node.record.tagId === HWP_TAG_ID.CHART_DATA) {
                result.chartDataRecord = node;
            }
            if (node.record.tagId === HWP_TAG_ID.SHAPE_COMPONENT) {
                result.shapeComponentRecord = node;
            }
            for (const child of node.children) {
                findChartRecords(child);
            }
        };

        findChartRecords(ctrlNode);

        // 기본 크기
        let width = 20000;
        let height = 15000;

        // SHAPE_COMPONENT에서 크기 추출
        if (result.shapeComponentRecord && result.shapeComponentRecord.record.data.length >= 16) {
            const reader = new RecordDataReader(result.shapeComponentRecord.record.data);
            reader.skip(8);
            width = Math.abs(reader.safeReadInt32(20000)) || 20000;
            height = Math.abs(reader.safeReadInt32(15000)) || 15000;
        }

        // CHART_DATA 레코드에서 차트 데이터 추출
        const chartData: {
            categories: string[];
            series: Array<{ name: string; values: number[] }>;
        } = {
            categories: [],
            series: []
        };

        let chartType = 0; // COLUMN by default

        if (result.chartDataRecord && result.chartDataRecord.record.data.length >= 4) {
            const reader = new RecordDataReader(result.chartDataRecord.record.data);

            // 차트 데이터 구조 파싱
            // 주의: 실제 HWP 차트 데이터 구조는 복잡하고 버전에 따라 다름
            // 여기서는 기본적인 구조만 파싱

            // 차트 타입 (첫 바이트 또는 특정 오프셋)
            if (reader.canRead(4)) {
                chartType = reader.safeReadUint8(0);
            }

            // 데이터 개수
            if (reader.canRead(4)) {
                const categoryCount = reader.safeReadUint16(0);
                const seriesCount = reader.safeReadUint16(0);

                // 카테고리 이름 읽기
                for (let i = 0; i < Math.min(categoryCount, 100); i++) {
                    if (!reader.canRead(2)) break;
                    const catName = reader.safeReadString(100);
                    if (catName) {
                        chartData.categories.push(catName);
                    }
                }

                // 시리즈 데이터 읽기
                for (let s = 0; s < Math.min(seriesCount, 50); s++) {
                    if (!reader.canRead(2)) break;
                    const seriesName = reader.safeReadString(100);
                    const values: number[] = [];

                    // 각 카테고리에 대한 값
                    for (let i = 0; i < chartData.categories.length; i++) {
                        if (!reader.canRead(8)) break;
                        const value = reader.safeReadInt32(0);
                        values.push(value);
                    }

                    chartData.series.push({ name: seriesName, values });
                }
            }
        }

        return {
            width,
            height,
            type: chartType,
            x: 0,
            y: 0,
            data: chartData
        };
    }

    /**
     * 디버그: 레코드 구조 출력
     */
    debugStructure(): string {
        const recordParser = new RecordParser(this.data);
        const records = recordParser.parseAll();

        const lines: string[] = [
            `=== Section ${this.sectionIndex} Structure ===`,
            `Total records: ${records.length}`,
            ''
        ];

        for (const record of records) {
            const indent = '  '.repeat(record.level);
            const tagName = RecordParser.getTagName(record.tagId);
            lines.push(`${indent}[${tagName}] Size=${record.size}`);
        }

        return lines.join('\n');
    }
}

/**
 * 여러 섹션 스트림을 파싱하는 유틸리티
 */
export class SectionStreamParser {
    /**
     * OLE 디렉토리에서 모든 BodyText/Section 스트림 파싱
     * @param sections Map of section index to decompressed data
     */
    static parseAll(sections: Map<number, Uint8Array>): EnhancedSection[] {
        const result: EnhancedSection[] = [];

        // 인덱스 순서대로 정렬
        const sortedIndices = [...sections.keys()].sort((a, b) => a - b);

        for (const index of sortedIndices) {
            const data = sections.get(index);
            if (!data) continue;

            try {
                const parser = new BodyTextParser(data, index);
                const section = parser.parse();
                result.push(section);
            } catch (e) {
                console.error(`[SectionStreamParser] Failed to parse section ${index}:`, e);
            }
        }

        return result;
    }
}
