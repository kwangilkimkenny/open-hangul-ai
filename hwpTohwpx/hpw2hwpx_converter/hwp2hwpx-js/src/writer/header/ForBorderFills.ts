import { DocInfo } from 'hwplib-js';
import { StringXmlWriter } from '../stream/StringXmlWriter';
import { getRemappedBinId } from '../../util/BinDataIdMapper';

/**
 * HWPML-compliant BORDERFILL XML Generation
 * Based on: docs/hwpml-reference/06-borderfill.md
 */

/** Border definition */
interface Border {
    type?: number;
    width?: number;
    color?: number;
}

/** Image brush definition */
interface ImageBrush {
    mode?: number;
    binItemId?: number;
    alpha?: number;
}

/** Gradation definition */
interface Gradation {
    type?: number;
    angle?: number;
    centerX?: number;
    centerY?: number;
    step?: number;
    stepCenter?: number;
    colors?: number[];
    startColor?: number;
    endColor?: number;
}

/** Fill brush definition */
interface FillBrush {
    type?: number;
    faceColor?: number;
    hatchColor?: number;
    hatchStyle?: number;
    alpha?: number;
    gradation?: Gradation;
    imgBrush?: ImageBrush;
}

/** BorderFill entry */
interface BorderFillEntry {
    id: number;
    isNoBorder?: boolean;
    threeD?: boolean;
    shadow?: boolean;
    centerLine?: number;
    breakCellSeparateLine?: number;
    slashType?: number;
    crookedSlash?: boolean;
    counterSlash?: boolean;
    backSlashType?: number;
    counterBackSlash?: boolean;
    leftBorder?: Border;
    rightBorder?: Border;
    topBorder?: Border;
    bottomBorder?: Border;
    diagonal?: Border;
    fillBrush?: FillBrush;
}

/**
 * Generates <hh:borderFills> XML from DocInfo
 * Optimized with Set for O(1) ID lookup and StringBuilder for string building
 */
export function generateBorderFillsXml(docInfo: DocInfo): string {
    const borderFillsMap = (docInfo as { borderFills?: Map<number, BorderFillEntry> }).borderFills;
    if (!borderFillsMap) {
        return getDefaultBorderFillsXml();
    }
    const borderFills: BorderFillEntry[] = [];

    // Collect border fills and build ID set in single pass
    const existingIds = new Set<number>();
    for (const bf of borderFillsMap.values()) {
        borderFills.push(bf);
        existingIds.add(bf.id);
    }

    if (borderFills.length === 0) {
        return getDefaultBorderFillsXml();
    }

    // ID 3이 없으면 추가 (테이블용 테두리 없음 스타일) - O(1) lookup
    if (!existingIds.has(3)) {
        borderFills.push({ id: 3, isNoBorder: true });
    }

    // ID 7이 없으면 추가 (테이블 셀용 기본 테두리) - O(1) lookup
    if (!existingIds.has(7)) {
        borderFills.push({ id: 7 });
    }

    // 정렬 후 개수 계산
    borderFills.sort((a, b) => a.id - b.id);

    const sb = new StringXmlWriter();
    sb.append(`<hh:borderFills itemCnt="${borderFills.length}">`);

    const count = borderFills.length;

    for (let i = 0; i < count; i++) {
        const bf = borderFills[i];

        // ID 3은 테이블용 "테두리 없음" 스타일 (레퍼런스 HWPX 기준)
        if (bf.id === 3 || bf.isNoBorder) {
            sb.append(`\n  <hh:borderFill id="${bf.id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/><hh:leftBorder type="NONE" width="0.1 mm" color="none"/><hh:rightBorder type="NONE" width="0.1 mm" color="none"/><hh:topBorder type="NONE" width="0.1 mm" color="none"/><hh:bottomBorder type="NONE" width="0.1 mm" color="none"/></hh:borderFill>`);
            continue;
        }

        // hwplib-js에서 파싱된 원본 데이터를 최대한 보존하여 변환

        // diagonal은 실제 사용할 때만 출력
        const diagonalXml = (bf.diagonal && bf.diagonal.type && bf.diagonal.type !== 0)
            ? `\n    ${borderToXml('diagonal', bf.diagonal)}` : '';

        // fillBrush는 실제 색상이 있을 때만 출력
        const fillBrushXml = fillBrushToXml(bf.fillBrush);

        sb.append(`\n  <hh:borderFill id="${bf.id}" threeD="${bf.threeD ? '1' : '0'}" shadow="${bf.shadow ? '1' : '0'}" centerLine="${getCenterLineType(bf.centerLine)}" breakCellSeparateLine="${bf.breakCellSeparateLine || 0}"><hh:slash type="${getSlashType(bf.slashType)}" Crooked="${bf.crookedSlash ? '1' : '0'}" isCounter="${bf.counterSlash ? '1' : '0'}"/><hh:backSlash type="${getSlashType(bf.backSlashType)}" Crooked="${bf.counterBackSlash ? '1' : '0'}" isCounter="${bf.counterBackSlash ? '1' : '0'}"/>${borderToXml('leftBorder', bf.leftBorder)}${borderToXml('rightBorder', bf.rightBorder)}${borderToXml('topBorder', bf.topBorder)}${borderToXml('bottomBorder', bf.bottomBorder)}${diagonalXml}${fillBrushXml}</hh:borderFill>`);
    }

    sb.append(`\n</hh:borderFills>`);
    return sb.toString();
}

