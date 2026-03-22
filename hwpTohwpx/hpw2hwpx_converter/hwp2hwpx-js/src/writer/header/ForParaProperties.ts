import { DocInfo, ParaShape } from 'hwplib-js';
import { StringXmlWriter } from '../stream/StringXmlWriter';

/**
 * HWPML-compliant PARASHAPE XML Generation
 * Based on: docs/hwpml-reference/04-parashape.md
 * Optimized with direct iteration and StringBuilder
 */

/**
 * Extended DocInfo interface for paraShapeList compatibility
 */
interface DocInfoWithParaShapeList extends DocInfo {
  paraShapeList?: Map<number, ParaShape> | ParaShape[];
}

/**
 * Extended ParaShape interface for additional properties
 */
interface ExtendedParaShape extends ParaShape {
  vertAlign?: number;
  headingType?: number;
  headingIdRef?: number;
  headingLevel?: number;
}

/**
 * Generates <hh:paraProperties> XML
 */
export function generateParaPropertiesXml(docInfo: DocInfo): string {
  // Check multiple possible locations for paraShapes
  const extDocInfo = docInfo as DocInfoWithParaShapeList;
  const paraShapeMap = docInfo.paraShapes ||
    extDocInfo.paraShapeList ||
    new Map<number, ParaShape>();

  // Convert to array if it's a Map
  let paraShapes: ParaShape[] = [];
  if (paraShapeMap instanceof Map) {
    for (const ps of paraShapeMap.values()) {
      paraShapes.push(ps);
    }
    paraShapes.sort((a, b) => a.id - b.id);
  } else if (Array.isArray(paraShapeMap)) {
    paraShapes = paraShapeMap;
  }

  if (paraShapes.length === 0) {
    return getDefaultParaPropertiesXml();
  }

  const sb = new StringXmlWriter();
  sb.append(`<hh:paraProperties itemCnt="${paraShapes.length}">`);

  const count = paraShapes.length;
  for (let i = 0; i < count; i++) {
    const ps = paraShapes[i];
    // HWP paraShape.id는 1-indexed이므로 HWPX에서는 0-indexed로 변환
    const hwpxId = Math.max(0, ps.id - 1);
    sb.append('\n');
    sb.append(paraShapeToXml(ps, hwpxId));
  }

  sb.append(`\n</hh:paraProperties>`);
  return sb.toString();
}

function getDefaultParaPropertiesXml(): string {
  return `<hh:paraProperties itemCnt="1">
  <hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
    <hh:align horizontal="JUSTIFY" vertical="BASELINE"/>
    <hh:heading type="NONE" idRef="0" level="0"/>
    <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
    <hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
    <hp:switch>
      <hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">
        <hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin>
        <hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>
      </hp:case>
      <hp:default>
        <hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin>
        <hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>
      </hp:default>
    </hp:switch>
    <hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
  </hh:paraPr>
</hh:paraProperties>`;
}

