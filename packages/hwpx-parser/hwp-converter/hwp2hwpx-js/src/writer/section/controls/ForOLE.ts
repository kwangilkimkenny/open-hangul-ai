/**
 * ForOLE.ts - OLE Object OWPML Generator
 * OLE 객체 (Excel, Word 등 임베디드 객체) OWPML 생성 모듈
 */

/**
 * OLE object types
 */
export const OLEType = {
    EMBED: 'EMBED',       // 포함된 객체
    LINK: 'LINK',         // 연결된 객체
    STATIC: 'STATIC'      // 정적 이미지
} as const;

/**
 * OLE object interface
 */
export interface OLEObject {
    id: number;
    type: keyof typeof OLEType;
    binDataIDRef?: number;        // 이미지 미리보기 BinData ID
    objDataBIDRef?: number;       // OLE 데이터 BinData ID
    width: number;                // 너비 (HWPUNIT)
    height: number;               // 높이 (HWPUNIT)
    x?: number;                   // X 위치
    y?: number;                   // Y 위치
    zOrder?: number;              // Z 순서
    drawAspect?: 'CONTENT' | 'ICON'; // 표시 방식
    objectId?: string;            // OLE Object ID (UUID)
    programId?: string;           // 프로그램 ID (e.g., "Excel.Sheet.12")
    isPreviewLocked?: boolean;    // 미리보기 잠금
    hasMoniker?: boolean;         // Moniker 존재 여부
}

/**
 * Extended OLE control interface for HWP
 */
export interface HWPOLEControl {
    type: 'OLE';
    oleObject: OLEObject;
}

/**
 * Generate OWPML OLE object XML
 * @param ole OLE object definition
 * @returns OWPML OLE XML string
 */
export function oleToXml(ole: OLEObject): string {
    const oleType = ole.type || 'EMBED';
    const drawAspect = ole.drawAspect || 'CONTENT';
    const objectId = ole.objectId || `{${generateOLEObjectId()}}`;
    const programId = ole.programId || `OLE:${oleType}`;

    // Shape positioning attributes
    const positionAttrs = [
        `vertRelTo="PARA"`,
        `horzRelTo="PARA"`,
        `vertAlign="TOP"`,
        `horzAlign="LEFT"`,
        ole.x !== undefined ? `vertOffset="${ole.x}"` : '',
        ole.y !== undefined ? `horzOffset="${ole.y}"` : ''
    ].filter(Boolean).join(' ');

    // Size attributes
    const sizeContent = `<hp:sz width="${ole.width}" height="${ole.height}" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE"/>`;

    // Position content
    const posContent = `<hp:pos ${positionAttrs} treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0"/>`;

    // OLE specific content
    const oleContent = `
      <hp:ole objectId="${objectId}" hasMoniker="${ole.hasMoniker ? '1' : '0'}" drawAspect="${drawAspect}" eqBaseLine="0"/>
      <hp:shapeComment>${programId}</hp:shapeComment>`;

    // Binary data references
    let binDataContent = '';
    if (ole.binDataIDRef !== undefined) {
        binDataContent += `\n      <hp:img bright="0" contrast="0" effect="REAL_PIC" binDataIDRef="${ole.binDataIDRef}">
        <hp:imgRect x1="0" y1="0" x2="100" y2="100"/>
        <hp:imgClip left="0" right="0" top="0" bottom="0"/>
        <hp:imgDim dimwidth="${ole.width}" dimheight="${ole.height}"/>
      </hp:img>`;
    }

    return `<hp:ctrl>
    <hp:shapeObject id="${ole.id}" zOrder="${ole.zOrder ?? 0}" numberingType="NONE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" dropcapstyle="NONE">
      ${sizeContent}
      ${posContent}
      <hp:outMargin left="0" right="0" top="0" bottom="0"/>
      ${oleContent}${binDataContent}
    </hp:shapeObject>
  </hp:ctrl>`;
}

/**
 * Generate a pseudo-unique OLE Object ID
 */
function generateOLEObjectId(): string {
    const hex = () => Math.floor(Math.random() * 16).toString(16);
    const segment = (len: number) => Array.from({ length: len }, hex).join('');
    return `${segment(8)}-${segment(4)}-${segment(4)}-${segment(4)}-${segment(12)}`.toUpperCase();
}

/**
 * Create OLE fallback as static image
 * Used when OLE data cannot be extracted, uses preview image instead
 */
export function createOLEFallbackImage(ole: OLEObject): string {
    if (ole.binDataIDRef === undefined) {
        return `<!-- OLE object without preview: ${ole.id} -->`;
    }

    // Convert OLE to simple picture for compatibility
    return `<hp:ctrl>
    <hp:shapeObject id="${ole.id}" zOrder="${ole.zOrder ?? 0}" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0">
      <hp:sz width="${ole.width}" height="${ole.height}" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE"/>
      <hp:pos vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" treatAsChar="1"/>
      <hp:outMargin left="0" right="0" top="0" bottom="0"/>
      <hp:img bright="0" contrast="0" effect="REAL_PIC" binDataIDRef="${ole.binDataIDRef}">
        <hp:imgRect x1="0" y1="0" x2="100" y2="100"/>
        <hp:imgClip left="0" right="0" top="0" bottom="0"/>
        <hp:imgDim dimwidth="${ole.width}" dimheight="${ole.height}"/>
      </hp:img>
    </hp:shapeObject>
  </hp:ctrl>`;
}

/**
 * Check if an OLE object has valid preview data
 */
export function hasValidPreview(ole: OLEObject): boolean {
    return ole.binDataIDRef !== undefined && ole.binDataIDRef > 0;
}

/**
 * Known OLE program IDs and their descriptions
 */
export const KnownOLEPrograms: Record<string, string> = {
    'Excel.Sheet.12': 'Microsoft Excel Worksheet',
    'Excel.Sheet.8': 'Microsoft Excel 97-2003 Worksheet',
    'Excel.Chart.8': 'Microsoft Excel Chart',
    'Word.Document.12': 'Microsoft Word Document',
    'Word.Document.8': 'Microsoft Word 97-2003 Document',
    'PowerPoint.Slide.12': 'Microsoft PowerPoint Slide',
    'Equation.3': 'Microsoft Equation 3.0',
    'Package': 'Embedded Package',
    'AcroExch.Document': 'Adobe PDF Document'
};
