import { DocInfo, CharShape } from 'hwplib-js';
import { StringXmlWriter } from '../stream/StringXmlWriter';
import { DEFAULTS } from '../../constants/DefaultValues';

/**
 * HWPML-compliant CHARSHAPE XML Generation
 * Based on: docs/hwpml-reference/03-charshape.md
 */

/**
 * Extended DocInfo interface for charShapeList compatibility
 */
interface DocInfoWithCharShapeList extends DocInfo {
    charShapeList?: Map<number, CharShape> | CharShape[];
}

/**
 * Generates <hh:charProperties> XML from DocInfo
 * Optimized with direct iteration and StringBuilder
 */
export function generateCharPropertiesXml(docInfo: DocInfo): string {
    // Check multiple possible locations for charShapes
    const extDocInfo = docInfo as DocInfoWithCharShapeList;
    const charShapeMap = docInfo.charShapes ||
        extDocInfo.charShapeList ||
        new Map<number, CharShape>();

    // Convert to array if it's a Map
    let charShapes: CharShape[] = [];
    if (charShapeMap instanceof Map) {
        for (const cs of charShapeMap.values()) {
            charShapes.push(cs);
        }
        charShapes.sort((a, b) => a.id - b.id);
    } else if (Array.isArray(charShapeMap)) {
        charShapes = charShapeMap;
    }

    if (charShapes.length === 0) {
        return getDefaultCharPropertiesXml();
    }

    const sb = new StringXmlWriter();
    sb.append(`<hh:charProperties itemCnt="${charShapes.length}">`);

    const count = charShapes.length;
    for (let i = 0; i < count; i++) {
        const cs = charShapes[i];
        sb.append('\n');
        sb.append(charShapeToXml(cs, cs.id));
    }

    sb.append(`\n</hh:charProperties>`);
    return sb.toString();
}

function getDefaultCharPropertiesXml(): string {
    // DEFAULTS에서 기본값 가져오기
    const fontSize = DEFAULTS.character.fontSize;
    const textColor = formatColor(DEFAULTS.character.textColor);
    const underlineColor = formatColor(DEFAULTS.character.underlineColor);
    const ratio = DEFAULTS.character.fontRatio;
    const spacing = DEFAULTS.character.charSpacing;
    const relSize = DEFAULTS.character.relativeSize;
    const offset = DEFAULTS.character.charOffset;
    const borderFillRef = DEFAULTS.character.borderFillId;

    return `<hh:charProperties itemCnt="1">
  <hh:charPr id="0" height="${fontSize}" textColor="${textColor}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="${borderFillRef}">
    <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
    <hh:ratio hangul="${ratio}" latin="${ratio}" hanja="${ratio}" japanese="${ratio}" other="${ratio}" symbol="${ratio}" user="${ratio}"/>
    <hh:spacing hangul="${spacing}" latin="${spacing}" hanja="${spacing}" japanese="${spacing}" other="${spacing}" symbol="${spacing}" user="${spacing}"/>
    <hh:relSz hangul="${relSize}" latin="${relSize}" hanja="${relSize}" japanese="${relSize}" other="${relSize}" symbol="${relSize}" user="${relSize}"/>
    <hh:offset hangul="${offset}" latin="${offset}" hanja="${offset}" japanese="${offset}" other="${offset}" symbol="${offset}" user="${offset}"/>
    <hh:underline type="NONE" shape="SOLID" color="${underlineColor}"/>
    <hh:strikeout shape="NONE" color="${underlineColor}"/>
    <hh:outline type="NONE"/>
    <hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/>
  </hh:charPr>
</hh:charProperties>`;
}

