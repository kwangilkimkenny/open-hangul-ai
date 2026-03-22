import { BinData } from 'hwplib-js';
import { HWPPicture } from '../../../models/hwp.types';
import { generateInstanceId } from '../../../util/IdGenerator';
import { formatBinId } from '../../header/ForBinData';

/**
 * HWPML-compliant PICTURE XML Generation
 * Based on: docs/hwpml-reference/08-picture.md
 */

export function pictureToXml(picture: HWPPicture, _binData?: BinData): string {
  const instId = generateInstanceId();

  // Binary data reference
  const binID = (picture.binDataIDRef !== undefined && picture.binDataIDRef !== null)
    ? picture.binDataIDRef
    : 0;

  // 표시 크기 (hwpunit)
  const width = picture.width || 8000;
  const height = picture.height || 6000;

  // 원본 이미지 크기 (SHAPE_COMPONENT_PICTURE에서 추출된 값 사용)
  const origImgWidth = picture.imgWidth || width;
  const origImgHeight = picture.imgHeight || height;
  const rotation = picture.rotation || 0;

  // Crop values
  const cropLeft = picture.cropLeft || 0;
  const cropRight = picture.cropRight || origImgWidth;
  const cropTop = picture.cropTop || 0;
  const cropBottom = picture.cropBottom || origImgHeight;

  // Image effects (HWPML spec)
  const bright = picture.bright || 0;
  const contrast = picture.contrast || 0;
  const effect = getImageEffect(picture.effect);
  const alpha = picture.alpha || 0;

  // Position attributes
  const textWrap = getTextWrapType(picture.textWrap);
  const textFlow = getTextFlowType(picture.textFlow);
  const vertRelTo = getVertRelTo(picture.vertRelTo);
  const horzRelTo = getHorzRelTo(picture.horzRelTo);
  const vertAlign = getVertAlign(picture.vertAlign);
  const horzAlign = getHorzAlign(picture.horzAlign);
  const vertOffset = picture.vertOffset || 0;
  const horzOffset = picture.horzOffset || 0;
  const treatAsChar = picture.treatAsChar ? '1' : '0';
  // allowOverlap must be "0" for images to display correctly in Hancom Office
  const allowOverlap = '0';

  // Flip
  const horzFlip = picture.horzFlip ? '1' : '0';
  const vertFlip = picture.vertFlip ? '1' : '0';

  // Native Hancom HWPX structure order (verified from native HWPX):
  // 1. hp:sz, hp:pos, hp:outMargin (layout info FIRST)
  // 2. hp:shapeComponent (shape component info)
  // 3. hp:flip, hp:rotationInfo, hp:renderingInfo (transforms)
  // 4. hc:img, hp:imgRect, hp:imgClip, hp:inMargin, hp:imgDim, hp:effects (image content)
  return `<hp:pic id="${instId}" zOrder="${picture.zOrder || 0}" numberingType="PICTURE" textWrap="${textWrap}" textFlow="${textFlow}" lock="${picture.lock ? '1' : '0'}" dropcapstyle="None" href="${picture.href || ''}" groupLevel="${picture.groupLevel || 0}" instid="${instId}" reverse="0">
  <hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${height}" heightRelTo="ABSOLUTE" protect="0"/>
  <hp:pos treatAsChar="${treatAsChar}" affectLSpacing="0" flowWithText="0" allowOverlap="${allowOverlap}" holdAnchorAndSO="0" vertRelTo="${vertRelTo}" horzRelTo="${horzRelTo}" vertAlign="${vertAlign}" horzAlign="${horzAlign}" vertOffset="${vertOffset}" horzOffset="${horzOffset}"/>
  <hp:outMargin left="${picture.marginLeft || 0}" right="${picture.marginRight || 0}" top="${picture.marginTop || 0}" bottom="${picture.marginBottom || 0}"/>
  <hp:shapeComponent groupLevel="0" orient="NONE" horzFlip="${horzFlip}" vertFlip="${vertFlip}" x="0" y="0" alpha="100" angle="${rotation}"/>
  <hp:flip horizontal="${horzFlip}" vertical="${vertFlip}"/>
  <hp:rotationInfo angle="${rotation}" centerX="${Math.round(width / 2)}" centerY="${Math.round(height / 2)}" rotateimage="1"/>
  <hp:renderingInfo>
    <hc:transMatrix e1="1.0" e2="0.0" e3="0.0" e4="1.0" e5="0.0" e6="0.0"/>
    <hc:scaMatrix e1="1.0" e2="0.0" e3="0.0" e4="1.0" e5="0.0" e6="0.0"/>
    <hc:rotMatrix e1="1.0" e2="0.0" e3="0.0" e4="1.0" e5="0.0" e6="0.0"/>
  </hp:renderingInfo>
  <hc:img binaryItemIDRef="${formatBinId(binID)}" bright="${bright}" contrast="${contrast}" effect="${effect}" alpha="${alpha}"/>
  <hp:imgRect>
    <hc:pt0 x="0" y="0"/>
    <hc:pt1 x="${origImgWidth}" y="0"/>
    <hc:pt2 x="${origImgWidth}" y="${origImgHeight}"/>
    <hc:pt3 x="0" y="${origImgHeight}"/>
  </hp:imgRect>
  <hp:imgClip left="${cropLeft}" right="${cropRight}" top="${cropTop}" bottom="${cropBottom}"/>
  <hp:inMargin left="0" right="0" top="0" bottom="0"/>
  <hp:imgDim dimwidth="${origImgWidth}" dimheight="${origImgHeight}"/>
  <hp:effects/>
</hp:pic>`;
}

