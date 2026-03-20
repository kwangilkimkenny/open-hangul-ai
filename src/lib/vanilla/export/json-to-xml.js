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
    // v2.8 (최신) -> v1.0 (호환성)
    // Hancom 2018 등 하위 버전 호환성을 위해 1.0으로 조정
    const version = versionData.version || '1.0';
    const major = versionData.major || '1';
    const minor = versionData.minor || '0';
    const micro = versionData.micro || '0';
    const build = versionData.build || '0';
    const application = versionData.application || 'HWPX-Viewer-AI';

    return `<?xml version="1.0" encoding="UTF-8"?>
<version xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml" 
         version="${version}" 
         major="${major}" 
         minor="${minor}" 
         micro="${micro}" 
         build="${build}" 
         application="${application}"/>`;
  }

  /**
   * settings.xml 생성
   * @param {Object} settingsData - 설정 정보
   * @returns {string} settings.xml 내용
   */
  generateSettingsXml(settingsData = {}) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<HWPML xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml">
  <MAPPINGTABLE>`;

    // 폰트 매핑
    if (settingsData.fontFaces) {
      settingsData.fontFaces.forEach((font, idx) => {
        xml += `
    <FONTFACE Id="${idx}" Lang="1042" Count="7" FontFaces="${this.escapeXml(font.name || '맑은 고딕')}"/>`;
      });
    } else {
      // 기본 폰트
      xml += `
    <FONTFACE Id="0" Lang="1042" Count="7" FontFaces="맑은 고딕"/>`;
    }

    xml += `
  </MAPPINGTABLE>
</HWPML>`;

    return xml;
  }

  /**
   * Contents/header.xml 생성
   * @param {Object} headerData - 헤더 정보
   * @returns {string} header.xml 내용
   */
  generateHeaderXml(headerData = {}) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<HWPML xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml">
  <HEAD>
    <MAPPINGTABLE>`;

    // 폰트 매핑
    const fontFaces = headerData.fontFaces || [{ name: '맑은 고딕' }];
    fontFaces.forEach((font, idx) => {
      xml += `
      <FONTFACE Id="${idx}" Lang="1042" Count="7" FontFaces="${this.escapeXml(font.name || '맑은 고딕')}"/>`;
    });

    // 테두리 채우기
    const borderFills = headerData.borderFills || [];
    borderFills.forEach((fill, idx) => {
      xml += `
      <BORDERFILL Id="${idx}">`;

      if (fill.backgroundColor) {
        xml += `
        <FILLBRUSH BackColor="${fill.backgroundColor}"/>`;
      }

      xml += `
      </BORDERFILL>`;
    });

    // 문단 속성
    const paraProps = headerData.paraProps || [];
    paraProps.forEach((prop, idx) => {
      xml += `
      <PARASHAPE Id="${idx}">
        <ALIGN HorizontalAlign="${prop.align || 'Left'}" VerticalAlign="Top"/>
        <HEADING Level="0" Type="None"/>
        <BREAKLATINWORD BreakLatinWord="KeepWord"/>
        <BREAKNONLATINWORD BreakNonLatinWord="Normal"/>
        <CONDENSE Condense="0"/>
        <FONTLINEHEIGHT FontLineHeight="0"/>
        <SNAPTOTEXT SnapToText="0"/>
        <SUPPRESSLINENUMBERS SuppressLineNumbers="0"/>
        <TEXTALIGN TextAlign="Left"/>
        <WIDOWORPHAN WidowOrphan="0"/>
        <AUTOSPACEEEASIANENG AutoSpaceEAsianEng="0"/>
        <AUTOSPACEEASIANNUM AutoSpaceEAsianNum="0"/>
      </PARASHAPE>`;
    });

    // 문자 속성
    const charProps = headerData.charProps || [];
    charProps.forEach((prop, idx) => {
      const fontRef = prop.fontRef || 0;
      const fontSize = prop.fontSize || 1000;
      const bold = prop.bold ? 1 : 0;
      const italic = prop.italic ? 1 : 0;

      xml += `
      <CHARSHAPE Id="${idx}">
        <FONTID Hangul="${fontRef}" Latin="${fontRef}" Hanja="${fontRef}" Japanese="${fontRef}" Other="${fontRef}" Symbol="${fontRef}" User="${fontRef}"/>
        <RATIO Hangul="100" Latin="100" Hanja="100" Japanese="100" Other="100" Symbol="100" User="100"/>
        <CHARSPACING Hangul="0" Latin="0" Hanja="0" Japanese="0" Other="0" Symbol="0" User="0"/>
        <RELATIVESZ Hangul="100" Latin="100" Hanja="100" Japanese="100" Other="100" Symbol="100" User="100"/>
        <CHAROFFSET Hangul="0" Latin="0" Hanja="0" Japanese="0" Other="0" Symbol="0" User="0"/>
        <HEIGHT Hangul="${fontSize}" Latin="${fontSize}" Hanja="${fontSize}" Japanese="${fontSize}" Other="${fontSize}" Symbol="${fontSize}" User="${fontSize}"/>
        <TEXTCOLOR Red="0" Green="0" Blue="0"/>
        <UNDERLINECOLOR Red="0" Green="0" Blue="0"/>
        <SHADECOLOR Red="255" Green="255" Blue="255"/>
        <SHADOWCOLOR Red="128" Green="128" Blue="128"/>
        <FONTTYPE Hangul="TTF" Latin="TTF" Hanja="TTF" Japanese="TTF" Other="TTF" Symbol="TTF" User="TTF"/>
        <FONTTYPE Hangul="${bold}" Latin="${bold}" Hanja="${bold}" Japanese="${bold}" Other="${bold}" Symbol="${bold}" User="${bold}"/>
        <ITALIC Hangul="${italic}" Latin="${italic}" Hanja="${italic}" Japanese="${italic}" Other="${italic}" Symbol="${italic}" User="${italic}"/>
      </CHARSHAPE>`;
    });

    xml += `
    </MAPPINGTABLE>
  </HEAD>
</HWPML>`;

    return xml;
  }

  /**
   * Contents/section0.xml 생성
   * @param {Object} sectionData - 섹션 정보
   * @returns {string} section0.xml 내용
   */
  generateSectionXml(sectionData) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<HWPML xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml">
  <SECTION>`;

    // 섹션의 요소들 순회
    const elements = sectionData.elements || [];
    for (const element of elements) {
      if (element.type === 'paragraph') {
        xml += this._generateParagraphXml(element);
      } else if (element.type === 'table') {
        xml += this._generateTableXml(element);
      }
    }

    xml += `
  </SECTION>