export function charShapeToXml(charShape: CharShape, id: number): string {
    // Attribute flags (bit fields)
    const attr = charShape.attribute || 0;
    const italic = (attr & 0x01) !== 0;
    const bold = (attr & 0x02) !== 0;
    const superscript = (attr & 0x100) !== 0;
    const subscript = (attr & 0x200) !== 0;

    // Colors
    const textColor = formatColor(charShape.textColor);
    const shadeColor = charShape.shadeColor === 0xFFFFFF || charShape.shadeColor === 0xFFFFFFFF
        ? 'none'
        : formatColor(charShape.shadeColor);
    const underlineColor = formatColor(charShape.underlineColor);
    const strikeoutColor = formatColor(charShape.strikeoutColor);
    const shadowColor = formatColor(charShape.shadowColor);

    // Underline type mapping (HWPML: Bottom/Center/Top)
    const underlineType = getUnderlineType(charShape.underlineType);
    const underlineShape = getLineShape(charShape.underlineShape);

    // Strikeout type mapping (HWPML: None/Continuous)
    const strikeoutShape = getStrikeoutShape(charShape.strikeoutType);

    // Shadow type mapping (HWPML: None/Drop/Cont)
    const shadowType = getShadowType(charShape.shadowType);

    // SymMark (emphasis marks)
    const symMark = getSymMarkType(charShape.symMark);

    // Font properties - DEFAULTS 사용
    const defaultFontId = DEFAULTS.idFallback.fontId;
    const defaultRatio = DEFAULTS.character.fontRatio;
    const defaultSpacing = DEFAULTS.character.charSpacing;
    const defaultRelSize = DEFAULTS.character.relativeSize;
    const defaultOffset = DEFAULTS.character.charOffset;

    const fontIDs = charShape.fontIDs || { hangul: defaultFontId, latin: defaultFontId, hanja: defaultFontId, japanese: defaultFontId, other: defaultFontId, symbol: defaultFontId, user: defaultFontId };
    const ratios = charShape.ratios || { hangul: defaultRatio, latin: defaultRatio, hanja: defaultRatio, japanese: defaultRatio, other: defaultRatio, symbol: defaultRatio, user: defaultRatio };
    const spacing = charShape.spacing || { hangul: defaultSpacing, latin: defaultSpacing, hanja: defaultSpacing, japanese: defaultSpacing, other: defaultSpacing, symbol: defaultSpacing, user: defaultSpacing };
    const relSizes = charShape.relSizes || { hangul: defaultRelSize, latin: defaultRelSize, hanja: defaultRelSize, japanese: defaultRelSize, other: defaultRelSize, symbol: defaultRelSize, user: defaultRelSize };
    const offsets = charShape.offsets || { hangul: defaultOffset, latin: defaultOffset, hanja: defaultOffset, japanese: defaultOffset, other: defaultOffset, symbol: defaultOffset, user: defaultOffset };

    // borderFillIDRef: 레퍼런스 기준 기본값 (테두리 없음 스타일)
    const borderFillRef = charShape.borderFillID || DEFAULTS.character.borderFillId;
    const fontSize = charShape.fontSizes?.hangul || DEFAULTS.character.fontSize;

    let xml = `<hh:charPr id="${id}" height="${fontSize}" textColor="${textColor}" shadeColor="${shadeColor}" useFontSpace="${charShape.useFontSpace ? '1' : '0'}" useKerning="${charShape.useKerning ? '1' : '0'}" symMark="${symMark}" borderFillIDRef="${borderFillRef}">
  <hh:fontRef hangul="${fontIDs.hangul}" latin="${fontIDs.latin}" hanja="${fontIDs.hanja}" japanese="${fontIDs.japanese}" other="${fontIDs.other}" symbol="${fontIDs.symbol}" user="${fontIDs.user}"/>
  <hh:ratio hangul="${ratios.hangul}" latin="${ratios.latin}" hanja="${ratios.hanja}" japanese="${ratios.japanese}" other="${ratios.other}" symbol="${ratios.symbol}" user="${ratios.user}"/>
  <hh:spacing hangul="${spacing.hangul}" latin="${spacing.latin}" hanja="${spacing.hanja}" japanese="${spacing.japanese}" other="${spacing.other}" symbol="${spacing.symbol}" user="${spacing.user}"/>
  <hh:relSz hangul="${relSizes.hangul}" latin="${relSizes.latin}" hanja="${relSizes.hanja}" japanese="${relSizes.japanese}" other="${relSizes.other}" symbol="${relSizes.symbol}" user="${relSizes.user}"/>
  <hh:offset hangul="${offsets.hangul}" latin="${offsets.latin}" hanja="${offsets.hanja}" japanese="${offsets.japanese}" other="${offsets.other}" symbol="${offsets.symbol}" user="${offsets.user}"/>`;

    // Optional italic/bold elements
    if (italic) xml += `\n  <hh:italic/>`;
    if (bold) xml += `\n  <hh:bold/>`;

    // Underline
    xml += `\n  <hh:underline type="${underlineType}" shape="${underlineShape}" color="${underlineColor}"/>`;

    // Strikeout
    xml += `\n  <hh:strikeout shape="${strikeoutShape}" color="${strikeoutColor}"/>`;

    // Outline
    const outlineType = getOutlineType(charShape.outlineType);
    xml += `\n  <hh:outline type="${outlineType}"/>`;

    // Shadow
    xml += `\n  <hh:shadow type="${shadowType}" color="${shadowColor}" offsetX="${charShape.shadowOffsetX || 10}" offsetY="${charShape.shadowOffsetY || 10}"/>`;

    // Superscript/Subscript
    if (superscript) xml += `\n  <hh:superscript/>`;
    if (subscript) xml += `\n  <hh:subscript/>`;

    xml += `\n</hh:charPr>`;
    return xml;
}