// === Helper Functions ===

/**
 * Image effect type (OWPML specification complete)
 * 이미지 효과 타입 (OWPML 전체 스펙)
 */
function getImageEffect(effect: number | undefined): string {
  if (effect === undefined || effect === null) return 'REAL_PIC';
  switch (effect) {
    case 0: return 'REAL_PIC';       // 원본
    case 1: return 'GRAY_SCALE';     // 회색조
    case 2: return 'BLACK_WHITE';    // 흑백
    case 3: return 'PATTERN8X8';     // 8x8 패턴
    case 4: return 'SOFT_EDGE';      // 부드러운 가장자리
    case 5: return 'EMBOSS';         // 양각
    case 6: return 'ENGRAVE';        // 음각
    default: return 'REAL_PIC';
  }
}

/**
 * Text wrap type (HWPML spec)
 * 0=SQUARE, 1=TIGHT, 2=THROUGH, 3=TOP_AND_BOTTOM, 4=BEHIND_TEXT, 5=IN_FRONT_OF_TEXT
 */
function getTextWrapType(type: number | undefined): string {
  if (type === undefined || type === null) return 'SQUARE';  // 기본값: SQUARE
  switch (type) {
    case 0: return 'SQUARE';
    case 1: return 'TIGHT';
    case 2: return 'THROUGH';
    case 3: return 'TOP_AND_BOTTOM';
    case 4: return 'BEHIND_TEXT';
    case 5: return 'IN_FRONT_OF_TEXT';
    default: return 'SQUARE';
  }
}

/**
 * Text flow type (HWPML spec)
 * 0=BOTH_SIDES, 1=LEFT_ONLY, 2=RIGHT_ONLY, 3=LARGEST_ONLY
 */
function getTextFlowType(type: number | undefined): string {
  if (type === undefined || type === null) return 'BOTH_SIDES';
  switch (type) {
    case 0: return 'BOTH_SIDES';
    case 1: return 'LEFT_ONLY';
    case 2: return 'RIGHT_ONLY';
    case 3: return 'LARGEST_ONLY';
    default: return 'BOTH_SIDES';
  }
}

/**
 * Vertical relative position
 * 0=PAPER, 1=PAGE, 2=PARA
 */
function getVertRelTo(type: number | undefined): string {
  if (type === undefined || type === null) return 'PAPER';  // 기본값: PAPER
  switch (type) {
    case 0: return 'PAPER';
    case 1: return 'PAGE';
    case 2: return 'PARA';
    default: return 'PAPER';
  }
}

/**
 * Horizontal relative position
 * 0=PAPER, 1=PAGE, 2=COLUMN, 3=PARA
 */
function getHorzRelTo(type: number | undefined): string {
  if (type === undefined || type === null) return 'COLUMN';  // 기본값: COLUMN
  switch (type) {
    case 0: return 'PAPER';
    case 1: return 'PAGE';
    case 2: return 'COLUMN';
    case 3: return 'PARA';
    default: return 'COLUMN';
  }
}

/**
 * Vertical alignment
 * 0=TOP, 1=CENTER, 2=BOTTOM, 3=INSIDE, 4=OUTSIDE
 */
function getVertAlign(type: number | undefined): string {
  if (type === undefined || type === null) return 'TOP';
  switch (type) {
    case 0: return 'TOP';
    case 1: return 'CENTER';
    case 2: return 'BOTTOM';
    case 3: return 'INSIDE';
    case 4: return 'OUTSIDE';
    default: return 'TOP';
  }
}

/**
 * Horizontal alignment
 * 0=LEFT, 1=CENTER, 2=RIGHT, 3=INSIDE, 4=OUTSIDE
 */
function getHorzAlign(type: number | undefined): string {
  if (type === undefined || type === null) return 'LEFT';
  switch (type) {
    case 0: return 'LEFT';
    case 1: return 'CENTER';
    case 2: return 'RIGHT';
    case 3: return 'INSIDE';
    case 4: return 'OUTSIDE';
    default: return 'LEFT';
  }
}