function getDefaultBorderFillsXml(): string {
    return `<hh:borderFills itemCnt="1">
  <hh:borderFill id="1" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
    <hh:slash type="NONE" Crooked="0" isCounter="0"/>
    <hh:backSlash type="NONE" Crooked="0" isCounter="0"/>
    <hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/>
    <hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/>
    <hh:topBorder type="NONE" width="0.1 mm" color="#000000"/>
    <hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/>
    <hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>
    <hc:fillBrush><hc:colorRef type="COLOR" value="NONE"/></hc:fillBrush>
  </hh:borderFill>
</hh:borderFills>`;
}

// === Slash/BackSlash Types ===

function getSlashType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 0: return 'NONE';
        case 1: return 'SLASH';
        case 2: return 'BACK_SLASH';
        case 3: return 'CROOKED_SLASH';
        default: return 'NONE';
    }
}

function getCenterLineType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 0: return 'NONE';
        case 1: return 'SOLID';
        case 2: return 'DASH';
        case 3: return 'DOT';
        default: return 'NONE';
    }
}

// === Border Generation ===

function borderToXml(tagName: string, border: Border | undefined): string {
    if (!border) return `<hh:${tagName} type="NONE" width="0.1 mm" color="none"/>`;

    const type = getBorderTypeString(border.type);
    const width = getBorderWidthString(border.width);
    // type이 NONE이면 color도 none (레퍼런스 기준)
    const color = type === 'NONE' ? 'none' : formatColor(border.color);

    return `<hh:${tagName} type="${type}" width="${width}" color="${color}"/>`;
}

/**
 * Border type (HWPML: LineType1)
 */
function getBorderTypeString(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 0: return 'NONE';
        case 1: return 'SOLID';
        case 2: return 'DASH';
        case 3: return 'DOT';
        case 4: return 'DASH_DOT';
        case 5: return 'DASH_DOT_DOT';
        case 6: return 'LONG_DASH';
        case 7: return 'CIRCLE';
        case 8: return 'DOUBLE_SLIM';
        case 9: return 'SLIM_THICK';
        case 10: return 'THICK_SLIM';
        case 11: return 'SLIM_THICK_SLIM';
        default: return 'SOLID';
    }
}

/**
 * Border width (HWPML spec)
 */
function getBorderWidthString(widthCode: number | undefined): string {
    if (widthCode === undefined) return '0.12 mm';
    switch (widthCode) {
        case 0: return '0.1 mm';
        case 1: return '0.12 mm';
        case 2: return '0.15 mm';
        case 3: return '0.2 mm';
        case 4: return '0.25 mm';
        case 5: return '0.3 mm';
        case 6: return '0.4 mm';
        case 7: return '0.5 mm';
        case 8: return '0.6 mm';
        case 9: return '0.7 mm';
        case 10: return '1.0 mm';
        case 11: return '1.5 mm';
        case 12: return '2.0 mm';
        case 13: return '3.0 mm';
        case 14: return '4.0 mm';
        case 15: return '5.0 mm';
        default: return '0.12 mm';
    }
}

// === Fill Brush Generation ===

function fillBrushToXml(fillBrush: FillBrush | undefined): string {
    // fillBrush가 없거나 type=0이면 빈 문자열 반환 (레퍼런스는 fillBrush 없음)
    if (!fillBrush || fillBrush.type === 0) {
        return '';
    }

    // Check fill type
    const fillType = fillBrush.type || 0;

    // Note: fillBrush uses hc: (core) namespace, not hh: (head)
    switch (fillType) {
        case 0: // None
            return `<hc:fillBrush><hc:colorRef type="COLOR" value="NONE"/></hc:fillBrush>`;

        case 1: // Solid color (winBrush)
            return windowBrushToXml(fillBrush);

        case 2: // Gradient
            return gradientToXml(fillBrush.gradation);

        case 4: // Image
            return imageBrushToXml(fillBrush.imgBrush);

        default:
            // Fallback: check if faceColor exists
            if (fillBrush.faceColor !== undefined && fillBrush.faceColor !== 0xFFFFFFFF) {
                return windowBrushToXml(fillBrush);
            }
            return '';
    }
}

