#!/usr/bin/env node
/**
 * Golden HWPX Fixture Builder
 * ---------------------------
 * tests/golden/<NN-feature>/ 디렉토리 각각에 합성 fixture.hwpx 를 만든다.
 *
 * HWPX 는 OWPML(XML) + ZIP 구조이므로 한글 한컴 워드프로세서 없이도
 * 합성 가능하다. 이 스크립트가 만드는 파일은 SimpleHWPXParser 가 파싱할
 * 수 있는 최소 유효 OWPML 이며, 정식 한글 뷰어에서 100% 동일하게 표시
 * 되는 것을 보장하지는 않는다 (호환성 테스트 목적이 아니라 라운드트립
 * 회귀 테스트 픽스처).
 *
 * 사용법:
 *   node scripts/build-golden-fixtures.mjs
 *
 * 결과:
 *   tests/golden/01-paragraph/fixture.hwpx
 *   tests/golden/02-table/fixture.hwpx
 *   ... (12 개)
 *
 * 외부 의존성: jszip (이미 dependencies 에 있음)
 */

import JSZip from 'jszip';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const GOLDEN_ROOT = join(ROOT, 'tests', 'golden');

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const HP_NS = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
const HS_NS = 'http://www.hancom.co.kr/hwpml/2011/section';
const HH_NS = 'http://www.hancom.co.kr/hwpml/2011/head';
const HC_NS = 'http://www.hancom.co.kr/hwpml/2011/core';

// ---------------------------------------------------------------------------
// container.xml (META-INF)
// ---------------------------------------------------------------------------
function buildContainerXml() {
  return `${XML_DECL}
<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container">
  <ocf:rootfiles>
    <ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  </ocf:rootfiles>
</ocf:container>`;
}

// ---------------------------------------------------------------------------
// manifest.xml (META-INF)
// ---------------------------------------------------------------------------
function buildManifestXml() {
  return `${XML_DECL}
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/hwpml-package+xml" manifest:full-path="Contents/content.hpf"/>
  <manifest:file-entry manifest:media-type="application/xml" manifest:full-path="Contents/header.xml"/>
  <manifest:file-entry manifest:media-type="application/xml" manifest:full-path="Contents/section0.xml"/>
  <manifest:file-entry manifest:media-type="application/xml" manifest:full-path="version.xml"/>
  <manifest:file-entry manifest:media-type="application/xml" manifest:full-path="settings.xml"/>
</manifest:manifest>`;
}

// ---------------------------------------------------------------------------
// content.hpf (OPF metadata + manifest + spine)
// ---------------------------------------------------------------------------
function buildContentHpf(title) {
  return `${XML_DECL}
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="1.2" unique-identifier="hwpx-001">
  <opf:metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf-meta="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>ko</dc:language>
    <dc:identifier id="hwpx-001">urn:hwpx:fixture:${slugify(title)}</dc:identifier>
    <dc:creator>open-hangul-ai golden fixture builder</dc:creator>
    <opf-meta:meta property="dcterms:modified">2026-01-01T00:00:00Z</opf-meta:meta>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="header" href="header.xml" media-type="application/xml"/>
    <opf:item id="section0" href="section0.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0" linear="yes"/>
  </opf:spine>
</opf:package>`;
}

// ---------------------------------------------------------------------------
// version.xml
// ---------------------------------------------------------------------------
function buildVersionXml() {
  return `${XML_DECL}
<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROC" major="5" minor="0" micro="5" buildNumber="0" os="WIN" xmlVersion="1.4" application="open-hangul-ai" appVersion="5.0.5"/>`;
}

// ---------------------------------------------------------------------------
// settings.xml
// ---------------------------------------------------------------------------
function buildSettingsXml() {
  return `${XML_DECL}
<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app">
  <ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>
  <ha:ViewSetting zoom="100"/>
</ha:HWPApplicationSetting>`;
}

