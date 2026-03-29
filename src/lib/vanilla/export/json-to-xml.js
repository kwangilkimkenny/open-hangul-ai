/**
 * JSON → XML 변환기 (브라우저용)
 *
 * HWPX 문서의 JSON 구조를 XML 문자열로 변환합니다.
 *
 * @module export/json-to-xml
 * @version 1.1.0 - linebreak run 타입 지원 추가
 * @author HWPX Viewer Team
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('JsonToXmlConverter');

/**
 * JSON 데이터를 XML 문자열로 변환하는 클래스
 */
export class JsonToXmlConverter {
  constructor() {
    this.namespaces = {
      'hp': 'http://www.hancom.co.kr/hwpml/2011/hwpml',
      'hc': 'http://www.hancom.co.kr/hwpml/2011/hwpml'
    };
  }

  /**
   * XML 이스케이프 처리
   * @param {string} text - 이스케이프할 텍스트
   * @returns {string} 이스케이프된 텍스트
   */
  escapeXml(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * version.xml 생성
   * @param {Object} versionData - 버전 정보
   * @returns {string} version.xml 내용
   */
  generateVersionXml(versionData = {}) {
    const major = versionData.major || '5';
    const minor = versionData.minor || '1';
    const micro = versionData.micro || '1';
    const build = versionData.build || '0';
    const application = versionData.application || 'OpenHangul AI';
    const appVersion = versionData.appVersion || '3.0.0';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version"
               tagetApplication="WORDPROCESSOR"
               major="${major}" minor="${minor}" micro="${micro}" buildNumber="${build}"
               os="1" xmlVersion="1.5"
               application="${this.escapeXml(application)}"
               appVersion="${this.escapeXml(appVersion)}"/>`;
  }

  /**
   * settings.xml 생성
   * @param {Object} settingsData - 설정 정보
   * @returns {string} settings.xml 내용
   */
  generateSettingsXml(settingsData = {}) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"
                          xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">
  <ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>
</ha:HWPApplicationSetting>`;
  }

  /**
   * Contents/header.xml 생성
   * @param {Object} headerData - 헤더 정보
   * @returns {string} header.xml 내용
   */
  generateHeaderXml(headerData = {}) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"
         xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"
         xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">
  <hh:beginNum page="1" footnote="1" endnote="1"/>
  <hh:refList>
    <hh:fontfaces>
      <hh:fontface lang="HANGUL">
        <hh:font id="0" face="함초롬돋움" type="TTF"/>
      </hh:fontface>
      <hh:fontface lang="LATIN">
        <hh:font id="0" face="함초롬돋움" type="TTF"/>
      </hh:fontface>
      <hh:fontface lang="HANJA">
        <hh:font id="0" face="함초롬돋움" type="TTF"/>
      </hh:fontface>
    </hh:fontfaces>
    <hh:charProperties>
      <hh:charPr id="0" height="1000" color="0">
        <hh:fontRef hangul="0" latin="0" hanja="0"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:paraProperties>
      <hh:paraPr id="0" align="JUSTIFY">
        <hh:margin left="0" right="0" indent="0"/>
        <hh:lineSpacing type="PERCENT" value="160"/>
      </hh:paraPr>
    </hh:paraProperties>
  </hh:refList>
</hh:head>`;
  }

  /**
   * Contents/section0.xml 생성
   * @param {Object} sectionData - 섹션 정보
   * @returns {string} section0.xml 내용
   */
  generateSectionXml(sectionData) {
    const pageSettings = sectionData.pageSettings || {};
    // px → HWPX 단위: 5000 미만이면 px, 그 이상이면 HWPX 단위
    const toHwp = (v) => { const n = parseInt(v); return !n ? 0 : n < 5000 ? Math.round(n * 75) : n; };
    const width = toHwp(pageSettings.width) || 59528;
    const height = toHwp(pageSettings.height) || 84188;
    const marginLeft = toHwp(pageSettings.marginLeft) || 6354;
    const marginRight = toHwp(pageSettings.marginRight) || 6354;
    const marginTop = toHwp(pageSettings.marginTop) || 5314;
    const marginBottom = toHwp(pageSettings.marginBottom) || 4252;

    let bodyXml = '';

    // 섹션의 요소들 순회
    const elements = sectionData.elements || [];
    for (const element of elements) {
      if (element.type === 'paragraph') {
        bodyXml += this._generateParagraphXml(element);
      } else if (element.type === 'table') {
        bodyXml += this._generateTableXml(element);
      }
    }

    // 빈 단락이라도 하나는 포함
    if (!bodyXml) {
      bodyXml = `
    <hp:p paraPrIDRef="0" styleIDRef="0">
      <hp:run charPrIDRef="0">
        <hp:t xml:space="preserve"></hp:t>
      </hp:run>
    </hp:p>`;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page"><hp:p paraPrIDRef="0" styleIDRef="0"><hp:run><hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="${width}" height="${height}" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="${marginLeft}" right="${marginRight}" top="${marginTop}" bottom="${marginBottom}"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr></hp:run></hp:p>${bodyXml}</hs:sec>`;
  }