</HWPML>`;

    return xml;
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

    let xml = `
    <P ParaShape="${paraShapeId}" Style="${styleId}">`;

    // 텍스트 런 생성
    const runs = paragraph.runs || [];
    if (runs.length === 0 && paragraph.text) {
      // 단순 텍스트인 경우
      xml += `
      <TEXT CharShape="0">${this.escapeXml(paragraph.text)}</TEXT>`;
    } else {
      // 런이 있는 경우
      runs.forEach(run => {
        const charShapeId = run.charShapeId || 0;

        // ✅ v1.1.0: linebreak 타입 처리
        if (run.type === 'linebreak') {
          xml += `
      <LINEBREAK CharShape="${charShapeId}"/>`;
        } else {
          // 일반 텍스트 런
          xml += `
      <TEXT CharShape="${charShapeId}">${this.escapeXml(run.text || '')}</TEXT>`;
        }
      });
    }

    xml += `
    </P>`;

    return xml;
  }

  /**
   * 테이블 XML 생성
   * @param {Object} table - 테이블 객체
   * @returns {string} 테이블 XML
   */
  _generateTableXml(table) {
    const rows = table.rows || [];
    const cols = table.cols || (rows[0]?.cells?.length || 1);

    let xml = `
    <TABLE>
      <SHAPEOBJECT>
        <TABLE Id="0" TreatAsChar="0" Lock="0" Width="60000" Height="0" ZOrder="0" NumberingType="1" TextWrap="0" TextFlow="0" InstId="${Math.floor(Math.random() * 100000000)}">
          <TABLEFORMAT ColCount="${cols}" RowCount="${rows.length}">`;

    // 열 정의
    for (let i = 0; i < cols; i++) {
      const width = Math.floor(60000 / cols);
      xml += `
            <COLDEF Width="${width}"/>`;
    }

    // 행 생성
    rows.forEach((row, rowIdx) => {
      xml += `
            <ROW>`;

      const cells = row.cells || [];
      cells.forEach((cell, cellIdx) => {
        const colSpan = cell.colSpan || 1;
        const rowSpan = cell.rowSpan || 1;

        xml += `
              <CELL ColAddr="${cellIdx}" RowAddr="${rowIdx}" ColSpan="${colSpan}" RowSpan="${rowSpan}">
                <CELLPROPERTY>
                  <CELLBORDER Left="1" Right="1" Top="1" Bottom="1"/>
                </CELLPROPERTY>
                <SUBLIST>`;

        // 셀 내용 (문단들)
        const cellElements = cell.elements || [];
        if (cellElements.length === 0 && cell.text) {
          // 단순 텍스트인 경우
          xml += `
                  <P ParaShape="0" Style="0">
                    <TEXT CharShape="0">${this.escapeXml(cell.text)}</TEXT>
                  </P>`;
        } else {
          cellElements.forEach(element => {
            if (element.type === 'paragraph') {
              xml += this._generateParagraphXml(element);
            }
          });
        }

        xml += `
                </SUBLIST>
              </CELL>`;
      });

      xml += `
            </ROW>`;
    });

    xml += `
          </TABLEFORMAT>
        </TABLE>
      </SHAPEOBJECT>
    </TABLE>`;

    return xml;
  }
}

export default JsonToXmlConverter;

