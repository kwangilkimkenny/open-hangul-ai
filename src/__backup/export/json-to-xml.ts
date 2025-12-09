/**
 * JSON → XML 변환기 (실제 HWPX 표준 준수)
 * 
 * 원본 HWPX 파일 분석 결과 기반:
 * - <hs:sec> (section)
 * - <hp:p> (paragraph)
 * - <hp:run> (run)
 * - <hp:t> (text)
 * - <hp:tbl> (table)
 * - <hp:tr> (table row)
 * - <hp:tc> (table cell)
 * 
 * @module lib/export/json-to-xml
 * @version 4.0.0
 */

import type { 
  HWPXSection, 
  HWPXElement,
  HWPXParagraph,
  HWPXTable,
  HWPXTableRow,
  HWPXTableCell,
  HWPXRun
} from '../../types/hwpx';

/**
 * 버전 정보 인터페이스
 */
interface VersionData {
  version?: string;
  major?: string;
  minor?: string;
  micro?: string;
  build?: string;
  application?: string;
}

/**
 * 설정 정보 인터페이스
 */
interface SettingsData {
  fontFaces?: Array<{ name: string }>;
}

/**
 * 헤더 정보 인터페이스
 */
interface HeaderData {
  fontFaces?: Array<{ name: string }>;
  borderFills?: Array<{ backgroundColor?: string }>;
  paraProps?: Array<{ align?: string }>;
  charProps?: Array<{ 
    fontRef?: number;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
  }>;
}

/**
 * JSON 데이터를 실제 HWPX 표준 XML 문자열로 변환하는 클래스
 */
