/**
 * HWPML-compliant Equation (수식) XML Generation
 * Uses hwplib-js EquationHelper for MathML conversion
 */

import { Equation } from 'hwplib-js';
import { generateInstanceId } from '../../../util/IdGenerator';
import { DEFAULTS } from '../../../constants/DefaultValues';

/**
 * Extended Equation interface with additional properties
 */
interface ExtendedEquation extends Partial<Equation> {
    hwpEquation?: string;
    text?: string;
    width?: number;
    height?: number;
    baseline?: number;
    fontSize?: number;
    inline?: boolean;
    color?: number;
    backgroundColor?: number;
    fontFamily?: string;
    alignment?: number;  // 0=LEFT, 1=CENTER, 2=RIGHT
    x?: number;
    y?: number;
    zOrder?: number;
    marginLeft?: number;
    marginRight?: number;
    marginTop?: number;
    marginBottom?: number;
}

/**
 * Convert Equation control to OWPML XML
 */
export function equationToXml(equation: ExtendedEquation): string {
    const instId = generateInstanceId();
    const width = equation.width || DEFAULTS.equation.width;
    const height = equation.height || DEFAULTS.equation.height;
    const baseline = equation.baseline || DEFAULTS.equation.baseline;
    const fontSize = equation.fontSize || DEFAULTS.equation.fontSize;
    const inline = equation.inline ?? DEFAULTS.equation.inline ? '1' : '0';
    const x = equation.x || DEFAULTS.shape.horzOffset;
    const y = equation.y || DEFAULTS.shape.vertOffset;
    const zOrder = equation.zOrder || DEFAULTS.picture.zOrder;

    // Margins
    const marginLeft = equation.marginLeft || 0;
    const marginRight = equation.marginRight || 0;
    const marginTop = equation.marginTop || 0;
    const marginBottom = equation.marginBottom || 0;

    // Color handling
    const textColor = equation.color !== undefined
        ? rgbToHex(equation.color)
        : rgbToHex(DEFAULTS.character.textColor);

    // Font family
    const fontFamily = equation.fontFamily || DEFAULTS.font.hangul;

    // Alignment
    const horzAlign = getAlignmentString(equation.alignment);

    // Get script/formula content
    const script = escapeXml(equation.hwpEquation || equation.text || '');

    return `<hp:ctrl>
  <hp:equation id="${instId}" lock="0" numberingType="EQUATION" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" zOrder="${zOrder}">
    <hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${height}" heightRelTo="ABSOLUTE" protect="0"/>
    <hp:pos treatAsChar="${inline}" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="BASELINE" horzAlign="${horzAlign}" vertOffset="0" horzOffset="0"/>
    <hp:outMargin left="${marginLeft}" right="${marginRight}" top="${marginTop}" bottom="${marginBottom}"/>
    <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" x="${x}" y="${y}" alpha="100" angle="0"/>
    <hp:lineShape color="${textColor}" width="0.12 mm" style="NONE" endCap="FLAT"/>
    <hp:eqEdit version="1" baseLine="${baseline}" fontSize="${fontSize}" fontName="${escapeXml(fontFamily)}" inline="${inline}" textColor="${textColor}" script="${script}"/>
  </hp:equation>
</hp:ctrl>`;
}

// === Helper Functions ===

function escapeXml(str: string): string {
    // First, remove control characters (0x00-0x1F) except tab(0x09) and newline(0x0A)
    let cleaned = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x1F && code !== 0x09 && code !== 0x0A) {
            // Skip control characters
            continue;
        }
        cleaned += str[i];
    }

    // Then escape XML special characters
    return cleaned
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Convert RGB number to hex color string
 */
function rgbToHex(rgb: number): string {
    const r = (rgb >> 16) & 0xFF;
    const g = (rgb >> 8) & 0xFF;
    const b = rgb & 0xFF;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get alignment string from alignment value (OWPML specification)
 * 정렬 문자열 변환 (OWPML 전체 스펙)
 */
function getAlignmentString(alignment?: number): string {
    switch (alignment) {
        case 0: return 'LEFT';       // 왼쪽 정렬
        case 1: return 'CENTER';     // 가운데 정렬
        case 2: return 'RIGHT';      // 오른쪽 정렬
        case 3: return 'JUSTIFY';    // 양쪽 정렬
        case 4: return 'DISTRIBUTE'; // 배분 정렬
        default: return 'LEFT';
    }
}

/**
 * Default equation dimensions based on font size
 * 글꼴 크기에 따른 기본 수식 크기
 */
export function getDefaultEquationDimensions(fontSize: number = 10): { width: number; height: number } {
    // Approximate width: 100 hwpunit per point * 10 characters average
    const width = fontSize * 100 * 10;
    // Approximate height: 120% of font size in hwpunit
    const height = fontSize * 100 * 1.2;
    return {
        width: Math.round(width),
        height: Math.round(height)
    };
}