// ---------------------------------------------------------------------------
// header.xml — 글꼴 / 스타일 / numbering / borderFill 정의
// ---------------------------------------------------------------------------
function buildHeaderXml({ withNumbering = false } = {}) {
  const numberingBlock = withNumbering
    ? `
    <hh:numbering id="1">
      <hh:paraHead level="1" start="1" numFormat="Arabic" formatStr="%1." indent="400"/>
      <hh:paraHead level="2" start="1" numFormat="Arabic" formatStr="%1.%2" indent="800"/>
      <hh:paraHead level="3" start="1" numFormat="HangulSyllable" formatStr="%3) " indent="1200"/>
    </hh:numbering>`
    : '';
  return `${XML_DECL}
<hh:head xmlns:hh="${HH_NS}" xmlns:hp="${HP_NS}" xmlns:hc="${HC_NS}" version="1.4">
  <hh:refList>
    <hh:fontfaces>
      <hh:fontface lang="HANGUL">
        <hh:font id="0" type="TTF" name="함초롬바탕"/>
        <hh:font id="1" type="TTF" name="굴림"/>
      </hh:fontface>
      <hh:fontface lang="LATIN">
        <hh:font id="0" type="TTF" name="Times New Roman"/>
      </hh:fontface>
    </hh:fontfaces>
    <hh:borderFills>
      <hh:borderFill id="0" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
        <hh:slash type="NONE" crooked="0" isCounter="0"/>
        <hh:backSlash type="NONE" crooked="0" isCounter="0"/>
        <hh:leftBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:rightBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:topBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:bottomBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:diagonal type="SOLID" width="0.12mm" color="#000000"/>
      </hh:borderFill>
      <hh:borderFill id="1" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
        <hh:slash type="NONE" crooked="0" isCounter="0"/>
        <hh:backSlash type="NONE" crooked="0" isCounter="0"/>
        <hh:leftBorder type="SOLID" width="0.5mm" color="#000000"/>
        <hh:rightBorder type="SOLID" width="0.5mm" color="#000000"/>
        <hh:topBorder type="SOLID" width="0.5mm" color="#000000"/>
        <hh:bottomBorder type="SOLID" width="0.5mm" color="#000000"/>
        <hh:diagonal type="SOLID" width="0.12mm" color="#000000"/>
      </hh:borderFill>
    </hh:borderFills>
    <hh:charProperties>
      <hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:italic/>
        <hh:bold/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout shape="NONE" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/>
      </hh:charPr>
      <hh:charPr id="1" height="1200" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:italic/>
        <hh:bold/>
      </hh:charPr>
      <hh:charPr id="2" height="1200" textColor="#FF0000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
      </hh:charPr>
      <hh:charPr id="3" height="1400" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:fontRef hangul="1" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:paraProperties>
      <hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="1" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="CENTER" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:margin>
          <hc:intro value="0"/>
          <hc:left value="0"/>
          <hc:right value="0"/>
          <hc:top value="0"/>
          <hc:bottom value="0"/>
        </hh:margin>
        <hh:lineSpacing type="PERCENT" value="160"/>
      </hh:paraPr>
      <hh:paraPr id="1" tabPrIDRef="0" condense="0" fontLineHeight="1" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="JUSTIFY" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:margin indent="2000">
          <hc:left value="0"/>
          <hc:right value="0"/>
          <hc:top value="0"/>
          <hc:bottom value="0"/>
        </hh:margin>
        <hh:lineSpacing type="PERCENT" value="200"/>
      </hh:paraPr>
    </hh:paraProperties>
    <hh:styles>
      <hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/>
      <hh:style id="1" type="PARA" name="본문" engName="Body" paraPrIDRef="1" charPrIDRef="0" nextStyleIDRef="1" langID="1042" lockForm="0"/>
    </hh:styles>
    ${numberingBlock}
  </hh:refList>
</hh:head>`;
}

