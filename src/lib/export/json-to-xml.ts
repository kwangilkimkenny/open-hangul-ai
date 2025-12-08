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
   * Contents/header.xml 생성 (실제 HWPX 표준)
   */
  generateHeaderXml(_headerData: HeaderData = {}): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"><hh:mappingTable><hp:fontface id="0" lang="1042" name="맑은 고딕"><hp:font face="맑은 고딕"/></hp:fontface><hp:paraPr id="0"><hp:align horizontal="LEFT" vertical="TOP"/><hp:heading level="0" type="NONE"/><hp:lineSpacing method="RATIO" value="160" unit="PERCENT"/><hp:breakLatinWord value="KEEP_WORD"/><hp:breakNonLatinWord value="NORMAL"/><hp:autoLineBreak value="1"/></hp:paraPr><hp:charPr id="0"><hp:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hp:fontRatio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hp:fontSpacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hp:fontHeight hangul="1000" latin="1000" hanja="1000" japanese="1000" other="1000" symbol="1000" user="1000"/><hp:textColor value="0"/><hp:underlineColor value="0"/><hp:shadeColor value="16777215"/></hp:charPr><hh:style id="0" name="바탕글" type="PARA" nextStyle="0" langId="1042"><hp:paraPr id="0"/><hp:charPr id="0"/></hh:style></hh:mappingTable></hh:head>`;
  }

  /**
   * Contents/section0.xml 생성 (실제 HWPX 표준)
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

    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec ${xmlns}>`;

    // 섹션의 요소들 순회
    const elements = sectionData.elements || [];
    for (const element of elements) {
      if (element.type === 'paragraph') {
        xml += this.generateParagraphXml(element as HWPXParagraph);
      } else if (element.type === 'table') {
        xml += this.generateTableXml(element as HWPXTable);
      }
    }

    xml += `</hs:sec>`;
    return xml;
  }

  /**
   * 문단 XML 생성 (실제 HWPX 표준)
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

    xml += `</hp:p>`;
    return xml;
  }

  /**
   * 테이블 XML 생성 (실제 HWPX 표준)
   */
  generateTableXml(table: HWPXTable): string {
    const rows = table.rows || [];
    const colCount = rows[0]?.cells?.length || 1;
    const rowCount = rows.length;

    // 테이블 폭 계산
    const tableWidth = 42520; // A4 기준
    const colWidth = Math.floor(tableWidth / colCount);

    let xml = `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`;
    xml += `<hp:run charPrIDRef="0">`;
    xml += `<hp:ctrl>`;
    xml += `<hp:tbl id="0" treatAsChar="0" vertAlign="TOP" horAlign="LEFT" vertOffset="0" horOffset="0" widthRelTo="PAPER" heightRelTo="PAPER" zOrder="0" allowOverlap="1" textWrap="NONE" textFlow="HORIZONTAL" instId="${Date.now()}">`;
    
    // 테이블 크기
    xml += `<hp:sz width="${tableWidth}" height="0" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE"/>`;
    xml += `<hp:inside marLeft="100" marRight="100" marTop="100" marBottom="100"/>`;
    
    // 테이블 속성
    xml += `<hp:tblPr>`;
    xml += `<hp:sz rowCnt="${rowCount}" colCnt="${colCount}">`;
    
    // 열 정의
    for (let i = 0; i < colCount; i++) {
      xml += `<hp:colSz width="${colWidth}"/>`;
    }
    
    xml += `</hp:sz>`;
    xml += `</hp:tblPr>`;

    // 행 생성
    rows.forEach((row: HWPXTableRow, _rowIdx: number) => {
      xml += `<hp:tr>`;

      const cells = row.cells || [];
      cells.forEach((cell: HWPXTableCell, _cellIdx: number) => {
        const colSpan = cell.colSpan || 1;
        const rowSpan = cell.rowSpan || 1;

        xml += `<hp:tc colSpan="${colSpan}" rowSpan="${rowSpan}">`;
        xml += `<hp:tcPr>`;
        xml += `<hp:cellSz width="${colWidth * colSpan}" height="1000"/>`;
        xml += `<hp:cellMargin left="100" right="100" top="100" bottom="100"/>`;
        xml += `<hp:borderFill id="1" threeD="0" shadow="0">`;
        xml += `<hp:left type="SOLID" width="12" color="0"/>`;
        xml += `<hp:right type="SOLID" width="12" color="0"/>`;
        xml += `<hp:top type="SOLID" width="12" color="0"/>`;
        xml += `<hp:bottom type="SOLID" width="12" color="0"/>`;
        xml += `</hp:borderFill>`;
        xml += `</hp:tcPr>`;

        // 셀 내용 (문단들)
        const cellElements = cell.elements || [];
        if (cellElements.length === 0 && (cell as any).text) {
          // 단순 텍스트
          const text = (cell as any).text;
          xml += `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`;
          xml += `<hp:run charPrIDRef="0">`;
          xml += `<hp:t xml:space="preserve">${this.escapeXml(text)}</hp:t>`;
          xml += `</hp:run>`;
          xml += `</hp:p>`;
        } else if (cellElements.length === 0) {
          // 빈 셀
          xml += `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`;
          xml += `<hp:run charPrIDRef="0">`;
          xml += `<hp:t xml:space="preserve"></hp:t>`;
          xml += `</hp:run>`;
          xml += `</hp:p>`;
        } else {
          // 복잡한 셀 내용
          cellElements.forEach((element: HWPXElement) => {
            if (element.type === 'paragraph') {
              xml += this.generateParagraphXml(element as HWPXParagraph);
            }
          });
        }

        xml += `</hp:tc>`;
      });

      xml += `</hp:tr>`;
    });

    xml += `</hp:tbl>`;
    xml += `</hp:ctrl>`;
    xml += `</hp:run>`;
    xml += `</hp:p>`;

    return xml;
  }
}

export default JsonToXmlConverter;