export class JsonToXmlConverter {
  /**
   * XML 이스케이프 처리
   */
  escapeXml(text: string | unknown): string {
    if (typeof text !== 'string') {
      text = String(text ?? '');
    }
    
    return (text as string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * version.xml 생성 (실제 HWPX 표준)
   */
  generateVersionXml(versionData: VersionData = {}): string {
    const version = versionData.version || '2.8';
    const major = versionData.major || '2';
    const minor = versionData.minor || '8';
    const micro = versionData.micro || '0';
    const build = versionData.build || '0';
    const application = versionData.application || 'WORDPROCESSOR';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="${application}" version="${version}" major="${major}" minor="${minor}" micro="${micro}" build="${build}" versionName=""/>`;
  }

  /**
   * settings.xml 생성 (실제 HWPX 표준)
   */
  generateSettingsXml(_settingsData: SettingsData = {}): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hwpml:hwpml xmlns:hwpml="http://www.hancom.co.kr/hwpml/2011/hwpml"><hwpml:docInfo><hwpml:documentProperties itemCnt="0"/></hwpml:docInfo></hwpml:hwpml>`;
  }

  /**
   * Contents/header.xml 생성 (참조 템플릿 기반)
   */
  generateHeaderXml(_headerData: HeaderData = {}): string {
    // 참조 HWPX 파일을 기반으로 한 간소화 버전
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">
<hh:mappingTable>
<hh:fontfaces itemCnt="1">
<hh:fontface lang="HANGUL" fontCnt="1"><hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0"/></hh:fontface>
<hh:fontface lang="LATIN" fontCnt="1"><hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0"/></hh:fontface>
<hh:fontface lang="HANJA" fontCnt="1"><hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0"/></hh:fontface>
<hh:fontface lang="JAPANESE" fontCnt="1"><hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0"/></hh:fontface>
<hh:fontface lang="OTHER" fontCnt="1"><hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0"/></hh:fontface>
<hh:fontface lang="SYMBOL" fontCnt="1"><hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0"/></hh:fontface>
<hh:fontface lang="USER" fontCnt="1"><hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0"/></hh:fontface>
</hh:fontfaces>
<hh:borderFills itemCnt="1">
<hh:borderFill id="0">
<hh:slash type="None" color="#000000" width="0.1mm"/>
<hh:backSlash type="None" color="#000000" width="0.1mm"/>
<hh:leftBorder type="Solid" color="#000000" width="0.1mm"/>
<hh:rightBorder type="Solid" color="#000000" width="0.1mm"/>
<hh:topBorder type="Solid" color="#000000" width="0.1mm"/>
<hh:bottomBorder type="Solid" color="#000000" width="0.1mm"/>
<hh:diagonal type="NONE" color="#000000" width="0.1mm"/>
</hh:borderFill>
</hh:borderFills>
<hh:charProperties itemCnt="1">
<hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
<hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
<hh:underline type="NONE" shape="SOLID" color="#000000"/>
<hh:strikeout shape="NONE" color="none"/>
<hh:outline type="NONE"/>
<hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>
</hh:charPr>
</hh:charProperties>
<hh:paraProperties itemCnt="1">
<hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
<hh:align horizontal="JUSTIFY" vertical="BASELINE"/>
<hh:heading type="NONE" idRef="0" level="0"/>
<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
<hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin>
<hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>
<hh:border borderFillIDRef="0" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
</hh:paraPr>
</hh:paraProperties>
<hh:styles itemCnt="1">
<hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/>
</hh:styles>
</hh:mappingTable>
<hh:compatibleDocument targetProgram="HWP2016"><hh:layoutCompatibility/></hh:compatibleDocument>
<hh:docOption><hh:linkinfo path="" pageInherit="1" footnoteInherit="0"/></hh:docOption>
<hh:trackchageConfig flags="0"/>
</hh:head>`;
  }

  /**
   * Contents/section0.xml 생성 (참조 기반 표준 구조)
   */
  generateSectionXml(sectionData: HWPXSection): string {
    const xmlns = [
      'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"',
      'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"',
      'xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph"',
      'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"',
      'xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"',
      'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"',
      'xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history"',
      'xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page"',
      'xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"',
      'xmlns:dc="http://purl.org/dc/elements/1.1/"',
      'xmlns:opf="http://www.idpf.org/2007/opf/"',
      'xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart"',
      'xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar"',
      'xmlns:epub="http://www.idpf.org/2007/ops"',
      'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"'
    ].join(' ');

    // HWPX 표준: 첫 번째 문단에 섹션 속성 포함 (필수!)
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec ${xmlns}>`;
    
    xml += `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`;
    xml += `<hp:run charPrIDRef="0">`;
    
    // 섹션 속성 (페이지 설정 등)
    xml += `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1135" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">`;
    xml += `<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>`;
    xml += `<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>`;
    xml += `<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>`;
    xml += `<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>`;
    xml += `<hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY">`;
    xml += `<hp:margin header="0" footer="0" gutter="0" left="5670" right="5670" top="4250" bottom="4250"/>`;
    xml += `</hp:pagePr>`;
    xml += `<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="285" belowLine="565" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>`;
    xml += `<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="565" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>`;
    xml += `</hp:secPr>`;
    
    // 컬럼 속성
    xml += `<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`;
    xml += `</hp:run>`;

    xml += `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48188" flags="393216"/></hp:linesegarray>`;
    xml += `</hp:p>`;

    // 섹션의 실제 요소들 (각각 별도의 hp:p)
    const elements = sectionData.elements || [];
    for (const element of elements) {
      if (element.type === 'table') {
        xml += `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`;
        xml += `<hp:run charPrIDRef="0">`;
        xml += this.generateTableXml(element as HWPXTable);
        xml += `<hp:t/>`;
        xml += `</hp:run>`;
        xml += `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48188" flags="393216"/></hp:linesegarray>`;
        xml += `</hp:p>`;
      } else if (element.type === 'paragraph') {
        xml += this.generateParagraphXml(element as HWPXParagraph);
      }
    }

    xml += `</hs:sec>`;
    return xml;
  }

  /**
   * 문단 XML 생성 (참조 기반 표준 구조)
   */
  generateParagraphXml(paragraph: HWPXParagraph): string {
    const paraPrIDRef = (paragraph as any).paraShapeId || 0;
    const styleIDRef = (paragraph as any).styleIdRef || 0;

    let xml = `<hp:p id="0" paraPrIDRef="${paraPrIDRef}" styleIDRef="${styleIDRef}" pageBreak="0" columnBreak="0" merged="0">`;

    // 텍스트 런 생성
    const runs = paragraph.runs || [];
    if (runs.length === 0) {
      // 빈 문단
      xml += `<hp:run charPrIDRef="0"><hp:t xml:space="preserve"></hp:t></hp:run>`;
    } else {
      runs.forEach((run: HWPXRun) => {
        const charPrIDRef = (run as any).charShapeId || 0;
        const text = run.text || '';
        
        xml += `<hp:run charPrIDRef="${charPrIDRef}">`;
        xml += `<hp:t xml:space="preserve">${this.escapeXml(text)}</hp:t>`;
        xml += `</hp:run>`;
      });
    }

    // linesegarray 추가 (HWPX 필수 요소)
    xml += `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48188" flags="393216"/></hp:linesegarray>`;
    xml += `</hp:p>`;
    return xml;
  }

  /**
   * 테이블 XML 생성 (참조 기반 표준 구조)
   */
  generateTableXml(table: HWPXTable): string {
    const rows = table.rows || [];
    const colCount = rows[0]?.cells?.length || 1;
    const rowCount = rows.length;

    // 테이블 폭 계산 (참조 파일 기준)
    const tableWidth = 48025;
    const colWidth = Math.floor(tableWidth / colCount);

    let xml = `<hp:tbl id="${Date.now()}" zOrder="1" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="${rowCount}" colCnt="${colCount}" cellSpacing="0" borderFillIDRef="0" noAdjust="1">`;
    xml += `<hp:sz width="${tableWidth}" widthRelTo="ABSOLUTE" height="0" heightRelTo="ABSOLUTE" protect="0"/>`;
    xml += `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="0" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>`;
    xml += `<hp:outMargin left="285" right="285" top="285" bottom="285"/>`;
    xml += `<hp:inMargin left="140" right="140" top="140" bottom="140"/>`;

    // 행 생성
    rows.forEach((row: HWPXTableRow, rowIdx: number) => {
      xml += `<hp:tr>`;

      const cells = row.cells || [];
      cells.forEach((cell: HWPXTableCell, cellIdx: number) => {
        const colSpan = cell.colSpan || 1;
        const rowSpan = cell.rowSpan || 1;
        const cellWidth = colWidth * colSpan;

        xml += `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="0">`;
        
        // subList (셀 내용 컨테이너)
        xml += `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">`;

        // 셀 내 문단들
        const cellElements = cell.elements || [];
        if (cellElements.length === 0 && (cell as any).text) {
          // 단순 텍스트
          const text = (cell as any).text;
          xml += `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`;
          xml += `<hp:run charPrIDRef="0">`;
          xml += `<hp:t xml:space="preserve">${this.escapeXml(text)}</hp:t>`;
          xml += `</hp:run>`;
          xml += `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="${cellWidth - 280}" flags="393216"/></hp:linesegarray>`;
          xml += `</hp:p>`;
        } else if (cellElements.length === 0) {
          // 빈 셀
          xml += `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`;
          xml += `<hp:run charPrIDRef="0"/>`;
          xml += `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="${cellWidth - 280}" flags="393216"/></hp:linesegarray>`;
          xml += `</hp:p>`;
        } else {
          // 복잡한 셀 내용
          cellElements.forEach((element: HWPXElement) => {
            if (element.type === 'paragraph') {
              const para = element as HWPXParagraph;
              const runs = para.runs || [];
              
              xml += `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`;
              
              if (runs.length === 0) {
                xml += `<hp:run charPrIDRef="0"/>`;
              } else {
                runs.forEach((run: HWPXRun) => {
                  xml += `<hp:run charPrIDRef="0">`;
                  xml += `<hp:t xml:space="preserve">${this.escapeXml(run.text || '')}</hp:t>`;
                  xml += `</hp:run>`;
                });
              }
              
              xml += `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="${cellWidth - 280}" flags="393216"/></hp:linesegarray>`;
              xml += `</hp:p>`;
            }
          });
        }

        xml += `</hp:subList>`;
        
        // 셀 속성들 (참조 파일 순서대로)
        xml += `<hp:cellAddr colAddr="${cellIdx}" rowAddr="${rowIdx}"/>`;
        xml += `<hp:cellSpan colSpan="${colSpan}" rowSpan="${rowSpan}"/>`;
        xml += `<hp:cellSz width="${cellWidth}" height="1000"/>`;
        xml += `<hp:cellMargin left="0" right="0" top="0" bottom="0"/>`;
        
        xml += `</hp:tc>`;
      });

      xml += `</hp:tr>`;
    });

    xml += `</hp:tbl>`;
    return xml;
  }
}

export default JsonToXmlConverter;