// ---------------------------------------------------------------------------
// section0.xml shell — wraps body XML with required HWPX section root
// ---------------------------------------------------------------------------
function wrapSection(bodyInnerXml, { secPrInnerXml = '' } = {}) {
  // hs:sec is the canonical root; include both hp and hs namespaces so that
  // querySelector with hp:* works.
  const secPr = secPrInnerXml
    ? `<hp:secPr id="0" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0">
      ${secPrInnerXml}
    </hp:secPr>`
    : `<hp:secPr id="0" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0">
      <hp:grid lineGrid="0" charGrid="0"/>
      <hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>
      <hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>
      <hp:lineNumberShape restartType="NONE" countBy="0" distance="0" startNumber="0"/>
      <hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">
        <hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/>
      </hp:pagePr>
      <hp:footNotePr>
        <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
      </hp:footNotePr>
      <hp:endNotePr>
        <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
      </hp:endNotePr>
    </hp:secPr>`;
  return `${XML_DECL}
<hs:sec xmlns:hs="${HS_NS}" xmlns:hp="${HP_NS}" xmlns:hh="${HH_NS}" xmlns:hc="${HC_NS}">
  ${secPr}
  ${bodyInnerXml}
</hs:sec>`;
}

// ---------------------------------------------------------------------------
// Per-scenario section body builders
// Each returns the inner XML to embed inside <hs:sec>...</hs:sec>.
// ---------------------------------------------------------------------------