// === Helper Functions ===

// Pre-computed hex digits for fast color conversion
const HEX_CHARS = '0123456789abcdef';

/**
 * Optimized color formatting using bitwise operations
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

/**
 * Underline type (HWPML spec: Bottom/Center/Top)
 */
function getUnderlineType(type: number | undefined): string {
    if (!type) return 'NONE';
    switch (type) {
        case 1: return 'BOTTOM';  // 글자 아래
        case 2: return 'CENTER';  // 글자 중간
        case 3: return 'TOP';     // 글자 위
        default: return 'NONE';
    }
}

/**
 * Line shape (HWPML spec: LineType2)
 */
function getLineShape(shape: number | undefined): string {
    if (!shape) return 'SOLID';
    switch (shape) {
        case 0: return 'SOLID';
        case 1: return 'DASH';
        case 2: return 'DOT';
        case 3: return 'DASH_DOT';
        case 4: return 'DASH_DOT_DOT';
        case 5: return 'LONG_DASH';
        case 6: return 'CIRCLE';
        case 7: return 'DOUBLE_SLIM';
        case 8: return 'SLIM_THICK';
        case 9: return 'THICK_SLIM';
        case 10: return 'SLIM_THICK_SLIM';
        default: return 'SOLID';
    }
}

/**
 * Strikeout shape (HWPML spec: None/Continuous)
 * HWP에서 strikeoutType=1만 CONTINUOUS, 그 외는 NONE
 */
function getStrikeoutShape(type: number | undefined): string {
    if (type === 1) return 'CONTINUOUS';
    return 'NONE';
}

/**
 * Shadow type (HWPML spec: None/Drop/Continuous)
 * Based on OWPML enumdef.h CSHADOWTYPE
 */
function getShadowType(type: number | undefined): string {
    if (!type || type === 0) return 'NONE';
    switch (type) {
        case 1: return 'DROP';        // 비연속
        case 2: return 'CONTINUOUS';  // 연속 (OWPML 표준)
        default: return 'DROP';
    }
}

/**
 * Emphasis mark type (SymMark)
 * Based on OWPML enumdef.h SYMBOLMARKTYPE
 */
function getSymMarkType(type: number | undefined): string {
    if (!type || type === 0) return 'NONE';
    switch (type) {
        case 1: return 'DOT_ABOVE';      // 점 (위)
        case 2: return 'RING_ABOVE';     // 고리 (위)
        case 3: return 'TILDE';          // 물결
        case 4: return 'CARON';          // 꺾쇠
        case 5: return 'SIDE';           // 옆점
        case 6: return 'COLON';          // 쌍점
        case 7: return 'GRAVE_ACCENT';   // 억음 부호
        case 8: return 'ACUTE_ACCENT';   // 양음 부호
        case 9: return 'CIRCUMFLEX';     // 곡절 부호
        case 10: return 'MACRON';        // 장음 부호
        case 11: return 'HOOK_ABOVE';    // 훅 (위)
        case 12: return 'DOT_BELOW';     // 점 (아래)
        default: return 'NONE';
    }
}

/**
 * Outline type (HWPML spec: None/Solid/Dot/Dash/DashDot)
 */
function getOutlineType(type: number | undefined): string {
    if (!type || type === 0) return 'NONE';
    switch (type) {
        case 1: return 'SOLID';
        case 2: return 'DOT';
        case 3: return 'THICK';
        case 4: return 'DASH';
        case 5: return 'DASH_DOT';
        case 6: return 'DASH_DOT_DOT';
        default: return 'NONE';
    }
}

