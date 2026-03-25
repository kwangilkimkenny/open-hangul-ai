/**
 * TEXTBOX to OWPML XML conversion
 *
 * 텍스트 박스(GSO 컨트롤)를 HWPX XML로 변환
 * 위치, 크기, 테두리, 배경색, 그림자 등 모든 속성 지원
 */

import { generateParagraphsXml } from '../ForParagraph';
import { generateInstanceId } from '../../../util/IdGenerator';
import type { HWPTextBox } from '../../../models/hwp.types';

/**
 * Extended TextBox interface with all HWPX supported properties
 */
interface ExtendedTextBox extends HWPTextBox {
    rotation?: number;
    zOrder?: number;
    borderFillIDRef?: number;
    textWrap?: number;
    textFlow?: string;
    vertRelTo?: string;
    horzRelTo?: string;
    vertAlign?: string;
    horzAlign?: string;
    vertOffset?: number;
    horzOffset?: number;
    treatAsChar?: boolean;
    marginLeft?: number;
    marginRight?: number;
    marginTop?: number;
    marginBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    alpha?: number;
    shadow?: boolean;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
}

/**
 * 텍스트 박스 객체를 XML로 변환
 *
 * HWPX에서 텍스트 박스는 hp:container 내 hp:rect로 표현
 */
export function textboxToXml(textbox: HWPTextBox): string {
    if (!textbox) {
        return '';
    }

    // Cast to extended interface for additional properties
    const extTextbox = textbox as ExtendedTextBox;
    const instId = generateInstanceId();

    // 위치 및 크기
    const x = textbox.x || 0;
    const y = textbox.y || 0;
    const width = textbox.width || 8000;
    const height = textbox.height || 4000;

    // 회전 및 Z-order
    const rotation = extTextbox.rotation || 0;
    const zOrder = extTextbox.zOrder || 0;

    // 테두리 및 배경
    const borderFillIDRef = extTextbox.borderFillIDRef || 1;

    // 배치 속성
    const textWrap = getTextWrapType(extTextbox.textWrap);
    const textFlow = extTextbox.textFlow || 'BOTH_SIDES';
    const vertRelTo = extTextbox.vertRelTo || 'PARA';
    const horzRelTo = extTextbox.horzRelTo || 'PARA';
    const vertAlign = extTextbox.vertAlign || 'TOP';
    const horzAlign = extTextbox.horzAlign || 'LEFT';
    const vertOffset = extTextbox.vertOffset || 0;
    const horzOffset = extTextbox.horzOffset || 0;
    const treatAsChar = extTextbox.treatAsChar ? '1' : '0';

    // 여백
    const marginLeft = extTextbox.marginLeft || 0;
    const marginRight = extTextbox.marginRight || 0;
    const marginTop = extTextbox.marginTop || 0;
    const marginBottom = extTextbox.marginBottom || 0;

    // 내부 여백 (padding)
    const paddingLeft = extTextbox.paddingLeft || 170;
    const paddingRight = extTextbox.paddingRight || 170;
    const paddingTop = extTextbox.paddingTop || 170;
    const paddingBottom = extTextbox.paddingBottom || 170;

    // 투명도 및 그림자
    const alpha = extTextbox.alpha || 0;
    const hasShadow = extTextbox.shadow || false;

    // 텍스트 박스 내부 문단
    const paragraphs = textbox.paragraphs || [];
    const paragraphsXml = paragraphs.length > 0 ? generateParagraphsXml(paragraphs) : '';

    // 그림자 XML (있는 경우)
    const shadowXml = hasShadow
        ? `<hp:shadow type="DROP" color="${extTextbox.shadowColor || '#808080'}" offsetX="${extTextbox.shadowOffsetX || 10}" offsetY="${extTextbox.shadowOffsetY || 10}"/>`
        : '';

    return `<hp:container id="${instId}" zOrder="${zOrder}" numberingType="TEXTBOX" textWrap="${textWrap}" textFlow="${textFlow}" lock="0" dropcapstyle="None">
  <hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${height}" heightRelTo="ABSOLUTE" protect="0"/>
  <hp:pos treatAsChar="${treatAsChar}" affectLSpacing="0" flowWithText="0" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="${vertRelTo}" horzRelTo="${horzRelTo}" vertAlign="${vertAlign}" horzAlign="${horzAlign}" vertOffset="${vertOffset}" horzOffset="${horzOffset}"/>
  <hp:outMargin left="${marginLeft}" right="${marginRight}" top="${marginTop}" bottom="${marginBottom}"/>
  <hp:rect x="${x}" y="${y}" groupLevel="0" orient="NONE" horzFlip="0" vertFlip="0" alpha="${alpha}" angle="${rotation}" instid="${instId}" borderFillIDRef="${borderFillIDRef}">
    <hp:lineShape lineType="NONE" lineWidth="0" lineColor="#000000"/>
    <hp:fillBrush/>
    ${shadowXml}
  </hp:rect>
  <hp:subList id="${instId}" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
    <hp:inMargin left="${paddingLeft}" right="${paddingRight}" top="${paddingTop}" bottom="${paddingBottom}"/>
    ${paragraphsXml}
  </hp:subList>
</hp:container>`;
}

/**
 * Text wrap type for textbox
 */
function getTextWrapType(type: number | undefined): string {
    if (type === undefined || type === null) return 'SQUARE';
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