function bodyParagraph() {
  // 01-paragraph: 3 paragraphs with different alignments / char styles
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="1">
      <hp:t>가운데 정렬 굵게</hp:t>
    </hp:run>
    <hp:linesegarray>
      <hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/>
    </hp:linesegarray>
  </hp:p>
  <hp:p id="2" paraPrIDRef="1" styleIDRef="1" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:t>양쪽 정렬, 첫 줄 들여쓰기 20pt, 줄간격 더블입니다. </hp:t>
      <hp:t>두 번째 줄로 줄 바꿈됩니다.</hp:t>
    </hp:run>
    <hp:linesegarray>
      <hp:lineseg textpos="0" vertpos="2000" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/>
    </hp:linesegarray>
  </hp:p>
  <hp:p id="3" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="2"><hp:t>빨강 12pt</hp:t></hp:run>
    <hp:run charPrIDRef="3"><hp:t> 굴림 14pt</hp:t></hp:run>
    <hp:linesegarray>
      <hp:lineseg textpos="0" vertpos="4000" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/>
    </hp:linesegarray>
  </hp:p>`;
}

function bodyTable() {
  // 02-table: 3x3 with merges
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:tbl id="1" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" rowCnt="3" colCnt="3" cellSpacing="0" borderFillIDRef="1" noAdjust="0">
        <hp:sz width="42000" widthRelTo="ABSOLUTE" height="9000" heightRelTo="ABSOLUTE" protect="0"/>
        <hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
        <hp:outMargin left="0" right="0" top="0" bottom="0"/>
        <hp:inMargin left="510" right="510" top="141" bottom="141"/>
        <hp:tr>
          <hp:tc name="A1B1" header="0" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="1">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
              <hp:p id="11" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
                <hp:run charPrIDRef="0"><hp:t>병합</hp:t></hp:run>
                <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="28000" flags="393216"/></hp:linesegarray>
              </hp:p>
            </hp:subList>
            <hp:cellAddr colAddr="0" rowAddr="0"/>
            <hp:cellSpan colSpan="2" rowSpan="1"/>
            <hp:cellSz width="28000" height="3000"/>
            <hp:cellMargin left="510" right="510" top="141" bottom="141"/>
          </hp:tc>
          <hp:tc name="C1" header="0" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="1">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
              <hp:p id="12" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
                <hp:run charPrIDRef="0"><hp:t>C</hp:t></hp:run>
                <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="14000" flags="393216"/></hp:linesegarray>
              </hp:p>
            </hp:subList>
            <hp:cellAddr colAddr="2" rowAddr="0"/>
            <hp:cellSpan colSpan="1" rowSpan="1"/>
            <hp:cellSz width="14000" height="3000"/>
            <hp:cellMargin left="510" right="510" top="141" bottom="141"/>
          </hp:tc>
        </hp:tr>
        <hp:tr>
          <hp:tc name="A2" header="0" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="1">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
              <hp:p id="21" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
                <hp:run charPrIDRef="0"><hp:t>A2</hp:t></hp:run>
                <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="14000" flags="393216"/></hp:linesegarray>
              </hp:p>
            </hp:subList>
            <hp:cellAddr colAddr="0" rowAddr="1"/>
            <hp:cellSpan colSpan="1" rowSpan="1"/>
            <hp:cellSz width="14000" height="3000"/>
            <hp:cellMargin left="510" right="510" top="141" bottom="141"/>
          </hp:tc>
          <hp:tc name="B2" header="0" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="1">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
              <hp:p id="22" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
                <hp:run charPrIDRef="0"><hp:t>B2</hp:t></hp:run>
                <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="14000" flags="393216"/></hp:linesegarray>
              </hp:p>
            </hp:subList>
            <hp:cellAddr colAddr="1" rowAddr="1"/>
            <hp:cellSpan colSpan="1" rowSpan="1"/>
            <hp:cellSz width="14000" height="3000"/>
            <hp:cellMargin left="510" right="510" top="141" bottom="141"/>
          </hp:tc>
          <hp:tc name="C2C3" header="0" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="1">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
              <hp:p id="23" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
                <hp:run charPrIDRef="0"><hp:t>세로병합</hp:t></hp:run>
                <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="14000" flags="393216"/></hp:linesegarray>
              </hp:p>
            </hp:subList>
            <hp:cellAddr colAddr="2" rowAddr="1"/>
            <hp:cellSpan colSpan="1" rowSpan="2"/>
            <hp:cellSz width="14000" height="6000"/>
            <hp:cellMargin left="510" right="510" top="141" bottom="141"/>
          </hp:tc>
        </hp:tr>
        <hp:tr>
          <hp:tc name="A3" header="0" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="1">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
              <hp:p id="31" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
                <hp:run charPrIDRef="0"><hp:t>A3</hp:t></hp:run>
                <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="14000" flags="393216"/></hp:linesegarray>
              </hp:p>
            </hp:subList>
            <hp:cellAddr colAddr="0" rowAddr="2"/>
            <hp:cellSpan colSpan="1" rowSpan="1"/>
            <hp:cellSz width="14000" height="3000"/>
            <hp:cellMargin left="510" right="510" top="141" bottom="141"/>
          </hp:tc>
          <hp:tc name="B3" header="0" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="1">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
              <hp:p id="32" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
                <hp:run charPrIDRef="0"><hp:t>B3</hp:t></hp:run>
                <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="14000" flags="393216"/></hp:linesegarray>
              </hp:p>
            </hp:subList>
            <hp:cellAddr colAddr="1" rowAddr="2"/>
            <hp:cellSpan colSpan="1" rowSpan="1"/>
            <hp:cellSz width="14000" height="3000"/>
            <hp:cellMargin left="510" right="510" top="141" bottom="141"/>
          </hp:tc>
        </hp:tr>
      </hp:tbl>
    </hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="9000" textheight="9000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

function bodyImage() {
  // 03-image: single image referencing BinData/image1.png
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:pic id="1" zOrder="1" numberingType="PICTURE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="">
        <hp:offset x="0" y="0"/>
        <hp:orgSz width="2000" height="1500"/>
        <hp:curSz width="1000" height="750"/>
        <hp:flip horizontal="0" vertical="0"/>
        <hp:rotationInfo angle="0" centerX="500" centerY="375"/>
        <hp:renderingInfo>
          <hc:transMatrix e1="1.0" e2="0.0" e3="0.0" e4="0.0" e5="1.0" e6="0.0"/>
          <hc:scaMatrix e1="1.0" e2="0.0" e3="0.0" e4="0.0" e5="1.0" e6="0.0"/>
          <hc:rotMatrix e1="1.0" e2="0.0" e3="0.0" e4="0.0" e5="1.0" e6="0.0"/>
        </hp:renderingInfo>
        <hp:imgRect>
          <hc:pt0 x="0" y="0"/>
          <hc:pt1 x="2000" y="0"/>
          <hc:pt2 x="2000" y="1500"/>
          <hc:pt3 x="0" y="1500"/>
        </hp:imgRect>
        <hp:imgClip left="0" top="0" right="0" bottom="0"/>
        <hp:img binaryItemIDRef="image1" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>
      </hp:pic>
    </hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1500" textheight="1500" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

function bodyShape() {
  // 04-shape: rect + ellipse
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:rect id="1" zOrder="2" numberingType="NONE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" ratio="0">
        <hp:offset x="100" y="100"/>
        <hp:orgSz width="800" height="400"/>
        <hp:curSz width="800" height="400"/>
        <hp:flip horizontal="0" vertical="0"/>
        <hp:rotationInfo angle="0" centerX="400" centerY="200"/>
        <hp:lineShape color="#000000" width="1mm" alpha="0" compoundType="SINGLE" type="SOLID" dashType="SOLID" headStyle="NORMAL" tailStyle="NORMAL" headfill="0" tailfill="0" headSz="SMALL_SMALL" tailSz="SMALL_SMALL" outlineStyle="NORMAL" miterLimit="0" lineEndCap="FLAT" join="MITER"/>
        <hp:fillBrush>
          <hc:winBrush faceColor="#FFC000" hatchColor="#000000" hatchStyle="NONE" alpha="0"/>
        </hp:fillBrush>
        <hp:drawText name="" lastWidth="0" editable="1"/>
      </hp:rect>
      <hp:ellipse id="2" zOrder="3" numberingType="NONE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" ratio="0">
        <hp:offset x="500" y="200"/>
        <hp:orgSz width="600" height="400"/>
        <hp:curSz width="600" height="400"/>
        <hp:flip horizontal="0" vertical="0"/>
        <hp:rotationInfo angle="30" centerX="300" centerY="200"/>
        <hp:lineShape color="#000000" width="1mm" alpha="0" compoundType="SINGLE" type="SOLID" dashType="SOLID" headStyle="NORMAL" tailStyle="NORMAL" headfill="0" tailfill="0" headSz="SMALL_SMALL" tailSz="SMALL_SMALL" outlineStyle="NORMAL" miterLimit="0" lineEndCap="FLAT" join="MITER"/>
        <hp:fillBrush>
          <hc:gradation type="LINEAR" angle="45" centerX="0" centerY="0" step="2" colors="#FFFFFF,#FF0000"/>
        </hp:fillBrush>
        <hp:drawText name="" lastWidth="0" editable="1"/>
      </hp:ellipse>
    </hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

function bodyFootnote() {
  // 05-footnote
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:t>본문 텍스트</hp:t>
      <hp:footNote id="1" numberingType="DIGIT" placement="EACH_COLUMN" beforeSpacing="170" lineLength="HALF" lineType="SOLID" lineWidth="0.12mm" autoNumFormat="DIGIT">
        <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
          <hp:p id="100" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
            <hp:run charPrIDRef="0"><hp:t>이것은 각주입니다.</hp:t></hp:run>
            <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
          </hp:p>
        </hp:subList>
      </hp:footNote>
      <hp:t>계속.</hp:t>
    </hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

function bodyHeaderFooter() {
  // 06-header-footer: secPr contains header/footer entries
  const body = `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0"><hp:t>본문</hp:t></hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
  const secPrInner = `<hp:grid lineGrid="0" charGrid="0"/>
    <hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>
    <hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>
    <hp:lineNumberShape restartType="NONE" countBy="0" distance="0" startNumber="0"/>
    <hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">
      <hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/>
    </hp:pagePr>
    <hp:footNotePr>
      <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
    </hp:footNotePr>
    <hp:endNotePr>
      <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
    </hp:endNotePr>
    <hp:header id="" applyPageType="BOTH">
      <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
        <hp:p id="200" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
          <hp:run charPrIDRef="0"><hp:t>문서제목</hp:t></hp:run>
          <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
        </hp:p>
      </hp:subList>
    </hp:header>
    <hp:footer id="" applyPageType="ODD">
      <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
        <hp:p id="201" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
          <hp:run charPrIDRef="0"><hp:t>쪽 </hp:t><hp:pageNum format="DIGIT"/></hp:run>
          <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
        </hp:p>
      </hp:subList>
    </hp:footer>
    <hp:footer id="" applyPageType="EVEN">
      <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
        <hp:p id="202" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
          <hp:run charPrIDRef="0"><hp:pageNum format="DIGIT"/><hp:t> 쪽</hp:t></hp:run>
          <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
        </hp:p>
      </hp:subList>
    </hp:footer>`;
  return { body, secPrInner };
}

