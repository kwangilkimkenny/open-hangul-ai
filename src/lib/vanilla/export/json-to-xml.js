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
    const width = parseInt(pageSettings.width) || 59528;
    const height = parseInt(pageSettings.height) || 84188;
    const marginLeft = parseInt(pageSettings.marginLeft) || 6354;
    const marginRight = parseInt(pageSettings.marginRight) || 6354;
    const marginTop = parseInt(pageSettings.marginTop) || 5314;
    const marginBottom = parseInt(pageSettings.marginBottom) || 4252;

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

    return `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head">
  <hp:p paraPrIDRef="0" styleIDRef="0">
    <hp:run>
      <hp:secPr>
        <hp:pageSize width="${width}" height="${height}"/>
        <hp:pageMar top="${marginTop}" bottom="${marginBottom}" left="${marginLeft}" right="${marginRight}" header="4252" footer="4252"/>
      </hp:secPr>
    </hp:run>
  </hp:p>${bodyXml}
</hs:sec>`;
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

