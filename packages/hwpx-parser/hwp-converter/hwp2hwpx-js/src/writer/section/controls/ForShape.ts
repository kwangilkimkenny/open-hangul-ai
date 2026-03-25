/**
 * HWPML-compliant Shape (Drawing Object) XML Generation
 * Supports: LINE, RECTANGLE, ELLIPSE, POLYGON, CURVE
 */

import {
    Shape, ShapeLine, ShapeRectangle, ShapeEllipse, ShapePolygon, ShapeCurve, ShapeConnector, ShapeTextArt,
    LineStyle, FillType, ArrowType, ConnectorType, TextArtShapeType, TextArtAlign
} from 'hwplib-js';
import { generateInstanceId } from '../../../util/IdGenerator';
import { Logger } from '../../../util/Logger';
import { DEFAULTS } from '../../../constants/DefaultValues';

/**
 * Convert Shape control to OWPML XML
 */
export function shapeToXml(shape: Shape): string {
    const instId = generateInstanceId();

    // Common shape wrapper
    const commonAttrs = getCommonShapeAttrs(shape, instId);
    const posXml = getPositionXml(shape);
    const sizeXml = getSizeXml(shape);
    const lineXml = getLineStyleXml(shape);
    const fillXml = getFillXml(shape);

    switch (shape.type) {
        case 'LINE':
            return lineToXml(shape as ShapeLine, commonAttrs, posXml, sizeXml, lineXml);
        case 'RECTANGLE':
            return rectangleToXml(shape as ShapeRectangle, commonAttrs, posXml, sizeXml, lineXml, fillXml);
        case 'ELLIPSE':
            return ellipseToXml(shape as ShapeEllipse, commonAttrs, posXml, sizeXml, lineXml, fillXml);
        case 'POLYGON':
            return polygonToXml(shape as ShapePolygon, commonAttrs, posXml, sizeXml, lineXml, fillXml);
        case 'CURVE':
            return curveToXml(shape as ShapeCurve, commonAttrs, posXml, sizeXml, lineXml, fillXml);
        case 'CONNECTOR':
            return connectorToXml(shape as ShapeConnector, commonAttrs, posXml, sizeXml, lineXml);
        case 'TEXTART':
            return textArtToXml(shape as ShapeTextArt, commonAttrs, posXml, sizeXml, lineXml, fillXml);
        default:
            Logger.warn(`Unsupported shape type: ${(shape as { type: string }).type}`);
            return '';
    }
}

// === Individual Shape XML Generators ===

function lineToXml(
    shape: ShapeLine,
    commonAttrs: string,
    posXml: string,
    sizeXml: string,
    lineXml: string
): string {
    const startX = shape.startX || 0;
    const startY = shape.startY || 0;
    const endX = shape.endX || shape.width;
    const endY = shape.endY || shape.height;

    const headStyle = getArrowStyleName(shape.arrowStart);
    const tailStyle = getArrowStyleName(shape.arrowEnd);

    return `<hp:line ${commonAttrs}>
  ${sizeXml}
  ${posXml}
  <hp:outMargin left="0" right="0" top="0" bottom="0"/>
  <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${shape.x}" y="${shape.y}" alpha="100" angle="${shape.rotation || 0}"/>
  ${lineXml}
  <hc:startPt x="${startX}" y="${startY}"/>
  <hc:endPt x="${endX}" y="${endY}"/>
  <hp:lineHeadTail headStyle="${headStyle}" tailStyle="${tailStyle}" headSz="MEDIUM" tailSz="MEDIUM" headFill="0" tailFill="0"/>
</hp:line>`;
}

function rectangleToXml(
    shape: ShapeRectangle,
    commonAttrs: string,
    posXml: string,
    sizeXml: string,
    lineXml: string,
    fillXml: string
): string {
    const ratio = shape.cornerRadius || 0;

    return `<hp:rect ${commonAttrs}>
  ${sizeXml}
  ${posXml}
  <hp:outMargin left="0" right="0" top="0" bottom="0"/>
  <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${shape.x}" y="${shape.y}" alpha="100" angle="${shape.rotation || 0}"/>
  ${lineXml}
  ${fillXml}
  <hp:ratio ratio="${ratio}"/>
</hp:rect>`;
}