/**
 * Window brush (solid color fill)
 */
function windowBrushToXml(fillBrush: FillBrush): string {
    const faceColor = formatColor(fillBrush.faceColor);
    const hatchColor = formatColor(fillBrush.hatchColor || 0);
    const hatchStyle = fillBrush.hatchStyle || -1;
    const alpha = fillBrush.alpha || 0;

    return `<hc:fillBrush><hc:winBrush faceColor="${faceColor}" hatchColor="${hatchColor}" hatchStyle="${hatchStyle}" alpha="${alpha}"/></hc:fillBrush>`;
}

/**
 * Gradient fill (HWPML: Linear/Radial/Conical/Square)
 */
function gradientToXml(gradation: Gradation | undefined): string {
    if (!gradation) {
        return `<hc:fillBrush><hc:colorRef type="COLOR" value="NONE"/></hc:fillBrush>`;
    }

    const gradType = getGradientType(gradation.type);
    const angle = gradation.angle || 0;
    const centerX = gradation.centerX || 50;
    const centerY = gradation.centerY || 50;
    const step = gradation.step || 50;
    const stepCenter = gradation.stepCenter || 50;

    // Colors - use map() for better performance
    const colors: string[] = (gradation.colors && Array.isArray(gradation.colors))
        ? gradation.colors.map((c: number) => formatColor(c))
        : [formatColor(gradation.startColor || 0xFFFFFF), formatColor(gradation.endColor || 0x000000)];

    // Generate XML using map().join() for better performance
    const colorsXml = colors.map(c => `<hc:color value="${c}"/>`).join('');
    return `<hc:fillBrush><hc:gradation type="${gradType}" angle="${angle}" centerX="${centerX}" centerY="${centerY}" step="${step}" colorNum="${colors.length}" stepCenter="${stepCenter}">${colorsXml}</hc:gradation></hc:fillBrush>`;
}

function getGradientType(type: number | undefined): string {
    if (!type) return 'LINEAR';
    switch (type) {
        case 1: return 'LINEAR';
        case 2: return 'RADIAL';
        case 3: return 'CONICAL';
        case 4: return 'SQUARE';
        default: return 'LINEAR';
    }
}

/**
 * Image brush fill
 */
function imageBrushToXml(imgBrush: ImageBrush | undefined): string {
    if (!imgBrush) {
        return `<hc:fillBrush><hc:colorRef type="COLOR" value="NONE"/></hc:fillBrush>`;
    }

    const mode = getImageFillMode(imgBrush.mode);
    const binItemId = imgBrush.binItemId || 0;

    // Use remapped sequential ID to match native Hancom HWPX behavior
    const newId = getRemappedBinId(binItemId);
    const binItemRef = 'image' + newId;

    // Native Hancom HWPX format includes img attributes: bright, contrast, effect, alpha
    return `<hc:fillBrush><hc:imgBrush mode="${mode}"><hc:img binaryItemIDRef="${binItemRef}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/></hc:imgBrush></hc:fillBrush>`;
}

function getImageFillMode(mode: number | undefined): string {
    if (!mode) return 'TILE';
    switch (mode) {
        case 0: return 'TILE';
        case 1: return 'TILE_HORZ_TOP';
        case 2: return 'TILE_HORZ_BOTTOM';
        case 3: return 'TILE_VERT_LEFT';
        case 4: return 'TILE_VERT_RIGHT';
        case 5: return 'TOTAL';
        case 6: return 'CENTER';
        case 7: return 'CENTER_TOP';
        case 8: return 'CENTER_BOTTOM';
        case 9: return 'LEFT_CENTER';
        case 10: return 'LEFT_TOP';
        case 11: return 'LEFT_BOTTOM';
        case 12: return 'RIGHT_CENTER';
        case 13: return 'RIGHT_TOP';
        case 14: return 'RIGHT_BOTTOM';
        case 15: return 'ZOOM';
        default: return 'TILE';
    }
}

// === Utility ===

// Pre-computed hex digits for fast color conversion
const HEX_CHARS = '0123456789abcdef';

/**
 * Optimized color formatting using bitwise operations
 * Avoids .toString(16).padStart(6, '0') overhead
 */
function formatColor(color: number | undefined): string {
    if (color === undefined || color === null) return '#000000';

    const c = color & 0xFFFFFF;
    return '#' +
        HEX_CHARS[(c >> 20) & 0xF] +
        HEX_CHARS[(c >> 16) & 0xF] +
        HEX_CHARS[(c >> 12) & 0xF] +
        HEX_CHARS[(c >> 8) & 0xF] +
        HEX_CHARS[(c >> 4) & 0xF] +
        HEX_CHARS[c & 0xF];
}