  /**
   * 문단 XML 생성
   * ✅ v1.1.0: linebreak run 타입 지원
   * @param {Object} paragraph - 문단 객체
   * @returns {string} 문단 XML
   */
  _generateParagraphXml(paragraph) {
    const paraShapeId = paragraph.paraShapeId || 0;
    const styleId = paragraph.styleId || 0;

    let runXml = '';

    // 텍스트 런 생성
    const runs = paragraph.runs || [];
    if (runs.length === 0 && paragraph.text) {
      runXml = `
      <hp:run charPrIDRef="0">
        <hp:t xml:space="preserve">${this.escapeXml(paragraph.text)}</hp:t>
      </hp:run>`;
    } else {
      runs.forEach(run => {
        const charShapeId = run.charShapeId || 0;

        if (run.type === 'linebreak') {
          runXml += `
      <hp:run charPrIDRef="${charShapeId}">
        <hp:t xml:space="preserve">
</hp:t>
      </hp:run>`;
        } else {
          runXml += `
      <hp:run charPrIDRef="${charShapeId}">
        <hp:t xml:space="preserve">${this.escapeXml(run.text || '')}</hp:t>
      </hp:run>`;
        }
      });
    }

    if (!runXml) {
      runXml = `
      <hp:run charPrIDRef="0">
        <hp:t xml:space="preserve"></hp:t>
      </hp:run>`;
    }

    return `
    <hp:p paraPrIDRef="${paraShapeId}" styleIDRef="${styleId}">${runXml}
    </hp:p>`;
  }

  /**
   * 테이블 XML 생성
   * @param {Object} table - 테이블 객체
   * @returns {string} 테이블 XML
   */
  _generateTableXml(table) {
    const rows = table.rows || [];
    const cols = table.cols || (rows[0]?.cells?.length || 1);
    const colWidth = Math.floor(42000 / cols);

    // 열 정의
    let gridColXml = '';
    for (let i = 0; i < cols; i++) {
      gridColXml += `
        <hp:gridCol width="${colWidth}"/>`;
    }

    // 행 생성
    let rowXml = '';
    rows.forEach((row) => {
      let cellXml = '';
      const cells = row.cells || [];
      cells.forEach((cell) => {
        let cellContent = '';
        const cellElements = cell.elements || [];
        if (cellElements.length === 0 && cell.text) {
          cellContent = `
              <hp:p paraPrIDRef="0" styleIDRef="0">
                <hp:run charPrIDRef="0">
                  <hp:t xml:space="preserve">${this.escapeXml(cell.text)}</hp:t>
                </hp:run>
              </hp:p>`;
        } else {
          cellElements.forEach(element => {
            if (element.type === 'paragraph') {
              cellContent += this._generateParagraphXml(element);
            }
          });
        }
        if (!cellContent) {
          cellContent = `
              <hp:p paraPrIDRef="0" styleIDRef="0">
                <hp:run charPrIDRef="0">
                  <hp:t xml:space="preserve"></hp:t>
                </hp:run>
              </hp:p>`;
        }
        cellXml += `
          <hp:tc>
            <hp:subList>${cellContent}
            </hp:subList>
          </hp:tc>`;
      });
      rowXml += `
        <hp:tr>${cellXml}
        </hp:tr>`;
    });

    return `
    <hp:p paraPrIDRef="0" styleIDRef="0">
      <hp:run>
        <hp:ctrl>
          <hp:tbl colCnt="${cols}" rowCnt="${rows.length}">
            <hp:gridColList>${gridColXml}
            </hp:gridColList>${rowXml}
          </hp:tbl>
        </hp:ctrl>
      </hp:run>
    </hp:p>`;
  }
}

export default JsonToXmlConverter;