function ellipseToXml(
    shape: ShapeEllipse,
    commonAttrs: string,
    posXml: string,
    sizeXml: string,
    lineXml: string,
    fillXml: string
): string {
    const arcType = getArcTypeName(shape.arcType);
    const centerX = Math.round(shape.width / 2);
    const centerY = Math.round(shape.height / 2);

    return `<hp:ellipse ${commonAttrs}>
  ${sizeXml}
  ${posXml}
  <hp:outMargin left="0" right="0" top="0" bottom="0"/>
  <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${shape.x}" y="${shape.y}" alpha="100" angle="${shape.rotation || 0}"/>
  ${lineXml}
  ${fillXml}
  <hp:center x="${centerX}" y="${centerY}"/>
  <hp:ax1 x="${shape.width}" y="${centerY}"/>
  <hp:ax2 x="${centerX}" y="${shape.height}"/>
  <hp:start1 x="${shape.width}" y="${centerY}"/>
  <hp:end1 x="${shape.width}" y="${centerY}"/>
  <hp:start2 x="${shape.width}" y="${centerY}"/>
  <hp:end2 x="${shape.width}" y="${centerY}"/>
  <hp:arcPr type="${arcType}"/>
</hp:ellipse>`;
}

function polygonToXml(
    shape: ShapePolygon,
    commonAttrs: string,
    posXml: string,
    sizeXml: string,
    lineXml: string,
    fillXml: string
): string {
    // Generate points XML using map().join() for better performance
    const pointsXml = (shape.points && shape.points.length > 0)
        ? shape.points.map(pt => `<hc:pt x="${pt.x}" y="${pt.y}"/>`).join('')
        : '';

    return `<hp:polygon ${commonAttrs}>
  ${sizeXml}
  ${posXml}
  <hp:outMargin left="0" right="0" top="0" bottom="0"/>
  <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${shape.x}" y="${shape.y}" alpha="100" angle="${shape.rotation || 0}"/>
  ${lineXml}
  ${fillXml}
  <hp:pts>${pointsXml}</hp:pts>
</hp:polygon>`;
}

function curveToXml(
    shape: ShapeCurve,
    commonAttrs: string,
    posXml: string,
    sizeXml: string,
    lineXml: string,
    fillXml: string
): string {
    // Generate control points XML using map().join() for better performance
    const segXml = (shape.controlPoints && shape.controlPoints.length > 0)
        ? shape.controlPoints.map((pt, idx) => {
            const type = idx === 0 ? 'LINE' : 'CURVE';
            return `<hp:seg type="${type}" x1="${pt.x}" y1="${pt.y}" x2="${pt.x}" y2="${pt.y}"/>`;
        }).join('')
        : '';

    return `<hp:arc ${commonAttrs}>
  ${sizeXml}
  ${posXml}
  <hp:outMargin left="0" right="0" top="0" bottom="0"/>
  <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${shape.x}" y="${shape.y}" alpha="100" angle="${shape.rotation || 0}"/>
  ${lineXml}
  ${fillXml}
  <hp:segs>${segXml}</hp:segs>
</hp:arc>`;
}

function connectorToXml(
    shape: ShapeConnector,
    commonAttrs: string,
    posXml: string,
    sizeXml: string,
    lineXml: string
): string {
    const startX = shape.startX || 0;
    const startY = shape.startY || 0;
    const endX = shape.endX || shape.width;
    const endY = shape.endY || shape.height;

    const connectorType = getConnectorTypeName(shape.connectorType);

    // Generate control points for elbow/curved connectors
    let controlPointsXml = '';
    if (shape.controlPoints && shape.controlPoints.length > 0) {
        controlPointsXml = shape.controlPoints.map(pt =>
            `<hp:pt x="${pt.x}" y="${pt.y}"/>`
        ).join('\n    ');
    }

    return `<hp:connectLine ${commonAttrs}>
  ${sizeXml}
  ${posXml}
  <hp:outMargin left="0" right="0" top="0" bottom="0"/>
  <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${shape.x}" y="${shape.y}" alpha="100" angle="${shape.rotation || 0}"/>
  ${lineXml}
  <hc:startPt x="${startX}" y="${startY}"/>
  <hc:endPt x="${endX}" y="${endY}"/>
  <hp:connectLineType type="${connectorType}">${controlPointsXml ? '\n    ' + controlPointsXml + '\n  ' : ''}</hp:connectLineType>
</hp:connectLine>`;
}