export function paraShapeToXml(paraShape: ParaShape, id: number): string {
  // Cast to ExtendedParaShape for additional properties
  const ps = paraShape as ExtendedParaShape;

  // Alignment (HWPML: Justify/Left/Right/Center/Distribute/DistributeSpace)
  const horizontal = getAlignmentType(paraShape.align);
  const vertical = getVerticalAlignType(ps.vertAlign);

  // Line spacing type (HWPML: Percent/Fixed/BetweenLines/AtLeast)
  const lineSpacingType = getLineSpacingType(ps.lineSpacingType);

  // Heading type (HWPML: None/Outline/Number/Bullet)
  const headingType = getHeadingType(ps.headingType);

  // Break settings
  const lineWrap = getLineWrapType(paraShape.lineWrap);

  // Safe defaults
  const tabDefID = paraShape.tabDefID || 0;
  const condense = paraShape.condense || 0;
  const indent = paraShape.indent || 0;
  const leftMargin = paraShape.leftMargin || 0;
  const rightMargin = paraShape.rightMargin || 0;
  const prevSpacing = paraShape.prevSpacing || 0;
  const nextSpacing = paraShape.nextSpacing || 0;
  const lineSpacing = paraShape.lineSpacing || 160;
  const borderFillID = paraShape.borderFillID || 1;
  const borderLeft = paraShape.borderLeft || 0;
  const borderRight = paraShape.borderRight || 0;
  const borderTop = paraShape.borderTop || 0;
  const borderBottom = paraShape.borderBottom || 0;

  // fontLineHeight: 글꼴에 어울리는 줄 높이 사용 여부
  // snapToGrid: 격자에 맞춤 여부
  const fontLineHeightVal = paraShape.fontLineHeight ? '1' : '0';
  const snapToGridVal = paraShape.snapToGrid !== false ? '1' : '0';

  const breakLatinWord = getBreakWordType(ps.breakLatinWord);
  const breakNonLatinWord = getBreakWordType(ps.breakNonLatinWord);

  return `<hh:paraPr id="${id}" tabPrIDRef="${tabDefID}" condense="${condense}" fontLineHeight="${fontLineHeightVal}" snapToGrid="${snapToGridVal}" suppressLineNumbers="${paraShape.suppressLineNumbers ? '1' : '0'}" checked="${paraShape.widowOrphan ? '1' : '0'}">
  <hh:align horizontal="${horizontal}" vertical="${vertical}"/>
  <hh:heading type="${headingType}" idRef="${ps.headingIdRef || 0}" level="${ps.headingLevel || 0}"/>
  <hh:breakSetting breakLatinWord="${breakLatinWord}" breakNonLatinWord="${breakNonLatinWord}" widowOrphan="${paraShape.widowOrphan ? '1' : '0'}" keepWithNext="${paraShape.keepWithNext ? '1' : '0'}" keepLines="${paraShape.keepLines ? '1' : '0'}" pageBreakBefore="${paraShape.pageBreakBefore ? '1' : '0'}" lineWrap="${lineWrap}"/>
  <hh:autoSpacing eAsianEng="${paraShape.autoSpaceEAsianEng ? '1' : '0'}" eAsianNum="${paraShape.autoSpaceEAsianNum ? '1' : '0'}"/>
  <hp:switch>
    <hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">
      <hh:margin><hc:intent value="${indent}" unit="HWPUNIT"/><hc:left value="${leftMargin}" unit="HWPUNIT"/><hc:right value="${rightMargin}" unit="HWPUNIT"/><hc:prev value="${prevSpacing}" unit="HWPUNIT"/><hc:next value="${nextSpacing}" unit="HWPUNIT"/></hh:margin>
      <hh:lineSpacing type="${lineSpacingType}" value="${lineSpacing}" unit="HWPUNIT"/>
    </hp:case>
    <hp:default>
      <hh:margin><hc:intent value="${indent}" unit="HWPUNIT"/><hc:left value="${leftMargin}" unit="HWPUNIT"/><hc:right value="${rightMargin}" unit="HWPUNIT"/><hc:prev value="${prevSpacing}" unit="HWPUNIT"/><hc:next value="${nextSpacing}" unit="HWPUNIT"/></hh:margin>
      <hh:lineSpacing type="${lineSpacingType}" value="${lineSpacing}" unit="HWPUNIT"/>
    </hp:default>
  </hp:switch>
  <hh:border borderFillIDRef="${borderFillID}" offsetLeft="${borderLeft}" offsetRight="${borderRight}" offsetTop="${borderTop}" offsetBottom="${borderBottom}" connect="0" ignoreMargin="0"/>
</hh:paraPr>`;
}

// === Helper Functions ===

/**
 * Horizontal alignment (HWP → HWPML)
 * HWP: 0=JUSTIFY, 1=LEFT, 2=CENTER, 3=RIGHT, 4=CENTER(table), 5=DISTRIBUTE, 6=DISTRIBUTE_SPACE
 */
function getAlignmentType(align: number | undefined): string {
  if (align === undefined) return 'JUSTIFY';
  switch (align) {
    case 0: return 'JUSTIFY';  // 양쪽 맞춤 (기본값)
    case 1: return 'LEFT';
    case 2: return 'CENTER';
    case 3: return 'RIGHT';
    case 4: return 'CENTER';  // 테이블 내 가운데 정렬
    case 5: return 'DISTRIBUTE';
    case 6: return 'DISTRIBUTE_SPACE';
    default: return 'JUSTIFY';
  }
}

/**
 * Vertical alignment (HWPML: Baseline/Top/Center/Bottom)
 */
function getVerticalAlignType(vertAlign: number | undefined): string {
  if (!vertAlign) return 'BASELINE';
  switch (vertAlign) {
    case 0: return 'BASELINE';
    case 1: return 'TOP';
    case 2: return 'CENTER';
    case 3: return 'BOTTOM';
    default: return 'BASELINE';
  }
}

/**
 * Line spacing type (HWPML: Percent/Fixed/BetweenLines/AtLeast)
 */
function getLineSpacingType(type: number | undefined): string {
  if (!type) return 'PERCENT';
  switch (type) {
    case 0: return 'PERCENT';
    case 1: return 'FIXED';
    case 2: return 'BETWEEN_LINES';
    case 3: return 'AT_LEAST';
    default: return 'PERCENT';
  }
}

/**
 * Heading type (HWPML: None/Outline/Number/Bullet)
 */
function getHeadingType(type: number | undefined): string {
  if (!type) return 'NONE';
  switch (type) {
    case 0: return 'NONE';
    case 1: return 'OUTLINE';
    case 2: return 'NUMBER';
    case 3: return 'BULLET';
    default: return 'NONE';
  }
}


/**
 * Line wrap type (HWPML: Break/Squeeze/Keep)
 */
function getLineWrapType(type: number | undefined): string {
  if (!type) return 'BREAK';
  switch (type) {
    case 0: return 'BREAK';
    case 1: return 'SQUEEZE';
    case 2: return 'KEEP';
    default: return 'BREAK';
  }
}

/**
 * Break word type (HWPML: KeepWord/HyphenWord/BreakWord)
 */
function getBreakWordType(type: number | undefined): string {
  if (!type) return 'KEEP_WORD';
  switch (type) {
    case 0: return 'KEEP_WORD';
    case 1: return 'HYPHEN_WORD';
    case 2: return 'BREAK_WORD';
    default: return 'KEEP_WORD';
  }
}