function bodyField() {
  // 07-field: DATE and PAGE_NUM fields
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:fieldBegin id="1" type="DATE" format="yyyy-MM-dd" name="DATE_FIELD" editable="0"/>
      <hp:t>2026-05-22</hp:t>
      <hp:fieldEnd id="1" type="DATE"/>
      <hp:t> · 페이지 </hp:t>
      <hp:fieldBegin id="2" type="PAGE_NUM" name="PAGE_NUM_FIELD" editable="0"/>
      <hp:t>1</hp:t>
      <hp:fieldEnd id="2" type="PAGE_NUM"/>
    </hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

function bodyMultiColumn() {
  // 08-multi-column: secPr with cols
  const body = `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0"><hp:t>3단 본문 텍스트</hp:t></hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
  const secPrInner = `<hp:grid lineGrid="0" charGrid="0"/>
    <hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>
    <hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>
    <hp:lineNumberShape restartType="NONE" countBy="0" distance="0" startNumber="0"/>
    <hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">
      <hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/>
    </hp:pagePr>
    <hp:footNotePr>
      <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
    </hp:footNotePr>
    <hp:endNotePr>
      <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
    </hp:endNotePr>
    <hp:cols type="NEWSPAPER" layout="LEFT" colCount="3" sameSz="0" sameGap="0">
      <hp:col width="3200" gap="200"/>
      <hp:col width="2400" gap="200"/>
      <hp:col width="2400" gap="0"/>
      <hp:lineBetween type="SOLID" width="1.0" color="#000000"/>
    </hp:cols>`;
  return { body, secPrInner };
}

function bodyNumbering() {
  // 09-numbering: paragraphs that reference numbering id=1
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0"><hp:t>레벨1 항목</hp:t></hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>
  <hp:p id="2" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0"><hp:t>레벨2 항목</hp:t></hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>
  <hp:p id="3" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0"><hp:t>레벨3 항목</hp:t></hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

function bodyRuby() {
  // 10-ruby
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:ruby align="CENTER" sizeRatio="50" mainText="人" rubyText="사람"/>
      <hp:t>이라는 한자.</hp:t>
    </hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

function bodyHyperlink() {
  // 11-hyperlink
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:hyperlink url="https://yatavent.com" tooltip="홈" target="_self"><hp:t>홈으로</hp:t></hp:hyperlink>
    </hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

function bodyBookmark() {
  // 12-bookmark
  return `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:bookmark name="bm1" id="1"/>
      <hp:t>여기가 책갈피 위치</hp:t>
    </hp:run>
    <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>
  </hp:p>`;
}

// ---------------------------------------------------------------------------
// Tiny 1x1 PNG (used by 03-image fixture as BinData/image1.png)
// ---------------------------------------------------------------------------
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
function tinyPng() {
  return Uint8Array.from(Buffer.from(TINY_PNG_BASE64, 'base64'));
}

// ---------------------------------------------------------------------------
// Scenario registry
// ---------------------------------------------------------------------------
const SCENARIOS = [
  { dir: '01-paragraph', title: '01-paragraph', build: bodyParagraph },
  { dir: '02-table', title: '02-table', build: bodyTable },
  { dir: '03-image', title: '03-image', build: bodyImage, addImage: true },
  { dir: '04-shape', title: '04-shape', build: bodyShape },
  { dir: '05-footnote', title: '05-footnote', build: bodyFootnote },
  { dir: '06-header-footer', title: '06-header-footer', build: bodyHeaderFooter, splitSecPr: true },
  { dir: '07-field', title: '07-field', build: bodyField },
  { dir: '08-multi-column', title: '08-multi-column', build: bodyMultiColumn, splitSecPr: true },
  { dir: '09-numbering', title: '09-numbering', build: bodyNumbering, withNumbering: true },
  { dir: '10-ruby', title: '10-ruby', build: bodyRuby },
  { dir: '11-hyperlink', title: '11-hyperlink', build: bodyHyperlink },
  { dir: '12-bookmark', title: '12-bookmark', build: bodyBookmark },
];

// ---------------------------------------------------------------------------
// ZIP assembly per scenario
// ---------------------------------------------------------------------------
async function buildScenario(scenario) {
  const zip = new JSZip();

  // mimetype MUST be the first entry and STORED (no compression)
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

  // META-INF
  zip.file('META-INF/container.xml', buildContainerXml());
  zip.file('META-INF/manifest.xml', buildManifestXml());

  // Contents
  zip.file('Contents/content.hpf', buildContentHpf(scenario.title));
  zip.file(
    'Contents/header.xml',
    buildHeaderXml({ withNumbering: !!scenario.withNumbering })
  );

  let bodyInner;
  let secPrInner;
  if (scenario.splitSecPr) {
    const out = scenario.build();
    bodyInner = out.body;
    secPrInner = out.secPrInner;
  } else {
    bodyInner = scenario.build();
    secPrInner = '';
  }
  zip.file('Contents/section0.xml', wrapSection(bodyInner, { secPrInnerXml: secPrInner }));

  // Top-level
  zip.file('version.xml', buildVersionXml(), { compression: 'STORE' });
  zip.file('settings.xml', buildSettingsXml());

  // BinData (only image scenario)
  if (scenario.addImage) {
    zip.file('BinData/image1.png', tinyPng(), { compression: 'STORE' });
  }

  // Generate as nodebuffer (so we can writeFile directly)
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: 'application/hwp+zip',
  });

  const outDir = join(GOLDEN_ROOT, scenario.dir);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'fixture.hwpx');
  writeFileSync(outPath, buffer);
  return { dir: scenario.dir, path: outPath, size: buffer.length };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!existsSync(GOLDEN_ROOT)) {
    console.error(`tests/golden directory not found at ${GOLDEN_ROOT}`);
    process.exit(1);
  }

  console.log(`Building ${SCENARIOS.length} synthetic HWPX fixtures...`);
  const results = [];
  for (const scenario of SCENARIOS) {
    try {
      const result = await buildScenario(scenario);
      console.log(`  ✓ ${result.dir}/fixture.hwpx (${result.size.toLocaleString()} bytes)`);
      results.push(result);
    } catch (err) {
      console.error(`  ✗ ${scenario.dir}: ${err.message}`);
      throw err;
    }
  }

  console.log(`\nDone. ${results.length}/${SCENARIOS.length} fixtures generated.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