function textArtToXml(
    shape: ShapeTextArt,
    commonAttrs: string,
    posXml: string,
    sizeXml: string,
    lineXml: string,
    fillXml: string
): string {
    const text = escapeXml(shape.text || '');
    const textColor = colorToHex(shape.textColor);
    const outlineColor = colorToHex(shape.outlineColor);
    const outlineWidth = shape.outlineWidth || 0;
    const shadowColor = colorToHex(shape.shadowColor);
    const shadowOffsetX = shape.shadowOffsetX || 0;
    const shadowOffsetY = shape.shadowOffsetY || 0;

    const fontStyle = shape.fontStyle || {};
    const bold = fontStyle.bold ? '1' : '0';
    const italic = fontStyle.italic ? '1' : '0';
    const underline = fontStyle.underline ? '1' : '0';
    const strikeout = fontStyle.strikeout ? '1' : '0';

    const textArtShapeType = getTextArtShapeTypeName(shape.textArtShape);
    const align = getTextArtAlignName(shape.align);

    // Build shadow XML if shadow exists
    let shadowXml = '';
    if (shape.shadowColor !== undefined && shape.shadowColor !== 0) {
        shadowXml = `<hp:shadow type="DROP" color="${shadowColor}" offsetX="${shadowOffsetX}" offsetY="${shadowOffsetY}" alpha="0"/>`;
    }

    return `<hp:textart ${commonAttrs}>
  ${sizeXml}
  ${posXml}
  <hp:outMargin left="0" right="0" top="0" bottom="0"/>
  <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${shape.x}" y="${shape.y}" alpha="100" angle="${shape.rotation || 0}"/>
  ${lineXml}
  ${fillXml}
  <hp:textartPr fontName="" fontStyle="${bold}${italic}${underline}${strikeout}" fontType="TTF" textShape="${textArtShapeType}" lineSpacing="160" charSpacing="0" align="${align}" textColor="${textColor}">
    <hp:textartOutline style="SOLID" width="${outlineWidth}" color="${outlineColor}"/>
    ${shadowXml}
  </hp:textartPr>
  <hp:pt x="0" y="0"/>
  <hp:pt x="${shape.width}" y="0"/>
  <hp:pt x="${shape.width}" y="${shape.height}"/>
  <hp:pt x="0" y="${shape.height}"/>
  <hp:t>${text}</hp:t>
</hp:textart>`;
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// === Helper Functions ===

function getCommonShapeAttrs(shape: Shape, instId: number): string {
    const lock = '0';
    const numberingType = 'NONE';
    // textWrap 기본값: TOP_AND_BOTTOM (도형 전용)
    // Shape 타입에 textWrap 속성이 없으므로 any 캐스팅 사용
    const extShape = shape as Shape & { textWrap?: string };
    const textWrap = extShape.textWrap || 'TOP_AND_BOTTOM';
    const textFlow = 'BOTH_SIDES';
    const zOrder = shape.zOrder ?? DEFAULTS.picture.zOrder;

    return `id="${instId}" zOrder="${zOrder}" numberingType="${numberingType}" textWrap="${textWrap}" textFlow="${textFlow}" lock="${lock}" dropcapstyle="None" instid="${instId}"`;
}

/**
 * 도형 위치 확장 인터페이스
 * hwplib-js Shape 타입에 없는 위치 관련 속성들
 */
interface ShapePositionExt {
    treatAsChar?: boolean;
    vertRelTo?: string;
    horzRelTo?: string;
    vertAlign?: string;
    horzAlign?: string;
    vertOffset?: number;
    horzOffset?: number;
}

function getPositionXml(shape?: Shape): string {
    // 확장 속성 접근을 위한 타입 캐스팅
    const extShape = shape as (Shape & ShapePositionExt) | undefined;

    // 인라인 도형 기본값 사용 (treatAsChar=true)
    const treatAsChar = extShape?.treatAsChar ?? DEFAULTS.inlineShape.treatAsChar ? '1' : '0';
    const vertRelTo = extShape?.vertRelTo || DEFAULTS.inlineShape.vertRelTo;
    const horzRelTo = extShape?.horzRelTo || DEFAULTS.inlineShape.horzRelTo;
    const vertAlign = extShape?.vertAlign || DEFAULTS.shape.vertAlign;
    const horzAlign = extShape?.horzAlign || DEFAULTS.shape.horzAlign;
    const vertOffset = extShape?.vertOffset ?? DEFAULTS.shape.vertOffset;
    const horzOffset = extShape?.horzOffset ?? DEFAULTS.shape.horzOffset;

    return `<hp:pos treatAsChar="${treatAsChar}" affectLSpacing="0" flowWithText="0" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="${vertRelTo}" horzRelTo="${horzRelTo}" vertAlign="${vertAlign}" horzAlign="${horzAlign}" vertOffset="${vertOffset}" horzOffset="${horzOffset}"/>`;
}

function getSizeXml(shape: Shape): string {
    return `<hp:sz width="${shape.width}" widthRelTo="ABSOLUTE" height="${shape.height}" heightRelTo="ABSOLUTE" protect="0"/>`;
}

function getLineStyleXml(shape: Shape): string {
    const color = colorToHex(shape.lineColor, DEFAULTS.shape.lineColor);
    // lineWidth가 있으면 mm 변환, 없으면 기본값 사용
    const lineWidth = shape.lineWidth ?? DEFAULTS.shape.lineWidth;
    const width = `${(lineWidth / 100).toFixed(2)} mm`;
    const style = getLineStyleNameLocal(shape.lineStyle);

    return `<hc:lineShape color="${color}" width="${width}" style="${style}" endCap="FLAT" headStyle="NONE" tailStyle="NONE" headSz="SMALL_SMALL" tailSz="SMALL_SMALL" headFill="0" tailFill="0" alpha="0"/>`;
}

function getFillXml(shape: Shape): string {
    if (shape.fillType === undefined || shape.fillType === null || shape.fillType === FillType.NONE) {
        return '';
    }

    const faceColor = colorToHex(shape.fillColor, DEFAULTS.shape.fillColor);
    const alpha = shape.fillOpacity ?? DEFAULTS.picture.alpha;

    return `<hc:fillBrush>
  <hc:winBrush faceColor="${faceColor}" hatchColor="none" alpha="${alpha}"/>
</hc:fillBrush>`;
}

function colorToHex(color: number | undefined, defaultColor: number = DEFAULTS.shape.lineColor): string {
    const c = color ?? defaultColor;
    const r = (c >> 16) & 0xFF;
    const g = (c >> 8) & 0xFF;
    const b = c & 0xFF;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Line style name (OWPML specification)
 * 선 스타일 이름 (OWPML 전체 스펙)
 */
function getLineStyleNameLocal(style: LineStyle | undefined): string {
    if (style === undefined || style === null) return 'SOLID';

    const names: { [key: number]: string } = {
        [LineStyle.NONE]: 'NONE',
        [LineStyle.SOLID]: 'SOLID',
        [LineStyle.DASH]: 'DASH',
        [LineStyle.DOT]: 'DOT',
        [LineStyle.DASH_DOT]: 'DASH_DOT',
        [LineStyle.DASH_DOT_DOT]: 'DASH_DOT_DOT',
        [LineStyle.LONG_DASH]: 'LONG_DASH',
    };

    // Check if style is in the enum mapping
    if (style in names) {
        return names[style];
    }

    // Handle extended numeric values not in enum
    const numStyle = style as number;
    if (numStyle === 7) return 'DOUBLE_SLIM';       // 이중 가는선
    if (numStyle === 8) return 'SLIM_THICK';        // 가는선+굵은선
    if (numStyle === 9) return 'THICK_SLIM';        // 굵은선+가는선
    if (numStyle === 10) return 'SLIM_THICK_SLIM';  // 가는선+굵은선+가는선
    if (numStyle === 11) return 'CIRCLE';           // 동그라미

    return 'SOLID';
}

function getArrowStyleName(arrow: ArrowType | undefined): string {
    if (arrow === undefined || arrow === null) return 'NONE';
    const names: { [key: number]: string } = {
        [ArrowType.NONE]: 'NONE',
        [ArrowType.NORMAL]: 'ARROW',
        [ArrowType.OPEN]: 'OPEN_ARROW',
        [ArrowType.FILLED]: 'ARROW',
        [ArrowType.DIAMOND]: 'DIAMOND',
        [ArrowType.CIRCLE]: 'CIRCLE',
        [ArrowType.SQUARE]: 'SQUARE',
    };
    return names[arrow] || 'NONE';
}

function getArcTypeName(arcType: number | undefined): string {
    if (arcType === undefined || arcType === null) return 'NORMAL';
    switch (arcType) {
        case 0: return 'NORMAL';
        case 1: return 'ARC';
        case 2: return 'PIE';
        case 3: return 'CHORD';
        default: return 'NORMAL';
    }
}

function getConnectorTypeName(connectorType: ConnectorType | undefined): string {
    if (connectorType === undefined || connectorType === null) return 'STRAIGHT';
    switch (connectorType) {
        case ConnectorType.STRAIGHT: return 'STRAIGHT';
        case ConnectorType.ELBOW_1: return 'STROKE_1';
        case ConnectorType.ELBOW_2: return 'STROKE_2';
        case ConnectorType.CURVE: return 'ARC';
        default: return 'STRAIGHT';
    }
}

function getTextArtShapeTypeName(shapeType: TextArtShapeType | undefined): string {
    if (shapeType === undefined || shapeType === null) return 'PLAIN';
    const names: { [key: number]: string } = {
        [TextArtShapeType.PLAIN]: 'PLAIN',
        [TextArtShapeType.WAVE_1]: 'WAVE_1',
        [TextArtShapeType.WAVE_2]: 'WAVE_2',
        [TextArtShapeType.ARCH_UP]: 'TOP_ARC',
        [TextArtShapeType.ARCH_DOWN]: 'BOTTOM_ARC',
        [TextArtShapeType.CIRCLE]: 'CIRCLE',
        [TextArtShapeType.BUTTON]: 'BUTTON',
        [TextArtShapeType.INFLATE]: 'INFLATE',
        [TextArtShapeType.DEFLATE]: 'DEFLATE',
        [TextArtShapeType.FADE_RIGHT]: 'FADE_RIGHT',
        [TextArtShapeType.FADE_LEFT]: 'FADE_LEFT',
        [TextArtShapeType.FADE_UP]: 'FADE_UP',
        [TextArtShapeType.FADE_DOWN]: 'FADE_DOWN',
        [TextArtShapeType.SLANT_UP]: 'SLANT_UP',
        [TextArtShapeType.SLANT_DOWN]: 'SLANT_DOWN',
        [TextArtShapeType.CHEVRON_UP]: 'CHEVRON_UP',
        [TextArtShapeType.CHEVRON_DOWN]: 'CHEVRON_DOWN',
    };
    return names[shapeType] || 'PLAIN';
}

function getTextArtAlignName(align: TextArtAlign | undefined): string {
    if (align === undefined || align === null) return 'LEFT';
    switch (align) {
        case TextArtAlign.LEFT: return 'LEFT';
        case TextArtAlign.CENTER: return 'CENTER';
        case TextArtAlign.RIGHT: return 'RIGHT';
        case TextArtAlign.JUSTIFY: return 'FULL';
        default: return 'LEFT';
    }
}
