import { NAMESPACES } from '../../constants/xml-namespaces';
import { generateParagraphsXml } from './ForParagraph';
import { tableToXml } from './controls/ForTable';
import { pictureToXml } from './controls/ForPicture';
import { columnDefToXml, ExtendedColumnDef } from './ForColumn';
import { getMasterPageCount } from './ForMasterPage';
import { HWPSection, PageDef, HeaderFooter, HWPTable, HWPPicture } from '../../models/hwp.types';
import type { Table } from 'hwplib-js';
import { generateHeaderFooterId } from '../../util/IdGenerator';

/**
 * HWPSection -> OWPML Section XML 변환
 */
export function generateSectionXml(
    section: HWPSection,
    inlineTableXmls?: string[],
    inlinePictureXmls?: string[]
): string {
    // PageDef -> hp:secPr
    const secPrContent = generateSecPr(section);

    // 1. Header/Footer XML
    const headerFooterXmls: string[] = [];
    if (section.headerFooters && section.headerFooters.length > 0) {
        section.headerFooters.forEach((hf: HeaderFooter) => {
            headerFooterXmls.push(headerFooterToXml(hf));
        });
    }

    // 2. Section Body XML
    const injectedXmls = [secPrContent, ...headerFooterXmls, ...(inlineTableXmls || []), ...(inlinePictureXmls || [])];

    const paragraphsXml = generateParagraphsXml(section.paragraphs, injectedXmls);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hs:sec ${NAMESPACES}>
  ${paragraphsXml}
</hs:sec>`;
}

function generateSecPr(section: HWPSection): string {
    const masterPageCnt = getMasterPageCount(section.masterPages);

    if (!section.pageDef) {
        // Default (A4 Portrait)
        return `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="${masterPageCnt}"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`;
    }

    const pd: PageDef = section.pageDef;

    // 원본 HWP 파일의 페이지 크기를 그대로 사용
    const pageWidth = pd.width;
    const pageHeight = pd.height;

    // Extended page settings with defaults
    const textDirection = pd.textDirection || 'HORIZONTAL';
    const lineGrid = pd.lineGrid ?? 0;
    const charGrid = pd.charGrid ?? 0;
    const tabStop = pd.tabStop ?? 8000;
    const gutterType = pd.gutterType || 'LEFT_ONLY';
    const pageStartsOn = pd.pageStartsOn || 'BOTH';
    const pageStartNumber = pd.pageStartNumber ?? 0;

    // Landscape value from PageDef
    let landscapeValue = pd.landscape ? 'WIDELY' : 'NARROWLY';

    // 테이블 너비 확인 (섹션에 테이블이 있는 경우)
    if (section.paragraphs) {
        for (const para of section.paragraphs) {
            if (para.controls) {
                for (const ctrl of para.controls) {
                    if (ctrl.type === 'TABLE') {
                        // 테이블이 있으면 가로 방향 사용
                        landscapeValue = 'WIDELY';
                    }
                }
            }
        }
    }

    // Column Definitions - using ForColumn module
    let colPrContent = columnDefToXml({ columnCount: 1, sameWidth: true, gap: 0 });
    if (section.columnDefs && section.columnDefs.length > 0) {
        const cd = section.columnDefs[0] as ExtendedColumnDef;
        colPrContent = columnDefToXml(cd);
    }

    const borderFillID = section.pageBorderFillID || 1;

    return `<hp:secPr id="" textDirection="${textDirection}" spaceColumns="1134" tabStop="${tabStop}" tabStopVal="${Math.floor(tabStop / 2)}" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="${masterPageCnt}">
      <hp:grid lineGrid="${lineGrid}" charGrid="${charGrid}" wonggojiFormat="0"/>
      <hp:startNum pageStartsOn="${pageStartsOn}" page="${pageStartNumber}" pic="0" tbl="0" equation="0"/>
      <hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>
      <hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>
      <hp:pagePr landscape="${landscapeValue}" width="${pageWidth}" height="${pageHeight}" gutterType="${gutterType}">
        <hp:margin header="${pd.headerMargin}" footer="${pd.footerMargin}" gutter="${pd.gutterMargin}" left="${pd.leftMargin}" right="${pd.rightMargin}" top="${pd.topMargin}" bottom="${pd.bottomMargin}"/>
      </hp:pagePr>
      <hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>
      <hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="0" type="NONE" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>
      <hp:pageBorderFill type="BOTH" borderFillIDRef="${borderFillID}" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>
      <hp:pageBorderFill type="EVEN" borderFillIDRef="${borderFillID}" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>
      <hp:pageBorderFill type="ODD" borderFillIDRef="${borderFillID}" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>
    </hp:secPr>
    ${colPrContent}`;
}

function headerFooterToXml(hf: HeaderFooter): string {
    const hfTableXmls = hf.tables ? hf.tables.map((t: HWPTable) => tableToXml(t as Table)) : [];
    const hfPictureXmls = hf.pictures ? hf.pictures.map((p: HWPPicture) => pictureToXml(p)) : [];

    const hfContent = generateParagraphsXml(hf.paragraphs, [...hfTableXmls, ...hfPictureXmls]);

    const isHeader = hf.type === 'HEADER';
    const tag = isHeader ? 'hp:header' : 'hp:footer';
    const applyPageMap = ['BOTH', 'EVEN', 'ODD'];
    const applyPage = applyPageMap[hf.applyPage] || 'BOTH';
    const id = generateHeaderFooterId();

    return `<hp:ctrl><${tag} id="${id}" applyPage="${applyPage}" type=""><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${hfContent}</hp:subList></${tag}></hp:ctrl>`;
}
